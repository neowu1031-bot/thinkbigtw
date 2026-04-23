import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const hdrs = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }

  // 補抓指定日期的全市場收盤價
  const { startDate, endDate } = await req.json().catch(() => ({
    startDate: '20260330',
    endDate: '20260422'
  }))

  // 產生日期清單（只抓工作日）
  const dates: string[] = []
  const start = new Date(
    parseInt(startDate.substring(0,4)),
    parseInt(startDate.substring(4,6))-1,
    parseInt(startDate.substring(6,8))
  )
  const end = new Date(
    parseInt(endDate.substring(0,4)),
    parseInt(endDate.substring(4,6))-1,
    parseInt(endDate.substring(6,8))
  )

  for (let d = new Date(start); d <= end; d.setDate(d.getDate()+1)) {
    const dow = d.getDay()
    if (dow === 0 || dow === 6) continue // 跳過週末
    const y = d.getFullYear()
    const m = String(d.getMonth()+1).padStart(2,'0')
    const day = String(d.getDate()).padStart(2,'0')
    dates.push(`${y}${m}${day}`)
  }

  console.log(`[backfill] 補抓日期: ${dates.join(', ')}`)

  let totalInserted = 0
  const results: any[] = []

  for (const dateStr of dates) {
    try {
      const y = dateStr.substring(0,4)
      const m = dateStr.substring(4,6)
      const day = dateStr.substring(6,8)
      const isoDate = `${y}-${m}-${day}`

      // 先確認 DB 裡是否已有當天資料
      const { count } = await supabase
        .from('daily_prices')
        .select('*', { count: 'exact', head: true })
        .eq('date', isoDate)

      if (count && count > 100) {
        console.log(`[backfill] ${isoDate} 已有 ${count} 筆，跳過`)
        results.push({ date: isoDate, status: 'skipped', count })
        continue
      }

      // 抓 TWSE 全市場收盤
      const r = await fetch(
        `https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY_ALL?response=json&date=${dateStr}`,
        { headers: hdrs }
      )
      if (!r.ok) {
        results.push({ date: isoDate, status: 'error', msg: `HTTP ${r.status}` })
        continue
      }
      const json = await r.json()

      if (!json.data || json.data.length === 0) {
        results.push({ date: isoDate, status: 'no_data' })
        continue
      }

      const rows = json.data.map((row: string[]) => {
        const sym = row[0]?.trim()
        const open  = parseFloat(row[4]?.replace(/,/g,'')) || null
        const high  = parseFloat(row[5]?.replace(/,/g,'')) || null
        const low   = parseFloat(row[6]?.replace(/,/g,'')) || null
        const close = parseFloat(row[7]?.replace(/,/g,'')) || null
        const vol   = parseInt(row[2]?.replace(/,/g,'')) || null
        if (!sym || !close) return null
        return { symbol: sym, date: isoDate, open_price: open, high_price: high, low_price: low, close_price: close, volume: vol, change_percent: null }
      }).filter(Boolean)

      // 批次寫入
      const BATCH = 500
      let inserted = 0
      for (let i = 0; i < rows.length; i += BATCH) {
        const { error } = await supabase
          .from('daily_prices')
          .upsert(rows.slice(i, i+BATCH), { onConflict: 'symbol,date', ignoreDuplicates: true })
        if (!error) inserted += Math.min(BATCH, rows.length - i)
      }

      totalInserted += inserted
      results.push({ date: isoDate, status: 'ok', inserted })
      console.log(`[backfill] ${isoDate} ✅ ${inserted} 筆`)

      // 避免打太快被 TWSE 封鎖
      await new Promise(r => setTimeout(r, 1200))

    } catch(e: any) {
      results.push({ date: dateStr, status: 'error', msg: e.message })
    }
  }

  return new Response(JSON.stringify({ ok: true, totalInserted, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
})
