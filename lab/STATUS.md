# MoneyRadar™ 系統狀態

最後更新：自動由 GitHub Actions 每 30 分鐘檢查

## 健檢項目（共 9 項）

1. ✅ 首頁可訪問
2. ✅ app2.js 載入
3. ✅ Service Worker
4. ✅ PWA Manifest
5. ✅ security.txt（RFC 9116 通報窗口）
6. ✅ Worker `/health`
7. ✅ Worker `/quote`（Yahoo Finance 全球報價）
8. ✅ Worker `/chat`（AI 助理）
9. ✅ 法律護欄活躍（拒絕投資建議）

## 公開承諾

- 24/7 自動監測，異常 5 分鐘內 NEO 會收到通知
- 系統使用 Cloudflare Workers（全球 300+ 節點）+ GitHub Pages（CDN 加速）
- 數據來源：Yahoo Finance、Supabase、Cloudflare Workers AI（Llama 3.3 70B）

## 緊急聯絡

- Email：ceo-nini@agentmail.to
- 安全通報：詳見 `/lab/.well-known/security.txt`

---
Think BIG · 詩篇 127:1


## 2026-04-30 v275-v276 大整合戰報

### Plan A migration（兩個 Supabase 統一）
- 起點：split-brain（gvscndrxmihaffbwgmku Free 寫不到、sirhskxufayklqrlxeep Pro 沒人讀）
- - 修復：升 Pro Plan + Compute Small ($25+$15/月)、Worker patch URL+anon key、前端 stock_code→symbol
  - - 驗收：daily-update.yml #7 ✅ Success 52s、770k daily_prices/16k institutional/2125 stocks/1000 monthly_revenue 全通
   
    - ### v275 cache bump（commit 8b80557）
    - - lab/index.html: app2.js?v=2721 → ?v=275
      - - lab/sw.js: mr-v2721 → mr-v275
       
        - ### v275 拖拉 Dashboard hotfix（commit 11ee3ee）
        - - 起點：v272 GridStack init 卡 'wait-for-login'，HTML 沒 .grid-stack 容器，結構性 bug
          - - 修復：放棄 v272，注入 inline SortableJS hotfix 到 lab/index.html（line 924）
            - - 機制：每個 .section 加 ⋮⋮ drag handle、onEnd 存 localStorage `mr_v275_<tab-id>`
             
              - ### v275.1 16 tabs 擴展（commit e5d202e）
              - - 從 7 個 tabs 擴展到 16 個 tabs（補 fund/futures/tools/options/screener/bonds/sector/macro/portfolio/pro）
                - - 移除不存在的 tab-fx
                 
                  - ### v275.2 v273 selector 修復（commit 96810c3）
                  - - Bug：app2.js:11878 構造 '#v230-fund-*' 不是合法 CSS（每 3 秒 throw 一次）
                    - - 修復：改用 attribute selector `[id^=v230-fund-]`
                      - - 驗收：share button 真的能 inject
                       
                        - ### v276 cache invalidate（commits 3114996 + cc62dcc）
                        - - lab/sw.js: mr-v275 → mr-v276（強制 SW 重 fetch 全部 resources）
                          - - lab/index.html: app2.js?v=275 → ?v=276（強制繞過 CDN cache）
                           
                            - ### 線上驗收實測（Chrome MCP）
                            - ```
                              ✅ app2.js?v=276 載入新版
                              ✅ 35 個 ⋮⋮ drag handles 跨 16 個 tabs
                              ✅ Sortable.js 1.15.2 loaded
                              ✅ window.v275Reset() 可用
                              ✅ v273InjectShareButtons() NO_THROW（之前 throw）
                              ✅ Share buttons inject 成功
                              ✅ Service Worker mr-v276 active
                              ✅ Console 完全乾淨（v273 errors 消失）
                              ✅ Pro Supabase 770k records 順暢讀寫
                              ```

                              ### 工程紀錄
                              - GitHub web editor (CodeMirror 6) 大檔 paste 會截斷（5KB→1.6KB），改用 github.dev (Monaco) 才穩
                              - - github.dev Cmd+Enter 提交（不是 Ctrl+Enter）
                                - - Service Worker cache 名稱 bump 是強制 returning users 拿新版的關鍵
                                  - - Supabase 2026 新 publishable_key 只能用 RLS 表，root REST 401，要從 Legacy Tab 取 JWT
                                    - 
