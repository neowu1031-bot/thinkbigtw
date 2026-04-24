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
    const { type, code, name, from, to } = await req.json();
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
      case 'etf_nav': {
        // ETF 折溢價 - TWSE opendata ETF_topmessage
        const navRes = await fetch('https://openapi.twse.com.tw/v1/opendata/ETF_topmessage', { headers });
        if (!navRes.ok) throw new Error(`upstream HTTP ${navRes.status}`);
        const navAll = await navRes.json();
        const navItem = Array.isArray(navAll) && code
          ? navAll.find((d: any) =>
              d['基金代碼'] === code ||
              d['ETFcode'] === code ||
              d['基金代號'] === code
            )
          : null;
        return new Response(JSON.stringify({ ok: true, data: navItem || null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
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
        // 月營收 - TWSE 公開資料 (CC BY 4.0 政府授權，可商業使用)
        if (!code) throw new Error('code required');
        const revRes = await fetch(`https://openapi.twse.com.tw/v1/opendata/t187ap05_L`, { headers });
        if (!revRes.ok) throw new Error(`upstream HTTP ${revRes.status}`);
        const revAll = await revRes.json();
        const revFiltered = Array.isArray(revAll) ? revAll.filter((d: any) => d['公司代號'] === code) : [];
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
      case 'news': {
        const q = encodeURIComponent((name || code || '') + ' 台股');
        const rssUrl = `https://news.google.com/rss/search?q=${q}&hl=zh-TW&gl=TW&ceid=TW:zh-Hant`;
        const rssRes = await fetch(rssUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
        });
        if (!rssRes.ok) throw new Error(`RSS fetch failed: ${rssRes.status}`);
        const xmlText = await rssRes.text();
        const newsItems: { title: string; link: string; pubDate: string }[] = [];
        const itemMatches = xmlText.matchAll(/<item>([\s\S]*?)<\/item>/g);
        for (const match of itemMatches) {
          const itemXml = match[1];
          const titleMatch =
            itemXml.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
            itemXml.match(/<title>([\s\S]*?)<\/title>/);
          const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/);
          const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
          if (titleMatch) {
            newsItems.push({
              title: titleMatch[1].trim(),
              link: linkMatch?.[1]?.trim() || '#',
              pubDate: pubDateMatch?.[1]?.trim() || '',
            });
          }
          if (newsItems.length >= 5) break;
        }
        return new Response(JSON.stringify({ ok: true, data: newsItems }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      case 'us_quote': {
        if (!code) throw new Error('code required');
        const fhKey = Deno.env.get('FINNHUB_KEY');
        if (!fhKey) throw new Error('FINNHUB_KEY not set');
        const qRes = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(code)}&token=${fhKey}`);
        if (!qRes.ok) throw new Error(`finnhub HTTP ${qRes.status}`);
        const qData = await qRes.json();
        return new Response(JSON.stringify({ ok: true, data: qData }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      case 'us_candle': {
        if (!code) throw new Error('code required');
        if (!from || !to) throw new Error('from and to required');
        const fhKey = Deno.env.get('FINNHUB_KEY');
        if (!fhKey) throw new Error('FINNHUB_KEY not set');
        const cRes = await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(code)}&resolution=D&from=${from}&to=${to}&token=${fhKey}`);
        if (!cRes.ok) throw new Error(`finnhub HTTP ${cRes.status}`);
        const cData = await cRes.json();
        return new Response(JSON.stringify({ ok: true, data: cData }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      case 'us_economic': {
        if (!code) throw new Error('code required');
        const fhKey = Deno.env.get('FINNHUB_KEY');
        if (!fhKey) throw new Error('FINNHUB_KEY not set');
        const eRes = await fetch(`https://finnhub.io/api/v1/economic?code=${encodeURIComponent(code)}&token=${fhKey}`);
        if (!eRes.ok) throw new Error(`finnhub HTTP ${eRes.status}`);
        const eData = await eRes.json();
        return new Response(JSON.stringify({ ok: true, data: eData }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
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
