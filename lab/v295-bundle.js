/* MoneyRadar v295 — 法律合規包
 * 1. ⚠️ 投資免責 banner（首次訪問必跳）
 * 2. 🔗 footer 加 TOS / PP 連結
 * 3. 🍪 Cookie 同意彈窗（GDPR/PIPL 合規）
 * 4. 📜 AI 輸出後綴免責（自動加在所有 AI response 底下）
 */
(function () {
  'use strict';
  function V295_$(id) { return document.getElementById(id); }
  function V295_el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }

  // ============================================================
  // 1. ⚠️ 首次訪問投資免責彈窗
  // ============================================================
  function V295_showDisclaimer() {
    if (localStorage.getItem('mr_v295_disclaimer_accepted')) return;
    const modal = V295_el(`<div id="v295-disclaimer" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.85);z-index:999999;display:flex;align-items:center;justify-content:center">
      <div style="background:#1a1a2e;padding:32px;border-radius:12px;width:600px;max-width:92vw;max-height:90vh;overflow-y:auto;border:2px solid #fbbf24">
        <h2 style="color:#fbbf24;margin:0 0 16px 0;text-align:center">⚠️ 重要免責聲明</h2>
        <div style="color:#e0e0ff;line-height:1.7;font-size:14px">
          <p><b>使用 MoneyRadar 前請仔細閱讀以下聲明：</b></p>
          <ol style="padding-left:20px">
            <li><b>本網站僅供教育與資訊參考</b>，所有資訊（股價、技術指標、AI 分析、投資建議）<b>不構成任何投資建議</b>。</li>
            <li><b>Think BIG! 並非經金管會核准之證券投資顧問事業</b>，不收取顧問費用，亦不代客操盤。</li>
            <li><b>所有 AI 輸出均為演算法產出</b>，可能存在錯誤、偏見或失準，使用者應自行判斷並承擔風險。</li>
            <li><b>投資涉及風險</b>，過去績效不代表未來表現。投資人應自行評估風險承受能力。</li>
            <li><b>資料延遲與準確性</b>：本站資料來自第三方 API（Yahoo Finance、TPEx、TWSE 等），可能有延遲或誤差。</li>
            <li><b>最終投資決定</b>應諮詢具備合格證照之理財顧問。</li>
            <li><b>遵守當地法律</b>：使用者應遵守所在國家／地區之證券、稅務、外匯相關法規。</li>
          </ol>
          <p style="color:#fbbf24;font-weight:bold">本服務基於聖經誠實正直原則營運，不對使用者投資結果負任何法律責任。</p>
        </div>
        <div style="margin-top:20px">
          <label style="display:flex;align-items:center;gap:8px;color:#fff;cursor:pointer">
            <input type="checkbox" id="v295-agree" style="width:18px;height:18px">
            <span>我已閱讀並同意上述免責聲明、<a href="/terms.html" target="_blank" style="color:#4ade80">服務條款</a>、<a href="/privacy.html" target="_blank" style="color:#4ade80">隱私政策</a></span>
          </label>
          <button id="v295-accept" disabled style="width:100%;margin-top:16px;padding:12px;background:#666;color:#fff;border:none;border-radius:6px;cursor:not-allowed;font-weight:bold;font-size:15px">請先勾選同意</button>
        </div>
      </div>
    </div>`);
    document.body.appendChild(modal);
    const cb = V295_$('v295-agree');
    const btn = V295_$('v295-accept');
    cb.onchange = () => {
      if (cb.checked) {
        btn.disabled = false;
        btn.style.background = '#4ade80';
        btn.style.color = '#000';
        btn.style.cursor = 'pointer';
        btn.textContent = '✅ 同意並繼續使用';
      } else {
        btn.disabled = true;
        btn.style.background = '#666';
        btn.style.cursor = 'not-allowed';
        btn.textContent = '請先勾選同意';
      }
    };
    btn.onclick = () => {
      localStorage.setItem('mr_v295_disclaimer_accepted', new Date().toISOString());
      modal.remove();
    };
  }

  // ============================================================
  // 2. 🔗 Footer
  // ============================================================
  function V295_addFooter() {
    if (V295_$('mr-v295-footer')) return;
    const footer = V295_el(`<footer id="mr-v295-footer" style="margin-top:48px;padding:24px;background:#0a0a1e;border-top:1px solid #333;text-align:center;color:#888;font-size:12px">
      <div style="margin-bottom:12px">
        <a href="/terms.html" target="_blank" style="color:#888;margin:0 8px">服務條款</a> |
        <a href="/privacy.html" target="_blank" style="color:#888;margin:0 8px">隱私政策</a> |
        <a href="/disclaimer.html" target="_blank" style="color:#888;margin:0 8px">投資免責</a> |
        <a href="mailto:neowu1031@gmail.com" style="color:#888;margin:0 8px">聯絡我們</a>
      </div>
      <div style="margin-bottom:8px;color:#666">
        ⚠️ 本網站資訊僅供參考，不構成任何投資建議。投資涉及風險，請審慎評估。
      </div>
      <div style="color:#444">
        © 2026 Think BIG! — MoneyRadar™ — 基督徒誠信經營 · Soli Deo Gloria
      </div>
    </footer>`);
    document.body.appendChild(footer);
  }

  // ============================================================
  // 3. 🍪 Cookie 同意
  // ============================================================
  function V295_showCookieBanner() {
    if (localStorage.getItem('mr_v295_cookie_accepted')) return;
    const banner = V295_el(`<div id="v295-cookie" style="position:fixed;bottom:0;left:0;right:0;background:#1a1a2e;border-top:2px solid #4ade80;padding:16px;z-index:99998;display:flex;align-items:center;gap:16px;flex-wrap:wrap;justify-content:center">
      <span style="color:#fff;font-size:13px">🍪 本網站使用必要 Cookie 以維持服務正常運作。我們不追蹤您的個人資料。</span>
      <button id="v295-cookie-accept" style="padding:8px 16px;background:#4ade80;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold">同意</button>
      <a href="/privacy.html" target="_blank" style="color:#4ade80;font-size:13px">了解更多</a>
    </div>`);
    document.body.appendChild(banner);
    V295_$('v295-cookie-accept').onclick = () => {
      localStorage.setItem('mr_v295_cookie_accepted', new Date().toISOString());
      banner.remove();
    };
  }

  // ============================================================
  // 4. 📜 自動加 AI 輸出免責後綴
  // ============================================================
  function V295_autoAppendDisclaimer() {
    // MutationObserver 監聽所有 AI 回應 div
    const observer = new MutationObserver(mutations => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          const aiContent = node.querySelector?.('[data-ai-output]') || (node.matches?.('[data-ai-output]') ? node : null);
          if (aiContent && !aiContent.dataset.disclaimerAdded) {
            aiContent.dataset.disclaimerAdded = '1';
            const disc = V295_el(`<div style="margin-top:12px;padding:8px;background:#1a0f0f;border-left:3px solid #fbbf24;color:#888;font-size:11px;border-radius:4px">⚠️ AI 分析結果僅供參考，不構成投資建議。投資前請自行判斷並諮詢合格理財顧問。</div>`);
            aiContent.appendChild(disc);
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ============================================================
  // 啟動
  // ============================================================
  function V295_init() {
    V295_showDisclaimer();
    V295_addFooter();
    V295_showCookieBanner();
    V295_autoAppendDisclaimer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', V295_init);
  } else {
    V295_init();
  }

  console.log('[MoneyRadar v295] ⚖️ 法律合規包載入');
})();
