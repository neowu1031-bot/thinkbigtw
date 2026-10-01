/**
 * line-flex.js — Think BIG LINE Flex Message 模板模組
 *
 * 設計原則：
 *   - 純函式為主，方便單元測試
 *   - 品牌風格：深色品牌列 "THINK BIG!" + 粉紅點綴（官網配色）
 *   - 意圖偵測：企業詢價 / 個人方案 / 作品集 / 預設
 *   - 長回覆自動分 carousel（最多 2 個 bubble）
 *   - 失敗備援：Flex 送出失敗（400/403）自動改送純文字
 *   - 按鈕標籤、header 不含任何金額
 *   - altText = 回覆前 40 字（去除換行）
 *   - options.maxButtons: 0–3（0 = 純資訊卡，不塞按鈕）
 *   - options.intent: 強制覆蓋意圖偵測
 *
 * LINE Flex Message 限制：
 *   - 單一 bubble JSON：≤ 30 KB
 *   - carousel JSON：≤ 50 KB（最多 12 個 bubble）
 *   - altText：≤ 400 字元（此模組固定截 40）
 *   - button label：≤ 20 字元（LINE 規範）
 *   - URI action：一律 https://
 *   - Flex 裡的文字無法長按複製 → 網址一律做成按鈕
 *
 * 取捨說明（2026-10-02 NEO 議題）：
 *   Flex 文字不可長按複製，客人要抄電話/網址不方便。
 *   因應措施：所有可點擊的網址一律做成按鈕（URI action），
 *   避免在 body 文字中放裸網址。本模組已遵循此原則。
 */

const LINE_REPLY_URL_CONST = 'https://api.line.me/v2/bot/message/reply';
const LINE_PUSH_URL_CONST  = 'https://api.line.me/v2/bot/message/push';

// ── 品牌配色（對應 assets/homesplit/site.css :root） ──────────────────────
const BRAND_DARK  = '#191a1d';  // --ink（header 背景）
const BRAND_PINK  = '#eea4bb';  // --brand（點綴色）
const BRAND_PAPER = '#f7f6f2';  // --paper（body / footer 背景）

// ── 外部連結（固定） ──────────────────────────────────────────────────────
const SHOPEE_URL      = 'https://shopee.tw/shop/105010395';
const PORTFOLIO_URL   = 'https://thinkbigtw.com/portfolio/';
const CONTACT_URL     = 'https://thinkbigtw.com/contact/';
const ENTERPRISE_URL  = 'https://thinkbigtw.com/enterprise/';
const SITE_URL        = 'https://thinkbigtw.com';

// 每個 bubble body 文字上限（超出則拆 carousel）
const MAX_BODY_CHARS = 400;

// ──────────────────────────────────────────────
// 歡迎訊息 body（NEO 2026-10-02 定案）
// ──────────────────────────────────────────────

/** 歡迎 bubble body 文字（NEO 2026-10-02 定稿）。 */
export const WELCOME_FLEX_BODY =
  '嗨，歡迎來到Think BIG ✨\n' +
  '我是 Think BIG AI小助理\n' +
  '有任何 AI 導入的問題直接問我就好呢！\n\n' +
  '期待我們為你打開更深一層的AI領域\n' +
  '幫助你走在科技的最前線\n' +
  '讓我們一起Make it Real!';

// ──────────────────────────────────────────────
// URL 偵測與移除（確定性程式處理，不靠 prompt）
// ──────────────────────────────────────────────

/**
 * 將 AI 回覆中的網址對應到按鈕標籤。
 * 未知網域回傳 null（由呼叫端記 log、不建立按鈕）。
 *
 * 優先序：/enterprise/start > /enterprise/ > /pricing/personal > /pricing/ >
 *          /portfolio/ > /contact/ > 其他 thinkbigtw.com > shopee.tw
 *
 * @param {string} url
 * @returns {string|null} 按鈕標籤
 */
export function urlToLabel(url) {
  try {
    const u   = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const path = u.pathname;

    if (host === 'shopee.tw') return '蝦皮賣場';

    if (host === 'thinkbigtw.com') {
      if (path.startsWith('/enterprise/start')) return '自助評估';
      if (path.startsWith('/enterprise/'))      return '企業導入';
      if (path.startsWith('/pricing/personal')) return '個人方案';
      if (path.startsWith('/pricing/'))         return '個人方案';
      if (path.startsWith('/portfolio/'))       return '導入案例';
      if (path.startsWith('/contact/'))         return '預約需求訪談';
      return '官網'; // 其他 thinkbigtw.com 路徑
    }

    // lin.ee 及其他未知網域：不轉按鈕，記 log
    console.log(`[urlToLabel] unknown domain discarded: ${url}`);
    return null;
  } catch {
    return null;
  }
}

/**
 * 從 AI 回覆文字中移除網址，收集已知域名的 URL。
 *
 * 處理規則：
 *  1. markdown 連結 [label](url) → 整組移除，URL 收集
 *  2. 整行只是「標籤：URL」→ 整行移除（收集 URL）
 *  3. 句中裸網址 → 移除（含前置冒號），收集 URL
 *  4. 移除後行尾留有冒號的殘句（如「・企業 AI 導入：」）→ 整行清掉
 *  5. 連續空行壓成一行；去除首尾空行
 *
 * 已知掃描域名：thinkbigtw.com、shopee.tw、lin.ee
 * 其他域名：URL 從內文移除，但不加入 foundUrls（記 log）
 *
 * @param {string} text
 * @returns {{ cleanText: string, foundUrls: string[] }}
 */
export function stripUrls(text) {
  if (typeof text !== 'string') return { cleanText: String(text ?? ''), foundUrls: [] };

  const foundUrls = [];
  const KNOWN_HOSTS = new Set(['thinkbigtw.com', 'shopee.tw', 'lin.ee']);

  /** 收集 URL：已知域名加入 foundUrls；其他記 log 不加入。 */
  function collectUrl(url) {
    try {
      const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
      if (KNOWN_HOSTS.has(host)) {
        foundUrls.push(url);
      } else {
        console.log(`[stripUrls] unknown domain discarded: ${url}`);
      }
    } catch { /* 無效 URL，丟棄 */ }
  }

  // Step 1：移除 markdown 連結 [label](url)
  let processed = text.replace(
    /\[([^\]]*)\]\((https?:\/\/[^\)\s]+)\)/g,
    (_m, _label, url) => { collectUrl(url); return ''; },
  );

  // Step 2：逐行處理
  const lines = processed.split('\n');
  const resultLines = [];

  for (const line of lines) {
    // 2a. 整行為「標籤：URL」（冒號前段無其他 URL）→ 整行移除
    const wholeLineRe = /^([^：:\n]*)[：:]\s*(https?:\/\/\S+)\s*$/;
    const wholeMatch  = wholeLineRe.exec(line);
    if (wholeMatch && !/https?:\/\//.test(wholeMatch[1])) {
      collectUrl(wholeMatch[2]);
      resultLines.push('');
      continue;
    }

    let cleanLine = line;
    let modified  = false;

    // 2b. 移除句中「冒號 + URL」（如「更多資訊：https://...」）
    cleanLine = cleanLine.replace(/[：:]\s*https?:\/\/\S+/g, (m) => {
      const mu = /https?:\/\/\S+/.exec(m);
      if (mu) collectUrl(mu[0]);
      modified = true;
      return '';
    });

    // 2c. 移除剩餘裸 URL
    cleanLine = cleanLine.replace(/https?:\/\/\S+/g, (url) => {
      collectUrl(url);
      modified = true;
      return '';
    });

    if (modified) {
      cleanLine = cleanLine.replace(/\s{2,}/g, ' ').trim();
      // 殘句：移除 URL 後行尾剩冒號（如「・企業 AI 導入：」）→ 清除
      if (!cleanLine || /[：:]\s*$/.test(cleanLine)) {
        resultLines.push('');
        continue;
      }
    }

    resultLines.push(cleanLine);
  }

  // Step 3：壓縮連續空行；去除首尾空行
  const finalLines = [];
  let prevBlank = false;
  for (const line of resultLines) {
    if (line === '') {
      if (!prevBlank) finalLines.push('');
      prevBlank = true;
    } else {
      prevBlank = false;
      finalLines.push(line);
    }
  }
  while (finalLines.length > 0 && finalLines[0] === '')               finalLines.shift();
  while (finalLines.length > 0 && finalLines[finalLines.length - 1] === '') finalLines.pop();

  return { cleanText: finalLines.join('\n'), foundUrls };
}

// ──────────────────────────────────────────────
// 意圖偵測
// ──────────────────────────────────────────────

/**
 * 根據 AI 回覆文字偵測對話意圖。
 * 優先序：enterprise > portfolio > personal > default
 * @param {string} text AI 回覆原文
 * @returns {'enterprise'|'personal'|'portfolio'|'default'}
 */
export function detectIntent(text) {
  if (typeof text !== 'string' || !text.trim()) return 'default';

  const enterprisePattern = /企業|公司|組織|部門|導入|多人|跨部門|企業版|合作方案|評估|B2B/i;
  const portfolioPattern  = /案例|作品集|客戶案例|portfolio|實績/i;
  const personalPattern   = /個人方案|個人版|個人計畫|蝦皮|購買|訂閱|月費|方案介紹|選購/;

  if (enterprisePattern.test(text)) return 'enterprise';
  if (portfolioPattern.test(text))  return 'portfolio';
  if (personalPattern.test(text))   return 'personal';
  return 'default';
}

// ──────────────────────────────────────────────
// 按鈕建構（純函式）
// ──────────────────────────────────────────────

/** URI button（連結到網頁）。label ≤ 20 字元。 */
function makeUriButton(label, uri, isPrimary = true) {
  const btn = {
    type: 'button',
    action: { type: 'uri', label, uri },
    style: isPrimary ? 'primary' : 'secondary',
    height: 'sm',
    margin: 'sm',
  };
  if (isPrimary) btn.color = BRAND_DARK;
  return btn;
}

/** Message button（傳送關鍵字觸發真人流程）。label ≤ 20 字元。 */
function makeMessageButton(label, messageText) {
  return {
    type: 'button',
    action: { type: 'message', label, text: messageText },
    style: 'secondary',
    height: 'sm',
    margin: 'sm',
  };
}

/**
 * 根據意圖返回 1–3 顆按鈕（按鈕指向 /portfolio/ 一律用「導入案例」）。
 * @param {'enterprise'|'personal'|'portfolio'|'default'} intent
 * @returns {object[]} LINE Flex button 物件陣列
 */
export function buildButtons(intent) {
  switch (intent) {
    case 'enterprise':
      return [makeUriButton('預約需求訪談', CONTACT_URL, true)];
    case 'personal':
      return [
        makeUriButton('蝦皮賣場', SHOPEE_URL, true),
        makeMessageButton('真人協助', '預約'),
      ];
    case 'portfolio':
      return [makeUriButton('導入案例', PORTFOLIO_URL, true)];
    default:
      return [
        makeUriButton('導入案例', PORTFOLIO_URL, false),
        makeMessageButton('真人協助', '預約'),
      ];
  }
}

// ──────────────────────────────────────────────
// Bubble 零件
// ──────────────────────────────────────────────

function buildHeader() {
  return {
    type: 'box',
    layout: 'horizontal',
    paddingAll: '16px',
    paddingBottom: '14px',
    backgroundColor: BRAND_DARK,
    contents: [
      {
        // span 支援同一行不同顏色：THINK 白 / BIG! 粉紅
        type: 'text',
        contents: [
          { type: 'span', text: 'THINK ', color: '#ffffff', weight: 'bold' },
          { type: 'span', text: 'BIG!',   color: BRAND_PINK, weight: 'bold' },
        ],
        size: 'sm',
        flex: 1,
        gravity: 'center',
      },
    ],
  };
}

function buildBody(text) {
  const safeText = (typeof text === 'string' && text.trim()) ? text.trim() : '（無內容）';
  return {
    type: 'box',
    layout: 'vertical',
    paddingAll: '16px',
    backgroundColor: BRAND_PAPER,
    contents: [
      {
        type: 'text',
        text: safeText,
        wrap: true,
        color: BRAND_DARK,
        size: 'sm',
        lineSpacing: '6px',
      },
    ],
  };
}

function buildFooter(buttons) {
  if (!Array.isArray(buttons) || buttons.length === 0) return null;
  return {
    type: 'box',
    layout: 'vertical',
    paddingAll: '12px',
    paddingTop: '4px',
    backgroundColor: BRAND_PAPER,
    contents: buttons,
  };
}

/**
 * 建構單一 bubble。
 * @param {string} text  body 文字
 * @param {object[]} buttons footer 按鈕（可空陣列）
 * @returns {object} LINE bubble container 物件
 */
export function buildBubble(text, buttons) {
  const footer = buildFooter(buttons);
  return {
    type: 'bubble',
    size: 'mega',
    header: buildHeader(),
    body: buildBody(text),
    ...(footer ? { footer } : {}),
  };
}

// ──────────────────────────────────────────────
// 文字分段（長回覆 → carousel）
// ──────────────────────────────────────────────

/**
 * 將長文字拆成最多 2 段，優先在段落邊界切割。
 * 每段上限 MAX_BODY_CHARS 字元。
 * @param {string} text
 * @returns {string[]} 長度 1 或 2 的陣列
 */
export function splitText(text) {
  if (typeof text !== 'string') return [''];
  const t = text.trim();
  if (t.length <= MAX_BODY_CHARS) return [t];

  // 嘗試在雙換行（段落）切割
  const doubleBreak = t.lastIndexOf('\n\n', MAX_BODY_CHARS);
  if (doubleBreak > MAX_BODY_CHARS * 0.3) {
    return [t.slice(0, doubleBreak).trim(), t.slice(doubleBreak).trim()];
  }

  // 嘗試在單換行切割
  const singleBreak = t.lastIndexOf('\n', MAX_BODY_CHARS);
  if (singleBreak > MAX_BODY_CHARS * 0.3) {
    return [t.slice(0, singleBreak).trim(), t.slice(singleBreak).trim()];
  }

  // 強制截斷
  return [t.slice(0, MAX_BODY_CHARS).trim(), t.slice(MAX_BODY_CHARS).trim()];
}

// ──────────────────────────────────────────────
// 主要建構函式
// ──────────────────────────────────────────────

/**
 * 根據 AI 回覆文字建構完整 LINE Flex Message 物件。
 * 長回覆自動分成 carousel（最多 2 bubble）。
 * 按鈕優先順序：AI 回覆中的連結（確定性移除）> 意圖按鈕；總數 ≤ 3。
 * 第一顆按鈕用 primary（實心），其餘 secondary（外框）。
 *
 * @param {string} replyText AI 回覆原文（純文字，已去除 Markdown）
 * @param {object} [options]
 * @param {string} [options.intent]      強制指定意圖（'enterprise'|'personal'|'portfolio'|'default'）
 * @param {number} [options.maxButtons]  按鈕上限（0 = 不帶按鈕，預設 3）
 * @returns {{ type: 'flex', altText: string, contents: object }}
 */
export function buildFlexMessage(replyText, options = {}) {
  const { intent: intentOverride = null, maxButtons = 3 } = options;

  const rawText = typeof replyText === 'string' ? replyText.trim() : '';

  // altText：用原文前 40 字（通知列），去除換行
  const altText = rawText.replace(/\n/g, ' ').slice(0, 40) || 'Think BIG AI 顧問';

  // 確定性移除網址，收集已知 URL
  const { cleanText, foundUrls } = stripUrls(rawText);

  const intent = intentOverride !== null ? intentOverride : detectIntent(cleanText);

  // 建立 URL 驅動的按鈕（從 AI 回覆擷取，優先）
  const seenLabels = new Set();
  const urlDrivenDefs = [];
  for (const url of foundUrls) {
    const label = urlToLabel(url);
    if (!label || seenLabels.has(label)) continue;
    seenLabels.add(label);
    urlDrivenDefs.push({ type: 'uri', label, uri: url });
  }

  // 建立意圖按鈕（補位用）
  const intentButtons = buildButtons(intent);

  // 合併：URL 優先，去重，最多 cappedCount 顆
  const cappedCount = Math.min(maxButtons, 3);
  const merged = [...urlDrivenDefs];

  for (const btn of intentButtons) {
    if (merged.length >= cappedCount) break;
    const label = btn.action.label;
    if (seenLabels.has(label)) continue;
    seenLabels.add(label);
    merged.push(
      btn.action.type === 'uri'
        ? { type: 'uri',     label, uri:  btn.action.uri  }
        : { type: 'message', label, text: btn.action.text },
    );
  }

  const finalDefs = merged.slice(0, cappedCount);

  // 第一顆 primary；其餘 secondary
  const buttons = finalDefs.map((def, i) =>
    def.type === 'uri'
      ? makeUriButton(def.label, def.uri, i === 0)
      : makeMessageButton(def.label, def.text),
  );

  const parts = splitText(cleanText);

  if (parts.length <= 1) {
    return {
      type: 'flex',
      altText,
      contents: buildBubble(parts[0] ?? '', buttons),
    };
  }

  // Carousel：第一個 bubble 純內容，第二個帶按鈕
  return {
    type: 'flex',
    altText,
    contents: {
      type: 'carousel',
      contents: [
        buildBubble(parts[0], []),
        buildBubble(parts[1], buttons),
      ],
    },
  };
}

// ──────────────────────────────────────────────
// 歡迎訊息 Flex（固定 3 顆按鈕）
// ──────────────────────────────────────────────

/**
 * 建構歡迎 Flex Message（follow 事件用）。
 * Body：NEO 定稿文字 + 可點擊的隱私說明小字；
 * Footer：導入案例 / 企業導入 / 官網。
 * @returns {{ type: 'flex', altText: string, contents: object }}
 */
export function buildWelcomeFlex() {
  // 客製 body：主文 + 隱私說明小字（帶 URI action）
  const body = {
    type: 'box',
    layout: 'vertical',
    paddingAll: '16px',
    backgroundColor: BRAND_PAPER,
    contents: [
      {
        type: 'text',
        text: WELCOME_FLEX_BODY,
        wrap: true,
        color: BRAND_DARK,
        size: 'sm',
        lineSpacing: '6px',
      },
      {
        type: 'text',
        text: '對話由 AI 回覆・隱私說明 →',
        size: 'xxs',
        color: '#aaaaaa',
        margin: 'lg',
        action: { type: 'uri', uri: 'https://thinkbigtw.com/privacy.html' },
      },
    ],
  };

  const footer = {
    type: 'box',
    layout: 'vertical',
    paddingAll: '12px',
    paddingTop: '4px',
    backgroundColor: BRAND_PAPER,
    contents: [
      makeUriButton('導入案例', PORTFOLIO_URL, false),
      makeUriButton('企業導入', ENTERPRISE_URL, false),
      makeUriButton('官網',    SITE_URL,        false),
    ],
  };

  return {
    type: 'flex',
    altText: '嗨，歡迎來到Think BIG ✨',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: buildHeader(),
      body,
      footer,
    },
  };
}

// ──────────────────────────────────────────────
// JSON 大小驗證（可選，供測試使用）
// ──────────────────────────────────────────────

/**
 * 計算 Flex Message JSON 大小（bytes），並與 LINE 限制比對。
 * @param {object} flexMsg buildFlexMessage 的回傳值
 * @returns {{ bytes: number, limit: number, ok: boolean }}
 */
export function checkFlexSize(flexMsg) {
  const json = JSON.stringify(flexMsg);
  const bytes = new TextEncoder().encode(json).length;
  const isCarousel = flexMsg?.contents?.type === 'carousel';
  const limit = isCarousel ? 50000 : 30000;
  return { bytes, limit, ok: bytes <= limit };
}

// ──────────────────────────────────────────────
// Flex Reply（帶失敗備援）
// ──────────────────────────────────────────────

/**
 * 送出 Flex Message（reply）。
 * 若 LINE API 回 400/403，或 JSON 超出大小限制，自動降回純文字，
 * 確保客人一定收到回覆。
 *
 * @param {string} token        LINE channel access token
 * @param {string} replyToken   LINE reply token
 * @param {string} replyText    AI 回覆文字（純文字）
 * @param {object} [options]    buildFlexMessage 選項（intent / maxButtons）
 * @returns {Promise<{sent: 'flex'|'text', reason?: string}>}
 */
export async function sendFlexReply(token, replyToken, replyText, options = {}) {
  const safeText = String(replyText ?? '').slice(0, 1000);
  const flex = buildFlexMessage(safeText, options);

  // 先做大小檢查，超出就直接降回純文字
  const sizeCheck = checkFlexSize(flex);
  if (!sizeCheck.ok) {
    return _sendPlainReply(token, replyToken, safeText, `flex_too_large:${sizeCheck.bytes}>${sizeCheck.limit}`);
  }

  try {
    const res = await fetch(LINE_REPLY_URL_CONST, {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ replyToken, messages: [flex] }),
    });

    if (res.ok) {
      await res.body?.cancel();
      return { sent: 'flex' };
    }

    const errText = await res.text().catch(() => '');
    const reason = `flex_${res.status}:${errText.slice(0, 80)}`;
    return _sendPlainReply(token, replyToken, safeText, reason);

  } catch (e) {
    return _sendPlainReply(token, replyToken, safeText, String(e).slice(0, 80));
  }
}

/** 送出歡迎 Flex（follow 事件專用）；失敗降回 WELCOME_FLEX_BODY 純文字。 */
export async function sendWelcomeFlex(token, replyToken) {
  const flex = buildWelcomeFlex();

  try {
    const res = await fetch(LINE_REPLY_URL_CONST, {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ replyToken, messages: [flex] }),
    });
    if (res.ok) {
      await res.body?.cancel();
      return { sent: 'flex' };
    }
    const errText = await res.text().catch(() => '');
    return _sendPlainReply(token, replyToken, WELCOME_FLEX_BODY, `flex_${res.status}:${errText.slice(0, 80)}`);
  } catch (e) {
    return _sendPlainReply(token, replyToken, WELCOME_FLEX_BODY, String(e).slice(0, 80));
  }
}

/**
 * 送出 Flex Push Message（/line-push-answer 端點用）。
 * 失敗時降回純文字推播。
 * @returns {Promise<{sent: 'flex'|'text', ok: boolean, reason?: string}>}
 */
export async function sendFlexPush(token, userId, replyText, options = {}) {
  const safeText = String(replyText ?? '').slice(0, 800);
  const flex = buildFlexMessage(safeText, options);

  const sizeCheck = checkFlexSize(flex);

  if (sizeCheck.ok) {
    try {
      const res = await fetch(LINE_PUSH_URL_CONST, {
        method: 'POST',
        signal: AbortSignal.timeout(8000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: userId, messages: [flex] }),
      });
      if (res.ok) {
        await res.body?.cancel();
        return { sent: 'flex', ok: true };
      }
      const errText = await res.text().catch(() => '');
      const reason = `flex_${res.status}:${errText.slice(0, 80)}`;
      // 400/403 → 結構問題，嘗試純文字備援
      // 其他 → 直接回報失敗（不在 fallback 上繞圈）
      if (res.status !== 400 && res.status !== 403) {
        return { sent: 'flex', ok: false, reason };
      }
    } catch { /* fall through to plain text */ }
  }

  // 純文字備援
  return _sendPlainPush(token, userId, safeText, 'flex_fallback');
}

// ──────────────────────────────────────────────
// 內部備援函式（不拋例外）
// ──────────────────────────────────────────────

async function _sendPlainReply(token, replyToken, text, reason) {
  try {
    const res = await fetch(LINE_REPLY_URL_CONST, {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: 'text', text: String(text).slice(0, 1000) }],
      }),
    });
    await res.body?.cancel();
  } catch { /* P3: never throw */ }
  return { sent: 'text', reason };
}

async function _sendPlainPush(token, userId, text, reason) {
  try {
    const res = await fetch(LINE_PUSH_URL_CONST, {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        to: userId,
        messages: [{ type: 'text', text: String(text).slice(0, 800) }],
      }),
    });
    if (res.ok) {
      await res.body?.cancel();
      return { sent: 'text', ok: true, reason };
    }
    const errText = await res.text().catch(() => '');
    return { sent: 'text', ok: false, reason: `text_${res.status}:${errText.slice(0, 80)}` };
  } catch (e) {
    return { sent: 'text', ok: false, reason: String(e).slice(0, 80) };
  }
}
