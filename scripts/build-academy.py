# -*- coding: utf-8 -*-
"""Build /library/academy/ (series overview) and one page per episode from data/academy-episodes.json.

Rules (spec: OL-008):
- An episode appears ONLY when its text is complete (title, summary, date, youtube_id, >=1 point). Incomplete episodes
  are skipped silently: no blank page, no placeholder page.
- With zero complete episodes nothing is written (no empty overview page).
- Usage: python3 scripts/build-academy.py [--data FILE] [--root DIR]   (root defaults to the repo; tests pass a temp dir)
"""
import sys, re, json, html
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
BASE = 'https://thinkbigtw.com'
REQUIRED = ('ep', 'slug', 'title', 'summary', 'date', 'youtube_id', 'points')


def arg(name, default):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default


def esc(s):
    return html.escape(str(s), quote=True)


def complete(e):
    return all(e.get(k) for k in REQUIRED) and re.fullmatch(r'[a-z0-9-]+', e['slug']) and re.fullmatch(r'[\w-]{11}', e['youtube_id']) and re.fullmatch(r'\d{4}-\d{2}-\d{2}', e['date'])


def chrome(root):
    idx = (root / 'library/qa/index.html').read_text(encoding='utf-8')
    g = lambda pat, f=0: re.search(pat, idx, f).group(0)
    return (g(r'<!-- Google tag \(gtag\.js\) -->.*?</script>\s*<script>.*?</script>', re.S),
            g(r'<link rel="stylesheet" href="/assets/generated/site-[^"]+\.css">'),
            g(r'<!-- TB:NAV:START -->.*?<!-- TB:NAV:END -->', re.S),
            g(r'<!-- TB:FOOTER:START -->.*?<!-- TB:FOOTER:END -->', re.S),
            g(r'<script src="/ask-ai\.js[^"]*" defer></script>'))


STYLE = '<style>.ac{max-width:760px;margin:0 auto;padding:32px 20px 64px;line-height:1.8}.ac h1{line-height:1.3}.ac .lead{color:#5a635f}.ac .vid{position:relative;aspect-ratio:16/9;margin:24px 0;background:#000;border-radius:12px;overflow:hidden}.ac .vid iframe{position:absolute;inset:0;width:100%;height:100%;border:0}.ac pre{white-space:pre-wrap;background:#f3f3ef;padding:14px;border-radius:8px}.ac .cta{margin-top:40px;padding:20px;background:#e3ece9;border-radius:12px}.ac ol.refs{font-size:.92em;color:#5a635f}.ac ul.eps{list-style:none;padding:0}.ac ul.eps li{padding:12px 0;border-bottom:1px solid #daded7}</style>'


def page(root, title, desc, canonical, body, ld=None):
    gtag, css, nav, foot, askai = chrome(root)
    ldtag = '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + '</script>' if ld else ''
    return f'''<!DOCTYPE html>
<html lang="zh-Hant">
<head>
{gtag}
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(title)}｜Think BIG</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{canonical}">
{css}
{STYLE}
{ldtag}
</head>
<body>
{nav}
<main class="ac">
{body}
</main>
{foot}
{askai}
</body>
</html>
'''


CTA = '<div class="cta"><b>想把這招用在公司流程？</b><p>預約 30 分鐘免費評估，一起看哪些工作適合交給 AI Agent。</p><p><a href="/enterprise/start/">預約免費評估</a>　<a href="https://lin.ee/n5KW430" target="_blank" rel="noopener noreferrer">LINE 洽詢 ↗</a></p></div>'


def episode_html(root, e, prev, nxt):
    url = f"{BASE}/library/academy/{e['slug']}/"
    pts = ''.join(f'<li>{esc(p)}</li>' for p in e['points'])
    terms = ''.join(f"<li><b>{esc(t['name'])}</b>：{esc(t['plain'])}" + (f"（例：{esc(t['example'])}）" if t.get('example') else '') + '</li>' for t in e.get('terms', []))
    tip = e.get('tip') or {}
    tip_html = ''
    if tip.get('steps') or tip.get('prompt'):
        tip_html = '<h2>一招用法</h2>' + (f"<p>{esc(tip['steps'])}</p>" if tip.get('steps') else '') + (f"<pre>{esc(tip['prompt'])}</pre>" if tip.get('prompt') else '')
    refs = ''.join(f'<li><a href="{esc(r["url"])}" target="_blank" rel="noopener noreferrer">{esc(r["title"])}</a></li>' for r in e.get('refs', []) if str(r.get('url', '')).startswith('https://'))
    nav = ''.join(x for x in [
        f'<a href="/library/academy/{prev["slug"]}/">← 上一集：{esc(prev["title"])}</a>' if prev else '',
        '　' if prev and nxt else '',
        f'<a href="/library/academy/{nxt["slug"]}/">下一集：{esc(nxt["title"])} →</a>' if nxt else ''])
    body = f'''<p><a href="/library/academy/">← 陪你跟上 AI</a></p>
<h1>{esc(e['title'])}</h1>
<p class="lead">{esc(e['summary'])}</p>
<div class="vid"><iframe src="https://www.youtube-nocookie.com/embed/{e['youtube_id']}" title="{esc(e['title'])}" loading="lazy" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>
<p class="lead">本集影像與配音為 AI 生成。</p>
<h2>本集重點</h2><ul>{pts}</ul>
{('<h2>術語小卡</h2><ul>' + terms + '</ul>') if terms else ''}
{tip_html}
{('<h2>參考資料</h2><ol class="refs">' + refs + '</ol>') if refs else ''}
<p>{nav}</p>
{CTA}'''
    ld = {'@context': 'https://schema.org', '@type': 'VideoObject', 'name': e['title'], 'description': e['summary'], 'uploadDate': e['date'],
          'thumbnailUrl': f"https://i.ytimg.com/vi/{e['youtube_id']}/hqdefault.jpg", 'embedUrl': f"https://www.youtube-nocookie.com/embed/{e['youtube_id']}"}
    return page(root, e['title'], e['summary'][:150], url, body, ld)


def overview_html(root, eps):
    items = ''.join(f'<li><a href="/library/academy/{e["slug"]}/"><b>EP{int(e["ep"]):02d}　{esc(e["title"])}</b></a><br>{esc(e["summary"])}</li>' for e in sorted(eps, key=lambda x: -int(x['ep'])))
    body = f'''<h1>陪你跟上 AI</h1>
<p class="lead">每個平日一集，用白話講一個 AI 術語、教一招可以馬上用的做法。每集附影片、重點與參考資料。</p>
<ul class="eps">{items}</ul>
{CTA}'''
    return page(root, '陪你跟上 AI：每集一個術語、一招用法', '每個平日一集，白話講一個 AI 術語並教一招馬上能用的做法；每集附影片、重點與參考資料。', f'{BASE}/library/academy/', body)


def main():
    root = Path(arg('--root', str(REPO)))
    data = Path(arg('--data', str(root / 'data/academy-episodes.json')))
    raw = json.loads(data.read_text(encoding='utf-8')) if data.exists() else []
    eps = sorted([e for e in raw if complete(e)], key=lambda x: int(x['ep']))
    skipped = [e.get('slug') or e.get('ep') for e in raw if not complete(e)]
    if skipped:
        print('skipped (incomplete text):', skipped)
    if not eps:
        print('no complete episodes: nothing written')
        return 0
    for i, e in enumerate(eps):
        d = root / 'library/academy' / e['slug']
        d.mkdir(parents=True, exist_ok=True)
        (d / 'index.html').write_text(episode_html(root, e, eps[i - 1] if i else None, eps[i + 1] if i + 1 < len(eps) else None), encoding='utf-8')
    (root / 'library/academy/index.html').write_text(overview_html(root, eps), encoding='utf-8')
    print(f'built overview + {len(eps)} episode pages')
    return 0


sys.exit(main())
