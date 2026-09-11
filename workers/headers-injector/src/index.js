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

// ── AI 搜尋 / 引用爬蟲（一律放行完整 HTML，配合 robots.txt Allow 與 GEO 策略）─
// 這些爬蟲會把內容納入 AI 搜尋引擎的引用庫；封鎖等同斷絕 GEO 流量。
// 2026-09-11 NEO 裁示「開放吧」→ 移出封鎖名單。
const AI_SEARCH_CRAWLERS = [
  'GPTBot',           // OpenAI 搜尋（ChatGPT Search）
  'ChatGPT-User',     // ChatGPT 瀏覽功能
  'OAI-SearchBot',    // OpenAI 搜尋爬蟲
  'ClaudeBot',        // Anthropic 引用爬蟲
  'anthropic-ai',     // Anthropic 通用識別
  'Claude-Web',
  'PerplexityBot',    // Perplexity AI 搜尋
  'Google-Extended',  // Google AI（Gemini/AI Overview）
  'Applebot-Extended',// Apple Intelligence
  'CCBot',            // Common Crawl（AI 搜尋引用基礎）
  'Bytespider',       // TikTok 搜尋（robots.txt 已 Allow）
  'Amazonbot',        // Amazon Alexa AI
  'FacebookBot',      // Meta AI（robots.txt 已 Allow）
];

// ── SEO 工具爬蟲 / 漏洞掃描（繼續阻擋，與 AI 搜尋引擎無關）──────────────────
// Googlebot / Bingbot 等真實 SEO 爬蟲不在此列，保留以維持搜尋排名。
const BLOCKED_CRAWLER_SIGNATURES = [
  'SemrushBot',       // 競品分析爬蟲（高頻，污染流量）
  'AhrefsBot',        // 競品分析爬蟲（高頻，污染流量）
  'MJ12bot',
  'DotBot',
  'BLEXBot',
  'linkdexbot',
  'rogerbot',
  'DataForSeoBot',
  'PetalBot',         // 華為爬蟲（非目標市場）
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
 * 判斷請求是否來自 AI 搜尋爬蟲（放行完整 HTML）
 */
function isAiSearchCrawler(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return AI_SEARCH_CRAWLERS.some(sig => ua.includes(sig.toLowerCase()));
}

/**
 * 判斷請求是否來自應封鎖的 SEO 工具 / 漏洞掃描爬蟲
 */
function isBlockedCrawler(userAgent) {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return BLOCKED_CRAWLER_SIGNATURES.some(sig => ua.includes(sig.toLowerCase()));
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

    // ── AI 搜尋爬蟲：放行完整 HTML（GEO 策略，配合 robots.txt Allow）────────
    // 這些爬蟲不攔截，讓它們正常取得完整頁面後轉發到正常請求流程。
    // X-TB-Filtered: ai-search 僅供 log 分析，不影響回應內容。
    // 注意：放行後繼續走下方的正常請求 → 加安全 headers → 回傳。

    // ── SEO 工具爬蟲：回 200 空回應（減少 analytics 污染）────────────────────
    if (!isAiSearchCrawler(userAgent) && isBlockedCrawler(userAgent)) {
      return new Response('', {
        status: 200,
        headers: {
          'X-TB-Filtered': 'seo-tool',
          'Cache-Control': 'no-store, no-cache',
          'Content-Type': 'text/plain',
        },
      });
    }

    // ── 正常請求（含 AI 搜尋爬蟲）：轉發至 GitHub Pages origin + 注入安全 headers
    const response = await fetch(request);
    const headers = new Headers(response.headers);
    Object.entries(SECURITY_HEADERS).forEach(([k, v]) => headers.set(k, v));
    // 標記請求類型供 Cloudflare analytics 分析用
    headers.set('X-TB-Filtered', isAiSearchCrawler(userAgent) ? 'ai-search' : 'pass');
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
