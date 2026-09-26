"""Export sitemap page bodies to readable Markdown; never include scripts or chrome."""
import sys,xml.etree.ElementTree as ET
from bs4 import NavigableString
from seo_common import ROOT,BASE,BeautifulSoup
BLOCKS={'p','div','section','article','header','main','figure','details','ul','ol','table','tr','blockquote'}
def markdown(node):
 if isinstance(node,NavigableString):return str(node)
 name=node.name
 if name in ('script','style','nav','footer','button','noscript','svg','form'):return ''
 text=''.join(markdown(c) for c in node.children).strip()
 if name in ('h1','h2','h3','h4','h5','h6'):return '\n\n'+'#'*int(name[1])+' '+text+'\n\n'
 if name=='li':return '\n- '+text+'\n'
 if name=='a' and node.get('href','').startswith(('/', 'https://')):return '['+text+']('+ (BASE.rstrip('/')+node['href'] if node['href'].startswith('/') else node['href'])+')'
 if name=='br':return '\n'
 if name in BLOCKS:return '\n\n'+text+'\n\n'
 return text+' '
import re
urls=[n.text for n in ET.parse(ROOT/'sitemap.xml').iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
parts=[]
for url in urls:
 path=url.removeprefix(BASE);p=ROOT/(path+'index.html' if not path or path.endswith('/') else path)
 soup=BeautifulSoup(p.read_text(),'html.parser');body=soup.main or soup.body
 for n in body.select('#tb-nav,#tb-footer,.tb-personal-context,.enterprise-local-nav'):n.decompose()
 text=re.sub(r'\n[ \t]*\n(?:[ \t]*\n)+','\n\n',markdown(body)).strip()
 if not text.startswith('# '):text='# '+soup.title.get_text()+'\n\n'+text
 parts.append('URL: '+url+'\n\n'+text)
output='\n\n---\n\n'.join(parts)+'\n';p=ROOT/'llms-full.txt'
if '--check' in sys.argv:
 if p.read_text()!=output:sys.exit('FAIL llms-full differs')
 print(f'PASS llms-full: {len(parts)} URL sections')
else:p.write_text(output);print(f'Built {len(parts)} URL sections')
