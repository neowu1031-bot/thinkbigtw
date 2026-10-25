(function () {
  var video = document.querySelector('.home-video');
  if (!video) return;

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
    // Sync immediately to match actual video state at script load time
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
