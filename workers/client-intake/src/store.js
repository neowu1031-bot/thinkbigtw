// KV layout (namespace INTAKE_KV). Every key carries an expiration.
//   cfg:<slug>                      client config (code hash, content, media map). scripts/provision.mjs
//   media:<slug>:<name>             video/poster bytes (KV value, max 25 MiB)               scripts/provision.mjs
//   fail:<slug>:<hour>              failed access-code attempts in that hour     (TTL 2h)
//   faild:<slug>:<day>              failed attempts that day                     (TTL 2d)
//   sub:<slug>:<id>                 one submission; id = <UTC timestamp>-<hash8> (TTL = retention)
//   notify_failed:<slug>:<id>       the notice mail for that submission failed   (TTL = retention)
//
// Each submission gets its own key, so concurrent submits never overwrite each other.

import { sha256Hex } from './crypto.js';

export const DEFAULTS = {
  maxSubmissions: 5,
  retentionDays: 180,
  failPerHour: 8,
  failPerDay: 30,
  tokenTtlSec: 6 * 3600,
};

const DAY = 86400;

// Returns { cfg } when open, { gone: true } when closed or past expiresAt, null when unknown.
export async function getConfig(env, slug, now = Date.now()) {
  const raw = await env.INTAKE_KV.get(`cfg:${slug}`);
  if (!raw) return null;
  let cfg;
  try { cfg = JSON.parse(raw); } catch { return null; }
  if (cfg.status === 'closed') return { gone: true };
  if (cfg.expiresAt && !(Date.parse(cfg.expiresAt) > now)) return { gone: true };
  return { cfg };
}

// Admin/retrieval read: ignores expiry so answers stay retrievable after the link closes.
export async function getConfigAny(env, slug) {
  const raw = await env.INTAKE_KV.get(`cfg:${slug}`);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function hourKey(now) { return Math.floor(now / 3600000); }
function dayKey(now) { return Math.floor(now / 86400000); }

export async function isLocked(env, slug, now = Date.now()) {
  const [h, d] = await Promise.all([
    env.INTAKE_KV.get(`fail:${slug}:${hourKey(now)}`),
    env.INTAKE_KV.get(`faild:${slug}:${dayKey(now)}`),
  ]);
  return Number(h || 0) >= DEFAULTS.failPerHour || Number(d || 0) >= DEFAULTS.failPerDay;
}

export async function recordFailure(env, slug, now = Date.now()) {
  const hk = `fail:${slug}:${hourKey(now)}`;
  const dk = `faild:${slug}:${dayKey(now)}`;
  const [h, d] = await Promise.all([env.INTAKE_KV.get(hk), env.INTAKE_KV.get(dk)]);
  await Promise.all([
    env.INTAKE_KV.put(hk, String(Number(h || 0) + 1), { expirationTtl: 7200 }),
    env.INTAKE_KV.put(dk, String(Number(d || 0) + 1), { expirationTtl: 2 * DAY }),
  ]);
}

async function listAll(env, prefix) {
  const names = [];
  let cursor;
  do {
    const r = await env.INTAKE_KV.list({ prefix, cursor });
    for (const k of r.keys) names.push(k.name);
    cursor = r.list_complete ? undefined : r.cursor;
  } while (cursor);
  return names;
}

export async function listSubmissionIds(env, slug) {
  const prefix = `sub:${slug}:`;
  return (await listAll(env, prefix)).map((n) => n.slice(prefix.length)).sort();
}

export function makeSubmissionId(submittedAt, digest) {
  // 2026-11-12T05:00:00.910Z -> 20261112T050000910Z-<hash8>
  return `${submittedAt.replace(/[-:.]/g, '')}-${digest.slice(0, 8)}`;
}

export const SUBMISSION_ID_RE = /^\d{8}T\d{9}Z-[0-9a-f]{8}$/;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Write, then read back and compare hashes. Throws if the stored copy cannot be confirmed,
// so the caller never tells the client "received" for something that is not in storage.
export async function saveSubmission(env, slug, cfg, record) {
  const retention = (cfg.retentionDays || DEFAULTS.retentionDays) * DAY;
  const key = `sub:${slug}:${record.id}`;
  const body = JSON.stringify(record);
  const want = await sha256Hex(body);
  await env.INTAKE_KV.put(key, body, { expirationTtl: retention });
  for (const wait of [0, 100, 300, 800]) {
    if (wait) await sleep(wait);
    const back = await env.INTAKE_KV.get(key);
    if (back != null) {
      if ((await sha256Hex(back)) === want) return { key, hash: want };
      throw new Error('stored copy differs');
    }
  }
  throw new Error('stored copy not readable');
}

export async function getSubmission(env, slug, id) {
  const raw = await env.INTAKE_KV.get(`sub:${slug}:${id}`);
  return raw ? JSON.parse(raw) : null;
}

export async function recordNotifyFailed(env, slug, cfg, id, reason) {
  const retention = (cfg.retentionDays || DEFAULTS.retentionDays) * DAY;
  await env.INTAKE_KV.put(`notify_failed:${slug}:${id}`, JSON.stringify({ at: new Date().toISOString(), reason }), { expirationTtl: retention });
}
