/**
 * MoneyRadar v282 Bundle — 5 件 AI Native 殺手鐧（震動市場等級）
 * 1. AI 全站多語言切換（en/ja/zh-CN/vi/id/th）
 * 2. AI 個股觀點文章生成（Seeking Alpha 等級 1500 字）
 * 3. AI 市場異常偵測（每天掃描 770k 資料）
 * 4. AI 投資對話夥伴（巴菲特/索羅斯/孫正義/林園角色）
 * 5. 目標導向投資規劃器（Wealthfront $4B 核心）
 */
(function() {
  'use strict';
  const VERSION = 'v282-bundle';
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
  // FEATURE 1 — AI 全站多語言切換（v305）
  // ==============================================================
  function buildLangSwitcher() {
    if ($('v282-lang-btn')) return;
    const KEY = 'mr_v282_lang';
    const LANGS = [
      { code: 'zh-TW', label: '🇹🇼 繁中' },
      { code: 'zh-CN', label: '🇨🇳 简中' },
      { code: 'en', label: '🇺🇸 English' },
      { code: 'ja', label: '🇯🇵 日本語' },
      { code: 'vi', label: '🇻🇳 Tiếng Việt' },
      { code: 'id', label: '🇮🇩 Indonesia' },
      { code: 'th', label: '🇹🇭 ภาษาไทย' }
    ];
    const cur = (() => { try { return localStorage.getItem(KEY) || 'zh-TW'; } catch { return 'zh-TW'; } })();

    const btn = document.createElement('button');
    btn.id = 'v282-lang-btn';
    btn.textContent = (LANGS.find(l => l.code === cur) || LANGS[0]).label;
    btn.title = 'AI 翻譯整個介面';
    btn.style.cssText = 'position:fixed;top:14px;right:64px;z-index:9998;padding:6px 10px;background:rgba(168,85,247,0.15);border:1px solid rgba(168,85,247,0.3);color:#fff;border-radius:6px;cursor:pointer;font-size:13px';
    document.body.appendChild(btn);

    const menu = document.createElement('div');
    menu.id = 'v282-lang-menu';
    menu.style.cssText = 'display:none;position:fixed;top:48px;right:64px;z-index:9999;background:#0f172a;border:1px solid #334155;border-radius:8px;padding:6px;box-shadow:0 12px 30px rgba(0,0,0,0.4);min-width:160px';
    LANGS.forEach(l => {
      const item = document.createElement('div');
      item.textContent = l.label + (l.code === cur ? ' ✓' : '');
      item.dataset.code = l.code;
      item.style.cssText = 'padding:8px 10px;cursor:pointer;border-radius:4px;color:#cbd5e1;font-size:13px';
      item.addEventListener('mouseenter', () => item.style.background = 'rgba(168,85,247,0.15)');
      item.addEventListener('mouseleave', () => item.style.background = 'transparent');
      item.addEventListener('click', async () => {
        menu.style.display = 'none';
        const code = item.dataset.code;
        try { localStorage.setItem(KEY, code); } catch {}
        btn.textContent = l.label;
        if (code === 'zh-TW') { location.reload(); return; } // back to native
        // Show overlay
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:99999;display:flex;align-items:center;justify-content:center;color:#fff;font-size:16px';
        ov.innerHTML = '<div style="background:#0f172a;padding:24px;border-radius:12px;text-align:center;max-width:400px"><div style="font-size:28px">🌐</div><div style="margin:8px 0">AI 翻譯中（' + l.label + '）...</div><div style="color:#94a3b8;font-size:12px">用 Llama 3.3 70B 翻譯整個介面 · ~10 秒</div></div>';
        document.body.appendChild(ov);
        try {
          // Collect visible text from sections
          const targets = Array.from(document.querySelectorAll('.section-title, .section h2, .section h3, [class*=section] strong, [class*=section] label'));
          const texts = targets.map(el => el.textContent.trim()).filter(t => t && t.length < 100);
          const unique = Array.from(new Set(texts));
          if (unique.length === 0) { ov.remove(); return; }
          // Batch translate via Worker /translate
          const r = await fetch(W + '/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ texts: unique, target: code })
          });
          if (!r.ok) throw new Error('translate ' + r.status);
          const j = await r.json();
          const map = j.translations || {};
          targets.forEach(el => {
            const orig = el.textContent.trim();
            if (map[orig]) el.textContent = map[orig];
          });
          ov.querySelector('div > div:nth-child(2)').textContent = '✅ 翻譯完成（' + Object.keys(map).length + ' 處）';
          setTimeout(() => ov.remove(), 1500);
        } catch (e) {
          ov.querySelector('div > div:nth-child(2)').innerHTML = '❌ ' + (e.message || e) + '<br><br>（Worker /translate 端點需 deploy v282 patch）';
          setTimeout(() => ov.remove(), 3000);
        }
      });
      menu.appendChild(item);
    });
    document.body.appendChild(menu);
    btn.addEventListener('click', () => {
      menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', e => {
      if (e.target !== btn && !menu.contains(e.target)) menu.style.display = 'none';
    });
  }

  // ==============================================================
  // FEATURE 2 — AI 個股觀點文章生成（v306）
  // ==============================================================
  function buildArticleGen(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:#94a3b8;margin-bottom:8px">📝 AI 觀點文章生成 — Llama 3.3 70B 為任何股票寫 1500 字 Seeking Alpha 級分析</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:10px"><input id="ag-sym" placeholder="代號 (例: 2330, AAPL, NVDA)" value="2330" style="flex:1;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px">' +
      '<select id="ag-style" style="padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px"><option value="bull">🐂 多頭觀點</option><option value="bear">🐻 空頭觀點</option><option value="balanced">⚖️ 平衡分析</option><option value="contrarian">🔄 反向思考</option></select>' +
      '<button id="ag-go" style="padding:6px 14px;background:#dc2626;border:0;color:#fff;border-radius:4px;cursor:pointer">生成 1500 字</button></div>' +
      '<div id="ag-result"></div></div>';
    $('ag-go').addEventListener('click', async () => {
      const sym = $('ag-sym').value.trim();
      const style = $('ag-style').value;
      $('ag-result').innerHTML = '<div style="color:#94a3b8;padding:14px">⏳ Llama 70B 撰寫中（~30 秒）...</div>';
      try {
        const r = await fetch(W + '/article', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol: sym, style })
        });
        if (!r.ok) throw new Error('article ' + r.status);
        const j = await r.json();
        if (j.error) throw new Error(j.error);
        const styleMap = { bull: '🐂 多頭', bear: '🐻 空頭', balanced: '⚖️ 平衡', contrarian: '🔄 反向' };
        $('ag-result').innerHTML = '<article style="background:rgba(220,38,38,0.05);border:1px solid rgba(220,38,38,0.3);border-radius:6px;padding:20px;font-size:14px;line-height:1.8">' +
          '<header style="display:flex;justify-content:space-between;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid #334155">' +
          '<h3 style="margin:0;font-size:18px;color:#fff">' + sym + ' — ' + styleMap[style] + '觀點</h3>' +
          '<span style="color:#94a3b8;font-size:11px">🤖 Llama 3.3 70B · ' + new Date().toLocaleString() + '</span></header>' +
          '<div style="color:#cbd5e1;white-space:pre-wrap">' + (j.article || '').replace(/</g, '&lt;') + '</div>' +
          '<footer style="margin-top:14px;padding-top:10px;border-top:1px solid #334155;color:#64748b;font-size:11px">⚠️ 此文由 AI 生成，僅供參考。投資有風險，請自行判斷。' + (j.tokenCount ? ' · ' + j.tokenCount + ' tokens' : '') + '</footer>' +
          '</article>';
      } catch (e) {
        $('ag-result').innerHTML = '<div style="color:#dc2626;padding:14px">❌ ' + (e.message || e) + '<br><br>（需 Worker /article 端點 — deploy v282 patch）</div>';
      }
    });
  }

  // ==============================================================
  // FEATURE 3 — AI 市場異常偵測（v307）
  // ==============================================================
  function buildAnomalyDetector(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:#94a3b8;margin-bottom:8px">🚨 AI 市場異常偵測 — 每日掃描 2125 檔 / 770k 筆，找突破 / 爆量 / 反轉訊號</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:10px"><button id="ad-go" style="padding:8px 16px;background:#ea580c;border:0;color:#fff;border-radius:4px;cursor:pointer;font-weight:700">執行今日掃描</button></div>' +
      '<div id="ad-result"></div></div>';

    $('ad-go').addEventListener('click', async () => {
      $('ad-result').innerHTML = '<div style="color:#94a3b8;padding:10px">⏳ 掃描所有股票...</div>';
      try {
        // Get last 2 days of all stocks
        const today = new Date();
        const since = new Date(today - 30 * 24 * 3600e3).toISOString().slice(0, 10);
        const r = await fetch(SB_URL + '/rest/v1/daily_prices?date=gte.' + since +
          '&select=symbol,date,close_price,open_price,high_price,low_price,volume&order=symbol.asc,date.asc&limit=15000', { headers: SB_H });
        const data = await r.json();
        // Group by symbol
        const groups = new Map();
        data.forEach(d => {
          if (!groups.has(d.symbol)) groups.set(d.symbol, []);
          groups.get(d.symbol).push(d);
        });
        // Detect anomalies
        const anomalies = [];
        groups.forEach((arr, sym) => {
          if (arr.length < 10) return;
          const last = arr[arr.length - 1];
          const prev = arr[arr.length - 2];
          if (!last || !prev) return;
          const closes = arr.map(x => x.close_price);
          const vols = arr.map(x => x.volume || 0);
          const mean = closes.reduce((s,x)=>s+x,0)/closes.length;
          const variance = closes.reduce((s,x)=>s+(x-mean)**2,0)/closes.length;
          const std = Math.sqrt(variance);
          const dailyRet = ((last.close_price - prev.close_price) / prev.close_price) * 100;
          const high = Math.max.apply(null, closes.slice(0, -1));
          const low = Math.min.apply(null, closes.slice(0, -1));
          const meanVol = vols.slice(0, -1).reduce((s,x)=>s+x,0)/(vols.length-1);
          const volRatio = meanVol > 0 ? last.volume / meanVol : 0;
          const flags = [];
          if (Math.abs(dailyRet) >= 5) flags.push({ icon: dailyRet > 0 ? '🚀' : '💥', label: (dailyRet > 0 ? '單日大漲' : '單日大跌') + ' ' + dailyRet.toFixed(1) + '%', score: Math.abs(dailyRet) });
          if (last.close_price > high && last.close_price > 0) flags.push({ icon: '📈', label: '創 30 日新高', score: 5 });
          if (last.close_price < low && last.close_price > 0) flags.push({ icon: '📉', label: '創 30 日新低', score: 5 });
          if (volRatio >= 3) flags.push({ icon: '🔊', label: '爆量 ' + volRatio.toFixed(1) + 'x', score: volRatio });
          // 3 sigma daily
          const lastZ = std > 0 ? Math.abs(last.close_price - mean) / std : 0;
          if (lastZ >= 2.5) flags.push({ icon: '⚡', label: lastZ.toFixed(1) + 'σ 異常', score: lastZ });
          if (flags.length >= 1) {
            const totalScore = flags.reduce((s,f)=>s+f.score,0);
            anomalies.push({ sym, last, dailyRet, flags, totalScore });
          }
        });
        anomalies.sort((a, b) => b.totalScore - a.totalScore);
        const top = anomalies.slice(0, 30);
        if (top.length === 0) {
          $('ad-result').innerHTML = '<div style="padding:10px;color:#34d399">✅ 今日市場平靜，無重大異常事件</div>';
          return;
        }
        let html = '<div style="background:rgba(234,88,12,0.05);border:1px solid rgba(234,88,12,0.3);border-radius:6px;padding:12px"><div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:8px">🚨 偵測到 ' + anomalies.length + ' 個異常事件（顯示 Top 30）</div>' +
          '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="border-bottom:1px solid #334155;color:#94a3b8"><th style="padding:6px;text-align:left">代號</th><th style="text-align:right">收盤</th><th style="text-align:right">漲跌%</th><th style="text-align:left">異常旗標</th><th style="text-align:right">成交</th></tr></thead><tbody>';
        top.forEach(a => {
          html += '<tr style="border-bottom:1px solid #1e293b;cursor:pointer" data-sym="' + a.sym + '">' +
            '<td style="padding:6px;font-weight:700">' + a.sym + '</td>' +
            '<td style="text-align:right">' + fmt(a.last.close_price, 2) + '</td>' +
            '<td style="text-align:right;color:' + (a.dailyRet >= 0 ? '#34d399' : '#f87171') + '">' + (a.dailyRet >= 0 ? '+' : '') + a.dailyRet.toFixed(2) + '%</td>' +
            '<td>' + a.flags.map(f => '<span style="display:inline-block;background:rgba(234,88,12,0.15);border-radius:4px;padding:2px 6px;margin:1px;font-size:11px">' + f.icon + ' ' + f.label + '</span>').join(' ') + '</td>' +
            '<td style="text-align:right">' + fmtBig(a.last.volume) + '</td></tr>';
        });
        html += '</tbody></table>' +
          '<div style="margin-top:10px;padding:8px;background:rgba(96,165,250,0.05);border-radius:4px;font-size:11px;color:#94a3b8">💡 點擊任何一行可查詢個股深度。掃描範圍: 過去 30 天 vs 今日。</div></div>';
        $('ad-result').innerHTML = html;
        $('ad-result').querySelectorAll('tr[data-sym]').forEach(tr => {
          tr.addEventListener('click', () => {
            const inp = document.querySelector('#stockSearch, #twStockInput, #stockInput');
            if (inp) { inp.value = tr.dataset.sym; inp.dispatchEvent(new Event('input', { bubbles: true })); }
            if (typeof window.searchStock === 'function') window.searchStock(tr.dataset.sym);
          });
        });
      } catch (e) {
        $('ad-result').innerHTML = '❌ ' + e.message;
      }
    });
  }

  // ==============================================================
  // FEATURE 4 — AI 投資對話夥伴（v308）
  // ==============================================================
  function buildMentorChat(containerId) {
    const c = $(containerId);
    if (!c) return;
    const MENTORS = [
      { id: 'buffett', name: 'Warren Buffett 巴菲特', desc: '價值投資、長期持有、護城河', icon: '🎩' },
      { id: 'soros', name: 'George Soros 索羅斯', desc: '反身性、宏觀對沖、危機是機會', icon: '📊' },
      { id: 'son', name: '孫正義 SoftBank', desc: '科技遠見、AI 趨勢、Blitzscale', icon: '🚀' },
      { id: 'lin', name: '林園 投資達人', desc: '台股深度、產業循環、持有信仰', icon: '🇹🇼' },
      { id: 'munger', name: 'Charlie Munger 蒙格', desc: '多元思維、心智模型、避免愚蠢', icon: '🧠' },
      { id: 'dalio', name: 'Ray Dalio 達里歐', desc: 'All Weather、原則、橋水', icon: '🌉' }
    ];
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:#94a3b8;margin-bottom:8px">💬 投資導師對話 — 6 位世界頂級投資人 AI 角色扮演（Llama 3.3 70B）</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;margin-bottom:10px">' +
      MENTORS.map(m => '<div class="mt-card" data-id="' + m.id + '" style="background:#0a0f1c;border:1px solid #334155;border-radius:6px;padding:10px;cursor:pointer;transition:all 0.15s"><div style="font-size:20px">' + m.icon + '</div><div style="font-weight:700;color:#fff;font-size:13px">' + m.name + '</div><div style="color:#94a3b8;font-size:11px;margin-top:2px">' + m.desc + '</div></div>').join('') +
      '</div>' +
      '<div id="mt-chat" style="display:none;background:#0a0f1c;border:1px solid #334155;border-radius:8px;padding:12px;margin-bottom:10px">' +
      '<div id="mt-history" style="max-height:400px;overflow:auto;margin-bottom:10px"></div>' +
      '<div style="display:flex;gap:6px"><input id="mt-input" placeholder="問導師任何投資問題..." style="flex:1;padding:8px;background:#0f172a;border:1px solid #475569;color:#fff;border-radius:4px">' +
      '<button id="mt-send" style="padding:8px 14px;background:#16a34a;border:0;color:#fff;border-radius:4px;cursor:pointer">送出</button></div></div>' +
      '<div id="mt-info" style="color:#94a3b8;font-size:12px;padding:6px">點選一位導師開始對話</div></div>';

    let curMentor = null;
    const history = [];
    function renderHistory() {
      const h = $('mt-history');
      h.innerHTML = history.map(m => {
        if (m.role === 'user') {
          return '<div style="display:flex;justify-content:flex-end;margin:6px 0"><div style="background:rgba(96,165,250,0.15);border-radius:8px;padding:8px 12px;max-width:75%;color:#fff">' + m.content.replace(/</g, '&lt;') + '</div></div>';
        } else {
          return '<div style="display:flex;margin:6px 0"><div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.25);border-radius:8px;padding:8px 12px;max-width:80%;color:#cbd5e1;line-height:1.6;white-space:pre-wrap">' + m.content.replace(/</g, '&lt;') + '</div></div>';
        }
      }).join('');
      h.scrollTop = h.scrollHeight;
    }

    c.querySelectorAll('.mt-card').forEach(card => {
      card.addEventListener('mouseenter', () => card.style.transform = 'translateY(-2px)');
      card.addEventListener('mouseleave', () => card.style.transform = '');
      card.addEventListener('click', () => {
        c.querySelectorAll('.mt-card').forEach(x => x.style.borderColor = '#334155');
        card.style.borderColor = '#34d399';
        curMentor = MENTORS.find(m => m.id === card.dataset.id);
        $('mt-chat').style.display = 'block';
        $('mt-info').textContent = '與「' + curMentor.name + '」對話中';
        history.length = 0;
        history.push({ role: 'assistant', content: curMentor.icon + ' 你好，我是 ' + curMentor.name + '。我擅長：' + curMentor.desc + '。請問有什麼投資問題我可以幫你？' });
        renderHistory();
      });
    });

    async function send() {
      if (!curMentor) return;
      const text = $('mt-input').value.trim();
      if (!text) return;
      history.push({ role: 'user', content: text });
      $('mt-input').value = '';
      renderHistory();
      history.push({ role: 'assistant', content: '⏳ 思考中...' });
      renderHistory();
      try {
        const r = await fetch(W + '/coach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mentor: curMentor.id, mentor_name: curMentor.name, history: history.slice(0, -1) })
        });
        const j = await r.json();
        history.pop();
        history.push({ role: 'assistant', content: j.reply || '❌ 無回應' });
        renderHistory();
      } catch (e) {
        history.pop();
        history.push({ role: 'assistant', content: '❌ ' + e.message + '（需 Worker /coach endpoint）' });
        renderHistory();
      }
    }
    $('mt-send').addEventListener('click', send);
    $('mt-input').addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
  }

  // ==============================================================
  // FEATURE 5 — 目標導向投資規劃器（v309）— Wealthfront 等級
  // ==============================================================
  function buildGoalPlanner(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:#94a3b8;margin-bottom:8px">🎯 目標導向投資規劃器 — 退休 / 買房 / 子女教育，5 條情境路徑模擬</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;margin-bottom:10px;font-size:12px">' +
      '<label>目標<select id="gp-goal" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"><option value="退休">🏖️ 退休</option><option value="買房頭款">🏠 買房頭款</option><option value="子女教育">🎓 子女教育</option><option value="財富自由">💰 財富自由</option><option value="緊急金">🛡️ 緊急金</option></select></label>' +
      '<label>目標金額<input type="number" id="gp-target" value="50000000" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label>目前年齡<input type="number" id="gp-age" value="30" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label>目標年齡<input type="number" id="gp-target-age" value="60" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label>目前資產<input type="number" id="gp-cur" value="500000" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '<label>每月可投入<input type="number" id="gp-monthly" value="20000" style="width:100%;padding:6px;background:#0f172a;border:1px solid #334155;color:#fff;border-radius:4px;margin-top:4px"></label>' +
      '</div><button id="gp-go" style="width:100%;padding:10px;background:#16a34a;border:0;color:#fff;border-radius:6px;font-weight:700;cursor:pointer">計算 5 種情境路徑</button>' +
      '<div id="gp-result" style="margin-top:10px"></div></div>';

    function fv(P, PMT, r, n) {
      // P = present value, PMT = monthly contribution, r = monthly rate, n = months
      return P * Math.pow(1 + r, n) + PMT * ((Math.pow(1 + r, n) - 1) / r);
    }

    $('gp-go').addEventListener('click', () => {
      const goal = $('gp-goal').value;
      const target = parseFloat($('gp-target').value);
      const age = parseFloat($('gp-age').value);
      const targetAge = parseFloat($('gp-target-age').value);
      const cur = parseFloat($('gp-cur').value);
      const monthly = parseFloat($('gp-monthly').value);
      const months = (targetAge - age) * 12;
      if (months <= 0) { $('gp-result').innerHTML = '<div style="color:#fbbf24">⚠️ 目標年齡需大於目前年齡</div>'; return; }
      const SCENARIOS = [
        { name: '保守（債券 + 高股息）', annRet: 0.04, color: '#94a3b8' },
        { name: '穩健（60/40 股債）', annRet: 0.06, color: '#60a5fa' },
        { name: '平衡（80/20 股債）', annRet: 0.08, color: '#34d399' },
        { name: '積極（全股票指數）', annRet: 0.10, color: '#fbbf24' },
        { name: '激進（科技+小型股）', annRet: 0.13, color: '#f87171' }
      ];
      const results = SCENARIOS.map(s => {
        const r = s.annRet / 12;
        const final = fv(cur, monthly, r, months);
        const gap = final - target;
        const reqMonthly = (target - cur * Math.pow(1 + r, months)) * r / (Math.pow(1 + r, months) - 1);
        return { ...s, final, gap, reqMonthly };
      });
      const totalIn = cur + monthly * months;
      let html = '<div style="background:rgba(22,163,74,0.05);border:1px solid rgba(22,163,74,0.3);border-radius:6px;padding:12px;margin-bottom:10px">' +
        '<div style="font-size:14px;color:#fff;margin-bottom:6px"><strong>目標：' + goal + ' $' + fmtBig(target) + ' / ' + (targetAge - age) + ' 年（' + targetAge + ' 歲）</strong></div>' +
        '<div style="font-size:12px;color:#94a3b8">起點 $' + fmtBig(cur) + ' · 每月 $' + fmtBig(monthly) + ' · 總投入 $' + fmtBig(totalIn) + '</div>' +
        '</div>';
      // SVG visualization
      const W = 800, H = 280;
      let maxV = Math.max(target, Math.max.apply(null, results.map(r => r.final)));
      let svg = '<svg width="100%" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" style="background:#0a0f1c;border-radius:6px">';
      // Target line
      const tY = H - (target / maxV) * (H - 30) - 15;
      svg += '<line x1="0" y1="' + tY + '" x2="' + W + '" y2="' + tY + '" stroke="#fbbf24" stroke-width="2" stroke-dasharray="6,4"/>';
      svg += '<text x="' + (W - 8) + '" y="' + (tY - 4) + '" text-anchor="end" fill="#fbbf24" font-size="11">🎯 目標 $' + fmtBig(target) + '</text>';
      // Each scenario path
      SCENARIOS.forEach((s, idx) => {
        const r = s.annRet / 12;
        const path = [];
        for (let m = 0; m <= months; m += Math.max(1, Math.floor(months / 60))) {
          const v = fv(cur, monthly, r, m);
          const x = (m / months) * W;
          const y = H - (v / maxV) * (H - 30) - 15;
          path.push((m === 0 ? 'M' : 'L') + x.toFixed(1) + ',' + y.toFixed(1));
        }
        svg += '<path d="' + path.join('') + '" stroke="' + s.color + '" stroke-width="2" fill="none" opacity="0.85"/>';
      });
      svg += '</svg>';
      html += svg;
      // Table
      html += '<table style="width:100%;border-collapse:collapse;font-size:12px;margin-top:10px"><thead><tr style="border-bottom:1px solid #334155;color:#94a3b8">' +
        '<th style="padding:8px;text-align:left">情境</th><th style="text-align:right">年化</th><th style="text-align:right">最終資產</th><th style="text-align:right">vs 目標</th><th style="text-align:right">需每月</th></tr></thead><tbody>';
      results.forEach(r => {
        const meet = r.final >= target;
        html += '<tr style="border-bottom:1px solid #1e293b">' +
          '<td style="padding:8px;color:' + r.color + ';font-weight:700">' + r.name + '</td>' +
          '<td style="text-align:right">' + (r.annRet * 100).toFixed(1) + '%</td>' +
          '<td style="text-align:right;font-weight:700">$' + fmtBig(r.final) + '</td>' +
          '<td style="text-align:right;color:' + (meet ? '#34d399' : '#f87171') + ';font-weight:700">' + (meet ? '✓ +' : '✗ ') + fmtBig(r.gap) + '</td>' +
          '<td style="text-align:right">$' + fmtBig(Math.max(0, r.reqMonthly)) + '</td></tr>';
      });
      html += '</tbody></table>' +
        '<div style="margin-top:10px;padding:8px;background:rgba(96,165,250,0.05);border-radius:4px;font-size:11px;color:#94a3b8;line-height:1.6">💡 「需每月」 = 達成目標的最低每月投入。建議：年輕（30+）配置可較積極，接近目標年齡時轉穩健。</div>';
      $('gp-result').innerHTML = html;
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
    // Lang switcher is global (not in any tab)
    buildLangSwitcher();
    injectSection('tab-tools', 'v306-article', '📝 AI 個股觀點文章生成', buildArticleGen);
    injectSection('tab-tw', 'v307-anomaly', '🚨 AI 市場異常偵測（每日掃描）', buildAnomalyDetector);
    injectSection('tab-tools', 'v308-mentor', '💬 AI 投資導師對話（6 位世界級）', buildMentorChat);
    injectSection('tab-portfolio', 'v309-goal', '🎯 目標導向投資規劃器', buildGoalPlanner);
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

  window.v282 = {
    version: VERSION,
    rebuild: buildAll,
    article: buildArticleGen,
    anomaly: buildAnomalyDetector,
    mentor: buildMentorChat,
    goal: buildGoalPlanner
  };
  console.log('[' + VERSION + '] 5 AI Native features loaded');
})();
