# Client intake pages

Private, per-client requirement confirmation pages at `https://thinkbigtw.com/c/<slug>/`.
This directory is the reusable template. Client text never goes into this repo.

## How it works

1. The page shell (`public/c/_a/`) is generic. It holds no client name, questions or codes.
2. The client opens `/c/<slug>/` (43-char random slug) and types a 6-digit access code.
3. The worker checks the code (PBKDF2-SHA256 with a per-client salt and a server-side pepper)
   and returns the client's content plus a 6-hour session token (HMAC, bound to the slug).
4. Answers are drafted in the browser's `localStorage` only. Nothing is sent until "送出".
5. On submit the worker validates every answer against the config, blocks text that looks like
   a password, API key, token or card number, stores it in KV with a 180-day expiry and sends
   a short notice (no answers) to the internal inbox.

## Data and limits

| Item | Value |
| --- | --- |
| Storage | Workers KV namespace `INTAKE_KV` (Think BIG Cloudflare account) |
| Retention | `retentionDays` per client, default 180 days (KV `expirationTtl`) |
| Submissions | `maxSubmissions` per client, default 5; each one is kept, the latest wins |
| Wrong codes | 8 per hour and 30 per day per link, then locked until the window passes |
| Request rate | 20 API calls per minute per IP (`RATE_LIMITER`) |
| Body size | 64 KB; text answers 300 chars, long answers 2000 chars |
| Indexing | `X-Robots-Tag: noindex, nofollow`, `<meta name="robots">`, `robots.txt` disallows `/c/`, not in sitemap or llms.txt |

## Add a client

1. Write the client config JSON **outside this repo** (see `test/fixtures/demo-config.json` for the shape).
2. Generate the link and code, then upload:

   ```bash
   cd workers/client-intake
   INTAKE_SECRET=... node scripts/provision.mjs --config <client.json> --out <record.json> --apply remote
   ```

   The script prints the link and the 6-digit code once. Only the hash is stored.
   To change the questions later, run it again with `--slug <same slug>` (the code is rotated unless `--code` is given).
3. Send the link and code to the client through separate messages.

To swap in a video later, set `content.video.src` (and optionally `poster`) in the client config and re-run step 2 with the same slug and code.

## Retrieve answers

```bash
# latest submission as Markdown (or ?format=json, ?n=<number> for an older one)
curl -H "Authorization: Bearer $INTAKE_ADMIN_TOKEN" "https://thinkbigtw.com/c/_admin/<slug>?format=md"

# or straight from KV
npx wrangler kv key get --binding INTAKE_KV --remote "meta:<slug>"
npx wrangler kv key get --binding INTAKE_KV --remote "sub:<slug>:<n>"
```

The admin endpoint answers 404 unless `INTAKE_ADMIN_TOKEN` (32+ chars) is set and matches.

## Close a link

Set `"status": "closed"` in the record and upload it again, or delete `cfg:<slug>` from KV.

## First deploy

```bash
cd workers/client-intake
npx wrangler kv namespace create CLIENT_INTAKE      # put the id into wrangler.toml
npx wrangler secret put INTAKE_SECRET               # 32+ random chars
npx wrangler secret put INTAKE_ADMIN_TOKEN          # 32+ random chars
# Email Routing: verify the notice destination, then uncomment [[send_email]] in wrangler.toml
npx wrangler deploy
```

There is no CI workflow for this worker on purpose; deploys are manual.

## Tests

```bash
npm test                                  # node --test, no network
npx wrangler dev --local                  # full flow in the browser
```
