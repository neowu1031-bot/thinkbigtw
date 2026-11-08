/**
 * line-group.js — Think BIG LINE OA 群組模式（會計群組協調用）
 *
 * 規則：
 *   - 群組/room 事件絕不呼叫 AI 顧問、絕不走一對一的自動回覆。
 *   - 只有 env.LINE_GROUP_ALLOWLIST（逗號分隔 groupId，Worker secret/var，之後再設）內的群組：
 *     每則訊息（時間＋暱稱＋文字）寫入既有詢問管線（Supabase RPC submit_thinkbig_inquiry，
 *     scale/organization 標記 source=line-group-accountant），由 inquiry_relay.py 送到 GM。
 *   - 加入群組（join）：寫一列「bot joined group <id>」讓 GM 讀取 groupId（不需 NEO 抄 id）。
 *   - 非白名單群組：訊息忽略；LINE_GROUP_LEAVE_UNKNOWN==='1' 且白名單非空時才退群。
 *   - 揭露：白名單群組的第一則回覆（收到第一則訊息時以 reply 免費送出；或 GM 第一次 push 時附在前面）
 *     說明這是 Think BIG 的 AI 助理。
 *   - 出站：POST /line-group-push，HMAC-SHA256（secret GROUP_PUSH_KEY，header X-Group-Push-Signature），
 *     body {text, ts, nonce}；目標群組只取自 env，不接受 body 指定。月用量計數＋上限。
 */
import { writeInquiry } from './thinkbig.js';

const LINE_API = 'https://api.line.me/v2/bot';
export const GROUP_SOURCE = 'line-group-accountant';
export const GROUP_DISCLOSURE =
  '大家好，我是 Think BIG 的 AI 助理，代表公司處理行政與帳務的聯繫協調。這個群組裡的訊息會轉給公司的 AI 總經理處理；如需真人，請直接告知，我們會安排專人回覆。請勿在群組傳送身分證或銀行帳號全碼。';
export const DEFAULT_MONTHLY_CAP = 60;   // 以「則數單位」計，可由 GROUP_PUSH_MONTHLY_CAP 覆寫
export const MAX_PUSH_TEXT = 500;
const SIG_WINDOW_MS = 5 * 60 * 1000;

export function parseAllowlist(env) {
  return new Set(String(env.LINE_GROUP_ALLOWLIST || '').split(',').map(s => s.trim()).filter(Boolean));
}
export function sourceId(source) { return source?.groupId || source?.roomId || ''; }
export function isAllowed(env, source) {
  const id = sourceId(source);
  return !!id && parseAllowlist(env).has(id);
}
const hex = buf => Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
async function sha256Hex(str) { return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str))); }

/** 由字串決定性產生 UUIDv4 格式 id → 重送同一事件時 RPC 回 duplicate，不重複入列。 */
export async function deterministicUuid(seed) {
  const h = (await sha256Hex('line-group:' + seed)).slice(0, 32).split('');
  h[12] = '4'; h[16] = ['8', '9', 'a', 'b'][parseInt(h[16], 16) % 4];
  const s = h.join('');
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
}
function clean(text, max) {
  return String(text ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').trim().slice(0, max);
}
export function taipeiStamp(ms) {
  const d = new Date(ms + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

async function lineFetch(token, path, init = {}) {
  return fetch(LINE_API + path, {
    ...init, signal: AbortSignal.timeout(8000),
    headers: { Authorization: `Bearer ${token}`, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
  });
}
export async function getMemberName(token, source, userId) {
  if (!userId) return '';
  const path = source.type === 'group'
    ? `/group/${source.groupId}/member/${userId}` : `/room/${source.roomId}/member/${userId}`;
  try {
    const res = await lineFetch(token, path);
    if (!res.ok) { await res.body?.cancel(); return ''; }
    const j = await res.json();
    return clean(j.displayName, 60);
  } catch { return ''; }
}
async function replyText(token, replyToken, text) {
  try {
    const res = await lineFetch(token, '/message/reply', { method: 'POST', body: JSON.stringify({ replyToken, messages: [{ type: 'text', text }] }) });
    const ok = res.ok; await res.body?.cancel(); return ok;
  } catch { return false; }
}
async function leaveSource(token, source) {
  const path = source.type === 'group' ? `/group/${source.groupId}/leave` : `/room/${source.roomId}/leave`;
  try { const res = await lineFetch(token, path, { method: 'POST' }); await res.body?.cancel(); } catch { /* ignore */ }
}

/** 寫入既有詢問管線（不新增資料表）。 */
export async function writeGroupRow({ idSeed, name, text, ms }, env) {
  const id = await deterministicUuid(idSeed);
  const data = {
    id,
    name: clean(name, 80) || 'LINE群組成員',
    organization: 'source=' + GROUP_SOURCE,
    need: clean(`[${taipeiStamp(ms)} 台北] ${text}`, 1200),
    scale: GROUP_SOURCE,
    contactMethod: 'line',
    contact: 'lg-acct-' + id.replace(/-/g, '').slice(0, 12),   // 每列唯一 → 不受 RPC「同聯絡人 30 分 3 筆」限流
  };
  return writeInquiry(data, env);
}

const NON_TEXT_LABEL = { image: '圖片', video: '影片', audio: '語音', file: '檔案', location: '位置', sticker: '貼圖' };

export async function handleGroupEvent(event, token, kv, env, ctx) {
  const { type, source, replyToken } = event;
  const gid = sourceId(source);
  if (!gid) return;
  const allowed = isAllowed(env, source);
  const ms = Number(event.timestamp) || Date.now();

  if (type === 'join') {
    // 一律記一列，讓 GM 讀到 groupId（設白名單用）。此時不發話（尚未授權）。
    await writeGroupRow({ idSeed: 'join:' + (event.webhookEventId || gid + ms), name: 'LINE OA 系統', ms,
      text: `bot joined ${source.type} ${gid}（請把此 id 設為 LINE_GROUP_ALLOWLIST；allowlisted=${allowed}）` }, env);
    if (allowed) await sendDisclosureOnce(token, kv, gid, replyToken);
    else if (env.LINE_GROUP_LEAVE_UNKNOWN === '1' && parseAllowlist(env).size > 0) await leaveSource(token, source);
    return;
  }
  if (type === 'leave') {
    await writeGroupRow({ idSeed: 'leave:' + (event.webhookEventId || gid + ms), name: 'LINE OA 系統', ms,
      text: `bot left ${source.type} ${gid}` }, env);
    return;
  }
  if (type !== 'message') return;
  if (!allowed) {
    if (env.LINE_GROUP_LEAVE_UNKNOWN === '1' && parseAllowlist(env).size > 0) await leaveSource(token, source);
    return; // 非白名單：不回、不存
  }
  if (!(await groupRateOk(kv, gid, ms, env))) return; // M6：每群每分鐘上限，超過直接丟（軟上限）
  const m = event.message || {};
  const text = m.type === 'text' ? m.text : `（${NON_TEXT_LABEL[m.type] || m.type || '其他'}訊息，未轉存內容）`;
  const name = await getMemberName(token, source, source.userId);
  const r = await writeGroupRow({ idSeed: 'msg:' + (m.id || event.webhookEventId || gid + ms), name, text, ms }, env);
  if (!r.ok) throw new Error('group_inquiry_write_failed'); // 讓 dedup 層保持 processing → LINE 可重送
  await sendDisclosureOnce(token, kv, gid, replyToken);
}

export const GROUP_RATE_PER_MIN = 20;
/** 每群每分鐘最多入列 N 則（KV 計數，軟上限）。超過的訊息丟棄並只留一行 log。 */
export async function groupRateOk(kv, gid, ms, env = {}) {
  const lim = parseInt(env.LINE_GROUP_RATE_PER_MIN || String(GROUP_RATE_PER_MIN), 10) || GROUP_RATE_PER_MIN;
  const key = 'grprate:' + (await sha256Hex(gid)).slice(0, 16) + ':' + Math.floor(ms / 60000);
  const n = parseInt((await kv.get(key)) || '0', 10);
  if (n >= lim) { if (n === lim) console.error(JSON.stringify({ event: 'line_group_rate_limited' })); await kv.put(key, String(n + 1), { expirationTtl: 120 }); return false; }
  await kv.put(key, String(n + 1), { expirationTtl: 120 });
  return true;
}
async function disclosed(kv, gid) { return !!(await kv.get('grpdisc:' + await sha256Hex(gid))); }
async function markDisclosed(kv, gid) { await kv.put('grpdisc:' + await sha256Hex(gid), '1'); }
async function sendDisclosureOnce(token, kv, gid, replyToken) {
  if (!replyToken || await disclosed(kv, gid)) return;
  if (await replyText(token, replyToken, GROUP_DISCLOSURE)) await markDisclosed(kv, gid); // reply 不計則數
}

// ───────────── 出站：GM → 白名單群組 ─────────────
async function verifyHmac(key, bodyBytes, sigB64) {
  if (!sigB64) return false;
  let sig;
  try { sig = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0)); } catch { return false; }
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const exp = new Uint8Array(await crypto.subtle.sign('HMAC', k, bodyBytes));
  if (exp.length !== sig.length) return false;
  let d = 0; for (let i = 0; i < exp.length; i++) d |= exp[i] ^ sig[i];
  return d === 0;
}
const jres = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

async function memberUnits(token, gid, env) {
  const fallback = Math.max(1, parseInt(env.GROUP_MEMBER_ESTIMATE || '3', 10) || 3);
  try {
    const res = await lineFetch(token, `/group/${gid}/members/count`);
    if (!res.ok) { await res.body?.cancel(); return fallback; }
    const j = await res.json();
    return Math.max(1, Number(j.count) || fallback);
  } catch { return fallback; }
}

export async function handleLineGroupPush(request, env) {
  if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const key = env.GROUP_PUSH_KEY, token = env.LINE_CHANNEL_ACCESS_TOKEN, kv = env.LINE_KV;
  const targets = [...parseAllowlist(env)];
  if (!key || !token || !kv) return new Response('Service Unavailable', { status: 503 });
  if (targets.length !== 1) return jres({ error: 'allowlist_must_have_exactly_one_group' }, 503);
  const gid = targets[0];

  let bodyBytes;
  try { bodyBytes = new Uint8Array(await request.arrayBuffer()); } catch { return new Response('Bad Request', { status: 400 }); }
  if (bodyBytes.length > 4000) return new Response('Payload Too Large', { status: 413 });
  if (!(await verifyHmac(key, bodyBytes, request.headers.get('X-Group-Push-Signature')))) return new Response('Unauthorized', { status: 401 });

  let body;
  try { body = JSON.parse(new TextDecoder().decode(bodyBytes)); } catch { return new Response('Bad Request', { status: 400 }); }
  const { text, ts, nonce } = body || {};
  if (typeof text !== 'string' || !text.trim() || text.length > MAX_PUSH_TEXT) return jres({ error: 'bad_text' }, 400);
  if (typeof ts !== 'number' || Math.abs(Date.now() - ts) > SIG_WINDOW_MS) return jres({ error: 'stale_ts' }, 401);
  if (typeof nonce !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(nonce)) return jres({ error: 'bad_nonce' }, 400);
  if (await kv.get('grpnonce:' + nonce)) return jres({ error: 'replay' }, 409);
  await kv.put('grpnonce:' + nonce, '1', { expirationTtl: 900 });

  // 用量：reserve-then-push（失敗仍計，保守）
  const month = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 7);
  const usageKey = 'grpush:month:' + month;
  const cap = parseInt(env.GROUP_PUSH_MONTHLY_CAP || String(DEFAULT_MONTHLY_CAP), 10) || DEFAULT_MONTHLY_CAP;
  const used = parseInt((await kv.get(usageKey)) || '0', 10);
  const units = await memberUnits(token, gid, env);
  const needsDisclosure = !(await disclosed(kv, gid));
  const finalText = (needsDisclosure ? GROUP_DISCLOSURE + '\n\n' : '') + text.trim();
  if (used + units > cap) return jres({ error: 'monthly_cap_reached', used, cap, units }, 429);
  await kv.put(usageKey, String(used + units), { expirationTtl: 40 * 86400 });

  let res;
  try {
    res = await lineFetch(token, '/message/push', { method: 'POST', body: JSON.stringify({ to: gid, messages: [{ type: 'text', text: finalText.slice(0, 1000) }] }) });
  } catch { return jres({ error: 'line_unreachable', used: used + units, cap }, 502); }
  const ok = res.ok; await res.body?.cancel();
  if (!ok) return jres({ error: 'line_push_failed', status: res.status, used: used + units, cap }, 502);
  if (needsDisclosure) await markDisclosed(kv, gid);
  return jres({ ok: true, used: used + units, cap, units, disclosed: needsDisclosure });
}
