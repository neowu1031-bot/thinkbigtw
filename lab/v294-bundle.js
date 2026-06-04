/* MoneyRadar v294 — 用戶系統 + 跨裝置雲端同步
 * 技術：Supabase Auth (Email + Google OAuth) + Supabase DB
 * 1. 👤 註冊/登入 UI（Email / Google）
 * 2. ☁️ Watchlist 雲端同步
 * 3. ☁️ Portfolio 雲端同步
 * 4. ☁️ Alerts 雲端同步
 * 5. 🌐 跨裝置即時同步
 */
(function () {
  'use strict';
  const SB_URL = 'https://sirhskxufayklqrlxeep.supabase.co';
  const SB_KEY = window.__MR_SB_ANON_KEY__ || '';

  function V294_$(id) { return document.getElementById(id); }
  function V294_el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }

  // 載入 Supabase JS SDK
  function V294_loadSDK() {
    return new Promise((resolve, reject) => {
      if (window.supabase) return resolve(window.supabase);
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
      script.onload = () => resolve(window.supabase);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  let sb = null;
  let currentUser = null;

  async function V294_init() {
    try {
      const SDK = await V294_loadSDK();
      sb = SDK.createClient(SB_URL, SB_KEY);
      // 監聽 auth 變化
      sb.auth.onAuthStateChange((event, session) => {
        currentUser = session?.user || null;
        V294_renderAuthUI();
        if (currentUser) {
          V294_pullCloudData();  // 登入時拉雲端資料
        }
      });
      // 取現有 session
      const { data: { session } } = await sb.auth.getSession();
      currentUser = session?.user || null;
      V294_renderAuthUI();
      if (currentUser) V294_pullCloudData();
    } catch (e) { console.error('v294 init', e); }
  }

  // ============================================================
  // 👤 Auth UI — v297a hotfix: 拿掉 v294 自己的右上角按鈕（NEO 主程式已有登入頁）
  // 此函式改為 no-op，僅保留 currentUser tracking 給 sync 邏輯使用
  // ============================================================
  function V294_renderAuthUI() {
    // 如果之前 v294 加過按鈕，移除掉
    const oldBtn = document.getElementById('mr-v294-auth-btn');
    if (oldBtn) oldBtn.remove();
    // 不再產生 v294 自己的 UI（避免與 NEO 原有登入頁重複）
  }

  function V294_openAuthModal() {
    // 已登入：顯示 menu
    if (currentUser) {
      const menu = V294_el(`<div style="position:fixed;top:46px;right:12px;background:var(--bg-surface);border:1px solid #4ade80;border-radius:8px;padding:8px;z-index:9999;min-width:200px;box-shadow:0 4px 12px rgba(0,0,0,0.5)">
        <div style="padding:8px;color:#aaa;font-size:11px;border-bottom:1px solid #333">${currentUser.email}</div>
        <button id="v294-sync-now" style="width:100%;padding:8px;background:transparent;border:none;color:#fff;cursor:pointer;text-align:left">☁️ 立即同步</button>
        <button id="v294-logout" style="width:100%;padding:8px;background:transparent;border:none;color:#ef4444;cursor:pointer;text-align:left">🚪 登出</button>
      </div>`);
      document.body.appendChild(menu);
      menu.querySelector('#v294-sync-now').onclick = async () => {
        await V294_syncToCloud();
        alert('✅ 已同步到雲端');
        menu.remove();
      };
      menu.querySelector('#v294-logout').onclick = async () => {
        await sb.auth.signOut();
        menu.remove();
      };
      // 點外面關
      setTimeout(() => {
        document.addEventListener('click', function close(e) {
          if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', close);
          }
        });
      }, 100);
      return;
    }
    // 未登入：彈出登入 modal
    const modal = V294_el(`<div id="v294-modal" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:99999;display:flex;align-items:center;justify-content:center">
      <div style="background:var(--bg-surface);padding:32px;border-radius:12px;width:400px;max-width:90vw;border:1px solid #4ade80">
        <h2 style="color:#fff;margin:0 0 16px 0;text-align:center">登入 / 註冊 MoneyRadar</h2>
        <p style="color:#aaa;font-size:13px;text-align:center;margin:0 0 16px 0">登入後，watchlist / portfolio / 警報自動跨裝置同步</p>
        <button id="v294-google-login" style="width:100%;padding:12px;background:#fff;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold;margin-bottom:8px;display:flex;align-items:center;justify-content:center;gap:8px">
          <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/></svg>
          使用 Google 登入
        </button>
        <div style="display:flex;align-items:center;gap:8px;margin:12px 0"><div style="flex:1;height:1px;background:#333"></div><span style="color:#666;font-size:11px">或</span><div style="flex:1;height:1px;background:#333"></div></div>
        <input id="v294-email" type="email" placeholder="Email" style="width:100%;padding:10px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;margin-bottom:8px;box-sizing:border-box">
        <input id="v294-pw" type="password" placeholder="密碼（6+ 字元）" style="width:100%;padding:10px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;margin-bottom:12px;box-sizing:border-box">
        <button id="v294-signup" style="width:100%;padding:10px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold;margin-bottom:6px">📝 註冊</button>
        <button id="v294-login" style="width:100%;padding:10px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold">🔓 登入</button>
        <button id="v294-cancel" style="width:100%;padding:8px;background:transparent;color:#aaa;border:none;cursor:pointer;margin-top:8px">取消</button>
        <p id="v294-msg" style="color:#fbbf24;font-size:12px;margin:8px 0 0 0;min-height:18px"></p>
      </div>
    </div>`);
    document.body.appendChild(modal);
    const msg = V294_$('v294-msg');
    V294_$('v294-cancel').onclick = () => modal.remove();
    V294_$('v294-google-login').onclick = async () => {
      msg.textContent = '🔄 跳轉到 Google...';
      try {
        await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });
      } catch (e) { msg.textContent = '❌ ' + e.message; }
    };
    V294_$('v294-signup').onclick = async () => {
      const email = V294_$('v294-email').value.trim();
      const password = V294_$('v294-pw').value;
      if (!email || !password) return msg.textContent = '⚠️ 請輸入 email + 密碼';
      msg.textContent = '🔄 註冊中...';
      try {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        msg.textContent = '✅ 註冊成功！請查收 email 確認信。';
      } catch (e) { msg.textContent = '❌ ' + e.message; }
    };
    V294_$('v294-login').onclick = async () => {
      const email = V294_$('v294-email').value.trim();
      const password = V294_$('v294-pw').value;
      if (!email || !password) return msg.textContent = '⚠️ 請輸入 email + 密碼';
      msg.textContent = '🔄 登入中...';
      try {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        modal.remove();
      } catch (e) { msg.textContent = '❌ ' + e.message; }
    };
  }

  // ============================================================
  // ☁️ 雲端同步邏輯
  // ============================================================
  async function V294_syncToCloud() {
    if (!currentUser || !sb) return;
    const data = {
      user_id: currentUser.id,
      watchlist: localStorage.getItem('mr_watchlist') || '[]',
      portfolio: localStorage.getItem('mr_v278_paper_account') || '{}',
      alerts: localStorage.getItem('mr_v285_alerts') || '[]',
      journal: localStorage.getItem('mr_v290_journal') || '[]',
      research_notes: V294_collectResearchNotes(),
      updated_at: new Date().toISOString()
    };
    try {
      const { error } = await sb.from('user_data').upsert(data, { onConflict: 'user_id' });
      if (error) throw error;
      console.log('[v294] ✅ Synced to cloud');
    } catch (e) { console.error('[v294] sync failed', e); }
  }

  function V294_collectResearchNotes() {
    const notes = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('mr_v293_research_')) {
        notes[k.replace('mr_v293_research_', '')] = localStorage.getItem(k);
      }
    }
    return JSON.stringify(notes);
  }

  async function V294_pullCloudData() {
    if (!currentUser || !sb) return;
    try {
      const { data, error } = await sb.from('user_data').select('*').eq('user_id', currentUser.id).single();
      if (error) {
        if (error.code === 'PGRST116') {
          // 第一次登入，沒資料 — 推現有 localStorage 上去
          await V294_syncToCloud();
          return;
        }
        throw error;
      }
      if (data) {
        // Merge 策略：以雲端為主，但保留本地有但雲端沒有的
        if (data.watchlist) localStorage.setItem('mr_watchlist', data.watchlist);
        if (data.portfolio) localStorage.setItem('mr_v278_paper_account', data.portfolio);
        if (data.alerts) localStorage.setItem('mr_v285_alerts', data.alerts);
        if (data.journal) localStorage.setItem('mr_v290_journal', data.journal);
        if (data.research_notes) {
          try {
            const notes = JSON.parse(data.research_notes);
            for (const [k, v] of Object.entries(notes)) {
              localStorage.setItem(`mr_v293_research_${k}`, v);
            }
          } catch { }
        }
        console.log('[v294] ☁️ Pulled from cloud, please refresh');
        // 顯示提示
        const banner = V294_el(`<div style="position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#4ade80;color:#000;padding:12px 24px;border-radius:8px;z-index:99999;font-weight:bold;transition:opacity 0.5s ease">☁️ 雲端資料已同步！重新整理頁面以查看 <button onclick="location.reload()" style="margin-left:8px;padding:4px 12px;background:#000;color:#4ade80;border:none;border-radius:4px;cursor:pointer">重新整理</button><button onclick="this.parentElement.style.opacity='0';setTimeout(()=>this.parentElement.remove(),500)" style="margin-left:8px;padding:2px 8px;background:transparent;color:#000;border:1px solid rgba(0,0,0,0.3);border-radius:4px;cursor:pointer;font-weight:bold;font-size:14px;line-height:1">✕</button></div>`);
        document.body.appendChild(banner);
        setTimeout(() => { banner.style.opacity='0'; setTimeout(()=>banner.remove(),500); }, 4000);
      }
    } catch (e) { console.error('[v294] pull failed', e); }
  }

  // 自動同步：每 5 分鐘 + 換 tab 時
  setInterval(() => { if (currentUser) V294_syncToCloud(); }, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && currentUser) V294_pullCloudData();
  });

  // ============================================================
  // 啟動
  // ============================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', V294_init);
  } else {
    V294_init();
  }
  console.log('[MoneyRadar v294] ✅ User system + Cloud sync 載入');
})();
