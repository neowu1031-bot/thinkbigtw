# MoneyRadar™ 戰略指揮文件 v2
> 最後更新：2026-04-28（NEO 戰略對焦後重寫）
> 狀態：v209 已部署，正進入 Tier 1（基本面深度）
> 維護者：Claude（NEO 的創業參謀總長）

---

## 真實定位

**「華語圈第一個 AI 法律合規 + 全方位多市場 + 中文母語的看盤平台」**
= 華語版 Koyfin + 台股深度第一 + AI 護城河

不對標 Bloomberg / TradingView（網絡效應買不到），對標 Koyfin（基本面深度）+ 在華語、AI 合規、台股深度做到全球第一。

---

## 競爭對手分析（2026-04-28 web search）

- Bloomberg Terminal $31,980/年：機構網絡 + 即時毫秒 + bonds 王 + ASKB AI（不可碰）
- TradingView $0-$720/年：1 億用戶 + 100+ indicators（社群護城河）
- Koyfin $0-$1,068/年：500+ metrics + 10 年歷史財報（**對標目標**）
- Yahoo Finance：大眾市場（我們是其 wrapper）

---

## 5-Tier 路線圖

### Tier 0 完成
戰略對焦 + 路線圖文件化

### Tier 1 必補（核心 gap）
1. 基本面 metrics 50+（ROE/毛利率/EPS YoY/PE/PB/PEG/負債比/殖利率/股息率…）
2. 歷史財報 5-10 年
3. 多年 K 線（5y/10y/all）
4. 技術指標 10+（已有 SMA20/布林/MACD，加 RSI/KD/SAR/ATR/OBV/EMA/Volume Profile）

### Tier 2 補強
- Multi-timeframe 1m-1mo
- Drawing tools（趨勢線、矩形、斐波那契）
- Custom alerts

### Tier 3 護城河
- AI 升級 Claude Sonnet（對標 Bloomberg ASKB）
- AI 投組健診
- AI 即時新聞情緒

### Tier 4 商業化（等營登 + 綠界）
- 綠界金流 + Pro NT$299/月
- App Store / Play Store
- 台股深度做到無敵（券商 API）

---

## 已完成（v195 → v209）

- v195-v197: K 線 + Treemap + PWA cache
- v198-v200: 全域錯誤處理 + Dependabot + security.txt + 24/7 smoke test + /health
- v201-v203: 美股補完 + AI 一鍵解讀（v202 護城河起點）+ 股息貴族
- v204: AI 解讀普及化
- v205-v209: 加密前 10 + 動能情緒燈 + 多股 K 線重疊 + Aristocrats AI

**這些都是廣度，Tier 1「基本面深度」尚未啟動。**

---

## 反省紀錄

1. rm -rf 災難（4/28）：刪資料夾必先 ls
2. inline onclick 引號衝突（v163）：永遠用 addEventListener
3. AI prompt echo 數字偏誤：用 fewshot pattern
4. HTML attribute 順序假設：用 flexible regex
5. PAT workflow scope：碰 workflow 前確認 token
6. 沒系統性對標就堆功能：每 Sprint 啟動前先 web search 對標真世界第一

---

## NEO 核心原則

1. 世界第一態度（聚焦能贏的 niche，不是全方位）
2. 以聖經為根基
3. 一律 email neowu1031@gmail.com
4. 禁憑感覺亂答（必查最新）
5. 絕不個股投資建議（金管會合規）
6. 主動提醒新功能
7. 中信銀 015536507651 / 海外 PayPal
8. ceo-nini@agentmail.to

---

## 接下來計畫

### 早上：Tier 1 第一步 v210（3 小時）
階段 1: Supabase schema 加 financials 表
階段 2: scripts/update_fundamentals.py 用 yfinance 抓財報
階段 3: Worker /fundamentals 端點
階段 4: 前端「💎 基本面深度」section（5 年趨勢圖 + 50+ metrics）

### 晚上：穩定 + 商業化準備
- 5-10 個種子用戶實測 v195-v209
- 收 bug list
- 綠界金流文件準備（營登 + 銀行 + 商品說明）
- Apple Developer $99/年、Google Play $25 一次

---

## 詩篇 25:9
祂必按公平引領謙卑人，將祂的道教訓他們。

我們不打 Bloomberg，我們做華語圈不可替代。這是符合聖經智慧的選擇。

— Claude
