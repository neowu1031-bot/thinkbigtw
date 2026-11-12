#!/usr/bin/env node
// Build the KV record for one client page and (optionally) upload it.
//
//   INTAKE_SECRET=... node scripts/provision.mjs --config <client.json> --out <record.json> [options]
//
// Options
//   --slug <slug>     reuse an existing link (default: new 43-char random slug)
//   --code <6digits>  set a specific access code (default: new random code)
//   --apply local|remote   run `wrangler kv key put` for you
//   --origin <url>    printed link origin (default https://thinkbigtw.com)
//
// The client config and the output record must live OUTSIDE this public repo.
// The access code is printed once and stored only as a PBKDF2 hash.

import { readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { b64url, randomBytes, hashAccessCode, PBKDF2_ITER } from '../src/crypto.js';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : dflt;
}

function die(msg) { console.error(`provision: ${msg}`); process.exit(1); }

function randomCode() {
  // Uniform 000000-999999 via rejection sampling.
  for (;;) {
    const n = new Uint32Array(randomBytes(4).buffer)[0];
    if (n < 4294000000) return String(n % 1000000).padStart(6, '0');
  }
}

const cfgPath = arg('config');
const outPath = arg('out');
const secret = process.env.INTAKE_SECRET || '';
if (!cfgPath || !outPath) die('need --config and --out');
if (secret.length < 32) die('INTAKE_SECRET (>=32 chars) must be set in the environment');
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

const slug = arg('slug') || b64url(randomBytes(32));
if (!/^[A-Za-z0-9_-]{32,64}$/.test(slug)) die('slug must be 32-64 chars [A-Za-z0-9_-]');
const code = arg('code') || randomCode();
if (!/^\d{6}$/.test(code)) die('code must be 6 digits');
const salt = b64url(randomBytes(16));
const hash = await hashAccessCode(code, salt, secret, PBKDF2_ITER);

const retentionDays = client.retentionDays || 180;
const record = {
  v: 1,
  label: client.label || 'client',
  status: 'open',
  createdAt: new Date().toISOString(),
  expiresAt: client.expiresAt || null,
  maxSubmissions: client.maxSubmissions || 5,
  retentionDays,
  code: { salt, hash, iter: PBKDF2_ITER },
  content: client.content,
};
writeFileSync(outPath, JSON.stringify(record));
chmodSync(outPath, 0o600);

const ttl = retentionDays * 86400;
const origin = arg('origin', 'https://thinkbigtw.com');
const kvArgs = ['wrangler', 'kv', 'key', 'put', '--binding', 'INTAKE_KV', `cfg:${slug}`, '--path', resolve(outPath), '--ttl', String(ttl)];

console.log(`link: ${origin}/c/${slug}/`);
console.log(`access code: ${code}`);
console.log(`record: ${resolve(outPath)} (mode 600)`);
const mode = arg('apply');
if (mode === 'local' || mode === 'remote') {
  execFileSync('npx', [...kvArgs, `--${mode}`], { cwd: resolve(here, '..'), stdio: 'inherit' });
  console.log(`uploaded to KV (${mode})`);
} else {
  console.log(`upload: (cd workers/client-intake && npx ${kvArgs.join(' ')} --remote)`);
}
