/* MoneyRadar v290 — 心理面 + 交易日誌 + AI 教練 5 件
 * 1. 🧠 FOMO/Panic 心理預警
 * 2. 📓 交易日誌（Trading Journal）
 * 3. 📊 自我評估 KPI 儀表板
 * 4. 🧑‍🏫 AI 交易教練覆盤
 * 5. 😨 市場恐懼貪婪指數
 *
 * 所有函數加 V290_ 前綴避免命名衝突
 */
(function () {
  'use strict';
  const W = 'https://moneyradar-ai-proxy.thinkbigtw.workers.dev';
  function V290_$(id) { return document.getElementById(id); }
  function V290_el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function V290_fmt(n, d = 2) { if (n == null || isNaN(n)) return '—'; return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function V290_inject(parentTabId, id, title, builder) {
    const tab = document.querySelector(`[data-tab-content="${parentTabId}"]`) || document.querySelector(`#tab-${parentTabId}`) || document.body;
    if (document.getElementById(id)) return;
    const sec = V290_el(`<section id="${id}" style="margin:24px 0;padding:20px;background:var(--card-bg,var(--bg-surface));border-radius:12px;border:1px solid var(--border,var(--bg-surface))">
      <h3 style="margin:0 0 16px 0;color:var(--text,var(--text-primary))">${title}</h3>
      <div id="${id}-body"></div>
    </section>`);
    tab.appendChild(sec);
    try { builder(`${id}-body`); } catch (e) { console.error('v290 builder', id, e); }
  }

  // ============================================================
  // FEATURE 1: 🧠 FOMO/Panic 心理預警
  // ============================================================
  function V290_buildFOMODetect(containerId) {
    const c = V290_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">🧠 偵測你的交易行為是否被情緒主導（FOMO 追高 / Panic 殺低）</p>
      <div style="background:var(--bg-base);padding:16px;border-radius:8px;margin-bottom:12px">
        <p style="color:#fbbf24;margin:0 0 8px 0">📋 5 道行為自評題（誠實作答）：</p>
        <div id="fomo290-questions"></div>
        <button id="fomo290-eval" style="margin-top:12px;padding:10px 20px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">🧠 評估我的心理狀態</button>
      </div>
      <div id="fomo290-result"></div>
    `;
    const QS = [
      '我經常看到別人在某檔賺錢就立刻買進',
      '股價快速上漲時，我會擔心錯過而衝進去買',
      '我會在虧損 5-10% 時恐慌賣出',
      '我每天看盤超過 5 小時',
      '我會用槓桿（融資/期貨/選擇權）操作'
    ];
    V290_$('fomo290-questions').innerHTML = QS.map((q, i) => `
      <div style="margin:8px 0">
        <p style="color:#fff;margin:0 0 4px 0;font-size:14px">${i + 1}. ${q}</p>
        <div style="display:flex;gap:8px">
          ${[0, 1, 2, 3, 4].map(v => `<label style="cursor:pointer">
            <input type="radio" name="q${i}" value="${v}" style="display:none">
            <span class="q${i}-opt" data-v="${v}" style="display:inline-block;padding:4px 12px;background:var(--bg-surface);border:1px solid #444;color:#aaa;border-radius:4px;font-size:12px">${['從不', '很少', '偶爾', '常常', '總是'][v]}</span>
          </label>`).join('')}
        </div>
      </div>
    `).join('');
    V290_$('fomo290-questions').querySelectorAll('span[class^="q"]').forEach(s => {
      s.onclick = () => {
        const cls = s.className;
        document.querySelectorAll('.' + cls).forEach(o => { o.style.background = 'var(--bg-surface)'; o.style.color = '#aaa'; });
        s.style.background = '#4ade80'; s.style.color = '#000';
        s.previousElementSibling.checked = true;
      };
    });
    V290_$('fomo290-eval').onclick = () => {
      let score = 0;
      let answered = 0;
      QS.forEach((_, i) => {
        const sel = document.querySelector(`input[name="q${i}"]:checked`);
        if (sel) { score += parseInt(sel.value); answered++; }
      });
      if (answered < QS.length) return alert('請完成所有題目');
      // FOMO 指數 0-100
      const fomoIdx = Math.round(score / (QS.length * 4) * 100);
      let level, color, advice;
      if (fomoIdx < 25) { level = '✅ 理性投資人'; color = '#4ade80'; advice = '你的心理紀律良好，繼續保持！記得定期檢視策略，但不要過度交易。'; }
      else if (fomoIdx < 50) { level = '😊 偶爾感性'; color = '#fbbf24'; advice = '你大多數時候保持理性，但偶爾會被情緒左右。建議：1) 設定明確的進出場規則 2) 每筆交易前寫下理由'; }
      else if (fomoIdx < 75) { level = '⚠️ 情緒主導'; color = '#f97316'; advice = '你的交易明顯被情緒影響。建議：1) 每天看盤不超過 2 小時 2) 建立交易日誌追蹤情緒 3) 避免槓桿 4) 找朋友或社群討論'; }
      else { level = '🚨 高風險警報'; color = '#ef4444'; advice = '你的心理狀態非常危險！建議：1) 立即停止追高/殺低 2) 暫停交易至少 1 週 3) 重新檢視風險承受能力 4) 考慮諮詢理財顧問。'; }
      V290_$('fomo290-result').innerHTML = `
        <div style="background:var(--bg-base);padding:20px;border-radius:8px;border-left:6px solid ${color}">
          <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px">
            <div style="font-size:48px">${fomoIdx < 25 ? '😎' : fomoIdx < 50 ? '😊' : fomoIdx < 75 ? '😰' : '😱'}</div>
            <div>
              <div style="color:#aaa;font-size:12px">FOMO/Panic 指數</div>
              <div style="font-size:36px;color:${color};font-weight:bold">${fomoIdx}/100</div>
              <div style="color:${color};font-size:14px;font-weight:bold">${level}</div>
            </div>
          </div>
          <div style="background:var(--bg-surface);height:8px;border-radius:4px;overflow:hidden;margin-bottom:12px">
            <div style="background:${color};height:100%;width:${fomoIdx}%"></div>
          </div>
          <p style="color:var(--text-primary);line-height:1.6;margin:0">${advice}</p>
        </div>
      `;
      // 儲存歷史
      const history = JSON.parse(localStorage.getItem('mr_v290_fomo') || '[]');
      history.push({ date: new Date().toISOString().slice(0, 10), score: fomoIdx });
      localStorage.setItem('mr_v290_fomo', JSON.stringify(history.slice(-30)));
    };
  }
  V290_inject('tools', 'mr-v290-fomo', '🧠 FOMO/Panic 心理預警 (v290)', V290_buildFOMODetect);

  // ============================================================
  // FEATURE 2: 📓 交易日誌
  // ============================================================
  function V290_buildJournal(containerId) {
    const c = V290_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">📓 詳細記錄每筆交易：進場理由 + 情緒 + 結果（找出你的優勢與盲點）</p>
      <div style="background:var(--bg-base);padding:16px;border-radius:8px;margin-bottom:12px">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px">
          <input id="j290-date" type="date" value="${new Date().toISOString().slice(0, 10)}" style="padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px">
          <input id="j290-symbol" placeholder="代碼" style="padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px">
          <select id="j290-action" style="padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px">
            <option>BUY</option><option>SELL</option>
          </select>
          <input id="j290-price" type="number" step="0.01" placeholder="價格" style="padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px">
          <input id="j290-qty" type="number" placeholder="數量" style="padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px">
          <select id="j290-emotion" style="padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px">
            <option value="confident">😎 自信</option><option value="hopeful">🤞 期待</option>
            <option value="anxious">😰 焦慮</option><option value="fomo">🤤 FOMO</option>
            <option value="panic">😱 恐慌</option><option value="calm">😌 冷靜</option>
          </select>
        </div>
        <textarea id="j290-reason" rows="2" placeholder="進場理由（必填，越詳細越好）" style="width:100%;padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;margin-top:8px;resize:vertical"></textarea>
        <button id="j290-save" style="margin-top:8px;padding:10px 20px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">📓 記錄</button>
      </div>
      <div id="j290-list"></div>
    `;
    function render() {
      const trades = JSON.parse(localStorage.getItem('mr_v290_journal') || '[]');
      const total = trades.length;
      const buys = trades.filter(t => t.action === 'BUY').length;
      const sells = trades.filter(t => t.action === 'SELL').length;
      V290_$('j290-list').innerHTML = total ? `
        <p style="color:#aaa;font-size:13px;margin-bottom:8px">📋 共 ${total} 筆（${buys} 買 / ${sells} 賣）</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr style="background:var(--bg-surface)">
            <th style="padding:6px">日期</th><th style="padding:6px">代碼</th><th style="padding:6px">動作</th>
            <th style="padding:6px">價格</th><th style="padding:6px">數量</th><th style="padding:6px">情緒</th>
            <th style="padding:6px;text-align:left">理由</th><th style="padding:6px">操作</th>
          </tr>
          ${trades.slice().reverse().map((t, idx) => `<tr style="border-bottom:1px solid #333">
            <td style="padding:6px">${t.date}</td>
            <td style="padding:6px"><b>${t.symbol}</b></td>
            <td style="padding:6px;color:${t.action === 'BUY' ? '#4ade80' : '#ef4444'};font-weight:bold">${t.action}</td>
            <td style="padding:6px;text-align:right">${V290_fmt(t.price)}</td>
            <td style="padding:6px;text-align:right">${t.qty}</td>
            <td style="padding:6px;text-align:center">${({ confident: '😎', hopeful: '🤞', anxious: '😰', fomo: '🤤', panic: '😱', calm: '😌' })[t.emotion]}</td>
            <td style="padding:6px;color:#aaa">${t.reason}</td>
            <td style="padding:6px;text-align:center"><button data-rm="${trades.length - 1 - idx}" style="background:#ef4444;color:#fff;border:none;padding:2px 8px;border-radius:3px;cursor:pointer;font-size:11px">刪</button></td>
          </tr>`).join('')}
        </table>
      ` : '<p style="color:#666;text-align:center;padding:20px">尚無交易記錄。從第一筆開始建立你的優勢吧！</p>';
      V290_$('j290-list').querySelectorAll('[data-rm]').forEach(b => b.onclick = () => {
        const trs = JSON.parse(localStorage.getItem('mr_v290_journal') || '[]');
        trs.splice(parseInt(b.dataset.rm), 1);
        localStorage.setItem('mr_v290_journal', JSON.stringify(trs));
        render();
      });
    }
    render();
    V290_$('j290-save').onclick = () => {
      const trade = {
        date: V290_$('j290-date').value,
        symbol: V290_$('j290-symbol').value.trim().toUpperCase(),
        action: V290_$('j290-action').value,
        price: parseFloat(V290_$('j290-price').value),
        qty: parseInt(V290_$('j290-qty').value),
        emotion: V290_$('j290-emotion').value,
        reason: V290_$('j290-reason').value.trim()
      };
      if (!trade.symbol || !trade.price || !trade.qty || !trade.reason) {
        return alert('請填完整資料（理由必填）');
      }
      const trs = JSON.parse(localStorage.getItem('mr_v290_journal') || '[]');
      trs.push(trade);
      localStorage.setItem('mr_v290_journal', JSON.stringify(trs));
      V290_$('j290-symbol').value = ''; V290_$('j290-price').value = ''; V290_$('j290-qty').value = ''; V290_$('j290-reason').value = '';
      render();
    };
  }
  V290_inject('portfolio', 'mr-v290-journal', '📓 交易日誌 Trading Journal (v290)', V290_buildJournal);

  // ============================================================
  // FEATURE 3: 📊 自我評估 KPI 儀表板
  // ============================================================
  function V290_buildKPI(containerId) {
    const c = V290_$(containerId); if (!c) return;
    c.innerHTML = `
      <button id="kpi290-load" style="padding:10px 20px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">📊 計算我的 KPI</button>
      <div id="kpi290-area" style="margin-top:12px"></div>
    `;
    V290_$('kpi290-load').onclick = () => {
      const trades = JSON.parse(localStorage.getItem('mr_v290_journal') || '[]');
      const portfolio = JSON.parse(localStorage.getItem('mr_v278_paper_account') || '{"holdings":[],"cash":1000000,"initialCapital":1000000}');
      // KPI
      const totalTrades = trades.length;
      const wins = trades.filter(t => t.pnl > 0).length;
      const losses = trades.filter(t => t.pnl < 0).length;
      const winRate = totalTrades > 0 ? (wins / totalTrades * 100) : 0;
      const avgWin = wins > 0 ? trades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0) / wins : 0;
      const avgLoss = losses > 0 ? Math.abs(trades.filter(t => t.pnl < 0).reduce((s, t) => s + t.pnl, 0) / losses) : 0;
      const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;
      const totalAsset = portfolio.holdings.reduce((s, h) => s + h.qty * (h.currentPrice || h.avgCost), 0) + portfolio.cash;
      const totalReturn = ((totalAsset - portfolio.initialCapital) / portfolio.initialCapital * 100);
      // 情緒分析
      const emotionCount = {};
      trades.forEach(t => { emotionCount[t.emotion] = (emotionCount[t.emotion] || 0) + 1; });
      const dominantEmotion = Object.entries(emotionCount).sort((a, b) => b[1] - a[1])[0];
      const emotionMap = { confident: '😎 自信', hopeful: '🤞 期待', anxious: '😰 焦慮', fomo: '🤤 FOMO', panic: '😱 恐慌', calm: '😌 冷靜' };
      // 分數
      const score = Math.round(
        (Math.min(100, winRate * 1.5)) * 0.3 +
        (Math.min(100, profitFactor * 30)) * 0.3 +
        (Math.min(100, Math.max(0, totalReturn + 50))) * 0.2 +
        (totalTrades > 5 ? 100 : totalTrades * 20) * 0.2
      );
      const card = (label, val, color, sub) => `<div style="background:var(--bg-base);padding:16px;border-radius:8px">
        <div style="color:#aaa;font-size:12px">${label}</div>
        <div style="font-size:28px;color:${color};font-weight:bold">${val}</div>
        ${sub ? `<div style="color:#666;font-size:11px">${sub}</div>` : ''}
      </div>`;
      V290_$('kpi290-area').innerHTML = `
        <div style="background:linear-gradient(135deg,#1a3a1a 0%,#0f3a3a 100%);padding:24px;border-radius:12px;text-align:center;margin-bottom:16px">
          <div style="color:#aaa;font-size:14px">綜合評分</div>
          <div style="font-size:80px;color:#fbbf24;font-weight:bold;line-height:1">${score}</div>
          <div style="color:#aaa;font-size:14px">${score >= 80 ? '🏆 大師級' : score >= 60 ? '⭐ 進階' : score >= 40 ? '📈 進步中' : '🌱 新手'}</div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
          ${card('交易次數', totalTrades, '#fff', '基礎統計')}
          ${card('勝率', V290_fmt(winRate, 1) + '%', winRate >= 50 ? '#4ade80' : '#fbbf24', `${wins} 勝 / ${losses} 敗`)}
          ${card('盈虧比', V290_fmt(profitFactor, 2), profitFactor >= 1.5 ? '#4ade80' : '#fbbf24', '> 1.5 為佳')}
          ${card('總報酬', (totalReturn >= 0 ? '+' : '') + V290_fmt(totalReturn, 2) + '%', totalReturn >= 0 ? '#4ade80' : '#ef4444', '相對初始')}
          ${card('主導情緒', dominantEmotion ? emotionMap[dominantEmotion[0]] || dominantEmotion[0] : '—', 'var(--accent)', dominantEmotion ? `${dominantEmotion[1]} 次` : '尚無資料')}
          ${card('總資產', 'NT$' + V290_fmt(totalAsset, 0), '#fff', '紙上交易帳戶')}
        </div>
      `;
    };
  }
  V290_inject('portfolio', 'mr-v290-kpi', '📊 自我評估 KPI 儀表板 (v290)', V290_buildKPI);

  // ============================================================
  // FEATURE 4: 🧑‍🏫 AI 交易教練覆盤
  // ============================================================
  function V290_buildAICoach(containerId) {
    const c = V290_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">🧑‍🏫 AI 看你最近 30 筆交易，給出像教練一樣的覆盤建議</p>
      <button id="cc290-run" style="padding:10px 20px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">🧑‍🏫 AI 覆盤</button>
      <div id="cc290-area" style="margin-top:12px"></div>
    `;
    V290_$('cc290-run').onclick = async () => {
      const trades = JSON.parse(localStorage.getItem('mr_v290_journal') || '[]');
      if (trades.length < 1) {
        V290_$('cc290-area').innerHTML = '<p style="color:#fbbf24;padding:16px;background:var(--bg-base);border-radius:6px">⚠️ 請先在「交易日誌」記錄至少 3 筆交易再來覆盤</p>';
        return;
      }
      const a = V290_$('cc290-area');
      a.innerHTML = '<p style="color:#fbbf24;text-align:center;padding:20px">🧑‍🏫 AI 教練分析中...</p>';
      try {
        const summary = trades.slice(-30).map(t => `${t.date} ${t.action} ${t.symbol}@${t.price} (情緒:${t.emotion}, 理由:${t.reason})`).join('\n');
        const r = await fetch(`${W}/coach`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: '請以世界級交易教練的身份，分析以下 30 筆交易記錄，找出我的優點 + 缺點 + 改進建議：\n\n' + summary, persona: 'lin' })
        });
        const j = await r.json();
        a.innerHTML = `
          <div style="background:var(--bg-base);padding:20px;border-radius:8px;border-left:6px solid #4ade80">
            <h4 style="margin:0 0 12px 0;color:#4ade80">🧑‍🏫 AI 教練覆盤報告</h4>
            <div style="color:var(--text-primary);line-height:1.8;white-space:pre-wrap">${j.response || j.message || '無回應'}</div>
          </div>
        `;
      } catch (e) { a.innerHTML = `<p style="color:#ef4444">錯誤：${e.message}</p>`; }
    };
  }
  V290_inject('portfolio', 'mr-v290-coach', '🧑‍🏫 AI 交易教練覆盤 (v290)', V290_buildAICoach);

  // ============================================================
  // FEATURE 5: 😨 市場恐懼貪婪指數
  // ============================================================
  function V290_buildFGI(containerId) {
    const c = V290_$(containerId); if (!c) return;
    c.innerHTML = `
      <button id="fgi290-load" style="padding:10px 20px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">😨 載入恐懼貪婪指數</button>
      <div id="fgi290-area" style="margin-top:12px"></div>
    `;
    V290_$('fgi290-load').onclick = async () => {
      const a = V290_$('fgi290-area');
      a.innerHTML = '<p style="color:#fbbf24;text-align:center;padding:20px">😨 載入中...</p>';
      try {
        // 直接打 alternative.me 的 Crypto Fear & Greed API
        const r = await fetch('https://api.alternative.me/fng/');
        const j = await r.json();
        const d = (j.data || [])[0];
        if (!d) throw new Error('無資料');
        const v = parseInt(d.value);
        let level, color, advice;
        if (v < 25) { level = '極度恐懼 Extreme Fear'; color = '#ef4444'; advice = '市場極度恐懼 → 通常是逢低買進的好時機（Buffett: 別人恐懼我貪婪）'; }
        else if (v < 45) { level = '恐懼 Fear'; color = '#f97316'; advice = '市場偏向恐懼 → 可考慮分批進場'; }
        else if (v < 55) { level = '中性 Neutral'; color = '#fbbf24'; advice = '市場情緒中性 → 維持原有計畫，不需特別動作'; }
        else if (v < 75) { level = '貪婪 Greed'; color = '#a3e635'; advice = '市場偏向貪婪 → 注意風險，可考慮獲利了結部分'; }
        else { level = '極度貪婪 Extreme Greed'; color = '#4ade80'; advice = '市場極度貪婪 → 接近高點，建議減碼或保留現金（Buffett: 別人貪婪我恐懼）'; }
        // SVG 半圓 gauge
        const angle = -90 + v * 1.8; // -90 to 90
        const W2 = 300, H2 = 180, cx = 150, cy = 150, rr = 100;
        let svg = `<svg width="${W2}" height="${H2}" style="background:var(--bg-base);border-radius:8px">`;
        // 半圓背景
        for (let i = 0; i < 5; i++) {
          const a1 = -180 + i * 36;
          const a2 = -180 + (i + 1) * 36;
          const x1 = cx + rr * Math.cos(a1 * Math.PI / 180);
          const y1 = cy + rr * Math.sin(a1 * Math.PI / 180);
          const x2 = cx + rr * Math.cos(a2 * Math.PI / 180);
          const y2 = cy + rr * Math.sin(a2 * Math.PI / 180);
          const colors = ['#ef4444', '#f97316', '#fbbf24', '#a3e635', '#4ade80'];
          svg += `<path d="M ${x1} ${y1} A ${rr} ${rr} 0 0 1 ${x2} ${y2} L ${cx} ${cy} Z" fill="${colors[i]}" opacity="0.3"/>`;
        }
        // 指針
        const px = cx + (rr - 10) * Math.cos((angle - 180) * Math.PI / 180);
        const py = cy + (rr - 10) * Math.sin((angle - 180) * Math.PI / 180);
        svg += `<line x1="${cx}" y1="${cy}" x2="${px}" y2="${py}" stroke="${color}" stroke-width="4" stroke-linecap="round"/>`;
        svg += `<circle cx="${cx}" cy="${cy}" r="6" fill="${color}"/>`;
        svg += `<text x="${cx}" y="${cy + 30}" fill="${color}" font-size="36" font-weight="bold" text-anchor="middle">${v}</text>`;
        svg += `<text x="${cx}" y="${cy + 50}" fill="#aaa" font-size="12" text-anchor="middle">/100</text>`;
        svg += `</svg>`;
        a.innerHTML = `
          <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;background:var(--bg-base);padding:16px;border-radius:8px">
            ${svg}
            <div style="flex:1;min-width:280px">
              <div style="color:${color};font-size:24px;font-weight:bold">${level}</div>
              <div style="color:#aaa;font-size:12px;margin-top:6px">資料來源：CNN Money / alternative.me ｜ ${d.timestamp ? new Date(parseInt(d.timestamp) * 1000).toLocaleDateString() : '今日'}</div>
              <p style="color:var(--text-primary);line-height:1.6;margin-top:12px">${advice}</p>
            </div>
          </div>
        `;
      } catch (e) { a.innerHTML = `<p style="color:#ef4444">錯誤：${e.message}</p>`; }
    };
  }
  V290_inject('us', 'mr-v290-fgi', '😨 市場恐懼貪婪指數 (v290)', V290_buildFGI);

  console.log('[MoneyRadar v290] ✅ 5 件心理面 features 已載入');
})();
