"""Stamp the WhatsApp number from data/whatsapp.json into every wa.me link.
Usage (repo root):
  python3 scripts/sync-whatsapp.py            # rewrite wa.me/<number> everywhere
  python3 scripts/sync-whatsapp.py --check    # fail if any link is out of sync
  python3 scripts/sync-whatsapp.py --strict   # also fail while the number is still the placeholder (ship gate)
The number lives ONLY in data/whatsapp.json (digits, E.164 without '+').
"""
import json, re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
PLACEHOLDER = "WA_NUMBER_PLACEHOLDER"
num = json.loads((ROOT / "data/whatsapp.json").read_text())["number"].strip()
args = sys.argv[1:]
if not (num == PLACEHOLDER or re.fullmatch(r"[1-9]\d{7,14}", num)):
    sys.exit(f"data/whatsapp.json: number must be E.164 digits without '+' (got {num!r})")
if "--strict" in args and num == PLACEHOLDER:
    sys.exit("SHIP GATE FAILED: WhatsApp number is still WA_NUMBER_PLACEHOLDER. Fill data/whatsapp.json.")
pat = re.compile(r"wa\.me/[A-Za-z0-9_]+")
bad = []; hits = 0
for p in ROOT.rglob("*"):
    if p.suffix not in (".html", ".txt", ".md", ".js") or ".git" in p.parts or "node_modules" in p.parts: continue
    if p.name in ("whatsapp.json",) : continue
    try: s = p.read_text()
    except Exception: continue
    if "wa.me/" not in s: continue
    n = pat.sub("wa.me/" + num, s)
    hits += len(pat.findall(s))
    if n != s:
        bad.append(p.relative_to(ROOT).as_posix())
        if "--check" not in args and "--strict" not in args: p.write_text(n)
if ("--check" in args or "--strict" in args) and bad:
    sys.exit("wa.me links out of sync with data/whatsapp.json:\n" + "\n".join(bad))
print(f"WhatsApp links OK: {hits} link(s), number={'PLACEHOLDER' if num == PLACEHOLDER else 'set'}")
