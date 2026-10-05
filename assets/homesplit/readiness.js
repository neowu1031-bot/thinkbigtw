/* Local, deterministic readiness guidance. No telemetry, persistence or requests. */
(function (root) {
  'use strict';
  const allowed = [
    ['service', 'sales', 'marketing', 'finance', 'operations'],
    ['clear', 'partial', 'unclear'], ['ready', 'scattered', 'unknown'],
    ['owner', 'team', 'none'], ['local', 'approved', 'undecided'],
    ['defined', 'rough', 'explore']
  ];
  // i18n: detect page language; default to Chinese for any non-en page
  const isEn = typeof document !== 'undefined' && document.documentElement.lang === 'en';
  const i18n = {
    progress: isEn
      ? function (n) { return 'Step ' + n + ' of 6'; }
      : function (n) { return '第 ' + n + ' 題，共 6 題'; },
    progressDone: isEn ? 'All 6 steps completed' : '已完成 6 題',
    nextLabel: isEn ? 'Next →' : '下一題 →',
    submitLabel: isEn ? 'View assessment →' : '檢視評估建議 →',
    errorEmpty: isEn
      ? 'Please select the option that best fits your current situation.'
      : '請先選擇符合目前狀況的選項。',
    typeError: isEn
      ? 'Please complete all six steps and select a valid option.'
      : '請完成六題，並選擇有效選項。',
    departments: isEn
      ? { service: 'Customer service', sales: 'Sales', marketing: 'Marketing', finance: 'Finance', operations: 'Operations' }
      : { service: '客服', sales: '業務與客戶聯繫', marketing: '行銷', finance: '財務', operations: '維運與資安' },
    resultDept: isEn
      ? function (dept) { return 'Suggested priority function: ' + dept + '. Based on your business priorities.'; }
      : function (dept) { return '建議優先職能：' + dept + '。依業務優先需求選定。'; }
  };
  function assess(answers) {
    if (!Array.isArray(answers) || answers.length !== 6 || allowed.some((values, i) => !values.includes(answers[i]))) {
      throw new TypeError(i18n.typeError);
    }
    const departments = i18n.departments;
    const actions = [];
    if (answers[1] !== 'clear') actions.push('flow');
    if (answers[2] !== 'ready') actions.push('data');
    if (answers[3] !== 'owner') actions.push('owner');
    if (answers[4] === 'undecided') actions.push('boundary');
    if (answers[5] !== 'defined') actions.push('acceptance');
    const missingFoundation = answers[1] === 'unclear' || answers[2] === 'unknown' || answers[3] === 'none' || answers[4] === 'undecided';
    const stage = missingFoundation ? 'discovery' : actions.length ? 'prepare' : 'pilot';
    if (!actions.length) actions.push('sample');
    if (answers[4] === 'local') actions.push('local');
    else if (answers[4] === 'approved') actions.push('approved');
    return { department: departments[answers[0]], stage, actions };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { assess, allowed };
  if (!root.document) return;
  const box = document.getElementById('readiness');
  if (!box) return;
  const panels = Array.from(box.querySelectorAll('[data-question]'));
  const next = document.getElementById('quiz-next');
  const back = document.getElementById('quiz-back');
  const progress = document.getElementById('quiz-progress');
  const error = document.getElementById('quiz-error');
  const result = document.getElementById('quiz-result');
  const controls = document.getElementById('quiz-controls');
  let current = 0;
  const answers = Array(6).fill(null);
  function render(focus) {
    panels.forEach((panel, i) => { panel.hidden = i !== current; });
    progress.textContent = i18n.progress(current + 1);
    back.disabled = current === 0;
    next.textContent = current === 5 ? i18n.submitLabel : i18n.nextLabel;
    error.textContent = '';
    if (focus) { panels[current].querySelector('legend').tabIndex = -1; panels[current].querySelector('legend').focus(); }
  }
  box.addEventListener('change', event => {
    if (event.target.matches('input[type="radio"]')) {
      answers[Number(event.target.name.slice(1))] = event.target.value;
      error.textContent = '';
    }
  });
  back.addEventListener('click', () => { if (current > 0) { current--; render(true); } });
  next.addEventListener('click', () => {
    if (!answers[current]) {
      error.textContent = i18n.errorEmpty;
      panels[current].querySelector('input').focus(); return;
    }
    if (current < 5) { current++; render(true); return; }
    const recommendation = assess(answers);
    const stageCopy = document.querySelector('[data-result-stage="' + recommendation.stage + '"]');
    document.getElementById('result-title').textContent = stageCopy.querySelector('h4').textContent;
    document.getElementById('result-department').textContent = i18n.resultDept(recommendation.department);
    document.getElementById('result-stage').textContent = stageCopy.querySelector('p').textContent;
    box.querySelectorAll('[data-result-action]').forEach(li => {
      li.hidden = !recommendation.actions.includes(li.dataset.resultAction);
    });
    panels.forEach(panel => { panel.hidden = true; }); controls.hidden = true;
    progress.textContent = i18n.progressDone; result.hidden = false;
    document.getElementById('result-title').focus();
  });
  document.getElementById('quiz-reset').addEventListener('click', () => {
    answers.fill(null); box.querySelectorAll('input').forEach(input => { input.checked = false; });
    current = 0; result.hidden = true; controls.hidden = false; render(true);
  });
  // Browser form restoration must not silently keep a prior visitor's answers.
  box.querySelectorAll('input').forEach(input => { input.checked = false; });
  box.classList.add('quiz-enhanced'); controls.hidden = false; render(false);
})(typeof window === 'undefined' ? globalThis : window);
