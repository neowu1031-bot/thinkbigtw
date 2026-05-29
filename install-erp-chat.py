#!/usr/bin/env python3
"""
規格 4 ｜ 自動把 /erp-chat endpoint 加進 Worker index.js
用法:
  cd ~/Desktop/thinkbigtw
  python3 install-erp-chat.py
"""
import os
import sys

WORKER_PATH = "workers/ai-proxy/src/index.js"

# ============= ERP endpoint 完整 code(會貼進 Worker) =============
ERP_ENDPOINT_CODE = r'''

// ============== ERP 助理 (規格 4 ｜ MiniMax-M2 + RAG) ==============
const ERP_KNOWLEDGE = `你是 Think BIG AI ERP 內建的智慧助理。

【你的能力】
使用者每次提問,前端會把「目前 ERP 系統的完整即時資料」(JSON)附在訊息裡。
你要做的是:
1. 讀懂這份 JSON 資料(營收、庫存、供應商、訂單、員工出勤、加班等所有模組)
2. 針對問題做真的計算(加總、排序、找極值、跨表比對)
3. 不只給數字,還要給「顧問式洞察」——像一位懂經營的營運顧問

【回答風格】
- 繁體中文,純文字,完全不使用 emoji(這是 ERP 內部介面)
- 先給結論數字,再給一句經營建議
- 數據裡查不到的,直接說「目前系統數據中沒有這項資料」,絕不編造

【範例】
問:「誰加班最多?」
答:「李明德這個月加班 32 小時最多,其次是王雅婷 21 小時。建議留意李明德的工時負荷。」

問:「庫存有沒有快缺貨的?」
答:「目前低於安全庫存的有 3 項:A 料剩 12、C 料剩 8、F 料剩 5。建議優先補 F 料。」

【禁止】
- 不報不存在於 JSON 內的數字
- 不用 emoji、不下投資/財務/法律建議
- 與 ERP 無關的問題禮貌引導回正題`;

async function handleErpChat(request, env) {
  let body;
  try { body = await request.json(); }
  catch (e) { return jsonResponse({ error: 'Invalid JSON' }, 400); }

  const { messages, erpState } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonResponse({ error: 'messages 必填' }, 400);
  }
  if (messages.length > 20) {
    return jsonResponse({ error: '對話過長' }, 400);
  }
  for (const m of messages) {
    if (typeof m.content !== 'string' || m.content.length > 2000) {
      return jsonResponse({ error: '訊息過長(上限 2000 字)' }, 400);
    }
    if (!['user', 'assistant'].includes(m.role)) {
      return jsonResponse({ error: 'role 必須是 user 或 assistant' }, 400);
    }
  }

  let systemPrompt = ERP_KNOWLEDGE;
  if (erpState && typeof erpState === 'object') {
    const knowledge = JSON.stringify(erpState);
    const trimmed = knowledge.length > 50000 ? knowledge.slice(0, 50000) + '...(截斷)' : knowledge;
    systemPrompt += `\n\n【目前 ERP 系統即時資料(JSON)】\n${trimmed}`;
  }

  let reply = '';
  let modelUsed = 'MiniMax-M2';

  // Primary: MiniMax-M2
  const MINIMAX_KEY = env.MINIMAX_API_KEY;
  if (MINIMAX_KEY) {
    try {
      const mxRes = await fetch('https://api.minimax.io/v1/text/chatcompletion_v2', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MINIMAX_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'MiniMax-M2',
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
          max_tokens: 800,
          temperature: 0.3,
        }),
      });
      if (mxRes.ok) {
        const data = await mxRes.json();
        if (data.base_resp && data.base_resp.status_code === 0 && data.choices && data.choices[0]) {
          reply = (data.choices[0].message?.content || '').trim();
          reply = reply.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        }
      }
    } catch (err) {
      console.error('ERP MiniMax error:', err);
    }
  }

  // Fallback: Llama 3.3 70B → Llama 3 8B
  if (!reply) {
    try {
      const aiRes = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        max_tokens: 700,
        temperature: 0.3,
      });
      reply = (aiRes.response || '').trim();
      modelUsed = 'llama-3.3-70b-fallback';
    } catch (err) {
      try {
        const aiRes = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
          max_tokens: 600,
        });
        reply = (aiRes.response || '').trim();
        modelUsed = 'llama-3-8b-fallback';
      } catch (err2) {
        return jsonResponse({ reply: '助理暫時無法回應,請稍後再試。', model: 'fallback-error' });
      }
    }
  }

  // 嚴格去除 emoji(規格 1 ERP 鐵律)
  reply = reply.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F910}-\u{1F96B}]/gu, '');

  return jsonResponse({
    reply,
    model: modelUsed,
    engine: 'Think BIG AI ERP Assistant',
    updated: new Date().toISOString(),
  });
}
// ============== /erp-chat endpoint 結束 ==============
'''

# ============= 開始安裝 =============
def main():
    if not os.path.exists(WORKER_PATH):
        print(f"❌ 找不到 {WORKER_PATH}")
        print("請確認你在 ~/Desktop/thinkbigtw 目錄裡跑這支腳本")
        sys.exit(1)

    with open(WORKER_PATH, 'r', encoding='utf-8') as f:
        content = f.read()

    # 檢查是否已安裝
    if 'handleErpChat' in content:
        print("⚠️  /erp-chat endpoint 已存在,跳過安裝")
        return

    # === 1. 插入 endpoint code(放在 handleThinkBigChat 函式後面)===
    marker = "// ============== 盤前快報情緒判讀"
    if marker in content:
        content = content.replace(marker, ERP_ENDPOINT_CODE + "\n" + marker, 1)
        print(f"✅ ERP endpoint code 已插入(放在 handleThinkBigChat 後)")
    else:
        print(f"❌ 找不到插入點 marker: {marker}")
        sys.exit(1)

    # === 2. 在路由註冊加一行 ===
    route_marker = "if (url.pathname === '/thinkbig-chat') return await handleThinkBigChat(request, env);"
    new_routes = (
        "if (url.pathname === '/thinkbig-chat') return await handleThinkBigChat(request, env);\n"
        "      if (url.pathname === '/erp-chat') return await handleErpChat(request, env);"
    )
    if route_marker in content:
        content = content.replace(route_marker, new_routes, 1)
        print(f"✅ 路由 /erp-chat 已註冊")
    else:
        print(f"❌ 找不到路由 marker")
        sys.exit(1)

    # 寫回
    with open(WORKER_PATH, 'w', encoding='utf-8') as f:
        f.write(content)

    print()
    print("=" * 50)
    print("✅ 安裝完成!接下來請執行:")
    print("=" * 50)
    print()
    print("  cd workers/ai-proxy")
    print("  npx wrangler deploy")
    print()

if __name__ == '__main__':
    main()
