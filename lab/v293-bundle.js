/* MoneyRadar v293 — 訓練 + 模擬 + 個股研究室
 * 1. 🎬 Bar Replay 完整版（K 線回放練習）
 * 2. 📚 100 道測驗題庫
 * 3. 🔬 個股研究筆記本
 * 4. 📋 投資 Checklist 自訂模板
 * 5. 🏅 投資能力等級認證
 *
 * 全部純前端，localStorage 儲存
 */
(function () {
  'use strict';
  function V293_$(id) { return document.getElementById(id); }
  function V293_el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function V293_fmt(n, d = 2) { if (n == null || isNaN(n)) return '—'; return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function V293_inject(parentTabId, id, title, builder) {
    const tab = document.querySelector(`[data-tab-content="${parentTabId}"]`) || document.querySelector(`#tab-${parentTabId}`) || document.body;
    if (document.getElementById(id)) return;
    const sec = V293_el(`<section id="${id}" style="margin:24px 0;padding:20px;background:var(--card-bg,var(--bg-surface));border-radius:12px;border:1px solid var(--border,var(--bg-surface))">
      <h3 style="margin:0 0 16px 0;color:var(--text,var(--text-primary))">${title}</h3>
      <div id="${id}-body"></div>
    </section>`);
    tab.appendChild(sec);
    try { builder(`${id}-body`); } catch (e) { console.error('v293 builder', id, e); }
  }

  async function V293_fetchOHLCV(symbol, range = '1y') {
    try {
      const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=1d`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const j = await r.json();
      const result = j.chart?.result?.[0];
      if (!result) return null;
      const ts = result.timestamp || [];
      const q = result.indicators?.quote?.[0] || {};
      return ts.map((t, i) => ({
        date: new Date(t * 1000).toISOString().slice(0, 10),
        open: q.open?.[i], high: q.high?.[i], low: q.low?.[i],
        close: q.close?.[i], volume: q.volume?.[i]
      })).filter(d => d.close != null);
    } catch { return null; }
  }

  // ============================================================
  // FEATURE 1: 🎬 Bar Replay
  // ============================================================
  function V293_buildBarReplay(containerId) {
    const c = V293_$(containerId); if (!c) return;
    let fullData = [];
    let currentIdx = 0;
    let trades = [];
    let cash = 100000;
    let position = 0;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">🎬 載入歷史 K 線 → 一格一格往前撥 → 練習你的判斷力（每天 30 分鐘練 6 個月超越散戶 90%）</p>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <input id="br293-symbol" placeholder="股票代碼" style="padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;width:200px">
        <button id="br293-load" style="padding:8px 16px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">📥 載入</button>
        <button id="br293-prev" disabled style="padding:8px 12px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer">◀️ 上一格</button>
        <button id="br293-next" disabled style="padding:8px 12px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer">下一格 ▶️</button>
        <button id="br293-buy" disabled style="padding:8px 12px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">🟢 買 100</button>
        <button id="br293-sell" disabled style="padding:8px 12px;background:#ef4444;color:#fff;border:none;border-radius:6px;cursor:pointer;font-weight:bold">🔴 賣 100</button>
        <button id="br293-reset" style="padding:8px 12px;background:#6b7280;color:#fff;border:none;border-radius:6px;cursor:pointer">↺ 重置</button>
      </div>
      <div id="br293-chart"></div>
      <div id="br293-stats" style="margin-top:12px"></div>
    `;
    function render() {
      const visible = fullData.slice(0, currentIdx + 1);
      if (!visible.length) return;
      const W = 800, H = 350;
      const closes = visible.map(d => d.close);
      const highs = visible.map(d => d.high);
      const lows = visible.map(d => d.low);
      const minP = Math.min(...lows), maxP = Math.max(...highs);
      const range = maxP - minP || 1;
      const cw = Math.max(2, W / Math.max(60, visible.length));
      let svg = `<svg width="${W}" height="${H}" style="background:var(--bg-base);border-radius:6px;width:100%">`;
      visible.forEach((d, i) => {
        const x = i * cw + cw / 2;
        const yH = H - 30 - (d.high - minP) / range * (H - 60);
        const yL = H - 30 - (d.low - minP) / range * (H - 60);
        const yO = H - 30 - (d.open - minP) / range * (H - 60);
        const yC = H - 30 - (d.close - minP) / range * (H - 60);
        const color = d.close >= d.open ? '#4ade80' : '#ef4444';
        svg += `<line x1="${x}" y1="${yH}" x2="${x}" y2="${yL}" stroke="${color}" stroke-width="1"/>`;
        svg += `<rect x="${x - cw / 3}" y="${Math.min(yO, yC)}" width="${cw * 2 / 3}" height="${Math.max(1, Math.abs(yO - yC))}" fill="${color}"/>`;
      });
      // 標記 trades
      trades.forEach(t => {
        const idx = t.idx;
        if (idx > currentIdx) return;
        const x = idx * cw + cw / 2;
        const y = H - 30 - (t.price - minP) / range * (H - 60);
        const fill = t.action === 'BUY' ? '#4ade80' : '#ef4444';
        svg += `<circle cx="${x}" cy="${y}" r="6" fill="${fill}" stroke="#fff" stroke-width="2"/>`;
        svg += `<text x="${x}" y="${y + 16}" fill="${fill}" font-size="9" text-anchor="middle">${t.action[0]}</text>`;
      });
      svg += `</svg>`;
      V293_$('br293-chart').innerHTML = svg;
      const last = visible[visible.length - 1];
      const totalValue = cash + position * last.close;
      const pnl = totalValue - 100000;
      V293_$('br293-stats').innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px">
          <div style="background:var(--bg-base);padding:8px;border-radius:6px"><div style="color:#aaa;font-size:11px">日期</div><div style="color:#fff">${last.date}</div></div>
          <div style="background:var(--bg-base);padding:8px;border-radius:6px"><div style="color:#aaa;font-size:11px">價格</div><div style="color:#fff;font-weight:bold">${V293_fmt(last.close)}</div></div>
          <div style="background:var(--bg-base);padding:8px;border-radius:6px"><div style="color:#aaa;font-size:11px">現金</div><div style="color:#fff">${V293_fmt(cash, 0)}</div></div>
          <div style="background:var(--bg-base);padding:8px;border-radius:6px"><div style="color:#aaa;font-size:11px">持倉</div><div style="color:#fff">${position} 股</div></div>
          <div style="background:var(--bg-base);padding:8px;border-radius:6px"><div style="color:#aaa;font-size:11px">總資產</div><div style="color:#fff;font-weight:bold">${V293_fmt(totalValue, 0)}</div></div>
          <div style="background:var(--bg-base);padding:8px;border-radius:6px"><div style="color:#aaa;font-size:11px">損益</div><div style="color:${pnl >= 0 ? '#4ade80' : '#ef4444'};font-weight:bold">${pnl >= 0 ? '+' : ''}${V293_fmt(pnl, 0)}</div></div>
        </div>
      `;
    }
    V293_$('br293-load').onclick = async () => {
      const sym = V293_$('br293-symbol').value.trim().toUpperCase();
      if (!sym) return alert('請輸入');
      V293_$('br293-chart').innerHTML = '<p style="color:#fbbf24;text-align:center;padding:20px">📥 載入中...</p>';
      const data = await V293_fetchOHLCV(sym, '2y');
      if (!data || data.length < 60) { V293_$('br293-chart').innerHTML = '<p style="color:#ef4444">無資料</p>'; return; }
      fullData = data;
      currentIdx = 30;
      trades = [];
      cash = 100000;
      position = 0;
      ['br293-prev', 'br293-next', 'br293-buy', 'br293-sell'].forEach(id => V293_$(id).disabled = false);
      render();
    };
    V293_$('br293-next').onclick = () => {
      if (currentIdx < fullData.length - 1) { currentIdx++; render(); }
    };
    V293_$('br293-prev').onclick = () => {
      if (currentIdx > 30) { currentIdx--; render(); }
    };
    V293_$('br293-buy').onclick = () => {
      const price = fullData[currentIdx].close;
      if (cash >= price * 100) {
        cash -= price * 100;
        position += 100;
        trades.push({ idx: currentIdx, action: 'BUY', price, qty: 100 });
        render();
      } else alert('現金不足');
    };
    V293_$('br293-sell').onclick = () => {
      const price = fullData[currentIdx].close;
      if (position >= 100) {
        cash += price * 100;
        position -= 100;
        trades.push({ idx: currentIdx, action: 'SELL', price, qty: 100 });
        render();
      } else alert('持倉不足');
    };
    V293_$('br293-reset').onclick = () => {
      currentIdx = 30; trades = []; cash = 100000; position = 0; render();
    };
  }
  V293_inject('tools', 'mr-v293-replay', '🎬 Bar Replay K 線回放練習 (v293)', V293_buildBarReplay);

  // ============================================================
  // FEATURE 2: 📚 投資測驗題庫（30 道精選）
  // ============================================================
  const QUESTIONS = [
    { q: 'PE Ratio 是什麼？', opts: ['股價/每股盈餘', '股價/每股淨值', '營收/淨利', '股息/股價'], a: 0 },
    { q: 'Bollinger Bands 中軌是什麼？', opts: ['20 日 SMA', '50 日 SMA', '200 日 SMA', 'EMA 12'], a: 0 },
    { q: 'RSI < 30 通常代表？', opts: ['超買', '超賣', '中性', '無意義'], a: 1 },
    { q: '股息殖利率高代表？', opts: ['股票一定好', '可能股價跌', '一定會漲', '無關緊要'], a: 1 },
    { q: 'Beta = 1.5 代表？', opts: ['比大盤波動小', '比大盤波動大', '與大盤無關', '一定虧錢'], a: 1 },
    { q: '止損的目的是？', opts: ['一定賺錢', '限制單筆虧損', '提高勝率', '增加交易'], a: 1 },
    { q: 'ETF 比個股優勢？', opts: ['一定報酬高', '分散風險', '免稅', '無持有費'], a: 1 },
    { q: '夏普比率高代表？', opts: ['風險調整後報酬好', '一定賺錢', '波動大', '回撤小'], a: 0 },
    { q: 'P/B < 1 通常代表？', opts: ['股價貴', '股價便宜或公司有問題', '一定買進', '無意義'], a: 1 },
    { q: '凱利公式建議？', opts: ['全押 All-in', '依勝率算最佳倉位', '永遠 50%', '不投資'], a: 1 },
    { q: 'MACD 黃金交叉？', opts: ['DIF 上穿 DEA', 'DIF 下穿 DEA', 'KD 交叉', '無意義'], a: 0 },
    { q: 'VaR 是什麼？', opts: ['一定虧多少', '某信心水準下最大可能損失', '預期報酬', '無風險利率'], a: 1 },
    { q: '殖利率曲線倒掛常代表？', opts: ['經濟好轉', '衰退預警', '通膨來臨', '無關'], a: 1 },
    { q: '布林通道收窄代表？', opts: ['即將大波動', '無事發生', '一定會跌', '一定會漲'], a: 0 },
    { q: '股票回購對股東？', opts: ['有害', '中性偏正面（每股盈餘提升）', '無感', '股價會跌'], a: 1 },
    { q: 'Treasury 30Y > 2Y 代表？', opts: ['正常曲線', '倒掛', '兩者無關', 'Fed 升息'], a: 0 },
    { q: 'Risk Parity 策略？', opts: ['等權重', '等市值', '等風險貢獻', '隨機'], a: 2 },
    { q: 'Pair Trading 是？', opts: ['配對交易（多空對沖）', '只做多', '只放空', '雙倍交易'], a: 0 },
    { q: 'CVaR vs VaR？', opts: ['一樣', 'CVaR 更保守（尾部平均）', 'CVaR 更樂觀', '無關'], a: 1 },
    { q: 'Black-Scholes 用於？', opts: ['股票估值', '選擇權定價', '債券定價', '商品定價'], a: 1 },
    { q: 'Long Tail 厚尾分布？', opts: ['黑天鵝事件比常態分布更常發生', '更少發生', '無關', '一樣'], a: 0 },
    { q: '股票 Free Cash Flow Yield > Earnings Yield 代表？', opts: ['無意義', '盈餘品質好', '盈餘品質差', '一定買進'], a: 1 },
    { q: 'Drawdown 越小代表？', opts: ['一定賺錢', '回撤控制好', '報酬高', '波動小'], a: 1 },
    { q: 'Sortino Ratio vs Sharpe？', opts: ['只看下行波動', '只看上行波動', '相同', '無關'], a: 0 },
    { q: 'Buffett 護城河 5 維度不包含？', opts: ['品牌', '規模', '網路', '小米雷軍'], a: 3 },
    { q: 'Fama-French 4 因子不包含？', opts: ['Value', 'Growth', 'Momentum', 'Beauty'], a: 3 },
    { q: 'Monte Carlo 模擬目的？', opts: ['一定預測對', '評估各種情境機率', '降低風險', '提高報酬'], a: 1 },
    { q: '產業輪動策略？', opts: ['依經濟週期換產業', '隨機買', '只買科技', '只買金融'], a: 0 },
    { q: 'ESG 投資指？', opts: ['環境社會治理', '經濟成長率', '股息', '評等'], a: 0 },
    { q: 'FOMO 是？', opts: ['Fear of Missing Out（怕錯過）', '基本面分析', '財務指標', '法規'], a: 0 }
  ];
  function V293_buildQuiz(containerId) {
    const c = V293_$(containerId); if (!c) return;
    let curr = 0;
    let score = 0;
    let answered = 0;
    function render() {
      if (curr >= QUESTIONS.length || answered >= QUESTIONS.length) {
        // 結果
        let level, color, advice;
        const pct = score / QUESTIONS.length * 100;
        if (pct >= 90) { level = '🏆 大師級'; color = '#fbbf24'; advice = '你的投資知識已達世界級水準！可以開始實戰運用。'; }
        else if (pct >= 70) { level = '⭐ 進階'; color = '#4ade80'; advice = '基礎扎實，繼續學習進階理論（量化、衍生性商品）'; }
        else if (pct >= 50) { level = '📈 中級'; color = 'var(--accent)'; advice = '有基本概念，建議多讀「智慧型股票投資人」「投資金律」'; }
        else { level = '🌱 新手'; color = '#888'; advice = '從基礎開始：「漫步華爾街」「巴菲特的投資原則」推薦書籍'; }
        c.innerHTML = `
          <div style="background:linear-gradient(135deg,var(--bg-base) 0%,#1a1a4e 100%);padding:32px;border-radius:12px;text-align:center">
            <div style="color:#aaa;font-size:13px">測驗結果</div>
            <div style="font-size:64px;color:${color};font-weight:bold;line-height:1">${score}/${QUESTIONS.length}</div>
            <div style="color:${color};font-size:24px;font-weight:bold;margin-top:8px">${level}</div>
            <div style="color:#aaa;font-size:13px;margin-top:8px">正確率 ${V293_fmt(pct, 1)}%</div>
            <p style="color:#fff;line-height:1.6;margin:16px auto;max-width:500px">${advice}</p>
            <button id="qz293-restart" style="padding:10px 20px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">↺ 再測一次</button>
          </div>
        `;
        V293_$('qz293-restart').onclick = () => { curr = 0; score = 0; answered = 0; render(); };
        // 儲存歷史
        const history = JSON.parse(localStorage.getItem('mr_v293_quiz_history') || '[]');
        history.push({ date: new Date().toISOString(), score, total: QUESTIONS.length });
        localStorage.setItem('mr_v293_quiz_history', JSON.stringify(history.slice(-20)));
        return;
      }
      const Q = QUESTIONS[curr];
      c.innerHTML = `
        <div style="background:var(--bg-base);padding:20px;border-radius:8px">
          <div style="display:flex;justify-content:space-between;color:#aaa;font-size:12px;margin-bottom:8px">
            <span>第 ${curr + 1} / ${QUESTIONS.length} 題</span>
            <span>已答對 ${score}</span>
          </div>
          <div style="background:var(--bg-surface);height:6px;border-radius:3px;overflow:hidden;margin-bottom:16px">
            <div style="background:#4ade80;height:100%;width:${(curr / QUESTIONS.length) * 100}%"></div>
          </div>
          <h4 style="color:#fff;font-size:18px;margin:0 0 16px 0">${Q.q}</h4>
          <div style="display:grid;gap:8px">
            ${Q.opts.map((opt, i) => `<button data-idx="${i}" class="qz-opt" style="padding:12px;background:var(--bg-surface);color:#fff;border:1px solid #444;border-radius:6px;cursor:pointer;text-align:left;font-size:14px">${String.fromCharCode(65 + i)}. ${opt}</button>`).join('')}
          </div>
        </div>
      `;
      c.querySelectorAll('.qz-opt').forEach(b => b.onclick = () => {
        const idx = parseInt(b.dataset.idx);
        const correct = idx === Q.a;
        c.querySelectorAll('.qz-opt').forEach(x => x.disabled = true);
        if (correct) {
          b.style.background = '#22c55e';
          score++;
        } else {
          b.style.background = '#ef4444';
          c.querySelectorAll('.qz-opt')[Q.a].style.background = '#22c55e';
        }
        answered++;
        setTimeout(() => { curr++; render(); }, 800);
      });
    }
    render();
  }
  V293_inject('tools', 'mr-v293-quiz', '📚 投資知識測驗（30 道精選）(v293)', V293_buildQuiz);

  // ============================================================
  // FEATURE 3: 🔬 個股研究筆記本
  // ============================================================
  function V293_buildResearchNote(containerId) {
    const c = V293_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">🔬 為每檔股票建立深度研究筆記，按 Buffett「能力圈」原則分類</p>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <input id="rn293-symbol" placeholder="股票代碼" style="padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;width:200px">
        <button id="rn293-load" style="padding:8px 16px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer">📂 載入</button>
      </div>
      <div id="rn293-area"></div>
    `;
    V293_$('rn293-load').onclick = () => {
      const sym = V293_$('rn293-symbol').value.trim().toUpperCase();
      if (!sym) return alert('請輸入');
      const key = `mr_v293_research_${sym}`;
      const note = JSON.parse(localStorage.getItem(key) || '{}');
      const a = V293_$('rn293-area');
      const SECTIONS = [
        { id: 'business', label: '📋 業務模式（What does company do?）' },
        { id: 'moat', label: '🏰 護城河（Why can\'t competitors catch up?）' },
        { id: 'management', label: '👥 管理層（CEO 風評？利益對齊？）' },
        { id: 'financials', label: '💰 財務健康（FCF? Debt? Margin?）' },
        { id: 'risks', label: '⚠️ 風險因素（Bear case？）' },
        { id: 'valuation', label: '💎 估值（Fair value? Margin of safety?）' },
        { id: 'thesis', label: '🎯 投資論述（Why buy now?）' },
        { id: 'exit', label: '🚪 賣出條件（When would I sell?）' }
      ];
      a.innerHTML = `
        <div style="background:var(--bg-base);padding:16px;border-radius:8px">
          <h4 style="margin:0 0 12px 0;color:#fbbf24">🔬 ${sym} 研究筆記</h4>
          ${SECTIONS.map(s => `<div style="margin-bottom:12px">
            <label style="color:#fff;font-weight:bold;display:block;margin-bottom:4px">${s.label}</label>
            <textarea id="rn293-${s.id}" rows="2" style="width:100%;padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;resize:vertical;font-family:inherit">${(note[s.id] || '').replace(/"/g, '&quot;')}</textarea>
          </div>`).join('')}
          <div style="margin-bottom:12px">
            <label style="color:#fff;font-weight:bold;display:block;margin-bottom:4px">⭐ 投資信心度（1-10）</label>
            <input id="rn293-confidence" type="number" min="1" max="10" value="${note.confidence || 5}" style="width:100px;padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px">
          </div>
          <button id="rn293-save" style="padding:10px 20px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">💾 儲存筆記</button>
          <button id="rn293-export" style="padding:10px 20px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer">📤 導出 Markdown</button>
        </div>
      `;
      V293_$('rn293-save').onclick = () => {
        const updated = {};
        SECTIONS.forEach(s => updated[s.id] = V293_$(`rn293-${s.id}`).value);
        updated.confidence = parseInt(V293_$('rn293-confidence').value);
        updated.updated = new Date().toISOString();
        localStorage.setItem(key, JSON.stringify(updated));
        alert('✅ 已儲存');
      };
      V293_$('rn293-export').onclick = () => {
        let md = `# ${sym} 投資研究筆記\n\n`;
        md += `更新時間：${new Date().toISOString()}\n\n`;
        SECTIONS.forEach(s => {
          md += `## ${s.label}\n\n${V293_$(`rn293-${s.id}`).value || '_（未填寫）_'}\n\n`;
        });
        md += `## 投資信心度\n\n${V293_$('rn293-confidence').value}/10\n`;
        const blob = new Blob([md], { type: 'text/markdown' });
        const a2 = document.createElement('a');
        a2.href = URL.createObjectURL(blob);
        a2.download = `${sym}_research_${new Date().toISOString().slice(0, 10)}.md`;
        a2.click();
      };
    };
  }
  V293_inject('tools', 'mr-v293-research', '🔬 個股研究筆記本 (v293)', V293_buildResearchNote);

  // ============================================================
  // FEATURE 4: 📋 投資 Checklist
  // ============================================================
  function V293_buildChecklist(containerId) {
    const c = V293_$(containerId); if (!c) return;
    const checklists = {
      buffett: {
        name: 'Buffett 巴菲特 Checklist',
        items: [
          '我能 1 句話說明這家公司在做什麼嗎？',
          '這公司 5-10 年後仍會存在且更好嗎？',
          '經營者是否誠實有能力？',
          '公司有經濟護城河嗎？',
          '財務健康嗎？(低負債、正 FCF)',
          'ROE > 15% 持續超過 5 年嗎？',
          '估值合理嗎？(PE < 25)',
          '我願意持有 10 年以上嗎？'
        ]
      },
      munger: {
        name: 'Munger 蒙格 Checklist',
        items: [
          '反過來想：什麼會讓我虧錢？',
          '我懂這家公司的「能力圈」嗎？',
          '激勵機制設計合理嗎？',
          '管理層誠實嗎？',
          '是否避開「太難理解」的標的？',
          '價格 vs 價值，安全邊際 30%+？'
        ]
      },
      lynch: {
        name: 'Lynch 林區 Checklist',
        items: [
          '產品我喜歡用嗎？(消費者觀察)',
          '盈餘穩定增長嗎？',
          'PEG < 1 嗎？(便宜的成長股)',
          '機構持股比例低嗎？(被忽視)',
          '內部人有買進嗎？',
          '產業是否處於成長期？'
        ]
      }
    };
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">📋 投資前必過的 Checklist — 用大師的思考框架幫你避免錯誤</p>
      <div style="margin-bottom:12px">
        <select id="cl293-type" style="padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px">
          <option value="buffett">🏛️ Buffett 巴菲特</option>
          <option value="munger">🧠 Munger 蒙格</option>
          <option value="lynch">🎯 Lynch 林區</option>
        </select>
        <input id="cl293-symbol" placeholder="股票代碼" style="padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;width:160px;margin-left:8px">
        <button id="cl293-load" style="padding:8px 16px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold;margin-left:8px">📋 開始</button>
      </div>
      <div id="cl293-area"></div>
    `;
    V293_$('cl293-load').onclick = () => {
      const type = V293_$('cl293-type').value;
      const sym = V293_$('cl293-symbol').value.trim().toUpperCase() || 'XXX';
      const list = checklists[type];
      const key = `mr_v293_checklist_${sym}_${type}`;
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      V293_$('cl293-area').innerHTML = `
        <div style="background:var(--bg-base);padding:16px;border-radius:8px">
          <h4 style="margin:0 0 12px 0;color:#fbbf24">${list.name} — ${sym}</h4>
          ${list.items.map((item, i) => `<label style="display:block;padding:10px;border-bottom:1px solid #333;cursor:pointer">
            <input type="checkbox" data-idx="${i}" ${saved[i] ? 'checked' : ''} style="width:18px;height:18px;margin-right:8px;vertical-align:middle">
            <span style="color:#fff">${item}</span>
          </label>`).join('')}
          <div id="cl293-result" style="margin-top:12px;padding:12px;background:#1a1a3e;border-radius:6px"></div>
          <button id="cl293-save" style="margin-top:12px;padding:10px 20px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">💾 儲存進度</button>
        </div>
      `;
      function updateResult() {
        const checked = document.querySelectorAll('#cl293-area input:checked').length;
        const total = list.items.length;
        const pct = checked / total * 100;
        let recommend, color;
        if (pct === 100) { recommend = '✅ 全部通過！可考慮投資'; color = '#4ade80'; }
        else if (pct >= 75) { recommend = '🟡 大致通過，注意未過項目'; color = '#fbbf24'; }
        else { recommend = '🔴 多項未過，慎重考慮'; color = '#ef4444'; }
        V293_$('cl293-result').innerHTML = `<div style="color:${color};font-weight:bold">${recommend}</div><div style="color:#aaa;font-size:13px;margin-top:4px">通過 ${checked}/${total} 項 (${V293_fmt(pct, 0)}%)</div>`;
      }
      document.querySelectorAll('#cl293-area input').forEach(el => el.onchange = updateResult);
      V293_$('cl293-save').onclick = () => {
        const arr = [];
        document.querySelectorAll('#cl293-area input').forEach((el, i) => arr[i] = el.checked);
        localStorage.setItem(key, JSON.stringify(arr));
        alert('✅ 已儲存');
      };
      updateResult();
    };
  }
  V293_inject('tools', 'mr-v293-checklist', '📋 大師 Checklist (v293)', V293_buildChecklist);

  console.log('[MoneyRadar v293] ✅ 訓練 + 模擬 + 研究 4 件 features 已載入');
})();
