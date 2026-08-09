// ═══════════════════════════════════════════════════
// Think BIG! ASK AI — 共用元件 (CSS+HTML+JS 自動注入)
// 每頁只需: <script src="/ask-ai.js" defer></script>
// ═══════════════════════════════════════════════════
(function(){
  if (document.getElementById('ai-agent-btn')) return; // 防重複注入

  // ---- 1. 注入 CSS ----
  var css = "#ai-agent-btn,#ai-chat{--mono:'Space Mono',ui-monospace,monospace;--tc:'Noto Sans TC',sans-serif;--red:#e8422a;--white:#fff;}\n/* ── AI AGENT BUTTON ── */\n#ai-agent-btn{\n  position:fixed;bottom:24px;right:24px;z-index:9999;\n  width:72px;height:72px;padding:0;border-radius:50%;\n  background:#0a0a0a;\n  border:2px solid #e8422a;\n  cursor:pointer;overflow:visible;\n  transition:transform 0.3s ease,box-shadow 0.3s ease;\n  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;\n  box-shadow:0 0 12px rgba(232,66,42,0.6),0 0 24px rgba(232,66,42,0.3);\n  font-family:var(--mono);\n}\n#ai-agent-btn:hover{transform:scale(1.05);box-shadow:0 0 20px rgba(232,66,42,0.8),0 0 36px rgba(232,66,42,0.5)}\n#ai-agent-btn .pulse{\n  position:absolute;inset:0;border-radius:50%;\n  border:1px solid var(--red);animation:pulse-ring 2.5s ease-out infinite;\n}\n#ai-agent-btn .pulse-2{animation-delay:1.25s}\n@keyframes pulse-ring{0%{transform:scale(1);opacity:0.6}100%{transform:scale(1.15);opacity:0}}\n#ai-agent-btn .btn-dot{\n  width:8px;height:8px;border-radius:50%;background:var(--red);\n  box-shadow:0 0 8px var(--red);\n  animation:dotPulse 1.5s ease-in-out infinite;\n}\n@keyframes dotPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.4;transform:scale(0.7)}}\n#ai-agent-btn .btn-text{\n  color:#fff;font-size:11px;font-weight:700;\n  letter-spacing:0.1em;text-transform:uppercase;\n  white-space:nowrap;line-height:1;\n}\n#ai-agent-btn .btn-brand{\n  color:#fff;font-size:11px;font-weight:700;\n  letter-spacing:0.1em;text-transform:uppercase;\n  white-space:nowrap;\n  border-left:none;\n  padding-left:0;line-height:1;\n}\n\n/* ── AI CHAT FULLSCREEN ── */\n#ai-chat{\n  position:fixed;inset:0;z-index:2147483600;\n  background:radial-gradient(ellipse at center, rgba(15,8,5,0.75) 0%, rgba(0,0,0,0.92) 70%, rgba(0,0,0,0.98) 100%);\n  backdrop-filter:blur(28px) saturate(180%);\n  -webkit-backdrop-filter:blur(28px) saturate(180%);\n  display:none;flex-direction:column;\n  animation:chatFadeIn 0.4s cubic-bezier(0.16,1,0.3,1);\n}\n@keyframes chatFadeIn{from{opacity:0;backdrop-filter:blur(0px)}to{opacity:1;backdrop-filter:blur(28px) saturate(180%)}}\n#ai-chat.open{display:flex}\n#ai-chat .chat-header{\n  padding:20px 32px;border-bottom:1px solid rgba(232,66,42,0.12);\n  display:flex;align-items:center;justify-content:space-between;\n  background:linear-gradient(180deg,rgba(232,66,42,0.04) 0%,transparent 100%);\n}\n#ai-chat .chat-header .agent-info{display:flex;align-items:center;gap:14px}\n#ai-chat .chat-header .agent-avatar{\n  width:42px;height:42px;border-radius:50%;\n  background:linear-gradient(135deg,var(--red) 0%,#ff6b4a 50%,#ffaa80 100%);\n  display:flex;align-items:center;justify-content:center;\n  font-family:var(--mono);font-size:1rem;font-weight:800;color:#fff;\n  box-shadow:0 0 24px rgba(232,66,42,0.5), inset 0 0 8px rgba(255,255,255,0.2);\n  animation:avatarGlow 3s ease-in-out infinite;\n}\n@keyframes avatarGlow{0%,100%{box-shadow:0 0 24px rgba(232,66,42,0.5), inset 0 0 8px rgba(255,255,255,0.2)}50%{box-shadow:0 0 36px rgba(232,66,42,0.8), inset 0 0 12px rgba(255,255,255,0.3)}}\n#ai-chat .chat-header .agent-name{font-family:var(--mono);font-size:0.85rem;font-weight:700;letter-spacing:0.15em;text-transform:uppercase;color:#fff;line-height:1}\n#ai-chat .chat-header .agent-tagline{font-family:var(--mono);font-size:0.55rem;letter-spacing:0.2em;color:rgba(232,66,42,0.8);margin-top:4px;text-transform:uppercase}\n#ai-chat .chat-header .status{font-family:var(--mono);font-size:0.55rem;opacity:0.5;display:flex;align-items:center;gap:6px;margin-top:3px;letter-spacing:0.15em}\n#ai-chat .chat-header .status::before{content:'';width:6px;height:6px;border-radius:50%;background:#4ade80;box-shadow:0 0 8px #4ade80;animation:statusPulse 2s ease-in-out infinite}\n@keyframes statusPulse{0%,100%{opacity:1}50%{opacity:0.4}}\n#ai-chat .chat-header .header-right{display:flex;align-items:center;gap:14px}\n#ai-chat .chat-header .powered-by{\n  font-family:var(--mono);font-size:0.55rem;color:rgba(255,255,255,0.3);\n  letter-spacing:0.15em;text-transform:uppercase;\n  padding:6px 12px;border:1px solid rgba(255,255,255,0.08);border-radius:30px;\n}\n#ai-chat .chat-header .powered-by b{color:var(--red);font-weight:600}\n#ai-chat .chat-header .close-btn{\n  width:36px;height:36px;border-radius:50%;\n  background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);\n  cursor:pointer;font-size:1.1rem;color:var(--white);\n  display:flex;align-items:center;justify-content:center;\n  transition:all 0.2s;\n}\n#ai-chat .chat-header .close-btn:hover{background:rgba(232,66,42,0.15);border-color:rgba(232,66,42,0.4)}\n\n#ai-chat .chat-body{\n  flex:1;overflow-y:auto;\n  padding:32px max(48px, 5vw);\n  display:flex;flex-direction:column;gap:16px;\n  max-width:1000px;width:100%;margin:0 auto;\n}\n#ai-chat .chat-body::-webkit-scrollbar{width:4px}\n#ai-chat .chat-body::-webkit-scrollbar-thumb{background:rgba(232,66,42,0.3);border-radius:2px}\n#ai-chat .chat-body::-webkit-scrollbar-track{background:transparent}\n\n/* Hero welcome */\n#ai-chat .hero-welcome{\n  text-align:center;padding:60px 20px 40px;animation:heroIn 0.6s ease 0.2s both;\n}\n@keyframes heroIn{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}\n#ai-chat .hero-welcome .hero-icon{\n  width:80px;height:80px;border-radius:50%;margin:0 auto 24px;\n  background:radial-gradient(circle, var(--red) 0%, transparent 70%);\n  display:flex;align-items:center;justify-content:center;\n  font-size:2.5rem;animation:heroIconFloat 3s ease-in-out infinite;\n}\n@keyframes heroIconFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}\n#ai-chat .hero-welcome h2{\n  font-family:var(--mono);font-size:1.6rem;font-weight:300;letter-spacing:0.05em;\n  background:linear-gradient(135deg,#fff 0%,var(--red) 50%,#ff6b4a 100%);\n  -webkit-background-clip:text;background-clip:text;color:transparent;\n  margin-bottom:12px;\n}\n#ai-chat .hero-welcome p{\n  font-family:var(--tc);font-size:0.9rem;color:rgba(255,255,255,0.5);\n  line-height:1.7;max-width:520px;margin:0 auto;\n}\n#ai-chat .quick-suggestions{\n  display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;\n  margin-top:40px;max-width:780px;margin-left:auto;margin-right:auto;\n}\n#ai-chat .quick-suggestions .qs{\n  text-align:left;padding:18px 20px;\n  background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:12px;\n  cursor:pointer;transition:all 0.25s;\n  display:flex;align-items:flex-start;gap:12px;\n}\n#ai-chat .quick-suggestions .qs:hover{\n  background:rgba(232,66,42,0.08);border-color:rgba(232,66,42,0.4);\n  transform:translateY(-2px);box-shadow:0 8px 24px rgba(232,66,42,0.15);\n}\n#ai-chat .quick-suggestions .qs .qs-icon{font-size:1.5rem;flex-shrink:0;margin-top:2px}\n#ai-chat .quick-suggestions .qs .qs-text{font-family:var(--tc);font-size:0.85rem;color:rgba(255,255,255,0.85);line-height:1.6}\n#ai-chat .quick-suggestions .qs .qs-text small{display:block;font-family:var(--mono);font-size:0.55rem;color:rgba(232,66,42,0.7);letter-spacing:0.1em;text-transform:uppercase;margin-top:4px}\n\n/* Messages */\n#ai-chat .msg-row{display:flex;gap:14px;align-items:flex-start;animation:msgIn 0.35s cubic-bezier(0.16,1,0.3,1)}\n@keyframes msgIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}\n#ai-chat .msg-row.user{flex-direction:row-reverse}\n#ai-chat .msg-avatar{\n  width:32px;height:32px;border-radius:50%;flex-shrink:0;\n  display:flex;align-items:center;justify-content:center;\n  font-family:var(--mono);font-size:0.65rem;font-weight:700;\n}\n#ai-chat .msg-row.bot .msg-avatar{background:linear-gradient(135deg,var(--red),#ff6b4a);color:#fff;box-shadow:0 0 12px rgba(232,66,42,0.4)}\n#ai-chat .msg-row.user .msg-avatar{background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.1)}\n#ai-chat .msg{\n  font-family:var(--tc);font-size:0.92rem;\n  line-height:1.8;padding:14px 18px;border-radius:14px;max-width:680px;\n  white-space:pre-wrap;word-wrap:break-word;\n}\n#ai-chat .msg.bot{background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.05);color:rgba(255,255,255,0.92)}\n#ai-chat .msg.user{background:linear-gradient(135deg,rgba(232,66,42,0.18) 0%,rgba(232,66,42,0.1) 100%);border:1px solid rgba(232,66,42,0.25);color:#fff}\n#ai-chat .msg a{color:var(--red);text-decoration:underline}\n#ai-chat .msg .typing-dots{display:inline-flex;gap:4px}\n#ai-chat .msg .typing-dots span{width:6px;height:6px;border-radius:50%;background:var(--red);animation:typing 1.4s ease-in-out infinite}\n#ai-chat .msg .typing-dots span:nth-child(2){animation-delay:0.2s}\n#ai-chat .msg .typing-dots span:nth-child(3){animation-delay:0.4s}\n@keyframes typing{0%,60%,100%{opacity:0.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}\n\n/* Quick bar (persistent) */\n#ai-chat .quick-bar{display:flex;flex-wrap:nowrap;gap:10px;max-width:1000px;margin:0 auto 12px}\n#ai-chat .quick-bar .qchip{flex:1 1 0;min-width:0;text-align:left;padding:10px 12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;cursor:pointer;transition:all 0.2s;font-family:var(--tc)}\n#ai-chat .quick-bar .qchip:hover{background:rgba(232,66,42,0.1);border-color:rgba(232,66,42,0.45);transform:translateY(-2px)}\n#ai-chat .quick-bar .qchip .qt{display:block;font-size:0.8rem;color:#fff;font-weight:500;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n#ai-chat .quick-bar .qchip .qs2{display:block;font-family:var(--mono);font-size:0.5rem;color:rgba(232,66,42,0.85);letter-spacing:0.06em;text-transform:uppercase;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n/* Input area */\n#ai-chat .chat-input-wrap{\n  padding:20px max(48px, 5vw) 28px;\n  background:linear-gradient(180deg,transparent 0%,rgba(0,0,0,0.6) 100%);\n  border-top:1px solid rgba(232,66,42,0.1);\n}\n#ai-chat .chat-input{\n  max-width:1000px;margin:0 auto;\n  display:flex;gap:10px;align-items:center;\n  background:rgba(255,255,255,0.04);\n  border:1px solid rgba(255,255,255,0.08);\n  border-radius:16px;padding:8px 8px 8px 20px;\n  transition:all 0.25s;\n}\n#ai-chat .chat-input:focus-within{\n  border-color:rgba(232,66,42,0.5);\n  box-shadow:0 0 0 4px rgba(232,66,42,0.08), 0 0 24px rgba(232,66,42,0.15);\n}\n#ai-chat .chat-input input{\n  flex:1;background:none;border:none;\n  color:#fff;font-family:var(--tc);font-size:0.95rem;\n  outline:none;padding:12px 0;\n}\n#ai-chat .chat-input input::placeholder{color:rgba(255,255,255,0.3)}\n#ai-chat .chat-input .send-btn{\n  width:44px;height:44px;border-radius:12px;\n  background:linear-gradient(135deg,var(--red),#ff6b4a);\n  border:none;cursor:pointer;\n  display:flex;align-items:center;justify-content:center;\n  transition:all 0.2s;color:#fff;\n}\n#ai-chat .chat-input .send-btn:hover{transform:scale(1.08);box-shadow:0 0 20px rgba(232,66,42,0.5)}\n#ai-chat .chat-input .send-btn:disabled{opacity:0.3;cursor:not-allowed;transform:none}\n#ai-chat .chat-input .send-btn svg{width:18px;height:18px;fill:#fff}\n#ai-chat .chat-footer{\n  text-align:center;margin-top:12px;\n  font-family:var(--mono);font-size:0.55rem;\n  color:rgba(255,255,255,0.25);letter-spacing:0.15em;\n}\n#ai-chat .chat-footer a{color:var(--red);text-decoration:none}\n#ai-chat .chat-footer a:hover{text-decoration:underline}\n\n\n@media(max-width:768px){\n  #ai-chat{position:fixed;top:0;left:0;width:100vw;height:100vh;right:auto;bottom:auto;border-radius:0;z-index:10000}\n  /* 手機版: 正圓鈕, ASK/AI 直排置中, 文字不溢出 */\n  #ai-agent-btn{width:60px;height:60px;min-width:60px;padding:0;border-radius:50%;bottom:16px;right:16px;gap:1px;flex-direction:column;align-items:center;justify-content:center;z-index:9999}\n  #ai-agent-btn .pulse{border-radius:50%}\n  #ai-agent-btn .btn-text{font-size:10px;letter-spacing:0.05em;line-height:1}\n  #ai-agent-btn .btn-brand{font-size:10px;letter-spacing:0.05em;line-height:1;padding-left:0;border-left:none;color:#fff}\n  /* 手機版快速鈕: 2x2 */\n  #ai-chat .quick-bar{flex-wrap:wrap}\n  #ai-chat .quick-bar .qchip{flex:0 0 calc(50% - 5px);width:calc(50% - 5px)}\n  #ai-chat .quick-bar .qchip .qt{white-space:normal}\n}\n";
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  // ---- 2. 注入 HTML ----
  var html = '<div id="ai-agent-btn" onclick="toggleChat()">\n  <div class="pulse"></div>\n  <div class="pulse pulse-2"></div>\n  <div class="btn-text">ASK</div>\n  <div class="btn-brand">AI</div>\n</div>\n\n<div id="ai-chat">\n  <div class="chat-header">\n    <div class="agent-info">\n      <div class="agent-avatar">🦞</div>\n      <div>\n        <div class="agent-name">Hermes Agent</div>\n        <div class="agent-tagline">Think BIG! AI Assistant</div>\n        <div class="status">Online · Real AI · Powered by Claude</div>\n      </div>\n    </div>\n    <div class="header-right">\n      <div class="powered-by">Powered by <b>Cloudflare AI</b></div>\n      <button class="close-btn" onclick="toggleChat()" title="關閉 (ESC)">✕</button>\n    </div>\n  </div>\n  <div class="chat-body" id="chat-body">\n    <div class="hero-welcome" id="hero-welcome">\n      <div class="hero-icon">🦞</div>\n      <h2 id="hero-title">您好！我是 Hermes</h2>\n      <p id="hero-desc">Think BIG! 的 AI 助理 · Powered by 我們自家的 OpenClaw + Claude Code 引擎<br><br>\n        <strong style="color:#fff">🎯 我們目前提供三大服務：</strong><br>\n        <span style="color:rgba(232,66,42,0.9)">①</span> <strong>AI Agent ERP</strong> — 全球首創 AI Native 企業系統<br>\n        <span style="color:rgba(232,66,42,0.9)">②</span> <strong>企業 AI 導入</strong> — RAG / Agent / 流程自動化<br>\n        <span style="color:rgba(232,66,42,0.9)">③</span> <strong>Harness Engineers</strong> — 個人 AI Agent 搭建<br><br>\n        隨時問我任何問題，或點下方快速選項 👇\n      </p>\n    </div>\n  </div>\n  <div class="chat-input-wrap">\n    <div class="quick-bar" id="quick-bar">\n      <button class="qchip" onclick="askQuick(\'告訴我 AI Agent ERP 有什麼模組？定價是多少？\')"><span class="qt">AI Agent ERP 有什麼？</span><span class="qs2">11 大模組 · 三階方案</span></button>\n      <button class="qchip" onclick="askQuick(\'我想導入 AI 自動化\')"><span class="qt">我想導入 AI 自動化</span><span class="qs2">企業方案推薦</span></button>\n      <button class="qchip" onclick="askQuick(\'關於 Think BIG\')"><span class="qt">關於 Think BIG</span><span class="qs2">公司介紹 · 三大服務</span></button>\n    </div>\n    <div class="chat-input">\n      <input type="text" id="chat-msg" placeholder="問我任何問題，例如：ERP 月費多少？" onkeydown="if(event.key===\'Enter\')sendMsg()" autocomplete="off">\n      <button class="send-btn" id="send-btn" onclick="sendMsg()" title="送出 (Enter)">\n        <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>\n      </button>\n    </div>\n    <div class="chat-footer">\n      由 Cloudflare AI 即時驅動 · 若需專人服務請洽 <a href="https://lin.ee/n5KW430" target="_blank">LINE 客服</a>\n    </div>\n  </div>\n</div>\n';
  var wrap = document.createElement('div'); wrap.innerHTML = html;
  while (wrap.firstChild) document.body.appendChild(wrap.firstChild);

  // ---- 3. 邏輯 ----
// ═══ AI CHAT - Real Cloudflare Worker Integration ═══
const AI_ENDPOINT = 'https://moneyradar-ai-proxy.thinkbigtw.workers.dev/thinkbig-chat';
const LINE_CS = 'https://lin.ee/n5KW430';
let chatHistory = []; // {role, content}
let isLoading = false;
let userLang = 'zh-TW'; // Default

// ═══ IP-based Language Detection ═══
// Translations for hero section
const HERO_I18N = {
  'zh-TW': {
    title: '您好！我是 Hermes',
    intro: 'Think BIG! 的 AI 助理 · Powered by 我們自家的 OpenClaw + Claude Code 引擎',
    servicesLabel: '🎯 我們目前提供三大服務：',
    s1: 'AI Agent ERP — 全球首創 AI Native 企業系統',
    s2: '企業 AI 導入 — RAG / Agent / 流程自動化',
    s3: 'Harness Engineers — 個人 AI 搭建',
    askPrompt: '隨時問我任何問題，或點下方快速選項 👇',
    placeholder: '問我任何問題，例如：ERP 月費多少？',
    qs1: 'AI Agent ERP 有什麼？', qs1s: '11 大模組 · 三階方案',
    qs2: '我想導入 AI 自動化', qs2s: '企業方案推薦',
    qs3: '和鼎新、SAP 比？', qs3s: '差異化優勢',
    qs1q: '告訴我 AI Agent ERP 有什麼模組？定價是多少？',
    qs2q: '我是中小企業老闆，想導入 AI Agent，請問適合什麼方案？',
    qs3q: 'Think BIG 和鼎新數智、SAP 比起來，優勢在哪？',
    footer: '由 AI 即時驅動 · 若需專人服務請洽',
  },
  'en': {
    title: 'Hello! I\'m Hermes',
    intro: 'Think BIG!\'s AI Assistant · Powered by our OpenClaw + Claude Code engine',
    servicesLabel: '🎯 We offer three core services:',
    s1: 'AI Agent ERP — World\'s first AI-Native enterprise system',
    s2: 'Enterprise AI — RAG / Agent / Automation',
    s3: 'Harness Engineers — Personal AI Agent builder',
    askPrompt: 'Ask me anything, or pick a quick option below 👇',
    placeholder: 'Ask me anything, e.g.: How much is ERP monthly?',
    qs1: 'What\'s in AI Agent ERP?', qs1s: '11 modules · 3 tiers',
    qs2: 'I want AI automation', qs2s: 'Enterprise solutions',
    qs3: 'vs SAP / Digiwin?', qs3s: 'Our advantages',
    qs1q: 'Tell me about AI Agent ERP modules and pricing.',
    qs2q: 'I run a SMB and want to adopt AI Agent. Which plan suits me?',
    qs3q: 'How does Think BIG compare to SAP and Digiwin?',
    footer: 'Powered by AI · For human support contact',
  },
  'ja': {
    title: 'こんにちは！Hermes です',
    intro: 'Think BIG! の AI アシスタント · OpenClaw + Claude Code エンジン搭載',
    servicesLabel: '🎯 3 つのコアサービスを提供しています：',
    s1: 'AI Agent ERP — 世界初の AI ネイティブ企業システム',
    s2: '企業向け AI 導入 — RAG / Agent / 自動化',
    s3: 'Harness Engineers — 個人向け AI エージェント構築',
    askPrompt: 'お気軽にご質問ください、または下のオプションをタップ 👇',
    placeholder: 'ご質問をどうぞ。例：ERP の月額は？',
    qs1: 'AI Agent ERP の内容は？', qs1s: '11 モジュール · 3 段階',
    qs2: 'AI 自動化を導入したい', qs2s: '企業向けプラン',
    qs3: 'SAP / 鼎新と比較？', qs3s: '優位性',
    qs1q: 'AI Agent ERP のモジュールと価格を教えてください。',
    qs2q: '中小企業の経営者です。AI Agent 導入にどのプランが最適ですか？',
    qs3q: 'Think BIG は SAP や鼎新と比べてどんな優位性がありますか？',
    footer: 'AI 駆動 · サポートは',
  }
};

// Detect user language from IP / browser
async function detectLanguage(){
  try {
    // First check browser language
    const browserLang = (navigator.language || 'zh-TW').toLowerCase();
    if(browserLang.startsWith('ja')) return 'ja';
    if(browserLang.startsWith('zh')) return 'zh-TW';
    
    // Then try IP-based detection (Cloudflare provides cf-ipcountry header but we need another way)
    // Use a free geo IP service with timeout
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 2000);
    
    const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
    if(res.ok){
      const data = await res.json();
      const country = (data.country_code || '').toUpperCase();
      if(country === 'TW' || country === 'HK' || country === 'CN' || country === 'MO' || country === 'SG') return 'zh-TW';
      if(country === 'JP') return 'ja';
      return 'en';
    }
  } catch(e){
    // Fall back to browser default
    const lang = (navigator.language || 'zh-TW').toLowerCase();
    if(lang.startsWith('ja')) return 'ja';
    if(lang.startsWith('zh')) return 'zh-TW';
    return 'en';
  }
  return 'zh-TW';
}

// Apply language to UI
function applyLanguage(lang){
  userLang = lang;
  const t = HERO_I18N[lang] || HERO_I18N['zh-TW'];
  
  const hero = document.getElementById('hero-welcome');
  if(hero){
    document.getElementById('hero-title').textContent = t.title;
    document.getElementById('hero-desc').innerHTML = `${t.intro}<br><br>
      <strong style="color:#fff">${t.servicesLabel}</strong><br>
      <span style="color:rgba(232,66,42,0.9)">①</span> <strong>${t.s1}</strong><br>
      <span style="color:rgba(232,66,42,0.9)">②</span> <strong>${t.s2}</strong><br>
      <span style="color:rgba(232,66,42,0.9)">③</span> <strong>${t.s3}</strong><br><br>
      ${t.askPrompt}`;
  }
  
  // Update quick suggestions
  const qsItems = document.querySelectorAll('#hero-welcome .qs');
  const qsKeys = ['qs1', 'qs2', 'qs3'];
  const qsQs = ['qs1q', 'qs2q', 'qs3q'];
  qsItems.forEach((item, i) => {
    const textEl = item.querySelector('.qs-text');
    const smallEl = textEl.querySelector('small');
    const smallText = t[qsKeys[i] + 's'];
    textEl.innerHTML = `${t[qsKeys[i]]}<small>${smallText}</small>`;
    item.setAttribute('onclick', `askQuick('${t[qsQs[i]].replace(/'/g, "\\'")}')`);
  });
  
  // Update input placeholder
  const input = document.getElementById('chat-msg');
  if(input) input.placeholder = t.placeholder;
  
  // Update footer
  const footer = document.querySelector('#ai-chat .chat-footer');
  if(footer) footer.innerHTML = `${t.footer} <a href="${LINE_CS}" target="_blank">LINE</a>`;
  
  // Set HTML lang attribute
  document.documentElement.lang = lang === 'zh-TW' ? 'zh-Hant' : lang;
}

// Run language detection on page load
detectLanguage().then(applyLanguage);


function toggleChat(){
  const chat = document.getElementById('ai-chat');
  chat.classList.toggle('open');
  if(chat.classList.contains('open')){
    setTimeout(() => document.getElementById('chat-msg').focus(), 300);
  }
}

// ESC to close
document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape' && document.getElementById('ai-chat').classList.contains('open')){
    toggleChat();
  }
});

function escapeHtml(s){
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Convert URLs and markdown-style links to HTML links
function linkify(text){
  let html = escapeHtml(text);
  // URL 偵測：遇到中文字、全形/半形標點、逗號即停止；支援無 scheme 的 lin.ee / www.
  const urlRegex = /(https?:\/\/[^\s一-鿿，。、；：！？「」『』（）(),]+|(?:www\.|lin\.ee\/)[^\s一-鿿，。、；：！？「」『』（）(),]+)/g;
  html = html.replace(urlRegex, (url) => {
    const clean = url.startsWith('http') ? url : 'https://' + url;
    return '<a href="' + clean + '" target="_blank" rel="noopener" style="color:#e8422a;text-decoration:underline;word-break:break-all">' + url + '</a>';
  });
  // **bold**
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  return html;
}

function appendMsg(role, content, isLoading = false){
  const body = document.getElementById('chat-body');
  // Remove hero on first message
  const hero = document.getElementById('hero-welcome');
  if(hero) hero.remove();
  
  const row = document.createElement('div');
  row.className = `msg-row ${role}`;
  
  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = role === 'bot' ? '🦞' : 'You';
  
  const msg = document.createElement('div');
  msg.className = `msg ${role}`;
  
  if(isLoading){
    msg.innerHTML = '<div class="typing-dots"><span></span><span></span><span></span></div>';
    msg.id = 'loading-msg';
  } else {
    msg.innerHTML = linkify(content);
  }
  
  row.appendChild(avatar);
  row.appendChild(msg);
  body.appendChild(row);
  body.scrollTop = body.scrollHeight;
  return msg;
}

// ─── 罐頭回覆（任務 8 / 9：逐字內容，點按鈕即時顯示，不經 AI 確保一字不差）───
const ABOUT_THINKBIG = `您好,謝謝您對 Think BIG 有興趣!

Think BIG 是台灣 AI 自動化顧問公司,由 NEO.W 創辦,專注幫助中小企業與個人創業者把 AI 真正落地到日常工作中。

我們相信 AI 不應該只是聊天工具,而是要能真的幫您工作、回客人、跑流程。所以我們提供「會做事的 AI」,不是「會講話的 AI」。

【核心優勢】
- 自家引擎 OpenClaw + Claude Code,不是套別人的殼
- 從個人戶到中大型企業都有對應方案
- 全程繁體中文支援,台灣團隊在地服務
- 透明定價、明確交付、七天免費維護

【三大服務】
① AI Agent ERP — 全球首創 AI Native 企業系統
② 企業 AI 導入 — RAG / Agent / 流程自動化
③ Harness Engineers — 個人 AI 搭建

想了解更多,可以隨時問我任何問題,或點上方快速選項 👇`;

const ADOPT_AI = `您好!很高興您想導入 AI Agent。在推薦方案前,我先讓您快速認識一下我們的引擎:

━━━━━━━━━━━━━━━━━━━━

🦞 OpenClaw — 會做事的 AI Agent 框架

OpenClaw(又稱「龍蝦 AI」)是一款開源的 AI Agent 框架,能讓 AI 直接操作電腦、瀏覽器與應用程式來完成任務,而不只是對話。

【它跟 ChatGPT 有什麼不同】
ChatGPT 是「會說的 AI」,OpenClaw 是「會做的 AI」。ChatGPT 給你 PPT 大綱,OpenClaw 直接打開軟體做出 PPT、寄給客戶。

【七大核心特色】
① 多通路整合:賴 OA / tele 紙飛機 / WhatsApp / Slack / Discord
② 長期記憶:保留使用者互動歷史,個人化服務
③ 主動執行:透過排程與 webhook,自動發起任務
④ 高權限操作:可直接存取系統與檔案
⑤ 簡單設置:支援快速連接帳號與服務
⑥ 可擴展技能(Skills):任務封裝後重複使用
⑦ 語音互動:支援語音喚醒與通話模式

【生態系規模】
ClawHub 已有超過 4 萬個社群貢獻的 Skills

━━━━━━━━━━━━━━━━━━━━

⚡ Hermes — 越用越聰明的自學習 AI

Hermes Agent(愛馬仕 Agent)由 Nous Research 開發,採 MIT 授權。

【核心概念:程序性記憶】
每次完成任務後,系統自動將成功的推理模式萃取為「技能」,下次直接調用並持續優化。

傳統 AI 助理像是每天換一個新實習生,Hermes 則像一位跟著您越做越熟練的長期助理。

【五階段學習迴圈】
① 執行任務 ② 評估結果 ③ 萃取技能 ④ 優化技能 ⑤ 檢索技能

【跨對話追蹤四件事】
① 格式偏好 ② 決策紀錄 ③ 任務模式 ④ 回饋訊號

用一句話理解:一般 AI 記住「您說過什麼」,Hermes 記住「怎麼做最有效」。

━━━━━━━━━━━━━━━━━━━━

🧠 ClawMem — 雙 Agent 的共享大腦

ClawMem 是本地的記憶層,讓 Claude Code、OpenClaw、Hermes 共用同一個 SQLite 倉庫。一個 agent 學到的決定,另一個 agent 立即知道。

【關鍵價值】
完全在本地運行,沒有 API Key,沒有雲端依賴,隱私 100% 留在您電腦。

【自動做的事】
① 自動浮現相關上下文
② Session 啟動時注入您的個人檔案、最近決策
③ 用本地觀察模型擷取決策、偏好、里程碑
④ Session 結束時生成交接,讓下次接續工作
⑤ 透過回饋迴圈學習什麼重要
⑥ 防護 prompt injection 攻擊
⑦ 偵測矛盾:新決策若與舊決策矛盾,自動降權舊決策

━━━━━━━━━━━━━━━━━━━━

🦞+⚡+🧠 雙 Agent 完整方案

把 OpenClaw + Hermes + ClawMem 三者合在一起,就是我們最強大的「雙 Agent 方案」:

- OpenClaw 負責「廣連接」 — 對外接通訊軟體、跑日常任務
- Hermes 負責「深學習」 — 累積您的工作風格與技能
- ClawMem 是兩者共享的大腦 — 記憶 100% 同步

成果:一個跨平台、自學習、共享記憶、且資料完全留在您電腦的 AI 員工。

━━━━━━━━━━━━━━━━━━━━

🎯 推薦方案前,我需要先了解一件事:

您是個人使用,還是公司/企業使用?

⚠️ 重要提醒:個人方案僅可對接最多兩個通訊軟體帳號。如需對接三人以上(例如多個業務、多個客服),就需要企業方案。

請告訴我您的情境,我幫您推薦最合適的組合!`;

const CANNED = {
  '關於 Think BIG': ABOUT_THINKBIG,
  '我想導入 AI 自動化': ADOPT_AI
};

function askQuick(question){
  // 命中罐頭內容 → 即時顯示(不打 AI),並寫入對話歷史供後續追問
  if (CANNED[question]){
    appendMsg('user', question);
    chatHistory.push({role:'user', content: question});
    appendMsg('bot', CANNED[question]);
    chatHistory.push({role:'assistant', content: CANNED[question]});
    return;
  }
  document.getElementById('chat-msg').value = question;
  sendMsg();
}

async function sendMsg(){
  if(isLoading) return;
  
  const input = document.getElementById('chat-msg');
  const sendBtn = document.getElementById('send-btn');
  const text = input.value.trim();
  if(!text) return;
  
  // Show user message
  appendMsg('user', text);
  input.value = '';
  isLoading = true;
  sendBtn.disabled = true;
  
  // Add to history
  chatHistory.push({role: 'user', content: text});
  
  // Show typing indicator
  const loadingMsg = appendMsg('bot', '', true);
  
  try {
    const response = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({messages: chatHistory})
    });
    
    if(!response.ok){
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const reply = data.reply || '抱歉，我這邊發生了一些問題，請直接聯絡客服：' + LINE_CS;
    
    // Replace loading with real response
    loadingMsg.innerHTML = linkify(reply);
    loadingMsg.removeAttribute('id');
    
    // Add to history
    chatHistory.push({role: 'assistant', content: reply});
    
    // Keep history under 20 messages
    if(chatHistory.length > 18){
      chatHistory = chatHistory.slice(-18);
    }
    
  } catch(err){
    console.error('AI error:', err);
    loadingMsg.innerHTML = linkify(`抱歉，AI 助理暫時無法回應 😔\n\n請直接聯絡我們的客服中心：${LINE_CS}\n\n錯誤代碼：${err.message}`);
    loadingMsg.removeAttribute('id');
  } finally {
    isLoading = false;
    sendBtn.disabled = false;
    document.getElementById('chat-body').scrollTop = document.getElementById('chat-body').scrollHeight;
    input.focus();
  }
}


  // ---- 4. 將 onclick handlers 掛到全域 ----
  window.toggleChat = toggleChat;
  window.sendMsg = sendMsg;
  window.askQuick = askQuick;
})();
