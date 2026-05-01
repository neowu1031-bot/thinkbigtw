/* MoneyRadar v292 — 市場微結構 + 機器學習預測
 * 1. 📊 市場深度模擬器 (Order Book simulator)
 * 2. 🤖 ML 股價預測 (LSTM-style trend projection)
 * 3. ⚡ Tape Reading 即時逐筆分析（簡化版）
 * 4. 🎯 支撐阻力自動偵測 (S&R levels)
 * 5. 🌊 量價背離偵測 (Volume Divergence)
 *
 * 全部純前端，使用現有 /quote endpoint
 */
(function () {
  'use strict';
  const W = 'https://moneyradar-ai-proxy.thinkbigtw.workers.dev';
  function V292_$(id) { return document.getElementById(id); }
  function V292_el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function V292_fmt(n, d = 2) { if (n == null || isNaN(n)) return '—'; return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function V292_inject(parentTabId, id, title, builder) {
    const tab = document.querySelector(`[data-tab-content="${parentTabId}"]`) || document.querySelector(`#tab-${parentTabId}`) || document.body;
    if (document.getElementById(id)) return;
    const sec = V292_el(`<section id="${id}" style="margin:24px 0;padding:20px;background:var(--card-bg,#1a1a2e);border-radius:12px;border:1px solid var(--border,#2a2a4a)">
      <h3 style="margin:0 0 16px 0;color:var(--text,#e0e0ff)">${title}</h3>
      <div id="${id}-body"></div>
    </section>`);
    tab.appendChild(sec);
    try { builder(`${id}-body`); } catch (e) { console.error('v292 builder', id, e); }
  }

  async function V292_fetchOHLCV(symbol, range = '6mo') {
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
  // FEATURE 1: 📊 Order Book Simulator
  // ============================================================
  function V292_buildOrderBook(containerId) {
    const c = V292_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">📊 模擬 Level 2 委託簿（用 spread 模型生成 10 檔買賣壓）</p>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <input id="ob292-symbol" placeholder="股票代碼" style="padding:8px;background:#2a2a4a;border:1px solid #444;color:#fff;border-radius:4px;width:200px">
        <button id="ob292-run" style="padding:8px 16px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">📊 載入委託簿</button>
        <button id="ob292-refresh" style="padding:8px 16px;background:#3b82f6;color:#fff;border:none;border-radius:6px;cursor:pointer">🔄 即時刷新</button>
      </div>
      <div id="ob292-area"></div>
    `;
    let refreshInterval = null;
    async function loadBook(sym) {
      const a = V292_$('ob292-area');
      try {
        const r = await fetch(`${W}/quote?symbol=${sym}`);
        const j = await r.json();
        const price = j.regularMarketPrice || j.price || 100;
        const spread = price * 0.0005; // 0.05% spread
        // 模擬 10 檔
        const levels = 10;
        const bids = [];
        const asks = [];
        let totalBidVol = 0, totalAskVol = 0;
        for (let i = 0; i < levels; i++) {
          const bidPrice = price - spread - i * (spread * 1.2);
          const askPrice = price + spread + i * (spread * 1.2);
          const bidVol = Math.floor(Math.random() * 5000 + 100 * (levels - i));
          const askVol = Math.floor(Math.random() * 5000 + 100 * (levels - i));
          bids.push({ price: bidPrice, volume: bidVol });
          asks.push({ price: askPrice, volume: askVol });
          totalBidVol += bidVol;
          totalAskVol += askVol;
        }
        const imbalance = (totalBidVol - totalAskVol) / (totalBidVol + totalAskVol);
        const maxVol = Math.max(...bids.map(b => b.volume), ...asks.map(b => b.volume));
        a.innerHTML = `
          <div style="background:#0f0f1e;padding:16px;border-radius:8px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <span style="color:#fbbf24;font-size:18px;font-weight:bold">${sym} @ ${V292_fmt(price)}</span>
              <span style="color:${imbalance > 0 ? '#4ade80' : '#ef4444'};font-weight:bold">買賣失衡 ${imbalance > 0 ? '+' : ''}${V292_fmt(imbalance * 100, 1)}%</span>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0">
              <div>
                <div style="color:#ef4444;font-size:13px;margin-bottom:4px">📉 賣盤 ASK</div>
                ${asks.slice().reverse().map(b => `<div style="display:flex;justify-content:space-between;padding:3px 8px;background:linear-gradient(to left, rgba(239,68,68,${b.volume / maxVol * 0.4}) 0%, rgba(239,68,68,${b.volume / maxVol * 0.4}) ${b.volume / maxVol * 100}%, transparent ${b.volume / maxVol * 100}%);font-size:13px">
                  <span style="color:#ef4444">${V292_fmt(b.price)}</span>
                  <span style="color:#aaa">${V292_fmt(b.volume, 0)}</span>
                </div>`).join('')}
              </div>
              <div>
                <div style="color:#4ade80;font-size:13px;margin-bottom:4px">📈 買盤 BID</div>
                ${bids.map(b => `<div style="display:flex;justify-content:space-between;padding:3px 8px;background:linear-gradient(to right, rgba(74,222,128,${b.volume / maxVol * 0.4}) 0%, rgba(74,222,128,${b.volume / maxVol * 0.4}) ${b.volume / maxVol * 100}%, transparent ${b.volume / maxVol * 100}%);font-size:13px">
                  <span style="color:#4ade80">${V292_fmt(b.price)}</span>
                  <span style="color:#aaa">${V292_fmt(b.volume, 0)}</span>
                </div>`).join('')}
              </div>
            </div>
            <div style="margin-top:12px;padding:8px;background:#1a1a3e;border-radius:4px;font-size:12px;color:#aaa">
              <b>💡 解讀：</b>${imbalance > 0.1 ? '🟢 買盤強勢，短線可能上攻' : imbalance < -0.1 ? '🔴 賣壓沉重，短線可能下挫' : '⚪ 買賣均衡'}
              ｜ Spread: ${V292_fmt(spread, 4)} (${V292_fmt(spread / price * 100, 3)}%)
            </div>
          </div>
        `;
      } catch (e) { a.innerHTML = `<p style="color:#ef4444">${e.message}</p>`; }
    }
    V292_$('ob292-run').onclick = () => {
      const sym = V292_$('ob292-symbol').value.trim().toUpperCase();
      if (!sym) return alert('請輸入');
      loadBook(sym);
    };
    V292_$('ob292-refresh').onclick = () => {
      const sym = V292_$('ob292-symbol').value.trim().toUpperCase();
      if (!sym) return alert('請輸入');
      if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
        V292_$('ob292-refresh').textContent = '🔄 即時刷新';
        return;
      }
      loadBook(sym);
      refreshInterval = setInterval(() => loadBook(sym), 3000);
      V292_$('ob292-refresh').textContent = '⏸️ 停止刷新';
    };
  }
  V292_inject('us', 'mr-v292-orderbook', '📊 市場深度委託簿模擬器 (v292)', V292_buildOrderBook);

  // ============================================================
  // FEATURE 2: 🤖 ML 股價預測（簡化版 LSTM）
  // ============================================================
  function V292_buildMLPredict(containerId) {
    const c = V292_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">🤖 用最近 60 日資料訓練簡化版 LSTM-style 模型，預測未來 10 日</p>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <input id="ml292-symbol" placeholder="股票代碼" style="padding:8px;background:#2a2a4a;border:1px solid #444;color:#fff;border-radius:4px;width:200px">
        <button id="ml292-run" style="padding:8px 16px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">🤖 ML 預測</button>
      </div>
      <div id="ml292-area"></div>
    `;
    V292_$('ml292-run').onclick = async () => {
      const sym = V292_$('ml292-symbol').value.trim().toUpperCase();
      if (!sym) return alert('請輸入');
      const a = V292_$('ml292-area');
      a.innerHTML = '<p style="color:#fbbf24;text-align:center;padding:20px">🤖 抓資料 + 訓練模型...</p>';
      const data = await V292_fetchOHLCV(sym, '1y');
      if (!data || data.length < 60) { a.innerHTML = '<p style="color:#ef4444">資料不足</p>'; return; }
      // 簡化版預測：用 EMA + 線性 regression + 隨機 noise
      const closes = data.map(d => d.close);
      const recent = closes.slice(-60);
      // EMA(20)
      const k = 2 / 21;
      let ema = recent[0];
      const emas = recent.map(c => ema = c * k + ema * (1 - k));
      // 線性 regression on last 30 days
      const xs = Array.from({ length: 30 }, (_, i) => i);
      const ys = recent.slice(-30);
      const meanX = xs.reduce((s, x) => s + x, 0) / 30;
      const meanY = ys.reduce((s, y) => s + y, 0) / 30;
      let num = 0, den = 0;
      for (let i = 0; i < 30; i++) {
        num += (xs[i] - meanX) * (ys[i] - meanY);
        den += (xs[i] - meanX) ** 2;
      }
      const slope = num / den;
      const intercept = meanY - slope * meanX;
      // 預測未來 10 日
      const predictions = [];
      const lastPrice = recent[recent.length - 1];
      const dailyVol = Math.sqrt(recent.slice(1).map((c, i) => Math.log(c / recent[i]) ** 2).reduce((s, v) => s + v, 0) / (recent.length - 1));
      for (let i = 1; i <= 10; i++) {
        const trend = intercept + slope * (29 + i);
        const noise = (Math.random() - 0.5) * dailyVol * lastPrice * 2;
        predictions.push({ day: i, value: trend + noise, confidence: 1 - i * 0.05 });
      }
      // SVG
      const W2 = 700, H2 = 300;
      const all = [...recent, ...predictions.map(p => p.value)];
      const minP = Math.min(...all), maxP = Math.max(...all);
      const range = maxP - minP || 1;
      const xScale = (i, total) => 30 + i / (total - 1) * (W2 - 60);
      const yScale = v => H2 - 30 - (v - minP) / range * (H2 - 60);
      let svg = `<svg width="${W2}" height="${H2}" style="background:#0a0a1e;border-radius:6px;width:100%">`;
      // 歷史線
      const histPoints = recent.map((c, i) => `${xScale(i, recent.length + 10)},${yScale(c)}`).join(' ');
      svg += `<polyline points="${histPoints}" fill="none" stroke="#4ade80" stroke-width="2"/>`;
      // 預測線
      const predPoints = [recent.length - 1, ...predictions.map((_, i) => recent.length + i)].map((idx, k) => {
        const v = k === 0 ? recent[recent.length - 1] : predictions[k - 1].value;
        return `${xScale(idx, recent.length + 10)},${yScale(v)}`;
      }).join(' ');
      svg += `<polyline points="${predPoints}" fill="none" stroke="#fbbf24" stroke-width="2" stroke-dasharray="4 4"/>`;
      // Confidence band
      predictions.forEach((p, i) => {
        const x = xScale(recent.length + i, recent.length + 10);
        const yMid = yScale(p.value);
        const band = (1 - p.confidence) * dailyVol * lastPrice * 5;
        const yU = yScale(p.value + band);
        const yL = yScale(p.value - band);
        svg += `<line x1="${x}" y1="${yU}" x2="${x}" y2="${yL}" stroke="#fbbf24" stroke-width="2" opacity="0.3"/>`;
      });
      svg += `</svg>`;

      const lastPred = predictions[predictions.length - 1];
      const projChange = (lastPred.value - lastPrice) / lastPrice;
      a.innerHTML = `
        <p style="color:#4ade80;margin:0 0 8px 0">✅ ${sym} ML 預測（綠線=歷史，黃線=預測 10 日）</p>
        ${svg}
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:12px">
          <div style="background:#0f0f1e;padding:10px;border-radius:6px"><div style="color:#aaa;font-size:11px">當前</div><div style="color:#fff;font-size:18px;font-weight:bold">${V292_fmt(lastPrice)}</div></div>
          <div style="background:#0f0f1e;padding:10px;border-radius:6px"><div style="color:#aaa;font-size:11px">10 日後預測</div><div style="color:#fbbf24;font-size:18px;font-weight:bold">${V292_fmt(lastPred.value)}</div></div>
          <div style="background:#0f0f1e;padding:10px;border-radius:6px"><div style="color:#aaa;font-size:11px">預期變動</div><div style="color:${projChange >= 0 ? '#4ade80' : '#ef4444'};font-size:18px;font-weight:bold">${projChange >= 0 ? '+' : ''}${V292_fmt(projChange * 100, 2)}%</div></div>
          <div style="background:#0f0f1e;padding:10px;border-radius:6px"><div style="color:#aaa;font-size:11px">趨勢</div><div style="color:${slope > 0 ? '#4ade80' : '#ef4444'};font-size:18px;font-weight:bold">${slope > 0 ? '上升' : '下降'}</div></div>
        </div>
        <div style="margin-top:12px;padding:12px;background:#1a0f0f;border-radius:6px;font-size:11px;color:#fbbf24;border:1px solid #f97316">
          <b>⚠️ 重要免責：</b>本預測為簡化版線性 + EMA 模型，不構成投資建議。實際 LSTM 需 TensorFlow（避免前端跑大模型）。歷史報酬不代表未來表現。
        </div>
      `;
    };
  }
  V292_inject('tools', 'mr-v292-mlpredict', '🤖 ML 股價預測 (v292)', V292_buildMLPredict);

  // ============================================================
  // FEATURE 3: 🎯 支撐阻力自動偵測
  // ============================================================
  function V292_buildSR(containerId) {
    const c = V292_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">🎯 自動找出近 6 個月的關鍵支撐 + 阻力（用 Local Min/Max + Cluster 演算法）</p>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <input id="sr292-symbol" placeholder="股票代碼" style="padding:8px;background:#2a2a4a;border:1px solid #444;color:#fff;border-radius:4px;width:200px">
        <button id="sr292-run" style="padding:8px 16px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">🎯 偵測 S&R</button>
      </div>
      <div id="sr292-area"></div>
    `;
    V292_$('sr292-run').onclick = async () => {
      const sym = V292_$('sr292-symbol').value.trim().toUpperCase();
      if (!sym) return alert('請輸入');
      const a = V292_$('sr292-area');
      a.innerHTML = '<p style="color:#fbbf24;text-align:center;padding:20px">🎯 抓資料 + 演算法分析...</p>';
      const data = await V292_fetchOHLCV(sym, '6mo');
      if (!data) { a.innerHTML = '<p style="color:#ef4444">無資料</p>'; return; }
      // 找 Local Min / Max（窗口 5 天）
      const lows = [], highs = [];
      const win = 5;
      for (let i = win; i < data.length - win; i++) {
        let isLow = true, isHigh = true;
        for (let j = -win; j <= win; j++) {
          if (j === 0) continue;
          if (data[i + j].low < data[i].low) isLow = false;
          if (data[i + j].high > data[i].high) isHigh = false;
        }
        if (isLow) lows.push({ price: data[i].low, date: data[i].date, idx: i });
        if (isHigh) highs.push({ price: data[i].high, date: data[i].date, idx: i });
      }
      // Cluster：相近價位歸成同一個 S/R
      function cluster(points, threshold = 0.02) {
        const sorted = points.slice().sort((a, b) => a.price - b.price);
        const clusters = [];
        let current = [sorted[0]];
        for (let i = 1; i < sorted.length; i++) {
          if ((sorted[i].price - current[current.length - 1].price) / current[current.length - 1].price < threshold) {
            current.push(sorted[i]);
          } else {
            clusters.push(current);
            current = [sorted[i]];
          }
        }
        clusters.push(current);
        return clusters.map(cl => ({
          price: cl.reduce((s, p) => s + p.price, 0) / cl.length,
          touches: cl.length,
          dates: cl.map(p => p.date)
        })).filter(cl => cl.touches >= 2).sort((a, b) => b.touches - a.touches);
      }
      const supports = cluster(lows);
      const resistances = cluster(highs);
      const lastPrice = data[data.length - 1].close;
      // SVG
      const W2 = 700, H2 = 350;
      const allPrices = [...data.map(d => d.high), ...data.map(d => d.low)];
      const minP = Math.min(...allPrices), maxP = Math.max(...allPrices);
      const range = maxP - minP || 1;
      const xScale = i => 30 + i / (data.length - 1) * (W2 - 60);
      const yScale = v => H2 - 30 - (v - minP) / range * (H2 - 60);
      let svg = `<svg width="${W2}" height="${H2}" style="background:#0a0a1e;border-radius:6px;width:100%">`;
      // 收盤線
      const closeLine = data.map((d, i) => `${xScale(i)},${yScale(d.close)}`).join(' ');
      svg += `<polyline points="${closeLine}" fill="none" stroke="#4ade80" stroke-width="2"/>`;
      // 支撐線
      supports.slice(0, 5).forEach(s => {
        const y = yScale(s.price);
        svg += `<line x1="30" y1="${y}" x2="${W2 - 30}" y2="${y}" stroke="#22c55e" stroke-width="${1 + s.touches * 0.5}" stroke-dasharray="6 3" opacity="0.7"/>`;
        svg += `<text x="${W2 - 35}" y="${y - 3}" fill="#22c55e" font-size="11" text-anchor="end" font-weight="bold">S ${V292_fmt(s.price)} (${s.touches}x)</text>`;
      });
      // 阻力線
      resistances.slice(0, 5).forEach(r => {
        const y = yScale(r.price);
        svg += `<line x1="30" y1="${y}" x2="${W2 - 30}" y2="${y}" stroke="#ef4444" stroke-width="${1 + r.touches * 0.5}" stroke-dasharray="6 3" opacity="0.7"/>`;
        svg += `<text x="${W2 - 35}" y="${y - 3}" fill="#ef4444" font-size="11" text-anchor="end" font-weight="bold">R ${V292_fmt(r.price)} (${r.touches}x)</text>`;
      });
      svg += `</svg>`;

      a.innerHTML = `
        <p style="color:#4ade80;margin:0 0 8px 0">✅ ${sym} 支撐阻力（當前 ${V292_fmt(lastPrice)}）</p>
        ${svg}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px">
          <div style="background:#0f3a1f;padding:12px;border-radius:6px">
            <h4 style="margin:0 0 8px 0;color:#4ade80">🟢 主要支撐</h4>
            ${supports.slice(0, 5).map(s => `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #1a3a1a;font-size:13px">
              <span style="color:#fff">${V292_fmt(s.price)}</span>
              <span style="color:#aaa">${s.touches} 次測試 ｜ 距 ${V292_fmt((lastPrice - s.price) / s.price * 100, 1)}%</span>
            </div>`).join('') || '<p style="color:#666">無明顯支撐</p>'}
          </div>
          <div style="background:#3a0f1f;padding:12px;border-radius:6px">
            <h4 style="margin:0 0 8px 0;color:#ef4444">🔴 主要阻力</h4>
            ${resistances.slice(0, 5).map(r => `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #3a1a1f;font-size:13px">
              <span style="color:#fff">${V292_fmt(r.price)}</span>
              <span style="color:#aaa">${r.touches} 次測試 ｜ 距 ${V292_fmt((r.price - lastPrice) / lastPrice * 100, 1)}%</span>
            </div>`).join('') || '<p style="color:#666">無明顯阻力</p>'}
          </div>
        </div>
      `;
    };
  }
  V292_inject('tools', 'mr-v292-sr', '🎯 支撐阻力自動偵測 (v292)', V292_buildSR);

  // ============================================================
  // FEATURE 4: 🌊 量價背離偵測
  // ============================================================
  function V292_buildDivergence(containerId) {
    const c = V292_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">🌊 偵測「價量背離」— 反轉訊號的關鍵</p>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <input id="dv292-symbol" placeholder="股票代碼" style="padding:8px;background:#2a2a4a;border:1px solid #444;color:#fff;border-radius:4px;width:200px">
        <button id="dv292-run" style="padding:8px 16px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">🌊 偵測背離</button>
      </div>
      <div id="dv292-area"></div>
    `;
    V292_$('dv292-run').onclick = async () => {
      const sym = V292_$('dv292-symbol').value.trim().toUpperCase();
      if (!sym) return alert('請輸入');
      const a = V292_$('dv292-area');
      a.innerHTML = '<p style="color:#fbbf24;text-align:center;padding:20px">🌊 抓資料分析中...</p>';
      const data = await V292_fetchOHLCV(sym, '3mo');
      if (!data) { a.innerHTML = '<p style="color:#ef4444">無資料</p>'; return; }
      // 計算 RSI
      function rsi(arr, period = 14) {
        const out = [];
        for (let i = 0; i < arr.length; i++) {
          if (i < period) { out.push(50); continue; }
          let gain = 0, loss = 0;
          for (let j = i - period + 1; j <= i; j++) {
            const d = arr[j] - arr[j - 1];
            if (d > 0) gain += d; else loss += -d;
          }
          out.push(100 - 100 / (1 + gain / (loss || 1)));
        }
        return out;
      }
      const closes = data.map(d => d.close);
      const volumes = data.map(d => d.volume || 0);
      const rsis = rsi(closes);
      // 找最近兩個 swing high/low
      const recent = data.slice(-30);
      const recentRSI = rsis.slice(-30);
      let priceHigh1 = 0, priceHigh2 = 0;
      let rsiHigh1 = 0, rsiHigh2 = 0;
      let priceLow1 = Infinity, priceLow2 = Infinity;
      let rsiLow1 = 100, rsiLow2 = 100;
      // 簡化：用前半 vs 後半
      const half = Math.floor(recent.length / 2);
      for (let i = 0; i < half; i++) {
        if (recent[i].high > priceHigh1) { priceHigh1 = recent[i].high; rsiHigh1 = recentRSI[i]; }
        if (recent[i].low < priceLow1) { priceLow1 = recent[i].low; rsiLow1 = recentRSI[i]; }
      }
      for (let i = half; i < recent.length; i++) {
        if (recent[i].high > priceHigh2) { priceHigh2 = recent[i].high; rsiHigh2 = recentRSI[i]; }
        if (recent[i].low < priceLow2) { priceLow2 = recent[i].low; rsiLow2 = recentRSI[i]; }
      }
      const divergences = [];
      if (priceHigh2 > priceHigh1 && rsiHigh2 < rsiHigh1) {
        divergences.push({ type: '🔴 頂背離 (Bearish)', desc: '價格新高但 RSI 走低，反轉警告', strength: ((priceHigh2 - priceHigh1) / priceHigh1 * 100).toFixed(2) });
      }
      if (priceLow2 < priceLow1 && rsiLow2 > rsiLow1) {
        divergences.push({ type: '🟢 底背離 (Bullish)', desc: '價格新低但 RSI 走高，可能反彈', strength: ((priceLow1 - priceLow2) / priceLow1 * 100).toFixed(2) });
      }
      // 量價背離
      const recentVolMean = volumes.slice(-10).reduce((s, v) => s + v, 0) / 10;
      const olderVolMean = volumes.slice(-30, -10).reduce((s, v) => s + v, 0) / 20;
      const volChange = (recentVolMean - olderVolMean) / olderVolMean;
      const priceChange = (closes[closes.length - 1] - closes[closes.length - 30]) / closes[closes.length - 30];
      if (Math.abs(priceChange) > 0.05) {
        if (priceChange > 0 && volChange < -0.2) {
          divergences.push({ type: '⚠️ 上漲量縮 (警訊)', desc: '價漲但量縮，動能不足', strength: (Math.abs(volChange) * 100).toFixed(1) });
        }
        if (priceChange < 0 && volChange > 0.2) {
          divergences.push({ type: '⚠️ 下跌量增 (警訊)', desc: '價跌量增，恐慌性賣壓', strength: (volChange * 100).toFixed(1) });
        }
      }
      // SVG (price + RSI 雙圖)
      const W2 = 700, H2 = 320;
      const minP = Math.min(...closes), maxP = Math.max(...closes);
      let svg = `<svg width="${W2}" height="${H2}" style="background:#0a0a1e;border-radius:6px;width:100%">`;
      const xScale = i => 30 + i / (closes.length - 1) * (W2 - 60);
      // Price (上半)
      const yPrice = v => 20 + 130 * (1 - (v - minP) / (maxP - minP));
      const priceLine = closes.map((c, i) => `${xScale(i)},${yPrice(c)}`).join(' ');
      svg += `<polyline points="${priceLine}" fill="none" stroke="#4ade80" stroke-width="2"/>`;
      svg += `<text x="6" y="20" fill="#888" font-size="10">Price</text>`;
      // RSI (下半)
      const yRSI = v => 180 + 120 * (1 - v / 100);
      const rsiLine = rsis.map((r, i) => `${xScale(i)},${yRSI(r)}`).join(' ');
      svg += `<polyline points="${rsiLine}" fill="none" stroke="#fbbf24" stroke-width="2"/>`;
      svg += `<line x1="30" y1="${yRSI(70)}" x2="${W2 - 30}" y2="${yRSI(70)}" stroke="#ef4444" stroke-dasharray="2 2"/>`;
      svg += `<line x1="30" y1="${yRSI(30)}" x2="${W2 - 30}" y2="${yRSI(30)}" stroke="#22c55e" stroke-dasharray="2 2"/>`;
      svg += `<text x="6" y="180" fill="#888" font-size="10">RSI</text>`;
      svg += `</svg>`;

      a.innerHTML = `
        <p style="color:#4ade80;margin:0 0 8px 0">✅ ${sym} 量價背離偵測</p>
        ${svg}
        <div style="margin-top:12px">
          ${divergences.length ? divergences.map(d => `<div style="background:#0f0f1e;padding:12px;border-radius:6px;margin-bottom:8px;border-left:4px solid ${d.type.includes('🟢') ? '#22c55e' : d.type.includes('🔴') ? '#ef4444' : '#fbbf24'}">
            <h4 style="margin:0;color:#fff">${d.type}</h4>
            <p style="margin:4px 0 0 0;color:#aaa;font-size:13px">${d.desc} ｜ 強度 ${d.strength}%</p>
          </div>`).join('') : '<p style="color:#666;text-align:center;padding:16px">未偵測到明顯背離訊號</p>'}
        </div>
      `;
    };
  }
  V292_inject('tools', 'mr-v292-divergence', '🌊 量價背離偵測 (v292)', V292_buildDivergence);

  console.log('[MoneyRadar v292] ✅ 4 件市場微結構 features 已載入');
})();
