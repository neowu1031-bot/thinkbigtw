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
- NAMES: local JS object for TW stock names (line ~36)
- US_NAMES: local JS object for US stock names (added 2026-04-24)

## Version History
| Version | Commit | Date | Changes |
|---------|--------|------|---------|
| v126 | 8f0d462 | 2026-04-24 | 排行榜名稱修正 |
| v127 | 9b70e6c | 2026-04-24 | 台股搜尋 autocomplete（Supabase + NAMES） |
| v128 | b6f4275 | 2026-04-24 | ETF/美股搜尋 autocomplete |
| v129 | 6513a6b | 2026-04-24 | 法人買賣超三大法人 5 天趨勢 mini SVG |
| v130 | 99f26eb | 2026-04-24 | ETF 圖表週K/月K 切換按鈕 |

## Key Functions
| Function | Location | Description |
|----------|----------|-------------|
| `initSearchAutocomplete()` | app2.js ~2683 | 台股搜尋 autocomplete（NAMES + Supabase） |
| `initETFAutocomplete()` | app2.js ~2745 | ETF 搜尋 autocomplete |
| `initUSAutocomplete()` | app2.js ~2793 | 美股搜尋 autocomplete（US_NAMES 靜態） |
| `loadChipAnalysis(code)` | app2.js ~2597 | 三大法人籌碼分析（含 mini SVG 趨勢） |
| `switchETFChartMode(mode,period,btn)` | app2.js ~4363 | ETF 週K/月K 切換 |
| `loadETFWeekMonthChart(code,days,mode)` | app2.js ~4384 | ETF 週/月 K 線聚合 |
| `switchChartMode(mode,period,btn)` | app2.js ~2270 | 台股日K/週K/月K/分K 切換 |
| `miniSVG(prices,color)` | app2.js ~3803 | 迷你折線 SVG |

## Conventions
- 所有 Supabase REST 呼叫用 `fetch(BASE+'/table?...', {headers:SB_H})`
- 版本號在 index.html 的 `<script src="app2.js?v=XXX">`
- 最終 commit 格式：`🎉 v[版號] Cowork 巡邏修正`
