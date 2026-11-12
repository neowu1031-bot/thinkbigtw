// thinkbigtw-client-intake — private per-client requirement confirmation pages.
//
//   GET  /c/<slug>/                page shell (generic template, no client data)
//   POST /c/<slug>/api/unlock      { code } -> { token, content, status } (+ HttpOnly media cookie)
//   GET  /c/<slug>/api/content     Bearer token -> { content, status }
//   POST /c/<slug>/api/submit      Bearer token, { answers, note } -> { ok, id, submittedAt }
//   GET  /c/<slug>/media/<name>    token cookie or Bearer; Range supported; private video/poster
//   GET  /c/_admin/<slug>          Bearer INTAKE_ADMIN_TOKEN -> latest submission (?format=md|json, ?id=)
//   GET  /c/_a/{app.js,app.css,logo.png}  static UI assets
//
// The slug is a 43-char random string; the 8-character access code is checked only
// here (PBKDF2 + server-side pepper). Client content lives in KV, never in the repo.

import { hashAccessCode, issueToken, verifyToken, safeEqual, sha256Hex, b64url, randomBytes } from './crypto.js';
import { validateSubmission, LIMITS } from './validate.js';
import {
  DEFAULTS, getConfig, getConfigAny, isLocked, recordFailure, listSubmissionIds, saveSubmission,
  getSubmission, makeSubmissionId, SUBMISSION_ID_RE, recordNotifyFailed,
} from './store.js';
import { submissionToMarkdown } from './render.js';
import { CODE_RE, normalizeCode } from './code.js';
import { notify } from './notify.js';

const SLUG_RE = /^[A-Za-z0-9_-]{32,64}$/;
const MEDIA_NAME_RE = /^[a-z0-9][a-z0-9._-]{0,60}$/;
const STATIC_ASSETS = new Set(['/c/_a/app.js', '/c/_a/app.css', '/c/_a/logo.png']);
const COOKIE = 'ci_t';

const BASE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Content-Security-Policy':
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self'; " +
    "connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
};

function withHeaders(res, extra = {}) {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries({ ...BASE_HEADERS, ...extra })) h.set(k, v);
  return new Response(res.body, { status: res.status, headers: h });
}

function json(status, obj, extra) {
  return withHeaders(new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  }), extra);
}

function text(status, body) {
  return withHeaders(new Response(body, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
}

const notFound = () => text(404, 'Not found');
const gone = () => text(410, '這個頁面已經關閉。如需協助，請直接用 LINE 聯絡我們。');

function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'local';
}

async function rateLimited(binding, key) {
  if (!binding || typeof binding.limit !== 'function') return false;
  try {
    const { success } = await binding.limit({ key });
    return !success;
  } catch {
    return false;
  }
}

function sameOrigin(request, url) {
  return request.headers.get('Origin') === url.origin;
}

async function readJson(request) {
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > LIMITS.bodyBytes) return { error: 'too_large' };
  const t = await request.text();
  if (t.length > LIMITS.bodyBytes) return { error: 'too_large' };
  try { return { body: JSON.parse(t) }; } catch { return { error: 'bad_json' }; }
}

function bearer(request) {
  const m = /^Bearer\s+(\S+)$/.exec(request.headers.get('Authorization') || '');
  return m ? m[1] : null;
}

function cookieToken(request) {
  const c = request.headers.get('Cookie') || '';
  const m = new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`).exec(c);
  return m ? m[1] : null;
}

function publicStatus(cfg, count) {
  const max = cfg.maxSubmissions || DEFAULTS.maxSubmissions;
  return { submitted: count, maxSubmissions: max, remaining: Math.max(0, max - count) };
}

async function handleUnlock(request, env, slug, cfg, url) {
  const parsed = await readJson(request);
  if (parsed.error) return json(400, { error: parsed.error });
  const code = normalizeCode(parsed.body && parsed.body.code);
  if (!CODE_RE.test(code)) return json(400, { error: 'format' }); // not counted as an attempt
  if (await isLocked(env, slug)) return json(429, { error: 'locked' });
  const hash = await hashAccessCode(code, cfg.code.salt, env.INTAKE_SECRET, cfg.code.iter);
  if (!safeEqual(hash, cfg.code.hash)) {
    await recordFailure(env, slug);
    return json(401, { error: 'wrong_code' });
  }
  const token = await issueToken(env.INTAKE_SECRET, slug, DEFAULTS.tokenTtlSec);
  const count = (await listSubmissionIds(env, slug)).length;
  const secure = url.protocol === 'https:' || url.hostname === 'localhost' ? '; Secure' : '';
  return json(200, { token, content: cfg.content, status: publicStatus(cfg, count) }, {
    'Set-Cookie': `${COOKIE}=${token}; Path=/c/${slug}/; HttpOnly${secure}; SameSite=Strict; Max-Age=${DEFAULTS.tokenTtlSec}`,
  });
}

async function tokenOk(env, slug, t) {
  return !!t && (await verifyToken(env.INTAKE_SECRET, slug, t));
}

async function handleContent(request, env, slug, cfg) {
  if (!(await tokenOk(env, slug, bearer(request)))) return json(401, { error: 'token' });
  const count = (await listSubmissionIds(env, slug)).length;
  return json(200, { content: cfg.content, status: publicStatus(cfg, count) });
}

async function handleSubmit(request, env, ctx, slug, cfg) {
  if (!(await tokenOk(env, slug, bearer(request)))) return json(401, { error: 'token' });
  const parsed = await readJson(request);
  if (parsed.error) return json(400, { error: parsed.error });
  const before = (await listSubmissionIds(env, slug)).length;
  const max = cfg.maxSubmissions || DEFAULTS.maxSubmissions;
  if (before >= max) return json(409, { error: 'max_submissions', status: publicStatus(cfg, before) });
  const v = validateSubmission(cfg.content, parsed.body);
  if (!v.ok) return json(422, { error: 'invalid', errors: v.errors });

  const submittedAt = new Date().toISOString();
  // Random nonce keeps ids unique even for identical answers sent in the same millisecond.
  const nonce = b64url(randomBytes(9));
  const digest = await sha256Hex(JSON.stringify({ t: submittedAt, r: nonce, a: v.answers, n: v.note }));
  const id = makeSubmissionId(submittedAt, digest);
  const rec = { id, seq: before + 1, submittedAt, answers: v.answers, note: v.note };
  try {
    await saveSubmission(env, slug, cfg, rec);
  } catch (e) {
    console.error('intake store failed', e && e.message);
    return json(503, { error: 'store_failed' });
  }

  // The notice must never affect the submission result. Failures are recorded for the daily check.
  const p = notify(env, cfg, slug, rec).then(async (result) => {
    if (result !== 'sent') {
      try { await recordNotifyFailed(env, slug, cfg, id, result); } catch (e) { console.error('notify_failed record failed', e && e.message); }
    }
  });
  if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(p); else await p;

  return json(200, { ok: true, id, submittedAt, status: publicStatus(cfg, before + 1) });
}

function parseRange(header, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header || '');
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start;
  let end;
  if (m[1] === '') { // suffix: last N bytes
    const n = Number(m[2]);
    if (!n) return 'invalid';
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return 'invalid';
  return { start, end };
}

async function handleMedia(request, env, slug, cfg, name) {
  if (!(await tokenOk(env, slug, cookieToken(request) || bearer(request)))) return notFound();
  const entry = cfg.media && Object.prototype.hasOwnProperty.call(cfg.media, name) ? cfg.media[name] : null;
  if (!entry) return notFound();
  const type = entry.type || 'application/octet-stream';
  const headers = {
    'Content-Type': type,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store',
    'Content-Disposition': 'inline',
  };

  // Media bytes live in KV (media:<slug>:<name>, max 25 MiB per value).
  if (!entry.kvKey) return notFound();
  const buf = await env.INTAKE_KV.get(entry.kvKey, { type: 'arrayBuffer' });
  if (!buf) return notFound();
  const size = buf.byteLength;
  const readRange = async (r) => (r ? buf.slice(r.start, r.end + 1) : buf);

  const range = parseRange(request.headers.get('Range'), size);
  if (range === 'invalid') {
    return withHeaders(new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${size}` } }), { 'Cache-Control': 'private, no-store' });
  }
  const isHead = request.method === 'HEAD';
  if (range) {
    const len = range.end - range.start + 1;
    const body = isHead ? null : await readRange(range);
    return withHeaders(new Response(body, {
      status: 206,
      headers: { ...headers, 'Content-Range': `bytes ${range.start}-${range.end}/${size}`, 'Content-Length': String(len) },
    }), { 'Cache-Control': 'private, no-store' });
  }
  const body = isHead ? null : await readRange(null);
  return withHeaders(new Response(body, { status: 200, headers: { ...headers, 'Content-Length': String(size) } }), { 'Cache-Control': 'private, no-store' });
}

async function handleAdmin(request, env, slug, url) {
  const expected = env.INTAKE_ADMIN_TOKEN;
  if (!expected || expected.length < 32) return notFound();
  const [a, b] = await Promise.all([sha256Hex(bearer(request) || ''), sha256Hex(expected)]);
  if (!safeEqual(a, b)) return notFound();
  const cfg = await getConfigAny(env, slug);
  const ids = await listSubmissionIds(env, slug);
  if (!cfg && !ids.length) return notFound();
  const want = url.searchParams.get('id');
  if (want != null && !SUBMISSION_ID_RE.test(want)) return json(400, { error: 'bad_id' });
  const fmt = url.searchParams.get('format');
  if (fmt != null && fmt !== 'md' && fmt !== 'json') return json(400, { error: 'bad_format' });
  const id = want || ids[ids.length - 1];
  if (!id) return json(200, { label: cfg && cfg.label, submissions: [] });
  const rec = await getSubmission(env, slug, id);
  if (!rec) return json(404, { error: 'no_such_submission', submissions: ids });
  if (fmt === 'md' && cfg) {
    return withHeaders(new Response(submissionToMarkdown(cfg, rec), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } }));
  }
  return json(200, { label: cfg && cfg.label, submissions: ids, submission: rec });
}

async function serveAsset(env, request, path) {
  if (!env.ASSETS) return notFound();
  const res = await env.ASSETS.fetch(new Request(new URL(path, request.url), { method: 'GET' }));
  if (res.status !== 200) return notFound();
  return withHeaders(res, { 'Cache-Control': path.endsWith('.html') ? 'no-store' : 'public, max-age=300' });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (!path.startsWith('/c/')) return notFound();

    // Fail closed if the deployment is incomplete.
    if (!env.INTAKE_KV || !env.INTAKE_SECRET || env.INTAKE_SECRET.length < 32) {
      return text(503, 'Service unavailable');
    }

    if (path.startsWith('/c/_a/')) {
      if ((request.method !== 'GET' && request.method !== 'HEAD') || !STATIC_ASSETS.has(path)) return notFound();
      return serveAsset(env, request, path);
    }

    const parts = path.split('/'); // ['', 'c', slug, ...]
    const ip = clientIp(request);

    if (parts[2] === '_admin') {
      const slug = parts[3];
      if (request.method !== 'GET' || !SLUG_RE.test(slug || '') || parts.length > 4) return notFound();
      if (await rateLimited(env.RATE_LIMITER, `admin:${ip}`)) return json(429, { error: 'rate' });
      return handleAdmin(request, env, slug, url);
    }

    const slug = parts[2];
    if (!SLUG_RE.test(slug || '')) return notFound();
    const rest = parts.slice(3).join('/');

    if (rest === '' && parts.length === 3) {
      return withHeaders(Response.redirect(`${url.origin}/c/${slug}/`, 301));
    }

    // Rate-limit before any KV read so random-slug probing cannot burn the KV quota.
    const isMedia = rest.startsWith('media/');
    const limiter = isMedia ? (env.MEDIA_LIMITER || env.RATE_LIMITER) : env.RATE_LIMITER;
    if (await rateLimited(limiter, `${isMedia ? 'media' : 'page'}:${ip}`)) return json(429, { error: 'rate' });

    const state = await getConfig(env, slug);
    if (!state) return notFound();
    if (state.gone) return rest.startsWith('api/') ? json(410, { error: 'closed' }) : gone();
    const cfg = state.cfg;

    if (rest === '' && (request.method === 'GET' || request.method === 'HEAD')) {
      return serveAsset(env, request, '/c/_a/shell.html');
    }

    if (isMedia) {
      const name = rest.slice('media/'.length);
      if ((request.method !== 'GET' && request.method !== 'HEAD') || !MEDIA_NAME_RE.test(name)) return notFound();
      return handleMedia(request, env, slug, cfg, name);
    }

    if (!rest.startsWith('api/')) return notFound();
    if (rest === 'api/content' && request.method === 'GET') return handleContent(request, env, slug, cfg);
    if (request.method !== 'POST') return notFound();
    if (!sameOrigin(request, url)) return json(403, { error: 'origin' });
    if (rest === 'api/unlock') return handleUnlock(request, env, slug, cfg, url);
    if (rest === 'api/submit') return handleSubmit(request, env, ctx, slug, cfg);
    return notFound();
  },
};
