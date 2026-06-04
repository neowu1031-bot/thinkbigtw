/* MoneyRadar v286 — Goldman Sachs 級量化套件
 * 1. 🎯 Long/Short 對沖策略生成器
 * 2. 🔄 Sector Rotation 產業輪動雷達
 * 3. 📊 Factor Investing 因子投資（Value/Growth/Momentum/Quality）
 * 4. ⚖️ Risk Parity 風險平價配置器
 * 5. 🎲 Kelly Criterion 凱利公式倉位管理
 *
 * 所有函數加 V286_ 前綴避免命名衝突
 */
(function () {
  'use strict';
  const W = 'https://moneyradar-ai-proxy.thinkbigtw.workers.dev';

  function V286_$(id) { return document.getElementById(id); }
  function V286_el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function V286_fmt(n, d = 2) { if (n == null || isNaN(n)) return '—'; return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function V286_inject(parentTabId, id, title, builder) {
    const tab = document.querySelector(`[data-tab-content="${parentTabId}"]`) || document.querySelector(`#tab-${parentTabId}`) || document.body;
    if (document.getElementById(id)) return;
    const sec = V286_el(`<section id="${id}" style="margin:24px 0;padding:20px;background:var(--card-bg,var(--bg-surface));border-radius:12px;border:1px solid var(--border,var(--bg-surface))">
      <h3 style="margin:0 0 16px 0;color:var(--text,var(--text-primary))">${title}</h3>
      <div id="${id}-body"></div>
    </section>`);
    tab.appendChild(sec);
    try { builder(`${id}-body`); } catch (e) { console.error('v286 builder', id, e); }
  }

  // ============================================================
  // FEATURE 1: 🎯 Long/Short 對沖策略生成器
  // ============================================================
  function V286_buildLongShort(containerId) {
    const c = V286_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">🎯 輸入候選股票池，AI 自動找出最佳 Long/Short 對沖配對（β-neutral 策略）</p>
      <div style="background:var(--bg-base);padding:16px;border-radius:8px;margin-bottom:12px">
        <textarea id="ls286-pool" rows="3" placeholder="股票代碼，逗號分隔（例：AAPL, MSFT, GOOG, META, NVDA, TSLA, AMD, INTC）" style="width:100%;padding:10px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px"></textarea>
        <div style="margin-top:8px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <label style="color:#aaa;font-size:13px">配對數:
            <input id="ls286-pairs" type="number" min="1" max="5" value="3" style="width:60px;padding:6px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;margin-left:4px"></label>
          <button id="ls286-run" style="padding:8px 16px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">🎯 生成 Long/Short 對</button>
        </div>
      </div>
      <div id="ls286-results"></div>
    `;
    V286_$('ls286-run').onclick = async () => {
      const symbols = V286_$('ls286-pool').value.split(/[,\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
      if (symbols.length < 2) return alert('至少輸入 2 個股票代碼');
      const pairs = parseInt(V286_$('ls286-pairs').value) || 3;
      const r = V286_$('ls286-results');
      r.innerHTML = '<p style="color:#fbbf24;text-align:center;padding:20px">🔍 分析中...抓 60 日歷史 → 計算相關係數 → 找最佳配對</p>';
      try {
        const resp = await fetch(`${W}/long-short-pairs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols, pairs })
        });
        const j = await resp.json();
        if (j.error) throw new Error(j.error);
        const rows = j.pairs || [];
        if (!rows.length) {
          r.innerHTML = '<p style="color:#888;text-align:center;padding:20px">無法生成配對</p>';
          return;
        }
        r.innerHTML = `
          <h4 style="color:#4ade80;margin:0 0 8px 0">✅ 找出 ${rows.length} 組最佳配對</h4>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr style="background:var(--bg-surface)">
              <th style="padding:8px">#</th>
              <th style="padding:8px">📈 Long</th>
              <th style="padding:8px">📉 Short</th>
              <th style="padding:8px">相關係數</th>
              <th style="padding:8px">動能差</th>
              <th style="padding:8px">建議倉位</th>
              <th style="padding:8px">預期 α</th>
            </tr>
            ${rows.map((p, i) => `<tr style="border-bottom:1px solid #333">
              <td style="padding:8px;text-align:center"><b>#${i + 1}</b></td>
              <td style="padding:8px;text-align:center;color:#4ade80;font-weight:bold">${p.long}</td>
              <td style="padding:8px;text-align:center;color:#ef4444;font-weight:bold">${p.short}</td>
              <td style="padding:8px;text-align:right">${V286_fmt(p.correlation, 3)}</td>
              <td style="padding:8px;text-align:right;color:${p.momentum_diff > 0 ? '#4ade80' : '#ef4444'}">${V286_fmt(p.momentum_diff * 100, 2)}%</td>
              <td style="padding:8px;text-align:right">${V286_fmt(p.position_size * 100, 1)}%</td>
              <td style="padding:8px;text-align:right;color:#fbbf24">${V286_fmt(p.expected_alpha * 100, 2)}%</td>
            </tr>`).join('')}
          </table>
          <div style="margin-top:16px;padding:12px;background:var(--bg-base);border-radius:6px;font-size:12px;color:#aaa">
            <b>💡 策略說明：</b><br>
            • <b>Long</b> = 做多預期上漲股，<b>Short</b> = 放空預期下跌股，β-neutral 不受大盤影響<br>
            • <b>動能差</b> = (Long 60日報酬) − (Short 60日報酬)，正值越大配對越強<br>
            • <b>預期 α</b> = 市場中性下的超額報酬，理論基礎：Pairs Trading（摩根士丹利 1980s 發明）<br>
            • 對沖基金 Renaissance / Citadel / D.E. Shaw 都用此策略
          </div>
        `;
      } catch (e) {
        r.innerHTML = `<p style="color:#ef4444">錯誤：${e.message}</p>`;
      }
    };
  }
  V286_inject('tools', 'mr-v286-longshort', '🎯 Long/Short 對沖策略生成器 (v286)', V286_buildLongShort);

  // ============================================================
  // FEATURE 2: 🔄 Sector Rotation 產業輪動雷達
  // ============================================================
  function V286_buildSectorRotation(containerId) {
    const c = V286_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">🔄 11 大產業 ETF 動能雷達 — 看資金流入哪些產業</p>
      <div style="margin-bottom:12px">
        <button id="sr286-load" style="padding:8px 16px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">🔄 載入產業輪動</button>
      </div>
      <div id="sr286-results"></div>
    `;
    V286_$('sr286-load').onclick = async () => {
      const r = V286_$('sr286-results');
      r.innerHTML = '<p style="color:#fbbf24;text-align:center;padding:20px">🔄 抓 11 大產業 ETF 數據...</p>';
      try {
        const resp = await fetch(`${W}/sector-rotation`);
        const j = await resp.json();
        const sectors = j.sectors || [];
        if (!sectors.length) {
          r.innerHTML = '<p style="color:#888">無資料</p>';
          return;
        }
        // 排序：依 1mo 報酬
        sectors.sort((a, b) => b.return_1m - a.return_1m);
        const W2 = 700, H2 = 60 * sectors.length + 40;
        // 條狀圖 — 強到弱
        const maxAbs = Math.max(...sectors.map(s => Math.abs(s.return_1m))) || 1;
        let svg = `<svg width="${W2}" height="${H2}" style="background:var(--bg-base);border-radius:6px;width:100%">`;
        const midX = W2 * 0.4;
        sectors.forEach((s, i) => {
          const y = 30 + i * 60;
          const w = (s.return_1m / maxAbs) * (W2 * 0.5);
          const color = s.return_1m >= 0 ? '#4ade80' : '#ef4444';
          svg += `<text x="${midX - 8}" y="${y + 5}" fill="#fff" font-size="13" text-anchor="end">${s.name}</text>`;
          svg += `<rect x="${midX}" y="${y - 12}" width="${Math.abs(w)}" height="24" fill="${color}" transform="${w < 0 ? `translate(${w}, 0)` : ''}"/>`;
          svg += `<text x="${midX + Math.abs(w) + (w < 0 ? -Math.abs(w) - 60 : 8)}" y="${y + 5}" fill="${color}" font-size="13" font-weight="bold">${s.return_1m >= 0 ? '+' : ''}${V286_fmt(s.return_1m * 100, 2)}%</text>`;
          svg += `<text x="${midX - 8}" y="${y + 22}" fill="#888" font-size="10" text-anchor="end">${s.symbol}</text>`;
        });
        svg += `<line x1="${midX}" y1="20" x2="${midX}" y2="${H2 - 10}" stroke="#666" stroke-dasharray="3 3"/>`;
        svg += `</svg>`;
        const top = sectors.slice(0, 3).map(s => s.name).join(' / ');
        const bot = sectors.slice(-3).map(s => s.name).join(' / ');
        r.innerHTML = `
          <p style="color:#4ade80;margin:0 0 8px 0">✅ 11 大產業排名（依 1 個月報酬）</p>
          ${svg}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
            <div style="background:#0f3a1f;padding:12px;border-radius:6px"><div style="color:#4ade80;font-weight:bold;font-size:12px">🚀 強勢產業（資金流入）</div><div style="color:#fff;margin-top:4px">${top}</div></div>
            <div style="background:#3a0f1f;padding:12px;border-radius:6px"><div style="color:#ef4444;font-weight:bold;font-size:12px">⛔ 弱勢產業（資金流出）</div><div style="color:#fff;margin-top:4px">${bot}</div></div>
          </div>
          <div style="margin-top:12px;padding:12px;background:var(--bg-base);border-radius:6px;font-size:12px;color:#aaa">
            <b>💡 產業輪動策略：</b> 經濟週期 4 階段（復甦→擴張→成熟→衰退），各階段最強產業不同。
            目前強勢的「${sectors[0].name}」+「${sectors[1].name}」可能反映市場處於 ${V286_phaseHint(sectors)} 階段。
          </div>
        `;
      } catch (e) {
        r.innerHTML = `<p style="color:#ef4444">錯誤：${e.message}</p>`;
      }
    };
  }
  function V286_phaseHint(sectors) {
    const top = sectors[0].symbol;
    const map = { XLK: '科技牛市/擴張', XLY: '消費復甦/擴張', XLF: '金融上升/復甦', XLE: '通膨擴張/成熟', XLV: '防禦性/衰退', XLP: '防禦性/衰退', XLU: '防禦性/衰退', XLI: '工業擴張', XLB: '原物料擴張', XLRE: '降息預期', XLC: '通訊牛市' };
    return map[top] || '混合';
  }
  V286_inject('us', 'mr-v286-sector', '🔄 Sector Rotation 產業輪動雷達 (v286)', V286_buildSectorRotation);

  // ============================================================
  // FEATURE 3: 📊 Factor Investing — 4 因子篩選
  // ============================================================
  function V286_buildFactorInvest(containerId) {
    const c = V286_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">📊 Fama-French 4 因子模型：找出符合你風格的股票（學術研究經諾貝爾獎驗證）</p>
      <div style="background:var(--bg-base);padding:16px;border-radius:8px;margin-bottom:12px">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
          <label style="color:#aaa">📉 Value 價值
            <select id="fi286-value" style="width:100%;padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;margin-top:4px">
              <option value="0">不偏重</option><option value="1">偏重</option><option value="2" selected>強烈偏重</option>
            </select></label>
          <label style="color:#aaa">📈 Growth 成長
            <select id="fi286-growth" style="width:100%;padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;margin-top:4px">
              <option value="0">不偏重</option><option value="1" selected>偏重</option><option value="2">強烈偏重</option>
            </select></label>
          <label style="color:#aaa">🚀 Momentum 動能
            <select id="fi286-momentum" style="width:100%;padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;margin-top:4px">
              <option value="0">不偏重</option><option value="1" selected>偏重</option><option value="2">強烈偏重</option>
            </select></label>
          <label style="color:#aaa">💎 Quality 品質
            <select id="fi286-quality" style="width:100%;padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;margin-top:4px">
              <option value="0">不偏重</option><option value="1">偏重</option><option value="2" selected>強烈偏重</option>
            </select></label>
        </div>
        <button id="fi286-run" style="margin-top:12px;padding:10px 20px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">📊 執行 4 因子篩選</button>
      </div>
      <div id="fi286-results"></div>
    `;
    V286_$('fi286-run').onclick = async () => {
      const v = parseInt(V286_$('fi286-value').value);
      const g = parseInt(V286_$('fi286-growth').value);
      const m = parseInt(V286_$('fi286-momentum').value);
      const q = parseInt(V286_$('fi286-quality').value);
      const r = V286_$('fi286-results');
      r.innerHTML = '<p style="color:#fbbf24;text-align:center;padding:20px">📊 計算 4 因子分數...</p>';
      try {
        const params = new URLSearchParams({ value: v, growth: g, momentum: m, quality: q });
        const resp = await fetch(`${W}/factor-screen?${params}`);
        const j = await resp.json();
        const rows = j.results || [];
        if (!rows.length) {
          r.innerHTML = '<p style="color:#888">無結果</p>';
          return;
        }
        r.innerHTML = `
          <p style="color:#4ade80">✅ 依 4 因子綜合分數排名（分數越高越符合你的風格）</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr style="background:var(--bg-surface)">
              <th style="padding:8px">排名</th><th style="padding:8px">代碼</th><th style="padding:8px">名稱</th>
              <th style="padding:8px;color:#fbbf24">綜合分數</th>
              <th style="padding:8px;color:#aaa">Value</th><th style="padding:8px;color:#aaa">Growth</th>
              <th style="padding:8px;color:#aaa">Momentum</th><th style="padding:8px;color:#aaa">Quality</th>
            </tr>
            ${rows.slice(0, 30).map((row, i) => `<tr style="border-bottom:1px solid #333">
              <td style="padding:6px;text-align:center">#${i + 1}</td>
              <td style="padding:6px"><b>${row.symbol}</b></td>
              <td style="padding:6px">${row.name}</td>
              <td style="padding:6px;text-align:right;color:#fbbf24;font-weight:bold">${V286_fmt(row.score, 2)}</td>
              <td style="padding:6px;text-align:right">${V286_fmt(row.value_score, 2)}</td>
              <td style="padding:6px;text-align:right">${V286_fmt(row.growth_score, 2)}</td>
              <td style="padding:6px;text-align:right">${V286_fmt(row.momentum_score, 2)}</td>
              <td style="padding:6px;text-align:right">${V286_fmt(row.quality_score, 2)}</td>
            </tr>`).join('')}
          </table>
          <div style="margin-top:12px;padding:12px;background:var(--bg-base);border-radius:6px;font-size:12px;color:#aaa">
            <b>💡 因子定義：</b> Value = 1/PE+1/PB｜Growth = 營收增長+EPS增長｜Momentum = 12-1月報酬｜Quality = ROE+毛利率
          </div>
        `;
      } catch (e) {
        r.innerHTML = `<p style="color:#ef4444">錯誤：${e.message}</p>`;
      }
    };
  }
  V286_inject('tools', 'mr-v286-factor', '📊 Factor Investing 4 因子模型 (v286)', V286_buildFactorInvest);

  // ============================================================
  // FEATURE 4: ⚖️ Risk Parity 風險平價配置器
  // ============================================================
  function V286_buildRiskParity(containerId) {
    const c = V286_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">⚖️ 橋水基金 Ray Dalio 全天候策略：每檔股票風險貢獻相同（不是市值權重）</p>
      <div style="background:var(--bg-base);padding:16px;border-radius:8px;margin-bottom:12px">
        <input id="rp286-symbols" placeholder="股票代碼，逗號分隔（例：SPY, TLT, GLD, DBC, VWO）" style="width:100%;padding:10px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px">
        <button id="rp286-run" style="margin-top:8px;padding:8px 16px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">⚖️ 計算風險平價配置</button>
      </div>
      <div id="rp286-results"></div>
    `;
    V286_$('rp286-run').onclick = async () => {
      const symbols = V286_$('rp286-symbols').value.split(/[,\s]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
      if (symbols.length < 2) return alert('至少輸入 2 個資產');
      const r = V286_$('rp286-results');
      r.innerHTML = '<p style="color:#fbbf24;text-align:center;padding:20px">⚖️ 計算協方差矩陣 + 風險平價最佳化...</p>';
      try {
        const resp = await fetch(`${W}/risk-parity`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols })
        });
        const j = await resp.json();
        if (j.error) throw new Error(j.error);
        const w = j.weights || [];
        if (!w.length) { r.innerHTML = '<p style="color:#888">無結果</p>'; return; }
        // 圓餅圖
        let cum = 0;
        const colors = ['#4ade80', 'var(--accent)', '#fbbf24', '#ef4444', '#a855f7', '#ec4899', '#14b8a6', '#f97316'];
        const W2 = 200, H2 = 200, cx = 100, cy = 100, rr = 80;
        let svg = `<svg width="${W2}" height="${H2}" style="display:inline-block">`;
        w.forEach((it, i) => {
          const a1 = cum * 2 * Math.PI - Math.PI / 2;
          cum += it.weight;
          const a2 = cum * 2 * Math.PI - Math.PI / 2;
          const large = it.weight > 0.5 ? 1 : 0;
          const x1 = cx + rr * Math.cos(a1), y1 = cy + rr * Math.sin(a1);
          const x2 = cx + rr * Math.cos(a2), y2 = cy + rr * Math.sin(a2);
          svg += `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${rr} ${rr} 0 ${large} 1 ${x2} ${y2} Z" fill="${colors[i % 8]}" stroke="#000"/>`;
        });
        svg += `</svg>`;
        r.innerHTML = `
          <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
            ${svg}
            <table style="flex:1;font-size:13px;border-collapse:collapse;min-width:300px">
              <tr style="background:var(--bg-surface)"><th style="padding:6px;text-align:left">資產</th><th style="padding:6px">權重</th><th style="padding:6px">波動度</th><th style="padding:6px">風險貢獻</th></tr>
              ${w.map((it, i) => `<tr style="border-bottom:1px solid #333">
                <td style="padding:6px"><span style="display:inline-block;width:12px;height:12px;background:${colors[i % 8]};border-radius:2px;margin-right:6px"></span><b>${it.symbol}</b></td>
                <td style="padding:6px;text-align:right;color:#4ade80;font-weight:bold">${V286_fmt(it.weight * 100, 2)}%</td>
                <td style="padding:6px;text-align:right">${V286_fmt(it.volatility * 100, 2)}%</td>
                <td style="padding:6px;text-align:right">${V286_fmt(it.risk_contribution * 100, 2)}%</td>
              </tr>`).join('')}
            </table>
          </div>
          <div style="margin-top:12px;padding:12px;background:var(--bg-base);border-radius:6px;font-size:12px;color:#aaa">
            <b>📊 投組指標：</b> 預期年化波動 ${V286_fmt(j.portfolio_volatility * 100, 2)}% ｜ 預期年化報酬 ${V286_fmt(j.portfolio_return * 100, 2)}% ｜ Sharpe ${V286_fmt(j.sharpe, 2)}<br>
            <b>💡 Risk Parity</b>：給每個資產相同風險貢獻（風險平價），避免單一資產主導投組風險。
            橋水「全天候」基金 1996 年發明，30 年累積報酬贏 S&P 500。
          </div>
        `;
      } catch (e) { r.innerHTML = `<p style="color:#ef4444">錯誤：${e.message}</p>`; }
    };
  }
  V286_inject('tools', 'mr-v286-riskparity', '⚖️ Risk Parity 風險平價配置器 (v286)', V286_buildRiskParity);

  // ============================================================
  // FEATURE 5: 🎲 Kelly Criterion 凱利公式倉位管理
  // ============================================================
  function V286_buildKelly(containerId) {
    const c = V286_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">🎲 Edward Thorp / Bill Gross / Warren Buffett 都用的倉位管理公式：依勝率 + 賠率算最佳倉位</p>
      <div style="background:var(--bg-base);padding:16px;border-radius:8px;margin-bottom:12px">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
          <label style="color:#aaa">勝率 % (歷史測試或主觀估計)
            <input id="k286-win" type="number" min="1" max="99" value="55" style="width:100%;padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;margin-top:4px"></label>
          <label style="color:#aaa">平均勝報酬 % (停利目標)
            <input id="k286-gain" type="number" min="0.1" step="0.1" value="15" style="width:100%;padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;margin-top:4px"></label>
          <label style="color:#aaa">平均敗報酬 % (停損)
            <input id="k286-loss" type="number" min="0.1" step="0.1" value="5" style="width:100%;padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;margin-top:4px"></label>
          <label style="color:#aaa">總資金 (NTD)
            <input id="k286-capital" type="number" min="1000" value="1000000" style="width:100%;padding:8px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;margin-top:4px"></label>
        </div>
        <button id="k286-run" style="margin-top:12px;padding:10px 20px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">🎲 計算最佳倉位</button>
      </div>
      <div id="k286-results"></div>
    `;
    V286_$('k286-run').onclick = () => {
      const winPct = parseFloat(V286_$('k286-win').value) / 100;
      const gainPct = parseFloat(V286_$('k286-gain').value) / 100;
      const lossPct = parseFloat(V286_$('k286-loss').value) / 100;
      const capital = parseFloat(V286_$('k286-capital').value) || 1000000;
      const lossPct_safe = Math.max(0.001, lossPct);
      // Kelly: f = (p * b - q) / b, where b = gain/loss ratio, p = win, q = lose
      const b = gainPct / lossPct_safe;
      const p = winPct;
      const q = 1 - winPct;
      const fullKelly = (p * b - q) / b;
      const halfKelly = fullKelly / 2;
      const quarterKelly = fullKelly / 4;
      const ev = winPct * gainPct - (1 - winPct) * lossPct;
      const r = V286_$('k286-results');
      const recommend = halfKelly; // Buffett uses Half Kelly
      const recommendCapital = recommend * capital;
      r.innerHTML = `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
          <div style="background:#0f3a1f;padding:16px;border-radius:8px">
            <div style="color:#aaa;font-size:12px">🎯 全凱利 Full Kelly</div>
            <div style="color:#4ade80;font-size:32px;font-weight:bold">${V286_fmt(fullKelly * 100, 2)}%</div>
            <div style="color:#aaa;font-size:11px">理論最佳，但波動大</div>
            <div style="color:#fff;font-size:14px;margin-top:6px">投入：NT$${V286_fmt(fullKelly * capital, 0)}</div>
          </div>
          <div style="background:#0f3a1f;padding:16px;border-radius:8px;border:2px solid #fbbf24">
            <div style="color:#fbbf24;font-size:12px">⭐ 建議：半凱利 Half Kelly</div>
            <div style="color:#fbbf24;font-size:32px;font-weight:bold">${V286_fmt(halfKelly * 100, 2)}%</div>
            <div style="color:#aaa;font-size:11px">Buffett 推薦，平衡報酬+風險</div>
            <div style="color:#fff;font-size:14px;margin-top:6px">投入：NT$${V286_fmt(recommendCapital, 0)}</div>
          </div>
          <div style="background:#0f3a1f;padding:16px;border-radius:8px">
            <div style="color:#aaa;font-size:12px">🛡️ 四分之一凱利</div>
            <div style="color:var(--accent);font-size:32px;font-weight:bold">${V286_fmt(quarterKelly * 100, 2)}%</div>
            <div style="color:#aaa;font-size:11px">最保守，新手推薦</div>
            <div style="color:#fff;font-size:14px;margin-top:6px">投入：NT$${V286_fmt(quarterKelly * capital, 0)}</div>
          </div>
        </div>
        <div style="margin-top:16px;padding:12px;background:var(--bg-base);border-radius:6px;font-size:13px">
          <p style="color:#fbbf24;margin:0 0 8px 0"><b>📊 統計指標：</b></p>
          <p style="margin:4px 0;color:#aaa">• 期望值 EV：<b style="color:${ev > 0 ? '#4ade80' : '#ef4444'}">${V286_fmt(ev * 100, 3)}%</b> per trade ${ev > 0 ? '（正期望值，可玩）' : '（負期望值，不要玩）'}</p>
          <p style="margin:4px 0;color:#aaa">• 賠率 b：<b>${V286_fmt(b, 2)}</b> （勝賠 ÷ 敗賠）</p>
          <p style="margin:4px 0;color:#aaa">• 100 次交易預期累積：<b style="color:${ev > 0 ? '#4ade80' : '#ef4444'}">${V286_fmt((Math.pow(1 + recommend * b * winPct - recommend * (1 - winPct), 100) - 1) * 100, 1)}%</b></p>
        </div>
        <div style="margin-top:8px;padding:12px;background:#1a0f0f;border-radius:6px;font-size:12px;color:#aaa;border:1px solid #ef4444">
          <b>⚠️ 警告：</b> Kelly 假設你的勝率估計準確。實際應用時請用「半凱利」或「四分之一凱利」降低破產風險。
          ${fullKelly < 0 ? '<br><b style="color:#ef4444">本次計算結果為負！表示這個策略期望值為負，不應該交易。</b>' : ''}
        </div>
      `;
    };
  }
  V286_inject('tools', 'mr-v286-kelly', '🎲 Kelly Criterion 凱利公式倉位管理 (v286)', V286_buildKelly);

  console.log('[MoneyRadar v286] ✅ Goldman 級量化套件 5 件 features 已載入');
})();
