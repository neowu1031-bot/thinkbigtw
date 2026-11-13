// tools/ai-usage.mjs：Workers AI 當日用量 70%／90% 判定（離線測試，不連網）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { buildQuery, summarize, exitCode, utcDate, FREE_DAILY_NEURONS } from '../tools/ai-usage.mjs';

const A = '4d3c709d4de5d593fcc69a89c39cbfd4';
const resp = groups => ({ data: { viewer: { accounts: [{ aiInferenceAdaptiveGroups: groups }] } }, errors: null });
const g = (date, modelId, totalNeurons) => ({ sum: { totalNeurons }, dimensions: { date, modelId } });

test('buildQuery：只接受 32 碼帳號與 YYYY-MM-DD；查的是單日', () => {
  const q = buildQuery(A, '2026-11-13');
  assert.deepEqual(q.variables, { a: A, d: '2026-11-13' });
  assert.match(q.query, /aiInferenceAdaptiveGroups/);
  assert.match(q.query, /totalNeurons/);
  assert.throws(() => buildQuery('x', '2026-11-13'), /bad_account_id/);
  assert.throws(() => buildQuery(A, '11/13'), /bad_date/);
});

test('summarize：加總各模型，70% 以上 warn、90% 以上 critical', () => {
  const ok = summarize(resp([g('2026-11-13', '@cf/meta/llama-3.3-70b-instruct-fp8-fast', 4000.4), g('2026-11-13', '@cf/mistralai/mistral-small-3.1-24b-instruct', 1000)]), { date: '2026-11-13' });
  assert.equal(ok.neurons, 5000); assert.equal(ok.pct, 50); assert.equal(ok.level, 'ok'); assert.equal(ok.limit, FREE_DAILY_NEURONS);
  assert.equal(summarize(resp([g('2026-11-13', 'm', 7000)]), { date: '2026-11-13' }).level, 'warn');
  assert.equal(summarize(resp([g('2026-11-13', 'm', 9000)]), { date: '2026-11-13' }).level, 'critical');
  assert.equal(summarize(resp([g('2026-11-12', 'm', 9999), g('2026-11-13', 'm', 10)]), { date: '2026-11-13' }).neurons, 10, '別天的不算');
  assert.equal(summarize(resp([]), { date: '2026-11-13' }).neurons, 0);
  assert.deepEqual([exitCode('ok'), exitCode('warn'), exitCode('critical')], [0, 1, 2]);
});

test('summarize：GraphQL 錯誤或格式不符就丟錯（不當成 0 用量）', () => {
  assert.throws(() => summarize({ errors: [{ message: 'auth' }] }), /graphql_error/);
  assert.throws(() => summarize({ data: { viewer: { accounts: [] } } }), /unexpected_shape/);
  assert.throws(() => summarize(resp([g('2026-11-13', 'm', 'NaN')])), /unexpected_shape/);
});

test('utcDate：以 UTC 日期算（免費額度 00:00 UTC 重置）', () => {
  assert.equal(utcDate(new Date('2026-11-13T23:30:00+08:00')), '2026-11-13');
  assert.equal(utcDate(new Date('2026-11-14T07:59:00+08:00')), '2026-11-13');
});

test('CLI 預設不連網，只印查詢', () => {
  const out = execFileSync(process.execPath, [new URL('../tools/ai-usage.mjs', import.meta.url).pathname, '--date', '2026-11-13'], { env: { PATH: process.env.PATH }, encoding: 'utf8' });
  const j = JSON.parse(out);
  assert.equal(j.dry_run, true); assert.equal(j.variables.d, '2026-11-13');
});
