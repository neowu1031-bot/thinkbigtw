// NEO 2026-11-13「不要超過額度」：Workers AI 每日 neurons 硬上限（ai-budget.js）測試。不連網。
import test from 'node:test';
import assert from 'node:assert/strict';
import { AiBudget, guardAI, withAiBudget, estimateNeurons, actualNeurons, crossedLevel, utcDay, DAILY_NEURON_CAP, _resetBudgetCacheForTest } from './ai-budget.js';

function fakeStorage(init) {
  const m = new Map(init ? [['day', init]] : []);
  return { get: async k => m.get(k), put: async (k, v) => { m.set(k, structuredClone(v)); }, _m: m };
}
// 假 DO namespace：所有名稱都導到同一個 AiBudget 實例，記錄 DO 請求數。
function fakeNamespace(initUsed = 0, date = utcDay()) {
  const storage = fakeStorage({ date, used: initUsed });
  const obj = new AiBudget({ storage });
  const ns = { requests: 0, storage, idFromName: n => n, get: () => ({ fetch: async (url, init) => { ns.requests++; return obj.fetch(new Request(url, init)); } }) };
  return ns;
}
function captureLogs() {
  const saved = console.log; const lines = [];
  console.log = (...a) => { try { lines.push(JSON.parse(a.join(' '))); } catch { lines.push({ raw: a.join(' ') }); } };
  return { lines, restore: () => { console.log = saved; } };
}
const LLAMA = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const small = { messages: [{ role: 'user', content: 'hi' }], max_tokens: 10, temperature: 0 };

test('上限是 5,000；70%／90% 門檻換算成 3,500／4,500', () => {
  assert.equal(DAILY_NEURON_CAP, 5000);
  assert.equal(crossedLevel(3499, 3500), 70);
  assert.equal(crossedLevel(4499, 4500), 90);
  assert.equal(crossedLevel(3400, 3499), null);
});

test('已用 5,000：第 5,001 個 neuron 起不呼叫模型，丟 ai_budget_exceeded 並記 ai_budget_block', async () => {
  _resetBudgetCacheForTest();
  const ns = fakeNamespace(DAILY_NEURON_CAP);
  let called = 0;
  const ai = guardAI({ AI: { run: async () => { called++; return { response: 'x' }; } }, AI_BUDGET: ns });
  const log = captureLogs();
  try { await assert.rejects(ai.run(LLAMA, small), /ai_budget_exceeded/); } finally { log.restore(); }
  assert.equal(called, 0);
  assert.equal(log.lines.find(l => l.type === 'ai_budget_block').reason, 'cap');
  assert.equal((await ns.storage.get('day')).used, DAILY_NEURON_CAP, '被擋的呼叫不加計數');
});

test('剛好用到 5,000 可以；超過 1 個 neuron 就擋（預扣是估計值，偏高估）', async () => {
  _resetBudgetCacheForTest();
  const est = estimateNeurons(LLAMA, small);
  let called = 0;
  const run = async () => { called++; return { response: 'x', usage: { neurons: est } }; };
  const okNs = fakeNamespace(DAILY_NEURON_CAP - est);
  await guardAI({ AI: { run }, AI_BUDGET: okNs }).run(LLAMA, small);
  assert.equal(called, 1);
  assert.equal((await okNs.storage.get('day')).used, DAILY_NEURON_CAP);
  _resetBudgetCacheForTest();
  const blockNs = fakeNamespace(DAILY_NEURON_CAP - est + 1);
  const log = captureLogs();
  try { await assert.rejects(guardAI({ AI: { run }, AI_BUDGET: blockNs }).run(LLAMA, small), /ai_budget_exceeded/); } finally { log.restore(); }
  assert.equal(called, 1);
});

test('同一 isolate 當天被擋過，就不再問 DO（灌請求不多花 DO 請求數）', async () => {
  _resetBudgetCacheForTest();
  const ns = fakeNamespace(DAILY_NEURON_CAP);
  const ai = guardAI({ AI: { run: async () => ({ response: 'x' }) }, AI_BUDGET: ns });
  const log = captureLogs();
  try {
    await assert.rejects(ai.run(LLAMA, small));
    await assert.rejects(ai.run(LLAMA, small));
    await assert.rejects(ai.run(LLAMA, small));
  } finally { log.restore(); }
  assert.equal(ns.requests, 1);
  _resetBudgetCacheForTest();
});

test('呼叫完成後用實際 neurons 校正（預扣偏高，校正後退回差額）', async () => {
  _resetBudgetCacheForTest();
  const ns = fakeNamespace(100);
  await guardAI({ AI: { run: async () => ({ response: 'x', usage: { neurons: 7.2 } }) }, AI_BUDGET: ns }).run(LLAMA, small);
  assert.equal((await ns.storage.get('day')).used, 108);
  assert.equal(ns.requests, 2);
});

test('跨過 70%／90% 各寫一行 ai_budget log', async () => {
  _resetBudgetCacheForTest();
  const ns = fakeNamespace(Math.floor(DAILY_NEURON_CAP * 0.7) - 1);
  const log = captureLogs();
  try {
    await guardAI({ AI: { run: async () => ({ response: 'x', usage: { neurons: 1 } }) }, AI_BUDGET: ns }).run(LLAMA, small);
    (await ns.storage.get('day')).used;
    ns.storage._m.set('day', { date: utcDay(), used: Math.floor(DAILY_NEURON_CAP * 0.9) - 1 });
    await guardAI({ AI: { run: async () => ({ response: 'x', usage: { neurons: 1 } }) }, AI_BUDGET: ns }).run(LLAMA, small);
  } finally { log.restore(); }
  assert.deepEqual(log.lines.filter(l => l.type === 'ai_budget').map(l => l.level), ['warn70', 'warn90']);
  assert.equal(crossedLevel(0, 100), null);
});

test('換 UTC 日就歸零', async () => {
  const storage = fakeStorage({ date: '2000-01-01', used: DAILY_NEURON_CAP });
  const r = await (await new AiBudget({ storage }).fetch(new Request('https://x/', { method: 'POST', body: JSON.stringify({ op: 'reserve', est: 50 }) }))).json();
  assert.equal(r.ok, true); assert.equal(r.used, 50); assert.equal(r.date, utcDay());
});

test('計數器出錯或沒綁 DO：一律不呼叫模型（fail-closed）', async () => {
  _resetBudgetCacheForTest();
  let called = 0;
  const run = async () => { called++; return { response: 'x' }; };
  const log = captureLogs();
  try {
    await assert.rejects(guardAI({ AI: { run } }).run(LLAMA, small), /ai_budget_unavailable/);
    const broken = { idFromName: n => n, get: () => ({ fetch: async () => { throw new Error('DO down'); } }) };
    await assert.rejects(guardAI({ AI: { run }, AI_BUDGET: broken }).run(LLAMA, small), /ai_budget_unavailable/);
  } finally { log.restore(); }
  assert.equal(called, 0);
});

test('模型呼叫失敗時保留預扣值（不確定是否計費，寧可多算）', async () => {
  _resetBudgetCacheForTest();
  const ns = fakeNamespace(0);
  await assert.rejects(guardAI({ AI: { run: async () => { throw new Error('3040: capacity'); } }, AI_BUDGET: ns }).run(LLAMA, small));
  assert.equal((await ns.storage.get('day')).used, estimateNeurons(LLAMA, small));
});

test('估算偏高：llama 整份知識庫一題實測 ~223 neurons，預扣不得低於實測', () => {
  const kb = '企'.repeat(9500);   // 實測主力路徑約 7.4k token、123 輸出 token
  const est = estimateNeurons(LLAMA, { messages: [{ role: 'system', content: kb }, { role: 'user', content: '你們有哪些方案？' }], max_tokens: 600 });
  assert.ok(est >= 223, `est ${est}`);
  assert.equal(actualNeurons(LLAMA, { usage: { prompt_tokens: 1000, completion_tokens: 100 } }, 999), Math.ceil(1000 * 0.026636 + 100 * 0.204818));
  assert.equal(actualNeurons(LLAMA, {}, 77), 77, '沒有 usage（串流）就沿用預扣值');
  assert.ok(estimateNeurons('@cf/meta/llama-3-8b-instruct', small) >= estimateNeurons(LLAMA, small), '未列費率的模型用保守值');
});

test('整支 Worker 都被包：官網 /thinkbig-chat 在額度用完時回既有 503（引導 LINE），不呼叫模型', async () => {
  _resetBudgetCacheForTest();
  const { default: worker } = await import('./index.js');
  let called = 0;
  const env = { RATE_LIMITER: { limit: async () => ({ success: true }) }, AI: { run: async () => { called++; return { response: 'x' }; } }, AI_BUDGET: fakeNamespace(DAILY_NEURON_CAP) };
  const log = captureLogs();
  let res;
  try {
    res = await worker.fetch(new Request('https://x.invalid/thinkbig-chat', { method: 'POST', headers: { Origin: 'https://thinkbigtw.com', 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: '你們有哪些方案？' }] }) }), env, { waitUntil() {} });
  } finally { log.restore(); }
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.error, 'ai_unavailable'); assert.match(body.fallback, /lin\.ee/);
  assert.equal(called, 0);
  assert.ok(log.lines.some(l => l.type === 'ai_error' && l.code === 'ai_budget_exceeded'));
  _resetBudgetCacheForTest();
});

test('withAiBudget：其他 binding 照常取得，只換掉 AI；股市端點用的 env.AI 也是同一個守門', async () => {
  _resetBudgetCacheForTest();
  let called = 0;
  const raw = { AI: { run: async () => { called++; return { response: 'x' }; } }, AI_BUDGET: fakeNamespace(DAILY_NEURON_CAP), LINE_KV: { tag: 'kv' } };
  const env = withAiBudget(raw);
  assert.equal(env.LINE_KV.tag, 'kv');
  assert.notEqual(env.AI, raw.AI);
  const ai = env.AI;   // index.js 第 898、992 行的寫法：const ai = env.AI
  const log = captureLogs();
  try { await assert.rejects(ai.run('@cf/meta/llama-3-8b-instruct', small), /ai_budget_exceeded/); } finally { log.restore(); }
  assert.equal(called, 0);
  _resetBudgetCacheForTest();
});
