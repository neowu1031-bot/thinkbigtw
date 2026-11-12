#!/usr/bin/env node
// Daily check: for every client link, show when the latest answers arrived and whether any
// notice mail failed. Reads key NAMES only (no values), so no answers are ever printed.
//
//   node scripts/check-submissions.mjs [--local [--persist-to <dir>]] [--wrangler-config <path>] [--full-slug]
//
// Exit code 2 when any notify_failed record exists, so a scheduler can flag it.

import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const workerDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const has = (n) => argv.includes(`--${n}`);

function listKeys(prefix) {
  const extra = [has('local') ? '--local' : '--remote'];
  if (arg('persist-to')) extra.push('--persist-to', arg('persist-to'));
  if (arg('wrangler-config')) extra.push('--config', arg('wrangler-config'));
  const out = execFileSync('npx', ['--no-install', 'wrangler', 'kv', 'key', 'list', '--binding', 'INTAKE_KV', '--prefix', prefix, ...extra], {
    cwd: workerDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'],
  });
  const start = out.indexOf('[');
  return JSON.parse(out.slice(start)).map((k) => k.name);
}

// 20261112T050000910Z-ab12cd34 -> 2026-11-12T05:00:00.910Z
function idTime(id) {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(\d{3})Z/.exec(id);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}.${m[7]}Z` : id;
}

const short = (s) => (has('full-slug') ? s : `${s.slice(0, 10)}…`);

const cfgs = listKeys('cfg:').map((n) => n.slice(4));
const subs = listKeys('sub:');
const fails = listKeys('notify_failed:');

const bySlug = new Map(cfgs.map((s) => [s, { count: 0, latest: null, failed: 0 }]));
const slugOf = (name, prefix) => { const rest = name.slice(prefix.length); const i = rest.lastIndexOf(':'); return [rest.slice(0, i), rest.slice(i + 1)]; };
for (const n of subs) {
  const [slug, id] = slugOf(n, 'sub:');
  const e = bySlug.get(slug) || { count: 0, latest: null, failed: 0 };
  e.count++;
  if (!e.latest || id > e.latest) e.latest = id;
  bySlug.set(slug, e);
}
for (const n of fails) {
  const [slug] = slugOf(n, 'notify_failed:');
  const e = bySlug.get(slug) || { count: 0, latest: null, failed: 0 };
  e.failed++;
  bySlug.set(slug, e);
}

console.log(`checked ${new Date().toISOString()}  links=${bySlug.size}  submissions=${subs.length}  notify_failed=${fails.length}`);
for (const [slug, e] of [...bySlug].sort()) {
  const latest = e.latest ? `${idTime(e.latest)} (${e.latest})` : '-';
  console.log(`${short(slug)}  submissions=${e.count}  latest=${latest}  notify_failed=${e.failed}`);
}
if (fails.length) {
  console.log('NOTICE MAIL FAILED for the submission(s) above: fetch them with wrangler kv key get and follow up.');
  process.exit(2);
}
