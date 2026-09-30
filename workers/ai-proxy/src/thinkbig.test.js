/**
 * thinkbig.test.js
 * 單元測試 — 使用 Node.js 內建 node:test 執行
 *
 * 執行方式：
 *   node workers/ai-proxy/src/thinkbig.test.js
 *
 * 需要 Node.js 18+
 *
 * 回歸測試：確保個人方案路由不被企業方案路由覆蓋（2026-10-01 修復）
 * 覆蓋六題：
 *   Q1：雙 AI Agent 多少錢？ → ch07（個人方案）
 *   Q2：共存版多少錢？       → ch07
 *   Q3：12,000 有協作會議室嗎？ → ch07，答案應含「不含」
 *   Q4：15,000 包含什麼？    → ch07
 *   Q5：人格版多少錢？       → ch07
 *   Q6：企業方案多少錢？     → ch11（企業方案）
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { selectKnowledge } from './thinkbig.js';

function msg(content) {
  return [{ role: 'user', content }];
}

// ── Q1：雙 AI Agent 多少錢 ─────────────────────────────────────────
test('Q1 雙 AI Agent 多少錢 → 選到 ch07（個人方案）', () => {
  const { selected, text } = selectKnowledge(msg('雙 AI Agent 多少錢？'));
  assert.ok(selected.includes('07'), `expected ch07, got ${selected}`);
  // ch07 text should mention NT$12,000 and NT$15,000
  assert.ok(text.includes('12,000'), '文字應含 NT$12,000（共存版）');
  assert.ok(text.includes('15,000'), '文字應含 NT$15,000（雙 AI Agent）');
});

// ── Q2：共存版多少錢 ───────────────────────────────────────────────
test('Q2 共存版多少錢 → 選到 ch07', () => {
  const { selected, text } = selectKnowledge(msg('共存版多少錢？'));
  assert.ok(selected.includes('07'), `expected ch07, got ${selected}`);
  assert.ok(text.includes('12,000'), '文字應含 NT$12,000');
});

// ── Q3：12,000 有沒有協作會議室 ─────────────────────────────────────
test('Q3 12,000 有沒有協作會議室 → 選到 ch07，文字含「不含」', () => {
  const { selected, text } = selectKnowledge(msg('12,000 的方案有協作會議室嗎？'));
  assert.ok(selected.includes('07'), `expected ch07, got ${selected}`);
  // ch07 says 共存版 NT$12,000 不含協作會議室
  assert.ok(text.includes('不含'), '文字應明確說明不含協作會議室');
  assert.ok(text.includes('協作'), '文字應提到協作會議室');
});

// ── Q4：15,000 包含什麼 ───────────────────────────────────────────
test('Q4 15,000 包含什麼 → 選到 ch07，文字含協作會議室說明', () => {
  const { selected, text } = selectKnowledge(msg('15,000 的雙 AI Agent 方案包含什麼？'));
  assert.ok(selected.includes('07'), `expected ch07, got ${selected}`);
  assert.ok(text.includes('15,000'), '文字應含 NT$15,000');
  assert.ok(text.includes('協作'), '文字應提到協作會議室');
  assert.ok(text.includes('記憶互通'), '文字應提到記憶互通');
});

// ── Q5：人格版多少錢 ───────────────────────────────────────────────
test('Q5 人格版多少錢 → 選到 ch07，文字含 NT$6,000', () => {
  const { selected, text } = selectKnowledge(msg('人格版 AI 助理多少錢？'));
  assert.ok(selected.includes('07'), `expected ch07, got ${selected}`);
  assert.ok(text.includes('6,000'), '文字應含 NT$6,000');
});

// ── Q6：企業方案多少錢 ─────────────────────────────────────────────
test('Q6 企業方案多少錢 → 選到 ch11（企業方案）', () => {
  const { selected, text } = selectKnowledge(msg('請問企業方案多少錢？'));
  assert.ok(selected.includes('11'), `expected ch11, got ${selected}`);
  assert.ok(text.includes('33,000') || text.includes('33000'), '文字應含企業入門 NT$33,000');
});

// ── 防退化：ch07 和 ch11 同分時，個人關鍵字讓 ch07 優先 ─────────────
test('防退化：雙 AI Agent + 多少錢 同時出現時 ch07 排在 ch11 前', () => {
  const { selected } = selectKnowledge(msg('雙 AI Agent 多少錢？'));
  const i07 = selected.indexOf('07');
  const i11 = selected.indexOf('11');
  // If both selected, ch07 should appear before ch11 (or ch11 not selected at all)
  if (i07 !== -1 && i11 !== -1) {
    assert.ok(i07 < i11, `ch07 (idx ${i07}) should come before ch11 (idx ${i11})`);
  } else {
    assert.ok(i07 !== -1, 'ch07 should always be selected for personal plan queries');
  }
});

// ── ch07 含 12k 和 15k 描述 ────────────────────────────────────────
test('ch07 文字同時有 12,000 和 15,000 兩個方案', () => {
  const { selected, text } = selectKnowledge(msg('個人方案有哪些？'));
  assert.ok(selected.includes('07'), `expected ch07, got ${selected}`);
  assert.ok(text.includes('12,000'), '共存版 NT$12,000 應在 ch07');
  assert.ok(text.includes('15,000'), '雙 AI Agent NT$15,000 應在 ch07');
});

// ── Q9：企業續約完整級每月多少 → 選到 ch11 ────────────────────────
test('Q9 企業續約完整級每月多少 → 選到 ch11', () => {
  const { selected, text } = selectKnowledge(msg('企業方案完整級續約每個月多少錢？'));
  assert.ok(selected.includes('11'), `expected ch11, got ${selected}`);
  assert.ok(text.includes('15,000') || text.includes('15000'), '文字應含完整級續約 NT$15,000/月');
});

// ── Q10：Muse 取代龍蝦？→ 選到 ch08，核心句存在，不貶低品牌 ────────
test('Q10 Muse 取代龍蝦？ → 選到 ch08，含核心句，不貶低品牌', () => {
  const { selected, text } = selectKnowledge(msg('Muse 會不會取代龍蝦？'));
  assert.ok(selected.includes('08'), `expected ch08, got ${selected}`);
  // 核心句：兩者可以一起用，費用可控是差異點
  assert.ok(text.includes('每一個都很好'), '文字應含「每一個都很好」（核心句）');
  assert.ok(text.includes('費用可控'), '文字應含「費用可控」（核心句）');
  // 不貶低任何品牌
  assert.ok(!text.includes('比較差') && !text.includes('不如') && !text.includes('劣'), '不應出現貶低品牌的詞彙');
});

// ── Q11：Grok Agent → 還需要龍蝦？→ 選到 ch08，核心句存在 ─────────
test('Q11 Grok 出了 agent 還需要龍蝦嗎？ → 選到 ch08，含核心句', () => {
  const { selected, text } = selectKnowledge(msg('Grok 出了 agent 那我還需要龍蝦嗎？'));
  assert.ok(selected.includes('08'), `expected ch08, got ${selected}`);
  assert.ok(text.includes('每一個都很好'), '文字應含「每一個都很好」（核心句）');
  assert.ok(text.includes('長時間運作'), '文字應含「長時間運作」（核心句）');
});

// ── Q12：新 AI Agent 那麼多怎麼選？→ 選到 ch08，核心句存在 ──────────
test('Q12 新的 AI Agent 那麼多要怎麼選？ → 選到 ch08，含核心句', () => {
  const { selected, text } = selectKnowledge(msg('新的 AI Agent 那麼多要怎麼選？'));
  assert.ok(selected.includes('08'), `expected ch08, got ${selected}`);
  assert.ok(text.includes('每一個都很好'), '文字應含「每一個都很好」（核心句）');
  assert.ok(text.includes('協作'), '文字應含「協作」（核心句結尾）');
});

// ── Q13：你們跟大品牌的 AI Agent 差在哪？資安呢？→ 選到 ch08，含資安審查 ──
test('Q13 你們跟大品牌的 AI Agent 差在哪？資安呢？ → 選到 ch08，含資安審查句', () => {
  const { selected, text } = selectKnowledge(msg('你們跟大品牌的 AI Agent 差在哪？資安呢？'));
  assert.ok(selected.includes('08'), `expected ch08, got ${selected}`);
  assert.ok(text.includes('打包票'), '文字應含「打包票」（資安審查核心句）');
  assert.ok(text.includes('一道一道的審查'), '文字應含「一道一道的審查」（資安核心句）');
});
