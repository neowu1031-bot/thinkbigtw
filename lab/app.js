
const PW='';

const SB_URL='https://sirhskxufayklqrlxeep.supabase.co';
const SB_KEY='';
const BASE=SB_URL+'/rest/v1';
const SB_H={'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY};
const NAMES={'2330':'台積電','2317':'鴻海','2454':'聯發科','2382':'廣達','3231':'緯創','2308':'台達電','2303':'聯電','2881':'富邦金','2882':'國泰金','2886':'兆豐金','2891':'中信金','2884':'玉山金','2885':'元大金','2892':'第一金','2883':'開發金','2880':'華南金','2887':'台新金','2888':'新光金','1301':'台塑','1303':'南亞','1326':'台化','2002':'中鋼','2412':'中華電','3008':'大立光','2395':'研華','2357':'華碩','2376':'技嘉','4938':'和碩','2474':'可成','3034':'聯詠','2379':'瑞昱','6505':'台塑化','1216':'統一','2912':'統一超','2207':'和泰車','2105':'正新','2615':'萬海','2603':'長榮','2609':'陽明','2610':'華航','2618':'長榮航','2301':'光寶科','2324':'仁寶','2352':'佳世達','2353':'宏碁','2356':'英業達','3045':'台灣大','4904':'遠傳','2409':'友達','3481':'群創','6669':'緯穎','2408':'南亞科','3711':'日月光投控','2327':'國巨','2360':'致茂','5274':'信驊','6415':'矽力-KY','2049':'上銀','1590':'亞德客-KY','6239':'力成','0050':'元大台灣50','0056':'元大高股息','00878':'國泰永續高股息','00919':'群益台灣精選高息','00929':'復華台灣科技優息','00940':'元大台灣價值高息','00713':'元大台灣高息低波','006208':'富邦台灣采吉50','00881':'國泰台灣5G+'}
let taiexChart=null,stockChart=null,etfChart=null,usChart=null,currentStock='',currentETF='',currentUS='';
const FINNHUB_KEY='';

const LS_PRICE_ALERTS='mr_priceAlerts';
const LS_WATCHLIST='mr_watchlist';

let marketIntervalId=null;
let cryptoIntervalId=null;
let alertsIntervalId=null;

function checkPw(){
  // Phase 1: remove hardcoded password gate (PW is empty).
  if(!PW){showDashboard();return;}
  const inp=document.getElementById('pwInput');
  if(!inp)return;
  if(inp.value===PW){showDashboard();}
  else{
    const err=document.getElementById('errMsg');
    if(err)err.textContent='密碼錯誤';
  }
}
function showDashboard(){
  const lock=document.getElementById('lockScreen');
  if(lock)lock.style.display='none';
  const dash=document.getElementById('dashboard');
  if(dash)dash.style.display='block';

  loadMarketData();loadSupabaseData();
  if(marketIntervalId!=null)clearInterval(marketIntervalId);
  marketIntervalId=setInterval(loadMarketData,30000);
  if(cryptoIntervalId!=null)clearInterval(cryptoIntervalId);
  cryptoIntervalId=setInterval(()=>{const tab=document.getElementById("tab-crypto");if(tab&&tab.classList.contains("active"))loadCrypto();},30000);
  loadRanking("up");loadIntlIndices();setTimeout(()=>loadTaiexChart(30,document.querySelector('#tab-tw .range-btn')),600);
}
showDashboard();





let alertList=JSON.parse(localStorage.getItem(LS_PRICE_ALERTS)||'[]');

function requestNotifyPermission(){
  if(!('Notification' in window)){alert('此瀏覽器不支援通知功能');return;}
  Notification.requestPermission().then(p=>{
    const btn=document.getElementById('notifyBtn');
    if(p==='granted'){btn.textContent='🔔 通知已開啟';btn.style.color='#34d399';btn.style.borderColor='#34d399';}
    else{btn.textContent='🔕 通知已封鎖';btn.style.color='#f87171';}
  });
}

function addAlert(){
  const sym=document.getElementById('alertSymbol').value.trim().toUpperCase();
  const cond=document.getElementById('alertCondition').value;
  const price=parseFloat(document.getElementById('alertPrice').value);
  if(!sym||!price){alert('請填入股票代號和目標價');return;}
  const alert_item={id:Date.now(),symbol:sym,condition:cond,price:price,triggered:false};
  alertList.push(alert_item);
  localStorage.setItem(LS_PRICE_ALERTS,JSON.stringify(alertList));
  document.getElementById('alertSymbol').value='';
  document.getElementById('alertPrice').value='';
  renderAlerts();
  // 申請通知權限
  if(Notification.permission==='default')requestNotifyPermission();
}

function removeAlert(id){
  alertList=alertList.filter(a=>a.id!==id);
  localStorage.setItem(LS_PRICE_ALERTS,JSON.stringify(alertList));
  renderAlerts();
}

function renderAlerts(){
  const el=document.getElementById('alertList');
  if(!el)return;
  if(alertList.length===0){el.innerHTML='<div style="color:#64748b;font-size:13px">尚未設定警示</div>';return;}
  el.innerHTML='';
  alertList.forEach(a=>{
    el.innerHTML+=`<div style="display:flex;align-items:center;justify-content:space-between;background:#1e293b;border-radius:8px;padding:10px 14px;border:1px solid ${a.triggered?'#f59e0b':'#334155'}">
      <div>
        <span style="font-size:14px;color:#e2e8f0;font-weight:600">${a.symbol}</span>
        <span style="font-size:13px;color:#94a3b8;margin-left:8px">${a.condition==='above'?'漲到':'跌到'} $${a.price.toLocaleString()}</span>
        ${a.triggered?'<span style="font-size:12px;color:#f59e0b;margin-left:8px">✓ 已觸發</span>':''}
      </div>
      <button onclick="removeAlert(${a.id})" style="background:transparent;border:none;color:#f87171;cursor:pointer;font-size:16px">✕</button>
    </div>`;
  });
}

async function checkAlerts(){
  if(alertList.length===0)return;
  const activeAlerts=alertList.filter(a=>!a.triggered);
  if(activeAlerts.length===0)return;
  const syms=[...new Set(activeAlerts.map(a=>a.symbol))];
  try{
    const r=await fetch(BASE+'/daily_prices?order=date.desc&limit=1&select=date',{headers:SB_H});
    const latest=(await r.json())[0].date;
    for(const sym of syms){
      const r2=await fetch(BASE+'/daily_prices?symbol=eq.'+sym+'&date=eq.'+latest+'&select=close_price',{headers:SB_H});
      const data=await r2.json();
      if(!data||!data.length)continue;
      const price=parseFloat(data[0].close_price);
      alertList.forEach(a=>{
        if(a.symbol!==sym||a.triggered)return;
        if((a.condition==='above'&&price>=a.price)||(a.condition==='below'&&price<=a.price)){
          a.triggered=true;
          // 瀏覽器推播通知
          if(Notification.permission==='granted'){
            new Notification('📣 台股情報站 價格警示',{
              body:`${sym} 現價 $${price.toLocaleString()} 已${a.condition==='above'?'達到':'跌破'} $${a.price.toLocaleString()}`,
              icon:'/favicon.ico'
            });
          }
        }
      });
    }
    localStorage.setItem(LS_PRICE_ALERTS,JSON.stringify(alertList));
    renderAlerts();
  }catch(e){}
}

// 初始化
renderAlerts();
if(Notification.permission==='granted'){
  const btn=document.getElementById('notifyBtn');
  if(btn){btn.textContent='🔔 通知已開啟';btn.style.color='#34d399';btn.style.borderColor='#34d399';}
}
// 每分鐘檢查一次警示
if(alertsIntervalId!=null)clearInterval(alertsIntervalId);
alertsIntervalId=setInterval(checkAlerts,60000);
async function applyFilter(reset=false){
  const result=document.getElementById('filterResult');
  if(!result)return;
  if(reset){
    document.getElementById('filterMinPct').value='';
    document.getElementById('filterMaxPrice').value='';
    result.innerHTML='';
    return;
  }
  const type=document.getElementById('filterType').value;
  const minPct=parseFloat(document.getElementById('filterMinPct').value)||null;
  const maxPrice=parseFloat(document.getElementById('filterMaxPrice').value)||null;
  result.innerHTML='<div style="color:#64748b">篩選中...</div>';
  try{
    const r=await fetch(BASE+'/daily_prices?order=date.desc&limit=1&select=date',{headers:SB_H});
    const latest=(await r.json())[0].date;
    let url=BASE+'/daily_prices?date=eq.'+latest+'&symbol=neq.TAIEX&limit=50&select=symbol,close_price,change_percent,volume';
    if(type==='up')url+='&order=change_percent.desc';
    else if(type==='down')url+='&order=change_percent.asc';
    else if(type==='volume')url+='&order=volume.desc';
    else if(type==='price_asc')url+='&order=close_price.asc';
    else url+='&order=close_price.desc';
    if(maxPrice)url+=`&close_price=lte.${maxPrice}`;
    const r2=await fetch(url,{headers:SB_H});
    let data=await r2.json();
    // 過濾最小漲幅
    if(minPct!==null){
      data=data.filter(d=>{
        const ch=parseFloat(d.change_percent);
        const prev=parseFloat(d.close_price)-ch;
        const pct=prev>0?ch/prev*100:0;
        return pct>=minPct;
      });
    }
    // 查名稱
    const syms=data.slice(0,20).map(d=>d.symbol).join(',');
    const rn=await fetch(BASE+'/stocks?symbol=in.('+syms+')&select=symbol,name',{headers:SB_H});
    const nameMap={};(await rn.json()).forEach(s=>nameMap[s.symbol]=s.name);
    result.innerHTML=`<div style="color:#94a3b8;font-size:13px;margin-bottom:8px">找到 ${data.length} 檔</div>`;
    data.slice(0,20).forEach((d,i)=>{
      const ch=parseFloat(d.change_percent);
      const prev=parseFloat(d.close_price)-ch;
      const pct=prev>0?(ch/prev*100).toFixed(2):'—';
      const up=ch>=0;
      result.innerHTML+=`<div onclick="document.getElementById('stockInput').value='${d.symbol}';searchStock();" style="display:flex;align-items:center;justify-content:space-between;background:#1e293b;border-radius:8px;padding:10px 14px;cursor:pointer;border:1px solid #0f172a">
        <div>
          <span style="font-size:14px;color:#e2e8f0;font-weight:600">${nameMap[d.symbol]||NAMES[d.symbol]||d.symbol}</span>
          <span style="color:#64748b;font-size:12px;margin-left:6px">${d.symbol}</span>
        </div>
        <div style="text-align:right">
          <div style="font-size:15px;font-weight:700;color:${up?'#34d399':'#f87171'}">${up?'+':''}${pct}%</div>
          <div style="font-size:12px;color:#64748b">$${parseFloat(d.close_price).toLocaleString()}</div>
        </div>
      </div>`;
    });
  }catch(e){result.innerHTML='<div style="color:#f87171">篩選失敗</div>';}
}
async function loadRanking(type){
  // 更新按鈕樣式
  ['up','down','volume'].forEach(t=>{
    const btn=document.getElementById('rank'+t.charAt(0).toUpperCase()+t.slice(1)+'Btn');
    if(btn){btn.style.background=t===type?'#1d4ed8':'#1e293b';btn.style.color=t===type?'#fff':'#94a3b8';btn.style.border=t===type?'none':'1px solid #334155';}
  });
  const list=document.getElementById('rankingList');
  if(!list)return;
  list.innerHTML='<div style="color:#64748b">載入中...</div>';
  try{
    const r=await fetch(BASE+'/daily_prices?order=date.desc&limit=1&select=date',{headers:SB_H});
    const latest=(await r.json())[0].date;
    let url=BASE+'/daily_prices?date=eq.'+latest+'&symbol=neq.TAIEX&limit=10&select=symbol,close_price,change_percent,volume';
    if(type==='up')url+='&order=change_percent.desc';
    else if(type==='down')url+='&order=change_percent.asc';
    else url+='&order=volume.desc';
    const r2=await fetch(url,{headers:SB_H});
    const data=await r2.json();
    // 批次查名稱
    const syms=data.map(d=>d.symbol).join(',');
    const rn=await fetch(BASE+'/stocks?symbol=in.('+syms+')&select=symbol,name',{headers:SB_H});
    const nameData=await rn.json();
    const nameMap={};nameData.forEach(s=>nameMap[s.symbol]=s.name);
    list.innerHTML='';
    data.forEach((d,i)=>{
      const ch=parseFloat(d.change_percent);
      const up=ch>=0;
      const closePx=parseFloat(d.close_price);
      const prevPx=closePx-ch;
      const pct=prevPx>0?Math.abs(ch/prevPx*100).toFixed(2):'—';
      list.innerHTML+=`<div onclick="document.getElementById('stockInput').value='${d.symbol}';searchStock();" title="${nameMap[d.symbol]||NAMES[d.symbol]||d.symbol}" style="display:flex;align-items:center;justify-content:space-between;background:#1e293b;border-radius:8px;padding:10px 14px;cursor:pointer;border:1px solid #0f172a">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="color:#64748b;font-size:13px;width:20px">${i+1}</span>
          <div>
            <div style="font-size:14px;color:#e2e8f0;font-weight:600">${nameMap[d.symbol]||NAMES[d.symbol]||d.symbol} <span style="color:#64748b;font-size:12px">${d.symbol}</span></div>
            <div style="font-size:12px;color:#64748b">${type==='volume'?parseInt(d.volume).toLocaleString()+'張':'$'+parseFloat(d.close_price).toLocaleString()}</div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:15px;font-weight:700;color:${up?'#34d399':'#f87171'}">${up?'+':''}${ch.toFixed(2)}</div>
          <div style="font-size:12px;color:${up?'#34d399':'#f87171'}">${pct!=='—'?(up?'+':'')+pct+'%':''}</div>
        </div>
      </div>`;
    });
  }catch(e){list.innerHTML='<div style="color:#f87171">載入失敗</div>';}
}
function toggleWatchlist(){
  const code=currentStock;
  if(!code)return;
  let ws=JSON.parse(localStorage.getItem(LS_WATCHLIST)||'[]');
  if(ws.includes(code)){ws=ws.filter(s=>s!==code);}else{ws.push(code);}
  localStorage.setItem(LS_WATCHLIST,JSON.stringify(ws));
  const btn=document.getElementById('watchlistBtn');
  btn.textContent=ws.includes(code)?'✓ 已加入自選':'＋ 加入自選';
  btn.style.background=ws.includes(code)?'#166534':'#1d4ed8';
  renderWatchlist();
}
async function renderWatchlist(){
  const ws=JSON.parse(localStorage.getItem(LS_WATCHLIST)||'[]');
  const el=document.getElementById('watchlistGrid');
  if(!el)return;
  if(ws.length===0){el.innerHTML='<div style="color:#64748b;padding:8px">尚未加入任何自選股</div>';return;}
  el.innerHTML='';
  for(const code of ws){
    try{
      const r=await fetch(BASE+'/daily_prices?symbol=eq.'+code+'&order=date.desc&limit=1',{headers:SB_H});
      const data=await r.json();
      if(!data||!data.length)continue;
      const d=data[0];
      const ch=parseFloat(d.change_percent);
      const up=ch>=0;
      el.innerHTML+=`<div onclick="document.getElementById('stockInput').value='${code}';searchStock();" style="background:#1e293b;border-radius:10px;padding:14px;cursor:pointer;border:1px solid #334155">
        <div style="font-size:12px;color:#94a3b8">${code}</div>
        <div style="font-size:14px;color:#e2e8f0">${NAMES[code]||code}</div>
        <div style="font-size:18px;font-weight:700;color:#e2e8f0">${parseFloat(d.close_price).toLocaleString()}</div>
        <div style="font-size:12px;color:${up?'#34d399':'#f87171'}">${up?'▲ +':'▼ '}${ch.toFixed(2)}</div>
      </div>`;
    }catch(e){}
  }
}
function switchTab(name,btn){
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
  btn.classList.add('active');
  const tab=document.getElementById('tab-'+name);
  if(!tab)return;
  tab.classList.add('active');
  if(name==='crypto')setTimeout(loadCrypto,100);
  if(name==='etf')setTimeout(loadETFHot,100);
  if(name==='us')setTimeout(loadUSHot,100);if(name==='fund')setTimeout(loadFX,100);
}



async function searchCrypto(){
  const inputEl=document.getElementById('cryptoSearch');
  const result=document.getElementById('cryptoSearchResult');
  if(!inputEl||!result)return;
  const input=inputEl.value.trim().toUpperCase();
  if(!input){result.innerHTML='';return;}
  const sym=input.endsWith('USDT')?input:input+'USDT';
  result.innerHTML='<div style="color:#94a3b8;padding:8px">查詢中...</div>';
  try{
    const r=await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol='+sym);
    if(!r.ok){result.innerHTML='<div style="color:#f87171;padding:8px">找不到 '+input+'，請確認代號</div>';return;}
    const d=await r.json();
    const pct=parseFloat(d.priceChangePercent);
    const price=parseFloat(d.lastPrice);
    const up=pct>=0;
    result.innerHTML=`<div style="background:#1e3a5f;border:1px solid #2563eb;border-radius:12px;padding:20px;max-width:340px">
      <div style="font-size:13px;color:#94a3b8;margin-bottom:4px">${input} / USDT</div>
      <div style="font-size:26px;font-weight:700;color:#e2e8f0">$${price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:6})}</div>
      <div style="font-size:15px;color:${up?'#34d399':'#f87171'};margin-top:6px">${up?'▲ +':'▼ '}${pct.toFixed(2)}%</div>
      <div style="font-size:12px;color:#64748b;margin-top:8px">24h高: $${parseFloat(d.highPrice).toLocaleString()} | 低: $${parseFloat(d.lowPrice).toLocaleString()}</div>
    </div>`;
  }catch(e){result.innerHTML='<div style="color:#f87171;padding:8px">查詢失敗</div>';}
}
// Enter 鍵觸發搜尋
document.addEventListener('DOMContentLoaded',()=>{
  const inp=document.getElementById('cryptoSearch');
  if(inp)inp.addEventListener('keydown',e=>{if(e.key==='Enter')searchCrypto();});
});
async function loadCrypto(){
  const coins=[
    // 主流
    {sym:'BTCUSDT',name:'Bitcoin'},
    {sym:'ETHUSDT',name:'Ethereum'},
    {sym:'BNBUSDT',name:'BNB'},
    {sym:'SOLUSDT',name:'Solana'},
    {sym:'XRPUSDT',name:'XRP'},
    {sym:'ADAUSDT',name:'Cardano'},
    {sym:'DOGEUSDT',name:'Dogecoin'},
    {sym:'TRXUSDT',name:'TRON'},
    // Layer2/DeFi
    {sym:'AVAXUSDT',name:'Avalanche'},
    {sym:'DOTUSDT',name:'Polkadot'},
    {sym:'MATICUSDT',name:'Polygon'},
    {sym:'LINKUSDT',name:'Chainlink'},
    {sym:'UNIUSDT',name:'Uniswap'},
    {sym:'ATOMUSDT',name:'Cosmos'},
    {sym:'LTCUSDT',name:'Litecoin'},
    {sym:'SHIBUSDT',name:'Shiba Inu'},
    // 新興
    {sym:'SUIUSDT',name:'Sui'},
    {sym:'APTUSDT',name:'Aptos'},
    {sym:'ARBUSDT',name:'Arbitrum'},
    {sym:'OPUSDT',name:'Optimism'},
    {sym:'INJUSDT',name:'Injective'},
    {sym:'TIAUSDT',name:'Celestia'},
    {sym:'WIFUSDT',name:'dogwifhat'},
    {sym:'PEPEUSDT',name:'Pepe'}
  ];
  const grid=document.getElementById('cryptoGrid');
  if(!grid)return;
  grid.innerHTML='';
  for(const c of coins){
    try{
      const r=await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol='+c.sym);
      const d=await r.json();
      const pct=parseFloat(d.priceChangePercent);
      const price=parseFloat(d.lastPrice);
      const up=pct>=0;
      grid.innerHTML+=`<div class="stock-card" style="background:#1e293b;border-radius:12px;padding:20px">
        <div style="font-size:13px;color:#94a3b8;margin-bottom:4px">${c.name}</div>
        <div style="font-size:22px;font-weight:700;color:#e2e8f0">$${price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div style="font-size:14px;color:${up?'#34d399':'#f87171'};margin-top:4px">${up?'▲ +':'▼ '}${pct.toFixed(2)}%</div>
        <div style="font-size:12px;color:#64748b;margin-top:8px">24h量: ${parseFloat(d.volume).toLocaleString(undefined,{maximumFractionDigits:0})}</div>
      </div>`;
    }catch(e){}
  }
}

const INTL_INDICES=[
  {sym:'^DJI',name:'道瓊'},
  {sym:'^IXIC',name:'納斯達克'},
  {sym:'^SPX',name:'S&P500'},
  {sym:'^N225',name:'日經225'},
  {sym:'^HSI',name:'恆生指數'}
];
async function loadIntlIndices(){
  const grid=document.getElementById('intlGrid');
  if(!grid)return;
  for(const idx of INTL_INDICES){
    try{
      const url=`https://query1.finance.yahoo.com/v8/finance/chart/${idx.sym}?interval=1d&range=2d`;
      const proxy='https://api.allorigins.win/get?url='+encodeURIComponent(url);
      const r=await fetch(proxy);
      const raw=await r.json();
      const d=JSON.parse(raw.contents);
      const meta=d.chart.result[0].meta;
      const price=meta.regularMarketPrice;
      const prev=meta.chartPreviousClose;
      const pct=prev?((price-prev)/prev*100):0;
      const up=pct>=0;
      const el=document.getElementById('intl-'+idx.sym.replace('^',''));
      if(el){
        el.innerHTML=`<div style="font-size:12px;color:#94a3b8">${idx.name}</div>
          <div style="font-size:16px;font-weight:700;color:#e2e8f0">${price.toLocaleString(undefined,{maximumFractionDigits:0})}</div>
          <div style="font-size:12px;color:${up?'#34d399':'#f87171'}">${up?'▲ +':'▼ '}${pct.toFixed(2)}%</div>`;
      }
    }catch(e){}
  }
}
async function loadMarketData(){
  try{
    const r=await fetch(BASE+'/daily_prices?symbol=eq.TAIEX&order=date.desc&limit=1',{headers:SB_H});
    const data=await r.json();
    if(data&&data.length>0){
      const d=data[0];
      const taiexEl=document.getElementById('taiex');
      if(taiexEl)taiexEl.textContent=parseFloat(d.close_price).toLocaleString();
      const ch=parseFloat(d.change_percent);
      const el=document.getElementById('taiexChange');
      if(el){
        el.textContent=(ch>=0?'▲ +':'▼ ')+ch.toFixed(2)+' 點';
        el.className='sub '+(ch>=0?'up':'down');
      }
      const hiEl=document.getElementById('taiexHigh');
      if(hiEl)hiEl.textContent=parseFloat(d.high_price).toLocaleString();
      const loEl=document.getElementById('taiexLow');
      if(loEl)loEl.textContent=parseFloat(d.low_price).toLocaleString();
    }else{
      const taiexEl=document.getElementById('taiex');
      if(taiexEl)taiexEl.textContent='盤後更新';
    }
  }catch(e){
    const taiexEl=document.getElementById('taiex');
    if(taiexEl)taiexEl.textContent='盤後更新';
  }
  try{
    const r2=await fetch(BASE+'/institutional_investors?order=total_buy.desc&limit=1&date=eq.'+new Date().toISOString().slice(0,10),{headers:SB_H});
    const d2=await r2.json();
    if(d2&&d2.length>0){
      const val=d2[0].foreign_buy||0;
      const el2=document.getElementById('foreign');
      if(el2){
        el2.textContent=(val>=0?'+':'')+val.toLocaleString();
        el2.className='value '+(val>=0?'up':'down');
      }
    }
  }catch(e){}
}

async function loadTaiexChart(days,btn){
  if(btn){document.querySelectorAll('#tab-tw .chart-range .range-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}
  const since=new Date();since.setDate(since.getDate()-days);
  const s=since.toISOString().split('T')[0];
  try{
    const r=await fetch(BASE+'/daily_prices?symbol=eq.TAIEX&date=gte.'+s+'&order=date.asc&limit=400',{headers:SB_H});
    const data=await r.json();
    if(!data||!data.length)return;
    const el=document.getElementById('taiexChart');
    el.innerHTML='';
    if(taiexChart){try{taiexChart.remove();}catch(e){}}
    taiexChart=LightweightCharts.createChart(el,{width:el.clientWidth,height:300,layout:{background:{color:'#1e293b'},textColor:'#94a3b8'},grid:{vertLines:{color:'#0f172a'},horzLines:{color:'#0f172a'}},rightPriceScale:{borderColor:'#334155'},timeScale:{borderColor:'#334155'}});
    const ls=taiexChart.addLineSeries({color:'#60a5fa',lineWidth:2,priceLineVisible:false});
    ls.setData(data.map(d=>({time:d.date,value:parseFloat(d.close_price)})));
    taiexChart.timeScale().fitContent();
  }catch(e){console.log('chart',e);}
}

async function searchStock(){
  const code=document.getElementById('stockInput').value.trim();
  if(!code)return;
  currentStock=code;
  try{
    const r=await fetch(BASE+'/daily_prices?symbol=eq.'+code+'&order=date.desc&limit=1',{headers:SB_H});
    const data=await r.json();
    const res=document.getElementById('stockResult');
    res.style.display='block';
    if(data&&data.length>0){
      const d=data[0];
      document.getElementById('stockName').textContent=(NAMES[code]||code)+' ('+code+')';
      document.getElementById('stockMeta').textContent='最新交易日：'+d.date;
      document.getElementById('sClose').textContent=d.close_price;
      const ch=parseFloat(d.change_percent);
      const cel=document.getElementById('sChange');
      const pct=d.close_price>0?((ch/(parseFloat(d.close_price)-ch))*100).toFixed(2):ch.toFixed(2);cel.textContent=(ch>=0?'+':'')+pct+'%';
      cel.className='val '+(ch>=0?'up':'down');
      document.getElementById('sVol').textContent=parseInt(d.volume).toLocaleString();
      document.getElementById('sOpen').textContent=d.open_price;
      document.getElementById('sHigh').textContent=d.high_price;
      document.getElementById('sLow').textContent=d.low_price;
      document.getElementById('stockChartContainer').style.display='block';
      document.getElementById('stockChartTitle').textContent=(NAMES[code]||code)+' K線圖';
      // 載入財報數據
      loadFundamentals(code);
      loadStockChart(code,30,document.querySelector('#stockChartContainer .range-btn'));
      // 更新自選股按鈕
      const ws=JSON.parse(localStorage.getItem(LS_WATCHLIST)||'[]');
      const wBtn=document.getElementById('watchlistBtn');
      if(wBtn){wBtn.textContent=ws.includes(code)?'✓ 已加入自選':'＋ 加入自選';wBtn.style.background=ws.includes(code)?'#166534':'#1d4ed8';}
    }else{
      document.getElementById('stockName').textContent=code;
      document.getElementById('stockMeta').textContent='尚無數據';
      ['sClose','sChange','sVol','sOpen','sHigh','sLow'].forEach(id=>document.getElementById(id).textContent='—');
      document.getElementById('stockChartContainer').style.display='none';
    }
  }catch(e){alert('查詢失敗');}
}

async function loadStockChart(code,days,btn){
  if(!code)return;
  if(btn){document.querySelectorAll('#stockChartContainer .range-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}
  const since=new Date();since.setDate(since.getDate()-days);
  const s=since.toISOString().split('T')[0];
  try{
    const r=await fetch(BASE+'/daily_prices?symbol=eq.'+code+'&date=gte.'+s+'&order=date.asc&limit=400',{headers:SB_H});
    const data=await r.json();
    if(!data||!data.length)return;
    const el=document.getElementById('stockChartWrap');
    el.innerHTML='';
    if(stockChart){try{stockChart.remove();}catch(e){}}
    stockChart=LightweightCharts.createChart(el,{width:el.clientWidth,height:280,layout:{background:{color:'#0f172a'},textColor:'#94a3b8'},grid:{vertLines:{color:'#1e293b'},horzLines:{color:'#1e293b'}},rightPriceScale:{borderColor:'#334155'},timeScale:{borderColor:'#334155'}});
    const cs=stockChart.addCandlestickSeries({upColor:'#34d399',downColor:'#f87171',borderUpColor:'#34d399',borderDownColor:'#f87171',wickUpColor:'#34d399',wickDownColor:'#f87171'});
    const kData=data.map(d=>({time:d.date,open:parseFloat(d.open_price),high:parseFloat(d.high_price),low:parseFloat(d.low_price),close:parseFloat(d.close_price)}));
    cs.setData(kData);
    // MA5
    const ma5=stockChart.addLineSeries({color:'#fbbf24',lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});
    const ma5data=kData.map((d,i,arr)=>{if(i<4)return null;const avg=arr.slice(i-4,i+1).reduce((s,v)=>s+v.close,0)/5;return{time:d.time,value:avg};}).filter(Boolean);
    ma5.setData(ma5data);
    // MA20
    const ma20=stockChart.addLineSeries({color:'#a78bfa',lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});
    const ma20data=kData.map((d,i,arr)=>{if(i<19)return null;const avg=arr.slice(i-19,i+1).reduce((s,v)=>s+v.close,0)/20;return{time:d.time,value:avg};}).filter(Boolean);
    ma20.setData(ma20data);
    stockChart.timeScale().fitContent();
    // 進場點位偵測（MA5 黃金/死亡交叉）
    const markers=[];
    for(let i=20;i<kData.length;i++){
      const prev5=ma5data.find(d=>d.time===kData[i-1].time);
      const curr5=ma5data.find(d=>d.time===kData[i].time);
      const prev20=ma20data.find(d=>d.time===kData[i-1].time);
      const curr20=ma20data.find(d=>d.time===kData[i].time);
      if(!prev5||!curr5||!prev20||!curr20)continue;
      if(prev5.value<prev20.value && curr5.value>=curr20.value){
        // 黃金交叉 做多
        markers.push({time:kData[i].time,position:'belowBar',color:'#34d399',shape:'arrowUp',text:'做多'});
      } else if(prev5.value>prev20.value && curr5.value<=curr20.value){
        // 死亡交叉 做空
        markers.push({time:kData[i].time,position:'aboveBar',color:'#f87171',shape:'arrowDown',text:'做空'});
      }
    }
    if(markers.length>0)cs.setMarkers(markers);
    // 計算 RSI(14)
    if(kData.length>=15){
      const closes=kData.map(d=>d.close);
      let gains=0,losses=0;
      for(let i=1;i<=14;i++){const d=closes[closes.length-14-1+i]-closes[closes.length-14-1+i-1];if(d>0)gains+=d;else losses-=d;}
      let avgG=gains/14,avgL=losses/14;
      const lastClose=closes[closes.length-1];
      const prevClose=closes[closes.length-2];
      const diff=lastClose-prevClose;
      if(diff>0){avgG=(avgG*13+diff)/14;}else{avgL=(avgL*13-diff)/14;}
      const rs=avgL===0?100:avgG/avgL;
      const rsi=Math.round(100-100/(1+rs));
      const rsiEl=document.getElementById('stockRSI');
      const rsiLabel=document.getElementById('stockRSILabel');
      if(rsiEl){rsiEl.textContent=rsi;rsiEl.style.color=rsi>70?'#f87171':rsi<30?'#34d399':'#e2e8f0';}
      if(rsiLabel){
        if(rsi>70){rsiLabel.textContent='超買';rsiLabel.style.background='#450a0a';rsiLabel.style.color='#f87171';}
        else if(rsi<30){rsiLabel.textContent='超賣';rsiLabel.style.background='#052e16';rsiLabel.style.color='#34d399';}
        else{rsiLabel.textContent='正常';rsiLabel.style.background='#1e293b';rsiLabel.style.color='#64748b';}
      }
    }
  }catch(e){}
}


async function loadFundamentals(code){
  const el=document.getElementById('stockFundamentals');
  if(!el)return;
  try{
    const r=await fetch(BASE+'/stock_fundamentals?symbol=eq.'+code+'&select=*',{headers:SB_H});
    const data=await r.json();
    if(!data||!data.length){el.style.display='none';return;}
    const d=data[0];
    const items=[
      {label:'EPS',value:d.eps?d.eps.toFixed(2)+'元':'—'},
      {label:'本益比',value:d.pe_ratio?d.pe_ratio.toFixed(1)+'x':'—'},
      {label:'殖利率',value:d.dividend_yield?d.dividend_yield.toFixed(2)+'%':'—'},
      {label:'ROE',value:d.roe?d.roe.toFixed(1)+'%':'—'},
      {label:'每股淨值',value:d.book_value?'$'+d.book_value.toFixed(1):'—'},
      {label:'52週高',value:d.week52_high?'$'+d.week52_high.toLocaleString():'—'},
      {label:'52週低',value:d.week52_low?'$'+d.week52_low.toLocaleString():'—'},
    ];
    el.style.display='block';
    el.innerHTML=`<div style="font-size:13px;color:#64748b;margin-bottom:8px">基本面數據</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px">
        ${items.map(i=>`<div style="background:#0f172a;border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:11px;color:#64748b;margin-bottom:4px">${i.label}</div>
          <div style="font-size:15px;font-weight:700;color:#e2e8f0">${i.value}</div>
        </div>`).join('')}
      </div>`;
  }catch(e){if(el)el.style.display='none';}
}
async function searchETF(){
  const code=document.getElementById('etfInput').value.trim();
  if(!code)return;
  currentETF=code;
  try{
    const r=await fetch(BASE+'/daily_prices?symbol=eq.'+code+'&order=date.desc&limit=1',{headers:SB_H});
    const data=await r.json();
    const res=document.getElementById('etfResult');
    res.style.display='block';
    if(data&&data.length>0){
      const d=data[0];
      document.getElementById('etfName').textContent=(NAMES[code]||code)+' ('+code+')';
      document.getElementById('etfMeta').textContent='最新交易日：'+d.date;
      document.getElementById('eClose').textContent=d.close_price;
      const ch=parseFloat(d.change_percent);
      const cel=document.getElementById('eChange');
      const pct=d.close_price>0?((ch/(parseFloat(d.close_price)-ch))*100).toFixed(2):ch.toFixed(2);cel.textContent=(ch>=0?'+':'')+pct+'%';
      cel.className='val '+(ch>=0?'up':'down');
      document.getElementById('eVol').textContent=parseInt(d.volume).toLocaleString();
      document.getElementById('etfChartContainer').style.display='block';
      document.getElementById('etfChartTitle').textContent=(NAMES[code]||code)+' K線圖';
      loadETFChart(code,30,document.querySelector('#etfChartContainer .range-btn'));
      loadETFDividend(code);
    }else{
      document.getElementById('etfName').textContent=code;
      document.getElementById('etfMeta').textContent='尚無數據';
      document.getElementById('etfChartContainer').style.display='none';
    }
  }catch(e){alert('查詢失敗');}
}


const ETF_HOT = [
  // 指數型
  {sym:'0050',name:'元大台灣50'},
  {sym:'006208',name:'富邦台灣采吉50'},
  {sym:'0051',name:'元大中型100'},
  {sym:'0052',name:'富邦科技'},
  {sym:'0053',name:'元大電子'},
  {sym:'0054',name:'元大台商50'},
  {sym:'0055',name:'元大MSCI金融'},
  // 高股息型
  {sym:'0056',name:'元大高股息'},
  {sym:'00713',name:'元大台灣高息低波'},
  {sym:'00878',name:'國泰永續高股息'},
  {sym:'00900',name:'富邦特選高股息30'},
  {sym:'00915',name:'凱基優選高股息30'},
  {sym:'00918',name:'大華優利高填息30'},
  {sym:'00919',name:'群益台灣精選高息'},
  {sym:'00923',name:'群益台灣精選高息30'},
  {sym:'00929',name:'復華台灣科技優息'},
  {sym:'00934',name:'中信成長高股息'},
  {sym:'00940',name:'元大台灣價值高息'},
  {sym:'00905',name:'富邦台灣優質高息'},
  {sym:'00907',name:'永豐優息存股'},
  // 科技主題
  {sym:'00881',name:'國泰台灣5G+'},
  {sym:'00891',name:'中信關鍵半導體'},
  {sym:'00892',name:'富邦台灣半導體'},
  {sym:'00896',name:'中信綠能及電動車'},
  {sym:'00893',name:'國泰智能電動車'},
  {sym:'00927',name:'群益半導體收益ETF'},
  {sym:'00922',name:'國泰台灣尖牙+'},
  {sym:'00935',name:'野村臺灣新科技50'},
  // ESG/永續
  {sym:'00850',name:'元大臺灣ESG永續'},
  {sym:'00888',name:'永豐台灣ESG'},
  // 美股/海外
  {sym:'00646',name:'元大S&P500'},
  {sym:'00827',name:'中信美國500大'},
  {sym:'00858',name:'國泰美國道瓊'},
  {sym:'00830',name:'國泰費城半導體'},
  {sym:'00757',name:'統一FANG+'},
  {sym:'00662',name:'富邦NASDAQ'},
  {sym:'00631L',name:'元大S&P500正2'},
  // 債券型
  {sym:'00679B',name:'元大美債20年'},
  {sym:'00696B',name:'富邦美債20年'},
  {sym:'00720B',name:'元大投資級公司債'},
  {sym:'00723B',name:'群益15年IG'},
  {sym:'00795B',name:'富邦投資級公司債'},
  {sym:'00751B',name:'元大AAA至A公司債'},
  // 原物料/黃金
  {sym:'00635U',name:'元大S&P黃金'},
  {sym:'00642U',name:'元大S&P石油'},
  // 槓桿反向
  {sym:'00631L',name:'元大S&P500正2'},
  {sym:'00632R',name:'元大S&P500反1'},
  {sym:'00663L',name:'國泰臺灣加權正2'},
  {sym:'00664R',name:'國泰臺灣加權反1'}
];

const US_HOT=[
  // 科技巨頭
  {sym:'AAPL',name:'Apple'},
  {sym:'NVDA',name:'NVIDIA'},
  {sym:'MSFT',name:'Microsoft'},
  {sym:'GOOGL',name:'Alphabet'},
  {sym:'AMZN',name:'Amazon'},
  {sym:'META',name:'Meta'},
  {sym:'TSLA',name:'Tesla'},
  {sym:'TSM',name:'台積電 ADR'},
  // 半導體
  {sym:'AMD',name:'AMD'},
  {sym:'INTC',name:'Intel'},
  {sym:'QCOM',name:'Qualcomm'},
  {sym:'AVGO',name:'Broadcom'},
  {sym:'MU',name:'Micron'},
  {sym:'AMAT',name:'應用材料'},
  {sym:'LRCX',name:'科林研發'},
  {sym:'KLAC',name:'科磊'},
  {sym:'ASML',name:'ASML'},
  {sym:'ARM',name:'ARM Holdings'},
  // AI/雲端/SaaS
  {sym:'PLTR',name:'Palantir'},
  {sym:'CRM',name:'Salesforce'},
  {sym:'ORCL',name:'Oracle'},
  {sym:'NOW',name:'ServiceNow'},
  {sym:'SNOW',name:'Snowflake'},
  {sym:'DDOG',name:'Datadog'},
  {sym:'ZS',name:'Zscaler'},
  {sym:'CRWD',name:'CrowdStrike'},
  // 消費/娛樂/電商
  {sym:'NFLX',name:'Netflix'},
  {sym:'DIS',name:'Disney'},
  {sym:'SHOP',name:'Shopify'},
  {sym:'UBER',name:'Uber'},
  {sym:'ABNB',name:'Airbnb'},
  {sym:'DASH',name:'DoorDash'},
  {sym:'SPOT',name:'Spotify'},
  {sym:'RBLX',name:'Roblox'},
  // 金融/支付
  {sym:'JPM',name:'摩根大通'},
  {sym:'BAC',name:'美國銀行'},
  {sym:'GS',name:'高盛'},
  {sym:'V',name:'Visa'},
  {sym:'MA',name:'Mastercard'},
  {sym:'PYPL',name:'PayPal'},
  {sym:'SQ',name:'Block'},
  // 傳產/能源/醫療
  {sym:'BRK-B',name:'波克夏'},
  {sym:'JNJ',name:'嬌生'},
  {sym:'PFE',name:'輝瑞'},
  {sym:'XOM',name:'埃克森美孚'},
  {sym:'CVX',name:'雪佛龍'},
  // 中概股
  {sym:'BABA',name:'阿里巴巴'},
  {sym:'BIDU',name:'百度'},
  {sym:'JD',name:'京東'},
  {sym:'PDD',name:'拼多多'},
  {sym:'NTES',name:'網易'},
  {sym:'BILI',name:'嗶哩嗶哩'},
  // 美股ETF
  {sym:'SPY',name:'S&P500 ETF'},
  {sym:'QQQ',name:'NASDAQ ETF'},
  {sym:'SOXX',name:'費城半導體ETF'},
  {sym:'ARKK',name:'ARK Innovation'},
  {sym:'GLD',name:'黃金ETF'},
  {sym:'TLT',name:'美債20年ETF'},
  {sym:'SQQQ',name:'NASDAQ三倍反向'},
  {sym:'TQQQ',name:'NASDAQ三倍正向'}
];
async function fetchUSStock(sym){
  const r=await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${FINNHUB_KEY}`);
  const d=await r.json();
  if(!d||!d.c)throw new Error('no data');
  const price=d.c;
  const prev=d.pc;
  const pct=prev?((price-prev)/prev*100):0;
  const high=d.h||price;
  const low=d.l||price;
  return {price,pct,high,low};
}
function usCard(sym,name,price,pct,extra=''){
  const up=pct>=0;
  return `<div class="stock-card" style="background:#1e293b;border-radius:12px;padding:16px;border:1px solid #334155">
    <div style="font-size:12px;color:#94a3b8">${sym}</div>
    <div style="font-size:14px;color:#e2e8f0;margin:2px 0">${name}</div>
    <div style="font-size:20px;font-weight:700;color:#e2e8f0">$${price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
    <div style="font-size:13px;color:${up?'#34d399':'#f87171'}">${up?'▲ +':'▼ '}${pct.toFixed(2)}%</div>
    ${extra}
  </div>`;
}

const FX_ITEMS=[
  // 台幣相關
  {sym:'USDTWD=X',name:'美元/台幣',unit:'TWD'},
  {sym:'JPYTWD=X',name:'日圓/台幣',unit:'TWD'},
  {sym:'EURTWD=X',name:'歐元/台幣',unit:'TWD'},
  // 主要貨幣
  {sym:'EURUSD=X',name:'歐元/美元',unit:'USD'},
  {sym:'JPY=X',name:'美元/日圓',unit:'JPY'},
  {sym:'GBPUSD=X',name:'英鎊/美元',unit:'USD'},
  {sym:'AUDUSD=X',name:'澳幣/美元',unit:'USD'},
  {sym:'CNY=X',name:'美元/人民幣',unit:'CNY'},
  {sym:'KRWUSD=X',name:'韓元/美元',unit:'KRW'},
  // 貴金屬
  {sym:'GC=F',name:'黃金',unit:'USD/oz'},
  {sym:'SI=F',name:'白銀',unit:'USD/oz'},
  // 大宗商品
  {sym:'CL=F',name:'原油(WTI)',unit:'USD/桶'},
  {sym:'NG=F',name:'天然氣',unit:'USD'},
  {sym:'HG=F',name:'銅',unit:'USD/磅'}
];
async function loadFX(){
  const grid=document.getElementById('fxGrid');
  if(!grid)return;
  grid.innerHTML='';
  for(const item of FX_ITEMS){
    try{
      const url=`https://query1.finance.yahoo.com/v8/finance/chart/${item.sym}?interval=1d&range=2d`;
      const proxy='https://api.allorigins.win/raw?url='+encodeURIComponent(url);
      const r=await fetch(proxy);
      const d=await r.json();
      const meta=d.chart.result[0].meta;
      const price=meta.regularMarketPrice;
      const prev=meta.chartPreviousClose;
      const pct=prev?((price-prev)/prev*100):0;
      const up=pct>=0;
      const decimals=price>100?2:4;
      grid.innerHTML+=`<div style="background:#1e293b;border-radius:12px;padding:16px;border:1px solid #334155">
        <div style="font-size:12px;color:#94a3b8">${item.unit}</div>
        <div style="font-size:15px;color:#e2e8f0;margin:2px 0">${item.name}</div>
        <div style="font-size:22px;font-weight:700;color:#e2e8f0">${price.toLocaleString(undefined,{minimumFractionDigits:decimals,maximumFractionDigits:decimals})}</div>
        <div style="font-size:13px;color:${up?'#34d399':'#f87171'}">${up?'▲ +':'▼ '}${pct.toFixed(2)}%</div>
      </div>`;
    }catch(e){grid.innerHTML+=`<div style="background:#1e293b;border-radius:12px;padding:16px;color:#64748b">${item.name} 載入失敗</div>`;}
  }
}
async function loadUSHot(){
  const grid=document.getElementById('usHotGrid');
  if(!grid)return;
  grid.innerHTML='';
  for(const s of US_HOT){
    try{
      const {price,pct}=await fetchUSStock(s.sym);
      grid.innerHTML+=usCard(s.sym,s.name,price,pct);
    }catch(e){grid.innerHTML+=`<div style="background:#1e293b;border-radius:12px;padding:16px;color:#64748b">${s.sym} 載入失敗</div>`;}
  }
}
async function searchUS(){
  const sym=document.getElementById('usSearch').value.trim().toUpperCase();
  const result=document.getElementById('usSearchResult');
  if(!sym){result.innerHTML='';return;}
  result.innerHTML='<div style="color:#94a3b8;padding:8px">查詢中...</div>';
  try{
    const {price,pct,high,low}=await fetchUSStock(sym);
    const up=pct>=0;
    currentUS=sym;
    result.innerHTML=`<div style="background:#1e3a5f;border:1px solid #2563eb;border-radius:12px;padding:20px;max-width:400px">
      <div style="font-size:13px;color:#94a3b8;margin-bottom:4px">${sym}</div>
      <div style="font-size:26px;font-weight:700;color:#e2e8f0">$${price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
      <div style="font-size:15px;color:${up?'#34d399':'#f87171'};margin-top:6px">${up?'▲ +':'▼ '}${pct.toFixed(2)}%</div>
      <div style="font-size:12px;color:#64748b;margin-top:8px">今日高: $${high.toFixed(2)} | 低: $${low.toFixed(2)}</div>
    </div>`;
    document.getElementById('usChartTitle').textContent=sym+' K線圖';
    document.getElementById('usChartContainer').style.display='block';
    loadUSChart(sym,30,document.querySelector('#usChartContainer .range-btn'));
  }catch(e){result.innerHTML='<div style="color:#f87171;padding:8px">找不到 '+sym+'，請確認代號</div>';}
}
async function loadUSChart(sym,days,btn){
  if(!sym)return;
  if(btn){document.querySelectorAll('#usChartContainer .range-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}
  const el=document.getElementById('usChartWrap');
  if(!el)return;
  el.innerHTML='<div style="color:#64748b;padding:20px;text-align:center">載入中...</div>';
  try{
    const now=Math.floor(Date.now()/1000);
    const from=now-days*86400;
    const r=await fetch(`https://finnhub.io/api/v1/stock/candle?symbol=${sym}&resolution=D&from=${from}&to=${now}&token=${FINNHUB_KEY}`);
    const d=await r.json();
    if(!d||d.s==='no_data'||!d.t)throw new Error('no data');
    el.innerHTML='';
    if(usChart){try{usChart.remove();}catch(e){}}
    usChart=LightweightCharts.createChart(el,{width:el.clientWidth,height:260,layout:{background:{color:'#0f172a'},textColor:'#94a3b8'},grid:{vertLines:{color:'#1e293b'},horzLines:{color:'#1e293b'}},rightPriceScale:{borderColor:'#334155'},timeScale:{borderColor:'#334155'}});
    const cs=usChart.addCandlestickSeries({upColor:'#34d399',downColor:'#f87171',borderUpColor:'#34d399',borderDownColor:'#f87171',wickUpColor:'#34d399',wickDownColor:'#f87171'});
    const bars=d.t.map((t,i)=>({time:t,open:d.o[i],high:d.h[i],low:d.l[i],close:d.c[i]})).filter(b=>b.open&&b.high&&b.low&&b.close);
    cs.setData(bars);
    usChart.timeScale().fitContent();
  }catch(e){el.innerHTML='<div style="color:#f87171;padding:20px;text-align:center">K線載入失敗</div>';}
}

async function loadETFDividend(code){
  const el=document.getElementById('etfDividend');
  if(!el)return;
  try{
    // 基本面殖利率
    const r0=await fetch(BASE+'/stock_fundamentals?symbol=eq.'+code+'&select=dividend_yield,pe_ratio',{headers:SB_H});
    const fd=await r0.json();
    // 配息明細
    const r1=await fetch(BASE+'/etf_dividends?symbol=eq.'+code+'&order=ex_dividend_date.desc&limit=12',{headers:SB_H});
    const divs=await r1.json();
    let html='<div style="margin:10px 0">';
    // 殖利率卡片
    if(fd&&fd.length){
      const f=fd[0];
      html+=`<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
        <div style="background:#0f172a;border-radius:8px;padding:10px 16px;text-align:center;min-width:80px">
          <div style="font-size:11px;color:#64748b;margin-bottom:4px">年殖利率</div>
          <div style="font-size:18px;font-weight:700;color:#34d399">${f.dividend_yield?f.dividend_yield.toFixed(2)+'%':'—'}</div>
        </div>
        <div style="background:#0f172a;border-radius:8px;padding:10px 16px;text-align:center;min-width:80px">
          <div style="font-size:11px;color:#64748b;margin-bottom:4px">本益比</div>
          <div style="font-size:18px;font-weight:700;color:#e2e8f0">${f.pe_ratio?f.pe_ratio.toFixed(1)+'x':'—'}</div>
        </div>
      </div>`;
    }
    // 配息明細列表
    if(divs&&divs.length){
      html+='<div style="font-size:12px;color:#93c5fd;font-weight:700;margin-bottom:6px;border-left:3px solid #2563eb;padding-left:8px">📅 配息記錄</div>';
      html+='<div style="display:flex;flex-direction:column;gap:4px">';
      divs.forEach(d=>{
        const amt=d.dividend_amount!=null?'$'+parseFloat(d.dividend_amount).toFixed(3):'待公告';
        const color=d.dividend_amount!=null?'#34d399':'#94a3b8';
        html+=`<div style="display:flex;justify-content:space-between;align-items:center;background:#0f172a;border-radius:6px;padding:8px 12px">
          <div>
            <div style="font-size:12px;color:#94a3b8">除息日 ${d.ex_dividend_date||'—'}</div>
            <div style="font-size:11px;color:#64748b">發放日 ${d.payment_date||'—'}</div>
          </div>
          <div style="font-size:16px;font-weight:700;color:${color}">${amt}</div>
        </div>`;
      });
      html+='</div>';
    }
    html+='</div>';
    el.style.display='block';
    el.innerHTML=html;
  }catch(e){if(el)el.style.display='none';}
}
async function loadETFHot(){
  const grid=document.getElementById('etfHotGrid');
  if(!grid)return;
  // 使用全域 SB_URL, SB_KEY, SB_H
  grid.innerHTML='';
  for(const e of ETF_HOT){
    try{
      const r=await fetch(SB_URL+'/rest/v1/daily_prices?symbol=eq.'+e.sym+'&order=date.desc&limit=1',
        {headers:SB_H});
      const data=await r.json();
      if(!data||data.length===0){continue;}
      const d=data[0];
      const pct=parseFloat(d.change_percent)||0;
      const up=pct>=0;
      grid.innerHTML+=`<div class="stock-card" onclick="document.getElementById('etfInput').value='${e.sym}';searchETF();" style="background:#1e293b;border-radius:12px;padding:16px;cursor:pointer;border:1px solid #334155">
        <div style="font-size:12px;color:#94a3b8">${e.sym}</div>
        <div style="font-size:14px;color:#e2e8f0;margin:2px 0">${e.name}</div>
        <div style="font-size:20px;font-weight:700;color:#e2e8f0">$${parseFloat(d.close_price).toLocaleString()}</div>
        <div style="font-size:13px;color:${up?'#34d399':'#f87171'}">${up?'▲ +':'▼ '}${pct.toFixed(2)}%</div>
      </div>`;
    }catch(e2){}
  }
}
async function loadETFChart(code,days,btn){
  if(!code)return;
  if(btn){document.querySelectorAll('#etfChartContainer .range-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}
  const since=new Date();since.setDate(since.getDate()-days);
  const s=since.toISOString().split('T')[0];
  try{
    const r=await fetch(BASE+'/daily_prices?symbol=eq.'+code+'&date=gte.'+s+'&order=date.asc&limit=400',{headers:SB_H});
    const data=await r.json();
    if(!data||!data.length)return;
    const el=document.getElementById('etfChartWrap');
    el.innerHTML='';
    if(etfChart){try{etfChart.remove();}catch(e){}}
    etfChart=LightweightCharts.createChart(el,{width:el.clientWidth,height:280,layout:{background:{color:'#0f172a'},textColor:'#94a3b8'},grid:{vertLines:{color:'#1e293b'},horzLines:{color:'#1e293b'}},rightPriceScale:{borderColor:'#334155'},timeScale:{borderColor:'#334155'}});
    const cs=etfChart.addCandlestickSeries({upColor:'#34d399',downColor:'#f87171',borderUpColor:'#34d399',borderDownColor:'#f87171',wickUpColor:'#34d399',wickDownColor:'#f87171'});
    cs.setData(data.map(d=>({time:d.date,open:parseFloat(d.open_price),high:parseFloat(d.high_price),low:parseFloat(d.low_price),close:parseFloat(d.close_price)})));
    etfChart.timeScale().fitContent();
  }catch(e){}
}

async function loadSupabaseData(){
  try{
    const r=await fetch(BASE+'/ai_analysis?order=date.desc&limit=10',{headers:SB_H});
    const data=await r.json();
    if(data&&data.length>0)document.getElementById('aiText').innerHTML=data.map(d=>'<span class="ai-stock">'+(NAMES[d.symbol]||d.symbol)+' ('+d.symbol+')</span> '+d.summary+'<br><br>').join('');
  }catch(e){}
  try{
    const r=await fetch(BASE+'/sentiment?order=mention_count.desc&limit=5',{headers:SB_H});
    const data=await r.json();
    if(data&&data.length>0)document.getElementById('sentimentList').innerHTML=data.map((d,i)=>{const tag=d.sentiment_score>=0.6?'tag-up">正面':d.sentiment_score<=0.4?'tag-down">負面':'tag-neutral">中性';return '<div class="rank-item"><div class="rank-num">'+(i+1)+'</div><div><div class="rank-name">'+(NAMES[d.symbol]||d.symbol)+' '+d.symbol+'</div><div class="rank-sub">今日討論 '+d.mention_count+' 則</div></div><span class="tag '+tag+'</span></div>';}).join('');
  }catch(e){}
  try{
    const r=await fetch(BASE+'/institutional_investors?order=total_buy.desc&limit=5&date=eq.'+new Date().toISOString().slice(0,10),{headers:SB_H});
    const data=await r.json();
    if(data&&data.length>0)document.getElementById('institutionalList').innerHTML=data.map((d,i)=>{const who=d.foreign_buy>0&&d.investment_trust_buy>0?'外資+投信':d.foreign_buy>0?'外資':'投信';const nm=NAMES[d.symbol]||d.symbol;const nm2=nm===d.symbol?d.symbol:nm+' '+d.symbol;const sheets=Math.round((d.total_buy||0)/1000);return '<div class="rank-item"><div class="rank-num">'+(i+1)+'</div><div><div class="rank-name">'+nm2+'</div><div class="rank-sub">'+who+'</div></div><div class="rank-val up">+'+sheets.toLocaleString()+'張</div></div>';}).join('');
  }catch(e){}
}
