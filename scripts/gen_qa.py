# -*- coding: utf-8 -*-
"""產生問答圖書館單篇頁＋更新 /library/qa/ 列表＋sitemap（多品牌）。
用法：
  python3 gen_qa.py <repo_root> <slug>              單篇（品牌取自 ARTICLES[].brand_key，預設 twy）
  python3 gen_qa.py <repo_root> --overview <brand>  品牌總覽頁（中文＋英文）、品牌入口列、sitemap
文章內容 qa_content.ARTICLES 預設從本檔同資料夾載入，可用環境變數 QA_CONTENT_DIR 指定其他資料夾。
品牌設定在 qa_brands.py。
"""
import sys, os, re, json, html
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if os.environ.get("QA_CONTENT_DIR"):
    sys.path.insert(0, os.environ["QA_CONTENT_DIR"])
try:
    from qa_content import ARTICLES
except ImportError:
    ARTICLES = []
from qa_brands import BRANDS, OVERVIEW, IG as IG_URL, CHECKED as CHECKED_DATE

BASE = "https://thinkbigtw.com"
WEEK = "一二三四五六日"

def strip(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s)).strip()

def esc(s):
    return html.escape(s, quote=True)

def brand_of(a):
    return BRANDS[a.get("brand_key", "twy")]

def by_slug(slug):
    return next(a for a in ARTICLES if a["slug"] == slug)

def related_item(repo, slug, lang="zh"):
    """延伸閱讀的 (網址, 標題)：先找 ARTICLES，找不到就讀倉庫裡已存在頁面的 <h1>。英文頁只連有英文版的頁。"""
    a = next((x for x in ARTICLES if x["slug"] == slug), None)
    if lang == "en":
        if a and a.get("en"):
            return f"/en/qa/{slug}/", a["en"]["title"]
        return None
    if a:
        return f"/library/qa/{slug}/", a["title"]
    fp = os.path.join(repo, "library/qa", slug, "index.html")
    if os.path.exists(fp):
        m = re.search(r'<h1[^>]*>(.*?)</h1>', open(fp, encoding="utf-8").read(), re.S)
        if m:
            return f"/library/qa/{slug}/", html.unescape(strip(m.group(1)))
    return None

def chrome(repo, lang="zh"):
    idx = open(os.path.join(repo, "en/qa/index.html" if lang == "en" else "library/qa/index.html"), encoding="utf-8").read()
    nav = re.search(r"<!-- TB:NAV:START -->.*?<!-- TB:NAV:END -->", idx, re.S).group(0)
    foot = re.search(r"<!-- TB:FOOTER:START -->.*?<!-- TB:FOOTER:END -->", idx, re.S).group(0)
    css = re.search(r'<link rel="stylesheet" href="/assets/generated/site-[^"]+\.css">', idx).group(0)
    askai = re.search(r'<script src="/ask-ai\.js[^"]*" defer></script>', idx).group(0)
    gtag = re.search(r"<!-- Google tag \(gtag\.js\) -->.*?</script>\s*<script>.*?</script>", idx, re.S).group(0)
    return nav, foot, css, askai, gtag

STYLE = """<style>
  :root{--bg:#f3f3ef;--card:#fbfbf8;--ink:#1a211f;--ink-soft:#5a635f;--line:#daded7;--accent:#1f5f5b;--accent-soft:#e3ece9;--gold:#9a7b35;--serif:'Noto Serif TC',Georgia,serif;--sans:'Noto Sans TC','Helvetica Neue',Arial,sans-serif;}
  @media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#13181a;--card:#1b2224;--ink:#e7ece9;--ink-soft:#97a09b;--line:#2b3335;--accent:#5cb8af;--accent-soft:#1d2e2d;--gold:#c6a862;color-scheme:dark;}}
  *{box-sizing:border-box}
  body{background:var(--bg);color:var(--ink);font-family:var(--sans);line-height:1.8;-webkit-font-smoothing:antialiased;margin:0}
  .wrap{max-width:760px;margin:0 auto;padding-block:40px 64px;padding-left:20px;padding-right:20px}
  .back-link{display:inline-block;font-size:13px;color:var(--accent);text-decoration:none;margin-bottom:20px;letter-spacing:.04em}.back-link:hover{text-decoration:underline}
  .qa-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;font-size:11px;letter-spacing:.14em;text-transform:uppercase}
  .qa-top .cat{color:var(--accent);font-weight:700}.qa-top .no{color:var(--ink-soft);font-family:var(--serif);font-weight:700;letter-spacing:.1em}
  h1.q{font-family:var(--serif);font-weight:900;font-size:clamp(25px,6vw,36px);line-height:1.35;margin:0 0 12px;text-wrap:balance}
  .byline{font-size:12.5px;color:var(--ink-soft);margin:0 0 24px;font-variant-numeric:tabular-nums}
  .answer{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--accent);border-radius:12px;padding:20px 22px;margin:0 0 30px}
  .lede{display:block;font-size:11px;letter-spacing:.16em;font-weight:700;color:var(--accent);margin-bottom:8px}
  .answer p{margin:0;font-size:16.5px;font-weight:500}
  .body h2{font-family:var(--serif);font-weight:900;font-size:21px;line-height:1.4;margin:34px 0 12px;padding-top:12px;border-top:1px solid var(--line);text-wrap:balance}
  .body h2 .no{color:var(--accent);margin-right:.3em}
  .body p{margin:0 0 14px;font-size:16px}
  .body ul,.body ol{margin:0 0 14px;padding-left:1.4em}.body li{margin-bottom:6px}
  .body a,.brand a,.sources a,.related a{color:var(--accent)}
  .tbl{overflow-x:auto;margin:0 0 16px}
  .body table{width:100%;border-collapse:collapse;font-size:14px;min-width:520px}
  .body th{background:var(--accent-soft);font-weight:700;font-size:13px;padding:8px 10px;text-align:left;border:1px solid var(--line)}
  .body td{padding:8px 10px;border:1px solid var(--line);vertical-align:top}
  @media(max-width:600px){.body table{min-width:0}.body thead{display:none}.body tr{display:block;border:1px solid var(--line);border-radius:10px;margin:0 0 12px;background:var(--card)}.body td{display:block;border:0;border-top:1px dashed var(--line);padding:8px 12px}.body td:first-child{border-top:0}.body td[data-label]::before{content:attr(data-label);display:block;font-size:11px;letter-spacing:.1em;color:var(--accent);font-weight:700;margin-bottom:2px}}
  .brand{background:var(--card);border:2px solid var(--accent);border-radius:14px;padding:22px 22px 16px;margin:36px 0 0}
  .brand h2{font-family:var(--serif);font-weight:900;font-size:20px;margin:0 0 12px}
  .brand p,.brand li{font-size:15.5px}.brand p{margin:0 0 12px}.brand ol{padding-left:1.3em;margin:0 0 12px}.brand li{margin-bottom:6px}
  .brand .brand-src{font-size:12.5px;color:var(--ink-soft);border-top:1px dashed var(--line);padding-top:10px;margin-top:6px}
  .faq{margin:36px 0 0;border-top:2px solid var(--ink);padding-top:14px}
  .faq h2{font-family:var(--serif);font-weight:900;font-size:21px;margin:0 0 6px}
  .faq dt{font-weight:700;font-size:16px;margin-top:16px}.faq dd{margin:4px 0 0;font-size:15px;color:var(--ink-soft)}
  .related{margin:30px 0 0;font-size:14.5px}.related ul{padding-left:1.2em;margin:6px 0 0}
  .sources{margin-top:30px;border-top:1px solid var(--line);padding-top:14px;font-size:12.5px;color:var(--ink-soft);line-height:1.7}
  .sources .lede{color:var(--ink)}.sources ol{padding-left:1.3em;margin:0}.sources li{margin-bottom:4px}.sources a{word-break:break-all}
  .disclaimer{font-size:12px;color:var(--ink-soft);margin-top:18px;line-height:1.7}
  .colophon{text-align:center;margin-top:34px;padding-top:18px;border-top:1px solid var(--line);font-size:12px;color:var(--ink-soft)}
  .colophon b{font-family:var(--serif);color:var(--ink);letter-spacing:.06em}
  .colophon .sig{display:block;margin-top:8px;color:var(--ink);font-weight:700;font-family:var(--serif);letter-spacing:.06em;font-size:13px}
  a:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
</style>"""

def zh_date(d):
    import datetime
    dt = datetime.date.fromisoformat(d)
    return f"{dt.year} 年 {dt.month} 月 {dt.day} 日　星期{WEEK[dt.weekday()]}"

def page(repo, a):
    nav, foot, css, askai, gtag = chrome(repo)
    url = f"{BASE}/library/qa/{a['slug']}/"
    iso = f"{a['date']}T12:00:00+08:00"
    answer_txt = strip(a["answer"])
    faq = [(a["title"], answer_txt)] + a["faq"]
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "Article", "@id": url + "#article", "headline": a["title"], "description": a["desc"], "keywords": a["keywords"],
         "author": {"@type": "Organization", "name": "Think BIG 問答圖書館", "url": BASE + "/library/qa/"},
         "publisher": {"@type": "Organization", "@id": BASE + "/#organization", "name": "大想成業有限公司", "url": BASE + "/",
                       "logo": {"@type": "ImageObject", "url": BASE + "/assets/brand/thinkbig-dark.png"}},
         "datePublished": iso, "dateModified": iso, "url": url, "mainEntityOfPage": url, "inLanguage": "zh-Hant-TW",
         "isPartOf": {"@type": "CollectionPage", "name": "問答圖書館", "url": BASE + "/library/qa/"},
         "mentions": [brand_of(a)["mention"]],
         "citation": [u for _, u in a["sources"]]},
        {"@type": "FAQPage", "@id": url + "#faq", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": ans}} for q, ans in faq]},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "首頁", "item": BASE + "/"},
            {"@type": "ListItem", "position": 2, "name": "Library", "item": BASE + "/library/"},
            {"@type": "ListItem", "position": 3, "name": "問答圖書館", "item": BASE + "/library/qa/"},
            {"@type": "ListItem", "position": 4, "name": a["short"], "item": url}]}]}
    title = f"{a['title']}｜問答圖書館｜Think BIG"
    og_desc = a["desc"]
    sec = re.sub(r"(<table>.*?</table>)", r'<div class="tbl">\1</div>', a["sections"], flags=re.S)
    def _label(m):
        heads = re.findall(r"<th>(.*?)</th>", m.group(0))
        def _row(r):
            cells = iter(heads)
            return re.sub(r"<td>", lambda _: f'<td data-label="{esc(strip(next(cells, "")))}">', r.group(0))
        return re.sub(r"<tr><td>.*?</tr>", _row, m.group(0), flags=re.S)
    sec = re.sub(r"<table>.*?</table>", _label, sec, flags=re.S)
    faq_html = "".join(f"<dt>Q{i}：{esc(q)}</dt><dd>{esc(ans)}</dd>" for i, (q, ans) in enumerate(a["faq"], 1))
    src_html = "".join(f'<li>{esc(label)}：<a href="{u}" target="_blank" rel="noopener">{esc(u.split("//")[1].split("/")[0])}</a></li>' for label, u in a["sources"])
    rel = [x for x in (related_item(repo, s) for s in a.get("related", [])) if x]
    rel_html = ""
    if rel:
        rel_html = '<nav class="related" aria-label="延伸閱讀"><b>延伸閱讀</b><ul>' + "".join(
            f'<li><a href="{u}">{esc(t)}</a></li>' for u, t in rel) + "</ul></nav>"
    hl_zh = ""
    if a.get("en"):
        hl_zh = (f'<link rel="alternate" hreflang="zh-Hant-TW" href="{url}">\n<link rel="alternate" hreflang="en" href="{BASE}/en/qa/{a["slug"]}/">\n'
                 f'<link rel="alternate" hreflang="x-default" href="{url}">\n')
    return f"""<!DOCTYPE html>
<html lang="zh-Hant">
<head>
{gtag}
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(title)}</title>
<meta name="description" content="{esc(a['desc'])}">
<link rel="canonical" href="{url}">
{hl_zh}<meta property="og:type" content="article">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(og_desc)}">
<meta property="og:image" content="{BASE}/assets/brand/thinkbig-og.jpg">
<meta property="og:site_name" content="Think BIG!">
<meta property="og:locale" content="zh_TW">
<meta property="article:published_time" content="{iso}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(title)}">
<meta name="twitter:description" content="{esc(og_desc)}">
<meta name="twitter:image" content="{BASE}/assets/brand/thinkbig-og.jpg">
<script type="application/ld+json">
{json.dumps(ld, ensure_ascii=False, indent=1)}
</script>
{STYLE}
{css}
</head>
<body>
{nav}<main>
<article class="wrap">
  <a class="back-link" href="/library/qa/">&larr; 問答圖書館</a>
  <div class="qa-top"><span class="cat">{brand_of(a)["cat"]}</span><span class="no">{a['no']}</span></div>
  <h1 class="q">{esc(a['title'])}</h1>
  <p class="byline">Think BIG 問答圖書館　·　<time datetime="{iso}">{zh_date(a['date'])}</time></p>

  <section class="answer" aria-label="先說答案">
    <span class="lede">先說答案</span>
    <p>{a['answer']}</p>
  </section>

  <div class="body">{sec}</div>

  <section class="brand" aria-label="品牌資訊">
    <span class="lede">品牌資訊｜{brand_of(a)["name"]}</span>
    <h2>{esc(a['brand_title'])}</h2>
    {a['brand']}
  </section>

  <section class="faq" aria-label="常見問題">
    <h2>常見問題</h2>
    <dl>{faq_html}</dl>
  </section>

  {rel_html}

  <div class="sources"><span class="lede">參考來源（連結於 {a.get("checked", "2026-10-11")} 查證）</span><ol>{src_html}</ol></div>
  <p class="disclaimer">本文整理公開的法規、研究與官方資料，供家長參考，不構成法律或醫療意見；法規以全國法規資料庫最新條文為準，研究內容以各原文為準。品牌資訊段落取自該品牌官網，內容以官網最新版本為準。</p>

  <div class="colophon"><b>問答圖書館</b>　·　<a href="/library/" style="color:inherit">Library 首頁</a><span class="sig">Think BIG, Make it Real!　大想成業有限公司</span></div>
</article>
</main><script src="/nav.js" defer></script>
{askai}{foot}
</body>
</html>
"""

def card(a):
    first = strip(a["answer"]).split("。")[0] + "。"
    return f"""    <article class="qa">
      <div class="qa-top"><span class="cat">{brand_of(a)["cat"]}</span><span class="no">{a['no']}</span></div>
      <h2 class="q"><a href="/library/qa/{a['slug']}/" style="color:inherit;text-decoration:none">{esc(a['title'])}</a></h2>
      <div class="a">
        <div>
          <p>{esc(first)}</p>
          <p><a href="/library/qa/{a['slug']}/" style="color:var(--accent);font-weight:700">看完整解答與出處 →</a></p>
        </div>
      </div>
      <div class="qa-foot">
        <span class="by">Think BIG 問答圖書館</span>
        <span class="tag">{brand_of(a)["tag"]}</span>
        <span class="meta">更新 {a['date']}</span>
      </div>
    </article>
"""

def update_index(repo, a):
    p = os.path.join(repo, "library/qa/index.html")
    s = open(p, encoding="utf-8").read()
    if f'/library/qa/{a["slug"]}/' in s:
        return
    cat = brand_of(a)["cat"]
    if f"<span>{cat}</span>" not in s:
        s = s.replace('    <span>常見疑問</span>\n', f'    <span>常見疑問</span>\n    <span>{cat}</span>\n', 1)
    assert '<div class="cards">\n' in s
    s = s.replace('<div class="cards">\n', '<div class="cards">\n' + card(a), 1)
    open(p, "w", encoding="utf-8").write(s)

def update_sitemap(repo, a):
    p = os.path.join(repo, "sitemap.xml")
    s = open(p, encoding="utf-8").read()
    loc = f"{BASE}/library/qa/{a['slug']}/"
    if loc in s:
        return
    anchor = f"  <url><loc>{BASE}/library/qa/</loc><lastmod>"
    i = s.index(anchor); j = s.index("\n", i)
    s = s[:i] + f"  <url><loc>{BASE}/library/qa/</loc><lastmod>{a['date']}</lastmod></url>" + s[j:]   # 列表頁也更新了
    j = s.index("\n", i)
    # 新文章接在 /library/qa/ 那一行之後（依序累加在最後一篇問答後面），不碰 NEWS 會改的行
    k = j
    while s[k + 1:].startswith(f"  <url><loc>{BASE}/library/qa/"):
        k = s.index("\n", k + 1)
    s = s[:k + 1] + f"  <url><loc>{loc}</loc><lastmod>{a['date']}</lastmod></url>\n" + s[k + 1:]
    open(p, "w", encoding="utf-8").write(s)

OV_STYLE_EXTRA = """<style>
  .facts{width:100%;border-collapse:collapse;font-size:15px;margin:0 0 8px}
  .facts th{width:30%;text-align:left;background:var(--accent-soft);padding:9px 12px;border:1px solid var(--line);font-size:13px}
  .facts td{padding:9px 12px;border:1px solid var(--line);background:var(--card)}
  @media(max-width:600px){.facts th,.facts td{display:block;width:100%}.facts th{border-bottom:0}.facts tr{display:block;margin-bottom:10px}}
  .empty{background:var(--card);border:1px dashed var(--line);border-radius:12px;padding:16px 18px;font-size:15px;color:var(--ink-soft)}
  .qa-list{list-style:none;padding:0;margin:0}.qa-list li{padding:12px 0;border-bottom:1px solid var(--line)}
  .qa-list a{font-weight:700;color:var(--accent)}.qa-list p{margin:4px 0 0;font-size:14px;color:var(--ink-soft)}
</style>"""

def overview_items(brand, lang):
    out = []
    for a in ARTICLES:
        if a.get("brand_key", "twy") != brand:
            continue
        if lang == "en":
            if not a.get("en"):
                continue
            out.append((f"/en/qa/{a['slug']}/", a["en"]["title"], strip(a["en"]["answer"]).split(". ")[0].rstrip(".") + ".", a["date"]))
        else:
            out.append((f"/library/qa/{a['slug']}/", a["title"], strip(a["answer"]).split("。")[0] + "。", a["date"]))
    return out

def overview_page(repo, brand, lang):
    o = OVERVIEW[brand][lang]
    z, e = OVERVIEW[brand]["zh"], OVERVIEW[brand]["en"]
    nav, foot, css, askai, gtag = chrome(repo, lang)
    url = BASE + o["path"]
    brand_id = BASE + "/library/qa/bearsay/#brand"
    items = overview_items(brand, lang)
    graph = [
        {"@type": "CollectionPage", "@id": url + "#page", "url": url, "name": o["h1"], "description": o["desc"],
         "inLanguage": "en" if lang == "en" else "zh-Hant-TW", "dateModified": CHECKED_DATE,
         "isPartOf": {"@type": "CollectionPage", "name": o["back"], "url": BASE + ("/en/qa/" if lang == "en" else "/library/qa/")},
         "about": {"@id": brand_id}, "mentions": {"@id": brand_id}},
        {"@type": "Brand", "@id": brand_id, "name": z["h1"].split("｜")[0], "alternateName": "BearSay Mandarin",
         "description": z["answer"] if lang == "zh" else e["answer"], "sameAs": [IG_URL]},
        {"@type": "FAQPage", "@id": url + "#faq", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": t}} for q, t in o["faq"]]},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "首頁" if lang == "zh" else "Home", "item": BASE + ("/" if lang == "zh" else "/en/")},
            {"@type": "ListItem", "position": 2, "name": "Library", "item": BASE + "/library/"},
            {"@type": "ListItem", "position": 3, "name": o["back"], "item": BASE + ("/en/qa/" if lang == "en" else "/library/qa/")},
            {"@type": "ListItem", "position": 4, "name": o["h1"].split(":")[0].split("｜")[0], "item": url}]},
    ]
    if items:
        graph[0]["mainEntity"] = {"@type": "ItemList", "itemListElement": [
            {"@type": "ListItem", "position": i, "url": BASE + u, "name": t} for i, (u, t, _, _) in enumerate(items, 1)]}
    ld = {"@context": "https://schema.org", "@graph": graph}
    facts = "".join(f"<tr><th scope=\"row\">{esc(k)}</th><td>{esc(v)}</td></tr>" for k, v in o["facts"])
    if items:
        lst = '<ul class="qa-list">' + "".join(
            f'<li><a href="{u}">{esc(t)}</a><p>{esc(f)}</p></li>' for u, t, f, _ in items) + "</ul>"
    else:
        lst = f'<p class="empty">{esc(o["list_empty"])}</p>'
    faq_html = "".join(f"<dt>Q{i}: {esc(q)}</dt><dd>{esc(t)}</dd>" if lang == "en" else f"<dt>Q{i}：{esc(q)}</dt><dd>{esc(t)}</dd>"
                       for i, (q, t) in enumerate(o["faq"], 1))
    src_html = "".join(f'<li>{esc(l)}：<a href="{u}" target="_blank" rel="noopener">{esc(u.split("//")[1].rstrip("/"))}</a></li>' for l, u in o["sources"])
    if lang == "en":
        hl = (f'<link rel="alternate" hreflang="en" href="{BASE}{e["path"]}">\n<link rel="alternate" hreflang="zh-Hant-TW" href="{BASE}{z["path"]}">\n'
              f'<link rel="alternate" hreflang="x-default" href="{BASE}{z["path"]}">')
        answer_lbl, loc, htmllang, sig_lbl, back_href = "Short answer", "en_US", "en", "Q&A Library", "/en/qa/"
    else:
        hl = (f'<link rel="alternate" hreflang="zh-Hant-TW" href="{BASE}{z["path"]}">\n<link rel="alternate" hreflang="en" href="{BASE}{e["path"]}">\n'
              f'<link rel="alternate" hreflang="x-default" href="{BASE}{z["path"]}">')
        answer_lbl, loc, htmllang, sig_lbl, back_href = "先說答案", "zh_TW", "zh-Hant", "問答圖書館", "/library/qa/"
    ol, ou = o["other_lang"]
    return f"""<!DOCTYPE html>
<html lang="{htmllang}">
<head>
{gtag}
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(o['title'])}</title>
<meta name="description" content="{esc(o['desc'])}">
<link rel="canonical" href="{url}">
{hl}
<meta property="og:type" content="website">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{esc(o['title'])}">
<meta property="og:description" content="{esc(o['desc'])}">
<meta property="og:image" content="{BASE}/assets/brand/thinkbig-og.jpg">
<meta property="og:site_name" content="Think BIG!">
<meta property="og:locale" content="{loc}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(o['title'])}">
<meta name="twitter:description" content="{esc(o['desc'])}">
<meta name="twitter:image" content="{BASE}/assets/brand/thinkbig-og.jpg">
<script type="application/ld+json">
{json.dumps(ld, ensure_ascii=False, indent=1)}
</script>
{STYLE}
{OV_STYLE_EXTRA}
{css}
</head>
<body>
{nav}<main>
<div class="wrap">
  <a class="back-link" href="{back_href}">&larr; {esc(o['back'])}</a>
  <div class="qa-top"><span class="cat">{esc(o['eyebrow'])}</span><span class="no"><a href="{ou}" hreflang="{'en' if lang == 'zh' else 'zh-Hant-TW'}" style="color:inherit">{ol}</a></span></div>
  <h1 class="q">{esc(o['h1'])}</h1>

  <section class="answer" aria-label="{answer_lbl}">
    <span class="lede">{answer_lbl}</span>
    <p>{esc(o['answer'])}</p>
  </section>

  <div class="body">
    <h2>{esc(o['facts_h'])}</h2>
    <table class="facts"><tbody>{facts}</tbody></table>
    <h2>{esc(o['list_h'])}</h2>
    {lst}
  </div>

  <section class="faq" aria-label="{esc(o['faq_h'])}">
    <h2>{esc(o['faq_h'])}</h2>
    <dl>{faq_html}</dl>
  </section>

  <div class="sources"><span class="lede">{esc(o['src_h'])}</span><ol>{src_html}</ol></div>
  <p class="disclaimer">{esc(o['disclosure'])}</p>

  <div class="colophon"><b>{sig_lbl}</b>　·　<a href="/library/" style="color:inherit">Library</a><span class="sig">Think BIG, Make it Real!　大想成業有限公司</span></div>
</div>
</main><script src="/nav.js" defer></script>
{askai}{foot}
</body>
</html>
"""

def add_brand_entry(repo, brand):
    """在 /library/qa/ 與 /en/qa/ 的分類列上方加品牌入口（一般連結，不靠 JS）；已加過就略過。"""
    for lang, rel, anchor in (("zh", "library/qa/index.html", '  <nav class="cats"'), ("en", "en/qa/index.html", '  <div class="cards">')):
        p = os.path.join(repo, rel)
        s = open(p, encoding="utf-8").read()
        o = OVERVIEW[brand][lang]
        if o["path"] in s:
            continue
        label = BRANDS[brand]["name"] + " · BearSay Mandarin" if lang == "zh" else "BearSay Mandarin (熊好學)"
        lead = "品牌問答總覽" if lang == "zh" else "Brand Q&amp;A"
        block = (f'  <nav class="brands" aria-label="{lead}"><span class="brands-lead">{lead}</span>'
                 f'<a href="{o["path"]}">{label}</a></nav>\n')
        css = ("<style>.brands{display:flex;flex-wrap:wrap;gap:8px 12px;justify-content:center;align-items:center;margin:0 0 16px;font-size:13px}"
               ".brands-lead{color:var(--ink-soft);letter-spacing:.06em}.brands a{padding:6px 14px;border:1px solid var(--accent);border-radius:999px;color:var(--accent);text-decoration:none;font-weight:700}"
               ".brands a:hover{background:var(--accent-soft)}</style>\n")
        assert anchor in s, rel
        s = s.replace(anchor, block + anchor, 1)
        s = s.replace("</head>", css + "</head>", 1)
        open(p, "w", encoding="utf-8").write(s)

def add_sitemap_overview(repo, brand):
    p = os.path.join(repo, "sitemap.xml")
    s = open(p, encoding="utf-8").read()
    for lang in ("zh", "en"):
        loc = BASE + OVERVIEW[brand][lang]["path"]
        if loc in s:
            continue
        anchor = f"  <url><loc>{BASE}/library/qa/</loc>"
        i = s.index(anchor); j = s.index("\n", i)
        s = s[:j + 1] + f"  <url><loc>{loc}</loc><lastmod>{CHECKED_DATE}</lastmod></url>\n" + s[j + 1:]
    open(p, "w", encoding="utf-8").write(s)

def add_llms(repo, brand):
    p = os.path.join(repo, "llms.txt")
    s = open(p, encoding="utf-8").read()
    z, e = OVERVIEW[brand]["zh"], OVERVIEW[brand]["en"]
    if BASE + z["path"] in s:
        return
    lines = (f"- [{z['h1']}]({BASE}{z['path']})：台灣華語、注音、繁體字的學習問答與品牌資料（中文）\n"
             f"- [BearSay Mandarin Q&A Overview (English)]({BASE}{e['path']})：Taiwan Mandarin, zhuyin and Traditional characters\n")
    m = re.search(r"^- \[Library｜報導・問答圖書館\]\([^\n]*\n", s, re.M)
    assert m, "llms.txt 找不到 Library 條目"
    s = s[:m.end()] + lines + s[m.end():]
    open(p, "w", encoding="utf-8").write(s)

def run_overview(repo, brand):
    for lang in ("zh", "en"):
        o = OVERVIEW[brand][lang]
        out = os.path.join(repo, o["path"].strip("/"), "index.html")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        open(out, "w", encoding="utf-8").write(overview_page(repo, brand, lang))
    add_brand_entry(repo, brand)
    add_sitemap_overview(repo, brand)
    add_llms(repo, brand)
    print("ok overview", brand)


# ---------------------------------------------------------------- 英文單篇（a["en"]）與疊加用的 sitemap-qa / llms
EN_MONTH = ["January","February","March","April","May","June","July","August","September","October","November","December"]

def en_date(d):
    import datetime
    dt = datetime.date.fromisoformat(d)
    return f"{EN_MONTH[dt.month - 1]} {dt.day}, {dt.year}"

def page_en(repo, a):
    e = a["en"]
    nav, foot, css, askai, gtag = chrome(repo, "en")
    url = f"{BASE}/en/qa/{a['slug']}/"
    zh_url = f"{BASE}/library/qa/{a['slug']}/"
    iso = f"{a['date']}T16:00:00+08:00"
    answer_txt = strip(e["answer"])
    faq = [(e["title"], answer_txt)] + e["faq"]
    ld = {"@context": "https://schema.org", "@graph": [
        {"@type": "Article", "@id": url + "#article", "headline": e["title"], "description": e["desc"], "keywords": e["keywords"],
         "author": {"@type": "Organization", "name": "Think BIG Q&A Library", "url": BASE + "/en/qa/"},
         "publisher": {"@type": "Organization", "@id": BASE + "/#organization", "name": "Think BIG Make it Real Co., Ltd.", "url": BASE + "/",
                       "logo": {"@type": "ImageObject", "url": BASE + "/assets/brand/thinkbig-dark.png"}},
         "datePublished": iso, "dateModified": iso, "url": url, "mainEntityOfPage": url, "inLanguage": "en",
         "isPartOf": {"@type": "CollectionPage", "name": "Q&A Library", "url": BASE + "/en/qa/"},
         "mentions": [brand_of(a)["mention"]],
         "citation": [u for _, u in e["sources"]]},
        {"@type": "FAQPage", "@id": url + "#faq", "mainEntity": [
            {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": ans}} for q, ans in faq]},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": BASE + "/en/"},
            {"@type": "ListItem", "position": 2, "name": "Library", "item": BASE + "/library/"},
            {"@type": "ListItem", "position": 3, "name": "Q&A Library", "item": BASE + "/en/qa/"},
            {"@type": "ListItem", "position": 4, "name": e["short"], "item": url}]}]}
    title = f"{e['title']} | Q&A Library | Think BIG"
    sec = re.sub(r"(<table>.*?</table>)", r'<div class="tbl">\1</div>', e["sections"], flags=re.S)
    def _label(m):
        heads = re.findall(r"<th>(.*?)</th>", m.group(0))
        def _row(r):
            cells = iter(heads)
            return re.sub(r"<td>", lambda _: f'<td data-label="{esc(strip(next(cells, "")))}">', r.group(0))
        return re.sub(r"<tr><td>.*?</tr>", _row, m.group(0), flags=re.S)
    sec = re.sub(r"<table>.*?</table>", _label, sec, flags=re.S)
    faq_html = "".join(f"<dt>Q{i}: {esc(q)}</dt><dd>{esc(ans)}</dd>" for i, (q, ans) in enumerate(e["faq"], 1))
    src_html = "".join(f'<li>{esc(label)}: <a href="{u}" target="_blank" rel="noopener">{esc(u.split("//")[1].split("/")[0])}</a></li>' for label, u in e["sources"])
    rel = [x for x in (related_item(repo, s, "en") for s in a.get("related", [])) if x]
    rel_html = ""
    if rel:
        rel_html = '<nav class="related" aria-label="Related"><b>Related</b><ul>' + "".join(
            f'<li><a href="{u}">{esc(t)}</a></li>' for u, t in rel) + "</ul></nav>"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
{gtag}
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{esc(title)}</title>
<meta name="description" content="{esc(e['desc'])}">
<link rel="canonical" href="{url}">
<link rel="alternate" hreflang="en" href="{url}">
<link rel="alternate" hreflang="zh-Hant-TW" href="{zh_url}">
<link rel="alternate" hreflang="x-default" href="{zh_url}">
<meta property="og:type" content="article">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(e['desc'])}">
<meta property="og:image" content="{BASE}/assets/brand/thinkbig-og.jpg">
<meta property="og:site_name" content="Think BIG!">
<meta property="og:locale" content="en_US">
<meta property="article:published_time" content="{iso}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(title)}">
<meta name="twitter:description" content="{esc(e['desc'])}">
<meta name="twitter:image" content="{BASE}/assets/brand/thinkbig-og.jpg">
<script type="application/ld+json">
{json.dumps(ld, ensure_ascii=False, indent=1)}
</script>
{STYLE}
{css}
</head>
<body>
{nav}<main>
<article class="wrap">
  <a class="back-link" href="/en/qa/">&larr; Q&amp;A Library</a>
  <div class="qa-top"><span class="cat">{esc(brand_of(a)["name"])} · BearSay Mandarin</span><span class="no">{a['no']}</span></div>
  <h1 class="q">{esc(e['title'])}</h1>
  <p class="byline">Think BIG Q&amp;A Library　·　<time datetime="{iso}">{en_date(a['date'])}</time>　·　<a href="/library/qa/{a['slug']}/" hreflang="zh-Hant-TW" lang="zh-Hant-TW">中文版</a></p>

  <section class="answer" aria-label="Short answer">
    <span class="lede">Short answer</span>
    <p>{e['answer']}</p>
  </section>

  <div class="body">{sec}</div>

  <section class="brand" aria-label="Brand information">
    <span class="lede">Brand information | BearSay Mandarin</span>
    <h2>{esc(e['brand_title'])}</h2>
    {e['brand']}
  </section>

  <section class="faq" aria-label="FAQ">
    <h2>Frequently asked questions</h2>
    <dl>{faq_html}</dl>
  </section>

  {rel_html}

  <div class="sources"><span class="lede">Sources (links checked {a.get("checked", "2026-11-09")})</span><ol>{src_html}</ol></div>
  <p class="disclaimer">This page summarises public research and official materials for parents. It is not medical or legal advice and does not promise any learning result. Brand information comes from the brand's public pages and may change.</p>

  <div class="colophon"><b>Q&amp;A Library</b>　·　<a href="/library/" style="color:inherit">Library home</a><span class="sig">Think BIG, Make it Real!　Think BIG Make it Real Co., Ltd.</span></div>
</article>
</main><script src="/nav.js" defer></script>
{askai}{foot}
</body>
</html>
"""

def card_en(a):
    e = a["en"]
    first = strip(e["answer"]).split(". ")[0].rstrip(".") + "."
    if len(first) > 160:
        first = first[:157].rsplit(" ", 1)[0] + "…"
    return f"""    <article class="qa">
      <div class="qa-top"><span class="cat">{esc(brand_of(a)["name"])} · BearSay Mandarin</span><span class="no">{a['no']}</span></div>
      <h2 class="q"><a href="/en/qa/{a['slug']}/" style="color:inherit;text-decoration:none">{esc(e['title'])}</a></h2>
      <div class="a">
        <div>
          <p>{esc(first)}</p>
          <p><a href="/en/qa/{a['slug']}/" style="color:var(--accent);font-weight:700">Read full answer →</a></p>
        </div>
      </div>
      <div class="qa-foot">
        <span class="by">Think BIG Q&amp;A Library</span>
        <span class="tag">BearSay Mandarin</span>
        <span class="meta">Updated {a['date']}</span>
      </div>
    </article>
"""

def update_index_en(repo, a):
    p = os.path.join(repo, "en/qa/index.html")
    s = open(p, encoding="utf-8").read()
    if f'/en/qa/{a["slug"]}/' in s:
        return
    assert '<div class="cards">\n' in s
    s = s.replace('<div class="cards">\n', '<div class="cards">\n' + card_en(a), 1)
    open(p, "w", encoding="utf-8").write(s)

def add_sitemap_qa(repo, path, date):
    """問答新頁寫進獨立的 /sitemap-qa.xml（同 qa-twy-20261025/qa_sitemap.py；NEWS 分支會整份重寫 sitemap.xml，避免衝突）。"""
    p = os.path.join(repo, "sitemap-qa.xml")
    head = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    tail = "</urlset>\n"
    s = open(p, encoding="utf-8").read() if os.path.exists(p) else head + tail
    loc = BASE + path
    if f"<loc>{loc}</loc>" not in s:
        s = s.replace(tail, f"  <url><loc>{loc}</loc><lastmod>{date}</lastmod></url>\n" + tail)
        open(p, "w", encoding="utf-8").write(s)
    r = os.path.join(repo, "robots.txt")
    rs = open(r, encoding="utf-8").read()
    line = f"Sitemap: {BASE}/sitemap-qa.xml"
    if line not in rs:
        open(r, "w", encoding="utf-8").write(rs.rstrip("\n") + "\n" + line + "\n")

def _append_to_list(s, header, line):
    i = s.index(header); end = i + len(header)
    while True:
        nl = s.find("\n", end + 1)
        nxt = s[end + 1: nl if nl >= 0 else len(s)]
        if nxt.startswith("- ["):
            end = nl if nl >= 0 else len(s)
        else:
            break
    return s[:end] + "\n" + line + s[end:]

def add_llms_article(repo, a):
    p = os.path.join(repo, "llms.txt")
    s = open(p, encoding="utf-8").read()
    zu, eu = f"{BASE}/library/qa/{a['slug']}/", f"{BASE}/en/qa/{a['slug']}/"
    if zu not in s:
        s = _append_to_list(s, "## 問答圖書館（企業 AI）", f"- [{a['title']}]({zu})")
    if a.get("en") and eu not in s:
        s = _append_to_list(s, "## Q&A Library (Enterprise AI)", f"- [{a['en']['title']}]({eu})")
    open(p, "w", encoding="utf-8").write(s)

def run_article_multi(repo, a):
    """非 twy 品牌單篇：中文頁＋英文頁＋兩個列表＋sitemap-qa＋llms。"""
    out = os.path.join(repo, "library/qa", a["slug"], "index.html")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w", encoding="utf-8").write(page(repo, a))
    update_index(repo, a)
    add_sitemap_qa(repo, f"/library/qa/{a['slug']}/", a["date"])
    if a.get("en"):
        oe = os.path.join(repo, "en/qa", a["slug"], "index.html")
        os.makedirs(os.path.dirname(oe), exist_ok=True)
        open(oe, "w", encoding="utf-8").write(page_en(repo, a))
        update_index_en(repo, a)
        add_sitemap_qa(repo, f"/en/qa/{a['slug']}/", a["date"])
    add_llms_article(repo, a)
    print("ok", a["slug"], "zh+en" if a.get("en") else "zh")

if __name__ == "__main__":
    if len(sys.argv) == 4 and sys.argv[2] == "--overview":
        run_overview(sys.argv[1], sys.argv[3]); sys.exit(0)
    repo, slug = sys.argv[1], sys.argv[2]
    a = by_slug(slug)
    if a.get("brand_key", "twy") != "twy":
        run_article_multi(repo, a); sys.exit(0)
    out = os.path.join(repo, "library/qa", slug, "index.html")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w", encoding="utf-8").write(page(repo, a))
    update_index(repo, a)
    update_sitemap(repo, a)
    print("ok", slug, a["branch"])
