import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const headers = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' }

  try {
    // 支援傳入指定月份 { yearMonth: "11503" }，否則抓當月
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    
    let yearMonth: string
    if (body.yearMonth) {
      yearMonth = body.yearMonth
    } else {
      const now = new Date()
      const twYear = now.getFullYear() - 1911
      const m = String(now.getMonth() + 1).padStart(2, '0')
      yearMonth = `${twYear}${m}`
    }

    console.log(`[revenue-fetcher] 開始抓取 ${yearMonth} 月營收`)

    // 根據月份選擇 API：當月用 openapi，歷史月份用 exchangeReport
    const rocYear = parseInt(yearMonth.substring(0, 3))
    const monthNum = parseInt(yearMonth.substring(3, 5))
    const now = new Date()
    const curRocYear = now.getFullYear() - 1911
    const curMonth = now.getMonth() + 1
    const isCurrent = (rocYear === curRocYear && monthNum === curMonth)
    
    let apiUrl: string
    if (isCurrent) {
      apiUrl = 'https://openapi.twse.com.tw/v1/opendata/t187ap05_L'
    } else {
      apiUrl = `https://www.twse.com.tw/exchangeReport/t187ap05_L?response=json&date=${yearMonth}&selectType=ALL`
    }

    const r = await fetch(apiUrl, { headers })
    if (!r.ok) throw new Error(`TWSE HTTP ${r.status}`)
    const data = await r.json()

    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const text = await r.text()
    if (!text || text.trim().startsWith('<')) 
      return new Response(JSON.stringify({ ok: true, msg: '無資料或非交易月', yearMonth }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const json = JSON.parse(text)
    
    // openapi 回傳陣列，exchangeReport 回傳 {data: [...], fields: [...]}
    let rows: any[]
    if (Array.isArray(json)) {
      // openapi 格式（中文欄位）
      if (json.length === 0) return new Response(JSON.stringify({ ok: true, msg: '無資料', yearMonth }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      rows = json.map((d: any) => ({
        symbol: d['公司代號']?.trim(),
        year_month: d['資料年月']?.trim() || yearMonth,
        revenue: parseInt((d['營業收入-當月營收'] || '0').replace(/,/g, '')),
        mom_pct: parseFloat(d['營業收入-上月比較增減(%)'] || '0'),
        yoy_pct: parseFloat(d['營業收入-去年同月增減(%)'] || '0'),
      })).filter((r: any) => r.symbol && r.year_month && r.revenue > 0)
    } else {
      // exchangeReport 格式（array of array, 欄位: [公司代號,公司名稱,產業別,當月營收,上月營收,去年當月,上月增減%,去年增減%,累計,去年累計,前期增減%]）
      const data = json.data || []
      if (data.length === 0) return new Response(JSON.stringify({ ok: true, msg: '無資料', yearMonth }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      rows = data.map((row: string[]) => ({
        symbol: row[0]?.trim(),
        year_month: yearMonth,
        revenue: parseInt((row[3] || '0').replace(/,/g, '')),
        mom_pct: parseFloat(row[6] || '0'),
        yoy_pct: parseFloat(row[7] || '0'),
      })).filter((r: any) => r.symbol && r.year_month && r.revenue > 0)
    }

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
