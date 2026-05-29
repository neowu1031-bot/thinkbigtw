# Think BIG 官網工程 + Hermes 升級 + Enterprise 流程設計卡升級
## Claude Code 完整任務指令(10 條)

---

## 🎯 總目標

一次完成 10 條任務,全部完成後 `git add . && git commit && git push`。

**Repo**:`~/Desktop/thinkbigtw`(已在 main branch)
**Worker**:`workers/ai-proxy/src/index.js`(部署到 `https://moneyradar-ai-proxy.thinkbigtw.workers.dev`)

**工作前先同步**:
```bash
cd ~/Desktop/thinkbigtw
git pull origin main --no-rebase
```

---

## 📌 全域鐵律(每條任務都要遵守)

1. **字型**:中文用 Noto Sans TC,英文用 Space Mono。**禁用** Syne / Bangers / 其他字型。
2. **不用簡體字**。
3. **不用 emoji** 在三個主頁(`enterprise/`、`harness/`、`erp/`)。Hermes 對話框內 emoji 保留。
4. **保留**:`lab/`、`erp/`、`clawland/admin*/` **完全不動**(這些是工具頁或管理頁)。
5. **每次重大修改前先看現況**:`cat <file> | head -50` 或 `grep -n "<keyword>" <file>` 確認你要改的位置。
6. **每改一個檔案存檔後**:用 `head`、`tail`、或 grep **驗證改動有確實寫進去**,不要假設。

---

## 任務 1:全站拿掉「立即諮詢」按鈕

**範圍**:所有對外頁(`/`、`/enterprise/`、`/harness/`、`/clawland/`、`/lobster/`、`/gift/`、`/v2/`、`/subsidy/`、`/privacy.html`、`/terms.html` 如存在)

**做法**:
1. 用 `grep -rn "立即諮詢\|立即聯絡\|聯絡我們" --include="*.html" .` 找出所有出現位置
2. 對於指向 `lin.ee/n5KW430` 或 LINE 連結、**且文字含「立即諮詢/立即聯絡/聯絡我們」的整個按鈕元素**移除
3. 注意:**右下角的 Hermes 對話框/ASK AI 觸發點不在此範圍**,不要動它

**驗收**:`grep -rn "立即諮詢" --include="*.html" .` 應該完全沒有結果(除了 `lab/`、`erp/`、`admin*/` 之外)

---

## 任務 2:拿掉每頁底部多餘的 ASK AI 收尾

**範圍**:全部對外頁(同任務 1 範圍)

**移除以下 pattern 的整個 section**:
- 含文字「**想知道怎麼開始?請點選右下角 ASK AI**」的 section
- class 含 `ask-ai-closing` 的 section
- class 含 `cta-sec` 且 section 內有 ASK AI 按鈕的整個 section(這些是之前 v2 版本加上去的,現在要全拿掉)

**理由**:右下角已有 ASK AI 圓鈕,下方再放一顆是重複,顯得很突兀。

**驗收**:用 `grep -rn "想知道怎麼開始" --include="*.html" .` 應該完全沒有結果。

---

## 任務 3:右下角 ASK AI 圓鈕必需在每頁顯示

**範圍**:全部對外頁(同任務 1 範圍)
**例外**:`/lab/`、`/erp/` **不要有**(工具頁不該放)

**做法**:
1. 檢查每頁是否載入 `<script src="/ask-ai.js"></script>`(或對應相對路徑)
2. 沒載入的頁面加上
3. 已載入的不要重複加
4. 確認 `/lab/index.html` 跟 `/erp/index.html` **沒有**載入這支(若有要移除)

**驗收**:用瀏覽器(或 grep)確認每個對外頁都有 `ask-ai.js`,而 `lab/`、`erp/` 沒有。

---

## 任務 4:統一導覽列(每頁最上 + 最下)

**範圍**:全部對外頁
**例外**:`/lab/`、`/erp/`(這兩頁不需要動)

**從 `index.html` 抽出右上角的導覽結構**:
- 左上 Logo:`THINK BIG! MAKE IT REAL.`(連到 `/`)
- 右上四個連結:
  - `MONEYRADAR` → `/lab/`
  - `ENTERPRISE` → `/enterprise/`
  - `HARNESS ENGINEERS` → `/harness/`
  - `AI ERP` → `/erp/`

**字型**:Space Mono(英文)。配色不要硬黑底貼到白底頁面。

**做法選擇**(挑「最穩、後續好維護」):

**建議方案 A:寫成獨立 JS 注入器**
- 建立 `/partials/nav-injector.js`
- 包含頂部 nav HTML + 底部 nav HTML + 注入邏輯
- 在頁面 DOMContentLoaded 時自動把 nav 插進每個頁面的 body 開頭跟 footer 之前
- 每個對外頁載入 `<script src="/partials/nav-injector.js"></script>`(或對應相對路徑)
- 注入器內部要偵測「當前頁面是 `/lab/` 或 `/erp/`」就**跳過注入**

**也可以選方案 B**:直接複製貼上 nav HTML 到每個 HTML 檔(較不優雅但最穩),自己評估後挑一個,做完跟我說選哪個跟原因。

**底部 nav 比較精簡**:Logo + 4 連結 + Copyright(© 2026 Think BIG)一行。

**驗收**:
1. 在桌面 + 手機 viewport 開 `/enterprise/`、`/harness/`、`/clawland/`、`/lobster/`、`/gift/`,**頂部跟底部都應該有導覽列**
2. `/lab/` 跟 `/erp/` **不應該有**

---

## 任務 5:修手機版右下 ASK AI 圓鈕

**問題**:目前手機版右下 ASK AI 圓鈕形狀跟字看起來沒弄好(可能溢位或變形)

**修正範圍**:`ask-ai.js`(或頁面內 inline 的 ASK AI 圓鈕 CSS)

**修正規則**:
- 在 viewport ≤ 768px 時:
  - 圓鈕 `width` = `height`(保持正圓)
  - 文字「ASK AI」不溢出、不換行錯位
  - `z-index` 至少 9999(不被其他元素遮蓋)
  - `position: fixed`,`right: 20-24px`,`bottom: 20-24px`(不貼邊太近)
  - 字體大小縮小到 viewport 適合的尺寸

**先**:打開 `ask-ai.js` 看現有 CSS,**直接改現有的**,不要重寫整個檔案。

**驗收**:
1. Chrome DevTools 切到 iPhone 14 Pro viewport(393×852)
2. 開 `/enterprise/`,右下角 ASK AI 圓鈕應該是正圓 + 字不溢出 + 點得到

---

## 任務 6:Hermes 對話框 LINE 連結 404 修復

**問題**:Hermes 回覆中,LINE 連結後面緊接中文字(例如「`https://lin.ee/n5KW430,把編號傳給我們就好,NEO`」),瀏覽器把整段都當 URL,導致 404。

**修法**(走方案 B:改前端渲染,徹底解決所有未來連結問題):

在 `ask-ai.js`(或 Hermes 前端訊息渲染器)的訊息顯示函式裡:

加一段 **URL 自動偵測 + 轉換為 `<a>` 標籤**的 regex 處理。範例邏輯:

```javascript
function linkify(text) {
  // 偵測 http://, https://, lin.ee/, www. 開頭的 URL
  const urlRegex = /(https?:\/\/[^\s\u4e00-\u9fff,。、,]+|lin\.ee\/[^\s\u4e00-\u9fff,。、,]+)/g;
  return text.replace(urlRegex, (url) => {
    const cleanUrl = url.startsWith('http') ? url : 'https://' + url;
    return `<a href="${cleanUrl}" target="_blank" rel="noopener" style="color:#e8422a;text-decoration:underline;word-break:break-all;">${url}</a>`;
  });
}
```

關鍵:
- regex 在遇到**中文字、逗號、句號、頓號、全形標點**時就停止抓 URL
- URL 抓出來後包成可點 `<a>` 標籤
- 套用到所有 AI 訊息渲染(不只 LINE 連結,所有 URL 都要處理)

**測試 case**:
- 輸入「請加我們 LINE:https://lin.ee/n5KW430,把編號傳給我們」
- 預期:`lin.ee/n5KW430` 是可點連結,後面「,把編號傳給我們」是純文字
- 點擊連結應該開啟正確網址(不會 404)

---

## 任務 7:Hermes 4 個快速選項常駐 + 排版

**目前狀態**:Hermes 開場 4 個快速選項,點了會消失

**要做的**:
1. **拿掉**第 4 個「**和鼎新、SAP 比?**」按鈕
2. **新增**新的第 4 個「**關於 Think BIG**」按鈕
3. **4 個按鈕常駐**:點選後**不消失**,讓客戶可以隨時點其他選項
4. **桌面版排版**:**一行 4 顆**並排(不換行)
5. **手機版排版**:`viewport ≤ 768px` 時,自動變 **2x2 排列**(避免擠成一團)

**4 個按鈕的最終文字**:

| 按鈕主標 | 副標(灰字) |
|---|---|
| AI Agent ERP 有什麼? | 11 大模組·三階方案 |
| MoneyRadar™ 怎麼用? | 全球頂尖看盤神器 |
| 我想導入 AI 自動化 | 企業方案推薦 |
| **關於 Think BIG** | **公司介紹·四大服務** |

**CSS 要求**:
- 桌面版:`display: flex; flex-wrap: nowrap; gap: 12px;` 一行擺下
- 字體適度縮小確保 4 顆並排不擠出畫面
- 手機版:`flex-wrap: wrap;` + 每顆 `width: calc(50% - 6px);` 變 2x2
- 點選後按鈕**保留**(不要 `display:none` 也不要從 DOM 移除)

---

## 任務 8:Hermes 新增「關於 Think BIG」回答內容

**觸發條件**:當客戶點「關於 Think BIG」按鈕,或自由輸入「你們公司是?」「介紹一下你們」「about think big」等類似問題

**Hermes 應回覆的完整內容**(請寫進 Hermes 後端 system prompt 或回應邏輯):

```
您好,謝謝您對 Think BIG 有興趣!

Think BIG 是台灣 AI 自動化顧問公司,由 NEO.W 創辦,專注幫助中小企業與個人創業者把 AI 真正落地到日常工作中。

我們相信 AI 不應該只是聊天工具,而是要能真的幫您工作、回客人、跑流程。所以我們提供「會做事的 AI」,不是「會講話的 AI」。

【核心優勢】
- 自家引擎 OpenClaw + Claude Code,不是套別人的殼
- 從個人戶到中大型企業都有對應方案
- 全程繁體中文支援,台灣團隊在地服務
- 透明定價、明確交付、七天免費維護

【四大服務】
① AI Agent ERP — 全球首創 AI Native 企業系統
② MoneyRadar™ — 全球頂尖 AI 看盤神器
③ 企業 AI 導入 — RAG / Agent / 流程自動化
④ Harness Engineers — 個人 AI 搭建

想了解更多,可以隨時問我任何問題,或點上方快速選項 👇
```

**重點**:
- 不要寫「台灣**本土**」→ 統一寫「**台灣 AI 自動化顧問公司**」
- 創辦人寫 **NEO.W**(不是 Stanley Wu、不是 Neo Wu)
- 不要編造客戶案例(沒授權的不能寫)

---

## 任務 9:Hermes「我想導入 AI 自動化」引導式回答

**觸發條件**:客戶點「我想導入 AI 自動化」、自由輸入「我想用 AI」「想自動化我的工作」「導入 AI Agent」等類似意圖

**Hermes 應回覆的完整內容**(請寫進後端 system prompt + 知識庫):

````
您好!很高興您想導入 AI Agent。在推薦方案前,我先讓您快速認識一下我們的引擎:

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

請告訴我您的情境,我幫您推薦最合適的組合!
````

**重點**:
- 用詞要用「**賴 OA / tele 紙飛機**」(蝦皮安全用詞,避免出現 LINE/Telegram 原字)
- 結尾**必須**問「個人 or 企業」,且**必須**提醒兩個帳號上限
- 不要編造客戶案例

---

## 任務 10:Enterprise 流程設計卡升級(32 產業範本 + Worker AI 即時生成)

### 10A. 統一範本結構(每個產業都用這個格式)

```
━━━━━━━━━━━━━━━━━━━━
產業名稱(例如:美容 / SPA / 沙龍)

【目前痛點】(3-4 條,每條要具體、有情境、有數字感)
- 痛點 1:具體描述(例:電話預約漏接率約 X%,客人轉去競爭對手)
- 痛點 2:具體描述
- 痛點 3:具體描述

【AI 可以接手的流程】(4 項,每項都要有完整資訊)

功能 1 名稱
- 描述:一句話說明 AI 怎麼處理(15-25 字)
- 串接系統:賴 OA + 您的 CRM + Google Calendar(看實際需求)
- 串接流程:
  ① 取得授權(賴 OA Channel Access Token / Google OAuth)
  ② 設定觸發條件(時間 / 客戶動作 / 關鍵字)
  ③ AI 學習(餵您過去的回應範例)
  ④ 上線測試 → 微調 → 正式運行
- 資安規格:
  ▸ 傳輸:TLS 1.3 加密
  ▸ 儲存:本地 AES-256 加密 SQLite
  ▸ 個資:符合台灣個資法 + 權限分級存取
  ▸ 備份:每日自動備份,7 天滾動保留
- 預估工期:3-7 工作天(複雜功能 1-2 週)
- 預期效益:具體量化(例:回應速度 5 分鐘→10 秒,回購率提升 20%)

功能 2 / 3 / 4 同上格式

【為您規劃的三階段路線圖】

第一階段(立即上線,1-2 週):
- 完成功能 1 + 功能 2
- 立即見效項目

第二階段(成熟運作,1-2 個月):
- 完成功能 3
- 累積資料後可優化的項目

第三階段(規模擴張,3-6 個月):
- 完成功能 4
- 跨平台 / 跨團隊延伸

【預期效益(可量化)】
- 時間節省:每月省 X-Y 小時人力(原本 X 小時 → 縮減到 Y 小時)
- 營收提升:轉換率 / 回購率 / 客單價 提升 X-Y%
- 客戶體驗:回應速度 X 分鐘 → X 秒;24 小時可用
- ROI 估算:導入成本回收期約 X-Y 個月

【適合搭配的方案】
- 個人方案 / 企業方案 / 雙 Agent 方案
- 月維護費區間(可選)
━━━━━━━━━━━━━━━━━━━━
```

### 10B. 32 個熱門產業清單

請建立 `enterprise/industry-templates.json`(或寫進 Worker),依下方清單**全部生成**,每個都依 10A 結構填完整內容:

**服務業 (8)**:
1. 美容 / SPA / 沙龍
2. 美髮 / 美甲
3. 健身 / 瑜珈 / 教練
4. 補習班 / 安親班
5. 才藝教室
6. 寵物美容 / 寵物店
7. 婚紗攝影 / 攝影工作室
8. 汽車美容 / 修車廠

**餐飲業 (5)**:
9. 餐廳 / 簡餐
10. 手搖飲 / 咖啡廳
11. 早餐店
12. 燒烤 / 火鍋店
13. 外送便當 / 團膳

**零售與電商 (5)**:
14. 服飾店 / 鞋店
15. 電商賣家(蝦皮 / momo / 自架站)
16. 代購 / 團購
17. 食品禮盒 / 烘焙坊
18. 小型超市 / 雜貨店

**專業服務 (5)**:
19. 診所 / 牙醫 / 中醫
20. 律師事務所
21. 會計師 / 記帳士
22. 保險業務員
23. 房仲 / 不動產

**文創 / 教育 / 自由業 (3)**:
24. 接案設計師 / 自由工作者
25. YouTuber / 自媒體 / KOL
26. 線上課程講師 / 知識付費

**製造與 B2B (4)**:
27. 製造廠 / 工廠接單
28. 批發商 / 經銷商
29. 進出口貿易
30. 室內設計 / 裝潢工程

**追加 (2)**:
31. 營造業
32. 設計公司(品牌 / 平面 / 視覺設計)

### 10C. 智慧比對 + 快取機制

寫一個 Worker endpoint:`/industry-design`

邏輯:
1. 客戶輸入產業名稱(例如「拉麵店」、「美容店」、「無人機外送」)
2. **先查快取**(KV 或記憶體):是否有人查過這個關鍵字?
   - 有 → 直接回傳(秒出)
3. **AI 智慧分類**:用 Claude/Llama 判斷這個產業最接近 32 個熱門範本中的哪一個
   - 信心度 > 0.7 → 用該熱門範本
   - 信心度 < 0.7 → 走「即時生成」
4. **即時生成**:用 AI 依照 10A 結構生成完整內容,並寫進快取
5. 回傳結構化 JSON 給前端

**Worker 寫法**(寫進 `workers/ai-proxy/src/index.js`):

```javascript
async function handleIndustryDesign(request, env) {
  const { industry } = await request.json();
  
  // 1. 快取查詢(用 env.KV 或記憶體快取)
  // 2. 32 範本字串比對
  // 3. AI 智慧分類
  // 4. 命中熱門範本 → 回傳該範本
  // 5. 沒命中 → AI 即時生成(走 MiniMax / Llama)
  // 6. 寫入快取
  // 7. 回傳 JSON
}
```

並在路由註冊:`if (url.pathname === '/industry-design') return await handleIndustryDesign(request, env);`

### 10D. 前端 enterprise/index.html 改造

目前的流程設計卡 UI(從截圖看)只顯示痛點 + 4 功能 + 一行設計方向 + 一行效益。**這太簡陋**。

升級成依照 10A 結構顯示:
- 痛點(完整 3 條)
- 4 個功能卡片(每個展開可看串接過程、資安規格、工期、效益)
- 三階段路線圖(時間軸視覺化)
- 量化效益(數字大字突顯)
- 適合方案推薦

UI 風格保持現有暗黑科技風(背景 #0a0a0a、強調色 #e8422a),不要改主色。

### 10E. 驗收

1. 開 `https://thinkbigtw.com/enterprise/`
2. 輸入「美容」→ 應該秒出完整流程設計卡(含資安、串接、三階段、量化效益)
3. 輸入「拉麵店」→ AI 自動歸類到「餐廳」範本,秒出
4. 輸入「無人機外送」→ 顯示「為您生成中...」5-10 秒後生出完整客製內容
5. 同樣輸入「無人機外送」第二次 → 快取命中,秒出

---

## 🚀 最終步驟

10 條全部完成後:

```bash
cd ~/Desktop/thinkbigtw

# 1. 確認所有修改
git status
git diff --stat

# 2. 部署 Worker(任務 10C 需要)
cd workers/ai-proxy
npx wrangler deploy
cd ../..

# 3. 全部 commit + push
git add .
git commit -m "feat: nav unification + ASK AI fixes + Hermes upgrades + enterprise 32 industries"
git push origin main
```

---

## ✅ 全域驗收(打勾才算完成)

桌面瀏覽器無痕模式測試以下:

- [ ] `/enterprise/` 頂部 + 底部都有導覽列(4 連結)
- [ ] `/harness/` 頂部 + 底部都有導覽列
- [ ] `/clawland/` 頂部 + 底部都有導覽列
- [ ] `/lab/` **沒有**統一導覽列(保留原樣)
- [ ] `/erp/` **沒有**統一導覽列
- [ ] 所有對外頁右下角都有 ASK AI 圓鈕
- [ ] `/lab/` 跟 `/erp/` **沒有** ASK AI 圓鈕
- [ ] 全站找不到「立即諮詢」按鈕
- [ ] 全站找不到「想知道怎麼開始?請點選右下角 ASK AI」區塊
- [ ] Hermes 開場顯示 4 個按鈕(一行排列),包含「關於 Think BIG」
- [ ] 點 Hermes 任一按鈕後,按鈕**不消失**
- [ ] Hermes 回 LINE 連結時,連結可點不會 404
- [ ] 手機 viewport(iPhone 14 Pro)右下 ASK AI 是正圓 + 字不溢出
- [ ] 手機 viewport Hermes 4 按鈕變 2x2 排列
- [ ] `/enterprise/` 輸入「美容」秒出完整流程設計卡(含資安、串接、三階段)
- [ ] `/enterprise/` 輸入冷門產業會走 AI 即時生成

跑完後,**逐頁列出驗收結果**回報給我(每點打勾或 X + 簡述)。

如有任何一條無法完成,**停下來告訴我原因**,不要硬做或編造完成。
