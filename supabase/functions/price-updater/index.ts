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

  try {
    const now = new Date()
    // 台灣時間 UTC+8
    const twNow = new Date(now.getTime() + 8 * 3600 * 1000)
    const y = twNow.getUTCFullYear()
    const m = String(twNow.getUTCMonth() + 1).padStart(2, '0')
    const d = String(twNow.getUTCDate()).padStart(2, '0')
    const today = `${y}-${m}-${d}`
    const dateStr = `${y}${m}${d}`

    console.log(`[price-updater] 開始抓取 ${today} 收盤價`)

    // 抓 TWSE 全市場當日收盤價（STOCK_DAY_ALL）
    const r = await fetch(
      `https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY_ALL?response=json&date=${dateStr}`,
      { headers: hdrs }
    )
    if (!r.ok) throw new Error(`TWSE HTTP ${r.status}`)
    const json = await r.json()

    if (!json.data || json.data.length === 0) {
      return new Response(JSON.stringify({ ok: true, msg: '今日無交易資料（假日或盤中）', date: today }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // TWSE STOCK_DAY_ALL 欄位：
    // [證券代號, 證券名稱, 成交股數, 成交金額, 開盤價, 最高價, 最低價, 收盤價, 漲跌(+/-), 漲跌價差, 本益比]
    const rows = json.data.map((row: string[]) => {
      const sym = row[0]?.trim()
      const open = parseFloat(row[4]?.replace(/,/g, '')) || null
      const high = parseFloat(row[5]?.replace(/,/g, '')) || null
      const low  = parseFloat(row[6]?.replace(/,/g, '')) || null
      const close= parseFloat(row[7]?.replace(/,/g, '')) || null
      const vol  = parseInt(row[2]?.replace(/,/g, '')) || null
      if (!sym || !close) return null
      return { symbol: sym, date: today, open_price: open, high_price: high, low_price: low, close_price: close, volume: vol, change_percent: null }
    }).filter(Boolean)

    console.log(`[price-updater] 共 ${rows.length} 筆資料，寫入 DB...`)

    // 批次寫入（upsert，避免重複）
    const BATCH = 500
    let inserted = 0
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const { error } = await supabase
        .from('daily_prices')
        .upsert(batch, { onConflict: 'symbol,date', ignoreDuplicates: false })
      if (error) console.error(`批次 ${i} 錯誤:`, error.message)
      else inserted += batch.length
    }

    console.log(`[price-updater] ✅ 完成！寫入 ${inserted} 筆`)

    return new Response(JSON.stringify({ ok: true, date: today, inserted, total: rows.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e: any) {
    console.error('[price-updater] 錯誤:', e.message)
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
