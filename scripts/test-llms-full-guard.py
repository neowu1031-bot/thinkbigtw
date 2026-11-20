"""Guard: noindex pages and meta-refresh redirect stubs must never appear in sitemap.xml or llms-full.txt."""
import re, sys, xml.etree.ElementTree as ET
from seo_common import ROOT, BASE, BeautifulSoup, is_stub

fail = []
def check(name, ok):
    print(('PASS ' if ok else 'FAIL ') + name)
    if not ok: fail.append(name)

def soup(html): return BeautifulSoup(html, 'html.parser')
check('plain page is not a stub', not is_stub(soup('<html><head><title>x</title></head></html>')))
check('noindex is a stub', is_stub(soup('<meta name="robots" content="noindex, follow">')))
check('noindex uppercase is a stub', is_stub(soup('<meta name="robots" content="NOINDEX">')))
check('meta refresh is a stub', is_stub(soup('<meta http-equiv="refresh" content="0;url=/x/">')))
check('meta refresh uppercase is a stub', is_stub(soup('<meta http-equiv="Refresh" content="0;url=/x/">')))

# Real repo: every published URL must come from a non-stub page.
ns = '{http://www.sitemaps.org/schemas/sitemap/0.9}loc'
urls = [n.text for n in ET.parse(ROOT / 'sitemap.xml').iter(ns)]
bad = []
for url in urls:
    path = url.removeprefix(BASE)
    p = ROOT / (path + 'index.html' if not path or path.endswith('/') else path)
    if is_stub(BeautifulSoup(p.read_text(), 'html.parser')): bad.append(url)
check('sitemap.xml lists no noindex/redirect page ' + str(bad), not bad)

llms = (ROOT / 'llms-full.txt').read_text()
exported = re.findall(r'^URL: (\S+)$', llms, re.M)
bad = []
for url in exported:
    path = url.removeprefix(BASE)
    p = ROOT / (path + 'index.html' if not path or path.endswith('/') else path)
    if p.exists() and is_stub(BeautifulSoup(p.read_text(), 'html.parser')): bad.append(url)
check('llms-full.txt exports no noindex/redirect page ' + str(bad), not bad)
sys.exit(1 if fail else 0)
