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
    document.querySelectorAll('.section-head').forEach(el => observer.observe(el));
  }
  const diagram = document.querySelector('.governance-model');
  if (diagram) {
    let queued = false;
    const render = () => {
      queued = false;
      if (motion.matches) { diagram.style.transform = ''; return; }
      const rect = diagram.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      const offset = Math.max(-6, Math.min(6, (rect.top - window.innerHeight / 2) * 0.015));
      diagram.style.transform = 'translateY(' + offset.toFixed(2) + 'px)';
    };
    window.addEventListener('scroll', () => {
      if (!motion.matches && !queued) { queued = true; window.requestAnimationFrame(render); }
    }, { passive: true });
    motion.addEventListener('change', render);
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
