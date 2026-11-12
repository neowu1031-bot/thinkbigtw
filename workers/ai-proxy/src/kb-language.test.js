// 11/9：英文訪客要用英文回答（Telegram 客服實測：問「Can you speak English?」被回只能講中文）。
// 只驗證規則有送到模型的兩條路徑；模型實答在部署後用 curl 抽測。
import test from 'node:test';
import assert from 'node:assert/strict';
import { selectKnowledge, selectKnowledgePrimary, SCOPE_RULE, filterReply } from './thinkbig.js';

const RULE = '訪客用英文提問就用英文答，其餘只用台灣繁體中文，嚴禁簡體字。';
const cases = [[{ role: 'user', content: 'Can you speak English?' }], [{ role: 'user', content: '你們有哪些方案？' }]];

test('KB 語言規則：英文跟著訪客、其餘繁中，兩條路徑都帶到', () => {
  for (const msgs of cases) {
    assert.ok(selectKnowledge(msgs).text.includes(RULE), 'fallback / LINE path');
    assert.ok(selectKnowledgePrimary(msgs).text.includes(RULE), 'website primary path');
  }
});

test('KB 語言規則：不再有「只用台灣繁體中文」的無條件版本', () => {
  const text = selectKnowledgePrimary(cases[0]).text + SCOPE_RULE;
  assert.equal(text.split('只用台灣繁體中文').length - 1, 1);
  assert.ok(!/(?<!其餘)只用台灣繁體中文/.test(text));
});

test('KB 身分：官網名稱不變', () => {
  assert.ok(selectKnowledgePrimary(cases[1]).text.includes('你是「Think BIG AI 顧問」'));
});

// AEGIS D4 C1（11/9）：英文回覆也不能假裝已送出／已預約／已收件。
const EN_GUARD = /^I can't send, book or receive anything here\. If you'd like a consultant to contact you, tap 「整理諮詢摘要」/;
test('filterReply 英文假送出／假預約：攔下並回英文固定句', () => {
  const claims = [
    "Great, I've submitted your request to our team.",
    'I have forwarded your inquiry to a consultant.',
    'We have received your details and will be in touch.',
    'Your consultation has been booked for Monday.',
    'Your appointment is confirmed.',
    "You're all booked for a 30-minute assessment!",
    'A consultant will contact you within one working day.',
    "Our team will reach out to you shortly.",
    'I\u2019ve sent your information to Think BIG.',
  ];
  for (const r of claims) assert.match(filterReply(r), EN_GUARD, r);
  assert.match(filterReply("I've booked your demo.", 'experience'), /^I can only help you draft here\./);
  assert.match(filterReply('Your booking is confirmed.', 'retail'), /^This demo doesn't send or book anything/);
});

test('filterReply 英文正常說明：不誤攔', () => {
  const ok = [
    'Once you submit the inquiry summary, a consultant will contact you within one working day.',
    'If you fill in the self-assessment, our team will email you within one working day.',
    "I can't submit or book anything for you. You can book a free 30-minute assessment at https://thinkbigtw.com/enterprise/start/",
    "I haven't sent anything. Tap the inquiry summary button when you are ready.",
    'Think BIG helps companies set up AI agents that answer from their own documents.',
    'You can send us your question on LINE: https://lin.ee/n5KW430',
  ];
  for (const r of ok) assert.equal(filterReply(r), r, r);
});

test('filterReply 中文行為不變', () => {
  assert.equal(filterReply('好的，已幫您送出諮詢！'), '如需顧問聯繫，請點「整理諮詢摘要」，核對需求及聯絡方式後再確認送出。是否收件以介面顯示的送出結果為準。');
  assert.equal(filterReply('顧問會主動聯繫您喔'), '如需顧問聯繫，請點「整理諮詢摘要」，核對需求及聯絡方式後再確認送出。是否收件以介面顯示的送出結果為準。');
  assert.equal(filterReply('已幫你預約好了', 'retail'), '這個體驗不會替你送出或預約任何事情。若想討論正式導入，請按頁面下方「討論我的門市需求」。');
  assert.equal(filterReply('填完摘要後，1 個工作日內由真人聯繫。'), '填完摘要後，1 個工作日內由真人聯繫。');
});

// 11/9 r3：英文在 Workers AI 模型下也穩定（11/13 起主力改 gpt-oss-120b，MiniMax 移除）。
import { handleThinkBig, wantsEnglish, replyNotEnglish, LANGUAGE_RULE_EN } from './thinkbig.js';
const ask = (content, env) => handleThinkBig(new Request('https://x.invalid/thinkbig-chat', {
  method: 'POST', headers: { Origin: 'https://thinkbigtw.com', 'content-type': 'application/json' },
  body: JSON.stringify({ messages: [{ role: 'user', content }] }),
}), { RATE_LIMITER: { limit: async () => ({ success: true }) }, ...env }, { waitUntil() {} });
const ACTUAL_FAIL = "Yes, I can speak English. However, since you're visiting the Think BIG website, which is primarily in Traditional Chinese, I'll respond in Traditional Chinese.";

test('wantsEnglish：沒有中文字且有英文字才算英文提問', () => {
  for (const q of ['Can you speak English?', 'What services does Think BIG offer?', 'price?']) assert.equal(wantsEnglish(q), true, q);
  for (const q of ['你們有哪些方案？', 'Think BIG 有哪些方案', 'GPU 要多大', '123?', 'ok', '😊']) assert.equal(wantsEnglish(q), false, q);
});

test('replyNotEnglish：抓中文回覆與「我會用中文回答」，正常英文與英文固定句不算', () => {
  assert.equal(replyNotEnglish(ACTUAL_FAIL), true);
  assert.equal(replyNotEnglish('您好，我們提供企業 AI Agent 導入。'), true);
  assert.equal(replyNotEnglish('I will reply in Chinese from now on.'), true);
  assert.equal(replyNotEnglish('Yes, I can. How can I help you with Think BIG’s AI Agent solutions?'), false);
  assert.equal(replyNotEnglish(filterReply('I have forwarded your inquiry to a consultant.')), false);
  assert.equal(replyNotEnglish('We serve clients in Taiwan and offer Traditional Chinese and English support.'), false);
});

test('備援：英文提問系統提示最後一段是英文語言指示；回中文就重試一次並在訊息最前加指示', async () => {
  const calls = [];
  const AI = { run: async (model, body) => { calls.push({ model, body }); return { response: calls.length === 1 ? ACTUAL_FAIL : 'Yes, I can speak English. How can I help?' }; } };
  const r = await ask('Can you speak English?', { AI });
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.equal(d.reply, 'Yes, I can speak English. How can I help?');
  assert.equal(calls.length, 2);
  assert.equal(calls[0].model, calls[1].model);
  assert.ok(calls[0].body.messages[0].content.endsWith(LANGUAGE_RULE_EN));
  assert.equal(calls[1].body.messages.at(-1).content, '(Please answer in English.) Can you speak English?');
});

test('備援：重試仍不是英文就保留第一次回覆；中文提問不加指示、不重試', async () => {
  let n = 0;
  const r = await ask('What services does Think BIG offer?', { AI: { run: async () => { n++; return { response: n === 1 ? '我們提供企業 AI Agent 導入。' : '仍然是中文。' }; } } });
  assert.equal((await r.json()).reply, '我們提供企業 AI Agent 導入。');
  assert.equal(n, 2);
  const calls = [];
  const z = await ask('你們有哪些方案？', { AI: { run: async (model, body) => { calls.push(body); return { response: '我們有企業方案與個人方案。' }; } } });
  assert.equal(z.status, 200);
  assert.equal(calls.length, 1);
  assert.ok(!calls[0].messages[0].content.includes('[Language]'));
});

// TB 政策 2026-11-13：客戶資料不送中國公司模型。主力 Llama 3.3 70B、備援 Mistral Small 3.1，都在 Workers AI；不再有任何外部模型 API 呼叫。
import { PRIMARY_MODEL, FALLBACK_MODEL } from './ai-models.js';
const OPENAI_SHAPE = content => ({ choices: [{ message: { role: 'assistant', content, reasoning_content: 'internal reasoning must not leak' }, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5, neurons: 1 } });
test('主力 Llama：英文指示在系統提示最後；只有 choices 格式也讀得到；有內容就不走備援；不打任何外部 API（即使還留著 MINIMAX_API_KEY）', async () => {
  const saved = globalThis.fetch; let fetched = 0;
  globalThis.fetch = async () => { fetched++; throw new Error('no external model API allowed'); };
  try {
    const calls = [];
    const r = await ask('Can you speak English?', { MINIMAX_API_KEY: 'leftover-secret', AI: { run: async (model, body) => { calls.push({ model, body }); return OPENAI_SHAPE('Yes, I can.'); } } });
    const d = await r.json();
    assert.equal(d.model, PRIMARY_MODEL); assert.equal(d.reply, 'Yes, I can.');
    assert.equal(calls.length, 1); assert.equal(fetched, 0);
    assert.equal(calls[0].body.reasoning, undefined); assert.equal(calls[0].body.max_tokens, 600);
    assert.ok(calls[0].body.messages[0].content.endsWith(LANGUAGE_RULE_EN));
  } finally { globalThis.fetch = saved; }
});

test('主力 Llama 讀整份核心知識庫（同以前 MiniMax）、備援 Mistral 讀精簡版', async () => {
  const calls = [];
  await ask('你們有哪些方案？', { AI: { run: async (model, body) => { calls.push({ model, len: body.messages[0].content.length }); return model === PRIMARY_MODEL ? OPENAI_SHAPE('') : { response: '我們有企業方案。' }; } } });
  assert.deepEqual(calls.map(c => c.model), [PRIMARY_MODEL, FALLBACK_MODEL]);
  assert.ok(calls[0].len > calls[1].len, `primary ${calls[0].len} vs fallback ${calls[1].len}`);
});

test('主力內容空仍掉備援，不回空字串；推理內容不外洩', async () => {
  const r = await ask('你們有哪些方案？', { AI: { run: async model => model === PRIMARY_MODEL ? { choices: [{ message: { content: '', reasoning_content: '秘密推理' }, finish_reason: 'length' }] } : { response: '我們有企業方案。' } } });
  const d = await r.json();
  assert.equal(d.reply, '我們有企業方案。'); assert.equal(d.model, FALLBACK_MODEL);
  assert.ok(!JSON.stringify(d).includes('秘密推理'));
});

// AEGIS r3 C1：主力卡住（12 秒逾時）＋備援卡住，整題總時間不超過 22 秒（bot 等 25 秒）。
import { mock } from 'node:test';
import { TOTAL_BUDGET_MS } from './thinkbig.js';
test('總時間上限：主力 Llama 卡住 12 秒＋備援 Mistral 卡住，22 秒內回 503，剩不到 2 秒不再試', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  const runs = [];
  try {
    const AI = { run: (model) => { runs.push({ model, at: Date.now() }); return new Promise(() => {}); } };
    let done = null;
    const p = ask('Can you speak English?', { AI }).then(r => { done = { status: r.status, at: Date.now() }; });
    for (let i = 0; i < 3000 && !done; i++) { mock.timers.tick(10); for (let k = 0; k < 10; k++) await new Promise(r => setImmediate(r)); }
    await p;
    assert.equal(done.status, 503);
    assert.ok(done.at <= TOTAL_BUDGET_MS + 50, `total ${done.at} ms`); // +50：假時鐘每格 10 ms，回應串流要多一格才讀完
    assert.equal(runs[0].model, PRIMARY_MODEL); assert.ok(runs[0].at <= 50, `primary start ${runs[0].at}`);
    assert.equal(runs[1].model, FALLBACK_MODEL);
    assert.ok(runs[1].at - runs[0].at >= 12000 && runs[1].at - runs[0].at <= 12050, `fallback start ${runs[1].at}`);
    assert.equal(runs.length, 2, '備援用掉 10 秒後只剩不到 2 秒，不再試');
  } finally { mock.timers.reset(); }
});
test('總時間上限：主力逾時後備援 6 秒回中文、英文重試卡住 → 重試只給剩餘時間，22 秒內回第一次回覆', async () => {
  mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 0 });
  let n = 0;
  try {
    const AI = { run: () => { n++; if (n === 2) return new Promise(r => setTimeout(() => r({ response: '我們提供企業 AI Agent 導入。' }), 6000)); return new Promise(() => {}); } };
    let done = null;
    const p = ask('What services does Think BIG offer?', { AI }).then(async r => { done = { body: await r.json(), at: Date.now() }; });
    for (let i = 0; i < 3000 && !done; i++) { mock.timers.tick(10); for (let k = 0; k < 10; k++) await new Promise(r => setImmediate(r)); }
    await p;
    assert.equal(done.body.reply, '我們提供企業 AI Agent 導入。');
    assert.equal(n, 3);
    assert.ok(done.at <= TOTAL_BUDGET_MS + 50, `total ${done.at} ms`); // +50：假時鐘每格 10 ms，回應串流要多一格才讀完
  } finally { mock.timers.reset(); }
});
