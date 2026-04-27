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
    const direction = pct >= 1 ? '大漲' : pct >= 0.3 ? '小漲' : pct <= -1 ? '大跌' : pct <= -0.3 ? '小跌' : '持平';
    const fnDirection = fNet === null ? '' : fNet >= 5000 ? '大買' : fNet > 0 ? '買超' : fNet <= -5000 ? '大賣' : fNet < 0 ? '賣超' : '中性';
    const prompt = `今日台股大盤狀況：方向=${direction}（${pct.toFixed(2)}%），外資=${fnDirection}。

請用 18-22 字繁體中文寫一句【市場氛圍觀察】，要有質感、有畫面，**禁止複述任何數字**。

優秀範例（學這種風格）：
「指數放量收紅，外資買盤湧進」
「賣壓沉重，金融科技齊挫」
「市場氣氛清淡，多空拉鋸」
「外資轉買，指數扭轉跌勢」
「量縮整理，類股表現分歧」

劣質範例（絕對不要）：
✗「加權指數收盤漲704點」← 純複述數字
✗「今日上漲X支下跌Y支」← 純複述
✗「指數收紅外資買超」← 太簡陋

只回觀察文字，不要前綴或解釋。`;

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
    const upRatio = upCount / totalCount;
    const desc = upRatio >= 0.7 ? '多數類股齊漲' : upRatio >= 0.55 ? '漲多跌少' : upRatio <= 0.3 ? '多數類股下挫' : upRatio <= 0.45 ? '跌多漲少' : '漲跌互見';
    const strongDesc = strongUpCount > strongDownCount * 2 ? '強勢股活躍' : strongDownCount > strongUpCount * 2 ? '弱勢股增加' : '';
    const prompt = '台股盤面：' + desc + (strongDesc ? '，' + strongDesc : '') + '。\n\n請用 18-22 字繁體中文寫一句【市場氛圍觀察】，**禁止複述任何數字**。\n\n優秀範例：\n「類股普漲，多頭氣勢回溫」\n「賣壓沉重，金融科技皆挫」\n「漲跌互見，個股表現分歧」\n\n劣質範例（絕對不要）：\n✗「上漲X支下跌Y支」← 純複述\n\n只回觀察文字，不要前綴或解釋。';
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


// ============== 個股全方位分析 (NEW v6) ==============
async function handleAnalysis(request, env) {
  let body;
  try { body = await request.json(); }
  catch (e) { return jsonResponse({ error: 'Invalid JSON' }, 400); }

  const { symbol, name, fundamentals, institutional, priceData, news } = body;
  if (!symbol) return jsonResponse({ error: 'Missing symbol' }, 400);

  const fb = fundamentals || {};
  const pd = priceData || {};
  const inst = Array.isArray(institutional) ? institutional : [];
  const newsList = (Array.isArray(news) ? news : []).slice(0, 3);

  // 計算籌碼面：近 7 日外資累計（股 → 張）
  const foreignTotalShares = inst.reduce((s, i) => s + (Number(i.foreign_buy) || 0), 0);
  const foreignTotalLot = Math.round(foreignTotalShares / 1000);

  const newsBlock = newsList.length > 0
    ? newsList.map((n, i) => '[' + (i+1) + '] ' + (n.headline || n.title || '')).join('\n')
    : '(無相關新聞)';

  const fmt = (v, suffix) => v != null && !isNaN(Number(v)) ? Number(v).toFixed(2) + (suffix || '') : 'N/A';
  const fmtPct = (v) => v != null && !isNaN(Number(v)) ? (Number(v) >= 0 ? '+' : '') + Number(v).toFixed(2) + '%' : 'N/A';

  const prompt = '股票：' + (name || symbol) + ' (' + symbol + ')\n\n'
    + '【基本面】\n'
    + '- EPS: ' + fmt(fb.eps, ' 元') + '\n'
    + '- 本益比: ' + fmt(fb.pe_ratio, 'x') + '\n'
    + '- 殖利率: ' + fmt(fb.dividend_yield, '%') + '\n'
    + '- ROE: ' + fmt(fb.roe, '%') + '\n'
    + '- 52週區間: ' + fmt(fb.week52_low) + ' ~ ' + fmt(fb.week52_high) + '\n\n'
    + '【籌碼面】\n'
    + '- 近 7 日外資累計: ' + (foreignTotalLot >= 0 ? '+' : '') + foreignTotalLot.toLocaleString() + ' 張\n\n'
    + '【技術面】\n'
    + '- 當前: ' + fmt(pd.current) + '\n'
    + '- 7 日變化: ' + fmtPct(pd.change_7d_pct) + '\n'
    + '- 30 日變化: ' + fmtPct(pd.change_30d_pct) + '\n'
    + '- 20 日區間: ' + fmt(pd.low20d) + ' ~ ' + fmt(pd.high20d) + '\n\n'
    + '【近期新聞】\n' + newsBlock + '\n\n'
    + '請寫一段 200-280 字的【全方位資訊整理】，繁體中文，依序：\n'
    + '1. 基本面（EPS/本益比/殖利率/ROE 概況）\n'
    + '2. 籌碼面（外資 7 日動向）\n'
    + '3. 技術面（區間描述、波動，禁止預測）\n'
    + '4. 新聞重點（1-2 句總結）\n\n'
    + '【絕對禁止】\n'
    + '- 不得用「建議買/賣」「目標價」「會漲到」「會跌到」「保證」「值得」「適合進場」\n'
    + '- 不得評估投資價值\n'
    + '- 不得預測股價\n\n'
    + '【風格】專業財經整理、純陳述事實、簡潔有重點、不加結尾免責。\n\n'
    + '直接回答整理文字。';

  let analysis = '';
  try {
    const r = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: '你是專業股市資訊整理員，只整理公開資訊，絕不提供投資建議或股價預測。' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 800,
    });
    analysis = r.response || '';
  } catch (err) {
    try {
      const r2 = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
        messages: [
          { role: 'system', content: '你是專業股市資訊整理員，只整理公開資訊。' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 700,
      });
      analysis = r2.response || '';
    } catch (err2) {
      return jsonResponse({ error: 'AI 服務暫時無法使用' }, 503);
    }
  }

  if (!isContentSafe(analysis)) {
    analysis = '為符合金管會規範與避免誤導，本助理不能提供個股投資建議或股價預測。如需了解此股票公開資訊，建議您查閱公開財報、券商研究報告或官方公告。';
  }

  // 提取 highlights 標籤
  const highlights = [];
  if (fb.pe_ratio != null) highlights.push('本益比 ' + Number(fb.pe_ratio).toFixed(1) + 'x');
  if (fb.dividend_yield != null) highlights.push('殖利率 ' + Number(fb.dividend_yield).toFixed(2) + '%');
  if (fb.roe != null) highlights.push('ROE ' + Number(fb.roe).toFixed(1) + '%');
  if (foreignTotalLot !== 0) highlights.push('外資 7 日 ' + (foreignTotalLot >= 0 ? '+' : '') + foreignTotalLot.toLocaleString() + ' 張');
  if (pd.change_30d_pct != null) highlights.push('30 日 ' + (Number(pd.change_30d_pct) >= 0 ? '+' : '') + Number(pd.change_30d_pct).toFixed(2) + '%');

  return jsonResponse({
    symbol,
    name: name || symbol,
    analysis,
    highlights,
    disclaimer: DISCLAIMER,
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
      if (url.pathname === '/analysis') return await handleAnalysis(request, env);
      return await handleSummary(request, env);
    } catch (err) {
      return jsonResponse({ error: err.message || 'Internal error' }, 500);
    }
  },
};
