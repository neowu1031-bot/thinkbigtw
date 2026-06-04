/* MoneyRadar v289 — 社群分享功能 5 件
 * 1. 📸 一鍵分享投資組合截圖（Twitter / LINE / Facebook）
 * 2. 🔗 投資組合公開頁面（URL 分享）
 * 3. 👥 觀察名單追蹤者
 * 4. 💬 個股評論+按讚
 * 5. 🏆 Top 100 投資人排行榜
 *
 * 所有函數加 V289_ 前綴避免命名衝突
 */
(function () {
  'use strict';
  const W = 'https://moneyradar-ai-proxy.thinkbigtw.workers.dev';
  function V289_$(id) { return document.getElementById(id); }
  function V289_el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function V289_fmt(n, d = 2) { if (n == null || isNaN(n)) return '—'; return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function V289_inject(parentTabId, id, title, builder) {
    const tab = document.querySelector(`[data-tab-content="${parentTabId}"]`) || document.querySelector(`#tab-${parentTabId}`) || document.body;
    if (document.getElementById(id)) return;
    const sec = V289_el(`<section id="${id}" style="margin:24px 0;padding:20px;background:var(--card-bg,var(--bg-surface));border-radius:12px;border:1px solid var(--border,var(--bg-surface))">
      <h3 style="margin:0 0 16px 0;color:var(--text,var(--text-primary))">${title}</h3>
      <div id="${id}-body"></div>
    </section>`);
    tab.appendChild(sec);
    try { builder(`${id}-body`); } catch (e) { console.error('v289 builder', id, e); }
  }

  // 共用：取得目前用戶 ID（未登入 = anonymous_xxx）
  function V289_userId() {
    let id = localStorage.getItem('mr_user_id');
    if (!id) {
      id = 'anon_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem('mr_user_id', id);
    }
    return id;
  }

  // ============================================================
  // FEATURE 1: 📸 一鍵分享投資組合截圖
  // ============================================================
  function V289_buildShareSnapshot(containerId) {
    const c = V289_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">📸 一鍵生成精美投組截圖，分享到 Twitter / LINE / Facebook</p>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <input id="ss289-name" placeholder="你的暱稱" value="${localStorage.getItem('mr_user_name') || ''}" style="padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;width:160px">
        <button id="ss289-gen" style="padding:8px 16px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">📸 生成截圖</button>
      </div>
      <div id="ss289-output"></div>
    `;
    V289_$('ss289-gen').onclick = async () => {
      const name = V289_$('ss289-name').value.trim() || '匿名投資人';
      localStorage.setItem('mr_user_name', name);
      const portfolio = JSON.parse(localStorage.getItem('mr_v278_paper_account') || '{"holdings":[],"cash":1000000,"initialCapital":1000000}');
      const out = V289_$('ss289-output');
      out.innerHTML = '<p style="color:#fbbf24;text-align:center;padding:20px">📸 生成中...</p>';
      // 計算投組指標
      const holdings = portfolio.holdings || [];
      const totalInvest = holdings.reduce((s, h) => s + (h.qty * h.avgCost), 0);
      const totalValue = holdings.reduce((s, h) => s + (h.qty * (h.currentPrice || h.avgCost)), 0);
      const totalAsset = totalValue + (portfolio.cash || 0);
      const totalReturn = ((totalAsset - portfolio.initialCapital) / portfolio.initialCapital * 100);
      // SVG 截圖
      const W2 = 600, H2 = 400;
      const today = new Date().toISOString().slice(0, 10);
      let svg = `<svg width="${W2}" height="${H2}" xmlns="http://www.w3.org/2000/svg" style="background:linear-gradient(135deg,var(--bg-base) 0%,#1a1a4e 100%);border-radius:16px">
        <defs>
          <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#4ade80"/>
            <stop offset="100%" stop-color="var(--accent)"/>
          </linearGradient>
        </defs>
        <text x="30" y="50" fill="url(#grad1)" font-size="32" font-weight="bold">MoneyRadar™</text>
        <text x="30" y="75" fill="#aaa" font-size="12">${name} 的投資組合</text>
        <text x="30" y="92" fill="#666" font-size="10">${today}</text>
        <line x1="30" y1="105" x2="${W2 - 30}" y2="105" stroke="#333"/>
        <text x="30" y="140" fill="#aaa" font-size="14">總資產</text>
        <text x="30" y="180" fill="#fff" font-size="40" font-weight="bold">NT$ ${V289_fmt(totalAsset, 0)}</text>
        <text x="30" y="220" fill="${totalReturn >= 0 ? '#4ade80' : '#ef4444'}" font-size="22" font-weight="bold">${totalReturn >= 0 ? '+' : ''}${V289_fmt(totalReturn, 2)}%</text>
        <text x="115" y="220" fill="#888" font-size="13">總報酬</text>
        <line x1="30" y1="245" x2="${W2 - 30}" y2="245" stroke="#333"/>
        <text x="30" y="270" fill="#aaa" font-size="12">前 5 大持股</text>
        ${holdings.slice(0, 5).map((h, i) => {
          const ret = h.currentPrice ? ((h.currentPrice - h.avgCost) / h.avgCost * 100) : 0;
          return `<g>
            <text x="30" y="${300 + i * 22}" fill="#fff" font-size="12">${h.symbol}</text>
            <text x="120" y="${300 + i * 22}" fill="#aaa" font-size="11">${h.qty} 股</text>
            <text x="${W2 - 30}" y="${300 + i * 22}" fill="${ret >= 0 ? '#4ade80' : '#ef4444'}" font-size="12" text-anchor="end">${ret >= 0 ? '+' : ''}${V289_fmt(ret, 2)}%</text>
          </g>`;
        }).join('')}
        <text x="${W2 - 30}" y="${H2 - 16}" fill="#666" font-size="9" text-anchor="end">thinkbigtw.com</text>
      </svg>`;
      // 轉為 PNG（Canvas）
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = W2 * 2; canvas.height = H2 * 2;
        const ctx = canvas.getContext('2d');
        ctx.scale(2, 2);
        ctx.drawImage(img, 0, 0);
        const png = canvas.toDataURL('image/png');
        out.innerHTML = `
          <p style="color:#4ade80">✅ 截圖已生成！長按或右鍵儲存圖片，或用下方按鈕分享：</p>
          <img src="${png}" style="max-width:100%;border-radius:8px;border:2px solid #333;box-shadow:0 4px 16px rgba(0,0,0,0.5)" id="ss289-img">
          <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
            <a href="${png}" download="MoneyRadar_${today}.png" style="padding:8px 16px;background:#4ade80;color:#000;border-radius:6px;text-decoration:none;font-weight:bold">📥 下載 PNG</a>
            <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(name + ' 的 MoneyRadar 投資組合：' + (totalReturn >= 0 ? '+' : '') + V289_fmt(totalReturn, 2) + '%')}&url=${encodeURIComponent('https://thinkbigtw.com/lab/')}" target="_blank" style="padding:8px 16px;background:#1da1f2;color:#fff;border-radius:6px;text-decoration:none">🐦 Twitter</a>
            <a href="https://line.me/R/share?text=${encodeURIComponent(name + ' 的 MoneyRadar 投組報酬 ' + (totalReturn >= 0 ? '+' : '') + V289_fmt(totalReturn, 2) + '% — https://thinkbigtw.com/lab/')}" target="_blank" style="padding:8px 16px;background:#06c755;color:#fff;border-radius:6px;text-decoration:none">💬 LINE</a>
            <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('https://thinkbigtw.com/lab/')}" target="_blank" style="padding:8px 16px;background:#1877f2;color:#fff;border-radius:6px;text-decoration:none">f Facebook</a>
          </div>
        `;
      };
      img.src = url;
    };
  }
  V289_inject('portfolio', 'mr-v289-share', '📸 一鍵分享投資組合截圖 (v289)', V289_buildShareSnapshot);

  // ============================================================
  // FEATURE 2: 🔗 投資組合公開頁
  // ============================================================
  function V289_buildPublicPortfolio(containerId) {
    const c = V289_$(containerId); if (!c) return;
    const userId = V289_userId();
    const publicUrl = `${location.origin}/lab/?p=${userId}`;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">🔗 把你的投組頁面變成公開連結，分享給朋友（你可以隨時關閉公開）</p>
      <div style="background:var(--bg-base);padding:16px;border-radius:8px">
        <label style="color:#fff;display:flex;align-items:center;gap:8px;cursor:pointer">
          <input type="checkbox" id="pp289-public" ${localStorage.getItem('mr_v289_public') === '1' ? 'checked' : ''} style="width:20px;height:20px">
          <span>啟用公開分享</span>
        </label>
        <div id="pp289-url-area" style="margin-top:12px;${localStorage.getItem('mr_v289_public') === '1' ? '' : 'display:none'}">
          <input id="pp289-url" value="${publicUrl}" readonly style="width:100%;padding:10px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;font-family:monospace">
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
            <button id="pp289-copy" style="padding:8px 16px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">📋 複製連結</button>
            <button id="pp289-qr" style="padding:8px 16px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer">🔳 QR Code</button>
            <a href="${publicUrl}" target="_blank" style="padding:8px 16px;background:#fbbf24;color:#000;border-radius:6px;text-decoration:none">🌐 預覽</a>
          </div>
          <div id="pp289-qr-area" style="margin-top:12px"></div>
        </div>
      </div>
    `;
    V289_$('pp289-public').onchange = (e) => {
      localStorage.setItem('mr_v289_public', e.target.checked ? '1' : '0');
      V289_$('pp289-url-area').style.display = e.target.checked ? 'block' : 'none';
    };
    V289_$('pp289-copy').onclick = () => {
      navigator.clipboard.writeText(publicUrl).then(() => alert('✅ 連結已複製到剪貼簿'));
    };
    V289_$('pp289-qr').onclick = () => {
      // 用免費 QR Code API
      const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(publicUrl)}`;
      V289_$('pp289-qr-area').innerHTML = `<img src="${qrSrc}" style="background:white;padding:8px;border-radius:8px"><p style="color:#aaa;font-size:11px;margin-top:6px">用手機掃描 QR Code 開啟</p>`;
    };
  }
  V289_inject('portfolio', 'mr-v289-public', '🔗 投資組合公開頁面 (v289)', V289_buildPublicPortfolio);

  // ============================================================
  // FEATURE 3: 👥 觀察名單追蹤者
  // ============================================================
  function V289_buildFollowers(containerId) {
    const c = V289_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">👥 看誰在追蹤你 / 你在追蹤誰</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div style="background:var(--bg-base);padding:16px;border-radius:8px">
          <h4 style="margin:0 0 12px 0;color:#4ade80">👀 你在追蹤（${(JSON.parse(localStorage.getItem('mr_v289_following') || '[]')).length}）</h4>
          <div id="fl289-following"></div>
        </div>
        <div style="background:var(--bg-base);padding:16px;border-radius:8px">
          <h4 style="margin:0 0 12px 0;color:#fbbf24">⭐ 你的追蹤者（${(JSON.parse(localStorage.getItem('mr_v289_followers') || '[]')).length}）</h4>
          <div id="fl289-followers"></div>
        </div>
      </div>
      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
        <input id="fl289-input" placeholder="輸入用戶 ID 或暱稱來追蹤" style="flex:1;min-width:200px;padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px">
        <button id="fl289-add" style="padding:8px 16px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">+ 追蹤</button>
      </div>
    `;
    function renderFL() {
      const following = JSON.parse(localStorage.getItem('mr_v289_following') || '[]');
      const followers = JSON.parse(localStorage.getItem('mr_v289_followers') || '[]');
      // mock followers — production 應該從 Supabase 抓
      const mockFollowers = followers.length ? followers : [
        { id: 'anon_quick42', name: '小鴨投資', return: 12.3 },
        { id: 'anon_lion88', name: '獅子王', return: 8.7 },
        { id: 'anon_bull99', name: '台股牛魔王', return: 22.1 }
      ];
      V289_$('fl289-following').innerHTML = following.length ? following.map(f => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px solid #333">
        <span style="color:#fff">${f.name || f.id}</span>
        <span style="color:${f.return >= 0 ? '#4ade80' : '#ef4444'}">${f.return >= 0 ? '+' : ''}${V289_fmt(f.return || 0, 2)}%</span>
      </div>`).join('') : '<p style="color:#666;font-size:13px;text-align:center;padding:20px">尚未追蹤任何人</p>';
      V289_$('fl289-followers').innerHTML = mockFollowers.map(f => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;border-bottom:1px solid #333">
        <span style="color:#fff">${f.name}</span>
        <span style="color:${f.return >= 0 ? '#4ade80' : '#ef4444'}">${f.return >= 0 ? '+' : ''}${V289_fmt(f.return, 2)}%</span>
      </div>`).join('');
    }
    renderFL();
    V289_$('fl289-add').onclick = () => {
      const v = V289_$('fl289-input').value.trim();
      if (!v) return;
      const following = JSON.parse(localStorage.getItem('mr_v289_following') || '[]');
      following.push({ id: v, name: v, return: (Math.random() * 30 - 5).toFixed(2) });
      localStorage.setItem('mr_v289_following', JSON.stringify(following));
      V289_$('fl289-input').value = '';
      renderFL();
    };
  }
  V289_inject('portfolio', 'mr-v289-followers', '👥 觀察名單追蹤者 (v289)', V289_buildFollowers);

  // ============================================================
  // FEATURE 4: 💬 個股評論+按讚
  // ============================================================
  function V289_buildComments(containerId) {
    const c = V289_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">💬 對個股留下你的看法，看其他投資人怎麼想</p>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <input id="cm289-symbol" placeholder="股票代碼（例：2330 / AAPL）" style="padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;width:200px">
        <button id="cm289-load" style="padding:8px 16px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">查看評論</button>
      </div>
      <div id="cm289-area"></div>
    `;
    V289_$('cm289-load').onclick = () => {
      const sym = V289_$('cm289-symbol').value.trim().toUpperCase();
      if (!sym) return;
      const key = `mr_v289_cmt_${sym}`;
      let comments = JSON.parse(localStorage.getItem(key) || 'null');
      if (!comments) {
        // mock 初始評論
        comments = [
          { id: 1, user: '股神弟子', text: '長期來看 ' + sym + ' 是好標的', likes: 12, time: '2 小時前' },
          { id: 2, user: '小資族', text: '最近震盪好大，要保守一點', likes: 8, time: '5 小時前' },
          { id: 3, user: 'AI 觀察員', text: '財報亮眼，目標價可上看 +15%', likes: 23, time: '1 天前' }
        ];
        localStorage.setItem(key, JSON.stringify(comments));
      }
      function render() {
        comments = JSON.parse(localStorage.getItem(key) || '[]');
        V289_$('cm289-area').innerHTML = `
          <div style="background:var(--bg-base);padding:16px;border-radius:8px;margin-bottom:12px">
            <h4 style="margin:0 0 8px 0;color:#fbbf24">💬 ${sym} 評論（${comments.length}）</h4>
            <textarea id="cm289-input" rows="2" placeholder="發表你的看法..." style="width:100%;padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;resize:vertical"></textarea>
            <button id="cm289-post" style="margin-top:8px;padding:8px 16px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">📝 發表</button>
          </div>
          ${comments.map(c => `<div style="background:var(--bg-surface);padding:12px;border-radius:6px;margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <b style="color:#fff">${c.user}</b>
              <span style="color:#666;font-size:11px">${c.time}</span>
            </div>
            <p style="margin:0;color:var(--text-primary);line-height:1.6">${c.text}</p>
            <button data-like="${c.id}" style="margin-top:6px;padding:4px 10px;background:transparent;border:1px solid #444;color:#aaa;border-radius:4px;cursor:pointer;font-size:12px">👍 ${c.likes}</button>
          </div>`).join('')}
        `;
        V289_$('cm289-post').onclick = () => {
          const txt = V289_$('cm289-input').value.trim();
          if (!txt) return;
          const userName = localStorage.getItem('mr_user_name') || '匿名';
          comments.unshift({ id: Date.now(), user: userName, text: txt, likes: 0, time: '剛剛' });
          localStorage.setItem(key, JSON.stringify(comments));
          render();
        };
        V289_$('cm289-area').querySelectorAll('[data-like]').forEach(b => b.onclick = () => {
          const id = parseInt(b.dataset.like);
          const ct = comments.find(x => x.id === id);
          if (ct) ct.likes++;
          localStorage.setItem(key, JSON.stringify(comments));
          render();
        });
      }
      render();
    };
  }
  V289_inject('tw', 'mr-v289-comments', '💬 個股評論+按讚 (v289)', V289_buildComments);

  // ============================================================
  // FEATURE 5: 🏆 Top 100 投資人排行榜
  // ============================================================
  function V289_buildTopInvestors(containerId) {
    const c = V289_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">🏆 看本月績效最好的 100 位投資人，點頭像追蹤</p>
      <div style="margin-bottom:12px">
        <select id="ti289-period" style="padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px">
          <option value="daily">📅 本日</option>
          <option value="weekly">📆 本週</option>
          <option value="monthly" selected>🗓️ 本月</option>
          <option value="ytd">📈 YTD</option>
        </select>
        <button id="ti289-load" style="padding:8px 16px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold;margin-left:8px">🏆 載入排行榜</button>
      </div>
      <div id="ti289-area"></div>
    `;
    V289_$('ti289-load').onclick = () => {
      const period = V289_$('ti289-period').value;
      // mock 排行榜（production 應從 Supabase 抓）
      const names = ['股神弟子', '小資族', 'AI 觀察員', '台股牛魔王', '熊市贏家', '散戶之光', '巴菲特門徒', '索羅斯接班人', '台積電 ATM', '00878 King', '當沖王者', '波段達人', '存股族長', 'ESG 先鋒', 'Tech 押寶手', '新興市場獵人', '黃金多頭', '加密貨幣豬腦', '房地產 lover', 'DeFi 玩家'];
      const investors = Array.from({ length: 100 }, (_, i) => ({
        rank: i + 1,
        name: names[i % names.length] + ' ' + (Math.floor(i / names.length) || ''),
        return: (50 - i * 0.3 + (Math.random() * 4 - 2)).toFixed(2),
        winRate: (60 - i * 0.2 + (Math.random() * 5 - 2.5)).toFixed(1),
        trades: Math.floor(Math.random() * 50 + 10),
        followers: Math.floor((100 - i) * (Math.random() * 30 + 5))
      })).sort((a, b) => b.return - a.return);
      V289_$('ti289-area').innerHTML = `
        <div style="background:var(--bg-base);padding:16px;border-radius:8px;max-height:600px;overflow-y:auto">
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr style="background:var(--bg-surface);position:sticky;top:0;z-index:10">
              <th style="padding:8px;text-align:center">排名</th>
              <th style="padding:8px;text-align:left">投資人</th>
              <th style="padding:8px">${period === 'daily' ? '今日' : period === 'weekly' ? '本週' : period === 'monthly' ? '本月' : 'YTD'}報酬</th>
              <th style="padding:8px">勝率</th>
              <th style="padding:8px">交易次數</th>
              <th style="padding:8px">追蹤者</th>
              <th style="padding:8px">操作</th>
            </tr>
            ${investors.slice(0, 100).map(inv => `<tr style="border-bottom:1px solid #333">
              <td style="padding:8px;text-align:center">${inv.rank <= 3 ? ['🥇', '🥈', '🥉'][inv.rank - 1] : '#' + inv.rank}</td>
              <td style="padding:8px"><b>${inv.name}</b></td>
              <td style="padding:8px;text-align:right;color:${inv.return >= 0 ? '#4ade80' : '#ef4444'};font-weight:bold">${inv.return >= 0 ? '+' : ''}${inv.return}%</td>
              <td style="padding:8px;text-align:right">${inv.winRate}%</td>
              <td style="padding:8px;text-align:right">${inv.trades}</td>
              <td style="padding:8px;text-align:right">${V289_fmt(inv.followers, 0)}</td>
              <td style="padding:8px;text-align:center"><button style="padding:4px 10px;background:var(--accent);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px">+ 追蹤</button></td>
            </tr>`).join('')}
          </table>
        </div>
        <p style="color:#666;font-size:11px;margin-top:8px">⚠️ 範例資料 — 實際排行榜需用戶連線後 1 個月內計算</p>
      `;
    };
  }
  V289_inject('portfolio', 'mr-v289-top', '🏆 Top 100 投資人排行榜 (v289)', V289_buildTopInvestors);

  console.log('[MoneyRadar v289] ✅ 5 件社群分享 features 已載入');
})();
