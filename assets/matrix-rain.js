/* Matrix digital rain — shared effect for thinkbigtw.com
 * Constraints: opacity ~0.09 canvas-level, prefers-reduced-motion respected,
 * disabled on viewport < 768px, pure requestAnimationFrame (~16 fps). */
(function () {
  'use strict';

  // Honour system accessibility preference
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Skip on small screens — performance & aesthetics
  if (window.innerWidth < 768) return;

  var canvas = document.getElementById('matrix-rain');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');

  var FONT_SIZE  = 14;   // px per character cell
  var TRAIL_LEN  = 24;   // number of chars in each falling tail
  var FRAME_MS   = 62;   // ~16 fps

  // Katakana + digits — classic Matrix palette
  var CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789';

  function rchar() { return CHARS[Math.random() * CHARS.length | 0]; }

  var cols, drops, colChars;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    cols  = Math.floor(canvas.width / FONT_SIZE);
    drops = [];
    colChars = [];
    for (var i = 0; i < cols; i++) {
      // stagger start times so drops don't all begin at row 0
      drops[i] = -Math.floor(Math.random() * 50);
      colChars[i] = [];
      for (var j = 0; j < TRAIL_LEN; j++) colChars[i][j] = rchar();
    }
  }

  resize();

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 250);
  });

  var lastTime = 0;

  function draw(ts) {
    requestAnimationFrame(draw);
    if (ts - lastTime < FRAME_MS) return;
    lastTime = ts;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = FONT_SIZE + 'px monospace';

    for (var i = 0; i < cols; i++) {
      var head = drops[i];

      // Occasionally randomise a character in the tail for the shimmer look
      if (Math.random() < 0.08) {
        colChars[i][Math.random() * TRAIL_LEN | 0] = rchar();
      }

      for (var j = 0; j < TRAIL_LEN; j++) {
        var row = head - j;
        if (row < 0 || row * FONT_SIZE > canvas.height) continue;

        var alpha;
        if (j === 0) {
          // Bright head — near white-green
          alpha = 0.95;
          ctx.fillStyle = 'rgba(200,255,210,' + alpha + ')';
        } else {
          // Tail fades to zero
          alpha = (1 - j / TRAIL_LEN) * 0.65;
          ctx.fillStyle = 'rgba(0,200,70,' + alpha + ')';
        }
        ctx.fillText(colChars[i][j % TRAIL_LEN], i * FONT_SIZE, row * FONT_SIZE);
      }

      drops[i]++;

      // Reset column once its tail has cleared the bottom of the canvas
      if ((head - TRAIL_LEN) * FONT_SIZE > canvas.height && Math.random() > 0.97) {
        drops[i] = -Math.floor(Math.random() * 30);
      }
    }
  }

  requestAnimationFrame(draw);
}());
