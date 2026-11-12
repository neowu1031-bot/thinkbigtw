// Turn a stored submission into Markdown for the internal team.

function optLabel(def, value) {
  const o = (def.options || []).find((x) => x.value === value);
  return o ? o.label : value;
}

function leafText(def, val) {
  if (val == null) return '（未回答）';
  if (def.type === 'single' || def.type === 'multi') {
    const vs = Array.isArray(val.v) ? val.v : val.v ? [val.v] : [];
    const parts = vs.map((v) => optLabel(def, v));
    if (val.o) parts.push(`補充：${val.o}`);
    return parts.length ? parts.join('；') : '（未回答）';
  }
  return String(val);
}

export function submissionToMarkdown(cfg, rec) {
  const c = cfg.content || {};
  const groups = new Map((c.groups || []).map((g) => [g.id, g.title]));
  const lines = [];
  lines.push(`# ${c.title || '需求確認'}（${cfg.label || ''}）`);
  lines.push('');
  lines.push(`- 第 ${rec.n} 次送出：${rec.submittedAt}`);
  lines.push(`- 內容摘要碼：${rec.digest}`);
  lines.push('');
  let lastGroup = null;
  (c.questions || []).forEach((q, i) => {
    if (q.group !== lastGroup) {
      lastGroup = q.group;
      lines.push(`## ${groups.get(q.group) || q.group || ''}`);
      lines.push('');
    }
    lines.push(`### ${i + 1}. ${q.title}`);
    const a = rec.answers?.[q.id];
    if (q.type === 'fields') {
      if (a == null) lines.push('（未回答）');
      else for (const f of q.fields || []) lines.push(`- ${f.label}：${leafText(f, a[f.id])}`);
    } else {
      lines.push(leafText(q, a));
    }
    lines.push('');
  });
  lines.push('## 其他想說的');
  lines.push(rec.note || '（無）');
  lines.push('');
  return lines.join('\n');
}
