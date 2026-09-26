"""Generate consistent entities and article metadata from static visible content.
Run after content edits and again after the content commit, before deployment.
"""
import argparse,json,re,sys
from seo_common import ROOT,BASE,pages,git_date,BeautifulSoup
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check',action='store_true',help='Compare generated graphs without writing any file; exit 1 on drift.')
args=parser.parse_args()
ORG=json.loads((ROOT/'data/seo-entity.json').read_text())
WEBSITE={'@type':'WebSite','@id':BASE+'#website','url':BASE,'name':'Think BIG','inLanguage':'zh-Hant','publisher':{'@id':ORG['@id']}}
EDITOR={'@type':'Organization','@id':BASE+'#editorial','name':'Think BIG 編輯部','parentOrganization':{'@id':ORG['@id']}}
LD=re.compile(r'<script\b[^>]*type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',re.S|re.I)
article_urls=[u for p,u,s in pages() if '/guides/' in u and u!=BASE+'guides/' and '/glossary/' not in u]
def normalize(node):
 if isinstance(node,list):return [normalize(x) for x in node]
 if not isinstance(node,dict):return node
 if node.get('@type')=='Organization':return {'@id':ORG['@id']}
 if node.get('@type')=='WebSite':return {'@id':WEBSITE['@id']}
 if node.get('@type')=='PostalAddress':return {'@type':'PostalAddress','addressCountry':'TW'}
 result={k:normalize(v) for k,v in node.items()}
 if 'areaServed' in result or result.get('@type')=='Service':result['areaServed']='Worldwide'
 return result
changed=[]
def save(p,raw,result):
 if result!=raw:
  changed.append(str(p.relative_to(ROOT)))
  if not args.check:p.write_text(result)
for p,url,soup in pages():
 raw=p.read_text();nodes=[]
 for m in LD.finditer(raw):
  parsed=json.loads(m[1]);nodes.extend(parsed.get('@graph',[parsed]) if isinstance(parsed,dict) else parsed)
 nodes=[normalize(n) for n in nodes if n.get('@type') not in ('Organization','WebSite','WebPage','BreadcrumbList')]
 title=soup.title.get_text(strip=True)
 heading=BeautifulSoup(str(soup.h1),'html.parser') if soup.h1 else None
 if heading:
  for br in heading.select('br'):br.replace_with(' ')
 h1=re.sub(r'\s+',' ',heading.get_text()).strip() if heading else title
 desc=soup.find('meta',attrs={'name':'description'});desc=desc.get('content','') if desc else h1
 web={'@type':'WebPage','@id':url+'#webpage','url':url,'name':title,'description':desc,'inLanguage':'zh-Hant','isPartOf':{'@id':WEBSITE['@id']},'publisher':{'@id':ORG['@id']},'dateModified':git_date(p)}
 crumbs=[{'@type':'ListItem','position':1,'name':'首頁','item':BASE}]
 if url!=BASE:
  if '/guides/' in url and url!=BASE+'guides/':crumbs.append({'@type':'ListItem','position':2,'name':'指南','item':BASE+'guides/'})
  crumbs.append({'@type':'ListItem','position':len(crumbs)+1,'name':h1,'item':url})
 web['breadcrumb']={'@id':url+'#breadcrumb'}
 breadcrumb={'@type':'BreadcrumbList','@id':url+'#breadcrumb','itemListElement':crumbs}
 for n in nodes:
  n.pop('@context',None)
  if n.get('@type')=='Article':
   n.update({'@id':url+'#article','headline':h1,'description':desc,'author':{'@id':EDITOR['@id']},'publisher':{'@id':ORG['@id']},'image':[BASE+'assets/brand/thinkbig-og.jpg'],'datePublished':git_date(p,True),'dateModified':git_date(p),'inLanguage':'zh-Hant','mainEntityOfPage':{'@id':web['@id']},'isPartOf':{'@id':BASE+'guides/#collection'}})
  if n.get('@type')=='FAQPage' and '/harness/' in url:
   n['mainEntity']=[{'@type':'Question','name':d.summary.get_text(' ',strip=True),'acceptedAnswer':{'@type':'Answer','text':d.p.get_text(' ',strip=True)}} for d in soup.select('#faq details')]
  if n.get('@type')=='FAQPage' and soup.select('.faq-item'):
   # Visible copy is the source of truth; avoid a second, drifting answer text.
   n['mainEntity']=[{'@type':'Question','name':re.sub(r'^Q[：:]\s*','',d.select_one('.faq-q').get_text(' ',strip=True)),'acceptedAnswer':{'@type':'Answer','text':d.select_one('.faq-a').get_text(' ',strip=True)}} for d in soup.select('.faq-item')]
  if n.get('@type')=='CollectionPage':n['isPartOf']={'@id':WEBSITE['@id']}
 if url==BASE+'guides/':
  nodes=[n for n in nodes if n.get('@type')!='CollectionPage']
  nodes.append({'@type':'CollectionPage','@id':BASE+'guides/#collection','url':url,'name':title,'hasPart':[{'@id':u+'#article'} for u in article_urls]+[{'@id':BASE+'guides/glossary/#terms'}]})
 if '/glossary/' in url:
  nodes=[n for n in nodes if n.get('@type')!='DefinedTermSet']
  nodes.append({'@type':'DefinedTermSet','@id':url+'#terms','name':h1,'hasDefinedTerm':[{'@type':'DefinedTerm','name':d.find(['h2','h3']).get_text(),'description':d.select_one('.term-definition').get_text(),'inDefinedTermSet':{'@id':url+'#terms'}} for d in soup.select('section[id^="term-"]')]})
 org=ORG if url in (BASE,BASE+'about/') else {k:ORG[k] for k in ('@type','@id','name','url','logo','address','areaServed')}
 graph=[org,WEBSITE,web,breadcrumb]+([EDITOR] if any(n.get('@type')=='Article' for n in nodes) else [])+nodes
 data=json.dumps({'@context':'https://schema.org','@graph':graph},ensure_ascii=False,indent=2)
 script='<script type="application/ld+json">'+data+'</script>'
 # Replace the first block in place and remove any extra blocks. Do not consume
 # surrounding whitespace: metadata and script boundary newlines stay stable.
 matches=list(LD.finditer(raw))
 result=LD.sub(lambda m:script if m.start()==matches[0].start() else '',raw) if matches else raw.replace('</head>',script+'\n</head>')
 # Ensure guide byline matches author entity without changing article body.
 if any(n.get('@type')=='Article' for n in nodes):
  result=result.replace('Think BIG 編輯 ·','Think BIG 編輯部 ·')
  if 'Think BIG 編輯部' not in BeautifulSoup(LD.sub('',result),'html.parser').get_text():result=result.replace('</h1>','</h1><p class="note">Think BIG 編輯部</p>',1)
 if not soup.find('link',rel='canonical'):result=result.replace('</head>',f'<link rel="canonical" href="{url}">\n</head>')
 save(p,raw,result)
# Normalize pre-existing entities on retained historical pages too, without indexing them.
known={p for p,_,_ in pages()}
for p in ROOT.rglob('*.html'):
 if p in known:continue
 raw=p.read_text()
 def replace(m):
  data=json.loads(m[1])
  def fix(n):
   if isinstance(n,list):return [fix(x) for x in n]
   if not isinstance(n,dict):return n
   if n.get('@type')=='Organization' and ('Think BIG' in n.get('name','') or n.get('@id')==ORG['@id']):return {k:ORG[k] for k in ('@type','@id','name','url','logo','address','areaServed')}
   if n.get('@type')=='PostalAddress':return {'@type':'PostalAddress','addressCountry':'TW'}
   result={k:fix(v) for k,v in n.items()}
   if 'areaServed' in result or result.get('@type')=='Service':result['areaServed']='Worldwide'
   return result
  return '<script type="application/ld+json">'+json.dumps(fix(data),ensure_ascii=False,indent=2)+'</script>'
 result=LD.sub(replace,raw)
 save(p,raw,result)
if args.check:
 if changed:
  print('FAIL SEO graph drift:\n'+'\n'.join(changed));sys.exit(1)
 print('PASS SEO graphs: no changes required; no files written')
else:print('SEO graphs synchronized:',len(list(pages())),'indexable pages;',len(changed),'files updated')
