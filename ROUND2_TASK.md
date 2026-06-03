# Think BIG 官網修復指令(這輪 6 條)

## 工作前
```bash
cd ~/Desktop/thinkbigtw
git pull origin main --no-rebase
```

---

## 全域鐵律
- 中文 Noto Sans TC、英文 Space Mono
- 不用簡體字
- 每改一個檔案,用 grep 或 head/tail 驗證確實寫進去
- lab/index.html 這次**可以動**(修 UI bug)

---

## 任務 1:全站拿掉頁面中間所有 ASK AI 大按鈕

**範圍**:所有對外頁(enterprise、harness、clawland、lobster、gift、v2、subsidy、index.html 等)

**搜尋並移除以下 pattern 的整個元素**:
1. `grep -rn "ASK AI\|ask-ai\|askAI" --include="*.html" .` 先找出全部位置
2. 移除**頁面中間**的大矩形 ASK AI 按鈕(通常是 `<a>` 或 `<button>` 包著「ASK AI」文字,或整個含 ASK AI 按鈕的 `<section>`)
3. 移除「想知道哪一種適合你?」+「ASK AI」那類收尾區塊
4. 移除 class 含 `ask-ai-closing`、`cta-sec` 中有 ASK AI 按鈕的整個 section

**不要動**:
- `ask-ai.js` 本身
- 右下角浮動圓鈕注入的 HTML(那是 ask-ai.js 動態注入的,不在各頁 HTML 裡)
- Hermes 對話框觸發點

**驗收**:
```bash
grep -rn "ASK AI" --include="*.html" . | grep -v "lab/" | grep -v "erp/"
```
結果只應該出現右下角圓鈕相關的 script 載入,不應該有頁面中間的大按鈕

---

## 任務 2:右下角 ASK AI 圓鈕樣式修正

**問題**:目前圓鈕樣式不對。

**正確樣式**(依據設計參考圖):
- **形狀**:正圓,`width: height`(兩個要一樣,建議 72px 桌面 / 64px 手機)
- **背景**:黑色 `#000` 或深色 `#0a0a0a`
- **邊框**:橘紅色圓環,`border: 2px solid #e8422a`
- **發光效果**:`box-shadow: 0 0 12px rgba(232, 66, 42, 0.6), 0 0 24px rgba(232, 66, 42, 0.3)`
- **文字**:ASK 在上、AI 在下,分兩行,白色 `#fff`,Space Mono 字型,字體大小 11-12px,置中
- **位置**:`position: fixed; right: 24px; bottom: 24px; z-index: 9999`
- **hover 效果**:`box-shadow` 加強 + `transform: scale(1.05)`
- **手機版(≤768px)**:大小縮至 60px × 60px,right/bottom 改 16px

**做法**:
1. 打開 `ask-ai.js`
2. 找到圓鈕的 CSS(通常在 JS 裡動態注入的 `<style>` 或 inline style)
3. 照上面規格修改
4. 確認手機 + 桌面都符合

**驗收**:Chrome DevTools → iPhone 14 Pro → 開 `thinkbigtw.com`,右下角應該是正圓 + 橘紅發光圓環 + ASK/AI 兩行白字

---

## 任務 3:手機版 ASK AI 點擊後全螢幕展開

**問題**:手機版點擊 ASK AI 後,Hermes 對話框以小視窗呈現,不夠好用。

**要做的**:在 `ask-ai.js` 裡,偵測到 viewport ≤ 768px 時:
- 點擊 ASK AI 圓鈕後,Hermes 對話框以**全螢幕模式**展開
  - `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 10000`
  - 覆蓋整個畫面,讓使用者可以好好打字
- 右上角要有一個**關閉按鈕**(✕),點了恢復正常
- 桌面版(> 768px)維持現有樣式**不動**

**實作建議**:
```javascript
const isMobile = window.innerWidth <= 768;
if (isMobile) {
  // 開啟時加 class: hermes-fullscreen
  // CSS: .hermes-fullscreen { position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:10000; }
}
```

**驗收**:iPhone 14 Pro viewport → 點右下 ASK AI → 對話框展開成全螢幕 → 右上角有 ✕ → 點 ✕ 縮回

---

## 任務 4:MoneyRadar 手機版右上角 UI 疊層修復

**檔案**:`lab/index.html`

**問題**:手機版右上角「繁中/語言切換」+「白天/黑夜模式」按鈕,與帳號登出按鈕**疊在一起**

**做法**:
1. `grep -n "登出\|logout\|dark\|light\|language\|繁中\|en\b" lab/index.html | head -30` 找出三個按鈕的 HTML 位置
2. 確認三個按鈕的 CSS position/z-index 是否有衝突
3. 手機版(≤768px)調整排版:
   - 方案 A:三個按鈕**水平排成一行**,縮小間距
   - 方案 B:語言 + 日夜模式 **移到 hamburger menu 裡**
   - **選方案 A**(較快),確保三顆並排不重疊
4. 確認 `z-index` 不互相遮蓋

**驗收**:iPhone 14 Pro viewport → 開 `/lab/` → 右上角三個按鈕**各自獨立可見、可點、不重疊**

---

## 任務 5:MoneyRadar 「雲端資料已同步」Toast 修復

**檔案**:`lab/index.html`

**問題**:綠色 Toast「雲端資料已同步!重新整理頁面以查看」無法關閉

**做法**:
1. `grep -n "雲端資料已同步\|syncToast\|cloud-sync\|toast" lab/index.html | head -20` 找到 Toast 的 HTML 和 JS 邏輯
2. 加上兩種關閉機制:
   - **自動消失**:Toast 顯示後 4 秒自動 fade out(`setTimeout` + CSS transition)
   - **手動關閉**:Toast 右上角加一個 ✕ 按鈕,點了立刻消失
3. CSS 範例:
```css
.sync-toast {
  transition: opacity 0.5s ease;
}
.sync-toast.fade-out {
  opacity: 0;
  pointer-events: none;
}
```
4. JS 範例:
```javascript
// 自動消失
setTimeout(() => {
  toast.classList.add('fade-out');
  setTimeout(() => toast.remove(), 500);
}, 4000);

// 手動關閉
closeBtn.addEventListener('click', () => {
  toast.classList.add('fade-out');
  setTimeout(() => toast.remove(), 500);
});
```

**驗收**:開 `/lab/` → 出現 Toast → 4 秒後自動消失 OR 點 ✕ 立刻消失

---

## 任務 6:MoneyRadar 語言切換修復(Worker /translate endpoint)

**問題**:切換語言時出現「translate 400 - Worker /translate 端點需 deploy v282 patch」

**兩步驟**:

### Step A:補 Worker endpoint

打開 `workers/ai-proxy/src/index.js`,加入 `/translate` endpoint:

```javascript
async function handleTranslate(request, env) {
  let body;
  try { body = await request.json(); } 
  catch(e) { return jsonResponse({ error: 'Invalid JSON' }, 400); }

  const { texts, targetLang } = body;
  if (!texts || !Array.isArray(texts) || texts.length === 0) {
    return jsonResponse({ error: 'texts 必填,需為陣列' }, 400);
  }
  if (!targetLang) {
    return jsonResponse({ error: 'targetLang 必填' }, 400);
  }
  if (texts.length > 500) {
    return jsonResponse({ error: '單次最多 500 筆' }, 400);
  }

  const prompt = `你是專業翻譯引擎。把以下 JSON 陣列裡的每個字串翻譯成「${targetLang}」。
只回傳翻譯後的 JSON 陣列,不加任何解釋、不加 markdown。
原始陣列:${JSON.stringify(texts)}`;

  let translated = [];
  let modelUsed = 'llama-3.3-70b';

  try {
    const aiRes = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.1,
    });
    const raw = (aiRes.response || '').trim().replace(/```json|```/g, '').trim();
    translated = JSON.parse(raw);
  } catch(err) {
    try {
      const aiRes = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 3000,
      });
      const raw = (aiRes.response || '').trim().replace(/```json|```/g, '').trim();
      translated = JSON.parse(raw);
      modelUsed = 'llama-3-8b-fallback';
    } catch(err2) {
      return jsonResponse({ error: '翻譯失敗,請稍後再試' }, 500);
    }
  }

  return jsonResponse({
    translated,
    model: modelUsed,
    targetLang,
    count: translated.length,
  });
}
```

並在路由區加上:
```javascript
if (url.pathname === '/translate') return await handleTranslate(request, env);
```

### Step B:部署 Worker

```bash
cd workers/ai-proxy
npx wrangler deploy
cd ../..
```

**驗收**:
```bash
curl -s -X POST https://moneyradar-ai-proxy.thinkbigtw.workers.dev/translate \
  -H "Content-Type: application/json" \
  -d '{"texts":["台股","美股","看盤"],"targetLang":"English"}'
```
應該回傳 `{"translated":["Taiwan Stocks","US Stocks","Market View"],...}`

---

## 最終 commit

```bash
cd ~/Desktop/thinkbigtw
git add .
git commit -m "fix: ASK AI fullscreen mobile, circle style, remove inline CTAs, lab UI bugs, translate endpoint"
git push origin main
```

---

## 驗收清單

- [ ] 全站頁面中間找不到大矩形 ASK AI 按鈕
- [ ] 右下角 ASK AI 圓鈕:正圓 + 橘紅發光圓環 + ASK/AI 兩行白字
- [ ] 手機版點 ASK AI → 全螢幕展開 → ✕ 可關閉
- [ ] `/lab/` 手機版右上角三個按鈕並排不重疊
- [ ] `/lab/` 綠色 Toast 4 秒自動消失 + 有 ✕ 可手動關
- [ ] `/translate` endpoint curl 測試回傳正確翻譯
- [ ] `/lab/` 點語言切換不再出現 400 錯誤

跑完**逐條列出驗收結果**,有任何一條無法完成,停下來告訴我原因,不要硬做。
