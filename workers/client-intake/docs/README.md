# Client intake pages

Private, per-client requirement confirmation pages at `https://thinkbigtw.com/c/<slug>/`.
This directory is the reusable template. Client text, videos and codes never go into this repo.

## How it works

1. The page shell (`public/c/_a/`) is generic. It holds no client name, questions, media or codes.
2. The client opens `/c/<slug>/` (43-char random slug) and types an 8-character access code
   (letters and digits, no 0/O/1/I/L; case and dashes are ignored).
3. The worker checks the code (PBKDF2-SHA256 with a per-link salt and a server-side pepper) and
   returns the client's content, a 6-hour session token (HMAC, bound to the slug) and the same
   token as an HttpOnly cookie scoped to `/c/<slug>/` for the video.
4. Answers are drafted in the browser's `localStorage` only. Nothing is sent until "送出".
5. On submit the worker validates every answer, blocks text that looks like a password, key,
   token or card number, writes it to KV under its own key, **reads it back and compares the
   hash**, and only then answers 200 with a receipt id (`<UTC timestamp>-<hash8>`). Anything else
   is a 5xx, and the page keeps the draft, retries 3 times (2 s, 5 s, 12 s), then offers
   "重試" and "下載我的答案".
6. A short notice (no answers) goes to the team inbox. If it cannot be sent, the submission is
   still kept and `notify_failed:<slug>:<id>` is written for the daily check.

## Data and limits

| Item | Value |
| --- | --- |
| Storage | Workers KV `INTAKE_KV` on the Think BIG Cloudflare account |
| Keys | `cfg:`, `media:`, `sub:<slug>:<id>`, `notify_failed:<slug>:<id>`, `fail:`/`faild:` (see `src/store.js`) |
| Retention | `retentionDays` per client (default 180) on every answer; config and media 60 days longer |
| Link expiry | `expiresAt` in the client config; after it the page and API answer 410 |
| Submissions | `maxSubmissions` per link (default 5); each kept under its own key, the latest wins |
| Wrong codes | 8 per hour and 30 per day per link, then locked until the window passes |
| Request rate | page + API: 20/min per IP; video/poster: 300/min per IP. Checked before any KV read |
| Body size | 64 KB; short answers 300 chars, long answers 2000 chars; optional per-field `pattern` |
| Media | served only with a valid token, `Range` supported, `Cache-Control: private, no-store`. Stored in KV under `media:<slug>:<name>` (max 25 MiB per file, so keep web videos small) |
| Indexing | `X-Robots-Tag: noindex, nofollow`, robots meta, `robots.txt` disallows `/c/`, not in sitemap or llms.txt |

## Tooling

Wrangler is pinned in `package.json`. Run `npm ci` once in this directory, then always use
`npx --no-install wrangler …` so nothing newer is fetched implicitly. The account has several
Cloudflare accounts on the same login, so export `CLOUDFLARE_ACCOUNT_ID` first.

## First deploy

```bash
cd workers/client-intake && npm ci
npx --no-install wrangler kv namespace create CLIENT_INTAKE    # put the id into wrangler.toml
npx --no-install wrangler secret put INTAKE_SECRET             # 32+ random chars; keep a copy in a mode-600 file
# Do NOT set INTAKE_ADMIN_TOKEN on first deploy: /c/_admin/* then answers 404 and answers are
# read with wrangler. If it is ever needed, put Cloudflare Access or a WAF IP rule in front.
# Email Routing: make sure the notice destination is a verified address, then uncomment [[send_email]].
npx --no-install wrangler deploy
```

There is no CI workflow for this worker on purpose; deploys are manual.

## Add a client

1. Write the client config JSON **outside this repo** with mode 600 (shape: `test/fixtures/demo-config.json`).
   `expiresAt` (a future ISO date) is required; add `media` entries pointing at local files if there is a video.
2. Create the link and code and upload everything:

   ```bash
   node scripts/provision.mjs --config <client.json> --out <record.json> \
     --secret-file <intake.secret (mode 600)> --apply remote
   ```

   The secret is read from the file (or `--secret-stdin`, or `INTAKE_SECRET`), never from an argument.
   The script prints the link and code once; only the hash is stored. Media is uploaded before the config.
   To change content later, re-run with `--slug <same>` and `--code <same>`.
3. Send the link and the code in two separate LINE messages.

## Retrieve answers

```bash
npx --no-install wrangler kv key list --binding INTAKE_KV --remote --prefix "sub:<slug>:"
npx --no-install wrangler kv key get  --binding INTAKE_KV --remote "sub:<slug>:<id>"
```

## Daily check

```bash
node scripts/check-submissions.mjs          # key names only: slug prefix, count, latest time, notify_failed
```

Exit code 2 means at least one notice mail failed: fetch that submission with wrangler and follow up.

## Close a link

Set `"status": "closed"` (or an `expiresAt` in the past) and re-run provision with the same slug and code,
or delete `cfg:<slug>`. When the project ends, delete `cfg:`, `media:`, `sub:` and `notify_failed:` for the slug
instead of waiting for expiry.

## Post-deploy end-to-end acceptance (do this before sending any client a link)

Use a throw-away test config (no client data) and a test slug.

1. `node scripts/provision.mjs … --apply remote`; note the link and code.
2. On a phone (or a 390 px wide browser) open the link, enter the code.
3. Video: it plays, the progress bar can be dragged to the middle and the end, the poster shows.
   Open the video URL (`/c/<slug>/media/<name>`) in a private window without logging in: it must be 404.
4. Answer every question, use "先存起來", reload, continue, then submit. Write down the 送出編號.
5. `wrangler kv key get … "sub:<slug>:<送出編號>"`: the id matches and every answer matches what was entered, question by question.
6. AI@thinkbigtw.com received the notice; it has the 送出編號 and retrieval command, and no answers.
7. `node scripts/check-submissions.mjs` lists the test slug with the right time and `notify_failed=0`.
8. Turn the network off (airplane mode / DevTools offline), press 送出: the page says the answers are still
   there, retries automatically, then shows 重試 and 下載我的答案. Download the .txt, check it, turn the network
   back on, press 重試 and get a 送出編號.
9. Type a fake password (e.g. `密碼 abc12345`) in a free-text answer: submit is refused and the question is marked.
10. Delete the test slug: `cfg:`, `media:`, `sub:`, `notify_failed:` keys.

## Tests

```bash
npm test                                         # node --test, no network
npx --no-install wrangler dev --local            # full flow in a browser
```
