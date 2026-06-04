/**
 * MoneyRadar v284 Bundle — 5 件 Bloomberg 級殺手鐧
 * 1. AI 月度自動報告（Llama + jsPDF 生成 PDF）
 * 2. 全民股票競賽排行榜（Paper Trading 公開排名）
 * 3. AI 投資學習路徑（個人化教育 roadmap）
 * 4. Pair Trading 量化訊號（z-score 偏離）
 * 5. Implied Volatility Surface（期權波動率視覺化）
 */
(function() {
  'use strict';
  const VERSION = 'v284-bundle';
  const W = 'https://moneyradar-ai-proxy.thinkbigtw.workers.dev';
  const SB_URL = 'https://sirhskxufayklqrlxeep.supabase.co';
  const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcmhza3h1ZmF5a2xxcmx4ZWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTc5ODQsImV4cCI6MjA5MDMzMzk4NH0.i0iNEGXq3tkLrQQbGq3WJbNPbNrnrV6ryg8UUB8Bz5g';
  const SB_H = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };

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
  // FEATURE 1 — AI 月度自動報告（v317）
  // ==============================================================
  function buildMonthlyReport(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">📋 AI 月度投資報告 — Llama 70B 為你的投資組合生成個人化 PDF 月報（Bloomberg 機構級）</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:10px"><input id="mr-syms" placeholder="持股代號（逗號分隔，如 2330,2454,AAPL）" value="2330,2454,2308,3711,1101" style="flex:1;padding:6px;background:var(--bg-base);border:1px solid var(--border-strong);color:#fff;border-radius:4px">' +
      '<button id="mr-go" style="padding:6px 14px;background:#dc2626;border:0;color:#fff;border-radius:4px;cursor:pointer;font-weight:700">生成月報</button></div>' +
      '<div id="mr-result"></div></div>';

    $('mr-go').addEventListener('click', async () => {
      const syms = $('mr-syms').value.split(',').map(s => s.trim()).filter(Boolean);
      if (syms.length === 0) return;
      $('mr-result').innerHTML = '<div style="color:var(--text-secondary);padding:14px">⏳ 抓取持股 30 天數據 + AI 撰寫月報（~30 秒）...</div>';
      try {
        // Get 30-day data for each holding
        const since = new Date(Date.now() - 35 * 24 * 3600e3).toISOString().slice(0, 10);
        const sym = syms.join(',');
        const r = await fetch(SB_URL + '/rest/v1/daily_prices?symbol=in.(' + sym + ')&date=gte.' + since +
          '&select=symbol,date,close_price,volume&order=date.asc', { headers: SB_H });
        const data = await r.json();
        // Group + summarize
        const summary = {};
        syms.forEach(s => {
          const arr = data.filter(d => d.symbol === s);
          if (arr.length < 2) return;
          const first = arr[0].close_price;
          const last = arr[arr.length - 1].close_price;
          const high = Math.max.apply(null, arr.map(x => x.close_price));
          const low = Math.min.apply(null, arr.map(x => x.close_price));
          summary[s] = {
            mtdReturn: ((last - first) / first) * 100,
            high, low, last,
            volume: arr.reduce((s2, x) => s2 + (x.volume || 0), 0)
          };
        });
        // Build prompt for AI
        const promptData = Object.entries(summary).map(([s, v]) =>
          `${s}: MTD ${v.mtdReturn.toFixed(2)}%, 收 ${v.last.toFixed(2)}, 最高 ${v.high.toFixed(2)}, 最低 ${v.low.toFixed(2)}`
        ).join('\n');
        const r2 = await fetch(W + '/monthly-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: syms, summary: promptData, month: new Date().toISOString().slice(0, 7) })
        });
        if (!r2.ok) throw new Error('Worker /monthly-report ' + r2.status);
        const j = await r2.json();
        const month = j.month || new Date().toISOString().slice(0, 7);
        const aiReport = j.report || '無 AI 內容';
        // Render report
        let html = '<div id="mr-pdf-content" style="background:#fff;color:#1a1a1a;border-radius:8px;padding:32px;font-family:-apple-system,sans-serif;line-height:1.7">' +
          '<header style="border-bottom:3px solid #0a64a8;padding-bottom:12px;margin-bottom:20px"><h1 style="margin:0;color:#0a64a8;font-size:24px">📋 MoneyRadar 月度投資報告</h1>' +
          '<div style="color:#666;font-size:13px;margin-top:6px">月份: ' + month + ' · 生成日期: ' + new Date().toLocaleString() + ' · 持股: ' + syms.length + ' 檔</div></header>';
        // Holdings table
        html += '<h2 style="font-size:16px;color:#0a64a8;margin-top:20px">📊 持股月度表現</h2>' +
          '<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px"><thead><tr style="background:#f3f4f6"><th style="padding:8px;text-align:left;border:1px solid #e5e7eb">代號</th><th style="text-align:right;border:1px solid #e5e7eb">MTD 報酬</th><th style="text-align:right;border:1px solid #e5e7eb">收盤</th><th style="text-align:right;border:1px solid #e5e7eb">最高</th><th style="text-align:right;border:1px solid #e5e7eb">最低</th></tr></thead><tbody>';
        Object.entries(summary).forEach(([s, v]) => {
          html += '<tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:700">' + s + '</td>' +
            '<td style="text-align:right;border:1px solid #e5e7eb;color:' + (v.mtdReturn >= 0 ? '#16a34a' : '#dc2626') + ';font-weight:700">' + (v.mtdReturn >= 0 ? '+' : '') + v.mtdReturn.toFixed(2) + '%</td>' +
            '<td style="text-align:right;border:1px solid #e5e7eb">' + v.last.toFixed(2) + '</td>' +
            '<td style="text-align:right;border:1px solid #e5e7eb;color:#16a34a">' + v.high.toFixed(2) + '</td>' +
            '<td style="text-align:right;border:1px solid #e5e7eb;color:#dc2626">' + v.low.toFixed(2) + '</td></tr>';
        });
        html += '</tbody></table>';
        // AI summary
        html += '<h2 style="font-size:16px;color:#0a64a8;margin-top:24px">🤖 AI 月度評析（Llama 3.3 70B）</h2>' +
          '<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px;border-radius:4px;white-space:pre-wrap;font-size:13px;line-height:1.8">' + aiReport.replace(/</g, '&lt;') + '</div>';
        // Footer
        html += '<footer style="margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;color:#666;font-size:11px">⚠️ 本報告由 MoneyRadar AI 自動生成。所有內容僅供參考，不構成投資建議。投資有風險，請自行判斷。<br>由 Think BIG! 提供 · https://thinkbigtw.com</footer>' +
          '</div>' +
          '<button id="mr-pdf" style="margin-top:10px;padding:10px 16px;background:#16a34a;border:0;color:#fff;border-radius:6px;cursor:pointer;font-weight:700">📥 下載為 PDF</button>';
        $('mr-result').innerHTML = html;
        $('mr-pdf').addEventListener('click', () => {
          // Use html2canvas + jsPDF if available, else just print
          if (window.html2canvas && window.jsPDF) {
            window.html2canvas($('mr-pdf-content'), { scale: 2 }).then(canvas => {
              const imgData = canvas.toDataURL('image/png');
              const pdf = new window.jsPDF('p', 'pt', 'a4');
              const pdfW = pdf.internal.pageSize.getWidth();
              const imgH = (canvas.height * pdfW) / canvas.width;
              pdf.addImage(imgData, 'PNG', 0, 0, pdfW, imgH);
              pdf.save('MoneyRadar-月報-' + month + '.pdf');
            });
          } else {
            // Print fallback
            const w = window.open('', '_blank');
            w.document.write('<html><head><title>MoneyRadar 月報</title></head><body>' + $('mr-pdf-content').outerHTML + '</body></html>');
            w.document.close();
            setTimeout(() => w.print(), 500);
          }
        });
      } catch (e) {
        $('mr-result').innerHTML = '<div style="padding:14px;color:#dc2626">❌ ' + (e.message || e) + '</div>';
      }
    });
  }

  // ==============================================================
  // FEATURE 2 — 全民股票競賽排行榜（v318）
  // 使用 Paper Trading (v291) 的數據 + localStorage + 本地排名
  // ==============================================================
  function buildContestLeaderboard(containerId) {
    const c = $(containerId);
    if (!c) return;
    const KEY = 'mr_v278_paper_account';
    const NAME_KEY = 'mr_v284_username';
    function getAccount() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } }
    function getUsername() { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } }

    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">🏆 全民股票競賽 — 用 Paper Trading 累積戰績，公開月度排行榜</div>' +
      '<div id="cl-info" style="margin-bottom:10px"></div>' +
      '<div style="display:flex;gap:6px;margin-bottom:10px"><input id="cl-name" placeholder="你的暱稱（公開排行用）" style="flex:1;padding:6px;background:var(--bg-base);border:1px solid var(--border-strong);color:#fff;border-radius:4px">' +
      '<button id="cl-submit" style="padding:6px 14px;background:#16a34a;border:0;color:#fff;border-radius:4px;cursor:pointer">送戰績上榜</button>' +
      '<button id="cl-refresh" style="padding:6px 14px;background:var(--text-muted);border:0;color:#fff;border-radius:4px;cursor:pointer">🔄 刷新</button></div>' +
      '<div id="cl-leaderboard"></div></div>';

    const acc = getAccount();
    if (!acc) {
      $('cl-info').innerHTML = '<div style="color:#fbbf24;padding:8px;background:rgba(251,191,36,0.05);border:1px solid rgba(251,191,36,0.3);border-radius:4px">⚠️ 還沒開始模擬交易！請先到「理財工具 → 📒 模擬交易」開始。</div>';
    } else {
      const tv = acc.cash + Object.values(acc.holdings).reduce((s, h) => s + h.shares * (h.last || h.avgCost), 0);
      const ret = ((tv - 1000000) / 1000000) * 100;
      $('cl-info').innerHTML = '<div style="background:rgba(96,165,250,0.05);border:1px solid rgba(96,165,250,0.3);border-radius:4px;padding:10px;font-size:13px">💼 你的戰績: 總市值 <strong style="color:#fff">$' + fmtBig(tv) + '</strong> · 報酬率 <strong style="color:' + (ret >= 0 ? '#34d399' : '#f87171') + '">' + (ret >= 0 ? '+' : '') + ret.toFixed(2) + '%</strong> · ' + Object.keys(acc.holdings).length + ' 檔持股 · ' + acc.history.length + ' 筆交易</div>';
    }
    $('cl-name').value = getUsername();

    async function loadLeaderboard() {
      $('cl-leaderboard').innerHTML = '⏳ 載入排行榜...';
      try {
        // Try Supabase contest table; fallback to mock
        let entries = [];
        try {
          const r = await fetch(SB_URL + '/rest/v1/contest_entries?select=*&order=return_pct.desc&limit=50', { headers: SB_H });
          if (r.ok) entries = await r.json();
        } catch {}
        if (!Array.isArray(entries) || entries.length === 0) {
          // Show mock + own
          entries = [
            { username: '股神巴菲特', return_pct: 28.5, total_value: 1285000, trades: 32, updated_at: '2026-04-29' },
            { username: '台股老司機', return_pct: 22.3, total_value: 1223000, trades: 56, updated_at: '2026-04-29' },
            { username: 'AI 投資狂', return_pct: 18.7, total_value: 1187000, trades: 89, updated_at: '2026-04-30' },
            { username: '量化俠客', return_pct: 15.2, total_value: 1152000, trades: 124, updated_at: '2026-04-30' },
            { username: '價值守護者', return_pct: 12.8, total_value: 1128000, trades: 18, updated_at: '2026-04-29' },
            { username: '存股族長', return_pct: 9.5, total_value: 1095000, trades: 8, updated_at: '2026-04-28' },
            { username: '波段獵人', return_pct: 7.2, total_value: 1072000, trades: 67, updated_at: '2026-04-30' },
            { username: '新手菜鳥', return_pct: -2.1, total_value: 979000, trades: 45, updated_at: '2026-04-30' }
          ];
          // Insert own if exists
          if (acc) {
            const tv = acc.cash + Object.values(acc.holdings).reduce((s, h) => s + h.shares * (h.last || h.avgCost), 0);
            const ret = ((tv - 1000000) / 1000000) * 100;
            const username = getUsername() || '你';
            entries.push({ username: '👤 ' + username + ' (你)', return_pct: ret, total_value: tv, trades: acc.history.length, updated_at: new Date().toISOString().slice(0, 10), is_self: true });
            entries.sort((a, b) => b.return_pct - a.return_pct);
          }
        }
        let html = '<div style="background:rgba(251,191,36,0.05);border:1px solid rgba(251,191,36,0.3);border-radius:6px;padding:12px"><div style="font-size:14px;color:#fff;margin-bottom:8px;font-weight:700">🏆 ' + new Date().toISOString().slice(0, 7) + ' 月排行榜（前 ' + entries.length + ' 名）</div>' +
          '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="border-bottom:1px solid var(--border-strong);color:var(--text-secondary)"><th style="padding:6px;text-align:left">#</th><th style="text-align:left">玩家</th><th style="text-align:right">報酬率</th><th style="text-align:right">總市值</th><th style="text-align:right">交易數</th><th style="text-align:right">更新</th></tr></thead><tbody>';
        entries.forEach((e, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
          html += '<tr style="border-bottom:1px solid var(--bg-elevated);' + (e.is_self ? 'background:rgba(96,165,250,0.1);font-weight:700' : '') + '">' +
            '<td style="padding:6px">' + medal + ' ' + (i + 1) + '</td>' +
            '<td>' + (e.username || '-') + '</td>' +
            '<td style="text-align:right;color:' + (e.return_pct >= 0 ? '#34d399' : '#f87171') + ';font-weight:700">' + (e.return_pct >= 0 ? '+' : '') + Number(e.return_pct).toFixed(2) + '%</td>' +
            '<td style="text-align:right">$' + fmtBig(e.total_value) + '</td>' +
            '<td style="text-align:right">' + (e.trades || 0) + '</td>' +
            '<td style="text-align:right;color:var(--text-muted);font-size:11px">' + (e.updated_at || '-') + '</td></tr>';
        });
        html += '</tbody></table>' +
          '<div style="margin-top:10px;padding:8px;background:rgba(96,165,250,0.05);border-radius:4px;font-size:11px;color:var(--text-secondary)">💡 排行榜目前展示示範資料。送戰績上榜後將寫入 Supabase contest_entries 表（公開）。月底結算冠軍。</div></div>';
        $('cl-leaderboard').innerHTML = html;
      } catch (e) {
        $('cl-leaderboard').innerHTML = '❌ ' + e.message;
      }
    }

    $('cl-submit').addEventListener('click', async () => {
      if (!acc) { alert('請先開始模擬交易'); return; }
      const name = $('cl-name').value.trim();
      if (!name) { alert('請輸入暱稱'); return; }
      try { localStorage.setItem(NAME_KEY, name); } catch {}
      const tv = acc.cash + Object.values(acc.holdings).reduce((s, h) => s + h.shares * (h.last || h.avgCost), 0);
      const ret = ((tv - 1000000) / 1000000) * 100;
      try {
        await fetch(SB_URL + '/rest/v1/contest_entries', {
          method: 'POST',
          headers: { ...SB_H, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify({ username: name, return_pct: ret, total_value: tv, trades: acc.history.length, updated_at: new Date().toISOString() })
        });
        alert('✅ 戰績已上傳');
        loadLeaderboard();
      } catch (e) {
        alert('上傳失敗（contest_entries 表可能尚未建立）：' + e.message);
      }
    });
    $('cl-refresh').addEventListener('click', loadLeaderboard);
    loadLeaderboard();
  }

  // ==============================================================
  // FEATURE 3 — AI 投資學習路徑（v319）
  // ==============================================================
  function buildLearningPath(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">🧭 AI 投資學習路徑 — 評估你的程度，個人化推薦下一步學什麼</div>' +
      '<div id="lp-quiz"></div></div>';

    const QUESTIONS = [
      { q: '你聽過「本益比 (PE)」嗎？', opts: ['沒聽過', '聽過但不太懂', '懂並會用'] },
      { q: '你能解釋什麼是「股利再投入」嗎？', opts: ['沒聽過', '聽過但不太懂', '能解釋'] },
      { q: '你做過技術分析（看 K 線、均線）嗎？', opts: ['沒做過', '看過但不會用', '熟練'] },
      { q: '你了解「資產配置」(60/40 股債) 嗎？', opts: ['沒聽過', '聽過', '已實踐'] },
      { q: '你算過「年化報酬」嗎？', opts: ['沒算過', '會算但不常算', '常用 IRR / CAGR'] },
      { q: '你知道「夏普比率 Sharpe Ratio」嗎？', opts: ['沒聽過', '聽過', '會用來評投組'] },
      { q: '你做過「投組再平衡」嗎？', opts: ['沒做過', '聽過', '每年做'] },
      { q: '你買過 ETF 嗎？', opts: ['沒買過', '買過 1-2 檔', '主要工具'] }
    ];

    let answers = [];
    let curQ = 0;

    function showQ() {
      if (curQ >= QUESTIONS.length) { showResult(); return; }
      const q = QUESTIONS[curQ];
      $('lp-quiz').innerHTML = '<div style="background:rgba(96,165,250,0.05);border:1px solid rgba(96,165,250,0.3);border-radius:8px;padding:20px">' +
        '<div style="font-size:11px;color:var(--text-secondary)">問題 ' + (curQ + 1) + ' / ' + QUESTIONS.length + '</div>' +
        '<div style="font-size:18px;font-weight:700;color:#fff;margin:8px 0 14px">' + q.q + '</div>' +
        q.opts.map((o, i) => '<button class="lp-opt" data-i="' + i + '" style="display:block;width:100%;padding:10px;margin:6px 0;background:var(--bg-base);border:1px solid var(--border-strong);color:#cbd5e1;border-radius:6px;cursor:pointer;text-align:left;font-size:14px">' + (i + 1) + '. ' + o + '</button>').join('') +
        '</div>';
      $('lp-quiz').querySelectorAll('.lp-opt').forEach(b => {
        b.addEventListener('click', () => {
          answers.push(parseInt(b.dataset.i));
          curQ++;
          showQ();
        });
      });
    }

    function showResult() {
      const score = answers.reduce((s, a) => s + a, 0);
      const max = QUESTIONS.length * 2;
      const pct = (score / max) * 100;
      let level, plan, color;
      if (pct < 25) {
        level = '🌱 入門新手';
        color = '#34d399';
        plan = [
          { stage: 'Week 1-2', topic: '基本概念', items: ['什麼是股票？股利？股價？', '看懂 K 線基本圖', '台股交易時間 + 手續費 + 證交稅'] },
          { stage: 'Week 3-4', topic: 'ETF 入門', items: ['了解 0050 / 0056 / 00878', '指數投資 vs 主動選股', '定期定額 vs 單筆投資'] },
          { stage: 'Month 2', topic: '基本面入門', items: ['本益比 PE / 殖利率', '財報三大表（簡化版）', '產業類股分類（科技/金融/傳產）'] },
          { stage: 'Month 3', topic: '實戰練習', items: ['用 MoneyRadar 模擬交易 NT$1M', '建立 5 檔自選股 watchlist', '每週看一次盤後摘要'] }
        ];
      } else if (pct < 50) {
        level = '🌿 進階學習';
        color = '#60a5fa';
        plan = [
          { stage: 'Week 1-2', topic: '技術分析', items: ['均線 (SMA/EMA) + 黃金交叉', 'RSI / MACD / KD 三大指標', 'Bollinger Bands 通道策略'] },
          { stage: 'Week 3-4', topic: '基本面深度', items: ['ROE / ROA / 毛利率', '自由現金流 FCF / DCF 估值入門', '巴菲特 4 大過濾條件'] },
          { stage: 'Month 2', topic: '資產配置', items: ['60/40 股債經典', 'All Weather (Ray Dalio)', '黃金 / REITs / 加密 入門'] },
          { stage: 'Month 3', topic: '投組管理', items: ['年化報酬 / 風險評估', '夏普比率 / 最大回撤', '再平衡頻率規劃'] }
        ];
      } else if (pct < 75) {
        level = '🌳 中級實戰';
        color = '#fbbf24';
        plan = [
          { stage: 'Week 1-2', topic: '量化思維', items: ['Beta / Alpha / Sortino', '相關性分析（避免單一風險）', '黑天鵝偵測 + 尾部風險'] },
          { stage: 'Week 3-4', topic: '期權入門', items: ['Call / Put 基本', 'Black-Scholes 定價', 'Greeks (Δ Γ Θ ν)'] },
          { stage: 'Month 2', topic: '進階策略', items: ['Pair Trading 配對交易', '事件驅動投資（財報、併購）', '13F 跟單巴菲特 + Bridgewater'] },
          { stage: 'Month 3', topic: '心理學 & 紀律', items: ['認知偏誤識別', '交易日誌養成', '風險控制公式（Kelly）'] }
        ];
      } else {
        level = '🌲 高手進化';
        color = '#dc2626';
        plan = [
          { stage: 'Week 1-2', topic: '機構級工具', items: ['Bloomberg Terminal 自學', 'Refinitiv Eikon 操作', '自建 Python backtest 平台'] },
          { stage: 'Week 3-4', topic: '宏觀策略', items: ['Soros 反身性 / Dalio 機器原理', '貨幣政策 + 央行行動', 'Sector rotation 產業循環'] },
          { stage: 'Month 2', topic: '進階量化', items: ['Markowitz 效率前緣', 'Kelly Criterion 倉位', 'Monte Carlo 模擬'] },
          { stage: 'Month 3', topic: '個人系統', items: ['寫個人投資憲法', '建立 12 個月計畫', '考慮 CFA / FRM 等專業認證'] }
        ];
      }

      let html = '<div style="background:rgba(' + (color === '#34d399' ? '52,211,153' : color === '#60a5fa' ? '96,165,250' : color === '#fbbf24' ? '251,191,36' : '220,38,38') + ',0.05);border:1px solid ' + color + ';border-radius:8px;padding:20px">' +
        '<div style="text-align:center;margin-bottom:14px"><div style="font-size:24px;font-weight:700;color:' + color + '">' + level + '</div>' +
        '<div style="color:var(--text-secondary);font-size:13px">分數: ' + score + '/' + max + ' · ' + pct.toFixed(0) + '%</div></div>' +
        '<div style="font-weight:700;color:#fff;margin-bottom:10px">📚 你的個人化 3 個月學習路徑：</div>';
      plan.forEach(p => {
        html += '<div style="background:var(--bg-base);border-left:3px solid ' + color + ';padding:10px 14px;margin:6px 0;border-radius:4px">' +
          '<div style="font-weight:700;color:' + color + ';font-size:13px">' + p.stage + ' · ' + p.topic + '</div>' +
          '<ul style="margin:6px 0 0 0;padding-left:20px;color:#cbd5e1;font-size:12px;line-height:1.7">' +
          p.items.map(it => '<li>' + it + '</li>').join('') +
          '</ul></div>';
      });
      html += '<button id="lp-restart" style="margin-top:12px;padding:8px 16px;background:var(--text-muted);border:0;color:#fff;border-radius:4px;cursor:pointer">↺ 重新測驗</button>' +
        '<div style="margin-top:8px;padding:8px;background:rgba(96,165,250,0.05);border-radius:4px;font-size:11px;color:var(--text-secondary)">💡 完成這個路徑後再回來重測，看你有沒有進階。MoneyRadar 內所有相關工具會在描述中標記對應級別。</div>' +
        '</div>';
      $('lp-quiz').innerHTML = html;
      $('lp-restart').addEventListener('click', () => { answers = []; curQ = 0; showQ(); });
    }

    showQ();
  }

  // ==============================================================
  // FEATURE 4 — Pair Trading 訊號（v320）
  // ==============================================================
  function buildPairTrading(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">🔄 Pair Trading 配對交易訊號 — 找出 z-score 偏離的雙股價差（量化基金核心策略）</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 80px;gap:6px;margin-bottom:10px"><input id="pt2-a" placeholder="A 股" value="2330" style="padding:6px;background:var(--bg-base);border:1px solid var(--border-strong);color:#fff;border-radius:4px">' +
      '<input id="pt2-b" placeholder="B 股" value="2454" style="padding:6px;background:var(--bg-base);border:1px solid var(--border-strong);color:#fff;border-radius:4px">' +
      '<button id="pt2-go" style="padding:6px;background:#7c3aed;border:0;color:#fff;border-radius:4px;cursor:pointer">分析</button></div>' +
      '<div id="pt2-result"></div></div>';

    $('pt2-go').addEventListener('click', async () => {
      const a = $('pt2-a').value.trim();
      const b = $('pt2-b').value.trim();
      const since = new Date(Date.now() - 365 * 24 * 3600e3).toISOString().slice(0, 10);
      $('pt2-result').innerHTML = '⏳ 分析配對...';
      try {
        const [r1, r2] = await Promise.all([
          fetch(SB_URL + '/rest/v1/daily_prices?symbol=eq.' + a + '&date=gte.' + since + '&select=date,close_price&order=date.asc', { headers: SB_H }),
          fetch(SB_URL + '/rest/v1/daily_prices?symbol=eq.' + b + '&date=gte.' + since + '&select=date,close_price&order=date.asc', { headers: SB_H })
        ]);
        const d1 = await r1.json(), d2 = await r2.json();
        const m2 = new Map(d2.map(d => [d.date, d.close_price]));
        const aligned = d1.filter(d => m2.has(d.date)).map(d => ({ date: d.date, a: d.close_price, b: m2.get(d.date) }));
        if (aligned.length < 60) { $('pt2-result').innerHTML = '⚠️ 對齊資料不足'; return; }
        // Compute price ratio (or log spread)
        const ratios = aligned.map(d => d.a / d.b);
        const mean = ratios.reduce((s, r) => s + r, 0) / ratios.length;
        const variance = ratios.reduce((s, r) => s + (r - mean) ** 2, 0) / ratios.length;
        const std = Math.sqrt(variance);
        const lastRatio = ratios[ratios.length - 1];
        const z = (lastRatio - mean) / std;
        // Build chart
        const W = 800, H = 240;
        const minR = Math.min.apply(null, ratios), maxR = Math.max.apply(null, ratios);
        let svg = '<svg width="100%" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" style="background:var(--bg-base);border-radius:6px">';
        // Mean line
        const meanY = H - ((mean - minR) / (maxR - minR)) * (H - 30) - 15;
        svg += '<line x1="0" y1="' + meanY + '" x2="' + W + '" y2="' + meanY + '" stroke="#fbbf24" stroke-dasharray="4,4" stroke-width="1"/>';
        // ±2 sigma
        [{ v: mean + 2 * std, label: '+2σ', color: '#f87171' }, { v: mean - 2 * std, label: '-2σ', color: '#34d399' }].forEach(line => {
          const y = H - ((line.v - minR) / (maxR - minR)) * (H - 30) - 15;
          svg += '<line x1="0" y1="' + y + '" x2="' + W + '" y2="' + y + '" stroke="' + line.color + '" stroke-dasharray="2,2" stroke-width="1" opacity="0.6"/>';
        });
        // Ratio line
        const path = ratios.map((r, i) => {
          const x = (i / (ratios.length - 1)) * W;
          const y = H - ((r - minR) / (maxR - minR)) * (H - 30) - 15;
          return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
        }).join('');
        svg += '<path d="' + path + '" stroke="#60a5fa" stroke-width="1.5" fill="none"/>';
        svg += '</svg>';
        // Signal
        let signal = '中性 (no signal)', sigColor = 'var(--text-secondary)';
        if (z > 2) { signal = '🔻 做空 ' + a + ' / 做多 ' + b + '（價差過高，預期回歸）'; sigColor = '#f87171'; }
        else if (z < -2) { signal = '🔺 做多 ' + a + ' / 做空 ' + b + '（價差過低，預期回歸）'; sigColor = '#34d399'; }
        else if (Math.abs(z) > 1) { signal = '⚠️ 觀察中（z 接近 ±2）'; sigColor = '#fbbf24'; }
        $('pt2-result').innerHTML = '<div style="background:rgba(124,58,237,0.05);border:1px solid rgba(124,58,237,0.3);border-radius:6px;padding:12px">' +
          '<div style="display:flex;justify-content:space-between;margin-bottom:8px"><span style="font-size:14px;font-weight:700;color:#fff">' + a + ' / ' + b + ' 價格比</span><span style="font-size:18px;font-weight:700;color:' + sigColor + '">z = ' + z.toFixed(2) + 'σ</span></div>' +
          svg +
          '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px;font-size:12px"><div><span style="color:var(--text-secondary)">當前比率</span><div style="font-weight:700">' + lastRatio.toFixed(4) + '</div></div>' +
          '<div><span style="color:var(--text-secondary)">平均</span><div style="font-weight:700">' + mean.toFixed(4) + '</div></div>' +
          '<div><span style="color:var(--text-secondary)">標準差</span><div style="font-weight:700">' + std.toFixed(4) + '</div></div>' +
          '<div><span style="color:var(--text-secondary)">樣本</span><div style="font-weight:700">' + aligned.length + ' 天</div></div></div>' +
          '<div style="margin-top:10px;padding:10px;background:rgba(' + (sigColor === '#f87171' ? '248,113,113' : sigColor === '#34d399' ? '52,211,153' : '251,191,36') + ',0.1);border-radius:6px;color:' + sigColor + ';font-weight:700">' + signal + '</div>' +
          '<div style="margin-top:8px;padding:8px;background:rgba(96,165,250,0.05);border-radius:4px;font-size:11px;color:var(--text-secondary)">💡 Pair Trading: 找出長期高度相關的雙股，當價差 z-score 超過 ±2σ 時建立反向部位（買低賣高），等價差回歸時平倉獲利。市場中性策略，不依賴大盤方向。</div></div>';
      } catch (e) {
        $('pt2-result').innerHTML = '❌ ' + e.message;
      }
    });
  }

  // ==============================================================
  // FEATURE 5 — Implied Volatility Surface（v321）
  // ==============================================================
  function buildIVSurface(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">📊 隱含波動率曲面 IV Surface — 機構級期權分析（從 Yahoo options 計算）</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:10px"><input id="iv-sym" value="AAPL" placeholder="美股代號" style="flex:1;padding:6px;background:var(--bg-base);border:1px solid var(--border-strong);color:#fff;border-radius:4px">' +
      '<button id="iv-go" style="padding:6px 14px;background:#7c3aed;border:0;color:#fff;border-radius:4px;cursor:pointer">繪製 IV 曲面</button></div>' +
      '<div id="iv-result"></div></div>';

    $('iv-go').addEventListener('click', async () => {
      const sym = $('iv-sym').value.trim();
      $('iv-result').innerHTML = '⏳ 抓 options chain...';
      try {
        const r = await fetch(W + '/options?symbol=' + encodeURIComponent(sym));
        if (!r.ok) throw new Error('Worker /options ' + r.status);
        const j = await r.json();
        if (!j.calls || !j.puts) { $('iv-result').innerHTML = '⚠️ 無期權資料'; return; }
        const underlying = j.underlyingPrice || 100;
        // Combine calls + puts with IV
        const points = [];
        j.calls.forEach(c => { if (c.strike && c.impliedVolatility != null) points.push({ strike: c.strike, iv: c.impliedVolatility * 100, type: 'call' }); });
        j.puts.forEach(p => { if (p.strike && p.impliedVolatility != null) points.push({ strike: p.strike, iv: p.impliedVolatility * 100, type: 'put' }); });
        if (points.length < 5) { $('iv-result').innerHTML = '⚠️ IV 資料不足'; return; }
        // Sort by strike
        points.sort((a, b) => a.strike - b.strike);
        // Compute moneyness (strike / underlying)
        points.forEach(p => p.moneyness = p.strike / underlying);
        // Find min/max IV
        const ivs = points.map(p => p.iv);
        const minIV = Math.min.apply(null, ivs);
        const maxIV = Math.max.apply(null, ivs);
        // SVG 2D smile chart (since IV surface needs expiry too, but here only one expiry)
        const W = 800, H = 320;
        let svg = '<svg width="100%" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" style="background:var(--bg-base);border-radius:6px">';
        // ATM line (moneyness = 1)
        const minM = Math.min.apply(null, points.map(p => p.moneyness));
        const maxM = Math.max.apply(null, points.map(p => p.moneyness));
        const atmX = ((1 - minM) / (maxM - minM)) * (W - 80) + 40;
        svg += '<line x1="' + atmX + '" y1="0" x2="' + atmX + '" y2="' + H + '" stroke="#fbbf24" stroke-dasharray="4,4"/>';
        svg += '<text x="' + (atmX + 6) + '" y="20" fill="#fbbf24" font-size="11">ATM (價平)</text>';
        // Plot
        points.forEach(p => {
          const x = ((p.moneyness - minM) / (maxM - minM)) * (W - 80) + 40;
          const y = H - ((p.iv - minIV) / (maxIV - minIV)) * (H - 60) - 30;
          const color = p.type === 'call' ? '#34d399' : '#f87171';
          svg += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4" fill="' + color + '" opacity="0.7"/>';
        });
        // Smooth curve through avg per strike bucket
        const buckets = new Map();
        points.forEach(p => {
          const bucket = Math.round(p.moneyness * 20) / 20; // round to 0.05
          if (!buckets.has(bucket)) buckets.set(bucket, []);
          buckets.get(bucket).push(p.iv);
        });
        const smoothed = Array.from(buckets.entries()).map(([m, ivs2]) => ({
          moneyness: m,
          iv: ivs2.reduce((s, v) => s + v, 0) / ivs2.length
        })).sort((a, b) => a.moneyness - b.moneyness);
        if (smoothed.length >= 2) {
          const path = smoothed.map((p, i) => {
            const x = ((p.moneyness - minM) / (maxM - minM)) * (W - 80) + 40;
            const y = H - ((p.iv - minIV) / (maxIV - minIV)) * (H - 60) - 30;
            return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1);
          }).join('');
          svg += '<path d="' + path + '" stroke="#60a5fa" stroke-width="2" fill="none" opacity="0.8"/>';
        }
        // Y-axis labels
        svg += '<text x="10" y="' + (H - 10) + '" fill="var(--text-secondary)" font-size="10">' + minIV.toFixed(0) + '%</text>';
        svg += '<text x="10" y="20" fill="var(--text-secondary)" font-size="10">' + maxIV.toFixed(0) + '%</text>';
        svg += '<text x="' + (W - 100) + '" y="' + (H - 8) + '" fill="var(--text-secondary)" font-size="11">moneyness (Strike/Spot)</text>';
        svg += '</svg>';
        // ATM IV
        const atmPoints = points.filter(p => Math.abs(p.moneyness - 1) < 0.05);
        const atmIV = atmPoints.length ? atmPoints.reduce((s, p) => s + p.iv, 0) / atmPoints.length : null;
        // Skew: OTM put IV - ATM IV
        const otmPuts = points.filter(p => p.type === 'put' && p.moneyness < 0.9);
        const skew = otmPuts.length && atmIV != null ? (otmPuts.reduce((s, p) => s + p.iv, 0) / otmPuts.length) - atmIV : null;
        $('iv-result').innerHTML = '<div style="background:rgba(124,58,237,0.05);border:1px solid rgba(124,58,237,0.3);border-radius:6px;padding:12px">' +
          '<div style="font-size:14px;color:#fff;font-weight:700;margin-bottom:8px">' + sym + ' IV Smile（隱含波動率微笑曲線）</div>' +
          svg +
          '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px;font-size:12px">' +
          '<div><span style="color:var(--text-secondary)">標的價</span><div style="font-weight:700">$' + underlying.toFixed(2) + '</div></div>' +
          '<div><span style="color:var(--text-secondary)">ATM IV</span><div style="font-weight:700;color:#fbbf24">' + (atmIV ? atmIV.toFixed(1) + '%' : '-') + '</div></div>' +
          '<div><span style="color:var(--text-secondary)">Skew (OTM Put - ATM)</span><div style="font-weight:700;color:' + (skew > 5 ? '#f87171' : '#34d399') + '">' + (skew != null ? (skew >= 0 ? '+' : '') + skew.toFixed(1) + '%' : '-') + '</div></div>' +
          '<div><span style="color:var(--text-secondary)">合約數</span><div style="font-weight:700">' + points.length + '</div></div></div>' +
          '<div style="margin-top:10px;padding:10px;background:rgba(96,165,250,0.05);border-radius:4px;font-size:11px;color:var(--text-secondary);line-height:1.6">' +
          '💡 IV 微笑：行權價偏離 ATM 時 IV 通常較高（兩翼高、中間低）。<strong>Skew &gt; 5%</strong> 代表市場擔心下跌（買 OTM Put 避險需求高）→ 看空訊號。<br>🟢 綠點 = Call、🔴 紅點 = Put、🔵 藍線 = 平滑曲線。' +
          '</div></div>';
      } catch (e) {
        $('iv-result').innerHTML = '❌ ' + e.message;
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

  // Load jsPDF + html2canvas dynamically for monthly report
  function loadPDFLibs() {
    if (window.jsPDF && window.html2canvas) return;
    if (!window.jsPDF) {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload = () => { window.jsPDF = window.jspdf?.jsPDF || window.jsPDF; };
      document.head.appendChild(s);
    }
    // html2canvas already loaded by app2 (v272 share screenshots)
  }

  function buildAll() {
    loadPDFLibs();
    injectSection('tab-portfolio', 'v317-monthly-report', '📋 AI 月度自動報告', buildMonthlyReport);
    injectSection('tab-portfolio', 'v318-contest', '🏆 全民股票競賽排行榜', buildContestLeaderboard);
    injectSection('tab-tools', 'v319-learning', '🧭 AI 投資學習路徑', buildLearningPath);
    injectSection('tab-tools', 'v320-pair-trade', '🔄 Pair Trading 量化訊號', buildPairTrading);
    injectSection('tab-us', 'v321-iv-surface', '📊 IV Surface 隱含波動率曲面', buildIVSurface);
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

  window.v284 = { version: VERSION, rebuild: buildAll };
  console.log('[' + VERSION + '] 5 features loaded');
})();
