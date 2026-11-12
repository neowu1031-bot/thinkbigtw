/* Client intake page. Generic template: all client text comes from the server
   after the access code is verified. Drafts stay in this browser only. */
(function () {
  'use strict';

  var m = /^\/c\/([A-Za-z0-9_-]{32,64})\/?$/.exec(location.pathname);
  if (!m) return;
  var SLUG = m[1];
  var API = '/c/' + SLUG + '/api/';
  var DRAFT_KEY = 'tb-intake:' + SLUG;
  var TOKEN_KEY = 'tb-intake-t:' + SLUG;

  var app = document.getElementById('app');
  var progress = document.querySelector('.ci-progress');
  var bar = document.querySelector('.ci-progress-bar');
  var toastEl = document.querySelector('.ci-toast');

  var S = { token: null, content: null, status: null, answers: {}, note: '', idx: 0, view: 'gate', submittedN: 0 };

  /* ---------- helpers ---------- */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        var v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'style') el.style.cssText = v; // CSSOM: allowed under strict CSP
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      if (Array.isArray(c)) c.forEach(function (x) { appendKid(el, x); });
      else el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }
  function appendKid(el, x) {
    if (x == null || x === false) return;
    if (Array.isArray(x)) { x.forEach(function (y) { appendKid(el, y); }); return; }
    el.appendChild(typeof x === 'string' ? document.createTextNode(x) : x);
  }
  // Same alphabet as the server: no 0/O, 1/I/L. Full-width input is folded first.
  function normCode(v) {
    v = String(v || '');
    try { v = v.normalize('NFKC'); } catch (e) { /* old browsers */ }
    return v.toUpperCase().replace(/[^ABCDEFGHJKMNPQRSTUVWXYZ23456789]/g, '');
  }
  function clear() { toastEl.hidden = true; while (app.firstChild) app.removeChild(app.firstChild); }
  function toast(msg) {
    toastEl.textContent = msg; toastEl.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { toastEl.hidden = true; }, 2600);
  }
  function top() { window.scrollTo({ top: 0, behavior: 'auto' }); }
  function q() { return S.content.questions; }
  function groupTitle(id) {
    var g = (S.content.groups || []).filter(function (x) { return x.id === id; })[0];
    return g ? g.title : '';
  }
  function fmtTime(ts) {
    try { return new Date(ts).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
  }

  /* ---------- storage (this browser only) ---------- */
  function loadDraft() {
    try { var d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); return d && typeof d === 'object' ? d : null; } catch (e) { return null; }
  }
  function saveDraft(manual) {
    var d = { answers: S.answers, note: S.note, idx: S.idx, savedAt: Date.now(), submittedN: S.submittedN };
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch (e) { if (manual) toast('這個瀏覽器不允許暫存，請先別關掉頁面'); return; }
    var s = document.querySelector('[data-saved]');
    if (s) s.textContent = '已存在這支裝置 ' + fmtTime(d.savedAt);
    if (manual) toast('已暫存。下次打開這個網址，會從這一題接著答');
  }
  function clearDraftAnswers() {
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) { /* ignore */ }
  }

  /* ---------- API ---------- */
  function api(path, opts) {
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    if (S.token) headers.Authorization = 'Bearer ' + S.token;
    return fetch(API + path, { method: opts.method || 'GET', headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined, credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; }); });
  }

  /* ---------- gate ---------- */
  function renderGate(msg) {
    S.view = 'gate'; progress.hidden = true; clear();
    var input = h('input', { class: 'ci-code', id: 'code', type: 'text', inputmode: 'text', autocomplete: 'off', autocapitalize: 'characters', autocorrect: 'off', spellcheck: 'false', maxlength: '9', 'aria-describedby': 'code-err', placeholder: 'XXXX-XXXX' });
    var err = h('p', { class: 'ci-err', id: 'code-err', role: 'alert', text: msg || '' });
    var btn = h('button', { class: 'ci-btn ci-btn-block', type: 'submit', text: '進入' });
    var form = h('form', { class: 'ci-card', novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      var code = normCode(input.value);
      if (code.length !== 8) { err.textContent = '請輸入 8 個字的存取碼（英文字母和數字）'; input.focus(); return; }
      btn.disabled = true; btn.textContent = '確認中…'; err.textContent = '';
      api('unlock', { method: 'POST', body: { code: code } }).then(function (j) {
        btn.disabled = false; btn.textContent = '進入';
        if (j._status === 200) {
          S.token = j.token; S.content = j.content; S.status = j.status;
          try { sessionStorage.setItem(TOKEN_KEY, j.token); } catch (e2) { /* ignore */ }
          start();
        } else if (j._status === 401) { err.textContent = '存取碼不對，請再對照一次 LINE 上收到的 8 個字。'; input.select(); }
        else if (j._status === 429) { err.textContent = '嘗試太多次了，請稍後再試，或直接 LINE 我們。'; }
        else { err.textContent = '連線有點問題，請稍後再試。'; }
      }).catch(function () { btn.disabled = false; btn.textContent = '進入'; err.textContent = '連線有點問題，請稍後再試。'; });
    } },
      h('label', { for: 'code', class: 'ci-flabel', text: '存取碼（8 個字，英文字母和數字）' }),
      input, err, btn,
      h('p', { class: 'ci-small ci-muted', style: 'margin:14px 0 0', text: '存取碼會另外用 LINE 傳給您。大小寫都可以，中間的橫線打不打都行。' })
    );
    input.addEventListener('input', function () {
      var c = normCode(input.value).slice(0, 8);
      input.value = c.length > 4 ? c.slice(0, 4) + '-' + c.slice(4) : c;
    });
    app.appendChild(h('section', { class: 'ci-gate' },
      h('p', { class: 'ci-eyebrow', text: 'Private' }),
      h('h1', { class: 'ci-h1', text: '專屬需求確認' }),
      h('p', { class: 'ci-lead', text: '這是只給您的頁面。請輸入存取碼開始。' }),
      form));
    setTimeout(function () { input.focus(); }, 50);
  }

  /* ---------- intro ---------- */
  function renderVideo(v) {
    v = v || {};
    var portrait = v.orientation === 'portrait';
    var box = h('div', { class: 'ci-video' + (portrait ? ' is-portrait' : '') });
    if (v.src) {
      box.appendChild(h('video', { src: v.src, poster: v.poster || null, controls: true, playsinline: true, preload: 'metadata', controlslist: 'nodownload', 'aria-label': v.label || '說明影片' }));
    } else if (v.poster) {
      box.appendChild(h('img', { src: v.poster, alt: v.posterAlt || '說明影片封面' }));
    } else {
      box.appendChild(h('div', { class: 'ci-poster', role: 'img', 'aria-label': '說明影片製作中' },
        h('span', { class: 'ci-play', 'aria-hidden': 'true' }),
        h('span', { class: 'ci-poster-t', text: v.placeholderTitle || '說明影片製作中' }),
        h('span', { class: 'ci-poster-s', text: v.placeholderSub || '影片好了會放在這裡，先看下面的文字說明就可以' })));
    }
    return [box, v.caption ? h('p', { class: 'ci-video-cap', text: v.caption }) : null];
  }

  function renderSection(s) {
    var wrap = h('section', { class: 'ci-card' + (s.accent ? ' ci-card-accent' : '') });
    if (s.title) wrap.appendChild(h('h2', { class: 'ci-h2', text: s.title }));
    if (s.body) [].concat(s.body).forEach(function (p) { wrap.appendChild(h('p', { style: 'margin:0 0 10px', text: p })); });
    if (s.type === 'steps') wrap.appendChild(h('ol', { class: 'ci-steps' }, (s.items || []).map(function (t) { return h('li', { text: t }); })));
    if (s.type === 'list') wrap.appendChild(h('ul', { style: 'margin:0;padding-left:1.2em' }, (s.items || []).map(function (t) { return h('li', { text: t }); })));
    if (s.type === 'items') {
      var grid = h('div', { class: 'ci-items', style: 'margin-top:12px' });
      (s.items || []).forEach(function (it) {
        grid.appendChild(h('div', { class: 'ci-item' },
          h('h3', { class: 'ci-h3', text: it.title }),
          h('dl', null, (it.rows || []).map(function (r) { return [h('dt', { text: r[0] }), h('dd', { text: r[1] })]; }))));
      });
      wrap.appendChild(grid);
    }
    return wrap;
  }

  function renderIntro() {
    S.view = 'intro'; progress.hidden = true; clear(); top();
    var c = S.content, it = c.intro || {};
    var draft = loadDraft();
    var answered = countAnswered();
    var resume = draft && answered > 0 && S.view !== 'done';
    app.appendChild(h('p', { class: 'ci-eyebrow', text: it.eyebrow || '開始之前' }));
    app.appendChild(h('h1', { class: 'ci-h1', text: it.title || c.title }));
    if (it.lead) app.appendChild(h('p', { class: 'ci-lead', text: it.lead }));
    renderVideo(c.video).forEach(function (x) { if (x) app.appendChild(x); });
    if (it.meta) app.appendChild(h('div', { class: 'ci-meta' }, it.meta.map(function (t) { return h('span', { class: 'ci-chip', text: t }); })));
    if (resume) {
      app.appendChild(h('div', { class: 'ci-note' },
        h('strong', { text: '上次已經答了 ' + answered + ' 題。' }),
        ' 存在這支裝置 ' + fmtTime(draft.savedAt) + '，按下面的按鈕會接著答。'));
    }
    (it.sections || []).forEach(function (s) { app.appendChild(renderSection(s)); });
    app.appendChild(h('div', { class: 'ci-note' }, h('strong', { text: '提醒：' }), c.safetyNote || '請勿填寫任何密碼、金鑰、信用卡資料。需要登入的地方，我們開遠端時由您本人輸入。'));
    if (S.status && S.status.submitted > 0) {
      app.appendChild(h('p', { class: 'ci-small ci-muted', text: '您已經送出過 ' + S.status.submitted + ' 次，還可以修改後再送 ' + S.status.remaining + ' 次（以最後一次為準）。' }));
    }
    app.appendChild(h('div', { class: 'ci-nav single' },
      h('button', { class: 'ci-btn ci-btn-block', type: 'button', text: resume ? '接著答（第 ' + (Math.min(S.idx, q().length - 1) + 1) + ' 題）' : '下一步：開始回答', onclick: function () { renderQuestion(resume ? Math.min(S.idx, q().length - 1) : 0); } })));
  }

  /* ---------- questions ---------- */
  function isAnswered(def, v) {
    if (v == null) return false;
    if (def.type === 'fields') return Object.keys(v).some(function (k) { return isAnswered((def.fields || []).filter(function (f) { return f.id === k; })[0] || {}, v[k]); });
    if (def.type === 'single') return !!(v.v || v.o);
    if (def.type === 'multi') return !!((v.v && v.v.length) || v.o);
    return typeof v === 'string' && v.trim() !== '';
  }
  function countAnswered() {
    return q().filter(function (d) { return isAnswered(d, S.answers[d.id]); }).length;
  }

  function choiceControl(def, value, onChange, name) {
    var multi = def.type === 'multi';
    var cur = value || { v: multi ? [] : null, o: '' };
    var wrap = h('div', { class: 'ci-opts', role: multi ? 'group' : 'radiogroup' });
    var otherBox = null;
    function needsOther() {
      var picked = multi ? (cur.v || []) : (cur.v ? [cur.v] : []);
      return (def.options || []).some(function (o) { return o.other && picked.indexOf(o.value) >= 0; });
    }
    (def.options || []).forEach(function (o) {
      var checked = multi ? (cur.v || []).indexOf(o.value) >= 0 : cur.v === o.value;
      var inp = h('input', { type: multi ? 'checkbox' : 'radio', name: name, value: o.value, checked: checked });
      inp.addEventListener('change', function () {
        if (multi) {
          var set = (cur.v || []).filter(function (x) { return x !== o.value; });
          if (inp.checked) set.push(o.value);
          cur.v = set;
        } else cur.v = o.value;
        otherBox.hidden = !needsOther();
        onChange(cur);
      });
      wrap.appendChild(h('label', { class: 'ci-opt' + (multi ? ' is-multi' : '') }, inp, h('span', { class: 'ci-mark', 'aria-hidden': 'true' }),
        h('span', null, h('span', { class: 'ci-opt-t', text: o.label }), o.desc ? h('span', { class: 'ci-opt-d', text: o.desc }) : null)));
    });
    var otherDef = (def.options || []).filter(function (o) { return o.other; })[0];
    var ta = h('input', { class: 'ci-input', type: 'text', maxlength: '300', placeholder: (otherDef && otherDef.placeholder) || '請寫一下', value: cur.o || '' });
    ta.addEventListener('input', function () { cur.o = ta.value; onChange(cur); });
    otherBox = h('div', { class: 'ci-other' }, ta);
    otherBox.hidden = !needsOther();
    return [wrap, otherBox];
  }

  function textControl(def, value, onChange, id) {
    var big = def.type === 'textarea';
    var max = def.maxLength || (big ? 2000 : 300);
    var el = h(big ? 'textarea' : 'input', { class: big ? 'ci-textarea' : 'ci-input', id: id, maxlength: String(max), placeholder: def.placeholder || '', inputmode: def.inputmode || null, autocomplete: 'off' });
    el.value = value || '';
    var cnt = big ? h('div', { class: 'ci-count', text: (el.value.length) + ' / ' + max }) : null;
    el.addEventListener('input', function () { if (cnt) cnt.textContent = el.value.length + ' / ' + max; onChange(el.value); });
    return [el, cnt];
  }

  function controlFor(def, value, onChange, id) {
    if (def.type === 'single' || def.type === 'multi') return choiceControl(def, value, onChange, id);
    return textControl(def, value, onChange, id);
  }

  var saveTimer = null;
  function autosave() { clearTimeout(saveTimer); saveTimer = setTimeout(function () { saveDraft(false); }, 400); }

  function renderQuestion(i) {
    S.view = 'q'; S.idx = i; clear(); top();
    var list = q(), def = list[i], total = list.length;
    progress.hidden = false; bar.style.width = Math.round((i / total) * 100) + '%';
    progress.setAttribute('role', 'progressbar'); progress.setAttribute('aria-valuenow', String(i + 1)); progress.setAttribute('aria-valuemax', String(total));

    var card = h('section', { class: 'ci-q' });
    card.appendChild(h('div', { class: 'ci-qhead' }, h('span', { class: 'ci-group', text: groupTitle(def.group) }), h('span', { text: '第 ' + (i + 1) + ' / ' + total + ' 題' })));
    card.appendChild(h('h1', { class: 'ci-qtitle', id: 'qt', text: def.title }));
    if (def.why) card.appendChild(h('p', { class: 'ci-why', text: '為什麼問：' + def.why }));
    if (def.help) card.appendChild(h('p', { class: 'ci-help', text: def.help }));
    if (def.table) {
      card.appendChild(h('table', { class: 'ci-table' }, h('tbody', null, def.table.map(function (r) { return h('tr', null, h('td', { text: r[0] }), h('td', { text: r[1] })); }))));
    }

    if (def.type === 'fields') {
      var cur = S.answers[def.id] || {};
      var box = h('div', { class: 'ci-fields' });
      (def.fields || []).forEach(function (f) {
        var fid = def.id + '-' + f.id;
        var lab = (f.type === 'single' || f.type === 'multi') ? h('p', { class: 'ci-flabel', text: f.label }) : h('label', { for: fid, text: f.label });
        box.appendChild(h('div', { class: 'ci-field' }, lab,
          f.hint ? h('p', { class: 'ci-small ci-muted', style: 'margin:-4px 0 8px', text: f.hint }) : null,
          controlFor(f, cur[f.id], function (val) { cur[f.id] = val; S.answers[def.id] = cur; autosave(); }, fid)));
      });
      card.appendChild(box);
    } else {
      card.appendChild(h('div', { class: 'ci-field' }, controlFor(def, S.answers[def.id], function (val) { S.answers[def.id] = val; autosave(); }, 'a-' + def.id)));
    }

    var last = i === total - 1;
    card.appendChild(h('div', { class: 'ci-nav' },
      h('button', { class: 'ci-btn-ghost', type: 'button', text: i === 0 ? '回說明' : '上一題', onclick: function () { saveDraft(false); if (i === 0) renderIntro(); else renderQuestion(i - 1); } }),
      h('button', { class: 'ci-btn', type: 'button', text: last ? '下一步：確認答案' : '下一題', onclick: function () { saveDraft(false); if (last) renderReview(); else renderQuestion(i + 1); } })));
    card.appendChild(h('div', { class: 'ci-save' },
      h('span', { 'data-saved': true, text: '答案會自動存在這支裝置' }),
      h('button', { class: 'ci-link', type: 'button', text: '先存起來，下次再答', onclick: function () { saveDraft(true); } })));
    if (!isAnswered(def, S.answers[def.id])) card.appendChild(h('p', { class: 'ci-small ci-muted', style: 'margin:10px 0 0', text: def.skipHint || '不確定也沒關係，可以先跳過，開遠端時再一起看。' }));
    app.appendChild(card);
  }

  /* ---------- review ---------- */
  function leafText(def, v) {
    if (!isAnswered(def, v)) return '';
    if (def.type === 'single' || def.type === 'multi') {
      var vs = def.type === 'multi' ? (v.v || []) : (v.v ? [v.v] : []);
      var parts = vs.map(function (x) { var o = (def.options || []).filter(function (y) { return y.value === x; })[0]; return o ? o.label : x; });
      if (v.o && (def.options || []).some(function (o) { return o.other && vs.indexOf(o.value) >= 0; })) parts.push('補充：' + v.o);
      return parts.join('、');
    }
    return v;
  }

  function renderReview(errMap) {
    S.view = 'review'; clear(); top();
    progress.hidden = false; bar.style.width = '100%';
    var rv = S.content.review || {};
    app.appendChild(h('p', { class: 'ci-eyebrow', text: '最後一步' }));
    app.appendChild(h('h1', { class: 'ci-h1', text: rv.title || '確認一下答案' }));
    app.appendChild(h('p', { class: 'ci-lead', text: rv.lead || '沒問題就按最下面的「送出」。想改哪一題，按旁邊的「修改」。' }));
    var missing = 0, lastGroup = null, grp = null;
    q().forEach(function (def, i) {
      if (def.group !== lastGroup) {
        lastGroup = def.group;
        grp = h('div', { class: 'ci-rgroup' }, h('h3', { text: groupTitle(def.group) }));
        app.appendChild(grp);
      }
      var v = S.answers[def.id];
      var body;
      if (def.type === 'fields') {
        var rows = (def.fields || []).map(function (f) { var t = leafText(f, v && v[f.id]); return t ? h('span', { class: 'ci-rf' }, h('b', { text: f.label + '：' }), t) : null; }).filter(Boolean);
        body = rows.length ? h('div', { class: 'ci-ra' }, rows) : null;
      } else {
        var t = leafText(def, v);
        body = t ? h('div', { class: 'ci-ra', text: t }) : null;
      }
      if (!body) { missing++; body = h('div', { class: 'ci-ra is-empty', text: '還沒回答（可以留白，我們遠端時再問）' }); }
      var err = errMap && errMap[def.id];
      grp.appendChild(h('div', { class: 'ci-rrow', style: err ? 'border-color:#A1262F' : null },
        h('div', { class: 'ci-rq', text: (i + 1) + '. ' + def.title }),
        h('button', { class: 'ci-link', type: 'button', text: '修改', onclick: function () { renderQuestion(i); } }),
        body,
        err ? h('div', { class: 'ci-ra is-empty', text: err }) : null));
    });

    if (rv.note !== false) {
      var noteDef = { type: 'textarea', maxLength: 2000, placeholder: rv.notePlaceholder || '還有想跟我們說的，寫在這裡（可以不填）' };
      app.appendChild(h('div', { class: 'ci-field' }, h('label', { for: 'note', text: rv.noteLabel || '還有什麼想補充的嗎？' }),
        textControl(noteDef, S.note, function (val) { S.note = val; autosave(); }, 'note'),
        errMap && errMap._note ? h('p', { class: 'ci-err', text: errMap._note }) : null));
    }
    app.appendChild(h('div', { class: 'ci-note' }, h('strong', { text: '送出前再提醒一次：' }), S.content.safetyNote || '請勿填寫任何密碼、金鑰、信用卡資料。'));
    if (missing) app.appendChild(h('p', { class: 'ci-small ci-muted', text: '還有 ' + missing + ' 題沒回答。可以先送出，沒答的我們遠端時再一起確認。' }));

    var remaining = S.status ? S.status.remaining : 1;
    var statusBox = h('div', { class: 'ci-sendstate', role: 'alert', hidden: true });
    var send = h('button', { class: 'ci-btn ci-btn-block', type: 'button', text: '送出', disabled: remaining <= 0 });
    send.addEventListener('click', function () { submitWithRetry(send, statusBox); });
    app.appendChild(statusBox);
    app.appendChild(h('div', { class: 'ci-nav' },
      h('button', { class: 'ci-btn-ghost', type: 'button', text: '上一題', onclick: function () { renderQuestion(q().length - 1); } }),
      send));
    if (remaining <= 0) app.appendChild(h('p', { class: 'ci-small ci-muted', text: '已達送出次數上限。還想修改的話，直接 LINE 我們就好。' }));
    app.appendChild(h('div', { class: 'ci-dl' },
      h('span', { class: 'ci-small ci-muted', text: '想自己留一份底？' }),
      downloadButton('下載我的答案（.txt）')));
  }

  /* ---------- submit: confirmed-write only, retries, never lose the draft ---------- */
  var RETRY_DELAYS = [2000, 5000, 12000];

  function submitWithRetry(send, box) {
    saveDraft(false); // the draft stays on this device until the server confirms
    var attempt = 0;
    send.disabled = true; send.textContent = '送出中…';
    box.hidden = true;

    function fail(msg, canRetry) {
      send.disabled = false; send.textContent = '送出';
      showSendProblem(box, msg, canRetry ? function () { submitWithRetry(send, box); } : null);
    }

    function once() {
      api('submit', { method: 'POST', body: { answers: S.answers, note: S.note } }).then(function (j) {
        if (j._status === 200 && j.ok && j.id) {
          S.submittedN = (S.submittedN || 0) + 1; S.status = j.status;
          S.lastSubmission = { id: j.id, at: j.submittedAt };
          saveDraft(false);
          renderDone(j);
          return;
        }
        if (j._status === 401) { renderGate('頁面閒置太久，請重新輸入存取碼。答案都還在這支裝置上。'); return; }
        if (j._status === 409) { fail('已經送出 ' + (j.status && j.status.maxSubmissions) + ' 次了。還想修改的話，直接 LINE 我們就好。答案都還在，也可以先下載留底。', false); return; }
        if (j._status === 410) { fail('這個頁面已經關閉。答案都還在，請先下載，再用 LINE 傳給我們。', false); return; }
        if (j._status === 422) { send.disabled = false; send.textContent = '送出'; renderReview(mapErrors(j.errors || [])); toast('有幾題需要調整，已標成紅色'); return; }
        retryOrFail(j._status === 429 ? '送出的次數有點密集，' : '');
      }).catch(function () { retryOrFail(''); });
    }

    function retryOrFail(prefix) {
      if (attempt < RETRY_DELAYS.length) {
        var wait = RETRY_DELAYS[attempt++];
        showSendProblem(box, prefix + '網路有點問題，答案都還在。' + Math.round(wait / 1000) + ' 秒後自動再試一次（第 ' + attempt + ' / ' + RETRY_DELAYS.length + ' 次）。', null);
        setTimeout(once, wait);
        return;
      }
      fail(prefix + '網路有點問題，答案都還在這支裝置上，請按「重試」。也可以先下載答案留底。', true);
    }

    once();
  }

  function showSendProblem(box, msg, onRetry) {
    while (box.firstChild) box.removeChild(box.firstChild);
    box.hidden = false;
    box.appendChild(h('p', { class: 'ci-sendmsg', text: msg }));
    var row = h('div', { class: 'ci-sendrow' });
    if (onRetry) row.appendChild(h('button', { class: 'ci-btn', type: 'button', text: '重試', onclick: onRetry }));
    row.appendChild(downloadButton('下載我的答案'));
    box.appendChild(row);
    box.scrollIntoView({ block: 'center' });
  }

  /* ---------- download a plain-text copy (stays on the device) ---------- */
  function answersAsText() {
    var lines = [];
    lines.push((S.content.title || '需求確認') + '｜我的答案');
    lines.push('存檔時間：' + new Date().toLocaleString('zh-TW'));
    if (S.lastSubmission) lines.push('送出編號：' + S.lastSubmission.id);
    lines.push('');
    var lastGroup = null;
    q().forEach(function (def, i) {
      if (def.group !== lastGroup) { lastGroup = def.group; lines.push('【' + groupTitle(def.group) + '】'); }
      lines.push((i + 1) + '. ' + def.title);
      var v = S.answers[def.id];
      if (def.type === 'fields') {
        var any = false;
        (def.fields || []).forEach(function (f) { var t = leafText(f, v && v[f.id]); if (t) { any = true; lines.push('   ' + f.label + '：' + t); } });
        if (!any) lines.push('   （未回答）');
      } else {
        lines.push('   ' + (leafText(def, v) || '（未回答）'));
      }
      lines.push('');
    });
    if (S.note) { lines.push('其他補充：'); lines.push(S.note); }
    return '﻿' + lines.join('\r\n');
  }

  function downloadButton(label) {
    return h('button', { class: 'ci-btn-ghost', type: 'button', text: label, onclick: function () {
      var d = new Date();
      var stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0') + '-' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
      var url = URL.createObjectURL(new Blob([answersAsText()], { type: 'text/plain;charset=utf-8' }));
      var a = h('a', { href: url, download: '需求確認-我的答案-' + stamp + '.txt' });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    } });
  }

  function mapErrors(list) {
    var out = {};
    list.forEach(function (e) {
      var msg = e.reason === 'looks_like_secret' ? '這題的內容看起來像密碼、金鑰或卡號，請拿掉後再送出。'
        : e.reason === 'too_long' ? '這題字數太多了，請精簡一點。'
        : e.reason === 'pattern' ? '這一格只能填數字（例如 AnyDesk 號碼），請不要寫其他內容。'
        : '這題的格式有問題，請重新選一次。';
      out[e.q] = msg;
    });
    return out;
  }

  /* ---------- done ---------- */
  function renderDone(j) {
    S.view = 'done'; clear(); top(); progress.hidden = true;
    var t = S.content.thanks || {};
    var wrap = h('section', { class: 'ci-done' }, h('div', { class: 'ci-check', 'aria-hidden': 'true' }),
      h('h1', { class: 'ci-h1', text: t.title || '收到了，謝謝您！' }),
      t.lead ? h('p', { class: 'ci-lead', text: t.lead }) : null);
    wrap.appendChild(h('div', { class: 'ci-receipt' },
      h('span', { class: 'ci-receipt-l', text: '送出編號' }),
      h('span', { class: 'ci-receipt-v', text: j.id }),
      h('span', { class: 'ci-small ci-muted', text: '要跟我們核對時，報這組編號就可以。' })));
    if (t.steps && t.steps.length) wrap.appendChild(h('section', { class: 'ci-card ci-card-accent' }, h('h2', { class: 'ci-h2', text: t.stepsTitle || '接下來' }), h('ol', { class: 'ci-steps' }, t.steps.map(function (s) { return h('li', { text: s }); }))));
    var row = h('div', { class: 'ci-sendrow' }, downloadButton('下載我的答案（.txt）'));
    if (S.status && S.status.remaining > 0) row.appendChild(h('button', { class: 'ci-btn-ghost', type: 'button', text: '回去修改答案', onclick: function () { renderReview(); } }));
    wrap.appendChild(row);
    if (S.status && S.status.remaining > 0) {
      wrap.appendChild(h('p', { class: 'ci-small ci-muted', text: '想改答案的話，可以修改後再送出（還可以送 ' + S.status.remaining + ' 次，以最後一次為準）。' }));
    }
    wrap.appendChild(h('p', { class: 'ci-small ci-muted', style: 'margin-top:18px' },
      '用的是共用的電腦或手機？ ',
      h('button', { class: 'ci-link', type: 'button', text: '清除這台裝置上的答案', onclick: function () {
        if (!window.confirm('確定要清除這台裝置上暫存的答案嗎？我們這邊收到的不受影響。')) return;
        clearDraftAnswers(); S.answers = {}; S.note = ''; S.idx = 0;
        try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ }
        toast('已清除這台裝置上的答案');
      } })));
    app.appendChild(wrap);
  }

  /* ---------- boot ---------- */
  function start() {
    var d = loadDraft();
    if (d) {
      S.answers = d.answers && typeof d.answers === 'object' ? d.answers : {};
      S.note = typeof d.note === 'string' ? d.note : '';
      S.idx = Number(d.idx) || 0;
      S.submittedN = d.submittedN || 0;
    }
    renderIntro();
  }

  function boot() {
    var t = null;
    try { t = sessionStorage.getItem(TOKEN_KEY); } catch (e) { /* ignore */ }
    if (!t) return renderGate();
    S.token = t;
    api('content').then(function (j) {
      if (j._status === 200) { S.content = j.content; S.status = j.status; start(); }
      else { S.token = null; try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) { /* ignore */ } renderGate(); }
    }).catch(function () { renderGate(); });
  }

  window.__intakeClearDraft = clearDraftAnswers;
  boot();
})();
