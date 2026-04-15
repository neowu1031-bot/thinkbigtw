
const PW='thinkbig2025';
const SB_URL='https://sirhskxufayklqrlxeep.supabase.co';
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcmhza3h1ZmF5a2xxcmx4ZWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTc5ODQsImV4cCI6MjA5MDMzMzk4NH0.i0iNEGXq3tkLrQQbGq3WJbNPbNrnrV6ryg8UUB8Bz5g';
const BASE=SB_URL+'/rest/v1';
const SB_H={'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY};
const NAMES={'2330':'台積電','2317':'鴻海','2454':'聯發科','2382':'廣達','3231':'緯創','2308':'台達電','0050':'元大台灣50','00878':'國泰永續高股息'};
let taiexChart=null,stockChart=null,etfChart=null,currentStock='',currentETF='';

function checkPw(){
  if(document.getElementById('pwInput').value===PW){showDashboard();}
  else document.getElementById('errMsg').textContent='密碼錯誤';
}
function showDashboard(){
  document.getElementById('lockScreen').style.display='none';
  document.getElementById('dashboard').style.display='block';
  loadMarketData();loadSupabaseData();setInterval(loadMarketData,30000);setInterval(()=>{if(document.getElementById("tab-crypto").classList.contains("active"))loadCrypto();},30000);
  loadRanking("up");setTimeout(()=>loadTaiexChart(30,document.querySelector('#tab-tw .range-btn')),600);
}
// 不自動進入，等待密碼





let alertList=JSON.parse(localStorage.getItem('priceAlerts')||'[]');

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
  localStorage.setItem('priceAlerts',JSON.stringify(alertList));
  document.getElementById('alertSymbol').value='';
  document.getElementById('alertPrice').value='';
  renderAlerts();
  // 申請通知權限
  if(Notification.permission==='default')requestNotifyPermission();
}

function removeAlert(id){
  alertList=alertList.filter(a=>a.id!==id);
  localStorage.setItem('priceAlerts',JSON.stringify(alertList));
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
    localStorage.setItem('priceAlerts',JSON.stringify(alertList));
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
setInterval(checkAlerts,60000);
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
  let ws=JSON.parse(localStorage.getItem('watchlist')||'[]');
  if(ws.includes(code)){ws=ws.filter(s=>s!==code);}else{ws.push(code);}
  localStorage.setItem('watchlist',JSON.stringify(ws));
  const btn=document.getElementById('watchlistBtn');
  btn.textContent=ws.includes(code)?'✓ 已加入自選':'＋ 加入自選';
  btn.style.background=ws.includes(code)?'#166534':'#1d4ed8';
  renderWatchlist();
}
async function renderWatchlist(){
  const ws=JSON.parse(localStorage.getItem('watchlist')||'[]');
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
  document.getElementById('tab-'+name).classList.add('active');
  if(name==='crypto')setTimeout(loadCrypto,100);
  if(name==='etf')setTimeout(loadETFHot,100);
  if(name==='us')setTimeout(loadUSHot,100);if(name==='fund')setTimeout(loadFX,100);
}



async function searchCrypto(){
  const input=document.getElementById('cryptoSearch').value.trim().toUpperCase();
  const result=document.getElementById('cryptoSearchResult');
  if(!input){result.innerHTML='';return;}
  const sym=input.endsWith('USDT')?input:input+'USDT';
  result.innerHTML='<div style="color:#94a3b8;padding:8px">查詢中...</div>';
  try{
    const r=await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol='+sym);
    if(!r.ok){result.innerHTML='<div style="color:#f87171;padding:8px">找不到 '+input+'，請確認代號是否正確</div>';return;}
    const d=await r.json();
    const pct=parseFloat(d.priceChangePercent);
    const price=parseFloat(d.lastPrice);
    const up=pct>=0;
    result.innerHTML=`<div style="background:#1e3a5f;border:1px solid #2563eb;border-radius:12px;padding:20px;max-width:320px">
      <div style="font-size:13px;color:#94a3b8;margin-bottom:4px">${input} / USDT</div>
      <div style="font-size:28px;font-weight:700;color:#e2e8f0">$${price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:6})}</div>
      <div style="font-size:16px;color:${up?'#34d399':'#f87171'};margin-top:6px">${up?'▲ +':'▼ '}${pct.toFixed(2)}%</div>
      <div style="font-size:12px;color:#64748b;margin-top:8px">24h量: ${parseFloat(d.volume).toLocaleString(undefined,{maximumFractionDigits:0})} | 高: $${parseFloat(d.highPrice).toLocaleString()} | 低: $${parseFloat(d.lowPrice).toLocaleString()}</div>
    </div>`;
  }catch(e){result.innerHTML='<div style="color:#f87171;padding:8px">查詢失敗，請稍後再試</div>';}
}
// Enter 鍵觸發搜尋
document.addEventListener('DOMContentLoaded',()=>{
  const inp=document.getElementById('cryptoSearch');
  if(inp)inp.addEventListener('keydown',e=>{if(e.key==='Enter')searchCrypto();});
});

async function searchCrypto(){
  const input=document.getElementById('cryptoSearch').value.trim().toUpperCase();
  const result=document.getElementById('cryptoSearchResult');
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
async function loadCrypto(){
  const coins=[
    {sym:'BTCUSDT',name:'Bitcoin'},
    {sym:'ETHUSDT',name:'Ethereum'},
    {sym:'BNBUSDT',name:'BNB'},
    {sym:'SOLUSDT',name:'Solana'},
    {sym:'XRPUSDT',name:'XRP'},
    {sym:'ADAUSDT',name:'Cardano'},
    {sym:'DOGEUSDT',name:'Dogecoin'},
    {sym:'TRXUSDT',name:'TRON'}
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
async function loadMarketData(){
  try{
    const r=await fetch(BASE+'/daily_prices?symbol=eq.TAIEX&order=date.desc&limit=1',{headers:SB_H});
    const data=await r.json();
    if(data&&data.length>0){
      const d=data[0];
      document.getElementById('taiex').textContent=parseFloat(d.close_price).toLocaleString();
      const ch=parseFloat(d.change_percent);
      const el=document.getElementById('taiexChange');
      el.textContent=(ch>=0?'▲ +':'▼ ')+ch.toFixed(2)+' 點';
      el.className='sub '+(ch>=0?'up':'down');
      const vol=parseFloat(d.volume);
      document.getElementById('taiexHigh').textContent=parseFloat(d.high_price).toLocaleString();document.getElementById('taiexLow').textContent=parseFloat(d.low_price).toLocaleString();
    }else document.getElementById('taiex').textContent='盤後更新';
  }catch(e){document.getElementById('taiex').textContent='盤後更新';}
  try{
    const r2=await fetch(BASE+'/institutional_investors?order=date.desc&limit=1',{headers:SB_H});
    const d2=await r2.json();
    if(d2&&d2.length>0){
      const val=d2[0].foreign_buy||0;
      const el2=document.getElementById('foreign');
      el2.textContent=(val>=0?'+':'')+val.toLocaleString();
      el2.className='value '+(val>=0?'up':'down');
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
      const ws=JSON.parse(localStorage.getItem('watchlist')||'[]');
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
    }else{
      document.getElementById('etfName').textContent=code;
      document.getElementById('etfMeta').textContent='尚無數據';
      document.getElementById('etfChartContainer').style.display='none';
    }
  }catch(e){alert('查詢失敗');}
}


const ETF_HOT = [
  {sym:'0050',name:'元大台灣50'},
  {sym:'0056',name:'元大高股息'},
  {sym:'00878',name:'國泰永續高股息'},
  {sym:'00919',name:'群益台灣精選高息'},
  {sym:'00929',name:'復華台灣科技優息'},
  {sym:'00713',name:'元大台灣高息低波'},
  {sym:'006208',name:'富邦台灣50'},
  {sym:'00881',name:'國泰台灣5G+'}
];

const US_HOT=[
  {sym:'AAPL',name:'Apple'},
  {sym:'NVDA',name:'NVIDIA'},
  {sym:'MSFT',name:'Microsoft'},
  {sym:'TSLA',name:'Tesla'},
  {sym:'TSM',name:'台積電 ADR'},
  {sym:'GOOGL',name:'Alphabet'},
  {sym:'AMZN',name:'Amazon'},
  {sym:'META',name:'Meta'}
];
async function fetchUSStock(sym){
  const url=`https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=2d`;
  const proxy='https://corsproxy.io/?'+encodeURIComponent(url);
  const r=await fetch(proxy);
  const d=await r.json();
  const meta=d.chart.result[0].meta;
  const price=meta.regularMarketPrice;
  const prev=meta.chartPreviousClose;
  const pct=(price-prev)/prev*100;
  const high=meta.regularMarketDayHigh||price;
  const low=meta.regularMarketDayLow||price;
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
  {sym:'USDTWD=X',name:'美元/台幣',unit:'TWD'},
  {sym:'GC=F',name:'黃金',unit:'USD/oz'},
  {sym:'EURUSD=X',name:'歐元/美元',unit:'USD'},
  {sym:'JPY=X',name:'日圓/美元',unit:'JPY'},
  {sym:'CNY=X',name:'人民幣/美元',unit:'CNY'},
  {sym:'SI=F',name:'白銀',unit:'USD/oz'}
];
async function loadFX(){
  const grid=document.getElementById('fxGrid');
  if(!grid)return;
  grid.innerHTML='';
  for(const item of FX_ITEMS){
    try{
      const url=`https://query1.finance.yahoo.com/v8/finance/chart/${item.sym}?interval=1d&range=2d`;
      const proxy='https://corsproxy.io/?'+encodeURIComponent(url);
      const r=await fetch(proxy);
      const d=await r.json();
      const meta=d.chart.result[0].meta;
      const price=meta.regularMarketPrice;
      const prev=meta.chartPreviousClose;
      const pct=(price-prev)/prev*100;
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
    result.innerHTML=`<div style="background:#1e3a5f;border:1px solid #2563eb;border-radius:12px;padding:20px;max-width:340px">
      <div style="font-size:13px;color:#94a3b8;margin-bottom:4px">${sym}</div>
      <div style="font-size:26px;font-weight:700;color:#e2e8f0">$${price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
      <div style="font-size:15px;color:${up?'#34d399':'#f87171'};margin-top:6px">${up?'▲ +':'▼ '}${pct.toFixed(2)}%</div>
      <div style="font-size:12px;color:#64748b;margin-top:8px">今日高: $${high.toFixed(2)} | 低: $${low.toFixed(2)}</div>
    </div>`;
  }catch(e){result.innerHTML='<div style="color:#f87171;padding:8px">找不到 '+sym+'，請確認代號</div>';}
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
    const r=await fetch(BASE+'/institutional_investors?order=total_buy.desc&limit=5',{headers:SB_H});
    const data=await r.json();
    if(data&&data.length>0)document.getElementById('institutionalList').innerHTML=data.map((d,i)=>{const who=d.foreign_buy>0&&d.investment_trust_buy>0?'外資+投信':d.foreign_buy>0?'外資':'投信';return '<div class="rank-item"><div class="rank-num">'+(i+1)+'</div><div><div class="rank-name">'+(NAMES[d.symbol]||d.symbol)+' '+d.symbol+'</div><div class="rank-sub">'+who+'</div></div><div class="rank-val up">+'+(d.total_buy||0).toLocaleString()+'張</div></div>';}).join('');
  }catch(e){}
}
