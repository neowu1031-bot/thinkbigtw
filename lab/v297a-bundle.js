/* MoneyRadar v297a — UI/UX hotfix 10 件
 * 1. 拿掉 v294 自己的右上角登入按鈕（與 NEO 原有登入頁重複）
 * 2. 移除 cookie banner 的 🍪 emoji
 * 3. 隱藏「需完成 Google Cloud Console 設定後生效」+「管理員入口」
 * 4. 登入畫面加「記住我」checkbox
 * 5. 未登入時隱藏「新手導覽」+「右下 AI 鑽石」
 * 6. K 線背景持續向左流動（不再左右抖動）
 */
(function () {
  'use strict';

  const HIDE_TEXTS = [
    '需完成 Google Cloud Console 設定後生效',
    '管理員入口',
    '需完成Google Cloud Console設定後生效'
  ];

  // ============================================================
  // 6. K 線背景向左流動 + 整體 hotfix CSS
  // ============================================================
  function V297a_injectCSS() {
    if (document.getElementById('v297a-style')) return;
    const style = document.createElement('style');
    style.id = 'v297a-style';
    style.textContent = `
      /* K 線背景持續向左跑 */
      [class*="kline-bg"],
      [class*="candlestick-bg"],
      [class*="chart-bg"],
      [id*="kline-bg"],
      [id*="bg-chart"],
      .login-bg-canvas,
      .auth-bg,
      canvas[id*="bg"],
      canvas.background,
      .background-chart {
        animation: v297aScrollLeft 80s linear infinite !important;
        will-change: transform;
      }
      @keyframes v297aScrollLeft {
        from { background-position-x: 0; transform: translateX(0); }
        to { background-position-x: -200%; transform: translateX(-50%); }
      }
      /* v297a-remember-me checkbox 樣式 */
      .v297a-remember-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #aaa;
        font-size: 13px;
        margin: 8px 0 12px 0;
        cursor: pointer;
        user-select: none;
      }
      .v297a-remember-wrap input { width: 16px; height: 16px; cursor: pointer; }
      /* 統一隱藏 */
      .v297a-hidden { display: none !important; }
    `;
    document.head.appendChild(style);
  }

  // ============================================================
  // 1. 拿掉 v294 右上角登入按鈕
  // ============================================================
  function V297a_removeV294Button() {
    const btn = document.getElementById('mr-v294-auth-btn');
    if (btn) btn.remove();
  }

  // ============================================================
  // 2. 移除 cookie banner 的 🍪
  // ============================================================
  function V297a_cleanCookieBanner() {
    const banner = document.getElementById('v295-cookie');
    if (!banner) return;
    banner.querySelectorAll('span').forEach(s => {
      if (s.textContent.includes('🍪')) {
        s.textContent = s.textContent.replace(/🍪\s*/g, '').trim();
      }
    });
  }

  // ============================================================
  // 3. 隱藏 Google Cloud Console 提示 + 管理員入口
  // ============================================================
  function V297a_hideAdminText() {
    const all = document.querySelectorAll('p, span, div, a, small');
    all.forEach(el => {
      if (el.children.length > 0) return; // 只看 leaf
      const t = (el.textContent || '').trim();
      if (HIDE_TEXTS.includes(t)) {
        el.classList.add('v297a-hidden');
      }
    });
  }

  // ============================================================
  // 4. 加「記住我」checkbox
  // 規則：必須是 submit 登入按鈕（其往上 5 層內必須包含 email/password input）
  // 排除：tab 切換的「登入」按鈕（旁邊有「免費註冊」tab，且無 input）
  // ============================================================
  function V297a_addRememberMe() {
    // 先把舊版錯加的 checkbox 全部清除（避免重複/位置錯）
    document.querySelectorAll('.v297a-remember-wrap').forEach(el => el.remove());

    const buttons = Array.from(document.querySelectorAll('button'));
    const loginBtns = buttons.filter(b => {
      const t = (b.textContent || '').trim();
      if (t !== '登入') return false;
      if (b.offsetWidth < 200) return false; // 排除小的 tab 按鈕
      // 必須在表單內：往上找 5 層，看是否有 email/password input
      let parent = b.parentElement;
      for (let i = 0; i < 5 && parent; i++) {
        const hasEmail = parent.querySelector('input[type="email"], input[name="email"], input[placeholder*="Email"], input[placeholder*="email"]');
        const hasPw = parent.querySelector('input[type="password"]');
        if (hasEmail && hasPw) return true;
        parent = parent.parentElement;
      }
      return false;
    });

    loginBtns.forEach(btn => {
      const parent = btn.parentNode;
      if (!parent) return;
      // 確保 checkbox 緊接在 submit 按鈕前
      const remember = document.createElement('label');
      remember.className = 'v297a-remember-wrap';
      remember.innerHTML = `<input type="checkbox" id="v297a-remember-cb" ${localStorage.getItem('mr_remember_me') === '1' ? 'checked' : ''}><span>記住我（30 天）</span>`;
      parent.insertBefore(remember, btn);
      const cb = remember.querySelector('#v297a-remember-cb');
      cb.addEventListener('change', () => {
        localStorage.setItem('mr_remember_me', cb.checked ? '1' : '0');
      });
    });
  }

  // ============================================================
  // 5. 未登入時隱藏新手導覽 + AI 鑽石
  // ============================================================
  function V297a_isLoggedIn() {
    // 檢查 supabase token
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith('sb-') && k.includes('-auth-token')) {
        const v = localStorage.getItem(k);
        try {
          const obj = JSON.parse(v || '{}');
          if (obj && obj.access_token) return true;
        } catch { }
      }
      if (k === 'mr_logged_in' || k === 'supabase.auth.token') {
        const v = localStorage.getItem(k);
        if (v && v !== 'null' && v !== 'false' && v !== '') return true;
      }
    }
    return false;
  }

  function V297a_toggleAuthFeatures() {
    const loggedIn = V297a_isLoggedIn();

    // 找新手導覽（左下角，文字含「新手導覽」「教學」）
    const candidates1 = Array.from(document.querySelectorAll('button, a, [role="button"], div[class*="tutorial"], div[class*="onboarding"]'));
    const tutorialEls = candidates1.filter(el => {
      const t = (el.textContent || '').trim();
      return /新手導覽|教學引導|🚀 新手|tutorial/i.test(t) && t.length < 30;
    });

    // 找 AI 鑽石（右下角浮動按鈕，類別含 ai/diamond/floating）
    const aiEls = document.querySelectorAll(
      '[class*="ai-floating"], [class*="ai-bubble"], [class*="diamond"], [id*="ai-diamond"], [id*="ai-bubble"], [class*="ai-fab"]'
    );

    const allTargets = [...tutorialEls, ...aiEls];
    allTargets.forEach(el => {
      if (loggedIn) el.classList.remove('v297a-hidden');
      else el.classList.add('v297a-hidden');
    });
  }

  // ============================================================
  // 主控
  // ============================================================
  function V297a_run() {
    V297a_injectCSS();
    V297a_removeV294Button();
    V297a_cleanCookieBanner();
    V297a_hideAdminText();
    V297a_addRememberMe();
    V297a_toggleAuthFeatures();
  }

  // 啟動
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', V297a_run);
  } else {
    V297a_run();
  }
  // Polling — UI 動態載入時持續修正
  setInterval(V297a_run, 1500);

  console.log('[MoneyRadar v297a] UI/UX hotfix 10 件已載入');
})();
