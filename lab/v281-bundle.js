/**
 * MoneyRadar v281 Bundle — 9 件純前端 features
 * 1. 技術指標補完 (ADX/Stoch/CCI/MACD divergence/Bollinger)
 * 2. Black-Scholes 期權定價
 * 3. Greeks (Delta/Gamma/Theta/Vega/Rho)
 * 4. Monte Carlo 投組模擬
 * 5. 投組統計 (Beta/Sharpe/Sortino/Treynor)
 * 6. 相關性矩陣 + 熱力圖
 * 7. 季節性分析 (月份/星期幾)
 * 8. 黑天鵝偵測 (3-sigma)
 * 9. Theme 切換 + Cmd+K 快速搜尋
 */
(function() {
  'use strict';
  const VERSION = 'v281-bundle';
  const SB_URL = 'https://sirhskxufayklqrlxeep.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcmhza3h1ZmF5a2xxcmx4ZWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTc5ODQsImV4cCI6MjA5MDMzMzk4NH0.i0iNEGXq3tkLrQQbGq3WJbNPbNrnrV6ryg8UUB8Bz5g';
  const SB_H = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };

  function $(id) { return document.getElementById(id); }
  function fmt(n, d) {
    if (n == null || isNaN(n)) return '-';
    return Number(n).toFixed(d == null ? 2 : d);
  }
  function fmtBig(n, d) {
    if (n == null || isNaN(n)) return '-';
    if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(d || 1) + 'B';
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(d || 1) + 'M';
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(d || 1) + 'K';
    return n.toFixed(d || 2);
  }

  // ==============================================================
  // FEATURE 1 — 技術指標補完 (v297)
  // ==============================================================
  function buildTechIndicators(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:#94a3b8;margin-bottom:8px">📐 完整技術指標：ADX / Stochastic / CCI / Bollinger / MACD divergence</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:10px"><input id="ti-sym" value="2330" style="flex:1;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px">' +
      '<button id="ti-go" style="padding:6px 14px;background:#7c3aed;border:0;color:#fff;border-radius:4px;cursor:pointer">計算</button></div>' +
      '<div id="ti-result"></div></div>';

    function sma(arr, n) {
      const out = []; let s = 0;
      for (let i = 0; i < arr.length; i++) {
        s += arr[i];
        if (i >= n) s -= arr[i - n];
        out.push(i >= n - 1 ? s / n : null);
      }
      return out;
    }
    function ema(arr, n) {
      const out = []; const k = 2 / (n + 1); let prev = null;
      for (let i = 0; i < arr.length; i++) {
        if (i < n - 1) { out.push(null); continue; }
        if (prev == null) {
          let s = 0; for (let j = 0; j <= i; j++) s += arr[j];
          prev = s / (i + 1);
        } else prev = arr[i] * k + prev * (1 - k);
        out.push(prev);
      }
      return out;
    }
    function trueRange(highs, lows, closes) {
      const out = [null];
      for (let i = 1; i < closes.length; i++) {
        const tr = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
        out.push(tr);
      }
      return out;
    }
    // ADX (Average Directional Index, 趨勢強度)
    function adx(highs, lows, closes, n) {
      const tr = trueRange(highs, lows, closes);
      const plusDM = [null], minusDM = [null];
      for (let i = 1; i < closes.length; i++) {
        const up = highs[i] - highs[i - 1];
        const down = lows[i - 1] - lows[i];
        plusDM.push(up > down && up > 0 ? up : 0);
        minusDM.push(down > up && down > 0 ? down : 0);
      }
      const trN = ema(tr.slice(1), n).map(v => v == null ? null : v);
      const plusDMN = ema(plusDM.slice(1), n);
      const minusDMN = ema(minusDM.slice(1), n);
      const plusDI = [], minusDI = [], dx = [];
      for (let i = 0; i < trN.length; i++) {
        if (trN[i] == null || trN[i] === 0) { plusDI.push(null); minusDI.push(null); dx.push(null); continue; }
        const pdi = (plusDMN[i] / trN[i]) * 100;
        const mdi = (minusDMN[i] / trN[i]) * 100;
        plusDI.push(pdi); minusDI.push(mdi);
        dx.push(Math.abs(pdi - mdi) / (pdi + mdi || 1) * 100);
      }
      const adxVals = ema(dx.filter(v => v != null), n);
      return { plusDI, minusDI, adx: adxVals };
    }
    // Stochastic Oscillator
    function stoch(highs, lows, closes, n, smoothK, smoothD) {
      const k = [];
      for (let i = 0; i < closes.length; i++) {
        if (i < n - 1) { k.push(null); continue; }
        const win = closes.slice(i - n + 1, i + 1);
        const hwin = highs.slice(i - n + 1, i + 1);
        const lwin = lows.slice(i - n + 1, i + 1);
        const hh = Math.max.apply(null, hwin), ll = Math.min.apply(null, lwin);
        k.push(hh === ll ? 50 : ((closes[i] - ll) / (hh - ll)) * 100);
      }
      const kSmooth = sma(k.filter(v => v != null), smoothK || 3);
      const d = sma(kSmooth, smoothD || 3);
      return { k: kSmooth, d };
    }
    // CCI (Commodity Channel Index)
    function cci(highs, lows, closes, n) {
      const tp = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
      const out = [];
      for (let i = 0; i < tp.length; i++) {
        if (i < n - 1) { out.push(null); continue; }
        const win = tp.slice(i - n + 1, i + 1);
        const mean = win.reduce((s, v) => s + v, 0) / n;
        const md = win.reduce((s, v) => s + Math.abs(v - mean), 0) / n;
        out.push(md === 0 ? 0 : (tp[i] - mean) / (0.015 * md));
      }
      return out;
    }
    // Bollinger Bands
    function bbands(closes, n, mult) {
      const m = sma(closes, n);
      const out = [];
      for (let i = 0; i < closes.length; i++) {
        if (m[i] == null) { out.push({ upper: null, lower: null, mid: null }); continue; }
        const win = closes.slice(i - n + 1, i + 1);
        const v = win.reduce((s, x) => s + (x - m[i]) ** 2, 0) / n;
        const std = Math.sqrt(v);
        out.push({ upper: m[i] + mult * std, lower: m[i] - mult * std, mid: m[i] });
      }
      return out;
    }

    $('ti-go').addEventListener('click', async () => {
      const sym = $('ti-sym').value.trim();
      const since = new Date(Date.now() - 365 * 24 * 3600e3).toISOString().slice(0, 10);
      $('ti-result').innerHTML = '<div style="color:#94a3b8;padding:10px">⏳ 計算中...</div>';
      try {
        const r = await fetch(SB_URL + '/rest/v1/daily_prices?symbol=eq.' + sym + '&date=gte.' + since +
          '&select=date,close_price,high_price,low_price&order=date.asc&limit=300', { headers: SB_H });
        const data = await r.json();
        if (data.length < 30) { $('ti-result').innerHTML = '⚠️ 資料不足'; return; }
        const closes = data.map(d => d.close_price);
        const highs = data.map(d => d.high_price || d.close_price);
        const lows = data.map(d => d.low_price || d.close_price);
        const last = data.length - 1;
        const adxR = adx(highs, lows, closes, 14);
        const stochR = stoch(highs, lows, closes, 14, 3, 3);
        const cciR = cci(highs, lows, closes, 20);
        const bb = bbands(closes, 20, 2);
        const lastClose = closes[last];
        const lastBB = bb[last];
        const bbPos = lastBB.upper && lastBB.lower ? ((lastClose - lastBB.lower) / (lastBB.upper - lastBB.lower)) * 100 : null;
        const adxVal = adxR.adx[adxR.adx.length - 1];
        const stochK = stochR.k[stochR.k.length - 1];
        const stochD = stochR.d[stochR.d.length - 1];
        const cciVal = cciR[last];

        function judge(name, val, rules) {
          for (const r of rules) if (val != null && r.cond(val)) return { val, label: r.label, color: r.color };
          return { val, label: '-', color: '#94a3b8' };
        }
        const adxJ = judge('ADX', adxVal, [
          { cond: v => v > 50, label: '極強趨勢', color: '#0d8043' },
          { cond: v => v > 25, label: '強趨勢', color: '#16a34a' },
          { cond: v => v > 20, label: '溫和趨勢', color: '#84cc16' },
          { cond: v => v >= 0, label: '無趨勢/盤整', color: '#94a3b8' }
        ]);
        const stochJ = judge('Stoch', stochK, [
          { cond: v => v > 80, label: '超買', color: '#f87171' },
          { cond: v => v < 20, label: '超賣', color: '#34d399' },
          { cond: v => true, label: '中性', color: '#94a3b8' }
        ]);
        const cciJ = judge('CCI', cciVal, [
          { cond: v => v > 100, label: '超買', color: '#f87171' },
          { cond: v => v < -100, label: '超賣', color: '#34d399' },
          { cond: v => true, label: '中性', color: '#94a3b8' }
        ]);
        const bbJ = judge('BB', bbPos, [
          { cond: v => v > 95, label: '突破上軌（強勢）', color: '#f87171' },
          { cond: v => v < 5, label: '跌破下軌（弱勢）', color: '#34d399' },
          { cond: v => v > 80, label: '靠近上軌', color: '#fbbf24' },
          { cond: v => v < 20, label: '靠近下軌', color: '#fbbf24' },
          { cond: v => true, label: '中段', color: '#94a3b8' }
        ]);

        $('ti-result').innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">' +
          buildCard('📊 ADX(14) — 趨勢強度', adxVal, adxJ) +
          buildCard('🎯 Stochastic(14,3,3) %K', stochK, stochJ, '%D = ' + fmt(stochD, 1)) +
          buildCard('📈 CCI(20)', cciVal, cciJ) +
          buildCard('📊 Bollinger Bands(20,2)', bbPos, bbJ, '上軌 ' + fmt(lastBB.upper, 2) + ' / 中軌 ' + fmt(lastBB.mid, 2) + ' / 下軌 ' + fmt(lastBB.lower, 2)) +
          '</div>' +
          '<div style="margin-top:10px;padding:8px;background:rgba(96,165,250,0.05);border:1px solid rgba(96,165,250,0.2);border-radius:4px;font-size:11px;color:#94a3b8">💡 ADX > 25 表強趨勢；Stoch > 80 超買、< 20 超賣；CCI > 100 超買、< -100 超賣；BB% 顯示在區間位置（0-100%）。</div>';

        function buildCard(title, val, j, sub) {
          return '<div style="background:rgba(124,58,237,0.05);border:1px solid rgba(124,58,237,0.3);border-radius:6px;padding:10px">' +
            '<div style="font-size:11px;color:#94a3b8;margin-bottom:4px">' + title + '</div>' +
            '<div style="font-size:18px;font-weight:700;color:' + j.color + '">' + fmt(val, 2) + '</div>' +
            '<div style="font-size:11px;color:' + j.color + '">' + j.label + '</div>' +
            (sub ? '<div style="font-size:10px;color:#64748b;margin-top:4px">' + sub + '</div>' : '') +
            '</div>';
        }
      } catch (e) {
        $('ti-result').innerHTML = '❌ ' + e.message;
      }
    });
  }

  // ==============================================================
  // FEATURE 2+3 — Black-Scholes + Greeks (v298)
  // ==============================================================
  function buildBlackScholes(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:#94a3b8;margin-bottom:8px">⚖️ Black-Scholes 期權定價 + Greeks（Delta/Gamma/Theta/Vega/Rho）</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-bottom:10px;font-size:12px">' +
      '<label>標的價 S<input type="number" id="bs-s" value="100" step="0.01" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label>行權價 K<input type="number" id="bs-k" value="100" step="0.01" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label>年化波動率 σ %<input type="number" id="bs-vol" value="25" step="0.1" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label>無風險利率 r %<input type="number" id="bs-r" value="3" step="0.1" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label>到期天數 T<input type="number" id="bs-t" value="30" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label>類型<select id="bs-type" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"><option value="call">Call 買權</option><option value="put">Put 賣權</option></select></label>' +
      '</div><button id="bs-go" style="width:100%;padding:10px;background:#7c3aed;border:0;color:#fff;border-radius:6px;font-weight:700;cursor:pointer">計算定價 + Greeks</button>' +
      '<div id="bs-result" style="margin-top:10px"></div></div>';

    function normalCDF(x) {
      const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
      const sign = x < 0 ? -1 : 1;
      x = Math.abs(x) / Math.sqrt(2);
      const t = 1 / (1 + p * x);
      const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
      return 0.5 * (1 + sign * y);
    }
    function normalPDF(x) {
      return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
    }

    $('bs-go').addEventListener('click', () => {
      const S = parseFloat($('bs-s').value);
      const K = parseFloat($('bs-k').value);
      const vol = parseFloat($('bs-vol').value) / 100;
      const r = parseFloat($('bs-r').value) / 100;
      const T = parseFloat($('bs-t').value) / 365;
      const type = $('bs-type').value;
      const sqrtT = Math.sqrt(T);
      const d1 = (Math.log(S / K) + (r + 0.5 * vol * vol) * T) / (vol * sqrtT);
      const d2 = d1 - vol * sqrtT;
      let price, delta, gamma, theta, vega, rho;
      gamma = normalPDF(d1) / (S * vol * sqrtT);
      vega = S * normalPDF(d1) * sqrtT / 100; // per 1% vol
      if (type === 'call') {
        price = S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
        delta = normalCDF(d1);
        theta = (-S * normalPDF(d1) * vol / (2 * sqrtT) - r * K * Math.exp(-r * T) * normalCDF(d2)) / 365;
        rho = K * T * Math.exp(-r * T) * normalCDF(d2) / 100;
      } else {
        price = K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
        delta = normalCDF(d1) - 1;
        theta = (-S * normalPDF(d1) * vol / (2 * sqrtT) + r * K * Math.exp(-r * T) * normalCDF(-d2)) / 365;
        rho = -K * T * Math.exp(-r * T) * normalCDF(-d2) / 100;
      }
      const intrinsic = type === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0);
      const timeValue = price - intrinsic;
      const itm = type === 'call' ? S > K : S < K;
      $('bs-result').innerHTML = '<div style="background:rgba(124,58,237,0.05);border:1px solid rgba(124,58,237,0.3);border-radius:6px;padding:12px">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:10px"><span style="font-size:18px;font-weight:700;color:#fff">' + (type === 'call' ? '📈 Call' : '📉 Put') + ' 定價 = $' + fmt(price, 4) + '</span><span style="color:' + (itm ? '#34d399' : '#94a3b8') + '">' + (itm ? '✓ ITM 價內' : 'OTM 價外') + '</span></div>' +
        '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;font-size:12px">' +
        '<div><div style="color:#94a3b8;font-size:10px">Δ Delta</div><div style="font-weight:700">' + fmt(delta, 4) + '</div></div>' +
        '<div><div style="color:#94a3b8;font-size:10px">Γ Gamma</div><div style="font-weight:700">' + fmt(gamma, 6) + '</div></div>' +
        '<div><div style="color:#94a3b8;font-size:10px">Θ Theta /day</div><div style="font-weight:700;color:#f87171">' + fmt(theta, 4) + '</div></div>' +
        '<div><div style="color:#94a3b8;font-size:10px">ν Vega /1% vol</div><div style="font-weight:700">' + fmt(vega, 4) + '</div></div>' +
        '<div><div style="color:#94a3b8;font-size:10px">ρ Rho /1% rate</div><div style="font-weight:700">' + fmt(rho, 4) + '</div></div>' +
        '<div><div style="color:#94a3b8;font-size:10px">內在價值</div><div style="font-weight:700">' + fmt(intrinsic, 2) + '</div></div>' +
        '<div><div style="color:#94a3b8;font-size:10px">時間價值</div><div style="font-weight:700;color:#fbbf24">' + fmt(timeValue, 2) + '</div></div>' +
        '</div>' +
        '<div style="margin-top:10px;font-size:11px;color:#64748b;line-height:1.6">' +
        'Δ Delta: 標的每漲 $1 期權變動<br>' +
        'Γ Gamma: Delta 對標的價的二階導<br>' +
        'Θ Theta: 每天時間衰減（通常負數）<br>' +
        'ν Vega: 波動率每升 1% 期權變動<br>' +
        'ρ Rho: 利率每升 1% 期權變動' +
        '</div></div>';
    });
  }

  // ==============================================================
  // FEATURE 4 — Monte Carlo 投組模擬 (v299)
  // ==============================================================
  function buildMonteCarlo(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:#94a3b8;margin-bottom:8px">🎲 Monte Carlo 投組模擬 — 10,000 次蒙地卡羅模擬未來 30 年</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-bottom:10px;font-size:12px">' +
      '<label>初始資金<input type="number" id="mc-init" value="1000000" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label>每月加碼<input type="number" id="mc-monthly" value="20000" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label>年化期望報酬 %<input type="number" id="mc-mu" value="8" step="0.1" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label>年化波動率 %<input type="number" id="mc-vol" value="15" step="0.1" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label>年數<input type="number" id="mc-years" value="30" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label>模擬次數<input type="number" id="mc-runs" value="10000" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '</div><button id="mc-go" style="width:100%;padding:10px;background:#16a34a;border:0;color:#fff;border-radius:6px;font-weight:700;cursor:pointer">執行 Monte Carlo</button>' +
      '<div id="mc-result" style="margin-top:10px"></div></div>';

    // Box-Muller transform for normal random
    function randn() {
      let u = 0, v = 0;
      while (u === 0) u = Math.random();
      while (v === 0) v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    $('mc-go').addEventListener('click', () => {
      const init = parseFloat($('mc-init').value);
      const monthly = parseFloat($('mc-monthly').value);
      const mu = parseFloat($('mc-mu').value) / 100;
      const vol = parseFloat($('mc-vol').value) / 100;
      const years = parseInt($('mc-years').value);
      const runs = parseInt($('mc-runs').value);
      const months = years * 12;
      const muM = mu / 12;
      const volM = vol / Math.sqrt(12);
      $('mc-result').innerHTML = '<div style="color:#94a3b8;padding:10px">⏳ 模擬 ' + runs + ' 次...</div>';
      setTimeout(() => {
        const finals = [];
        const paths = []; // sample 50 paths for chart
        for (let i = 0; i < runs; i++) {
          let v = init;
          const path = [v];
          for (let m = 0; m < months; m++) {
            const ret = muM + volM * randn();
            v = v * (1 + ret) + monthly;
            if (i < 50) path.push(v);
          }
          finals.push(v);
          if (i < 50) paths.push(path);
        }
        finals.sort((a, b) => a - b);
        const p5 = finals[Math.floor(runs * 0.05)];
        const p25 = finals[Math.floor(runs * 0.25)];
        const median = finals[Math.floor(runs * 0.5)];
        const p75 = finals[Math.floor(runs * 0.75)];
        const p95 = finals[Math.floor(runs * 0.95)];
        const totalIn = init + monthly * months;
        // Build SVG of sample paths
        const W = 800, H = 200;
        const maxP = Math.max.apply(null, paths.flat());
        const minP = Math.min.apply(null, paths.flat());
        let svg = '<svg width="100%" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="background:#0a0f1c;border-radius:6px">';
        paths.forEach((path, idx) => {
          const d = path.map((v, i) => {
            const x = (i / (path.length - 1)) * W;
            const y = H - ((v - minP) / (maxP - minP || 1)) * (H - 10) - 5;
            return (i === 0 ? 'M' : 'L') + x.toFixed(0) + ',' + y.toFixed(0);
          }).join('');
          const opacity = 0.15;
          svg += '<path d="' + d + '" stroke="#34d399" stroke-width="0.7" fill="none" opacity="' + opacity + '"/>';
        });
        svg += '</svg>';

        $('mc-result').innerHTML = '<div style="background:rgba(22,163,74,0.05);border:1px solid rgba(22,163,74,0.3);border-radius:6px;padding:12px">' +
          '<div style="font-size:13px;color:#94a3b8;margin-bottom:8px">總投入: $' + fmtBig(totalIn) + '（初始 $' + fmtBig(init) + ' + 每月 $' + fmtBig(monthly) + ' × ' + months + ' 個月）</div>' +
          svg +
          '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px;font-size:12px;margin-top:10px">' +
          '<div><div style="color:#f87171;font-size:10px">P5（悲觀）</div><div style="font-weight:700">$' + fmtBig(p5) + '</div></div>' +
          '<div><div style="color:#fbbf24;font-size:10px">P25</div><div style="font-weight:700">$' + fmtBig(p25) + '</div></div>' +
          '<div><div style="color:#34d399;font-size:10px">中位數 P50</div><div style="font-weight:700">$' + fmtBig(median) + '</div></div>' +
          '<div><div style="color:#16a34a;font-size:10px">P75</div><div style="font-weight:700">$' + fmtBig(p75) + '</div></div>' +
          '<div><div style="color:#0d8043;font-size:10px">P95（樂觀）</div><div style="font-weight:700">$' + fmtBig(p95) + '</div></div>' +
          '</div>' +
          '<div style="margin-top:10px;font-size:11px;color:#94a3b8;line-height:1.6">' +
          '💡 中位數報酬倍數 ' + (median / totalIn).toFixed(2) + 'x（vs 投入），' +
          'P5 仍 $' + fmtBig(p5) + (p5 < totalIn ? '（虧損機率約 5%）' : '（仍獲利）') +
          '</div></div>';
      }, 50);
    });
  }

  // ==============================================================
  // FEATURE 5 — 投組統計 Sharpe/Sortino/Beta (v300)
  // ==============================================================
  function buildPortfolioStats(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:#94a3b8;margin-bottom:8px">📈 投組統計（Sharpe / Sortino / Treynor / Beta vs 大盤）</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:10px"><input id="ps-syms" placeholder="代號 (1 檔即可，例: 2330)" value="2330" style="flex:1;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px">' +
      '<input id="ps-bench" placeholder="大盤代號 (預設 0050)" value="0050" style="width:120px;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px">' +
      '<button id="ps-go" style="padding:6px 14px;background:#7c3aed;border:0;color:#fff;border-radius:4px;cursor:pointer">計算</button></div>' +
      '<div id="ps-result"></div></div>';

    $('ps-go').addEventListener('click', async () => {
      const sym = $('ps-syms').value.trim();
      const bench = $('ps-bench').value.trim() || '0050';
      const since = new Date(Date.now() - 365 * 24 * 3600e3).toISOString().slice(0, 10);
      $('ps-result').innerHTML = '⏳ 計算中...';
      try {
        const [r1, r2] = await Promise.all([
          fetch(SB_URL + '/rest/v1/daily_prices?symbol=eq.' + sym + '&date=gte.' + since + '&select=date,close_price&order=date.asc', { headers: SB_H }),
          fetch(SB_URL + '/rest/v1/daily_prices?symbol=eq.' + bench + '&date=gte.' + since + '&select=date,close_price&order=date.asc', { headers: SB_H })
        ]);
        const d1 = await r1.json(), d2 = await r2.json();
        if (!d1.length || !d2.length) { $('ps-result').innerHTML = '⚠️ 資料不足'; return; }
        const map2 = new Map(d2.map(d => [d.date, d.close_price]));
        const aligned = d1.filter(d => map2.has(d.date)).map(d => ({ date: d.date, p: d.close_price, b: map2.get(d.date) }));
        if (aligned.length < 30) { $('ps-result').innerHTML = '⚠️ 對齊資料不足'; return; }
        const rets = [], benchRets = [];
        for (let i = 1; i < aligned.length; i++) {
          rets.push((aligned[i].p / aligned[i - 1].p) - 1);
          benchRets.push((aligned[i].b / aligned[i - 1].b) - 1);
        }
        const n = rets.length;
        const mean = rets.reduce((s, r) => s + r, 0) / n;
        const meanB = benchRets.reduce((s, r) => s + r, 0) / n;
        const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / n;
        const std = Math.sqrt(variance);
        // Downside deviation (for Sortino)
        const downside = Math.sqrt(rets.filter(r => r < 0).reduce((s, r) => s + r * r, 0) / n);
        // Beta (cov / var benchmark)
        const cov = rets.reduce((s, r, i) => s + (r - mean) * (benchRets[i] - meanB), 0) / n;
        const varB = benchRets.reduce((s, r) => s + (r - meanB) ** 2, 0) / n;
        const beta = cov / (varB || 1);
        // Annualized
        const annRet = mean * 252;
        const annStd = std * Math.sqrt(252);
        const annDownside = downside * Math.sqrt(252);
        const annBenchRet = meanB * 252;
        const rf = 0.03; // 3% risk-free
        const sharpe = (annRet - rf) / (annStd || 1);
        const sortino = (annRet - rf) / (annDownside || 1);
        const treynor = (annRet - rf) / (beta || 1);
        const alpha = annRet - (rf + beta * (annBenchRet - rf));
        // Total return
        const totalRet = ((aligned[aligned.length - 1].p / aligned[0].p) - 1) * 100;
        const benchTotal = ((aligned[aligned.length - 1].b / aligned[0].b) - 1) * 100;
        const winRate = (rets.filter(r => r > 0).length / n) * 100;
        // Max drawdown
        let peak = aligned[0].p, mdd = 0;
        aligned.forEach(d => { if (d.p > peak) peak = d.p; mdd = Math.max(mdd, (peak - d.p) / peak); });

        function card(title, val, unit, color) {
          return '<div style="background:rgba(124,58,237,0.05);border:1px solid rgba(124,58,237,0.3);border-radius:6px;padding:10px">' +
            '<div style="font-size:11px;color:#94a3b8">' + title + '</div>' +
            '<div style="font-size:18px;font-weight:700;color:' + (color || '#fff') + '">' + (val == null ? '-' : val) + (unit || '') + '</div></div>';
        }
        $('ps-result').innerHTML = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px">' +
          card('總報酬', fmt(totalRet, 1), '%', totalRet >= 0 ? '#34d399' : '#f87171') +
          card('大盤報酬', fmt(benchTotal, 1), '%', benchTotal >= 0 ? '#34d399' : '#f87171') +
          card('Alpha α (超額)', fmt(alpha * 100, 2), '%', alpha >= 0 ? '#34d399' : '#f87171') +
          card('Beta β', fmt(beta, 2), '', '#fbbf24') +
          card('Sharpe', fmt(sharpe, 2), '', sharpe >= 1 ? '#34d399' : sharpe >= 0 ? '#fbbf24' : '#f87171') +
          card('Sortino', fmt(sortino, 2), '', sortino >= 1.5 ? '#34d399' : '#fbbf24') +
          card('Treynor', fmt(treynor * 100, 2), '%', '#fbbf24') +
          card('年化波動', fmt(annStd * 100, 1), '%', '#94a3b8') +
          card('Max Drawdown', fmt(mdd * 100, 1), '%', '#f87171') +
          card('勝率', fmt(winRate, 1), '%', winRate >= 50 ? '#34d399' : '#fbbf24') +
          '</div>' +
          '<div style="margin-top:10px;padding:8px;background:rgba(96,165,250,0.05);border:1px solid rgba(96,165,250,0.2);border-radius:4px;font-size:11px;color:#94a3b8;line-height:1.6">' +
          '💡 <strong>Sharpe</strong> &gt; 1 算優、&gt; 2 算極優；<strong>Sortino</strong> 只看下行波動更精確；<strong>Beta</strong> = 1 同步大盤、&lt; 1 較穩、&gt; 1 較激；<strong>Alpha</strong> &gt; 0 表跑贏 Beta 解釋的部分。<br>樣本: ' + n + ' 個交易日（含對齊大盤 ' + bench + '）。' +
          '</div>';
      } catch (e) {
        $('ps-result').innerHTML = '❌ ' + e.message;
      }
    });
  }

  // ==============================================================
  // FEATURE 6 — 相關性熱力圖 (v301)
  // ==============================================================
  function buildCorrelation(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:#94a3b8;margin-bottom:8px">🔗 相關性熱力圖 — 多股 correlation matrix（投組分散性檢查）</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:10px"><input id="cor-syms" placeholder="多支股票，逗號分隔" value="2330,2454,2308,3711,1101" style="flex:1;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px">' +
      '<button id="cor-go" style="padding:6px 14px;background:#0891b2;border:0;color:#fff;border-radius:4px;cursor:pointer">計算</button></div>' +
      '<div id="cor-result"></div></div>';

    $('cor-go').addEventListener('click', async () => {
      const syms = $('cor-syms').value.split(',').map(s => s.trim()).filter(Boolean);
      const since = new Date(Date.now() - 180 * 24 * 3600e3).toISOString().slice(0, 10);
      $('cor-result').innerHTML = '⏳ 計算 ' + syms.length + ' 檔...';
      try {
        const series = {};
        await Promise.all(syms.map(async s => {
          const r = await fetch(SB_URL + '/rest/v1/daily_prices?symbol=eq.' + s + '&date=gte.' + since + '&select=date,close_price&order=date.asc', { headers: SB_H });
          const d = await r.json();
          series[s] = new Map(d.map(x => [x.date, x.close_price]));
        }));
        // align dates (intersect)
        const allDates = Array.from(series[syms[0]].keys()).filter(d => syms.every(s => series[s].has(d)));
        if (allDates.length < 30) { $('cor-result').innerHTML = '⚠️ 對齊資料不足'; return; }
        const rets = {};
        syms.forEach(s => {
          rets[s] = [];
          for (let i = 1; i < allDates.length; i++) {
            rets[s].push(series[s].get(allDates[i]) / series[s].get(allDates[i - 1]) - 1);
          }
        });
        function corr(a, b) {
          const n = a.length;
          const ma = a.reduce((s, x) => s + x, 0) / n;
          const mb = b.reduce((s, x) => s + x, 0) / n;
          let cov = 0, va = 0, vb = 0;
          for (let i = 0; i < n; i++) {
            cov += (a[i] - ma) * (b[i] - mb);
            va += (a[i] - ma) ** 2;
            vb += (b[i] - mb) ** 2;
          }
          return cov / Math.sqrt(va * vb || 1);
        }
        function colorOf(r) {
          if (r >= 0.8) return '#0d8043';
          if (r >= 0.5) return '#16a34a';
          if (r >= 0.2) return '#84cc16';
          if (r >= -0.2) return '#525252';
          if (r >= -0.5) return '#dc2626';
          return '#7f1d1d';
        }
        let html = '<div style="overflow-x:auto"><table style="border-collapse:collapse;font-size:11px;margin:auto"><thead><tr><th></th>';
        syms.forEach(s => { html += '<th style="padding:6px;color:#94a3b8;font-weight:600">' + s + '</th>'; });
        html += '</tr></thead><tbody>';
        syms.forEach(a => {
          html += '<tr><th style="padding:6px;color:#94a3b8;font-weight:600;text-align:right">' + a + '</th>';
          syms.forEach(b => {
            const r = a === b ? 1 : corr(rets[a], rets[b]);
            html += '<td style="background:' + colorOf(r) + ';color:#fff;padding:8px 10px;text-align:center;font-weight:600;min-width:50px">' + r.toFixed(2) + '</td>';
          });
          html += '</tr>';
        });
        html += '</tbody></table></div>' +
          '<div style="margin-top:10px;padding:8px;background:rgba(96,165,250,0.05);border:1px solid rgba(96,165,250,0.2);border-radius:4px;font-size:11px;color:#94a3b8;line-height:1.6">' +
          '💡 顏色：深綠 0.8+ 高度同步、綠 0.5+ 強相關、淺綠 0.2+ 弱相關、灰 中性、紅負相關。<strong>負相關股票配在一起風險分散最好</strong>。樣本 ' + (allDates.length - 1) + ' 個交易日。' +
          '</div>';
        $('cor-result').innerHTML = html;
      } catch (e) {
        $('cor-result').innerHTML = '❌ ' + e.message;
      }
    });
  }

  // ==============================================================
  // FEATURE 7 — 季節性分析 (v302)
  // ==============================================================
  function buildSeasonality(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:#94a3b8;margin-bottom:8px">🌸 季節性分析 — 月份 / 星期幾的歷史報酬統計</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:10px"><input id="se-sym" value="2330" style="flex:1;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px">' +
      '<button id="se-go" style="padding:6px 14px;background:#ea580c;border:0;color:#fff;border-radius:4px;cursor:pointer">分析</button></div>' +
      '<div id="se-result"></div></div>';

    const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
    const WDAYS = ['周日','周一','周二','周三','周四','周五','周六'];

    $('se-go').addEventListener('click', async () => {
      const sym = $('se-sym').value.trim();
      const since = new Date(Date.now() - 5 * 365 * 24 * 3600e3).toISOString().slice(0, 10);
      $('se-result').innerHTML = '⏳ 抓 5 年資料...';
      try {
        const r = await fetch(SB_URL + '/rest/v1/daily_prices?symbol=eq.' + sym + '&date=gte.' + since + '&select=date,close_price&order=date.asc&limit=2000', { headers: SB_H });
        const data = await r.json();
        if (data.length < 60) { $('se-result').innerHTML = '⚠️ 資料不足'; return; }
        const monthStats = Array.from({length: 12}, () => ({ rets: [], wins: 0 }));
        const wdayStats = Array.from({length: 7}, () => ({ rets: [], wins: 0 }));
        for (let i = 1; i < data.length; i++) {
          const ret = (data[i].close_price / data[i - 1].close_price) - 1;
          const dt = new Date(data[i].date);
          const m = dt.getUTCMonth();
          const w = dt.getUTCDay();
          monthStats[m].rets.push(ret);
          wdayStats[w].rets.push(ret);
          if (ret > 0) monthStats[m].wins++;
          if (ret > 0) wdayStats[w].wins++;
        }
        function compileBars(stats, labels) {
          const items = stats.map((s, i) => {
            const n = s.rets.length;
            const mean = n ? s.rets.reduce((a, b) => a + b, 0) / n * 100 : 0;
            const winRate = n ? (s.wins / n) * 100 : 0;
            return { label: labels[i], mean, winRate, n };
          });
          const maxAbs = Math.max.apply(null, items.map(x => Math.abs(x.mean))) || 1;
          let html = '<div style="display:flex;flex-direction:column;gap:4px;font-size:12px">';
          items.forEach(it => {
            const w = (Math.abs(it.mean) / maxAbs) * 50;
            const isPos = it.mean >= 0;
            html += '<div style="display:grid;grid-template-columns:60px 100px 1fr;gap:8px;align-items:center">' +
              '<span style="color:#94a3b8">' + it.label + '</span>' +
              '<span style="color:' + (isPos ? '#34d399' : '#f87171') + ';font-family:monospace">' + (isPos ? '+' : '') + it.mean.toFixed(3) + '%</span>' +
              '<div style="position:relative;height:18px;background:#1e293b;border-radius:3px">' +
              '<div style="position:absolute;left:50%;top:0;bottom:0;background:' + (isPos ? '#34d399' : '#f87171') + ';width:' + w + '%;' + (isPos ? 'left:50%;' : 'right:50%;left:auto;') + '"></div>' +
              '<span style="position:absolute;right:6px;top:1px;font-size:10px;color:#94a3b8">勝率 ' + it.winRate.toFixed(0) + '% / n=' + it.n + '</span>' +
              '</div></div>';
          });
          html += '</div>';
          return html;
        }
        $('se-result').innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">' +
          '<div><div style="font-weight:700;color:#fff;margin-bottom:6px">📅 按月份統計（過去 5 年）</div>' + compileBars(monthStats, MONTHS) + '</div>' +
          '<div><div style="font-weight:700;color:#fff;margin-bottom:6px">📆 按星期幾統計</div>' + compileBars(wdayStats, WDAYS) + '</div>' +
          '</div>' +
          '<div style="margin-top:10px;padding:8px;background:rgba(234,88,12,0.05);border:1px solid rgba(234,88,12,0.2);border-radius:4px;font-size:11px;color:#94a3b8">💡 季節性效應在學術上稱為「日曆異常」(calendar anomaly)，過去報酬不代表未來。樣本 ' + (data.length - 1) + ' 個交易日。</div>';
      } catch (e) {
        $('se-result').innerHTML = '❌ ' + e.message;
      }
    });
  }

  // ==============================================================
  // FEATURE 8 — 黑天鵝偵測 (v303)
  // ==============================================================
  function buildBlackSwan(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:#94a3b8;margin-bottom:8px">🦢 黑天鵝偵測 — 找出歷史上 ±3 sigma 的異常事件（罕見極端日）</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:10px"><input id="bs2-sym" value="2330" style="flex:1;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px">' +
      '<input id="bs2-sigma" type="number" value="3" step="0.5" style="width:80px;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px" title="sigma threshold">' +
      '<button id="bs2-go" style="padding:6px 14px;background:#dc2626;border:0;color:#fff;border-radius:4px;cursor:pointer">尋找</button></div>' +
      '<div id="bs2-result"></div></div>';

    $('bs2-go').addEventListener('click', async () => {
      const sym = $('bs2-sym').value.trim();
      const sigmaT = parseFloat($('bs2-sigma').value) || 3;
      const since = new Date(Date.now() - 5 * 365 * 24 * 3600e3).toISOString().slice(0, 10);
      $('bs2-result').innerHTML = '⏳ 偵測中...';
      try {
        const r = await fetch(SB_URL + '/rest/v1/daily_prices?symbol=eq.' + sym + '&date=gte.' + since + '&select=date,close_price&order=date.asc&limit=2000', { headers: SB_H });
        const data = await r.json();
        if (data.length < 30) { $('bs2-result').innerHTML = '⚠️ 資料不足'; return; }
        const rets = [];
        for (let i = 1; i < data.length; i++) rets.push((data[i].close_price / data[i - 1].close_price) - 1);
        const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
        const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / rets.length;
        const std = Math.sqrt(variance);
        const events = [];
        for (let i = 0; i < rets.length; i++) {
          const z = (rets[i] - mean) / std;
          if (Math.abs(z) >= sigmaT) {
            events.push({ date: data[i + 1].date, ret: rets[i] * 100, z, price: data[i + 1].close_price });
          }
        }
        events.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
        let html = '<div style="background:rgba(220,38,38,0.05);border:1px solid rgba(220,38,38,0.3);border-radius:6px;padding:10px;margin-bottom:8px">' +
          '<div style="font-size:18px;color:#fff;font-weight:700;margin-bottom:6px">🦢 偵測到 ' + events.length + ' 個 ' + sigmaT + 'σ 黑天鵝事件</div>' +
          '<div style="font-size:12px;color:#94a3b8">過去 ' + Math.floor(rets.length / 252) + ' 年 · 平均日報酬 ' + (mean * 100).toFixed(3) + '% · 標準差 ' + (std * 100).toFixed(2) + '%</div></div>';
        if (events.length === 0) {
          html += '<div style="color:#94a3b8;padding:10px">過去 5 年無 ' + sigmaT + 'σ 等級異常事件，標的相對穩定</div>';
        } else {
          html += '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="border-bottom:1px solid #334155;color:#94a3b8"><th style="padding:6px;text-align:left">日期</th><th style="text-align:right">報酬</th><th style="text-align:right">Z-score</th><th style="text-align:right">收盤</th></tr></thead><tbody>';
          events.slice(0, 30).forEach(e => {
            html += '<tr style="border-bottom:1px solid #1e293b"><td style="padding:6px">' + e.date + '</td>' +
              '<td style="text-align:right;color:' + (e.ret >= 0 ? '#34d399' : '#f87171') + ';font-weight:700">' + (e.ret >= 0 ? '+' : '') + e.ret.toFixed(2) + '%</td>' +
              '<td style="text-align:right;color:#fbbf24;font-weight:700">' + (e.z >= 0 ? '+' : '') + e.z.toFixed(2) + 'σ</td>' +
              '<td style="text-align:right">' + fmt(e.price, 2) + '</td></tr>';
          });
          html += '</tbody></table>';
          if (events.length > 30) html += '<div style="margin-top:6px;color:#64748b;font-size:11px">… 及另外 ' + (events.length - 30) + ' 個</div>';
        }
        $('bs2-result').innerHTML = html;
      } catch (e) {
        $('bs2-result').innerHTML = '❌ ' + e.message;
      }
    });
  }

  // ==============================================================
  // FEATURE 9 — Theme 切換 + Cmd+K 快速搜尋 (v304)
  // ==============================================================
  function buildThemeAndKBar() {
    // Theme: only adds toggle button (we already use dark theme by default)
    const KEY = 'mr_v281_theme';
    function applyTheme(t) {
      document.documentElement.dataset.v281Theme = t;
      if (t === 'light') {
        // Inject light theme overrides
        let st = document.getElementById('v281-theme-style');
        if (!st) {
          st = document.createElement('style'); st.id = 'v281-theme-style';
          document.head.appendChild(st);
        }
        st.textContent = `
          [data-v281-theme="light"] body { background: #f8fafc !important; color: #1e293b !important; }
          [data-v281-theme="light"] .section, [data-v281-theme="light"] [class*="section"] { background: #ffffff !important; border-color: #e2e8f0 !important; color: #1e293b !important; }
          [data-v281-theme="light"] input, [data-v281-theme="light"] select, [data-v281-theme="light"] textarea { background: #f1f5f9 !important; color: #1e293b !important; border-color: #cbd5e1 !important; }
          [data-v281-theme="light"] table { color: #1e293b !important; }
          [data-v281-theme="light"] .v275-h, [data-v281-theme="light"] [class*="drag-handle"] { color: rgba(0,0,0,0.4) !important; background: rgba(0,0,0,0.05) !important; }
        `;
      } else {
        const st = document.getElementById('v281-theme-style');
        if (st) st.textContent = '';
      }
      try { localStorage.setItem(KEY, t); } catch {}
    }
    const initTheme = (() => { try { return localStorage.getItem(KEY) || 'dark'; } catch { return 'dark'; } })();
    applyTheme(initTheme);

    if ($('v281-theme-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'v281-theme-btn';
    btn.textContent = initTheme === 'dark' ? '☀️' : '🌙';
    btn.title = '切換明暗主題';
    btn.style.cssText = 'position:fixed;top:14px;right:14px;z-index:9998;padding:6px 10px;background:rgba(96,165,250,0.15);border:1px solid rgba(96,165,250,0.3);color:#fff;border-radius:6px;cursor:pointer;font-size:14px';
    btn.addEventListener('click', () => {
      const cur = document.documentElement.dataset.v281Theme || 'dark';
      const next = cur === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      btn.textContent = next === 'dark' ? '☀️' : '🌙';
    });
    document.body.appendChild(btn);

    // Cmd+K palette
    if ($('v281-kbar')) return;
    const kbar = document.createElement('div');
    kbar.id = 'v281-kbar';
    kbar.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:99999;align-items:flex-start;justify-content:center;padding-top:80px';
    kbar.innerHTML = '<div style="background:#0f172a;border:1px solid #334155;border-radius:12px;padding:16px;width:90%;max-width:600px;box-shadow:0 24px 60px rgba(0,0,0,0.5)">' +
      '<input id="kbar-input" placeholder="🔍 輸入股票代號或功能名稱（例: 2330, heatmap, dcf, paper）..." style="width:100%;padding:12px;background:#0a0f1c;border:1px solid #475569;color:#fff;border-radius:8px;font-size:15px;outline:none">' +
      '<div id="kbar-list" style="margin-top:12px;max-height:400px;overflow:auto"></div>' +
      '<div style="margin-top:8px;color:#64748b;font-size:11px">↑↓ 移動 · Enter 跳轉 · Esc 關閉</div></div>';
    document.body.appendChild(kbar);
    const FUNCS = [
      { kw: 'heatmap 熱力圖', id: 'v277-heatmap', label: '🔥 台股熱力圖' },
      { kw: 'dcf 估值', id: 'v280-dcf', label: '💎 DCF 估值模型' },
      { kw: 'risk 風險', id: 'v282-risk', label: '⚖️ 部位 / 風險計算' },
      { kw: 'backtest 回測', id: 'v283-backtest', label: '🔬 SMA Cross 回測' },
      { kw: 'screener 篩選', id: 'v284-screener', label: '🎯 進階篩選器' },
      { kw: 'replay 回放', id: 'v285-replay', label: '🎬 K 線回放練習' },
      { kw: '13f hedge', id: 'v286-13f', label: '🐋 13F 對沖基金' },
      { kw: 'colors 顏色', id: 'v288-colors', label: '🎨 自選股顏色' },
      { kw: 'multichart 多股', id: 'v289-multichart', label: '📊 多股 K 線比較' },
      { kw: 'pinescript 自定指標', id: 'v290-pinescript', label: '📐 Pine Script-like' },
      { kw: 'paper 模擬', id: 'v291-paper', label: '📒 模擬交易' },
      { kw: 'taxloss 稅損', id: 'v292-taxloss', label: '💸 稅損收割' },
      { kw: 'opinions 筆記', id: 'v293-opinions', label: '💭 投資筆記' },
      { kw: 'stocktwits 情緒', id: 'v294-stocktwits', label: '💬 StockTwits 社群' },
      { kw: 'options 期權', id: 'v295-options', label: '📋 美股期權鏈' },
      { kw: 'earnings ai', id: 'v296-earnings-ai', label: '🤖 Earnings AI 摘要' }
    ];
    let selected = 0, filtered = FUNCS.slice();
    function render() {
      const q = $('kbar-input').value.toLowerCase().trim();
      filtered = q ? FUNCS.filter(f => f.kw.includes(q) || f.label.toLowerCase().includes(q)) : FUNCS.slice();
      // Also: if q looks like stock symbol, add direct stock action
      if (/^[0-9A-Z]+$/i.test(q)) filtered.unshift({ kw: q, action: 'stock', label: '📈 查詢股票 ' + q.toUpperCase() });
      selected = Math.min(selected, filtered.length - 1);
      $('kbar-list').innerHTML = filtered.length === 0 ? '<div style="padding:10px;color:#94a3b8">無符合</div>' :
        filtered.map((f, i) => '<div class="kbar-item" data-i="' + i + '" style="padding:10px;border-radius:6px;cursor:pointer;color:' + (i === selected ? '#fff' : '#cbd5e1') + ';background:' + (i === selected ? 'rgba(96,165,250,0.15)' : 'transparent') + '">' + f.label + '</div>').join('');
      $('kbar-list').querySelectorAll('.kbar-item').forEach(el => {
        el.addEventListener('mouseenter', () => { selected = parseInt(el.dataset.i); render(); });
        el.addEventListener('click', () => exec(filtered[parseInt(el.dataset.i)]));
      });
    }
    function exec(item) {
      kbar.style.display = 'none';
      if (item.action === 'stock') {
        const inp = document.querySelector('#stockSearch, #twStockInput, #stockInput');
        if (inp) { inp.value = item.kw.toUpperCase(); inp.dispatchEvent(new Event('input', { bubbles: true })); }
        if (typeof window.searchStock === 'function') window.searchStock(item.kw.toUpperCase());
      } else if (item.id) {
        const el = document.getElementById(item.id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          el.style.boxShadow = '0 0 0 2px rgba(96,165,250,0.5)';
          setTimeout(() => el.style.boxShadow = '', 2000);
        }
      }
    }
    function open() {
      kbar.style.display = 'flex';
      $('kbar-input').value = '';
      selected = 0;
      render();
      $('kbar-input').focus();
    }
    function close() { kbar.style.display = 'none'; }
    $('kbar-input').addEventListener('input', render);
    $('kbar-input').addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); selected = Math.min(filtered.length - 1, selected + 1); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); selected = Math.max(0, selected - 1); render(); }
      else if (e.key === 'Enter') { if (filtered[selected]) exec(filtered[selected]); }
      else if (e.key === 'Escape') close();
    });
    kbar.addEventListener('click', e => { if (e.target === kbar) close(); });
    document.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); open(); }
    });
  }

  // ==============================================================
  // BUNDLE INIT
  // ==============================================================
  function injectSection(parentTab, id, title, builder) {
    const tab = $(parentTab);
    if (!tab) return;
    if ($(id)) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'section';
    wrapper.style.marginTop = '20px';
    wrapper.dataset.v275Key = id;
    wrapper.innerHTML = '<div class="section-title" style="font-weight:700;font-size:16px;margin-bottom:10px">' + title + '</div><div id="' + id + '"></div>';
    tab.appendChild(wrapper);
    builder(id);
  }

  function buildAll() {
    injectSection('tab-tools', 'v297-tech', '📐 完整技術指標 (ADX/Stoch/CCI/BB)', buildTechIndicators);
    injectSection('tab-tools', 'v298-blackscholes', '⚖️ Black-Scholes + Greeks', buildBlackScholes);
    injectSection('tab-tools', 'v299-montecarlo', '🎲 Monte Carlo 投組模擬', buildMonteCarlo);
    injectSection('tab-portfolio', 'v300-portstats', '📈 投組統計 (Sharpe/Sortino/Beta)', buildPortfolioStats);
    injectSection('tab-portfolio', 'v301-correlation', '🔗 相關性熱力圖', buildCorrelation);
    injectSection('tab-tools', 'v302-seasonality', '🌸 季節性分析（月份/星期）', buildSeasonality);
    injectSection('tab-tools', 'v303-blackswan', '🦢 黑天鵝偵測（3-sigma）', buildBlackSwan);
    buildThemeAndKBar();
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

  window.v281 = {
    version: VERSION,
    rebuild: buildAll,
    tech: buildTechIndicators,
    bs: buildBlackScholes,
    mc: buildMonteCarlo,
    stats: buildPortfolioStats,
    correlation: buildCorrelation,
    seasonality: buildSeasonality,
    blackswan: buildBlackSwan
  };
  console.log('[' + VERSION + '] 9 features loaded');
})();
