// KV layout (namespace INTAKE_KV). Every key except cfg:* carries an expiration.
//   cfg:<slug>             client config (code hash, content). Written by scripts/provision.mjs.
//   fail:<slug>:<hour>     failed access-code attempts in that hour     (TTL 2h)
//   faild:<slug>:<day>     failed attempts that day                     (TTL 2d)
//   meta:<slug>            { count, history:[{n, at, digest}] }         (TTL = retention)
//   sub:<slug>:<n>         one submission (answers JSON)                (TTL = retention)

export const DEFAULTS = {
  maxSubmissions: 5,
  retentionDays: 180,
  failPerHour: 8,
  failPerDay: 30,
  tokenTtlSec: 6 * 3600,
};

const DAY = 86400;

export async function getConfig(env, slug) {
  const raw = await env.INTAKE_KV.get(`cfg:${slug}`);
  if (!raw) return null;
  try {
    const cfg = JSON.parse(raw);
    if (cfg.status === 'closed') return null;
    if (cfg.expiresAt && Date.parse(cfg.expiresAt) < Date.now()) return null;
    return cfg;
  } catch {
    return null;
  }
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

export async function getMeta(env, slug) {
  const raw = await env.INTAKE_KV.get(`meta:${slug}`);
  if (!raw) return { count: 0, history: [] };
  try { return JSON.parse(raw); } catch { return { count: 0, history: [] }; }
}

export async function saveSubmission(env, slug, cfg, record) {
  const retention = (cfg.retentionDays || DEFAULTS.retentionDays) * DAY;
  const meta = await getMeta(env, slug);
  const n = meta.count + 1;
  const rec = { ...record, n };
  await env.INTAKE_KV.put(`sub:${slug}:${n}`, JSON.stringify(rec), { expirationTtl: retention });
  meta.count = n;
  meta.history = [...(meta.history || []), { n, at: record.submittedAt, digest: record.digest }];
  meta.latest = n;
  await env.INTAKE_KV.put(`meta:${slug}`, JSON.stringify(meta), { expirationTtl: retention });
  return rec;
}

export async function getSubmission(env, slug, n) {
  const raw = await env.INTAKE_KV.get(`sub:${slug}:${n}`);
  return raw ? JSON.parse(raw) : null;
}
