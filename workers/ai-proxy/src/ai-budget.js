// Workers AI 每日 neurons 硬上限（NEO 2026-11-13：「不要超過額度」）。
//
// 帳號是 Workers Paid：超過每天 10,000 neurons 的免費額度會照量計費，Cloudflare 本身沒有花費上限。
// 這支 Worker 的每一個 AI 呼叫（官網 AI 顧問、摘要、LINE 客服、AI 實戰體驗、股市網站約 25 處）都經過
// withAiBudget() 包過的 env.AI：呼叫前先向 Durable Object 預扣估計值，超過 9,000（留 10% 緩衝）就不呼叫模型、
// 直接丟 ai_budget_exceeded，由各呼叫端既有的降級流程接手（官網引導 LINE、LINE 附 ai@ 信箱、摘要寫無法生成）。
// 呼叫完成後用實際 neurons 校正。
//
// 計數按 UTC 日（免費額度 00:00 UTC＝台灣 08:00 重置）。只算這支 Worker；同帳號其他 Worker 或手動 REST 呼叫
// 也吃同一份免費額度，這裡看不到（用 tools/ai-usage.mjs 查全帳號）。
// 計數器或 DO 出錯時一律「不呼叫模型」（fail-closed）：寧可暫停 AI，也不冒超額計費。
export const DAILY_NEURON_CAP = 9000;
export const FREE_DAILY_NEURONS = 10000;
export const ALERT_LEVELS = [70, 90];   // 佔 DAILY_NEURON_CAP 的百分比，跨過時寫 ai_budget log 供告警

// 每個 token 的 neurons（由 Workers AI 模型目錄的美元價 ÷ $0.011／1,000 neurons 換算，2026-11-13）。
const RATES = {
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast': { in: 0.026636, out: 0.204818 },
  '@cf/mistralai/mistral-small-3.1-24b-instruct': { in: 0.031909, out: 0.050455 },
  '@cf/openai/gpt-oss-120b': { in: 0.031818, out: 0.068182 },
};
// 沒列在上面的模型（股市端點的 llama-3-8b 等）用偏高的保守值，寧可多扣。
const DEFAULT_RATE = { in: 0.05, out: 0.25 };
const DEFAULT_MAX_OUT = 256;   // Workers AI 文字模型 max_tokens 預設值

export function utcDay(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10);
}

function textOf(inputs) {
  if (!inputs || typeof inputs !== 'object') return String(inputs ?? '');
  if (Array.isArray(inputs.messages)) return inputs.messages.map(m => typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content ?? '')).join('\n');
  if (typeof inputs.prompt === 'string') return inputs.prompt;
  return JSON.stringify(inputs);
}
// 偏高估：中日韓字 1 字 1 token、其他 3 字元 1 token，再加 50 token 的模板開銷。
export function estimateInputTokens(inputs) {
  let n = 50;
  for (const ch of textOf(inputs)) n += ch.codePointAt(0) > 0x2e7f ? 1 : 1 / 3;
  return Math.ceil(n);
}
export function estimateNeurons(model, inputs) {
  const r = RATES[model] || DEFAULT_RATE;
  const maxOut = Number(inputs?.max_tokens) > 0 ? Number(inputs.max_tokens) : DEFAULT_MAX_OUT;
  return Math.ceil(estimateInputTokens(inputs) * r.in + maxOut * r.out);
}
// 實際用量：有 usage.neurons 就用；只有 token 數就照費率換算；都沒有（例如串流）就沿用預扣的估計值。
export function actualNeurons(model, result, estimate) {
  const u = result?.usage;
  if (u && Number.isFinite(Number(u.neurons))) return Math.ceil(Number(u.neurons));
  if (u && Number.isFinite(Number(u.prompt_tokens))) {
    const r = RATES[model] || DEFAULT_RATE;
    return Math.ceil(Number(u.prompt_tokens) * r.in + Number(u.completion_tokens || 0) * r.out);
  }
  return estimate;
}

export function crossedLevel(before, after, cap = DAILY_NEURON_CAP) {
  let hit = null;
  for (const pct of ALERT_LEVELS) if (before < cap * pct / 100 && after >= cap * pct / 100) hit = pct;
  return hit;
}

// ───────── Durable Object：單一實例（名稱固定）＝全 Worker 共用一份當日計數，請求依序處理所以不會搶寫 ─────────
export class AiBudget {
  constructor(state) { this.storage = state.storage; }
  async fetch(request) {
    let body;
    try { body = await request.json(); } catch { return Response.json({ error: 'bad_request' }, { status: 400 }); }
    const today = utcDay();
    let rec = (await this.storage.get('day')) || { date: today, used: 0 };
    if (rec.date !== today) rec = { date: today, used: 0 };
    const cap = Number(body.cap) > 0 ? Number(body.cap) : DAILY_NEURON_CAP;
    const before = rec.used;
    if (body.op === 'reserve') {
      const est = Math.max(0, Math.ceil(Number(body.est) || 0));
      if (rec.used + est > cap) return Response.json({ ok: false, date: rec.date, used: rec.used, cap });
      rec.used += est;
    } else if (body.op === 'settle') {
      if (body.date === rec.date) rec.used = Math.max(0, rec.used + Math.ceil(Number(body.delta) || 0));
    } else if (body.op !== 'peek') {
      return Response.json({ error: 'bad_op' }, { status: 400 });
    }
    if (rec.used !== before || !(await this.storage.get('day'))) await this.storage.put('day', rec);
    return Response.json({ ok: true, date: rec.date, used: rec.used, cap, crossed: crossedLevel(before, rec.used, cap) });
  }
}

// 同一個 isolate 當天已經被擋過，就不再問 DO（擋下狀態下灌請求也不會多花 DO 請求數）。
let exhaustedDay = null;
export function _resetBudgetCacheForTest() { exhaustedDay = null; }

async function budgetCall(env, payload) {
  const ns = env.AI_BUDGET;
  const stub = ns.get(ns.idFromName('global'));
  const res = await stub.fetch('https://ai-budget.internal/', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cap: DAILY_NEURON_CAP, ...payload }) });
  if (!res.ok) throw new Error('ai_budget_unavailable');
  return res.json();
}
function logLevel(r) {
  if (r?.crossed) console.log(JSON.stringify({ type: 'ai_budget', level: `warn${r.crossed}`, used: r.used, cap: r.cap, date: r.date, ts: new Date().toISOString() }));
}

export function guardAI(env) {
  const realAI = env.AI;
  return {
    async run(model, inputs, options) {
      const day = utcDay();
      if (exhaustedDay === day) throw new Error('ai_budget_exceeded');
      if (!env.AI_BUDGET) {
        console.log(JSON.stringify({ type: 'ai_budget_block', reason: 'binding_missing', model, ts: new Date().toISOString() }));
        throw new Error('ai_budget_unavailable');
      }
      const est = estimateNeurons(model, inputs);
      let r;
      try { r = await budgetCall(env, { op: 'reserve', est }); } catch {
        console.log(JSON.stringify({ type: 'ai_budget_block', reason: 'counter_error', model, ts: new Date().toISOString() }));
        throw new Error('ai_budget_unavailable');
      }
      if (!r.ok) {
        exhaustedDay = r.date;
        console.log(JSON.stringify({ type: 'ai_budget_block', reason: 'cap', model, est, used: r.used, cap: r.cap, date: r.date, ts: new Date().toISOString() }));
        throw new Error('ai_budget_exceeded');
      }
      logLevel(r);
      let result;
      try {
        result = await realAI.run(model, inputs, options);
      } catch (err) {
        // 失敗的呼叫是否計費不確定：保留預扣值（寧可多算）。
        throw err;
      }
      const delta = actualNeurons(model, result, est) - est;
      if (delta !== 0) {
        try { logLevel(await budgetCall(env, { op: 'settle', date: r.date, delta })); } catch { /* 保留預扣值 */ }
      }
      return result;
    },
  };
}

// 包一層 env：只換掉 AI，其餘 binding 透過原型照舊取用。
export function withAiBudget(env) {
  if (!env || !env.AI) return env;
  return Object.create(env, { AI: { value: guardAI(env), enumerable: true } });
}
