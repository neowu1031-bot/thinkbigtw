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
 *   若後續評估仍需保留純文字備份，可在 sendFlexReply 中
 *   額外發送一則 text message（需兩則 reply messages 配額）。
 */

const LINE_REPLY_URL = 'https://api.line.me/v2/bot/message/reply';

// ── 品牌配色（對應 assets/homesplit/site.css :root） ──────────────────────
const BRAND_DARK  = '#191a1d';  // --ink（header 背景）
const BRAND_PINK  = '#eea4bb';  // --brand（點綴色）
const BRAND_PAPER = '#f7f6f2';  // --paper（body / footer 背景）
const BRAND_MUTED = '#5c5d63';  // --muted（副文字）

// ── 外部連結（固定） ──────────────────────────────────────────────────────
const SHOPEE_URL    = 'https://shopee.tw/shop/105010395';
const PORTFOLIO_URL = 'https://thinkbigtw.com/portfolio/';
const CONTACT_URL   = 'https://thinkbigtw.com/contact/';

// 每個 bubble body 文字上限（超出則拆 carousel）
const MAX_BODY_CHARS = 400;

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
  // primary 按鈕套品牌深色
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
 * 根據意圖返回 1–3 顆按鈕。
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
      return [makeUriButton('看作品集', PORTFOLIO_URL, true)];
    default:
      return [
        makeUriButton('看作品集', PORTFOLIO_URL, false),
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
        type: 'text',
        text: 'THINK BIG!',
        weight: 'bold',
        color: '#ffffff',
        size: 'sm',
        flex: 1,
        gravity: 'center',
      },
      // 粉紅點綴
      {
        type: 'box',
        layout: 'vertical',
        width: '8px',
        height: '8px',
        backgroundColor: BRAND_PINK,
        cornerRadius: '4px',
        contents: [],
        justifyContent: 'center',
        alignItems: 'center',
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

  // 強制截斷（不切半個 CJK 字元）
  return [t.slice(0, MAX_BODY_CHARS).trim(), t.slice(MAX_BODY_CHARS).trim()];
}

// ──────────────────────────────────────────────
// 主要建構函式
// ──────────────────────────────────────────────

/**
 * 根據 AI 回覆文字建構完整 LINE Flex Message 物件。
 * 長回覆自動分成 carousel（最多 2 bubble）。
 * 按鈕依意圖自動帶入。
 *
 * @param {string} replyText AI 回覆原文（純文字，已去除 Markdown）
 * @returns {{ type: 'flex', altText: string, contents: object }}
 */
export function buildFlexMessage(replyText) {
  const text = typeof replyText === 'string' ? replyText.trim() : '';

  // altText：前 40 字（通知列），去除換行
  const altText = (text.replace(/\n/g, ' ').slice(0, 40)) || 'Think BIG AI 顧問';

  const intent  = detectIntent(text);
  const buttons = buildButtons(intent);
  const parts   = splitText(text);

  if (parts.length <= 1) {
    // 單一 bubble
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
 * 送出 Flex Message。
 * 若 LINE API 回 400/403，或 JSON 超出大小限制，自動降回純文字，
 * 確保客人一定收到回覆。
 *
 * @param {string} token        LINE channel access token
 * @param {string} replyToken   LINE reply token
 * @param {string} replyText    AI 回覆文字（純文字）
 * @returns {Promise<{sent: 'flex'|'text', reason?: string}>}
 */
export async function sendFlexReply(token, replyToken, replyText) {
  const safeText = String(replyText ?? '').slice(0, 1000);
  const flex = buildFlexMessage(safeText);

  // 先做大小檢查，超出就直接降回純文字
  const sizeCheck = checkFlexSize(flex);
  if (!sizeCheck.ok) {
    return _sendPlainText(token, replyToken, safeText, `flex_too_large:${sizeCheck.bytes}>${sizeCheck.limit}`);
  }

  try {
    const res = await fetch(LINE_REPLY_URL, {
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

    // 400/403 = JSON 結構問題或 replyToken 失效 → 降回純文字
    const errText = await res.text().catch(() => '');
    const reason = `flex_${res.status}:${errText.slice(0, 80)}`;
    return _sendPlainText(token, replyToken, safeText, reason);

  } catch (e) {
    return _sendPlainText(token, replyToken, safeText, String(e).slice(0, 80));
  }
}

/** 內部：送出純文字備援（不拋例外）。 */
async function _sendPlainText(token, replyToken, text, reason) {
  try {
    const res = await fetch(LINE_REPLY_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: 'text', text: String(text).slice(0, 1000) }],
      }),
    });
    await res.body?.cancel();
  } catch { /* P3: never throw */ }
  return { sent: 'text', reason };
}
