/* Progressive enhancement: links remain native; no global mouse tracking. */
(function () {
  'use strict';
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const buttonSelector = 'button,summary,a.button,a.btn,a.local-consult,a.cta-btn,a.contact-btn,a.btn-primary,a.btn-secondary,a.btn-cta,a.btn-line,a.line-btn,a.cta-button,[role="button"]';
  const cardSelector = '.department-index>a,a.variant,a.card,a.tier-card,a.resource,a.package,a.product-card';
  function layer(el, className) {
    const node = document.createElement('span');
    node.className = className; node.setAttribute('aria-hidden', 'true');
    el.appendChild(node); return node;
  }
  function arrow(el) {
    // Wrap a trailing arrow without changing the accessible link label.
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = []; let node;
    while ((node = walker.nextNode())) nodes.push(node);
    const last = nodes.filter(n => n.textContent.trim()).pop();
    if (!last || !/[›→↗]\s*$/.test(last.textContent) || last.parentElement.closest('.tb-hover-arrow')) return;
    const match = last.textContent.match(/([›→↗])\s*$/);
    const span = document.createElement('span'); span.className = 'tb-hover-arrow';
    span.setAttribute('aria-hidden', 'true'); span.textContent = match[1];
    last.textContent = last.textContent.slice(0, match.index);
    last.after(span);
  }
  const cleanups = new Set();
  function spotlight(card) {
    const clip = layer(card, 'tb-hover-shine-clip');
    const shine = layer(clip, 'tb-hover-shine');
    let frame = 0, bounds = null, point = null;
    const stop = () => {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0; bounds = null; point = null;
      shine.style.transform = '';
    };
    const paint = () => {
      frame = 0;
      if (!bounds || !point || !fine.matches || reduced.matches) return;
      const x = Math.max(0, Math.min(bounds.width, point.x - bounds.left));
      const y = Math.max(0, Math.min(bounds.height, point.y - bounds.top));
      shine.style.transform = `translate3d(${x - 140}px,${y - 140}px,0)`;
    };
    const move = event => {
      if (!fine.matches || reduced.matches || event.pointerType === 'touch') return;
      if (!bounds) bounds = card.getBoundingClientRect();
      point = {x: event.clientX, y: event.clientY};
      if (!frame) frame = window.requestAnimationFrame(paint);
    };
    card.addEventListener('pointerenter', move);
    card.addEventListener('pointermove', move, {passive: true});
    card.addEventListener('pointerleave', stop);
    card.addEventListener('pointercancel', stop);
    // Scrolling changes coordinates; refresh only while the pointer is inside.
    const invalidate = () => { bounds = null; };
    window.addEventListener('scroll', invalidate, {passive: true});
    window.addEventListener('resize', invalidate, {passive: true});
    cleanups.add(stop);
  }
  function enhance(root) {
    const elements = Array.from(root.querySelectorAll('a,button,summary,[role="button"]'));
    if (root.matches && root.matches('a,button,summary,[role="button"]')) elements.unshift(root);
    elements.forEach(el => {
      if (el.dataset.tbFeedback || el.closest('svg')) return;
      el.dataset.tbFeedback = 'true';
      // Keep fixed/absolute controls (video, advisor, dialogs) in place.
      if (el.matches(cardSelector + ',' + buttonSelector)) {
        const position = window.getComputedStyle(el).position;
        if (!position || position === 'static') el.classList.add('tb-hover-surface');
      }
      if (el.matches(cardSelector)) {
        el.classList.add('tb-hover-card'); layer(el, 'tb-hover-halo');
        // Clip the image and spotlight separately so the outer shadow can show.
        el.querySelectorAll('img.department-art,img.personal-card-art').forEach(img => {
          const kind = img.classList.contains('department-art') ? 'department-art' : 'personal-card-art';
          const frame = document.createElement('span'); frame.className = 'tb-hover-media ' + kind;
          img.before(frame); frame.appendChild(img); img.classList.remove(kind);
        });
        if (el.matches('.department-index>a,a.variant,a.tier-card,a.package')) spotlight(el);
      } else if (el.matches(buttonSelector)) {
        el.classList.add('tb-hover-button'); layer(el, 'tb-hover-halo'); arrow(el);
      } else if (el.querySelector('img,picture')) {
        el.classList.add('tb-hover-image');
      } else if (!el.classList.contains('skip-link')) {
        el.classList.add('tb-hover-link'); layer(el, 'tb-hover-underline');
      }
      if (el.matches('a') && el.querySelector('img,picture')) el.classList.add('tb-hover-image');
    });
  }
  function init() {
    enhance(document);
    // The advisor and review lightbox are inserted after page load.
    const mutations = new MutationObserver(records => records.forEach(record => {
      record.addedNodes.forEach(node => {
        if (node.nodeType === 1 && !node.classList.contains('tb-hover-halo') && !node.classList.contains('tb-hover-shine') && !node.classList.contains('tb-hover-shine-clip') && !node.classList.contains('tb-hover-underline') && !node.classList.contains('tb-hover-arrow')) enhance(node);
      });
    }));
    mutations.observe(document.body, {childList: true, subtree: true});
    const reset = () => cleanups.forEach(stop => stop());
    fine.addEventListener('change', reset); reduced.addEventListener('change', reset);
    const diagram = document.querySelector('.governance-model');
    if (!diagram) return;
    const control = diagram.querySelector('.model-motion-control');
    let entered = false;
    const enter = () => {
      if (entered) return;
      entered = true; diagram.classList.add('model-entered');
    };
    if (!reduced.matches && 'IntersectionObserver' in window) diagram.classList.add('model-ready');
    const visibility = () => {
      diagram.classList.toggle('model-paused', control.getAttribute('aria-pressed') === 'true' || document.hidden);
    };
    const preference = () => {
      control.hidden = reduced.matches;
      if (reduced.matches) { diagram.classList.remove('model-ready'); enter(); diagram.classList.add('model-settled'); }
      visibility();
    };
    diagram.addEventListener('animationend', event => {
      if (event.animationName === 'model-draw' && event.target.closest('.model-wires-lower')) diagram.classList.add('model-settled');
    });
    control.addEventListener('click', () => {
      const paused = control.getAttribute('aria-pressed') !== 'true';
      control.setAttribute('aria-pressed', String(paused));
      control.firstChild.textContent = paused ? '繼續資料流動' : '暫停資料流動';
      visibility();
    });
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => entries.forEach(entry => {
        diagram.classList.toggle('model-in-view', entry.isIntersecting);
        if (entry.isIntersecting) enter();
      }), {threshold: .12});
      observer.observe(diagram);
    } else { enter(); diagram.classList.add('model-in-view'); }
    document.addEventListener('visibilitychange', visibility);
    reduced.addEventListener('change', preference); preference();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
