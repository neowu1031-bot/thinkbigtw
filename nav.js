/* Static HTML owns the navigation and footer. JavaScript adds current-page and
   keyboard behavior. Legacy microsites keep their original application layout. */
(function () {
  'use strict';
  if (window.__tbNavLoaded) return;
  window.__tbNavLoaded = true;

  /* ── Language toggle ─────────────────────────────────────────────────── */
  var LANG_KEY = 'tb_lang';

  /* Pages with a real English equivalent; all others fall back to /en/ */
  var EN_MAP = {
    '/': '/en/',
    '/contact/': '/en/contact/',
    '/pricing/': '/en/pricing/',
    '/portfolio/': '/portfolio/en/',
    '/portfolio/ai-agent/': '/portfolio/ai-agent/en/',
    '/portfolio/ai-agent/deck/': '/portfolio/ai-agent/deck/en/',
    '/portfolio/erp-demo/': '/portfolio/erp-demo/en/',
    '/library/': '/en/news/',
    '/library/news/': '/en/news/',
    '/library/news/lobster-hermes-abandonment-20261003/': '/en/news/lobster-hermes-abandonment-20261003/',
    '/library/news/local-llm-gpu-check-20261005/': '/en/news/local-llm-gpu-check-20261005/',
    '/services/ai-visibility/': '/en/services/seo-geo/',
    '/services/ai-agent-setup/': '/en/services/ai-agent-setup/',
    '/briefing/': '/en/briefing/'
  };

  function getEnDest(path) {
    return EN_MAP[path] || '/en/';
  }

  function rememberLang(lang) {
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
  }

  function buildEnToggle(dest) {
    var a = document.createElement('a');
    a.href = dest;
    a.textContent = 'EN';
    a.className = 'tb-lang-toggle';
    a.setAttribute('hreflang', 'en');
    a.setAttribute('aria-label', 'Switch to English');
    a.addEventListener('click', function () { rememberLang('en'); });
    return a;
  }

  function injectLangToggle(nav) {
    /* Skip EN toggle injection on English-language pages (they already have a 中文 link) */
    if (nav.getAttribute('aria-label') === 'Main navigation') return;
    /* Inject once per page — guard via the flag that already exists */
    if (!document.getElementById('tb-lang-css')) {
      var s = document.createElement('style');
      s.id = 'tb-lang-css';
      /* Small bordered pill; works on the dark nav background */
      s.textContent = [
        '#tb-nav a.tb-lang-toggle{',
        'border:1px solid rgba(255,255,255,.38);',
        'border-radius:3px;',
        'padding:2px 8px;',
        'font-size:.8125em;',
        'letter-spacing:.05em;',
        'opacity:.72;',
        'transition:opacity .15s;',
        'white-space:nowrap;',
        '}',
        '#tb-nav a.tb-lang-toggle:hover{opacity:1;}'
      ].join('');
      document.head.appendChild(s);
    }

    var path = location.pathname.replace(/index\.html?$/, '');
    var dest = getEnDest(path);

    /* Desktop .tb-links (first direct child div) */
    var desktopLinks = nav.querySelector(':scope > div.tb-links');
    if (desktopLinks) desktopLinks.appendChild(buildEnToggle(dest));

    /* Mobile menu .tb-links inside <details> */
    var mobileMenu = nav.querySelector('details.tb-menu');
    if (mobileMenu) {
      var mobileLinks = mobileMenu.querySelector('.tb-links');
      if (mobileLinks) mobileLinks.appendChild(buildEnToggle(dest));
    }
  }
  /* ─────────────────────────────────────────────────────────────────────── */

  function init() {
    // Experience remains reachable from page content, but not global navigation.
    document.querySelectorAll('#tb-nav a[href="/experience/"], footer a[href="/experience/"]').forEach(function (link) { link.remove(); });
    var nav = document.getElementById('tb-nav');
    if (!nav) return;
    var path = location.pathname.replace(/index\.html?$/, '');
    nav.querySelectorAll('a').forEach(function (link) {
      var href = link.getAttribute('href');
      if (href === path) link.setAttribute('aria-current', 'page');
      else if ((href === '/portfolio/' || href === '/portfolio/en/') && path.startsWith('/portfolio/')) link.setAttribute('aria-current', 'location');
      else if (href === '/pricing/personal/' && document.querySelector('.tb-personal-context')) link.setAttribute('aria-current', 'location');
      else if (href === '/guides/' && path.startsWith('/guides/')) link.setAttribute('aria-current', 'location');
      else if (href === '/enterprise/process/' && path.startsWith('/enterprise/process/')) link.setAttribute('aria-current', 'location');
    });

    injectLangToggle(nav);

    var menu = nav.querySelector('details');
    if (!menu) return;
    menu.addEventListener('click', function (event) {
      if (event.target.closest('a')) menu.open = false;
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && menu.open) {
        menu.open = false;
        menu.querySelector('summary').focus();
      }
    });
    document.addEventListener('click', function (event) {
      if (!nav.contains(event.target)) menu.open = false;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* ── GA4 QA filter + custom events ──────────────────────────────────────── */
(function () {
  'use strict';
  /* Disable GA4 for headless/QA sessions (set before config fires when possible;
     this late-binding version still suppresses events after page load). */
  var QA_PARAM = 'tb_qa';
  try {
    if (new URLSearchParams(location.search).has(QA_PARAM) || navigator.webdriver) {
      window['ga-disable-G-7V41XYLLP5'] = true;
    }
    if (new URLSearchParams(location.search).has(QA_PARAM)) {
      try { localStorage.setItem('tb_qa', '1'); } catch (_) {}
    }
    if (localStorage.getItem('tb_qa')) {
      window['ga-disable-G-7V41XYLLP5'] = true;
    }
  } catch (_) {}

  /* Custom event helper — safe to call before gtag is defined */
  function tbEvent(name, params) {
    if (typeof gtag === 'function') gtag('event', name, params || {});
  }

  /* Track outbound link clicks. LINE links report `click_line` (+ legacy `line_click`), WhatsApp `click_whatsapp` (+ legacy `whatsapp_click`), Telegram `click_telegram`;
     `cta` comes from the nearest data-cta attribute so each entry point can be compared. */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a) return;
    var href = a.href || '';
    if (href.indexOf('lin.ee') !== -1 || href.indexOf('line.me') !== -1) {
      var holder = a.closest('[data-cta]');
      var lp = { page_location: location.href, page_path: location.pathname, link_url: href, cta: holder ? holder.getAttribute('data-cta') : 'inline' };
      tbEvent('click_line', lp);
      tbEvent('line_click', lp); /* legacy name, kept so existing reports keep working */
    } else if (href.indexOf('wa.me/') !== -1 || href.indexOf('api.whatsapp.com') !== -1) {
      var h2 = a.closest('[data-cta]');
      var wp = { page_location: location.href, page_path: location.pathname, link_url: href, cta: h2 ? h2.getAttribute('data-cta') : 'inline' };
      tbEvent('click_whatsapp', wp);
      tbEvent('whatsapp_click', wp); /* legacy name */
    } else if (href.indexOf('t.me/') !== -1 || href.indexOf('telegram.me/') !== -1) {
      var h3 = a.closest('[data-cta]');
      tbEvent('click_telegram', { page_location: location.href, page_path: location.pathname, link_url: href, cta: h3 ? h3.getAttribute('data-cta') : 'inline' });
    } else if (href.indexOf('shopee.tw') !== -1) {
      tbEvent('shopee_click', { page_location: location.pathname, link_url: href });
    }
  }, true);
})();

/* ── Mobile LINE dock + 11/22 briefing entry ────────────────────────────── */
(function () {
  'use strict';
  if (window.__tbFunnelLoaded) return;
  window.__tbFunnelLoaded = true;

  var LINE_URL = 'https://lin.ee/n5KW430';
  /* Overseas (English pages) channel. Number is stamped by scripts/sync-whatsapp.py from data/whatsapp.json. */
  var WA_URL = 'https://wa.me/886908898903?text=Hi%20Think%20BIG%2C%20I%27d%20like%20to%20ask%20about%20your%20AI%20Agent%20services.';
  var WA_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#25D366" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>';
  /* Briefing entry at the end of Think BIG Q&A / NEWS articles.
     Empty string = not shown. Hidden automatically after BRIEFING_END. */
  var BRIEFING_URL = '/briefing/';
  var BRIEFING_URL_EN = '/en/briefing/';
  var BRIEFING_END = Date.parse('2026-11-22T20:40:00+08:00');
  var BRIEFING_UTM = 'utm_source=thinkbigtw&utm_medium=article_end&utm_campaign=briefing_202611';

  /* Pages that are not Think BIG AI services (other brands, tools, demos). */
  var SKIP_PREFIX = ['/gift/', '/print/', '/book/', '/meeting/', '/clawland/', '/tbos/', '/v2/', '/erp/', '/portfolio/erp-demo/'];
  var OTHER_BRAND = /童話有你|熊好學|Tale ?With ?You|BearSay/i;

  function isOtherBrandPage(path) {
    for (var i = 0; i < SKIP_PREFIX.length; i++) if (path.indexOf(SKIP_PREFIX[i]) === 0) return true;
    var off = document.querySelector('meta[name="tb-line-dock"]');
    if (off && off.getAttribute('content') === 'off') return true;
    if (OTHER_BRAND.test(document.title || '')) return true;
    /* Q&A pages carry a brand box; only Think BIG boxes say so in their label. */
    var brand = document.querySelector('section.brand[aria-label]');
    if (brand && brand.getAttribute('aria-label').indexOf('Think BIG') === -1) return true;
    return false;
  }

  function isEnglish() {
    var lang = (document.documentElement.getAttribute('lang') || '').toLowerCase();
    return lang.indexOf('en') === 0;
  }

  function addStyle() {
    if (document.getElementById('tb-funnel-css')) return;
    var s = document.createElement('style');
    s.id = 'tb-funnel-css';
    s.textContent = [
      '.tb-line-dock{display:none}',
      '@media(max-width:600px){',
      '.tb-line-dock{position:fixed;left:16px;right:16px;bottom:max(12px,env(safe-area-inset-bottom));z-index:39;display:flex;align-items:center;justify-content:center;gap:8px;height:44px;border-radius:12px;',
      'background:rgba(18,20,22,.94);color:#fff;border:1px solid rgba(255,255,255,.14);box-shadow:0 8px 28px rgba(0,0,0,.18);',
      '-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);font:600 15px/1 -apple-system,BlinkMacSystemFont,"PingFang TC","Noto Sans TC",sans-serif;letter-spacing:.04em;text-decoration:none;transition:opacity .2s,transform .2s}',
      '.tb-line-dock svg{width:18px;height:18px;flex:none}',
      /* Site-wide hover enhancement adds position:relative + an underline layer to links; keep the dock fixed. */
      'a.tb-line-dock{position:fixed!important;text-decoration:none!important}',
      '.tb-line-dock .tb-hover-underline,.tb-line-dock .tb-hover-halo{display:none!important}',
      '.tb-line-dock.is-hidden{opacity:0;transform:translateY(12px);pointer-events:none}',
      'body:has(#tb-ai-launcher) .tb-line-dock{right:64px}',
      'body.tb-dock-on{padding-bottom:68px}',
      '}',
      '.tb-briefing-cta{display:block;margin:32px 0 0;padding:18px 20px;border:1px solid rgba(127,127,127,.38);border-radius:14px;text-align:left}',
      '.tb-briefing-cta .tb-bc-k{display:block;font:500 11px/1.4 ui-monospace,"SF Mono",Menlo,monospace;letter-spacing:.18em;text-transform:uppercase;opacity:.72;margin-bottom:6px}',
      '.tb-briefing-cta strong{display:block;font-size:17px;line-height:1.45;margin-bottom:4px}',
      '.tb-briefing-cta .tb-bc-d{display:block;font-size:14px;opacity:.8;margin-bottom:10px}',
      '.tb-briefing-cta a{font-weight:700;color:inherit;text-decoration:underline;text-underline-offset:3px}'
    ].join('');
    document.head.appendChild(s);
  }

  var LINE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#06C755" d="M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/><path fill="#fff" d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629"/></svg>';

  function addLineDock() {
    if (document.querySelector('.tb-line-dock')) return;
    var a = document.createElement('a');
    a.className = 'tb-line-dock';
    a.href = isEnglish() ? WA_URL : LINE_URL;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.setAttribute('data-cta', 'mobile_dock');
    var label = isEnglish() ? 'Think BIG on WhatsApp' : 'LINE 問需求';
    a.setAttribute('aria-label', isEnglish() ? 'Ask Think BIG on WhatsApp' : '用 LINE 詢問 Think BIG');
    a.innerHTML = (isEnglish() ? WA_SVG : LINE_SVG) + '<span>' + label + '</span>';
    document.body.appendChild(a);
    document.body.classList.add('tb-dock-on');
    /* Step aside while typing so the on-screen keyboard never hides a field. */
    document.addEventListener('focusin', function (e) {
      if (e.target.matches && e.target.matches('input,textarea,select')) a.classList.add('is-hidden');
    });
    document.addEventListener('focusout', function () { a.classList.remove('is-hidden'); });
  }

  function addBriefingEntry(path) {
    var en = path.indexOf('/en/') === 0;
    var url = en ? BRIEFING_URL_EN : BRIEFING_URL;
    if (!url || !(Date.now() < BRIEFING_END)) return;
    if (!/^\/(library\/(qa|news)|en\/(qa|news))\/[^/]+\/$/.test(path)) return;
    if (document.querySelector('.tb-briefing-cta')) return;
    var box = document.createElement('aside');
    box.className = 'tb-briefing-cta';
    box.setAttribute('data-cta', 'article_briefing');
    box.setAttribute('aria-label', en ? 'Live briefing' : '說明會');
    var k = document.createElement('span'); k.className = 'tb-bc-k';
    var t = document.createElement('strong');
    var d = document.createElement('span'); d.className = 'tb-bc-d';
    var link = document.createElement('a');
    link.href = url + '?' + BRIEFING_UTM;
    if (en) {
      k.textContent = 'Live · Sun Nov 22 · 8 PM Taiwan time';
      t.textContent = 'AI for your business: 4 things every owner should know';
      d.textContent = 'Free YouTube live briefing, open to everyone. Presented in Mandarin.';
      link.textContent = 'Register for the briefing →';
    } else {
      k.textContent = 'Live · 11/22（日）20:00';
      t.textContent = '企業導入 AI 說明會：老闆不能不知道的 4 件事';
      d.textContent = 'YouTube 直播，免費參加、不限人數，回放留在 YouTube。';
      link.textContent = '報名說明會 →';
    }
    link.addEventListener('click', function () {
      if (typeof gtag === 'function') gtag('event', 'briefing_click', { page_path: path });
    });
    box.appendChild(k); box.appendChild(t); box.appendChild(d); box.appendChild(link);
    var colophon = document.querySelector('article .colophon, main .colophon');
    if (colophon && colophon.parentNode) colophon.parentNode.insertBefore(box, colophon);
    else {
      var host = document.querySelector('article') || document.querySelector('main');
      if (host) host.appendChild(box);
    }
  }

  function init() {
    var path = location.pathname.replace(/index\.html?$/, '');
    if (isOtherBrandPage(path)) return;
    addStyle();
    addLineDock();
    addBriefingEntry(path);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
