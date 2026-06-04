/* MoneyRadar v287 — 深度 AI 分析套件
 * 1. 📚 AI 財報摘要（10-K Reader）
 * 2. 🏰 AI 護城河分析（5 維度）
 * 3. 🥊 AI 競爭格局分析
 * 4. 🦢 AI 黑天鵝風險預測
 * 5. 🖼️ AI K 線型態識別
 *
 * 所有函數加 V287_ 前綴避免命名衝突
 */
(function () {
  'use strict';
  const W = 'https://moneyradar-ai-proxy.thinkbigtw.workers.dev';
  function V287_$(id) { return document.getElementById(id); }
  function V287_el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function V287_inject(parentTabId, id, title, builder) {
    const tab = document.querySelector(`[data-tab-content="${parentTabId}"]`) || document.querySelector(`#tab-${parentTabId}`) || document.body;
    if (document.getElementById(id)) return;
    const sec = V287_el(`<section id="${id}" style="margin:24px 0;padding:20px;background:var(--card-bg,var(--bg-surface));border-radius:12px;border:1px solid var(--border,var(--bg-surface))">
      <h3 style="margin:0 0 16px 0;color:var(--text,var(--text-primary))">${title}</h3>
      <div id="${id}-body"></div>
    </section>`);
    tab.appendChild(sec);
    try { builder(`${id}-body`); } catch (e) { console.error('v287 builder', id, e); }
  }

  // ============================================================
  // FEATURE 1: 📚 AI 10-K 財報摘要
  // ============================================================
  function V287_build10K(containerId) {
    const c = V287_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">📚 輸入美股代號，AI 自動抓 SEC 最新 10-K 年報，5 段重點摘要</p>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <input id="k287-symbol" placeholder="美股代碼（例：AAPL / MSFT / NVDA）" style="padding:10px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;width:240px">
        <button id="k287-run" style="padding:10px 20px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">📚 AI 摘要 10-K</button>
      </div>
      <div id="k287-results"></div>
    `;
    V287_$('k287-run').onclick = async () => {
      const sym = V287_$('k287-symbol').value.trim().toUpperCase();
      if (!sym) return alert('請輸入股票代碼');
      const r = V287_$('k287-results');
      r.innerHTML = '<p style="color:#fbbf24;text-align:center;padding:20px">📚 抓 SEC EDGAR 最新 10-K... AI 摘要中...</p>';
      try {
        const resp = await fetch(`${W}/ai-10k?symbol=${sym}`);
        const j = await resp.json();
        if (j.error) throw new Error(j.error);
        r.innerHTML = `
          <h4 style="color:#4ade80">✅ ${sym} 10-K 年報摘要</h4>
          <p style="color:#aaa;font-size:12px;margin:0 0 8px 0">📅 ${j.filing_date || ''} ｜ <a href="${j.url || '#'}" target="_blank" style="color:var(--accent)">查看完整 SEC 文件 ↗</a></p>
          <div style="background:var(--bg-base);padding:16px;border-radius:6px;color:var(--text-primary);line-height:1.7;white-space:pre-wrap">${j.summary || '(無摘要)'}</div>
        `;
      } catch (e) { r.innerHTML = `<p style="color:#ef4444">錯誤：${e.message}</p>`; }
    };
  }
  V287_inject('us', 'mr-v287-10k', '📚 AI 10-K 財報摘要 (v287)', V287_build10K);

  // ============================================================
  // FEATURE 2: 🏰 AI 護城河分析
  // ============================================================
  function V287_buildMoat(containerId) {
    const c = V287_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">🏰 5 維度評分（品牌/規模/網路/轉換/特許）— Buffett 所謂「護城河」</p>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <input id="m287-symbol" placeholder="股票代碼（例：AAPL / 2330）" style="padding:10px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;width:200px">
        <button id="m287-run" style="padding:10px 20px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">🏰 AI 護城河分析</button>
      </div>
      <div id="m287-results"></div>
    `;
    V287_$('m287-run').onclick = async () => {
      const sym = V287_$('m287-symbol').value.trim().toUpperCase();
      if (!sym) return alert('請輸入股票代碼');
      const r = V287_$('m287-results');
      r.innerHTML = '<p style="color:#fbbf24;text-align:center;padding:20px">🏰 AI 分析中...</p>';
      try {
        const resp = await fetch(`${W}/ai-moat?symbol=${sym}`);
        const j = await resp.json();
        if (j.error) throw new Error(j.error);
        const sc = j.scores || {};
        const total = (sc.brand + sc.scale + sc.network + sc.switching + sc.regulatory) / 5;
        const dims = [
          { key: 'brand', name: '品牌力', desc: '消費者心智份額' },
          { key: 'scale', name: '規模經濟', desc: '量大成本低' },
          { key: 'network', name: '網路效應', desc: '用戶越多越值錢' },
          { key: 'switching', name: '轉換成本', desc: '用戶難以離開' },
          { key: 'regulatory', name: '特許壟斷', desc: '法規/專利保護' }
        ];
        // 雷達圖
        const W2 = 280, H2 = 280, cx = 140, cy = 140, rr = 100;
        const pts = dims.map((d, i) => {
          const a = i * 2 * Math.PI / 5 - Math.PI / 2;
          const v = (sc[d.key] || 0) / 10;
          return [cx + rr * v * Math.cos(a), cy + rr * v * Math.sin(a)];
        });
        const polygon = pts.map(p => p.join(',')).join(' ');
        const grid = [0.25, 0.5, 0.75, 1].map(g => {
          const ps = dims.map((_, i) => {
            const a = i * 2 * Math.PI / 5 - Math.PI / 2;
            return [cx + rr * g * Math.cos(a), cy + rr * g * Math.sin(a)];
          });
          return `<polygon points="${ps.map(p => p.join(',')).join(' ')}" fill="none" stroke="#444" stroke-width="0.5"/>`;
        }).join('');
        const labels = dims.map((d, i) => {
          const a = i * 2 * Math.PI / 5 - Math.PI / 2;
          const x = cx + (rr + 20) * Math.cos(a);
          const y = cy + (rr + 20) * Math.sin(a);
          return `<text x="${x}" y="${y}" fill="#fff" text-anchor="middle" font-size="12">${d.name}</text>`;
        }).join('');
        r.innerHTML = `
          <h4 style="color:#4ade80">✅ ${sym} 護城河 5 維度</h4>
          <div style="display:flex;gap:16px;flex-wrap:wrap">
            <svg width="${W2}" height="${H2}" style="background:var(--bg-base);border-radius:6px">
              ${grid}${labels}
              <polygon points="${polygon}" fill="rgba(74,222,128,0.3)" stroke="#4ade80" stroke-width="2"/>
              ${pts.map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#4ade80"/>`).join('')}
            </svg>
            <div style="flex:1;min-width:280px">
              <div style="font-size:48px;color:#fbbf24;font-weight:bold">${total.toFixed(1)}/10</div>
              <div style="color:#aaa">綜合護城河分數</div>
              <div style="margin-top:12px">
                ${dims.map(d => `<div style="margin-bottom:6px">
                  <div style="display:flex;justify-content:space-between"><span style="color:#fff">${d.name}</span><b style="color:#fbbf24">${(sc[d.key] || 0).toFixed(1)}</b></div>
                  <div style="background:var(--bg-surface);height:6px;border-radius:3px;overflow:hidden"><div style="background:#4ade80;height:100%;width:${(sc[d.key] || 0) * 10}%"></div></div>
                  <div style="font-size:11px;color:#666">${d.desc}</div>
                </div>`).join('')}
              </div>
            </div>
          </div>
          <div style="margin-top:16px;padding:12px;background:var(--bg-base);border-radius:6px;color:var(--text-primary);line-height:1.6">${j.analysis || ''}</div>
        `;
      } catch (e) { r.innerHTML = `<p style="color:#ef4444">錯誤：${e.message}</p>`; }
    };
  }
  V287_inject('us', 'mr-v287-moat', '🏰 AI 護城河 5 維度分析 (v287)', V287_buildMoat);

  // ============================================================
  // FEATURE 3: 🥊 AI 競爭格局分析
  // ============================================================
  function V287_buildCompetition(containerId) {
    const c = V287_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">🥊 輸入主標的，AI 找出競爭對手 + 對比 PE/PB/ROE/毛利率/市值</p>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <input id="cp287-symbol" placeholder="主標的（例：AAPL / 2330）" style="padding:10px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;width:200px">
        <button id="cp287-run" style="padding:10px 20px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">🥊 競爭分析</button>
      </div>
      <div id="cp287-results"></div>
    `;
    V287_$('cp287-run').onclick = async () => {
      const sym = V287_$('cp287-symbol').value.trim().toUpperCase();
      if (!sym) return alert('請輸入');
      const r = V287_$('cp287-results');
      r.innerHTML = '<p style="color:#fbbf24;text-align:center;padding:20px">🥊 找競爭對手 + 對比指標...</p>';
      try {
        const resp = await fetch(`${W}/ai-competition?symbol=${sym}`);
        const j = await resp.json();
        if (j.error) throw new Error(j.error);
        const peers = j.peers || [];
        if (!peers.length) { r.innerHTML = '<p style="color:#888">無資料</p>'; return; }
        r.innerHTML = `
          <h4 style="color:#4ade80">✅ ${sym} 競爭格局</h4>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr style="background:var(--bg-surface)">
              <th style="padding:8px">代碼</th><th style="padding:8px">公司</th>
              <th style="padding:8px">市值</th><th style="padding:8px">PE</th>
              <th style="padding:8px">PB</th><th style="padding:8px">ROE</th>
              <th style="padding:8px">毛利率</th><th style="padding:8px">YTD</th>
            </tr>
            ${peers.map(p => `<tr style="border-bottom:1px solid #333;${p.symbol === sym ? 'background:#1a3a1a' : ''}">
              <td style="padding:6px"><b>${p.symbol}</b>${p.symbol === sym ? ' ⭐' : ''}</td>
              <td style="padding:6px">${p.name || ''}</td>
              <td style="padding:6px;text-align:right">${p.market_cap_b ? p.market_cap_b + 'B' : '—'}</td>
              <td style="padding:6px;text-align:right">${p.pe || '—'}</td>
              <td style="padding:6px;text-align:right">${p.pb || '—'}</td>
              <td style="padding:6px;text-align:right">${p.roe || '—'}%</td>
              <td style="padding:6px;text-align:right">${p.gross_margin || '—'}%</td>
              <td style="padding:6px;text-align:right;color:${p.ytd > 0 ? '#4ade80' : '#ef4444'}">${p.ytd ? (p.ytd > 0 ? '+' : '') + p.ytd + '%' : '—'}</td>
            </tr>`).join('')}
          </table>
          <div style="margin-top:12px;padding:12px;background:var(--bg-base);border-radius:6px;color:var(--text-primary);line-height:1.6">${j.analysis || ''}</div>
        `;
      } catch (e) { r.innerHTML = `<p style="color:#ef4444">錯誤：${e.message}</p>`; }
    };
  }
  V287_inject('us', 'mr-v287-comp', '🥊 AI 競爭格局分析 (v287)', V287_buildCompetition);

  // ============================================================
  // FEATURE 4: 🦢 AI 黑天鵝風險預測
  // ============================================================
  function V287_buildBlackSwan(containerId) {
    const c = V287_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">🦢 AI 結合總經 + 地緣 + 政策推估「未來 3 個月可能的黑天鵝」</p>
      <button id="bs287-run" style="padding:10px 20px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">🦢 AI 預測黑天鵝</button>
      <div id="bs287-results" style="margin-top:12px"></div>
    `;
    V287_$('bs287-run').onclick = async () => {
      const r = V287_$('bs287-results');
      r.innerHTML = '<p style="color:#fbbf24;text-align:center;padding:20px">🦢 Llama 70B 推估中...</p>';
      try {
        const resp = await fetch(`${W}/ai-blackswan`);
        const j = await resp.json();
        if (j.error) throw new Error(j.error);
        const events = j.events || [];
        r.innerHTML = `
          <h4 style="color:#4ade80">✅ AI 預測 ${events.length} 個高風險事件</h4>
          ${events.map((e, i) => `<div style="background:var(--bg-base);padding:14px;border-radius:8px;margin-bottom:10px;border-left:4px solid ${e.probability > 30 ? '#ef4444' : e.probability > 15 ? '#fbbf24' : '#4ade80'}">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <h4 style="margin:0;color:#fff">#${i + 1} ${e.title || ''}</h4>
              <span style="color:${e.probability > 30 ? '#ef4444' : '#fbbf24'};font-weight:bold">機率 ${e.probability}%</span>
            </div>
            <div style="color:#aaa;font-size:12px;margin-bottom:6px">📂 ${e.category || ''} ｜ 🎯 影響：${e.impact || ''}</div>
            <div style="color:var(--text-primary);font-size:13px;line-height:1.6">${e.description || ''}</div>
            ${e.mitigation ? `<div style="margin-top:8px;padding:8px;background:#1a1a3e;border-radius:4px;font-size:12px;color:#a8d8ff"><b>💡 對沖建議：</b>${e.mitigation}</div>` : ''}
          </div>`).join('')}
        `;
      } catch (e) { r.innerHTML = `<p style="color:#ef4444">錯誤：${e.message}</p>`; }
    };
  }
  V287_inject('tools', 'mr-v287-blackswan', '🦢 AI 黑天鵝風險預測 (v287)', V287_buildBlackSwan);

  // ============================================================
  // FEATURE 5: 🖼️ AI K 線型態識別
  // ============================================================
  function V287_buildPattern(containerId) {
    const c = V287_$(containerId); if (!c) return;
    c.innerHTML = `
      <p style="color:#aaa;margin:0 0 12px 0">🖼️ 抓 60 日 K 線資料，AI 識別經典型態（頭肩頂/雙底/三角收斂等 12 種）</p>
      <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
        <input id="pt287-symbol" placeholder="股票代碼（例：AAPL / 2330）" style="padding:10px;background:var(--bg-surface);border:1px solid #444;color:#fff;border-radius:4px;width:200px">
        <button id="pt287-run" style="padding:10px 20px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">🖼️ AI 型態識別</button>
      </div>
      <div id="pt287-results"></div>
    `;
    V287_$('pt287-run').onclick = async () => {
      const sym = V287_$('pt287-symbol').value.trim().toUpperCase();
      if (!sym) return alert('請輸入');
      const r = V287_$('pt287-results');
      r.innerHTML = '<p style="color:#fbbf24;text-align:center;padding:20px">🖼️ 抓 K 線 + AI 識別中...</p>';
      try {
        const resp = await fetch(`${W}/ai-pattern?symbol=${sym}`);
        const j = await resp.json();
        if (j.error) throw new Error(j.error);
        const patterns = j.patterns || [];
        // 畫 K 線 SVG
        const closes = j.closes || [];
        const W2 = 700, H2 = 200;
        let svg = '';
        if (closes.length > 1) {
          const maxV = Math.max(...closes), minV = Math.min(...closes);
          const range = maxV - minV || 1;
          const points = closes.map((p, i) => `${i / (closes.length - 1) * W2},${H2 - (p - minV) / range * (H2 - 20) - 10}`).join(' ');
          svg = `<svg width="${W2}" height="${H2}" style="width:100%;background:var(--bg-base);border-radius:6px">
            <polyline points="${points}" fill="none" stroke="#4ade80" stroke-width="2"/>
          </svg>`;
        }
        r.innerHTML = `
          <h4 style="color:#4ade80">✅ ${sym} K 線型態識別</h4>
          ${svg}
          <div style="margin-top:12px">
            ${patterns.length ? patterns.map(p => `<div style="background:var(--bg-base);padding:12px;border-radius:6px;margin-bottom:8px;border-left:4px solid ${p.bullish ? '#4ade80' : '#ef4444'}">
              <div style="display:flex;justify-content:space-between"><b style="color:#fff">${p.name}</b><span style="color:${p.bullish ? '#4ade80' : '#ef4444'}">信心度 ${p.confidence}%</span></div>
              <div style="color:#aaa;font-size:12px;margin-top:4px">${p.description || ''}</div>
              ${p.target ? `<div style="margin-top:6px;color:#fbbf24">🎯 目標價：${p.target}</div>` : ''}
            </div>`).join('') : '<p style="color:#888">未識別到明確型態</p>'}
          </div>
        `;
      } catch (e) { r.innerHTML = `<p style="color:#ef4444">錯誤：${e.message}</p>`; }
    };
  }
  V287_inject('tools', 'mr-v287-pattern', '🖼️ AI K 線型態識別 (v287)', V287_buildPattern);

  console.log('[MoneyRadar v287] ✅ 5 件深度 AI 分析 features 已載入');
})();
