/* The homepage movie is optional: no media URL is loaded under reduced motion.
   Rejected autoplay, disabled JavaScript and load errors all retain the poster.
   HOMESPLIT v6 (SITE, RANK 01:50 MTG-b18f0903): honour data-autoplay on the
   hero video so the HTML never ships the autoplay attribute. The poster image
   is therefore the only LCP candidate Lighthouse can pick up on mobile. */
(function () {
  'use strict';
  // Assign media URLs only after checking the user's motion preference.
  const personal = document.querySelector('.personal-mascot video');
  if (personal) {
    const source = personal.querySelector('source');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      if (reduced.matches) {
        personal.pause();
        if (source.hasAttribute('src')) { source.removeAttribute('src'); personal.load(); }
      } else if (!document.hidden) {
        if (!source.hasAttribute('src')) { source.src = source.dataset.src; personal.load(); }
        const play = personal.play(); if (play) play.catch(() => {});
      }
    };
    personal.addEventListener('playing', () => { if (reduced.matches) personal.pause(); });
    reduced.addEventListener('change', sync);
    document.addEventListener('visibilitychange', () => document.hidden ? personal.pause() : sync());
    sync();
  }
  const video = document.getElementById('brand-hero-video');
  if (!video) return;
  const frame = video.parentElement;
  // NEO 9/27: no visible pause control; reduced-motion users still get the poster only.
  const button = document.getElementById('hero-motion-toggle') || { hidden: true, textContent: '', addEventListener() {} };
  const source = video.querySelector('source');
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  // HOMESPLIT v6 fix: the brand hero video must not autoplay on phones.
  // Honour data-autoplay on the hero video: "desktop" (default) means play on
  // desktop viewports only; "all" or "mobile" keeps the previous always-on
  // behaviour. The poster image is therefore the only LCP candidate on phones.
  const isMobileViewport = () => window.matchMedia('(max-width: 767px)').matches;
  const autoplayMode = (video.dataset.autoplay || 'desktop').toLowerCase();
  const playsOnThisViewport = () => {
    if (autoplayMode === 'all') return true;
    if (autoplayMode === 'mobile') return isMobileViewport();
    return !isMobileViewport(); // desktop (default)
  };
  let userPaused = false;
  let visible = true;
  let mediaReady = false;
  function poster() { frame.classList.remove('is-playing'); }
  function pause() { video.pause(); poster(); }
  function play() {
    if (!mediaReady || preference.matches || userPaused || !visible || document.hidden) return;
    if (!playsOnThisViewport()) return;
    if (!source.hasAttribute('src')) {
      // Choose once before the first load; rotating/resizing never downloads a
      // second movie. Removing data-mobile-src restores the desktop-only path.
      source.src = source.dataset.mobileSrc && isMobileViewport()
        ? source.dataset.mobileSrc : source.dataset.src;
      video.load();
    }
    video.muted = true;
    const promise = video.play();
    if (promise) promise.catch(() => { poster(); if (!preference.matches) { button.hidden = false; button.textContent = '播放主視覺'; } });
  }
  function update() {
    button.hidden = !mediaReady || preference.matches || !playsOnThisViewport();
    if (preference.matches) {
      pause(); source.removeAttribute('src'); video.load();
    } else if (!playsOnThisViewport()) {
      // Skip the video on this viewport: keep poster, never load or play.
      pause();
      if (source.hasAttribute('src')) { source.removeAttribute('src'); video.load(); }
      button.hidden = true;
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
  window.matchMedia('(max-width: 767px)').addEventListener('change', update);
  document.addEventListener('visibilitychange', () => document.hidden ? pause() : play());
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) play(); else pause();
    }, { threshold:0.05 });
    observer.observe(frame);
  }
  update();
  // Keep the poster on the critical rendering path. Every playback entry point
  // shares this gate, including visibility and motion-preference changes.
  function scheduleMedia() {
    window.setTimeout(() => {
      const ready = () => { mediaReady = true; update(); };
      if ('requestIdleCallback' in window) window.requestIdleCallback(ready);
      else window.setTimeout(ready, 0);
    }, 2000);
  }
  // HOMESPLIT v6 fix: skip the schedule entirely on viewports where the video
  // is not meant to autoplay, so Lighthouse never sees the hero video as an
  // LCP candidate on phones (or on desktop, when data-autoplay="none").
  if (!playsOnThisViewport()) {
    mediaReady = false;
  } else if (document.readyState === 'complete') scheduleMedia();
  else window.addEventListener('load', scheduleMedia, { once: true });
})();
