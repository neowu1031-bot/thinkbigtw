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
for rel in ['index.html','enterprise/index.html','trust/index.html']:
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
 record(rel+': substantial static text',len(soup.select_one('main').get_text())>500)
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
record('sitemap preserves all URLs and adds trust',old_urls<new_urls and 'https://thinkbigtw.com/trust/' in new_urls)
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
print(json.dumps({'passed':sum(r['pass'] for r in results),'total':len(results),'failed':[r for r in results if not r['pass']],'checks':results},ensure_ascii=False,indent=2))
raise SystemExit(1 if any(not r['pass'] for r in results) else 0)
