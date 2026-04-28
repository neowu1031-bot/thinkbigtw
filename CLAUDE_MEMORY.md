# MoneyRadar 戰略指揮文件 v3 - 2026-04-28

## 真實定位
**全球首個 AI 原生對話式個人投資 CFO**
不對標 Bloomberg / TradingView（30 年護城河買不到）
做下一個範式：AI 思考夥伴，不是資料螢幕

## 範式革命路線（v210 啟動）
v210 ✅ AI 全螢幕對話介面 + 動態 stock card render
v211: AI 個人化記憶（client-side localStorage）
v212: AI 多 Agent 圓桌（基本面 / 技術面 / 反方視角）
v213: AI 透明度（強制解釋使用資料 + 有多少把握）
v214: AI 主動每日 brief
v215: 價值觀投資篩選（排除色情/賭博/武器/菸酒）

## 戰略原則
1. 世界第一態度，聚焦能贏的 niche
2. 完全法律合規（金管會），絕不個股投資建議
3. 對外中立，不打宗教/政治牌
4. 用戶隱私至上（client-side personalization 零後端資料）
5. AI-Native，從 Day 1（介面是對話，不是 dashboard）
6. 主動驗證，不憑感覺答（必查官方 + web search）

## 已完成 v195-v210
v195-v200: K 線+Treemap+PWA+24/7 監測
v201-v204: 美股+AI 解讀+股息貴族+AI 普及化
v205-v209: 加密+情緒燈+多股比較+Aristocrats AI
v210: AI 對話 CFO 主介面（範式革命）

## 反省紀錄
1. rm -rf 前先 ls
2. 永不 inline onclick
3. AI prompt 用 fewshot
4. flexible regex 別假設 attribute 順序
5. PAT workflow scope 確認
6. 沒對標就不堆功能
7. 對外包裝中性化（不打宗教牌）

## 系統架構
GitHub Pages → Cloudflare Worker (headers + AI proxy) → Supabase / Yahoo / CoinGecko/CoinCap/Binance / CoinGecko
PWA service worker network-first
GitHub Actions: daily-update (16:30 TWN 爬 Supabase) + smoke-test (30 分鐘健檢)

## 關鍵端點
- /chat: AI 對話（Llama 3.3 70B + 法律護欄）
- /quote: Yahoo Finance 全球報價
- /quote-batch: 30 並發
- /sentiment-score: 動能情緒
- /global-quick-analysis: 個股 AI 解讀
- /crypto-top: 三層保底加密
- /fundamentals: (規劃中) 基本面深度
- /health: 200 + version

## 接下來
v211 開工：個人化記憶（localStorage 存自選股 + 風險偏好 + 過去查詢）→ AI 自動感知
