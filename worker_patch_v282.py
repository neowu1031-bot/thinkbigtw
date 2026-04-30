#!/usr/bin/env python3
"""Worker patch v282 — 4 新 endpoints: /translate /article /coach + intercept route"""
import re, pathlib, sys

W = pathlib.Path('workers/ai-proxy/src/index.js')
if not W.exists():
    print('❌ run from ~/Desktop/thinkbigtw'); sys.exit(1)

src = W.read_text()
if 'handleTranslate' in src and 'handleArticle' in src and 'handleCoach' in src:
    print('✓ Already patched'); sys.exit(0)

backup = pathlib.Path('.bak_worker_v282_index.js')
backup.write_text(src)

HANDLERS = r'''
// ============= v282 /translate (POST, batch translate via Llama) =============
async function handleTranslate(request, env) {
  if (request.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405);
  try {
    const body = await request.json();
    const texts = body.texts || [];
    const target = body.target || 'en';
    if (!texts.length) return jsonResponse({ error: 'no texts' }, 400);
    const langMap = { 'en': 'English', 'ja': 'Japanese', 'zh-CN': 'Simplified Chinese', 'vi': 'Vietnamese', 'id': 'Indonesian', 'th': 'Thai' };
    const langName = langMap[target] || 'English';
    const ai = env.AI;
    const aiRes = await ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: `You are a precise translator. Translate each input text to ${langName}. Keep emoji/numbers/symbols intact. Return JSON only.` },
        { role: 'user', content: 'Translate these UI strings to ' + langName + '. Return JSON {"原文1":"翻譯1", ...}:\n' + JSON.stringify(texts) }
      ],
      max_tokens: 2000
    });
    let translations = {};
    try {
      const text = aiRes.response || '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) translations = JSON.parse(jsonMatch[0]);
    } catch (_) {}
    return jsonResponse({ target, translations, _source: 'LLAMA_3_3_70B' });
  } catch (e) { return jsonResponse({ error: e.message }, 500); }
}

// ============= v282 /article (POST, generate 1500-word article) =============
async function handleArticle(request, env) {
  if (request.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405);
  try {
    const body = await request.json();
    const symbol = body.symbol;
    const style = body.style || 'balanced';
    if (!symbol) return jsonResponse({ error: 'missing symbol' }, 400);
    const styleMap = {
      bull: '從多頭角度寫，找出該股 5 個強烈買進理由，包括基本面、技術面、產業趨勢',
      bear: '從空頭角度寫，找出該股 5 個風險與利空，提醒投資人注意',
      balanced: '從平衡角度寫，先列 3 個多頭因素，再列 3 個空頭因素，最後給結論',
      contrarian: '從反向思考角度寫，挑戰市場共識，提出非主流觀點'
    };
    const ai = env.AI;
    const aiRes = await ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: '你是 Seeking Alpha 等級的資深投資觀點寫手。用繁體中文寫一篇 1200-1500 字的個股觀點文章，結構：(1) 引言 (2) 三個論點段落 (3) 結論。語調專業但易讀，引用具體數據（成交量、本益比、營收成長率等占位即可）。文末加免責聲明。' },
        { role: 'user', content: '為股票 ' + symbol + ' 寫文章。要求: ' + styleMap[style] }
      ],
      max_tokens: 2500
    });
    return jsonResponse({
      symbol, style,
      article: aiRes.response || '無內容',
      tokenCount: (aiRes.response || '').length,
      _source: 'LLAMA_3_3_70B'
    });
  } catch (e) { return jsonResponse({ error: e.message }, 500); }
}

// ============= v282 /coach (POST, mentor chat) =============
async function handleCoach(request, env) {
  if (request.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405);
  try {
    const body = await request.json();
    const mentor = body.mentor || 'buffett';
    const mentorName = body.mentor_name || mentor;
    const userHistory = body.history || [];
    const personas = {
      buffett: '你是 Warren Buffett 巴菲特，世界最偉大的價值投資人。你的核心思想：以合理價格買進好公司、長期持有、找有護城河的企業、避開不懂的領域、注重內在價值。語調謙遜、有智慧、引用 Berkshire Hathaway 經驗、引用 Charlie Munger 的話。用繁體中文回答。',
      soros: '你是 George Soros 索羅斯，反身性理論發明者。你的核心思想：市場永遠錯誤、找尋市場與認知的落差、危機就是機會、宏觀對沖。語調哲學、犀利、引用 1992 年放空英鎊經驗。用繁體中文回答。',
      son: '你是孫正義 SoftBank 創辦人。你的核心思想：找到 AI/科技超級趨勢、敢於 all-in、Vision Fund、看 30 年後。語調熱血、宏觀、敢於做夢。用繁體中文回答。',
      lin: '你是林園，台灣著名價值投資人。你的核心思想：堅持做台股、深入產業循環、長期持有民生消費類股、信仰價值投資。語調台味、實在、引用台股案例（中華食、台積電、中信金等）。用繁體中文回答。',
      munger: '你是 Charlie Munger 蒙格，巴菲特搭檔。你的核心思想：多元思維（mental models）、避免愚蠢、跨學科思考、批判性思維。語調尖銳、博學、不留情面、有時粗魯但深刻。用繁體中文回答。',
      dalio: '你是 Ray Dalio 達里歐，橋水基金創辦人。你的核心思想：All Weather 全天候投資組合、原則(Principles)、辯證式思考、了解經濟機器運作。語調系統化、深度、引用《Principles》。用繁體中文回答。'
    };
    const sys = personas[mentor] || personas.buffett;
    const messages = [{ role: 'system', content: sys + ' 注意: 不給出具體買賣建議，只分享投資思維與框架。' }, ...userHistory];
    const ai = env.AI;
    const aiRes = await ai.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages, max_tokens: 1000
    });
    return jsonResponse({
      mentor, mentorName,
      reply: aiRes.response || '我需要思考一下，請再問我吧',
      _source: 'LLAMA_3_3_70B'
    });
  } catch (e) { return jsonResponse({ error: e.message }, 500); }
}
'''

# Inject handlers before export default
match = re.search(r'(export\s+default\s*\{)', src)
if not match:
    print('❌ injection point not found'); sys.exit(1)
patched = src[:match.start()] + HANDLERS + '\n' + src[match.start():]

# Add to early intercept
patched = re.sub(
    r'(// === V279_EARLY_INTERCEPT ===[\s\S]*?// === END V279_EARLY_INTERCEPT ===)',
    lambda m: m.group(1).replace(
        '// === END V279_EARLY_INTERCEPT ===',
        'if (_u.pathname === "/translate") return handleTranslate(request, env);\n' +
        '      if (_u.pathname === "/article") return handleArticle(request, env);\n' +
        '      if (_u.pathname === "/coach") return handleCoach(request, env);\n' +
        '      // === END V279_EARLY_INTERCEPT ==='
    ),
    patched, count=1
)

W.write_text(patched)
print(f'✓ patched {W} (+{len(patched)-len(src)} bytes)')
