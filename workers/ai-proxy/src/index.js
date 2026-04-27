/**
 * MoneyRadar™ AI Proxy v3
 * Endpoints:
 *   POST /          → 個股新聞摘要 + 情緒判斷
 *   POST /chat      → AI 聊天助理（多輪對話、法律護欄）
 *   POST /briefing  → 盤前快報 AI 情緒判讀（new in v3）
 *
 * Protection:
 *   - CORS 鎖定 https://thinkbigtw.com
 *   - Cloudflare Rate Limiting binding (30 req/min/IP, cross-isolate)
 *   - Llama 3.3 70B → 8B 自動 fallback
 *   - 三層法律護欄 (system prompt + advice query 偵測 + 輸出端過濾)
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://thinkbigtw.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

const DISCLAIMER = '本內容為公開資訊整理，不構成投資建議，投資有風險。';

const FORBIDDEN_WORDS = [
  '建議買入', '建議賣出', '建議買進', '推薦買', '推薦賣',
  '一定會漲', '一定會跌', '保證', '必定上漲', '必定下跌', '必漲', '必跌',
  '目標價', '預估股價', '股價將達', '可望上看',
];

const ADVICE_PATTERNS = [
  /建議\s*(您|你)?\s*(買|賣|進場|出場|加碼|減碼)/,
  /我\s*(建議|推薦|認為應該)\s*(買|賣)/,
  /(短期|中期|長期)?\s*(可\s*買|可以買|可以賣)/,
];

function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function isContentSafe(text) {
  if (!text) return true;
  if (FORBIDDEN_WORDS.some(w => text.includes(w))) return false;
  if (ADVICE_PATTERNS.some(re => re.test(text))) return false;
  return true;
}

async function checkRate(env, ip) {
  if (!env.RATE_LIMITER) return true;
  try {
    const { success } = await env.RATE_LIMITER.limit({ key: ip });
    return success;
  } catch (e) {
    return true;
  }
}

// ============== 個股新聞摘要 ==============
async function handleSummary(request, env) {
  const { symbol, news } = await request.json();
  if (!symbol || !news || news.length === 0) {
    return jsonResponse({ error: 'Missing data' }, 400);
  }

  const newsText = news.map((n, i) =>
    `[${i + 1}] ${n.headline} (${n.source}, ${new Date(n.datetime * 1000).toLocaleDateString('zh-TW')})`
  ).join('\n');

  const prompt = `你是一個專業的股市資訊整理員。
根據以下關於 ${symbol} 的最新新聞，請用繁體中文完成兩件事：
1. 用100-150字整理今日重點消息（只陳述事實，不得預測漲跌或給出買賣建議）
2. 根據新聞內容判斷目前市場情緒：偏多、中性、偏空（只選一個）

新聞資料：
${newsText}

請以以下格式回應：
【消息摘要】
（你的摘要）

【市場情緒】
（偏多/中性/偏空）

重要：禁止使用「建議買入」「建議賣出」「一定會漲」「保證」等詞語。`;

  const response = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
    messages: [
      { role: 'system', content: '你是專業股市資訊整理員，只整理公開資訊，絕不提供投資建議。' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 512,
  });

  const text = response.response || '';
  let sentiment = 'neutral';
  if (text.includes('偏多')) sentiment = 'bullish';
  else if (text.includes('偏空')) sentiment = 'bearish';

  if (!isContentSafe(text)) {
    return jsonResponse({
      error: 'Content filtered',
      summary: '系統偵測到不當內容，請稍後再試。',
      sentiment: 'neutral',
    });
  }

  return jsonResponse({
    symbol,
    summary: text,
    sentiment,
    disclaimer: DISCLAIMER,
    updated: new Date().toISOString(),
  });
}

// ============== AI 聊天助理 ==============
const CHAT_SYSTEM_PROMPT = `你是 MoneyRadar™ 的 AI 助理（公開資訊整理員）。

【你的身份】
- 你只整理「公開可查證」的資訊
- 你的服務範圍：解釋財經名詞、整理當前個股的公開新聞、教育性質的市場知識、操作 App 的問題

【絕對禁止】
1. 不得提供買賣建議（「該不該買 XX」、「OO 會漲嗎」這類問題你都要拒絕）
2. 不得預測股價（「目標價」「會漲到多少」「會跌到多少」一律不答）
3. 不得評估個股投資價值
4. 不得編造資料 — 沒有的就明說「我目前資料中沒有」
5. 不得使用以下詞語：建議買入、建議賣出、一定會漲、保證、必漲、必跌、目標價

【抗假消息守則】
- 如果使用者引用某則消息，你必須先確認該消息是否在「參考新聞」中
- 沒看到就回：「我目前資料中沒有這則消息，建議您從原始來源核對。」

【法律邊界】
依台灣《證券投資信託及顧問法》規定，未取得執照不得提供個股投資建議。
遇到「我該買 XX 嗎」「OO 會漲嗎」這類問題，請明確回：
「依法我不能提供個股投資建議。我可以幫你整理 XX 最近的公開新聞，由你自己判斷。」

【回答格式】
- 100-200 字
- 必要時用條列
- 永遠用繁體中文`;

async function fetchSupabaseUserPlan(authHeader, env) {
  return 'free';
}

async function handleChat(request, env) {
  let body;
  try { body = await request.json(); }
  catch (e) { return jsonResponse({ error: 'Invalid JSON' }, 400); }

  const { messages, context } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonResponse({ error: 'messages 必填' }, 400);
  }
  if (messages.length > 20) {
    return jsonResponse({ error: '對話過長，請刷新重新開始' }, 400);
  }
  for (const m of messages) {
    if (typeof m.content !== 'string' || m.content.length > 2000) {
      return jsonResponse({ error: '單則訊息過長（上限 2000 字）' }, 400);
    }
    if (!['user', 'assistant'].includes(m.role)) {
      return jsonResponse({ error: 'role 必須是 user 或 assistant' }, 400);
    }
  }

  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  const userText = lastUser ? lastUser.content : '';
  const adviceQuery = /(該|要不要|可不可以|能不能)\s*(買|賣|進場|出場)|會\s*(漲|跌)\s*嗎|(目標價|會漲到|會跌到)|值不值得買/.test(userText);

  const userPlan = await fetchSupabaseUserPlan(request.headers.get('Authorization'), env);

  let systemPrompt = CHAT_SYSTEM_PROMPT;
  if (context && context.currentSymbol && Array.isArray(context.currentNews)) {
    const newsBlock = context.currentNews.slice(0, 5).map((n, i) =>
      `[${i + 1}] ${n.headline || n.title || ''} (${n.source || 'Google News'})`
    ).join('\n');
    systemPrompt += `\n\n【參考新聞 - ${context.currentSymbol}】\n${newsBlock}`;
  }
  if (adviceQuery) {
    systemPrompt += '\n\n⚠️ 偵測到使用者可能在詢問投資建議。請務必依「法律邊界」段落回應，明確拒絕並改提供公開資訊整理。';
  }

  let reply = '';
  let modelUsed = 'llama-3.3-70b';

  try {
    const aiRes = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 600,
    });
    reply = aiRes.response || '';
  } catch (err) {
    try {
      const aiRes = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        max_tokens: 500,
      });
      reply = aiRes.response || '';
      modelUsed = 'llama-3-8b';
    } catch (err2) {
      return jsonResponse({ error: 'AI 服務暫時無法使用' }, 503);
    }
  }

  if (!isContentSafe(reply)) {
    reply = '為符合金管會規範與避免誤導，本助理不能提供投資建議。\n\n如需了解某支股票的公開資訊，請查詢該個股後使用 AI 消息摘要功能。';
  }

  return jsonResponse({
    reply,
    model: modelUsed,
    engine: 'Cloudflare AI',
    plan: userPlan,
    disclaimer: DISCLAIMER,
    updated: new Date().toISOString(),
  });
}

// ============== 盤前快報情緒判讀 (NEW v3.1 - 規則式 + AI 輔助) ==============
async function handleBriefing(request, env) {
  let body;
  try { body = await request.json(); }
  catch (e) { return jsonResponse({ error: 'Invalid JSON' }, 400); }

  const { taiex, foreign_net } = body;
  if (!taiex || typeof taiex.close !== 'number') {
    return jsonResponse({ error: 'Missing taiex.close' }, 400);
  }

  const change = Number(taiex.change) || 0;
  const pct = Number(taiex.pct) || 0;
  const close = Number(taiex.close);
  const fNet = typeof foreign_net === 'number' ? foreign_net : null;

  // 100% 規則式情緒判讀（決定性，無 AI 判斷誤差）
  let sentiment = 'neutral';
  if (pct >= 1) {
    sentiment = 'bullish';
  } else if (pct >= 0.3 && (fNet === null || fNet > 0)) {
    sentiment = 'bullish';
  } else if (pct <= -1) {
    sentiment = 'bearish';
  } else if (pct <= -0.3 && (fNet === null || fNet < 0)) {
    sentiment = 'bearish';
  }
  const label = sentiment === 'bullish' ? '偏多' : sentiment === 'bearish' ? '偏空' : '中性';

  // AI 補充 25 字內市場觀察（中性陳述，不得買賣建議）
  let note = '';
  try {
    const fNetText = fNet !== null
      ? `外資買賣超 ${fNet >= 0 ? '+' : ''}${fNet.toLocaleString()} 張`
      : '外資資料未提供';
    const prompt = `加權指數收盤 ${close.toLocaleString()}，漲跌 ${change >= 0 ? '+' : ''}${change.toFixed(2)}（${pct.toFixed(2)}%）。${fNetText}。

請用「不超過 25 字」的繁體中文寫一句【中性陳述】的市場觀察。
範例：「大盤輕微震盪，外資觀望中」「指數小漲，外資連 3 日買超」「指數收黑，外資轉賣」。

要求：
1. 不得預測未來走勢
2. 不得使用「該買」「會漲」「會跌」「目標價」「保證」等字眼
3. 只陳述當前資料事實
4. 不要加標點以外的格式符號

直接回答觀察文字（不要前綴、不要解釋）：`;

    const r = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: '你只回應 25 字內的市場觀察句子，純陳述事實，不評價、不預測、不建議。' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 80,
    });
    note = (r.response || '').trim().replace(/^[「『]|[」』]$/g, '').slice(0, 80);
    // 安全過濾
    if (!isContentSafe(note)) {
      note = sentiment === 'bullish' ? '指數偏多運行' : sentiment === 'bearish' ? '指數偏空整理' : '指數震盪整理';
    }
  } catch (err) {
    note = sentiment === 'bullish' ? '指數偏多運行' : sentiment === 'bearish' ? '指數偏空整理' : '指數震盪整理';
  }

  return jsonResponse({
    sentiment,
    label,
    note,
    rule: { pct, foreign_net: fNet },
    updated: new Date().toISOString(),
  });
}


// ============== 市場熱度儀表板 (NEW v4) ==============
async function handleHeatmap(request, env) {
  let body;
  try { body = await request.json(); }
  catch (e) { return jsonResponse({ error: 'Invalid JSON' }, 400); }

  const stats = body.stats || {};
  const upCount = Number(stats.upCount) || 0;
  const downCount = Number(stats.downCount) || 0;
  const flatCount = Number(stats.flatCount) || 0;
  const strongUpCount = Number(stats.strongUpCount) || 0;
  const strongDownCount = Number(stats.strongDownCount) || 0;
  const totalCount = upCount + downCount + flatCount;
  if (totalCount === 0) return jsonResponse({ error: 'Empty stats' }, 400);

  const upRatio = upCount / totalCount;
  const strongRatio = strongUpCount / totalCount;
  let heat = 'neutral';
  let label = '中性';
  if (upRatio >= 0.7 && strongRatio >= 0.1) { heat = 'hot'; label = '熱絡'; }
  else if (upRatio >= 0.55) { heat = 'warm'; label = '偏熱'; }
  else if (upRatio <= 0.3 && (strongDownCount / totalCount) >= 0.1) { heat = 'cold'; label = '寒冷'; }
  else if (upRatio <= 0.45) { heat = 'cool'; label = '偏冷'; }

  let note = '';
  try {
    const prompt = '今日台股' + totalCount + '支：上漲' + upCount + '、下跌' + downCount + '、強勢股(>+3%)' + strongUpCount + '支、弱勢股(<-3%)' + strongDownCount + '支。請用 25 字內中文寫一句中性的市場熱度觀察，純陳述事實，不預測、不買賣建議。直接回答觀察文字。';
    const r = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: '你只回 25 字內市場熱度觀察句，純陳述。' },
        { role: 'user', content: prompt },
      ],
      max_tokens: 80,
    });
    note = (r.response || '').trim().replace(/^[「『]|[」』]$/g, '').slice(0, 80);
    if (!isContentSafe(note)) note = '';
  } catch (e) {}

  if (!note) {
    note = heat === 'hot' ? '多數類股上揚，市場氣氛熱絡' :
           heat === 'warm' ? '多數類股收紅，市場偏多' :
           heat === 'cold' ? '多數類股收黑，市場氣氛低迷' :
           heat === 'cool' ? '多數類股收黑，市場偏空' :
           '漲跌互見，市場分歧';
  }

  return jsonResponse({
    heat, label, note,
    stats: { upCount, downCount, flatCount, strongUpCount, strongDownCount, totalCount },
    updated: new Date().toISOString(),
  });
}

// ============== Router ==============
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!await checkRate(env, ip)) {
      return jsonResponse({ error: '請求過於頻繁，請稍候再試（每分鐘最多 30 次）' }, 429);
    }

    const url = new URL(request.url);
    try {
      if (url.pathname === '/chat') return await handleChat(request, env);
      if (url.pathname === '/briefing') return await handleBriefing(request, env);
      if (url.pathname === '/heatmap') return await handleHeatmap(request, env);
      return await handleSummary(request, env);
    } catch (err) {
      return jsonResponse({ error: err.message || 'Internal error' }, 500);
    }
  },
};
