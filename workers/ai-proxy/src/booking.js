// ============== /thinkbig-booking：30 分鐘免費評估預約 ==============
// NEO 2026-10-30：LINE 回「預約」→ 給不公開的官網行事曆頁（/book/），
// 客戶點日期與時段 → 填稱呼、LINE 名稱、Email → 送出。
// 紀錄與通知沿用官網詢問管線（thinkbig_inquiries → inquiry_relay.py → 收件匣＋會議室＋尼尼 Telegram）。
// 時段鎖存 LINE_KV（booking:slot:*），LINE 連結代碼存 booking:token:*（7 天），不存 IP。

const TPE_OFFSET_MS = 8 * 3600 * 1000;
export const BOOKING_DAYS_AHEAD = 14;
export const MIN_NOTICE_MS = 12 * 3600 * 1000;
// NEO 10/30：11/24 前只開台灣時間早上 9:00–12:00、晚上 21:00–24:00（每 30 分鐘一格）；11/25–11/28 不接受預約
const US_PERIOD_END = Date.parse('2026-11-25T00:00:00+08:00');
const BLOCKED_DATES = new Set(['2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28']);
const US_SLOTS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '21:00', '21:30', '22:00', '22:30', '23:00', '23:30'];
const TW_SLOTS = ['10:00', '11:00', '14:00', '15:00', '16:00', '19:30', '20:30'];
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

const slotStartMs = (date, time) => Date.parse(`${date}T${time}:00+08:00`);

export function slotsForDate(date) {
  return slotStartMs(date, '00:00') < US_PERIOD_END ? US_SLOTS : TW_SLOTS;
}

export function dateLabel(date) {
  const [, m, d] = date.split('-').map(Number);
  const wd = new Date(slotStartMs(date, '12:00')).getUTCDay();
  return `${m}/${d}（${WEEKDAYS[wd]}）`;
}

/** 可預約日期：明天起 14 天內的週一到週五，排除回台移動日。 */
export function bookableDates(nowMs = Date.now()) {
  const out = [];
  const today = new Date(nowMs + TPE_OFFSET_MS).toISOString().slice(0, 10);
  for (let i = 1; i <= BOOKING_DAYS_AHEAD; i++) {
    const date = new Date(slotStartMs(today, '12:00') + i * 86400000 + TPE_OFFSET_MS).toISOString().slice(0, 10);
    const wd = new Date(slotStartMs(date, '12:00')).getUTCDay();
    if (wd === 0 || wd === 6 || BLOCKED_DATES.has(date)) continue;
    out.push(date);
  }
  return out;
}

export function isBookableSlot(date, time, nowMs = Date.now()) {
  if (typeof date !== 'string' || typeof time !== 'string') return false;
  if (!bookableDates(nowMs).includes(date) || !slotsForDate(date).includes(time)) return false;
  return slotStartMs(date, time) - nowMs >= MIN_NOTICE_MS;
}

const slotKey = (date, time) => `booking:slot:${date}T${time}`;
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

/** LINE 端：產生連結代碼，對應雜湊後的 LINE 使用者（keyHash）與顯示名稱（7 天有效）；不存明文 userId。 */
export async function createBookingToken(kv, keyHash, displayName) {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  await kv.put('booking:token:' + token, JSON.stringify({ keyHash, name: displayName || '' }), { expirationTtl: 7 * 86400 });
  return token;
}

export async function bookingSlots(env, nowMs = Date.now()) {
  const kv = env.LINE_KV;
  const takenSet = new Set();
  if (kv?.list) {
    try { (await kv.list({ prefix: 'booking:slot:', limit: 1000 })).keys.forEach(k => takenSet.add(k.name)); } catch { /* 讀不到就全顯示可選，送出時仍會再檢查 */ }
  }
  const dates = [];
  for (const date of bookableDates(nowMs)) {
    const slots = [];
    for (const time of slotsForDate(date)) {
      if (slotStartMs(date, time) - nowMs < MIN_NOTICE_MS) continue;
      const taken = takenSet.has(slotKey(date, time));
      slots.push({ time, taken });
    }
    if (slots.length) dates.push({ date, label: dateLabel(date), slots });
  }
  return { dates, timezone: 'Asia/Taipei' };
}

const clean = (v, max) => (typeof v === 'string' && v.length <= max && !/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/.test(v) ? v.trim() : null);

export function validateBooking(body, nowMs = Date.now()) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_booking');
  const allowed = ['date', 'time', 'name', 'lineName', 'email', 'token', 'consent'];
  if (Object.keys(body).some(k => !allowed.includes(k)) || body.consent !== true) throw new Error('invalid_booking');
  if (!isBookableSlot(body.date, body.time, nowMs)) throw new Error('slot_unavailable');
  const name = clean(body.name, 40), lineName = clean(body.lineName ?? '', 60), email = clean(body.email, 254);
  if (!name || lineName === null || !email) throw new Error('invalid_booking');
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email)) throw new Error('invalid_email');
  const token = body.token == null || body.token === '' ? '' : body.token;
  if (token && !TOKEN_RE.test(token)) throw new Error('invalid_booking');
  return { date: body.date, time: body.time, name, lineName, email: email.toLowerCase(), token };
}

async function pushLineConfirm(env, userId, text) {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN || !userId) return;
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST', signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}` },
      body: JSON.stringify({ to: userId, messages: [{ type: 'text', text }] }),
    });
    await res.body?.cancel();
  } catch { /* 確認訊息失敗不影響預約 */ }
}

/**
 * 建立預約。writeInquiry(data) 由 thinkbig.js 注入（寫 thinkbig_inquiries，回 { ok, status, body }）。
 * 回傳 { status, body }。
 */
export const MAX_BOOKINGS_PER_IP_DAY = 3;
export const MAX_UNLINKED_PER_DAY = 10;
async function bump(kv, key, max, ttl) {
  const n = Number((await kv.get(key)) || 0);
  if (!Number.isSafeInteger(n) || n >= max) return false;
  await kv.put(key, String(n + 1), { expirationTtl: ttl });
  return true;
}
async function sha(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d), b => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

/** ipHash：呼叫端傳入雜湊後的連線 IP（不存原始 IP）。 */
export async function createBooking(body, env, writeInquiry, nowMs = Date.now(), ipHash = 'unknown') {
  let data;
  try { data = validateBooking(body, nowMs); } catch (e) { return { status: e.message === 'slot_unavailable' ? 409 : 400, body: { error: e.message } }; }
  const kv = env.LINE_KV;
  if (!kv) return { status: 503, body: { error: 'booking_unavailable' } };
  const key = slotKey(data.date, data.time);
  if ((await kv.get(key)) !== null) return { status: 409, body: { error: 'slot_taken' } };

  let line = null;
  if (data.token) {
    try { line = await kv.get('booking:token:' + data.token, 'json'); } catch { line = null; }
  }
  // 防灌滿（AEGIS M3）：同 Email 只能有 1 筆未來預約；每 IP 每天 3 筆；沒從 LINE 連過來的每天總共 10 筆
  const day = new Date(nowMs + TPE_OFFSET_MS).toISOString().slice(0, 10);
  const emailKey = 'booking:email:' + await sha(data.email);
  if ((await kv.get(emailKey)) !== null) return { status: 409, body: { error: 'already_booked' } };
  if (!(await bump(kv, `booking:ip:${ipHash}:${day}`, MAX_BOOKINGS_PER_IP_DAY, 172800))) return { status: 429, body: { error: 'daily_limit' } };
  if (!line && !(await bump(kv, `booking:unlinked:${day}`, MAX_UNLINKED_PER_DAY, 172800))) return { status: 429, body: { error: 'daily_limit' } };
  const lineShown = data.lineName || line?.name || '（未填）';
  const when = `${dateLabel(data.date)} ${data.time}（台灣時間）`;
  const need = [
    `【預約 30 分鐘免費評估】${when}`,
    `LINE 名稱：${lineShown}`,
    line ? `LINE 帳號：已從官方帳號連結過來（LINE 顯示名稱「${line.name || '未取得'}」，到 LINE 官方帳號聊天列表找這個人）` : 'LINE 帳號：未連結（不是從 LINE 點進來的）',
  ].join('\n');

  await kv.put(key, JSON.stringify({ at: nowMs }), { expirationTtl: 30 * 86400 });
  const result = await writeInquiry({
    id: crypto.randomUUID(), name: data.name, organization: '', need,
    scale: '預約評估', contactMethod: 'email', contact: data.email,
  });
  if (!result.ok) {
    await kv.delete(key);
    return { status: result.status, body: result.body };
  }
  const untilSlot = Math.max(60, Math.ceil((slotStartMs(data.date, data.time) - nowMs) / 1000) + 86400);
  await kv.put(emailKey, '1', { expirationTtl: untilSlot });
  if (data.token) await kv.delete('booking:token:' + data.token); // 代碼用過即失效（AEGIS L2）
  // 確認訊息：沿用 6D uidmap（keyHash → userId，7 天）推播，查不到就略過
  const pushTo = line?.keyHash ? await kv.get('uidmap:' + line.keyHash) : null;
  if (pushTo) {
    await pushLineConfirm(env, pushTo,
      `${data.name} 你好～已收到你的預約 🙌\n時間：${when}\n我們會在這裡傳會議連結給你。評估全程免費、不先收任何費用喔！`);
  }
  return { status: 200, body: { accepted: true, when } };
}
