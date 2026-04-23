import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const { symbol, range = '1mo', interval = '1d' } = await req.json().catch(() => ({}))
  const sym = (symbol || '2330.TW').toUpperCase()
  const hdrs = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
  try {
    const isTW = sym.endsWith('.TW') || sym.endsWith('.TWO')
    const isIndex = sym.startsWith('^')
    if (isTW) {
      const code = sym.replace('.TW','').replace('.TWO','')
      const isOTC = sym.endsWith('.TWO')
      const monthCount = range==='3mo'?3:range==='6mo'?6:range==='1y'?12:1
      const allData: any[] = []
      const now = new Date()
      for (let i = 0; i < monthCount; i++) {
        const d = new Date(now.getFullYear(), now.getMonth()-i, 1)
        const dateStr = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}01`
        try {
          const url = isOTC
            ? `https://www.tpex.org.tw/web/stock/aftertrading/daily_trading_info/st43_result.php?l=zh-tw&d=${d.getFullYear()-1911}/${String(d.getMonth()+1).padStart(2,'0')}&stkno=${code}&o=json`
            : `https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY?response=json&date=${dateStr}&stockNo=${code}`
          const r = await fetch(url, { headers: hdrs })
          if (!r.ok) continue
          const json = await r.json()
          const rows = json.data || json.aaData || []
          for (const row of rows) {
            const parts = row[0].split('/')
            if (parts.length === 3) {
              const year = parseInt(parts[0])+1911
              const mo = parts[1].padStart(2,'0')
              const dy = parts[2].padStart(2,'0')
              const open=parseFloat(row[3]?.toString().replace(/,/g,''))
              const high=parseFloat(row[4]?.toString().replace(/,/g,''))
              const low=parseFloat(row[5]?.toString().replace(/,/g,''))
              const close=parseFloat(row[6]?.toString().replace(/,/g,''))
              const vol=parseInt(row[1]?.toString().replace(/,/g,''))
              if(!isNaN(close)&&close>0) allData.push({date:`${year}/${mo}/${dy}`,open,high,low,close,volume:vol})
            }
          }
        } catch {}
      }
      allData.sort((a,b)=>a.date.localeCompare(b.date))
      const closes=allData.map(d=>d.close)
      const latest=allData[allData.length-1]
      const prev=allData[allData.length-2]
      const currentPrice=latest?.close||0
      const prevClose=prev?.close||0
      const change=currentPrice-prevClose
      const changePct=prevClose>0?parseFloat((change/prevClose*100).toFixed(2)):0
      return new Response(JSON.stringify({closes,candles:allData,currentPrice,prevClose,change:parseFloat(change.toFixed(2)),changePct,high:latest?.high||0,low:latest?.low||0,volume:latest?.volume||0,marketState:'CLOSED',symbol:code,currency:'TWD',exchangeName:isOTC?'TPEx':'TWSE',source:'TWSE_OFFICIAL'}),{headers:{...corsHeaders,'Content-Type':'application/json'}})
    } else {
      // 美股/指數：Finnhub quote API (免費版支援，商業授權)
      const FINNHUB_KEY=Deno.env.get('FINNHUB_KEY')||'d7fh9c1r01qpjqqkqkv0d7fh9c1r01qpjqqkqkvg'
      const indexMap: Record<string,string> = {'DJI':'DIA','GSPC':'SPY','IXIC':'QQQ','N225':'EWJ','HSI':'EWH','FTSE':'EWU','GDAXI':'EWG','SPX':'SPY'}
      const rawSym = isIndex ? sym.replace('^','') : sym
      const fsym = indexMap[rawSym] || rawSym
      const r=await fetch(`https://finnhub.io/api/v1/quote?symbol=${fsym}&token=${FINNHUB_KEY}`,{headers:hdrs})
      const data=await r.json()
      if(!data.c||data.c===0) return new Response(JSON.stringify({closes:[],error:'no data',symbol:fsym}),{headers:{...corsHeaders,'Content-Type':'application/json'}})
      const currentPrice=data.c
      const prevClose=data.pc||data.c
      const change=data.d||currentPrice-prevClose
      const changePct=data.dp||parseFloat((change/prevClose*100).toFixed(2))
      // quote only - 回傳單點資料，closes 用 [prevClose, currentPrice]
      return new Response(JSON.stringify({closes:[prevClose,currentPrice],currentPrice,prevClose,change:parseFloat(change.toFixed(4)),changePct:parseFloat(changePct.toFixed(2)),high:data.h||0,low:data.l||0,volume:0,marketState:'CLOSED',symbol:fsym,currency:'USD',source:'FINNHUB_QUOTE'}),{headers:{...corsHeaders,'Content-Type':'application/json'}})
    }
  } catch(e:any) {
    return new Response(JSON.stringify({error:e.message}),{status:500,headers:{...corsHeaders,'Content-Type':'application/json'}})
  }
})
