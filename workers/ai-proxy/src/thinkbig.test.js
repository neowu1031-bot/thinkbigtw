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

import { selectKnowledge, selectKnowledgePrimary, fullKBText, KB_FULL_LIMIT, estimateTokens, SCOPE_RULE } from './thinkbig.js';

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
  assert.ok(text.includes('可以一起用'), '文字應含「可以一起用」（核心句，ch08 現行定稿）');
  assert.ok(text.includes('費用可控'), '文字應含「費用可控」（核心句）');
  // 不貶低任何品牌
  assert.ok(!text.includes('比較差') && !text.includes('不如') && !text.includes('劣'), '不應出現貶低品牌的詞彙');
});

// ── Q11：Grok Agent → 還需要龍蝦？→ 選到 ch08，核心句存在 ─────────
test('Q11 Grok 出了 agent 還需要龍蝦嗎？ → 選到 ch08，含核心句', () => {
  const { selected, text } = selectKnowledge(msg('Grok 出了 agent 那我還需要龍蝦嗎？'));
  assert.ok(selected.includes('08'), `expected ch08, got ${selected}`);
  assert.ok(text.includes('可以一起用'), '文字應含「可以一起用」（核心句，ch08 現行定稿）');
  assert.ok(text.includes('長時間運作'), '文字應含「長時間運作」（核心句）');
});

// ── Q12：新 AI Agent 那麼多怎麼選？→ 選到 ch08，核心句存在 ──────────
test('Q12 新的 AI Agent 那麼多要怎麼選？ → 選到 ch08，含核心句', () => {
  const { selected, text } = selectKnowledge(msg('新的 AI Agent 那麼多要怎麼選？'));
  assert.ok(selected.includes('08'), `expected ch08, got ${selected}`);
  assert.ok(text.includes('可以一起用'), '文字應含「可以一起用」（核心句，ch08 現行定稿）');
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
  assert.ok(['core', 'core+supplement'].includes(r.tier), `expected core tier, got ${r.tier}`);
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

// ── C2 回歸：企業關鍵字存在時本地大模型路由到 ch11，而非 ch07 ─────────────
test('Q19 公司想導入本地大模型多少錢 → 選到 ch11（企業方案）', () => {
  const { selected } = selectKnowledge(msg('公司想導入本地大模型多少錢？'));
  assert.ok(selected.includes('11'), `expected ch11, got ${selected}`);
});

test('Q20 本地版多少錢 → 選到 ch07（個人方案）', () => {
  const { selected } = selectKnowledge(msg('本地版多少錢？'));
  assert.ok(selected.includes('07'), `expected ch07, got ${selected}`);
});

test('Q21 一人公司想用人格版多少錢 → 選到 ch07（一人公司屬個人方案）', () => {
  const { selected } = selectKnowledge(msg('一人公司想用人格版多少錢？'));
  assert.ok(selected.includes('07'), `expected ch07, got ${selected}`);
});

// ── 負向斷言：全本 KB 與 generated 檔不得含任何 NT$ 金額或三方案定價 ─────────
test('負向斷言 KB_PRICE_FREE：fullKBText 不含 NT$ 金額、33000/66000/99000 等企業定價', () => {
  const PRICE_RE = /NT\$\s*\d|33,?000|66,?000|99,?000|12,?000|15,?000|6,?000/;
  assert.ok(!PRICE_RE.test(fullKBText),
    'KB 全文不應含任何 NT$ 金額或企業三方案定價，違反 NEO 2026-10-01 鐵則');
});

// ── 2026-10-31 補充章節（13 起）：官網導覽、方案交付物、本地大模型技術問答 ─────────
test('KB13 補充章節：每章加上 ch01＋ch10 都在備援預算 2850 內', () => {
  const sel = selectKnowledge(msg('Mac Studio 可以跑嗎？'));
  assert.ok(sel.estimatedTokens <= 2850, `got ${sel.estimatedTokens}`);
});
test('KB13 技術題：20 人公司要買什麼等級電腦 → ch17（硬體）', () => {
  const { selected, text } = selectKnowledge(msg('我們公司大概 20 個人，想裝本地大模型，要買什麼等級的電腦？'));
  assert.ok(selected.includes('17'), `expected ch17, got ${selected}`);
  assert.ok(/24GB/.test(text) && text.includes('30 分鐘免費評估'), '應含規格起點與評估 CTA');
});
test('KB13 技術題沒點名個人方案：本地大模型要什麼顯卡 → ch17 而非 ch07', () => {
  const { selected } = selectKnowledge(msg('本地大模型要什麼顯卡？'));
  assert.strictEqual(selected[2], '17', `expected ch17 first, got ${selected}`);
});
test('KB13 點名個人方案的技術題仍走 ch07：人格版需要什麼顯卡', () => {
  const { selected } = selectKnowledge(msg('人格版需要什麼顯卡？'));
  assert.ok(selected.includes('07'), `expected ch07, got ${selected}`);
});
test('KB13 Ollama／vLLM／Dify → ch18；資料外洩 → ch20；回答很慢 → ch21', () => {
  assert.ok(selectKnowledge(msg('Ollama、vLLM、Dify 差在哪？')).selected.includes('18'));
  assert.ok(selectKnowledge(msg('資料真的不會外洩嗎？')).selected.includes('20'));
  assert.ok(selectKnowledge(msg('回答很慢怎麼辦？')).selected.includes('21'));
});
test('KB13 官網題：作品集 → ch13；隱私追蹤 → ch14；企業交付物 → ch15；技能包 → ch16', () => {
  assert.ok(selectKnowledge(msg('作品集裡有什麼？')).selected.includes('13'));
  assert.ok(selectKnowledge(msg('你們官網有用什麼追蹤工具嗎？')).selected.includes('14'));
  assert.ok(selectKnowledge(msg('企業導入做完之後，我們實際會拿到哪些東西？')).selected.includes('15'));
  assert.ok(selectKnowledge(msg('技能包是什麼？')).selected.includes('16'));
});
test('KB13 TB FRAME 不可被「RAM」誤判成硬體章', () => {
  const { selected } = selectKnowledge(msg('TB FRAME 是什麼？'));
  assert.ok(selected.includes('04') && !selected.includes('17'), `got ${selected}`);
});
test('KB13 主力路徑：核心章節全載入，再加命中的補充章節，且不超過 KB_FULL_LIMIT', () => {
  const r = selectKnowledgePrimary(msg('Mac Studio 可以跑嗎？資料會外洩嗎？'));
  assert.ok(['01', '06', '11', '12'].every(id => r.selected.includes(id)), 'core chapters missing');
  assert.ok(r.selected.includes('17') && r.selected.includes('20'), `got ${r.selected}`);
  assert.ok(r.estimatedTokens <= KB_FULL_LIMIT);
  const plain = selectKnowledgePrimary(msg('你好'));
  assert.ok(plain.selected.every(id => Number(id) < 13), 'no supplement for small talk');
});
test('KB13 補充章節不含任何金額，交付時程只寫 30 天內', () => {
  assert.ok(!/NT\$\s*\d|\d+\s*萬元|32,?000|38,?000/.test(fullKBText), 'KB 不得含金額');
  assert.ok(!/(14|21)\s*天內交付/.test(fullKBText));
});

// ── 2026-10-31 對抗審修正：意圖與路由反例 ─────────
test('KB13 「顯示卡」與「顯卡」同義：本地大模型要什麼顯示卡 → ch17', () => {
  for (const q of ['本地大模型要什麼顯示卡？', '本地大模型要什麼顯卡？']) {
    const { selected } = selectKnowledge(msg(q));
    assert.strictEqual(selected[2], '17', `${q} → ${selected}`);
  }
});
test('KB13 企業意圖會延續：前一句說公司導入，下一句問維護 → 不走個人章', () => {
  const m = [{ role: 'user', content: '我們公司要導入本地大模型' }, { role: 'assistant', content: '好的' }, { role: 'user', content: '維護包含哪些？' }];
  const { selected } = selectKnowledge(m);
  assert.ok(selected.includes('15') && !selected.includes('07'), `got ${selected}`);
});
test('KB13 主力路徑個人意圖不加企業補充章', () => {
  const r = selectKnowledgePrimary(msg('我是個人，想裝 OpenClaw 人格版，壞了怎麼維護？'));
  assert.ok(!r.selected.includes('15') && !r.selected.includes('17'), `got ${r.selected}`);
  assert.ok(['core', 'core+supplement'].includes(r.tier) && Array.isArray(r.omitted));
});
test('KB13 寬泛字詞不誤判：MAC 位址、WordPress、內部問答', () => {
  assert.ok(!selectKnowledge(msg('MAC 位址會被保存嗎？')).selected.includes('17'));
  assert.ok(!selectKnowledge(msg('WordPress 官網可以接客服嗎？')).selected.includes('19'));
  assert.ok(!selectKnowledge(msg('可以幫我設定內部問答嗎？')).selected.includes('12'));
});
test('KB13 訓練與保存的同義問法 → ch19', () => {
  assert.ok(selectKnowledge(msg('我的資料會拿來訓練嗎？')).selected.includes('19'));
  assert.ok(selectKnowledge(msg('OpenAI API 會保存多久？')).selected.includes('19'));
});
test('KB13 硬體章對齊企業標準：16GB、AMD、Mac 不在地端標準範圍；不寫 Ollama 預設數字', () => {
  const ch17 = selectKnowledge(msg('Mac Studio 可以跑嗎？')).text;
  assert.ok(/16GB 顯示卡、AMD 顯示卡、Mac/.test(ch17), 'ch17 應寫明不在標準範圍');
  assert.ok(!/預設 4,?096|NUM_PARALLEL 預設/.test(fullKBText), '不寫未綁版本的 Ollama 預設值');
});
test('KB13 SCOPE_RULE 保留未知規格／合約例外的轉接出口', () => {
  assert.ok(/合約例外、法律個案不推測/.test(SCOPE_RULE) && /轉專人/.test(SCOPE_RULE));
});
