// TB 政策 2026-11-13：客戶資料不送中國公司模型。這組測試守住模型清單與「不再有外部模型 API」。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PRIMARY_MODEL, FALLBACK_MODEL, MODEL_CHAIN, MODEL_CONTEXT, CHINA_VENDOR, buildRequest, modelText, runModel } from './ai-models.js';
import { generateChatSummary } from './thinkbig.js';

test('模型清單：主力與備援都是 Workers AI（@cf/）、不同模型、都不是中國公司模型', () => {
  assert.notEqual(PRIMARY_MODEL, FALLBACK_MODEL);
  for (const m of MODEL_CHAIN) {
    assert.ok(m.startsWith('@cf/'), m);
    assert.ok(!CHINA_VENDOR.test(m), m);
    assert.ok(MODEL_CONTEXT[m] >= 24000, m);
  }
});

test('中國公司模型名稱特徵會被擋（Qwen、DeepSeek、MiniMax、GLM、Kimi）', () => {
  for (const m of ['@cf/qwen/qwen3-30b-a3b-fp8', '@cf/qwen/qwq-32b', '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b', 'MiniMax-M3', '@cf/zai-org/glm-5.3', '@cf/moonshotai/kimi-k2.6'])
    assert.ok(CHINA_VENDOR.test(m), m);
  for (const m of ['@cf/openai/gpt-oss-120b', '@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/mistralai/mistral-small-3.1-24b-instruct'])
    assert.ok(!CHINA_VENDOR.test(m), m);
});

test('runModel：中國公司模型直接拒絕，不呼叫 AI', async () => {
  let called = 0;
  await assert.rejects(runModel({ AI: { run: async () => { called++; return { response: 'x' }; } } }, '@cf/qwen/qwen3-30b-a3b-fp8', [], { max_tokens: 10, temperature: 0, timeoutMs: 1000 }), /blocked_model/);
  assert.equal(called, 0);
});

test('程式碼裡沒有任何外部模型 API（MiniMax 等）呼叫', () => {
  const dir = new URL('./', import.meta.url);
  for (const f of readdirSync(dir).filter(f => f.endsWith('.js') && !f.endsWith('.test.js'))) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    assert.ok(!/api\.minimax|minimaxi|MINIMAX_API_KEY/i.test(src), `${f} 仍有 MiniMax`);
    assert.ok(!/dashscope|api\.deepseek|moonshot\.cn|bigmodel\.cn|zhipu/i.test(src), `${f} 有中國模型 API 網址`);
  }
});

test('buildRequest：gpt-oss 加 reasoning low 與推理餘量；Llama 照原樣', () => {
  const g = buildRequest('@cf/openai/gpt-oss-120b', [], { max_tokens: 600, temperature: 0.2 });
  assert.deepEqual(g.reasoning, { effort: 'low' }); assert.equal(g.max_tokens, 1200);
  const l = buildRequest('@cf/meta/llama-3.3-70b-instruct-fp8-fast', [], { max_tokens: 500, temperature: 0.2 });
  assert.equal(l.reasoning, undefined); assert.equal(l.max_tokens, 500);
});

test('modelText：response 字串、OpenAI choices、Responses output 三種格式；不取推理內容', () => {
  assert.equal(modelText({ response: ' 你好 ' }), '你好');
  assert.equal(modelText({ choices: [{ message: { content: '您好', reasoning_content: '推理' } }] }), '您好');
  assert.equal(modelText({ output: [{ type: 'reasoning', content: [{ type: 'reasoning_text', text: '推理' }] }, { type: 'message', content: [{ type: 'output_text', text: '答案' }] }] }), '答案');
  assert.equal(modelText({ choices: [{ message: { content: null, reasoning_content: '推理' } }] }), '');
  assert.equal(modelText(null), '');
  assert.equal(modelText({ response: '<think>x</think>答' }), '答');
});

test('對話摘要：主力只回 choices 格式也能取 JSON；不打外部 API', async () => {
  const saved = globalThis.fetch; let fetched = 0;
  globalThis.fetch = async () => { fetched++; throw new Error('no external API'); };
  try {
    const calls = [];
    const env = { MINIMAX_API_KEY: 'leftover', AI: { run: async (model, body) => { calls.push({ model, body }); return { choices: [{ message: { content: '```json\n{"heat":"medium","kb_gap":""}\n```' } }] }; } } };
    const s = await generateChatSummary([{ role: 'user', content: '想了解企業方案' }], env);
    assert.deepEqual(s, { heat: 'medium', kb_gap: '' });
    assert.equal(calls.length, 1); assert.equal(calls[0].model, PRIMARY_MODEL); assert.equal(fetched, 0);
  } finally { globalThis.fetch = saved; }
});

test('對話摘要：主力失敗就換備援；兩個都失敗回 null', async () => {
  const models = [];
  const env = { AI: { run: async model => { models.push(model); if (model === PRIMARY_MODEL) throw new Error('boom'); return { response: '{"heat":"low"}' }; } } };
  assert.deepEqual(await generateChatSummary([{ role: 'user', content: 'x' }], env), { heat: 'low' });
  assert.deepEqual(models, [PRIMARY_MODEL, FALLBACK_MODEL]);
  assert.equal(await generateChatSummary([{ role: 'user', content: 'x' }], { AI: { run: async () => { throw new Error('down'); } } }), null);
});

test('ERP 助理：資料短走主力 Llama；資料超過 12,000 字先給 Mistral 讀全文，Llama 只拿截斷版', async () => {
  const { default: worker } = await import('./index.js');
  const call = async erpState => {
    const seen = [];
    const env = { AI: { run: async (model, body) => { seen.push({ model, len: body.messages[0].content.length }); return { response: '回答' }; } } };
    const req = new Request('https://x.invalid/erp-chat', { method: 'POST', headers: { 'content-type': 'application/json', Origin: 'https://thinkbigtw.com' }, body: JSON.stringify({ messages: [{ role: 'user', content: '誰加班最多？' }], erpState }) });
    const res = await worker.fetch(req, env, { waitUntil() {} });
    return { seen, body: await res.json() };
  };
  const small = await call({ a: 1 });
  assert.equal(small.seen[0].model, PRIMARY_MODEL); assert.equal(small.body.model, 'llama-3.3-70b');
  const big = await call({ rows: 'x'.repeat(20000) });
  assert.equal(big.seen[0].model, FALLBACK_MODEL); assert.ok(big.seen[0].len > 20000);
  assert.equal(big.body.model, 'mistral-small-3.1');
});
