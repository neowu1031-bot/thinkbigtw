"""Test build-academy.py in a temp copy of the chrome source: incomplete episodes never produce pages."""
import json, subprocess, sys, tempfile, shutil
from pathlib import Path
REPO = Path(__file__).resolve().parents[1]
fail = []
def check(n, ok):
    print(('PASS ' if ok else 'FAIL ') + n)
    if not ok: fail.append(n)

with tempfile.TemporaryDirectory() as t:
    root = Path(t)
    (root / 'library/qa').mkdir(parents=True)
    shutil.copy(REPO / 'library/qa/index.html', root / 'library/qa/index.html')
    data = root / 'eps.json'
    run = lambda: subprocess.run([sys.executable, str(REPO / 'scripts/build-academy.py'), '--root', str(root), '--data', str(data)], capture_output=True, text=True)
    good = {'ep': 1, 'slug': 'ep01-test', 'title': '測試集<b>', 'summary': '一句話摘要', 'date': '2026-11-21', 'youtube_id': 'abcdefghijk', 'points': ['重點一', '重點二'],
            'terms': [{'name': '術語', 'plain': '白話'}], 'refs': [{'title': '來源', 'url': 'https://example.com/a'}, {'title': 'bad', 'url': 'javascript:alert(1)'}]}
    bad = {'ep': 2, 'slug': 'ep02-nopoints', 'title': 'x', 'summary': 'y', 'date': '2026-11-22', 'youtube_id': 'abcdefghijk', 'points': []}
    data.write_text('[]'); r = run()
    check('zero episodes writes nothing', not (root / 'library/academy').exists())
    data.write_text(json.dumps([bad])); run()
    check('only incomplete episode writes nothing', not (root / 'library/academy').exists())
    data.write_text(json.dumps([good, bad])); r = run()
    check('complete episode built', (root / 'library/academy/ep01-test/index.html').exists() and (root / 'library/academy/index.html').exists())
    check('incomplete episode has no page', not (root / 'library/academy/ep02-nopoints').exists())
    h = (root / 'library/academy/ep01-test/index.html').read_text()
    check('html escaped', '<b>' not in h.split('<h1>')[1].split('</h1>')[0])
    check('unsafe ref url dropped', 'javascript:' not in h)
    check('overview omits incomplete', 'ep02-nopoints' not in (root / 'library/academy/index.html').read_text())
sys.exit(1 if fail else 0)
