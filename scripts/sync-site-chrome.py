"""Synchronize static navigation/footer without rewriting page bodies or prices.
Run from the repository root: python3 scripts/sync-site-chrome.py
"""
from pathlib import Path
import re,json
ROOT=Path(__file__).resolve().parents[1]
LINKS=[('企業導入','/enterprise/'),('AI 部門','/enterprise/departments/'),('SEO／GEO','/services/ai-visibility/'),('個人方案','/pricing/personal/'),('導入流程','/enterprise/process/'),('資安承諾','/trust/'),('指南','/guides/'),('作品集','/portfolio/'),('Library','/library/')]
PERSONAL=('pricing/personal/','annual/','annual-pro/','annual-flagship/','solo-pro/','openclaw-starter/','hermes-starter/','dual-agent/','full-agent/','skill-pack/','gift/','lobster/','harness/','guides/openclaw-daizhuang/','guides/openclaw-safe/','guides/hermes-vs-openclaw/','guides/yuanduan-daizhuang/')
LOGO='<img src="/assets/brand/thinkbig-dark.png" width="1509" height="297" alt="Think BIG">'
def chrome():
 links=''.join(f'<a href="{url}"'+(' class="tb-info-start"' if name=='導入流程' else '')+f'>{name}</a>' for name,url in LINKS)
 nav=f'''<!-- TB:NAV:START -->
<nav id="tb-nav" aria-label="主要導覽"><a class="tb-logo" href="/" aria-label="Think BIG 首頁">{LOGO}</a><div class="tb-links">{links}</div><details class="tb-menu"><summary>選單</summary><div class="tb-links">{links}</div></details></nav>
<!-- TB:NAV:END -->'''
 IG_SVG='<div class="tb-f-social"><a href="https://www.instagram.com/think_big_ai/" target="_blank" rel="noopener" aria-label="Instagram @think_big_ai"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg></a></div>'
 footer=f'''<!-- TB:FOOTER:START -->
<footer id="tb-footer"><div><a class="tb-f-logo" href="/" aria-label="Think BIG 首頁">{LOGO}</a><p>企業 AI Agent 導入與治理。<br>地端部署・流程整合・年度維運</p>{IG_SVG}</div><div class="tb-f-links">{links}<a href="https://lin.ee/n5KW430" target="_blank" rel="noopener noreferrer">LINE 洽詢 ↗</a></div><div class="tb-copy"><span>© 2026 Think BIG・台灣</span><div class="tb-legal"><a href="/about/">關於 Think BIG</a><a href="/guides/glossary/">術語表</a><a href="/privacy.html">隱私權政策</a><a href="/terms.html">服務條款</a><a href="/contact/">聯絡我們</a><a href="/faq/">常見問題</a><a href="/tbos/en/" lang="en">English</a></div></div></footer>
<!-- TB:FOOTER:END -->'''
 return nav,footer
nav,footer=chrome()
bundles=json.loads((ROOT/'data/css-bundles.json').read_text())
def has_style(raw, source):
 if source in raw:return True
 return any(source in bundles.get(href,[]) for href in re.findall(r'href=["\']([^"\']+)["\']',raw))
# Operational tools, meeting/admin pages and historical English sales microsite
# keep their application layout. Brand image metadata is updated separately.
for p in ROOT.rglob('*.html'):
 rel=p.relative_to(ROOT).as_posix()
 if rel.startswith(('meeting/','clawland/','tbos/','v2/','puig/')) or rel in ['og-image.html','google1d7d25342b26d0e8.html']:continue
 s=p.read_text()
 if '<body' not in s:continue
 s=re.sub(r'\n?<!-- TB:NAV:START -->.*?<!-- TB:NAV:END -->\s*','',s,flags=re.S)
 s=re.sub(r'\n?<!-- TB:FOOTER:START -->.*?<!-- TB:FOOTER:END -->\s*','',s,flags=re.S)
 s=re.sub(r'<footer\b[^>]*\bid="tb-footer".*?</footer>','',s,flags=re.S)
 # Consolidate generated website header only, leaving article headings/breadcrumbs intact.
 s=re.sub(r'(<body\b[^>]*>)',lambda m:m[1]+'\n'+nav,s,count=1)
 s=s.replace('</body>',footer+'\n</body>')
 s=re.sub(r'<!-- TB:PERSONAL:START -->.*?<!-- TB:PERSONAL:END -->','',s,flags=re.S)
 if rel.startswith(PERSONAL):
  personal='<div class="tb-personal-context"><a href="/pricing/personal/">個人方案專區</a><span>個人 AI 助理與工作流程服務。</span></div>'
  s=s.replace('<!-- TB:NAV:END -->','<!-- TB:NAV:END --><!-- TB:PERSONAL:START -->'+personal+'<!-- TB:PERSONAL:END -->')
  if not has_style(s,'/assets/brand/personal.css'):s=s.replace('</head>','<link rel="stylesheet" href="/assets/brand/personal.css"></head>')
 if not has_style(s,'/assets/brand/chrome.css'):s=s.replace('</head>','<link rel="stylesheet" href="/assets/brand/chrome.css">\n</head>')
 if not has_style(s,'/assets/homesplit/apple.css'):s=s.replace('</head>','<link rel="stylesheet" href="/assets/homesplit/apple.css">\n</head>')
 if '/nav.js' not in s:s=s.replace('</body>','<script src="/nav.js" defer></script>\n</body>')
 p.write_text(s)
print('Static website navigation and footers synchronized.')
