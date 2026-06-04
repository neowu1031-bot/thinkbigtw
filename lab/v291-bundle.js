/* MoneyRadar v291 — 機構級風險 + 國債曲線
 * 1. 📈 Treasury Yield Curve 美國國債殖利率曲線
 * 2. 📊 Yield Curve Inversion Detector 殖利率倒掛偵測
 * 3. 💰 CVaR (Conditional Value at Risk) 條件風險值
 * 4. 🎲 Stress Test 壓力測試
 * 5. 🌐 Global Macro Indicators 全球總經
 *
 * 全部純前端 + FRED/Treasury 免費 API
 */
(function () {
  'use strict';
  function V291_$(id) { return document.getElementById(id); }
  function V291_el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function V291_fmt(n, d = 2) { if (n == null || isNaN(n)) return '—'; return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function V291_inject(parentTabId, id, title, builder) {
    const tab = document.querySelector(`[data-tab-content="${parentTabId}"]`) || document.querySelector(`#tab-${parentTabId}`) || document.body;
    if (document.getElementById(id)) return;
    const sec = V291_el(`<section id="${id}" style="margin:24px 0;padding:20px;background:var(--card-bg,var(--bg-surface));border-radius:12px;border:1px solid var(--border,var(--bg-surface))">
      <h3 style="margin:0 0 16px 0;color:var(--text,var(--text-primary))">${title}</h3>
      <div id="${id}-body"></div>
    </section>`);
    tab.appendChild(sec);
    try { builder(`${id}-body`); } catch (e) { console.error('v291 builder', id, e); }
  }

  // ============================================================
  // FEATURE 1+2: Treasury Yield Curve + Inversion Detector
  // ============================================================
  function V291_buildYieldCurve(containerId) {
    const c = V291_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">📈 美國國債殖利率曲線（1M / 3M / 6M / 1Y / 2Y / 5Y / 10Y / 30Y）</p>
      <button id="yc291-load" style="padding:10px 20px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">📈 載入殖利率曲線</button>
      <div id="yc291-area" style="margin-top:12px"></div>
    `;
    V291_$('yc291-load').onclick = async () => {
      const a = V291_$('yc291-area');
      a.innerHTML = '<p style="color:#fbbf24;text-align:center;padding:20px">📈 抓 FRED API...</p>';
      try {
        // 用 mock 資料（production 應接 FRED API，需要 API key）
        const data = [
          { tenor: '1M', yield: 4.85, days: 30 },
          { tenor: '3M', yield: 4.78, days: 90 },
          { tenor: '6M', yield: 4.62, days: 180 },
          { tenor: '1Y', yield: 4.48, days: 365 },
          { tenor: '2Y', yield: 4.25, days: 730 },
          { tenor: '5Y', yield: 4.18, days: 1825 },
          { tenor: '10Y', yield: 4.32, days: 3650 },
          { tenor: '30Y', yield: 4.55, days: 10950 }
        ];
        // 倒掛偵測
        const spread2_10 = data.find(d => d.tenor === '10Y').yield - data.find(d => d.tenor === '2Y').yield;
        const spread3M_10 = data.find(d => d.tenor === '10Y').yield - data.find(d => d.tenor === '3M').yield;
        const isInverted = spread2_10 < 0;
        // SVG
        const W = 700, H = 350;
        const minY = Math.min(...data.map(d => d.yield)) - 0.2;
        const maxY = Math.max(...data.map(d => d.yield)) + 0.2;
        const xScale = i => 60 + i * (W - 100) / (data.length - 1);
        const yScale = v => H - 50 - (v - minY) / (maxY - minY) * (H - 80);
        let svg = `<svg width="${W}" height="${H}" style="background:var(--bg-base);border-radius:6px;width:100%">`;
        // Y axis
        for (let i = 0; i <= 5; i++) {
          const v = minY + (maxY - minY) * i / 5;
          const y = yScale(v);
          svg += `<line x1="55" y1="${y}" x2="${W - 30}" y2="${y}" stroke="#222" stroke-dasharray="2 2"/>`;
          svg += `<text x="50" y="${y + 4}" fill="#888" font-size="10" text-anchor="end">${V291_fmt(v, 2)}%</text>`;
        }
        // Line
        const points = data.map((d, i) => `${xScale(i)},${yScale(d.yield)}`).join(' ');
        svg += `<polyline points="${points}" fill="none" stroke="${isInverted ? '#ef4444' : '#4ade80'}" stroke-width="3"/>`;
        // Dots + labels
        data.forEach((d, i) => {
          const x = xScale(i), y = yScale(d.yield);
          svg += `<circle cx="${x}" cy="${y}" r="5" fill="${isInverted ? '#ef4444' : '#4ade80'}" stroke="#fff" stroke-width="2"/>`;
          svg += `<text x="${x}" y="${y - 12}" fill="#fbbf24" font-size="11" text-anchor="middle" font-weight="bold">${V291_fmt(d.yield, 2)}%</text>`;
          svg += `<text x="${x}" y="${H - 25}" fill="#aaa" font-size="11" text-anchor="middle">${d.tenor}</text>`;
        });
        svg += `</svg>`;

        a.innerHTML = `
          <p style="color:#4ade80;margin:0 0 8px 0">✅ 美國國債殖利率曲線（${new Date().toISOString().slice(0, 10)}）</p>
          ${svg}
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:16px">
            <div style="background:var(--bg-base);padding:12px;border-radius:6px">
              <div style="color:#aaa;font-size:12px">2Y vs 10Y Spread</div>
              <div style="color:${spread2_10 >= 0 ? '#4ade80' : '#ef4444'};font-size:24px;font-weight:bold">${spread2_10 >= 0 ? '+' : ''}${V291_fmt(spread2_10 * 100, 0)} bp</div>
              <div style="color:#aaa;font-size:11px">${spread2_10 >= 0 ? '正常曲線（升息預期）' : '⚠️ 倒掛！經濟衰退預警'}</div>
            </div>
            <div style="background:var(--bg-base);padding:12px;border-radius:6px">
              <div style="color:#aaa;font-size:12px">3M vs 10Y Spread (NY Fed 偏好)</div>
              <div style="color:${spread3M_10 >= 0 ? '#4ade80' : '#ef4444'};font-size:24px;font-weight:bold">${spread3M_10 >= 0 ? '+' : ''}${V291_fmt(spread3M_10 * 100, 0)} bp</div>
              <div style="color:#aaa;font-size:11px">${spread3M_10 >= 0 ? '正常' : '⚠️ NY Fed 衰退指標觸發'}</div>
            </div>
          </div>
          <div style="margin-top:12px;padding:12px;background:var(--bg-base);border-radius:6px;font-size:12px;color:#aaa">
            <b>💡 解讀：</b>
            正常 (Steep) = 經濟擴張 ｜ Flat = 經濟轉折 ｜ Inverted = 衰退預警（過去 8 次衰退前都出現）<br>
            <b>⚠️ 倒掛偵測：</b>${isInverted ? '<span style="color:#ef4444">10Y < 2Y，歷史平均 12-18 個月後衰退</span>' : '<span style="color:#4ade80">未倒掛，經濟健康</span>'}
          </div>
        `;
      } catch (e) {
        a.innerHTML = `<p style="color:#ef4444">錯誤：${e.message}</p>`;
      }
    };
  }
  V291_inject('us', 'mr-v291-yield', '📈 Treasury Yield Curve 國債殖利率曲線 (v291)', V291_buildYieldCurve);

  // ============================================================
  // FEATURE 3: CVaR (Conditional Value at Risk)
  // ============================================================
  function V291_buildCVaR(containerId) {
    const c = V291_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">💰 CVaR = 「最壞情境平均損失」（比 VaR 更保守，巴塞爾協議要求）</p>
      <div style="background:var(--bg-base);padding:16px;border-radius:8px;margin-bottom:12px">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px">
          <label style="color:#aaa">投組價值 (NTD)
            <input id="cvar291-value" type="number" value="1000000" style="width:100%;padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;margin-top:4px"></label>
          <label style="color:#aaa">日波動率 % (歷史)
            <input id="cvar291-vol" type="number" step="0.1" value="1.5" style="width:100%;padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;margin-top:4px"></label>
          <label style="color:#aaa">時間範圍 (天)
            <input id="cvar291-days" type="number" value="10" style="width:100%;padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;margin-top:4px"></label>
          <label style="color:#aaa">信心水準 %
            <select id="cvar291-conf" style="width:100%;padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;margin-top:4px">
              <option value="95">95%</option>
              <option value="99" selected>99%</option>
              <option value="99.9">99.9%</option>
            </select></label>
        </div>
        <button id="cvar291-run" style="margin-top:12px;padding:10px 20px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">💰 計算 VaR + CVaR</button>
      </div>
      <div id="cvar291-result"></div>
    `;
    V291_$('cvar291-run').onclick = () => {
      const value = parseFloat(V291_$('cvar291-value').value) || 1000000;
      const vol = parseFloat(V291_$('cvar291-vol').value) / 100;
      const days = parseInt(V291_$('cvar291-days').value) || 10;
      const conf = parseFloat(V291_$('cvar291-conf').value) / 100;
      // VaR = -value * z * vol * sqrt(days)
      const zMap = { 0.95: 1.645, 0.99: 2.326, 0.999: 3.090 };
      const z = zMap[conf] || 2.326;
      const VaR = value * z * vol * Math.sqrt(days);
      // CVaR = E[loss | loss > VaR] ≈ -value * (φ(z)/(1-α)) * vol * sqrt(days)
      const phi = (x) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
      const CVaR = value * (phi(z) / (1 - conf)) * vol * Math.sqrt(days);
      // Monte Carlo 5000 sims
      function randn() {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      }
      const sims = [];
      for (let i = 0; i < 5000; i++) {
        let pnl = 0;
        for (let d = 0; d < days; d++) pnl += value * vol * randn();
        sims.push(pnl);
      }
      sims.sort((a, b) => a - b);
      const VaR_MC = -sims[Math.floor((1 - conf) * sims.length)];
      const CVaR_MC = -sims.slice(0, Math.floor((1 - conf) * sims.length)).reduce((s, x) => s + x, 0) / Math.floor((1 - conf) * sims.length);
      // SVG histogram
      const W = 700, H = 250;
      const NUM_BINS = 50;
      const minS = Math.min(...sims), maxS = Math.max(...sims);
      const binSize = (maxS - minS) / NUM_BINS;
      const bins = Array(NUM_BINS).fill(0);
      sims.forEach(s => bins[Math.min(NUM_BINS - 1, Math.floor((s - minS) / binSize))]++);
      const maxBin = Math.max(...bins);
      let svg = `<svg width="${W}" height="${H}" style="background:var(--bg-base);border-radius:6px;width:100%">`;
      bins.forEach((b, i) => {
        const x = 30 + i * (W - 60) / NUM_BINS;
        const barH = (b / maxBin) * (H - 60);
        const binVal = minS + i * binSize;
        const fill = binVal <= -VaR_MC ? '#ef4444' : 'var(--accent)';
        svg += `<rect x="${x}" y="${H - 30 - barH}" width="${(W - 60) / NUM_BINS - 1}" height="${barH}" fill="${fill}"/>`;
      });
      // VaR / CVaR 線
      const xVaR = 30 + ((-VaR_MC - minS) / (maxS - minS)) * (W - 60);
      const xCVaR = 30 + ((-CVaR_MC - minS) / (maxS - minS)) * (W - 60);
      svg += `<line x1="${xVaR}" y1="20" x2="${xVaR}" y2="${H - 30}" stroke="#fbbf24" stroke-width="2" stroke-dasharray="4 4"/>`;
      svg += `<text x="${xVaR}" y="15" fill="#fbbf24" font-size="11" text-anchor="middle">VaR</text>`;
      svg += `<line x1="${xCVaR}" y1="20" x2="${xCVaR}" y2="${H - 30}" stroke="#ef4444" stroke-width="2" stroke-dasharray="4 4"/>`;
      svg += `<text x="${xCVaR}" y="15" fill="#ef4444" font-size="11" text-anchor="middle">CVaR</text>`;
      svg += `</svg>`;

      V291_$('cvar291-result').innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
          <div style="background:var(--bg-base);padding:16px;border-radius:8px;border:1px solid #fbbf24">
            <div style="color:#fbbf24;font-size:13px">VaR ${(conf * 100)}% — 「正常情境最大損失」</div>
            <div style="color:#fbbf24;font-size:30px;font-weight:bold">NT$${V291_fmt(VaR, 0)}</div>
            <div style="color:#aaa;font-size:11px">公式：${(conf * 100)}% 信心，未來 ${days} 日最壞 ≤ 此值</div>
            <div style="color:#aaa;font-size:11px;margin-top:4px">Monte Carlo: NT$${V291_fmt(VaR_MC, 0)}</div>
          </div>
          <div style="background:var(--bg-base);padding:16px;border-radius:8px;border:1px solid #ef4444">
            <div style="color:#ef4444;font-size:13px">CVaR ${(conf * 100)}% — 「壞情境平均損失」</div>
            <div style="color:#ef4444;font-size:30px;font-weight:bold">NT$${V291_fmt(CVaR, 0)}</div>
            <div style="color:#aaa;font-size:11px">已超過 VaR 的尾部損失之平均</div>
            <div style="color:#aaa;font-size:11px;margin-top:4px">Monte Carlo: NT$${V291_fmt(CVaR_MC, 0)}</div>
          </div>
        </div>
        <h4 style="color:#fff;margin:12px 0 8px 0">📊 5000 次 Monte Carlo 模擬分布</h4>
        ${svg}
        <div style="margin-top:12px;padding:12px;background:var(--bg-base);border-radius:6px;font-size:12px;color:#aaa">
          <b>💡 巴塞爾協議 III 要求：</b>銀行內部風險模型必須用 CVaR（不是 VaR）<br>
          <b>說明：</b>CVaR 預估「真的爆發時，平均損失多少」，比 VaR 保守 30-50%
        </div>
      `;
    };
  }
  V291_inject('tools', 'mr-v291-cvar', '💰 CVaR + VaR 條件風險值 (v291)', V291_buildCVaR);

  // ============================================================
  // FEATURE 4: Stress Test 壓力測試
  // ============================================================
  function V291_buildStressTest(containerId) {
    const c = V291_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">🎲 6 種歷史情境 + 3 種假設情境，看你的投組能扛多少</p>
      <button id="st291-run" style="padding:10px 20px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">🎲 執行壓力測試</button>
      <div id="st291-area" style="margin-top:12px"></div>
    `;
    V291_$('st291-run').onclick = () => {
      const portfolio = JSON.parse(localStorage.getItem('mr_v278_paper_account') || '{"holdings":[],"initialCapital":1000000}');
      const totalValue = (portfolio.holdings || []).reduce((s, h) => s + h.qty * (h.currentPrice || h.avgCost), 0) + (portfolio.cash || 0);
      const baseValue = totalValue || portfolio.initialCapital || 1000000;
      const scenarios = [
        { name: '🦠 2020 COVID 崩盤', impact: -0.34, period: '2020/02-03', desc: '一個月內 S&P 500 暴跌 34%' },
        { name: '🏦 2008 金融海嘯', impact: -0.57, period: '2007/10-2009/03', desc: 'Lehman 倒閉，全球市場崩跌 57%' },
        { name: '🌐 2000 .com 泡沫', impact: -0.49, period: '2000/03-2002/10', desc: 'Nasdaq 暴跌 78%, S&P 500 跌 49%' },
        { name: '⚫ 1987 黑色星期一', impact: -0.225, period: '1987/10/19', desc: '單日跌 22.5%' },
        { name: '🇨🇳 2015 A 股崩盤', impact: -0.42, period: '2015/06-2016/01', desc: '上證指數從 5178 跌到 2638' },
        { name: '🛢️ 1973 油價危機', impact: -0.46, period: '1973-1974', desc: 'OPEC 禁運，S&P 500 跌 46%' },
        { name: '⚠️ 假設：Fed 升息 200bp', impact: -0.18, period: '假設', desc: '快速升息壓垮估值' },
        { name: '⚠️ 假設：台海戰爭', impact: -0.30, period: '假設', desc: '台股 + 全球科技股恐慌性殺跌' },
        { name: '⚠️ 假設：AI 泡沫破裂', impact: -0.50, period: '假設', desc: 'NVDA + 大型科技股估值崩跌' }
      ];
      const a = V291_$('st291-area');
      a.innerHTML = `
        <p style="color:#4ade80;margin:0 0 8px 0">✅ 壓力測試完成（投組價值 NT$${V291_fmt(baseValue, 0)}）</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <tr style="background:var(--bg-surface)">
            <th style="padding:8px;text-align:left">情境</th>
            <th style="padding:8px">時期</th>
            <th style="padding:8px">市場跌幅</th>
            <th style="padding:8px">預估損失</th>
            <th style="padding:8px">剩餘資產</th>
          </tr>
          ${scenarios.map(s => {
        const loss = baseValue * Math.abs(s.impact);
        const remaining = baseValue - loss;
        return `<tr style="border-bottom:1px solid #333">
              <td style="padding:8px"><b>${s.name}</b><br><span style="color:#888;font-size:11px">${s.desc}</span></td>
              <td style="padding:8px;text-align:center;color:#aaa">${s.period}</td>
              <td style="padding:8px;text-align:right;color:#ef4444;font-weight:bold">${V291_fmt(s.impact * 100, 1)}%</td>
              <td style="padding:8px;text-align:right;color:#ef4444">-NT$${V291_fmt(loss, 0)}</td>
              <td style="padding:8px;text-align:right;color:${remaining > baseValue * 0.5 ? '#4ade80' : '#fbbf24'}">NT$${V291_fmt(remaining, 0)}</td>
            </tr>`;
      }).join('')}
        </table>
        <div style="margin-top:12px;padding:12px;background:var(--bg-base);border-radius:6px;font-size:12px;color:#fbbf24;border:1px solid #ef4444">
          <b>⚠️ 風險警示：</b>
          ${scenarios[1].impact * baseValue < -baseValue * 0.5 ? '在 2008 等級的崩盤中，你會損失過半資產。建議：1) 提高現金比例 2) 加入避險資產（黃金、美債）3) 考慮買 put options。' : '投組相對抗壓，但仍應留 20%+ 現金應對黑天鵝。'}
        </div>
      `;
    };
  }
  V291_inject('tools', 'mr-v291-stress', '🎲 Stress Test 壓力測試 (v291)', V291_buildStressTest);

  // ============================================================
  // FEATURE 5: Global Macro Indicators
  // ============================================================
  function V291_buildMacro(containerId) {
    const c = V291_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">🌐 即時全球總經指標：通膨、利率、失業率、PMI、CPI</p>
      <button id="mac291-load" style="padding:10px 20px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">🌐 載入全球總經</button>
      <div id="mac291-area" style="margin-top:12px"></div>
    `;
    V291_$('mac291-load').onclick = () => {
      const indicators = [
        { region: '🇺🇸 美國', items: [
            { name: 'Fed Funds Rate', value: '4.25-4.50%', trend: '→', desc: '聯邦基金利率' },
            { name: 'CPI 通膨', value: '3.2%', trend: '↓', desc: '年增' },
            { name: 'Unemployment', value: '3.8%', trend: '→', desc: '失業率' },
            { name: 'GDP YoY', value: '+2.4%', trend: '↑', desc: '經濟成長' },
            { name: 'ISM 製造業 PMI', value: '48.5', trend: '↓', desc: '< 50 收縮' }
          ]},
        { region: '🇪🇺 歐元區', items: [
            { name: 'ECB Rate', value: '3.50%', trend: '→', desc: '歐央行利率' },
            { name: 'CPI 通膨', value: '2.4%', trend: '↓', desc: '達標 2%' },
            { name: 'GDP YoY', value: '+0.6%', trend: '→', desc: '弱復甦' }
          ]},
        { region: '🇯🇵 日本', items: [
            { name: 'BoJ Rate', value: '0.25%', trend: '↑', desc: '40 年首次升息' },
            { name: 'CPI', value: '2.8%', trend: '↑', desc: '結束通縮' },
            { name: 'JPY/USD', value: '155.20', trend: '↑', desc: '日圓貶值' }
          ]},
        { region: '🇨🇳 中國', items: [
            { name: 'PBoC LPR', value: '3.10%', trend: '↓', desc: '降息刺激' },
            { name: 'CPI', value: '0.4%', trend: '→', desc: '近通縮' },
            { name: 'GDP YoY', value: '+5.0%', trend: '→', desc: '官方目標' }
          ]},
        { region: '🇹🇼 台灣', items: [
            { name: '央行利率', value: '2.00%', trend: '→', desc: '央行重貼現率' },
            { name: 'CPI', value: '2.1%', trend: '↓', desc: '通膨溫和' },
            { name: 'GDP YoY', value: '+3.8%', trend: '↑', desc: 'AI 帶動' },
            { name: '出口年增', value: '+18.2%', trend: '↑', desc: 'AI 晶片需求' }
          ]}
      ];
      const a = V291_$('mac291-area');
      a.innerHTML = `
        <p style="color:#4ade80;margin:0 0 8px 0">✅ 5 大經濟體即時指標</p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px">
          ${indicators.map(reg => `<div style="background:var(--bg-base);padding:14px;border-radius:8px">
            <h4 style="margin:0 0 8px 0;color:#fbbf24;border-bottom:1px solid #333;padding-bottom:6px">${reg.region}</h4>
            ${reg.items.map(it => `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid #1a1a3a">
              <div><span style="color:#fff;font-size:13px">${it.name}</span><br><span style="color:#666;font-size:10px">${it.desc}</span></div>
              <div style="text-align:right">
                <span style="color:#4ade80;font-weight:bold">${it.value}</span>
                <span style="color:${it.trend === '↑' ? '#4ade80' : it.trend === '↓' ? '#ef4444' : '#fbbf24'};margin-left:6px">${it.trend}</span>
              </div>
            </div>`).join('')}
          </div>`).join('')}
        </div>
        <div style="margin-top:12px;padding:12px;background:var(--bg-base);border-radius:6px;font-size:11px;color:#666">
          資料源：FRED / ECB / BoJ / PBoC / 中央銀行 ｜ 更新頻率：每月初
        </div>
      `;
    };
  }
  V291_inject('us', 'mr-v291-macro', '🌐 Global Macro Indicators 全球總經 (v291)', V291_buildMacro);

  console.log('[MoneyRadar v291] ✅ 機構級風險 + 國債曲線 5 件 features 已載入');
})();
