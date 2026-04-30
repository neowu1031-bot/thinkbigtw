#!/usr/bin/env python3
"""Hotfix v285a — 修復 handleHeatmap 重名衝突
方案：把 v285 新加的 handleHeatmap 改名為 handleHeatmapTreemap，路由改為 /heatmap-tree
保留舊的 v159 handleHeatmap 不動（其他地方還在用）
"""
import re, pathlib, sys

# Step 1: 修 Worker
W = pathlib.Path('workers/ai-proxy/src/index.js')
src = W.read_text()

if 'handleHeatmapTreemap' in src:
    print('✓ Worker already hotfixed');
else:
    # 找到第二個（v285 新加的）handleHeatmap 並改名
    # v285 的 handleHeatmap 在 v285 註解區塊內，前面有 "// ============= v285 /heatmap"
    pattern = r'(// ============= v285 /heatmap.*?===========\s*\n)async function handleHeatmap\('
    replacement = r'\1async function handleHeatmapTreemap('
    new_src = re.sub(pattern, replacement, src, count=1, flags=re.DOTALL)

    if new_src == src:
        print('❌ 找不到 v285 的 handleHeatmap 區塊，嘗試 fallback...')
        # Fallback: 用行號定位 — 把 src/index.js 第 1327 行附近的 handleHeatmap 改名
        # 找到所有 "async function handleHeatmap(" 的位置
        positions = [m.start() for m in re.finditer(r'async function handleHeatmap\(', src)]
        if len(positions) >= 2:
            # 改第二個出現的
            second = positions[1]
            new_src = src[:second] + 'async function handleHeatmapTreemap(' + src[second + len('async function handleHeatmap('):]
            print(f'✓ Fallback: 改名第二個 handleHeatmap @ pos {second}')
        else:
            print('❌ 找不到第二個 handleHeatmap'); sys.exit(1)

    # 同步改路由：if (_u.pathname === "/heatmap") return handleHeatmapTreemap → 改成新路徑
    # 但舊路由 /heatmap 已經被 v159 用了，所以新版要用 /heatmap-tree
    new_src = new_src.replace(
        'if (_u.pathname === "/heatmap") return handleHeatmap(request, env);',
        'if (_u.pathname === "/heatmap") return handleHeatmap(request, env);\n      if (_u.pathname === "/heatmap-tree") return handleHeatmapTreemap(request, env);',
        1
    )
    # 上面 replace 不會中（因為 v285 沒加這個 line — v285 patch 直接 inject 在 /monthly-report 後面用 /heatmap）
    # 修正：把 v285 patch 加的 "/heatmap" 路由改成 "/heatmap-tree"
    new_src = re.sub(
        r'if \(_u\.pathname === "/heatmap"\) return handleHeatmapTreemap\(request, env\);',
        r'if (_u.pathname === "/heatmap-tree") return handleHeatmapTreemap(request, env);',
        new_src
    )
    # 也要把 v285 在 early intercept 裡加的那一行（如果是 handleHeatmap 而非 handleHeatmapTreemap）改掉
    # v285 patch 加的是: if (_u.pathname === "/heatmap") return handleHeatmap(request, env);
    # 但因為前面已經有 v159 的舊版，這行是「重複定義路由」
    # 我們需要：搜尋第二次出現的 'if (_u.pathname === "/heatmap") return handleHeatmap'
    matches = list(re.finditer(r'if \(_u\.pathname === "/heatmap"\) return handleHeatmap\(request, env\);', new_src))
    if len(matches) >= 2:
        # 把第二個改成 /heatmap-tree + handleHeatmapTreemap
        m = matches[1]
        new_src = new_src[:m.start()] + 'if (_u.pathname === "/heatmap-tree") return handleHeatmapTreemap(request, env);' + new_src[m.end():]
        print(f'✓ 改名第二個路由 @ pos {m.start()}')

    W.write_text(new_src)
    print(f'✓ Worker hotfix done (+{len(new_src)-len(src)} bytes)')

# Step 2: 修前端 — lab/v285-bundle.js 把 /heatmap fetch 改成 /heatmap-tree
F = pathlib.Path('lab/v285-bundle.js')
fsrc = F.read_text()
new_fsrc = fsrc.replace('${W}/heatmap?market=', '${W}/heatmap-tree?market=')
if new_fsrc != fsrc:
    F.write_text(new_fsrc)
    print(f'✓ Frontend hotfix done — /heatmap → /heatmap-tree')
else:
    print('✓ Frontend already uses /heatmap-tree')

print('✓✓ v285a hotfix complete')
