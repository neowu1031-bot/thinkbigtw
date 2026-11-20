"""Shared static-site helpers. Requires beautifulsoup4 (existing authoring dependency)."""
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import subprocess
from bs4 import BeautifulSoup
ROOT=Path(__file__).resolve().parents[1]
BASE='https://thinkbigtw.com/'
EXCLUDE=('.claude/','clawland/','meeting/','erp/','puig/','tbos/','v2/')
def is_stub(soup):
 """True for pages that must not be published as content: noindex or meta-refresh redirect stubs."""
 robots=soup.find('meta',attrs={'name':'robots'})
 if robots and 'noindex' in robots.get('content','').lower():return True
 return soup.find('meta',attrs={'http-equiv':lambda v:bool(v) and v.lower()=='refresh'}) is not None
def git_date(path, first=False):
 args=['git','log','--format=%cs']+(['--reverse'] if first else ['-1'])+['--',str(path.relative_to(ROOT))]
 dates=subprocess.check_output(args,cwd=ROOT,text=True).strip().splitlines()
 return dates[0] if dates else datetime.now(ZoneInfo('Asia/Taipei')).date().isoformat()
def pages():
 for p in sorted(ROOT.rglob('*.html')):
  rel=p.relative_to(ROOT).as_posix()
  if rel.startswith(EXCLUDE) or p.name not in ('index.html','privacy.html','terms.html'):continue
  soup=BeautifulSoup(p.read_text(),'html.parser')
  if is_stub(soup):continue
  canonical=soup.find('link',rel='canonical')
  url=BASE+(rel[:-10] if rel.endswith('index.html') else rel)
  if canonical and canonical.get('href')!=url:continue
  yield p,url,soup
