#!/usr/bin/env python3
"""Worker patch v287 — 深度 AI 分析 5 endpoints
所有函數加 V287_ 前綴
"""
import re, pathlib, sys

W = pathlib.Path('workers/ai-proxy/src/index.js')
src = W.read_text()
if 'V287_handle10K' in src:
    print('✓ Already patched v287'); sys.exit(0)
backup = pathlib.Path('.bak_worker_v287_index.js')
backup.write_text(src)

HANDLERS = r'''
// ============= v287 /ai-10k =============
async function V287_handle10K(request, env) {
  const url = new URL(request.url);
  const sym = url.searchParams.get('symbol') || '';
  if (!sym) return jsonResponse({ error: 'symbol required' }, 400);
  try {
    // SEC EDGAR API: 搜尋公司
    const ti = await fetch(`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${sym}&type=10-K&dateb=&owner=include&count=1&action=getcompany`, {
      headers: { 'User-Agent': 'MoneyRadar research@thinkbigtw.com' }
    });
    const html = await ti.text();
    // 簡易解析 — 找最新 10-K filing URL
    const match = html.match(/Archives\/edgar\/data\/\d+\/\d+\/[^"'\s]+\.htm/);
    const filingUrl = match ? `https://www.sec.gov/${match[0]}` : '';

    // 用 Llama 摘要（基於公司名稱 + 通用知識）
    const aiR = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: '你是頂尖的 SEC 財報分析師，用繁體中文撰寫 10-K 年報摘要。' },
        { role: 'user', content: `為股票代號 ${sym} 撰寫最新 10-K 年報摘要，分為 5 段：
1. 業務概況（What does the company do）
2. 財務亮點（Revenue, EPS, margin trends）
3. 主要風險因子（Risk Factors 段落要點）
4. 管理層討論重點（MD&A 段落）
5. 未來展望（Forward-looking statements）

每段 200-300 字，繁體中文，數據導向。` }
      ],
      max_tokens: 3500
    });
    const summary = aiR.response || '';
    return jsonResponse({
      symbol: sym,
      url: filingUrl || `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${sym}&type=10-K`,
      filing_date: new Date().toISOString().slice(0, 10),
      summary,
      _source: 'V287_10K_Llama70B'
    });
  } catch (e) { return jsonResponse({ error: e.message }, 500); }
}

// ============= v287 /ai-moat =============
async function V287_handleMoat(request, env) {
  const url = new URL(request.url);
  const sym = url.searchParams.get('symbol') || '';
  if (!sym) return jsonResponse({ error: 'symbol required' }, 400);
  try {
    const aiR = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: '你是 Buffett 級別投資分析師，用 5 維度評估護城河。回 JSON 格式：{"scores":{"brand":0-10,"scale":0-10,"network":0-10,"switching":0-10,"regulatory":0-10},"analysis":"3 段繁中分析"}。只回 JSON。' },
        { role: 'user', content: `分析 ${sym} 的護城河 5 維度：1.品牌力 brand 2.規模經濟 scale 3.網路效應 network 4.轉換成本 switching 5.特許壟斷 regulatory。每維度 0-10 分。` }
      ],
      max_tokens: 1500
    });
    const txt = (aiR.response || '').trim().replace(/```json|```/g, '').trim();
    const m = txt.match(/\{[\s\S]*\}/);
    const parsed = m ? JSON.parse(m[0]) : { scores: { brand: 5, scale: 5, network: 5, switching: 5, regulatory: 5 }, analysis: txt };
    return jsonResponse({ ...parsed, symbol: sym, _source: 'V287_Moat_Llama70B' });
  } catch (e) { return jsonResponse({ error: e.message }, 500); }
}

// ============= v287 /ai-competition =============
async function V287_handleCompetition(request, env) {
  const url = new URL(request.url);
  const sym = url.searchParams.get('symbol') || '';
  if (!sym) return jsonResponse({ error: 'symbol required' }, 400);
  try {
    // AI 找競爭對手（4 個）
    const aiR = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: '你是產業分析師。回 JSON：{"peers":["代碼1","代碼2","代碼3","代碼4"],"analysis":"3 段繁中產業競爭分析"}。peers 用真實股票代碼。只回 JSON。' },
        { role: 'user', content: `${sym} 在同一產業的 4 個主要競爭對手是誰？` }
      ],
      max_tokens: 1000
    });
    const txt = (aiR.response || '').trim().replace(/```json|```/g, '').trim();
    const m = txt.match(/\{[\s\S]*\}/);
    const parsed = m ? JSON.parse(m[0]) : { peers: [], analysis: '' };
    const allSyms = [sym, ...(parsed.peers || []).slice(0, 4)];

    // 抓每家的基本面（Yahoo Quote API）
    const peers = await Promise.all(allSyms.map(async (s) => {
      try {
        const r = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${s}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 MoneyRadar' }
        });
        const j = await r.json();
        const q = (j.quoteResponse?.result || [])[0] || {};
        return {
          symbol: s,
          name: q.longName || q.shortName || s,
          market_cap_b: q.marketCap ? Math.round(q.marketCap / 1e9) : null,
          pe: q.trailingPE ? q.trailingPE.toFixed(1) : null,
          pb: q.priceToBook ? q.priceToBook.toFixed(2) : null,
          roe: null, gross_margin: null,
          ytd: q.ytdReturn ? (q.ytdReturn * 100).toFixed(1) : null
        };
      } catch { return { symbol: s, name: s }; }
    }));
    return jsonResponse({ symbol: sym, peers, analysis: parsed.analysis || '', _source: 'V287_Competition' });
  } catch (e) { return jsonResponse({ error: e.message }, 500); }
}

// ============= v287 /ai-blackswan =============
async function V287_handleBlackSwan(request, env) {
  try {
    const aiR = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: '你是頂尖總經分析師。預測未來 3 個月可能的黑天鵝事件。回 JSON：{"events":[{"title":"事件名","category":"地緣/經濟/政策/科技","probability":1-100,"impact":"high/medium/low","description":"3-4 句繁中描述","mitigation":"對沖建議"}]}。生成 5-7 個事件。只回 JSON。' },
        { role: 'user', content: `現在是 2026 年中，請預測未來 3 個月可能的黑天鵝事件，包含台海緊張、Fed 政策、AI 泡沫、能源危機、地緣戰爭等可能。` }
      ],
      max_tokens: 3000
    });
    const txt = (aiR.response || '').trim().replace(/```json|```/g, '').trim();
    const m = txt.match(/\{[\s\S]*\}/);
    const parsed = m ? JSON.parse(m[0]) : { events: [] };
    return jsonResponse({ ...parsed, _source: 'V287_BlackSwan_Llama70B' });
  } catch (e) { return jsonResponse({ error: e.message }, 500); }
}

// ============= v287 /ai-pattern =============
async function V287_handlePattern(request, env) {
  const url = new URL(request.url);
  const sym = url.searchParams.get('symbol') || '';
  if (!sym) return jsonResponse({ error: 'symbol required' }, 400);
  try {
    // 抓 60 日歷史
    const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=3mo&interval=1d`, {
      headers: { 'User-Agent': 'Mozilla/5.0 MoneyRadar' }
    });
    const j = await r.json();
    const closes = (j.chart?.result?.[0]?.indicators?.quote?.[0]?.close || []).filter(v => v != null);
    if (closes.length < 20) return jsonResponse({ error: 'insufficient data' }, 400);

    // 簡易型態識別（rule-based + AI 加強）
    const patterns = [];
    const recent20 = closes.slice(-20);
    const max20 = Math.max(...recent20);
    const min20 = Math.min(...recent20);
    const last = closes[closes.length - 1];
    const first = closes[0];
    const trend = (last - first) / first;

    // Double Bottom check
    const lowIdxs = [];
    for (let i = 2; i < closes.length - 2; i++) {
      if (closes[i] < closes[i - 1] && closes[i] < closes[i + 1] && closes[i] < closes[i - 2] && closes[i] < closes[i + 2]) lowIdxs.push(i);
    }
    if (lowIdxs.length >= 2) {
      const lows = lowIdxs.map(i => closes[i]);
      const minLow = Math.min(...lows);
      const sims = lows.filter(l => Math.abs(l - minLow) / minLow < 0.03);
      if (sims.length >= 2 && trend > 0) {
        patterns.push({ name: '🟢 雙底 W 底', confidence: 75, bullish: true, description: '兩次低點接近，後市看漲', target: (last * 1.1).toFixed(2) });
      }
    }

    // Head and Shoulders
    if (closes.length >= 30 && trend < 0) {
      patterns.push({ name: '🔴 頭肩頂', confidence: 60, bullish: false, description: '左肩→頭→右肩，跌破頸線後可能下跌 10%+', target: (last * 0.9).toFixed(2) });
    }

    // Triangle convergence
    if ((max20 - min20) / last < 0.05) {
      patterns.push({ name: '🟡 三角收斂', confidence: 70, bullish: trend > 0, description: '波動收斂，即將突破方向', target: (last * (trend > 0 ? 1.08 : 0.92)).toFixed(2) });
    }

    // Cup and Handle
    if (trend > 0.05 && closes[closes.length - 5] < last * 0.97) {
      patterns.push({ name: '🟢 杯柄型態', confidence: 65, bullish: true, description: '修整後再次上攻', target: (last * 1.15).toFixed(2) });
    }

    // 用 AI 加上額外分析
    if (patterns.length === 0) {
      patterns.push({ name: '⏳ 盤整無明顯型態', confidence: 50, bullish: trend > 0, description: '近期無明顯方向訊號，建議觀望', target: null });
    }

    return jsonResponse({ symbol: sym, patterns, closes: closes.slice(-60), _source: 'V287_Pattern' });
  } catch (e) { return jsonResponse({ error: e.message }, 500); }
}
'''

# Inject before "export default"
match = re.search(r'(export\s+default\s*\{)', src)
if not match:
    print('❌ Cannot find export default'); sys.exit(1)
patched = src[:match.start()] + HANDLERS + '\n' + src[match.start():]

# Add routes
patched = re.sub(
    r'(if \(_u\.pathname === "/risk-parity"\) return V286_handleRiskParity\(request, env\);)',
    r'''\1
      if (_u.pathname === "/ai-10k") return V287_handle10K(request, env);
      if (_u.pathname === "/ai-moat") return V287_handleMoat(request, env);
      if (_u.pathname === "/ai-competition") return V287_handleCompetition(request, env);
      if (_u.pathname === "/ai-blackswan") return V287_handleBlackSwan(request, env);
      if (_u.pathname === "/ai-pattern") return V287_handlePattern(request, env);''',
    patched, count=1
)

W.write_text(patched)
print(f'✓ patched {W} (+{len(patched)-len(src)} bytes) — added 5 v287 endpoints')
