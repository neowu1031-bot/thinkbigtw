"""Synchronize static navigation/footer without rewriting page bodies or prices.
Run from the repository root: python3 scripts/sync-site-chrome.py [--check]
"""
from pathlib import Path
import re,json,sys
CHECK = "--check" in sys.argv[1:]
changed = []
ROOT=Path(__file__).resolve().parents[1]

# ── Chinese chrome ─────────────────────────────────────────────────────────────
LINKS=[('企業導入','/enterprise/'),('AI 部門','/enterprise/departments/'),('SEO／AEO／GEO','/services/ai-visibility/'),('個人方案','/pricing/personal/'),('導入流程','/enterprise/process/'),('資安與治理','/trust/'),('指南','/guides/'),('作品集','/portfolio/'),('Library','/library/'),('AI 實戰體驗','/experience/')]
PERSONAL=('pricing/personal/','annual/','annual-pro/','annual-flagship/','solo-pro/','openclaw-starter/','hermes-starter/','dual-agent/','single-agent/','full-agent/','skill-pack/','gift/','lobster/','harness/','guides/openclaw-daizhuang/','guides/openclaw-safe/','guides/hermes-vs-openclaw/','guides/yuanduan-daizhuang/')
LOGO='<img src="/assets/brand/thinkbig-dark.png" width="1509" height="327" alt="Think BIG">'
IG_SVG='<div class="tb-f-social"><a href="https://www.instagram.com/think_big_ai/" target="_blank" rel="noopener" aria-label="Instagram @think_big_ai"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg></a><a href="https://lin.ee/n5KW430" target="_blank" rel="noopener noreferrer" aria-label="LINE 官方帳號"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg></a><a href="https://www.youtube.com/@think_big_ai_tw" target="_blank" rel="noopener noreferrer" aria-label="YouTube @think_big_ai_tw"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M23.495 6.205a3.007 3.007 0 0 0-2.088-2.088c-1.87-.501-9.396-.501-9.396-.501s-7.507-.01-9.396.501A3.007 3.007 0 0 0 .527 6.205a31.247 31.247 0 0 0-.522 5.805 31.247 31.247 0 0 0 .522 5.783 3.007 3.007 0 0 0 2.088 2.088c1.868.502 9.396.502 9.396.502s7.506 0 9.396-.502a3.007 3.007 0 0 0 2.088-2.088 31.247 31.247 0 0 0 .5-5.783 31.247 31.247 0 0 0-.5-5.805zM9.609 15.601V8.408l6.264 3.602z"/></svg></a></div>'

import json as _j
WA_NUM=_j.loads((ROOT/'data/whatsapp.json').read_text())['number']
WA_URL=f'https://wa.me/{WA_NUM}?text=Hi%20Think%20BIG%2C%20I%27d%20like%20to%20ask%20about%20your%20AI%20Agent%20services.'
WA_SVG='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>'
# ── English chrome ─────────────────────────────────────────────────────────────
EN_LINKS=[('Enterprise (Chinese)','/enterprise/'),('AI Departments (Chinese)','/enterprise/departments/'),('SEO / AEO / GEO','/en/services/seo-geo/'),('Personal plans','/en/pricing/'),('Deployment Process (Chinese)','/enterprise/process/'),('Security (Chinese)','/trust/'),('Guides (Chinese)','/guides/'),('Portfolio','/portfolio/en/'),('News','/en/news/')]
# English pages never show LINE (Chinese-only channel). Telegram is reserved in the layout until the support bot goes live.
EN_IG_SVG=re.sub(r'<a href="https://lin\.ee/[^"]*"[^>]*>.*?</a>','',IG_SVG,count=1,flags=re.S)
# English page relative-path prefix → corresponding Chinese page URL for 中文 toggle
ZH_BACK={
 'en/contact/':'/contact/',
 'en/terms/':'/terms.html',
 'en/privacy/':'/privacy.html',
 'en/faq/':'/faq/',
 'en/pricing/ai-assistant-cost/':'/pricing/ai-assistant-cost/',
 'en/pricing/':'/pricing/',
 'en/guides/ai-agents/':'/guides/ai-agents/',
 'en/news/lobster-hermes-abandonment-20261003/':'/library/news/lobster-hermes-abandonment-20261003/',
 'en/news/local-llm-gpu-check-20261005/':'/library/news/local-llm-gpu-check-20261005/',
 'en/news/':'/library/news/',
 'en/services/seo-geo/':'/services/ai-visibility/',
 'en/services/ai-agent-setup/':'/services/ai-agent-setup/',
 'en/briefing/':'/briefing/',
 'en/':'/','portfolio/en/':'/portfolio/',
}
def get_zh_dest(rel):
 rr=rel[:-10] if rel.endswith('index.html') else rel
 # Longest explicit mapping first (skip the catch-all roots handled below).
 for prefix in sorted(ZH_BACK,key=len,reverse=True):
  if prefix in ('en/','portfolio/en/'):continue
  if rr==prefix:return ZH_BACK[prefix]
  if rr.startswith(prefix):return _zh_counterpart(rel) or ZH_BACK[prefix]
 if rr in ('en/','portfolio/en/'):return ZH_BACK[rr]
 return _zh_counterpart(rel) or '/'

def _zh_counterpart(rel):
 """en/X/index.html -> /X/ (or /library/X/ for qa/news) when that Chinese page exists."""
 if not rel.startswith('en/'):return None
 x=rel[3:]
 if x.endswith('index.html'):x=x[:-10]
 x=x.strip('/')
 if not x:return '/'
 for cand in (x,'library/'+x):
  if (ROOT/cand/'index.html').exists():return '/'+cand+'/'
 return None

def get_en_dest(rel):
 """Chinese page -> its English counterpart; falls back to the English home page."""
 if rel=='index.html':return '/en/'
 if rel in ('privacy.html','terms.html'):return '/en/'+rel[:-5]+'/'
 if rel.startswith('portfolio/') and (ROOT/'portfolio/en/index.html').exists() and rel=='portfolio/index.html':return '/portfolio/en/'
 d=rel[:-10] if rel.endswith('index.html') else None
 if d is None:return '/en/'
 d=d.strip('/')
 if d=='services/ai-visibility':return '/en/services/seo-geo/'
 if (ROOT/d/'en/index.html').exists():return '/'+d+'/en/'
 cands=[d]
 if d.startswith('library/'):cands.append(d[len('library/'):])
 for c in cands:
  if (ROOT/'en'/c/'index.html').exists():return '/en/'+c+'/'
 return '/en/'

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
<footer id="tb-footer"><div><a class="tb-f-logo" href="/en/" aria-label="Think BIG home">{LOGO}</a><p>Enterprise AI Agent Deployment &amp; Governance.<br>On-premises deployment &middot; Workflow integration &middot; Annual operations</p>{EN_IG_SVG[:-6]}<a href="{WA_URL}" target="_blank" rel="noopener noreferrer" aria-label="Think BIG on WhatsApp">{WA_SVG}</a></div></div><div class="tb-f-links">{footer_links}<a href="{WA_URL}" target="_blank" rel="noopener noreferrer">Think BIG on WhatsApp &#x2197;</a><!-- TB:TELEGRAM:RESERVED --></div><div class="tb-copy"><span>&copy; 2026 Think BIG &middot; Taiwan</span><div class="tb-legal"><a href="/en/about/">About Think BIG</a><a href="/guides/glossary/">Glossary (Chinese)</a><a href="/en/privacy/">Privacy Policy</a><a href="/en/terms/">Terms of Service</a><a href="/en/contact/">Contact Us</a><a href="/en/faq/">FAQ</a><a href="{zh_url}" lang="zh-Hant">中文</a></div></div></footer>
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
 original=p.read_text()
 s=original
 if '<body' not in s:continue
 if 'http-equiv="refresh"' in s:continue  # redirect stubs keep no site chrome
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
  s=s.replace('</body>',footer.replace('href="/tbos/en/" lang="en"','href="'+get_en_dest(rel)+'" lang="en"')+'\n</body>')
  if rel.startswith(PERSONAL):
   personal='<div class="tb-personal-context"><a href="/pricing/personal/">個人方案專區</a><span>個人 AI 助理與工作流程服務。</span></div>'
   s=s.replace('<!-- TB:NAV:END -->','<!-- TB:NAV:END --><!-- TB:PERSONAL:START -->'+personal+'<!-- TB:PERSONAL:END -->')
   if not has_style(s,'/assets/brand/personal.css'):s=s.replace('</head>','<link rel="stylesheet" href="/assets/brand/personal.css"></head>')
 if not has_style(s,'/assets/brand/chrome.css'):s=s.replace('</head>','<link rel="stylesheet" href="/assets/brand/chrome.css">\n</head>')
 if not has_style(s,'/assets/homesplit/apple.css'):s=s.replace('</head>','<link rel="stylesheet" href="/assets/homesplit/apple.css">\n</head>')
 if '/nav.js' not in s:s=s.replace('</body>','<script src="/nav.js" defer></script>\n</body>')
 if s != original:
  changed.append(rel)
  if not CHECK:p.write_text(s)
if CHECK:
 print(f'Chrome check: {len(changed)} page(s) need synchronization; no files written.')
 for rel in changed:print(rel)
 sys.exit(bool(changed))
print('Static website navigation and footers synchronized.')
