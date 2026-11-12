// Notify the internal inbox that a client submitted. The mail carries NO answers:
// only the internal label, submission number, time and how to retrieve it.

function encodeHeader(s) {
  const b = new TextEncoder().encode(s);
  let bin = '';
  b.forEach((x) => { bin += String.fromCharCode(x); });
  return `=?UTF-8?B?${btoa(bin)}?=`;
}

function b64Body(s) {
  const b = new TextEncoder().encode(s);
  let bin = '';
  b.forEach((x) => { bin += String.fromCharCode(x); });
  return btoa(bin).replace(/.{1,76}/g, '$&\r\n');
}

// No links and no retrieval commands in the mail: the answers are read by the team
// from the backend (see docs/README.md). The slug is not included either.
export function buildNotice(env, cfg, slug, rec) {
  const subject = `[需求確認頁] ${cfg.label || 'client'} 已送出（第 ${rec.seq} 次）`;
  const text = [
    `${cfg.label || 'client'} 已在需求確認頁送出答案。`,
    '',
    '答案已安全存好，由 GM 用後台指令取回，不用點任何連結。',
    '',
    `送出編號：${rec.id}`,
    `第 ${rec.seq} 次送出（上限 ${cfg.maxSubmissions || 5} 次）`,
    `時間：${rec.submittedAt}`,
  ].join('\n');
  return { subject, text };
}

export function buildRawMime({ from, to, subject, text, messageId }) {
  return [
    `From: Think BIG intake <${from}>`,
    `To: ${to}`,
    `Subject: ${encodeHeader(subject)}`,
    `Message-ID: <${messageId}>`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    b64Body(text),
  ].join('\r\n');
}

// Returns 'sent' | 'skipped' | 'failed'. Never throws.
export async function notify(env, cfg, slug, rec) {
  if (!env.NOTIFY_EMAIL) return 'skipped';
  try {
    const { EmailMessage } = await import('cloudflare:email');
    const { subject, text } = buildNotice(env, cfg, slug, rec);
    const from = env.NOTIFY_FROM || 'intake-noreply@thinkbigtw.com';
    const to = env.NOTIFY_TO || 'AI@thinkbigtw.com';
    const messageId = `${crypto.randomUUID()}@thinkbigtw.com`;
    const raw = buildRawMime({ from, to, subject, text, messageId });
    await env.NOTIFY_EMAIL.send(new EmailMessage(from, to, raw));
    return 'sent';
  } catch (e) {
    console.error('intake notify failed', e && e.message);
    return 'failed';
  }
}
