"""V8 static acceptance. Browser layout is explicitly checked by review-v8.cjs."""
import json,re,subprocess
from pathlib import Path
from urllib.parse import urlsplit
from PIL import Image
from seo_common import ROOT,pages,BeautifulSoup
results=[]
def check(name,ok):
 results.append(bool(ok));print(('PASS ' if ok else 'FAIL ')+name)
def doc(rel):return BeautifulSoup((ROOT/rel).read_text(),'html.parser')
personal=doc('pricing/personal/index.html')
check('two-line personal heading with explicit break and no colon',len(personal.h1.select('br'))==1 and list(personal.h1.stripped_strings)==['個人 AI 助理方案','入門、工作組合與年約'])
check('mascot video retained, caption removed',personal.select_one('.personal-mascot video') is not None and not personal.select_one('.personal-mascot figcaption'))
check('exact USB copy',personal.select_one('#usb p').get_text()=='實體版資訊尚未公開，敬請期待。')
check('review title and capture disclosure',personal.select_one('#personal-reviews-title').get_text()=='蝦皮賣場 AI 服務評價全數 5 星' and '擷取日 2026/09/27' in personal.select_one('#personal-reviews').get_text())
for name in ['openclaw','hermes']:
 card=personal.select_one('a.variant[href="/'+name+'-starter/"]');img=card.img
 check(name+': native card link, responsive lazy art, no nested link',not card.select('a') and img['loading']=='lazy' and img['alt'] and all(str(n)+'w' in img['srcset'] for n in [240,480]))
 for size in [240,480]:
  p=ROOT/('assets/illustrations/personal-'+name+('-240' if size==240 else '')+'.webp');im=Image.open(p)
  check(p.name+': square WebP <= 30KB',im.format=='WEBP' and im.size==(size,size) and p.stat().st_size<30000)
rag=doc('enterprise/rag/index.html');graph=json.loads(rag.select_one('script[type="application/ld+json"]').string)['@graph'];article=next(n for n in graph if n.get('@type')=='Article')
check('RAG static article, author and enterprise breadcrumb',len(rag.select('main'))==1 and len(rag.select('h1'))==1 and article['author']['@id']=='https://thinkbigtw.com/#editorial' and any(n.get('name')=='Think BIG 編輯部' for n in graph) and any(n.get('@type')=='BreadcrumbList' and n['itemListElement'][1]['item']=='https://thinkbigtw.com/enterprise/' for n in graph))
check('RAG has all seven visible Q&A sections, no FAQPage, no mascot',all(rag.select_one('#'+id+' h2') for id in ['chat','fine-tuning','prepare','privacy','acceptance','failures','thinkbig']) and 'FAQPage' not in str(rag) and not rag.select('.personal-card-art,.personal-mascot,video'))
check('RAG definition and trust/consult links',all(x in rag.select_one('.rag-definition').get_text() for x in ['檢索增強生成','相關段落','引用出處']) and rag.select_one('a[href="/trust/"]') and rag.select_one('a[href="/enterprise/#consult"]'))
for rel in ['enterprise/index.html','enterprise/departments/index.html','guides/glossary/index.html']:
 check(rel+': inbound RAG link',doc(rel).select_one('a[href="/enterprise/rag/"]') is not None)
for rel in ['sitemap.xml','llms.txt','llms-full.txt','data/agent-kb/05-capabilities.md','workers/ai-proxy/src/agent-kb.generated.js']:
 check(rel+': RAG discoverable','/enterprise/rag/' in (ROOT/rel).read_text())
diagram=doc('enterprise/index.html').select_one('.governance-model')
check('governance remains HTML text, decorative SVG and accessible pause',all(t in diagram.get_text() for t in ['企業決策與授權','知識與資料','AI Agent 協作','治理與驗證','資料主權']) and len(diagram.select('svg[aria-hidden=true] path'))==6 and diagram.select_one('button[aria-pressed=false]') is not None and not diagram.select('img'))
public=[p for p,_,_ in pages()]+[ROOT/'404.html',ROOT/'erp/index.html',*sorted((ROOT/'tbos/en').glob('*.html'))]
manifest=json.loads((ROOT/'data/css-bundles.json').read_text());errors=[]
for p in public:
 soup=BeautifulSoup(p.read_text(),'html.parser');styles=soup.select('link[rel=stylesheet]')
 sources=[src for tag in styles for src in manifest.get(urlsplit(tag['href']).path,[urlsplit(tag['href']).path])]
 if len(styles)!=1 or '/assets/homesplit/interactions.css' not in sources or len(soup.select('script[src^="/assets/homesplit/interactions.js"]'))!=1:errors.append(str(p))
check('all '+str(len(public))+' public pages share one CSS bundle and one interaction script',not errors)
check('knowledge artifacts current',subprocess.run(['node','scripts/build-agent-kb.mjs','--check'],cwd=ROOT,capture_output=True).returncode==0)
prompts=json.loads((ROOT/'assets/illustrations/prompts-v8.json').read_text())
check('image prompts, reference roles and anatomy corrections recorded',all(prompts['assets'][n]['prompt'] and len(prompts['assets'][n]['revisions'])==2 for n in ['openclaw','hermes']))
print(json.dumps({'passed':sum(results),'total':len(results),'publicPages':len(public),'errors':errors},ensure_ascii=False))
raise SystemExit(0 if all(results) else 1)
