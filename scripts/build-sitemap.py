"""Generate sitemap dates from git; untracked pages use today's Taipei date."""
import sys
from xml.sax.saxutils import escape
from seo_common import ROOT,pages,git_date
rows=[f'  <url><loc>{escape(url)}</loc><lastmod>{git_date(p)}</lastmod></url>' for p,url,_ in pages()]
output='<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+'\n'.join(rows)+'\n</urlset>\n'
p=ROOT/'sitemap.xml'
if '--check' in sys.argv:
 if p.read_text()!=output:sys.exit('FAIL sitemap differs; run python3 scripts/build-sitemap.py')
 print(f'PASS sitemap: {len(rows)} canonical indexable pages, git dates match')
else:p.write_text(output);print(f'Built {len(rows)} URLs')
