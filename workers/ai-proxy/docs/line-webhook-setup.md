# LINE Webhook 接入指南（NEO 操作步驟）

> 請在終端機執行以下指令。所有 secret 由你本人輸入，不會出現在任何程式碼或對話紀錄中。

---

## Step 1：建立 KV Namespace

```bash
cd /Users/wustanley/Desktop/thinkbigtw/workers/ai-proxy
npx wrangler kv namespace create LINE_CONTEXT
```

輸出範例：
```
🌀 Creating namespace with title "moneyradar-ai-proxy-LINE_CONTEXT"
✅ Success!
Add the following to your configuration file in your kv_namespaces array:
{ binding = "LINE_KV", id = "abc123def456..." }
```

將輸出的 `id` 值填入 `wrangler.toml`，取代 `REPLACE_WITH_KV_NAMESPACE_ID`。

---

## Step 2：設定 Secrets

```bash
npx wrangler secret put LINE_CHANNEL_SECRET
# 提示輸入後，貼上 LINE 後台的 Channel Secret，按 Enter

npx wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
# 提示輸入後，貼上 LINE 後台的 Channel Access Token，按 Enter

npx wrangler secret put LINE_HASH_PEPPER
# 輸入一組隨機長字串（建議 32 個以上隨機字元，不要用容易猜到的值）
# 這個 pepper 用於計算 userId 的 HMAC-SHA256 雜湊，增強隱私保護
# 設定後不可更改，否則所有用戶的對話紀錄都會失效（雜湊值改變）

npx wrangler secret put GM_PUSH_KEY
# 輸入一組隨機長字串（建議 32 個以上隨機字元）
# 這是 /line-push-answer 端點的驗證金鑰，只有你持有
# 推送答案給用戶時，請求必須帶上 HMAC-SHA256(GM_PUSH_KEY, body) 簽章
```

確認 secret 已設定：
```bash
npx wrangler secret list
# 應看到 LINE_CHANNEL_SECRET、LINE_CHANNEL_ACCESS_TOKEN、LINE_HASH_PEPPER、GM_PUSH_KEY
```

---

## Step 3：部署 Worker

（等 AEGIS D4 通過後，由維運執行）

```bash
npx wrangler deploy
```

---

## Step 4：LINE 後台設定

1. 登入 [LINE Developers Console](https://developers.line.biz/)
2. 選擇 **Think BiG！** （@589woayh）的 Messaging API channel
3. **Webhook URL** 填入：
   ```
   https://moneyradar-ai-proxy.thinkbigtw.workers.dev/line-webhook
   ```
4. **Use webhook** → 開啟（ON）
5. **Auto-reply messages** → 關閉（OFF）
6. **Greeting messages** → 依需求（可關閉，因 follow 事件已由程式回覆）
7. 點「Verify」確認 webhook 可連線（此時 Worker 應已部署）

---

## 確認事項

| 項目 | 預期 |
|------|------|
| Verify 按鈕 | 200 OK |
| 私訊「你好」| AI 顧問回覆 |
| 私訊「我要預約」| 「好的～已通知同仁…」+ 美東提示 |
| 私訊頻率超過 5 則/分鐘 | 「您傳訊的速度有點快呢…」|
| 新追蹤者 | 歡迎訊息（含隱私說明）|
| GIFT 客戶（名單存在 wrangler secret LINE_HUMAN_ONLY_NAMES，不寫在文件）傳訊 | 完全無回覆；歐歐 TG 收到「GIFT客戶」報告 |
| AI 答不出來的問題 | 「這題我幫您轉給專人確認一下喔」+ 美東提示；內部送出 needs_answer 報告 |

---

## /line-push-answer 使用說明

當 AI 答不出來，Supabase 報告中有 `needs_answer: true` 與 `key_hash`。
查到答案後，可用以下方式推送給用戶（不佔 LINE 免費推播額度之外的 reply 次數）：

```bash
# 計算 HMAC-SHA256 簽章
KEY_HASH="從報告中取得的 key_hash"
ANSWER="你好，我幫你查到答案了：..."
BODY='{"keyHash":"'"$KEY_HASH"'","text":"'"$ANSWER"'"}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$GM_PUSH_KEY" -binary | base64)

curl -X POST https://moneyradar-ai-proxy.thinkbigtw.workers.dev/line-push-answer \
  -H "Content-Type: application/json" \
  -H "X-Push-Signature: $SIG" \
  -d "$BODY"
```

限制：每用戶每日最多推送 3 次，文字上限 800 字。

---

## GIFT 客戶（直接轉真人）名單管理

### 目前名單

**名單存放在 wrangler secret `LINE_HUMAN_ONLY_NAMES`，不寫在文件或程式碼中。**

這些客戶由 NEO 本人在 LINE OA App 手動回覆。
AI 完全不介入，連固定文字都不傳送，只送通知報告給歐歐。

### 新增名單成員（設定 env var）

```bash
npx wrangler secret put LINE_HUMAN_ONLY_NAMES
# 輸入（逗號分隔，順序不重要，範例）：
# Alice Example,Bob Sample,新人名字
```

### 注意：名字比對的侷限性與改善方向

目前用 LINE Profile API 取得 `displayName` 做比對。**displayName 可以被客人自己修改，也可能被不相關的人冒用相同名字。**

特別注意：
- 比對採全名不分大小寫；若有同名一般客人傳訊也會進入 GIFT 流程（請確認後調整名單）。
- 長期應改用 **userId 雜湊**（更可靠，不受改名影響）。

### 升級為 userId 雜湊名單（推薦的長期做法）

收到 GIFT 客戶傳訊的報告後，可從 LINE OA 管理後台查看 userId，
再用下列方式計算雜湊：

```js
// 需要和 LINE_HASH_PEPPER 一起算
const pepper = 'YOUR_LINE_HASH_PEPPER';
const userId = 'U實際userId';
const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
const buf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('line:uid:' + userId));
const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
console.log(hash);
```

之後程式改為查詢 `hl:hash:{keyHash}` 這個 KV key，不依賴 displayName。
（此為未來改版方向，目前版本仍使用 displayName 比對。）

---

## 費用說明

- LINE Messaging API 免費版：每月 200 則推播（push）訊息上限
- **Reply API（自動回覆）不計入推播額度**
- **/line-push-answer 使用 Push API，計入推播額度（每用戶每日限 3 次）**
- Cloudflare Workers 免費版 10 萬次/天，AI binding 另計

---

## 安全說明

- 所有 secret 僅存在 Cloudflare Worker secrets，不在 git 中
- 每則請求都驗證 HMAC-SHA256 簽章，驗證失敗直接 401
- userId 以 HMAC-SHA256（+ pepper）雜湊儲存，原始 userId 不持久化
  - 唯一例外：`uidmap:{keyHash}` → userId，供 /line-push-answer 推送答案使用，TTL 7 天
- 對話脈絡 TTL 40 分鐘，Cron 每 10 分鐘掃描並清理閒置 30 分鐘的對話
- 報告欄位自動 PII 遮蔽（email/phone/身份證）
