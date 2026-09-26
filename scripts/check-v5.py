"""Offline acceptance for HOMESPLIT v5. External/browser checks are separate."""
import json,re,subprocess,sys,xml.etree.ElementTree as ET
from urllib.parse import urlsplit,unquote
from urllib.robotparser import RobotFileParser
from seo_common import ROOT,BASE,pages,BeautifulSoup
checks=[]
def check(name,ok,detail=''):
 checks.append({'check':name,'pass':bool(ok),'detail':detail});print(('PASS ' if ok else 'FAIL ')+name+(' — '+detail if detail else ''))
def nodes(soup):
 for tag in soup.select('script[type="application/ld+json"]'):
  data=json.loads(tag.string)
  yield from data.get('@graph',[data]) if isinstance(data,dict) else data
robots=(ROOT/'robots.txt').read_text();check('P0-1 robots groups',robots.count('Disallow: /clawland/')==2 and all(s in robots for s in ['Claude-SearchBot','Perplexity-User','Applebot','Sitemap:']) and 'admin' not in robots)
rp=RobotFileParser();rp.parse(robots.splitlines());check('P0-1 all crawlers blocked only under clawland',all(not rp.can_fetch(b,'https://thinkbigtw.com/clawland/example') and rp.can_fetch(b,BASE+'enterprise/') for b in ['*','GPTBot','Claude-SearchBot','Perplexity-User','Applebot','Bingbot']))
allhtml=list(ROOT.rglob('*.html'));check('P0-2 no hreflang',not any('hreflang=' in p.read_text() for p in allhtml) and 'hreflang' not in (ROOT/'sitemap.xml').read_text())
entity=json.loads((ROOT/'data/seo-entity.json').read_text());definition=entity['description'];errors=[];article_count=0;faq_errors=[];link_errors=[];css_errors=[];price_errors=[]
for p,url,soup in pages():
 rel=str(p.relative_to(ROOT));graph=list(nodes(soup));org=next((x for x in graph if x.get('@id')==BASE+'#organization'),None)
 if not org or org.get('name')!='Think BIG' or org.get('logo',{}).get('url')!=BASE+'images/logo-nobg.png':errors.append(rel+' organization')
 if not any(x.get('@id')==BASE+'#website' and x.get('@type')=='WebSite' for x in graph):errors.append(rel+' website')
 for n in graph:
  if n.get('@type')=='Article':
   article_count+=1
   if not all(k in n for k in ('author','publisher','image','dateModified','datePublished')) or not any(x.get('@type')=='BreadcrumbList' for x in graph):errors.append(rel+' article')
 for tag in soup.select('a[href],img[src],script[src],link[href]'):
  href=tag.get('href',tag.get('src',''));u=urlsplit(href)
  if u.scheme or u.netloc or not u.path:continue
  target=ROOT/unquote(u.path.lstrip('/')) if u.path.startswith('/') else p.parent/unquote(u.path)
  if target.is_dir():target=target/'index.html'
  if not target.exists():link_errors.append(rel+': '+href)
 if len(soup.select('link[rel=stylesheet]'))>1:css_errors.append(rel)
 if rel in ['pricing/personal/index.html','openclaw-starter/index.html','hermes-starter/index.html','full-agent/index.html','dual-agent/index.html','skill-pack/index.html','annual-pro/index.html','annual-flagship/index.html','solo-pro/index.html']:
  old=subprocess.check_output(['git','show','HEAD:'+rel],cwd=ROOT,text=True)
  def prices(s):return re.findall(r'(?:NT\$|NTD|TWD|US\$|\$)\s*[\d,]+(?:\.\d+)?',s)
  def visible(raw):
   doc=BeautifulSoup(raw,'html.parser')
   for tag in doc.select('script,style'):tag.decompose()
   return doc.get_text(' ',strip=True)
  if prices(visible(old))!=prices(visible(p.read_text())):price_errors.append(rel)
  def offers(raw):
   found=[]
   def walk(n):
    if isinstance(n,list):
     for x in n:walk(x)
    if isinstance(n,dict):
     if n.get('@type')=='Offer':found.append((n.get('price'),n.get('priceCurrency')))
     for x in n.values():walk(x)
   for x in nodes(BeautifulSoup(raw,'html.parser')):walk(x)
   return sorted(found,key=str)
  if offers(old)!=offers(p.read_text()):price_errors.append(rel+': Offer prices')
  for phrase in ['48 小時','48小時','發現即修復']:
   if visible(old).count(phrase)!=visible(p.read_text()).count(phrase):price_errors.append(rel+': '+phrase)
# Cover every FAQPage, including retained pages outside the sitemap. Ignore only
# whitespace, never punctuation or wording; scripts cannot validate themselves.
def norm(text):return re.sub(r'\s+','',text)
faq_count=0;faq_pages=0
for p in allhtml:
 soup=BeautifulSoup(p.read_text(),'html.parser');graph=list(nodes(soup))
 for tag in soup.select('script,style,template,[hidden],[aria-hidden="true"]'):tag.decompose()
 visible=norm(soup.get_text(' ',strip=True))
 for n in graph:
  if n.get('@type')!='FAQPage':continue
  faq_pages+=1
  for q in n.get('mainEntity',[]):
   faq_count+=1
   answer=q.get('acceptedAnswer',{}).get('text','');question=q.get('name','')
   if not question or not answer or norm(question) not in visible or norm(answer) not in visible:faq_errors.append(str(p.relative_to(ROOT))+': '+question)
check('P0-9 faq_match across all HTML',not faq_errors and faq_count>0, '; '.join(faq_errors) or f'{faq_count} questions / {faq_pages} FAQPage graphs')
check('P0-3 all 30 entity graphs',not errors, '; '.join(errors))
check('P0-3 generated graphs current (read-only)',subprocess.run([sys.executable,str(ROOT/'scripts/sync-seo-graph.py'),'--check'],capture_output=True).returncode==0)
check('P0-3 full organization decisions',entity['vatID']=='62136066' and entity['email']=='AI@thinkbigtw.com' and 'foundingDate' not in entity and len(entity['sameAs'])==4)
harness=BeautifulSoup((ROOT/'harness/index.html').read_text(),'html.parser');check('P0-4 Chinese FAQ matches visible content',not faq_errors and harness.html['lang']=='zh-Hant' and len(harness.title.get_text())<=40 and next(n for n in nodes(harness) if n.get('@type')=='WebPage')['inLanguage']=='zh-Hant')
check('P0-5 sitemap git dates',subprocess.run([sys.executable,str(ROOT/'scripts/build-sitemap.py'),'--check'],capture_output=True).returncode==0)
llms=(ROOT/'llms.txt').read_text();sitemap=(ROOT/'sitemap.xml').read_text();count=len(list(ET.fromstring(sitemap).iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')))
check('P0-6 llms format / disclosures / full body count',llms.startswith('# ') and llms.splitlines()[2].startswith('> ') and '## Optional' in llms and '不含第三方模型用量費' in llms and not re.search('智能體|enterprise-cloud|enterprise-local',llms) and (ROOT/'llms-full.txt').read_text().count('URL: ')==count,str(count)+' URL sections')
check('P0-7 static definitions',all(any(p.get_text()==definition for p in BeautifulSoup((ROOT/f).read_text(),'html.parser').select('main p')) for f in ['index.html','enterprise/index.html','trust/index.html','guides/index.html','pricing/index.html']) and definition in llms)
check('P0-8 seven Articles / CollectionPage',article_count==7 and len(BeautifulSoup((ROOT/'guides/index.html').read_text(),'html.parser').select('script[type="application/ld+json"]'))==1 and (ROOT/'guides/index.html').read_text().count('"hasPart"')==1,str(article_count)+' articles')
scanned=[ROOT/'index.html',ROOT/'llms.txt']+[p for folder in ['enterprise','pricing','guides'] for p in (ROOT/folder).rglob('*.html')]
check('P0-9 naming / links',not any(re.search('智能體|引擎',p.read_text()) for p in scanned) and not re.search('enterprise-cloud|enterprise-local',(ROOT/'enterprise/index.html').read_text()) and not re.search(r'href="/(?:annual|gift|lobster)/"',(ROOT/'pricing/personal/index.html').read_text()))
check('P0-10 explicit favicon on audited pages',all(BeautifulSoup((ROOT/f).read_text(),'html.parser').find('link',rel='icon') for f in ['index.html','enterprise/index.html','pricing/personal/index.html']))
check('P0-10 CSS <= 1 static + 1 assistant',not css_errors, '; '.join(css_errors))
check('P0-10 video deferred / posters sized',all((lambda soup: all(v.get('preload') in ['none','metadata'] and v.source.get('data-src') and not v.source.get('src') for v in soup.select('video')) and all(i.has_attr('width') and i.has_attr('height') for i in soup.select('.hero-poster,.personal-reduced-poster')))(BeautifulSoup((ROOT/f).read_text(),'html.parser')) for f in ['index.html','pricing/personal/index.html']))
check('Hard rule: exact personal prices and 48-hour promises',not price_errors, '; '.join(price_errors))
check('Hard rule: no ratings or reviews',not any(re.search(r'"(?:aggregateRating|Review|ratingValue)"',p.read_text()) for p in allhtml))
check('Local URLs and assets',not link_errors,'; '.join(link_errors))
check('GA4 retained',all('G-7V41XYLLP5' in p.read_text() for p,_,_ in pages()))
check('No tracked file deleted',all((ROOT/x).exists() for x in subprocess.check_output(['git','ls-files'],cwd=ROOT,text=True).splitlines()))
check('No infrastructure config changes',subprocess.check_output(['git','diff','--name-only','--','workers/headers-injector','workers/ai-proxy/wrangler.toml','.github'],cwd=ROOT,text=True)=='')
check('Old logging removed',not any(x in (ROOT/'workers/ai-proxy/src/index.js').read_text() for x in ['THINKBIG_KNOWLEDGE','thinkbig_cs_logs','CS_LOG_SUPABASE']))
print(json.dumps({'passed':sum(x['pass'] for x in checks),'total':len(checks)},ensure_ascii=False))
sys.exit(0 if all(x['pass'] for x in checks) else 1)
