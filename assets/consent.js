/* Think BIG cookie consent (Google Consent Mode v2 companion).
 * - Consent defaults are set inline in each page's gtag block (EEA/UK/CH denied by region, elsewhere granted).
 * - This file shows the banner to visitors whose device time zone is in Europe and who have not chosen yet,
 *   stores the choice in localStorage('tb_consent') = 'granted' | 'denied', pushes gtag consent updates,
 *   and releases queued ad tags (Meta Pixel) only when allowed.
 * - Declining never blocks browsing. Re-open the banner with #cookie-settings or window.tbConsent.open().
 */
(function () {
  'use strict';
  var KEY = 'tb_consent', G = 'granted', D = 'denied';

  function stored() { try { var v = localStorage.getItem(KEY); return v === G || v === D ? v : null; } catch (e) { return null; } }
  function inConsentRegion() {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      return /^Europe\//.test(tz) || /^Atlantic\/(Reykjavik|Canary|Madeira|Azores|Faroe)$/.test(tz);
    } catch (e) { return false; }
  }
  function allowed() { var s = stored(); return s ? s === G : !inConsentRegion(); }

  /* Queue for tags that must wait for consent (Meta Pixel). Pages push functions into window.tbConsentQ. */
  var pending = [].concat(window.tbConsentQ || []);
  function runQueue() {
    if (!allowed()) return;
    while (pending.length) { var fn = pending.shift(); try { fn(); } catch (e) {} }
  }
  window.tbConsentQ = { push: function (fn) { if (typeof fn === 'function') { pending.push(fn); runQueue(); } } };

  function apply(v) {
    try { localStorage.setItem(KEY, v); } catch (e) {}
    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', { ad_storage: v, ad_user_data: v, ad_personalization: v, analytics_storage: v });
    }
    hide();
    runQueue();
    try { document.dispatchEvent(new CustomEvent('tb:consent', { detail: v })); } catch (e) {}
  }

  var el = null;
  function hide() { if (el) { el.remove(); el = null; } }

  function show() {
    if (el || !document.body) return;
    var en = /^en/i.test(document.documentElement.lang || '');
    var t = en
      ? { msg: 'We use cookies to measure site traffic and improve our content. Accept or decline — the site works either way.', more: 'Privacy policy', href: '/en/privacy/', no: 'Decline', yes: 'Accept', label: 'Cookie choice' }
      : { msg: '我們用 Cookie 統計網站流量、改善內容。你可以接受或拒絕，拒絕也能正常瀏覽。', more: '隱私權政策', href: '/privacy.html', no: '拒絕', yes: '接受', label: 'Cookie 選擇' };
    if (!document.getElementById('tb-consent-css')) {
      var st = document.createElement('style');
      st.id = 'tb-consent-css';
      st.textContent =
        '#tb-consent{position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483000;max-width:560px;margin:0 auto;' +
        'background:#fff;color:#2f3432;border:1px solid #d9dcda;border-top:3px solid #eea4bb;border-radius:12px;' +
        'box-shadow:0 8px 28px rgba(0,0,0,.14);padding:14px 16px;font:14px/1.6 system-ui,-apple-system,"PingFang TC","Noto Sans TC",sans-serif}' +
        '#tb-consent p{margin:0 0 10px}#tb-consent a{color:#2f3432;text-decoration:underline;text-decoration-color:#eea4bb;text-underline-offset:3px}' +
        '#tb-consent .tbc-row{display:flex;gap:8px}' +
        '#tb-consent button{flex:1;min-height:44px;border-radius:8px;font-size:14px;font-weight:600;font-family:inherit;line-height:1;cursor:pointer;border:1px solid #2f3432}' +
        '#tb-consent .tbc-no{background:#fff;color:#2f3432}#tb-consent .tbc-yes{background:#2f3432;color:#fff}' +
        '#tb-consent button:focus-visible{outline:2px solid #eea4bb;outline-offset:2px}' +
        '@media (min-width:640px){#tb-consent{display:flex;align-items:center;gap:16px}#tb-consent p{margin:0;flex:1}#tb-consent .tbc-row{flex:0 0 auto}#tb-consent button{min-width:96px}}' +
        '@media print{#tb-consent{display:none}}';
      document.head.appendChild(st);
    }
    el = document.createElement('div');
    el.id = 'tb-consent';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', t.label);
    var p = document.createElement('p');
    p.appendChild(document.createTextNode(t.msg + ' '));
    var a = document.createElement('a'); a.href = t.href; a.textContent = t.more; p.appendChild(a);
    var row = document.createElement('div'); row.className = 'tbc-row';
    var no = document.createElement('button'); no.type = 'button'; no.className = 'tbc-no'; no.textContent = t.no;
    var yes = document.createElement('button'); yes.type = 'button'; yes.className = 'tbc-yes'; yes.textContent = t.yes;
    no.addEventListener('click', function () { apply(D); });
    yes.addEventListener('click', function () { apply(G); });
    row.appendChild(no); row.appendChild(yes);
    el.appendChild(p); el.appendChild(row);
    document.body.appendChild(el);
  }

  window.tbConsent = { get: stored, allowed: allowed, set: function (v) { if (v === G || v === D) apply(v); }, open: show };

  function init() {
    if (location.hash === '#cookie-settings' || (!stored() && inConsentRegion())) show();
    runQueue();
  }
  window.addEventListener('hashchange', function () { if (location.hash === '#cookie-settings') show(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
