import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const headers = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }

  try {
    const now = new Date()
    const twYear = now.getFullYear() - 1911
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const yearMonth = `${twYear}${m}`

    console.log(`[revenue-fetcher] 開始抓取 ${yearMonth} 月營收`)

    const r = await fetch(`https://openapi.twse.com.tw/v1/opendata/t187ap05_L`, { headers })
    if (!r.ok) throw new Error(`TWSE HTTP ${r.status}`)
    const data = await r.json()

    if (!Array.isArray(data) || data.length === 0)
      return new Response(JSON.stringify({ ok: true, msg: '無資料', yearMonth }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    // 轉換資料
    const rows = data.map((d: any) => ({
      symbol: d['公司代號']?.trim(),
      year_month: d['資料年月']?.trim(),
      revenue: parseInt((d['營業收入-當月營收'] || '0').replace(/,/g, '')),
      mom_pct: parseFloat(d['營業收入-上月比較增減(%)'] || '0'),
      yoy_pct: parseFloat(d['營業收入-去年同月增減(%)'] || '0'),
    })).filter((r: any) => r.symbol && r.year_month && r.revenue > 0)

    // 批次寫入
    let inserted = 0
    const BATCH = 500
    for (let i = 0; i < rows.length; i += BATCH) {
      const { error } = await supabase.from('monthly_revenue')
        .upsert(rows.slice(i, i + BATCH), { onConflict: 'symbol,year_month', ignoreDuplicates: true })
      if (!error) inserted += Math.min(BATCH, rows.length - i)
    }

    console.log(`[revenue-fetcher] ✅ ${yearMonth} 寫入 ${inserted} 筆`)
    return new Response(JSON.stringify({ ok: true, yearMonth, inserted, total: rows.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
