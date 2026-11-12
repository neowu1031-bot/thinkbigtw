// 客戶對話用的模型（官網 AI 顧問、對話摘要、LINE 官方帳號 AI 客服、ERP 示範助理共用）。
//
// TB 政策（2026-11-13）：客戶資料不送中國公司的模型。
// 只用 Cloudflare Workers AI 上「非中國公司」的模型；Workers AI 官方資料政策：不拿客戶內容訓練模型、
// 標準推論不保留輸入輸出（https://developers.cloudflare.com/workers-ai/platform/data-usage/）。
// 不另接任何第三方模型 API（MiniMax 已整個移除，不是改成備援）。
//
// 換模型時只改這裡；ai-models.test.js 會擋下中國公司模型（Qwen、DeepSeek、MiniMax、GLM、Kimi 等）。
// 2026-11-13 本機 20 題實測（20 題繁中、不含真實客戶對話）：
//   主力 Llama 3.3 70B（Meta，美國）：事實題全對、最精簡、最快（精簡知識庫 p50 2.4 秒；整份核心知識庫 p50 5.6 秒）。
//   備援 Mistral Small 3.1 24B（Mistral，法國）：事實題全對，略囉嗦。
//   gpt-oss-120b 不採用：p50 11.5 秒、最慢 31 秒（超過時限）、20 題有 1 題整段輸出「!!!!」、愛畫表格、會自己補不存在的服務內容。
export const PRIMARY_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export const FALLBACK_MODEL = '@cf/mistralai/mistral-small-3.1-24b-instruct';
export const MODEL_CHAIN = [PRIMARY_MODEL, FALLBACK_MODEL];

// 各模型可放進提示的上限（token）。官網主力路徑整份核心知識庫上限 KB_FULL_LIMIT（估算 16000）實測約 7–8k token，Llama 24k 放得下。
export const MODEL_CONTEXT = {
  '@cf/openai/gpt-oss-120b': 128000,
  '@cf/meta/llama-3.3-70b-instruct-fp8-fast': 24000,
  '@cf/mistralai/mistral-small-3.1-24b-instruct': 128000,
};

// 中國公司模型的名稱特徵（Workers AI 的模型 ID 含廠商名）。只用在測試與執行前檢查。
export const CHINA_VENDOR = /qwen|qwq|deepseek|minimax|moonshot|kimi|zai-org|glm|chatglm|thudm|baichuan|01-ai|\byi-|baidu|ernie|tencent|hunyuan|bytedance|doubao|internlm|stepfun|sensenova/i;

// 若日後改用 gpt-oss：它一定會先推理（官方：Reasoning cannot be disabled），推理字數算在 max_tokens 內。
// 用 low 並多給推理額度，避免 11/9 MiniMax 那種「推理吃光額度、內容空白」。現行主力／備援都不是推理模型，不會帶這兩個參數。
const REASONING_HEADROOM = 600;
export function isReasoningModel(model) {
  return /gpt-oss/i.test(model);
}

export function buildRequest(model, messages, { max_tokens, temperature }) {
  const body = { messages, max_tokens, temperature };
  if (isReasoningModel(model)) {
    body.max_tokens = max_tokens + REASONING_HEADROOM;
    body.reasoning = { effort: 'low' };
  }
  return body;
}

// Workers AI 回傳格式不一：Llama/Mistral 有 response 字串；gpt-oss 只有 OpenAI 格式的 choices。
// 推理內容（reasoning / reasoning_content）一律不取。
export function modelText(result) {
  if (!result || typeof result !== 'object') return '';
  let text = '';
  if (typeof result.response === 'string') text = result.response;
  else if (typeof result.choices?.[0]?.message?.content === 'string') text = result.choices[0].message.content;
  else if (Array.isArray(result.output)) {
    for (const item of result.output) {
      if (item?.type !== 'message' || !Array.isArray(item.content)) continue;
      for (const part of item.content) if (part?.type === 'output_text' && typeof part.text === 'string') text += part.text;
    }
  }
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

// 只記數字（模型、token、neurons），不記對話內容。用來看每天用量有沒有超過 Workers AI 免費額度。
export function logUsage(kind, model, result) {
  const u = result?.usage;
  if (!u) return;
  console.log(JSON.stringify({ type: 'ai_usage', kind, model, ts: new Date().toISOString(), prompt_tokens: u.prompt_tokens, completion_tokens: u.completion_tokens, neurons: u.neurons }));
}

// 單次呼叫，逾時就丟錯（呼叫端決定要不要換下一個模型）。
export async function runModel(env, model, messages, { max_tokens, temperature, timeoutMs, kind = 'chat' }) {
  if (CHINA_VENDOR.test(model)) throw new Error('blocked_model');
  let timer;
  try {
    const result = await Promise.race([
      env.AI.run(model, buildRequest(model, messages, { max_tokens, temperature })),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeoutMs); }),
    ]);
    logUsage(kind, model, result);
    return modelText(result);
  } finally { clearTimeout(timer); }
}
