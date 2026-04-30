/**
 * MoneyRadar v277-v286 Mega Bundle
 * Phase A+B 9 件套：Heat Map / Pre+After / DCF / Risk / Peer / Backtest / Screener Pro / Bar Replay / 13F
 * 對標世界第一級工具（TradingView / Finviz / Seeking Alpha / Bloomberg）
 *
 * 全部 client-side，只 add fetch 用既有 Supabase / Worker endpoints。
 */
(function() {
  'use strict';
  const VERSION = 'v277-bundle';
  const SB_URL = 'https://sirhskxufayklqrlxeep.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcmhza3h1ZmF5a2xxcmx4ZWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTc5ODQsImV4cCI6MjA5MDMzMzk4NH0.i0iNEGXq3tkLrQQbGq3WJbNPbNrnrV6ryg8UUB8Bz5g';
  const SB_H = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };
  const W = 'https://moneyradar-ai-proxy.thinkbigtw.workers.dev';

  function $(id) { return document.getElementById(id); }
  function el(tag, props, children) {
    const e = document.createElement(tag);
    if (props) Object.assign(e.style, props.style || {});
    if (props) for (const k in props) if (k !== 'style') e[k] = props[k];
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(c => {
        e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return e;
  }
  function fmt(n, d) {
    if (n == null || isNaN(n)) return '-';
    if (Math.abs(n) >= 1e12) return (n/1e12).toFixed(d||1) + 'T';
    if (Math.abs(n) >= 1e9) return (n/1e9).toFixed(d||1) + 'B';
    if (Math.abs(n) >= 1e6) return (n/1e6).toFixed(d||1) + 'M';
    if (Math.abs(n) >= 1e3) return (n/1e3).toFixed(d||1) + 'K';
    return n.toFixed(d||2);
  }

  function loadScript(src, cb) {
    if (document.querySelector('script[src="' + src + '"]')) return cb && cb();
    const s = document.createElement('script');
    s.src = src; s.onload = cb; s.onerror = () => console.warn('[' + VERSION + '] script load fail', src);
    document.head.appendChild(s);
  }

  // ==============================================================
  // FEATURE 1 — Heat Map（v277）
  // 對標 Finviz Heat Map：treemap 視覺，個股大小=市值代理（成交量），顏色=漲跌幅
  // ==============================================================
  async function buildHeatMap(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="color:#888;padding:20px">📊 載入熱力圖資料中...</div>';
    try {
      // 抓最近一天的 daily_prices（兩天內）
      const today = new Date(Date.now() - 24 * 3600e3).toISOString().slice(0, 10);
      const r = await fetch(SB_URL + '/rest/v1/daily_prices?date=gte.' + today +
        '&select=symbol,date,close_price,open_price,volume&order=date.desc&limit=500', { headers: SB_H });
      const rows = await r.json();
      if (!Array.isArray(rows) || rows.length === 0) {
        c.innerHTML = '<div style="color:#888;padding:20px">⚠️ 暫無資料</div>';
        return;
      }
      // 取每股最新價 + 計算漲跌（用 open->close）
      const map = new Map();
      rows.forEach(r => {
        if (!map.has(r.symbol)) map.set(r.symbol, r);
      });
      // 取前 100 大成交量股票
      const arr = Array.from(map.values())
        .filter(r => r.volume && r.close_price && r.open_price)
        .map(r => ({
          symbol: r.symbol,
          value: r.volume * r.close_price,  // 成交額代理市值
          change_pct: ((r.close_price - r.open_price) / r.open_price) * 100,
          close: r.close_price,
          volume: r.volume
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 100);

      if (arr.length === 0) {
        c.innerHTML = '<div style="color:#888;padding:20px">⚠️ 今日無有效成交資料</div>';
        return;
      }

      const total = arr.reduce((s, x) => s + x.value, 0);
      const W = c.clientWidth || 1000;
      const H = 480;

      // Squarified treemap 簡易實作（不依賴 D3，自己做）
      function squarify(items, width, height) {
        const out = [];
        let x = 0, y = 0, w = width, h = height;
        const list = items.slice();
        while (list.length) {
          const remaining = list.reduce((s, x) => s + x.value, 0);
          // 取一行直到比例變壞
          const row = []; let rowSum = 0;
          const minDim = Math.min(w, h);
          while (list.length) {
            row.push(list[0]);
            rowSum = row.reduce((s, x) => s + x.value, 0);
            if (row.length >= 2) {
              // worst aspect ratio check
              const rowArea = (rowSum / remaining) * w * h;
              const rowSize = minDim;
              const worst = Math.max.apply(null, row.map(it => {
                const a = (it.value / rowSum) * rowArea / rowSize;
                return Math.max(a / rowSize, rowSize / a);
              }));
              if (row.length > 1) {
                const prevRow = row.slice(0, -1);
                const prevSum = prevRow.reduce((s, x) => s + x.value, 0);
                const prevWorst = Math.max.apply(null, prevRow.map(it => {
                  const pa = (prevSum / remaining) * w * h;
                  const a = (it.value / prevSum) * pa / rowSize;
                  return Math.max(a / rowSize, rowSize / a);
                }));
                if (worst > prevWorst) {
                  row.pop();
                  break;
                }
              }
            }
            list.shift();
          }
          // 把 row 排版
          const rowAreaSum = row.reduce((s, x) => s + x.value, 0);
          if (w >= h) {
            const rowW = (rowAreaSum / remaining) * w;
            let yy = y;
            row.forEach(it => {
              const itH = (it.value / rowAreaSum) * h;
              out.push({ ...it, x, y: yy, w: rowW, h: itH });
              yy += itH;
            });
            x += rowW; w -= rowW;
          } else {
            const rowH = (rowAreaSum / remaining) * h;
            let xx = x;
            row.forEach(it => {
              const itW = (it.value / rowAreaSum) * w;
              out.push({ ...it, x: xx, y, w: itW, h: rowH });
              xx += itW;
            });
            y += rowH; h -= rowH;
          }
        }
        return out;
      }

      const cells = squarify(arr, W, H);

      function color(p) {
        if (p > 5) return '#0d8043';
        if (p > 2) return '#16a34a';
        if (p > 0.3) return '#65a30d';
        if (p > -0.3) return '#525252';
        if (p > -2) return '#dc2626';
        if (p > -5) return '#b91c1c';
        return '#7f1d1d';
      }

      let html = '<svg width="' + W + '" height="' + H + '" style="font-family:-apple-system,system-ui,sans-serif">';
      cells.forEach(it => {
        const c2 = color(it.change_pct);
        const fontSize = Math.max(8, Math.min(18, Math.sqrt(it.w * it.h) / 8));
        html += '<g transform="translate(' + it.x + ',' + it.y + ')" style="cursor:pointer" data-symbol="' + it.symbol + '">';
        html += '<rect width="' + (it.w - 1) + '" height="' + (it.h - 1) + '" fill="' + c2 + '" stroke="#0a0a0a" stroke-width="0.5"/>';
        if (it.w > 30 && it.h > 20) {
          html += '<text x="' + (it.w / 2) + '" y="' + (it.h / 2 - 2) + '" text-anchor="middle" fill="#fff" font-size="' + fontSize + '" font-weight="700">' + it.symbol + '</text>';
          if (it.h > 40) {
            html += '<text x="' + (it.w / 2) + '" y="' + (it.h / 2 + fontSize) + '" text-anchor="middle" fill="#fff" font-size="' + (fontSize * 0.75) + '" opacity="0.95">' + (it.change_pct >= 0 ? '+' : '') + it.change_pct.toFixed(2) + '%</text>';
          }
        }
        html += '</g>';
      });
      html += '</svg>';
      c.innerHTML = html;
      c.querySelectorAll('g[data-symbol]').forEach(g => {
        g.addEventListener('click', () => {
          const s = g.dataset.symbol;
          const inp = $('stockSearch') || $('twStockInput') || $('stockInput');
          if (inp) { inp.value = s; inp.dispatchEvent(new Event('input', { bubbles: true })); }
          if (typeof window.searchStock === 'function') window.searchStock(s);
        });
      });
    } catch (e) {
      console.error('[v277 heatmap]', e);
      c.innerHTML = '<div style="color:#dc2626;padding:20px">❌ 熱力圖載入失敗：' + (e.message || e) + '</div>';
    }
  }

  // ==============================================================
  // FEATURE 2 — Pre-Market / After-Hours（v279）
  // ==============================================================
  async function buildPrePost(symbol, containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="color:#888">⏳ 抓盤前盤後資料中...</div>';
    try {
      const r = await fetch(W + '/quote?symbol=' + encodeURIComponent(symbol));
      const j = await r.json();
      const pre = j.preMarketPrice ?? j.pre_market_price;
      const post = j.postMarketPrice ?? j.post_market_price;
      const preChg = j.preMarketChangePercent ?? j.pre_market_change_pct;
      const postChg = j.postMarketChangePercent ?? j.post_market_change_pct;
      const reg = j.regularMarketPrice ?? j.close;
      const state = j.marketState || '-';
      let html = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:8px">';
      html += '<div style="background:rgba(255,159,28,0.08);border:1px solid rgba(255,159,28,0.3);border-radius:6px;padding:10px"><div style="color:#94a3b8;font-size:11px">🌅 盤前</div><div style="font-size:18px;font-weight:700;color:' + ((preChg||0) >= 0 ? '#34d399' : '#f87171') + '">' + (pre ? fmt(pre, 2) : '-') + '</div><div style="color:#94a3b8;font-size:11px">' + (preChg != null ? (preChg >= 0 ? '+' : '') + preChg.toFixed(2) + '%' : '-') + '</div></div>';
      html += '<div style="background:rgba(96,165,250,0.08);border:1px solid rgba(96,165,250,0.3);border-radius:6px;padding:10px"><div style="color:#94a3b8;font-size:11px">📈 盤中收盤</div><div style="font-size:18px;font-weight:700">' + (reg ? fmt(reg, 2) : '-') + '</div><div style="color:#94a3b8;font-size:11px">' + state + '</div></div>';
      html += '<div style="background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.3);border-radius:6px;padding:10px"><div style="color:#94a3b8;font-size:11px">🌙 盤後</div><div style="font-size:18px;font-weight:700;color:' + ((postChg||0) >= 0 ? '#34d399' : '#f87171') + '">' + (post ? fmt(post, 2) : '-') + '</div><div style="color:#94a3b8;font-size:11px">' + (postChg != null ? (postChg >= 0 ? '+' : '') + postChg.toFixed(2) + '%' : '-') + '</div></div>';
      html += '</div>';
      c.innerHTML = html;
    } catch (e) {
      c.innerHTML = '<div style="color:#dc2626">❌ ' + (e.message || e) + '</div>';
    }
  }

  // ==============================================================
  // FEATURE 3 — DCF 估值模型（v280）
  // ==============================================================
  function buildDCF(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px">' +
      '<label style="font-size:13px">FCF (M)<input type="number" id="dcf-fcf" value="100" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label style="font-size:13px">成長率 (%, 5y)<input type="number" id="dcf-g" value="8" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label style="font-size:13px">折現率 WACC (%)<input type="number" id="dcf-r" value="10" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label style="font-size:13px">終值成長率 (%)<input type="number" id="dcf-tg" value="3" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label style="font-size:13px">流通股數 (M)<input type="number" id="dcf-shares" value="100" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label style="font-size:13px">淨負債 (M)<input type="number" id="dcf-debt" value="0" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '</div><button id="dcf-go" style="width:100%;padding:10px;background:#2563eb;border:0;color:#fff;border-radius:6px;font-weight:700;cursor:pointer;margin-top:8px">計算 DCF 公允價值</button>' +
      '<div id="dcf-result" style="margin-top:10px;padding:10px;background:rgba(96,165,250,0.05);border:1px solid rgba(96,165,250,0.3);border-radius:6px;color:#94a3b8;font-size:13px">填入參數後點計算</div>';
    $('dcf-go').addEventListener('click', () => {
      const fcf = parseFloat($('dcf-fcf').value);
      const g = parseFloat($('dcf-g').value) / 100;
      const r = parseFloat($('dcf-r').value) / 100;
      const tg = parseFloat($('dcf-tg').value) / 100;
      const shares = parseFloat($('dcf-shares').value);
      const debt = parseFloat($('dcf-debt').value);
      let pv = 0;
      const flows = [];
      for (let y = 1; y <= 5; y++) {
        const f = fcf * Math.pow(1 + g, y);
        const dpv = f / Math.pow(1 + r, y);
        flows.push({ y, f, dpv });
        pv += dpv;
      }
      const tv = (fcf * Math.pow(1 + g, 5) * (1 + tg)) / (r - tg);
      const tpv = tv / Math.pow(1 + r, 5);
      pv += tpv;
      const equity = pv - debt;
      const fair = equity / shares;
      const flowHtml = flows.map(f => 'Y' + f.y + ': FCF $' + fmt(f.f) + 'M → PV $' + fmt(f.dpv) + 'M').join('<br>');
      $('dcf-result').innerHTML =
        '<div style="font-size:18px;color:#34d399;font-weight:700">公允價值 / 股 = $' + fair.toFixed(2) + '</div>' +
        '<div style="margin-top:8px;font-size:11px;line-height:1.6">' +
        flowHtml + '<br>終值 (TV) = $' + fmt(tv) + 'M / 折現後 $' + fmt(tpv) + 'M<br>' +
        '企業價值 EV = $' + fmt(pv) + 'M<br>股東權益 = EV - 淨債務 = $' + fmt(equity) + 'M' +
        '</div>';
    });
  }

  // ==============================================================
  // FEATURE 4 — Position Sizing / Risk Calculator（v282）
  // ==============================================================
  function buildRisk(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px">' +
      '<label style="font-size:13px">帳戶總額<input type="number" id="rk-acc" value="1000000" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label style="font-size:13px">每筆風險 %<input type="number" id="rk-pct" value="1" step="0.1" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label style="font-size:13px">進場價<input type="number" id="rk-entry" value="100" step="0.01" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label style="font-size:13px">停損價<input type="number" id="rk-stop" value="95" step="0.01" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label style="font-size:13px">停利價<input type="number" id="rk-target" value="110" step="0.01" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<div></div></div><button id="rk-go" style="width:100%;padding:10px;background:#16a34a;border:0;color:#fff;border-radius:6px;font-weight:700;cursor:pointer;margin-top:8px">計算部位大小</button>' +
      '<div id="rk-result" style="margin-top:10px;padding:10px;background:rgba(34,197,94,0.05);border:1px solid rgba(34,197,94,0.3);border-radius:6px;color:#94a3b8;font-size:13px">填入後點計算</div>';
    $('rk-go').addEventListener('click', () => {
      const acc = parseFloat($('rk-acc').value);
      const pct = parseFloat($('rk-pct').value) / 100;
      const entry = parseFloat($('rk-entry').value);
      const stop = parseFloat($('rk-stop').value);
      const tgt = parseFloat($('rk-target').value);
      const riskAmount = acc * pct;
      const perShareRisk = Math.abs(entry - stop);
      const shares = Math.floor(riskAmount / perShareRisk);
      const positionValue = shares * entry;
      const positionPct = (positionValue / acc) * 100;
      const reward = Math.abs(tgt - entry);
      const rr = reward / perShareRisk;
      $('rk-result').innerHTML =
        '<div style="font-size:18px;color:#34d399;font-weight:700">建議買 ' + shares.toLocaleString() + ' 股</div>' +
        '<div style="margin-top:8px;font-size:11px;line-height:1.6">' +
        '部位金額 = $' + fmt(positionValue) + ' (' + positionPct.toFixed(1) + '% 帳戶)<br>' +
        '風險金額 = $' + fmt(riskAmount) + ' (' + (pct * 100).toFixed(1) + '% 帳戶)<br>' +
        '每股風險 = $' + perShareRisk.toFixed(2) + ' / 每股報酬 = $' + reward.toFixed(2) + '<br>' +
        '<span style="color:' + (rr >= 2 ? '#34d399' : '#fbbf24') + ';font-weight:700">風險報酬比 R:R = 1 : ' + rr.toFixed(2) + (rr >= 2 ? ' ✓ 符合 2:1 經驗法則' : ' ⚠️ 建議 ≥ 2:1') + '</span>' +
        '</div>';
    });
  }

  // ==============================================================
  // FEATURE 5 — Peer Comparison（v281）
  // ==============================================================
  async function buildPeer(symbol, containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="color:#888">🔍 抓同業比較中...</div>';
    try {
      // 簡化：取相同前 2 碼產業（台股）或相同 sector
      const prefix = (symbol || '').slice(0, 2);
      const r = await fetch(SB_URL + '/rest/v1/stocks?symbol=like.' + prefix + '*&select=symbol,name,industry&limit=10', { headers: SB_H });
      const peers = await r.json();
      if (!Array.isArray(peers) || peers.length === 0) {
        c.innerHTML = '<div style="color:#888;padding:10px">⚠️ 無同業資料</div>';
        return;
      }
      const today = new Date(Date.now() - 24 * 3600e3).toISOString().slice(0, 10);
      const sym = peers.map(p => p.symbol).join(',');
      const r2 = await fetch(SB_URL + '/rest/v1/daily_prices?symbol=in.(' + sym + ')&date=gte.' + today +
        '&select=symbol,close_price,open_price,volume&order=date.desc', { headers: SB_H });
      const prices = await r2.json();
      const priceMap = new Map();
      prices.forEach(p => { if (!priceMap.has(p.symbol)) priceMap.set(p.symbol, p); });
      let html = '<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="border-bottom:1px solid #334155;color:#94a3b8">' +
        '<th style="padding:8px;text-align:left">代號</th><th style="text-align:left">名稱</th><th style="text-align:right">收盤</th>' +
        '<th style="text-align:right">漲跌%</th><th style="text-align:right">成交量</th></tr></thead><tbody>';
      peers.forEach(p => {
        const px = priceMap.get(p.symbol);
        const chg = px && px.open_price ? ((px.close_price - px.open_price) / px.open_price) * 100 : null;
        const isCurr = p.symbol === symbol;
        html += '<tr style="border-bottom:1px solid #1e293b;' + (isCurr ? 'background:rgba(96,165,250,0.1)' : '') + '">' +
          '<td style="padding:8px;font-weight:' + (isCurr ? '700' : '400') + '">' + p.symbol + (isCurr ? ' ★' : '') + '</td>' +
          '<td>' + (p.name || '-') + '</td>' +
          '<td style="text-align:right">' + (px ? fmt(px.close_price, 2) : '-') + '</td>' +
          '<td style="text-align:right;color:' + (chg == null ? '#94a3b8' : chg >= 0 ? '#34d399' : '#f87171') + '">' + (chg == null ? '-' : (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%') + '</td>' +
          '<td style="text-align:right">' + (px ? fmt(px.volume) : '-') + '</td>' +
          '</tr>';
      });
      html += '</tbody></table>';
      c.innerHTML = html;
    } catch (e) {
      c.innerHTML = '<div style="color:#dc2626">❌ ' + (e.message || e) + '</div>';
    }
  }

  // ==============================================================
  // FEATURE 6 — Backtest 簡化版（v283）
  // 策略：SMA 短/長交叉
  // ==============================================================
  async function buildBacktest(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:8px">' +
      '<label style="font-size:13px">股票<input id="bt-sym" value="2330" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label style="font-size:13px">短均<input type="number" id="bt-short" value="20" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label style="font-size:13px">長均<input type="number" id="bt-long" value="60" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label style="font-size:13px">期間(天)<input type="number" id="bt-days" value="365" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '</div><button id="bt-go" style="width:100%;padding:10px;background:#7c3aed;border:0;color:#fff;border-radius:6px;font-weight:700;cursor:pointer;margin-top:8px">執行回測 (SMA Cross)</button>' +
      '<div id="bt-result" style="margin-top:10px;padding:10px;background:rgba(124,58,237,0.05);border:1px solid rgba(124,58,237,0.3);border-radius:6px;color:#94a3b8;font-size:13px">填入參數後點執行</div>';
    $('bt-go').addEventListener('click', async () => {
      const sym = $('bt-sym').value.trim();
      const short = parseInt($('bt-short').value);
      const long = parseInt($('bt-long').value);
      const days = parseInt($('bt-days').value);
      const since = new Date(Date.now() - days * 24 * 3600e3).toISOString().slice(0, 10);
      $('bt-result').innerHTML = '⏳ 抓歷叴���格...';
      try {
        const r = await fetch(SB_URL + '/rest/v1/daily_prices?symbol=eq.' + sym + '&date=gte.' + since +
          '&select=date,close_price&order=date.asc&limit=1000', { headers: SB_H });
        const data = await r.json();
        if (!Array.isArray(data) || data.length < long + 5) {
          $('bt-result').innerHTML = '⚠️ 歷史資料不足（需至少 ' + (long + 5) + ' 天）';
          return;
        }
        const closes = data.map(d => d.close_price);
        function sma(arr, n, idx) {
          if (idx < n - 1) return null;
          let s = 0;
          for (let i = idx - n + 1; i <= idx; i++) s += arr[i];
          return s / n;
        }
        let pos = 0, entryPrice = 0, trades = [], equity = 1.0, peak = 1.0, mdd = 0;
        let prevSig = null;
        for (let i = long; i < closes.length; i++) {
          const sShort = sma(closes, short, i);
          const sLong = sma(closes, long, i);
          if (sShort == null || sLong == null) continue;
          const sig = sShort > sLong ? 1 : -1;
          if (prevSig !== null && sig !== prevSig) {
            // 訊號翻轉
            if (sig === 1 && pos === 0) {
              pos = 1; entryPrice = closes[i];
            } else if (sig === -1 && pos === 1) {
              const ret = (closes[i] - entryPrice) / entryPrice;
              equity *= (1 + ret);
              if (equity > peak) peak = equity;
              const dd = (peak - equity) / peak;
              if (dd > mdd) mdd = dd;
              trades.push({ in: entryPrice, out: closes[i], ret });
              pos = 0;
            }
          }
          prevSig = sig;
        }
        const wins = trades.filter(t => t.ret > 0).length;
        const winRate = trades.length ? (wins / trades.length) * 100 : 0;
        const totalRet = (equity - 1) * 100;
        const buyHold = ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100;
        $('bt-result').innerHTML =
          '<div style="font-size:18px;color:' + (totalRet > buyHold ? '#34d399' : '#fbbf24') + ';font-weight:700">' +
          '策略報酬 ' + totalRet.toFixed(1) + '% | 持有 ' + buyHold.toFixed(1) + '%</div>' +
          '<div style="margin-top:8px;font-size:11px;line-height:1.6">' +
          '交易次數: ' + trades.length + ' / 勝率: ' + winRate.toFixed(1) + '% / 最大回撤: ' + (mdd * 100).toFixed(1) + '%<br>' +
          '時間範圍: ' + data[0].date + ' ~ ' + data[data.length - 1].date + ' (' + data.length + ' 天)<br>' +
          '策略: 短均(' + short + ') 上穿長均(' + long + ') 進場、下穿出場' +
          '</div>';
      } catch (e) {
        $('bt-result').innerHTML = '❌ ' + (e.message || e);
      }
    });
  }

  // ==============================================================
  // FEATURE 7 — Screener Pro（v284）
  // ==============================================================
  async function buildScreener(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px;font-size:12px">' +
      '<label>最低收盤價<input type="number" id="sc-min-px" value="0" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label>最高收盤價<input type="number" id="sc-max-px" value="10000" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label>最低漲跌%<input type="number" id="sc-min-chg" value="-100" step="0.1" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label>最高漲跌%<input type="number" id="sc-max-chg" value="100" step="0.1" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label>最低成交量<input type="number" id="sc-min-vol" value="0" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label>排序<select id="sc-sort" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"><option value="chg_desc">漲幅由高到低</option><option value="chg_asc">跌幅由高到低</option><option value="vol_desc">成交量大→小</option><option value="px_desc">價格大→小</option></select></label>' +
      '</div><button id="sc-go" style="width:100%;padding:10px;background:#0891b2;border:0;color:#fff;border-radius:6px;font-weight:700;cursor:pointer;margin-top:8px">執行篩選</button>' +
      '<div id="sc-result" style="margin-top:10px"></div>';
    $('sc-go').addEventListener('click', async () => {
      const minPx = parseFloat($('sc-min-px').value);
      const maxPx = parseFloat($('sc-max-px').value);
      const minChg = parseFloat($('sc-min-chg').value);
      const maxChg = parseFloat($('sc-max-chg').value);
      const minVol = parseFloat($('sc-min-vol').value);
      const sort = $('sc-sort').value;
      $('sc-result').innerHTML = '<div style="color:#888;padding:10px">⏳ 篩選中...</div>';
      try {
        const today = new Date(Date.now() - 24 * 3600e3).toISOString().slice(0, 10);
        const r = await fetch(SB_URL + '/rest/v1/daily_prices?date=gte.' + today +
          '&select=symbol,close_price,open_price,volume&order=date.desc&limit=2500', { headers: SB_H });
        const rows = await r.json();
        const map = new Map();
        rows.forEach(r => { if (!map.has(r.symbol)) map.set(r.symbol, r); });
        const all = Array.from(map.values()).map(r => ({
          symbol: r.symbol,
          close: r.close_price,
          open: r.open_price,
          volume: r.volume,
          chg: r.open_price ? ((r.close_price - r.open_price) / r.open_price) * 100 : 0
        }));
        let filtered = all.filter(s =>
          s.close >= minPx && s.close <= maxPx &&
          s.chg >= minChg && s.chg <= maxChg &&
          (s.volume || 0) >= minVol
        );
        const sortFns = {
          chg_desc: (a, b) => b.chg - a.chg,
          chg_asc: (a, b) => a.chg - b.chg,
          vol_desc: (a, b) => (b.volume || 0) - (a.volume || 0),
          px_desc: (a, b) => b.close - a.close
        };
        filtered.sort(sortFns[sort] || sortFns.chg_desc);
        filtered = filtered.slice(0, 50);
        let html = '<div style="margin-bottom:8px;color:#94a3b8;font-size:12px">符合條件 ' + filtered.length + ' 檔（顯示前 50）</div>' +
          '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="border-bottom:1px solid #334155;color:#94a3b8">' +
          '<th style="padding:6px;text-align:left">代號</th><th style="text-align:right">收盤</th><th style="text-align:right">漲跌%</th><th style="text-align:right">成交量</th></tr></thead><tbody>';
        filtered.forEach(s => {
          html += '<tr style="border-bottom:1px solid #1e293b;cursor:pointer" data-symbol="' + s.symbol + '">' +
            '<td style="padding:6px">' + s.symbol + '</td>' +
            '<td style="text-align:right">' + fmt(s.close, 2) + '</td>' +
            '<td style="text-align:right;color:' + (s.chg >= 0 ? '#34d399' : '#f87171') + '">' + (s.chg >= 0 ? '+' : '') + s.chg.toFixed(2) + '%</td>' +
            '<td style="text-align:right">' + fmt(s.volume) + '</td></tr>';
        });
        html += '</tbody></table>';
        $('sc-result').innerHTML = html;
        $('sc-result').querySelectorAll('tr[data-symbol]').forEach(tr => {
          tr.addEventListener('click', () => {
            const inp = $('stockSearch') || $('twStockInput');
            if (inp) { inp.value = tr.dataset.symbol; inp.dispatchEvent(new Event('input', { bubbles: true })); }
            if (typeof window.searchStock === 'function') window.searchStock(tr.dataset.symbol);
          });
        });
      } catch (e) {
        $('sc-result').innerHTML = '<div style="color:#dc2626;padding:10px">❌ ' + (e.message || e) + '</div>';
      }
    });
  }

  // ==============================================================
  // FEATURE 8 — Bar Replay（v285）
  // ==============================================================
  function buildBarReplay(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:#94a3b8;margin-bottom:6px">🎬 K 線回放練習：模擬走勢，訓練判讀直覺</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><input id="br-sym" value="2330" placeholder="股票代號" style="flex:1 1 100px;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px">' +
      '<button id="br-load" style="padding:6px 14px;background:#2563eb;border:0;color:#fff;border-radius:4px;cursor:pointer">載入</button>' +
      '<button id="br-back" style="padding:6px 10px;background:#475569;border:0;color:#fff;border-radius:4px;cursor:pointer">⬅️</button>' +
      '<button id="br-play" style="padding:6px 14px;background:#16a34a;border:0;color:#fff;border-radius:4px;cursor:pointer">▶️ 播放</button>' +
      '<button id="br-fwd" style="padding:6px 10px;background:#475569;border:0;color:#fff;border-radius:4px;cursor:pointer">➡️</button></div>' +
      '<canvas id="br-canvas" width="800" height="240" style="margin-top:10px;background:#0a0f1c;border-radius:6px;width:100%"></canvas>' +
      '<div id="br-info" style="margin-top:6px;font-size:11px;color:#64748b"></div></div>';
    let bars = [], idx = 0, playing = false, timer = null;
    const cv = $('br-canvas'), ctx = cv.getContext('2d');
    function draw() {
      const W = cv.width, H = cv.height;
      ctx.fillStyle = '#0a0f1c';
      ctx.fillRect(0, 0, W, H);
      if (idx < 5) return;
      const slice = bars.slice(0, idx);
      const closes = slice.map(b => b.close_price);
      const min = Math.min.apply(null, closes), max = Math.max.apply(null, closes);
      const yScale = (p) => H - ((p - min) / (max - min || 1)) * (H - 20) - 10;
      ctx.strokeStyle = '#34d399'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      slice.forEach((b, i) => {
        const x = (i / (slice.length - 1)) * W;
        const y = yScale(b.close_price);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      });
      ctx.stroke();
      $('br-info').textContent = '第 ' + idx + '/' + bars.length + ' 根 K · ' + slice[slice.length - 1].date + ' · ' + slice[slice.length - 1].close_price;
    }
    $('br-load').addEventListener('click', async () => {
      const sym = $('br-sym').value.trim();
      const r = await fetch(SB_URL + '/rest/v1/daily_prices?symbol=eq.' + sym +
        '&select=date,close_price&order=date.asc&limit=500', { headers: SB_H });
      bars = await r.json();
      idx = Math.min(20, bars.length);
      draw();
    });
    $('br-fwd').addEventListener('click', () => { if (idx < bars.length) { idx++; draw(); } });
    $('br-back').addEventListener('click', () => { if (idx > 5) { idx--; draw(); } });
    $('br-play').addEventListener('click', () => {
      playing = !playing;
      $('br-play').textContent = playing ? '⏸️ 暫停' : '▶️ 播放';
      if (playing) {
        timer = setInterval(() => {
          if (idx < bars.length) { idx++; draw(); }
          else { playing = false; clearInterval(timer); $('br-play').textContent = '▶️ 播放'; }
        }, 200);
      } else if (timer) { clearInterval(timer); timer = null; }
    });
  }

  // ==============================================================
  // FEATURE 9 — 13F Hedge Fund Tracking (v286 simple)
  // SEC EDGAR 13F filings (公開免費)
  // ==============================================================
  async function build13F(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:#94a3b8;margin-bottom:8px">🐋 美股對沖基金 13F 追蹤（SEC 公開資料）</div>' +
      '<div style="display:flex;gap:8px"><input id="f13-cik" placeholder="CIK 或基金名 (例: 1067983=Berkshire)" value="1067983" style="flex:1;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px">' +
      '<button id="f13-go" style="padding:6px 14px;background:#dc2626;border:0;color:#fff;border-radius:4px;cursor:pointer">查持倉</button></div>' +
      '<div id="f13-result" style="margin-top:10px;color:#94a3b8;font-size:12px">輸入 CIK 點查詢（範例：Berkshire=1067983, BlackRock=1364742, Bridgewater=1350694）</div></div>';
    $('f13-go').addEventListener('click', async () => {
      const cik = $('f13-cik').value.trim();
      $('f13-result').innerHTML = '<div style="color:#888">⏳ 抓 SEC EDGAR 13F filings...</div>';
      try {
        const padded = cik.padStart(10, '0');
        const url = 'https://data.sec.gov/submissions/CIK' + padded + '.json';
        const r = await fetch(url);
        if (!r.ok) throw new Error('SEC ' + r.status);
        const j = await r.json();
        const recent = j.filings && j.filings.recent;
        if (!recent) throw new Error('no filings');
        const list = [];
        for (let i = 0; i < recent.form.length && list.length < 5; i++) {
          if (recent.form[i] === '13F-HR') {
            list.push({
              date: recent.filingDate[i],
              report: recent.reportDate[i],
              accession: recent.accessionNumber[i],
              link: 'https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=' + cik + '&type=13F-HR&dateb=&owner=include&count=10'
            });
          }
        }
        if (list.length === 0) {
          $('f13-result').innerHTML = '⚠️ 此 CIK 無 13F-HR filings';
          return;
        }
        let html = '<div style="font-weight:700;color:#fff;margin-bottom:8px">' + (j.name || j.entityName || cik) + ' — 最近 ' + list.length + ' 份 13F</div>';
        html += '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="border-bottom:1px solid #334155;color:#94a3b8"><th style="padding:6px;text-align:left">填報日</th><th style="text-align:left">報告期</th><th>連結</th></tr></thead><tbody>';
        list.forEach(f => {
          html += '<tr style="border-bottom:1px solid #1e293b"><td style="padding:6px">' + f.date + '</td><td>' + f.report + '</td><td><a href="' + f.link + '" target="_blank" rel="noopener" style="color:#60a5fa">SEC 詳情 →</a></td></tr>';
        });
        html += '</tbody></table>';
        html += '<div style="margin-top:10px;padding:8px;background:rgba(96,165,250,0.05);border:1px solid rgba(96,165,250,0.2);border-radius:4px;font-size:11px;color:#94a3b8">💡 13F 由機構投資人每季向 SEC 申報持倉（45 天延遲）。點 SEC 詳情看完整持股明細。</div>';
        $('f13-result').innerHTML = html;
      } catch (e) {
        $('f13-result').innerHTML = '❌ ' + (e.message || e);
      }
    });
  }

  // ==============================================================
  // BUNDLE INIT — 把所有 sections 注入頁面
  // ==============================================================
  function injectSection(parentTab, id, title, builder, autorun) {
    const tab = $(parentTab);
    if (!tab) return;
    if ($(id)) return;  // already injected
    const wrapper = el('div', { className: 'section', style: { marginTop: '20px' } });
    wrapper.dataset.v275Key = id;  // 整合到 v275-drag-fix
    wrapper.innerHTML = '<div class="section-title" style="font-weight:700;font-size:16px;margin-bottom:10px">' + title + '</div><div id="' + id + '"></div>';
    tab.appendChild(wrapper);
    if (autorun) builder(id);
    else $(id).innerHTML = '<button onclick="window.v277.run(\'' + id + '\')" style="padding:8px 16px;background:#2563eb;border:0;color:#fff;border-radius:6px;cursor:pointer">點此載入</button>';
    window.v277._builders = window.v277._builders || {};
    window.v277._builders[id] = builder;
  }

  function buildAll() {
    injectSection('tab-tw', 'v277-heatmap', '🔥 台股熱力圖（成交額前 100）', buildHeatMap, true);
    injectSection('tab-us', 'v277-heatmap-us', '🔥 美股熱力圖', buildHeatMap, false);
    injectSection('tab-tools', 'v280-dcf', '💎 DCF 估值模型', buildDCF, true);
    injectSection('tab-tools', 'v282-risk', '⚖️ 部位 / 風險計算機', buildRisk, true);
    injectSection('tab-tools', 'v283-backtest', '🔬 SMA Cross 回測', buildBacktest, true);
    injectSection('tab-screener', 'v284-screener', '🎯 進階篩選器（Screener Pro）', buildScreener, true);
    injectSection('tab-tw', 'v285-replay', '🎬 K 線回放練習', buildBarReplay, true);
    injectSection('tab-us', 'v286-13f', '🐋 對沖基金 13F 追蹤', build13F, true);
  }

  function ready() {
    buildAll();
    // 切換 tab 時補注入
    document.addEventListener('click', e => {
      if (e.target.closest('[data-tab],.tab-btn,[role=tab]')) {
        setTimeout(buildAll, 400);
      }
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready);
  else ready();

  window.v277 = {
    version: VERSION,
    run: function(id) {
      const b = (window.v277._builders || {})[id];
      if (b) b(id);
    },
    rebuild: buildAll,
    heatmap: buildHeatMap,
    prepost: buildPrePost,
    dcf: buildDCF,
    risk: buildRisk,
    peer: buildPeer,
    backtest: buildBacktest,
    screener: buildScreener,
    replay: buildBarReplay,
    f13: build13F
  };
  console.log('[' + VERSION + '] 9 features loaded');
})();
