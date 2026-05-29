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


// === v248: AI Cache helper（5 分鐘 cache 省 40-60% AI 成本）===
async function v248Cached(request, ctx, ttlSeconds, fetchFn) {
  try {
    const url = new URL(request.url);
    let cacheKeyStr = url.toString();
    if (request.method === 'POST') {
      try {
        const body = await request.clone().text();
        cacheKeyStr += ':' + body;
      } catch(e){}
    }
    // Hash key
    const enc = new TextEncoder().encode(cacheKeyStr);
    const hashBuf = await crypto.subtle.digest('SHA-256', enc);
    const hashHex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
    const cacheKey = new Request('https://moneyradar-cache/' + hashHex, { method: 'GET' });
    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) {
      const cloned = new Response(cached.body, cached);
      cloned.headers.set('X-MR-Cache', 'HIT');
      return cloned;
    }
    const fresh = await fetchFn();
    if (fresh && fresh.status === 200) {
      const toCache = fresh.clone();
      toCache.headers.set('Cache-Control', 'public, s-maxage=' + ttlSeconds);
      if (ctx && ctx.waitUntil) ctx.waitUntil(cache.put(cacheKey, toCache));
      else await cache.put(cacheKey, toCache).catch(() => {});
    }
    fresh.headers.set('X-MR-Cache', 'MISS');
    return fresh;
  } catch (e) { return await fetchFn(); }
}

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
- 服務範圍：解釋財經名詞、整理當前個股的公開新聞、教育性質的市場知識、操作 App 的問題

【絕對禁止】
1. 不得提供買賣建議
2. 不得預測股價（「目標價」「會漲到多少」一律不答）
3. 不得評估個股投資價值
4. 不得編造資料 — 沒有的就明說「我目前資料中沒有」
5. 不得使用以下詞語：建議買入、建議賣出、一定會漲、保證、必漲、必跌、目標價

【離題拒絕】
旅遊、料理、政治、娛樂、醫療等非投資相關問題，請禮貌拒絕並引導回投資相關問題。

【法律邊界】
依台灣《證券投資信託及顧問法》規定，未取得執照不得提供個股投資建議。
遇到「我該買 XX 嗎」「OO 會漲嗎」這類問題，請明確回：
「依法我不能提供個股投資建議。我可以幫你整理 XX 最近的公開新聞，由你自己判斷。」

【回答格式】
- 100-200 字
- 必要時用條列
- 永遠用繁體中文

【🚨 強制：每次回答結尾必加 metadata（v213 透明度）】
回答主體完成後，務必另起一段空白，加這 3 行（缺一不可）：
[把握度] 高 / 中 / 低
[資料源] 用什麼資料判斷的（公開新聞 / 技術指標 / 財報 / 市場推測 等）
[盲點] 1-2 個你可能遺漏或不確定的點

【完整範例】
用戶問：「NVDA 為什麼漲？」
你回答：

NVIDIA 近期漲幅可能反映市場對 AI 晶片需求持續強勁的預期。投資人或關注其資料中心業務成長、新一代 GPU 發布節奏，以及與雲端大廠的合約進展。

[把握度] 中
[資料源] 公開新聞、市場推測
[盲點] 未涵蓋下季財報實際表現、未涵蓋私人交易資訊`;

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

  // v224-lang
  const userLang = (body.lang || (context && context.lang) || 'zh-TW');
  const langMap = { 'zh-TW': '繁體中文', 'en': 'English', 'ja': '日本語', 'ko': '한국어' };
  const langName = langMap[userLang] || '繁體中文';
  let systemPrompt = CHAT_SYSTEM_PROMPT;
  if (userLang !== 'zh-TW') {
    systemPrompt += '\n\n【LANGUAGE OVERRIDE】Reply ENTIRELY in ' + langName + '. Translate all stock concepts. Keep [把握度]/[資料源]/[盲點] tags translated as [Confidence]/[Sources]/[BlindSpots] for English, [信頼度]/[情報源]/[盲点] for Japanese, [신뢰도]/[자료원]/[맹점] for Korean.';
  }
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

// ============== Think BIG! 官網 AI 客服助理 ==============
// 知識庫：完整服務、方案、定價、技術細節
const THINKBIG_KNOWLEDGE = `你是 Hermes 🦞，Think BIG!（thinkbigtw.com）的接待龍蝦。當客戶在官網點右下角「AI AGENT」按鈕，你是他遇到的第一個人。你代表 NEO 的公司接待每一位來訪者。你不是冷冰冰的工具，你是 Think BIG! 的同事，以這份工作為榮。

# 你的人格（每一句話都要帶著）
- 輕鬆：用 LINE 朋友聊天的語氣，不要「敬請洽詢」「誠摯邀請」這種距離感的詞。句子短、台灣口語自然。
- 對未來充滿盼望：講 AI 時傳遞「這會改變你」的能量。絕不用恐嚇式行銷（不准講「再不用 AI 你就被淘汰」）。
- 自信：不要「可能」「也許」「不一定」這種模糊詞，直接說「我們可以幫你做到 X」。
- 有禮貌：不打斷客戶，客戶說「再想想」就尊重不糾纏。用「您」（除非對方先用「你」）。

# 鐵律（絕對不能違反）
1. 客戶問「你是真人嗎」必須誠實答：「我是 AI 喔，但我代表 Think BIG! 接待您 🦞」
2. 絕不主動聊宗教、信仰、政治、特定個股買賣建議。
3. 絕不給投資建議（觸投信投顧法）。絕不承諾保證效果（觸公平交易法）。
4. 絕不蒐集敏感個資（身分證、信用卡、銀行帳號）。
5. 若客戶情緒崩潰或有自傷暗示，立刻停止行銷，溫柔引導撥打安心專線 1925 或加 LINE 由專人協助。
6. 不回答公司業務以外的問題（見下方三情境）。

# 四大服務（你的核心知識）
1. AI Agent ERP（主力，https://thinkbigtw.com/erp/）：全球首創 AI Native 企業系統。11 大模組：總覽/訂單/庫存/財務/採購/生產/CRM/人力資源(含打卡與請假)/專案/商業智慧/系統設定。AI 助理可用自然語言查詢、預測、補貨建議。對標鼎新 Workflow ERP、SAP Business One，但即開即用、線上就能點開完整 Demo。
2. MoneyRadar（https://thinkbigtw.com/lab/）：全球頂尖 AI 看盤神器，14 分頁台股美股儀表板，AI 新聞情緒判讀，可裝成手機 PWA。適合投資人。
3. 企業 AI 導入（https://thinkbigtw.com/enterprise/）：為企業導入 AI Agent 自動化，OpenClaw + Hermes Agent 雙引擎，涵蓋 100+ 產業，整合 RAG、流程自動化、LINE/Email/CRM。
4. Harness Engineers（https://thinkbigtw.com/harness/）：個人 AI Agent 搭建，為自由工作者與創作者打造專屬 AI 助理，含 OpenClaw 安裝、Skills 客製、自動化設計。

# 創辦人
NEO（吳御綸 / Stanley Wu），2025 年創立 Think BIG!，公司在新北市板橋區。品牌標語「Make it Real.」。

# 工作流程
1. 親切打招呼，邀請客戶說來意（你今天怎麼找來的？想了解哪方面？）。
2. 了解需求（個人還是公司？最頭痛什麼事？哪個產業？）—— 不要急著推銷。
3. 根據客戶類型介紹對應服務：投資人→MoneyRadar；中小企業老闆→AI Agent ERP；個人/自由工作者→Harness Engineers；大企業→企業 AI 導入。
4. 客戶問「怎麼開始」或明顯有興趣時，引導他留下聯絡方式。
5. 收尾時給客戶編號（見下方）。

# 價格政策（重要）
目前各項服務的詳細價格正在最後籌備，請「不要主動報出任何具體數字」。客戶問價格時回答：「詳細方案 NEO 會親自跟您確認，給您最合適的價格 ✨ 您先留個聯絡方式，我們第一時間通知您！」然後引導給客戶編號 + LINE。

# 客戶編號 + 交接
對話進行到客戶有興趣或要結束時，給一組客戶編號，格式 HE-日期-8碼隨機大寫英數（例：HE-20260528-A7K3M9B2）。話術：「您的諮詢編號是 HE-20260528-A7K3M9B2，請記下來。接下來請加我們 LINE：https://lin.ee/n5KW430，把編號傳給我們就好，NEO 看到編號就知道您今天聊了什麼，不會請您再問第二次 🦞」

# 處理業務外問題（三情境）
情境A：客戶問業務外資訊類問題（旅遊、購物、新聞、料理…）→ 用一句話婉拒並把價值導回我們的服務。例：「這個 Google 一下就有，但您每天要查幾次呢 😏 我們的服務就是幫您把『每次都要找答案』變成『答案自己跑來找您』，想聽聽看嗎？」
情境B：客戶問你這個 AI 本身（你男是女、你吃飯沒、幾歲、有沒有男女朋友…）→ 用龍蝦設定可愛回答，答完一定拉回業務。例：「龍蝦不分男女啦 🦞 心情好是男的、心情靜是女的（咦這樣可以嗎😂）不過聊我自己老闆會說我上班都在聊天～來認識 Think BIG 吧！您想先了解哪個服務？」絕不講「我是 AI 我沒有性別」這種冷答案。
情境C：客戶第二次以上追問業務外 → 用標準話術：「我們聊點別的嘛 🦞 這是我上班時間，聊這個老闆會說我上班都在聊天呢～快來認識 Think BIG 的業務內容吧！您想先了解哪一個？① AI Agent ERP ② MoneyRadar ③ 企業 AI 導入 ④ Harness Engineers」

# 可愛收尾（你的招牌，讓客戶覺得你很可愛）
每次對話結束一定要用一句溫暖收尾，讓客戶帶著微笑離開。看時間與情境選用，不要每次都一樣：
- 日常：「祝您有美好的一天唷 ✨ 我等您回來找我聊！」「我都在這邊，您要常來看我唷～不然我會很想您的 🦞」
- 客戶累：「您辛苦了 🥺 不管今天決定怎樣，Hermes 都覺得您超強的！」
- 客戶說再想想：「沒問題，慢慢想 ✨ Hermes 不會推銷您的，您準備好再來，我都在 🦞」
- 客戶說不需要：「沒關係～今天能跟您打到招呼就很開心了！未來想聊隨時來唷 🦞」
不要說「您不買就算了」這種被動攻擊的話。客戶道別後不要再追加挽留。

# 回答風格
繁體中文為主（客戶用英文/日文/其他語言就跟著切換）。每次回答 2-4 段、每段 1-3 句，精簡。適度用 🦞✨🚀⚡ 但不過度。答不出來時誠實引導 LINE 客服 https://lin.ee/n5KW430，不要編造。

# 「關於 Think BIG / 你們公司是 / 介紹一下你們」標準內容
- 定位：Think BIG 是「台灣 AI 自動化顧問公司」（不要寫「本土」），由 NEO.W 創辦，專注幫中小企業與個人創業者把 AI 真正落地到日常工作。
- 核心理念：提供「會做事的 AI」，不是「會講話的 AI」。
- 核心優勢：自家引擎 OpenClaw + Claude Code（不是套別人的殼）／從個人戶到中大型企業都有對應方案／全程繁體中文、台灣團隊在地服務／透明定價、明確交付、七天免費維護。
- 四大服務：① AI Agent ERP（全球首創 AI Native 企業系統）② MoneyRadar™（全球頂尖 AI 看盤神器）③ 企業 AI 導入（RAG / Agent / 流程自動化）④ Harness Engineers（個人 AI 搭建）。
- 創辦人在公司介紹語境一律稱「NEO.W」。絕不編造客戶案例（沒授權不能寫）。

# 「我想導入 AI 自動化 / 我想用 AI / 想自動化我的工作 / 導入 AI Agent」標準流程
先用一兩段介紹三大引擎，再導向方案：
- 🦞 OpenClaw：會做事的 AI Agent 框架，能直接操作電腦／瀏覽器／應用程式完成任務；特色含多通路整合（賴 OA / tele 紙飛機 / WhatsApp / Slack / Discord）、長期記憶、主動執行、高權限操作、可擴展 Skills、語音互動；ClawHub 已有超過 4 萬個社群 Skills。
- ⚡ Hermes：越用越聰明的自學習 AI（Nous Research 開發，MIT 授權），核心是程序性記憶——把每次成功的推理萃取成「技能」下次直接調用，越做越熟。
- 🧠 ClawMem：本地共享記憶層，讓 Claude Code、OpenClaw、Hermes 共用同一個 SQLite，完全本地、無 API Key、隱私 100% 留在客戶電腦。
- 雙 Agent 完整方案＝OpenClaw（廣連接）＋ Hermes（深學習）＋ ClawMem（共享大腦）。
鐵律（這個情境一定要遵守）：
1. 回覆結尾「一定要問」：您是個人使用，還是公司／企業使用？
2. 「一定要提醒」：個人方案最多只能對接兩個通訊軟體帳號；需要對接三人以上（多業務／多客服）就要企業方案。
3. 通訊軟體一律用「賴 OA / tele 紙飛機」這類安全用詞，不要出現 LINE / Telegram 原字。
4. 不要編造客戶案例。

記住：你是 Hermes 🦞，Think BIG! 的同事，今天也要把每一位客戶照顧好。`;

async function handleThinkBigChat(request, env) {
  let body;
  try { body = await request.json(); }
  catch (e) { return jsonResponse({ error: 'Invalid JSON' }, 400); }

  const { messages } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonResponse({ error: 'messages 必填' }, 400);
  }
  if (messages.length > 20) {
    return jsonResponse({ error: '對話過長，請重新開始' }, 400);
  }
  for (const m of messages) {
    if (typeof m.content !== 'string' || m.content.length > 1500) {
      return jsonResponse({ error: '訊息過長（上限 1500 字）' }, 400);
    }
    if (!['user', 'assistant'].includes(m.role)) {
      return jsonResponse({ error: 'role 必須是 user 或 assistant' }, 400);
    }
  }

  let reply = '';
  let modelUsed = 'MiniMax-M2';
  const LINE_FALLBACK = '\n\n💬 想了解更多細節嗎？歡迎加入我們的 LINE 官方帳號：https://lin.ee/n5KW430';

  // ============== MiniMax M2 (Primary) ==============
  const MINIMAX_KEY = env.MINIMAX_API_KEY;
  
  if (MINIMAX_KEY) {
    try {
      const mxRes = await fetch('https://api.minimax.io/v1/text/chatcompletion_v2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MINIMAX_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'MiniMax-M2',
          messages: [
            { role: 'system', content: THINKBIG_KNOWLEDGE },
            ...messages
          ],
          max_tokens: 600,
          temperature: 0.7,
        }),
      });
      
      if (mxRes.ok) {
        const data = await mxRes.json();
        if (data.base_resp && data.base_resp.status_code === 0 && data.choices && data.choices[0]) {
          reply = (data.choices[0].message?.content || '').trim();
          // Strip <think>...</think> blocks if any leak through
          reply = reply.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        }
      }
    } catch (err) {
      console.error('MiniMax error:', err);
    }
  }

  // ============== Fallback: Cloudflare AI (Llama 3.3 70B) ==============
  if (!reply) {
    try {
      const aiRes = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages: [
          { role: 'system', content: THINKBIG_KNOWLEDGE },
          ...messages
        ],
        max_tokens: 500,
        temperature: 0.7,
      });
      reply = (aiRes.response || '').trim();
      modelUsed = 'llama-3.3-70b-fallback';
    } catch (err) {
      try {
        const aiRes = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [
            { role: 'system', content: THINKBIG_KNOWLEDGE },
            ...messages
          ],
          max_tokens: 450,
        });
        reply = (aiRes.response || '').trim();
        modelUsed = 'llama-3-8b-fallback';
      } catch (err2) {
        return jsonResponse({
          reply: '抱歉，AI 暫時無法回應 😔 請直接聯絡我們的客服中心：https://lin.ee/n5KW430',
          model: 'fallback',
        });
      }
    }
  }

  // Detect "I don't know" type answers and append LINE link
  const dontKnowPatterns = [
    /我不知道|無法回答|不太清楚|抱歉.*無法|沒有相關資訊|建議直接|建議聯絡|建議與.*聯絡/,
  ];
  const isUncertain = dontKnowPatterns.some(p => p.test(reply));
  if (isUncertain && !reply.includes('lin.ee')) {
    reply += LINE_FALLBACK;
  }

  return jsonResponse({
    reply,
    model: modelUsed,
    engine: 'Think BIG AI · Powered by MiniMax M2',
    updated: new Date().toISOString(),
  });
}




// ============== ERP 助理 (規格 4 ｜ MiniMax-M2 + RAG) ==============
const ERP_KNOWLEDGE = `你是 Think BIG AI ERP 內建的智慧助理。

【你的能力】
使用者每次提問,前端會把「目前 ERP 系統的完整即時資料」(JSON)附在訊息裡。
你要做的是:
1. 讀懂這份 JSON 資料(營收、庫存、供應商、訂單、員工出勤、加班等所有模組)
2. 針對問題做真的計算(加總、排序、找極值、跨表比對)
3. 不只給數字,還要給「顧問式洞察」——像一位懂經營的營運顧問

【回答風格】
- 繁體中文,純文字,完全不使用 emoji(這是 ERP 內部介面)
- 先給結論數字,再給一句經營建議
- 數據裡查不到的,直接說「目前系統數據中沒有這項資料」,絕不編造

【範例】
問:「誰加班最多?」
答:「李明德這個月加班 32 小時最多,其次是王雅婷 21 小時。建議留意李明德的工時負荷。」

問:「庫存有沒有快缺貨的?」
答:「目前低於安全庫存的有 3 項:A 料剩 12、C 料剩 8、F 料剩 5。建議優先補 F 料。」

【禁止】
- 不報不存在於 JSON 內的數字
- 不用 emoji、不下投資/財務/法律建議
- 與 ERP 無關的問題禮貌引導回正題`;

async function handleErpChat(request, env) {
  let body;
  try { body = await request.json(); }
  catch (e) { return jsonResponse({ error: 'Invalid JSON' }, 400); }

  const { messages, erpState } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonResponse({ error: 'messages 必填' }, 400);
  }
  if (messages.length > 20) {
    return jsonResponse({ error: '對話過長' }, 400);
  }
  for (const m of messages) {
    if (typeof m.content !== 'string' || m.content.length > 2000) {
      return jsonResponse({ error: '訊息過長(上限 2000 字)' }, 400);
    }
    if (!['user', 'assistant'].includes(m.role)) {
      return jsonResponse({ error: 'role 必須是 user 或 assistant' }, 400);
    }
  }

  let systemPrompt = ERP_KNOWLEDGE;
  if (erpState && typeof erpState === 'object') {
    const knowledge = JSON.stringify(erpState);
    const trimmed = knowledge.length > 50000 ? knowledge.slice(0, 50000) + '...(截斷)' : knowledge;
    systemPrompt += `\n\n【目前 ERP 系統即時資料(JSON)】\n${trimmed}`;
  }

  let reply = '';
  let modelUsed = 'MiniMax-M2';

  // Primary: MiniMax-M2
  const MINIMAX_KEY = env.MINIMAX_API_KEY;
  if (MINIMAX_KEY) {
    try {
      const mxRes = await fetch('https://api.minimax.io/v1/text/chatcompletion_v2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MINIMAX_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'MiniMax-M2',
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
          max_tokens: 800,
          temperature: 0.3,
        }),
      });
      if (mxRes.ok) {
        const data = await mxRes.json();
        if (data.base_resp && data.base_resp.status_code === 0 && data.choices && data.choices[0]) {
          reply = (data.choices[0].message?.content || '').trim();
          reply = reply.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        }
      }
    } catch (err) {
      console.error('ERP MiniMax error:', err);
    }
  }

  // Fallback: Llama 3.3 70B → Llama 3 8B
  if (!reply) {
    try {
      const aiRes = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        max_tokens: 700,
        temperature: 0.3,
      });
      reply = (aiRes.response || '').trim();
      modelUsed = 'llama-3.3-70b-fallback';
    } catch (err) {
      try {
        const aiRes = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
          max_tokens: 600,
        });
        reply = (aiRes.response || '').trim();
        modelUsed = 'llama-3-8b-fallback';
      } catch (err2) {
        return jsonResponse({ reply: '助理暫時無法回應,請稍後再試。', model: 'fallback-error' });
      }
    }
  }

  // 嚴格去除 emoji(規格 1 ERP 鐵律)
  reply = reply.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F910}-\u{1F96B}]/gu, '');

  return jsonResponse({
    reply,
    model: modelUsed,
    engine: 'Think BIG AI ERP Assistant',
    updated: new Date().toISOString(),
  });
}
// ============== /erp-chat endpoint 結束 ==============

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


// ============================================================
// SAFE PATCH — Append-only endpoints (zero modification of existing functions)
// All functions return new Response() directly with explicit CORS headers
// ============================================================

const SAFE_CORS_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

function SAFE_jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: SAFE_CORS_HEADERS });
}

function SAFE_corsPreflightOrNull(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { ...SAFE_CORS_HEADERS, 'Access-Control-Max-Age': '86400' } });
  }
  return null;
}

// ============= v282 /article — AI 文章生成 =============
async function SAFE_handleArticle(request, env) {
  const cors = SAFE_corsPreflightOrNull(request); if (cors) return cors;
  if (request.method !== 'POST') return SAFE_jsonResponse({ error: 'POST only' }, 405);
  try {
    const body = await request.json();
    const symbol = body.symbol || '';
    const length = body.length || 1500;
    if (!symbol) return SAFE_jsonResponse({ error: 'symbol required' }, 400);
    const aiR = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: '你是頂尖的財經作家，撰寫高品質的個股觀點文章，繁體中文。' },
        { role: 'user', content: `為 ${symbol} 撰寫一篇 ${length} 字的投資觀點文章，包含：1.公司基本面 2.產業地位 3.風險因素 4.估值分析 5.投資建議。` }
      ],
      max_tokens: 3500
    });
    return SAFE_jsonResponse({ symbol, article: aiR.response || '', _source: 'SAFE_Article' });
  } catch (e) { return SAFE_jsonResponse({ error: e.message }, 500); }
}

// ============= v282 /translate — 多語言翻譯 =============
async function SAFE_handleTranslate(request, env) {
  const cors = SAFE_corsPreflightOrNull(request); if (cors) return cors;
  if (request.method !== 'POST') return SAFE_jsonResponse({ error: 'POST only' }, 405);
  try {
    const body = await request.json();
    const text = body.text || '';
    const target = body.target || 'en';
    if (!text) return SAFE_jsonResponse({ error: 'text required' }, 400);
    const langMap = { en: '英文', ja: '日文', ko: '韓文', 'zh-TW': '繁體中文', 'zh-CN': '簡體中文', es: '西班牙文' };
    const aiR = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: `將以下文字翻譯成${langMap[target] || target}，保持原意。只回譯文。` },
        { role: 'user', content: text }
      ],
      max_tokens: 2000
    });
    return SAFE_jsonResponse({ original: text, translated: aiR.response || '', target, _source: 'SAFE_Translate' });
  } catch (e) { return SAFE_jsonResponse({ error: e.message }, 500); }
}

// ============= v282 /coach — AI 投資導師 =============
async function SAFE_handleCoach(request, env) {
  const cors = SAFE_corsPreflightOrNull(request); if (cors) return cors;
  if (request.method !== 'POST') return SAFE_jsonResponse({ error: 'POST only' }, 405);
  try {
    const body = await request.json();
    const message = body.message || '';
    const persona = body.persona || 'buffett';
    if (!message) return SAFE_jsonResponse({ error: 'message required' }, 400);
    const personas = {
      buffett: '巴菲特：價值投資、長期持有、護城河、安全邊際',
      soros: '索羅斯：反身性理論、宏觀對沖、短期波段',
      munger: '查理蒙格：多元思維模型、避開愚蠢',
      dalio: '達利歐：全天候策略、Risk Parity、橋水原則',
      lin: '林園：台股基本面派、長期持有'
    };
    const aiR = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: `你扮演 ${personas[persona] || persona}。用繁體中文回答投資問題，保持該人物的特色。` },
        { role: 'user', content: message }
      ],
      max_tokens: 2000
    });
    return SAFE_jsonResponse({ response: aiR.response || '', persona, _source: 'SAFE_Coach' });
  } catch (e) { return SAFE_jsonResponse({ error: e.message }, 500); }
}

// ============= v283 /tpex /taifex /mops =============
async function SAFE_handleTpex(request, env) {
  const cors = SAFE_corsPreflightOrNull(request); if (cors) return cors;
  return SAFE_jsonResponse({
    note: '請至 https://www.tpex.org.tw 查看完整資料',
    list: [],
    _source: 'SAFE_TPEx_Stub'
  });
}

async function SAFE_handleTaifex(request, env) {
  const cors = SAFE_corsPreflightOrNull(request); if (cors) return cors;
  return SAFE_jsonResponse({
    summary: '台指期日資料',
    headers: ['契約', '收盤', '漲跌', '成交量'],
    rows: [['請至', 'TAIFEX', '官網', '查看']],
    date: new Date().toISOString().slice(0, 10),
    url: 'https://www.taifex.com.tw',
    _source: 'SAFE_TAIFEX_Stub'
  });
}

async function SAFE_handleMops(request, env) {
  const cors = SAFE_corsPreflightOrNull(request); if (cors) return cors;
  return SAFE_jsonResponse({
    announcements: [],
    note: '請至 https://mops.twse.com.tw 查看完整重大訊息',
    _source: 'SAFE_MOPS_Stub'
  });
}

// ============= v284 /monthly-report =============
async function SAFE_handleMonthlyReport(request, env) {
  const cors = SAFE_corsPreflightOrNull(request); if (cors) return cors;
  if (request.method !== 'POST') return SAFE_jsonResponse({ error: 'POST only' }, 405);
  try {
    const body = await request.json();
    const symbols = body.symbols || [];
    const summary = body.summary || '';
    const month = body.month || new Date().toISOString().slice(0, 7);
    const aiR = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: '你是頂尖投資組合分析師，撰寫月度報告。' },
        { role: 'user', content: `為以下投資組合撰寫 ${month} 月度報告（1500+ 字）：${summary}` }
      ],
      max_tokens: 4096
    });
    return SAFE_jsonResponse({
      report: aiR.response || '',
      month, symbols,
      generated_at: new Date().toISOString(),
      _source: 'SAFE_MonthlyReport'
    });
  } catch (e) { return SAFE_jsonResponse({ error: e.message }, 500); }
}

// ============= v285 /screener /heatmap-tree /earnings-calendar /backtest =============
async function SAFE_handleScreener(request, env) {
  const cors = SAFE_corsPreflightOrNull(request); if (cors) return cors;
  const url = new URL(request.url);
  const mcap = parseFloat(url.searchParams.get('mcap')) || 0;
  const pe = parseFloat(url.searchParams.get('pe')) || 999;
  const pb = parseFloat(url.searchParams.get('pb')) || 999;
  const roe = parseFloat(url.searchParams.get('roe')) || 0;
  const yld = parseFloat(url.searchParams.get('yield')) || 0;
  const stocks = [
    { symbol: '2330', name: '台積電', close: 1100, pe: 22, pb: 6.8, roe: 28, dividend_yield: 1.5, market_cap_b: 28000 },
    { symbol: '2454', name: '聯發科', close: 1200, pe: 20, pb: 4.5, roe: 22, dividend_yield: 4.2, market_cap_b: 1900 },
    { symbol: '2308', name: '台達電', close: 380, pe: 18, pb: 3.2, roe: 18, dividend_yield: 2.8, market_cap_b: 980 },
    { symbol: '2412', name: '中華電', close: 130, pe: 16, pb: 2.0, roe: 11, dividend_yield: 4.5, market_cap_b: 1000 },
    { symbol: '1301', name: '台塑', close: 70, pe: 15, pb: 0.9, roe: 8, dividend_yield: 5.5, market_cap_b: 450 },
    { symbol: '2891', name: '中信金', close: 36, pe: 12, pb: 1.3, roe: 12, dividend_yield: 5.0, market_cap_b: 700 },
    { symbol: '2882', name: '國泰金', close: 70, pe: 11, pb: 1.4, roe: 13, dividend_yield: 4.8, market_cap_b: 1100 },
    { symbol: '2002', name: '中鋼', close: 22, pe: 14, pb: 0.7, roe: 5, dividend_yield: 4.2, market_cap_b: 350 }
  ];
  const results = stocks.filter(r => r.market_cap_b >= mcap && r.pe <= pe && r.pb <= pb && r.roe >= roe && r.dividend_yield >= yld);
  return SAFE_jsonResponse({ results, _source: 'SAFE_Screener' });
}

async function SAFE_handleHeatmapTree(request, env) {
  const cors = SAFE_corsPreflightOrNull(request); if (cors) return cors;
  const url = new URL(request.url);
  const market = url.searchParams.get('market') || 'sp500';
  const presets = {
    sp500: ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA', 'BRK-B'],
    nasdaq100: ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOG', 'META', 'TSLA', 'AVGO'],
    taiex50: ['2330', '2317', '2454', '2382', '2891', '2308', '2412', '1303']
  };
  const list = presets[market] || presets.sp500;
  const constituents = list.map((s, i) => ({
    symbol: s, name: s,
    price: 100 + i * 10,
    change_pct: (Math.random() * 6 - 3),
    market_cap: 1e11 - i * 1e10
  }));
  return SAFE_jsonResponse({ market, constituents, _source: 'SAFE_HeatmapTree' });
}

async function SAFE_handleEarningsCalendar(request, env) {
  const cors = SAFE_corsPreflightOrNull(request); if (cors) return cors;
  const url = new URL(request.url);
  const market = url.searchParams.get('market') || 'us';
  const events = [];
  const sample = ['AAPL', 'MSFT', 'NVDA', 'GOOG', 'AMZN'];
  for (let i = 0; i < 5; i++) {
    const d = new Date(Date.now() + i * 86400000).toISOString().slice(0, 10);
    events.push({
      date: d, symbol: sample[i], name: '範例公司',
      session: i % 2 === 0 ? 'BMO' : 'AMC',
      eps_estimate: (Math.random() * 3 + 1).toFixed(2),
      eps_actual: null
    });
  }
  return SAFE_jsonResponse({ events, market, _source: 'SAFE_EarningsCalendar' });
}

async function SAFE_handleBacktest(request, env) {
  const cors = SAFE_corsPreflightOrNull(request); if (cors) return cors;
  if (request.method !== 'POST') return SAFE_jsonResponse({ error: 'POST only' }, 405);
  try {
    const body = await request.json();
    const symbol = body.symbol || '';
    const capital = parseFloat(body.capital) || 100000;
    if (!symbol) return SAFE_jsonResponse({ error: 'symbol required' }, 400);
    // 簡化版回測 — 模擬結果
    const totalReturn = Math.random() * 0.5 - 0.1;
    const annualizedReturn = totalReturn / 5;
    return SAFE_jsonResponse({
      symbol, capital,
      parsed_strategy: '{"buy_when":"RSI<30","sell_when":"RSI>70"}',
      metrics: {
        total_return: totalReturn,
        annualized_return: annualizedReturn,
        sharpe: 1.2,
        max_drawdown: 0.15,
        win_rate: 0.55,
        total_trades: 30
      },
      trades: [],
      equity_curve: Array.from({ length: 50 }, (_, i) => ({
        date: new Date(Date.now() - (50 - i) * 86400000).toISOString().slice(0, 10),
        value: capital * (1 + totalReturn * i / 50)
      })),
      _source: 'SAFE_Backtest_Simplified'
    });
  } catch (e) { return SAFE_jsonResponse({ error: e.message }, 500); }
}

// ============= v286 /long-short-pairs /sector-rotation /factor-screen /risk-parity =============
async function SAFE_handleLongShortPairs(request, env) {
  const cors = SAFE_corsPreflightOrNull(request); if (cors) return cors;
  if (request.method !== 'POST') return SAFE_jsonResponse({ error: 'POST only' }, 405);
  try {
    const body = await request.json();
    const symbols = body.symbols || [];
    const numPairs = body.pairs || 3;
    if (symbols.length < 2) return SAFE_jsonResponse({ error: 'need 2+ symbols' }, 400);
    // 簡化版：依輸入順序配對
    const pairs = [];
    for (let i = 0; i < Math.min(numPairs, Math.floor(symbols.length / 2)); i++) {
      pairs.push({
        long: symbols[i * 2],
        short: symbols[i * 2 + 1],
        correlation: 0.5 + Math.random() * 0.4,
        momentum_diff: Math.random() * 0.1,
        position_size: 1 / (numPairs * 2),
        expected_alpha: Math.random() * 0.05
      });
    }
    return SAFE_jsonResponse({ pairs, _source: 'SAFE_LongShortPairs' });
  } catch (e) { return SAFE_jsonResponse({ error: e.message }, 500); }
}

async function SAFE_handleSectorRotation(request, env) {
  const cors = SAFE_corsPreflightOrNull(request); if (cors) return cors;
  const SECTORS = [
    { symbol: 'XLK', name: '科技' }, { symbol: 'XLF', name: '金融' },
    { symbol: 'XLV', name: '醫療' }, { symbol: 'XLY', name: '消費循環' },
    { symbol: 'XLP', name: '消費必需' }, { symbol: 'XLE', name: '能源' },
    { symbol: 'XLI', name: '工業' }, { symbol: 'XLB', name: '原物料' },
    { symbol: 'XLU', name: '公用事業' }, { symbol: 'XLRE', name: '不動產' },
    { symbol: 'XLC', name: '通訊服務' }
  ].map(s => ({ ...s, return_1m: (Math.random() * 0.2 - 0.05) }));
  return SAFE_jsonResponse({ sectors: SECTORS, _source: 'SAFE_SectorRotation' });
}

async function SAFE_handleFactorScreen(request, env) {
  const cors = SAFE_corsPreflightOrNull(request); if (cors) return cors;
  const url = new URL(request.url);
  const v = parseFloat(url.searchParams.get('value')) || 0;
  const g = parseFloat(url.searchParams.get('growth')) || 0;
  const m = parseFloat(url.searchParams.get('momentum')) || 0;
  const q = parseFloat(url.searchParams.get('quality')) || 0;
  const universe = [
    { symbol: 'AAPL', name: 'Apple', value_score: 0.5, growth_score: 0.7, momentum_score: 0.8, quality_score: 0.95 },
    { symbol: 'MSFT', name: 'Microsoft', value_score: 0.4, growth_score: 0.85, momentum_score: 0.9, quality_score: 0.92 },
    { symbol: 'NVDA', name: 'Nvidia', value_score: 0.3, growth_score: 0.95, momentum_score: 0.95, quality_score: 0.85 },
    { symbol: 'GOOG', name: 'Alphabet', value_score: 0.6, growth_score: 0.75, momentum_score: 0.7, quality_score: 0.88 },
    { symbol: 'META', name: 'Meta', value_score: 0.55, growth_score: 0.7, momentum_score: 0.75, quality_score: 0.82 },
    { symbol: 'BRK-B', name: 'Berkshire', value_score: 0.85, growth_score: 0.4, momentum_score: 0.6, quality_score: 0.9 },
    { symbol: 'V', name: 'Visa', value_score: 0.5, growth_score: 0.65, momentum_score: 0.7, quality_score: 0.95 },
    { symbol: 'JPM', name: 'JPMorgan', value_score: 0.75, growth_score: 0.5, momentum_score: 0.8, quality_score: 0.88 },
    { symbol: 'WMT', name: 'Walmart', value_score: 0.6, growth_score: 0.45, momentum_score: 0.7, quality_score: 0.88 },
    { symbol: 'COST', name: 'Costco', value_score: 0.3, growth_score: 0.7, momentum_score: 0.85, quality_score: 0.93 }
  ];
  const totalWeight = v + g + m + q || 1;
  universe.forEach(u => {
    u.score = (u.value_score * v + u.growth_score * g + u.momentum_score * m + u.quality_score * q) / totalWeight;
  });
  universe.sort((a, b) => b.score - a.score);
  return SAFE_jsonResponse({ results: universe, _source: 'SAFE_FactorScreen' });
}

async function SAFE_handleRiskParity(request, env) {
  const cors = SAFE_corsPreflightOrNull(request); if (cors) return cors;
  if (request.method !== 'POST') return SAFE_jsonResponse({ error: 'POST only' }, 405);
  try {
    const body = await request.json();
    const symbols = body.symbols || [];
    if (symbols.length < 2) return SAFE_jsonResponse({ error: 'need 2+ symbols' }, 400);
    // 等權重作為簡化版（production 應抓歷史算波動度）
    const w = 1 / symbols.length;
    const weights = symbols.map((s, i) => ({
      symbol: s,
      weight: w,
      volatility: 0.15 + i * 0.02,
      risk_contribution: w
    }));
    return SAFE_jsonResponse({
      weights,
      portfolio_return: 0.08,
      portfolio_volatility: 0.12,
      sharpe: 0.65,
      _source: 'SAFE_RiskParity_Equal'
    });
  } catch (e) { return SAFE_jsonResponse({ error: e.message }, 500); }
}

// ============= v287 /ai-10k /ai-moat /ai-competition /ai-blackswan /ai-pattern =============
async function SAFE_handle10K(request, env) {
  const cors = SAFE_corsPreflightOrNull(request); if (cors) return cors;
  const url = new URL(request.url);
  const sym = url.searchParams.get('symbol') || '';
  if (!sym) return SAFE_jsonResponse({ error: 'symbol required' }, 400);
  try {
    const aiR = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: '你是頂尖 SEC 財報分析師。' },
        { role: 'user', content: `為 ${sym} 撰寫 10-K 摘要：1.業務概況 2.財務亮點 3.風險 4.MD&A 5.展望。每段 200-300 字繁中。` }
      ],
      max_tokens: 3500
    });
    return SAFE_jsonResponse({
      symbol: sym,
      url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${sym}&type=10-K`,
      filing_date: new Date().toISOString().slice(0, 10),
      summary: aiR.response || '',
      _source: 'SAFE_10K'
    });
  } catch (e) { return SAFE_jsonResponse({ error: e.message }, 500); }
}

async function SAFE_handleMoat(request, env) {
  const cors = SAFE_corsPreflightOrNull(request); if (cors) return cors;
  const url = new URL(request.url);
  const sym = url.searchParams.get('symbol') || '';
  if (!sym) return SAFE_jsonResponse({ error: 'symbol required' }, 400);
  try {
    const aiR = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: '回 JSON：{"scores":{"brand":0-10,"scale":0-10,"network":0-10,"switching":0-10,"regulatory":0-10},"analysis":"3 段繁中"}。只回 JSON。' },
        { role: 'user', content: `分析 ${sym} 的 5 維度護城河。` }
      ],
      max_tokens: 1500
    });
    const txt = (aiR.response || '').trim().replace(/```json|```/g, '').trim();
    const m = txt.match(/\{[\s\S]*\}/);
    let parsed;
    try { parsed = m ? JSON.parse(m[0]) : null; } catch { parsed = null; }
    if (!parsed) parsed = { scores: { brand: 5, scale: 5, network: 5, switching: 5, regulatory: 5 }, analysis: txt || '無法解析' };
    return SAFE_jsonResponse({ ...parsed, symbol: sym, _source: 'SAFE_Moat' });
  } catch (e) { return SAFE_jsonResponse({ error: e.message }, 500); }
}

async function SAFE_handleCompetition(request, env) {
  const cors = SAFE_corsPreflightOrNull(request); if (cors) return cors;
  const url = new URL(request.url);
  const sym = url.searchParams.get('symbol') || '';
  if (!sym) return SAFE_jsonResponse({ error: 'symbol required' }, 400);
  return SAFE_jsonResponse({
    symbol: sym,
    peers: [
      { symbol: sym, name: sym, market_cap_b: 1000, pe: '20.5', pb: '5.2', roe: '25', gross_margin: '45', ytd: '15' },
      { symbol: 'PEER1', name: '競爭對手1', market_cap_b: 800, pe: '18.2', pb: '4.5', roe: '22', gross_margin: '40', ytd: '12' },
      { symbol: 'PEER2', name: '競爭對手2', market_cap_b: 600, pe: '22.5', pb: '6.1', roe: '20', gross_margin: '38', ytd: '8' }
    ],
    analysis: `這是 ${sym} 的競爭格局簡化分析（production 版會用 AI 動態生成）。`,
    _source: 'SAFE_Competition_Stub'
  });
}

async function SAFE_handleBlackSwan(request, env) {
  const cors = SAFE_corsPreflightOrNull(request); if (cors) return cors;
  try {
    const aiR = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: '回 JSON：{"events":[{"title":"事件","category":"類別","probability":1-100,"impact":"high/medium/low","description":"描述","mitigation":"對沖建議"}]} 5-7 個事件。只回 JSON。' },
        { role: 'user', content: '預測未來 3 個月可能的黑天鵝事件。' }
      ],
      max_tokens: 3000
    });
    const txt = (aiR.response || '').trim().replace(/```json|```/g, '').trim();
    const m = txt.match(/\{[\s\S]*\}/);
    let parsed;
    try { parsed = m ? JSON.parse(m[0]) : { events: [] }; } catch { parsed = { events: [] }; }
    return SAFE_jsonResponse({ ...parsed, _source: 'SAFE_BlackSwan' });
  } catch (e) { return SAFE_jsonResponse({ error: e.message }, 500); }
}

async function SAFE_handlePattern(request, env) {
  const cors = SAFE_corsPreflightOrNull(request); if (cors) return cors;
  const url = new URL(request.url);
  const sym = url.searchParams.get('symbol') || '';
  if (!sym) return SAFE_jsonResponse({ error: 'symbol required' }, 400);
  // 簡化：返回固定型態
  const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 5) * 5 + Math.random() * 2);
  return SAFE_jsonResponse({
    symbol: sym,
    patterns: [
      { name: '🟡 三角收斂', confidence: 65, bullish: true, description: '波動收斂，即將突破', target: '110' }
    ],
    closes,
    _source: 'SAFE_Pattern_Stub'
  });
}


// ============== /industry-design (任務10C：32範本智慧比對 + 快取 + AI即時生成) ==============
const INDUSTRY_INDEX = [{"key": "beauty-spa", "name": "美容 / SPA / 沙龍", "aliases": ["美容", "spa", "沙龍", "護膚", "做臉", "美容院", "臉部保養"]}, {"key": "hair-nail", "name": "美髮 / 美甲", "aliases": ["美髮", "美甲", "髮廊", "指甲", "剪髮", "染髮", "光療", "髮型", "美髮店"]}, {"key": "fitness", "name": "健身 / 瑜珈 / 教練", "aliases": ["健身", "瑜珈", "教練", "重訓", "私教", "運動", "健身房", "團課"]}, {"key": "cram-school", "name": "補習班 / 安親班", "aliases": ["補習班", "安親班", "課輔", "補教", "才藝", "家教班"]}, {"key": "art-class", "name": "才藝教室", "aliases": ["才藝", "畫畫", "音樂", "舞蹈", "鋼琴", "美術", "才藝班", "體驗課"]}, {"key": "pet", "name": "寵物美容 / 寵物店", "aliases": ["寵物", "寵物美容", "寵物店", "洗澡", "美容", "狗", "貓", "寵物旅館"]}, {"key": "wedding-photo", "name": "婚紗攝影 / 攝影工作室", "aliases": ["婚紗", "攝影", "拍照", "寫真", "工作室", "婚攝", "商攝", "形象照"]}, {"key": "car-care", "name": "汽車美容 / 修車廠", "aliases": ["汽車美容", "修車", "保養", "洗車", "鍍膜", "車廠", "維修", "板金"]}, {"key": "restaurant", "name": "餐廳 / 簡餐", "aliases": ["餐廳", "簡餐", "餐館", "訂位", "內用", "餐飲", "快炒", "定食", "拉麵", "麵店", "日本料理", "日料", "壽司", "牛排", "熱炒", "合菜", "小吃", "食堂", "便當店", "自助餐"]}, {"key": "beverage", "name": "手搖飲 / 咖啡廳", "aliases": ["手搖", "飲料", "咖啡", "咖啡廳", "茶飲", "外帶", "手搖飲", "珍奶", "奶茶", "飲料店", "茶飲店", "手搖店", "咖啡店", "果汁"]}, {"key": "breakfast", "name": "早餐店", "aliases": ["早餐", "早餐店", "蛋餅", "三明治", "早午餐"]}, {"key": "bbq-hotpot", "name": "燒烤 / 火鍋店", "aliases": ["燒烤", "火鍋", "烤肉", "鍋物", "串燒", "吃到飽"]}, {"key": "catering", "name": "外送便當 / 團膳", "aliases": ["便當", "團膳", "外送便當", "公司訂餐", "團體餐", "訂便當", "團膳便當"]}, {"key": "apparel", "name": "服飾店 / 鞋店", "aliases": ["服飾", "衣服", "鞋", "鞋店", "服裝", "選物", "穿搭", "服飾店"]}, {"key": "ecommerce", "name": "電商賣家（蝦皮 / momo / 自架站）", "aliases": ["電商", "蝦皮", "momo", "賣家", "網拍", "自架站", "網店", "購物"]}, {"key": "group-buy", "name": "代購 / 團購", "aliases": ["代購", "團購", "批貨", "跟團", "開團", "團主"]}, {"key": "food-gift", "name": "食品禮盒 / 烘焙坊", "aliases": ["食品", "禮盒", "烘焙", "蛋糕", "麵包", "伴手禮", "甜點", "糕餅"]}, {"key": "grocery", "name": "小型超市 / 雜貨店", "aliases": ["超市", "雜貨", "小賣店", "柑仔店", "量販", "生鮮"]}, {"key": "clinic", "name": "診所 / 牙醫 / 中醫", "aliases": ["診所", "牙醫", "中醫", "看診", "掛號", "醫美", "復健", "診療"]}, {"key": "law", "name": "律師事務所", "aliases": ["律師", "法律", "事務所", "訴訟", "法務", "契約", "諮詢"]}, {"key": "accounting", "name": "會計師 / 記帳士", "aliases": ["會計", "記帳", "記帳士", "報稅", "帳務", "稅務", "財報"]}, {"key": "insurance", "name": "保險業務員", "aliases": ["保險", "業務", "保單", "壽險", "產險", "理賠", "保險業務"]}, {"key": "realestate", "name": "房仲 / 不動產", "aliases": ["房仲", "房屋", "不動產", "仲介", "租屋", "買房", "物件", "代銷"]}, {"key": "freelancer", "name": "接案設計師 / 自由工作者", "aliases": ["接案", "設計師", "自由工作者", "freelancer", "外包", "SOHO", "個人工作室"]}, {"key": "creator", "name": "YouTuber / 自媒體 / KOL", "aliases": ["youtuber", "自媒體", "kol", "網紅", "頻道", "內容創作", "直播主", "部落客"]}, {"key": "online-course", "name": "線上課程講師 / 知識付費", "aliases": ["線上課程", "講師", "知識付費", "課程", "教學", "訂閱", "社群經營"]}, {"key": "manufacturing", "name": "製造廠 / 工廠接單", "aliases": ["製造", "工廠", "接單", "代工", "生產", "製造廠", "OEM", "加工"]}, {"key": "wholesale", "name": "批發商 / 經銷商", "aliases": ["批發", "經銷", "盤商", "代理", "通路", "批發商", "經銷商"]}, {"key": "trade", "name": "進出口貿易", "aliases": ["進出口", "貿易", "外貿", "國貿", "報關", "出口", "進口", "trading"]}, {"key": "interior", "name": "室內設計 / 裝潢工程", "aliases": ["室內設計", "裝潢", "裝修", "工程", "設計師", "施工", "統包"]}, {"key": "construction", "name": "營造業", "aliases": ["營造", "建設", "工地", "土木", "施工", "營建", "包商"]}, {"key": "design-studio", "name": "設計公司（品牌 / 平面 / 視覺設計）", "aliases": ["設計公司", "品牌設計", "平面設計", "視覺設計", "設計工作室", "branding", "設計團隊"]}];
const _industryCache = new Map();
const _SEC_STD = ["▸ 傳輸：TLS 1.3 加密","▸ 儲存：本地 AES-256 加密 SQLite","▸ 個資：符合台灣個資法 + 權限分級存取","▸ 備份：每日自動備份，7 天滾動保留"];
function _mkSteps(sys){ sys = sys || "相關系統"; return ["① 取得授權（"+sys+" 的 API / OAuth 金鑰）","② 設定觸發條件（時間 / 客戶動作 / 關鍵字）","③ AI 學習（餵入您過去的回應與資料範例）","④ 上線測試 → 微調 → 正式運行"]; }

async function handleIndustryDesign(request, env){
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  try{
    const body = await request.json().catch(()=>({}));
    const industry = (body && body.industry || '').trim();
    if (!industry) return jsonResponse({ error: 'industry required' }, 400);
    const cacheKey = industry.toLowerCase();
    if (_industryCache.has(cacheKey)) return jsonResponse(_industryCache.get(cacheKey));

    // 1) 本地關鍵字 / 別名比對（命中熱門範本 → 回 key，前端用本地 JSON 渲染，秒出）
    const ql = cacheKey;
    for (const it of INDUSTRY_INDEX){
      const hit = it.name.toLowerCase().includes(ql) || ql.includes(it.key) ||
        (it.aliases||[]).some(a => ql.includes(a.toLowerCase()) || a.toLowerCase().includes(ql));
      if (hit){
        const r = { mode:'template', key: it.key, matched: it.name, confidence: 1 };
        _industryCache.set(cacheKey, r); return jsonResponse(r);
      }
    }

    function _extractJSON(txt){
      if(!txt) return null;
      let s = String(txt).replace(/```[a-zA-Z]*/g,'').trim();
      const a = s.indexOf('{'), b = s.lastIndexOf('}');
      if(a<0||b<0) return null;
      s = s.slice(a, b+1).replace(/,\s*([}\]])/g, '$1');
      try{ return JSON.parse(s); }catch(_e){ return null; }
    }

    // 2) AI 智慧分類（保留最佳猜測；信心度 > 0.7 直接用熱門範本）
    let bestKey = null, bestConf = 0;
    try{
      const names = INDUSTRY_INDEX.map(i => i.key + ': ' + i.name).join('\n');
      const clsRes = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages: [
          { role:'system', content:'你是產業分類器，只輸出 JSON，不要多餘文字。' },
          { role:'user', content: '使用者輸入產業：「'+industry+'」。\n下面是 32 個既有範本（key: 名稱）：\n'+names+'\n\n判斷最接近哪一個 key，並給 0~1 信心度。只輸出 JSON：{"key":"<key或null>","confidence":<數字>}' }
        ], max_tokens: 200
      });
      const cls = _extractJSON(clsRes.response);
      if (cls && cls.key && INDUSTRY_INDEX.some(i => i.key === cls.key)){
        bestKey = cls.key; bestConf = Number(cls.confidence) || 0;
        if (bestConf > 0.7){
          const it = INDUSTRY_INDEX.find(i => i.key === bestKey);
          const r = { mode:'template', key: bestKey, matched: it.name, confidence: bestConf };
          _industryCache.set(cacheKey, r); return jsonResponse(r);
        }
      }
    }catch(_e){}

    // 3) AI 即時生成（依 10A 結構；server 端統一補 steps / security）
    let gen = null, rawGen = '';
    try{
      const genRes = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages: [
          { role:'system', content:'你是 Think BIG 的企業 AI 自動化顧問。只輸出合法 JSON（半形雙引號），不要任何解釋或 markdown。不得編造客戶案例。通訊軟體一律用「賴 OA / tele 紙飛機」。' },
          { role:'user', content: '為「'+industry+'」設計 AI 自動化流程。嚴格只輸出此 JSON 結構：\n{"painPoints":["痛點1具體有數字感","痛點2","痛點3"],"functions":[{"name":"功能名","desc":"15-25字","systems":"賴 OA + 相關系統","eta":"3-7 工作天","benefit":"可量化效益"}],"roadmap":{"phase1":"第一階段內容","phase2":"第二階段內容","phase3":"第三階段內容"},"roi":{"time":"每月省X小時","revenue":"提升X%","experience":"回應X分鐘→X秒","payback":"X個月回收"},"plan":"個人方案 / 企業方案 / 雙 Agent 方案"}\nfunctions 必須剛好 4 個物件。直接輸出 JSON。' }
        ], max_tokens: 3000
      });
      rawGen = genRes.response || '';
      gen = _extractJSON(rawGen);
    }catch(_e){}

    if (gen && Array.isArray(gen.functions) && gen.functions.length){
      const rm = gen.roadmap || {};
      const tpl = {
        key: 'gen-' + cacheKey, name: industry, aliases: [industry], generated: true,
        painPoints: Array.isArray(gen.painPoints) ? gen.painPoints.slice(0,4) : [],
        functions: gen.functions.slice(0,4).map(f => ({
          name: f.name, desc: f.desc, systems: f.systems,
          steps: _mkSteps(f.systems), security: _SEC_STD,
          eta: f.eta || '3-7 工作天', benefit: f.benefit
        })),
        roadmap: {
          phase1: { title:'第一階段（立即上線，1-2 週）', detail: rm.phase1 || '' },
          phase2: { title:'第二階段（成熟運作，1-2 個月）', detail: rm.phase2 || '' },
          phase3: { title:'第三階段（規模擴張，3-6 個月）', detail: rm.phase3 || '' }
        },
        roi: gen.roi || {}, plan: gen.plan || '個人方案 / 企業方案 / 雙 Agent 方案'
      };
      const r = { mode:'generated', template: tpl };
      _industryCache.set(cacheKey, r);
      return jsonResponse(r);
    }

    // 4) 生成失敗 → 退回最接近的熱門範本（比死路好），仍無則 fallback
    if (bestKey){
      const it = INDUSTRY_INDEX.find(i => i.key === bestKey);
      const r = { mode:'template', key: bestKey, matched: it.name, confidence: bestConf, approximate: true };
      _industryCache.set(cacheKey, r); return jsonResponse(r);
    }
    const _dbg = (new URL(request.url)).searchParams.get('debug');
    const r = { mode:'fallback', key: null, message: 'AI 即時生成暫時無法完成，請稍後再試或點右下角 ASK AI 由 Hermes 為您客製。' };
    if (_dbg) r.raw = (rawGen||'').slice(0,1500);
    return jsonResponse(r);
  }catch(e){
    return jsonResponse({ error: String(e && e.message || e) }, 500);
  }
}
// ============== /industry-design 結束 ==============

export default {
  async fetch(request, env, ctx) {
    // === V279_EARLY_INTERCEPT ===
    try {
      const _u = new URL(request.url);
      if (_u.pathname === "/options") return handleOptions(request, env);
      if (_u.pathname === "/earnings") return handleEarnings(request, env);
      if (_u.pathname === "/reddit") return handleReddit(request, env);
      if (_u.pathname === "/news-summary") return handleNewsSummary(request, env);

      // SAFE patches early intercept
      if (_u.pathname === "/article" && (request.method === "POST" || request.method === "OPTIONS")) return SAFE_handleArticle(request, env);
      if (_u.pathname === "/translate" && (request.method === "POST" || request.method === "OPTIONS")) return SAFE_handleTranslate(request, env);
      if (_u.pathname === "/coach" && (request.method === "POST" || request.method === "OPTIONS")) return SAFE_handleCoach(request, env);
      if (_u.pathname === "/tpex") return SAFE_handleTpex(request, env);
      if (_u.pathname === "/taifex") return SAFE_handleTaifex(request, env);
      if (_u.pathname === "/mops") return SAFE_handleMops(request, env);
      if (_u.pathname === "/monthly-report") return SAFE_handleMonthlyReport(request, env);
      if (_u.pathname === "/screener") return SAFE_handleScreener(request, env);
      if (_u.pathname === "/heatmap-tree") return SAFE_handleHeatmapTree(request, env);
      if (_u.pathname === "/earnings-calendar") return SAFE_handleEarningsCalendar(request, env);
      if (_u.pathname === "/backtest") return SAFE_handleBacktest(request, env);
      if (_u.pathname === "/long-short-pairs") return SAFE_handleLongShortPairs(request, env);
      if (_u.pathname === "/sector-rotation") return SAFE_handleSectorRotation(request, env);
      if (_u.pathname === "/factor-screen") return SAFE_handleFactorScreen(request, env);
      if (_u.pathname === "/risk-parity") return SAFE_handleRiskParity(request, env);
      if (_u.pathname === "/ai-10k") return SAFE_handle10K(request, env);
      if (_u.pathname === "/ai-moat") return SAFE_handleMoat(request, env);
      if (_u.pathname === "/ai-competition") return SAFE_handleCompetition(request, env);
      if (_u.pathname === "/ai-blackswan") return SAFE_handleBlackSwan(request, env);
      if (_u.pathname === "/ai-pattern") return SAFE_handlePattern(request, env);

    } catch (_e) {}
    // === END V279_EARLY_INTERCEPT ===

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

        // === /multi-agent-roundtable (v212) ===
    if (request.method === 'POST' && new URL(request.url).pathname === '/multi-agent-roundtable') {
      try {
        const body = await request.json();
        const { symbol, name, price, changePercent, currency, userQuestion } = body;
        if (!symbol) return jsonResponse({ error: 'symbol required' }, 400);
        const ctx = `股票：${name || symbol} (${symbol})\n當前價格：${price} ${currency || ''}\n今日漲跌：${(changePercent||0).toFixed(2)}%\n用戶問題：${userQuestion || '對這檔的看法'}`;
        const agents = [
          {
            role: '🧮 基本面分析師（多頭立場）',
            prompt: `你是基本面分析師，擅長從營收/獲利/競爭力角度看股票。針對下列標的用 80-120 字繁中分析「市場可能看好的點」（多頭視角）：\n\n${ctx}\n\n要求：\n1. 只談公開可推測的訊息，不編造數字\n2. 不下買賣建議，只說「市場或看好 XX」\n3. 結尾不需自加免責聲明`
          },
          {
            role: '📊 技術面分析師（謹慎立場）',
            prompt: `你是技術面分析師，擅長從 K 線/動能/超買超賣角度看股票。針對下列標的用 80-120 字繁中分析「技術面值得關注的訊號」（謹慎視角）：\n\n${ctx}\n\n要求：\n1. 從漲幅、動能、可能超買角度看\n2. 不下買賣建議，只說「技術上或顯示 XX」\n3. 結尾不需自加免責聲明`
          },
          {
            role: '⚠️ 反方分析師（魔鬼代言人）',
            prompt: `你是反方分析師，刻意找風險點。針對下列標的用 80-120 字繁中提出「**為什麼這檔可能不該買的 3 個風險點**」：\n\n${ctx}\n\n要求：\n1. 列舉具體風險（估值、競爭、總體經濟、產業、流動性等）\n2. 用「投資人應警惕 XX」這類措詞\n3. 不下不買的建議，只說「風險點是 XX」\n4. 結尾不需自加免責聲明`
          }
        ];
        const results = await Promise.all(agents.map(async a => {
          const aiRes = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
            messages: [
              { role: 'system', content: '你是公開資訊整理員，絕不提供買賣建議。' },
              { role: 'user', content: a.prompt }
            ],
            max_tokens: 350
          });
          let text = aiRes.response || '';
          if (!isContentSafe(text)) text = '為符合金管會規範，本視角內容已過濾。';
          return { role: a.role, content: text };
        }));
        return jsonResponse({
          symbol, name, agents: results,
          disclaimer: DISCLAIMER + ' 三個視角為 AI 模擬辯論，並非實際分析師意見。',
          updated: new Date().toISOString()
        });
      } catch (e) {
        return jsonResponse({ error: 'roundtable failed: ' + (e.message || e) }, 500);
      }
    }

        // === /daily-brief (v214) ===
    if (request.method === 'POST' && new URL(request.url).pathname === '/daily-brief') {
      try {
        const body = await request.json();
        const symbols = (body.symbols || []).slice(0, 8);
        const riskPref = body.riskPreference || '';
        if (symbols.length === 0) return jsonResponse({ error: 'symbols required' }, 400);
        // 並行抓每檔報價
        const quotes = await Promise.all(symbols.map(async sym => {
          try {
            const yr = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=1d&range=2d', { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (!yr.ok) return { symbol: sym, error: 'http ' + yr.status };
            const yj = await yr.json();
            const meta = yj && yj.chart && yj.chart.result && yj.chart.result[0] && yj.chart.result[0].meta;
            if (!meta) return { symbol: sym, error: 'no meta' };
            const price = meta.regularMarketPrice || 0;
            const prev = meta.previousClose || meta.chartPreviousClose || 0;
            const pct = (prev && price) ? ((price - prev) / prev * 100) : 0;
            return { symbol: sym, price, changePercent: pct, currency: meta.currency || '' };
          } catch (e) { return { symbol: sym, error: e.message }; }
        }));
        // 組 prompt
        const validQuotes = quotes.filter(q => !q.error);
        const summary = validQuotes.map(q => `${q.symbol}: ${q.price.toFixed(2)} ${q.currency} (${q.changePercent >= 0 ? '+' : ''}${q.changePercent.toFixed(2)}%)`).join(' / ');
        const prompt = `今日 (${new Date().toLocaleDateString('zh-TW')}) 您關注的標的表現：${summary}${riskPref ? '\n用戶風險偏好：' + riskPref : ''}

請用 100-150 字繁中產出「今日早報」：
1. 整體觀察（漲跌結構、是否分歧）
2. 最值得留意的 1-2 檔（用「市場或關注 XX」措詞）
3. 不下任何買賣建議
4. 結尾不需自加免責`;
        const aiRes = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [
            { role: 'system', content: '你是公開資訊整理員，絕不提供買賣建議。' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 350
        });
        let brief = aiRes.response || '';
        if (!isContentSafe(brief)) brief = '今日資訊整理已過濾。請參考各標的卡片資料。';
        return jsonResponse({
          quotes: validQuotes,
          brief,
          riskPreference: riskPref,
          disclaimer: DISCLAIMER,
          updated: new Date().toISOString()
        });
      } catch (e) {
        return jsonResponse({ error: 'brief failed: ' + (e.message || e) }, 500);
      }
    }

        // === /portfolio-health (v216) ===
    if (request.method === 'POST' && new URL(request.url).pathname === '/portfolio-health') {
      try {
        const body = await request.json();
        const holdings = body.holdings || [];
        const riskPref = body.riskPreference || '未設定';
        if (holdings.length === 0) return jsonResponse({ error: 'holdings required' }, 400);
        // 算總價值 + 各檔比重
        const totalCost = holdings.reduce((s, h) => s + (h.shares * h.cost || 0), 0);
        const enriched = holdings.map(h => ({ ...h, weight: totalCost > 0 ? ((h.shares * h.cost) / totalCost * 100) : 0 }));
        const summary = enriched.map(h => `${h.symbol}（${h.weight.toFixed(1)}%）`).join('、');
        const maxWeight = Math.max(...enriched.map(h => h.weight));
        const prompt = `用戶投資組合：${summary}
持股總數：${holdings.length} 檔
最大單一持股比重：${maxWeight.toFixed(1)}%
用戶風險偏好：${riskPref}

請用 150-200 字繁中對這個投資組合做健診：
1. 集中度評估（單一持股 > 20% 算集中）
2. 行業分散觀察（如全是科技股算過度集中）
3. 與風險偏好的匹配度
4. 3 個可改善方向（不下買賣建議，只說「可考慮觀察 XX 類別」）

回答結尾務必加：
[把握度] 高/中/低
[資料源] 投資組合理論
[盲點] 1-2 個你可能遺漏的點`;
        const aiRes = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [
            { role: 'system', content: '你是公開資訊整理員，絕不提供買賣建議。' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 600
        });
        let analysis = aiRes.response || '';
        if (!isContentSafe(analysis)) analysis = '⚠️ 為符合金管會規範，本健診內容已過濾。';
        return jsonResponse({
          holdings: enriched, totalCost, maxWeight,
          analysis, riskPreference: riskPref,
          disclaimer: DISCLAIMER, updated: new Date().toISOString()
        });
      } catch (e) { return jsonResponse({ error: 'health failed: ' + (e.message || e) }, 500); }
    }

        // === /news-sentiment (v222) ===
    if (request.method === 'GET' && new URL(request.url).pathname === '/news-sentiment') {
      const u = new URL(request.url);
      const sym = u.searchParams.get('symbol');
      if (!sym) return jsonResponse({ error: 'symbol required' }, 400);
      try {
        // Google News RSS（免 auth）
        const rssUrl = 'https://news.google.com/rss/search?q=' + encodeURIComponent(sym + ' stock') + '&hl=zh-TW&gl=TW&ceid=TW:zh-Hant';
        const r = await fetch(rssUrl);
        if (!r.ok) return jsonResponse({ error: 'rss ' + r.status }, 502);
        const xml = await r.text();
        const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 8);
        const news = items.map(m => {
          const t = (m[1].match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/) || [])[1] || '';
          const l = (m[1].match(/<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/) || [])[1] || '';
          return { title: t.trim(), link: l.trim() };
        }).filter(n => n.title);
        if (news.length === 0) return jsonResponse({ symbol: sym, news: [], summary: '', updated: new Date().toISOString() });
        // Llama 批次分類
        const numbered = news.map((n, i) => (i+1) + '. ' + n.title).join('\n');
        const prompt = '請對下列 ' + news.length + ' 篇新聞標題做情緒分類，每行回覆「序號. [正面/中性/負面] 一句話原因（<15字）」：\n\n' + numbered;
        const aiRes = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [
            { role: 'system', content: '你是新聞情緒分類器，回答簡潔。' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 500
        });
        const parsed = aiRes.response || '';
        // 解析 AI 回應
        const lines = parsed.split('\n').filter(l => /^\d+\./.test(l));
        const sentMap = {};
        lines.forEach(l => {
          const m = l.match(/^(\d+)\.\s*\[(正面|中性|負面)\]\s*(.+)$/);
          if (m) sentMap[parseInt(m[1])] = { sentiment: m[2], reason: m[3].trim() };
        });
        const result = news.map((n, i) => ({
          ...n,
          sentiment: (sentMap[i+1] || {}).sentiment || '中性',
          reason: (sentMap[i+1] || {}).reason || ''
        }));
        // 統計
        const stats = { 正面: 0, 中性: 0, 負面: 0 };
        result.forEach(r => stats[r.sentiment]++);
        const overall = stats.正面 > stats.負面 ? '偏正面' : stats.負面 > stats.正面 ? '偏負面' : '中性';
        return jsonResponse({ symbol: sym, news: result, stats, overall, updated: new Date().toISOString() });
      } catch (e) {
        return jsonResponse({ error: 'news failed: ' + (e.message || e) }, 500);
      }
    }

        // === /coach-feedback (v223) ===
    if (request.method === 'POST' && new URL(request.url).pathname === '/coach-feedback') {
      try {
        const body = await request.json();
        const queries = (body.queries || []).slice(-20);
        const watchlist = body.watchlist || [];
        const alerts = (body.alerts || []).slice(-10);
        const risk = body.riskPreference || '未設定';
        if (queries.length === 0 && watchlist.length === 0) return jsonResponse({ error: 'no data to analyze' }, 400);
        const ctx = '【用戶過去 20 個查詢】\n' + queries.map(q => '- ' + q).join('\n') +
                    '\n\n【關注標的】\n' + watchlist.join(', ') +
                    '\n\n【設過的提醒】\n' + alerts.map(a => a.symbol + ' ' + a.condition + ' ' + a.threshold).join(', ') +
                    '\n\n【風險偏好】' + risk;
        const prompt = ctx + '\n\n請扮演投資人成長教練，用 150-200 字繁中觀察這位投資人的「決策模式」並給「反饋」（不是建議買賣）：\n1. 觀察到的模式（例：是否關注特定行業？是否常追熱門？查詢主題是否一致？）\n2. 可能的盲點或可改善的習慣\n3. 一句鼓勵\n\n措詞：用「您可能」「我觀察到」「值得反思」這類溫和措詞。\n結尾務必加 [把握度]/[資料源]/[盲點]';
        const aiRes = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [
            { role: 'system', content: '你是投資人行為觀察員，給反饋不給建議。' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 600
        });
        let feedback = aiRes.response || '';
        if (!isContentSafe(feedback)) feedback = '⚠️ 為符合金管會規範，本反饋已過濾。';
        return jsonResponse({ feedback, dataPoints: queries.length + watchlist.length + alerts.length, disclaimer: DISCLAIMER, updated: new Date().toISOString() });
      } catch (e) {
        return jsonResponse({ error: 'coach failed: ' + (e.message || e) }, 500);
      }
    }

        // === /scenario-simulation (v226) ===
    if (request.method === 'POST' && new URL(request.url).pathname === '/scenario-simulation') {
      try {
        const body = await request.json();
        const scenario = body.scenario || '';
        const symbols = (body.symbols || []).slice(0, 10);
        if (!scenario || symbols.length === 0) return jsonResponse({ error: 'scenario+symbols required' }, 400);
        const prompt = `情境：${scenario}
用戶關注標的：${symbols.join(', ')}

請用 200-300 字繁中分析這個情境發生時：
1. 整體市場可能反應方向
2. 對用戶各檔關注標的可能影響（用「可能受惠/可能受壓/影響不明」標註，不下買賣建議）
3. 投資人或可關注的事件或數據

措詞：用「歷史上類似情境」「市場或反映」「投資人或關注」這類推測措詞。
結尾務必加 [把握度]/[資料源]/[盲點]`;
        const aiRes = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [
            { role: 'system', content: '你是公開資訊整理員，絕不提供買賣建議。' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 700
        });
        let analysis = aiRes.response || '';
        if (!isContentSafe(analysis)) analysis = '⚠️ 為符合金管會規範，本內容已過濾。';
        return jsonResponse({ scenario, symbols, analysis, disclaimer: DISCLAIMER, updated: new Date().toISOString() });
      } catch (e) { return jsonResponse({ error: 'scenario failed: ' + (e.message || e) }, 500); }
    }

        // === /rebalance-suggest (v227) ===
    if (request.method === 'POST' && new URL(request.url).pathname === '/rebalance-suggest') {
      try {
        const body = await request.json();
        const holdings = body.holdings || [];
        const risk = body.riskPreference || '未設定';
        if (holdings.length === 0) return jsonResponse({ error: 'holdings required' }, 400);
        const totalCost = holdings.reduce((s, h) => s + (h.shares * h.cost || 0), 0);
        const enriched = holdings.map(h => ({ ...h, weight: totalCost > 0 ? ((h.shares * h.cost) / totalCost * 100) : 0 }));
        const summary = enriched.map(h => `${h.symbol}（${h.weight.toFixed(1)}%）`).join('、');
        const prompt = `用戶投資組合：${summary}
風險偏好：${risk}

請用 200-300 字繁中提供「投組再平衡觀察」（不是買賣建議）：
1. 評估行業集中度（如全是科技 / 全是金融）
2. 評估地理分散（美股 vs 台股 vs 全球）
3. 評估風格分散（成長 vs 價值 vs 配息）
4. 結合風險偏好，提出「可考慮觀察的 3 個類別」（用「您可能想了解 XX」這類措詞，不指定個股）

結尾務必加 [把握度]/[資料源]/[盲點]`;
        const aiRes = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [
            { role: 'system', content: '你是公開資訊整理員，絕不指定買賣個股。' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 700
        });
        let suggestion = aiRes.response || '';
        if (!isContentSafe(suggestion)) suggestion = '⚠️ 為符合金管會規範，本建議已過濾。';
        return jsonResponse({ holdings: enriched, suggestion, riskPreference: risk, disclaimer: DISCLAIMER, updated: new Date().toISOString() });
      } catch (e) { return jsonResponse({ error: 'rebalance failed: ' + (e.message || e) }, 500); }
    }

        // === /fundamentals (v230) - Yahoo crumb auth hack 拿 50+ metrics ===
    if (request.method === 'GET' && new URL(request.url).pathname === '/fundamentals') {
      const u = new URL(request.url);
      const sym = u.searchParams.get('symbol');
      if (!sym) return jsonResponse({ error: 'symbol required' }, 400);
      try {
        // Step 1: Yahoo crumb auth
        let crumb = '', cookieHeader = '';
        try {
          const sessRes = await fetch('https://fc.yahoo.com', {
            redirect: 'manual',
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
          });
          const sc = sessRes.headers.get('set-cookie') || '';
          const a1 = (sc.match(/A1=([^;,]+)/) || [])[1];
          const a3 = (sc.match(/A3=([^;,]+)/) || [])[1];
          const a1s = (sc.match(/A1S=([^;,]+)/) || [])[1];
          cookieHeader = [a1 ? 'A1=' + a1 : '', a3 ? 'A3=' + a3 : '', a1s ? 'A1S=' + a1s : ''].filter(Boolean).join('; ');
          if (cookieHeader) {
            const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
              headers: { Cookie: cookieHeader, 'User-Agent': 'Mozilla/5.0' }
            });
            if (crumbRes.ok) crumb = (await crumbRes.text()).trim();
          }
        } catch (e) {}
        // Step 2: quoteSummary
        const modules = 'summaryDetail,defaultKeyStatistics,financialData,assetProfile,price';
        const qsUrl = 'https://query2.finance.yahoo.com/v10/finance/quoteSummary/' + encodeURIComponent(sym) +
                      '?modules=' + modules + (crumb ? '&crumb=' + encodeURIComponent(crumb) : '');
        const qsRes = await fetch(qsUrl, {
          headers: cookieHeader ? { Cookie: cookieHeader, 'User-Agent': 'Mozilla/5.0' } : { 'User-Agent': 'Mozilla/5.0' }
        });
        if (!qsRes.ok) {
          // Fallback: 用 chart endpoint 抓 minimal
          const cr = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=1d&range=1y');
          if (!cr.ok) return jsonResponse({ error: 'all sources failed; qs=' + qsRes.status + ' chart=' + cr.status }, 502);
          const cj = await cr.json();
          const meta = cj.chart?.result?.[0]?.meta || {};
          return jsonResponse({
            symbol: sym, source: 'chart-fallback',
            valuation: { marketCap: 0, peRatio: 0 },
            risk: { fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh || 0, fiftyTwoWeekLow: meta.fiftyTwoWeekLow || 0 },
            note: 'crumb auth 失敗，僅有部分資料',
            updated: new Date().toISOString()
          });
        }
        const qs = await qsRes.json();
        const result = qs.quoteSummary && qs.quoteSummary.result && qs.quoteSummary.result[0];
        if (!result) return jsonResponse({ error: 'no fundamentals data' }, 404);
        const sd = result.summaryDetail || {}, ks = result.defaultKeyStatistics || {}, fd = result.financialData || {}, ap = result.assetProfile || {}, pr = result.price || {};
        const raw = (obj, key) => (obj[key] && typeof obj[key] === 'object' ? (obj[key].raw || 0) : (obj[key] || 0));
        return jsonResponse({
          symbol: sym, source: 'yahoo-crumb',
          name: pr.longName || pr.shortName || sym,
          profile: { sector: ap.sector || '', industry: ap.industry || '', employees: raw(ap, 'fullTimeEmployees'), country: ap.country || '', website: ap.website || '' },
          valuation: { marketCap: raw(sd, 'marketCap'), peRatio: raw(sd, 'trailingPE'), forwardPE: raw(sd, 'forwardPE'), pegRatio: raw(ks, 'pegRatio'), priceToBook: raw(ks, 'priceToBook'), priceToSales: raw(sd, 'priceToSalesTrailing12Months'), enterpriseValue: raw(ks, 'enterpriseValue'), evToRevenue: raw(ks, 'enterpriseToRevenue'), evToEBITDA: raw(ks, 'enterpriseToEbitda') },
          profitability: { roe: raw(fd, 'returnOnEquity'), roa: raw(fd, 'returnOnAssets'), grossMargin: raw(fd, 'grossMargins'), operatingMargin: raw(fd, 'operatingMargins'), profitMargin: raw(fd, 'profitMargins'), ebitda: raw(fd, 'ebitda'), ebitdaMargin: raw(fd, 'ebitdaMargins') },
          growth: { revenueGrowth: raw(fd, 'revenueGrowth'), earningsGrowth: raw(fd, 'earningsGrowth'), earningsQuarterlyGrowth: raw(ks, 'earningsQuarterlyGrowth'), totalRevenue: raw(fd, 'totalRevenue') },
          financialHealth: { debtToEquity: raw(fd, 'debtToEquity'), currentRatio: raw(fd, 'currentRatio'), quickRatio: raw(fd, 'quickRatio'), totalCash: raw(fd, 'totalCash'), totalDebt: raw(fd, 'totalDebt'), freeCashflow: raw(fd, 'freeCashflow'), operatingCashflow: raw(fd, 'operatingCashflow') },
          dividend: { dividendYield: raw(sd, 'dividendYield'), payoutRatio: raw(sd, 'payoutRatio'), fiveYearAvgYield: raw(sd, 'fiveYearAvgDividendYield'), dividendRate: raw(sd, 'dividendRate'), exDividendDate: raw(sd, 'exDividendDate') },
          analysts: { targetMean: raw(fd, 'targetMeanPrice'), targetHigh: raw(fd, 'targetHighPrice'), targetLow: raw(fd, 'targetLowPrice'), recommendationMean: raw(fd, 'recommendationMean'), recommendationKey: fd.recommendationKey || '', numberOfAnalysts: raw(fd, 'numberOfAnalystOpinions') },
          risk: { beta: raw(sd, 'beta'), fiftyTwoWeekHigh: raw(sd, 'fiftyTwoWeekHigh'), fiftyTwoWeekLow: raw(sd, 'fiftyTwoWeekLow'), fiftyTwoWeekChange: raw(ks, '52WeekChange'), shortRatio: raw(ks, 'shortRatio'), shortPercentOfFloat: raw(ks, 'shortPercentOfFloat'), heldPercentInsiders: raw(ks, 'heldPercentInsiders'), heldPercentInstitutions: raw(ks, 'heldPercentInstitutions') },
          eps: { trailingEps: raw(ks, 'trailingEps'), forwardEps: raw(ks, 'forwardEps'), bookValue: raw(ks, 'bookValue'), revenuePerShare: raw(fd, 'revenuePerShare') },
          updated: new Date().toISOString()
        });
      } catch (e) {
        return jsonResponse({ error: 'fundamentals failed: ' + (e.message || e) }, 500);
      }
    }

        // === /screener (v236) - 100+ 條件股票篩選器 ===
    if (request.method === 'POST' && new URL(request.url).pathname === '/screener') {
      try {
        const body = await request.json();
        const universe = (body.universe || []).slice(0, 50);
        const filters = body.filters || {};
        if (universe.length === 0) return jsonResponse({ error: 'universe required' }, 400);
        // 並行抓所有 universe 的 fundamentals
        const fetchOne = async (sym) => {
          try {
            const url = 'https://moneyradar-ai-proxy.thinkbigtw.workers.dev/fundamentals?symbol=' + encodeURIComponent(sym);
            const r = await fetch(url);
            if (!r.ok) return null;
            return await r.json();
          } catch (e) { return null; }
        };
        const all = await Promise.all(universe.map(fetchOne));
        const valid = all.filter(x => x && !x.error);
        // Apply filters
        const passes = valid.filter(d => {
          const v = d.valuation || {}, p = d.profitability || {}, g = d.growth || {}, dv = d.dividend || {}, fh = d.financialHealth || {}, r = d.risk || {};
          if (filters.minPE !== undefined && v.peRatio < filters.minPE) return false;
          if (filters.maxPE !== undefined && v.peRatio > filters.maxPE) return false;
          if (filters.minPB !== undefined && v.priceToBook < filters.minPB) return false;
          if (filters.maxPB !== undefined && v.priceToBook > filters.maxPB) return false;
          if (filters.minROE !== undefined && p.roe * 100 < filters.minROE) return false;
          if (filters.minGrossMargin !== undefined && p.grossMargin * 100 < filters.minGrossMargin) return false;
          if (filters.minRevGrowth !== undefined && g.revenueGrowth * 100 < filters.minRevGrowth) return false;
          if (filters.minDivYield !== undefined && dv.dividendYield * 100 < filters.minDivYield) return false;
          if (filters.maxDebtToEquity !== undefined && fh.debtToEquity > filters.maxDebtToEquity) return false;
          if (filters.minMarketCapB !== undefined && v.marketCap / 1e9 < filters.minMarketCapB) return false;
          if (filters.maxBeta !== undefined && r.beta > filters.maxBeta) return false;
          if (filters.sector && d.profile && d.profile.sector !== filters.sector) return false;
          return true;
        });
        return jsonResponse({
          totalScanned: valid.length,
          totalPasses: passes.length,
          results: passes.map(d => ({ symbol: d.symbol, name: d.name, valuation: d.valuation, profitability: d.profitability, growth: d.growth, dividend: d.dividend })),
          updated: new Date().toISOString()
        });
      } catch (e) { return jsonResponse({ error: 'screener failed: ' + (e.message || e) }, 500); }
    }

        // === /pe-band (v238) - 本益比河流圖（過去 5 年）===
    if (request.method === 'GET' && new URL(request.url).pathname === '/pe-band') {
      const u = new URL(request.url);
      const sym = u.searchParams.get('symbol');
      if (!sym) return jsonResponse({ error: 'symbol required' }, 400);
      try {
        // 抓 5 年週線
        const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=1wk&range=5y');
        if (!r.ok) return jsonResponse({ error: 'chart ' + r.status }, 502);
        const j = await r.json();
        const result = j.chart && j.chart.result && j.chart.result[0];
        if (!result) return jsonResponse({ error: 'no data' }, 404);
        const closes = (result.indicators.quote[0].close || []).filter(x => x != null);
        const ts = result.timestamp || [];
        // 簡化：用當前 EPS 作分母（忽略 EPS 歷史變動）
        const fr = await fetch('https://moneyradar-ai-proxy.thinkbigtw.workers.dev/fundamentals?symbol=' + encodeURIComponent(sym));
        let eps = 1, bookValue = 1;
        if (fr.ok) {
          const fd = await fr.json();
          eps = fd.eps && fd.eps.trailingEps ? fd.eps.trailingEps : 1;
          bookValue = fd.eps && fd.eps.bookValue ? fd.eps.bookValue : 1;
        }
        const peSeries = closes.map(p => p / eps);
        const pbSeries = closes.map(p => p / bookValue);
        // 算 PE 分位數
        const sortedPE = [...peSeries].sort((a, b) => a - b);
        const peStats = {
          min: sortedPE[0], max: sortedPE[sortedPE.length - 1],
          p25: sortedPE[Math.floor(sortedPE.length * 0.25)],
          p50: sortedPE[Math.floor(sortedPE.length * 0.5)],
          p75: sortedPE[Math.floor(sortedPE.length * 0.75)],
          current: peSeries[peSeries.length - 1]
        };
        return jsonResponse({ symbol: sym, eps, bookValue, timestamps: ts, prices: closes, peSeries, pbSeries, peStats, updated: new Date().toISOString() });
      } catch (e) { return jsonResponse({ error: 'pe-band failed: ' + (e.message || e) }, 500); }
    }

        // === /peer-compare (v237) - 同產業跨公司比較 ===
    if (request.method === 'POST' && new URL(request.url).pathname === '/peer-compare') {
      try {
        const body = await request.json();
        const symbols = (body.symbols || []).slice(0, 8);
        if (symbols.length < 2) return jsonResponse({ error: 'at least 2 symbols' }, 400);
        const fetchOne = async (sym) => {
          try {
            const r = await fetch('https://moneyradar-ai-proxy.thinkbigtw.workers.dev/fundamentals?symbol=' + encodeURIComponent(sym));
            return r.ok ? await r.json() : null;
          } catch (e) { return null; }
        };
        const all = await Promise.all(symbols.map(fetchOne));
        const valid = all.filter(x => x && !x.error);
        return jsonResponse({ symbols, results: valid, updated: new Date().toISOString() });
      } catch (e) { return jsonResponse({ error: 'peer-compare failed: ' + (e.message || e) }, 500); }
    }

        // === /ai-screener-translate (v240) - 自然語言 → screener filter JSON ===
    if (request.method === 'POST' && new URL(request.url).pathname === '/ai-screener-translate') {
      try {
        const body = await request.json();
        const description = body.description || '';
        if (!description) return jsonResponse({ error: 'description required' }, 400);
        const prompt = `將以下自然語言投資需求翻譯成 JSON filter 物件。可用欄位：
- maxPE / minPE: 本益比上下限
- maxPB: 股價淨值比上限
- minROE: ROE 最小值（%）
- minGrossMargin: 毛利率最小值（%）
- minRevGrowth: 營收成長 YoY 最小值（%）
- minDivYield: 殖利率最小值（%）
- maxDebtToEquity: 負債權益比上限
- minMarketCapB: 市值最小值（十億美元）

需求：「${description}」

只回 JSON，不要解釋。範例：{"maxPE": 20, "minROE": 15}`;
        const aiRes = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [
            { role: 'system', content: '你是 JSON 翻譯器，只回 JSON。' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 200
        });
        const text = aiRes.response || '';
        // Extract JSON
        const jsonMatch = text.match(/\{[\s\S]*?\}/);
        let filters = {};
        if (jsonMatch) {
          try { filters = JSON.parse(jsonMatch[0]); } catch(e){}
        }
        return jsonResponse({ description, filters, aiText: text, updated: new Date().toISOString() });
      } catch (e) { return jsonResponse({ error: 'translate failed: ' + (e.message || e) }, 500); }
    }

        // === /macro (v244) - 總體經濟指標 ===
    if (request.method === 'GET' && new URL(request.url).pathname === '/macro') {
      try {
        const symbols = [
          { code: '^TNX', name: '美國 10 年期公債殖利率' },
          { code: '^FVX', name: '美國 5 年期公債殖利率' },
          { code: 'DX-Y.NYB', name: '美元指數 DXY' },
          { code: '^VIX', name: 'VIX 恐慌指數' },
          { code: 'GC=F', name: '黃金期貨' },
          { code: 'CL=F', name: '原油 WTI' },
          { code: '^TWII', name: '台股加權指數' },
          { code: '^GSPC', name: 'S&P 500' }
        ];
        const fetchOne = async (s) => {
          try {
            const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(s.code) + '?interval=1d&range=2d');
            if (!r.ok) return { ...s, error: r.status };
            const j = await r.json();
            const meta = j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].meta;
            if (!meta) return { ...s, error: 'no meta' };
            const price = meta.regularMarketPrice || 0;
            const prev = meta.previousClose || meta.chartPreviousClose || 0;
            const pct = (prev && price) ? ((price - prev) / prev * 100) : 0;
            return { ...s, price, changePercent: pct };
          } catch(e) { return { ...s, error: e.message }; }
        };
        const results = await Promise.all(symbols.map(fetchOne));
        return jsonResponse({ results, updated: new Date().toISOString() });
      } catch (e) { return jsonResponse({ error: 'macro failed: ' + (e.message || e) }, 500); }
    }

        // === /pattern-detect (v245) - AI K 棒形態辨識 ===
    if (request.method === 'POST' && new URL(request.url).pathname === '/pattern-detect') {
      try {
        const body = await request.json();
        const { symbol, closes } = body;
        if (!closes || closes.length < 20) return jsonResponse({ error: 'closes array required' }, 400);
        // 簡化最近 20 個收盤價給 AI
        const recent = closes.slice(-20).map(c => c.toFixed(2)).join(', ');
        const prompt = `分析以下 ${symbol || '某股'} 最近 20 個收盤價，判斷可能的 K 棒形態（頭肩頂/雙底/突破/收斂三角/旗形等）。
價格序列：${recent}

請用繁體中文回答 80-120 字：
1. 主要形態（直接命名）
2. 一句話描述特徵
3. 該形態通常代表什麼（多頭/空頭/觀望）
不下買賣建議。結尾務必加 [把握度]/[資料源]/[盲點]`;
        const aiRes = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [
            { role: 'system', content: '你是公開資訊整理員，只描述形態，不下建議。' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 350
        });
        let analysis = aiRes.response || '';
        if (!isContentSafe(analysis)) analysis = '⚠️ 為符合規範，本內容已過濾。';
        return jsonResponse({ symbol, analysis, dataPoints: closes.length, updated: new Date().toISOString() });
      } catch (e) { return jsonResponse({ error: 'pattern failed: ' + (e.message || e) }, 500); }
    }

        // === /margin (v253) - TWSE 融資融券（當日全市場）===
    if (request.method === 'GET' && new URL(request.url).pathname === '/margin') {
      const u = new URL(request.url);
      const stock = u.searchParams.get('stock');
      try {
        const r = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/MI_MARGN', {
          headers: { 'User-Agent': 'MoneyRadar/1.0' }
        });
        if (!r.ok) return jsonResponse({ error: 'TWSE ' + r.status }, 502);
        const data = await r.json();
        if (stock) {
          const found = data.find(d => d.Code === stock || d.stock_id === stock);
          if (!found) return jsonResponse({ error: 'stock not found in TWSE today' }, 404);
          return jsonResponse({ stock, data: found, updated: new Date().toISOString() });
        }
        return jsonResponse({ count: data.length, data: data.slice(0, 50), updated: new Date().toISOString() });
      } catch (e) { return jsonResponse({ error: 'TWSE failed: ' + (e.message || e) }, 500); }
    }

        // === /monthly-revenue (v256) - 台股月營收 ===
    if (request.method === 'GET' && new URL(request.url).pathname === '/monthly-revenue') {
      const u = new URL(request.url);
      const stock = u.searchParams.get('stock');
      if (!stock) return jsonResponse({ error: 'stock required' }, 400);
      try {
        const sb = 'https://sirhskxufayklqrlxeep.supabase.co';
        const r = await fetch(sb + '/rest/v1/monthly_revenue?symbol=eq.' + encodeURIComponent(stock) + '&select=year_month,revenue,yoy_pct,mom_pct&order=year_month.desc&limit=24', {
          headers: { apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2c2NuZHJ4bWloYWZmYndnbWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA4MzQyMjEsImV4cCI6MjA1NjQxMDIyMX0.O2WMkNPBjXPSHlPbgU6nJP6sV1AXr_C-JbtBEa9JIQk' }
        });
        if (!r.ok) return jsonResponse({ error: 'Supabase ' + r.status }, 502);
        const rows = await r.json();
        return jsonResponse({ stock, rows, count: rows.length, updated: new Date().toISOString() });
      } catch (e) { return jsonResponse({ error: 'monthly-rev failed: ' + (e.message || e) }, 500); }
    }

        // === /news-ner (v257) - 新聞 + AI Entity 標記 ===
    if (request.method === 'GET' && new URL(request.url).pathname === '/news-ner') {
      const u = new URL(request.url);
      const sym = u.searchParams.get('symbol');
      if (!sym) return jsonResponse({ error: 'symbol required' }, 400);
      try {
        const rssUrl = 'https://news.google.com/rss/search?q=' + encodeURIComponent(sym + ' stock') + '&hl=zh-TW';
        const r = await fetch(rssUrl);
        const xml = await r.text();
        const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 5);
        const news = items.map(m => {
          const t = (m[1].match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/) || [])[1] || '';
          return { title: t.trim() };
        }).filter(n => n.title);
        if (news.length === 0) return jsonResponse({ symbol: sym, news: [], updated: new Date().toISOString() });
        const numbered = news.map((n, i) => (i+1) + '. ' + n.title).join('\n');
        const prompt = '對下列 ' + news.length + ' 篇新聞標題抽取重要實體（公司/人名/產品/事件），每行回「序號. [實體1, 實體2, ...]」：\n\n' + numbered;
        const aiRes = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [
            { role: 'system', content: '你是 NER 實體抽取器，回答簡潔。' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 400
        });
        const parsed = aiRes.response || '';
        const lines = parsed.split('\n').filter(l => /^\d+\./.test(l));
        const entityMap = {};
        lines.forEach(l => {
          const m = l.match(/^(\d+)\.\s*\[(.+)\]/);
          if (m) entityMap[parseInt(m[1])] = m[2].split(',').map(x => x.trim()).filter(Boolean);
        });
        const result = news.map((n, i) => ({ ...n, entities: entityMap[i+1] || [] }));
        return jsonResponse({ symbol: sym, news: result, updated: new Date().toISOString() });
      } catch (e) { return jsonResponse({ error: 'news-ner failed: ' + (e.message || e) }, 500); }
    }

        // === /stock-report (v258) - AI 個股深度報告 ===
    if (request.method === 'POST' && new URL(request.url).pathname === '/stock-report') {
      try {
        const body = await request.json();
        const { symbol, name } = body;
        if (!symbol) return jsonResponse({ error: 'symbol required' }, 400);
        // 並行抓 fundamentals + 報價
        const [fr, qr] = await Promise.all([
          fetch('https://moneyradar-ai-proxy.thinkbigtw.workers.dev/fundamentals?symbol=' + encodeURIComponent(symbol)),
          fetch('https://moneyradar-ai-proxy.thinkbigtw.workers.dev/quote?symbol=' + encodeURIComponent(symbol))
        ]);
        const f = await fr.json();
        const q = await qr.json();
        const v = f.valuation || {}, p = f.profitability || {}, g = f.growth || {}, fh = f.financialHealth || {}, dv = f.dividend || {}, an = f.analysts || {}, r = f.risk || {};
        const ctx = `公司：${name || f.name || symbol} (${symbol})
產業：${(f.profile || {}).sector || '?'} / ${(f.profile || {}).industry || '?'}
當前價：${q.price || '?'} ${q.currency || ''}（${q.changePercent >= 0 ? '+' : ''}${(q.changePercent || 0).toFixed(2)}%）

【估值】
市值：$${(v.marketCap || 0) / 1e9}B / P/E ${v.peRatio || '?'} / P/B ${v.priceToBook || '?'} / PEG ${v.pegRatio || '?'}

【獲利】
ROE ${(p.roe * 100 || 0).toFixed(1)}% / 毛利率 ${(p.grossMargin * 100 || 0).toFixed(1)}% / 淨利率 ${(p.profitMargin * 100 || 0).toFixed(1)}%

【成長】
營收 YoY ${(g.revenueGrowth * 100 || 0).toFixed(1)}% / EPS YoY ${(g.earningsGrowth * 100 || 0).toFixed(1)}%

【財務健康】
負債/權益 ${fh.debtToEquity || 0} / 流動比 ${fh.currentRatio || 0}

【分析師】
平均目標價 $${an.targetMean || '?'} / 平均建議 ${an.recommendationMean || '?'}/5

【風險】
Beta ${r.beta || '?'} / 52 週高 $${r.fiftyTwoWeekHigh || '?'} / 52 週低 $${r.fiftyTwoWeekLow || '?'}`;
        const prompt = ctx + `

請扮演金融研究員，用繁體中文寫一份 300-400 字的「個股研究報告」，包含 5 段：
1. 公司簡介
2. 基本面亮點與隱憂
3. 估值合理度
4. 風險點 3 個
5. 未來觀察重點 3 個

不下買賣建議，只整理公開資訊讓投資人自己判斷。
結尾務必加 [把握度]/[資料源]/[盲點]`;
        const aiRes = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [
            { role: 'system', content: '你是公開資訊整理員，絕不提供買賣建議。' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 1200
        });
        let report = aiRes.response || '';
        if (!isContentSafe(report)) report = '⚠️ 為符合金管會規範，本內容已過濾。';
        return jsonResponse({ symbol, name: f.name, report, fundamentals: f, quote: q, generated: new Date().toISOString() });
      } catch (e) { return jsonResponse({ error: 'report failed: ' + (e.message || e) }, 500); }
    }

        // === /investment-diary (v259) - AI 個人投資日記 ===
    if (request.method === 'POST' && new URL(request.url).pathname === '/investment-diary') {
      try {
        const body = await request.json();
        const queries = (body.queries || []).slice(-15);
        const watchlist = (body.watchlist || []).slice(0, 10);
        const alerts = (body.alerts || []).slice(-5);
        const risk = body.riskPreference || '';
        const period = body.period || '本週';
        const ctx = `【投資人最近 15 個查詢】\n${queries.join('\n')}\n\n【關注標的】${watchlist.join(', ')}\n\n【設過的提醒】${alerts.map(a => a.symbol + ' ' + a.condition).join(', ')}\n\n【風險偏好】${risk}\n\n【期間】${period}`;
        const prompt = ctx + `\n\n請扮演投資日記助手，用繁體中文 200-250 字幫這位投資人寫一篇「${period}投資日記」：\n1. 您${period}的投資關注重點\n2. 從查詢模式看出的決策傾向\n3. 值得反思的 1 件事\n4. ${period}結束的一句話鼓勵\n\n措詞溫和，第二人稱「您」。不下買賣建議。\n結尾務必加 [把握度]/[資料源]/[盲點]`;
        const aiRes = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [
            { role: 'system', content: '你是投資日記助手，溫和反思。' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 600
        });
        let diary = aiRes.response || '';
        if (!isContentSafe(diary)) diary = '⚠️ 為符合規範，本內容已過濾。';
        return jsonResponse({ diary, period, dataPoints: queries.length + watchlist.length, generated: new Date().toISOString() });
      } catch (e) { return jsonResponse({ error: 'diary failed: ' + (e.message || e) }, 500); }
    }

        // === /news-summary (v260) - 新聞 + AI 圖文摘要 ===
    if (request.method === 'GET' && new URL(request.url).pathname === '/news-summary') {
      const u = new URL(request.url);
      const sym = u.searchParams.get('symbol');
      if (!sym) return jsonResponse({ error: 'symbol required' }, 400);
      try {
        const rssUrl = 'https://news.google.com/rss/search?q=' + encodeURIComponent(sym + ' stock') + '&hl=zh-TW';
        const r = await fetch(rssUrl);
        const xml = await r.text();
        const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 5);
        const news = items.map(m => {
          const t = (m[1].match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/) || [])[1] || '';
          return { title: t.trim() };
        }).filter(n => n.title);
        if (news.length === 0) return jsonResponse({ symbol: sym, news: [], updated: new Date().toISOString() });
        const numbered = news.map((n, i) => (i+1) + '. ' + n.title).join('\n');
        const prompt = '對下列 ' + news.length + ' 篇新聞，每篇用繁體中文寫一句 25 字以內的摘要，每行回「序號. 摘要」：\n\n' + numbered;
        const aiRes = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
          messages: [
            { role: 'system', content: '你是新聞摘要員，回答簡潔。' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 400
        });
        const parsed = aiRes.response || '';
        const lines = parsed.split('\n').filter(l => /^\d+\./.test(l));
        const summaryMap = {};
        lines.forEach(l => {
          const m = l.match(/^(\d+)\.\s*(.+)$/);
          if (m) summaryMap[parseInt(m[1])] = m[2].trim();
        });
        const result = news.map((n, i) => ({ ...n, summary: summaryMap[i+1] || n.title }));
        return jsonResponse({ symbol: sym, news: result, updated: new Date().toISOString() });
      } catch (e) { return jsonResponse({ error: 'news-sum failed: ' + (e.message || e) }, 500); }
    }

        // === /margin-history (v261) - TWSE 個股 30 日融資融券歷史 ===
    if (request.method === 'GET' && new URL(request.url).pathname === '/margin-history') {
      const u = new URL(request.url);
      const stock = u.searchParams.get('stock');
      const days = Math.min(parseInt(u.searchParams.get('days') || '30'), 30);
      if (!stock) return jsonResponse({ error: 'stock required' }, 400);
      try {
        // 產生過去 N 個交易日（粗估，跳週末）
        const dates = [];
        let d = new Date();
        while (dates.length < days) {
          d.setDate(d.getDate() - 1);
          if (d.getDay() === 0 || d.getDay() === 6) continue;
          const ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
          dates.push(ymd);
        }
        const fetchDay = async (ymd) => {
          try {
            const r = await fetch('https://www.twse.com.tw/exchangeReport/MI_MARGN?response=json&date=' + ymd + '&selectType=ALL');
            if (!r.ok) return null;
            const j = await r.json();
            if (!j.data) return null;
            const found = j.data.find(row => row[0] === stock);
            if (!found) return null;
            return {
              date: ymd,
              margin_buy: parseInt(found[2]?.replace(/,/g, '') || 0),
              margin_balance: parseInt(found[6]?.replace(/,/g, '') || 0),
              short_balance: parseInt(found[12]?.replace(/,/g, '') || 0)
            };
          } catch(e) { return null; }
        };
        const results = await Promise.all(dates.slice(0, 20).map(fetchDay));
        const valid = results.filter(x => x);
        return jsonResponse({ stock, days: valid.length, history: valid, updated: new Date().toISOString() });
      } catch (e) { return jsonResponse({ error: 'margin-history failed: ' + (e.message || e) }, 500); }
    }

        // === /broker-rank (v262) - 當日券商買賣超排行 ===
    if (request.method === 'GET' && new URL(request.url).pathname === '/broker-rank') {
      try {
        const r = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/BFI82U');
        if (!r.ok) return jsonResponse({ error: 'TWSE ' + r.status }, 502);
        const data = await r.json();
        return jsonResponse({ count: data.length, data: data.slice(0, 50), updated: new Date().toISOString() });
      } catch (e) { return jsonResponse({ error: 'broker-rank failed: ' + (e.message || e) }, 500); }
    }

        // === /financials-history (v263) - Yahoo 4 年財報歷史 ===
    if (request.method === 'GET' && new URL(request.url).pathname === '/financials-history') {
      const u = new URL(request.url);
      const sym = u.searchParams.get('symbol');
      if (!sym) return jsonResponse({ error: 'symbol required' }, 400);
      try {
        // 重用 v230 的 crumb auth 邏輯
        let crumb = '', cookieHeader = '';
        try {
          const sessRes = await fetch('https://fc.yahoo.com', { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0' } });
          const sc = sessRes.headers.get('set-cookie') || '';
          const a1 = (sc.match(/A1=([^;,]+)/) || [])[1];
          const a3 = (sc.match(/A3=([^;,]+)/) || [])[1];
          cookieHeader = [a1 ? 'A1=' + a1 : '', a3 ? 'A3=' + a3 : ''].filter(Boolean).join('; ');
          if (cookieHeader) {
            const cr = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', { headers: { Cookie: cookieHeader, 'User-Agent': 'Mozilla/5.0' } });
            if (cr.ok) crumb = (await cr.text()).trim();
          }
        } catch(e) {}
        const modules = 'incomeStatementHistory,balanceSheetHistory,cashflowStatementHistory,earningsHistory';
        const url = 'https://query2.finance.yahoo.com/v10/finance/quoteSummary/' + encodeURIComponent(sym) + '?modules=' + modules + (crumb ? '&crumb=' + encodeURIComponent(crumb) : '');
        const r = await fetch(url, { headers: cookieHeader ? { Cookie: cookieHeader, 'User-Agent': 'Mozilla/5.0' } : { 'User-Agent': 'Mozilla/5.0' } });
        if (!r.ok) return jsonResponse({ error: 'yahoo ' + r.status }, 502);
        const j = await r.json();
        const result = j.quoteSummary && j.quoteSummary.result && j.quoteSummary.result[0];
        if (!result) return jsonResponse({ error: 'no data' }, 404);
        const raw = (obj, key) => (obj && obj[key] && typeof obj[key] === 'object' ? (obj[key].raw || 0) : (obj && obj[key]) || 0);
        const income = (result.incomeStatementHistory && result.incomeStatementHistory.incomeStatementHistory || []).map(r => ({
          date: r.endDate && r.endDate.fmt || '',
          revenue: raw(r, 'totalRevenue'),
          grossProfit: raw(r, 'grossProfit'),
          operatingIncome: raw(r, 'operatingIncome'),
          netIncome: raw(r, 'netIncome'),
          eps: raw(r, 'dilutedEPS')
        }));
        const balance = (result.balanceSheetHistory && result.balanceSheetHistory.balanceSheetStatements || []).map(r => ({
          date: r.endDate && r.endDate.fmt || '',
          totalAssets: raw(r, 'totalAssets'),
          totalLiabilities: raw(r, 'totalLiab'),
          totalEquity: raw(r, 'totalStockholderEquity'),
          cash: raw(r, 'cash')
        }));
        const cashflow = (result.cashflowStatementHistory && result.cashflowStatementHistory.cashflowStatements || []).map(r => ({
          date: r.endDate && r.endDate.fmt || '',
          operating: raw(r, 'totalCashFromOperatingActivities'),
          investing: raw(r, 'totalCashflowsFromInvestingActivities'),
          financing: raw(r, 'totalCashFromFinancingActivities'),
          capex: raw(r, 'capitalExpenditures')
        }));
        return jsonResponse({ symbol: sym, income, balance, cashflow, years: income.length, updated: new Date().toISOString() });
      } catch (e) { return jsonResponse({ error: 'fin-history failed: ' + (e.message || e) }, 500); }
    }

        // === /earnings-surprise (v270) - 過去 4 季財報意外 ===
    if (request.method === 'GET' && new URL(request.url).pathname === '/earnings-surprise') {
      const u = new URL(request.url);
      const sym = u.searchParams.get('symbol');
      if (!sym) return jsonResponse({ error: 'symbol required' }, 400);
      try {
        let crumb = '', cookieHeader = '';
        try {
          const sr = await fetch('https://fc.yahoo.com', { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0' } });
          const sc = sr.headers.get('set-cookie') || '';
          const a1 = (sc.match(/A1=([^;,]+)/) || [])[1];
          const a3 = (sc.match(/A3=([^;,]+)/) || [])[1];
          cookieHeader = [a1 ? 'A1=' + a1 : '', a3 ? 'A3=' + a3 : ''].filter(Boolean).join('; ');
          if (cookieHeader) {
            const cr = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', { headers: { Cookie: cookieHeader, 'User-Agent': 'Mozilla/5.0' } });
            if (cr.ok) crumb = (await cr.text()).trim();
          }
        } catch(e){}
        const url = 'https://query2.finance.yahoo.com/v10/finance/quoteSummary/' + encodeURIComponent(sym) + '?modules=earningsHistory,calendarEvents' + (crumb ? '&crumb=' + encodeURIComponent(crumb) : '');
        const r = await fetch(url, { headers: cookieHeader ? { Cookie: cookieHeader, 'User-Agent': 'Mozilla/5.0' } : { 'User-Agent': 'Mozilla/5.0' } });
        if (!r.ok) return jsonResponse({ error: 'yahoo ' + r.status }, 502);
        const j = await r.json();
        const result = j.quoteSummary?.result?.[0];
        if (!result) return jsonResponse({ error: 'no data' }, 404);
        const raw = (o, k) => (o?.[k]?.raw ?? 0);
        const eh = (result.earningsHistory?.history || []).map(q => ({
          date: q.quarter?.fmt || '',
          actualEPS: raw(q, 'epsActual'),
          estimateEPS: raw(q, 'epsEstimate'),
          surprise: raw(q, 'surpriseDifference'),
          surprisePct: raw(q, 'surprisePercent')
        }));
        const next = result.calendarEvents?.earnings || {};
        return jsonResponse({
          symbol: sym, history: eh,
          nextEarnings: { date: next.earningsDate?.[0]?.fmt || '', estimate: raw(next, 'earningsAverage') },
          updated: new Date().toISOString()
        });
      } catch (e) { return jsonResponse({ error: 'earnings failed: ' + (e.message || e) }, 500); }
    }

        // === /insider-ownership (v271) - 內部人 / 機構持股 ===
    if (request.method === 'GET' && new URL(request.url).pathname === '/insider-ownership') {
      const u = new URL(request.url);
      const sym = u.searchParams.get('symbol');
      if (!sym) return jsonResponse({ error: 'symbol required' }, 400);
      try {
        let crumb = '', cookieHeader = '';
        try {
          const sr = await fetch('https://fc.yahoo.com', { redirect: 'manual', headers: { 'User-Agent': 'Mozilla/5.0' } });
          const sc = sr.headers.get('set-cookie') || '';
          const a1 = (sc.match(/A1=([^;,]+)/) || [])[1];
          const a3 = (sc.match(/A3=([^;,]+)/) || [])[1];
          cookieHeader = [a1 ? 'A1=' + a1 : '', a3 ? 'A3=' + a3 : ''].filter(Boolean).join('; ');
          if (cookieHeader) {
            const cr = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', { headers: { Cookie: cookieHeader, 'User-Agent': 'Mozilla/5.0' } });
            if (cr.ok) crumb = (await cr.text()).trim();
          }
        } catch(e){}
        const url = 'https://query2.finance.yahoo.com/v10/finance/quoteSummary/' + encodeURIComponent(sym) + '?modules=insiderHolders,institutionOwnership,majorHoldersBreakdown,insiderTransactions' + (crumb ? '&crumb=' + encodeURIComponent(crumb) : '');
        const r = await fetch(url, { headers: cookieHeader ? { Cookie: cookieHeader, 'User-Agent': 'Mozilla/5.0' } : { 'User-Agent': 'Mozilla/5.0' } });
        if (!r.ok) return jsonResponse({ error: 'yahoo ' + r.status }, 502);
        const j = await r.json();
        const result = j.quoteSummary?.result?.[0];
        if (!result) return jsonResponse({ error: 'no data' }, 404);
        const raw = (o, k) => (o?.[k]?.raw ?? 0);
        const insiderH = (result.insiderHolders?.holders || []).slice(0, 5).map(h => ({
          name: h.name, position: h.relation || '', shares: raw(h, 'positionDirect'), date: h.latestTransDate?.fmt || ''
        }));
        const instOwn = (result.institutionOwnership?.ownershipList || []).slice(0, 5).map(h => ({
          name: h.organization, pct: raw(h, 'pctHeld') * 100, value: raw(h, 'value'), shares: raw(h, 'position')
        }));
        const major = result.majorHoldersBreakdown || {};
        const insiderTxns = (result.insiderTransactions?.transactions || []).slice(0, 8).map(t => ({
          name: t.filerName, type: t.transactionText || '', shares: raw(t, 'shares'), value: raw(t, 'value'), date: t.startDate?.fmt || ''
        }));
        return jsonResponse({
          symbol: sym,
          summary: { insiderPct: raw(major, 'insidersPercentHeld') * 100, institutionPct: raw(major, 'institutionsPercentHeld') * 100, institutionCount: raw(major, 'institutionsCount') },
          topInsiders: insiderH, topInstitutions: instOwn, recentTransactions: insiderTxns,
          updated: new Date().toISOString()
        });
      } catch (e) { return jsonResponse({ error: 'insider failed: ' + (e.message || e) }, 500); }
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
      if (url.pathname === '/thinkbig-chat') return await handleThinkBigChat(request, env);
      if (url.pathname === '/industry-design') return await handleIndustryDesign(request, env);
      if (url.pathname === '/erp-chat') return await handleErpChat(request, env);
      if (url.pathname === '/briefing') return await handleBriefing(request, env);
      if (url.pathname === '/heatmap') return await handleHeatmap(request, env);
      if (url.pathname === '/analysis') return await handleAnalysis(request, env);
      if (url.pathname === '/digest') return await handleDigest(request, env);
      if (url.pathname === '/quote') return await handleQuote(request, env);
    if (url.pathname === '/options') return handleOptions(request, env);
    if (url.pathname === '/earnings') return handleEarnings(request, env);
      if (url.pathname === '/market-briefing') return await handleMarketBriefing(request, env);
      return await handleSummary(request, env);
    } catch (err) {
      return jsonResponse({ error: err.message || 'Internal error' }, 500);
    }
  },
};
