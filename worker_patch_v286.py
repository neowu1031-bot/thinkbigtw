#!/usr/bin/env python3
"""Worker patch v286 — Goldman 量化套件 4 endpoints
所有函數加 V286_ 前綴避免命名衝突
"""
import re, pathlib, sys

W = pathlib.Path('workers/ai-proxy/src/index.js')
src = W.read_text()
if 'V286_handleLongShort' in src:
    print('✓ Already patched v286'); sys.exit(0)

backup = pathlib.Path('.bak_worker_v286_index.js')
backup.write_text(src)

HANDLERS = r'''
// ============= v286 /long-short-pairs =============
async function V286_handleLongShort(request, env) {
  if (request.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405);
  try {
    const body = await request.json();
    const symbols = body.symbols || [];
    const numPairs = body.pairs || 3;
    if (symbols.length < 2) return jsonResponse({ error: 'need at least 2 symbols' }, 400);

    // 抓 60 日歷史
    const hist = await Promise.all(symbols.map(async s => {
      try {
        const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${s}?range=3mo&interval=1d`, {
          headers: { 'User-Agent': 'Mozilla/5.0 MoneyRadar' }
        });
        const j = await r.json();
        const closes = (j.chart?.result?.[0]?.indicators?.quote?.[0]?.close || []).filter(v => v != null);
        return { symbol: s, closes };
      } catch { return { symbol: s, closes: [] }; }
    }));
    const valid = hist.filter(h => h.closes.length >= 30);
    if (valid.length < 2) return jsonResponse({ error: 'insufficient data', pairs: [] }, 400);

    // 計算 returns + 60 日動能
    valid.forEach(h => {
      const c = h.closes;
      h.return60 = (c[c.length - 1] - c[0]) / c[0];
      h.returns = [];
      for (let i = 1; i < c.length; i++) h.returns.push((c[i] - c[i - 1]) / c[i - 1]);
    });

    // Pearson correlation 雙循環
    function corr(a, b) {
      const n = Math.min(a.length, b.length);
      const ma = a.reduce((s, x) => s + x, 0) / n;
      const mb = b.reduce((s, x) => s + x, 0) / n;
      let cov = 0, va = 0, vb = 0;
      for (let i = 0; i < n; i++) {
        cov += (a[i] - ma) * (b[i] - mb);
        va += (a[i] - ma) ** 2;
        vb += (b[i] - mb) ** 2;
      }
      return va * vb > 0 ? cov / Math.sqrt(va * vb) : 0;
    }

    // 評估所有配對 — 找高相關 + 動能差大的
    const candidates = [];
    for (let i = 0; i < valid.length; i++) {
      for (let j = 0; j < valid.length; j++) {
        if (i === j) continue;
        const c = corr(valid[i].returns, valid[j].returns);
        const md = valid[i].return60 - valid[j].return60;
        if (md > 0 && c > 0.4) {
          candidates.push({
            long: valid[i].symbol,
            short: valid[j].symbol,
            correlation: c,
            momentum_diff: md,
            score: md * c
          });
        }
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    const used = new Set();
    const selected = [];
    for (const cd of candidates) {
      if (selected.length >= numPairs) break;
      if (used.has(cd.long) || used.has(cd.short)) continue;
      used.add(cd.long); used.add(cd.short);
      selected.push({
        long: cd.long, short: cd.short,
        correlation: cd.correlation,
        momentum_diff: cd.momentum_diff,
        position_size: 1 / (numPairs * 2),
        expected_alpha: cd.momentum_diff * 0.6
      });
    }
    return jsonResponse({ pairs: selected, _source: 'V286_LongShort' });
  } catch (e) { return jsonResponse({ error: e.message }, 500); }
}

// ============= v286 /sector-rotation =============
async function V286_handleSectorRotation(request, env) {
  try {
    const SECTORS = [
      { symbol: 'XLK', name: '科技' }, { symbol: 'XLF', name: '金融' },
      { symbol: 'XLV', name: '醫療' }, { symbol: 'XLY', name: '消費循環' },
      { symbol: 'XLP', name: '消費必需' }, { symbol: 'XLE', name: '能源' },
      { symbol: 'XLI', name: '工業' }, { symbol: 'XLB', name: '原物料' },
      { symbol: 'XLU', name: '公用事業' }, { symbol: 'XLRE', name: '不動產' },
      { symbol: 'XLC', name: '通訊服務' }
    ];
    const data = await Promise.all(SECTORS.map(async s => {
      try {
        const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${s.symbol}?range=1mo&interval=1d`, {
          headers: { 'User-Agent': 'Mozilla/5.0 MoneyRadar' }
        });
        const j = await r.json();
        const closes = (j.chart?.result?.[0]?.indicators?.quote?.[0]?.close || []).filter(v => v != null);
        if (closes.length < 2) return { ...s, return_1m: 0 };
        return { ...s, return_1m: (closes[closes.length - 1] - closes[0]) / closes[0] };
      } catch { return { ...s, return_1m: 0 }; }
    }));
    return jsonResponse({ sectors: data, _source: 'V286_SectorRotation' });
  } catch (e) { return jsonResponse({ error: e.message }, 500); }
}

// ============= v286 /factor-screen =============
async function V286_handleFactorScreen(request, env) {
  const url = new URL(request.url);
  const v = parseFloat(url.searchParams.get('value')) || 0;
  const g = parseFloat(url.searchParams.get('growth')) || 0;
  const m = parseFloat(url.searchParams.get('momentum')) || 0;
  const q = parseFloat(url.searchParams.get('quality')) || 0;
  // 用 mock data（production 應整合 Supabase fundamentals）
  const universe = [
    { symbol: 'AAPL', name: 'Apple', value_score: 0.5, growth_score: 0.7, momentum_score: 0.8, quality_score: 0.95 },
    { symbol: 'MSFT', name: 'Microsoft', value_score: 0.4, growth_score: 0.85, momentum_score: 0.9, quality_score: 0.92 },
    { symbol: 'NVDA', name: 'Nvidia', value_score: 0.3, growth_score: 0.95, momentum_score: 0.95, quality_score: 0.85 },
    { symbol: 'GOOG', name: 'Alphabet', value_score: 0.6, growth_score: 0.75, momentum_score: 0.7, quality_score: 0.88 },
    { symbol: 'META', name: 'Meta', value_score: 0.55, growth_score: 0.7, momentum_score: 0.75, quality_score: 0.82 },
    { symbol: 'TSLA', name: 'Tesla', value_score: 0.2, growth_score: 0.8, momentum_score: 0.6, quality_score: 0.65 },
    { symbol: 'BRK-B', name: 'Berkshire', value_score: 0.85, growth_score: 0.4, momentum_score: 0.6, quality_score: 0.9 },
    { symbol: 'V', name: 'Visa', value_score: 0.5, growth_score: 0.65, momentum_score: 0.7, quality_score: 0.95 },
    { symbol: 'JPM', name: 'JPMorgan', value_score: 0.75, growth_score: 0.5, momentum_score: 0.8, quality_score: 0.88 },
    { symbol: 'XOM', name: 'Exxon', value_score: 0.85, growth_score: 0.4, momentum_score: 0.55, quality_score: 0.78 },
    { symbol: 'WMT', name: 'Walmart', value_score: 0.6, growth_score: 0.45, momentum_score: 0.7, quality_score: 0.88 },
    { symbol: 'PG', name: 'P&G', value_score: 0.5, growth_score: 0.4, momentum_score: 0.55, quality_score: 0.92 },
    { symbol: 'UNH', name: 'UnitedHealth', value_score: 0.55, growth_score: 0.6, momentum_score: 0.5, quality_score: 0.9 },
    { symbol: 'COST', name: 'Costco', value_score: 0.3, growth_score: 0.7, momentum_score: 0.85, quality_score: 0.93 },
    { symbol: 'AVGO', name: 'Broadcom', value_score: 0.4, growth_score: 0.85, momentum_score: 0.92, quality_score: 0.88 }
  ];
  const totalWeight = v + g + m + q || 1;
  universe.forEach(u => {
    u.score = (u.value_score * v + u.growth_score * g + u.momentum_score * m + u.quality_score * q) / totalWeight;
  });
  universe.sort((a, b) => b.score - a.score);
  return jsonResponse({ results: universe, _source: 'V286_FactorScreen' });
}

// ============= v286 /risk-parity =============
async function V286_handleRiskParity(request, env) {
  if (request.method !== 'POST') return jsonResponse({ error: 'POST only' }, 405);
  try {
    const body = await request.json();
    const symbols = body.symbols || [];
    if (symbols.length < 2) return jsonResponse({ error: 'need 2+ symbols' }, 400);
    // 抓歷史
    const hist = await Promise.all(symbols.map(async s => {
      try {
        const r = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${s}?range=1y&interval=1d`, {
          headers: { 'User-Agent': 'Mozilla/5.0 MoneyRadar' }
        });
        const j = await r.json();
        const c = (j.chart?.result?.[0]?.indicators?.quote?.[0]?.close || []).filter(v => v != null);
        const returns = [];
        for (let i = 1; i < c.length; i++) returns.push((c[i] - c[i - 1]) / c[i - 1]);
        return { symbol: s, returns };
      } catch { return { symbol: s, returns: [] }; }
    }));
    const valid = hist.filter(h => h.returns.length >= 60);
    if (valid.length < 2) return jsonResponse({ error: 'insufficient data' }, 400);
    // 計算波動度
    const sigmas = valid.map(h => {
      const mean = h.returns.reduce((s, x) => s + x, 0) / h.returns.length;
      const variance = h.returns.reduce((s, x) => s + (x - mean) ** 2, 0) / h.returns.length;
      return Math.sqrt(variance) * Math.sqrt(252);
    });
    // 簡化版 Risk Parity: weight ∝ 1/sigma
    const invSigmas = sigmas.map(s => 1 / s);
    const sumInv = invSigmas.reduce((s, x) => s + x, 0);
    const weights = invSigmas.map(x => x / sumInv);
    // 風險貢獻 = w * sigma / sum(w * sigma)
    const wsigma = weights.map((w, i) => w * sigmas[i]);
    const sumWS = wsigma.reduce((s, x) => s + x, 0);
    const riskContribs = wsigma.map(x => x / sumWS);
    // 投組統計
    const meanReturns = valid.map(h => h.returns.reduce((s, x) => s + x, 0) / h.returns.length * 252);
    const portfolioReturn = weights.reduce((s, w, i) => s + w * meanReturns[i], 0);
    const portfolioVol = Math.sqrt(weights.reduce((s, w, i) => s + (w * sigmas[i]) ** 2, 0));
    const sharpe = (portfolioReturn - 0.015) / portfolioVol;

    const result = valid.map((h, i) => ({
      symbol: h.symbol,
      weight: weights[i],
      volatility: sigmas[i],
      risk_contribution: riskContribs[i]
    }));
    return jsonResponse({
      weights: result,
      portfolio_return: portfolioReturn,
      portfolio_volatility: portfolioVol,
      sharpe,
      _source: 'V286_RiskParity'
    });
  } catch (e) { return jsonResponse({ error: e.message }, 500); }
}
'''

# Inject before "export default"
match = re.search(r'(export\s+default\s*\{)', src)
if not match:
    print('❌ Cannot find export default'); sys.exit(1)
patched = src[:match.start()] + HANDLERS + '\n' + src[match.start():]

# Add routes
patched = re.sub(
    r'(if \(_u\.pathname === "/backtest"\) return handleBacktest\(request, env\);)',
    r'''\1
      if (_u.pathname === "/long-short-pairs") return V286_handleLongShort(request, env);
      if (_u.pathname === "/sector-rotation") return V286_handleSectorRotation(request, env);
      if (_u.pathname === "/factor-screen") return V286_handleFactorScreen(request, env);
      if (_u.pathname === "/risk-parity") return V286_handleRiskParity(request, env);''',
    patched, count=1
)

W.write_text(patched)
print(f'✓ patched {W} (+{len(patched)-len(src)} bytes) — added 4 v286 endpoints')
