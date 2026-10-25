(function () {
  var video = document.querySelector('.home-video');
  if (!video) return;

  // Respect prefers-reduced-motion: pause instead of autoplay
  var prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) {
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

  // Play / pause toggle
  var playBtn = document.getElementById('tb-play');
  if (playBtn) {
    // Sync initial state with actual video state (may be paused due to reduced-motion)
    if (prefersReduced || video.paused) {
      playBtn.setAttribute('aria-pressed', 'false');
      playBtn.textContent = '播放';
    }
    playBtn.addEventListener('click', function () {
      if (video.paused) {
        video.play();
        playBtn.setAttribute('aria-pressed', 'true');
        playBtn.textContent = '暫停';
      } else {
        video.pause();
        playBtn.setAttribute('aria-pressed', 'false');
        playBtn.textContent = '播放';
      }
    });
  }
})();
