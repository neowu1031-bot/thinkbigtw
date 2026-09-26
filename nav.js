/* Static HTML owns the navigation and footer. JavaScript adds current-page and
   keyboard behavior. Legacy microsites keep their original application layout. */
(function () {
  'use strict';
  if (window.__tbNavLoaded) return;
  window.__tbNavLoaded = true;
  function init() {
    const nav = document.getElementById('tb-nav');
    if (!nav) return;
    const path = location.pathname.replace(/index\.html?$/, '');
    nav.querySelectorAll('a').forEach(function (link) {
      const href = link.getAttribute('href');
      if (href === path) link.setAttribute('aria-current', 'page');
      else if (href === '/pricing/personal/' && document.querySelector('.tb-personal-context')) link.setAttribute('aria-current', 'location');
      else if (href === '/guides/' && path.startsWith('/guides/')) link.setAttribute('aria-current', 'location');
      else if (href === '/enterprise/process/' && path.startsWith('/enterprise/process/')) link.setAttribute('aria-current', 'location');
    });
    const menu = nav.querySelector('details');
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
