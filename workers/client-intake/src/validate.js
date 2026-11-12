// Server-side validation of submitted answers against the client config.
// Nothing the browser sends is trusted: unknown questions, unknown options,
// over-long text and anything that looks like a credential are rejected.

export const LIMITS = {
  bodyBytes: 64 * 1024,
  text: 300,
  textarea: 2000,
  other: 300,
  note: 2000,
  multiMax: 20,
};

const TYPES = new Set(['single', 'multi', 'text', 'textarea', 'fields']);

// Patterns for secrets people sometimes paste by accident. Kept specific to
// avoid false alarms on phone numbers, AnyDesk IDs, prices and dates.
const SECRET_PATTERNS = [
  { id: 'private_key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { id: 'aws_key', re: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { id: 'google_api_key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { id: 'anthropic_key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  { id: 'openai_key', re: /\bsk-(proj-|svcacct-)?[A-Za-z0-9_-]{20,}/ },
  { id: 'github_token', re: /\b(ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{30,}/ },
  { id: 'slack_token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  { id: 'stripe_key', re: /\b(sk|rk)_(live|test)_[A-Za-z0-9]{16,}/ },
  { id: 'telegram_bot_token', re: /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/ },
  { id: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  // Chinese keywords may run straight into the value ("密碼abc12345"); English ones need a word
  // boundary so words like "passport" do not trip it. The value must contain ASCII letters/digits
  // (text is NFKC-normalised first, so full-width characters count), which keeps ordinary
  // sentences such as "密碼我現場輸入" from being flagged.
  { id: 'password_label', re: /(密碼|密码|口令|驗證碼|验证码|登入碼|開機碼|解鎖碼)\s*(是|為|为|:|=|-)?\s*[A-Za-z0-9!@#$%^&*()_+=.?~-]{4,}/i },
  { id: 'password_label_en', re: /\b(password|passwd|passcode|pass|pwd|pw|pin)\b\s*(is|:|=|-)?\s*[A-Za-z0-9!@#$%^&*()_+=.?~-]{4,}/i },
  { id: 'long_secret', re: /\b[A-Za-z0-9+/_-]{48,}={0,2}\b/ },
];

function luhn(digits) {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

export function findSecret(raw) {
  if (typeof raw !== 'string' || !raw) return null;
  const text = raw.normalize('NFKC');
  for (const p of SECRET_PATTERNS) if (p.re.test(text)) return p.id;
  // Card numbers: 13-19 digits, optional spaces/dashes, Luhn-valid.
  const cards = text.match(/\b(?:\d[ -]?){12,18}\d\b/g) || [];
  for (const c of cards) {
    const d = c.replace(/[ -]/g, '');
    if (d.length >= 13 && d.length <= 19 && luhn(d)) return 'card_number';
  }
  return null;
}

function cleanText(v, max) {
  if (v == null) return { ok: true, value: '' };
  if (typeof v !== 'string') return { ok: false, reason: 'type' };
  // Strip control chars except newline/tab; normalise newlines.
  const s = v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (s.length > max) return { ok: false, reason: 'too_long' };
  return { ok: true, value: s };
}

function validateChoice(def, val, multi) {
  const options = Array.isArray(def.options) ? def.options : [];
  const allowed = new Map(options.map((o) => [o.value, o]));
  if (val == null) return { ok: true, value: null };
  if (typeof val !== 'object' || Array.isArray(val)) return { ok: false, reason: 'type' };
  let v = val.v;
  if (multi) {
    if (v == null) v = [];
    if (!Array.isArray(v) || v.length > LIMITS.multiMax) return { ok: false, reason: 'type' };
    const uniq = [...new Set(v)];
    if (!uniq.every((x) => typeof x === 'string' && allowed.has(x))) return { ok: false, reason: 'option' };
    v = uniq;
  } else if (v != null) {
    if (typeof v !== 'string' || !allowed.has(v)) return { ok: false, reason: 'option' };
  }
  const o = cleanText(val.o, LIMITS.other);
  if (!o.ok) return o;
  const picked = multi ? v : (v ? [v] : []);
  const wantsOther = picked.some((x) => allowed.get(x)?.other);
  const out = { v: multi ? v : (v || null) };
  if (wantsOther && o.value) out.o = o.value;
  if ((multi ? v.length === 0 : !v) && !out.o) return { ok: true, value: null };
  return { ok: true, value: out };
}

function validateLeaf(def, val) {
  switch (def.type) {
    case 'single': return validateChoice(def, val, false);
    case 'multi': return validateChoice(def, val, true);
    case 'text': {
      const r = cleanText(val, Math.min(def.maxLength || LIMITS.text, LIMITS.text));
      if (!r.ok) return r;
      // Optional per-field format, e.g. an AnyDesk ID field that only accepts digits,
      // so a password typed next to the ID is rejected instead of stored.
      if (r.value && def.pattern && !new RegExp(def.pattern).test(r.value.normalize('NFKC'))) return { ok: false, reason: 'pattern' };
      return { ok: true, value: r.value || null };
    }
    case 'textarea': {
      const r = cleanText(val, Math.min(def.maxLength || LIMITS.textarea, LIMITS.textarea));
      return r.ok ? { ok: true, value: r.value || null } : r;
    }
    default: return { ok: false, reason: 'type' };
  }
}

function collectStrings(v, out) {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => collectStrings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => collectStrings(x, out));
  return out;
}

// Returns { ok, answers, note, errors: [{q, field?, reason}] }.
export function validateSubmission(content, body) {
  const errors = [];
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, errors: [{ reason: 'body' }] };
  const input = body.answers;
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, errors: [{ reason: 'answers' }] };
  const qs = Array.isArray(content?.questions) ? content.questions : [];
  const known = new Set(qs.map((q) => q.id));
  for (const k of Object.keys(input)) if (!known.has(k)) errors.push({ q: k, reason: 'unknown_question' });

  const answers = {};
  for (const q of qs) {
    if (!TYPES.has(q.type)) { errors.push({ q: q.id, reason: 'bad_config' }); continue; }
    const raw = input[q.id];
    if (q.type === 'fields') {
      if (raw == null) { answers[q.id] = null; continue; }
      if (typeof raw !== 'object' || Array.isArray(raw)) { errors.push({ q: q.id, reason: 'type' }); continue; }
      const fdefs = Array.isArray(q.fields) ? q.fields : [];
      const fknown = new Set(fdefs.map((f) => f.id));
      for (const k of Object.keys(raw)) if (!fknown.has(k)) errors.push({ q: q.id, field: k, reason: 'unknown_field' });
      const obj = {};
      let any = false;
      for (const f of fdefs) {
        const r = validateLeaf(f, raw[f.id]);
        if (!r.ok) { errors.push({ q: q.id, field: f.id, reason: r.reason }); continue; }
        obj[f.id] = r.value;
        if (r.value != null) any = true;
      }
      answers[q.id] = any ? obj : null;
    } else {
      const r = validateLeaf(q, raw);
      if (!r.ok) { errors.push({ q: q.id, reason: r.reason }); continue; }
      answers[q.id] = r.value;
    }
    if (q.required && answers[q.id] == null) errors.push({ q: q.id, reason: 'required' });
  }

  const n = cleanText(body.note, LIMITS.note);
  if (!n.ok) errors.push({ q: '_note', reason: n.reason });

  if (errors.length) return { ok: false, errors };

  // Credential scan over every free-text value.
  for (const q of qs) {
    for (const str of collectStrings(answers[q.id], [])) {
      const hit = findSecret(str);
      if (hit) errors.push({ q: q.id, reason: 'looks_like_secret', kind: hit });
    }
  }
  const noteHit = findSecret(n.value);
  if (noteHit) errors.push({ q: '_note', reason: 'looks_like_secret', kind: noteHit });
  if (errors.length) return { ok: false, errors };

  return { ok: true, answers, note: n.value || null, errors: [] };
}
