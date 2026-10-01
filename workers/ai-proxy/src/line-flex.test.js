/**
 * line-flex.test.js
 * 單元測試 — 使用 Node.js 內建 node:test 執行
 *
 * 執行方式：
 *   node workers/ai-proxy/src/line-flex.test.js
 *
 * 需要 Node.js 18+（ESM + Web Crypto API 已內建）
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  detectIntent,
  buildButtons,
  buildBubble,
  splitText,
  buildFlexMessage,
  checkFlexSize,
  sendFlexReply,
  sendFlexPush,
  buildWelcomeFlex,
  WELCOME_FLEX_BODY,
  stripUrls,
  urlToLabel,
} from './line-flex.js';

// ────────────────────────────────────────────────────────────────────────────
// 輔助：遞迴收集 bubble 內所有文字字串
// ────────────────────────────────────────────────────────────────────────────
function collectTexts(obj) {
  if (!obj || typeof obj !== 'object') return [];
  const result = [];
  if (obj.type === 'text' && typeof obj.text === 'string') result.push(obj.text);
  if (Array.isArray(obj.contents)) obj.contents.forEach(c => result.push(...collectTexts(c)));
  for (const key of ['header', 'hero', 'body', 'footer']) {
    if (obj[key]) result.push(...collectTexts(obj[key]));
  }
  return result;
}

// 輔助：遞迴收集所有 button label 字串
function collectButtonLabels(obj) {
  if (!obj || typeof obj !== 'object') return [];
  const result = [];
  if (obj.type === 'button' && obj.action?.label) result.push(obj.action.label);
  if (Array.isArray(obj.contents)) obj.contents.forEach(c => result.push(...collectButtonLabels(c)));
  for (const key of ['header', 'hero', 'body', 'footer']) {
    if (obj[key]) result.push(...collectButtonLabels(obj[key]));
  }
  return result;
}

// 輔助：從 buildFlexMessage 結果取所有 bubble 陣列
function getBubbles(flexMsg) {
  if (flexMsg.contents?.type === 'carousel') return flexMsg.contents.contents;
  return [flexMsg.contents];
}

// 輔助：取 Flex 或純文字訊息的可讀文字
function getReplyText(msg) {
  if (!msg) return null;
  if (msg.type === 'flex') return msg.altText;
  return msg.text ?? null;
}

// ────────────────────────────────────────────────────────────────────────────
// T1–T4：意圖偵測
// ────────────────────────────────────────────────────────────────────────────

test('T1: 企業關鍵字 → enterprise', () => {
  assert.equal(detectIntent('我想了解企業導入方案'), 'enterprise');
  assert.equal(detectIntent('公司想評估 AI 助理'), 'enterprise');
  assert.equal(detectIntent('我們是跨部門的組織'), 'enterprise');
});

test('T2: 個人方案關鍵字 → personal', () => {
  assert.equal(detectIntent('個人方案多少錢'), 'personal');
  assert.equal(detectIntent('想去蝦皮買'), 'personal');
  assert.equal(detectIntent('訂閱月費怎麼算'), 'personal');
});

test('T3: 閒聊/無關 → default', () => {
  assert.equal(detectIntent('你好呀'), 'default');
  assert.equal(detectIntent('今天天氣真好'), 'default');
  assert.equal(detectIntent(''), 'default');
});

test('T4: 作品集關鍵字 → portfolio', () => {
  assert.equal(detectIntent('有沒有以前的客戶案例'), 'portfolio');
  assert.equal(detectIntent('我想看作品集'), 'portfolio');
  assert.equal(detectIntent('實績有哪些'), 'portfolio');
});

// ────────────────────────────────────────────────────────────────────────────
// T5–T8：按鈕選擇邏輯（「導入案例」取代舊「看作品集」）
// ────────────────────────────────────────────────────────────────────────────

test('T5: enterprise intent → 預約需求訪談 URI /contact/', () => {
  const buttons = buildButtons('enterprise');
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].action.label, '預約需求訪談');
  assert.ok(buttons[0].action.uri.includes('/contact/'));
  assert.equal(buttons[0].action.type, 'uri');
});

test('T6: personal intent → 蝦皮賣場 URI + 真人協助 message', () => {
  const buttons = buildButtons('personal');
  assert.equal(buttons.length, 2);
  const labels = buttons.map(b => b.action.label);
  assert.ok(labels.includes('蝦皮賣場'));
  assert.ok(labels.includes('真人協助'));
  const shopeeBtn = buttons.find(b => b.action.label === '蝦皮賣場');
  assert.equal(shopeeBtn.action.type, 'uri');
  assert.ok(shopeeBtn.action.uri.startsWith('https://'));
  const humanBtn = buttons.find(b => b.action.label === '真人協助');
  assert.equal(humanBtn.action.type, 'message');
  assert.equal(humanBtn.action.text, '預約');
});

test('T7: default intent → 導入案例 + 真人協助', () => {
  const buttons = buildButtons('default');
  const labels = buttons.map(b => b.action.label);
  assert.ok(labels.includes('導入案例'), `labels: ${labels}`);
  assert.ok(labels.includes('真人協助'));
});

test('T8: portfolio intent → 導入案例 URI to /portfolio/', () => {
  const buttons = buildButtons('portfolio');
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].action.label, '導入案例');
  assert.ok(buttons[0].action.uri.includes('/portfolio/'));
});

// ────────────────────────────────────────────────────────────────────────────
// T9–T10：文字分段
// ────────────────────────────────────────────────────────────────────────────

test('T9: 短文字 (≤400) → 1 段', () => {
  const short = '嗨！很高興為你服務，請問有什麼可以幫忙的呢？';
  const parts = splitText(short);
  assert.equal(parts.length, 1);
  assert.equal(parts[0], short);
});

test('T10: 長文字 (>400) 有段落邊界 → 2 段', () => {
  const para1 = 'A'.repeat(200);
  const para2 = 'B'.repeat(200);
  const long = para1 + '\n\n' + para2;
  const parts = splitText(long);
  assert.equal(parts.length, 2);
  assert.ok(parts[0].length <= 400 + 10);
  assert.ok(parts[1].length > 0);
});

test('T10b: 長文字無段落邊界 → 強制截斷成 2 段', () => {
  const long = 'X'.repeat(600);
  const parts = splitText(long);
  assert.equal(parts.length, 2);
  assert.equal(parts[0].length, 400);
  assert.equal(parts[1].length, 200);
});

// ────────────────────────────────────────────────────────────────────────────
// T11–T12：JSON 大小限制
// ────────────────────────────────────────────────────────────────────────────

test('T11: 一般回覆 bubble JSON ≤ 30 KB', () => {
  const msg = buildFlexMessage('嗨！這是一則正常長度的 AI 回覆，介紹了 Think BIG 的個人 AI Agent 服務。');
  const { bytes, limit, ok } = checkFlexSize(msg);
  assert.ok(ok, `bubble JSON ${bytes} bytes > ${limit} bytes`);
});

test('T12: 長回覆 carousel JSON ≤ 50 KB', () => {
  const long = 'Think BIG 的企業 AI Agent 解決方案，'.repeat(30);
  const msg = buildFlexMessage(long);
  const { bytes, limit, ok } = checkFlexSize(msg);
  assert.ok(ok, `carousel JSON ${bytes} bytes > ${limit} bytes`);
});

// ────────────────────────────────────────────────────────────────────────────
// T13–T14：altText 格式
// ────────────────────────────────────────────────────────────────────────────

test('T13: altText 長度 ≤ 40 字元', () => {
  const long = '這是一段很長的 AI 回覆，從很多角度說明了企業導入 AI 的好處和注意事項，以及後續服務流程。';
  const msg = buildFlexMessage(long);
  assert.ok(msg.altText.length <= 40, `altText too long: ${msg.altText.length}`);
});

test('T14: altText 不含換行', () => {
  const withNewlines = '第一段\n\n第二段';
  const msg = buildFlexMessage(withNewlines);
  assert.ok(!msg.altText.includes('\n'), 'altText should not contain newlines');
});

// ────────────────────────────────────────────────────────────────────────────
// T15–T16：按鈕標籤不含金額 / 禁用詞
// ────────────────────────────────────────────────────────────────────────────

const AMOUNT_PATTERN  = /NT\$|[\d,]+\s*元|[\d,]+\s*萬|[\d,]+\s*千|價格|定價/;
const FORBIDDEN_WORDS = /保證|取代|裁員|引擎|三級|回本|限量|名額|唯一|首創|NEO/;

test('T15: 所有按鈕標籤不含金額字串', () => {
  const intents = ['enterprise', 'personal', 'portfolio', 'default'];
  for (const intent of intents) {
    const buttons = buildButtons(intent);
    for (const btn of buttons) {
      const label = btn.action.label;
      assert.ok(!AMOUNT_PATTERN.test(label), `按鈕 "${label}" 含金額字串（intent: ${intent}）`);
    }
  }
});

test('T16: 所有按鈕標籤不含禁用詞', () => {
  const intents = ['enterprise', 'personal', 'portfolio', 'default'];
  for (const intent of intents) {
    const buttons = buildButtons(intent);
    for (const btn of buttons) {
      const label = btn.action.label;
      assert.ok(!FORBIDDEN_WORDS.test(label), `按鈕 "${label}" 含禁用詞（intent: ${intent}）`);
    }
  }
});

// ────────────────────────────────────────────────────────────────────────────
// T17–T20：buildFlexMessage 結構合法性
// ────────────────────────────────────────────────────────────────────────────

test('T17: buildFlexMessage 回傳物件有 type/altText/contents', () => {
  const msg = buildFlexMessage('嗨嗨，我是 AI 小助理！');
  assert.equal(msg.type, 'flex');
  assert.ok(typeof msg.altText === 'string' && msg.altText.length > 0);
  assert.ok(msg.contents && typeof msg.contents === 'object');
});

test('T18: 短回覆 → 單一 bubble（不是 carousel）', () => {
  const msg = buildFlexMessage('沒問題，很樂意為您說明！');
  assert.equal(msg.contents.type, 'bubble');
});

test('T19: 長回覆 → carousel，含 2 個 bubble', () => {
  const long = '這是說明企業 AI Agent 的第一段，詳細描述了導入流程。'.repeat(20);
  const msg = buildFlexMessage(long);
  assert.equal(msg.contents.type, 'carousel');
  assert.equal(msg.contents.contents.length, 2);
});

test('T20: bubble 有 header 和 body，type === "bubble"', () => {
  const bubble = buildBubble('測試內容', []);
  assert.equal(bubble.type, 'bubble');
  assert.ok(bubble.header, 'bubble should have header');
  assert.ok(bubble.body, 'bubble should have body');
  // header span 含 BIG!（粉紅）
  const headerSpans = bubble.header.contents?.[0]?.contents ?? [];
  assert.ok(headerSpans.some(s => s.text?.includes('BIG!')), 'header span should contain BIG!');
});

// ────────────────────────────────────────────────────────────────────────────
// T21：按鈕 label ≤ 20 字元（LINE 規範）
// ────────────────────────────────────────────────────────────────────────────

test('T21: 所有按鈕 label ≤ 20 字元', () => {
  const intents = ['enterprise', 'personal', 'portfolio', 'default'];
  for (const intent of intents) {
    const buttons = buildButtons(intent);
    for (const btn of buttons) {
      const label = btn.action.label;
      assert.ok(label.length <= 20, `按鈕 "${label}" 超過 20 字元（${label.length} 字）`);
    }
  }
});

// ────────────────────────────────────────────────────────────────────────────
// T22–T24：失敗備援（sendFlexReply）
// ────────────────────────────────────────────────────────────────────────────

async function mockFetch_FlexFail(url, opts) {
  const body = JSON.parse(opts.body);
  if (body.messages?.[0]?.type === 'flex') {
    return { ok: false, status: 400, text: async () => '{"message":"Invalid"}', body: { cancel: async () => {} } };
  }
  return { ok: true, status: 200, body: { cancel: async () => {} } };
}

async function mockFetch_FlexOk(url, opts) {
  return { ok: true, status: 200, body: { cancel: async () => {} } };
}

function withFetch(mockFn, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = mockFn;
  const result = fn();
  if (result && typeof result.then === 'function') {
    return result.finally(() => { globalThis.fetch = original; });
  }
  globalThis.fetch = original;
  return result;
}

test('T22: sendFlexReply — Flex 成功 → {sent: "flex"}', async () => {
  const result = await withFetch(mockFetch_FlexOk, () =>
    sendFlexReply('tok', 'rt', '嗨！這是測試回覆。')
  );
  assert.equal(result.sent, 'flex');
  assert.equal(result.reason, undefined);
});

test('T23: sendFlexReply — Flex 400 → 降回純文字 {sent: "text"}', async () => {
  const result = await withFetch(mockFetch_FlexFail, () =>
    sendFlexReply('tok', 'rt', '測試備援機制。')
  );
  assert.equal(result.sent, 'text');
  assert.ok(typeof result.reason === 'string' && result.reason.includes('400'));
});

test('T24: sendFlexReply — fetch 拋例外 → 降回純文字 {sent: "text"}', async () => {
  async function mockFetch_Throw() { throw new Error('Network error'); }
  const result = await withFetch(mockFetch_Throw, () =>
    sendFlexReply('tok', 'rt', '測試例外處理。')
  );
  assert.equal(result.sent, 'text');
  assert.ok(result.reason.includes('Network error'));
});

// ────────────────────────────────────────────────────────────────────────────
// T25：URI buttons 都是 https://
// ────────────────────────────────────────────────────────────────────────────

test('T25: 所有 URI button 使用 https://', () => {
  const intents = ['enterprise', 'personal', 'portfolio', 'default'];
  for (const intent of intents) {
    const buttons = buildButtons(intent);
    for (const btn of buttons) {
      if (btn.action.type === 'uri') {
        assert.ok(
          btn.action.uri.startsWith('https://'),
          `按鈕 "${btn.action.label}" URI 不是 https://: ${btn.action.uri}`
        );
      }
    }
  }
});

// ────────────────────────────────────────────────────────────────────────────
// T26：空字串/undefined 輸入不崩潰
// ────────────────────────────────────────────────────────────────────────────

test('T26: buildFlexMessage 空輸入不崩潰', () => {
  assert.doesNotThrow(() => buildFlexMessage(''));
  assert.doesNotThrow(() => buildFlexMessage(null));
  assert.doesNotThrow(() => buildFlexMessage(undefined));
  const msg = buildFlexMessage('');
  assert.equal(msg.type, 'flex');
  assert.ok(msg.altText.length > 0);
});

// ────────────────────────────────────────────────────────────────────────────
// T27：options.maxButtons
// ────────────────────────────────────────────────────────────────────────────

test('T27: maxButtons:0 → bubble 無 footer', () => {
  const msg = buildFlexMessage('這是一般 AI 回覆', { maxButtons: 0 });
  const bubble = msg.contents;
  assert.equal(bubble.type, 'bubble');
  assert.equal(bubble.footer, undefined, 'footer 應為 undefined（無按鈕）');
});

test('T27b: maxButtons:1 → 最多 1 顆按鈕', () => {
  // personal intent 本來有 2 顆按鈕
  const msg = buildFlexMessage('個人方案怎麼選', { maxButtons: 1 });
  const labels = collectButtonLabels(msg.contents);
  assert.ok(labels.length <= 1, `按鈕數應 ≤ 1，實際：${labels.length}`);
});

// ────────────────────────────────────────────────────────────────────────────
// T28：buildWelcomeFlex
// ────────────────────────────────────────────────────────────────────────────

test('T28: buildWelcomeFlex 結構正確', () => {
  const msg = buildWelcomeFlex();
  assert.equal(msg.type, 'flex');
  // altText = NEO 定稿第一行
  assert.ok(msg.altText.includes('Think BIG'), `altText: ${msg.altText}`);
  // contents 是 bubble
  assert.equal(msg.contents.type, 'bubble');
  // footer 有 3 顆按鈕
  const labels = collectButtonLabels(msg.contents);
  assert.equal(labels.length, 3, `按鈕數應為 3，實際：${labels.join(',')}`);
  assert.ok(labels.includes('導入案例'));
  assert.ok(labels.includes('企業導入'));
  assert.ok(labels.includes('官網'));
  // 所有按鈕 URI 以 https://
  const uriButtons = (msg.contents.footer?.contents ?? []).filter(b => b.action?.type === 'uri');
  for (const btn of uriButtons) {
    assert.ok(btn.action.uri.startsWith('https://'), `${btn.action.label} URI: ${btn.action.uri}`);
  }
});

test('T28b: WELCOME_FLEX_BODY 含 NEO 定稿文字', () => {
  assert.ok(WELCOME_FLEX_BODY.includes('Make it Real'), 'Welcome body 應含 Make it Real');
  assert.ok(WELCOME_FLEX_BODY.includes('Think BIG'), 'Welcome body 應含 Think BIG');
  assert.ok(!WELCOME_FLEX_BODY.includes('月費'), 'Welcome body 不應含費用描述');
});

// ────────────────────────────────────────────────────────────────────────────
// T29–T30：sendFlexPush
// ────────────────────────────────────────────────────────────────────────────

async function mockPush_Ok(url, opts) {
  return { ok: true, status: 200, body: { cancel: async () => {} } };
}

async function mockPush_FlexFail400(url, opts) {
  const body = JSON.parse(opts.body);
  if (body.messages?.[0]?.type === 'flex') {
    return { ok: false, status: 400, text: async () => '{"message":"Bad"}', body: { cancel: async () => {} } };
  }
  return { ok: true, status: 200, body: { cancel: async () => {} } };
}

test('T29: sendFlexPush 成功 → {sent: "flex", ok: true}', async () => {
  const result = await withFetch(mockPush_Ok, () =>
    sendFlexPush('tok', 'U123', '您好，查到答案了：測試答案')
  );
  assert.equal(result.sent, 'flex');
  assert.equal(result.ok, true);
});

test('T30: sendFlexPush Flex 400 → fallback 純文字 {sent: "text", ok: true}', async () => {
  const result = await withFetch(mockPush_FlexFail400, () =>
    sendFlexPush('tok', 'U123', '測試備援推播')
  );
  assert.equal(result.sent, 'text');
  assert.equal(result.ok, true);
});

// ────────────────────────────────────────────────────────────────────────────
// T31：header span 顏色正確（THINK 白 / BIG! 粉紅）
// ────────────────────────────────────────────────────────────────────────────

test('T31: header THINK 白色，BIG! 粉紅', () => {
  const bubble = buildBubble('test', []);
  const spans = bubble.header.contents?.[0]?.contents ?? [];
  assert.ok(spans.length >= 2, '應有至少 2 個 span');
  const thinkSpan = spans.find(s => s.text?.includes('THINK'));
  const bigSpan   = spans.find(s => s.text?.includes('BIG!'));
  assert.ok(thinkSpan?.color === '#ffffff', `THINK 應為白色，實際: ${thinkSpan?.color}`);
  assert.ok(bigSpan?.color  === '#eea4bb', `BIG! 應為粉紅，實際: ${bigSpan?.color}`);
});

// ────────────────────────────────────────────────────────────────────────────
// T32：options.intent 強制覆蓋
// ────────────────────────────────────────────────────────────────────────────

test('T32: intent 強制 enterprise → 顯示預約按鈕，即使文字無企業關鍵字', () => {
  const msg = buildFlexMessage('謝謝你的訊息！', { intent: 'enterprise' });
  const labels = collectButtonLabels(msg.contents);
  assert.ok(labels.includes('預約需求訪談'), `labels: ${labels}`);
});

// ────────────────────────────────────────────────────────────────────────────
// T33–T40：URL 確定性移除 + 按鈕轉換（NEO 截圖案例 + 邊界條件）
// ────────────────────────────────────────────────────────────────────────────

test('T33: NEO截圖案例 — 兩條bullet網址移除、內文無http、按鈕含企業導入＋個人方案、≤3顆', () => {
  const neoInput =
    'Think BIG 目前有以下兩個方向可以參考：\n\n' +
    '・企業 AI 導入：https://thinkbigtw.com/enterprise/\n' +
    '・個人 AI 助理：https://thinkbigtw.com/pricing/personal/';

  const msg = buildFlexMessage(neoInput);

  // 內文（body text）不含 http
  const allTexts = collectTexts(msg.contents);
  for (const t of allTexts) {
    assert.ok(!t.includes('http'), `內文含網址：${t}`);
  }

  // 按鈕含企業導入 & 個人方案
  const labels = collectButtonLabels(msg.contents);
  assert.ok(labels.includes('企業導入'), `缺少企業導入，實際：${labels}`);
  assert.ok(labels.includes('個人方案'), `缺少個人方案，實際：${labels}`);

  // 總按鈕數 ≤ 3
  assert.ok(labels.length <= 3, `按鈕數超過3：${labels.length}`);
});

test('T34: stripUrls 整行 label：URL → 整行移除，URL 收集', () => {
  const text =
    '以下是相關連結：\n' +
    '・企業 AI 導入：https://thinkbigtw.com/enterprise/\n' +
    '・官網：https://thinkbigtw.com/';
  const { cleanText, foundUrls } = stripUrls(text);
  assert.ok(!cleanText.includes('http'), `cleanText 含http: ${cleanText}`);
  assert.equal(foundUrls.length, 2, `應收集2個URL，實際：${foundUrls.length}`);
  assert.ok(!cleanText.includes('企業 AI 導入：'), `殘句應被清除，cleanText: ${cleanText}`);
});

test('T35: markdown 連結 → 整組移除、URL 收集', () => {
  const text = '詳情請見 [企業方案](https://thinkbigtw.com/enterprise/)，歡迎詢問。';
  const { cleanText, foundUrls } = stripUrls(text);
  assert.ok(!cleanText.includes('http'), `cleanText 含http: ${cleanText}`);
  assert.ok(
    foundUrls.some(u => u.includes('/enterprise/')),
    `foundUrls 應含 /enterprise/，實際：${foundUrls}`,
  );
});

test('T36: 未知網域 → 從內文移除，不轉按鈕', () => {
  const text = '更多資訊：https://google.com/search?q=ai 請自行查閱。';
  const msg = buildFlexMessage(text);

  // 內文無 http
  for (const t of collectTexts(msg.contents)) {
    assert.ok(!t.includes('http'), `內文含網址：${t}`);
  }

  // 不應有「官網」按鈕（未知網域不轉按鈕）
  const labels = collectButtonLabels(msg.contents);
  assert.ok(!labels.includes('官網'), `未知網域不應轉官網按鈕，labels: ${labels}`);
});

test('T37: URL 按鈕優先於意圖按鈕、第一顆 primary style', () => {
  // 文字含 /enterprise/ URL → 企業導入按鈕（URL 驅動）
  // intent 也是 enterprise → 預約需求訪談（意圖按鈕）
  // 企業導入 應排在第一顆且是 primary
  const text = '企業導入相關資訊：https://thinkbigtw.com/enterprise/ 歡迎詢問。';
  const msg  = buildFlexMessage(text);
  const labels = collectButtonLabels(msg.contents);
  assert.equal(labels[0], '企業導入', `第一顆應為企業導入，實際：${labels[0]}`);

  // 找第一顆按鈕確認 style=primary（getBubbles 接 msg，非 msg.contents）
  const bubbles = getBubbles(msg);
  const firstBtn = bubbles
    .flatMap(b => b.footer?.contents ?? [])
    .find(c => c.type === 'button');
  assert.equal(firstBtn?.style, 'primary', `第一顆按鈕 style 應為 primary`);
});

test('T38: 同路徑出現兩次 → 只產生一顆按鈕（去重）', () => {
  const text =
    '企業方案：https://thinkbigtw.com/enterprise/\n' +
    '企業導入：https://thinkbigtw.com/enterprise/';
  const msg = buildFlexMessage(text);
  const labels = collectButtonLabels(msg.contents);
  const count = labels.filter(l => l === '企業導入').length;
  assert.equal(count, 1, `企業導入按鈕應只有1顆，實際：${count}`);
});

test('T39: urlToLabel 路徑對應表', () => {
  assert.equal(urlToLabel('https://thinkbigtw.com/enterprise/'),         '企業導入');
  assert.equal(urlToLabel('https://thinkbigtw.com/enterprise/start/'),   '自助評估');
  assert.equal(urlToLabel('https://thinkbigtw.com/pricing/personal/'),   '個人方案');
  assert.equal(urlToLabel('https://thinkbigtw.com/pricing/'),            '個人方案');
  assert.equal(urlToLabel('https://thinkbigtw.com/portfolio/'),          '導入案例');
  assert.equal(urlToLabel('https://thinkbigtw.com/contact/'),            '預約需求訪談');
  assert.equal(urlToLabel('https://thinkbigtw.com/'),                    '官網');
  assert.equal(urlToLabel('https://shopee.tw/shop/105010395'),           '蝦皮賣場');
  assert.equal(urlToLabel('https://lin.ee/abc123'),                       null);
  assert.equal(urlToLabel('https://google.com/'),                         null);
});

test('T40: maxButtons:0 時 URL 按鈕也不帶（現有 T27 補充）', () => {
  const text = '請見：https://thinkbigtw.com/enterprise/';
  const msg  = buildFlexMessage(text, { maxButtons: 0 });
  assert.equal(msg.contents.type, 'bubble');
  assert.equal(msg.contents.footer, undefined, 'maxButtons:0 不應有 footer');
});
