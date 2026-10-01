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
    '/portfolio/': '/portfolio/en/'
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
    var nav = document.getElementById('tb-nav');
    if (!nav) return;
    var path = location.pathname.replace(/index\.html?$/, '');
    nav.querySelectorAll('a').forEach(function (link) {
      var href = link.getAttribute('href');
      if (href === path) link.setAttribute('aria-current', 'page');
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
