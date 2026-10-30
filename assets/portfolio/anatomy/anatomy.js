/* Presentation only. Does not read/write ERP state, storage, forms or navigation. */
(() => {
  'use strict';
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  const phone = window.matchMedia('(max-width: 600px)');
  document.querySelectorAll('[data-order-flow]').forEach(figure => {
    const buttons = [...figure.querySelectorAll('[data-flow-step]')];
    const art = [...figure.querySelectorAll('[data-flow-art]')];
    const svg = figure.querySelector('svg');
    const description = document.createElement('p');
    description.className = 'anatomy-description';
    description.setAttribute('role', 'status');
    description.setAttribute('aria-live', 'polite');
    description.setAttribute('aria-atomic', 'true');
    figure.querySelector('.anatomy-flow-note').before(description);
    let selected = -1;
    const select = index => {
      if (selected === index) return;
      selected = index;
      buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
      art.forEach((part, i) => part.dataset.active = String(i === index));
      description.textContent = figure.querySelector(`#${buttons[index].getAttribute('aria-describedby')}`).textContent;
    };
    buttons.forEach((button, i) => {
      button.addEventListener('pointerenter', () => select(i));
      button.addEventListener('focus', () => select(i));
      button.addEventListener('click', () => select(i));
    });
    art.forEach((part, i) => {
      part.addEventListener('pointerenter', () => select(i));
      part.addEventListener('click', () => select(i));
    });
    const resize = () => svg.setAttribute('viewBox', phone.matches ? '0 0 480 490' : '0 0 960 270');
    phone.addEventListener('change', resize);
    figure.classList.add('is-enhanced');
    resize(); select(0);
  });

  document.querySelectorAll('[data-warehouse]').forEach(svg => {
    const card = svg.closest('.project-card');
    if (!card) return;
    const incoming = svg.querySelector('[data-parcel=incoming]');
    const outgoing = svg.querySelector('[data-parcel=outgoing]');
    const counter = svg.querySelector('[data-stock-counter]');
    let frame = 0, start = null, visible = !('IntersectionObserver' in window);
    let hovered = false;
    // One four-second cycle: receive one unit, then ship one unit. No idle loop.
    const smooth = t => t * t * (3 - 2 * t);
    const draw = elapsed => {
      const receive = Math.min(elapsed / 1600, 1);
      const ship = Math.max(0, Math.min((elapsed - 2200) / 1600, 1));
      incoming.setAttribute('transform', `translate(${smooth(receive)*55} ${smooth(receive)*27.5})`);
      incoming.setAttribute('opacity', elapsed < 1600 ? '1' : '0');
      outgoing.setAttribute('transform', `translate(${(smooth(ship)-1)*55} ${(smooth(ship)-1)*27.5})`);
      outgoing.setAttribute('opacity', elapsed >= 2200 && elapsed < 3800 ? '1' : '0');
      counter.textContent = elapsed >= 1600 && elapsed < 3800 ? '13' : '12';
    };
    const reset = () => {
      cancelAnimationFrame(frame); frame = 0; start = null; draw(0);
    };
    const tick = now => {
      frame = 0;
      if (still.matches || !visible || document.hidden) { reset(); return; }
      if (start === null) start = now;
      const elapsed = Math.min(now - start, 4000);
      draw(elapsed);
      if (elapsed < 4000) frame = requestAnimationFrame(tick);
      // Keep a completed cycle still until a new interaction starts it.
    };
    const run = () => {
      if (still.matches || !visible || document.hidden || frame) return;
      start = null; frame = requestAnimationFrame(tick);
    };
    card.addEventListener('pointerenter', () => { hovered = true; run(); });
    card.addEventListener('pointerleave', () => { hovered = false; if (!card.matches(':focus-within')) reset(); });
    card.addEventListener('focusin', run);
    card.addEventListener('focusout', event => { if (!card.contains(event.relatedTarget) && !hovered) reset(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        visible = entries[entries.length - 1].isIntersecting;
        if (!visible) reset();
        else if (hovered || card.matches(':focus-within')) run();
      }).observe(svg);
    }
    still.addEventListener('change', () => { reset(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
    draw(0);
  });
})();
