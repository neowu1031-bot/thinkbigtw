#!/usr/bin/env python3
"""Read-only safety scan for the free-resources pages. Writes nothing.
Usage (repo root): python3 scripts/check-free-resources.py [--kb DIR]
Exit code 1 if any FAIL. WARN items need a human look.

Checks
 A. Every prompt text in data/free-resources.json (zh + en):
    invisible / zero-width / BiDi / control / tag / variation-selector characters,
    HTML tags, comments, markdown links/images/code, URLs, data: / javascript: schemes,
    instructions asking the AI to run system commands, read/write files, reach the
    network, bypass safety rules, or ask for personal data / credentials.
 B. The rendered pages (free-resources/, en/free-resources/):
    prompt <pre> text identical to the JSON text; no hidden-content tricks; scripts limited to
    GA4 + same-origin; no iframe/object/embed/download; no inline on* handlers; every
    external link has rel="noopener noreferrer"; copy buttons point to existing <pre>.
 C. No executable / macro / archive / script files in the page folders.
 D. (optional, --kb DIR) zh prompt text appears verbatim in the KB source files.
 E. SHA-256 of every prompt and page.
"""
import hashlib, json, re, sys, unicodedata
from html import unescape
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / 'data/free-resources.json').read_text())
fails, warns, lines = [], [], []

def sha(s): return hashlib.sha256(s.encode('utf-8')).hexdigest()
def fail(m): fails.append(m)
def warn(m): warns.append(m)

# ---------- A. prompt text ----------
BAD_CODEPOINTS = lambda ch: (
    unicodedata.category(ch) in ('Cf', 'Cc', 'Cs', 'Co', 'Cn') and ch not in '\n'
    or 0xFE00 <= ord(ch) <= 0xFE0F or 0xE0000 <= ord(ch) <= 0xE007F or 0xE0100 <= ord(ch) <= 0xE01EF
    or ch in '   ㅤᅟᅠ᠎')
ALLOWED_BRACKETS = re.compile(r'^\[(Intro|Verse|Pre-Chorus|Chorus|Bridge|Outro|Final Chorus|End)\]$')
PATTERNS = [
    ('html/markup', r'<[^>]*>|<!--|-->|&lt;|&gt;|&#'),
    ('markdown link/image/code', r'!\[|\]\(|`|~~~'),
    ('url/scheme', r'https?://|www\.|ftp:|data:|javascript:|file:|mailto:'),
    ('shell/system command (zh)', r'執行(?:指令|命令|程式|腳本)|終端機|命令列|系統指令|作業系統'),
    ('shell/system command (en)', r'\b(?:sudo|bash|zsh|powershell|cmd\.exe|rm\s+-|curl|wget|chmod|eval\(|exec\(|system prompt|terminal|shell command|run (?:this )?(?:command|script|code))\b'),
    ('file read/write (zh)', r'讀取(?:檔案|文件|本機|電腦)|寫入(?:檔案|文件)|刪除(?:檔案|文件)|存取(?:檔案|電腦|本機)|開啟(?:檔案|資料夾)'),
    ('file read/write (en)', r'\b(?:read|write|delete|open|access|overwrite)\s+(?:the\s+|any\s+|my\s+)?(?:files?|folders?|directory|disk|filesystem)\b'),
    ('network (zh)', r'連(?:外)?網|上網|搜尋網路|瀏覽網頁|下載|傳送到|傳到(?:伺服器|外部)|發送(?:到|至)'),
    ('network (en)', r'\b(?:browse the web|search the web|fetch|download|upload to|send to|post to|visit)\b'),
    ('bypass safety (zh)', r'忽略(?:以上|先前|之前|所有)|無視(?:規則|限制|安全)|繞過|越獄|不受(?:限制|約束)|解除(?:限制|安全)|假裝你(?:沒有|不受)'),
    ('bypass safety (en)', r'\b(?:ignore (?:all |any )?(?:previous|above|prior)|disregard|jailbreak|bypass|override|developer mode|DAN\b|no restrictions|without restrictions|pretend you (?:have no|are not))\b'),
    ('personal data / credentials (zh)', r'密碼|帳號|身分證|護照|信用卡|驗證碼|金鑰|私鑰|地址|電話號碼|手機號碼|銀行'),
    ('personal data / credentials (en)', r'\b(?:password|passcode|api[ -]?key|secret key|private key|token|credit card|ssn|social security|passport|bank account|phone number|home address)\b'),
]
n_prompts = 0
all_prompts = []
for c in data['cards']:
    for i, it in enumerate(c['items'], 1):
        for lang in ('zh', 'en'):
            txt = it['text'][lang]
            n_prompts += 1
            tag = f"{c['id']}#{i}/{lang}"
            all_prompts.append((tag, txt))
            if unicodedata.normalize('NFC', txt) != txt: warn(f'{tag}: not NFC-normalised')
            if txt != txt.strip(): warn(f'{tag}: leading/trailing whitespace')
            for pos, ch in enumerate(txt):
                if BAD_CODEPOINTS(ch):
                    fail(f'{tag}: hidden/control character U+{ord(ch):04X} ({unicodedata.name(ch, "?")}) at {pos}')
            for name, pat in PATTERNS:
                for m in re.finditer(pat, txt, re.I):
                    # the safe negative phrasing "不要…文字/特效" is not in these patterns, so any hit needs a look
                    fail(f'{tag}: [{name}] matched "{m.group(0)}"')
            for ln in txt.split('\n'):
                for br in re.findall(r'\[[^\]]*\]', ln):
                    if not ALLOWED_BRACKETS.match(br): warn(f'{tag}: bracket text "{br}" is not a Suno section tag')
            if len(txt) > 2500: warn(f'{tag}: unusually long ({len(txt)} chars)')
            if re.search(r'[A-Za-z0-9+/]{60,}={0,2}', txt): fail(f'{tag}: long base64-like run')

# ---------- B. rendered pages ----------
class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.scripts, self.links, self.issues, self.pre, self.buttons, self.ids = [], [], [], {}, [], set()
        self._pre = None; self._script = False; self.stack = []
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get('id'): self.ids.add(a['id'])
        for k in a:
            if k.startswith('on'): self.issues.append(f'inline handler {k} on <{tag}>')
        style = (a.get('style') or '').replace(' ', '').lower()
        if re.search(r'display:none|visibility:hidden|opacity:0|font-size:0|color:#fff|color:white|text-indent:-|clip:rect|height:0|width:0', style):
            self.issues.append(f'hidden-style on <{tag}>: {style}')
        if 'hidden' in a or a.get('aria-hidden') == 'true':
            if tag not in ('i', 'svg'): self.issues.append(f'hidden/aria-hidden on <{tag}>')
        if tag in ('iframe', 'object', 'embed', 'applet', 'frame', 'base', 'meta') and tag != 'meta':
            self.issues.append(f'forbidden <{tag}>')
        if tag == 'meta' and (a.get('http-equiv') or '').lower() == 'refresh': self.issues.append('meta refresh')
        if tag == 'script':
            self.scripts.append(a.get('src')); self._script = True
        if tag == 'a':
            self.links.append(a)
            if 'download' in a: self.issues.append(f'download attribute: {a.get("href")}')
        if tag == 'form':
            act = a.get('action', '')
            if act not in ('#', ''): self.issues.append(f'form action {act}')
        if tag == 'button' and 'data-copy-target' in a: self.buttons.append(a)
        if tag == 'pre' and a.get('id'): self._pre = a['id']; self.pre[self._pre] = ''
    def handle_endtag(self, tag):
        if tag == 'script': self._script = False
        if tag == 'pre': self._pre = None
    def handle_data(self, d):
        if self._pre: self.pre[self._pre] += d
    def handle_comment(self, d):
        if 'TB:' not in d and 'Google tag' not in d: self.issues.append(f'HTML comment: {d[:60]}')

OK_SCRIPT_SRC = ('https://www.googletagmanager.com/gtag/js?id=G-7V41XYLLP5', '/nav.js', '/ask-ai.js?v=202609280928')
EXEC_EXT = re.compile(r'\.(?:exe|dmg|pkg|apk|msi|bat|cmd|sh|ps1|vbs|js|jar|py|zip|rar|7z|tar|gz|xlsm|xlsb|docm|pptm|iso|scr|lnk)(?:[?#]|$)', re.I)
page_info = []
for lang, rel in (('zh', 'free-resources/index.html'), ('en', 'en/free-resources/index.html')):
    path = ROOT / rel
    raw = path.read_text()
    page_info.append((rel, sha(raw)))
    p = P(); p.feed(raw)
    for i in p.issues: fail(f'{rel}: {i}')
    for s in p.scripts:
        if s is not None and s not in OK_SCRIPT_SRC: fail(f'{rel}: unexpected external/other script src {s}')
    n_inline = raw.count('<script>')
    for a in p.links:
        href = a.get('href') or ''
        ext = href.startswith(('http://', 'https://')) and 'thinkbigtw.com' not in href
        rel_attr = (a.get('rel') or '').split()
        if ext or a.get('target') == '_blank':
            if not ('noopener' in rel_attr and 'noreferrer' in rel_attr): fail(f'{rel}: link missing rel="noopener noreferrer": {href[:70]}')
        if re.match(r'(?i)\s*(javascript|data|vbscript):', href): fail(f'{rel}: dangerous href {href[:50]}')
        if EXEC_EXT.search(href) : fail(f'{rel}: link to downloadable/executable file type {href}')
    if re.search(r'(?i)<link[^>]+href="https?://(?!thinkbigtw\.com)', raw): fail(f'{rel}: external stylesheet/link tag')
    if re.search(r'(?i)(?:src|data)=["\']https?://', raw.replace('src="https://www.googletagmanager.com/gtag/js?id=G-7V41XYLLP5"', '')): fail(f'{rel}: external src')
    if 'eval(' in raw or 'new Function' in raw or 'innerHTML' in raw or 'document.write' in raw: fail(f'{rel}: dynamic code / innerHTML in page script')
    # prompt text parity (visible text == copied text == JSON)
    expected = {}
    for c in data['cards']:
        for i, it in enumerate(c['items'], 1): expected[f"{c['id']}-p{i}"] = it['text'][lang]
    for pid, txt in expected.items():
        if p.pre.get(pid) != txt: fail(f'{rel}: <pre id={pid}> text differs from data/free-resources.json')
    for pid in p.pre:
        if pid not in expected: fail(f'{rel}: unexpected <pre id={pid}>')
    for b in p.buttons:
        if b['data-copy-target'] not in p.pre: fail(f'{rel}: copy button points to missing <pre> {b["data-copy-target"]}')
    # copy source must be the visible pre only
    if "pre.textContent" not in raw: fail(f'{rel}: copy handler does not read pre.textContent')
    if re.search(r'clipboardData|setData\(', raw): fail(f'{rel}: custom clipboard payload')
    lines.append(f'- {rel}: scripts={[s for s in p.scripts if s]}+{n_inline} inline, links={len(p.links)}, prompt blocks={len(p.pre)}, copy buttons={len(p.buttons)}')

# ---------- C. files in page folders ----------
for d in ('free-resources', 'en/free-resources'):
    for f in (ROOT / d).rglob('*'):
        if f.is_file() and f.name != 'index.html': fail(f'unexpected file in page folder: {f.relative_to(ROOT)}')

# ---------- D. KB parity ----------
kb_note = 'skipped (no --kb)'
if '--kb' in sys.argv:
    kb = Path(sys.argv[sys.argv.index('--kb') + 1]).expanduser()
    corpus = '\n'.join(f.read_text(errors='ignore') for f in kb.rglob('*') if f.is_file() and f.suffix in ('.txt', '.md'))
    norm = lambda s: re.sub(r'\s+', '', s)
    big = norm(corpus); miss = 0
    for tag, txt in all_prompts:
        if not tag.endswith('/zh'): continue
        for ln in [l for l in txt.split('\n') if l.strip()]:
            if norm(ln) not in big and not ln.startswith(('Title：', 'Lyrics：')):
                miss += 1; warn(f'{tag}: line not found verbatim in KB: {ln[:50]}')
    kb_note = f'{miss} zh lines not found verbatim'

# ---------- report ----------
print('# Free resources safety scan (read-only)')
print(f'- prompts scanned: {n_prompts} (zh + en), cards: {len(data["cards"])}')
print('\n## Pages'); print('\n'.join(lines))
print(f'\n## KB verbatim check: {kb_note}')
print('\n## SHA-256 (pages)')
for rel, h in page_info: print(f'- {rel}  {h}')
print('\n## SHA-256 (prompts)')
for tag, txt in all_prompts: print(f'- {tag}  {sha(txt)}')
print(f'\n## Result: {len(fails)} FAIL, {len(warns)} WARN')
for m in fails: print('FAIL', m)
for m in warns: print('WARN', m)
sys.exit(1 if fails else 0)
