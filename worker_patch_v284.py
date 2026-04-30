#!/usr/bin/env python3
"""Worker patch v284 — /monthly-report endpoint (Llama 70B generates monthly investment report)"""
import re, pathlib, sys

W = pathlib.Path('workers/ai-proxy/src/index.js')
src = W.read_text()
if 'handleMonthlyReport' in src:
    print('✓ Already patched v284'); sys.exit(0)

backup = pathlib.Path('.bak_worker_v284_index.js')
backup.write_text(src)

HANDLER = r'''
// ============= v284 /monthly-report (AI 月度投資報告) =============
async function handleMonthlyReport(request, env) {
  if (request.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405);
  try {
    const body = await request.json();
    const symbols = body.symbols || [];
    const summary = body.summary || '';
    const month = body.month || new Date().toISOString().slice(0, 7);

    const prompt = `你是世界頂尖的投資組合分析師（巴菲特+索羅斯+霍華馬克斯水平）。
為以下投資組合撰寫 ${month} 月度報告：

${summary}

請用繁體中文撰寫，分為四段：
1. **本月持倉表現總結**（300字以上）：分析整體報酬、波動度、相對大盤
2. **個股深度點評**（每檔 100 字以上）：分析每檔的基本面 + 技術面 + 籌碼面
3. **風險警示**（200字以上）：點出當前持倉的潛在風險（集中度、產業、總經）
4. **下月行動建議**（200字以上）：給出具體可執行的調整建議（加碼/減碼/觀望）

要求：
- 數據導向，避免空話
- 引用實際財報數據與技術指標
- 提出可量化的目標價與停損點
- 文字流暢，適合一般投資人閱讀
- 不少於 1500 字`;

    const aiR = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
      messages: [
        { role: 'system', content: '你是世界頂尖的投資組合分析師，撰寫高品質的月度投資報告。' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 4096
    });

    const reportText = aiR.response || aiR.result?.response || '';
    return jsonResponse({
      report: reportText,
      month,
      symbols,
      generated_at: new Date().toISOString(),
      _source: 'Llama-3.3-70B'
    });
  } catch (e) { return jsonResponse({ error: e.message }, 500); }
}
'''

# Step 1: Inject handler before "export default"
match = re.search(r'(export\s+default\s*\{)', src)
if not match:
    print('❌ Cannot find export default'); sys.exit(1)

patched = src[:match.start()] + HANDLER + '\n' + src[match.start():]

# Step 2: Add route in early intercept block
patched = re.sub(
    r'(if \(_u\.pathname === "/mops"\) return handleMops\(request, env\);)',
    r'\1\n      if (_u.pathname === "/monthly-report") return handleMonthlyReport(request, env);',
    patched, count=1
)

W.write_text(patched)
print(f'✓ patched {W} (+{len(patched)-len(src)} bytes) — added /monthly-report')
