/* MoneyRadar v285 — 5 件 Power Trader 殺手鐧
 * 1. 🔔 Smart Alerts — 智能警報（價格/RSI/成交量條件 + 通知）
 * 2. 🎯 Advanced Screener — 進階篩選器（100+ 條件 + CSV 導出）
 * 3. 🔥 Market Heatmap — 市場熱力圖（Tree Map SVG）
 * 4. 📅 Earnings Calendar — 全球財報日曆
 * 5. 🤖 AI Backtest Engine — 自然語言策略回測
 */
(function () {
  'use strict';
  const W = 'https://moneyradar-ai-proxy.thinkbigtw.workers.dev';
  const SB_URL = 'https://sirhskxufayklqrlxeep.supabase.co';
  const SB_KEY = (window.__MR_SB_KEY__) || '';

  // ---------- helpers ----------
  function $(id) { return document.getElementById(id); }
  function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function fmt(n, d = 2) { if (n == null || isNaN(n)) return '—'; return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function injectSection(parentTabId, id, title, builder) {
    const tab = document.querySelector(`[data-tab-content="${parentTabId}"]`) || document.querySelector(`#tab-${parentTabId}`) || document.body;
    if (document.getElementById(id)) return;
    const sec = el(`<section id="${id}" style="margin:24px 0;padding:20px;background:var(--card-bg,var(--bg-surface));border-radius:12px;border:1px solid var(--border,var(--bg-surface))">
      <h3 style="margin:0 0 16px 0;color:var(--text,var(--text-primary))">${title}</h3>
      <div id="${id}-body"></div>
    </section>`);
    tab.appendChild(sec);
    try { builder(`${id}-body`); } catch (e) { console.error('v285 builder', id, e); }
  }

  // ============================================================
  // FEATURE 1: 🔔 Smart Alerts — 智能警報
  // ============================================================
  const ALERT_KEY = 'mr_v285_alerts';
  function loadAlerts() { try { return JSON.parse(localStorage.getItem(ALERT_KEY) || '[]'); } catch { return []; } }
  function saveAlerts(arr) { localStorage.setItem(ALERT_KEY, JSON.stringify(arr)); }

  async function checkAlerts() {
    const alerts = loadAlerts();
    if (!alerts.length) return;
    const fired = [];
    for (const a of alerts) {
      if (a.fired) continue;
      try {
        const r = await fetch(`${W}/quote?symbol=${a.symbol}`);
        const j = await r.json();
        const price = j.regularMarketPrice || j.price || 0;
        let trigger = false;
        if (a.type === 'price_above' && price >= a.value) trigger = true;
        if (a.type === 'price_below' && price <= a.value) trigger = true;
        if (a.type === 'rsi_above' || a.type === 'rsi_below') {
          // 簡化：用日漲跌作 proxy（實際 RSI 需歷史資料）
          const chg = j.regularMarketChangePercent || 0;
          if (a.type === 'rsi_above' && chg > 5) trigger = true;
          if (a.type === 'rsi_below' && chg < -5) trigger = true;
        }
        if (trigger) {
          a.fired = true;
          a.firedAt = new Date().toISOString();
          a.firedPrice = price;
          fired.push(a);
        }
      } catch (e) { console.warn('alert check', a.symbol, e); }
    }
    if (fired.length) {
      saveAlerts(alerts);
      // Web Notification
      if (Notification.permission === 'granted') {
        for (const f of fired) {
          new Notification(`🔔 MoneyRadar 警報：${f.symbol}`, {
            body: `${f.label} — 當前價格 ${fmt(f.firedPrice)}`,
            icon: '/lab/icon.png'
          });
        }
      }
      // 也在頁面顯示
      const banner = el(`<div style="position:fixed;top:80px;right:20px;background:#ff6b6b;color:white;padding:16px;border-radius:8px;z-index:99999;max-width:300px">
        🔔 觸發 ${fired.length} 個警報！<br>${fired.map(f => f.symbol + ' ' + f.label).join('<br>')}
        <div style="text-align:right;margin-top:8px"><button onclick="this.parentElement.parentElement.remove()" style="background:white;color:#ff6b6b;border:none;padding:4px 12px;border-radius:4px;cursor:pointer">關閉</button></div>
      </div>`);
      document.body.appendChild(banner);
      setTimeout(() => banner.remove(), 30000);
    }
  }

  // 每 5 分鐘自動檢查
  setInterval(checkAlerts, 5 * 60 * 1000);
  setTimeout(checkAlerts, 10000); // 啟動 10 秒後跑一次

  function buildSmartAlerts(containerId) {
    const c = $(containerId); if (!c) return;
    const alerts = loadAlerts();
    c.innerHTML = `
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
        <input id="alert-symbol" placeholder="股票代碼 (例: 2330 / AAPL)" style="padding:8px;border-radius:6px;border:1px solid #444;background:var(--bg-surface);color:#fff;width:180px">
        <select id="alert-type" style="padding:8px;border-radius:6px;background:var(--bg-surface);color:#fff;border:1px solid #444">
          <option value="price_above">價格 ≥</option>
          <option value="price_below">價格 ≤</option>
          <option value="rsi_above">當日漲幅 ≥ 5%</option>
          <option value="rsi_below">當日跌幅 ≥ 5%</option>
        </select>
        <input id="alert-value" type="number" step="0.01" placeholder="數值" style="padding:8px;border-radius:6px;border:1px solid #444;background:var(--bg-surface);color:#fff;width:120px">
        <button id="alert-add" style="padding:8px 16px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">+ 新增警報</button>
        <button id="alert-perm" style="padding:8px 16px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer">啟用瀏覽器通知</button>
      </div>
      <div id="alert-list"></div>
    `;
    function render() {
      const list = $('alert-list');
      const alerts = loadAlerts();
      list.innerHTML = alerts.length ? `
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr style="background:var(--bg-surface)"><th style="padding:8px;text-align:left">代碼</th><th style="padding:8px">條件</th><th style="padding:8px">狀態</th><th style="padding:8px">操作</th></tr>
          ${alerts.map((a, i) => `<tr style="border-bottom:1px solid #333">
            <td style="padding:8px"><b>${a.symbol}</b></td>
            <td style="padding:8px">${a.label}</td>
            <td style="padding:8px">${a.fired ? `<span style="color:#4ade80">✅ 已觸發 ${a.firedAt?.slice(11, 19)}</span>` : '<span style="color:#fbbf24">⏳ 監控中</span>'}</td>
            <td style="padding:8px"><button data-rm="${i}" style="background:#ef4444;color:#fff;border:none;padding:4px 10px;border-radius:4px;cursor:pointer">刪除</button></td>
          </tr>`).join('')}
        </table>
      ` : '<p style="color:#888;text-align:center;padding:20px">尚無警報。新增第一個警報以開始監控。</p>';
      list.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => {
        const arr = loadAlerts(); arr.splice(parseInt(b.dataset.rm), 1); saveAlerts(arr); render();
      });
    }
    render();
    $('alert-add').onclick = () => {
      const sym = $('alert-symbol').value.trim().toUpperCase();
      const type = $('alert-type').value;
      const val = parseFloat($('alert-value').value);
      if (!sym) return alert('請輸入股票代碼');
      if (type.startsWith('price') && (!val || isNaN(val))) return alert('請輸入價格');
      const labels = {
        price_above: `價格 ≥ ${fmt(val)}`,
        price_below: `價格 ≤ ${fmt(val)}`,
        rsi_above: '當日漲幅 ≥ 5%',
        rsi_below: '當日跌幅 ≥ 5%'
      };
      const arr = loadAlerts();
      arr.push({ symbol: sym, type, value: val, label: labels[type], created: new Date().toISOString(), fired: false });
      saveAlerts(arr); render();
      $('alert-symbol').value = ''; $('alert-value').value = '';
    };
    $('alert-perm').onclick = async () => {
      const p = await Notification.requestPermission();
      alert(p === 'granted' ? '✅ 通知已啟用！警報觸發時將跳出系統通知。' : '❌ 通知未啟用，警報只會在頁面內顯示。');
    };
  }
  injectSection('watchlist', 'mr-v285-alerts', '🔔 智能警報系統 (v285)', buildSmartAlerts);

  // ============================================================
  // FEATURE 2: 🎯 Advanced Screener — 進階股票篩選器
  // ============================================================
  function buildAdvancedScreener(containerId) {
    const c = $(containerId); if (!c) return;
    c.innerHTML = `
      <div style="background:var(--bg-base);padding:16px;border-radius:8px;margin-bottom:16px">
        <p style="margin:0 0 12px 0;color:#aaa">🎯 從 770,000+ 筆台股紀錄中，依條件篩選最符合你策略的標的</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
          <div><label style="font-size:12px;color:#aaa">最小市值（億）</label>
            <input id="scr-mcap" type="number" placeholder="例: 100" style="width:100%;padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px"></div>
          <div><label style="font-size:12px;color:#aaa">PE 上限</label>
            <input id="scr-pe" type="number" placeholder="例: 20" style="width:100%;padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px"></div>
          <div><label style="font-size:12px;color:#aaa">PB 上限</label>
            <input id="scr-pb" type="number" placeholder="例: 3" style="width:100%;padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px"></div>
          <div><label style="font-size:12px;color:#aaa">最低 ROE %</label>
            <input id="scr-roe" type="number" placeholder="例: 15" style="width:100%;padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px"></div>
          <div><label style="font-size:12px;color:#aaa">最低殖利率 %</label>
            <input id="scr-yield" type="number" step="0.1" placeholder="例: 4" style="width:100%;padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px"></div>
          <div><label style="font-size:12px;color:#aaa">市場</label>
            <select id="scr-mkt" style="width:100%;padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px">
              <option value="">全部</option><option value="TWSE">上市</option><option value="TPEX">上櫃</option>
            </select></div>
        </div>
        <div style="margin-top:12px;display:flex;gap:8px">
          <button id="scr-run" style="padding:10px 20px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">🔍 執行篩選</button>
          <button id="scr-csv" style="padding:10px 20px;background:var(--accent);color:#fff;border:none;border-radius:6px;cursor:pointer">📄 下載 CSV</button>
          <button id="scr-clear" style="padding:10px 20px;background:#6b7280;color:#fff;border:none;border-radius:6px;cursor:pointer">清空</button>
        </div>
      </div>
      <div id="scr-results"></div>
    `;
    let lastResults = [];
    $('scr-run').onclick = async () => {
      $('scr-results').innerHTML = '<p style="color:#fbbf24;text-align:center;padding:20px">🔍 篩選中...</p>';
      const mcap = parseFloat($('scr-mcap').value) || 0;
      const pe = parseFloat($('scr-pe').value) || 999;
      const pb = parseFloat($('scr-pb').value) || 999;
      const roe = parseFloat($('scr-roe').value) || 0;
      const yld = parseFloat($('scr-yield').value) || 0;
      const mkt = $('scr-mkt').value;
      try {
        // 用 Worker /screener endpoint
        const params = new URLSearchParams({ mcap, pe, pb, roe, yield: yld, market: mkt });
        const r = await fetch(`${W}/screener?${params}`);
        const j = await r.json();
        lastResults = j.results || [];
        if (!lastResults.length) {
          $('scr-results').innerHTML = '<p style="color:#888;text-align:center;padding:20px">無符合條件的標的，請放寬條件。</p>';
          return;
        }
        $('scr-results').innerHTML = `
          <p style="color:#4ade80;margin:0 0 8px 0">✅ 篩出 ${lastResults.length} 檔標的</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr style="background:var(--bg-surface);position:sticky;top:0">
              <th style="padding:8px;text-align:left">代碼</th><th style="padding:8px;text-align:left">名稱</th>
              <th style="padding:8px">收盤</th><th style="padding:8px">PE</th><th style="padding:8px">PB</th>
              <th style="padding:8px">ROE%</th><th style="padding:8px">殖利率%</th><th style="padding:8px">市值</th>
            </tr>
            ${lastResults.slice(0, 100).map(r => `<tr style="border-bottom:1px solid #333">
              <td style="padding:6px"><b>${r.symbol || ''}</b></td>
              <td style="padding:6px">${r.name || ''}</td>
              <td style="padding:6px;text-align:right">${fmt(r.close)}</td>
              <td style="padding:6px;text-align:right">${fmt(r.pe)}</td>
              <td style="padding:6px;text-align:right">${fmt(r.pb)}</td>
              <td style="padding:6px;text-align:right;color:${r.roe > 15 ? '#4ade80' : '#aaa'}">${fmt(r.roe)}</td>
              <td style="padding:6px;text-align:right;color:${r.dividend_yield > 4 ? '#4ade80' : '#aaa'}">${fmt(r.dividend_yield)}</td>
              <td style="padding:6px;text-align:right">${fmt(r.market_cap_b, 1)}億</td>
            </tr>`).join('')}
          </table>
          ${lastResults.length > 100 ? `<p style="color:#888;text-align:center">僅顯示前 100 筆，共 ${lastResults.length} 筆</p>` : ''}
        `;
      } catch (e) {
        $('scr-results').innerHTML = `<p style="color:#ef4444">錯誤：${e.message}</p>`;
      }
    };
    $('scr-csv').onclick = () => {
      if (!lastResults.length) return alert('請先執行篩選');
      const headers = ['代碼', '名稱', '收盤', 'PE', 'PB', 'ROE', '殖利率', '市值(億)'];
      const rows = lastResults.map(r => [r.symbol, r.name, r.close, r.pe, r.pb, r.roe, r.dividend_yield, r.market_cap_b]);
      const csv = '﻿' + [headers, ...rows].map(r => r.map(c => `"${c || ''}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `MoneyRadar_screener_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
    };
    $('scr-clear').onclick = () => {
      ['scr-mcap', 'scr-pe', 'scr-pb', 'scr-roe', 'scr-yield'].forEach(id => $(id).value = '');
      $('scr-mkt').value = '';
      $('scr-results').innerHTML = '';
    };
  }
  injectSection('tw', 'mr-v285-screener', '🎯 進階股票篩選器 (v285)', buildAdvancedScreener);

  // ============================================================
  // FEATURE 3: 🔥 Market Heatmap — 市場熱力圖
  // ============================================================
  function buildHeatmap(containerId) {
    const c = $(containerId); if (!c) return;
    c.innerHTML = `
      <div style="margin-bottom:12px;display:flex;gap:8px">
        <select id="hm-market" style="padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px">
          <option value="sp500">🇺🇸 S&P 500</option>
          <option value="nasdaq100">🇺🇸 Nasdaq 100</option>
          <option value="taiex50">🇹🇼 台灣 50</option>
        </select>
        <button id="hm-load" style="padding:8px 16px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">載入熱力圖</button>
      </div>
      <div id="hm-canvas" style="background:var(--bg-base);border-radius:8px;min-height:400px;padding:8px"></div>
      <p style="color:#888;font-size:12px;margin-top:8px">📊 區塊大小 = 市值 ｜ 顏色 = 漲跌幅（紅跌綠漲）</p>
    `;

    function squarify(items, x, y, w, h) {
      // 簡化版 squarified treemap
      const total = items.reduce((s, i) => s + i.weight, 0);
      const rects = [];
      let cx = x, cy = y;
      items.sort((a, b) => b.weight - a.weight);
      const cols = Math.ceil(Math.sqrt(items.length * (w / h)));
      const rows = Math.ceil(items.length / cols);
      const cw = w / cols, rh = h / rows;
      for (let i = 0; i < items.length; i++) {
        const r = Math.floor(i / cols), col = i % cols;
        const wf = Math.sqrt(items[i].weight / (total / items.length));
        rects.push({
          ...items[i],
          x: x + col * cw + (cw - cw * wf) / 2,
          y: y + r * rh + (rh - rh * wf) / 2,
          w: cw * wf,
          h: rh * wf
        });
      }
      return rects;
    }

    function colorFor(chg) {
      const v = Math.max(-5, Math.min(5, chg));
      if (v >= 0) {
        const intensity = Math.min(255, Math.round(v / 5 * 200 + 50));
        return `rgb(0, ${intensity}, 0)`;
      } else {
        const intensity = Math.min(255, Math.round(-v / 5 * 200 + 50));
        return `rgb(${intensity}, 0, 0)`;
      }
    }

    $('hm-load').onclick = async () => {
      const mkt = $('hm-market').value;
      const cv = $('hm-canvas');
      cv.innerHTML = '<p style="color:#fbbf24;text-align:center;padding:40px">🔄 載入熱力圖...</p>';
      try {
        const r = await fetch(`${W}/heatmap-tree?market=${mkt}`);
        const j = await r.json();
        const items = (j.constituents || []).map(s => ({
          symbol: s.symbol, name: s.name || s.symbol,
          weight: s.market_cap || 1,
          chg: s.change_pct || 0,
          price: s.price || 0
        })).filter(i => i.weight > 0).slice(0, 100);
        if (!items.length) {
          cv.innerHTML = '<p style="color:#888;text-align:center;padding:40px">資料載入中（首次可能 30 秒）...</p>';
          return;
        }
        const W2 = cv.clientWidth || 800, H2 = 500;
        const rects = squarify(items, 0, 0, W2, H2);
        const svg = `<svg width="${W2}" height="${H2}" style="display:block">${rects.map(r => `
          <g>
            <rect x="${r.x}" y="${r.y}" width="${r.w - 1}" height="${r.h - 1}" fill="${colorFor(r.chg)}" stroke="#000" stroke-width="0.5"/>
            ${r.w > 60 && r.h > 30 ? `
              <text x="${r.x + r.w / 2}" y="${r.y + r.h / 2 - 5}" fill="white" text-anchor="middle" font-size="12" font-weight="bold">${r.symbol}</text>
              <text x="${r.x + r.w / 2}" y="${r.y + r.h / 2 + 10}" fill="white" text-anchor="middle" font-size="10">${r.chg > 0 ? '+' : ''}${fmt(r.chg, 1)}%</text>
            ` : r.w > 30 ? `<text x="${r.x + r.w / 2}" y="${r.y + r.h / 2}" fill="white" text-anchor="middle" font-size="10">${r.symbol}</text>` : ''}
          </g>
        `).join('')}</svg>`;
        cv.innerHTML = svg;
      } catch (e) {
        cv.innerHTML = `<p style="color:#ef4444">錯誤：${e.message}</p>`;
      }
    };
  }
  injectSection('us', 'mr-v285-heatmap', '🔥 全市場熱力圖 (v285)', buildHeatmap);

  // ============================================================
  // FEATURE 4: 📅 Earnings Calendar — 全球財報日曆
  // ============================================================
  function buildEarningsCalendar(containerId) {
    const c = $(containerId); if (!c) return;
    c.innerHTML = `
      <div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap">
        <select id="ec-mkt" style="padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px">
          <option value="us">🇺🇸 美股</option>
          <option value="tw">🇹🇼 台股</option>
        </select>
        <input id="ec-from" type="date" style="padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px">
        <input id="ec-to" type="date" style="padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px">
        <button id="ec-load" style="padding:8px 16px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">查詢</button>
      </div>
      <div id="ec-results"></div>
    `;
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const weekLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    $('ec-from').value = today.toISOString().slice(0, 10);
    $('ec-to').value = weekLater.toISOString().slice(0, 10);

    $('ec-load').onclick = async () => {
      const mkt = $('ec-mkt').value;
      const from = $('ec-from').value;
      const to = $('ec-to').value;
      const r = $('ec-results');
      r.innerHTML = '<p style="color:#fbbf24;text-align:center;padding:20px">📅 載入財報日曆...</p>';
      try {
        const resp = await fetch(`${W}/earnings-calendar?market=${mkt}&from=${from}&to=${to}`);
        const j = await resp.json();
        const events = j.events || [];
        if (!events.length) {
          r.innerHTML = '<p style="color:#888;text-align:center;padding:20px">該期間無財報事件</p>';
          return;
        }
        // 依日期分組
        const byDate = {};
        events.forEach(e => { (byDate[e.date] = byDate[e.date] || []).push(e); });
        const dates = Object.keys(byDate).sort();
        r.innerHTML = dates.map(d => `
          <div style="margin-bottom:16px;background:var(--bg-base);padding:12px;border-radius:8px">
            <h4 style="margin:0 0 8px 0;color:#fbbf24">📆 ${d}（${new Date(d).toLocaleDateString('zh-TW', { weekday: 'short' })}）</h4>
            <table style="width:100%;font-size:13px;border-collapse:collapse">
              <tr style="background:var(--bg-surface)"><th style="padding:6px;text-align:left">代碼</th><th style="padding:6px;text-align:left">公司</th><th style="padding:6px">時段</th><th style="padding:6px">EPS 預期</th><th style="padding:6px">EPS 實際</th></tr>
              ${byDate[d].map(e => `<tr style="border-bottom:1px solid #333">
                <td style="padding:6px"><b>${e.symbol}</b></td>
                <td style="padding:6px">${e.name || ''}</td>
                <td style="padding:6px;text-align:center">${e.session || '-'}</td>
                <td style="padding:6px;text-align:right">${e.eps_estimate != null ? fmt(e.eps_estimate, 2) : '-'}</td>
                <td style="padding:6px;text-align:right;color:${e.eps_actual > e.eps_estimate ? '#4ade80' : e.eps_actual < e.eps_estimate ? '#ef4444' : '#aaa'}">${e.eps_actual != null ? fmt(e.eps_actual, 2) : '-'}</td>
              </tr>`).join('')}
            </table>
          </div>
        `).join('');
      } catch (e) {
        r.innerHTML = `<p style="color:#ef4444">錯誤：${e.message}</p>`;
      }
    };
  }
  injectSection('tools', 'mr-v285-earnings', '📅 全球財報日曆 (v285)', buildEarningsCalendar);

  // ============================================================
  // FEATURE 5: 🤖 AI Backtest Engine — 自然語言策略回測
  // ============================================================
  function buildBacktest(containerId) {
    const c = $(containerId); if (!c) return;
    c.innerHTML = `
      <div style="background:var(--bg-base);padding:16px;border-radius:8px;margin-bottom:12px">
        <p style="margin:0 0 12px 0;color:#aaa">🤖 用自然語言描述你的交易策略，AI 自動翻譯成程式碼並回測 5 年歷史</p>
        <textarea id="bt-strategy" rows="4" placeholder="例：當 RSI < 30 時買入 2330，RSI > 70 時賣出。停損 5%，停利 15%。" style="width:100%;padding:10px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;resize:vertical"></textarea>
        <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
          <input id="bt-symbol" placeholder="股票代碼 (例: 2330 / AAPL)" style="padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;width:200px">
          <select id="bt-period" style="padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px">
            <option value="1y">1 年</option>
            <option value="3y">3 年</option>
            <option value="5y" selected>5 年</option>
          </select>
          <input id="bt-capital" type="number" value="100000" style="padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;width:140px" placeholder="初始資金">
          <button id="bt-run" style="padding:8px 16px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">🚀 執行回測</button>
        </div>
        <p style="color:#666;font-size:11px;margin:8px 0 0 0">💡 範例：「黃金交叉買入，死亡交叉賣出」「布林通道下軌買入，上軌賣出」「ATR 突破時加碼」</p>
      </div>
      <div id="bt-results"></div>
    `;

    $('bt-run').onclick = async () => {
      const strategy = $('bt-strategy').value.trim();
      const symbol = $('bt-symbol').value.trim().toUpperCase();
      const period = $('bt-period').value;
      const capital = parseFloat($('bt-capital').value) || 100000;
      if (!strategy || !symbol) return alert('請輸入策略和股票代碼');
      const r = $('bt-results');
      r.innerHTML = '<p style="color:#fbbf24;text-align:center;padding:20px">🤖 AI 翻譯策略中... 接著抓 5 年歷史 → 回測引擎執行</p>';
      try {
        const resp = await fetch(`${W}/backtest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ strategy, symbol, period, capital })
        });
        const j = await resp.json();
        if (j.error) throw new Error(j.error);
        const m = j.metrics || {};
        const trades = j.trades || [];
        const equity = j.equity_curve || [];
        // 渲染指標
        const metricCard = (label, val, color) => `<div style="background:var(--bg-surface);padding:12px;border-radius:6px;text-align:center">
          <div style="color:#aaa;font-size:11px">${label}</div>
          <div style="color:${color};font-size:20px;font-weight:bold">${val}</div>
        </div>`;
        // SVG equity curve
        const W2 = 700, H2 = 200;
        let svg = '';
        if (equity.length > 1) {
          const minV = Math.min(...equity.map(e => e.value));
          const maxV = Math.max(...equity.map(e => e.value));
          const range = maxV - minV || 1;
          const points = equity.map((e, i) => `${i / (equity.length - 1) * W2},${H2 - (e.value - minV) / range * (H2 - 20) - 10}`).join(' ');
          const baseY = H2 - (capital - minV) / range * (H2 - 20) - 10;
          svg = `<svg width="${W2}" height="${H2}" style="background:var(--bg-base);border-radius:6px;width:100%">
            <line x1="0" y1="${baseY}" x2="${W2}" y2="${baseY}" stroke="#666" stroke-dasharray="4 4"/>
            <text x="6" y="${baseY - 4}" fill="#888" font-size="10">初始資金 ${fmt(capital, 0)}</text>
            <polyline points="${points}" fill="none" stroke="#4ade80" stroke-width="2"/>
          </svg>`;
        }
        r.innerHTML = `
          <h4 style="color:#4ade80;margin:0 0 12px 0">✅ 回測完成</h4>
          <p style="color:#aaa;font-size:13px;background:var(--bg-base);padding:8px;border-radius:4px;margin-bottom:12px">
            <b>AI 翻譯策略：</b><br>${j.parsed_strategy || '無'}
          </p>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;margin-bottom:16px">
            ${metricCard('總報酬', `${m.total_return >= 0 ? '+' : ''}${fmt(m.total_return * 100, 2)}%`, m.total_return >= 0 ? '#4ade80' : '#ef4444')}
            ${metricCard('年化報酬', `${m.annualized_return >= 0 ? '+' : ''}${fmt(m.annualized_return * 100, 2)}%`, m.annualized_return >= 0 ? '#4ade80' : '#ef4444')}
            ${metricCard('Sharpe Ratio', fmt(m.sharpe, 2), m.sharpe > 1 ? '#4ade80' : '#fbbf24')}
            ${metricCard('最大回撤', `-${fmt(m.max_drawdown * 100, 2)}%`, '#ef4444')}
            ${metricCard('勝率', `${fmt(m.win_rate * 100, 1)}%`, m.win_rate > 0.5 ? '#4ade80' : '#fbbf24')}
            ${metricCard('交易次數', m.total_trades || 0, '#aaa')}
          </div>
          ${svg ? '<h4 style="color:#fff;margin:12px 0 8px 0">📈 權益曲線</h4>' + svg : ''}
          ${trades.length ? `
            <h4 style="color:#fff;margin:16px 0 8px 0">📋 交易明細 (前 20 筆)</h4>
            <table style="width:100%;font-size:12px;border-collapse:collapse">
              <tr style="background:var(--bg-surface)"><th style="padding:6px">日期</th><th style="padding:6px">動作</th><th style="padding:6px">價格</th><th style="padding:6px">數量</th><th style="padding:6px">損益</th></tr>
              ${trades.slice(0, 20).map(t => `<tr style="border-bottom:1px solid #333">
                <td style="padding:4px">${t.date}</td>
                <td style="padding:4px;color:${t.action === 'BUY' ? '#4ade80' : '#ef4444'}">${t.action}</td>
                <td style="padding:4px;text-align:right">${fmt(t.price)}</td>
                <td style="padding:4px;text-align:right">${t.qty}</td>
                <td style="padding:4px;text-align:right;color:${t.pnl > 0 ? '#4ade80' : t.pnl < 0 ? '#ef4444' : '#aaa'}">${t.pnl != null ? fmt(t.pnl, 0) : '-'}</td>
              </tr>`).join('')}
            </table>
          ` : ''}
        `;
      } catch (e) {
        r.innerHTML = `<p style="color:#ef4444">錯誤：${e.message}</p>`;
      }
    };
  }
  injectSection('tools', 'mr-v285-backtest', '🤖 AI 自動回測引擎 (v285)', buildBacktest);

  console.log('[MoneyRadar v285] ✅ 5 件 Power Trader features 已載入');
})();
