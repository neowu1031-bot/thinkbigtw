/* Matrix digital rain — shared effect for thinkbigtw.com
 * Two palette modes auto-detected from body background:
 *   dark-bg  — original neon palette (opacity 0.09, light-green chars)
 *   light-bg — deep forest-green palette (opacity 0.38, visible on white)
 * Constraints: prefers-reduced-motion respected,
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

  // ── Background detection ──────────────────────────────────────────────────
  // Reads the computed body background-color and determines light vs dark.
  // Luminance threshold: > 128 = light page, <= 128 = dark page.
  function isLightBg() {
    var bg = window.getComputedStyle(document.body).backgroundColor;
    var m  = bg.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
    if (!m) return true; // unknown → assume light
    var r = +m[1], g = +m[2], b = +m[3];
    return (0.299 * r + 0.587 * g + 0.114 * b) > 128;
  }

  var LIGHT_BG = isLightBg();

  // ── Palette config ────────────────────────────────────────────────────────
  var HEAD_COLOR, TAIL_R, TAIL_G, TAIL_B, TAIL_ALPHA_MAX;

  if (LIGHT_BG) {
    // Light / white background — deep forest green, higher canvas opacity
    // Effective head opacity ~0.34, tail brightest ~0.31 → clearly visible
    canvas.style.opacity = '0.38';
    HEAD_COLOR     = 'rgba(0,110,25,0.9)';
    TAIL_R = 0; TAIL_G = 80; TAIL_B = 15;
    TAIL_ALPHA_MAX = 0.82;
  } else {
    // Dark background — classic neon palette, unchanged
    canvas.style.opacity = '0.09';
    HEAD_COLOR     = 'rgba(200,255,210,0.95)';
    TAIL_R = 0; TAIL_G = 200; TAIL_B = 70;
    TAIL_ALPHA_MAX = 0.65;
  }

  var FONT_SIZE = 14;   // px per character cell
  var TRAIL_LEN = 24;   // number of chars in each falling tail
  var FRAME_MS  = 62;   // ~16 fps

  // Katakana + digits — classic Matrix palette
  var CHARS = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789';

  function rchar() { return CHARS[Math.random() * CHARS.length | 0]; }

  var cols, drops, colChars;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    cols = Math.floor(canvas.width / FONT_SIZE);
    drops    = [];
    colChars = [];
    for (var i = 0; i < cols; i++) {
      drops[i]    = -Math.floor(Math.random() * 50);
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

        if (j === 0) {
          // Bright head character
          ctx.fillStyle = HEAD_COLOR;
        } else {
          // Tail fades to transparent
          var alpha = (1 - j / TRAIL_LEN) * TAIL_ALPHA_MAX;
          ctx.fillStyle = 'rgba(' + TAIL_R + ',' + TAIL_G + ',' + TAIL_B + ',' + alpha.toFixed(3) + ')';
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
