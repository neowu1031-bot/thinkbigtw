// thinkbigtw-client-intake — private per-client requirement confirmation pages.
//
//   GET  /c/<slug>/              page shell (generic template, no client data)
//   POST /c/<slug>/api/unlock    { code } -> { token, content, status }
//   GET  /c/<slug>/api/content   Bearer token -> { content, status }
//   POST /c/<slug>/api/submit    Bearer token, { answers, note } -> { ok, n }
//   GET  /c/_admin/<slug>        Bearer INTAKE_ADMIN_TOKEN -> latest submission (?format=md|json, ?n=)
//   GET  /c/_a/*                 static UI assets
//
// The slug is a 43-char random string; the 6-digit access code is checked only
// here (PBKDF2 + server-side pepper). Client content lives in KV, never in the repo.

import { hashAccessCode, issueToken, verifyToken, safeEqual, sha256Hex } from './crypto.js';
import { validateSubmission, LIMITS } from './validate.js';
import { DEFAULTS, getConfig, isLocked, recordFailure, getMeta, saveSubmission, getSubmission } from './store.js';
import { submissionToMarkdown } from './render.js';
import { notify } from './notify.js';

const SLUG_RE = /^[A-Za-z0-9_-]{32,64}$/;

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
    "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; media-src 'self' https:; " +
    "connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
};

function withHeaders(res, extra = {}) {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries({ ...BASE_HEADERS, ...extra })) h.set(k, v);
  return new Response(res.body, { status: res.status, headers: h });
}

function json(status, obj) {
  return withHeaders(new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  }));
}

function notFound() {
  return withHeaders(new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
}

function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') || 'local';
}

async function rateLimited(env, key) {
  if (!env.RATE_LIMITER || typeof env.RATE_LIMITER.limit !== 'function') return false;
  try {
    const { success } = await env.RATE_LIMITER.limit({ key });
    return !success;
  } catch {
    return false;
  }
}

function sameOrigin(request, url) {
  const o = request.headers.get('Origin');
  return o === url.origin;
}

async function readJson(request) {
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > LIMITS.bodyBytes) return { error: 'too_large' };
  const text = await request.text();
  if (text.length > LIMITS.bodyBytes) return { error: 'too_large' };
  try { return { body: JSON.parse(text) }; } catch { return { error: 'bad_json' }; }
}

function bearer(request) {
  const h = request.headers.get('Authorization') || '';
  const m = /^Bearer\s+(\S+)$/.exec(h);
  return m ? m[1] : null;
}

function publicStatus(cfg, meta) {
  const max = cfg.maxSubmissions || DEFAULTS.maxSubmissions;
  return { submitted: meta.count || 0, maxSubmissions: max, remaining: Math.max(0, max - (meta.count || 0)) };
}

async function handleUnlock(request, env, slug, cfg) {
  const parsed = await readJson(request);
  if (parsed.error) return json(400, { error: parsed.error });
  const code = parsed.body && parsed.body.code;
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) {
    // Malformed input does not count as an attempt, but is still rate-limited.
    return json(400, { error: 'format' });
  }
  if (await isLocked(env, slug)) return json(429, { error: 'locked' });
  const hash = await hashAccessCode(code, cfg.code.salt, env.INTAKE_SECRET, cfg.code.iter);
  if (!safeEqual(hash, cfg.code.hash)) {
    await recordFailure(env, slug);
    return json(401, { error: 'wrong_code' });
  }
  const token = await issueToken(env.INTAKE_SECRET, slug, DEFAULTS.tokenTtlSec);
  const meta = await getMeta(env, slug);
  return json(200, { token, content: cfg.content, status: publicStatus(cfg, meta) });
}

async function requireToken(request, env, slug) {
  const t = bearer(request);
  return t && (await verifyToken(env.INTAKE_SECRET, slug, t));
}

async function handleContent(request, env, slug, cfg) {
  if (!(await requireToken(request, env, slug))) return json(401, { error: 'token' });
  const meta = await getMeta(env, slug);
  return json(200, { content: cfg.content, status: publicStatus(cfg, meta) });
}

async function handleSubmit(request, env, ctx, slug, cfg) {
  if (!(await requireToken(request, env, slug))) return json(401, { error: 'token' });
  const parsed = await readJson(request);
  if (parsed.error) return json(400, { error: parsed.error });
  const meta = await getMeta(env, slug);
  const max = cfg.maxSubmissions || DEFAULTS.maxSubmissions;
  if ((meta.count || 0) >= max) return json(409, { error: 'max_submissions', status: publicStatus(cfg, meta) });
  const v = validateSubmission(cfg.content, parsed.body);
  if (!v.ok) return json(422, { error: 'invalid', errors: v.errors });
  const submittedAt = new Date().toISOString();
  const digest = (await sha256Hex(JSON.stringify({ a: v.answers, n: v.note }))).slice(0, 16);
  const rec = await saveSubmission(env, slug, cfg, { submittedAt, digest, answers: v.answers, note: v.note });
  const p = notify(env, cfg, slug, rec);
  if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(p); else await p;
  const after = await getMeta(env, slug);
  return json(200, { ok: true, n: rec.n, submittedAt, status: publicStatus(cfg, { count: Math.max(after.count || 0, rec.n) }) });
}

async function handleAdmin(request, env, slug, url) {
  const expected = env.INTAKE_ADMIN_TOKEN;
  if (!expected || expected.length < 32) return notFound();
  const got = bearer(request) || '';
  const [a, b] = await Promise.all([sha256Hex(got), sha256Hex(expected)]);
  if (!safeEqual(a, b)) return notFound();
  const raw = await env.INTAKE_KV.get(`cfg:${slug}`);
  if (!raw) return notFound();
  const cfg = JSON.parse(raw);
  const meta = await getMeta(env, slug);
  const n = url.searchParams.get('n') ? Number(url.searchParams.get('n')) : meta.latest;
  if (!n) return json(200, { label: cfg.label, count: 0, history: [] });
  const rec = await getSubmission(env, slug, n);
  if (!rec) return json(404, { error: 'no_such_submission', history: meta.history });
  if (url.searchParams.get('format') === 'md') {
    return withHeaders(new Response(submissionToMarkdown(cfg, rec), { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } }));
  }
  return json(200, { label: cfg.label, history: meta.history, submission: rec });
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
      return withHeaders(new Response('Service unavailable', { status: 503 }));
    }

    if (path.startsWith('/c/_a/')) {
      if (request.method !== 'GET' && request.method !== 'HEAD') return notFound();
      if (path === '/c/_a/shell.html') return notFound();
      return serveAsset(env, request, path);
    }

    const parts = path.split('/'); // ['', 'c', slug, ...]

    if (parts[2] === '_admin') {
      const slug = parts[3];
      if (request.method !== 'GET' || !SLUG_RE.test(slug || '') || parts.length > 4) return notFound();
      if (await rateLimited(env, `admin:${clientIp(request)}`)) return json(429, { error: 'rate' });
      return handleAdmin(request, env, slug, url);
    }

    const slug = parts[2];
    if (!SLUG_RE.test(slug || '')) return notFound();
    const rest = parts.slice(3).join('/');

    if (rest === '' && parts.length === 3) {
      return withHeaders(Response.redirect(`${url.origin}/c/${slug}/`, 301));
    }

    const cfg = await getConfig(env, slug);
    if (!cfg) return notFound();

    if (rest === '' && (request.method === 'GET' || request.method === 'HEAD')) {
      return serveAsset(env, request, '/c/_a/shell.html');
    }

    if (!rest.startsWith('api/')) return notFound();
    if (await rateLimited(env, `api:${clientIp(request)}`)) return json(429, { error: 'rate' });

    if (rest === 'api/content' && request.method === 'GET') return handleContent(request, env, slug, cfg);
    if (request.method !== 'POST') return notFound();
    if (!sameOrigin(request, url)) return json(403, { error: 'origin' });
    if (rest === 'api/unlock') return handleUnlock(request, env, slug, cfg);
    if (rest === 'api/submit') return handleSubmit(request, env, ctx, slug, cfg);
    return notFound();
  },
};
