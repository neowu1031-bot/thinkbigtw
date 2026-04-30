/**
 * MoneyRadar v278 Bundle — Phase B 6 件套（client-side）
 * 1. Watchlist 顏色標記（HSL 個性化）
 * 2. Multi-chart 同步（4 視窗 K 線）
 * 3. Pine Script-like 自定義指標 DSL
 * 4. Paper Trading 模擬交易（localStorage）
 * 5. Tax-loss harvesting 稅損收割提醒
 * 6. User-generated 觀點留言板（純 localStorage）
 */
(function() {
  'use strict';
  const VERSION = 'v278-bundle';
  const SB_URL = 'https://sirhskxufayklqrlxeep.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcmhza3h1ZmF5a2xxcmx4ZWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTc5ODQsImV4cCI6MjA5MDMzMzk4NH0.i0iNEGXq3tkLrQQbGq3WJbNPbNrnrV6ryg8UUB8Bz5g';
  const SB_H = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };

  function $(id) { return document.getElementById(id); }
  function el(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (k === 'style') Object.assign(e.style, attrs.style);
      else if (k === 'class') e.className = attrs.class;
      else e[k] = attrs[k];
    }
    if (children) (Array.isArray(children) ? children : [children]).forEach(c => {
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }
  function fmt(n, d) {
    if (n == null || isNaN(n)) return '-';
    if (Math.abs(n) >= 1e9) return (n/1e9).toFixed(d||1) + 'B';
    if (Math.abs(n) >= 1e6) return (n/1e6).toFixed(d||1) + 'M';
    if (Math.abs(n) >= 1e3) return (n/1e3).toFixed(d||1) + 'K';
    return n.toFixed(d||2);
  }

  // ==============================================================
  // FEATURE 1 — Watchlist 顏色標記（v288）
  // ==============================================================
  function buildWatchlistColors(containerId) {
    const c = $(containerId);
    if (!c) return;
    const COLORS = [
      { v: '', label: '無', bg: 'transparent' },
      { v: 'red', label: '🔴 警戒', bg: '#dc2626' },
      { v: 'orange', label: '🟠 觀察', bg: '#ea580c' },
      { v: 'yellow', label: '🟡 待入', bg: '#eab308' },
      { v: 'green', label: '🟢 持有', bg: '#16a34a' },
      { v: 'blue', label: '🔵 長期', bg: '#2563eb' },
      { v: 'purple', label: '🟣 核心', bg: '#9333ea' }
    ];
    const KEY = 'mr_v278_watchlist_colors';
    function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } }
    function save(map) { try { localStorage.setItem(KEY, JSON.stringify(map)); } catch {} }
    let colorMap = load();

    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:#94a3b8;margin-bottom:8px">🎨 為自選股加顏色標記，幫助快速分類管理</div>' +
      '<div style="display:flex;gap:6px;align-items:center;margin-bottom:10px;flex-wrap:wrap">' +
      '<input id="wlc-sym" placeholder="輸入股票代號" style="padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;width:150px">' +
      '<select id="wlc-color" style="padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px">' +
      COLORS.map(c => '<option value="' + c.v + '">' + c.label + '</option>').join('') +
      '</select>' +
      '<button id="wlc-set" style="padding:6px 12px;background:#2563eb;border:0;color:#fff;border-radius:4px;cursor:pointer">設定</button>' +
      '<button id="wlc-clear" style="padding:6px 12px;background:#475569;border:0;color:#fff;border-radius:4px;cursor:pointer">清除全部</button>' +
      '</div><div id="wlc-list"></div></div>';

    function render() {
      colorMap = load();
      const items = Object.entries(colorMap);
      if (!items.length) {
        $('wlc-list').innerHTML = '<div style="color:#94a3b8;font-size:12px;padding:8px">尚未設定任何顏色標記。輸入股票代號 + 選顏色 + 點設定。</div>';
        return;
      }
      let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px">';
      items.forEach(([sym, col]) => {
        const c2 = COLORS.find(x => x.v === col) || COLORS[0];
        html += '<div style="display:flex;align-items:center;gap:6px;padding:6px;background:rgba(' +
          (col === 'red' ? '220,38,38' : col === 'green' ? '22,163,74' : col === 'blue' ? '37,99,235' :
           col === 'orange' ? '234,88,12' : col === 'yellow' ? '234,179,8' : col === 'purple' ? '147,51,234' : '71,85,105') +
          ',0.15);border:1px solid ' + c2.bg + ';border-radius:4px;font-size:12px">' +
          '<span style="display:inline-block;width:10px;height:10px;background:' + c2.bg + ';border-radius:50%"></span>' +
          '<span style="color:#fff;font-weight:600">' + sym + '</span>' +
          '<span style="color:#94a3b8;flex:1">' + c2.label + '</span>' +
          '<button data-rm="' + sym + '" style="background:transparent;border:0;color:#f87171;cursor:pointer;font-size:14px">×</button></div>';
      });
      html += '</div>';
      $('wlc-list').innerHTML = html;
      $('wlc-list').querySelectorAll('button[data-rm]').forEach(b => {
        b.addEventListener('click', () => {
          const sym = b.dataset.rm;
          delete colorMap[sym];
          save(colorMap);
          render();
        });
      });
    }
    $('wlc-set').addEventListener('click', () => {
      const sym = $('wlc-sym').value.trim().toUpperCase();
      if (!sym) return;
      colorMap[sym] = $('wlc-color').value;
      save(colorMap);
      $('wlc-sym').value = '';
      render();
    });
    $('wlc-clear').addEventListener('click', () => {
      if (!confirm('清除所有顏色標記？')) return;
      colorMap = {};
      save(colorMap);
      render();
    });
    render();
  }

  // ==============================================================
  // FEATURE 2 — Multi-Chart 同步（v289）
  // 4 個小 K 線同畫面，比較走勢
  // ==============================================================
  function buildMultiChart(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:#94a3b8;margin-bottom:8px">📊 多股 K 線同步比較（最多 4 檔同畫面）</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:10px"><input id="mc-syms" placeholder="代號逗號分隔，例: 2330,2454,2308,3711" value="2330,2454,2308,3711" style="flex:1;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px">' +
      '<button id="mc-go" style="padding:6px 14px;background:#2563eb;border:0;color:#fff;border-radius:4px;cursor:pointer">載入</button></div>' +
      '<div id="mc-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"></div></div>';
    $('mc-go').addEventListener('click', async () => {
      const syms = $('mc-syms').value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 4);
      const grid = $('mc-grid');
      grid.innerHTML = '<div style="grid-column:1 / -1;color:#94a3b8;padding:10px">⏳ 載入中...</div>';
      const since = new Date(Date.now() - 60 * 24 * 3600e3).toISOString().slice(0, 10);
      const results = await Promise.all(syms.map(async s => {
        try {
          const r = await fetch(SB_URL + '/rest/v1/daily_prices?symbol=eq.' + s +
            '&date=gte.' + since + '&select=date,close_price&order=date.asc&limit=200', { headers: SB_H });
          const data = await r.json();
          return { sym: s, data: Array.isArray(data) ? data : [] };
        } catch { return { sym: s, data: [] }; }
      }));
      grid.innerHTML = '';
      results.forEach(r => {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'background:#0a0f1c;border-radius:6px;padding:10px;border:1px solid #1e293b';
        if (!r.data.length) {
          wrap.innerHTML = '<div style="color:#94a3b8">' + r.sym + ' 無資料</div>';
        } else {
          const closes = r.data.map(d => d.close_price);
          const min = Math.min.apply(null, closes), max = Math.max.apply(null, closes);
          const first = closes[0], last = closes[closes.length - 1];
          const chg = ((last - first) / first) * 100;
          const W = 320, H = 120;
          const path = closes.map((p, i) => {
            const x = (i / (closes.length - 1)) * W;
            const y = H - ((p - min) / (max - min || 1)) * (H - 10) - 5;
            return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
          }).join('');
          const color = chg >= 0 ? '#34d399' : '#f87171';
          wrap.innerHTML = '<div style="display:flex;justify-content:space-between;margin-bottom:4px">' +
            '<span style="font-weight:700;color:#fff">' + r.sym + '</span>' +
            '<span style="color:' + color + ';font-weight:700">' + (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%</span>' +
            '</div>' +
            '<svg width="100%" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
            '<path d="' + path + '" stroke="' + color + '" stroke-width="1.5" fill="none"/></svg>' +
            '<div style="display:flex;justify-content:space-between;font-size:11px;color:#64748b;margin-top:4px">' +
            '<span>' + r.data[0].date + '</span>' +
            '<span>$' + last.toFixed(2) + '</span>' +
            '<span>' + r.data[r.data.length - 1].date + '</span></div>';
        }
        grid.appendChild(wrap);
      });
    });
  }

  // ==============================================================
  // FEATURE 3 — Pine Script-like 自定義指標（v290）
  // 簡易 DSL：用戶寫公式 → eval → 套到歷史 K 線
  // ==============================================================
  function buildPineScript(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:#94a3b8;margin-bottom:8px">📐 自定義技術指標 DSL（類似 Pine Script 簡化版）</div>' +
      '<div style="display:grid;grid-template-columns:120px 1fr 80px;gap:6px;margin-bottom:6px">' +
      '<input id="ps-sym" value="2330" placeholder="代號" style="padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px">' +
      '<input id="ps-formula" value="sma(close, 20) - sma(close, 60)" placeholder="公式 (sma/ema/rsi/diff/close/high/low/volume)" style="padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;font-family:monospace">' +
      '<button id="ps-go" style="padding:6px;background:#7c3aed;border:0;color:#fff;border-radius:4px;cursor:pointer">執行</button>' +
      '</div><div style="font-size:11px;color:#64748b;margin-bottom:6px">支援: sma(arr,n) ema(arr,n) rsi(arr,n) diff(arr) shift(arr,n) max/min/abs · 變數: close high low volume</div>' +
      '<canvas id="ps-canvas" width="800" height="240" style="background:#0a0f1c;border-radius:6px;width:100%"></canvas>' +
      '<div id="ps-info" style="margin-top:6px;font-size:11px;color:#64748b"></div></div>';
    function sma(arr, n) {
      const out = new Array(arr.length).fill(null);
      let s = 0;
      for (let i = 0; i < arr.length; i++) {
        s += arr[i];
        if (i >= n) s -= arr[i - n];
        if (i >= n - 1) out[i] = s / n;
      }
      return out;
    }
    function ema(arr, n) {
      const out = new Array(arr.length).fill(null);
      const k = 2 / (n + 1);
      let prev = null;
      for (let i = 0; i < arr.length; i++) {
        if (i < n - 1) continue;
        if (prev == null) {
          let s = 0;
          for (let j = 0; j <= i; j++) s += arr[j];
          prev = s / (i + 1);
        } else {
          prev = arr[i] * k + prev * (1 - k);
        }
        out[i] = prev;
      }
      return out;
    }
    function rsi(arr, n) {
      const out = new Array(arr.length).fill(null);
      let gain = 0, loss = 0;
      for (let i = 1; i < arr.length; i++) {
        const d = arr[i] - arr[i - 1];
        const g = d > 0 ? d : 0, l = d < 0 ? -d : 0;
        if (i <= n) { gain += g; loss += l;
          if (i === n) { gain /= n; loss /= n; out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss); }
        } else {
          gain = (gain * (n - 1) + g) / n;
          loss = (loss * (n - 1) + l) / n;
          out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
        }
      }
      return out;
    }
    function diff(arr) { return arr.map((x, i) => i === 0 ? null : (x == null || arr[i - 1] == null ? null : x - arr[i - 1])); }
    function shift(arr, n) { return arr.map((x, i) => arr[i - n]); }
    function arrSub(a, b) { return a.map((x, i) => (x == null || b[i] == null) ? null : x - b[i]); }

    $('ps-go').addEventListener('click', async () => {
      const sym = $('ps-sym').value.trim();
      const formula = $('ps-formula').value;
      const since = new Date(Date.now() - 365 * 24 * 3600e3).toISOString().slice(0, 10);
      $('ps-info').textContent = '⏳ 抓資料中...';
      const r = await fetch(SB_URL + '/rest/v1/daily_prices?symbol=eq.' + sym +
        '&date=gte.' + since + '&select=date,close_price,high_price,low_price,volume&order=date.asc&limit=500', { headers: SB_H });
      const data = await r.json();
      if (!Array.isArray(data) || data.length < 60) {
        $('ps-info').textContent = '⚠️ 資料不足';
        return;
      }
      const close = data.map(d => d.close_price);
      const high = data.map(d => d.high_price || d.close_price);
      const low = data.map(d => d.low_price || d.close_price);
      const volume = data.map(d => d.volume || 0);
      // sandbox eval
      let result;
      try {
        const fn = new Function('close', 'high', 'low', 'volume', 'sma', 'ema', 'rsi', 'diff', 'shift', 'max', 'min', 'abs',
          'return (' + formula + ');');
        result = fn(close, high, low, volume, sma, ema, rsi, diff, shift, Math.max, Math.min, Math.abs);
      } catch (e) {
        $('ps-info').textContent = '❌ 公式錯誤: ' + e.message;
        return;
      }
      if (!Array.isArray(result)) {
        $('ps-info').textContent = '⚠️ 公式必須回傳陣列。範例: sma(close, 20)';
        return;
      }
      // draw close + indicator
      const cv = $('ps-canvas'), ctx = cv.getContext('2d');
      const W = cv.width, H = cv.height;
      ctx.fillStyle = '#0a0f1c'; ctx.fillRect(0, 0, W, H);
      const validIdx = result.map((v, i) => v != null && !isNaN(v) ? i : -1).filter(i => i >= 0);
      if (!validIdx.length) { $('ps-info').textContent = '⚠️ 無有效計算結果'; return; }
      const cMin = Math.min.apply(null, close), cMax = Math.max.apply(null, close);
      const rVals = validIdx.map(i => result[i]);
      const rMin = Math.min.apply(null, rVals), rMax = Math.max.apply(null, rVals);
      // close (top half)
      ctx.strokeStyle = '#94a3b8'; ctx.lineWidth = 1;
      ctx.beginPath();
      close.forEach((p, i) => {
        const x = (i / (close.length - 1)) * W;
        const y = (H * 0.5) - ((p - cMin) / (cMax - cMin || 1)) * (H * 0.5 - 10) - 5;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.font = '10px sans-serif'; ctx.fillStyle = '#64748b';
      ctx.fillText(sym + ' close', 5, 12);
      // indicator (bottom half)
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      let firstDrawn = false;
      result.forEach((v, i) => {
        if (v == null || isNaN(v)) return;
        const x = (i / (result.length - 1)) * W;
        const y = H - ((v - rMin) / (rMax - rMin || 1)) * (H * 0.45 - 10) - 5;
        if (!firstDrawn) { ctx.moveTo(x, y); firstDrawn = true; }
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(formula, 5, H * 0.5 + 14);
      $('ps-info').textContent = '✓ 計算成功 · ' + validIdx.length + ' 點 · 範圍 [' + rMin.toFixed(2) + ', ' + rMax.toFixed(2) + '] · 最新值: ' + result[result.length - 1]?.toFixed(4);
    });
  }

  // ==============================================================
  // FEATURE 4 — Paper Trading 模擬交易（v291）
  // ==============================================================
  function buildPaperTrade(containerId) {
    const c = $(containerId);
    if (!c) return;
    const KEY = 'mr_v278_paper_account';
    function load() {
      try { return JSON.parse(localStorage.getItem(KEY)) || { cash: 1000000, holdings: {}, history: [] }; }
      catch { return { cash: 1000000, holdings: {}, history: [] }; }
    }
    function save(acc) { localStorage.setItem(KEY, JSON.stringify(acc)); }
    let acc = load();

    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:#94a3b8;margin-bottom:8px">📒 模擬交易：起始 NT$1,000,000，練習投資不冒險</div>' +
      '<div id="pt-summary" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 80px 80px;gap:6px;margin-bottom:10px">' +
      '<input id="pt-sym" placeholder="代號" style="padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px">' +
      '<input id="pt-shares" type="number" placeholder="股數" style="padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px">' +
      '<input id="pt-price" type="number" step="0.01" placeholder="價格" style="padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px">' +
      '<button id="pt-buy" style="padding:6px;background:#16a34a;border:0;color:#fff;border-radius:4px;cursor:pointer">買進</button>' +
      '<button id="pt-sell" style="padding:6px;background:#dc2626;border:0;color:#fff;border-radius:4px;cursor:pointer">賣出</button>' +
      '</div><div id="pt-holdings" style="margin-bottom:10px"></div>' +
      '<details><summary style="cursor:pointer;color:#94a3b8;font-size:12px">📜 交易歷史 (' + acc.history.length + ')</summary><div id="pt-history" style="margin-top:6px;max-height:200px;overflow:auto"></div></details>' +
      '<button id="pt-reset" style="margin-top:10px;padding:6px 12px;background:#475569;border:0;color:#fff;border-radius:4px;cursor:pointer;font-size:12px">↺ 重置帳戶</button></div>';

    function totalValue() {
      let h = 0;
      Object.entries(acc.holdings).forEach(([s, h2]) => { h += h2.shares * (h2.last || h2.avgCost); });
      return acc.cash + h;
    }
    function render() {
      const tv = totalValue();
      const ret = ((tv - 1000000) / 1000000) * 100;
      $('pt-summary').innerHTML =
        '<div style="background:rgba(96,165,250,0.05);border:1px solid rgba(96,165,250,0.3);border-radius:6px;padding:10px"><div style="color:#94a3b8;font-size:11px">💵 現金</div><div style="font-size:18px;font-weight:700">$' + fmt(acc.cash) + '</div></div>' +
        '<div style="background:rgba(168,85,247,0.05);border:1px solid rgba(168,85,247,0.3);border-radius:6px;padding:10px"><div style="color:#94a3b8;font-size:11px">📊 總市值</div><div style="font-size:18px;font-weight:700">$' + fmt(tv) + '</div></div>' +
        '<div style="background:rgba(' + (ret >= 0 ? '52,211,153' : '248,113,113') + ',0.05);border:1px solid rgba(' + (ret >= 0 ? '52,211,153' : '248,113,113') + ',0.3);border-radius:6px;padding:10px"><div style="color:#94a3b8;font-size:11px">📈 總報酬</div><div style="font-size:18px;font-weight:700;color:' + (ret >= 0 ? '#34d399' : '#f87171') + '">' + (ret >= 0 ? '+' : '') + ret.toFixed(2) + '%</div></div>';

      const items = Object.entries(acc.holdings);
      if (!items.length) {
        $('pt-holdings').innerHTML = '<div style="color:#94a3b8;font-size:12px;padding:8px">尚未持有任何股票</div>';
      } else {
        let html = '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="border-bottom:1px solid #334155;color:#94a3b8"><th style="padding:6px;text-align:left">代號</th><th style="text-align:right">股數</th><th style="text-align:right">均價</th><th style="text-align:right">市值</th></tr></thead><tbody>';
        items.forEach(([s, h]) => {
          const v = h.shares * (h.last || h.avgCost);
          html += '<tr style="border-bottom:1px solid #1e293b"><td style="padding:6px">' + s + '</td><td style="text-align:right">' + h.shares.toLocaleString() + '</td><td style="text-align:right">' + h.avgCost.toFixed(2) + '</td><td style="text-align:right">' + fmt(v) + '</td></tr>';
        });
        html += '</tbody></table>';
        $('pt-holdings').innerHTML = html;
      }
      $('pt-history').innerHTML = acc.history.slice(-30).reverse().map(h =>
        '<div style="padding:4px 8px;border-bottom:1px solid #1e293b;font-size:11px;color:#94a3b8">' +
        h.date + ' · <span style="color:' + (h.type === 'buy' ? '#34d399' : '#f87171') + '">' + (h.type === 'buy' ? '買' : '賣') + '</span> ' +
        h.sym + ' × ' + h.shares + ' @ $' + h.price.toFixed(2) + ' = $' + fmt(h.shares * h.price) + '</div>'
      ).join('') || '<div style="color:#64748b;font-size:11px">無交易紀錄</div>';
    }

    $('pt-buy').addEventListener('click', () => {
      const s = $('pt-sym').value.trim().toUpperCase();
      const sh = parseInt($('pt-shares').value);
      const p = parseFloat($('pt-price').value);
      if (!s || !sh || !p) { alert('請填代號、股數、價格'); return; }
      const cost = sh * p;
      if (cost > acc.cash) { alert('現金不足（需 $' + fmt(cost) + '）'); return; }
      acc.cash -= cost;
      const h = acc.holdings[s] || { shares: 0, avgCost: 0, last: p };
      const totalCost = h.shares * h.avgCost + cost;
      h.shares += sh;
      h.avgCost = totalCost / h.shares;
      h.last = p;
      acc.holdings[s] = h;
      acc.history.push({ date: new Date().toISOString().slice(0, 10), type: 'buy', sym: s, shares: sh, price: p });
      save(acc); render();
    });
    $('pt-sell').addEventListener('click', () => {
      const s = $('pt-sym').value.trim().toUpperCase();
      const sh = parseInt($('pt-shares').value);
      const p = parseFloat($('pt-price').value);
      if (!s || !sh || !p) { alert('請填代號、股數、價格'); return; }
      const h = acc.holdings[s];
      if (!h || h.shares < sh) { alert('持股不足'); return; }
      acc.cash += sh * p;
      h.shares -= sh;
      h.last = p;
      if (h.shares === 0) delete acc.holdings[s];
      else acc.holdings[s] = h;
      acc.history.push({ date: new Date().toISOString().slice(0, 10), type: 'sell', sym: s, shares: sh, price: p });
      save(acc); render();
    });
    $('pt-reset').addEventListener('click', () => {
      if (!confirm('重置帳戶（清空持股+現金回 100 萬）？')) return;
      acc = { cash: 1000000, holdings: {}, history: [] };
      save(acc); render();
    });
    render();
  }

  // ==============================================================
  // FEATURE 5 — Tax-Loss Harvesting 稅損收割（v292）
  // ==============================================================
  function buildTaxLoss(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:#94a3b8;margin-bottom:8px">💸 稅損收割：找出帳上虧損股票，賣出實現虧損 → 抵減資本利得稅</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr 100px;gap:6px;margin-bottom:6px">' +
      '<input id="tl-sym" placeholder="代號" style="padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px">' +
      '<input id="tl-shares" type="number" placeholder="股數" style="padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px">' +
      '<input id="tl-cost" type="number" step="0.01" placeholder="成本價" style="padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px">' +
      '<button id="tl-add" style="padding:6px;background:#2563eb;border:0;color:#fff;border-radius:4px;cursor:pointer">加入</button>' +
      '</div><div style="display:flex;align-items:center;gap:6px;margin-bottom:10px"><label style="font-size:12px;color:#94a3b8">資本利得 (本年已實現獲利):</label>' +
      '<input id="tl-gains" type="number" value="500000" style="padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;width:120px">' +
      '<label style="font-size:12px;color:#94a3b8">稅率 %:</label>' +
      '<input id="tl-rate" type="number" value="20" style="padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;width:60px"></div>' +
      '<div id="tl-list" style="margin-bottom:10px"></div>' +
      '<button id="tl-analyze" style="width:100%;padding:10px;background:#dc2626;border:0;color:#fff;border-radius:6px;font-weight:700;cursor:pointer">執行稅損分析</button>' +
      '<div id="tl-result" style="margin-top:10px"></div></div>';

    const positions = [];
    function renderList() {
      $('tl-list').innerHTML = positions.length === 0 ?
        '<div style="color:#94a3b8;font-size:12px;padding:8px">尚未加入任何持股</div>' :
        '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="border-bottom:1px solid #334155;color:#94a3b8"><th style="padding:6px;text-align:left">代號</th><th style="text-align:right">股數</th><th style="text-align:right">成本價</th><th></th></tr></thead><tbody>' +
        positions.map((p, i) =>
          '<tr style="border-bottom:1px solid #1e293b"><td style="padding:6px">' + p.sym + '</td><td style="text-align:right">' + p.shares.toLocaleString() + '</td><td style="text-align:right">' + p.cost.toFixed(2) + '</td><td><button data-i="' + i + '" class="tl-rm" style="background:transparent;border:0;color:#f87171;cursor:pointer">×</button></td></tr>'
        ).join('') + '</tbody></table>';
      $('tl-list').querySelectorAll('.tl-rm').forEach(b => b.addEventListener('click', () => {
        positions.splice(parseInt(b.dataset.i), 1); renderList();
      }));
    }
    $('tl-add').addEventListener('click', () => {
      const sym = $('tl-sym').value.trim().toUpperCase();
      const sh = parseInt($('tl-shares').value);
      const co = parseFloat($('tl-cost').value);
      if (!sym || !sh || !co) return;
      positions.push({ sym, shares: sh, cost: co });
      $('tl-sym').value = ''; $('tl-shares').value = ''; $('tl-cost').value = '';
      renderList();
    });
    $('tl-analyze').addEventListener('click', async () => {
      if (positions.length === 0) { $('tl-result').innerHTML = '<div style="color:#fbbf24;padding:10px">⚠️ 請先加入持股</div>'; return; }
      $('tl-result').innerHTML = '<div style="color:#94a3b8;padding:10px">⏳ 抓最新價計算未實現損益...</div>';
      const today = new Date(Date.now() - 24 * 3600e3).toISOString().slice(0, 10);
      const syms = positions.map(p => p.sym).join(',');
      const r = await fetch(SB_URL + '/rest/v1/daily_prices?symbol=in.(' + syms + ')&date=gte.' + today +
        '&select=symbol,close_price&order=date.desc', { headers: SB_H });
      const prices = await r.json();
      const priceMap = new Map();
      prices.forEach(p => { if (!priceMap.has(p.symbol)) priceMap.set(p.symbol, p.close_price); });
      const losses = [];
      positions.forEach(p => {
        const last = priceMap.get(p.sym);
        if (!last) return;
        const pl = (last - p.cost) * p.shares;
        if (pl < 0) losses.push({ ...p, last, pl });
      });
      const gains = parseFloat($('tl-gains').value) || 0;
      const rate = (parseFloat($('tl-rate').value) || 20) / 100;
      const totalLoss = losses.reduce((s, l) => s + l.pl, 0);
      const offsetable = Math.min(Math.abs(totalLoss), gains);
      const taxSaved = offsetable * rate;
      let html = '<div style="padding:10px;background:rgba(220,38,38,0.05);border:1px solid rgba(220,38,38,0.3);border-radius:6px">';
      if (losses.length === 0) {
        html += '<div style="color:#34d399;font-weight:700">✅ 沒有未實現虧損部位 — 你目前所有持股都在獲利</div>';
      } else {
        html += '<div style="font-size:18px;color:#f87171;font-weight:700;margin-bottom:6px">💸 可收割虧損 ' + losses.length + ' 檔，合計 $' + fmt(Math.abs(totalLoss)) + '</div>' +
          '<table style="width:100%;border-collapse:collapse;font-size:12px;margin:8px 0"><thead><tr style="border-bottom:1px solid #334155;color:#94a3b8"><th style="padding:4px;text-align:left">代號</th><th style="text-align:right">成本</th><th style="text-align:right">現價</th><th style="text-align:right">虧損</th></tr></thead><tbody>' +
          losses.map(l => '<tr><td style="padding:4px">' + l.sym + '</td><td style="text-align:right">$' + l.cost.toFixed(2) + '</td><td style="text-align:right">$' + l.last.toFixed(2) + '</td><td style="text-align:right;color:#f87171">$' + fmt(l.pl) + '</td></tr>').join('') +
          '</tbody></table>' +
          '<div style="font-size:13px;color:#fff;line-height:1.6">已實現獲利 $' + fmt(gains) + ' × ' + (rate * 100) + '% = 應稅 $' + fmt(gains * rate) + '<br>' +
          '可抵減金額 = min(虧損, 獲利) = $' + fmt(offsetable) + '<br>' +
          '<span style="color:#34d399;font-weight:700">💰 預估省稅 $' + fmt(taxSaved) + '</span></div>' +
          '<div style="margin-top:8px;font-size:11px;color:#fbbf24">⚠️ 注意：賣出後 30 天內不可買回相同證券（wash sale rule, 適用美股；台灣無此限制但建議避免）</div>';
      }
      html += '</div>';
      $('tl-result').innerHTML = html;
    });
    renderList();
  }

  // ==============================================================
  // FEATURE 6 — User-Generated 觀點留言板（v293）
  // 純 localStorage，無 backend
  // ==============================================================
  function buildOpinions(containerId) {
    const c = $(containerId);
    if (!c) return;
    const KEY = 'mr_v278_opinions';
    function load() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
    function save(arr) { localStorage.setItem(KEY, JSON.stringify(arr)); }
    let opinions = load();

    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:#94a3b8;margin-bottom:8px">💭 投資筆記 / 觀點記錄（離線儲存於本機）</div>' +
      '<div style="display:grid;grid-template-columns:120px 1fr 80px;gap:6px;margin-bottom:6px">' +
      '<input id="op-sym" placeholder="標的 (如 2330)" style="padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px">' +
      '<input id="op-text" placeholder="你的觀點（為什麼想買/賣/觀察）" style="padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px">' +
      '<button id="op-add" style="padding:6px;background:#2563eb;border:0;color:#fff;border-radius:4px;cursor:pointer">記錄</button>' +
      '</div><div style="display:flex;gap:6px;margin-bottom:10px"><input id="op-search" placeholder="搜尋..." style="flex:1;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px">' +
      '<button id="op-export" style="padding:6px 10px;background:#475569;border:0;color:#fff;border-radius:4px;cursor:pointer;font-size:12px">匯出 JSON</button></div>' +
      '<div id="op-list" style="max-height:400px;overflow:auto"></div></div>';

    function render() {
      opinions = load();
      const q = ($('op-search')?.value || '').toLowerCase();
      const list = opinions.filter(o => !q || (o.sym + ' ' + o.text).toLowerCase().includes(q));
      $('op-list').innerHTML = list.length === 0 ?
        '<div style="color:#94a3b8;font-size:12px;padding:8px">' + (q ? '無符合' : '尚無記錄') + '</div>' :
        list.slice().reverse().map((o, i) =>
          '<div style="padding:10px;border-bottom:1px solid #1e293b;font-size:13px">' +
          '<div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:#fbbf24;font-weight:700">' + o.sym + '</span><span style="color:#64748b;font-size:11px">' + o.date + ' <button data-i="' + (opinions.length - 1 - i) + '" class="op-rm" style="background:transparent;border:0;color:#f87171;cursor:pointer">×</button></span></div>' +
          '<div style="color:#cbd5e1;line-height:1.5">' + o.text.replace(/</g, '&lt;') + '</div></div>'
        ).join('');
      $('op-list').querySelectorAll('.op-rm').forEach(b => b.addEventListener('click', () => {
        opinions.splice(parseInt(b.dataset.i), 1); save(opinions); render();
      }));
    }
    $('op-add').addEventListener('click', () => {
      const sym = $('op-sym').value.trim().toUpperCase();
      const text = $('op-text').value.trim();
      if (!sym || !text) return;
      opinions.push({ sym, text, date: new Date().toISOString().slice(0, 16).replace('T', ' ') });
      save(opinions);
      $('op-sym').value = ''; $('op-text').value = '';
      render();
    });
    $('op-search').addEventListener('input', render);
    $('op-export').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(opinions, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'moneyradar-opinions-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click(); URL.revokeObjectURL(url);
    });
    render();
  }

  // ==============================================================
  // BUNDLE INIT
  // ==============================================================
  function injectSection(parentTab, id, title, builder) {
    const tab = $(parentTab);
    if (!tab) return;
    if ($(id)) return;
    const wrapper = el('div', { class: 'section', style: { marginTop: '20px' } });
    wrapper.dataset.v275Key = id;
    wrapper.innerHTML = '<div class="section-title" style="font-weight:700;font-size:16px;margin-bottom:10px">' + title + '</div><div id="' + id + '"></div>';
    tab.appendChild(wrapper);
    builder(id);
  }

  function buildAll() {
    injectSection('tab-watchlist', 'v288-colors', '🎨 自選股顏色標記', buildWatchlistColors);
    injectSection('tab-tools', 'v289-multichart', '📊 多股 K 線同步比較', buildMultiChart);
    injectSection('tab-tools', 'v290-pinescript', '📐 自定義指標 DSL（Pine Script-like）', buildPineScript);
    injectSection('tab-tools', 'v291-paper', '📒 模擬交易（Paper Trading）', buildPaperTrade);
    injectSection('tab-tools', 'v292-taxloss', '💸 稅損收割（Tax-Loss Harvesting）', buildTaxLoss);
    injectSection('tab-portfolio', 'v293-opinions', '💭 投資筆記 / 觀點', buildOpinions);
  }

  function ready() {
    buildAll();
    document.addEventListener('click', e => {
      if (e.target.closest('[data-tab],.tab-btn,[role=tab]')) {
        setTimeout(buildAll, 400);
      }
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();

  window.v278 = {
    version: VERSION,
    rebuild: buildAll,
    colors: buildWatchlistColors,
    multichart: buildMultiChart,
    pinescript: buildPineScript,
    paper: buildPaperTrade,
    taxloss: buildTaxLoss,
    opinions: buildOpinions
  };
  console.log('[' + VERSION + '] 6 features loaded');
})();
