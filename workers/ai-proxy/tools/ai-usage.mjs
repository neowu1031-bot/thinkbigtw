#!/usr/bin/env node
// Workers AI 當日用量查詢（AEGIS D4-20261113 C2：給 70%／90% 額度告警用）。0-Token，不呼叫任何模型。
//
// 用法：
//   node tools/ai-usage.mjs                       # 預設只印出要送的 GraphQL 查詢，不連網（尚未核准接雲端前就用這個）
//   node tools/ai-usage.mjs --fixture resp.json   # 用存好的 GraphQL 回應離線計算（測試用）
//   CF_API_TOKEN=… CF_ACCOUNT_ID=… node tools/ai-usage.mjs --live [--date 2026-11-13] [--limit 10000]
// 輸出一行 JSON：{date, neurons, limit, pct, level, by_model}。結束碼：0 正常、1 ≥70%、2 ≥90%、3 查詢失敗。
//
// 待核准（上線前由 GM／VAULT 決定，FORGE 未接雲端、未建 token、未排程）：
//   1. 專用唯讀 token：只給 Account Analytics:Read（不要用 wrangler 全權登入），放憑證庫。
//   2. 欄位：viewer.accounts.aiInferenceAdaptiveGroups 的 sum.totalNeurons、dimensions.date、dimensions.modelId。
//      2026-11-13 FORGE 用 wrangler 登入唯讀查過一次可用；但 totalNeurons 是否與帳單上的 neurons 完全一致，官方文件未寫，
//      上線第一週要和 Cloudflare 後台 Workers AI 用量頁對一次。
//   3. 日界：免費額度每天 00:00 UTC（台灣 08:00）重置，所以 date 用 UTC 日期。
//   4. 告警通道與頻率（建議每小時一次、同級別一天只發一次）。
// 同帳號其他 Worker（例如 moneyradar 端點）的 Workers AI 用量也算在同一份免費額度裡，這支查的是全帳號總量。

export const FREE_DAILY_NEURONS = 10000;
export const WARN_PCT = 70;
export const CRIT_PCT = 90;

export function utcDate(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function buildQuery(accountTag, date) {
  if (!/^[0-9a-f]{32}$/.test(accountTag || '')) throw new Error('bad_account_id');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error('bad_date');
  return {
    query: `query($a:String!,$d:Date!){viewer{accounts(filter:{accountTag:$a}){
  aiInferenceAdaptiveGroups(limit:100, filter:{date_geq:$d, date_leq:$d}){ sum{ totalNeurons } dimensions{ date modelId } }
}}}`,
    variables: { a: accountTag, d: date },
  };
}

export function summarize(resp, { date, limit = FREE_DAILY_NEURONS } = {}) {
  if (resp?.errors?.length) throw new Error('graphql_error');
  const accounts = resp?.data?.viewer?.accounts;
  if (!Array.isArray(accounts) || accounts.length !== 1) throw new Error('unexpected_shape');
  const groups = accounts[0]?.aiInferenceAdaptiveGroups;
  if (!Array.isArray(groups)) throw new Error('unexpected_shape');
  const byModel = {};
  let neurons = 0;
  for (const g of groups) {
    if (date && g?.dimensions?.date && g.dimensions.date !== date) continue;
    const n = Number(g?.sum?.totalNeurons);
    if (!Number.isFinite(n) || n < 0) throw new Error('unexpected_shape');
    const model = String(g?.dimensions?.modelId || 'unknown');
    byModel[model] = Math.round((byModel[model] || 0) + n);
    neurons += n;
  }
  neurons = Math.round(neurons);
  const pct = Math.round((neurons / limit) * 1000) / 10;
  const level = pct >= CRIT_PCT ? 'critical' : pct >= WARN_PCT ? 'warn' : 'ok';
  return { date, neurons, limit, pct, level, by_model: byModel };
}

export function exitCode(level) {
  return level === 'critical' ? 2 : level === 'warn' ? 1 : 0;
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const date = arg('--date') || utcDate();
  const limit = Number(arg('--limit') || FREE_DAILY_NEURONS);
  try {
    if (arg('--fixture')) {
      const { readFileSync } = await import('node:fs');
      const out = summarize(JSON.parse(readFileSync(arg('--fixture'), 'utf8')), { date, limit });
      console.log(JSON.stringify(out));
      return exitCode(out.level);
    }
    if (!process.argv.includes('--live')) {
      const q = buildQuery(process.env.CF_ACCOUNT_ID || '0'.repeat(32), date);
      console.log(JSON.stringify({ dry_run: true, note: '未連網；加 --live 才會查詢（需核准的唯讀 token）', ...q }));
      return 0;
    }
    const token = process.env.CF_API_TOKEN;
    if (!token) throw new Error('missing_token');
    const body = JSON.stringify(buildQuery(process.env.CF_ACCOUNT_ID, date));
    const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST', signal: AbortSignal.timeout(20000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body,
    });
    if (!res.ok) throw new Error(`http_${res.status}`);
    const out = summarize(await res.json(), { date, limit });
    console.log(JSON.stringify(out));
    return exitCode(out.level);
  } catch (err) {
    console.log(JSON.stringify({ date, error: String(err?.message || err).slice(0, 60) }));
    return 3;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(code => process.exit(code));
}
