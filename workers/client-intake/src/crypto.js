// Small WebCrypto helpers shared by the worker and the provisioning script.
// Works in Cloudflare Workers and Node >= 20 (globalThis.crypto).

const enc = new TextEncoder();

export function b64url(bytes) {
  let s = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '==='.slice((s.length + 3) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomBytes(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return a;
}

// Constant-time comparison (length is not secret: both sides are fixed-size digests).
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Workers cap PBKDF2 at 100000 iterations.
export const PBKDF2_ITER = 100000;

// Access code hash = PBKDF2-SHA256(code + pepper, salt). The pepper is a worker
// secret, so a copy of the KV record alone is not enough to brute-force 6 digits.
export async function hashAccessCode(code, saltB64, pepper, iter = PBKDF2_ITER) {
  const key = await crypto.subtle.importKey('raw', enc.encode(`${code}\u0000${pepper}`), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: b64urlDecode(saltB64), iterations: iter },
    key,
    256,
  );
  return b64url(new Uint8Array(bits));
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', enc.encode(`intake-token\u0000${secret}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

export async function hmac(secret, msg) {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return b64url(new Uint8Array(sig));
}

// Session token: "<exp>.<sig>" bound to one slug. No client data inside.
export async function issueToken(secret, slug, ttlSec, now = Date.now()) {
  const exp = Math.floor(now / 1000) + ttlSec;
  const sig = await hmac(secret, `${slug}.${exp}`);
  return `${exp}.${sig}`;
}

export async function verifyToken(secret, slug, token, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 200) return false;
  const m = /^(\d{9,11})\.([A-Za-z0-9_-]{20,100})$/.exec(token);
  if (!m) return false;
  const exp = Number(m[1]);
  if (exp * 1000 < now) return false;
  const expect = await hmac(secret, `${slug}.${exp}`);
  return safeEqual(expect, m[2]);
}

export async function sha256Hex(text) {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('');
}
