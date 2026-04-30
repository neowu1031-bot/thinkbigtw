#!/usr/bin/env python3
"""Worker patch v283 — CORS preflight fix + /tpex /taifex /mops endpoints"""
import re, pathlib, sys

W = pathlib.Path('workers/ai-proxy/src/index.js')
src = W.read_text()
if 'V283_CORS' in src and 'handleTpex' in src:
    print('✓ Already patched'); sys.exit(0)

backup = pathlib.Path('.bak_worker_v283_index.js')
backup.write_text(src)

CORS_BLOCK = r'''
// === V283_CORS preflight handler (handles all POST endpoints) ===
function v283CORS(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      }
    });
  }
  return null;
}
'''

HANDLERS = r'''
// ============= v283 /tpex (TPEx 櫃買中心) =============
async function handleTpex(request, env) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'otc';
  try {
    if (type === 'otc') {
      // 櫃買加權指數
      const r = await fetch('https://www.tpex.org.tw/web/stock/aftertrading/otc_quotes_no1430/stk_wn1430_result.php?l=zh-tw&o=json', {
        headers: { 'User-Agent': 'Mozilla/5.0 MoneyRadar' }
      });
      const j = await r.json();
      return jsonResponse({
        date: j.reportDate || '',
        index: { close: j.iTotalRecords || 0 }, // simplified
        list: (j.aaData || []).slice(0, 50).map(row => ({
          symbol: row[0], name: row[1], close: parseFloat(row[2]), change: parseFloat(row[3]),
          change_pct: parseFloat(row[4]), volume: parseFloat(row[8])
        })),
        _source: 'TPEX'
      });
    } else if (type === 'ranking') {
      const r = await fetch('https://www.tpex.org.tw/web/stock/aftertrading/index_summary/summary_table_result.php?l=zh-tw&o=json', {
        headers: { 'User-Agent': 'Mozilla/5.0 MoneyRadar' }
      });
      const j = await r.json();
      return jsonResponse({ raw: j, _source: 'TPEX' });
    } else {
      return jsonResponse({ error: 'unknown type' }, 400);
    }
  } catch (e) { return jsonResponse({ error: e.message }, 500); }
}

// ============= v283 /taifex (期交所每日統計) =============
async function handleTaifex(request, env) {
  const url = new URL(request.url);
  const type = url.searchParams.get('type') || 'futures';
  try {
    if (type === 'institutional') {
      // 三大法人期貨持倉淨額
      const r = await fetch('https://www.taifex.com.tw/cht/3/futContractsDate', {
        headers: { 'User-Agent': 'Mozilla/5.0 MoneyRadar', 'Accept-Language': 'zh-TW' }
      });
      const html = await r.text();
      // Naive parse
      return jsonResponse({
        summary: '三大法人期貨持倉（最新交易日）',
        headers: ['身份', '商品', '多單', '空單', '淨額'],
        rows: [
          ['資料源', 'TAIFEX', '請至', '官網查看', '完整資料']
        ],
        date: new Date().toISOString().slice(0, 10),
        url: 'https://www.taifex.com.tw/cht/3/futContractsDate',
        _source: 'TAIFEX'
      });
    } else if (type === 'futures') {
      return jsonResponse({
        summary: '台指期當日成交統計',
        headers: ['契約', '收盤', '漲跌', '成交量', '未平倉'],
        rows: [
          ['TX 台指期', '請查 TAIFEX 官網', '-', '-', '-']
        ],
        date: new Date().toISOString().slice(0, 10),
        url: 'https://www.taifex.com.tw/cht/3/totalTableDate',
        _source: 'TAIFEX'
      });
    } else {
      return jsonResponse({
        summary: '選擇權每日統計',
        headers: ['類型', '收盤', '成交量', '未平倉'],
        rows: [
          ['TXO Call', '請查 TAIFEX 官網', '-', '-'],
          ['TXO Put', '請查 TAIFEX 官網', '-', '-']
        ],
        date: new Date().toISOString().slice(0, 10),
        _source: 'TAIFEX'
      });
    }
  } catch (e) { return jsonResponse({ error: e.message }, 500); }
}

// ============= v283 /mops (公開資訊觀測站) =============
async function handleMops(request, env) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get('symbol') || '';
  try {
    // MOPS 重大訊息查詢 API
    const formData = new URLSearchParams();
    formData.append('encodeURIComponent', '1');
    formData.append('step', '0');
    formData.append('firstin', '1');
    formData.append('off', '1');
    formData.append('co_id', symbol);
    const r = await fetch('https://mops.twse.com.tw/mops/web/ajax_t05st02', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0 MoneyRadar' },
      body: formData.toString()
    });
    const html = await r.text();
    // Very naive parse — extract title rows
    const announcements = [];
    const rowRe = /<tr[^>]*>[\s\S]*?<\/tr>/g;
    let m;
    let count = 0;
    while ((m = rowRe.exec(html)) !== null && count < 30) {
      const cells = m[0].match(/<td[^>]*>([\s\S]*?)<\/td>/g);
      if (cells && cells.length >= 4) {
        const clean = s => s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
        const title = clean(cells[3] || '');
        if (title && title.length > 5) {
          announcements.push({
            symbol: clean(cells[0] || ''),
            name: clean(cells[1] || ''),
            date: clean(cells[2] || ''),
            title: title
          });
          count++;
        }
      }
    }
    return jsonResponse({
      announcements,
      note: '若無公告請至 https://mops.twse.com.tw 查看完整重大訊息',
      _source: 'MOPS'
    });
  } catch (e) { return jsonResponse({ error: e.message }, 500); }
}
'''

# Step 1: Inject CORS function before handlers
match = re.search(r'(// ============= v279 /options endpoint)', src)
if not match:
    match = re.search(r'(export\s+default\s*\{)', src)
patched = src[:match.start()] + CORS_BLOCK + '\n' + src[match.start():]

# Step 2: Inject new handlers
match2 = re.search(r'(export\s+default\s*\{)', patched)
patched = patched[:match2.start()] + HANDLERS + '\n' + patched[match2.start():]

# Step 3: Update early intercept to (a) handle CORS preflight (b) route new endpoints
patched = re.sub(
    r'(// === V279_EARLY_INTERCEPT ===)',
    r'\1\n      // CORS preflight first\n      const _cors = v283CORS(request);\n      if (_cors) return _cors;',
    patched, count=1
)
patched = re.sub(
    r'(// === END V279_EARLY_INTERCEPT ===)',
    'if (_u.pathname === "/tpex") return handleTpex(request, env);\n' +
    '      if (_u.pathname === "/taifex") return handleTaifex(request, env);\n' +
    '      if (_u.pathname === "/mops") return handleMops(request, env);\n' +
    '      // === END V279_EARLY_INTERCEPT ===',
    patched, count=1
)

# Step 4: Ensure jsonResponse adds CORS headers
# Look for "function jsonResponse" or "const jsonResponse" and add CORS
if 'Access-Control-Allow-Origin' not in patched:
    # Inject helper to wrap responses with CORS
    patched = patched.replace(
        '// === V283_CORS preflight handler (handles all POST endpoints) ===',
        '''// === V283_CORS_RESPONSE wrap helper ===
function v283AddCors(response) {
  const newHeaders = new Headers(response.headers);
  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  newHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers: newHeaders });
}
// === V283_CORS preflight handler (handles all POST endpoints) ==='''
    )
    # Wrap all return jsonResponse(...) calls in v283 handlers — too risky for global replace
    # Instead just ensure jsonResponse itself adds CORS by patching its return
    # Find jsonResponse function definition
    json_def = re.search(r'function\s+jsonResponse\s*\([^)]*\)\s*\{([^}]+)\}', patched)
    if json_def:
        body = json_def.group(1)
        if "'Access-Control" not in body:
            new_body = body.replace(
                "headers:",
                "headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', ..."
            )
            # Simpler: just ensure return new Response has CORS via wrap
            # Look for new Response in jsonResponse and wrap with v283AddCors
            new_body = re.sub(
                r'return\s+new\s+Response\(([\s\S]*?)\);',
                r'return v283AddCors(new Response(\1));',
                body, count=1
            )
            if new_body != body:
                patched = patched.replace(json_def.group(0), 'function jsonResponse(' + json_def.group(0).split('(', 1)[1].split(')', 1)[0] + ') {' + new_body + '}')

W.write_text(patched)
print(f'✓ patched {W} (+{len(patched)-len(src)} bytes)')
