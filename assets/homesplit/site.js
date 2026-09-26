(function () {
  'use strict';
  const form = document.getElementById('consult-form');
  if (!form) return;
  const status = document.getElementById('brief-status');
  const output = document.getElementById('brief-output');
  const preview = document.getElementById('brief-text');
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    const data = new FormData(form);
    const flows = data.getAll('workflow');
    if (!data.get('role').trim()) {
      status.textContent = '請填寫部門或職位。';
      form.querySelector('[name="role"]').focus();
      output.hidden = true;
      return;
    }
    if (!flows.length) {
      status.textContent = '請至少選一個想改善的流程，也可以選「其他流程」。';
      form.querySelector('[name="workflow"]').focus();
      output.hidden = true;
      return;
    }
    preview.textContent = ['企業 AI Agent 導入諮詢', '部門／職位：' + data.get('role').trim(), '想用在哪些流程：' + flows.join('、'), '導入規劃：' + data.get('timing'), '優先改善目標：' + (data.get('need').trim() || '於諮詢時進一步確認')].join('\n');
    output.hidden = false;
    status.textContent = '摘要已產生，尚未送出。請複製後到 LINE 貼上，確認內容再傳送。';
  });
  form.addEventListener('input', function () {
    if (!output.hidden) {
      output.hidden = true;
      status.textContent = '內容已修改，請重新產生摘要。';
    }
  });
  form.querySelector('[type="submit"]').disabled = false;
  document.getElementById('copy-brief').addEventListener('click', async function () {
    try {
      await navigator.clipboard.writeText(preview.textContent);
      status.textContent = '已複製。到 LINE 貼上並確認後，即可送出。';
    } catch (_) {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(preview);
      selection.removeAllRanges();
      selection.addRange(range);
      status.textContent = '瀏覽器無法自動複製，已選取摘要，請使用複製指令。';
    }
  });
})();
