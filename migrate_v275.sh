#!/bin/bash
# MoneyRadar v275 Migration: gvscndrxmihaffbwgmku → sirhskxufayklqrlxeep
# 同時把 PostgREST 與 JS 內的 stock_code → symbol
set -e
cd ~/Desktop/thinkbigtw

echo "==> 1. Backup"
mkdir -p .bak_v275
cp workers/ai-proxy/src/index.js .bak_v275/index.js.bak
cp lab/app2.js .bak_v275/app2.js.bak
cp lab/index.html .bak_v275/index.html.bak
cp lab/sw.js .bak_v275/sw.js.bak

echo "==> 2. Patch (URL + ANON_KEY + stock_code→symbol)"
python3 <<'PY'
import re, pathlib
NEW_URL  = 'https://sirhskxufayklqrlxeep.supabase.co'
NEW_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcmhza3h1ZmF5a2xxcmx4ZWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTc5ODQsImV4cCI6MjA5MDMzMzk4NH0.i0iNEGXq3tkLrQQbGq3WJbNPbNrnrV6ryg8UUB8Bz5g'

def patch(path):
    p = pathlib.Path(path)
    s = p.read_text()
    orig = s
    # 1) URL
    s = s.replace('https://gvscndrxmihaffbwgmku.supabase.co', NEW_URL)
    # 2) PostgREST query params: stock_code → symbol
    s = re.sub(r'\?stock_code=eq\.', '?symbol=eq.', s)
    s = re.sub(r'&stock_code=eq\.',  '&symbol=eq.', s)
    s = re.sub(r'select=stock_code,', 'select=symbol,', s)
    s = re.sub(r'select=stock_code\b', 'select=symbol', s)
    s = re.sub(r'order=stock_code\b', 'order=symbol', s)
    # 3) JS object key access: row.stock_code → row.symbol
    s = re.sub(r'\.stock_code\b', '.symbol', s)
    s = re.sub(r"\['stock_code'\]", "['symbol']", s)
    s = re.sub(r'\["stock_code"\]', '["symbol"]', s)
    # 4) window globals + const definitions (frontend may hold old anon key)
    s = re.sub(r"(window\.SUPABASE_URL\s*=\s*['\"])[^'\"]+(['\"])",
               lambda m: m.group(1) + NEW_URL + m.group(2), s)
    s = re.sub(r"(window\.SUPABASE_ANON_KEY\s*=\s*['\"])[^'\"]+(['\"])",
               lambda m: m.group(1) + NEW_ANON + m.group(2), s)
    s = re.sub(r"(const\s+SUPABASE_URL\s*=\s*['\"])[^'\"]+(['\"])",
               lambda m: m.group(1) + NEW_URL + m.group(2), s)
    s = re.sub(r"(const\s+SUPABASE_ANON_KEY\s*=\s*['\"])[^'\"]+(['\"])",
               lambda m: m.group(1) + NEW_ANON + m.group(2), s)
    if s != orig:
        p.write_text(s)
        print(f"  patched: {path}")
    else:
        print(f"  unchanged: {path}")

patch('workers/ai-proxy/src/index.js')
patch('lab/app2.js')
patch('lab/index.html')
patch('lab/sw.js')
PY

echo "==> 3. Bump version v274 → v275"
# index.html: app2.js?v=274 → ?v=275
sed -i '' 's/app2\.js?v=274/app2.js?v=275/g' lab/index.html
# sw.js: 'mr-v274' → 'mr-v275'
sed -i '' "s/mr-v274/mr-v275/g" lab/sw.js
# Worker version comment
sed -i '' "s/v274/v275/g" workers/ai-proxy/src/index.js || true

echo "==> 4. Verify (grep should return 0 hits in code)"
echo "    -- stock_code in workers --"
grep -c 'stock_code' workers/ai-proxy/src/index.js || true
echo "    -- stock_code in app2.js --"
grep -c 'stock_code' lab/app2.js || true
echo "    -- old supabase URL --"
grep -rn 'gvscndrxmihaffbwgmku' workers/ lab/ || echo "    (none — clean ✓)"

echo "==> 5. Deploy Worker"
cd workers/ai-proxy
npx wrangler deploy
cd ../..

echo "==> 6. Git commit + push"
git add -A
git commit -m "v275: Migrate to Pro Supabase (sirhskxufayklqrlxeep) + stock_code→symbol"
git push

echo "==> ✅ DONE"
echo "Next: GitHub → Actions → daily-update.yml → Run workflow (manual trigger)"
