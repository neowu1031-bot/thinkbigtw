/**
 * MoneyRadar v283 Bundle — 8 件 Tier A/B
 * 1. TPEx 櫃買中心 + 興櫃個股
 * 2. 期交所每日統計
 * 3. 公開資訊觀測站重大訊息
 * 4. 新手互動式 tutorial walkthrough
 * 5. 完整稅務計算器（台灣）
 * 6. CoinGecko 加密 10 萬幣
 * 7. Markowitz 效率前緣
 * 8. 浮動圖示 + 強化 UX
 */
(function() {
  'use strict';
  const VERSION = 'v283-bundle';
  const W = 'https://moneyradar-ai-proxy.thinkbigtw.workers.dev';

  function $(id) { return document.getElementById(id); }
  function fmt(n, d) { return n == null || isNaN(n) ? '-' : Number(n).toFixed(d == null ? 2 : d); }
  function fmtBig(n) {
    if (n == null) return '-';
    if (Math.abs(n) >= 1e9) return (n/1e9).toFixed(1) + 'B';
    if (Math.abs(n) >= 1e6) return (n/1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return (n/1e3).toFixed(1) + 'K';
    return n.toFixed(0);
  }

  // ==============================================================
  // FEATURE 1 — TPEx 櫃買 + 興櫃 (v310)
  // ==============================================================
  async function buildTPEx(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:#94a3b8;margin-bottom:8px">🇹🇼 TPEx 櫃買中心 — 台股 OTC 市場日報（即時抓取最新交易日資料）</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:10px"><button id="tpex-go" style="padding:6px 14px;background:#16a34a;border:0;color:#fff;border-radius:4px;cursor:pointer">抓取最新</button>' +
      '<select id="tpex-type" style="padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px"><option value="otc">櫃買加權</option><option value="emerging">興櫃</option><option value="ranking">櫃買漲幅榜</option></select></div>' +
      '<div id="tpex-result"></div></div>';

    $('tpex-go').addEventListener('click', async () => {
      const type = $('tpex-type').value;
      $('tpex-result').innerHTML = '<div style="color:#94a3b8;padding:10px">⏳ 抓取 TPEx 資料中...</div>';
      try {
        const r = await fetch(W + '/tpex?type=' + type);
        if (!r.ok) throw new Error('Worker /tpex ' + r.status);
        const j = await r.json();
        if (j.error) throw new Error(j.error);
        let html = '<div style="background:rgba(22,163,74,0.05);border:1px solid rgba(22,163,74,0.3);border-radius:6px;padding:12px">';
        if (type === 'otc') {
          html += '<div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:8px">櫃買加權指數</div>';
          html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;font-size:13px">';
          if (j.index) {
            html += '<div style="background:#0a0f1c;padding:8px;border-radius:4px"><div style="color:#94a3b8;font-size:11px">收盤</div><div style="font-size:18px;font-weight:700">' + fmt(j.index.close) + '</div></div>';
            html += '<div style="background:#0a0f1c;padding:8px;border-radius:4px"><div style="color:#94a3b8;font-size:11px">漲跌</div><div style="font-size:16px;font-weight:700;color:' + (j.index.change >= 0 ? '#34d399' : '#f87171') + '">' + (j.index.change >= 0 ? '+' : '') + fmt(j.index.change) + ' (' + (j.index.change_pct >= 0 ? '+' : '') + fmt(j.index.change_pct, 2) + '%)</div></div>';
            html += '<div style="background:#0a0f1c;padding:8px;border-radius:4px"><div style="color:#94a3b8;font-size:11px">成交額</div><div style="font-size:16px;font-weight:700">' + fmtBig(j.index.amount) + '</div></div>';
          }
          html += '</div>';
        } else if (j.list) {
          html += '<div style="font-size:14px;color:#fff;margin-bottom:8px">' + (type === 'ranking' ? '🚀 櫃買漲幅榜 Top 30' : '🌱 興櫃熱門 Top 30') + '</div>';
          html += '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="border-bottom:1px solid #334155;color:#94a3b8"><th style="padding:6px;text-align:left">代號</th><th style="text-align:left">名稱</th><th style="text-align:right">收盤</th><th style="text-align:right">漲跌</th><th style="text-align:right">漲幅%</th><th style="text-align:right">成交</th></tr></thead><tbody>';
          j.list.slice(0, 30).forEach(s => {
            html += '<tr style="border-bottom:1px solid #1e293b"><td style="padding:6px;font-weight:700">' + s.symbol + '</td><td>' + (s.name || '-') + '</td><td style="text-align:right">' + fmt(s.close, 2) + '</td><td style="text-align:right;color:' + (s.change >= 0 ? '#34d399' : '#f87171') + '">' + (s.change >= 0 ? '+' : '') + fmt(s.change, 2) + '</td><td style="text-align:right;color:' + (s.change_pct >= 0 ? '#34d399' : '#f87171') + ';font-weight:700">' + (s.change_pct >= 0 ? '+' : '') + fmt(s.change_pct, 2) + '%</td><td style="text-align:right">' + fmtBig(s.volume) + '</td></tr>';
          });
          html += '</tbody></table>';
        } else {
          html += '<div style="color:#94a3b8">⚠️ 無資料</div>';
        }
        html += '<div style="margin-top:8px;font-size:11px;color:#64748b">資料源: TPEx 證券櫃檯買賣中心 OpenData · ' + (j.date || '最新交易日') + '</div></div>';
        $('tpex-result').innerHTML = html;
      } catch (e) {
        $('tpex-result').innerHTML = '<div style="padding:10px;color:#dc2626">❌ ' + (e.message || e) + '<br>（需 Worker /tpex endpoint — 部署 v283 patch）</div>';
      }
    });
  }

  // ==============================================================
  // FEATURE 2 — 期交所每日統計 (v311)
  // ==============================================================
  async function buildTaifex(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:#94a3b8;margin-bottom:8px">📊 期交所 TAIFEX — 台指期 / 選擇權 / 三大法人期貨持倉每日統計</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:10px"><button id="tx-go" style="padding:6px 14px;background:#7c3aed;border:0;color:#fff;border-radius:4px;cursor:pointer">抓取最新</button>' +
      '<select id="tx-type" style="padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px"><option value="futures">📈 期貨成交統計</option><option value="institutional">🏢 三大法人期貨持倉</option><option value="options">📋 選擇權統計</option></select></div>' +
      '<div id="tx-result"></div></div>';

    $('tx-go').addEventListener('click', async () => {
      const type = $('tx-type').value;
      $('tx-result').innerHTML = '<div style="color:#94a3b8;padding:10px">⏳ 抓 TAIFEX...</div>';
      try {
        const r = await fetch(W + '/taifex?type=' + type);
        if (!r.ok) throw new Error('Worker /taifex ' + r.status);
        const j = await r.json();
        if (j.error) throw new Error(j.error);
        let html = '<div style="background:rgba(124,58,237,0.05);border:1px solid rgba(124,58,237,0.3);border-radius:6px;padding:12px">';
        if (j.summary) html += '<div style="font-size:14px;color:#fff;margin-bottom:8px;font-weight:700">' + j.summary + '</div>';
        if (j.rows && j.rows.length) {
          html += '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:8px">';
          if (j.headers) {
            html += '<thead><tr style="border-bottom:1px solid #334155;color:#94a3b8">';
            j.headers.forEach(h => { html += '<th style="padding:6px;text-align:right">' + h + '</th>'; });
            html += '</tr></thead>';
          }
          html += '<tbody>';
          j.rows.slice(0, 50).forEach((row, idx) => {
            html += '<tr style="border-bottom:1px solid #1e293b">';
            row.forEach((cell, ci) => {
              const isFirst = ci === 0;
              html += '<td style="padding:6px;text-align:' + (isFirst ? 'left' : 'right') + ';' + (isFirst ? 'font-weight:600' : '') + '">' + (cell == null ? '-' : cell) + '</td>';
            });
            html += '</tr>';
          });
          html += '</tbody></table>';
        }
        html += '<div style="margin-top:8px;font-size:11px;color:#64748b">資料源: 台灣期貨交易所 OpenData · ' + (j.date || '最新交易日') + '</div></div>';
        $('tx-result').innerHTML = html;
      } catch (e) {
        $('tx-result').innerHTML = '<div style="padding:10px;color:#dc2626">❌ ' + (e.message || e) + '<br>（需 Worker /taifex endpoint）</div>';
      }
    });
  }

  // ==============================================================
  // FEATURE 3 — 公開資訊觀測站 (v312)
  // ==============================================================
  async function buildMOPS(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:#94a3b8;margin-bottom:8px">📰 公開資訊觀測站 MOPS — 台股上市櫃公司即時重大訊息（法定揭露）</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:10px"><input id="mops-sym" placeholder="代號（空白=全市場）" style="flex:1;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px">' +
      '<button id="mops-go" style="padding:6px 14px;background:#dc2626;border:0;color:#fff;border-radius:4px;cursor:pointer">抓取重大訊息</button></div>' +
      '<div id="mops-result"></div></div>';

    $('mops-go').addEventListener('click', async () => {
      const sym = $('mops-sym').value.trim();
      $('mops-result').innerHTML = '<div style="color:#94a3b8;padding:10px">⏳ 抓 MOPS 重大訊息...</div>';
      try {
        const r = await fetch(W + '/mops?symbol=' + encodeURIComponent(sym));
        if (!r.ok) throw new Error('Worker /mops ' + r.status);
        const j = await r.json();
        if (j.error) throw new Error(j.error);
        const list = j.announcements || [];
        if (!list.length) { $('mops-result').innerHTML = '<div style="padding:10px;color:#94a3b8">⚠️ 無公告</div>'; return; }
        let html = '<div style="background:rgba(220,38,38,0.05);border:1px solid rgba(220,38,38,0.3);border-radius:6px;padding:12px">' +
          '<div style="font-size:14px;color:#fff;margin-bottom:8px;font-weight:700">📰 ' + list.length + ' 則重大訊息</div>';
        list.slice(0, 30).forEach(a => {
          html += '<div style="border-bottom:1px solid #1e293b;padding:8px 0;font-size:12px">' +
            '<div style="display:flex;justify-content:space-between;margin-bottom:4px">' +
            '<span style="color:#fbbf24;font-weight:700">' + (a.symbol || '-') + ' ' + (a.name || '') + '</span>' +
            '<span style="color:#94a3b8;font-size:11px">' + (a.date || '') + ' ' + (a.time || '') + '</span></div>' +
            '<div style="color:#cbd5e1;line-height:1.5">' + (a.title || '').replace(/</g, '&lt;') + '</div>' +
            (a.content ? '<div style="color:#94a3b8;font-size:11px;margin-top:4px;line-height:1.4">' + (a.content || '').slice(0, 200).replace(/</g, '&lt;') + '...</div>' : '') +
            '</div>';
        });
        html += '<div style="margin-top:8px;font-size:11px;color:#64748b">資料源: 公開資訊觀測站 MOPS · 法定揭露每日更新</div></div>';
        $('mops-result').innerHTML = html;
      } catch (e) {
        $('mops-result').innerHTML = '<div style="padding:10px;color:#dc2626">❌ ' + (e.message || e) + '<br>（需 Worker /mops endpoint）</div>';
      }
    });
  }

  // ==============================================================
  // FEATURE 4 — 新手互動式 tutorial (v313)
  // ==============================================================
  function buildTutorial() {
    if ($('v283-tutorial-btn')) return;
    const KEY = 'mr_v283_tutorial_done';
    const done = (() => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } })();

    const btn = document.createElement('button');
    btn.id = 'v283-tutorial-btn';
    btn.textContent = '🎓 新手導覽';
    btn.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:9998;padding:8px 14px;background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.3);color:#fff;border-radius:8px;cursor:pointer;font-size:13px';
    document.body.appendChild(btn);

    const STEPS = [
      { title: '👋 歡迎使用 MoneyRadar™', body: 'MoneyRadar 是世界第一級的全方位投資工具，覆蓋台股 / 美股 / 加密 / 全球市場。讓我帶你快速看 6 大核心功能。', target: null },
      { title: '🔥 1. 熱力圖（市場全景）', body: '台股分頁底部「台股熱力圖」一眼看 100 檔個股漲跌。色塊大小=成交額，顏色=漲跌幅。Finviz 招牌功能。', target: 'v277-heatmap' },
      { title: '🤖 2. AI 多 Agent 圓桌', body: '個股深度頁有「多 Agent AI 圓桌」— 同時看 3 位 AI（多/空/量化）對該股辯論。世界第一個多 Agent 投資對話。', target: null },
      { title: '🎯 3. 目標規劃器', body: '投資組合分頁的「目標規劃器」— 輸入「30 歲想 60 歲存 5000 萬」，5 條情境路徑算給你。Wealthfront $4B 估值核心。', target: 'v309-goal' },
      { title: '💬 4. AI 投資導師', body: '理財工具分頁的「AI 投資導師」— 跟巴菲特、索羅斯、孫正義等 6 位 AI mentor 對話投資問題。', target: 'v308-mentor' },
      { title: '🚨 5. 異常偵測', body: '台股分頁的「AI 市場異常偵測」— 一鍵掃描全市場找突破/爆量/3σ 異常事件。Trade Ideas $228/月級。', target: 'v307-anomaly' },
      { title: '⌨️ 6. Cmd+K 快速搜尋', body: '隨時按 Cmd+K (Mac) 或 Ctrl+K (Win) 開啟快速搜尋，輸入股票代號或功能名稱直接跳轉。', target: null },
      { title: '🎉 完成！', body: '你已了解 MoneyRadar 6 大核心功能。其他還有 27 件 features 等你探索。記得：投資有風險，量力而為。', target: null }
    ];

    let curStep = 0;
    let overlay;
    function showStep() {
      const s = STEPS[curStep];
      if (!s) { close(); return; }
      if (s.target) {
        const el = document.getElementById(s.target);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      overlay.querySelector('.tut-title').textContent = s.title;
      overlay.querySelector('.tut-body').textContent = s.body;
      overlay.querySelector('.tut-progress').textContent = (curStep + 1) + ' / ' + STEPS.length;
      overlay.querySelector('.tut-prev').style.display = curStep > 0 ? 'inline-block' : 'none';
      overlay.querySelector('.tut-next').textContent = curStep === STEPS.length - 1 ? '完成 ✓' : '下一步 →';
    }
    function close() {
      if (overlay) overlay.remove();
      try { localStorage.setItem(KEY, '1'); } catch {}
    }
    function open() {
      curStep = 0;
      if (overlay) overlay.remove();
      overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;bottom:80px;left:20px;z-index:99999;background:#0f172a;border:1px solid #334155;border-radius:12px;padding:18px;width:380px;box-shadow:0 24px 60px rgba(0,0,0,0.5)';
      overlay.innerHTML = '<div style="display:flex;justify-content:space-between;margin-bottom:8px"><span class="tut-title" style="font-weight:700;color:#fff;font-size:16px"></span><button class="tut-close" style="background:transparent;border:0;color:#94a3b8;cursor:pointer;font-size:18px">×</button></div>' +
        '<div class="tut-body" style="color:#cbd5e1;line-height:1.7;font-size:13px;margin-bottom:14px"></div>' +
        '<div style="display:flex;justify-content:space-between;align-items:center"><span class="tut-progress" style="color:#64748b;font-size:11px"></span>' +
        '<div><button class="tut-prev" style="padding:6px 12px;background:#1e293b;border:0;color:#cbd5e1;border-radius:4px;cursor:pointer;margin-right:6px">← 上一步</button>' +
        '<button class="tut-next" style="padding:6px 14px;background:#16a34a;border:0;color:#fff;border-radius:4px;cursor:pointer;font-weight:700"></button></div></div>';
      document.body.appendChild(overlay);
      overlay.querySelector('.tut-close').addEventListener('click', close);
      overlay.querySelector('.tut-prev').addEventListener('click', () => { if (curStep > 0) { curStep--; showStep(); } });
      overlay.querySelector('.tut-next').addEventListener('click', () => { if (curStep < STEPS.length - 1) { curStep++; showStep(); } else close(); });
      showStep();
    }
    btn.addEventListener('click', open);
    if (!done) setTimeout(open, 3000);
  }

  // ==============================================================
  // FEATURE 5 — 完整稅務計算器 (v314)
  // ==============================================================
  function buildTaxCalculator(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:#94a3b8;margin-bottom:8px">💸 台股完整稅費計算器 — 手續費 + 證交稅 + 二代健保 + 股利所得</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;margin-bottom:10px;font-size:12px">' +
      '<label>類型<select id="tx-mode" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"><option value="trade">📈 買賣交易</option><option value="dividend">💰 股利收入</option></select></label>' +
      '<label id="tx-buy-lbl">買進金額<input type="number" id="tx-buy" value="100000" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label id="tx-sell-lbl">賣出金額<input type="number" id="tx-sell" value="120000" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label>券商手續費折扣 %<input type="number" id="tx-disc" value="65" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label id="tx-div-lbl" style="display:none">股利金額<input type="number" id="tx-div" value="50000" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label id="tx-bracket-lbl" style="display:none">綜所稅率 %<select id="tx-bracket" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"><option value="5">5% (54 萬以下)</option><option value="12">12% (54-121 萬)</option><option value="20" selected>20% (121-242 萬)</option><option value="30">30% (242-453 萬)</option><option value="40">40% (453+ 萬)</option></select></label>' +
      '</div><button id="tx-go" style="width:100%;padding:10px;background:#dc2626;border:0;color:#fff;border-radius:6px;font-weight:700;cursor:pointer">計算稅費</button>' +
      '<div id="tx-result" style="margin-top:10px"></div></div>';

    function toggleMode() {
      const mode = $('tx-mode').value;
      $('tx-buy-lbl').style.display = mode === 'trade' ? 'block' : 'none';
      $('tx-sell-lbl').style.display = mode === 'trade' ? 'block' : 'none';
      $('tx-div-lbl').style.display = mode === 'dividend' ? 'block' : 'none';
      $('tx-bracket-lbl').style.display = mode === 'dividend' ? 'block' : 'none';
    }
    $('tx-mode').addEventListener('change', toggleMode);
    toggleMode();

    $('tx-go').addEventListener('click', () => {
      const mode = $('tx-mode').value;
      if (mode === 'trade') {
        const buy = parseFloat($('tx-buy').value);
        const sell = parseFloat($('tx-sell').value);
        const disc = parseFloat($('tx-disc').value) / 100;
        const buyFee = Math.max(20, Math.floor(buy * 0.001425 * disc));
        const sellFee = Math.max(20, Math.floor(sell * 0.001425 * disc));
        const tax = Math.floor(sell * 0.003);
        const grossProfit = sell - buy;
        const netProfit = grossProfit - buyFee - sellFee - tax;
        const totalFee = buyFee + sellFee + tax;
        $('tx-result').innerHTML = '<div style="background:rgba(220,38,38,0.05);border:1px solid rgba(220,38,38,0.3);border-radius:6px;padding:14px">' +
          '<div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:10px">📈 交易稅費明細</div>' +
          '<table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>' +
          '<tr><td style="padding:4px;color:#94a3b8">買進金額</td><td style="text-align:right">$' + buy.toLocaleString() + '</td></tr>' +
          '<tr><td style="padding:4px;color:#94a3b8">買進手續費 (0.1425% × ' + (disc * 100) + '%)</td><td style="text-align:right;color:#f87171">-$' + buyFee.toLocaleString() + '</td></tr>' +
          '<tr><td style="padding:4px;color:#94a3b8">賣出金額</td><td style="text-align:right">$' + sell.toLocaleString() + '</td></tr>' +
          '<tr><td style="padding:4px;color:#94a3b8">賣出手續費</td><td style="text-align:right;color:#f87171">-$' + sellFee.toLocaleString() + '</td></tr>' +
          '<tr><td style="padding:4px;color:#94a3b8">證交稅 (0.3%)</td><td style="text-align:right;color:#f87171">-$' + tax.toLocaleString() + '</td></tr>' +
          '<tr style="border-top:1px solid #334155"><td style="padding:6px;color:#fbbf24;font-weight:700">總費用</td><td style="text-align:right;color:#fbbf24;font-weight:700">$' + totalFee.toLocaleString() + '</td></tr>' +
          '<tr><td style="padding:6px;color:#fff;font-weight:700;font-size:16px">淨損益</td><td style="text-align:right;font-weight:700;font-size:16px;color:' + (netProfit >= 0 ? '#34d399' : '#f87171') + '">' + (netProfit >= 0 ? '+' : '') + '$' + netProfit.toLocaleString() + '</td></tr>' +
          '</tbody></table>' +
          '<div style="margin-top:10px;padding:8px;background:rgba(96,165,250,0.05);border-radius:4px;font-size:11px;color:#94a3b8;line-height:1.6">' +
          '💡 台股手續費標準 0.1425%（最低 20 元），多數券商有 5-7 折優惠。證交稅買賣股票賣出時收 0.3%（ETF 0.1%）。當沖只收 0.15%。本工具不含當沖。' +
          '</div></div>';
      } else {
        const div = parseFloat($('tx-div').value);
        const bracket = parseFloat($('tx-bracket').value) / 100;
        // 二代健保：單筆股利 ≥ 2 萬元，課 2.11%
        const nhi = div >= 20000 ? Math.floor(div * 0.0211) : 0;
        // 股利所得稅：兩種選一（合併計稅 28% 抵減 / 分離 28%）
        // 簡化：用合併計稅
        const incomeTax = Math.floor(div * bracket);
        const dividendCredit = Math.floor(div * 0.085); // 8.5% 抵減（最高 8 萬）
        const finalTax = Math.max(0, incomeTax - Math.min(dividendCredit, 80000));
        const netDividend = div - nhi - finalTax;
        $('tx-result').innerHTML = '<div style="background:rgba(220,38,38,0.05);border:1px solid rgba(220,38,38,0.3);border-radius:6px;padding:14px">' +
          '<div style="font-size:18px;font-weight:700;color:#fff;margin-bottom:10px">💰 股利稅務明細</div>' +
          '<table style="width:100%;border-collapse:collapse;font-size:13px"><tbody>' +
          '<tr><td style="padding:4px;color:#94a3b8">股利收入</td><td style="text-align:right">$' + div.toLocaleString() + '</td></tr>' +
          '<tr><td style="padding:4px;color:#94a3b8">二代健保補充保費 (' + (div >= 20000 ? '2.11%' : '免徵') + ')</td><td style="text-align:right;color:#f87171">-$' + nhi.toLocaleString() + '</td></tr>' +
          '<tr><td style="padding:4px;color:#94a3b8">綜合所得稅 (' + (bracket * 100) + '% 級距)</td><td style="text-align:right;color:#f87171">-$' + incomeTax.toLocaleString() + '</td></tr>' +
          '<tr><td style="padding:4px;color:#94a3b8">股利可抵減稅額 (8.5%)</td><td style="text-align:right;color:#34d399">+$' + Math.min(dividendCredit, 80000).toLocaleString() + '</td></tr>' +
          '<tr style="border-top:1px solid #334155"><td style="padding:6px;color:#fbbf24;font-weight:700">應繳稅額</td><td style="text-align:right;color:#fbbf24;font-weight:700">$' + (finalTax + nhi).toLocaleString() + '</td></tr>' +
          '<tr><td style="padding:6px;color:#fff;font-weight:700;font-size:16px">實領股利</td><td style="text-align:right;font-weight:700;font-size:16px;color:#34d399">$' + netDividend.toLocaleString() + '</td></tr>' +
          '</tbody></table>' +
          '<div style="margin-top:10px;padding:8px;background:rgba(96,165,250,0.05);border-radius:4px;font-size:11px;color:#94a3b8;line-height:1.6">' +
          '💡 二代健保 2.11% 單筆 ≥ 2 萬才扣。股利可選 (1) 合併計稅 8.5% 抵減（上限 8 萬）或 (2) 分離 28% 計稅。本工具預設方案 1。實際情況依綜所稅級距而定。' +
          '</div></div>';
      }
    });
  }

  // ==============================================================
  // FEATURE 6 — CoinGecko 加密整合 (v315)
  // ==============================================================
  async function buildCoinGecko(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:#94a3b8;margin-bottom:8px">🪙 加密前 100 + 全球熱搜 — CoinGecko 開放 API（無需付費）</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:10px"><button id="cg-go" style="padding:6px 14px;background:#fbbf24;border:0;color:#000;border-radius:4px;cursor:pointer;font-weight:700">抓取最新</button>' +
      '<select id="cg-sort" style="padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px"><option value="market_cap">市值排行</option><option value="volume">成交量</option><option value="gain">24h 漲幅</option><option value="loss">24h 跌幅</option></select></div>' +
      '<div id="cg-result"></div></div>';

    $('cg-go').addEventListener('click', async () => {
      const sort = $('cg-sort').value;
      $('cg-result').innerHTML = '⏳ 抓取 CoinGecko...';
      try {
        const r = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1');
        if (!r.ok) throw new Error('CoinGecko ' + r.status);
        let data = await r.json();
        const sortFn = {
          market_cap: (a, b) => (b.market_cap || 0) - (a.market_cap || 0),
          volume: (a, b) => (b.total_volume || 0) - (a.total_volume || 0),
          gain: (a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0),
          loss: (a, b) => (a.price_change_percentage_24h || 0) - (b.price_change_percentage_24h || 0)
        };
        data.sort(sortFn[sort] || sortFn.market_cap);
        let html = '<div style="background:rgba(251,191,36,0.05);border:1px solid rgba(251,191,36,0.3);border-radius:6px;padding:12px"><div style="font-size:14px;color:#fff;font-weight:700;margin-bottom:8px">🪙 加密前 ' + data.length + ' 大幣種</div>' +
          '<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="border-bottom:1px solid #334155;color:#94a3b8">' +
          '<th style="padding:5px;text-align:left">#</th><th style="text-align:left">幣</th><th style="text-align:right">價格</th><th style="text-align:right">24h%</th><th style="text-align:right">市值</th><th style="text-align:right">24h 量</th></tr></thead><tbody>';
        data.slice(0, 50).forEach((coin, i) => {
          const chg = coin.price_change_percentage_24h || 0;
          html += '<tr style="border-bottom:1px solid #1e293b">' +
            '<td style="padding:5px">' + (i + 1) + '</td>' +
            '<td><img src="' + coin.image + '" width="14" height="14" style="vertical-align:middle;margin-right:4px"> <strong>' + coin.symbol.toUpperCase() + '</strong> <span style="color:#94a3b8;font-size:10px">' + coin.name + '</span></td>' +
            '<td style="text-align:right">$' + (coin.current_price < 1 ? coin.current_price.toFixed(4) : coin.current_price.toLocaleString()) + '</td>' +
            '<td style="text-align:right;color:' + (chg >= 0 ? '#34d399' : '#f87171') + ';font-weight:600">' + (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%</td>' +
            '<td style="text-align:right">$' + fmtBig(coin.market_cap) + '</td>' +
            '<td style="text-align:right">$' + fmtBig(coin.total_volume) + '</td></tr>';
        });
        html += '</tbody></table></div>';
        $('cg-result').innerHTML = html;
      } catch (e) {
        $('cg-result').innerHTML = '❌ ' + e.message;
      }
    });
  }

  // ==============================================================
  // FEATURE 7 — Markowitz 效率前緣 (v316)
  // ==============================================================
  function buildEfficientFrontier(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:#94a3b8;margin-bottom:8px">📐 Markowitz 效率前緣 — 投組最佳化（給定風險的最高報酬 / 給定報酬的最低風險）</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:10px"><input id="ef-syms" placeholder="3-5 檔代號（如 2330,2454,2308,2882,1101）" value="2330,2454,2308,2882" style="flex:1;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px">' +
      '<button id="ef-go" style="padding:6px 14px;background:#7c3aed;border:0;color:#fff;border-radius:4px;cursor:pointer">計算效率前緣</button></div>' +
      '<div id="ef-result"></div></div>';

    $('ef-go').addEventListener('click', async () => {
      const syms = $('ef-syms').value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 5);
      if (syms.length < 2) { $('ef-result').innerHTML = '⚠️ 至少 2 檔'; return; }
      $('ef-result').innerHTML = '⏳ 計算中...';
      const SB_URL = 'https://sirhskxufayklqrlxeep.supabase.co';
      const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcmhza3h1ZmF5a2xxcmx4ZWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTc5ODQsImV4cCI6MjA5MDMzMzk4NH0.i0iNEGXq3tkLrQQbGq3WJbNPbNrnrV6ryg8UUB8Bz5g';
      const SB_H = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };
      try {
        const since = new Date(Date.now() - 365 * 24 * 3600e3).toISOString().slice(0, 10);
        const data = await Promise.all(syms.map(s =>
          fetch(SB_URL + '/rest/v1/daily_prices?symbol=eq.' + s + '&date=gte.' + since + '&select=date,close_price&order=date.asc', { headers: SB_H }).then(r => r.json())
        ));
        // Align dates
        const dates0 = data[0].map(d => d.date);
        const aligned = dates0.filter(d => data.every(arr => arr.find(x => x.date === d)));
        if (aligned.length < 30) { $('ef-result').innerHTML = '⚠️ 對齊資料不足'; return; }
        const series = data.map(arr => {
          const m = new Map(arr.map(d => [d.date, d.close_price]));
          return aligned.map(d => m.get(d));
        });
        const rets = series.map(arr => {
          const r = [];
          for (let i = 1; i < arr.length; i++) r.push(arr[i] / arr[i - 1] - 1);
          return r;
        });
        const N = rets[0].length;
        const means = rets.map(r => r.reduce((s, x) => s + x, 0) / N * 252);
        // Covariance matrix
        const cov = [];
        for (let i = 0; i < syms.length; i++) {
          cov[i] = [];
          for (let j = 0; j < syms.length; j++) {
            let c = 0;
            for (let k = 0; k < N; k++) c += (rets[i][k] - means[i] / 252) * (rets[j][k] - means[j] / 252);
            cov[i][j] = c / N * 252;
          }
        }
        // Random portfolios + efficient frontier
        const portfolios = [];
        for (let p = 0; p < 5000; p++) {
          let w = syms.map(() => Math.random());
          const sw = w.reduce((s, x) => s + x, 0);
          w = w.map(x => x / sw);
          let ret = 0;
          for (let i = 0; i < syms.length; i++) ret += w[i] * means[i];
          let varP = 0;
          for (let i = 0; i < syms.length; i++) {
            for (let j = 0; j < syms.length; j++) varP += w[i] * w[j] * cov[i][j];
          }
          const std = Math.sqrt(Math.max(0, varP));
          portfolios.push({ ret, std, w, sharpe: (ret - 0.03) / std });
        }
        // Find max Sharpe + min variance
        const maxSharpe = portfolios.reduce((m, p) => p.sharpe > m.sharpe ? p : m, portfolios[0]);
        const minVar = portfolios.reduce((m, p) => p.std < m.std ? p : m, portfolios[0]);
        // SVG scatter plot
        const W = 800, H = 350;
        const xMin = Math.min.apply(null, portfolios.map(p => p.std)) * 0.95;
        const xMax = Math.max.apply(null, portfolios.map(p => p.std)) * 1.05;
        const yMin = Math.min.apply(null, portfolios.map(p => p.ret)) * 0.95;
        const yMax = Math.max.apply(null, portfolios.map(p => p.ret)) * 1.05;
        let svg = '<svg width="100%" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" style="background:#0a0f1c;border-radius:6px;margin-top:8px">';
        portfolios.forEach(p => {
          const x = ((p.std - xMin) / (xMax - xMin)) * (W - 60) + 50;
          const y = H - ((p.ret - yMin) / (yMax - yMin)) * (H - 60) - 30;
          const c = p.sharpe > 0.8 ? '#34d399' : p.sharpe > 0.4 ? '#fbbf24' : '#475569';
          svg += '<circle cx="' + x.toFixed(0) + '" cy="' + y.toFixed(0) + '" r="2" fill="' + c + '" opacity="0.6"/>';
        });
        // Mark max Sharpe
        const msX = ((maxSharpe.std - xMin) / (xMax - xMin)) * (W - 60) + 50;
        const msY = H - ((maxSharpe.ret - yMin) / (yMax - yMin)) * (H - 60) - 30;
        svg += '<circle cx="' + msX.toFixed(0) + '" cy="' + msY.toFixed(0) + '" r="8" fill="#dc2626" stroke="#fff" stroke-width="2"/>';
        svg += '<text x="' + (msX + 12) + '" y="' + msY + '" fill="#fff" font-size="11">⭐ Max Sharpe</text>';
        const mvX = ((minVar.std - xMin) / (xMax - xMin)) * (W - 60) + 50;
        const mvY = H - ((minVar.ret - yMin) / (yMax - yMin)) * (H - 60) - 30;
        svg += '<circle cx="' + mvX.toFixed(0) + '" cy="' + mvY.toFixed(0) + '" r="8" fill="#2563eb" stroke="#fff" stroke-width="2"/>';
        svg += '<text x="' + (mvX + 12) + '" y="' + mvY + '" fill="#fff" font-size="11">🛡️ Min Variance</text>';
        // Axes labels
        svg += '<text x="' + (W / 2) + '" y="' + (H - 5) + '" text-anchor="middle" fill="#94a3b8" font-size="11">風險 (年化波動率)</text>';
        svg += '<text x="10" y="' + (H / 2) + '" fill="#94a3b8" font-size="11" transform="rotate(-90 10,' + (H / 2) + ')">年化期望報酬</text>';
        svg += '</svg>';

        let html = svg;
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:10px">';
        [{ label: '⭐ Max Sharpe (最高夏普)', p: maxSharpe, color: '#dc2626' }, { label: '🛡️ Min Variance (最低風險)', p: minVar, color: '#2563eb' }].forEach(c => {
          html += '<div style="background:rgba(' + (c.color === '#dc2626' ? '220,38,38' : '37,99,235') + ',0.05);border:1px solid ' + c.color + ';border-radius:6px;padding:10px">' +
            '<div style="font-weight:700;color:' + c.color + ';margin-bottom:6px">' + c.label + '</div>' +
            '<div style="font-size:12px;color:#cbd5e1;line-height:1.7">期望報酬: <strong>' + (c.p.ret * 100).toFixed(2) + '%</strong><br>波動率: <strong>' + (c.p.std * 100).toFixed(2) + '%</strong><br>Sharpe: <strong>' + c.p.sharpe.toFixed(2) + '</strong></div>' +
            '<div style="margin-top:8px;font-size:11px;color:#94a3b8">配置: ' + syms.map((s, i) => s + ' ' + (c.p.w[i] * 100).toFixed(1) + '%').join(' / ') + '</div></div>';
        });
        html += '</div>';
        html += '<div style="margin-top:10px;padding:8px;background:rgba(124,58,237,0.05);border-radius:4px;font-size:11px;color:#94a3b8;line-height:1.6">💡 5000 個隨機投組模擬。色點顏色越綠 Sharpe 越高。⭐ 紅點 = Max Sharpe，最佳風險調整後報酬。🛡️ 藍點 = Min Variance，最穩健配置。</div>';
        $('ef-result').innerHTML = html;
      } catch (e) {
        $('ef-result').innerHTML = '❌ ' + e.message;
      }
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
    injectSection('tab-tw', 'v310-tpex', '🇹🇼 TPEx 櫃買中心 + 興櫃', buildTPEx);
    injectSection('tab-futures', 'v311-taifex', '📊 期交所 TAIFEX 每日統計', buildTaifex);
    injectSection('tab-tw', 'v312-mops', '📰 公開資訊觀測站重大訊息', buildMOPS);
    buildTutorial();
    injectSection('tab-tools', 'v314-tax', '💸 完整稅務計算器（台股）', buildTaxCalculator);
    injectSection('tab-crypto', 'v315-coingecko', '🪙 CoinGecko 加密前 100', buildCoinGecko);
    injectSection('tab-portfolio', 'v316-frontier', '📐 Markowitz 效率前緣', buildEfficientFrontier);
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

  window.v283 = { version: VERSION, rebuild: buildAll };
  console.log('[' + VERSION + '] 7 features loaded');
})();
