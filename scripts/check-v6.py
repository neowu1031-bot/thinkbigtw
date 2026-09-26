"""Offline v6 asset/content checks. Does not claim browser layout or performance."""
import json
import subprocess
from pathlib import Path
from PIL import Image
from seo_common import ROOT, pages, BeautifulSoup

checks = []
def check(name, ok):
    checks.append(bool(ok))
    print(('PASS ' if ok else 'FAIL ') + name)

illustrations = ROOT / 'assets/illustrations'
prompts = json.loads((illustrations / 'prompts-v6.json').read_text())
check('five recorded image-generation prompts', len(prompts) == 5 and all(p['prompt'] for p in prompts))
for entry in prompts:
    for suffix, width in [('', 1536), ('-800', 800)]:
        path = illustrations / (entry['name'] + suffix + '.webp')
        im = Image.open(path)
        check(path.name + ' is responsive WebP', im.format == 'WEBP' and im.width == width and im.width <= 1600)
for rel in ['index.html', 'enterprise/departments/index.html']:
    soup = BeautifulSoup((ROOT / rel).read_text(), 'html.parser')
    images = soup.select('.department-art')
    check(rel + ': five described responsive illustrations', len(images) == 5 and all(
        i.get('alt') and '800w' in i.get('srcset', '') and '1536w' in i.get('srcset', '') and i.get('loading') == 'lazy'
        for i in images))
check('outlined placeholder removed from source CSS', '.department-index a:after' not in (ROOT / 'assets/homesplit/apple.css').read_text())
for p, _, soup in pages():
    rel = str(p.relative_to(ROOT))
    if rel in ['privacy.html', 'terms.html']:
        continue
    check(rel + ': common static hero', soup.h1.parent.get('class') and 'tb-hero-copy' in soup.h1.parent['class'])
glossary = BeautifulSoup((ROOT / 'guides/glossary/index.html').read_text(), 'html.parser')
old = BeautifulSoup(subprocess.check_output(['git', 'show', 'HEAD:guides/glossary/index.html'], cwd=ROOT, text=True), 'html.parser')
def terms(soup):
    return {s['id']: s.select_one('.term-definition').get_text() for s in soup.select('section[id^="term-"]')}
check('all 21 glossary definitions and anchors preserved in four groups', terms(glossary) == terms(old) and len(terms(glossary)) == 21 and len(glossary.select('.glossary-group')) == 4)
for rel in ['index.html','enterprise/index.html','trust/index.html','guides/index.html','pricing/index.html','about/index.html','enterprise/process/index.html']:
    soup = BeautifulSoup((ROOT / rel).read_text(), 'html.parser')
    check(rel + ': one definition without duplicate intro', len(soup.select('.tb-hero-copy > .tb-definition')) == 1 and not soup.select('.tb-hero-copy > .intro,.tb-hero-copy > .lead'))
video = ROOT / 'assets/neo_hero_nof_720.mp4'
info = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=codec_name,width,height','-of','json',str(video)], text=True))
check('720p H.264 mobile movie <= 1.5 MB', video.stat().st_size <= 1500000 and any(s.get('width') == 1280 and s.get('height') == 720 and s.get('codec_name') == 'h264' for s in info['streams']))
home = BeautifulSoup((ROOT / 'index.html').read_text(), 'html.parser')
check('mobile movie is deferred with a reversible source attribute', home.select_one('#brand-hero-video source').get('data-mobile-src') == '/assets/neo_hero_nof_720.mp4' and not home.select_one('#brand-hero-video source').get('src'))
personal = BeautifulSoup((ROOT / 'pricing/personal/index.html').read_text(), 'html.parser')
check('all eight reviews open local images without external targets', len(personal.select('.personal-review-image')) == 8 and all(a['href'].startswith('/assets/reviews/') and not a.has_attr('target') for a in personal.select('.personal-review-image')))
check('review image bytes unchanged', subprocess.check_output(['git','diff','--name-only','--','assets/reviews'],cwd=ROOT,text=True) == '')
print(json.dumps({'passed': sum(checks), 'total': len(checks)}))
raise SystemExit(0 if all(checks) else 1)
