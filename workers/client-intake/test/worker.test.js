import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../src/index.js';
import { normalizeCode } from '../src/code.js';
import { b64url, randomBytes, hashAccessCode, PBKDF2_ITER } from '../src/crypto.js';
import { findSecret, validateSubmission } from '../src/validate.js';
import { buildNotice } from '../src/notify.js';

const SECRET = 'x'.repeat(40);
const ADMIN = 'a'.repeat(40);
const ORIGIN = 'https://thinkbigtw.com';
const CODE = 'K7MP3XQ9';
// Fake credentials for detector tests, assembled at run time so no complete
// key-shaped string appears in the source (keeps secret scanners quiet).
const FAKE = {
  google: 'AI' + 'za' + 'Sy' + 'A1234567890' + 'abcdefghijklmnopqrstuv',
  anthropic: 'sk-' + 'ant-' + 'api03-' + 'abcdefghijklmnopqrstuvwxyz',
  github: 'gh' + 'p_' + 'abcdefghijklmnopqrstuvwxyz' + '0123456789',
  card: ['4111', '1111', '1111', '1111'].join(' '),
};
const demo = JSON.parse(readFileSync(new URL('./fixtures/demo-config.json', import.meta.url)));

function memKV({ dropWrites = false, corrupt = false } = {}) {
  const m = new Map();
  return {
    m,
    async get(k, opts) {
      if (!m.has(k)) return null;
      let v = m.get(k).v;
      if (corrupt && k.startsWith('sub:')) v = v.replace('"', "'");
      if (opts && opts.type === 'arrayBuffer') return typeof v === 'string' ? new TextEncoder().encode(v).buffer : v;
      return v;
    },
    async put(k, v, o = {}) {
      if (dropWrites && k.startsWith('sub:')) return;
      m.set(k, { v, ttl: o.expirationTtl });
    },
    async list({ prefix = '' } = {}) {
      return { keys: [...m.keys()].filter((k) => k.startsWith(prefix)).sort().map((name) => ({ name })), list_complete: true };
    },
  };
}

async function setup(opts = {}) {
  const kv = memKV(opts.kv);
  const slug = b64url(randomBytes(32));
  const salt = b64url(randomBytes(16));
  const hash = await hashAccessCode(CODE, salt, SECRET, PBKDF2_ITER);
  const video = new Uint8Array(1000).map((_, i) => i % 256);
  kv.m.set(`media:${slug}:clip.mp4`, { v: video.buffer });
  await kv.put(`cfg:${slug}`, JSON.stringify({
    v: 2, label: demo.label, status: 'open', maxSubmissions: demo.maxSubmissions, retentionDays: 180,
    expiresAt: opts.expiresAt || null,
    code: { salt, hash, iter: PBKDF2_ITER },
    media: { 'clip.mp4': { kvKey: `media:${slug}:clip.mp4`, type: 'video/mp4' } },
    content: demo.content,
  }));
  const sent = [];
  const env = {
    INTAKE_KV: kv,
    INTAKE_SECRET: SECRET,
    INTAKE_ADMIN_TOKEN: ADMIN,
    ASSETS: { fetch: async (req) => new Response(`asset:${new URL(req.url).pathname}`, { status: 200, headers: { 'Content-Type': 'text/html' } }) },
    ...(opts.env || {}),
  };
  return { kv, slug, env, sent };
}

function call(env, path, { method = 'GET', body, token, origin = ORIGIN, headers = {} } = {}) {
  const h = { ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  if (method === 'POST' && origin) h.Origin = origin;
  const pending = [];
  const req = new Request(ORIGIN + path, { method, headers: h, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) });
  return worker.fetch(req, env, { waitUntil(p) { pending.push(p); } }).then(async (res) => { await Promise.all(pending); return res; });
}

async function unlock(env, slug, code = CODE) {
  const r = await call(env, `/c/${slug}/api/unlock`, { method: 'POST', body: { code } });
  return { r, j: await r.json() };
}

const answers = { pick: { v: 'b', o: '補充說明' }, many: { v: ['x', 'y'] }, free: '一些文字', table: { price: '低消 3000', when: { v: 'am' } } };

test('unknown slug and odd paths are 404, page has noindex headers', async () => {
  const { env, slug } = await setup();
  assert.equal((await call(env, `/c/${'z'.repeat(43)}/`)).status, 404);
  assert.equal((await call(env, '/c/short/')).status, 404);
  assert.equal((await call(env, '/c/_a/shell.html')).status, 404);
  assert.equal((await call(env, '/c/_a/shell%2Ehtml')).status, 404);
  assert.equal((await call(env, '/c/_a/app.js')).status, 200);
  const r = await call(env, `/c/${slug}/`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('X-Robots-Tag'), /noindex/);
  assert.equal(r.headers.get('Cache-Control'), 'no-store');
  assert.match(r.headers.get('Content-Security-Policy'), /media-src 'self';/);
  assert.equal((await call(env, `/c/${slug}`)).status, 301);
});

test('fails closed without secret', async () => {
  const { env, slug } = await setup();
  assert.equal((await call({ ...env, INTAKE_SECRET: '' }, `/c/${slug}/`)).status, 503);
});

test('rate limit is checked before any KV read', async () => {
  const { env } = await setup();
  let kvReads = 0;
  const kv = { ...env.INTAKE_KV, get: async (...a) => { kvReads++; return env.INTAKE_KV.get(...a); } };
  const limited = { ...env, INTAKE_KV: kv, RATE_LIMITER: { limit: async () => ({ success: false }) } };
  const r = await call(limited, `/c/${'q'.repeat(43)}/`);
  assert.equal(r.status, 429);
  assert.equal(kvReads, 0);
});

test('expired or closed links answer 410', async () => {
  const { env, slug } = await setup({ expiresAt: '2020-01-01T00:00:00Z' });
  assert.equal((await call(env, `/c/${slug}/`)).status, 410);
  assert.equal((await call(env, `/c/${slug}/api/unlock`, { method: 'POST', body: { code: CODE } })).status, 410);
});

test('access code: 8 chars, no look-alikes, case/dash tolerant', async () => {
  assert.equal(normalizeCode('k7mp-3xq9'), CODE);
  assert.equal(normalizeCode('Ｋ７ＭＰ３ＸＱ９'), CODE);
  const { env, slug } = await setup();
  assert.equal((await unlock(env, slug, '123456')).r.status, 400);       // old 6-digit format
  assert.equal((await unlock(env, slug, 'K7MP3XQ0')).r.status, 400);     // 0 not in alphabet
  assert.equal((await unlock(env, slug, 'K7MP3XQ8')).r.status, 401);
  const ok = await unlock(env, slug, 'k7mp-3xq9');
  assert.equal(ok.r.status, 200);
  assert.match(ok.r.headers.get('Set-Cookie'), /ci_t=.*HttpOnly; Secure; SameSite=Strict/);
  assert.equal(JSON.stringify(ok.j).includes('hash'), false, 'code hash must not leak');
});

test('content is not served before the code is verified', async () => {
  const { env, slug } = await setup();
  assert.equal((await call(env, `/c/${slug}/api/content`)).status, 401);
  assert.equal((await call(env, `/c/${slug}/api/content`, { token: '9999999999.abcdefghijklmnopqrstuvwxyz' })).status, 401);
});

test('wrong code -> 401, lockout after 8 failures in an hour', async () => {
  const { env, slug } = await setup();
  for (let i = 0; i < 8; i++) assert.equal((await unlock(env, slug, 'AAAAAAAA')).r.status, 401);
  assert.equal((await unlock(env, slug)).r.status, 429);
});

test('cross-origin POST rejected', async () => {
  const { env, slug } = await setup();
  const r = await call(env, `/c/${slug}/api/unlock`, { method: 'POST', body: { code: CODE }, origin: 'https://evil.example' });
  assert.equal(r.status, 403);
});

test('full flow: submit returns a receipt id, each submission kept, limit, admin retrieval', async () => {
  const { env, slug, kv } = await setup();
  const { j } = await unlock(env, slug);
  const ids = [];
  for (let n = 1; n <= 3; n++) {
    const s = await call(env, `/c/${slug}/api/submit`, { method: 'POST', token: j.token, body: { answers } });
    assert.equal(s.status, 200);
    const sj = await s.json();
    assert.equal(sj.ok, true);
    assert.match(sj.id, /^\d{8}T\d{9}Z-[0-9a-f]{8}$/);
    ids.push(sj.id);
  }
  assert.equal(new Set(ids).size, 3);
  assert.equal((await call(env, `/c/${slug}/api/submit`, { method: 'POST', token: j.token, body: { answers } })).status, 409);
  assert.equal(kv.m.get(`sub:${slug}:${ids[0]}`).ttl, 180 * 86400);
  // no mail binding configured -> recorded for the daily check, submit still succeeded
  assert.ok(kv.m.has(`notify_failed:${slug}:${ids[0]}`));

  assert.equal((await call(env, `/c/_admin/${slug}`)).status, 404);
  assert.equal((await call(env, `/c/_admin/${slug}`, { token: 'b'.repeat(40) })).status, 404);
  assert.equal((await call(env, `/c/_admin/${slug}?id=abc`, { token: ADMIN })).status, 400);
  const aj = await (await call(env, `/c/_admin/${slug}`, { token: ADMIN })).json();
  assert.equal(aj.submission.id, ids.sort()[2]);
  assert.deepEqual(aj.submission.answers.pick, { v: 'b', o: '補充說明' });
  const md = await (await call(env, `/c/_admin/${slug}?format=md&id=${ids[0]}`, { token: ADMIN })).text();
  assert.match(md, /B；補充：補充說明/);
  assert.match(md, /價格：低消 3000/);
});

test('concurrent submits do not overwrite each other', async () => {
  const { env, slug, kv } = await setup();
  const { j } = await unlock(env, slug);
  const rs = await Promise.all([1, 2, 3].map((i) => call(env, `/c/${slug}/api/submit`, { method: 'POST', token: j.token, body: { answers: { ...answers, free: `版本 ${i}` } } })));
  assert.deepEqual(rs.map((r) => r.status), [200, 200, 200]);
  assert.equal([...kv.m.keys()].filter((k) => k.startsWith(`sub:${slug}:`)).length, 3);
});

test('write not confirmed -> 503, never a false "received"', async () => {
  for (const kvOpts of [{ dropWrites: true }, { corrupt: true }]) {
    const { env, slug } = await setup({ kv: kvOpts });
    const { j } = await unlock(env, slug);
    const s = await call(env, `/c/${slug}/api/submit`, { method: 'POST', token: j.token, body: { answers } });
    assert.equal(s.status, 503);
    assert.equal((await s.json()).error, 'store_failed');
  }
});

test('mail failure does not affect the submission and is recorded', async () => {
  const { env, slug, kv } = await setup({ env: { NOTIFY_EMAIL: { send: async () => { throw new Error('boom'); } } } });
  const { j } = await unlock(env, slug);
  const s = await call(env, `/c/${slug}/api/submit`, { method: 'POST', token: j.token, body: { answers } });
  assert.equal(s.status, 200);
  const { id } = await s.json();
  assert.match(kv.m.get(`notify_failed:${slug}:${id}`).v, /failed/);
});

test('media: needs a token, supports Range, private no-store', async () => {
  const { env, slug } = await setup();
  assert.equal((await call(env, `/c/${slug}/media/clip.mp4`)).status, 404);
  const { j, r } = await unlock(env, slug);
  const cookie = r.headers.get('Set-Cookie').split(';')[0];
  assert.equal((await call(env, `/c/${slug}/media/other.mp4`, { headers: { Cookie: cookie } })).status, 404);
  const full = await call(env, `/c/${slug}/media/clip.mp4`, { headers: { Cookie: cookie } });
  assert.equal(full.status, 200);
  assert.equal(full.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(full.headers.get('Accept-Ranges'), 'bytes');
  assert.equal((await full.arrayBuffer()).byteLength, 1000);
  const part = await call(env, `/c/${slug}/media/clip.mp4`, { token: j.token, headers: { Range: 'bytes=100-199' } });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('Content-Range'), 'bytes 100-199/1000');
  const body = new Uint8Array(await part.arrayBuffer());
  assert.equal(body.length, 100);
  assert.equal(body[0], 100);
  const tail = await call(env, `/c/${slug}/media/clip.mp4`, { token: j.token, headers: { Range: 'bytes=-10' } });
  assert.equal(tail.headers.get('Content-Range'), 'bytes 990-999/1000');
  assert.equal((await call(env, `/c/${slug}/media/clip.mp4`, { token: j.token, headers: { Range: 'bytes=5000-' } })).status, 416);
});

test('server validation: options, unknown keys, length, field pattern, secrets', async () => {
  const c = demo.content;
  assert.equal(validateSubmission(c, { answers: { pick: { v: 'zzz' } } }).ok, false);
  assert.equal(validateSubmission(c, { answers: { nope: 'x' } }).ok, false);
  assert.equal(validateSubmission(c, { answers: { free: 'x'.repeat(501) } }).ok, false);
  const sec = validateSubmission(c, { answers: { free: '金鑰 ' + FAKE.google } });
  assert.equal(sec.errors[0].reason, 'looks_like_secret');
  assert.equal(validateSubmission(c, { answers: { table: { price: '密碼：abcd1234' } } }).ok, false);
  assert.equal(validateSubmission(c, { answers: { table: { id: '123 456 789' } } }).ok, true);
  assert.equal(validateSubmission(c, { answers: { table: { id: '123456789 pass1234' } } }).errors[0].reason, 'pattern');
  const ok = validateSubmission(c, { answers: { pick: { v: 'a', o: 'ignored' } } });
  assert.equal(ok.ok, true);
  assert.equal(ok.answers.pick.o, undefined);
});

test('secret detector: hits and non-hits', () => {
  for (const hit of [FAKE.card, FAKE.anthropic, FAKE.github,
    '密碼 abc12345', '密碼abc12345', '密碼：abcd1234', 'pw: hunter22', 'ＰＡＳＳＷＯＲＤ：abcd1234', 'AnyDesk 123456789 密碼abc12345', 'password is hunter22']) {
    assert.notEqual(findSecret(hit), null, hit);
  }
  for (const miss of ['AnyDesk 123 456 789', '0912345678', '低消 3,000 元，最多 40 人，訂金三成', 'someone@example.com',
    '密碼我現場輸入', '遠端時我再輸入密碼就好', 'passport 很多', '週五晚上店裡最忙']) {
    assert.equal(findSecret(miss), null, miss);
  }
});

test('notification text has no answers and tells how to retrieve', () => {
  const { subject, text } = buildNotice({ PUBLIC_ORIGIN: ORIGIN }, { label: 'demo', maxSubmissions: 5 }, 'S'.repeat(43), { id: '20261112T050000910Z-ab12cd34', seq: 2, submittedAt: 't', answers: { free: 'SECRET-ANSWER' } });
  assert.match(subject, /第 2 次/);
  assert.equal(text.includes('SECRET-ANSWER'), false);
  assert.match(text, /20261112T050000910Z-ab12cd34/);
  assert.match(text, /答案已安全存好，由 GM 用後台指令取回，不用點任何連結。/);
  assert.match(text, /第 2 次送出/);
  assert.match(text, /時間：t/);
  assert.doesNotMatch(text, /https?:\/\/|_admin|wrangler|curl/);
  assert.equal(text.includes('S'.repeat(43)), false, 'slug must not be in the mail');
});

test('oversized body rejected', async () => {
  const { env, slug } = await setup();
  const { j } = await unlock(env, slug);
  const r = await call(env, `/c/${slug}/api/submit`, { method: 'POST', token: j.token, body: JSON.stringify({ answers: { free: 'x'.repeat(70000) } }) });
  assert.equal(r.status, 400);
});
