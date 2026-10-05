"""Synchronize static navigation/footer without rewriting page bodies or prices.
Run from the repository root: python3 scripts/sync-site-chrome.py
"""
from pathlib import Path
import re,json
ROOT=Path(__file__).resolve().parents[1]

# ── Chinese chrome ─────────────────────────────────────────────────────────────
LINKS=[('企業導入','/enterprise/'),('AI 部門','/enterprise/departments/'),('SEO／GEO','/services/ai-visibility/'),('個人方案','/pricing/personal/'),('導入流程','/enterprise/process/'),('資安承諾','/trust/'),('指南','/guides/'),('作品集','/portfolio/'),('Library','/library/')]
PERSONAL=('pricing/personal/','annual/','annual-pro/','annual-flagship/','solo-pro/','openclaw-starter/','hermes-starter/','dual-agent/','full-agent/','skill-pack/','gift/','lobster/','harness/','guides/openclaw-daizhuang/','guides/openclaw-safe/','guides/hermes-vs-openclaw/','guides/yuanduan-daizhuang/')
LOGO='<img src="/assets/brand/thinkbig-dark.png" width="1509" height="297" alt="Think BIG">'
IG_SVG='<div class="tb-f-social"><a href="https://www.instagram.com/think_big_ai/" target="_blank" rel="noopener" aria-label="Instagram @think_big_ai"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg></a><a href="https://lin.ee/n5KW430" target="_blank" rel="noopener noreferrer" aria-label="LINE 官方帳號"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg></a><a href="https://www.youtube.com/@think_big_ai_tw" target="_blank" rel="noopener noreferrer" aria-label="YouTube @think_big_ai_tw"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg></a></div>'

# ── English chrome ─────────────────────────────────────────────────────────────
EN_LINKS=[('Enterprise','/enterprise/'),('AI Departments','/enterprise/departments/'),('SEO / GEO','/en/services/seo-geo/'),('Personal plans','/en/pricing/'),('Deployment Process','/enterprise/process/'),('Security','/trust/'),('Guides','/guides/'),('Portfolio','/portfolio/en/'),('News','/en/news/')]
# English page relative-path prefix → corresponding Chinese page URL for 中文 toggle
ZH_BACK={
 'en/contact/':'/contact/',
 'en/pricing/':'/pricing/',
 'en/guides/ai-agents/':'/guides/ai-agents/',
 'en/news/lobster-hermes-abandonment-20261003/':'/library/news/lobster-hermes-abandonment-20261003/',
 'en/news/local-llm-gpu-check-20261005/':'/library/news/local-llm-gpu-check-20261005/',
 'en/news/':'/library/news/',
 'en/services/seo-geo/':'/services/ai-visibility/',
 'en/':'/','portfolio/en/':'/portfolio/',
}
def get_zh_dest(rel):
 # Sort by length descending so longer (more specific) prefixes match first
 for prefix in sorted(ZH_BACK,key=len,reverse=True):
  if rel.startswith(prefix) or rel==prefix.rstrip('/'):return ZH_BACK[prefix]
 return '/'

def chrome():
 nav_links=''.join(f'<a href="{url}"'+(' class="tb-info-start"' if name=='導入流程' else '')+f'>{name}</a>' for name,url in LINKS)
 footer_links=''.join(('<i class="tb-f-break" aria-hidden="true"></i>' if name=='導入流程' else '')+f'<a href="{url}">{name}</a>' for name,url in LINKS)
 nav=f'''<!-- TB:NAV:START -->
<nav id="tb-nav" aria-label="主要導覽"><a class="tb-logo" href="/" aria-label="Think BIG 首頁">{LOGO}</a><div class="tb-links">{nav_links}</div><details class="tb-menu"><summary>選單</summary><div class="tb-links">{nav_links}</div></details></nav>
<!-- TB:NAV:END -->'''
 footer=f'''<!-- TB:FOOTER:START -->
<footer id="tb-footer"><div><a class="tb-f-logo" href="/" aria-label="Think BIG 首頁">{LOGO}</a><p>企業 AI Agent 導入與治理。<br>地端部署・流程整合・年度維運</p>{IG_SVG}</div><div class="tb-f-links">{footer_links}<a href="https://lin.ee/n5KW430" target="_blank" rel="noopener noreferrer">LINE 洽詢 ↗</a></div><div class="tb-copy"><span>© 2026 Think BIG・台灣</span><div class="tb-legal"><a href="/about/">關於 Think BIG</a><a href="/guides/glossary/">術語表</a><a href="/privacy.html">隱私權政策</a><a href="/terms.html">服務條款</a><a href="/contact/">聯絡我們</a><a href="/faq/">常見問題</a><a href="/tbos/en/" lang="en">English</a></div></div></footer>
<!-- TB:FOOTER:END -->'''
 return nav,footer

def en_chrome(zh_url):
 nav_links=''.join(f'<a href="{url}"'+(' class="tb-info-start"' if name=='Deployment Process' else '')+f'>{name}</a>' for name,url in EN_LINKS)
 footer_links=''.join(('<i class="tb-f-break" aria-hidden="true"></i>' if name=='Deployment Process' else '')+f'<a href="{url}">{name}</a>' for name,url in EN_LINKS)
 zh=f'<a href="{zh_url}" lang="zh-Hant">中文</a>'
 nav=f'''<!-- TB:NAV:START -->
<nav id="tb-nav" aria-label="Main navigation"><a class="tb-logo" href="/en/" aria-label="Think BIG home">{LOGO}</a><div class="tb-links">{nav_links}{zh}</div><details class="tb-menu"><summary>Menu</summary><div class="tb-links">{nav_links}{zh}</div></details></nav>
<!-- TB:NAV:END -->'''
 footer=f'''<!-- TB:FOOTER:START -->
<footer id="tb-footer"><div><a class="tb-f-logo" href="/en/" aria-label="Think BIG home">{LOGO}</a><p>Enterprise AI Agent Deployment &amp; Governance.<br>On-premises deployment &middot; Workflow integration &middot; Annual operations</p>{IG_SVG}</div><div class="tb-f-links">{footer_links}<a href="https://lin.ee/n5KW430" target="_blank" rel="noopener noreferrer">Consult via LINE &#x2197;</a></div><div class="tb-copy"><span>&copy; 2026 Think BIG &middot; Taiwan</span><div class="tb-legal"><a href="/about/">About Think BIG</a><a href="/guides/glossary/">Glossary</a><a href="/privacy.html">Privacy Policy</a><a href="/terms.html">Terms of Service</a><a href="/en/contact/">Contact Us</a><a href="/faq/">FAQ</a><a href="{zh_url}" lang="zh-Hant">中文</a></div></div></footer>
<!-- TB:FOOTER:END -->'''
 return nav,footer

nav,footer=chrome()
bundles=json.loads((ROOT/'data/css-bundles.json').read_text())
def has_style(raw, source):
 if source in raw:return True
 return any(source in bundles.get(href,[]) for href in re.findall(r'href=["\']([^"\']+)["\']',raw))

# English page path prefixes (relative to ROOT)
EN_PREFIXES=('en/','portfolio/en/')

# Operational tools, meeting/admin pages and historical English sales microsite
# keep their application layout. Brand image metadata is updated separately.
for p in ROOT.rglob('*.html'):
 rel=p.relative_to(ROOT).as_posix()
 if rel.startswith(('meeting/','clawland/','tbos/','v2/','puig/')) or rel in ['og-image.html','google1d7d25342b26d0e8.html']:continue
 s=p.read_text()
 if '<body' not in s:continue
 # Remove existing chrome blocks
 s=re.sub(r'\n?<!-- TB:NAV:START -->.*?<!-- TB:NAV:END -->\s*','',s,flags=re.S)
 s=re.sub(r'\n?<!-- TB:FOOTER:START -->.*?<!-- TB:FOOTER:END -->\s*','',s,flags=re.S)
 s=re.sub(r'<footer\b[^>]*\bid="tb-footer".*?</footer>','',s,flags=re.S)
 is_english=any(rel.startswith(pre) for pre in EN_PREFIXES)
 if is_english:
  # Remove any legacy standalone English nav elements left in page body
  s=re.sub(r'<nav\b[^>]*\bid="tb-nav"[^>]*>.*?</nav>','',s,flags=re.S)
  s=re.sub(r'<nav\b[^>]*\bclass="nav-eng"[^>]*>.*?</nav>','',s,flags=re.S)
  # Remove orphaned TB:NAV:END comments and legacy standalone nav/footer comments
  s=re.sub(r'\s*<!--\s*TB:NAV:END\s*-->','',s)
  s=re.sub(r'<!--\s*English (?:nav|footer)[^>]*-->','',s)
  # Build and inject English chrome
  zh_url=get_zh_dest(rel)
  nav_en,footer_en=en_chrome(zh_url)
  s=re.sub(r'(<body\b[^>]*>)',lambda m:m[1]+'\n'+nav_en,s,count=1)
  s=s.replace('</body>',footer_en+'\n</body>')
 else:
  # Chinese pages: standard chrome
  s=re.sub(r'<!-- TB:PERSONAL:START -->.*?<!-- TB:PERSONAL:END -->','',s,flags=re.S)
  s=re.sub(r'(<body\b[^>]*>)',lambda m:m[1]+'\n'+nav,s,count=1)
  s=s.replace('</body>',footer+'\n</body>')
  if rel.startswith(PERSONAL):
   personal='<div class="tb-personal-context"><a href="/pricing/personal/">個人方案專區</a><span>個人 AI 助理與工作流程服務。</span></div>'
   s=s.replace('<!-- TB:NAV:END -->','<!-- TB:NAV:END --><!-- TB:PERSONAL:START -->'+personal+'<!-- TB:PERSONAL:END -->')
   if not has_style(s,'/assets/brand/personal.css'):s=s.replace('</head>','<link rel="stylesheet" href="/assets/brand/personal.css"></head>')
 if not has_style(s,'/assets/brand/chrome.css'):s=s.replace('</head>','<link rel="stylesheet" href="/assets/brand/chrome.css">\n</head>')
 if not has_style(s,'/assets/homesplit/apple.css'):s=s.replace('</head>','<link rel="stylesheet" href="/assets/homesplit/apple.css">\n</head>')
 if '/nav.js' not in s:s=s.replace('</body>','<script src="/nav.js" defer></script>\n</body>')
 p.write_text(s)
print('Static website navigation and footers synchronized.')
