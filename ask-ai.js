/* The chat and inquiry are separate flows. Contact fields never enter model context.
   Opening the panel or choosing a local FAQ makes no API request. */
(function () {
  'use strict';
  if (document.getElementById('tb-ai-launcher')) return;
  const endpoint = 'https://moneyradar-ai-proxy.thinkbigtw.workers.dev';
  const line = 'https://lin.ee/n5KW430';
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = '/assets/brand/assistant.css?v=a49c047'; document.head.appendChild(css);
  const arrow = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const launcher = document.createElement('button');
  launcher.id = 'tb-ai-launcher'; launcher.type = 'button';
  launcher.innerHTML = '<svg class="ai-mark" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 5.5h14v10H12l-4 3v-3H5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M9 10.5h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><span>AI 顧問</span>';
  launcher.setAttribute('aria-label', '開啟 Think BIG AI 顧問');
  launcher.setAttribute('aria-haspopup', 'dialog'); launcher.setAttribute('aria-controls', 'tb-ai-dialog'); launcher.setAttribute('aria-expanded', 'false');
  const dialog = document.createElement('dialog'); dialog.id = 'tb-ai-dialog'; dialog.setAttribute('aria-labelledby', 'tb-ai-title');
  dialog.innerHTML = '<div class="ai-sheet-handle" aria-hidden="true"></div><header class="ai-header"><div class="ai-identity"><img class="ai-avatar" src="/assets/brand/ai-avatar.png" width="40" height="40" alt="" aria-hidden="true"><div><h2 id="tb-ai-title">AI 顧問</h2><p>Think BIG AI 顧問</p></div></div><button class="ai-close" type="button" aria-label="關閉 AI 顧問"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></button></header><div class="ai-log" role="log" aria-live="polite" aria-relevant="additions" aria-label="對話紀錄" tabindex="0"></div><div class="ai-tools"><button type="button" class="ai-inquiry-open">整理諮詢摘要 <span aria-hidden="true">↗</span></button><a href="/privacy.html#ai-inquiry" target="_blank" rel="noopener">隱私說明</a></div><form class="ai-composer"><label class="ai-sr-only" for="tb-ai-input">輸入問題</label><div class="ai-input-row"><textarea id="tb-ai-input" rows="1" maxlength="1200" placeholder="想了解什麼？" enterkeyhint="send" required></textarea><button class="ai-send" type="submit" aria-label="送出問題">'+arrow+'</button></div><p class="ai-disclaimer">回覆由 AI 產生，請勿輸入密碼或機密</p><p class="ai-processing">自由提問使用外部 AI 服務</p><p id="tb-ai-status" role="status"></p></form>';
  document.body.append(launcher, dialog);
  const log = dialog.querySelector('.ai-log');
  const composer = dialog.querySelector('.ai-composer');
  const input = dialog.querySelector('#tb-ai-input');
  const send = dialog.querySelector('.ai-send');
  const status = dialog.querySelector('#tb-ai-status');
  const inquiryButton = dialog.querySelector('.ai-inquiry-open');
  let history = [], latestNeed = '', loading = false, opener = launcher, chatController, inquiryCard, inquirySent = false;
  const scroll = () => { log.scrollTop = log.scrollHeight; };
  function message(role, text, label) {
    const item = document.createElement('div'); item.className = 'ai-message'; item.dataset.role = role;
    const name = document.createElement('span'); name.className = 'ai-sr-only'; name.textContent = role === 'user' ? '你：' : 'AI 顧問：';
    const body = document.createElement('span'); body.textContent = text;
    item.append(name, body);
    if (label) { const note = document.createElement('small'); note.textContent = label; item.append(note); }
    log.append(item); scroll(); return item;
  }
  const chips = document.createElement('div'); chips.className = 'ai-chips'; chips.setAttribute('aria-label', '建議問題');
  function renderFAQs() {
    chips.replaceChildren();
    for (const item of window.TB_AGENT_FAQ || []) {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = item.question;
      button.addEventListener('click', () => localAnswer(item)); chips.append(button);
    }
  }
  const faqScript = document.createElement('script'); faqScript.src = '/assets/agent-faq.generated.js'; faqScript.onload = renderFAQs; document.head.append(faqScript);
  function localAnswer(item) {
    if (loading) return;
    message('user', item.question); message('assistant', item.answer, '官網常見問題');
    history = history.concat({ role: 'user', content: item.question }, { role: 'assistant', content: item.answer }).slice(-12);
  }
  function open(source) {
    if (!dialog.open) {
      opener = source || launcher; dialog.showModal(); launcher.setAttribute('aria-expanded', 'true'); launcher.hidden = true;
    }
    if (!log.childElementCount) {
      message('assistant', '你好，我是 Think BIG AI 顧問。想先了解企業導入，還是個人方案？');
      const note = document.createElement('p'); note.className = 'ai-start-note'; note.textContent = '從一個問題開始'; log.append(note, chips);
    }
    input.focus({ preventScroll: true }); scroll();
  }
  launcher.addEventListener('click', () => open(launcher));
  dialog.querySelector('.ai-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    if (chatController) chatController.abort();
    launcher.hidden = false; launcher.setAttribute('aria-expanded', 'false');
    if (opener?.isConnected) opener.focus({ preventScroll: true });
  });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const targets = Array.from(dialog.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')).filter(el => el.getClientRects().length && !el.closest('[hidden]'));
    const first = targets[0], last = targets.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-ai-question]'); if (!button) return;
    const id = { start: '03', privacy: '06', support: '04' }[button.dataset.aiQuestion];
    const item = (window.TB_AGENT_FAQ || []).find(x => x.id === id);
    open(button); if (item) localAnswer(item);
  });
  function resize() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 112) + 'px'; }
  input.addEventListener('input', resize);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229) { event.preventDefault(); composer.requestSubmit(); }
  });
  composer.addEventListener('submit', async event => {
    event.preventDefault(); const text = input.value.trim(); if (loading || !text) return;
    loading = true; send.disabled = true; input.value = ''; resize(); status.textContent = '';
    if (text.length > 12 && !/[^\s@]+@[^\s@]+|\+?\d[\d ()-]{7,}/.test(text)) latestNeed = text;
    message('user', text);
    const typing = document.createElement('div'); typing.className = 'ai-typing'; typing.setAttribute('role', 'status'); typing.setAttribute('aria-label', '正在整理回覆');
    typing.innerHTML = '<i></i><i></i><i></i>'; log.append(typing); scroll();
    chatController = new AbortController(); const timeout = setTimeout(() => chatController?.abort(), 40000);
    const pending = history.concat({ role: 'user', content: text });
    try {
      const response = await fetch(endpoint + '/thinkbig-chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: pending }), signal: chatController.signal });
      if (!response.ok) throw new Error();
      const data = await response.json(); if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error();
      typing.remove(); message('assistant', data.reply);
      history = pending.concat({ role: 'assistant', content: data.reply.slice(0, 1200) }).slice(-12);
      if (data.inquirySuggested && !inquirySent && !inquiryCard) offerInquiry();
    } catch (_) {
      status.replaceChildren(document.createTextNode('暫時無法取得回覆。請稍後再試，或 '), fallbackLink());
      if (!input.value) input.value = text; resize();
    } finally {
      clearTimeout(timeout); typing.remove(); chatController = null; loading = false; send.disabled = false;
      if (dialog.open && !inquiryCard) input.focus({ preventScroll: true });
    }
  });
  function fallbackLink() {
    const a = document.createElement('a'); a.href = line; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = '聯絡 LINE 顧問'; return a;
  }
  function offerInquiry() {
    const item = message('assistant', '可以先整理需求摘要，核對內容與聯絡方式後，再決定是否送出。');
    const button = document.createElement('button'); button.type = 'button'; button.className = 'ai-inline-action'; button.textContent = '整理諮詢摘要'; button.addEventListener('click', beginInquiry); item.append(button); scroll();
  }
  function beginInquiry() {
    if (inquirySent) return;
    if (inquiryCard) { inquiryCard.scrollIntoView({ block: 'nearest' }); inquiryCard.querySelector('input,button')?.focus(); return; }
    inquiryCard = document.createElement('section'); inquiryCard.className = 'ai-inquiry'; inquiryCard.setAttribute('aria-label', '諮詢需求摘要'); inquiryCard.setAttribute('aria-live', 'off');
    inquiryCard.innerHTML = '<h3>整理你的需求</h3><p>請將需求整理成摘要，確認下列欄位。這些欄位不會送給 AI。</p><form class="ai-inquiry-form"><label>稱呼<input name="name" autocomplete="name" maxlength="80" required></label><label>公司／產業（可略）<input name="organization" autocomplete="organization" maxlength="120"></label><label>想解決的問題<textarea name="need" rows="3" maxlength="1200" required></textarea></label><label>規模<input name="scale" placeholder="例如：使用部門、人數，或待確認" maxlength="120" required></label><label>偏好聯絡方式<select name="contactMethod"><option value="email">Email</option><option value="phone">電話</option><option value="line">LINE ID</option></select></label><label><span class="ai-contact-label">Email</span><input name="contact" type="email" autocomplete="email" maxlength="254" required></label><div class="ai-card-actions"><button type="button" class="ai-cancel">取消</button><button type="submit" class="ai-primary">預覽摘要</button></div></form><div class="ai-preview" hidden></div>';
    const form = inquiryCard.querySelector('form'); form.elements.need.value = latestNeed.slice(0, 1200);
    form.elements.scale.value = '待確認';
    form.elements.contactMethod.addEventListener('change', () => {
      const kind = form.elements.contactMethod.value, field = form.elements.contact;
      field.value = ''; field.type = kind === 'email' ? 'email' : kind === 'phone' ? 'tel' : 'text';
      field.autocomplete = kind === 'email' ? 'email' : kind === 'phone' ? 'tel' : 'off';
      field.pattern = kind === 'line' ? '[a-zA-Z0-9._-]{2,64}' : kind === 'phone' ? '[+0-9() -]{8,25}' : '.*';
      inquiryCard.querySelector('.ai-contact-label').textContent = { email: 'Email', phone: '電話', line: 'LINE ID（請開啟允許 ID 搜尋）' }[kind];
    });
    inquiryCard.querySelector('.ai-cancel').addEventListener('click', () => { inquiryCard.remove(); inquiryCard = null; input.focus(); });
    form.addEventListener('submit', event => { event.preventDefault(); previewInquiry(form); });
    log.append(inquiryCard); scroll(); form.elements.name.focus({ preventScroll: true });
  }
  inquiryButton.addEventListener('click', beginInquiry);
  function previewInquiry(form) {
    const card = inquiryCard, preview = card.querySelector('.ai-preview');
    const data = Object.fromEntries(new FormData(form));
    for (const key of Object.keys(data)) data[key] = data[key].trim();
    if (!data.name || !data.need || !data.scale || !data.contact) { form.reportValidity(); return; }
    data.id = crypto.randomUUID(); data.consent = true;
    form.hidden = true; preview.hidden = false;
    preview.innerHTML = '<h4 tabindex="-1">確認需求摘要</h4><dl></dl><p class="ai-retention">僅保存本卡摘要與單一聯絡方式，用於回覆本次諮詢，30 天後刪除。可寄信至 AI@thinkbigtw.com 請求提前刪除。聊天逐字稿不隨摘要保存。</p><label class="ai-consent"><input type="checkbox">我同意將以上摘要與聯絡資料交給 Think BIG 顧問聯繫。</label><div class="ai-card-actions"><button type="button" class="ai-edit">返回編輯</button><button type="button" class="ai-primary ai-confirm" disabled>確認送出</button></div><p class="ai-receipt" role="status"></p>';
    const labels = { name: '稱呼', organization: '公司／產業', need: '想解決的問題', scale: '規模', contactMethod: '聯絡方式', contact: '聯絡資料' };
    for (const [key, label] of Object.entries(labels)) {
      const term = document.createElement('dt'), value = document.createElement('dd'); term.textContent = label;
      value.textContent = key === 'contactMethod' ? { email: 'Email', phone: '電話', line: 'LINE ID' }[data[key]] : data[key] || '未填寫'; preview.querySelector('dl').append(term, value);
    }
    const consent = preview.querySelector('input'), confirm = preview.querySelector('.ai-confirm'), edit = preview.querySelector('.ai-edit'), receipt = preview.querySelector('.ai-receipt');
    let attempts = 0, submitting = false, exhausted = false;
    consent.addEventListener('change', () => { confirm.disabled = !consent.checked || submitting || exhausted; });
    edit.addEventListener('click', () => { preview.hidden = true; preview.replaceChildren(); form.hidden = false; form.elements.name.focus(); });
    confirm.addEventListener('click', async () => {
      if (!consent.checked || submitting || exhausted) return;
      attempts++; submitting = true; confirm.disabled = true; consent.disabled = true; edit.disabled = true;
      receipt.textContent = '正在送出…';
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(endpoint + '/thinkbig-inquiry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), signal: controller.signal });
        if (!response.ok) {
          if ([400, 403, 409, 429].includes(response.status)) exhausted = true;
          throw new Error(response.status === 429 ? 'rate' : 'failed');
        }
        const result = await response.json(); if (result.accepted !== true) throw new Error('failed');
        inquirySent = true; inquiryButton.disabled = true;
        card.replaceChildren(); const done = document.createElement('p'); done.setAttribute('role', 'status'); done.textContent = '已送出，顧問會主動與你聯繫'; card.append(done);
        form.reset(); for (const key of Object.keys(data)) delete data[key];
      } catch (error) {
        exhausted = exhausted || attempts >= 3;
        receipt.replaceChildren(document.createTextNode(error.message === 'rate' ? '送出次數較多，請稍後再試，或 ' : '尚未確認收件。'+(exhausted ? '請改用 ' : '可重試同一份摘要，或 ')), fallbackLink());
        confirm.textContent = exhausted ? '請使用 LINE 聯繫' : '重試送出（'+attempts+'/3）';
      } finally {
        clearTimeout(timer); submitting = false; confirm.disabled = exhausted || inquirySent; scroll();
      }
    });
    scroll(); preview.querySelector('h4').focus({ preventScroll: true });
  }
  // Resize the sheet above the virtual keyboard without changing document scroll.
  function viewport() {
    const view = window.visualViewport; if (!view) return;
    dialog.style.setProperty('--ai-viewport', view.height + 'px');
    dialog.style.setProperty('--ai-keyboard-inset', Math.max(0, window.innerHeight - view.height - view.offsetTop) + 'px');
  }
  window.visualViewport?.addEventListener('resize', viewport);
  window.visualViewport?.addEventListener('scroll', viewport); viewport();
  window.toggleChat = () => dialog.open ? dialog.close() : open(document.activeElement);
  window.askQuick = text => { open(document.activeElement); input.value = text; resize(); };
})();
