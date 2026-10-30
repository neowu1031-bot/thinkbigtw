import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bookableDates, slotsForDate, isBookableSlot, validateBooking, createBooking, bookingSlots, createBookingToken, dateLabel } from './booking.js';

const NOW = Date.parse('2026-10-30T22:00:00+08:00'); // 週五晚上
function kvStub() {
  const m = new Map();
  return { _m: m,
    async get(k, t) { const v = m.get(k); if (v === undefined) return null; return t === 'json' ? JSON.parse(v) : v; },
    async put(k, v) { m.set(k, v); }, async delete(k) { m.delete(k); } };
}
const okWrite = rec => async d => { rec.push(d); return { ok: true, status: 200, body: { accepted: true } }; };

test('可預約日：明天起 14 天內平日，排除 11/25–11/28', () => {
  const d = bookableDates(NOW);
  assert.equal(d[0], '2026-11-02');
  assert.ok(!d.includes('2026-10-31') && !d.includes('2026-11-01'));
  assert.ok(d.every(x => x <= '2026-11-13'));
  const late = bookableDates(Date.parse('2026-11-23T10:00:00+08:00'));
  assert.ok(!late.includes('2026-11-25') && !late.includes('2026-11-26') && !late.includes('2026-11-27') && !late.includes('2026-11-28'));
  assert.ok(late.includes('2026-11-24') && late.includes('2026-11-30'));
});

test('時段：回台前美東可接時段，回台後白天時段', () => {
  assert.deepEqual(slotsForDate('2026-11-03'), ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30']);
  assert.ok(slotsForDate('2026-11-30').includes('14:00'));
  assert.equal(dateLabel('2026-11-02'), '11/2（一）');
});

test('不能預約過去、太近或不存在的時段', () => {
  assert.equal(isBookableSlot('2026-11-02', '09:00', NOW), true);
  assert.equal(isBookableSlot('2026-11-02', '14:00', NOW), false);
  assert.equal(isBookableSlot('2026-10-31', '09:00', NOW), false);
  assert.equal(isBookableSlot('2026-11-02', '09:00', Date.parse('2026-11-01T23:00:00+08:00')), false, '不到 12 小時');
});

test('表單驗證：稱呼與 Email 必填、欄位白名單、同意必勾', () => {
  const base = { date: '2026-11-02', time: '09:00', name: '王小姐', lineName: 'Amy', email: 'A@B.com', consent: true };
  assert.equal(validateBooking(base, NOW).email, 'a@b.com');
  assert.throws(() => validateBooking({ ...base, email: 'nope' }, NOW), /invalid_email/);
  assert.throws(() => validateBooking({ ...base, name: '' }, NOW));
  assert.throws(() => validateBooking({ ...base, consent: false }, NOW));
  assert.throws(() => validateBooking({ ...base, extra: 1 }, NOW));
  assert.throws(() => validateBooking({ ...base, token: 'bad token!' }, NOW));
});

test('預約成功：寫入詢問、鎖時段、LINE 連結者收到確認推播', async () => {
  const kv = kvStub(); const rec = []; const pushes = [];
  const token = await createBookingToken(kv, 'hash123', '阿美');
  await kv.put('uidmap:hash123', 'U-real');
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, o) => { pushes.push(JSON.parse(o.body)); return { body: { cancel: async () => {} } }; };
  const r = await createBooking({ date: '2026-11-02', time: '21:00', name: '王小姐', lineName: '', email: 'a@b.com', token, consent: true },
    { LINE_KV: kv, LINE_CHANNEL_ACCESS_TOKEN: 't' }, okWrite(rec), NOW);
  globalThis.fetch = orig;
  assert.equal(r.status, 200);
  assert.equal(rec.length, 1);
  assert.equal(rec[0].contactMethod, 'email');
  assert.ok(rec[0].need.includes('11/2（一） 21:00') && rec[0].need.includes('阿美'));
  assert.ok(!JSON.stringify(rec[0]).includes('U-real'), '詢問紀錄不含明文 userId');
  assert.equal(pushes.length, 1); assert.equal(pushes[0].to, 'U-real');
  const again = await createBooking({ date: '2026-11-02', time: '21:00', name: 'B', email: 'b@b.com', consent: true }, { LINE_KV: kv }, okWrite(rec), NOW);
  assert.equal(again.status, 409); assert.equal(again.body.error, 'slot_taken');
  const slots = await bookingSlots({ LINE_KV: kv }, NOW);
  assert.equal(slots.dates[0].slots.find(s => s.time === '21:00').taken, true);
});

test('寫入失敗就釋放時段', async () => {
  const kv = kvStub();
  const r = await createBooking({ date: '2026-11-02', time: '09:00', name: 'A', email: 'a@b.com', consent: true },
    { LINE_KV: kv }, async () => ({ ok: false, status: 503, body: { error: 'receipt_unconfirmed' } }), NOW);
  assert.equal(r.status, 503);
  assert.equal(kv._m.has('booking:slot:2026-11-02T09:00'), false);
});

test('slots 回應只有時間與是否已滿，不含任何預約者資料', async () => {
  const kv = kvStub();
  await createBooking({ date: '2026-11-02', time: '09:00', name: '王小姐', lineName: 'Amy', email: 'a@b.com', consent: true }, { LINE_KV: kv }, okWrite([]), NOW);
  const out = JSON.stringify(await bookingSlots({ LINE_KV: kv }, NOW));
  assert.ok(!/王小姐|Amy|a@b\.com/.test(out));
  assert.ok(out.includes('"taken":true'));
});
