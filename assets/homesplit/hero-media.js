/* The homepage movie is optional: no media URL is loaded under reduced motion.
   Rejected autoplay, disabled JavaScript and load errors all retain the poster. */
(function () {
  'use strict';
  // Personal hub retains GM-approved autoplay and the original video attributes.
  // Reduced motion pauses it and exposes an explicit static poster instead.
  const personal = document.querySelector('.personal-mascot video');
  if (personal) {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      if (reduced.matches) personal.pause();
      else if (!document.hidden) { const play = personal.play(); if (play) play.catch(() => {}); }
    };
    personal.addEventListener('playing', () => { if (reduced.matches) personal.pause(); });
    reduced.addEventListener('change', sync);
    document.addEventListener('visibilitychange', () => document.hidden ? personal.pause() : sync());
    sync();
  }
  const video = document.getElementById('brand-hero-video');
  if (!video) return;
  const frame = video.parentElement;
  const button = document.getElementById('hero-motion-toggle');
  const source = video.querySelector('source');
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let userPaused = false;
  let visible = true;
  function poster() { frame.classList.remove('is-playing'); }
  function pause() { video.pause(); poster(); }
  function play() {
    if (preference.matches || userPaused || !visible || document.hidden) return;
    if (!source.hasAttribute('src')) { source.src = source.dataset.src; video.load(); }
    video.muted = true;
    const promise = video.play();
    if (promise) promise.catch(() => { poster(); if (!preference.matches) { button.hidden = false; button.textContent = '播放主視覺'; } });
  }
  function update() {
    button.hidden = preference.matches;
    if (preference.matches) {
      pause(); source.removeAttribute('src'); video.load();
    } else {
      button.textContent = userPaused ? '播放主視覺' : '暫停主視覺';
      play();
    }
  }
  video.addEventListener('playing', () => {
    if (preference.matches || userPaused || !visible || document.hidden) { pause(); return; }
    frame.classList.add('is-playing'); button.hidden = false; button.textContent = '暫停主視覺';
  });
  const failed = () => { pause(); button.hidden = true; };
  video.addEventListener('error', failed);
  source.addEventListener('error', failed);
  button.addEventListener('click', () => {
    userPaused = !video.paused;
    if (userPaused) { pause(); button.textContent = '播放主視覺'; } else play();
  });
  preference.addEventListener('change', update);
  document.addEventListener('visibilitychange', () => document.hidden ? pause() : play());
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) play(); else pause();
    }, { threshold:0.05 });
    observer.observe(frame);
  }
  update();
})();
