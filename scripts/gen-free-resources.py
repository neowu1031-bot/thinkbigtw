"""Generate /free-resources/ and /en/free-resources/ from data/free-resources.json.
Run from repo root: python3 scripts/gen-free-resources.py
Then: python3 scripts/sync-site-chrome.py && python3 scripts/build-sitemap.py
Prompts are plain text only; the copy button copies exactly the visible <pre> text.
"""
import json
from html import escape
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
D = json.loads((ROOT / 'data/free-resources.json').read_text())
WA = json.loads((ROOT / 'data/whatsapp.json').read_text())['number']
WA_URL = f'https://wa.me/{WA}?text=Hi%20Think%20BIG%2C%20I%27d%20like%20to%20ask%20about%20your%20AI%20Agent%20services.'
CAMP = D['campaign']
IG = 'https://www.instagram.com/think_big_ai/'
YT = 'https://www.youtube.com/@think_big_ai_tw'
LINE = 'https://lin.ee/n5KW430'
CSS = '/assets/generated/site-e284d01edacf.css'

T = {
 'zh': dict(
  lang='zh-Hant', url='/free-resources/', other='/en/free-resources/', locale='zh_TW',
  title='免費 AI 實作提示詞｜修老照片、搞笑修圖、照片動起來、做 GIF、做歌｜Think BIG',
  desc='Think BIG 學堂週末實作的完整提示詞，直接看、一鍵複製，不需留資料：ChatGPT 修老照片與搞笑修圖、Grok 讓照片動起來、ChatGPT 圖像風格與 GIF、Suno 做自己的歌。',
  eyebrow='FREE RESOURCES ／ 學堂週末實作', h1='免費 AI 實作提示詞',
  lede='Think BIG 學堂週末實作每一集的完整提示詞都放在這裡。直接看、一鍵複製，不需要留任何資料。',
  meta=['手機就能做', '直接複製', '不需留資料'],
  copy='複製提示詞', copied='已複製', copyfail='複製失敗，請長按文字手動選取',
  prompt_label='提示詞', video='看示範影片', ig='Instagram', yt='YouTube', tool='使用工具',
  soon='提示詞整理中，完成後會放在這裡。', soon_tag='即將公布', steps='怎麼做', notes='提醒',
  ai='本頁提示詞與圖卡為 AI 輔助製作。', ai_foot='AI 輔助製作',
  sub_h='想收到新玩法？', sub_p='有新的實作提示詞時，我們會通知你。可以只加 LINE，也可以留 Email。',
  line_btn='加 LINE 官方帳號好友', email_l='Email', email_ph='you@example.com',
  consent='我同意 Think BIG（大想成業有限公司）依<a href="/privacy.html#ai-inquiry" target="_blank" rel="noopener noreferrer">隱私權政策</a>保存我的 Email，只用來寄送新的實作提示詞，可隨時來信 AI@thinkbigtw.com 要求取消或刪除。',
  submit='訂閱新玩法', sending='送出中…', ok='已收到，之後有新玩法會寄到這個信箱。', errEmail='請輸入正確的 Email。', errConsent='請先勾選同意。',
  errRate='送出次數較多，請稍後再試。', errFail='尚未確認收件，請稍後再試，或', errFailLink='改加 LINE 好友',
  vid_note='示範影片在 Think BIG 的 Instagram 與 YouTube 頻道。',
  home='首頁', crumb='免費資源', sec_cards='每集一張卡', ctaq='想把 AI 用在自己的工作上？', ctap='用 LINE 傳一兩句你想交給 AI 的事，我們一起看怎麼做。',
  ctab='用 LINE 說你的需求', ctalink='/pricing/personal/', ctalinkt='看個人方案',
 ),
 'en': dict(
  lang='en', url='/en/free-resources/', other='/free-resources/', locale='en_US',
  title='Free AI Prompts: Photo Restore, Funny Edits, Animate a Photo, GIFs, Songs | Think BIG',
  desc='Full prompts from Think BIG weekend how-tos, free to read and copy with one tap, no sign-up: ChatGPT photo restore and funny edits, Grok photo animation, ChatGPT image styles and GIFs, Suno songs.',
  eyebrow='FREE RESOURCES / WEEKEND HOW-TOS', h1='Free AI how-to prompts',
  lede='Every prompt from our weekend how-to videos is here. Read it, copy it with one tap, no details required.',
  meta=['Works on a phone', 'Copy directly', 'No sign-up'],
  copy='Copy prompt', copied='Copied', copyfail='Copy failed. Long-press the text to select it.',
  prompt_label='Prompt', video='Watch the demo', ig='Instagram', yt='YouTube', tool='Tool',
  soon='The prompt is being prepared and will appear here.', soon_tag='Coming soon', steps='How to', notes='Notes',
  ai='Prompts and cards on this page are AI-assisted.', ai_foot='AI-assisted production',
  sub_h='Want new ideas as they come?', sub_p='We will let you know when new prompts are added. Add us on WhatsApp or leave an email.',
  line_btn='Message us on WhatsApp', email_l='Email', email_ph='you@example.com',
  consent='I agree that Think BIG (Da Xiang Cheng Ye Co., Ltd.) keeps my email under the <a href="/en/privacy/" target="_blank" rel="noopener noreferrer">Privacy Policy</a> and uses it only to send new prompts. I can ask to cancel or delete it any time at AI@thinkbigtw.com.',
  submit='Subscribe', sending='Sending…', ok='Received. New ideas will be sent to this address.', errEmail='Please enter a valid email.', errConsent='Please tick the consent box first.',
  errRate='Too many attempts. Please try again later.', errFail='We could not confirm receipt. Please try again later, or', errFailLink='message us on WhatsApp',
  vid_note='Demo videos are on the Think BIG Instagram and YouTube channels.',
  home='Home', crumb='Free resources', sec_cards='One card per episode', ctaq='Want to put AI to work in your own job?', ctap='Send us a line or two about what you would like AI to handle and we will look at it together.',
  ctab='Message us on WhatsApp', ctalink='/en/pricing/', ctalinkt='See personal plans',
 ),
}
def L(v, lang):
    return v[lang] if isinstance(v, dict) else v

STYLE = """<style>
  :root{--paper:#f5f4f0;--card:#fbfbf9;--ink:#121416;--ink-2:#3b4046;--muted:#62686f;--line:#dedcd5;--accent:#1f5f5b;--soft:#e4ebe8;--mono:ui-monospace,'SF Mono',Menlo,Consolas,monospace;--sans:-apple-system,BlinkMacSystemFont,'PingFang TC','Noto Sans TC','Helvetica Neue',Arial,sans-serif}
  @media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--paper:#0e1112;--card:#151a1b;--ink:#eceeec;--ink-2:#c9cecb;--muted:#99a19d;--line:#283032;--accent:#6cc3b9;--soft:#162625;color-scheme:dark}}
  *{box-sizing:border-box}
  body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);line-height:1.75;-webkit-font-smoothing:antialiased;overflow-x:hidden}
  .fr{max-width:960px;margin:0 auto;padding:0 24px}
  @media(max-width:600px){.fr{padding:0 16px}}
  .fr-eyebrow{display:block;font-family:var(--mono);font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--accent);margin:0 0 14px}
  .fr-hero{padding:72px 0 40px;border-bottom:1px solid var(--line)}
  .fr-hero h1{font-size:clamp(28px,5.6vw,48px);line-height:1.18;letter-spacing:-.01em;font-weight:800;margin:0 0 20px;text-wrap:balance}
  .fr-lede{font-size:clamp(16px,2.2vw,18px);color:var(--ink-2);max-width:40em;margin:0 0 24px}
  .fr-meta{display:flex;flex-wrap:wrap;gap:8px 10px;margin:0;padding:0;list-style:none}
  .fr-meta li{font-family:var(--mono);font-size:12px;letter-spacing:.04em;border:1px solid var(--line);border-radius:999px;padding:5px 12px;color:var(--ink-2);background:var(--card)}
  .fr-list{display:grid;gap:28px;padding:44px 0 24px}
  .fr-card{display:grid;grid-template-columns:minmax(0,300px) minmax(0,1fr);gap:28px;background:var(--card);border:1px solid var(--line);border-radius:18px;padding:24px}
  @media(max-width:760px){.fr-card{grid-template-columns:1fr;padding:18px 16px;gap:18px}}
  .fr-art{margin:0;aspect-ratio:4/5;border-radius:12px;background:var(--soft);border:1px solid var(--line);overflow:hidden}
  .fr-art img{display:block;width:100%;height:100%;object-fit:cover}
  @media(max-width:760px){.fr-art{max-width:240px}}
  .fr-tag{display:inline-block;font-family:var(--mono);font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);border:1px solid var(--line);border-radius:999px;padding:3px 10px;margin:0 8px 10px 0}
  .fr-card h2{font-size:clamp(20px,3.2vw,26px);line-height:1.3;font-weight:800;margin:0 0 8px;text-wrap:balance}
  .fr-blurb{margin:0 0 14px;color:var(--ink-2);font-size:16px}
  .fr-steps{font-size:14.5px;color:var(--muted);margin:0 0 16px;border-left:2px solid var(--accent);padding:4px 0 4px 12px}
  .fr-prompt{border-top:1px solid var(--line);padding:14px 0}
  .fr-prompt-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 8px}
  .fr-prompt-head h3{font-size:15px;margin:0;font-weight:700;line-height:1.4}
  .fr-copy{flex:none;min-height:44px;padding:8px 16px;border-radius:10px;border:1px solid var(--ink);background:var(--ink);color:var(--paper);font:inherit;font-size:14px;font-weight:700;cursor:pointer}
  .fr-copy:hover{background:var(--accent);border-color:var(--accent)}
  .fr-copy.done{background:var(--accent);border-color:var(--accent)}
  .fr-pre{margin:0;padding:14px;border-radius:10px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font:inherit;font-size:14.5px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere;user-select:text}
  .fr-notes{margin:14px 0 0;padding:0 0 0 18px;font-size:14px;color:var(--muted)}
  .fr-links{display:flex;flex-wrap:wrap;gap:8px 18px;margin:16px 0 0;font-size:14px;font-weight:700}
  .fr-links a{color:var(--accent);text-decoration:none;border-bottom:1px solid currentColor}
  .fr-soon{margin:0;font-size:15px;color:var(--muted)}
  .fr-foot{font-size:13.5px;color:var(--muted);padding:8px 0 40px}
  .fr-sub{padding:48px 0;border-top:1px solid var(--line)}
  .fr-sub h2{font-size:clamp(22px,3.6vw,30px);font-weight:800;margin:0 0 10px}
  .fr-sub p{color:var(--ink-2);margin:0 0 16px;max-width:40em}
  .fr-btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:12px 22px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;border:1px solid var(--ink);background:var(--ink);color:var(--paper)}
  .fr-btn:hover{background:var(--accent);border-color:var(--accent)}
  .fr-btn.ghost{background:transparent;color:var(--ink)}
  @media(max-width:600px){.fr-btn{width:100%}}
  .fr-form{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px;margin-top:22px;max-width:560px}
  .fr-field{margin:0 0 14px}
  .fr-field label{display:block;font-size:14px;font-weight:700;margin-bottom:6px}
  .fr-field input{width:100%;min-height:48px;padding:12px 14px;border:1px solid #b9b7b0;border-radius:10px;background:var(--paper);color:var(--ink);font:inherit;font-size:16px}
  .fr-consent{display:grid;grid-template-columns:22px 1fr;gap:10px;align-items:start;font-size:14px;color:var(--ink-2);margin:4px 0 16px}
  .fr-consent input{width:20px;height:20px;margin:2px 0 0;accent-color:var(--accent)}
  .fr-consent a{color:var(--accent)}
  .fr-form button[type=submit]{width:100%;cursor:pointer;font-family:inherit}
  .fr-form button[disabled]{opacity:.55;cursor:default}
  .fr-status{min-height:1.5em;font-size:14.5px;margin:12px 0 0}
  .fr-status.ok{color:var(--accent);font-weight:700}
  .fr-status.err{color:#b3261e}
  .fr-end{padding:8px 0 64px}
  .fr-end h2{font-size:clamp(22px,3.6vw,30px);font-weight:800;margin:0 0 10px}
  .fr-end p{color:var(--ink-2);margin:0 0 20px;max-width:40em}
  .fr-end .row{display:flex;flex-wrap:wrap;gap:12px}
  a:focus-visible,button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
</style>"""

def card_html(c, lang, t):
    cid = c['id']
    tool = L(c['tool'], lang)
    h = [f'<article class="fr-card" id="{cid}" data-card-id="{cid}">']
    alt = escape(L(c['alt'], lang))
    h.append(f'<figure class="fr-art" role="img" aria-label="{alt}" data-art-slot="{cid}"></figure>')
    h.append('<div class="fr-body">')
    h.append(f'<span class="fr-tag">{escape(t["tool"])}: {escape(tool)}</span>')
    if c.get('pending'):
        h.append(f'<span class="fr-tag">{escape(t["soon_tag"])}</span>')
    h.append(f'<h2>{escape(L(c["title"], lang))}</h2><p class="fr-blurb">{escape(L(c["blurb"], lang))}</p>')
    if c.get('pending') or not c['items']:
        h.append(f'<p class="fr-soon">{escape(t["soon"])}</p>')
    else:
        h.append(f'<p class="fr-steps"><strong>{escape(t["steps"])}</strong> {escape(L(c["steps"], lang))}</p>')
        for i, it in enumerate(c['items'], 1):
            pid = f'{cid}-p{i}'
            h.append(f'<div class="fr-prompt"><div class="fr-prompt-head"><h3>{escape(L(it["label"], lang))}</h3>'
                     f'<button type="button" class="fr-copy" data-copy-target="{pid}" data-card-id="{cid}" data-prompt-index="{i}">{escape(t["copy"])}</button></div>'
                     f'<pre class="fr-pre" id="{pid}">{escape(L(it["text"], lang))}</pre></div>')
        notes = L(c['notes'], lang)
        if notes:
            h.append('<ul class="fr-notes">' + ''.join(f'<li>{escape(n)}</li>' for n in notes) + '</ul>')
    h.append(f'<p class="fr-links"><span>{escape(t["video"])}:</span>'
             f'<a href="{IG}" target="_blank" rel="noopener noreferrer" data-video-link="ig" data-card-id="{cid}">{t["ig"]}</a>'
             f'<a href="{YT}" target="_blank" rel="noopener noreferrer" data-video-link="yt" data-card-id="{cid}">{t["yt"]}</a></p>')
    h.append('</div></article>')
    return '\n'.join(h)

JS = """<script>
(function(){
  var T = %s;
  function ev(n, p){ try { if (typeof gtag === 'function') gtag('event', n, p || {}); } catch (_) {} }
  // copy_prompt: copies exactly the visible text of the target <pre>
  function fallbackCopy(text){
    var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.top = '-1000px'; document.body.appendChild(ta); ta.select();
    var ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
    document.body.removeChild(ta); return ok;
  }
  document.querySelectorAll('.fr-copy').forEach(function(btn){
    btn.addEventListener('click', function(){
      var pre = document.getElementById(btn.getAttribute('data-copy-target')); if (!pre) return;
      var text = pre.textContent, label = btn.textContent;
      function done(ok){
        if (ok) { btn.classList.add('done'); btn.textContent = T.copied; ev('copy_prompt', { card_id: btn.getAttribute('data-card-id'), prompt_index: Number(btn.getAttribute('data-prompt-index')), language: T.lang }); }
        else { btn.textContent = T.copyfail; }
        setTimeout(function(){ btn.classList.remove('done'); btn.textContent = label; }, 2200);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function(){ done(true); }, function(){ done(fallbackCopy(text)); });
      else done(fallbackCopy(text));
    });
  });
  // LINE / WhatsApp clicks are reported by the shared listener in /nav.js (cta = data-cta on the button)
  // email subscription -> existing inquiry endpoint (same as /briefing/), email only
  var form = document.getElementById('fr-form'); if (!form) return;
  var status = document.getElementById('fr-status'), btn = document.getElementById('fr-submit');
  function uid(){ try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (_) {} return 'f-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12); }
  function say(m, c){ status.textContent = m; status.className = 'fr-status' + (c ? ' ' + c : ''); }
  form.addEventListener('submit', async function(e){
    e.preventDefault();
    var email = form.elements.email.value.trim().toLowerCase();
    if (!/^[^\\s@,;]+@[^\\s@,;]+\\.[^\\s@,;]+$/.test(email)) { say(T.errEmail, 'err'); return; }
    if (!form.elements.consent.checked) { say(T.errConsent, 'err'); return; }
    var q = new URLSearchParams(location.search), src = q.get('utm_source') || '';
    var payload = { id: uid(), consent: true, name: T.subName, organization: '',
      need: (T.subNeed + '\\nlang=' + T.lang + (src ? '\\nutm_source=' + src.slice(0, 40) : '')).slice(0, 1200),
      scale: 'source=%s', contactMethod: 'email', contact: email };
    btn.disabled = true; say(T.sending, '');
    try {
      var r = await fetch('https://moneyradar-ai-proxy.thinkbigtw.workers.dev/thinkbig-inquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      var d = await r.json().catch(function(){ return {}; });
      if (d.accepted) { say(T.ok, 'ok'); form.elements.email.disabled = true; form.elements.consent.disabled = true; ev('email_signup', { method: 'free_resources', language: T.lang }); return; }
      if (d.error === 'rate_limited') { say(T.errRate, 'err'); btn.disabled = false; return; }
      throw new Error(d.error || 'unknown');
    } catch (err) {
      status.className = 'fr-status err'; status.textContent = T.errFail + ' ';
      var a = document.createElement('a'); a.href = T.fallback; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = T.errFailLink; status.appendChild(a); btn.disabled = false;
    }
  });
})();
</script>"""

def build(lang):
    t = T[lang]
    url = 'https://thinkbigtw.com' + t['url']
    zh_url, en_url = 'https://thinkbigtw.com/free-resources/', 'https://thinkbigtw.com/en/free-resources/'
    if lang == 'zh':
        chan = f'<a class="fr-btn" href="{LINE}" target="_blank" rel="noopener noreferrer" data-cta="free_resources_@@">{t["line_btn"]}</a>'
        fallback = LINE; chan_attr = 'data-line-btn'
    else:
        chan = f'<a class="fr-btn" href="{WA_URL}" target="_blank" rel="noopener noreferrer" data-cta="free_resources_@@">{t["line_btn"]}</a>'
        fallback = WA_URL
    jsT = json.dumps(dict(lang=t['lang'], copied=t['copied'], copyfail=t['copyfail'], ok=t['ok'], errEmail=t['errEmail'], errConsent=t['errConsent'],
        errRate=t['errRate'], errFail=t['errFail'], errFailLink=t['errFailLink'], sending=t['sending'], fallback=fallback,
        subName='免費資源訂閱' if lang == 'zh' else 'Free resources subscriber',
        subNeed='訂閱「新玩法」通知：Email 僅用於寄送新的實作提示詞，可隨時取消。' if lang == 'zh' else 'Subscribe to new-prompt notices: email used only to send new how-to prompts, cancel any time.'), ensure_ascii=False)
    ld = {
        "@context": "https://schema.org", "@graph": [
            {"@type": "CollectionPage", "@id": url + '#webpage', "url": url, "name": t['title'], "description": t['desc'],
             "inLanguage": t['lang'], "isPartOf": {"@id": "https://thinkbigtw.com/#website"}, "publisher": {"@id": "https://thinkbigtw.com/#organization"},
             "dateModified": "2026-11-12", "breadcrumb": {"@id": url + '#breadcrumb'}},
            {"@type": "BreadcrumbList", "@id": url + '#breadcrumb', "itemListElement": [
                {"@type": "ListItem", "position": 1, "name": t['home'], "item": "https://thinkbigtw.com/" if lang == 'zh' else "https://thinkbigtw.com/en/"},
                {"@type": "ListItem", "position": 2, "name": t['crumb'], "item": url}]}]}
    cards = '\n'.join(card_html(c, lang, t) for c in D['cards'])
    meta = ''.join(f'<li>{escape(m)}</li>' for m in t['meta'])
    ctalink_btn = chan.replace('@@','bottom')
    sub_chan = chan.replace('@@','subscribe')
    html = f"""<!DOCTYPE html>
<html lang="{t['lang']}">
<head>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-7V41XYLLP5"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){{dataLayer.push(arguments);}}
  gtag('js', new Date());
  gtag('config', 'G-7V41XYLLP5');
</script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{escape(t['title'])}</title>
<meta name="description" content="{escape(t['desc'])}">
<link rel="canonical" href="{url}">
<link rel="alternate" hreflang="zh-Hant" href="{zh_url}">
<link rel="alternate" hreflang="en" href="{en_url}">
<link rel="alternate" hreflang="x-default" href="{zh_url}">
<meta property="og:type" content="website">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{escape(t['title'])}">
<meta property="og:description" content="{escape(t['desc'])}">
<meta property="og:image" content="https://thinkbigtw.com/assets/brand/thinkbig-og.jpg">
<meta property="og:site_name" content="Think BIG">
<meta property="og:locale" content="{t['locale']}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{escape(t['title'])}">
<meta name="twitter:description" content="{escape(t['desc'])}">
<meta name="twitter:image" content="https://thinkbigtw.com/assets/brand/thinkbig-og.jpg">
<link rel="icon" href="/favicon.ico" sizes="32x32 48x48">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<script type="application/ld+json">
{json.dumps(ld, ensure_ascii=False, indent=1)}
</script>
{STYLE}
<link rel="stylesheet" href="{CSS}">
</head>
<body>
<main id="main">
<section class="fr-hero"><div class="fr">
<span class="fr-eyebrow">{escape(t['eyebrow'])}</span>
<h1>{escape(t['h1'])}</h1>
<p class="fr-lede">{escape(t['lede'])}</p>
<ul class="fr-meta">{meta}</ul>
</div></section>
<section class="fr"><div class="fr-list" aria-label="{escape(t['sec_cards'])}">
{cards}
</div>
<p class="fr-foot">{escape(t['vid_note'])} {escape(t['ai'])}</p>
</section>
<section class="fr-sub" id="subscribe"><div class="fr">
<h2>{escape(t['sub_h'])}</h2>
<p>{escape(t['sub_p'])}</p>
{sub_chan}
<form class="fr-form" id="fr-form" method="post" action="#" novalidate>
<div class="fr-field"><label for="fr-email">{escape(t['email_l'])}</label><input id="fr-email" name="email" type="email" maxlength="254" autocomplete="email" inputmode="email" placeholder="{t['email_ph']}" required></div>
<label class="fr-consent"><input type="checkbox" id="fr-consent" name="consent" required><span>{t['consent']}</span></label>
<button class="fr-btn" id="fr-submit" type="submit">{escape(t['submit'])}</button>
<p class="fr-status" id="fr-status" role="status" aria-live="polite"></p>
</form>
</div></section>
<section class="fr-end"><div class="fr">
<h2>{escape(t['ctaq'])}</h2>
<p>{escape(t['ctap'])}</p>
<div class="row">{ctalink_btn}<a class="fr-btn ghost" href="{t['ctalink']}">{escape(t['ctalinkt'])}</a></div>
<p class="fr-foot">{escape(t['ai_foot'])}</p>
</div></section>
</main>
<script src="/ask-ai.js?v=202609280928" defer></script>
{JS % (jsT, CAMP)}
</body>
</html>
"""
    out = ROOT / t['url'].strip('/') / 'index.html'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(html)
    print('wrote', out.relative_to(ROOT))

build('zh')
build('en')
