"""v6b static content checks; real wrapping remains a five-width browser review."""
import json,re,subprocess
from seo_common import ROOT,pages,BeautifulSoup

results=[]
def check(name,ok):
 results.append(bool(ok));print(('PASS ' if ok else 'FAIL ')+name)
entity=json.loads((ROOT/'data/seo-entity.json').read_text());definition=entity['description']
expected='Think BIG（大想成業有限公司）是總部位於台灣、服務全球的企業 AI Agent 導入商，以 TB FRAME（我們的四階段導入方法：評估、建置、驗證、維運）方法論協助企業把 AI Agent 部署在公司自己的設備上、資料留在公司內，並提供一年陪跑維運；另有個人 AI 助理安裝方案。'
check('exact globally served company definition',definition==expected)
for rel in ['index.html','enterprise/index.html','trust/index.html','guides/index.html','pricing/index.html','about/index.html']:
 soup=BeautifulSoup((ROOT/rel).read_text(),'html.parser')
 check(rel+': visible exact definition',sum(p.get_text()==expected for p in soup.select('main p'))==1)
for rel in ['llms.txt','llms-full.txt','data/agent-kb/02-company.md','workers/ai-proxy/src/agent-kb.generated.js']:
 check(rel+': global definition synchronized',expected in (ROOT/rel).read_text())
errors=[];areas=[];addresses=[]
def walk(n,path):
 if isinstance(n,list):
  for item in n:walk(item,path)
 elif isinstance(n,dict):
  if 'areaServed' in n:
   areas.append(path)
   if n['areaServed']!='Worldwide':errors.append(path+' areaServed')
  if n.get('@type')=='PostalAddress':
   addresses.append(path)
   if n!={'@type':'PostalAddress','addressCountry':'TW'}:errors.append(path+' address')
  for item in n.values():walk(item,path)
for p in ROOT.rglob('*.html'):
 soup=BeautifulSoup(p.read_text(),'html.parser')
 for tag in soup.select('script[type="application/ld+json"]'):walk(json.loads(tag.string),str(p.relative_to(ROOT)))
walk(entity,'data/seo-entity.json')
check('every areaServed is Worldwide and every PostalAddress country-only',bool(areas) and bool(addresses) and not errors)
published=[*ROOT.rglob('*.html'),ROOT/'llms.txt',ROOT/'llms-full.txt',ROOT/'data/seo-entity.json',*(ROOT/'data/agent-kb').glob('*.md'),ROOT/'workers/ai-proxy/src/agent-kb.generated.js',ROOT/'assets/agent-faq.generated.js']
check('no old address fields, city/district address or old company definition in published sources',not any(re.search(r'新北市|板橋區|addressLocality|addressRegion|streetAddress|postalCode|是台灣的企業 AI Agent 導入商',p.read_text()) for p in published))
about=BeautifulSoup((ROOT/'about/index.html').read_text(),'html.parser')
check('About retains legal name and VAT ID with worldwide scope',all(t in about.main.get_text() for t in ['大想成業有限公司','62136066','總部位於台灣，服務範圍涵蓋全球']))
order_errors=[];heading_errors=[];punct_count=0
for p,_,soup in pages():
 for head in soup.select('.section-head'):
  for node in head.select('p,h2'):
   if node.name=='h2':break
   if 'eyebrow' not in node.get('class',[]):order_errors.append(str(p))
  prev=head.find_previous_sibling()
  if prev and 'tb-definition' in prev.get('class',[]):order_errors.append(str(p))
 # Newly added pages and two v7 content corrections have their own explicit checks.
 rel=str(p.relative_to(ROOT))
 baseline=subprocess.run(['git','show','HEAD:'+rel],cwd=ROOT,text=True,capture_output=True)
 if baseline.returncode==0 and rel not in ['harness/index.html','guides/hermes-vs-openclaw/index.html','trust/index.html']:
  old=BeautifulSoup(baseline.stdout,'html.parser')
  def headings(doc):
   doc=BeautifulSoup(str(doc),'html.parser')
   for note in doc.select('.term-explanation'):note.decompose()
   return [h.get_text() for h in doc.select('h1,h2')]
  if headings(soup)!=headings(old):heading_errors.append(str(p))
 punct_count+=len(soup.select('.punct'))
check('section eyebrow/title precedes all descriptions',not order_errors)
check('heading characters preserved after punctuation wrapping',not heading_errors and punct_count>0)
home=BeautifulSoup((ROOT/'index.html').read_text(),'html.parser')
check('READINESS definition below title and final phrase protected',home.select_one('.readiness-section .section-head > .tb-definition .keep-phrase') is not None)
css=(ROOT/'assets/homesplit/apple.css').read_text()
check('shared CJK wrapping, phrase protection and fallback/native punctuation rules',all(x in css for x in ['text-wrap:balance','text-wrap:pretty','line-break:strict','word-break:normal','max-width:36em','@supports(text-spacing-trim:trim-both)','.title-tail,.keep-phrase{white-space:nowrap}']))
print(json.dumps({'passed':sum(results),'total':len(results),'areaServed':len(areas),'countryOnlyAddresses':len(addresses),'punctuationMarks':punct_count,'errors':errors+order_errors+heading_errors},ensure_ascii=False))
raise SystemExit(0 if all(results) else 1)
