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
    let data = null;

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Referer': 'https://mis.twse.com.tw/',
    };

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
      case 'margin':
        // 融資融券 - 個股信用交易
        if (!code) throw new Error('code required');
        url = `https://www.twse.com.tw/exchangeReport/BFIAUU?response=json&stockNo=${code}`;
        break;
      case 'etf_holdings': {
        // ETF 成分股前10大 - TWSE openapi (CC BY 4.0 政府授權，可商業使用)
        if (!code) throw new Error('code required');
        url = `https://openapi.twse.com.tw/v1/ETF/fund/${code}`;
        break;
      }
      case 'monthly_revenue': {
        // 月營收歷史 - 平行抓近13個月（含當月），TWSE 政府公開資料 CC BY 4.0
        if (!code) throw new Error('code required');

        // 產生近13個月的民國年月清單 (格式: YYYMMM e.g. 11503)
        const months: string[] = [];
        const now = new Date();
        for (let i = 0; i < 13; i++) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const rocYear = d.getFullYear() - 1911;
          const m = String(d.getMonth() + 1).padStart(2, '0');
          months.push(`${rocYear}${m}`);
        }

        // 平行抓每個月份
        const results = await Promise.allSettled(
          months.map(ym =>
            fetch(`https://www.twse.com.tw/exchangeReport/t187ap05_L?response=json&date=${ym}&selectType=ALL`, { headers })
              .then(r => r.ok ? r.json() : null)
              .then(data => {
                if (!data || !data.data) return null;
                // TWSE t187ap05_L 欄位：[公司代號, 公司名稱, 產業別, 當月營收, 上月營收, 去年當月營收, 上月比較增減, 去年同月增減, 當月累計, 去年累計, 前期比較增減]
                const row = data.data.find((r: string[]) => r[0] === code);
                if (!row) return null;
                const rocYear = parseInt(ym.substring(0, 3));
                const month = parseInt(ym.substring(3, 5));
                return {
                  '資料年月': ym,
                  '公司代號': code,
                  '營業收入-當月營收': row[3]?.replace(/,/g,'') || '0',
                  '營業收入-上月比較增減(%)': row[6] || '0',
                  '營業收入-去年同月增減(%)': row[7] || '0',
                  revenue_year: rocYear + 1911,
                  revenue_month: month,
                };
              })
              .catch(() => null)
          )
        );

        const revFiltered = results
          .map((r: any) => r.status === 'fulfilled' ? r.value : null)
          .filter(Boolean)
          .sort((a: any, b: any) => a['資料年月'].localeCompare(b['資料年月']));

        // fallback：若全部失敗，嘗試 openapi 最新一筆
        if (revFiltered.length === 0) {
          const fallback = await fetch(`https://openapi.twse.com.tw/v1/opendata/t187ap05_L`, { headers });
          if (fallback.ok) {
            const fallbackAll = await fallback.json();
            const row = Array.isArray(fallbackAll) ? fallbackAll.filter((d: any) => d['公司代號'] === code) : [];
            return new Response(JSON.stringify({ ok: true, data: row }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }

        return new Response(JSON.stringify({ ok: true, data: revFiltered }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      case 'margin_total':
        // 全市場融資融券總覽（當日）
        url = 'https://openapi.twse.com.tw/v1/exchangeReport/MI_MARGN';
        break;
      case 'dividend':
        // 台股個股歷年配息 - TWSE exchangeReport
        if (!code) throw new Error('code required');
        url = `https://www.twse.com.tw/exchangeReport/STOCK_DAY?response=json&stockNo=${code}`;
        // 改用 goodinfo 格式的 TWSE API
        const r2 = await fetch(
          `https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_d`,
          { headers }
        );
        const allData = await r2.json();
        const stockData = Array.isArray(allData) ? allData.find((d: any) => d['Code'] === code) : null;
        // 再抓配息資料
        const r3 = await fetch(
          `https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL`,
          { headers }
        );
        let divData = null;
        try { divData = await r3.json(); } catch(e) { divData = null; }
        data = { bwibbu: stockData, dividendHistory: divData };
        return new Response(JSON.stringify({ ok: true, data }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      default:
        throw new Error('unknown type: ' + type);
    }

    const r = await fetch(url, { headers });
    if (!r.ok) throw new Error(`upstream HTTP ${r.status}`);

    const text = await r.text();
    try { data = JSON.parse(text); } catch { data = text; }

    // 過濾特定股票
    if (code && Array.isArray(data)) {
      if (type === 'dispose' || type === 'attention') {
        const filtered = data.filter((d: any) =>
          d['股票代號'] === code || d['Code'] === code || d['stockNo'] === code
        );
        data = filtered;
      }
      if (type === 'bwibbu') {
        const filtered = data.filter((d: any) => d['Code'] === code);
        data = filtered.length > 0 ? filtered[0] : null;
      }
      if (type === 'margin_total' && code) {
        const filtered = data.filter((d: any) =>
          d['股票代號'] === code || d['Code'] === code
        );
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
