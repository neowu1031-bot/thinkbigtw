/* tb-hero3d theme toggle — scoped to the .tb-hero3d element only.
   Does NOT modify document.documentElement; only the hero section's data-theme.
   localStorage key: tb-hero3d-theme  (read/write wrapped in try/catch)
*/
(function () {
  var hero = document.querySelector('.tb-hero3d');
  if (!hero) return;
  var btn = hero.querySelector('.tb-hero3d-toggle');
  if (!btn) return;
  var label = btn.querySelector('.tb-hero3d-tt-label');

  // Apply saved preference on init (default is dark — no attribute)
  try {
    var saved = localStorage.getItem('tb-hero3d-theme');
    if (saved === 'light') hero.dataset.theme = 'light';
  } catch (e) {}

  function sync() {
    var isLight = hero.dataset.theme === 'light';
    btn.setAttribute('aria-pressed', String(isLight));
    if (label) label.textContent = isLight ? 'Dark' : 'Light';
  }

  btn.addEventListener('click', function () {
    var next = hero.dataset.theme === 'light' ? 'dark' : 'light';
    if (next === 'light') {
      hero.dataset.theme = 'light';
    } else {
      delete hero.dataset.theme;
    }
    try { localStorage.setItem('tb-hero3d-theme', next); } catch (e) {}
    sync();
    document.dispatchEvent(new Event('tb-hero3d-theme'));
  });

  sync();
})();
