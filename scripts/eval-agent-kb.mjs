// 客服知識庫 60 題覆蓋檢查（0 token，不呼叫任何模型）。
// 對每一題跑兩條實際路徑：LINE／備援（selectKnowledge）與官網主力（selectKnowledgePrimary），
// 檢查模型實際看得到的內容（知識庫＋SCOPE_RULE＋LINE 補充規則）是否含答題必要的事實（must 正則）。
// 用法：node scripts/eval-agent-kb.mjs [--min 54] [--json]
// 這只證明「答案的依據有被送到模型」；答案品質仍要用模型實答＋人工／AI 評分（見 workers/ai-proxy/docs/kb-sync-sop.md）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tb = await import(path.join(root, 'workers/ai-proxy/src/thinkbig.js'));
const lineSrc = fs.readFileSync(path.join(root, 'workers/ai-proxy/src/line-webhook.js'), 'utf8');
const suffix = (lineSrc.match(/const LINE_SYSTEM_PROMPT_SUFFIX = `([\s\S]*?)`;/) || [, ''])[1];
const qs = JSON.parse(fs.readFileSync(path.join(root, 'data/agent-kb-eval/questions-60.json'), 'utf8'));
const minIdx = process.argv.indexOf('--min');
const min = minIdx > -1 ? Number(process.argv[minIdx + 1]) : 54;
const rows = [];
for (const q of qs) {
  const msgs = [{ role: 'user', content: q.q }];
  const line = tb.selectKnowledge(msgs), web = tb.selectKnowledgePrimary(msgs);
  const miss = ctx => q.must.filter(p => !new RegExp(p).test(ctx));
  rows.push({ id: q.id, cat: q.cat, lineSelected: line.selected, lineMissing: miss(line.text + tb.SCOPE_RULE + suffix), webSelected: web.selected.filter(id => Number(id) >= 13), webMissing: miss(web.text + tb.SCOPE_RULE) });
}
const linePass = rows.filter(r => !r.lineMissing.length).length, webPass = rows.filter(r => !r.webMissing.length).length;
if (process.argv.includes('--json')) console.log(JSON.stringify(rows, null, 1));
else for (const r of rows) if (r.lineMissing.length || r.webMissing.length) console.log(`FAIL ${r.id} ${r.cat} LINE[${r.lineSelected}] 缺 ${r.lineMissing.join(' | ') || '—'} ／ WEB 缺 ${r.webMissing.join(' | ') || '—'}`);
console.log(`agent-kb 60 題覆蓋：LINE ${linePass}/${qs.length}、官網 ${webPass}/${qs.length}（門檻 ${min}）`);
if (linePass < min || webPass < min) process.exit(1);
