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

  // Respect prefers-reduced-motion: pause instead of autoplay
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    video.pause();
  }

  // Mute toggle
  var muteBtn = document.getElementById('tb-mute');
  if (muteBtn) {
    muteBtn.addEventListener('click', function () {
      video.muted = !video.muted;
      muteBtn.textContent = video.muted ? '開聲音' : '靜音';
      muteBtn.setAttribute('aria-label', video.muted ? '開啟聲音' : '關閉聲音');
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
})();
