/* Reuses the existing endpoint. Loading/opening this UI never sends a request.
   Quick questions are explicitly local FAQ answers; only free text calls AI. */
(function () {
  'use strict';
  if (document.getElementById('tb-ai-launcher')) return;
  const endpoint = 'https://moneyradar-ai-proxy.thinkbigtw.workers.dev/thinkbig-chat';
  const localAnswers = {
    start: ['我該從哪個部門開始？', '先選一件重複頻率高、規則清楚，而且有人可以確認結果的工作。像是整理行銷草稿、客服回覆或業務追蹤。可到企業頁的需求整理，把流程、部門／職位與導入規劃帶給我們。'],
    privacy: ['資料會離開公司嗎？', '地端方案把工作資料與執行環境放在你的公司設備。若選用雲端模型或 LINE 等外部服務，相關請求仍會送出。需要資料不出公司時，要一起確認本機模型與外連限制。詳見資安承諾頁。'],
    support: ['導入之後，誰來維護？', '企業導入包含一年陪跑維護，依合約範圍進行問題追蹤、維護檢查與使用調整。服務窗口、範圍與新增需求的處理方式會在開始前確認。']
  };
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = '/assets/brand/assistant.css'; document.head.appendChild(css);
  const launcher = document.createElement('button');
  launcher.id = 'tb-ai-launcher'; launcher.type = 'button'; launcher.textContent = '問問 AI 助理';
  launcher.setAttribute('aria-haspopup', 'dialog'); launcher.setAttribute('aria-controls', 'tb-ai-dialog');
  const dialog = document.createElement('dialog'); dialog.id = 'tb-ai-dialog';
  dialog.setAttribute('aria-labelledby', 'tb-ai-title');
  dialog.innerHTML = '<div class="ai-header"><h2 id="tb-ai-title">Hermes｜TB 的 AI 助理</h2><button class="ai-close" type="button" aria-label="關閉 AI 助理">關閉</button></div><p class="ai-intro">常見問題可直接查看；自由提問會送至外部 AI 服務。請勿提供機密或個資，回答供初步參考。</p><div class="ai-log" role="log" aria-live="polite" aria-label="對話紀錄"></div><form class="ai-form"><label for="tb-ai-input">想了解什麼？</label><textarea id="tb-ai-input" rows="2" maxlength="1200" placeholder="例如：想讓 AI 整理內部工作清單" required></textarea><button type="submit">送出提問</button><p id="tb-ai-status" role="status"></p><div class="ai-help"><a href="/enterprise/#faq">閱讀常見問題</a><a href="/trust/">資安承諾</a><a href="https://lin.ee/n5KW430" target="_blank" rel="noopener noreferrer">找 LINE 專人 ↗</a></div></form>';
  document.body.append(launcher, dialog);
  const log = dialog.querySelector('.ai-log');
  const form = dialog.querySelector('form');
  const input = dialog.querySelector('textarea');
  const send = form.querySelector('button');
  const status = document.getElementById('tb-ai-status');
  let history = [], loading = false, opener = launcher, controller;
  function message(role, text, label) {
    const item = document.createElement('div'); item.className = 'ai-message'; item.dataset.role = role;
    const name = document.createElement('strong'); name.textContent = label || (role === 'user' ? '你' : 'AI 助理');
    const body = document.createElement('span'); body.textContent = text;
    item.append(name, body); log.appendChild(item); log.scrollTop = log.scrollHeight;
  }
  function open(source) {
    if (!dialog.open) { opener = source || launcher; dialog.showModal(); }
    if (!log.childElementCount) message('assistant', '你好，我是 Hermes。你可以問企業導入、地端資料處理或一年陪跑維護。', '歡迎訊息');
    input.focus();
  }
  launcher.addEventListener('click', function () { open(launcher); });
  dialog.querySelector('.ai-close').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('close', function () { if (controller) controller.abort(); opener.focus(); });
  document.addEventListener('click', function (event) {
    const button = event.target.closest('[data-ai-question]');
    if (!button) return;
    const answer = localAnswers[button.dataset.aiQuestion];
    if (!answer) return;
    open(button); message('user', answer[0]); message('assistant', answer[1], '網站常見問題・非即時生成');
  });
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    const text = input.value.trim();
    if (loading || !text) return;
    loading = true; send.disabled = true; input.value = '';
    message('user', text); status.textContent = 'AI 正在整理回覆…';
    controller = new AbortController();
    const timeout = setTimeout(function () { controller.abort(); }, 25000);
    const pending = history.concat({role: 'user', content: text});
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({messages: pending}), signal: controller.signal });
      if (!response.ok) throw new Error('request failed');
      const data = await response.json();
      if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('empty reply');
      message('assistant', data.reply); history = pending.concat({role: 'assistant', content: data.reply}).slice(-18);
      status.textContent = '企業費用、範圍與進度，以專人確認內容為準。';
    } catch (_) {
      status.textContent = '目前無法取得回覆，請稍後重試，或改看常見問題／聯絡 LINE 專人。';
      input.value = text;
    } finally {
      clearTimeout(timeout); controller = null; loading = false; send.disabled = false;
      if (dialog.open) input.focus();
    }
  });
  // Compatibility for retained public pages with old triggers.
  window.toggleChat = function () { if (dialog.open) dialog.close(); else open(document.activeElement); };
  window.askQuick = function (text) { open(document.activeElement); input.value = text; };
})();
