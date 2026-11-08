import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleLineWebhook } from './line-webhook.js';
import { handleLineGroupPush, GROUP_DISCLOSURE, deterministicUuid } from './line-group.js';

const SECRET = 'chan-secret', GKEY = 'group-key', GID = 'Cgroup_allowed_0001';
async function hmac(key, bytes) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC', k, bytes))));
}
function kvStub() { const m = new Map(); return { async get(k) { return m.get(k) ?? null; }, async put(k, v) { m.set(k, v); }, async delete(k) { m.delete(k); }, _m: m }; }
function mkEnv(over = {}) {
  return { LINE_CHANNEL_SECRET: SECRET, LINE_CHANNEL_ACCESS_TOKEN: 'tok', LINE_HASH_PEPPER: 'p', LINE_KV: kvStub(),
    INQUIRY_SUPABASE_URL: 'https://x.supabase.co', INQUIRY_SUPABASE_SERVICE_ROLE_KEY: 'svc',
    AI: { run() { throw new Error('AI must not be called'); } }, GROUP_PUSH_KEY: GKEY, ...over };
}
// fetch mock：記錄所有外呼
function mockFetch(opts = {}) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init, body: init.body ? JSON.parse(init.body) : null });
    const u = String(url);
    if (u.includes('/rpc/submit_thinkbig_inquiry')) return new Response('"accepted"', { status: 200 });
    if (u.includes('/members/count')) return new Response(JSON.stringify({ count: opts.members ?? 3 }), { status: 200 });
    if (u.includes('/member/')) return new Response(JSON.stringify({ displayName: '會計小姐' }), { status: 200 });
    if (u.includes('/message/push')) return new Response('{}', { status: opts.pushStatus ?? 200 });
    return new Response('{}', { status: 200 });
  };
  return calls;
}
async function post(env, events, ctx) {
  const bytes = new TextEncoder().encode(JSON.stringify({ events }));
  const req = new Request('https://w/line-webhook', { method: 'POST', headers: { 'X-Line-Signature': await hmac(SECRET, bytes) }, body: bytes });
  const tasks = [];
  const c = ctx || { waitUntil(p) { tasks.push(p); } };
  const r = await handleLineWebhook(req, env, c);
  await Promise.all(tasks);
  return r;
}
const ev = (o) => ({ webhookEventId: 'E' + Math.random().toString(36).slice(2), timestamp: Date.now(), replyToken: 'rt', mode: 'active', ...o });
const grpMsg = (gid, text, extra = {}) => ev({ type: 'message', source: { type: 'group', groupId: gid, userId: 'U1' }, message: { id: 'M' + Math.random(), type: 'text', text }, ...extra });
const rpc = calls => calls.filter(c => c.url.includes('submit_thinkbig_inquiry'));

test('allowlisted group message -> inquiry row with marker; no AI; disclosure via reply once', async () => {
  const calls = mockFetch(); const env = mkEnv({ LINE_GROUP_ALLOWLIST: GID });
  await post(env, [grpMsg(GID, '本月發票已收到')]);
  const rows = rpc(calls);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].body.p_scale, 'line-group-accountant');
  assert.match(rows[0].body.p_organization, /source=line-group-accountant/);
  assert.match(rows[0].body.p_need, /本月發票已收到/);
  assert.equal(rows[0].body.p_name, '會計小姐');
  assert.equal(rows[0].body.p_contact_method, 'line');
  const replies = calls.filter(c => c.url.endsWith('/message/reply'));
  assert.equal(replies.length, 1);
  assert.equal(replies[0].body.messages[0].text, GROUP_DISCLOSURE);
  await post(env, [grpMsg(GID, '第二則')]);
  assert.equal(calls.filter(c => c.url.endsWith('/message/reply')).length, 1, 'disclosure only once');
  assert.equal(rpc(calls).length, 2);
});

test('non-allowlisted group: ignored, no rows, no reply, no AI, no leave by default', async () => {
  const calls = mockFetch(); const env = mkEnv({ LINE_GROUP_ALLOWLIST: GID });
  await post(env, [grpMsg('Cother', 'hi')]);
  assert.equal(calls.length, 0);
});

test('empty allowlist: group messages ignored entirely', async () => {
  const calls = mockFetch(); await post(mkEnv(), [grpMsg(GID, 'hi')]);
  assert.equal(calls.length, 0);
});

test('non-allowlisted + LEAVE_UNKNOWN=1 + allowlist set -> leave called', async () => {
  const calls = mockFetch(); const env = mkEnv({ LINE_GROUP_ALLOWLIST: GID, LINE_GROUP_LEAVE_UNKNOWN: '1' });
  await post(env, [grpMsg('Cother', 'hi')]);
  assert.ok(calls.some(c => c.url.endsWith('/group/Cother/leave')));
});

test('join event: logs groupId row, silent when not allowlisted, never leaves with empty allowlist', async () => {
  const calls = mockFetch(); const env = mkEnv({ LINE_GROUP_LEAVE_UNKNOWN: '1' });
  await post(env, [ev({ type: 'join', source: { type: 'group', groupId: 'Cnew123' } })]);
  const rows = rpc(calls); assert.equal(rows.length, 1);
  assert.match(rows[0].body.p_need, /bot joined group Cnew123/);
  assert.equal(calls.filter(c => c.url.endsWith('/message/reply') || c.url.includes('/leave')).length, 0);
});

test('join event of allowlisted group sends disclosure', async () => {
  const calls = mockFetch(); const env = mkEnv({ LINE_GROUP_ALLOWLIST: GID });
  await post(env, [ev({ type: 'join', source: { type: 'group', groupId: GID } })]);
  assert.equal(calls.filter(c => c.url.endsWith('/message/reply'))[0].body.messages[0].text, GROUP_DISCLOSURE);
});

test('room source also never calls AI; one-to-one path untouched (user source still reaches GIFT/profile path)', async () => {
  const calls = mockFetch(); const env = mkEnv({ LINE_GROUP_ALLOWLIST: 'Rroom1' });
  await post(env, [ev({ type: 'message', source: { type: 'room', roomId: 'Rroom1', userId: 'U1' }, message: { id: 'm1', type: 'text', text: 'x' } })]);
  assert.equal(rpc(calls).length, 1);
});

test('non-text message stores placeholder only', async () => {
  const calls = mockFetch(); const env = mkEnv({ LINE_GROUP_ALLOWLIST: GID });
  await post(env, [ev({ type: 'message', source: { type: 'group', groupId: GID, userId: 'U1' }, message: { id: 'm2', type: 'image' } })]);
  assert.match(rpc(calls)[0].body.p_need, /圖片訊息，未轉存內容/);
});

test('inquiry write failure throws so LINE can retry (dedup stays processing)', async () => {
  const env = mkEnv({ LINE_GROUP_ALLOWLIST: GID }); mockFetch();
  const orig = globalThis.fetch;
  globalThis.fetch = async (u, i) => String(u).includes('/rpc/') ? new Response('boom', { status: 500 }) : orig(u, i);
  const e = grpMsg(GID, 'hi'); const errs = [];
  await post(env, [e], { waitUntil(p) { errs.push(p); } });
  // handleLineWebhook 以 work.catch(()=>{}) 吞掉背景錯誤；關鍵是事件未標 completed
  await Promise.all(errs);
  assert.notEqual(await env.LINE_KV.get('event:' + e.webhookEventId), 'completed');
});

test('deterministic uuid is stable and v4-shaped', async () => {
  const a = await deterministicUuid('x'), b = await deterministicUuid('x');
  assert.equal(a, b); assert.match(a, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

// ── 出站 ──
async function pushReq(env, payload, { key = GKEY, sig } = {}) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return handleLineGroupPush(new Request('https://w/line-group-push', { method: 'POST', headers: { 'X-Group-Push-Signature': sig ?? await hmac(key, bytes) }, body: bytes }), env);
}
const good = (o = {}) => ({ text: '請提供10月扣繳資料', ts: Date.now(), nonce: 'n' + Math.random().toString(36).slice(2, 14).padEnd(8, 'x'), ...o });

test('push: valid HMAC -> LINE push to allowlisted group only, disclosure prefixed first time, usage counted', async () => {
  const calls = mockFetch({ members: 3 }); const env = mkEnv({ LINE_GROUP_ALLOWLIST: GID });
  const r = await pushReq(env, good());
  assert.equal(r.status, 200); const j = await r.json();
  assert.equal(j.used, 3); assert.equal(j.disclosed, true);
  const p = calls.find(c => c.url.endsWith('/message/push'));
  assert.equal(p.body.to, GID);
  assert.ok(p.body.messages[0].text.startsWith(GROUP_DISCLOSURE));
  const r2 = await pushReq(env, good()); const j2 = await r2.json();
  assert.equal(j2.used, 6); assert.equal(j2.disclosed, false);
  const p2 = calls.filter(c => c.url.endsWith('/message/push'))[1];
  assert.ok(!p2.body.messages[0].text.includes(GROUP_DISCLOSURE));
});

test('push: bad signature 401, wrong key 401, no LINE call', async () => {
  const calls = mockFetch(); const env = mkEnv({ LINE_GROUP_ALLOWLIST: GID });
  assert.equal((await pushReq(env, good(), { sig: 'AAAA' })).status, 401);
  assert.equal((await pushReq(env, good(), { key: 'wrong' })).status, 401);
  assert.equal(calls.length, 0);
});

test('push: body cannot choose target; replay and stale ts rejected', async () => {
  const calls = mockFetch(); const env = mkEnv({ LINE_GROUP_ALLOWLIST: GID });
  await pushReq(env, good({ to: 'Cevil', groupId: 'Cevil', nonce: 'samenonce1' }));
  assert.equal(calls.find(c => c.url.endsWith('/message/push')).body.to, GID);
  assert.equal((await pushReq(env, good({ nonce: 'samenonce1' }))).status, 409);
  assert.equal((await pushReq(env, good({ ts: Date.now() - 3600e3 }))).status, 401);
});

test('push: monthly cap blocks and returns 429 without calling push', async () => {
  const calls = mockFetch({ members: 3 }); const env = mkEnv({ LINE_GROUP_ALLOWLIST: GID, GROUP_PUSH_MONTHLY_CAP: '5' });
  assert.equal((await pushReq(env, good())).status, 200);   // 3
  const r = await pushReq(env, good());                     // 3+3 > 5
  assert.equal(r.status, 429);
  assert.equal(calls.filter(c => c.url.endsWith('/message/push')).length, 1);
});

test('push: no secret / empty or multi allowlist -> 503; text too long 400', async () => {
  mockFetch();
  assert.equal((await pushReq(mkEnv({ GROUP_PUSH_KEY: undefined, LINE_GROUP_ALLOWLIST: GID }), good())).status, 503);
  assert.equal((await pushReq(mkEnv(), good())).status, 503);
  assert.equal((await pushReq(mkEnv({ LINE_GROUP_ALLOWLIST: 'A,B' }), good())).status, 503);
  assert.equal((await pushReq(mkEnv({ LINE_GROUP_ALLOWLIST: GID }), good({ text: 'x'.repeat(501) }))).status, 400);
});

test('push: LINE failure -> 502', async () => {
  mockFetch({ pushStatus: 500 });
  assert.equal((await pushReq(mkEnv({ LINE_GROUP_ALLOWLIST: GID }), good())).status, 502);
});

test('M6: per-group per-minute rate limit drops excess rows', async () => {
  const calls = mockFetch(); const env = mkEnv({ LINE_GROUP_ALLOWLIST: GID, LINE_GROUP_RATE_PER_MIN: '3' });
  const now = Date.now();
  for (let i = 0; i < 6; i++) await post(env, [grpMsg(GID, 'm' + i, { timestamp: now })]);
  assert.equal(rpc(calls).length, 3);
});
