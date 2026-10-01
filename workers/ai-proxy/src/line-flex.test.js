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
// T5–T8：按鈕選擇邏輯
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
  // 蝦皮按鈕必須是 URI action
  const shopeeBtn = buttons.find(b => b.action.label === '蝦皮賣場');
  assert.equal(shopeeBtn.action.type, 'uri');
  assert.ok(shopeeBtn.action.uri.startsWith('https://'));
  // 真人協助必須是 message action（傳「預約」觸發真人流程）
  const humanBtn = buttons.find(b => b.action.label === '真人協助');
  assert.equal(humanBtn.action.type, 'message');
  assert.equal(humanBtn.action.text, '預約');
});

test('T7: default intent → 看作品集 + 真人協助', () => {
  const buttons = buildButtons('default');
  const labels = buttons.map(b => b.action.label);
  assert.ok(labels.includes('看作品集'));
  assert.ok(labels.includes('真人協助'));
});

test('T8: portfolio intent → 看作品集 URI to /portfolio/', () => {
  const buttons = buildButtons('portfolio');
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0].action.label, '看作品集');
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
  assert.ok(parts[0].length <= 400 + 10); // 允許少量空白修整
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
  const long = 'Think BIG 的企業 AI Agent 解決方案，'.repeat(30); // ~500+ chars
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
  const long = '這是說明企業 AI Agent 的第一段，詳細描述了導入流程。'.repeat(20); // >400 chars
  const msg = buildFlexMessage(long);
  assert.equal(msg.contents.type, 'carousel');
  assert.equal(msg.contents.contents.length, 2);
});

test('T20: bubble 有 header 和 body，type === "bubble"', () => {
  const bubble = buildBubble('測試內容', []);
  assert.equal(bubble.type, 'bubble');
  assert.ok(bubble.header, 'bubble should have header');
  assert.ok(bubble.body, 'bubble should have body');
  // header 應含 "THINK BIG!" 文字
  const headerTexts = collectTexts(bubble.header);
  assert.ok(headerTexts.some(t => t === 'THINK BIG!'), 'header should contain THINK BIG!');
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

// 模擬 fetch：第一次（Flex）回 400，第二次（text）回 200
async function mockFetch_FlexFail(url, opts) {
  const body = JSON.parse(opts.body);
  if (body.messages?.[0]?.type === 'flex') {
    return {
      ok: false,
      status: 400,
      text: async () => '{"message":"Invalid flex message"}',
      body: { cancel: async () => {} },
    };
  }
  return { ok: true, status: 200, body: { cancel: async () => {} } };
}

// 模擬 fetch：Flex 成功
async function mockFetch_FlexOk(url, opts) {
  return { ok: true, status: 200, body: { cancel: async () => {} } };
}

// 暫時替換 global fetch
function withFetch(mockFn, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = mockFn;
  const result = fn();
  // restore after promise
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
  async function mockFetch_Throw() {
    throw new Error('Network error');
  }
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
  assert.ok(msg.altText.length > 0); // fallback altText
});
