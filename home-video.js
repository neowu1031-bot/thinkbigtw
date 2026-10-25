(function () {
  var video = document.querySelector('.home-video');
  if (!video) return;

  // Responsive source + poster selection (fallback for browsers where <source media> on video is unreliable)
  var isDesktop = window.matchMedia('(min-width:901px)').matches;
  var desktopSrc = '/assets/video/tb-ad-v3a-54.mp4';
  var mobileSrc = '/assets/video/tb-ad-v3a.mp4';
  var desktopPoster = '/assets/video/tb-ad-v3a-54-poster.webp';
  var mobilePoster = '/assets/video/tb-ad-v3a-poster.webp';

  video.poster = isDesktop ? desktopPoster : mobilePoster;

  // Ensure only the right source is queued (browser <source media> should handle this,
  // but reload with correct src as a safety net when needed)
  var sources = video.querySelectorAll('source');
  var expectedSrc = isDesktop ? desktopSrc : mobileSrc;
  var currentSrc = video.currentSrc || (sources[0] && sources[0].src) || '';
  if (currentSrc && currentSrc.indexOf(isDesktop ? 'v3a-54' : 'v3a.') === -1) {
    // Browser picked the wrong source; swap to the right one
    for (var i = 0; i < sources.length; i++) { video.removeChild(sources[i]); }
    var s = document.createElement('source');
    s.src = expectedSrc;
    s.type = 'video/mp4';
    video.appendChild(s);
    video.load();
  }

  // ── Sound state tracking ──
  // autoMutedFallback: true when we fell back to muted autoplay because sound was blocked
  // userMuted: true when the user explicitly muted via button
  var autoMutedFallback = false;
  var userMuted = false;
  var activationListenerActive = false;

  var muteBtn = document.getElementById('tb-mute');
  var soundHint = document.getElementById('tb-sound-hint');

  function syncMuteBtn() {
    if (!muteBtn) return;
    var isMuted = video.muted;
    muteBtn.textContent = isMuted ? '開聲音' : '靜音';
    muteBtn.setAttribute('aria-label', isMuted ? '開啟聲音' : '關閉聲音');
  }

  function showSoundHint() {
    if (soundHint) soundHint.hidden = false;
  }

  function hideSoundHint() {
    if (soundHint) soundHint.hidden = true;
  }

  function deactivateActivationListener() {
    if (activationListenerActive) {
      activationListenerActive = false;
      document.removeEventListener('click', onFirstActivation, true);
      document.removeEventListener('touchstart', onFirstActivation, true);
      document.removeEventListener('keydown', onFirstActivation, true);
    }
  }

  function setupActivationListener() {
    activationListenerActive = true;
    document.addEventListener('click', onFirstActivation, true);
    document.addEventListener('touchstart', onFirstActivation, true);
    document.addEventListener('keydown', onFirstActivation, true);
  }

  // First user interaction: auto-unmute if in autoplay-muted fallback (not user-muted)
  function onFirstActivation(e) {
    if (!activationListenerActive) return;
    // Let the mute button's own click handler take full control when clicked
    if (muteBtn && e.target === muteBtn) {
      deactivateActivationListener();
      return;
    }
    if (autoMutedFallback && !userMuted) {
      video.muted = false;
      autoMutedFallback = false;
      syncMuteBtn();
      hideSoundHint();
    }
    deactivateActivationListener();
  }

  // Mute toggle — user has full control at any time
  if (muteBtn) {
    muteBtn.addEventListener('click', function () {
      // User is taking manual control; disable the auto-unmute listener
      deactivateActivationListener();
      if (video.muted) {
        // Unmuting
        video.muted = false;
        userMuted = false;
        autoMutedFallback = false;
        hideSoundHint();
      } else {
        // Muting
        video.muted = true;
        userMuted = true;
      }
      syncMuteBtn();
    });
  }

  // Play / pause toggle — driven by video events so button always reflects actual state
  var playBtn = document.getElementById('tb-play');
  if (playBtn) {
    function syncPlayBtn() {
      var playing = !video.paused;
      playBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
      playBtn.setAttribute('aria-label', playing ? '暫停影片' : '播放影片');
      playBtn.textContent = playing ? '暫停' : '播放';
    }
    video.addEventListener('play', syncPlayBtn);
    video.addEventListener('pause', syncPlayBtn);
    syncPlayBtn();

    playBtn.addEventListener('click', function () {
      if (video.paused) {
        video.play().catch(function () { /* autoplay blocked by browser */ });
      } else {
        video.pause();
      }
    });
  }

  // Respect prefers-reduced-motion: pause and skip all sound logic
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    video.pause();
    return;
  }

  // ── Try autoplay with sound ──
  // The HTML attribute sets muted=true as a safe default for page load.
  // Here we attempt to remove that and play with sound.
  video.muted = false;
  var playPromise = video.play();

  if (typeof playPromise !== 'undefined') {
    playPromise.then(function () {
      if (!video.muted) {
        // Sound is working — nothing more to do
        autoMutedFallback = false;
        syncMuteBtn();
      } else {
        // Browser silently kept audio muted (rare; treat same as blocked)
        autoMutedFallback = true;
        syncMuteBtn();
        showSoundHint();
        setupActivationListener();
      }
    }).catch(function () {
      // Autoplay with sound was blocked — fall back to muted autoplay
      video.muted = true;
      autoMutedFallback = true;
      video.play().catch(function () { /* both modes blocked; do nothing */ });
      syncMuteBtn();
      showSoundHint();
      setupActivationListener();
    });
  } else {
    // Very old browser without Promise-based play() — assume muted from HTML
    syncMuteBtn();
  }
})();
