import { chapters } from './agent-kb.generated.js';

const ORIGIN = 'https://thinkbigtw.com';
const LINE = 'https://lin.ee/n5KW430';
const headers = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Vary': 'Origin',
  'Cache-Control': 'no-store',
  'Content-Type': 'application/json; charset=utf-8',
};
const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), { status, headers: { ...headers, ...extra } });
export const estimateTokens = text => Math.ceil(Array.from(text).reduce((n, c) => n + (c.codePointAt(0) > 127 ? 2 : 1 / 3), 0));
const TOPICS = {
  '02': /公司|Think\s*BIG|地址|聯絡窗口|統編|介紹|你們是/i,
  '03': /開始|適合|個人|企業|自評|規模|分流|一人公司/,
  '04': /交付|驗收|階段|流程|維護|維運|陪跑|TB|FRAME|READINESS|DELIVERY|CONTINUITY/i,
  '05': /部門|客服|業務|行銷|財務|能力|能做|自動|付款|發送/,
  '06': /資料|地端|雲端|安全|機密|資安|權限|部署|外傳|本機/,
  '07': /個人|價格|多少|費用|年約|續約|方案|技能|999|6000|支援|修復|48/,
  '08': /未知|不懂|不知|訂購|USB|設備|能否|可以|支援/,
  '09': /諮詢|聯絡|摘要|刪除|保存|同意|顧問|預約|收件|送出/,
};
export function selectKnowledge(messages) {
  const latest = messages.at(-1).content;
  const earlier = messages.filter(x => x.role === 'user').slice(-3, -1).map(x => x.content).join('\n');
  const required = chapters.filter(c => ['01', '10'].includes(c.id));
  const ranked = chapters.filter(c => TOPICS[c.id]).map(c => ({ c, score: (TOPICS[c.id].test(latest) ? 10 : 0) + (TOPICS[c.id].test(earlier) ? 1 : 0) }))
    .sort((a, b) => b.score - a.score || a.c.id.localeCompare(b.c.id));
  let text = required.map(c => c.text).join('\n\n');
  const selected = required.map(c => c.id);
  for (const { c, score } of ranked) {
    if (score === 0 && selected.length > 2) continue;
    const next = text + '\n\n' + c.text;
    if (estimateTokens(next) <= 2850) { text = next; selected.push(c.id); }
    if (selected.length >= 4) break;
  }
  return { text, selected, estimatedTokens: estimateTokens(text) };
}
export function trimHistory(messages) {
  const kept = []; let tokens = 0, bytes = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const cost = estimateTokens(messages[i].content) + 8;
    const byteCost = new TextEncoder().encode(messages[i].content).byteLength + 8;
    if (kept.length && (tokens + cost > 2500 || bytes + byteCost > 4000)) break;
    kept.unshift({ role: messages[i].role, content: messages[i].content }); tokens += cost; bytes += byteCost;
  }
  while (kept.length > 1 && kept[0].role !== 'user') kept.shift();
  return kept;
}
async function readJSON(stream, limit = 18000) {
  if (!stream) throw new Error('invalid_json');
  const reader = stream.getReader(); const chunks = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error('too_large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error('invalid_json'); }
}
async function deadline(promise, ms) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms); })]); }
  finally { clearTimeout(timer); }
}
async function chat(body, env) {
  const messages = body?.messages;
  if (!Array.isArray(messages) || !messages.length || messages.length > 20 || messages.at(-1)?.role !== 'user' ||
      messages.some(m => !m || !['user', 'assistant'].includes(m.role) || typeof m.content !== 'string' || !m.content.trim() || m.content.length > 1200)) {
    return json({ error: 'invalid_messages' }, 400);
  }
  const knowledge = selectKnowledge(messages);
  const context = [{ role: 'system', content: knowledge.text }, ...trimHistory(messages)];
  let reply = ''; let model = '';
  if (env.MINIMAX_API_KEY) {
    try {
      const response = await fetch('https://api.minimax.io/v1/text/chatcompletion_v2', {
        method: 'POST', signal: AbortSignal.timeout(8000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.MINIMAX_API_KEY}` },
        body: JSON.stringify({ model: 'MiniMax-M2', messages: context, max_tokens: 600, temperature: 0.2 }),
      });
      if (response.ok) {
        const data = await readJSON(response.body, 50000);
        if (data.base_resp?.status_code === 0) reply = cleanReply(data.choices?.[0]?.message?.content);
        model = 'MiniMax-M2';
      } else await response.body?.cancel();
    } catch { /* Fall back without logging the prompt or upstream response. */ }
  }
  for (const candidate of ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3-8b-instruct']) {
    if (reply) break;
    try {
      const result = await deadline(env.AI.run(candidate, { messages: context, max_tokens: 600, temperature: 0.2 }), 10000);
      reply = cleanReply(result?.response); model = candidate;
    } catch { /* Try the next configured model; no transcript persistence. */ }
  }
  if (!reply) return json({ error: 'ai_unavailable', fallback: LINE }, 503);
  // Receipt claims must come exclusively from the confirmed database write, never a model.
  if (/已.{0,8}(送出|轉交|提交|轉給|收件|預約)|顧問會主動/.test(reply)) {
    reply = '如需顧問聯繫，請點「整理諮詢摘要」，核對需求及聯絡方式後再確認送出。是否收件以介面顯示的送出結果為準。';
  }
  const inquirySuggested = /諮詢|聯絡我|聯繫我|找顧問|預約|想導入|想了解報價/.test(messages.at(-1).content);
  return json({ reply, model, inquirySuggested });
}
function cleanReply(value) {
  return typeof value === 'string' ? value.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '').trim().slice(0, 3000) : '';
}
const FIELD_LIMITS = { name: 80, organization: 120, need: 1200, scale: 120, contact: 254 };
export function validateInquiry(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('invalid_inquiry');
  const allowed = ['id', 'consent', 'contactMethod', ...Object.keys(FIELD_LIMITS)];
  if (Object.keys(body).some(k => !allowed.includes(k)) || body.consent !== true ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id || '')) throw new Error('invalid_inquiry');
  const result = { id: body.id.toLowerCase(), contactMethod: body.contactMethod };
  for (const [key, max] of Object.entries(FIELD_LIMITS)) {
    if (typeof body[key] !== 'string' || body[key].length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(body[key])) throw new Error('invalid_inquiry');
    result[key] = body[key].trim();
    if (key !== 'organization' && !result[key]) throw new Error('invalid_inquiry');
  }
  if (body.contactMethod === 'email') {
    if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(result.contact)) throw new Error('invalid_contact');
    result.contact = result.contact.toLowerCase();
  } else if (body.contactMethod === 'phone') {
    result.contact = result.contact.replace(/[\s()-]/g, '');
    if (!/^\+?\d{8,15}$/.test(result.contact)) throw new Error('invalid_contact');
  } else if (body.contactMethod === 'line') {
    if (!/^[a-zA-Z0-9._-]{2,64}$/.test(result.contact)) throw new Error('invalid_contact');
    result.contact = result.contact.toLowerCase();
  } else throw new Error('invalid_contact');
  return result;
}
async function inquiry(body, env) {
  let data;
  try { data = validateInquiry(body); } catch (error) { return json({ error: error.message }, 400); }
  if (!env.INQUIRY_SUPABASE_URL || !env.INQUIRY_SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'inquiry_unavailable', fallback: LINE }, 503);
  let url;
  try {
    url = new URL(env.INQUIRY_SUPABASE_URL);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error();
  } catch { return json({ error: 'inquiry_unavailable', fallback: LINE }, 503); }
  try {
    const response = await fetch(url.origin + '/rest/v1/rpc/submit_thinkbig_inquiry', {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json', apikey: env.INQUIRY_SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.INQUIRY_SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ p_id: data.id, p_name: data.name, p_organization: data.organization, p_need: data.need, p_scale: data.scale, p_contact_method: data.contactMethod, p_contact: data.contact }),
    });
    if (!response.ok) { await response.body?.cancel(); throw new Error('storage'); }
    const result = await readJSON(response.body, 2048);
    if (result === 'accepted' || result === 'duplicate') return json({ accepted: true });
    if (result === 'rate_limited') return json({ error: 'rate_limited', fallback: LINE }, 429, { 'Retry-After': '1800' });
    if (result === 'conflict') return json({ error: 'id_conflict', fallback: LINE }, 409);
    throw new Error('storage');
  } catch {
    console.error(JSON.stringify({ event: 'thinkbig_inquiry_write_failed' }));
    return json({ error: 'receipt_unconfirmed', fallback: LINE }, 503);
  }
}
export async function handleThinkBig(request, env) {
  const path = new URL(request.url).pathname;
  if (request.headers.get('Origin') !== ORIGIN) return json({ error: 'origin_denied' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({ error: 'json_required' }, 415);
  // Fail closed for these two endpoints; no request body, raw IP or rate key is stored/logged.
  if (!env.RATE_LIMITER) return json({ error: 'temporarily_unavailable' }, 503);
  try {
    const transient = `${path}:${new Date().toISOString().slice(0, 10)}:${request.headers.get('CF-Connecting-IP') || 'unknown'}`;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(transient));
    const key = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    if (!(await env.RATE_LIMITER.limit({ key })).success) return json({ error: 'rate_limited' }, 429, { 'Retry-After': '60' });
  } catch { return json({ error: 'temporarily_unavailable' }, 503); }
  let body;
  try { body = await readJSON(request.body, path === '/thinkbig-inquiry' ? 8000 : 80000); }
  catch (error) { return json({ error: error.message }, error.message === 'too_large' ? 413 : 400); }
  try { return path === '/thinkbig-inquiry' ? await inquiry(body, env) : await chat(body, env); }
  catch { return json({ error: 'temporarily_unavailable' }, 503); }
}
