"""Synchronize static navigation/footer without rewriting page bodies or prices.
Run from the repository root: python3 scripts/sync-site-chrome.py
"""
from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
LINKS=[('企業導入','/enterprise/'),('AI 部門','/enterprise/departments/'),('導入流程','/enterprise/process/'),('資安承諾','/trust/'),('指南','/guides/'),('個人方案','/pricing/personal/')]
PERSONAL=('pricing/personal/','annual/','annual-pro/','annual-flagship/','solo-pro/','openclaw-starter/','hermes-starter/','dual-agent/','full-agent/','skill-pack/','gift/','lobster/','harness/','guides/openclaw-daizhuang/','guides/openclaw-safe/','guides/hermes-vs-openclaw/','guides/yuanduan-daizhuang/')
LOGO='<img src="/assets/brand/thinkbig-dark.png" width="1509" height="297" alt="Think BIG">'
def chrome():
 links=''.join(f'<a href="{url}"'+(' class="tb-personal-link"' if name=='個人方案' else '')+f'>{name}</a>' for name,url in LINKS)
 nav=f'''<!-- TB:NAV:START -->
<nav id="tb-nav" aria-label="主要導覽"><a class="tb-logo" href="/" aria-label="Think BIG 首頁">{LOGO}</a><div class="tb-links">{links}</div><details class="tb-menu"><summary>選單</summary><div class="tb-links">{links}</div></details></nav>
<!-- TB:NAV:END -->'''
 footer=f'''<!-- TB:FOOTER:START -->
<footer id="tb-footer"><div><a class="tb-f-logo" href="/" aria-label="Think BIG 首頁">{LOGO}</a><p>把一個 AI 團隊裝進你公司。<br>地端部署・流程導入・一年陪跑維護</p></div><div class="tb-f-links">{links}<a href="https://lin.ee/n5KW430" target="_blank" rel="noopener noreferrer">LINE 洽詢 ↗</a></div><div class="tb-copy"><span>© 2026 Think BIG・台灣</span><div class="tb-legal"><a href="/privacy.html">隱私權政策</a><a href="/terms.html">服務條款</a></div></div></footer>
<!-- TB:FOOTER:END -->'''
 return nav,footer
nav,footer=chrome()
# Operational tools, meeting/admin pages and historical English sales microsite
# keep their application layout. Brand image metadata is updated separately.
for p in ROOT.rglob('*.html'):
 rel=p.relative_to(ROOT).as_posix()
 if rel.startswith(('erp/','meeting/','clawland/','tbos/','v2/','puig/')) or rel in ['og-image.html','google1d7d25342b26d0e8.html']:continue
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
  personal='<div class="tb-personal-context"><a href="/pricing/personal/">個人方案專區</a><span>你的 AI 助理，從這裡開始。</span></div>'
  s=s.replace('<!-- TB:NAV:END -->','<!-- TB:NAV:END --><!-- TB:PERSONAL:START -->'+personal+'<!-- TB:PERSONAL:END -->')
  if '/assets/brand/personal.css' not in s:s=s.replace('</head>','<link rel="stylesheet" href="/assets/brand/personal.css"></head>')
 if '/assets/brand/chrome.css' not in s:s=s.replace('</head>','<link rel="stylesheet" href="/assets/brand/chrome.css">\n</head>')
 if '/nav.js' not in s:s=s.replace('</body>','<script src="/nav.js" defer></script>\n</body>')
 p.write_text(s)
print('Static website navigation and footers synchronized.')
