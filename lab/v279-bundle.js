/**
 * MoneyRadar v279 Bundle — 最後 3 件可行 features
 * 1. StockTwits 社群情緒 (P2#16) — 純 client-side
 * 2. Option Chain (P0#2) — 需 Worker /options endpoint
 * 3. Earnings Call AI 摘要 (P1#9) — 需 Worker /earnings endpoint
 */
(function() {
  'use strict';
  const VERSION = 'v279-bundle';
  const W = 'https://moneyradar-ai-proxy.thinkbigtw.workers.dev';

  function $(id) { return document.getElementById(id); }
  function fmt(n, d) {
    if (n == null || isNaN(n)) return '-';
    if (Math.abs(n) >= 1e6) return (n/1e6).toFixed(d||1) + 'M';
    if (Math.abs(n) >= 1e3) return (n/1e3).toFixed(d||1) + 'K';
    return n.toFixed(d||2);
  }

  // ==============================================================
  // FEATURE 1 — StockTwits 社群情緒 (v294)
  // 公開 API: https://api.stocktwits.com/api/2/streams/symbol/{symbol}.json
  // 不需 auth，CORS friendly
  // ==============================================================
  async function buildStockTwits(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">💬 StockTwits 社群情緒（美股 / 加密）— 全球散戶討論熱度</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:10px"><input id="st-sym" value="TSLA" placeholder="美股代號 (例: AAPL, NVDA, TSLA, BTC.X, ETH.X)" style="flex:1;padding:6px;background:var(--bg-base);border:1px solid var(--border-strong);color:#fff;border-radius:4px">' +
      '<button id="st-go" style="padding:6px 14px;background:var(--accent);border:0;color:#fff;border-radius:4px;cursor:pointer">查情緒</button></div>' +
      '<div id="st-result"></div></div>';
    $('st-go').addEventListener('click', async () => {
      const sym = $('st-sym').value.trim().toUpperCase();
      if (!sym) return;
      $('st-result').innerHTML = '<div style="color:var(--text-secondary);padding:10px">⏳ 抓 StockTwits 社群討論中...</div>';
      try {
        const r = await fetch('https://api.stocktwits.com/api/2/streams/symbol/' + encodeURIComponent(sym) + '.json');
        if (!r.ok) throw new Error('StockTwits API ' + r.status);
        const j = await r.json();
        const msgs = j.messages || [];
        if (msgs.length === 0) { $('st-result').innerHTML = '<div style="padding:10px">⚠️ 無留言'; return; }
        let bull = 0, bear = 0, neutral = 0;
        msgs.forEach(m => {
          const sent = m.entities && m.entities.sentiment && m.entities.sentiment.basic;
          if (sent === 'Bullish') bull++;
          else if (sent === 'Bearish') bear++;
          else neutral++;
        });
        const total = msgs.length;
        const bullPct = (bull / total) * 100;
        const bearPct = (bear / total) * 100;
        const score = bull > bear ? 'BULLISH' : bear > bull ? 'BEARISH' : 'NEUTRAL';
        const color = score === 'BULLISH' ? '#34d399' : score === 'BEARISH' ? '#f87171' : 'var(--text-secondary)';
        let html = '<div style="background:rgba(96,165,250,0.05);border:1px solid rgba(96,165,250,0.3);border-radius:6px;padding:10px;margin-bottom:10px">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
          '<span style="font-weight:700;color:#fff;font-size:16px">' + sym + ' 社群情緒</span>' +
          '<span style="color:' + color + ';font-weight:700;font-size:18px">' + score + '</span></div>' +
          '<div style="display:flex;height:24px;border-radius:4px;overflow:hidden;background:var(--bg-elevated)">' +
          '<div style="background:#34d399;width:' + bullPct + '%" title="多方 ' + bull + '"></div>' +
          '<div style="background:var(--text-secondary);width:' + ((neutral/total)*100) + '%" title="中性 ' + neutral + '"></div>' +
          '<div style="background:#f87171;width:' + bearPct + '%" title="空方 ' + bear + '"></div></div>' +
          '<div style="display:flex;justify-content:space-between;font-size:12px;margin-top:6px">' +
          '<span style="color:#34d399">🐂 多 ' + bull + ' (' + bullPct.toFixed(0) + '%)</span>' +
          '<span style="color:var(--text-secondary)">⚪ 中 ' + neutral + '</span>' +
          '<span style="color:#f87171">🐻 空 ' + bear + ' (' + bearPct.toFixed(0) + '%)</span></div>' +
          '<div style="margin-top:8px;font-size:11px;color:var(--text-secondary)">樣本: 最新 ' + total + ' 則留言</div></div>';

        // Top messages
        html += '<div style="font-size:13px;color:var(--text-secondary);margin-bottom:6px">📝 最新 5 則熱門留言</div>';
        msgs.slice(0, 5).forEach(m => {
          const sent = m.entities?.sentiment?.basic;
          const sentColor = sent === 'Bullish' ? '#34d399' : sent === 'Bearish' ? '#f87171' : 'var(--text-secondary)';
          const sentIcon = sent === 'Bullish' ? '🐂' : sent === 'Bearish' ? '🐻' : '⚪';
          const text = (m.body || '').slice(0, 200);
          const time = new Date(m.created_at).toLocaleString();
          const user = m.user?.username || 'anon';
          html += '<div style="background:var(--bg-base);border:1px solid var(--bg-elevated);border-left:3px solid ' + sentColor + ';border-radius:4px;padding:8px;margin-bottom:6px;font-size:12px">' +
            '<div style="display:flex;justify-content:space-between;color:var(--text-secondary);font-size:11px;margin-bottom:4px">' +
            '<span>' + sentIcon + ' @' + user + (sent ? ' · ' + sent : '') + '</span>' +
            '<span>' + time + '</span></div>' +
            '<div style="color:#cbd5e1;line-height:1.5">' + text.replace(/</g, '&lt;') + '</div></div>';
        });
        $('st-result').innerHTML = html;
      } catch (e) {
        $('st-result').innerHTML = '<div style="padding:10px;color:#dc2626">❌ ' + (e.message || e) + '</div>';
      }
    });
  }

  // ==============================================================
  // FEATURE 2 — Option Chain (v295)
  // 透過 Worker /options endpoint 抓 Yahoo Finance options
  // ==============================================================
  async function buildOptionChain(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">📋 期權鏈（美股）— 透過 Worker proxy 抓 Yahoo Finance options</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:10px"><input id="oc-sym" value="AAPL" placeholder="美股代號 (例: AAPL, TSLA, NVDA)" style="flex:1;padding:6px;background:var(--bg-base);border:1px solid var(--border-strong);color:#fff;border-radius:4px">' +
      '<button id="oc-go" style="padding:6px 14px;background:#7c3aed;border:0;color:#fff;border-radius:4px;cursor:pointer">查期權鏈</button></div>' +
      '<div id="oc-result"></div></div>';
    $('oc-go').addEventListener('click', async () => {
      const sym = $('oc-sym').value.trim().toUpperCase();
      if (!sym) return;
      $('oc-result').innerHTML = '<div style="color:var(--text-secondary);padding:10px">⏳ 抓期權鏈資料...</div>';
      try {
        const r = await fetch(W + '/options?symbol=' + encodeURIComponent(sym));
        if (!r.ok) throw new Error('Worker /options ' + r.status);
        const j = await r.json();
        if (!j.calls || !j.puts) {
          $('oc-result').innerHTML = '<div style="color:#fbbf24;padding:10px">⚠️ ' + (j.error || '此標的無期權資料（Worker 端可能還沒 deploy /options endpoint，請看 Phase B 部署指南）') + '</div>';
          return;
        }
        const expiry = j.expirationDate ? new Date(j.expirationDate * 1000).toISOString().slice(0, 10) : '-';
        const underlying = j.underlyingPrice || '-';
        let html = '<div style="display:flex;justify-content:space-between;margin-bottom:8px;font-size:13px"><span style="color:var(--text-secondary)">標的價: <strong style="color:#fff">$' + underlying + '</strong></span><span style="color:var(--text-secondary)">到期日: <strong style="color:#fff">' + expiry + '</strong></span><span style="color:var(--text-secondary)">合約數: <strong style="color:#fff">' + (j.calls.length + j.puts.length) + '</strong></span></div>';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
        // Calls
        html += '<div><div style="font-weight:700;color:#34d399;margin-bottom:4px">📈 Calls (買權)</div>' +
          '<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="border-bottom:1px solid var(--border-strong);color:var(--text-secondary)"><th style="padding:4px;text-align:right">Strike</th><th style="text-align:right">Last</th><th style="text-align:right">Bid</th><th style="text-align:right">Ask</th><th style="text-align:right">OI</th></tr></thead><tbody>';
        j.calls.slice(0, 15).forEach(c => {
          const itm = c.strike < underlying;
          html += '<tr style="border-bottom:1px solid var(--bg-elevated)' + (itm ? ';background:rgba(52,211,153,0.05)' : '') + '">' +
            '<td style="padding:4px;text-align:right' + (itm ? ';color:#34d399;font-weight:600' : '') + '">' + c.strike + '</td>' +
            '<td style="text-align:right">' + (c.lastPrice || '-') + '</td>' +
            '<td style="text-align:right">' + (c.bid || '-') + '</td>' +
            '<td style="text-align:right">' + (c.ask || '-') + '</td>' +
            '<td style="text-align:right">' + fmt(c.openInterest || 0) + '</td></tr>';
        });
        html += '</tbody></table></div>';
        // Puts
        html += '<div><div style="font-weight:700;color:#f87171;margin-bottom:4px">📉 Puts (賣權)</div>' +
          '<table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr style="border-bottom:1px solid var(--border-strong);color:var(--text-secondary)"><th style="padding:4px;text-align:right">Strike</th><th style="text-align:right">Last</th><th style="text-align:right">Bid</th><th style="text-align:right">Ask</th><th style="text-align:right">OI</th></tr></thead><tbody>';
        j.puts.slice(0, 15).forEach(p => {
          const itm = p.strike > underlying;
          html += '<tr style="border-bottom:1px solid var(--bg-elevated)' + (itm ? ';background:rgba(248,113,113,0.05)' : '') + '">' +
            '<td style="padding:4px;text-align:right' + (itm ? ';color:#f87171;font-weight:600' : '') + '">' + p.strike + '</td>' +
            '<td style="text-align:right">' + (p.lastPrice || '-') + '</td>' +
            '<td style="text-align:right">' + (p.bid || '-') + '</td>' +
            '<td style="text-align:right">' + (p.ask || '-') + '</td>' +
            '<td style="text-align:right">' + fmt(p.openInterest || 0) + '</td></tr>';
        });
        html += '</tbody></table></div></div>';
        html += '<div style="margin-top:10px;padding:8px;background:rgba(96,165,250,0.05);border:1px solid rgba(96,165,250,0.2);border-radius:4px;font-size:11px;color:var(--text-secondary)">💡 ITM (價內) 行權價以淡綠/紅底標示。OI = 未平倉量，反映市場關注度。</div>';
        $('oc-result').innerHTML = html;
      } catch (e) {
        $('oc-result').innerHTML = '<div style="padding:10px;color:#dc2626">❌ ' + (e.message || e) + '</div>';
      }
    });
  }

  // ==============================================================
  // FEATURE 3 — Earnings Call AI 摘要 (v296)
  // 透過 Worker /earnings endpoint，Llama 3.3 70B 摘要 SEC 8-K
  // ==============================================================
  async function buildEarningsAI(containerId) {
    const c = $(containerId);
    if (!c) return;
    c.innerHTML = '<div style="padding:8px"><div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px">📊 Earnings Call AI 摘要（美股）— Llama 3.3 70B 解讀 SEC 8-K filing</div>' +
      '<div style="display:flex;gap:6px;margin-bottom:10px"><input id="ea-sym" value="AAPL" placeholder="美股代號 (例: AAPL, NVDA, TSLA)" style="flex:1;padding:6px;background:var(--bg-base);border:1px solid var(--border-strong);color:#fff;border-radius:4px">' +
      '<button id="ea-go" style="padding:6px 14px;background:#dc2626;border:0;color:#fff;border-radius:4px;cursor:pointer">AI 摘要</button></div>' +
      '<div id="ea-result"></div></div>';
    $('ea-go').addEventListener('click', async () => {
      const sym = $('ea-sym').value.trim().toUpperCase();
      if (!sym) return;
      $('ea-result').innerHTML = '<div style="color:var(--text-secondary);padding:10px">⏳ 抓最新 8-K filing 並做 AI 摘要（~15 秒）...</div>';
      try {
        const r = await fetch(W + '/earnings?symbol=' + encodeURIComponent(sym));
        if (!r.ok) throw new Error('Worker /earnings ' + r.status);
        const j = await r.json();
        if (j.error) {
          $('ea-result').innerHTML = '<div style="color:#fbbf24;padding:10px">⚠️ ' + j.error + '（Worker 端可能還沒 deploy /earnings endpoint，請看部署指南）</div>';
          return;
        }
        const summary = j.summary || j.aiSummary || '無 AI 摘要';
        const filingDate = j.filingDate || '-';
        const sourceUrl = j.sourceUrl || '#';
        let html = '<div style="background:rgba(220,38,38,0.05);border:1px solid rgba(220,38,38,0.3);border-radius:6px;padding:12px;margin-bottom:10px">' +
          '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:8px"><span style="color:var(--text-secondary)">' + sym + ' 最新 8-K</span><span style="color:var(--text-secondary)">' + filingDate + '</span></div>' +
          '<div style="font-weight:700;color:#fff;margin-bottom:8px">🤖 AI 摘要（Llama 3.3 70B）</div>' +
          '<div style="color:#cbd5e1;line-height:1.7;white-space:pre-wrap;font-size:13px">' + summary.replace(/</g, '&lt;') + '</div>' +
          '<div style="margin-top:10px"><a href="' + sourceUrl + '" target="_blank" rel="noopener" style="color:#60a5fa;font-size:11px">🔗 查看原始 SEC filing →</a></div>' +
          '</div>';
        $('ea-result').innerHTML = html;
      } catch (e) {
        $('ea-result').innerHTML = '<div style="padding:10px;color:#dc2626">❌ ' + (e.message || e) + '</div>';
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
    injectSection('tab-us', 'v294-stocktwits', '💬 StockTwits 社群情緒', buildStockTwits);
    injectSection('tab-crypto', 'v294-stocktwits-c', '💬 加密貨幣社群情緒', buildStockTwits);
    injectSection('tab-us', 'v295-options', '📋 美股期權鏈', buildOptionChain);
    injectSection('tab-us', 'v296-earnings-ai', '🤖 Earnings AI 摘要', buildEarningsAI);
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

  window.v279 = {
    version: VERSION,
    rebuild: buildAll,
    stocktwits: buildStockTwits,
    options: buildOptionChain,
    earnings: buildEarningsAI
  };
  console.log('[' + VERSION + '] 3 features loaded');
})();
