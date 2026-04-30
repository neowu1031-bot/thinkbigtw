/* MoneyRadar v288 — 進階圖表分析 5 件
 * 1. 🧱 Renko 磚型圖
 * 2. ❌ Point & Figure 點數圖
 * 3. 🇯🇵 Heikin-Ashi 平均 K 線
 * 4. 📊 Volume Profile 成交量分布
 * 5. 👣 Footprint 訂單流（簡化版）
 *
 * 所有函數加 V288_ 前綴避免命名衝突
 */
(function () {
  'use strict';
  const W = 'https://moneyradar-ai-proxy.thinkbigtw.workers.dev';
  function V288_$(id) { return document.getElementById(id); }
  function V288_el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function V288_fmt(n, d = 2) { if (n == null || isNaN(n)) return '—'; return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function V288_inject(parentTabId, id, title, builder) {
    const tab = document.querySelector(`[data-tab-content="${parentTabId}"]`) || document.querySelector(`#tab-${parentTabId}`) || document.body;
    if (document.getElementById(id)) return;
    const sec = V288_el(`<section id="${id}" style="margin:24px 0;padding:20px;background:var(--card-bg,#1a1a2e);border-radius:12px;border:1px solid var(--border,#2a2a4a)">
      <h3 style="margin:0 0 16px 0;color:var(--text,#e0e0ff)">${title}</h3>
      <div id="${id}-body"></div>
    </section>`);
    tab.appendChild(sec);
    try { builder(`${id}-body`); } catch (e) { console.error('v288 builder', id, e); }
  }

  // 共用：抓 OHLCV 資料
  async function V288_fetchOHLCV(symbol, range = '6mo') {
    try {
      const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=${range}&interval=1d`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const j = await r.json();
      const result = j.chart?.result?.[0];
      if (!result) return null;
      const ts = result.timestamp || [];
      const q = result.indicators?.quote?.[0] || {};
      const data = ts.map((t, i) => ({
        date: new Date(t * 1000).toISOString().slice(0, 10),
        open: q.open?.[i],
        high: q.high?.[i],
        low: q.low?.[i],
        close: q.close?.[i],
        volume: q.volume?.[i]
      })).filter(d => d.close != null);
      return data;
    } catch { return null; }
  }

  // ============================================================
  // FEATURE 1: 🧱 Renko 磚型圖
  // ============================================================
  function V288_buildRenko(containerId) {
    const c = V288_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">🧱 Renko 磚型圖：忽略時間，只看價格固定變化（過濾雜訊，看清趨勢）</p>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <input id="r288-symbol" placeholder="股票代碼（例：AAPL / 2330）" style="padding:8px;background:#2a2a4a;border:1px solid #444;color:#fff;border-radius:4px;width:200px">
        <input id="r288-brick" type="number" placeholder="磚塊大小（自動 = 留空）" style="padding:8px;background:#2a2a4a;border:1px solid #444;color:#fff;border-radius:4px;width:160px">
        <button id="r288-run" style="padding:8px 16px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">🧱 繪製 Renko</button>
      </div>
      <div id="r288-chart"></div>
    `;
    V288_$('r288-run').onclick = async () => {
      const sym = V288_$('r288-symbol').value.trim().toUpperCase();
      if (!sym) return alert('請輸入');
      const brickInput = parseFloat(V288_$('r288-brick').value);
      const ch = V288_$('r288-chart');
      ch.innerHTML = '<p style="color:#fbbf24;text-align:center;padding:20px">🧱 抓資料 + 計算磚塊...</p>';
      const data = await V288_fetchOHLCV(sym, '1y');
      if (!data || data.length < 30) { ch.innerHTML = '<p style="color:#ef4444">無資料</p>'; return; }
      // 自動計算 brick = 1.5% of average price
      const avgPrice = data.reduce((s, d) => s + d.close, 0) / data.length;
      const brick = brickInput || Math.round(avgPrice * 0.015 * 100) / 100;
      // 生成磚塊
      const bricks = [];
      let lastBrickPrice = data[0].close;
      let direction = 0;
      for (const d of data) {
        const diff = d.close - lastBrickPrice;
        const numBricks = Math.floor(Math.abs(diff) / brick);
        const newDir = diff > 0 ? 1 : -1;
        if (numBricks >= (direction === 0 || newDir === direction ? 1 : 2)) {
          for (let i = 0; i < numBricks; i++) {
            const open = lastBrickPrice + (newDir * brick * i);
            const close = open + (newDir * brick);
            bricks.push({ open, close, dir: newDir, date: d.date });
            lastBrickPrice = close;
          }
          direction = newDir;
        }
      }
      // SVG render
      const W2 = 900, H2 = 400;
      const allPrices = bricks.flatMap(b => [b.open, b.close]);
      const minP = Math.min(...allPrices), maxP = Math.max(...allPrices);
      const range = maxP - minP || 1;
      const bw = Math.max(4, W2 / Math.max(60, bricks.length));
      let svg = `<svg width="${W2}" height="${H2}" style="width:100%;background:#0a0a1e;border-radius:6px">`;
      // Y axis labels
      for (let i = 0; i <= 5; i++) {
        const p = minP + (range * i / 5);
        const y = H2 - 30 - ((p - minP) / range) * (H2 - 50);
        svg += `<line x1="0" y1="${y}" x2="${W2}" y2="${y}" stroke="#222" stroke-dasharray="2 2"/>`;
        svg += `<text x="6" y="${y - 2}" fill="#666" font-size="10">${V288_fmt(p, 2)}</text>`;
      }
      bricks.forEach((b, i) => {
        const x = i * bw;
        const yT = H2 - 30 - (Math.max(b.open, b.close) - minP) / range * (H2 - 50);
        const h = brick / range * (H2 - 50);
        const fill = b.dir > 0 ? '#4ade80' : '#ef4444';
        svg += `<rect x="${x}" y="${yT}" width="${bw - 1}" height="${h}" fill="${fill}" stroke="#000" stroke-width="0.5"/>`;
      });
      svg += `</svg>`;
      const upBricks = bricks.filter(b => b.dir > 0).length;
      const dnBricks = bricks.filter(b => b.dir < 0).length;
      ch.innerHTML = `
        <p style="color:#4ade80;margin:0 0 8px 0">✅ ${sym} Renko ｜ 磚塊大小 $${V288_fmt(brick)} ｜ 共 ${bricks.length} 塊</p>
        ${svg}
        <div style="margin-top:8px;display:flex;gap:16px;color:#aaa;font-size:13px">
          <span>🟢 上漲磚 ${upBricks} 塊</span>
          <span>🔴 下跌磚 ${dnBricks} 塊</span>
          <span>📈 趨勢比 ${V288_fmt(upBricks / Math.max(1, dnBricks), 2)}</span>
        </div>
        <div style="margin-top:12px;padding:12px;background:#0f0f1e;border-radius:6px;font-size:12px;color:#aaa">
          <b>💡 Renko 用法：</b>連續 3 塊同色 = 強趨勢 ｜ 磚塊變色 = 趨勢反轉訊號 ｜ 過濾雜訊看清主趨勢
        </div>
      `;
    };
  }
  V288_inject('tools', 'mr-v288-renko', '🧱 Renko 磚型圖 (v288)', V288_buildRenko);

  // ============================================================
  // FEATURE 2: ❌ Point & Figure 點數圖
  // ============================================================
  function V288_buildPnF(containerId) {
    const c = V288_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">❌ Point & Figure 點數圖：百年歷史的純價格圖（華爾街老前輩用了 100 年）</p>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <input id="pf288-symbol" placeholder="股票代碼" style="padding:8px;background:#2a2a4a;border:1px solid #444;color:#fff;border-radius:4px;width:200px">
        <button id="pf288-run" style="padding:8px 16px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">❌ 繪製 P&F</button>
      </div>
      <div id="pf288-chart"></div>
    `;
    V288_$('pf288-run').onclick = async () => {
      const sym = V288_$('pf288-symbol').value.trim().toUpperCase();
      if (!sym) return alert('請輸入');
      const ch = V288_$('pf288-chart');
      ch.innerHTML = '<p style="color:#fbbf24;text-align:center;padding:20px">❌ 計算 P&F...</p>';
      const data = await V288_fetchOHLCV(sym, '1y');
      if (!data) { ch.innerHTML = '<p style="color:#ef4444">無資料</p>'; return; }
      const avgPrice = data.reduce((s, d) => s + d.close, 0) / data.length;
      const boxSize = Math.round(avgPrice * 0.01 * 100) / 100;
      const reversal = 3; // 3-box reversal
      const cols = []; // each col: { type: 'X' or 'O', boxes: [price] }
      let curCol = null;
      for (const d of data) {
        const price = d.close;
        if (!curCol) {
          curCol = { type: 'X', boxes: [Math.floor(price / boxSize) * boxSize] };
          cols.push(curCol);
          continue;
        }
        const last = curCol.boxes[curCol.boxes.length - 1];
        if (curCol.type === 'X') {
          // 看漲：price 漲到下一個 box
          if (price >= last + boxSize) {
            const target = Math.floor(price / boxSize) * boxSize;
            for (let p = last + boxSize; p <= target; p += boxSize) curCol.boxes.push(p);
          } else if (price <= last - reversal * boxSize) {
            // 反轉
            curCol = { type: 'O', boxes: [last - boxSize] };
            cols.push(curCol);
            const target = Math.floor(price / boxSize) * boxSize;
            for (let p = last - boxSize * 2; p >= target; p -= boxSize) curCol.boxes.push(p);
          }
        } else {
          if (price <= last - boxSize) {
            const target = Math.floor(price / boxSize) * boxSize;
            for (let p = last - boxSize; p >= target; p -= boxSize) curCol.boxes.push(p);
          } else if (price >= last + reversal * boxSize) {
            curCol = { type: 'X', boxes: [last + boxSize] };
            cols.push(curCol);
            const target = Math.floor(price / boxSize) * boxSize;
            for (let p = last + boxSize * 2; p <= target; p += boxSize) curCol.boxes.push(p);
          }
        }
      }
      // SVG
      const W2 = 900, H2 = 400;
      const allPrices = cols.flatMap(c => c.boxes);
      const minP = Math.min(...allPrices), maxP = Math.max(...allPrices);
      const range = maxP - minP || 1;
      const colW = Math.max(8, W2 / Math.max(40, cols.length));
      const rowH = Math.max(4, (H2 - 40) / (range / boxSize + 1));
      let svg = `<svg width="${W2}" height="${H2}" style="width:100%;background:#0a0a1e;border-radius:6px">`;
      cols.forEach((col, ci) => {
        col.boxes.forEach(price => {
          const y = H2 - 20 - (price - minP) / boxSize * rowH;
          const x = ci * colW + colW / 2;
          if (col.type === 'X') {
            svg += `<line x1="${x - 4}" y1="${y - 4}" x2="${x + 4}" y2="${y + 4}" stroke="#4ade80" stroke-width="2"/>`;
            svg += `<line x1="${x - 4}" y1="${y + 4}" x2="${x + 4}" y2="${y - 4}" stroke="#4ade80" stroke-width="2"/>`;
          } else {
            svg += `<circle cx="${x}" cy="${y}" r="4" fill="none" stroke="#ef4444" stroke-width="2"/>`;
          }
        });
      });
      svg += `</svg>`;
      ch.innerHTML = `
        <p style="color:#4ade80">✅ ${sym} P&F ｜ Box=$${V288_fmt(boxSize)} ｜ 反轉=3 box ｜ 共 ${cols.length} 列</p>
        ${svg}
        <div style="margin-top:12px;padding:12px;background:#0f0f1e;border-radius:6px;font-size:12px;color:#aaa">
          <b>❌ X = 上漲列</b> ｜ <b>⭕ O = 下跌列</b><br>
          <b>💡 用法：</b>新高 X = 突破 ｜ 新低 O = 跌破 ｜ Triple Top/Bottom = 強訊號
        </div>
      `;
    };
  }
  V288_inject('tools', 'mr-v288-pnf', '❌ Point & Figure 點數圖 (v288)', V288_buildPnF);

  // ============================================================
  // FEATURE 3: 🇯🇵 Heikin-Ashi 平均 K 線
  // ============================================================
  function V288_buildHA(containerId) {
    const c = V288_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">🇯🇵 Heikin-Ashi（日文「平均棒」）：平滑化的 K 線，更清楚看趨勢</p>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <input id="ha288-symbol" placeholder="股票代碼" style="padding:8px;background:#2a2a4a;border:1px solid #444;color:#fff;border-radius:4px;width:200px">
        <button id="ha288-run" style="padding:8px 16px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">🇯🇵 繪製 Heikin-Ashi</button>
      </div>
      <div id="ha288-chart"></div>
    `;
    V288_$('ha288-run').onclick = async () => {
      const sym = V288_$('ha288-symbol').value.trim().toUpperCase();
      if (!sym) return alert('請輸入');
      const ch = V288_$('ha288-chart');
      ch.innerHTML = '<p style="color:#fbbf24;text-align:center;padding:20px">🇯🇵 計算 Heikin-Ashi...</p>';
      const data = await V288_fetchOHLCV(sym, '6mo');
      if (!data || data.length < 5) { ch.innerHTML = '<p style="color:#ef4444">無資料</p>'; return; }
      // 計算 HA
      const ha = [];
      for (let i = 0; i < data.length; i++) {
        const d = data[i];
        const haClose = (d.open + d.high + d.low + d.close) / 4;
        const haOpen = i === 0 ? (d.open + d.close) / 2 : (ha[i - 1].open + ha[i - 1].close) / 2;
        const haHigh = Math.max(d.high, haOpen, haClose);
        const haLow = Math.min(d.low, haOpen, haClose);
        ha.push({ open: haOpen, close: haClose, high: haHigh, low: haLow, date: d.date });
      }
      // SVG
      const W2 = 900, H2 = 400;
      const allP = ha.flatMap(h => [h.high, h.low]);
      const minP = Math.min(...allP), maxP = Math.max(...allP);
      const range = maxP - minP || 1;
      const cw = W2 / ha.length;
      let svg = `<svg width="${W2}" height="${H2}" style="width:100%;background:#0a0a1e;border-radius:6px">`;
      // Y grid
      for (let i = 0; i <= 5; i++) {
        const p = minP + range * i / 5;
        const y = H2 - 20 - (p - minP) / range * (H2 - 40);
        svg += `<line x1="0" y1="${y}" x2="${W2}" y2="${y}" stroke="#222" stroke-dasharray="2 2"/>`;
        svg += `<text x="6" y="${y - 2}" fill="#666" font-size="10">${V288_fmt(p)}</text>`;
      }
      ha.forEach((h, i) => {
        const x = i * cw + cw / 2;
        const yH = H2 - 20 - (h.high - minP) / range * (H2 - 40);
        const yL = H2 - 20 - (h.low - minP) / range * (H2 - 40);
        const yO = H2 - 20 - (h.open - minP) / range * (H2 - 40);
        const yC = H2 - 20 - (h.close - minP) / range * (H2 - 40);
        const color = h.close >= h.open ? '#4ade80' : '#ef4444';
        svg += `<line x1="${x}" y1="${yH}" x2="${x}" y2="${yL}" stroke="${color}" stroke-width="1"/>`;
        svg += `<rect x="${x - cw / 3}" y="${Math.min(yO, yC)}" width="${cw * 2 / 3}" height="${Math.max(1, Math.abs(yO - yC))}" fill="${color}"/>`;
      });
      svg += `</svg>`;
      // 趨勢分析
      const last5 = ha.slice(-5);
      const upBars = last5.filter(h => h.close >= h.open).length;
      const trend = upBars >= 4 ? '🚀 強多頭' : upBars >= 3 ? '📈 偏多' : upBars <= 1 ? '🔻 強空頭' : upBars <= 2 ? '📉 偏空' : '😐 盤整';
      ch.innerHTML = `
        <p style="color:#4ade80">✅ ${sym} Heikin-Ashi ｜ 近 5 日：${trend}（${upBars}/5 紅 K）</p>
        ${svg}
        <div style="margin-top:12px;padding:12px;background:#0f0f1e;border-radius:6px;font-size:12px;color:#aaa">
          <b>💡 Heikin-Ashi 訊號：</b>
          連續紅 K 無下影 = 強多頭 ｜ 連續黑 K 無上影 = 強空頭<br>
          十字星（Doji）= 趨勢可能反轉
        </div>
      `;
    };
  }
  V288_inject('tools', 'mr-v288-ha', '🇯🇵 Heikin-Ashi 平均 K 線 (v288)', V288_buildHA);

  // ============================================================
  // FEATURE 4: 📊 Volume Profile 成交量分布
  // ============================================================
  function V288_buildVolProfile(containerId) {
    const c = V288_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">📊 Volume Profile：哪個價位成交最多 = 市場共識的「公允價值」</p>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <input id="vp288-symbol" placeholder="股票代碼" style="padding:8px;background:#2a2a4a;border:1px solid #444;color:#fff;border-radius:4px;width:200px">
        <button id="vp288-run" style="padding:8px 16px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">📊 繪製 Volume Profile</button>
      </div>
      <div id="vp288-chart"></div>
    `;
    V288_$('vp288-run').onclick = async () => {
      const sym = V288_$('vp288-symbol').value.trim().toUpperCase();
      if (!sym) return alert('請輸入');
      const ch = V288_$('vp288-chart');
      ch.innerHTML = '<p style="color:#fbbf24;text-align:center;padding:20px">📊 抓資料 + 計算 Volume Profile...</p>';
      const data = await V288_fetchOHLCV(sym, '6mo');
      if (!data) { ch.innerHTML = '<p style="color:#ef4444">無資料</p>'; return; }
      // 找價格範圍
      const allP = data.flatMap(d => [d.high, d.low]);
      const minP = Math.min(...allP), maxP = Math.max(...allP);
      const range = maxP - minP;
      const NUM_BINS = 30;
      const binSize = range / NUM_BINS;
      const bins = Array(NUM_BINS).fill(0);
      // 分配每日成交量到價位區間（用 typical price = (H+L+C)/3）
      data.forEach(d => {
        const tp = (d.high + d.low + d.close) / 3;
        const idx = Math.min(NUM_BINS - 1, Math.floor((tp - minP) / binSize));
        bins[idx] += d.volume || 0;
      });
      const maxV = Math.max(...bins);
      const totalVol = bins.reduce((s, v) => s + v, 0);
      // POC = bin with max volume
      const pocIdx = bins.indexOf(maxV);
      const pocPrice = minP + (pocIdx + 0.5) * binSize;
      // Value Area (70% volume)
      const sortedIdx = bins.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
      let cumVol = 0;
      const vaIdxs = new Set();
      for (const { v, i } of sortedIdx) {
        if (cumVol >= totalVol * 0.7) break;
        vaIdxs.add(i);
        cumVol += v;
      }
      const vaIdxArr = [...vaIdxs].sort((a, b) => a - b);
      const vah = minP + (vaIdxArr[vaIdxArr.length - 1] + 1) * binSize;
      const val = minP + vaIdxArr[0] * binSize;
      // SVG
      const W2 = 900, H2 = 400;
      let svg = `<svg width="${W2}" height="${H2}" style="width:100%;background:#0a0a1e;border-radius:6px">`;
      const barH = (H2 - 40) / NUM_BINS;
      bins.forEach((v, i) => {
        const y = H2 - 20 - (i + 1) * barH;
        const w = (v / maxV) * (W2 - 100);
        const inVA = vaIdxs.has(i);
        const isPOC = i === pocIdx;
        const fill = isPOC ? '#fbbf24' : inVA ? '#4ade80' : '#3b82f6';
        svg += `<rect x="60" y="${y}" width="${w}" height="${barH - 1}" fill="${fill}" opacity="0.8"/>`;
        if (i % 3 === 0) {
          svg += `<text x="6" y="${y + barH / 2 + 3}" fill="#888" font-size="9">${V288_fmt(minP + (i + 0.5) * binSize, 2)}</text>`;
        }
      });
      // POC 標線
      const pocY = H2 - 20 - (pocIdx + 0.5) * barH;
      svg += `<text x="${W2 - 8}" y="${pocY}" fill="#fbbf24" font-size="11" text-anchor="end" font-weight="bold">POC ${V288_fmt(pocPrice, 2)}</text>`;
      svg += `</svg>`;
      const lastP = data[data.length - 1].close;
      const dist = ((lastP - pocPrice) / pocPrice * 100).toFixed(2);
      ch.innerHTML = `
        <p style="color:#4ade80">✅ ${sym} Volume Profile（過去 6 個月）</p>
        ${svg}
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-top:12px">
          <div style="background:#0f0f1e;padding:10px;border-radius:6px"><div style="color:#fbbf24;font-size:12px">🎯 POC 點</div><div style="color:#fff;font-size:18px;font-weight:bold">$${V288_fmt(pocPrice, 2)}</div></div>
          <div style="background:#0f0f1e;padding:10px;border-radius:6px"><div style="color:#4ade80;font-size:12px">📈 VA High</div><div style="color:#fff;font-size:18px;font-weight:bold">$${V288_fmt(vah, 2)}</div></div>
          <div style="background:#0f0f1e;padding:10px;border-radius:6px"><div style="color:#4ade80;font-size:12px">📉 VA Low</div><div style="color:#fff;font-size:18px;font-weight:bold">$${V288_fmt(val, 2)}</div></div>
          <div style="background:#0f0f1e;padding:10px;border-radius:6px"><div style="color:#aaa;font-size:12px">📍 當前 vs POC</div><div style="color:${dist > 0 ? '#4ade80' : '#ef4444'};font-size:18px;font-weight:bold">${dist > 0 ? '+' : ''}${dist}%</div></div>
        </div>
        <div style="margin-top:12px;padding:12px;background:#0f0f1e;border-radius:6px;font-size:12px;color:#aaa">
          <b>💡 用法：</b> POC = Point of Control，最重要支撐/壓力 ｜ VA (Value Area) = 70% 成交量區間，跌破 VAL 為熊訊，突破 VAH 為牛訊
        </div>
      `;
    };
  }
  V288_inject('tools', 'mr-v288-vp', '📊 Volume Profile 成交量分布 (v288)', V288_buildVolProfile);

  // ============================================================
  // FEATURE 5: 👣 Footprint 訂單流（簡化版）
  // ============================================================
  function V288_buildFootprint(containerId) {
    const c = V288_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">👣 Footprint 訂單流：每根 K 線內的買賣壓力分布（誰在主導）</p>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <input id="fp288-symbol" placeholder="股票代碼" style="padding:8px;background:#2a2a4a;border:1px solid #444;color:#fff;border-radius:4px;width:200px">
        <button id="fp288-run" style="padding:8px 16px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">👣 繪製 Footprint</button>
      </div>
      <div id="fp288-chart"></div>
    `;
    V288_$('fp288-run').onclick = async () => {
      const sym = V288_$('fp288-symbol').value.trim().toUpperCase();
      if (!sym) return alert('請輸入');
      const ch = V288_$('fp288-chart');
      ch.innerHTML = '<p style="color:#fbbf24;text-align:center;padding:20px">👣 計算 Footprint...</p>';
      const data = await V288_fetchOHLCV(sym, '1mo');
      if (!data) { ch.innerHTML = '<p style="color:#ef4444">無資料</p>'; return; }
      // 簡化：用 close vs open 推估買賣壓
      const recent = data.slice(-30);
      const W2 = 900, H2 = 400;
      const allP = recent.flatMap(d => [d.high, d.low]);
      const minP = Math.min(...allP), maxP = Math.max(...allP);
      const range = maxP - minP || 1;
      const cw = W2 / recent.length;
      let svg = `<svg width="${W2}" height="${H2}" style="width:100%;background:#0a0a1e;border-radius:6px">`;
      for (let i = 0; i <= 5; i++) {
        const y = H2 - 20 - (H2 - 40) * i / 5;
        const p = minP + range * i / 5;
        svg += `<line x1="0" y1="${y}" x2="${W2}" y2="${y}" stroke="#222" stroke-dasharray="2 2"/>`;
        svg += `<text x="6" y="${y - 2}" fill="#666" font-size="10">${V288_fmt(p)}</text>`;
      }
      recent.forEach((d, i) => {
        const x = i * cw + cw / 4;
        // 假設成交量上半 = sell pressure, 下半 = buy pressure（粗略）
        const buyVol = d.close >= d.open ? d.volume * 0.6 : d.volume * 0.4;
        const sellVol = d.volume - buyVol;
        const delta = buyVol - sellVol;
        const yH = H2 - 20 - (d.high - minP) / range * (H2 - 40);
        const yL = H2 - 20 - (d.low - minP) / range * (H2 - 40);
        const cellH = (yL - yH) / 5;
        // 5 個價位細分
        for (let k = 0; k < 5; k++) {
          const yc = yH + k * cellH;
          const buyV = Math.round(buyVol / 5);
          const sellV = Math.round(sellVol / 5);
          const total = buyV + sellV;
          const bias = (buyV - sellV) / Math.max(1, total);
          const fill = bias > 0.1 ? '#4ade80' : bias < -0.1 ? '#ef4444' : '#3b82f6';
          svg += `<rect x="${x}" y="${yc}" width="${cw / 2}" height="${cellH - 1}" fill="${fill}" opacity="${0.3 + Math.abs(bias) * 0.6}"/>`;
        }
        // delta 標籤
        const dColor = delta > 0 ? '#4ade80' : '#ef4444';
        svg += `<text x="${x + cw / 4}" y="${H2 - 4}" fill="${dColor}" font-size="9" text-anchor="middle">${(delta / 1e6).toFixed(1)}M</text>`;
      });
      svg += `</svg>`;
      const totalDelta = recent.reduce((s, d) => s + (d.close >= d.open ? d.volume * 0.2 : -d.volume * 0.2), 0);
      ch.innerHTML = `
        <p style="color:#4ade80">✅ ${sym} Footprint（過去 30 日）</p>
        ${svg}
        <div style="margin-top:12px;display:flex;gap:16px;flex-wrap:wrap;color:#aaa;font-size:13px">
          <span style="color:#4ade80">🟢 綠 = 買方主導</span>
          <span style="color:#ef4444">🔴 紅 = 賣方主導</span>
          <span>累計 Delta：<b style="color:${totalDelta > 0 ? '#4ade80' : '#ef4444'}">${(totalDelta / 1e6).toFixed(1)}M</b></span>
        </div>
        <div style="margin-top:12px;padding:12px;background:#0f0f1e;border-radius:6px;font-size:12px;color:#aaa">
          <b>💡 Footprint 用法：</b> 連續綠主導 = 強買方 ｜ 連續紅主導 = 強賣方 ｜ Delta 背離 = 反轉訊號<br>
          <b>注意：</b>本版為簡化版（用日 K 推估），完整 Footprint 需 tick-level 資料（付費版）
        </div>
      `;
    };
  }
  V288_inject('tools', 'mr-v288-fp', '👣 Footprint 訂單流 (v288)', V288_buildFootprint);

  console.log('[MoneyRadar v288] ✅ 5 件進階圖表 features 已載入');
})();
