#!/usr/bin/env python3
"""
Worker patch v279 — 加 /options (Yahoo Finance) + /earnings (Llama AI 摘要 SEC 8-K)
Usage:
    cd ~/Desktop/thinkbigtw
    python3 worker_patch_v279.py
    cd workers/ai-proxy && npx wrangler deploy
"""
import re
import pathlib
import sys

W = pathlib.Path('workers/ai-proxy/src/index.js')
if not W.exists():
    print('❌ workers/ai-proxy/src/index.js not found, run from ~/Desktop/thinkbigtw')
    sys.exit(1)

src = W.read_text()

# Already patched? Skip.
if '/options' in src and 'YAHOO_OPTIONS' in src:
    print('✓ Already patched, skip')
    sys.exit(0)

# Backup
backup = pathlib.Path('.bak_worker_v279_index.js')
backup.write_text(src)
print(f'✓ backup: {backup}')

# ==============================================================
# Inject 2 handler functions before "// Routing" or end of file
# ==============================================================
HANDLERS = r'''
// ============= v279 /options endpoint (Yahoo Finance options chain) =============
async function handleOptions(request, env) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get('symbol');
  if (!symbol) return jsonResponse({ error: 'missing symbol' }, 400);
  try {
    // Yahoo crumb auth (existing /quote already does this — extract crumb fetch)
    const cookieRes = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const cookies = cookieRes.headers.get('set-cookie') || '';
    const cookieStr = cookies.split(',').map(c => c.split(';')[0]).join('; ');
    const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', { headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': cookieStr } });
    const crumb = (await crumbRes.text()).trim();
    // Yahoo options API
    const apiUrl = `https://query2.finance.yahoo.com/v7/finance/options/${encodeURIComponent(symbol)}?crumb=${encodeURIComponent(crumb)}`;
    const r = await fetch(apiUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Cookie': cookieStr } });
    if (!r.ok) return jsonResponse({ error: `Yahoo options ${r.status}` }, 502);
    const j = await r.json();
    const result = j.optionChain && j.optionChain.result && j.optionChain.result[0];
    if (!result) return jsonResponse({ error: 'no options data' });
    const opt = result.options && result.options[0];
    return jsonResponse({
      symbol: result.underlyingSymbol,
      underlyingPrice: result.quote && result.quote.regularMarketPrice,
      expirationDate: opt && opt.expirationDate,
      expirationDates: result.expirationDates,
      strikes: result.strikes,
      calls: (opt && opt.calls) || [],
      puts: (opt && opt.puts) || [],
      _source: 'YAHOO_OPTIONS'
    });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}

// ============= v279 /earnings endpoint (Llama 3.3 70B summarize SEC 8-K) =============
async function handleEarnings(request, env) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get('symbol');
  if (!symbol) return jsonResponse({ error: 'missing symbol' }, 400);
  try {
    // Step 1: get CIK from SEC tickers
    const tickersRes = await fetch('https://www.sec.gov/files/company_tickers.json', { headers: { 'User-Agent': 'MoneyRadar contact@thinkbigtw.com' } });
    const tickers = await tickersRes.json();
    let cik = null;
    for (const k in tickers) {
      if (tickers[k].ticker === symbol.toUpperCase()) { cik = String(tickers[k].cik_str).padStart(10, '0'); break; }
    }
    if (!cik) return jsonResponse({ error: 'CIK not found for ' + symbol });

    // Step 2: get most recent 8-K filing
    const subRes = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, { headers: { 'User-Agent': 'MoneyRadar contact@thinkbigtw.com' } });
    const sub = await subRes.json();
    const recent = sub.filings && sub.filings.recent;
    if (!recent) return jsonResponse({ error: 'no filings' });
    let idx = -1;
    for (let i = 0; i < recent.form.length; i++) {
      if (recent.form[i] === '8-K') { idx = i; break; }
    }
    if (idx < 0) return jsonResponse({ error: 'no 8-K filing' });
    const accessionRaw = recent.accessionNumber[idx].replace(/-/g, '');
    const filingDate = recent.filingDate[idx];
    const primaryDoc = recent.primaryDocument[idx];
    const filingUrl = `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${accessionRaw}/${primaryDoc}`;

    // Step 3: fetch filing content (HTML or text)
    const docRes = await fetch(filingUrl, { headers: { 'User-Agent': 'MoneyRadar contact@thinkbigtw.com' } });
    let content = await docRes.text();
    // Strip HTML tags
    content = content.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    content = content.slice(0, 12000); // limit for AI prompt

    // Step 4: Llama 3.3 70B summary via Cloudflare Workers AI
    const ai = env.AI;
    if (!ai) return jsonResponse({ error: 'AI binding not available' }, 500);
    const aiRes = await ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: '你是專業財報分析師。用繁體中文摘要這份 SEC 8-K filing，重點：(1) 公司事件性質（財報/併購/高層異動/重大事項？）(2) 關鍵數據（營收/EPS/guidance？）(3) 對股價短期影響（中性/利多/利空）(4) 投資人需要關注的點。控制在 400 字內，條列式。' },
        { role: 'user', content: `公司: ${symbol}\nFiling 日期: ${filingDate}\n\n內容:\n${content}` }
      ],
      max_tokens: 800
    });
    const summary = (aiRes && aiRes.response) || '無摘要';
    return jsonResponse({
      symbol,
      cik,
      filingDate,
      filingType: '8-K',
      sourceUrl: filingUrl,
      summary,
      _source: 'LLAMA_3_3_70B'
    });
  } catch (e) {
    return jsonResponse({ error: e.message }, 500);
  }
}
'''

# Find a good injection point: just before module.exports / export default fetch
# Most Cloudflare Workers code has "export default { async fetch(..." pattern
# Inject handlers ABOVE the export
inject_re = re.compile(r'(export\s+default\s*\{)', re.MULTILINE)
m = inject_re.search(src)
if not m:
    # try alternate: addEventListener('fetch'...)
    inject_re = re.compile(r"(addEventListener\s*\(\s*['\"]fetch['\"])")
    m = inject_re.search(src)
if not m:
    print('❌ could not find injection point in Worker source. Manually add handlers.')
    sys.exit(1)

# Inject handlers before the match
patched = src[:m.start()] + HANDLERS + '\n' + src[m.start():]

# ==============================================================
# Add routing cases
# ==============================================================
# Find the routing block (looking for if/else with /quote, /chat, /briefing pattern)
ROUTE_PATTERNS = [
    # Pattern A: if (path === '/quote') return ...
    (r"(if\s*\(\s*path\s*===\s*['\"]/quote['\"]\s*\)[^;]*;)",
     r"\1\n    if (path === '/options') return handleOptions(request, env);\n    if (path === '/earnings') return handleEarnings(request, env);"),
    # Pattern B: case '/quote': ...
    (r"(case\s*['\"]/quote['\"][^;]*;)",
     r"\1\n      case '/options': return handleOptions(request, env);\n      case '/earnings': return handleEarnings(request, env);"),
    # Pattern C: switch with url.pathname
    (r"(url\.pathname\s*===\s*['\"]/quote['\"][^;]*;)",
     r"\1\n    if (url.pathname === '/options') return handleOptions(request, env);\n    if (url.pathname === '/earnings') return handleEarnings(request, env);"),
]

routed = False
for pat, repl in ROUTE_PATTERNS:
    new_patched, n = re.subn(pat, repl, patched, count=1)
    if n > 0:
        patched = new_patched
        routed = True
        print(f'✓ routing added via pattern')
        break

if not routed:
    print('⚠️  routing patterns not matched. Adding manual hint at bottom...')
    patched += '''

// ============= TODO MANUAL: add to your routing logic =============
// if (path === '/options')  return handleOptions(request, env);
// if (path === '/earnings') return handleEarnings(request, env);
'''

# Update /health endpoints list (cosmetic)
patched = re.sub(
    r'("endpoints"\s*:\s*\[)([^\]]+)(\])',
    lambda m: m.group(1) + m.group(2).rstrip(' ,') + ',"/options","/earnings"' + m.group(3),
    patched, count=1
)

W.write_text(patched)
print(f'✓ patched {W} (+{len(patched)-len(src)} bytes)')
print('')
print('Next:')
print('  cd workers/ai-proxy && npx wrangler deploy')
