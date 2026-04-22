import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { type, code } = await req.json();
    let url = '';

    switch(type) {
      case 'dispose':
        url = 'https://openapi.twse.com.tw/v1/exchangeReport/DISPOSE_STOCK_S';
        break;
      case 'attention':
        url = 'https://openapi.twse.com.tw/v1/exchangeReport/ATTENTION_STOCK_S';
        break;
      case 'bwibbu':
        url = 'https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_d';
        break;
      case 'realtime':
        if (!code) throw new Error('code required');
        const prefix = (code.startsWith('6') || code.startsWith('8')) ? 'otc' : 'tse';
        url = `https://mis.twse.com.tw/stock/api/getStockInfo.jsp?ex_ch=${prefix}_${code}.tw&json=1&delay=0`;
        break;
      case 'etf_nav':
        url = 'https://openapi.twse.com.tw/v1/ETF/fund';
        break;
      default:
        throw new Error('unknown type: ' + type);
    }

    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://mis.twse.com.tw/',
      }
    });

    if (!r.ok) throw new Error(`upstream HTTP ${r.status}`);

    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = text; }

    // 過濾特定股票
    if (code && Array.isArray(data)) {
      if (type === 'dispose' || type === 'attention') {
        const filtered = data.filter((d: any) =>
          d['股票代號'] === code || d['Code'] === code || d['stockNo'] === code
        );
        data = filtered.length > 0 ? filtered : [];
      }
      if (type === 'bwibbu') {
        const filtered = data.filter((d: any) => d['Code'] === code);
        data = filtered.length > 0 ? filtered[0] : null;
      }
    }

    return new Response(JSON.stringify({ ok: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
