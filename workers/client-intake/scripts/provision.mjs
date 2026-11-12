#!/usr/bin/env node
// Build the KV record for one client page and (optionally) upload it with its media.
//
//   node scripts/provision.mjs --config <client.json> --out <record.json> --secret-file <600 file> [options]
//
// Secret (never as a command-line argument): --secret-file <path, mode 600>, or --secret-stdin,
// or the INTAKE_SECRET environment variable.
//
// Options
//   --slug <slug>       reuse an existing link (default: new 43-char random slug)
//   --code <code>       keep a specific 8-character code (default: new random code)
//   --apply local|remote   upload the record (and media files) with wrangler
//   --persist-to <dir>  passed to wrangler for --apply local
//   --wrangler-config <path>  passed to wrangler as --config
//   --origin <url>      printed link origin (default https://thinkbigtw.com)
//
// The client config, its media and the output record must live OUTSIDE this public repo.
// The access code is printed once and stored only as a PBKDF2 hash.
//
// Media: client.media = { "<name>": { "file": "<abs path>", "type": "video/mp4" } }.
// Each file is uploaded to KV as media:<slug>:<name> (max 25 MiB) and served only to
// visitors holding a valid session token at /c/<slug>/media/<name>.

import { readFileSync, writeFileSync, chmodSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { b64url, randomBytes, hashAccessCode, PBKDF2_ITER } from '../src/crypto.js';
import { CODE_ALPHABET, normalizeCode } from '../src/code.js';

const here = dirname(fileURLToPath(import.meta.url));
const workerDir = resolve(here, '..');
const repoRoot = resolve(here, '../../..');
const KV_MAX = 25 * 1024 * 1024;

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : dflt;
}
const flag = (name) => process.argv.includes(`--${name}`);
function die(msg) { console.error(`provision: ${msg}`); process.exit(1); }

function randomCode() {
  // Uniform over the 31-character alphabet via rejection sampling.
  const n = CODE_ALPHABET.length;
  const limit = 256 - (256 % n);
  let out = '';
  while (out.length < 8) {
    for (const b of randomBytes(16)) {
      if (b < limit && out.length < 8) out += CODE_ALPHABET[b % n];
    }
  }
  return out;
}

function readSecret() {
  const file = arg('secret-file');
  if (file) {
    const mode = statSync(file).mode & 0o777;
    if (mode & 0o077) die(`${file} must be mode 600 (is ${mode.toString(8)})`);
    return readFileSync(file, 'utf8').trim();
  }
  if (flag('secret-stdin')) return readFileSync(0, 'utf8').trim();
  return (process.env.INTAKE_SECRET || '').trim();
}

const cfgPath = arg('config');
const outPath = arg('out');
if (!cfgPath || !outPath) die('need --config and --out');
const secret = readSecret();
if (secret.length < 32) die('secret missing or shorter than 32 chars (use --secret-file, --secret-stdin or INTAKE_SECRET)');
for (const p of [cfgPath, outPath]) {
  if (resolve(p).startsWith(repoRoot + '/')) die(`${p} is inside the public repo; keep client files outside it`);
}

const client = JSON.parse(readFileSync(cfgPath, 'utf8'));
if (!client.content || !Array.isArray(client.content.questions)) die('config.content.questions missing');
if (client.content.questions.length > 20) die('more than 20 questions; trim the list');
const ids = new Set();
for (const q of client.content.questions) {
  if (!q.id || ids.has(q.id)) die(`duplicate or missing question id: ${q.id}`);
  ids.add(q.id);
}
if (client.expiresAt && !(Date.parse(client.expiresAt) > Date.now())) die('expiresAt is missing a valid future date');

const slug = arg('slug') || b64url(randomBytes(32));
if (!/^[A-Za-z0-9_-]{32,64}$/.test(slug)) die('slug must be 32-64 chars [A-Za-z0-9_-]');
const code = arg('code') ? normalizeCode(arg('code')) : randomCode();
if (code.length !== 8 || [...code].some((c) => !CODE_ALPHABET.includes(c))) die(`code must be 8 chars from ${CODE_ALPHABET}`);
const salt = b64url(randomBytes(16));
const hash = await hashAccessCode(code, salt, secret, PBKDF2_ITER);

const retentionDays = client.retentionDays || 180;
const media = {};
const uploads = [];
for (const [name, m] of Object.entries(client.media || {})) {
  if (!/^[a-z0-9][a-z0-9._-]{0,60}$/.test(name)) die(`bad media name: ${name}`);
  const file = resolve(m.file);
  if (file.startsWith(repoRoot + '/')) die(`media ${name} is inside the public repo`);
  const size = statSync(file).size;
  if (size > KV_MAX) die(`media ${name} is ${size} bytes; KV values max 25 MiB — re-encode smaller or bind R2`);
  const kvKey = `media:${slug}:${name}`;
  media[name] = { kvKey, type: m.type || 'application/octet-stream', size };
  uploads.push({ kvKey, file });
}

const record = {
  v: 2,
  label: client.label || 'client',
  status: 'open',
  createdAt: new Date().toISOString(),
  expiresAt: client.expiresAt || null,
  maxSubmissions: client.maxSubmissions || 5,
  retentionDays,
  code: { salt, hash, iter: PBKDF2_ITER },
  media,
  content: client.content,
};
writeFileSync(outPath, JSON.stringify(record), { mode: 0o600 });
chmodSync(outPath, 0o600);

// Keep the config (and media) a bit longer than the answers so retrieval keeps working.
const ttl = String((retentionDays + 60) * 86400);
const origin = arg('origin', 'https://thinkbigtw.com');
const pretty = `${code.slice(0, 4)}-${code.slice(4)}`;
console.log(`link: ${origin}/c/${slug}/`);
console.log(`access code: ${pretty}`);
console.log(`record: ${resolve(outPath)} (mode 600)`);
if (record.expiresAt) console.log(`closes: ${record.expiresAt}`);

const mode = arg('apply');
if (mode === 'local' || mode === 'remote') {
  const extra = [`--${mode}`];
  if (arg('persist-to')) extra.push('--persist-to', arg('persist-to'));
  if (arg('wrangler-config')) extra.push('--config', arg('wrangler-config'));
  const put = (key, path) => execFileSync('npx', ['--no-install', 'wrangler', 'kv', 'key', 'put', '--binding', 'INTAKE_KV', key, '--path', path, '--ttl', ttl, ...extra], { cwd: workerDir, stdio: ['ignore', 'ignore', 'inherit'] });
  for (const u of uploads) { put(u.kvKey, u.file); console.log(`uploaded ${u.kvKey}`); }
  put(`cfg:${slug}`, resolve(outPath));
  console.log(`uploaded cfg (${mode})`);
} else {
  console.log('not uploaded; re-run with --apply remote');
}
