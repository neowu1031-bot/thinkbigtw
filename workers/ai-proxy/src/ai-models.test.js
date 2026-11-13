// TB 政策 2026-11-13：客戶資料不送中國公司模型。這組測試守住模型清單與「不再有外部模型 API」。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { PRIMARY_MODEL, FALLBACK_MODEL, MODEL_CHAIN, MODEL_CONTEXT, CHINA_VENDOR, buildRequest, modelText, runModel, errorCode } from './ai-models.js';
import { generateChatSummary, maskSummaryPII } from './thinkbig.js';

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

test('/erp-chat 已停止提供：直接回 410，不呼叫任何模型（AEGIS C1）', async () => {
  const { default: worker } = await import('./index.js');
  let called = 0;
  const env = { AI: { run: async () => { called++; return { response: 'x' }; } } };
  const req = new Request('https://x.invalid/erp-chat', { method: 'POST', headers: { 'content-type': 'application/json', Origin: 'https://thinkbigtw.com' }, body: JSON.stringify({ messages: [{ role: 'user', content: '誰加班最多？' }], erpState: { rows: 'x'.repeat(50000) } }) });
  const res = await worker.fetch(req, env, { waitUntil() {} });
  assert.equal(res.status, 410);
  assert.equal((await res.json()).error, 'gone');
  assert.equal(called, 0);
});

// AEGIS C2：失敗要留紀錄，只記管道／模型／錯誤碼，不記內容。
function captureLogs(fn) {
  const saved = console.log; const lines = [];
  console.log = (...a) => lines.push(a.join(' '));
  return Promise.resolve().then(fn).finally(() => { console.log = saved; }).then(() => lines.map(l => { try { return JSON.parse(l); } catch { return { raw: l }; } }));
}
test('errorCode：抓 Workers AI 數字代碼；逾時／空白／其他各有固定代碼；不帶訊息全文', () => {
  assert.equal(errorCode(new Error('3036: Account limited: you have used up your daily free allocation of 10,000 neurons')), '3036');
  assert.equal(errorCode(new Error('timeout')), 'timeout');
  assert.equal(errorCode(new Error('empty')), 'empty');
  assert.equal(errorCode(new Error('客戶說了一段秘密內容')), 'error');
  assert.equal(errorCode(Object.assign(new Error('x'), { name: 'InferenceUpstreamError' })), 'InferenceUpstreamError');
});
test('runModel 失敗記 ai_error（不含對話與錯誤全文）；空白回覆也記', async () => {
  const secret = '王小明 0912-345-678';
  const logs = await captureLogs(async () => {
    await assert.rejects(runModel({ AI: { run: async () => { throw new Error(`3036: quota ${secret}`); } } }, PRIMARY_MODEL, [{ role: 'user', content: secret }], { max_tokens: 10, temperature: 0, timeoutMs: 1000, kind: 'line' }));
    assert.equal(await runModel({ AI: { run: async () => ({ response: '' }) } }, FALLBACK_MODEL, [], { max_tokens: 10, temperature: 0, timeoutMs: 1000, kind: 'summary' }), '');
  });
  const errs = logs.filter(l => l.type === 'ai_error');
  assert.deepEqual(errs.map(e => [e.kind, e.model, e.code]), [['line', PRIMARY_MODEL, '3036'], ['summary', FALLBACK_MODEL, 'empty']]);
  assert.ok(!JSON.stringify(logs).includes('王小明') && !JSON.stringify(logs).includes('0912'));
});
test('runModel 逾時：記 timeout，並對 binding 送出中止訊號', async () => {
  let signal;
  const logs = await captureLogs(async () => {
    await assert.rejects(runModel({ AI: { run: (m, b, opts) => { signal = opts?.signal; return new Promise(() => {}); } } }, PRIMARY_MODEL, [], { max_tokens: 10, temperature: 0, timeoutMs: 20, kind: 'chat' }), /timeout/);
  });
  assert.equal(signal?.aborted, true);
  assert.equal(logs.find(l => l.type === 'ai_error').code, 'timeout');
});
test('整條模型鏈都失敗：官網、摘要各記一行 ai_unavailable', async () => {
  const { handleThinkBig } = await import('./thinkbig.js');
  const env = { RATE_LIMITER: { limit: async () => ({ success: true }) }, AI: { run: async () => { throw new Error('3036: limit'); } } };
  const logs = await captureLogs(async () => {
    const r = await handleThinkBig(new Request('https://x.invalid/thinkbig-chat', { method: 'POST', headers: { Origin: 'https://thinkbigtw.com', 'content-type': 'application/json' }, body: JSON.stringify({ messages: [{ role: 'user', content: '你們有哪些方案？' }] }) }), env, { waitUntil() {} });
    assert.equal(r.status, 503);
    assert.equal(await generateChatSummary([{ role: 'user', content: 'x' }], env), null);
  });
  assert.deepEqual(logs.filter(l => l.type === 'ai_unavailable').map(l => l.kind), ['chat', 'summary']);
  assert.equal(logs.filter(l => l.type === 'ai_error').length, 4);
});

// AEGIS L4：摘要寫進 Supabase 前的程式遮罩
test('maskSummaryPII：email、電話、身分證、LINE ID、@帳號、自報姓名都遮；一般用語不誤傷', () => {
  const cases = [
    ['我叫王小明，LINE ID: abc_123，email a@b.co 電話 0912-345-678', '我叫[name]，LINE ID: [line]，email [email] 電話 [phone]'],
    ['陳先生想導入，聯絡 LINE：wang.xm 或 @wangxm88', '[name]先生想導入，聯絡 LINE：[line] 或 [line]'],
    ['身分證 A123456789 市話 02-2345-6789', '身分證 [id] 市話 [phone]'],
    ['敝姓林，想問企業方案', '敝姓[name]，想問企業方案'],
  ];
  for (const [input, want] of cases) assert.equal(maskSummaryPII(input), want, input);
  for (const keep of ['用 LINE 官方帳號 和 LINE OA', '我是個人用戶', '想用 LINE Messaging API', '30 人的貿易公司']) assert.equal(maskSummaryPII(keep), keep);
});
