"""Bundle local styles, retaining their original cascade position and source list.
Inline style/script boundaries split bundles so cascade order is unchanged.
"""
import re,json,hashlib
from urllib.parse import urlsplit
from pathlib import Path
from bs4 import BeautifulSoup
from seo_common import ROOT,pages
out=ROOT/'assets/generated';out.mkdir(exist_ok=True)
manifest_path=ROOT/'data/css-bundles.json'
manifest=json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
indexed=list(pages())
extra=[ROOT/'404.html',ROOT/'erp/index.html',*sorted((ROOT/'tbos/en').glob('*.html'))]
for p,url,_ in indexed+[(p,'',None) for p in extra if p.exists()]:
 raw=p.read_text()
 # Eliminate remote font requests: system fonts are already the site baseline.
 raw=re.sub(r'<link\b[^>]*href=["\']https://fonts\.(?:googleapis|gstatic)\.com[^>]*>','',raw)
 links=list(re.finditer(r'<link\b[^>]*>',raw));local=[]
 for m in links:
  tag=BeautifulSoup(m[0],'html.parser').link
  href=urlsplit(tag.get('href','')).path
  if 'stylesheet' not in tag.get('rel',[]) or not href.startswith('/'):continue
  sources=manifest.get(href,[href]);local.append((m,sources))
 # One combined stylesheet inserted at the last CSS location, but capture intervening
 # inline style blocks in exact cascade order inside the bundle.
 if len(local)>1:
  start,end=local[0][0].start(),local[-1][0].end();segment=raw[start:end]
  cssparts=[];sources=[]
  pattern=r'<link\b[^>]*>|<style\b[^>]*>.*?</style>'
  def consume(m):
   if m[0].startswith('<style'):cssparts.append(re.sub(r'^<style[^>]*>|</style>$','',m[0]));sources.append({'inline':cssparts[-1]});return ''
   tag=BeautifulSoup(m[0],'html.parser').link;href=urlsplit(tag.get('href','')).path
   if 'stylesheet' not in tag.get('rel',[]) or not href.startswith('/'):return m[0]
   for src in manifest.get(href,[href]):
    sources.append(src);cssparts.append(src['inline'] if isinstance(src,dict) else (ROOT/src.lstrip('/')).read_text())
   return ''
  rest=re.sub(pattern,consume,segment,flags=re.S)
  key=hashlib.sha256(json.dumps(sources,ensure_ascii=False).encode()).hexdigest()[:12];href='/assets/generated/site-'+key+'.css';manifest[href]=sources
  (ROOT/href.lstrip('/')).write_text('\n'.join(cssparts));raw=raw[:start]+rest+f'<link rel="stylesheet" href="{href}">'+raw[end:]
 for href,sources in manifest.items():
  (ROOT/href.lstrip('/')).write_text('\n'.join(x['inline'] if isinstance(x,dict) else (ROOT/x.lstrip('/')).read_text() for x in sources))
 p.write_text(raw)
manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print('CSS bundles generated; source styles remain editable')
