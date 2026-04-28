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

【你的身份 - 嚴格範圍】
- 你只服務「財經 / 股市 / 投資知識 / MoneyRadar 操作」相關問題
- 你的服務範圍：解釋財經名詞、整理當前個股的公開新聞、教育性質的市場知識、操作 App 的問題

【絕對拒絕的離題問題（必須拒絕）】
- 旅遊、景點、餐廳、美食推薦、行程規劃
- 料理、食譜、烹飪
- 娛樂、電影、音樂、明星、體育
- 政治、宗教、人際關係、感情諮詢
- 天氣、健康、醫療、法律問題
- 技術問題（程式設計、3C 產品等）
- 任何與「財經、股市、投資、MoneyRadar 操作」無關的話題

遇到離題問題，請禮貌且明確拒絕，例如：
「我是 MoneyRadar 的財經 AI 助理，只能協助回答**財經、股市、投資知識、MoneyRadar 操作**相關問題。請問你想了解哪方面的市場資訊？例如：本益比是什麼、外資動向、特定個股的公開新聞等。」

不要試圖在離題問題後「順便提供財經建議」連結，直接拒絕並引導回主題即可。

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

  // 規則式 insight 描述（讓 AI 有方向感、不只 echo 數字）
  const peLevel = fb.pe_ratio == null ? '' : Number(fb.pe_ratio) >= 30 ? '本益比偏高' : Number(fb.pe_ratio) >= 15 ? '本益比中等' : '本益比偏低';
  const dyLevel = fb.dividend_yield == null ? '' : Number(fb.dividend_yield) >= 4 ? '殖利率偏高' : Number(fb.dividend_yield) >= 2 ? '殖利率中等' : '殖利率偏低';
  const roeLevel = fb.roe == null ? '' : Number(fb.roe) >= 20 ? 'ROE 高水準' : Number(fb.roe) >= 10 ? 'ROE 中等' : 'ROE 偏低';
  const fnLevel = foreignTotalLot >= 30000 ? '外資大幅加碼' : foreignTotalLot >= 5000 ? '外資加碼' : foreignTotalLot <= -30000 ? '外資大幅減碼' : foreignTotalLot <= -5000 ? '外資減碼' : '外資中性';
  const techDir = pd.change_30d_pct == null ? '' : Number(pd.change_30d_pct) >= 10 ? '月線強勢上揚' : Number(pd.change_30d_pct) >= 3 ? '月線溫和上漲' : Number(pd.change_30d_pct) <= -10 ? '月線明顯回檔' : Number(pd.change_30d_pct) <= -3 ? '月線轉弱' : '月線整理';

  const prompt = '股票：' + (name || symbol) + ' (' + symbol + ')\n\n'
    + '【基本面】' + [peLevel, dyLevel, roeLevel].filter(x=>x).join('、') + '\n'
    + '   原始：EPS ' + fmt(fb.eps) + '、本益比 ' + fmt(fb.pe_ratio, 'x') + '、殖利率 ' + fmt(fb.dividend_yield, '%') + '、ROE ' + fmt(fb.roe, '%') + '\n\n'
    + '【籌碼面】' + fnLevel + '\n'
    + '   原始：近 7 日外資累計 ' + (foreignTotalLot >= 0 ? '+' : '') + foreignTotalLot.toLocaleString() + ' 張\n\n'
    + '【技術面】' + techDir + '\n'
    + '   原始：當前 ' + fmt(pd.current) + '、7 日 ' + fmtPct(pd.change_7d_pct) + '、30 日 ' + fmtPct(pd.change_30d_pct) + '、20 日區間 ' + fmt(pd.low20d) + '-' + fmt(pd.high20d) + '\n\n'
    + '【近期新聞】\n' + newsBlock + '\n\n'
    + '請寫 200-260 字的【全方位資訊整理】，繁體中文，分四段：\n'
    + '1. 基本面段：用上方 insight 描述 + 帶 1-2 個關鍵數字\n'
    + '2. 籌碼面段：用 insight 描述 + 1 個關鍵數字\n'
    + '3. 技術面段：用 insight 描述 + 區間數字\n'
    + '4. 新聞段：1-2 句總結重點消息\n\n'
    + '優秀範例風格（請學）：\n'
    + '「基本面方面，EPS 達 38 元，本益比 22 倍偏中等，搭配 ROE 接近 30% 的高獲利能力，反映公司獲利穩健。籌碼面外資加碼明顯，近 7 日累計 +21 萬張買超...」\n\n'
    + '劣質範例（絕對不要）：\n'
    + '✗「EPS 為 38.5 元，本益比為 22.5 倍，殖利率為 1.85%」← 只是把數字唸一遍，沒 insight\n\n'
    + '【絕對禁止】\n'
    + '- 不得用「建議買/賣」「目標價」「會漲到」「值得」「適合進場」\n'
    + '- 不得評估投資價值（不能說「便宜」「貴」「划算」）\n'
    + '- 不得預測股價\n\n'
    + '直接回答整理文字，不加結尾免責。';

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


// ============== 自選股 AI 早報 (NEW v7) ==============
async function handleDigest(request, env) {
  let body;
  try { body = await request.json(); }
  catch (e) { return jsonResponse({ error: 'Invalid JSON' }, 400); }

  const stocks = Array.isArray(body.stocks) ? body.stocks : [];
  if (stocks.length === 0) return jsonResponse({ error: '請先加入自選股' }, 400);
  if (stocks.length > 20) return jsonResponse({ error: '自選股上限 20 支' }, 400);

  // 規則式描述每支股票（避免 AI 純 echo 數字）
  const stockBlock = stocks.map((s, i) => {
    const fnLot = Number(s.foreign_7d_lot) || 0;
    const fnDesc = s.foreign_7d_lot == null ? '外資資料未提供'
      : fnLot >= 30000 ? '外資大買' : fnLot >= 5000 ? '外資買超'
      : fnLot <= -30000 ? '外資大賣' : fnLot <= -5000 ? '外資賣超'
      : fnLot > 0 ? '外資微買' : fnLot < 0 ? '外資微賣' : '外資中性';
    const pct30 = Number(s.change_30d_pct);
    const trendDesc = s.change_30d_pct == null ? ''
      : pct30 >= 10 ? '30日強勢' : pct30 >= 3 ? '30日上揚'
      : pct30 <= -10 ? '30日弱勢' : pct30 <= -3 ? '30日回檔'
      : '30日整理';
    return (i+1) + '. ' + (s.name || s.symbol) + ' (' + s.symbol + ')：' + fnDesc + (trendDesc ? '、' + trendDesc : '');
  }).join('\n');

  // 整體外資方向
  const totalForLot = stocks.reduce((acc, s) => acc + (Number(s.foreign_7d_lot) || 0), 0);
  const overallDir = totalForLot >= 50000 ? '整體外資大幅加碼' : totalForLot >= 10000 ? '整體外資偏買'
    : totalForLot <= -50000 ? '整體外資大幅減碼' : totalForLot <= -10000 ? '整體外資偏賣'
    : '整體外資觀望';

  const prompt = '用戶自選 ' + stocks.length + ' 支台股近期狀況：\n\n'
    + stockBlock + '\n\n'
    + '整體：' + overallDir + '\n\n'
    + '請產出【自選股 AI 早報】，繁體中文，結構如下：\n\n'
    + '【整體觀察】\n'
    + '（一句話 25-35 字，描述外資動向氛圍，**禁止複述具體數字**）\n\n'
    + '【個股重點】\n'
    + '（每支一行，15-25 字，格式：- 名稱 (代號)：觀察）\n\n'
    + '優秀範例（學這種風格）：\n'
    + '【整體觀察】外資加碼科技權值，整體偏多氣氛濃厚\n'
    + '【個股重點】\n'
    + '- 台積電 (2330)：外資大買，30 日強勢領漲\n'
    + '- 鴻海 (2317)：外資轉賣，月線壓力浮現\n'
    + '- 中信金 (2891)：外資微買，金融類股相對抗跌\n\n'
    + '劣質範例（絕對不要）：\n'
    + '✗「台積電 (2330)：7日外資買超34,462張」← 純複述數字\n'
    + '✗「外資累計買超 X 張」← 純複述\n\n'
    + '【絕對禁止】\n'
    + '- 不得用「建議買/賣」「目標價」「值得」「適合進場」「會漲到」\n'
    + '- 不得評估投資價值\n'
    + '- 不得預測股價\n\n'
    + '只回答早報內容，不加標題前綴或結尾免責。';

  let digest = '';
  try {
    const r = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: '你是專業股市資訊整理員，產出客觀的自選股早報，純陳述事實，絕不提供投資建議。' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 700,
    });
    digest = r.response || '';
  } catch (err) {
    try {
      const r2 = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
        messages: [
          { role: 'system', content: '你是專業股市資訊整理員。' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 600,
      });
      digest = r2.response || '';
    } catch (err2) {
      return jsonResponse({ error: 'AI 服務暫時無法使用' }, 503);
    }
  }

  if (!isContentSafe(digest)) {
    digest = '為符合金管會規範，本助理不能對個股提供投資建議或股價預測。\n\n您可以手動逐支查詢個股，使用「AI 全方位分析」獲得詳細資訊整理。';
  }

  // 計算整體外資加總（張）
  const totalForeign7d = stocks.reduce((s, st) => s + (Number(st.foreign_7d_lot) || 0), 0);

  return jsonResponse({
    digest,
    stockCount: stocks.length,
    totalForeign7d,
    disclaimer: DISCLAIMER,
    updated: new Date().toISOString(),
  });
}


// ============== 全球報價代理 v10 — Alpha Vantage 主 + Yahoo 備援 + Cache 10 分鐘 ==============
async function fetchAlphaVantageQuote(symbol, env) {
  if (!env.ALPHA_VANTAGE_KEY) return null;
  try {
    const url = 'https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=' + encodeURIComponent(symbol) + '&apikey=' + env.ALPHA_VANTAGE_KEY;
    const r = await fetch(url, { cf: { cacheTtl: 300, cacheEverything: true } });
    if (!r.ok) return null;
    const d = await r.json();
    if (d.Note || d.Information) return { _quotaWarning: d.Note || d.Information };
    const q = d['Global Quote'];
    if (!q || !q['05. price']) return null;
    const price = parseFloat(q['05. price']);
    const prev = parseFloat(q['08. previous close']);
    return {
      symbol,
      name: symbol,
      price,
      prev,
      change: parseFloat(q['09. change']) || (price - prev),
      pct: parseFloat(String(q['10. change percent'] || '0').replace('%', '')) || 0,
      currency: '',
      tradingDay: q['07. latest trading day'] || '',
      source: 'alpha-vantage'
    };
  } catch (e) {
    return null;
  }
}

async function fetchYahooQuote(symbol) {
  try {
    // range=5d 確保抓到至少 2 個交易日（避開週末/假日）
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) + '?interval=1d&range=5d';
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      cf: { cacheTtl: 300, cacheEverything: true }
    });
    if (!r.ok) return null;
    const d = await r.json();
    const result = d && d.chart && d.chart.result && d.chart.result[0];
    if (!result) return null;
    const m = result.meta || {};
    const closes = (result.indicators && result.indicators.quote && result.indicators.quote[0] && result.indicators.quote[0].close) || [];
    const validCloses = closes.filter(c => c != null && !isNaN(c));

    // 當前價：優先 meta.regularMarketPrice
    const price = Number(m.regularMarketPrice) || (validCloses.length > 0 ? Number(validCloses[validCloses.length-1]) : 0);
    if (!price) return null;

    // 昨收：優先 meta.regularMarketPreviousClose（更準），否則用 closes 倒數第二個有效值
    let prev = Number(m.regularMarketPreviousClose) || 0;
    if (!prev && validCloses.length >= 2) {
      // 用倒數第二個 close（避開當天可能的盤中跳空）
      prev = Number(validCloses[validCloses.length-2]);
    }
    if (!prev) prev = Number(m.previousClose) || Number(m.chartPreviousClose) || 0;

    return {
      symbol,
      name: m.longName || m.shortName || symbol,
      price,
      prev,
      change: prev > 0 ? Number((price - prev).toFixed(4)) : 0,
      pct: prev > 0 ? Number(((price - prev) / prev * 100).toFixed(2)) : 0,
      currency: m.currency || '',
      marketState: m.marketState || '',
      exchange: m.exchangeName || m.fullExchangeName || '',
      tradingDay: m.regularMarketTime ? new Date(m.regularMarketTime * 1000).toISOString().slice(0,10) : '',
      closes: validCloses.length >= 2 ? validCloses.slice(-7).map(c => Number(c.toFixed(4))) : null,
      source: 'yahoo'
    };
  } catch (e) {
    return null;
  }
}

async function fetchQuote(symbol, env) {
  // 純美股代號（純大寫無後綴）→ 優先 Alpha Vantage（合法、NASDAQ 授權）
  const isUS = /^[A-Z]{1,5}$/.test(symbol);
  if (isUS && env.ALPHA_VANTAGE_KEY) {
    const av = await fetchAlphaVantageQuote(symbol, env);
    if (av && !av._quotaWarning && av.price) return av;
  }
  // 其他市場（港日韓歐...）或 Alpha Vantage 失敗 → Yahoo
  const yh = await fetchYahooQuote(symbol);
  if (yh) return yh;
  return { symbol, error: 'no data', source: 'none' };
}

async function handleQuote(request, env) {
  let body;
  try { body = await request.json(); }
  catch (e) { return jsonResponse({ error: 'Invalid JSON' }, 400); }

  const symbols = Array.isArray(body.symbols) ? body.symbols.slice(0, 30) : [];
  if (symbols.length === 0) return jsonResponse({ error: 'symbols 必填' }, 400);

  const results = await Promise.all(symbols.map(s => fetchQuote(String(s).trim(), env)));
  return jsonResponse({
    results,
    sourceMix: results.reduce((acc, r) => { const k = r.source || 'unknown'; acc[k] = (acc[k]||0) + 1; return acc; }, {}),
    updated: new Date().toISOString()
  });
}


// ============== 通用市場早報 (NEW v13 — for /market-briefing) ==============
async function handleMarketBriefing(request, env) {
  let body;
  try { body = await request.json(); }
  catch (e) { return jsonResponse({ error: 'Invalid JSON' }, 400); }

  const market = body.market || 'unknown';
  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) return jsonResponse({ error: 'items 必填' }, 400);

  const validItems = items.filter(i => i.pct != null && !isNaN(Number(i.pct)));
  if (validItems.length === 0) return jsonResponse({ error: '無有效資料' }, 400);

  const upCount = validItems.filter(i => Number(i.pct) > 0).length;
  const downCount = validItems.filter(i => Number(i.pct) < 0).length;
  const flatCount = validItems.length - upCount - downCount;
  const avgPct = validItems.reduce((s, i) => s + Number(i.pct), 0) / validItems.length;
  const upRatio = upCount / validItems.length;
  const strongUp = validItems.filter(i => Number(i.pct) >= 3).length;
  const strongDown = validItems.filter(i => Number(i.pct) <= -3).length;

  // 規則式情緒判定（避免 AI 偏多）
  let sentiment = 'neutral';
  let label = '中性';
  if (avgPct >= 1.5 || (upRatio >= 0.7 && avgPct >= 0.3)) { sentiment = 'bullish'; label = '偏多'; }
  else if (avgPct <= -1.5 || (upRatio <= 0.3 && avgPct <= -0.3)) { sentiment = 'bearish'; label = '偏空'; }

  // 規則式描述（給 AI 風向感）
  const marketLabels = { us: '美股', crypto: '加密貨幣', asia: '亞洲股市', global: '全球市場' };
  const marketName = marketLabels[market] || '市場';
  const dirDesc = avgPct >= 1 ? '大漲' : avgPct >= 0.3 ? '小漲' : avgPct <= -1 ? '大跌' : avgPct <= -0.3 ? '小跌' : '震盪';
  const breadthDesc = upRatio >= 0.7 ? '普漲' : upRatio >= 0.55 ? '漲多跌少' : upRatio <= 0.3 ? '普跌' : upRatio <= 0.45 ? '跌多漲少' : '漲跌互見';
  const strongDesc = strongUp > strongDown * 2 ? '強勢股活躍' : strongDown > strongUp * 2 ? '弱勢股增加' : '';

  // AI 25 字市場觀察
  const prompt = '今日' + marketName + '：' + dirDesc + '，' + breadthDesc + (strongDesc ? '，' + strongDesc : '') + '。\n\n'
    + '請用 18-22 字繁體中文寫一句【市場氛圍觀察】，**禁止複述任何數字**。\n\n'
    + '優秀範例（學風格）：\n'
    + '「科技領漲，金融跟進，多頭氣勢延續」\n'
    + '「賣壓沉重，類股普跌，市場氣氛謹慎」\n'
    + '「漲跌互見，缺乏明確方向，量縮整理」\n'
    + '「外資加碼，市場熱絡，買盤踴躍」\n\n'
    + '劣質範例（不要）：\n'
    + '✗「上漲 X 支下跌 Y 支」← 純複述數字\n'
    + '✗「平均上漲 X%」← 太機械\n\n'
    + '直接回答觀察文字，不加前綴或解釋。';

  let note = '';
  try {
    const r = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: '你只回 22 字內市場氛圍觀察句，純陳述事實，禁止複述數字。' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 80,
    });
    note = (r.response || '').trim().replace(/^[「『]|[」』]$/g, '').slice(0, 100);
    if (!isContentSafe(note)) note = '';
  } catch (e) {}

  if (!note) {
    note = sentiment === 'bullish' ? marketName + '多頭氣氛濃厚，類股齊漲'
         : sentiment === 'bearish' ? marketName + '賣壓沉重，氣氛轉謹慎'
         : marketName + '漲跌互見，缺乏明確方向';
  }

  return jsonResponse({
    market,
    sentiment,
    label,
    note,
    stats: {
      upCount, downCount, flatCount,
      avgPct: Number(avgPct.toFixed(2)),
      strongUp, strongDown,
      total: validItems.length
    },
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

    // === /health endpoint (v200) ===
    if (request.method === 'GET' && new URL(request.url).pathname === '/health') {
      return jsonResponse({
        ok: true,
        service: 'moneyradar-ai-proxy',
        version: 'v200',
        timestamp: new Date().toISOString(),
        endpoints: ['/chat', '/briefing', '/heatmap', '/analysis', '/digest', '/quote', '/market-briefing', '/health']
      });
    }
        // === /global-quick-analysis (v202) ===
    if (request.method === 'POST' && new URL(request.url).pathname === '/global-quick-analysis') {
      try {
        const body = await request.json();
        const { symbol, name, price, changePercent, currency } = body;
        if (!symbol) return jsonResponse({ error: 'symbol required' }, 400);
        const sign = (changePercent || 0) >= 0 ? '+' : '';
        const prompt = `你是 MoneyRadar 公開資訊整理員。針對下列股票，用繁體中文 100-150 字解析「市場可能反映哪些訊息」。

股票：${name || symbol} (${symbol})
今日價格：${price} ${currency || ''}
漲跌：${sign}${(changePercent||0).toFixed(2)}%

要求：
1. 從產業趨勢、總體經濟、公司面三角度推測（用「市場或關注 XX」、「投資人可能擔心 XX」這類措詞）
2. 不得給買賣建議（禁用：建議買、建議賣、目標價、會漲到、值得買）
3. 不得預測股價
4. 不得編造市值、EPS、營收等具體數字
5. 結尾不需自己加免責聲明（系統會附）`;
        const aiRes = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [
            { role: 'system', content: '你是公開資訊整理員，絕不提供投資建議。' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 400
        });
        let analysis = aiRes.response || '';
        if (!isContentSafe(analysis)) {
          analysis = '⚠️ 為符合金管會規範，本助理不能提供投資建議。';
        }
        return jsonResponse({
          symbol, analysis, disclaimer: DISCLAIMER, updated: new Date().toISOString()
        });
      } catch (e) {
        return jsonResponse({ error: 'analysis failed: ' + (e.message || e) }, 500);
      }
    }

        // === /quote-batch (v203, hotfix: 用並發 chart) ===
    if (request.method === 'GET' && new URL(request.url).pathname === '/quote-batch') {
      const u = new URL(request.url);
      const syms = (u.searchParams.get('symbols') || '').split(',').filter(Boolean);
      if (syms.length === 0) return jsonResponse({ error: 'symbols required' }, 400);
      if (syms.length > 30) return jsonResponse({ error: 'max 30 symbols' }, 400);
      const fetchOne = async (sym) => {
        try {
          const yr = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=1d&range=2d', {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MoneyRadar/1.0)' }
          });
          if (!yr.ok) return { symbol: sym, price: 0, changePercent: 0, error: 'http ' + yr.status };
          const yj = await yr.json();
          const meta = yj && yj.chart && yj.chart.result && yj.chart.result[0] && yj.chart.result[0].meta;
          if (!meta) return { symbol: sym, price: 0, changePercent: 0, error: 'no meta' };
          const price = meta.regularMarketPrice || 0;
          const prev = meta.previousClose || meta.chartPreviousClose || 0;
          const changePercent = (prev && price) ? ((price - prev) / prev * 100) : 0;
          return { symbol: sym, price, changePercent, currency: meta.currency || '' };
        } catch (e) {
          return { symbol: sym, price: 0, changePercent: 0, error: e.message || String(e) };
        }
      };
      try {
        const results = await Promise.all(syms.map(fetchOne));
        return jsonResponse({ symbols: syms, results, updated: new Date().toISOString() });
      } catch (e) {
        return jsonResponse({ error: 'batch failed: ' + (e.message || e) }, 500);
      }
    }

        // === /crypto-top (v205 hotfix: CoinCap fallback + 90s edge cache) ===
    if (request.method === 'GET' && new URL(request.url).pathname === '/crypto-top') {
      try {
        let result = null;
        // Primary: CoinGecko (TWD 直接計價)
        try {
          const r1 = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=twd&order=market_cap_desc&per_page=10&page=1&sparkline=false', { headers: { 'User-Agent': 'MoneyRadar/1.0' } });
          if (r1.ok) {
            const d1 = await r1.json();
            result = {
              source: 'coingecko', currency: 'TWD',
              results: d1.map(c => ({ symbol:(c.symbol||'').toUpperCase(), name:c.name, price:c.current_price||0, change24h:c.price_change_percentage_24h||0, marketCap:c.market_cap||0, image:c.image||'' }))
            };
          }
        } catch (e) {}
        // Fallback: CoinCap (USD, 200 calls/min 不太會 rate limit)
        if (!result) {
          try {
            const r2 = await fetch('https://api.coincap.io/v2/assets?limit=10', { headers: { 'User-Agent': 'MoneyRadar/1.0' } });
            if (r2.ok) {
              const d2 = (await r2.json()).data || [];
              result = {
                source: 'coincap', currency: 'USD',
                results: d2.map(c => ({ symbol:c.symbol, name:c.name, price:parseFloat(c.priceUsd)||0, change24h:parseFloat(c.changePercent24Hr)||0, marketCap:parseFloat(c.marketCapUsd)||0, image:'' }))
              };
            }
          } catch (e) {}
        }
        // Binance fallback (第三層)
        if (!result) {
          const map = [
            {s:'BTCUSDT',n:'Bitcoin',sym:'BTC'},{s:'ETHUSDT',n:'Ethereum',sym:'ETH'},
            {s:'SOLUSDT',n:'Solana',sym:'SOL'},{s:'BNBUSDT',n:'BNB',sym:'BNB'},
            {s:'XRPUSDT',n:'XRP',sym:'XRP'},{s:'ADAUSDT',n:'Cardano',sym:'ADA'},
            {s:'AVAXUSDT',n:'Avalanche',sym:'AVAX'},{s:'DOGEUSDT',n:'Dogecoin',sym:'DOGE'},
            {s:'LINKUSDT',n:'Chainlink',sym:'LINK'},{s:'TRXUSDT',n:'TRON',sym:'TRX'}
          ];
          const symbolsParam = encodeURIComponent(JSON.stringify(map.map(x => x.s)));
          const r3 = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbols=' + symbolsParam);
          if (!r3.ok) return jsonResponse({ error: 'all sources failed; binance ' + r3.status }, 502);
          const d3 = await r3.json();
          const dmap = {};
          d3.forEach(t => { dmap[t.symbol] = t; });
          result = {
            source: 'binance', currency: 'USD',
            results: map.map(m => {
              const t = dmap[m.s] || {};
              return { symbol: m.sym, name: m.n, price: parseFloat(t.lastPrice)||0, change24h: parseFloat(t.priceChangePercent)||0, marketCap: 0, image: '' };
            })
          };
        }
        const resp = jsonResponse({ ...result, updated: new Date().toISOString() });
        resp.headers.set('Cache-Control', 'public, s-maxage=90');
        return resp;
      } catch (e) { return jsonResponse({ error: e.message || String(e) }, 500); }
    }

        // === /sentiment-score (v206) ===
    if (request.method === 'GET' && new URL(request.url).pathname === '/sentiment-score') {
      const u = new URL(request.url);
      const sym = u.searchParams.get('symbol');
      if (!sym) return jsonResponse({ error: 'symbol required' }, 400);
      try {
        const yr = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=1d&range=1mo', { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!yr.ok) return jsonResponse({ error: 'yahoo ' + yr.status }, 502);
        const yj = await yr.json();
        const result = yj && yj.chart && yj.chart.result && yj.chart.result[0];
        if (!result) return jsonResponse({ error: 'no data' }, 404);
        const closes = (result.indicators.quote[0].close || []).filter(x => x != null);
        if (closes.length < 5) return jsonResponse({ error: 'insufficient' }, 404);
        const last = closes[closes.length - 1];
        const ma5 = closes.slice(-5).reduce((a,b)=>a+b,0) / 5;
        const ma20 = closes.length >= 20 ? closes.slice(-20).reduce((a,b)=>a+b,0) / 20 : ma5;
        const upDays = closes.slice(-10).reduce((acc, c, i, arr) => i > 0 && c > arr[i-1] ? acc + 1 : acc, 0);
        const baseIdx = Math.max(0, closes.length - 11);
        const recentChange = ((last - closes[baseIdx]) / closes[baseIdx]) * 100;
        let score = 50;
        if (last > ma5) score += 10;
        if (last > ma20) score += 15;
        if (ma5 > ma20) score += 10;
        score += Math.min(15, Math.max(-15, recentChange * 0.5));
        score += (upDays - 5) * 2;
        score = Math.max(0, Math.min(100, Math.round(score)));
        let label = '中性', color = '#fbbf24';
        if (score >= 70) { label = '偏強'; color = '#16a34a'; }
        else if (score <= 30) { label = '偏弱'; color = '#dc2626'; }
        return jsonResponse({ symbol: sym, score, label, color, metrics: { last, ma5, ma20, upDays, recentChange }, updated: new Date().toISOString() });
      } catch (e) { return jsonResponse({ error: e.message || String(e) }, 500); }
    }

    // === Inline /quote GET handler (v199 hotfix) ===
    if (request.method === 'GET' && new URL(request.url).pathname === '/quote') {
      const url2 = new URL(request.url);
      const symbol = url2.searchParams.get('symbol');
      if (!symbol) return jsonResponse({ error: 'symbol required' }, 400);
      try {
        const yr = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) + '?interval=1d&range=2d', {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MoneyRadar/1.0)' }
        });
        if (!yr.ok) return jsonResponse({ error: 'yahoo http ' + yr.status }, 502);
        const yj = await yr.json();
        const meta = yj && yj.chart && yj.chart.result && yj.chart.result[0] && yj.chart.result[0].meta;
        if (!meta) return jsonResponse({ error: 'not found' }, 404);
        const price = meta.regularMarketPrice;
        const prev = meta.previousClose || meta.chartPreviousClose;
        const changePercent = (prev && price) ? ((price - prev) / prev * 100) : 0;
        return jsonResponse({
          symbol, price, prevClose: prev, changePercent,
          currency: meta.currency || '', marketState: meta.marketState || '',
          source: 'yahoo', updated: new Date().toISOString()
        });
      } catch (e) {
        return jsonResponse({ error: 'fetch failed: ' + (e.message || String(e)) }, 500);
      }
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
      if (url.pathname === '/digest') return await handleDigest(request, env);
      if (url.pathname === '/quote') return await handleQuote(request, env);
      if (url.pathname === '/market-briefing') return await handleMarketBriefing(request, env);
      return await handleSummary(request, env);
    } catch (err) {
      return jsonResponse({ error: err.message || 'Internal error' }, 500);
    }
  },
};
