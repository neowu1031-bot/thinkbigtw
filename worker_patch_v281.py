#!/usr/bin/env python3
"""
Worker patch v281 — 加 /reddit (社群情緒) + /news-summary (Llama 摘要新聞)
"""
import re, pathlib, sys

W = pathlib.Path('workers/ai-proxy/src/index.js')
if not W.exists():
    print('❌ run from ~/Desktop/thinkbigtw'); sys.exit(1)

src = W.read_text()
if '/reddit' in src and 'handleReddit' in src:
    print('✓ Already patched'); sys.exit(0)

backup = pathlib.Path('.bak_worker_v281_index.js')
backup.write_text(src)

HANDLERS = r'''
// ============= v281 /reddit endpoint (Reddit search public, no auth) =============
async function handleReddit(request, env) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get('symbol');
  const subs = (url.searchParams.get('subs') || 'wallstreetbets,stocks,investing').split(',');
  if (!symbol) return jsonResponse({ error: 'missing symbol' }, 400);
  try {
    const results = [];
    for (const sub of subs.slice(0, 3)) {
      try {
        const r = await fetch(`https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(symbol)}&restrict_sr=1&sort=new&limit=10`, {
          headers: { 'User-Agent': 'MoneyRadar/1.0 (https://thinkbigtw.com)' }
        });
        if (!r.ok) continue;
        const j = await r.json();
        const posts = (j.data && j.data.children) || [];
        posts.forEach(p => {
          const d = p.data;
          results.push({
            sub, title: d.title, score: d.score, comments: d.num_comments,
            author: d.author, created: new Date(d.created_utc * 1000).toISOString(),
            url: 'https://reddit.com' + d.permalink, selftext: (d.selftext || '').slice(0, 300)
          });
        });
      } catch (_) {}
    }
    // Sentiment heuristic: scan titles for bull/bear words
    const bull = /\b(buy|long|bullish|moon|rocket|🚀|gem|undervalued|breakout|squeeze)\b/i;
    const bear = /\b(sell|short|bearish|crash|dump|puts|overvalued|bag|fud)\b/i;
    let bulls = 0, bears = 0;
    results.forEach(r => {
      const text = r.title + ' ' + r.selftext;
      if (bull.test(text)) bulls++;
      if (bear.test(text)) bears++;
    });
    return jsonResponse({
      symbol, totalPosts: results.length,
      sentiment: { bulls, bears, score: bulls - bears, label: bulls > bears * 1.5 ? 'BULLISH' : bears > bulls * 1.5 ? 'BEARISH' : 'NEUTRAL' },
      posts: results.sort((a, b) => b.score - a.score).slice(0, 15),
      _source: 'REDDIT_PUBLIC'
    });
  } catch (e) { return jsonResponse({ error: e.message }, 500); }
}

// ============= v281 /news-summary endpoint (抓 Yahoo News + Llama AI 摘要) =============
async function handleNewsSummary(request, env) {
  const url = new URL(request.url);
  const symbol = url.searchParams.get('symbol');
  if (!symbol) return jsonResponse({ error: 'missing symbol' }, 400);
  try {
    // Step 1: Yahoo Finance news search via RSS
    const newsUrl = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`;
    const r = await fetch(newsUrl, { headers: { 'User-Agent': 'Mozilla/5.0 MoneyRadar' } });
    const xml = await r.text();
    // Naive RSS parse
    const items = [];
    const itemRe = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = itemRe.exec(xml)) !== null && items.length < 8) {
      const block = m[1];
      const title = (block.match(/<title>(?:<!\[CDATA\[)?([^<\]]+?)(?:\]\]>)?<\/title>/) || [])[1] || '';
      const desc = (block.match(/<description>(?:<!\[CDATA\[)?([\s\S]+?)(?:\]\]>)?<\/description>/) || [])[1] || '';
      const link = (block.match(/<link>(.+?)<\/link>/) || [])[1] || '';
      const pubDate = (block.match(/<pubDate>(.+?)<\/pubDate>/) || [])[1] || '';
      if (title) items.push({ title: title.trim(), description: desc.replace(/<[^>]+>/g, ' ').trim().slice(0, 300), link, pubDate });
    }
    if (items.length === 0) return jsonResponse({ error: 'no news found', symbol });

    // Step 2: Llama 3.3 70B summarize
    const ai = env.AI;
    if (!ai) return jsonResponse({ error: 'AI binding not available' }, 500);
    const newsBlock = items.map((n, i) => `[${i+1}] ${n.title}\n   ${n.description}`).join('\n\n');
    const aiRes = await ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: '你是專業財經編輯。用繁體中文摘要這 8 則新聞，重點：(1) 整體訊號（多/空/中性）(2) 3 大關鍵主題 (3) 對股價短期影響的方向。控制 300 字內，條列式。' },
        { role: 'user', content: `公司: ${symbol}\n\n最新新聞:\n${newsBlock}` }
      ],
      max_tokens: 700
    });
    return jsonResponse({
      symbol,
      newsCount: items.length,
      news: items,
      summary: (aiRes && aiRes.response) || '摘要失敗',
      _source: 'YAHOO_NEWS + LLAMA_3_3_70B'
    });
  } catch (e) { return jsonResponse({ error: e.message }, 500); }
}
'''

# Inject handlers before fetch handler
inject_re = re.compile(r'(async\s+fetch\s*\(\s*request)', re.MULTILINE)
m = inject_re.search(src)
if not m:
    inject_re = re.compile(r'(export\s+default\s*\{)', re.MULTILINE)
    m = inject_re.search(src)
if not m:
    print('❌ injection point not found'); sys.exit(1)

# Find class/object start by searching backward for { + appropriate boundary
# Easier: inject before the export default block
match2 = re.search(r'(export\s+default\s*\{)', src)
if match2:
    pos = match2.start()
else:
    pos = m.start()

patched = src[:pos] + HANDLERS + '\n' + src[pos:]

# Add early intercept routing
patched = re.sub(
    r'(// === V279_EARLY_INTERCEPT ===[\s\S]*?// === END V279_EARLY_INTERCEPT ===)',
    lambda m: m.group(1).replace(
        'if (_u.pathname === "/earnings") return handleEarnings(request, env);',
        'if (_u.pathname === "/earnings") return handleEarnings(request, env);\n      if (_u.pathname === "/reddit") return handleReddit(request, env);\n      if (_u.pathname === "/news-summary") return handleNewsSummary(request, env);'
    ),
    patched, count=1
)

W.write_text(patched)
print(f'✓ patched {W} (+{len(patched)-len(src)} bytes)')
print('Next: cd workers/ai-proxy && npx wrangler deploy')
