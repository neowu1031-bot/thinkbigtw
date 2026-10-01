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
 * 2026-10-01（remove-prices-1001）：KB 改依需求報價，移除具體金額；
 * 測試改驗路由正確性與「依需求報價」關鍵字，不再驗具體金額。
 * 覆蓋六題：
 *   Q1：雙 AI Agent 多少錢？ → ch07（個人方案）
 *   Q2：共存版多少錢？       → ch07
 *   Q3：共存版有協作會議室嗎？ → ch07，答案應含「不含」
 *   Q4：雙 AI Agent 包含什麼？ → ch07
 *   Q5：人格版多少錢？       → ch07
 *   Q6：企業方案多少錢？     → ch11（企業方案）
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { selectKnowledge, selectKnowledgePrimary, fullKBText, KB_FULL_LIMIT, estimateTokens } from './thinkbig.js';

function msg(content) {
  return [{ role: 'user', content }];
}

// ── Q1：雙 AI Agent 多少錢 ─────────────────────────────────────────
test('Q1 雙 AI Agent 多少錢 → 選到 ch07（個人方案）', () => {
  const { selected, text } = selectKnowledge(msg('雙 AI Agent 多少錢？'));
  assert.ok(selected.includes('07'), `expected ch07, got ${selected}`);
  // ch07 說依需求報價（remove-prices-1001 後不含具體金額）
  assert.ok(text.includes('依需求報價') || text.includes('蝦皮'), '文字應含「依需求報價」或「蝦皮」');
  assert.ok(text.includes('共存版'), '文字應含「共存版」');
});

// ── Q2：共存版多少錢 ───────────────────────────────────────────────
test('Q2 共存版多少錢 → 選到 ch07', () => {
  const { selected, text } = selectKnowledge(msg('共存版多少錢？'));
  assert.ok(selected.includes('07'), `expected ch07, got ${selected}`);
  assert.ok(text.includes('共存版'), '文字應含「共存版」');
  assert.ok(text.includes('依需求報價') || text.includes('蝦皮'), '文字應含依需求報價說明');
});

// ── Q3：共存版有沒有協作會議室 ──────────────────────────────────────
test('Q3 共存版有沒有協作會議室 → 選到 ch07，文字含「不含」', () => {
  const { selected, text } = selectKnowledge(msg('共存版方案有協作會議室嗎？'));
  assert.ok(selected.includes('07'), `expected ch07, got ${selected}`);
  // ch07 說共存版不含協作會議室
  assert.ok(text.includes('不含'), '文字應明確說明不含協作會議室');
  assert.ok(text.includes('協作'), '文字應提到協作會議室');
});

// ── Q4：雙 AI Agent 包含什麼 ──────────────────────────────────────
test('Q4 雙 AI Agent 包含什麼 → 選到 ch07，文字含協作會議室說明', () => {
  const { selected, text } = selectKnowledge(msg('雙 AI Agent 方案包含什麼？'));
  assert.ok(selected.includes('07'), `expected ch07, got ${selected}`);
  assert.ok(text.includes('協作'), '文字應提到協作會議室');
  assert.ok(text.includes('記憶互通'), '文字應提到記憶互通');
});

// ── Q5：人格版多少錢 ───────────────────────────────────────────────
test('Q5 人格版多少錢 → 選到 ch07，文字含依需求報價說明', () => {
  const { selected, text } = selectKnowledge(msg('人格版 AI 助理多少錢？'));
  assert.ok(selected.includes('07'), `expected ch07, got ${selected}`);
  assert.ok(text.includes('依需求報價') || text.includes('蝦皮'), '文字應含依需求報價或蝦皮說明');
});

// ── Q6：企業方案多少錢 ─────────────────────────────────────────────
test('Q6 企業方案多少錢 → 選到 ch11（企業方案）', () => {
  const { selected, text } = selectKnowledge(msg('請問企業方案多少錢？'));
  assert.ok(selected.includes('11'), `expected ch11, got ${selected}`);
  assert.ok(text.includes('依需求報價') || text.includes('contact'), '文字應含依需求報價說明');
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

// ── ch07 含共存版和雙 AI Agent 描述 ──────────────────────────────────
test('ch07 文字同時有共存版和雙 AI Agent 兩個方案', () => {
  const { selected, text } = selectKnowledge(msg('個人方案有哪些？'));
  assert.ok(selected.includes('07'), `expected ch07, got ${selected}`);
  assert.ok(text.includes('共存版'), '共存版說明應在 ch07');
  assert.ok(text.includes('雙 AI Agent'), '雙 AI Agent 說明應在 ch07');
});

// ── Q9：企業續約完整級每月多少 → 選到 ch11 ────────────────────────
test('Q9 企業續約完整級每月多少 → 選到 ch11', () => {
  const { selected, text } = selectKnowledge(msg('企業方案完整級續約每個月多少錢？'));
  assert.ok(selected.includes('11'), `expected ch11, got ${selected}`);
  assert.ok(text.includes('依需求報價') || text.includes('contact'), '文字應含依需求報價說明');
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

// ── Q13：你們跟大品牌的 AI Agent 差在哪？資安呢？→ isSecurity 時 ch08 優先（定調答案）
// ch08（大品牌=10）與 ch06（資安=10）同分；全序規則 isSecurity→ch08>ch06，ch08 先入 budget
test('Q13 你們跟大品牌的 AI Agent 差在哪？資安呢？ → isSecurity 時 ch08 優先（定調答案）', () => {
  const { selected, text } = selectKnowledge(msg('你們跟大品牌的 AI Agent 差在哪？資安呢？'));
  assert.ok(selected.includes('08'), `expected ch08 (market FAQ security anchor), got ${selected}`);
  assert.ok(text.includes('打包票'), '文字應含「打包票」（資安審查核心句）');
  assert.ok(text.includes('一道一道的審查'), '文字應含「一道一道的審查」（資安核心句）');
});

// ── Q14：多輪對話——先問個人方案，接著追問「差在哪？」→ 應選 ch07 ────
test('Q14 多輪：「個人方案有哪些？」→「差在哪？」第二問應選到 ch07', () => {
  const messages = [
    { role: 'user', content: '個人方案有哪些？' },
    { role: 'user', content: '差在哪？' },
  ];
  const { selected, text } = selectKnowledge(messages);
  assert.ok(selected.includes('07'), `expected ch07 from context carry-over, got ${selected}`);
  assert.ok(text.includes('共存版') || text.includes('雙 AI Agent'), '文字應含個人方案說明（ch07 內容）');
});

// ── Q15：企業版資安怎麼做 → 備援路徑 ch06 優先（資安觸發詞），含八層框架 ──
test('Q15 你們企業版資安怎麼做 → 備援路徑選到 ch06，含八層框架關鍵字', () => {
  const { selected, text } = selectKnowledge(msg('你們企業版資安怎麼做？'));
  assert.ok(selected.includes('06'), `expected ch06, got ${selected}`);
  // ch06 應在 ch11 之前（資安優先規則）
  const i06 = selected.indexOf('06'), i11 = selected.indexOf('11');
  if (i06 !== -1 && i11 !== -1) assert.ok(i06 < i11, `ch06 should precede ch11 in security queries`);
  // 八層框架關鍵字
  assert.ok(text.includes('八層') || text.includes('八道'), '文字應含八層資安框架關鍵字');
});

// ── Q16：主力路徑應讀取全本 KB（所有章節都在 context 中）────────────────
test('Q16 主力路徑 selectKnowledgePrimary → 全本 KB 在預算內，返回所有章節', () => {
  const r = selectKnowledgePrimary(msg('請問你們的服務是什麼？'));
  assert.strictEqual(r.tier, 'full', `expected tier=full, got ${r.tier}`);
  assert.ok(r.estimatedTokens <= KB_FULL_LIMIT, `full KB ${r.estimatedTokens} should be ≤ ${KB_FULL_LIMIT}`);
  // 所有章節都在 text 中（以 ch06 的八層框架為代表）
  assert.ok(r.text.includes('八層') || r.text.includes('八道'), '全本 KB 應含八層資安框架');
  assert.ok(r.text.includes('共存版') && r.text.includes('雙 AI Agent'), '全本 KB 應含個人方案說明');
});

// ── Q17：備援路徑行為不變——企業方案問題選到 ch11 ──────────────────────
test('Q17 備援路徑 selectKnowledge 行為不變：企業方案多少錢 → ch11', () => {
  const { selected, text } = selectKnowledge(msg('企業方案多少錢？'));
  assert.ok(selected.includes('11'), `fallback expected ch11, got ${selected}`);
  assert.ok(text.includes('依需求報價') || text.includes('contact'), '備援路徑文字應含依需求報價說明');
});

// ── Q18：三方 tie——企業資安費用多少 → ch06 置頂（ch06＋ch11＋ch07 各得 10 分）──
test('Q18 三方 tie：企業資安費用多少 → isSecurity 時 ch06 置頂', () => {
  // ch06（資安=10）、ch11（企業+費用=10）、ch07（費用+多少=10） 三方同分
  const { selected } = selectKnowledge(msg('企業資安費用多少？'));
  assert.ok(selected.includes('06'), `expected ch06 first, got ${selected}`);
  const i06 = selected.indexOf('06');
  const i11 = selected.indexOf('11');
  const i07 = selected.indexOf('07');
  if (i11 !== -1) assert.ok(i06 < i11, `ch06 should precede ch11 in three-way tie, got ${selected}`);
  if (i07 !== -1) assert.ok(i06 < i07, `ch06 should precede ch07 in three-way tie, got ${selected}`);
});

// ── 負向斷言：全本 KB 與 generated 檔不得含任何 NT$ 金額或三方案定價 ─────────
test('負向斷言 KB_PRICE_FREE：fullKBText 不含 NT$ 金額、33000/66000/99000 等企業定價', () => {
  const PRICE_RE = /NT\$\s*\d|33,?000|66,?000|99,?000|12,?000|15,?000|6,?000/;
  assert.ok(!PRICE_RE.test(fullKBText),
    'KB 全文不應含任何 NT$ 金額或企業三方案定價，違反 NEO 2026-10-01 鐵則');
});
