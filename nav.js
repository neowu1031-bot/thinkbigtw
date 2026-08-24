// ═══════════════════════════════════════════════════
// Think BIG! — 全站統一導覽列 (Top Nav + Footer Nav)
// 共用元件，CSS + HTML 自動注入。每頁只需:
//   <script src="/nav.js" defer></script>
// 範本來源 = 首頁 / index.html 的 #nav。
// 字型 Azeret Mono + Noto Sans TC，配色 #e8422a，
// 採半透明深色毛玻璃，能同時相容深色與淺色頁面背景。
// 全螢幕展示頁 (/、/v2/) 不載入本檔，沿用各自的 nav。
// ═══════════════════════════════════════════════════
(function () {
  if (window.__tbNavLoaded || document.getElementById('tb-nav')) return;
  window.__tbNavLoaded = true;

  function init() {
    if (!document.body) { document.addEventListener('DOMContentLoaded', init); return; }
    if (document.getElementById('tb-nav')) return;
    // 工具頁 / 管理頁不注入統一導覽列
    var _p = location.pathname;
    if (_p.indexOf('/erp/') === 0 || /\/clawland\/admin/.test(_p)) return;

    // ---- 0. 確保字型 (Azeret Mono + Noto Sans TC) ----
    if (!document.querySelector('link[href*="Azeret+Mono"]')) {
      var pc1 = document.createElement('link'); pc1.rel = 'preconnect'; pc1.href = 'https://fonts.googleapis.com';
      var pc2 = document.createElement('link'); pc2.rel = 'preconnect'; pc2.href = 'https://fonts.gstatic.com'; pc2.crossOrigin = '';
      var fl = document.createElement('link'); fl.rel = 'stylesheet';
      fl.href = 'https://fonts.googleapis.com/css2?family=Azeret+Mono:wght@400;500;700;800&family=Noto+Sans+TC:wght@300;400;500;700&display=swap';
      document.head.appendChild(pc1); document.head.appendChild(pc2); document.head.appendChild(fl);
    }

    // ---- 1. 注入 CSS ----
    var css = [
      "#tb-nav,#tb-footer{--tb-red:#e8422a;--tb-mono:'Azeret Mono',ui-monospace,monospace;--tb-tc:'Noto Sans TC',sans-serif;box-sizing:border-box}",
      "#tb-nav *,#tb-footer *{box-sizing:border-box}",
      /* ── TOP NAV ── */
      "#tb-nav{position:fixed;top:0;left:0;right:0;z-index:900;display:flex;align-items:center;justify-content:space-between;gap:18px;height:54px;padding:0 clamp(16px,4vw,44px);font-family:var(--tb-mono);background:rgba(10,10,10,0.78);backdrop-filter:blur(16px) saturate(160%);-webkit-backdrop-filter:blur(16px) saturate(160%);border-bottom:1px solid rgba(232,66,42,0.22)}",
      "#tb-nav .tb-logo{flex:0 0 auto;font-family:var(--tb-mono);font-size:clamp(0.6rem,1.1vw,0.74rem);font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:#f0f0f0;text-decoration:none;white-space:nowrap}",
      "#tb-nav .tb-logo span{color:var(--tb-red)}",
      "#tb-nav .tb-logo .tb-tag{color:rgba(240,240,240,0.4);font-weight:400;margin-left:6px}",
      "#tb-nav .tb-links{flex:1 1 auto;display:flex;align-items:center;justify-content:flex-end;gap:clamp(12px,2vw,28px);min-width:0;overflow-x:auto;scrollbar-width:none}",
      "#tb-nav .tb-links::-webkit-scrollbar{display:none}",
      "#tb-nav .tb-links a{position:relative;font-size:0.58rem;font-weight:500;letter-spacing:0.16em;text-transform:uppercase;color:rgba(240,240,240,0.62);text-decoration:none;white-space:nowrap;padding:4px 0;transition:color 0.25s ease}",
      "#tb-nav .tb-links a::after{content:'';position:absolute;left:0;bottom:0;width:0;height:1px;background:var(--tb-red);transition:width 0.35s cubic-bezier(0.25,1,0.5,1)}",
      "#tb-nav .tb-links a:hover{color:#fff}",
      "#tb-nav .tb-links a:hover::after,#tb-nav .tb-links a.tb-active::after{width:100%}",
      "#tb-nav .tb-links a.tb-active{color:#fff}",
      /* ── FOOTER NAV ── */
      "#tb-footer{position:relative;z-index:2;font-family:var(--tb-mono);background:#0a0a0a;border-top:1px solid rgba(232,66,42,0.18);padding:22px clamp(16px,4vw,44px);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px}",
      "#tb-footer .tb-f-logo{font-size:0.7rem;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#f0f0f0;text-decoration:none;white-space:nowrap}",
      "#tb-footer .tb-f-logo span{color:var(--tb-red)}",
      "#tb-footer .tb-f-logo .tb-tag{color:rgba(240,240,240,0.38);font-weight:400;margin-left:6px}",
      "#tb-footer .tb-f-links{display:flex;align-items:center;flex-wrap:wrap;gap:18px}",
      "#tb-footer .tb-f-links a{font-size:0.55rem;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:rgba(240,240,240,0.55);text-decoration:none;transition:color 0.25s ease}",
      "#tb-footer .tb-f-links a:hover{color:var(--tb-red)}",
      "#tb-footer .tb-copy{font-size:0.55rem;letter-spacing:0.08em;color:rgba(240,240,240,0.38);white-space:nowrap}",
      /* ── MOBILE ── */
      "@media(max-width:640px){",
      "  #tb-nav{height:50px;gap:10px}",
      "  #tb-nav .tb-logo .tb-tag{display:none}",
      "  #tb-nav .tb-links{gap:14px;justify-content:flex-start;-webkit-overflow-scrolling:touch}",
      "  #tb-nav .tb-links a{font-size:0.55rem;letter-spacing:0.12em}",
      "  #tb-footer{flex-direction:column;align-items:flex-start;gap:12px}",
      "  #tb-footer .tb-copy{white-space:normal}",
      "}"
    ].join('\n');
    var st = document.createElement('style'); st.id = 'tb-nav-style'; st.textContent = css; document.head.appendChild(st);

    // ---- 2. 連結資料 (對應規格 D) ----
    var LINKS = [
      { t: 'Enterprise', h: '/enterprise/' },
      { t: 'Harness Engineers', h: '/harness/' }
    ];
    var path = location.pathname.replace(/\/index\.html?$/, '/');
    function activeClass(h) {
      if (h === '/') return path === '/' ? ' class="tb-active"' : '';
      return (path === h || path.indexOf(h) === 0) ? ' class="tb-active"' : '';
    }
    var logoHTML = 'Think <span>BIG!</span> Make it Real.';
    var linksHTML = LINKS.map(function (l) {
      return '<a href="' + l.h + '"' + activeClass(l.h) + '>' + l.t + '</a>';
    }).join('');

    // ---- 3. 注入頂部 NAV ----
    var nav = document.createElement('nav');
    nav.id = 'tb-nav';
    nav.setAttribute('aria-label', 'Think BIG global navigation');
    nav.innerHTML =
      '<a class="tb-logo" href="/">Think <span>BIG!</span><span class="tb-tag">Make it Real.</span></a>' +
      '<div class="tb-links">' + linksHTML + '</div>';
    document.body.insertBefore(nav, document.body.firstChild);

    // ---- 4. 版面相容處理 ----
    // flex 置中的單卡頁 (例: /clawland/download/) 不加 padding / footer，
    // 避免破壞置中；nav 以 fixed 浮層覆蓋頂部空白區即可。
    var bodyDisplay = getComputedStyle(document.body).display;
    var isFlexCentered = bodyDisplay === 'flex';
    if (!isFlexCentered) {
      var prevPad = parseFloat(getComputedStyle(document.body).paddingTop) || 0;
      document.body.style.paddingTop = (prevPad + 54) + 'px';

      // ---- 5. 注入底部精簡導覽 (Logo + 四連結 + Copyright 一行) ----
      var footer = document.createElement('footer');
      footer.id = 'tb-footer';
      footer.innerHTML =
        '<a class="tb-f-logo" href="/">Think <span>BIG!</span><span class="tb-tag">Make it Real.</span></a>' +
        '<div class="tb-f-links">' + LINKS.map(function (l) {
          return '<a href="' + l.h + '">' + l.t + '</a>';
        }).join('') + '</div>' +
        '<div class="tb-copy">© 2026 Think BIG! · thinkbigtw.com · Taiwan</div>';
      document.body.appendChild(footer);
    }
  }

  init();
})();
