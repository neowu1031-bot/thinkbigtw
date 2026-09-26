(function () {
  'use strict';
  const printButton = document.getElementById('print-worksheet');
  if (printButton) { printButton.hidden = false; printButton.addEventListener('click', () => window.print()); }
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!motion.matches && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        if (!motion.matches) entry.target.classList.add('arriving');
        observer.unobserve(entry.target);
      }
    }), { threshold: 0.12 });
    // Initial viewport content must paint immediately, including restored scroll
    // positions. Explicit exclusions also protect heroes on very short screens.
    const belowFold = Array.from(document.querySelectorAll('.section-head')).filter(el =>
      !el.closest('[data-no-reveal], .page-hero, .brand-hero, .brand-definition') &&
      el.getBoundingClientRect().top >= window.innerHeight
    );
    belowFold.forEach(el => observer.observe(el));
  }
  const chapterLinks = Array.from(document.querySelectorAll('.chapter-nav a[href^="#"], .method-story-rail a[href^="#"]'));
  if (chapterLinks.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) chapterLinks.forEach(link => {
        if (link.hash === '#' + entry.target.id) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      }); });
    }, { rootMargin: '-15% 0px -55% 0px' });
    chapterLinks.forEach(link => { const el = document.getElementById(link.hash.slice(1)); if (el) observer.observe(el); });
  }
})();
