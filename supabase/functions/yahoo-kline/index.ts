import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const { symbol, range = '1mo', interval = '1d' } = await req.json().catch(() => ({}))
  const sym = (symbol || 'AAPL').toUpperCase()

  try {
    // 抓 K線 + 即時報價
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=${interval}&range=${range}`
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
    const data = await r.json()
    const result = data.chart.result[0]
    const meta = result.meta
    const quotes = result.indicators.quote[0]
    
    const closes = quotes.close.filter((v: number) => v != null)
    const opens = quotes.open?.filter((v: number) => v != null) || []
    
    // 即時報價資訊
    const currentPrice = meta.regularMarketPrice || closes[closes.length-1]
    const prevClose = meta.chartPreviousClose || meta.previousClose || closes[0]
    const change = currentPrice - prevClose
    const changePct = prevClose > 0 ? (change / prevClose * 100) : 0
    const high = meta.regularMarketDayHigh || Math.max(...closes)
    const low = meta.regularMarketDayLow || Math.min(...closes)
    const volume = meta.regularMarketVolume || 0
    const marketState = meta.marketState || 'CLOSED'
    
    return new Response(JSON.stringify({
      closes,
      currentPrice,
      prevClose,
      change: parseFloat(change.toFixed(4)),
      changePct: parseFloat(changePct.toFixed(2)),
      high,
      low,
      volume,
      marketState,
      symbol: meta.symbol,
      currency: meta.currency,
      exchangeName: meta.exchangeName
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
