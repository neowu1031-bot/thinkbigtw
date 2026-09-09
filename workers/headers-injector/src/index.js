// MoneyRadar Security Headers Injector v2
// 攔截 thinkbigtw.com/* → 過濾 webhook / AI 爬蟲 → fetch GitHub Pages origin → 加安全 headers → 回傳
// v2 新增：webhook 路徑 early-exit + 已知 AI 爬蟲 early-exit（減少 origin 無謂 404 & analytics 污染）

const SECURITY_HEADERS = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy-Report-Only': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com https://www.googletagmanager.com https://www.google-analytics.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com; img-src 'self' data: https: blob:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co https://*.supabase.io https://moneyradar-ai-proxy.thinkbigtw.workers.dev https://finnhub.io https://www.alphavantage.co https://query1.finance.yahoo.com https://query2.finance.yahoo.com https://news.google.com https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://www.google-analytics.com; frame-src 'self' https://accounts.google.com https://content.googleapis.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self' https://accounts.google.com; upgrade-insecure-requests"
};

// ── 已知 webhook 路徑 ────────────────────────────────────────────────────────
// 這些是後端回呼端點，不是頁面。請求打到 thinkbigtw.com 表示 webhook URL 設定錯誤
// 或是測試打錯路徑，直接回 204 阻止轉發 GitHub Pages 產生 404 噪音。
const WEBHOOK_PATHS = [
  '/line/webhook',
  '/webhook',
  '/api/webhook',
  '/hooks/',
];

// ── 已知 AI 訓練爬蟲 / 惡意爬蟲 User-Agent 特徵（不區分大小寫比對）─────────
// 注意：Googlebot / Bingbot 等 SEO 爬蟲不在此列，保留以維持搜尋排名。
const AI_CRAWLER_SIGNATURES = [
  'GPTBot',           // OpenAI 訓練爬蟲
  'ChatGPT-User',     // ChatGPT 瀏覽功能
  'OAI-SearchBot',    // OpenAI 搜尋爬蟲
  'ClaudeBot',        // Anthropic 訓練爬蟲
  'anthropic-ai',     // Anthropic 通用識別
  'Claude-Web',
  'CCBot',            // Common Crawl（多數 AI 訓練集來源）
  'Google-Extended',  // Google 拒絕 AI 訓練選項
  'PerplexityBot',
  'Bytespider',       // TikTok/ByteDance 爬蟲
  'PetalBot',         // 華為爬蟲
  'Amazonbot',        // Amazon Alexa 訓練爬蟲
  'FacebookBot',      // Meta AI 爬蟲
  'Applebot-Extended',
  'DataForSeoBot',
  'SemrushBot',       // 競品分析爬蟲（高頻，污染流量）
  'AhrefsBot',        // 競品分析爬蟲（高頻，污染流量）
  'MJ12bot',
  'DotBot',
  'BLEXBot',
  'linkdexbot',
  'rogerbot',
  'YandexBot',        // Yandex（非目標市場）
  'YandexImages',
];

/**
 * 判斷請求是否為已知 webhook 路徑
 */
function isWebhookPath(pathname) {
  const lower = pathname.toLowerCase();
  return WEBHOOK_PATHS.some(p => lower.startsWith(p.toLowerCase()));
}

/**
 * 判斷請求是否來自已知 AI 爬蟲
 */
function isAiCrawler(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return AI_CRAWLER_SIGNATURES.some(sig => ua.includes(sig.toLowerCase()));
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const userAgent = request.headers.get('User-Agent') || '';

    // ── Early exit: webhook 路徑 ─────────────────────────────────────────────
    // 直接回 204，不轉 GitHub Pages，防止 origin 噪音。
    // X-TB-Filtered: webhook 供日後 log 分析識別。
    if (isWebhookPath(pathname)) {
      return new Response(null, {
        status: 204,
        headers: {
          'X-TB-Filtered': 'webhook',
          'Cache-Control': 'no-store',
        },
      });
    }

    // ── Early exit: 已知 AI 爬蟲 ─────────────────────────────────────────────
    // 回 200 空回應（比 204 更通用），阻止索引與訓練資料蒐集。
    // X-TB-Filtered: ai-crawler 供日後 log 分析識別。
    if (isAiCrawler(userAgent)) {
      return new Response('', {
        status: 200,
        headers: {
          'X-TB-Filtered': 'ai-crawler',
          'Cache-Control': 'no-store, no-cache',
          'Content-Type': 'text/plain',
        },
      });
    }

    // ── 正常請求：轉發至 GitHub Pages origin + 注入安全 headers ─────────────
    const response = await fetch(request);
    const headers = new Headers(response.headers);
    Object.entries(SECURITY_HEADERS).forEach(([k, v]) => headers.set(k, v));
    // 標記為真實訪客請求（供 Cloudflare analytics 肉眼辨識用）
    headers.set('X-TB-Filtered', 'pass');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
