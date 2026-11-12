import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../src/index.js';
import { b64url, randomBytes, hashAccessCode, PBKDF2_ITER } from '../src/crypto.js';
import { findSecret, validateSubmission } from '../src/validate.js';
import { buildNotice } from '../src/notify.js';

const SECRET = 'x'.repeat(40);
const ADMIN = 'a'.repeat(40);
const ORIGIN = 'https://thinkbigtw.com';
const demo = JSON.parse(readFileSync(new URL('./fixtures/demo-config.json', import.meta.url)));

function memKV() {
  const m = new Map();
  return {
    m,
    async get(k) { return m.has(k) ? m.get(k).v : null; },
    async put(k, v, o = {}) { m.set(k, { v, ttl: o.expirationTtl }); },
  };
}

async function setup() {
  const kv = memKV();
  const slug = b64url(randomBytes(32));
  const salt = b64url(randomBytes(16));
  const code = '482913';
  const hash = await hashAccessCode(code, salt, SECRET, PBKDF2_ITER);
  await kv.put(`cfg:${slug}`, JSON.stringify({ v: 1, label: demo.label, status: 'open', maxSubmissions: demo.maxSubmissions, retentionDays: 180, code: { salt, hash, iter: PBKDF2_ITER }, content: demo.content }));
  const env = {
    INTAKE_KV: kv,
    INTAKE_SECRET: SECRET,
    INTAKE_ADMIN_TOKEN: ADMIN,
    ASSETS: { fetch: async (req) => new Response(`asset:${new URL(req.url).pathname}`, { status: 200, headers: { 'Content-Type': 'text/html' } }) },
  };
  return { kv, slug, code, env };
}

function call(env, path, { method = 'GET', body, token, origin = ORIGIN, headers = {} } = {}) {
  const h = { ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  if (method === 'POST' && origin) h.Origin = origin;
  return worker.fetch(new Request(ORIGIN + path, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) }), env, { waitUntil() {} });
}

test('unknown slug and odd paths are 404, page has noindex headers', async () => {
  const { env, slug } = await setup();
  assert.equal((await call(env, `/c/${'z'.repeat(43)}/`)).status, 404);
  assert.equal((await call(env, '/c/short/')).status, 404);
  assert.equal((await call(env, '/c/_a/shell.html')).status, 404);
  const r = await call(env, `/c/${slug}/`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('X-Robots-Tag'), /noindex/);
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
  assert.match(r.headers.get('Content-Security-Policy'), /script-src 'self'/);
  assert.equal((await call(env, `/c/${slug}`)).status, 301);
});

test('fails closed without secret', async () => {
  const { env, slug } = await setup();
  const r = await call({ ...env, INTAKE_SECRET: '' }, `/c/${slug}/`);
  assert.equal(r.status, 503);
});

test('content is not served before the code is verified', async () => {
  const { env, slug } = await setup();
  assert.equal((await call(env, `/c/${slug}/api/content`)).status, 401);
  assert.equal((await call(env, `/c/${slug}/api/content`, { token: '9999999999.abcdefghijklmnopqrstuvwxyz' })).status, 401);
});

test('wrong code -> 401, lockout after 8 failures in an hour', async () => {
  const { env, slug, code } = await setup();
  for (let i = 0; i < 8; i++) {
    const r = await call(env, `/c/${slug}/api/unlock`, { method: 'POST', body: { code: '000000' } });
    assert.equal(r.status, 401);
  }
  const locked = await call(env, `/c/${slug}/api/unlock`, { method: 'POST', body: { code } });
  assert.equal(locked.status, 429);
});

test('cross-origin POST rejected', async () => {
  const { env, slug, code } = await setup();
  const r = await call(env, `/c/${slug}/api/unlock`, { method: 'POST', body: { code }, origin: 'https://evil.example' });
  assert.equal(r.status, 403);
});

test('full flow: unlock, submit, history, max submissions, admin retrieval', async () => {
  const { env, slug, code, kv } = await setup();
  const u = await call(env, `/c/${slug}/api/unlock`, { method: 'POST', body: { code } });
  assert.equal(u.status, 200);
  const uj = await u.json();
  assert.ok(uj.token);
  assert.equal(uj.content.questions.length, 4);
  assert.equal(JSON.stringify(uj).includes('hash'), false, 'code hash must not leak');

  const answers = { pick: { v: 'b', o: '補充說明' }, many: { v: ['x', 'y'] }, free: '一些文字', table: { price: '低消 3000', when: { v: 'am' } } };
  for (let n = 1; n <= 3; n++) {
    const s = await call(env, `/c/${slug}/api/submit`, { method: 'POST', token: uj.token, body: { answers } });
    assert.equal(s.status, 200);
    assert.equal((await s.json()).n, n);
  }
  const over = await call(env, `/c/${slug}/api/submit`, { method: 'POST', token: uj.token, body: { answers } });
  assert.equal(over.status, 409);

  const meta = JSON.parse(await kv.get(`meta:${slug}`));
  assert.equal(meta.count, 3);
  assert.equal(meta.history.length, 3);
  assert.equal(kv.m.get(`sub:${slug}:1`).ttl, 180 * 86400);

  assert.equal((await call(env, `/c/_admin/${slug}`)).status, 404);
  assert.equal((await call(env, `/c/_admin/${slug}`, { token: 'b'.repeat(40) })).status, 404);
  const a = await call(env, `/c/_admin/${slug}`, { token: ADMIN });
  assert.equal(a.status, 200);
  const aj = await a.json();
  assert.equal(aj.submission.n, 3);
  assert.equal(aj.submission.answers.pick.o, '補充說明');
  const md = await (await call(env, `/c/_admin/${slug}?format=md&n=1`, { token: ADMIN })).text();
  assert.match(md, /B；補充：補充說明/);
  assert.match(md, /價格：低消 3000/);
});

test('server validation: unknown option, unknown question, too long, secrets', async () => {
  const c = demo.content;
  assert.equal(validateSubmission(c, { answers: { pick: { v: 'zzz' } } }).ok, false);
  assert.equal(validateSubmission(c, { answers: { nope: 'x' } }).ok, false);
  assert.equal(validateSubmission(c, { answers: { free: 'x'.repeat(501) } }).ok, false);
  const sec = validateSubmission(c, { answers: { free: '金鑰 AIzaSyA1234567890abcdefghijklmnopqrstuv' } });
  assert.equal(sec.ok, false);
  assert.equal(sec.errors[0].reason, 'looks_like_secret');
  assert.equal(validateSubmission(c, { answers: { table: { price: '密碼：abcd1234' } } }).ok, false);
  // "other" text dropped when the option does not allow it
  const ok = validateSubmission(c, { answers: { pick: { v: 'a', o: 'ignored' } } });
  assert.equal(ok.ok, true);
  assert.equal(ok.answers.pick.o, undefined);
});

test('secret detector: hits and non-hits', () => {
  assert.equal(findSecret('4111 1111 1111 1111'), 'card_number');
  assert.equal(findSecret('sk-ant-api03-abcdefghijklmnopqrstuvwxyz'), 'anthropic_key');
  assert.equal(findSecret('ghp_abcdefghijklmnopqrstuvwxyz0123456789'), 'github_token');
  assert.equal(findSecret('AnyDesk 123 456 789'), null);
  assert.equal(findSecret('0912345678'), null);
  assert.equal(findSecret('低消 3,000 元，最多 40 人，訂金三成'), null);
  assert.equal(findSecret('anko@calvary.com.tw'), null);
});

test('notification text has no answers and tells how to retrieve', () => {
  const { subject, text } = buildNotice({ PUBLIC_ORIGIN: ORIGIN }, { label: 'demo', maxSubmissions: 5 }, 'S'.repeat(43), { n: 2, submittedAt: 't', digest: 'd', answers: { free: 'SECRET-ANSWER' } });
  assert.match(subject, /第 2 次/);
  assert.equal(text.includes('SECRET-ANSWER'), false);
  assert.match(text, /c\/_admin\//);
  assert.match(text, /wrangler kv key get/);
});

test('oversized body rejected', async () => {
  const { env, slug, code } = await setup();
  const uj = await (await call(env, `/c/${slug}/api/unlock`, { method: 'POST', body: { code } })).json();
  const r = await call(env, `/c/${slug}/api/submit`, { method: 'POST', token: uj.token, body: JSON.stringify({ answers: { free: 'x'.repeat(70000) } }) });
  assert.equal(r.status, 400);
});
