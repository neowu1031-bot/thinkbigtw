"""Offline verification; requires the pre-existing beautifulsoup4 and Pillow.
This does not replace a real-browser 375px and Lighthouse review.
"""
import json,re,subprocess
from pathlib import Path
from urllib.parse import urlsplit,unquote
from bs4 import BeautifulSoup
from PIL import Image
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
results=[]
def record(name,ok,detail=''):
 results.append({'check':name,'pass':bool(ok),'detail':detail})
def original(path):
 p=subprocess.run(['git','show','HEAD:'+str(path)],cwd=ROOT,capture_output=True,text=True)
 return p.stdout if p.returncode==0 else ''
def prices(text):return re.findall(r'(?:NT\$|NTD|TWD|US\$|\$)\s*[\d,]+(?:\.\d+)?',text)
def missing_links(path,source,baseline=False):
 soup=BeautifulSoup(source,'html.parser'); missing=[]
 for tag in soup.select('[href],[src]'):
  val=tag.get('href') or tag.get('src');u=urlsplit(val)
  if u.scheme or u.netloc or not u.path:continue
  target=ROOT/unquote(u.path.lstrip('/')) if u.path.startswith('/') else (ROOT/path).parent/unquote(u.path)
  if target.is_dir():target=target/'index.html'
  if not target.exists():missing.append(val)
 return set(missing)
CORE=['index.html','enterprise/index.html','trust/index.html','enterprise/departments/index.html','enterprise/process/index.html','enterprise/process/worksheet/index.html','guides/index.html','guides/choose-ai-partner/index.html','guides/local-ai-data/index.html','guides/ai-acceptance/index.html']
for rel in CORE:
 s=(ROOT/rel).read_text();soup=BeautifulSoup(s,'html.parser');base=original(rel)
 record(rel+': static landmarks',len(soup.select('h1'))==1 and len(soup.select('#tb-nav'))==1 and len(soup.select('#tb-footer'))==1)
 record(rel+': analytics',s.count("gtag('config', 'G-7V41XYLLP5')")+s.count("gtag('config','G-7V41XYLLP5')")==1)
 can=soup.select_one('link[rel=canonical]');expected='https://thinkbigtw.com/'+('' if rel=='index.html' else rel.replace('index.html',''))
 record(rel+': canonical',can and can['href']==expected)
 graph=[]
 for tag in soup.select('script[type="application/ld+json"]'):
  try:graph+=json.loads(tag.string)['@graph']
  except Exception as e:record(rel+': schema parse',False,str(e))
 record(rel+': schema',bool(graph))
 faqs=[x for x in graph if x['@type']=='FAQPage']
 if faqs:
  visible=[(d.summary.get_text(strip=True),d.p.get_text(strip=True)) for d in soup.select('.faq details')]
  structured=[(q['name'],q['acceptedAnswer']['text']) for q in faqs[0]['mainEntity']]
  record(rel+': visible FAQ matches JSON-LD',visible==structured)
 record(rel+': no broken local asset/page links',not missing_links(Path(rel),s),','.join(missing_links(Path(rel),s)))
 record(rel+': no enterprise prices / prohibited wording',not prices(s) and '引擎' not in s)
 ids=[x['id'] for x in soup.select('[id]')]
 record(rel+': unique IDs',len(ids)==len(set(ids)))
 for a in soup.select('a[href^="#"]'):
  record(rel+': anchor '+a['href'],a['href'][1:] in ids)
 # Every essential text is in the file itself, not an injected image/script.
 record(rel+': substantial static text',len(soup.select_one('main').get_text())>250)
for p in ROOT.rglob('*.html'):
 rel=p.relative_to(ROOT)
 if any(x in rel.parts for x in ['.git','workers','supabase']):continue
 old=original(rel)
 if not old:continue
 new=p.read_text()
 if new==old:continue
 if str(rel) not in ['index.html','enterprise/index.html','og-image.html']:
  record(str(rel)+': price tokens unchanged',prices(old)==prices(new))
  price_keys=r'"(?:price|lowPrice|highPrice|priceCurrency)"\s*:\s*"[^"]*"'
  record(str(rel)+': structured prices unchanged',re.findall(price_keys,old)==re.findall(price_keys,new))
 old_s=BeautifulSoup(old,'html.parser');new_s=BeautifulSoup(new,'html.parser')
 if old_s.select_one('link[rel=canonical]'):
  record(str(rel)+': canonical retained',str(old_s.select_one('link[rel=canonical]'))==str(new_s.select_one('link[rel=canonical]')))
 if 'G-7V41XYLLP5' in old:record(str(rel)+': GA4 retained','G-7V41XYLLP5' in new)
 new_broken=missing_links(rel,new)-missing_links(rel,old)
 record(str(rel)+': no new broken page/assets',not new_broken,','.join(new_broken))
 if 'id="tb-nav"' in new:
  record(str(rel)+': one shared header/footer',len(new_s.select('#tb-nav'))==1 and len(new_s.select('#tb-footer'))==1)
ns={'s':'http://www.sitemaps.org/schemas/sitemap/0.9'}
old_urls={e.text for e in ET.fromstring(original(Path('sitemap.xml'))).findall('.//s:loc',ns)}
new_urls={e.text for e in ET.parse(ROOT/'sitemap.xml').findall('.//s:loc',ns)}
record('sitemap preserves all URLs including trust',old_urls<=new_urls and 'https://thinkbigtw.com/trust/' in new_urls)
old_urls=set(re.findall(r'https://thinkbigtw.com[^\s)]+',original(Path('llms.txt'))));new_urls=set(re.findall(r'https://thinkbigtw.com[^\s)]+',(ROOT/'llms.txt').read_text()))
record('llms preserves existing links',old_urls<=new_urls)
record('llms preserves all price tokens',prices(original(Path('llms.txt')))==prices((ROOT/'llms.txt').read_text()))
for f in ['thinkbig-dark.png','thinkbig-light.png']:
 im=Image.open(ROOT/'assets/brand'/f)
 record(f+': transparent PNG',im.mode=='RGBA' and im.getextrema()[3][0]==0 and im.getextrema()[3][1]==255,str(im.size))
record('OG dimensions',Image.open(ROOT/'assets/brand/thinkbig-og.jpg').size==(1200,630))
tracked=subprocess.check_output(['git','ls-files'],cwd=ROOT,text=True).splitlines()
record('no existing tracked URLs/files deleted',all((ROOT/p).exists() for p in tracked))
changes=subprocess.check_output(['git','diff','--name-only'],cwd=ROOT,text=True).splitlines()
record('no infrastructure edits',not any(p.startswith(('workers/','supabase/','.github/')) or 'wrangler' in p for p in changes))
# Round 2: diagnosis privacy contract and original personal maintenance promises.
home=BeautifulSoup((ROOT/'index.html').read_text(),'html.parser')
record('homepage has one personal section',len(home.select('.home-section[data-audience="personal"]'))==1)
record('diagnosis has six static questions',len(home.select('#readiness fieldset'))==6)
record('diagnosis has static result explanations',len(home.select('[data-result-stage]'))==3 and len(home.select('[data-result-action]'))==8)
record('diagnosis CTA contains no answers',home.select_one('#quiz-result a')['href']=='/enterprise/#consult')
quiz=(ROOT/'assets/homesplit/readiness.js').read_text()
record('diagnosis has no network/storage/analytics APIs',not re.search(r'fetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie|gtag\s*\(|dataLayer',quiz))
for rel in CORE+['pricing/enterprise/index.html','enterprise-local/index.html','enterprise-cloud/index.html']:
 soup=BeautifulSoup((ROOT/rel).read_text(),'html.parser')
 if rel=='index.html':
  hero=soup.select_one('main>.brand-hero')
  record('homepage mascot confined to first screen',hero is not None and len(soup.select('video'))==1 and len(hero.select('video'))==1 and all('assets/brand/' in i.get('src','') or i in hero.select('img') for i in soup.select('img')))
  v=hero.select_one('video')
  record('homepage accessible poster and opt-in media load',all(k in v.attrs for k in ['autoplay','muted','loop','playsinline']) and v.get('poster')=='/assets/neo_hero_wide_poster.jpg' and v.select_one('source').get('data-src')=='/assets/neo_hero_wide.mp4' and not v.select_one('source').has_attr('src') and hero.select_one('img[fetchpriority="high"]') is not None)
 else:
  record(rel+': enterprise has no mascot or photo',not soup.select('video') and all('assets/brand/' in i.get('src','') for i in soup.select('img')))
 record(rel+': no delivery duration promise',not re.search(r'\d+\s*(?:天|個月|小時).{0,12}(?:交付|上線|修復)',soup.get_text()))
pattern=r'48(?: 小時(?:故障修復保證|故障修復|故障保固|內修復|修復)?|hr (?:修復保證|故障修復)|-hour (?:fault fixes|fault-fix guarantee))'
for rel in ['annual/index.html','annual-pro/index.html','annual-flagship/index.html','solo-pro/index.html','pricing/index.html','pricing/personal/index.html','guides/openclaw-safe/index.html','guides/hermes-vs-openclaw/index.html','llms.txt']:
 main=subprocess.check_output(['git','show','main:'+rel],cwd=ROOT,text=True)
 current=(ROOT/rel).read_text()
 record(rel+': exact 48-hour phrases restored from main',re.findall(pattern,main)==re.findall(pattern,current))
 record(rel+': original immediate repair wording restored',main.count('發現即修復')==current.count('發現即修復'))
personal=BeautifulSoup((ROOT/'pricing/personal/index.html').read_text(),'html.parser')
video=personal.select_one('video')
baseline_video=BeautifulSoup(original(Path('pricing/personal/index.html')),'html.parser').select_one('video')
record('personal mascot and approved playback configuration preserved',video and video.attrs==baseline_video.attrs and video.select_one('source')['src']==baseline_video.select_one('source')['src']=='/assets/neo_hero_wide.mp4')
for a in personal.select('#directory a'):
 record('personal directory '+a['href'],(ROOT/a['href'].strip('/')/'index.html').exists())
# Round 3 contract: presentation changed; section architecture and diagnosis remain.
enterprise=BeautifulSoup((ROOT/'enterprise/index.html').read_text(),'html.parser')
record('enterprise hero contains accessible static architecture',enterprise.select_one('.enterprise-hero .governance-model[aria-labelledby]') is not None and '架構示意' in enterprise.select_one('.governance-model').get_text())
for rel in ['index.html','enterprise/index.html','enterprise/process/index.html']:
 soup=BeautifulSoup((ROOT/rel).read_text(),'html.parser')
 record(rel+': four named method stages',len(soup.select('.method-map>li'))==4 and [e.get_text(strip=True) for e in soup.select('.method-map .method-en')]==['ASSESS','BUILD','VALIDATE','OPERATE'])
for rel in CORE:
 soup=BeautifulSoup((ROOT/rel).read_text(),'html.parser')
 record(rel+': title and social title match',soup.title.get_text(strip=True)==soup.select_one('meta[property="og:title"]')['content']==soup.select_one('meta[name="twitter:title"]')['content'])
 record(rel+': descriptions synchronized',soup.select_one('meta[name="description"]')['content']==soup.select_one('meta[property="og:description"]')['content']==soup.select_one('meta[name="twitter:description"]')['content'])
old_home=BeautifulSoup(original(Path('index.html')),'html.parser')
record('homepage separates hero and diagnosis, remaining audience order retained',[s['data-audience'] for s in home.select('.home-section')]==['enterprise']+[s['data-audience'] for s in old_home.select('.home-section')])
record('homepage diagnosis is second screen',home.select('.home-section')[1].select_one('#readiness') is not None)
record('system visual layer on marketing pages',all('/assets/homesplit/apple.css' in (ROOT/p).read_text() for p in CORE+['pricing/personal/index.html','pricing/enterprise/index.html']))
record('enterprise local navigation present',all(BeautifulSoup((ROOT/p).read_text(),'html.parser').select_one('.enterprise-local-nav') is not None for p in CORE if p not in ['index.html','guides/index.html']))
record('diagnosis answer values unchanged',[(i.get('name'),i.get('value')) for i in home.select('#readiness input')]==[(i.get('name'),i.get('value')) for i in old_home.select('#readiness input')])
print(json.dumps({'passed':sum(r['pass'] for r in results),'total':len(results),'failed':[r for r in results if not r['pass']],'checks':results},ensure_ascii=False,indent=2))
raise SystemExit(1 if any(not r['pass'] for r in results) else 0)
