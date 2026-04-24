# MoneyRadar™ Lab — CLAUDE.md

## Project Overview
MoneyRadar™ 是一個台灣投資人使用的前端投資平台，主要檔案在 `lab/` 目錄。

## Key Files
- `lab/app2.js` — 主要 JS 邏輯（4000+ 行）
- `lab/index.html` — 主要 HTML 介面

## Supabase
- URL: `https://sirhskxufayklqrlxeep.supabase.co`
- Key: `SB_KEY` 變數（在 app2.js 頂部）
- REST API base: `BASE = SB_URL + '/rest/v1'`
- Headers: `SB_H = { apikey, Authorization }`

## DB Tables
| Table | Key Columns |
|-------|-------------|
| `daily_prices` | symbol, date, open_price, high_price, low_price, close_price, volume |
| `stocks` | symbol, name |
| `institutional_investors` | symbol, date, foreign_buy, investment_trust_buy, dealer_buy, total_buy |
| `monthly_revenue` | symbol, year_month |
| `etf_dividends` | symbol, ex_dividend_date, dividend_amount |

## Architecture
- Single HTML + JS (no build step)
- Tab switching: `switchTab(name, el)`
- Chart lib: LightweightCharts (CDN)
- NAMES: local JS object for TW stock names (app2.js line ~36)
- US_NAMES: local JS object for US stock names (app2.js ~2822)
- ETF_HOT / ETF_GROUPS: local ETF list used by autocomplete (app2.js ~3750)

## Autocomplete Pattern
三個搜尋框各有自己的 autocomplete 函數，都在 `initSearchAutocomplete()` 呼叫時初始化：
- **台股** (`stockInput`): 本地 NAMES → debounce 查 Supabase `stocks` table（ilike）
- **ETF** (`etfInput`): 本地 ETF_HOT → debounce 查 Supabase `stocks` table（ilike）
- **美股** (`usSearch`): 本地 US_NAMES 靜態（無 Supabase，即時）

## Version History
| Version | Commit | Date | Changes |
|---------|--------|------|---------|
| v126 | 8f0d462 | 2026-04-24 | 排行榜名稱修正 |
| v127 | 9b70e6c | 2026-04-24 | 台股搜尋 autocomplete（Supabase + NAMES） |
| v128 | b6f4275 | 2026-04-24 | ETF/美股搜尋 autocomplete（US_NAMES 字典）|
| v129 | 6513a6b | 2026-04-24 | 法人買賣超三大法人 5 天趨勢 mini SVG bar chart |
| v130 | 99f26eb | 2026-04-24 | ETF 圖表週K/月K 切換按鈕（switchETFChartMode）|
| v131 | cd3ffe7 | 2026-04-24 | 修復 searchCrypto 重複宣告 & supabase→SUPA_AUTH |
| v132 | 8a96c36 | 2026-04-24 | Cowork 巡邏修正 checkpoint |
| v133 | 5ae962e | 2026-04-24 | 法人買賣超 sparkline 升級：bar+折線+dot+tooltip |
| v134 | d4a4727 | 2026-04-24 | ETF 按鈕樣式統一：日K/週K/月K label spans |
| v135 | a056f97 | 2026-04-24 | 全面 console error 修復（optional chaining + array guard） |

## Key Functions
| Function | Location | Description |
|----------|----------|-------------|
| `initSearchAutocomplete()` | app2.js:2697 | 台股 autocomplete（NAMES + Supabase ilike） |
| `initETFAutocomplete()` | app2.js:2761 | ETF autocomplete（ETF_HOT + Supabase ilike） |
| `initUSAutocomplete()` | app2.js:2818 | 美股 autocomplete（US_NAMES 靜態，即時） |
| `loadChipAnalysis(code)` | app2.js:2576 | 三大法人籌碼（miniSparkSVG: bar+折線+dot） |
| `switchChartMode(mode,period,btn)` | app2.js:2251 | 台股日K/週K/月K/分K 切換 |
| `switchETFChartMode(mode,period,btn)` | app2.js:4355 | ETF 週K/月K 切換 |
| `loadETFWeekMonthChart(code,days,mode)` | app2.js:4385 | ETF 週/月 K 線聚合（從日K資料） |
| `miniSVG(prices,color)` | app2.js:3945 | 熱門股迷你折線 SVG（用於卡片） |

## miniSparkSVG（法人趨勢圖）
`loadChipAnalysis` 內嵌的局部函數，為每個法人（外資/投信/自營）各繪一張 SVG：
- 半透明 bar（綠=買超 / 紅=賣超）顯示各日淨值大小
- 藍色 polyline 折線（#60a5fa）連接資料點顯示趨勢
- 彩色圓點標記各日，支援 SVG `<title>` 懸停 tooltip（日期 + 張數）
- 資料取 `institutional_investors` 最近 5 天（`data.slice(0,5).reverse()`）

## ETF Chart Button Layout
`#etfChartContainer` 內按鈕組同台股格式：
```
日K: [1M] [3M] [6M] [1Y]  週K: [1Y] [2Y]  月K: [2Y] [5Y]
```
使用 `class="chart-range"` + label spans，與台股 `#dayKBtns` 結構一致。

## Conventions
- 所有 Supabase REST 呼叫用 `fetch(BASE+'/table?...', {headers:SB_H})`
- Autocomplete debounce: 250ms，先本地即時顯示再 Supabase 更新
- Supabase OR filter 語法: `?or=(symbol.ilike.*q*,name.ilike.*q*)`
- 版本號在 index.html 的 `<script src="app2.js?v=XXX">`
- 最終 commit 格式：`🎉 v[版號] Cowork 巡邏修正`
