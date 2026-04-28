
// MoneyRadar™ v149 — switchTab 改用 dashboard 顯示狀態當門禁，避免 session 還原期 currentUser=null 擋切 tab
const ADMIN_EMAIL='neowu1031@gmail.com';
let isAdmin=false;
const SB_URL='https://sirhskxufayklqrlxeep.supabase.co';
const SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcmhza3h1ZmF5a2xxcmx4ZWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTc5ODQsImV4cCI6MjA5MDMzMzk4NH0.i0iNEGXq3tkLrQQbGq3WJbNPbNrnrV6ryg8UUB8Bz5g';
// Supabase Auth client（CDN 自動暴露 window.supabase）
let SUPA_AUTH=null;
let _supaInitTried=false;
function _initSupa(){
  if(_supaInitTried)return;
  _supaInitTried=true;
  try{
    if(window.supabase&&window.supabase.createClient){
      SUPA_AUTH=window.supabase.createClient(SB_URL,SB_KEY);
      console.log('Supabase init OK');
      // 立即恢復登入狀態
      SUPA_AUTH.auth.getSession().then(({data:{session}})=>{
        if(session?.user){
          currentUser=session.user;
          if(session.access_token) currentUser._token=session.access_token;
          console.log('Session restored:', currentUser.email);
          const run=()=>{ try{ onAuthSuccess(currentUser); }catch(e){ showDashboard(); } };
          if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true});
          else run();
        }
      });
    }
  }catch(e){console.log('Supa init error',e);}
}
_initSupa();
document.addEventListener('DOMContentLoaded',_initSupa);
let currentAuthMode='login';
let currentUser=null;
const BASE=SB_URL+'/rest/v1';
const SB_H={'apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY};
const PROXY_URL='https://sirhskxufayklqrlxeep.supabase.co/functions/v1/twse-proxy';

function showAuthGate(msg=''){
  const dash=document.getElementById('dashboard');
  if(dash)dash.style.display='none';
  const lock=document.getElementById('lockScreen');
  if(lock)lock.style.display='flex';
  if(msg){
    const err=document.getElementById('errMsg');
    if(err){err.textContent=msg;err.style.color='#f87171';}
  }
  try{switchAuthTab('login');}catch(e){}
  const emailEl=document.getElementById('authEmail');
  if(emailEl)emailEl.focus();
}

function hideAuthGate(){
  const lock=document.getElementById('lockScreen');
  if(lock)lock.style.display='none';
  const dash=document.getElementById('dashboard');
  if(dash)dash.style.display='block';
}

document.addEventListener('keydown',(e)=>{
  if(e.key==='Escape'){
    const lock=document.getElementById('lockScreen');
    if(lock && lock.style.display!=='none'){
      e.preventDefault();
      e.stopPropagation();
    }
  }
},{capture:true});

document.addEventListener('DOMContentLoaded',()=>{
  if(!currentUser) showAuthGate();
});

if(SUPA_AUTH?.auth?.onAuthStateChange){
  try{
    SUPA_AUTH.auth.onAuthStateChange((event, session)=>{
      console.log('Auth event:', event, !!session?.user);
      if((event==='SIGNED_IN'||event==='INITIAL_SESSION'||event==='TOKEN_REFRESHED'||event==='USER_UPDATED') && session?.user){
        currentUser=session.user;
        if(session.access_token) currentUser._token=session.access_token;
        const run=()=>{ try{ onAuthSuccess(session.user); }catch(e){ showDashboard(); } hideAuthGate(); };
        if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run,{once:true});
        else run();
      }else if(event==='SIGNED_OUT'){
        currentUser=null;
        showAuthGate('請先登入以使用平台');
      }
    });
  }catch(e){}
}
// Request deduplication: pending requests to same URL share one fetch
// Stores JSON-data promises; each caller gets a copy via fake Response wrapper
const _dedupMap = new Map();
let _apiCallCount = 0;
function fetchDedup(url, opts){
  _apiCallCount++;
  const key = url + (opts?.body||'');
  let jsonProm;
  if(_dedupMap.has(key)){
    jsonProm = _dedupMap.get(key);
  } else {
    jsonProm = fetch(url, opts).then(r=>r.json());
    _dedupMap.set(key, jsonProm);
    jsonProm.finally(()=>setTimeout(()=>_dedupMap.delete(key),100));
  }
  // Return fake Response so callers can still do await r.json()
  return jsonProm.then(data=>({ok:true,status:200,json:()=>Promise.resolve(JSON.parse(JSON.stringify(data)))}));
}

async function twseProxy(type, code=null, extra={}){
  const r = await fetch(PROXY_URL, {
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+SB_KEY},
    body: JSON.stringify({type, code, ...extra})
  });
  const d = await r.json();
  if(!d.ok) throw new Error(d.error||'proxy error');
  return d.data;
}
function authHeaders(){
  const token=currentUser?._token||SB_KEY;
  return{'apikey':SB_KEY,'Authorization':'Bearer '+token,'Content-Type':'application/json'};
}
// 確保 token 最新的版本
async function authHeadersFresh(){
  try{
    const{data:{session}}=await SUPA_AUTH.auth.getSession();
    if(session?.access_token&&currentUser) currentUser._token=session.access_token;
  }catch(e){}
  return authHeaders();
}
const NAMES={'2330':'台積電','2317':'鴻海','2454':'聯發科','2382':'廣達','3231':'緯創','2308':'台達電','2303':'聯電','2881':'富邦金','2882':'國泰金','2886':'兆豐金','2891':'中信金','2884':'玉山金','2885':'元大金','2892':'第一金','2883':'開發金','2880':'華南金','2887':'台新金','2888':'新光金','1301':'台塑','1303':'南亞','1326':'台化','2002':'中鋼','2412':'中華電','3008':'大立光','2395':'研華','2357':'華碩','2376':'技嘉','4938':'和碩','2474':'可成','3034':'聯詠','2379':'瑞昱','6505':'台塑化','1216':'統一','2912':'統一超','2207':'和泰車','2105':'正新','2615':'萬海','2603':'長榮','2609':'陽明','2610':'華航','2618':'長榮航','2301':'光寶科','2324':'仁寶','2352':'佳世達','2353':'宏碁','2356':'英業達','3045':'台灣大','4904':'遠傳','2409':'友達','3481':'群創','6669':'緯穎','2408':'南亞科','3711':'日月光投控','2327':'國巨','2360':'致茂','5274':'信驊','6415':'矽力-KY','2049':'上銀','1590':'亞德客-KY','6239':'力成','0050':'元大台灣50','0056':'元大高股息','00878':'國泰永續高股息','00919':'群益台灣精選高息','00929':'復華台灣科技優息','00940':'元大台灣價值高息','00713':'元大台灣高息低波','006208':'富邦台灣采吉50','00881':'國泰台灣5G+'}

// ===== 我的清單 (Watchlist) =====
let watchlistCache = null;
function normalizeWlSymbol(symbol){
  return (symbol||'').toString().trim().replace(/\.HK$|\.TWO$|\.TW$/i,'');
}

function updateWatchlistStars(list){
  const wl = Array.isArray(list) ? list : [];
  document.querySelectorAll('[data-wl-sym]').forEach(btn=>{
    const sym = normalizeWlSymbol(btn.getAttribute('data-wl-sym'));
    const mkt = btn.getAttribute('data-wl-mkt') || 'tw';
    const inList = wl.some(w=>normalizeWlSymbol(w.symbol)===sym && (w.market||'tw')===mkt);
    btn.style.color = inList ? '#f59e0b' : '#475569';
    btn.textContent = inList ? '★' : '☆';
    btn.title = inList ? '從清單移除' : '加入觀察清單';
  });
}

async function loadWatchlist() {
  if(!currentUser){watchlistCache=[];updateWatchlistStars([]);return [];}
  try {
    const r = await fetch(BASE+'/watchlist?user_id=eq.'+currentUser.id+'&order=created_at.desc', {headers:authHeaders()});
    watchlistCache = await r.json();
    // 更新頁面上所有星星狀態
    updateWatchlistStars(watchlistCache);
    return watchlistCache || [];
  } catch(e) { return []; }
}

async function toggleWatchlist(symbol, name, market, label='watching') {
  const cleanSym = normalizeWlSymbol(symbol);
  if(!cleanSym) return;
  market = market || 'tw';

  if(!currentUser){
    showToast('請先登入以使用自選股功能', '#f87171');
    try{
      document.getElementById('dashboard').style.display='none';
      document.getElementById('lockScreen').style.display='flex';
      switchAuthTab('login');
      const emailEl=document.getElementById('authEmail');
      if(emailEl)emailEl.focus();
      trackEvent('watchlist_login_prompt',{});
    }catch(e){}
    return;
  }
  // 確保 token 最新
  try{const{data:{session}}=await SUPA_AUTH.auth.getSession();if(session?.access_token)currentUser._token=session.access_token;}catch(e){}
  try {
    // 先查是否已存在
    const freshH = await authHeadersFresh();
    const r = await fetch(BASE+'/watchlist?user_id=eq.'+currentUser.id+'&symbol=eq.'+cleanSym+'&market=eq.'+market, {headers:freshH});
    const existing = await r.json();
    if(existing && existing.length > 0) {
      // 已存在 → 刪除
      await fetch(BASE+'/watchlist?id=eq.'+existing[0].id, {method:'DELETE', headers:freshH});
      watchlistCache = (watchlistCache||[]).filter(w => !(normalizeWlSymbol(w.symbol)===cleanSym && w.market===market));
      showToast('已從清單移除：'+name, '#f87171');
    } else {
      // 不存在 → 新增
      await fetch(BASE+'/watchlist', {
        method:'POST',
        headers:{...freshH,'Prefer':'return=minimal'},
        body: JSON.stringify({user_id:currentUser.id, symbol: cleanSym, name, market, label})
      });
      if(!watchlistCache) watchlistCache = [];
      watchlistCache.push({symbol: cleanSym, name, market, label});
      showToast((label==='holding'?'✅ 已加入持有中：':' 已加入觀察中：')+name, '#34d399');
    }
    // 更新按鈕狀態
    updateWatchlistStars(watchlistCache);
    renderWatchlistTab();
    renderWatchlist();
  } catch(e) { showToast('操作失敗，請重試', '#f87171'); }
}

function isInWatchlist(symbol, market) {
  const s=normalizeWlSymbol(symbol);
  market = market || 'tw';
  const list = watchlistCache || [];
  return (list||[]).some(w => normalizeWlSymbol(w.symbol)===s && (w.market||'tw')===market);
}

function watchlistBtn(symbol, name, market) {
  const inList = isInWatchlist(symbol, market);
  return `<span data-wl-sym="${symbol}" data-wl-mkt="${market}" onclick="event.stopPropagation();toggleWatchlist('${symbol}','${name.replace(/'/g,"\'")}','${market}')" style="cursor:pointer;font-size:18px;color:${inList?'#f59e0b':'#475569'};padding:2px 4px;line-height:1" title="${inList?'從清單移除':'加入觀察清單'}">${inList?'★':'☆'}</span>`;
}

function showToast(msg, color='#34d399') {
  let t = document.getElementById('wl-toast');
  if(!t) {
    t = document.createElement('div');
    t.id = 'wl-toast';
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1e293b;color:#e2e8f0;padding:10px 20px;border-radius:20px;font-size:13px;z-index:9999;border:1px solid #334155;transition:opacity 0.3s;pointer-events:none';
    document.body.appendChild(t);
  }
  t.style.borderColor = color;
  t.style.color = color;
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, 2500);
}

function _wlCardKey(w){ return 'wl-card-'+(w.id || (w.market+'-'+(w.symbol||'').replace(/[^a-zA-Z0-9]/g,'_'))); }

function _wlCardSkeleton(w){
  return `<div id="${_wlCardKey(w)}" style="background:#1e293b;border-radius:12px;padding:14px;border:1px solid #334155;min-height:120px;color:#64748b;font-size:12px;display:flex;align-items:center;justify-content:center">載入 ${w.symbol}…</div>`;
}

let _wlRenderToken = 0;

async function renderWatchlistTab() {
  const myToken = ++_wlRenderToken;
  const el = document.getElementById('watchlistContent');
  if(!el) return;
  el.innerHTML = '<div style="color:#64748b;padding:20px;text-align:center">載入中...</div>';
  const list = await loadWatchlist();
  if(myToken !== _wlRenderToken) return;
  if(!list || list.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:40px;color:#64748b">
      <div style="font-size:40px;margin-bottom:12px">☆</div>
      <div style="font-size:15px;margin-bottom:8px;color:#94a3b8">清單是空的</div>
      <div style="font-size:13px">在任何股票卡片上點 ☆ 即可加入</div>
    </div>`;
    return;
  }
  const holding = list.filter(w => w.label === 'holding');
  const watching = list.filter(w => w.label !== 'holding');
  const renderSection = (items, title, icon, color) => {
    if(!items.length) return '';
    return `<div style="margin-bottom:18px">
      <div style="font-size:13px;color:${color};font-weight:700;padding:8px 0 10px;border-bottom:1px solid #1e293b;margin-bottom:12px">${icon} ${title} (${items.length})</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px">
        ${items.map(_wlCardSkeleton).join('')}
      </div>
    </div>`;
  };
  el.innerHTML = `<div style="font-size:12px;color:#64748b;margin-bottom:10px">共 ${list.length} 檔（持有 ${holding.length} · 觀察 ${watching.length}）</div>`
    + renderSection(holding, '持有中', '✅', '#34d399')
    + renderSection(watching, '觀察中', '👁', '#60a5fa');
  await Promise.all(list.map(w => renderWatchlistCard(w, myToken).catch(e=>console.log('wl card err',w.symbol,e))));
}

async function _fetchWatchlistQuote(w){
  if(w.market==='tw' || w.market==='etf'){
    const sym = (w.symbol||'').toString();
    const r = await fetchDedup(BASE+'/daily_prices?symbol=eq.'+encodeURIComponent(sym)+'&order=date.desc&limit=30', {headers:SB_H});
    const data = await r.json();
    if(!Array.isArray(data) || !data.length) return {};
    const latest = data[0];
    const prev = data[1];
    const price = parseFloat(latest.close_price);
    const prevClose = prev ? parseFloat(prev.close_price) : (parseFloat(latest.open_price) || price);
    const pct = prevClose>0 ? ((price-prevClose)/prevClose*100) : 0;
    const prices = data.map(d=>parseFloat(d.close_price)).filter(p=>!isNaN(p)).reverse();
    return {price, pct, prices, dateStr: latest.date||''};
  }
  if(w.market==='us'){
    const d = await yfQuote(w.symbol, '1mo', '1d');
    if(!d || d.error || !d.currentPrice) return {};
    const price = d.currentPrice;
    const prev = d.prevClose || price;
    const pct = prev>0 ? (price-prev)/prev*100 : 0;
    let prices = null;
    if(Array.isArray(d.closes)) prices = d.closes.filter(p=>p!=null && !isNaN(p));
    else if(Array.isArray(d.prices)) prices = d.prices.filter(p=>p!=null && !isNaN(p));
    return {price, pct, prices};
  }
  if(w.market==='crypto'){
    const raw = (w.symbol||'').toString().toUpperCase();
    const sym = raw.endsWith('USDT') ? raw : raw+'USDT';
    const r = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol='+sym);
    const d = await r.json();
    if(!d || !d.lastPrice) return {};
    const price = parseFloat(d.lastPrice);
    const pct = parseFloat(d.priceChangePercent);
    let prices = null;
    try{
      const kr = await fetch('https://api.binance.com/api/v3/klines?symbol='+sym+'&interval=1d&limit=30');
      const kd = await kr.json();
      if(Array.isArray(kd) && kd.length>1) prices = kd.map(k=>parseFloat(k[4])).filter(p=>!isNaN(p));
    }catch(e){}
    return {price, pct, prices};
  }
  return {};
}

async function renderWatchlistCard(w, myToken){
  const key = _wlCardKey(w);
  let q = {};
  try{ q = await _fetchWatchlistQuote(w) || {}; }catch(e){}
  if(myToken !== undefined && myToken !== _wlRenderToken) return;
  const cur = document.getElementById(key);
  if(!cur || !cur.parentNode) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = _buildWatchlistCardHTML(w, q.price, q.pct, q.prices, q.dateStr||'');
  const fresh = tmp.firstElementChild;
  if(!fresh) return;
  cur.parentNode.replaceChild(fresh, cur);
}

function _buildWatchlistCardHTML(w, price, pct, prices, dateStr){
  const sName = (w.market==='tw' && NAMES[w.symbol]) ? NAMES[w.symbol] : (w.name || w.symbol);
  const safeName = String(sName).replace(/'/g, "\\'");
  const mktLabel = {tw:'台股', etf:'ETF', us:'美股', crypto:'加密', fx:'外匯'}[w.market] || w.market;
  const isHolding = w.label === 'holding';
  const hasPrice = price != null && !isNaN(price);
  const p = hasPrice ? Number(pct||0) : 0;
  const up = p >= 0;
  const color = up ? '#34d399' : '#f87171';
  const borderColor = !hasPrice ? '#334155' : (up ? '#1e4a3a' : '#4a1e1e');
  const priceStr = hasPrice
    ? ((w.market==='us' || w.market==='crypto')
        ? '$'+price.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:price<1?6:2})
        : price.toLocaleString())
    : '—';
  const pctStr = hasPrice ? `${up?'▲ +':'▼ '}${Math.abs(p).toFixed(2)}%` : '—';
  const svg = (prices && prices.length>1) ? miniSVG(prices, color) : '';
  const newLabel = isHolding ? 'watching' : 'holding';
  let onCardClick = '';
  if(w.market==='tw'){
    onCardClick = `var i=document.getElementById('stockInput');if(i){i.value='${w.symbol}';searchStock();}var t=document.querySelector('[onclick*=&quot;switchTab(\\'tw\\'&quot;]');if(t)switchTab('tw',t);window.scrollTo({top:300,behavior:'smooth'});`;
  } else if(w.market==='etf'){
    onCardClick = `var i=document.getElementById('etfInput');if(i){i.value='${w.symbol}';searchETF();}var t=document.querySelector('[onclick*=&quot;switchTab(\\'etf\\'&quot;]');if(t)switchTab('etf',t);`;
  } else if(w.market==='us'){
    onCardClick = `var i=document.getElementById('usSearch');if(i){i.value='${w.symbol}';}var t=document.querySelector('[onclick*=&quot;switchTab(\\'us\\'&quot;]');if(t)switchTab('us',t);if(typeof searchUS==='function')searchUS();`;
  } else if(w.market==='crypto'){
    onCardClick = `var i=document.getElementById('cryptoSearch');if(i){i.value='${w.symbol}';if(typeof searchCrypto==='function')searchCrypto();}var t=document.querySelector('[onclick*=&quot;switchTab(\\'crypto\\'&quot;]');if(t)switchTab('crypto',t);`;
  }
  const labelToggle = w.id
    ? `<span onclick="event.stopPropagation();toggleWatchlistLabel('${w.id}','${w.symbol}','${w.market}','${newLabel}')" style="font-size:9px;padding:2px 6px;border-radius:8px;cursor:pointer;background:${isHolding?'#1e4a3a':'#0f172a'};color:${isHolding?'#34d399':'#94a3b8'};border:1px solid ${isHolding?'#34d399':'#334155'};font-weight:600">${isHolding?'✅ 持有中':'👁 觀察中'}</span>`
    : `<span style="font-size:9px;padding:2px 6px;border-radius:8px;background:${isHolding?'#1e4a3a':'#0f172a'};color:${isHolding?'#34d399':'#94a3b8'};border:1px solid ${isHolding?'#34d399':'#334155'};font-weight:600">${isHolding?'✅ 持有中':'👁 觀察中'}</span>`;
  return `<div id="${_wlCardKey(w)}" style="background:#1e293b;border-radius:12px;padding:14px;border:1px solid ${borderColor};position:relative;transition:border-color 0.2s;${onCardClick?'cursor:pointer':''}" ${onCardClick?`onclick="${onCardClick}"`:''}>
    <button onclick="event.stopPropagation();toggleWatchlist('${w.symbol}','${safeName}','${w.market}')" title="從清單移除"
      style="position:absolute;top:6px;right:6px;background:#334155;border:none;color:#94a3b8;width:20px;height:20px;border-radius:50%;font-size:13px;cursor:pointer;line-height:18px;padding:0;text-align:center;z-index:2">×</button>
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap;padding-right:24px">
      <span style="font-size:9px;background:#0f172a;color:#60a5fa;padding:2px 6px;border-radius:8px;font-weight:600;border:1px solid #1e3a5f">${mktLabel}</span>
      ${labelToggle}
    </div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;gap:8px">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${sName}">${sName}</div>
        <div style="font-size:11px;color:#64748b">${w.symbol}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:16px;font-weight:700;color:#e2e8f0">${priceStr}</div>
        <div style="font-size:11px;color:${color}">${pctStr}</div>
      </div>
    </div>
    ${svg ? `<div style="margin-top:6px;overflow:hidden;border-radius:4px">${svg}</div>` : '<div style="height:48px"></div>'}
    ${dateStr ? `<div style="font-size:10px;color:#475569;margin-top:6px;text-align:right">${dateStr}</div>` : ''}
  </div>`;
}

async function toggleWatchlistLabel(id, symbol, market, newLabel) {
  try {
    await fetch(BASE+'/watchlist?id=eq.'+id, {
      method:'PATCH',
      headers:authHeaders(),
      body: JSON.stringify({label: newLabel})
    });
    if(watchlistCache) {
      const item = watchlistCache.find(w => w.symbol===symbol && w.market===market);
      if(item) item.label = newLabel;
    }
    renderWatchlistTab();
    showToast(newLabel==='holding'?'✅ 標記為持有中':'👁 標記為觀察中', '#34d399');
  } catch(e) {}
}
let taiexChart=null,stockChart=null,etfChart=null,usChart=null,indicatorChart=null,currentStock='',currentETF='',currentUS='',currentIndicator='none',lastKData=[];
const FINNHUB_KEY='d7fh9c1r01qpjqqkqkv0d7fh9c1r01qpjqqkqkvg';
const AI_PROXY_URL='https://moneyradar-ai-proxy.thinkbigtw.workers.dev';

function checkPw(){
  // 管理員入口已停用，請用 Google 或 Email 登入
  const err=document.getElementById('errMsg');
  if(err)err.textContent='請使用 Email 登入';
}

function showPwBackdoor(){
  const el=document.getElementById('pwBackdoor');
  if(el)el.style.display=el.style.display==='none'?'block':'none';
}

function switchAuthTab(mode){
  currentAuthMode=mode;
  const loginBtn=document.getElementById('authTabLogin');
  const signupBtn=document.getElementById('authTabSignup');
  const submitBtn=document.getElementById('authSubmitBtn');
  if(!loginBtn||!signupBtn||!submitBtn)return;
  if(mode==='login'){
    loginBtn.style.background='#2563eb';loginBtn.style.color='#fff';
    signupBtn.style.background='transparent';signupBtn.style.color='#94a3b8';
    submitBtn.textContent='登入';
  }else{
    signupBtn.style.background='#2563eb';signupBtn.style.color='#fff';
    loginBtn.style.background='transparent';loginBtn.style.color='#94a3b8';
    submitBtn.textContent='免費註冊';
  }
  const err=document.getElementById('errMsg');
  if(err)err.textContent='';
}


// ── Yahoo Finance via Edge Function (即時報價+K線) ──
const YF_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcmhza3h1ZmF5a2xxcmx4ZWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTc5ODQsImV4cCI6MjA5MDMzMzk4NH0.i0iNEGXq3tkLrQQbGq3WJbNPbNrnrV6ryg8UUB8Bz5g';
const YF_URL='https://sirhskxufayklqrlxeep.supabase.co/functions/v1/yahoo-kline';
async function yfQuote(symbol,range='1mo',interval='1d'){
  try{
    const r=await fetch(YF_URL,{method:'POST',headers:{'Content-Type':'application/json','apikey':YF_KEY,'Authorization':'Bearer '+YF_KEY},body:JSON.stringify({symbol,range,interval})});
    return await r.json();
  }catch(e){return {error:e.message};}
}

async function authSubmit(){
  const emailEl=document.getElementById('authEmail');
  const pwEl=document.getElementById('authPassword');
  const errEl=document.getElementById('errMsg');
  if(!emailEl||!pwEl||!errEl)return;
  const email=emailEl.value.trim();
  const password=pwEl.value;
  errEl.textContent='';
  if(!SUPA_AUTH){errEl.textContent='系統未就緒，請稍後再試';return;}
  if(!email||!password){errEl.textContent='請輸入 Email 與密碼';return;}
  if(password.length<6){errEl.textContent='密碼至少 6 字';return;}
  try{
    if(currentAuthMode==='signup'){
      const {data,error}=await SUPA_AUTH.auth.signUp({email,password});
      if(error){errEl.textContent='註冊失敗：'+error.message;return;}
      if(data.user&&!data.session){
        errEl.style.color='#34d399';
        errEl.textContent='✓ 註冊成功！請收信驗證後登入';
        switchAuthTab('login');
      }else if(data.session){
        currentUser=data.user;if(data.session?.access_token)currentUser._token=data.session.access_token;
        if(currentUser.email===ADMIN_EMAIL){currentUserPlan='pro';isAdmin=true;}
        onAuthSuccess(data.user);
      }
      trackEvent('signup',{method:'email'});
    }else{
      const {data,error}=await SUPA_AUTH.auth.signInWithPassword({email,password});
      if(error){errEl.textContent='登入失敗：'+error.message;return;}
      currentUser=data.user;
      onAuthSuccess(data.user);
      trackEvent('login',{method:'email'});
    }
  }catch(e){errEl.textContent='系統錯誤：'+e.message;}
}

async function loginGoogle(){
  const errEl=document.getElementById('errMsg');
  if(!SUPA_AUTH){if(errEl)errEl.textContent='系統未就緒';return;}
  try{
    const {error}=await SUPA_AUTH.auth.signInWithOAuth({
      provider:'google',
      options:{redirectTo:window.location.origin+window.location.pathname}
    });
    if(error){if(errEl)errEl.textContent='Google 登入失敗：'+error.message+'（請先在 Supabase 後台啟用 Google Provider）';}
    trackEvent('login',{method:'google'});
  }catch(e){if(errEl)errEl.textContent='Google 登入錯誤：'+e.message;}
}

async function onAuthSuccess(user){
  const badge=document.getElementById('userBadge');
  const logoutBtn=document.getElementById('logoutBtn');
  // 從 email 取 @ 前面作為暱稱
  const handle=user.email?user.email.split('@')[0]:'會員';
  // 查用戶 plan
  let plan='free';
  try{
    const r=await fetch(BASE+'/users?id=eq.'+user.id+'&select=plan',{headers:SB_H});
    const rows=await r.json();
    if(rows&&rows.length&&rows[0].plan)plan=rows[0].plan;
  }catch(e){}
  currentUserPlan=plan;
  const planLabel=plan==='pro'?'<span style="color:#fbbf24;font-weight:700">⭐ PRO</span>':'<span style="color:#60a5fa">測試版</span>';
  if(badge)badge.innerHTML=`Hi, ${handle} · ${planLabel}`;
  if(logoutBtn)logoutBtn.style.display='inline-block';
  showDashboard();
}

let currentUserPlan='free';

function isPro(){return currentUserPlan==='pro';}

function requirePro(featureName){
  if(isPro())return true;
  alert(`「${featureName}」為 PRO 會員專屬功能。\n\n升級 PRO 解鎖：\n• AI 個股深度解讀\n• 進場/出場訊號提醒\n• 法人籌碼進階分析\n• 自訂選股策略保存\n\n升級請洽：neowu1031@gmail.com`);
  trackEvent('upgrade_prompt',{feature:featureName});
  return false;
}

async function forgotPassword(){
  const email=document.getElementById('authEmail').value.trim();
  const errEl=document.getElementById('errMsg');
  if(!email){errEl.style.color='#f87171';errEl.textContent='請先在 Email 欄位輸入您的帳號 Email';return;}
  if(!SUPA_AUTH){errEl.textContent='系統未就緒';return;}
  try{
    const {error}=await SUPA_AUTH.auth.resetPasswordForEmail(email,{
      redirectTo:window.location.origin+window.location.pathname+'?reset=1'
    });
    if(error){errEl.style.color='#f87171';errEl.textContent='發送失敗：'+error.message;return;}
    errEl.style.color='#34d399';
    errEl.textContent='✓ 重設密碼連結已寄至 '+email+'，請查收 Email';
    trackEvent('password_reset_request',{});
  }catch(e){errEl.style.color='#f87171';errEl.textContent='系統錯誤：'+e.message;}
}

async function logoutUser(){
  if(SUPA_AUTH){try{await SUPA_AUTH.auth.signOut();}catch(e){}}
  currentUser=null;
  document.getElementById('dashboard').style.display='none';
  document.getElementById('lockScreen').style.display='flex';
  document.getElementById('authEmail').value='';
  document.getElementById('authPassword').value='';
  document.getElementById('logoutBtn').style.display='none';
  document.getElementById('userBadge').textContent='—';
  document.getElementById('errMsg').textContent='已登出';
  document.getElementById('errMsg').style.color='#94a3b8';
}

// 開啟頁面時自動恢復登入狀態
async function checkExistingSession(){
  if(!SUPA_AUTH)return;
  try{
    const {data:{session}}=await SUPA_AUTH.auth.getSession();
    if(session&&session.user){
      currentUser=session.user;
      onAuthSuccess(session.user);
    }
    // 處理密碼重設回流（Supabase 會把 token 放在 hash）
    const hash=window.location.hash;
    if((hash&&hash.includes('type=recovery'))||new URLSearchParams(location.search).get('reset')==='1'){
      setTimeout(()=>{
        const newPw=prompt('請設定新密碼（至少 6 字）：');
        if(newPw&&newPw.length>=6){
          SUPA_AUTH.auth.updateUser({password:newPw}).then(({error})=>{
            if(error)alert('設定失敗：'+error.message);
            else{alert('✓ 密碼已更新，請使用新密碼登入');history.replaceState(null,'',window.location.pathname);}
          });
        }
      },500);
    }
  }catch(e){}
}
window.addEventListener('load',()=>{setTimeout(checkExistingSession,300);});
let _marketIntervalId=null,_cryptoIntervalId=null,_alertIntervalId=null;
function showDashboard(){
  if (typeof v155Init === 'function') setTimeout(v155Init, 100);
  if(!currentUser){showAuthGate();return;}
  const lock=document.getElementById('lockScreen');if(lock)lock.style.display='none';
  const dash=document.getElementById('dashboard');if(dash)dash.style.display='block';
  loadMarketData();loadSupabaseData();loadDividendCalendar();
  // 預載自選股，讓星號狀態在首次渲染時就正確
  loadWatchlist();
  if(_marketIntervalId)clearInterval(_marketIntervalId);
  _marketIntervalId=setInterval(loadMarketData,30000);
  if(_cryptoIntervalId)clearInterval(_cryptoIntervalId);
  _cryptoIntervalId=setInterval(()=>{const t=document.getElementById("tab-crypto");if(t&&t.classList.contains("active"))loadCrypto();},30000);
  loadRanking("up");setTimeout(()=>loadTaiexChart(30,document.querySelector('#tab-tw .range-btn')),600);
  // 載入自選股區塊
  setTimeout(renderWatchlist, 800);
  // 效能監控：3秒後記錄主頁 API 請求數
  setTimeout(()=>console.log(`[MoneyRadar] 主頁初始 API 請求數：${_apiCallCount} 次（已去重複）`),3000);
  // 處理 URL 參數深連結
  handleURLParams();
}

function handleURLParams(){
  try{
    const p=new URLSearchParams(location.search);
    const tab=p.get('tab');
    if(tab){
      const tabBtn=document.querySelector(`[onclick*="switchTab('${tab}'"]`);
      if(tabBtn)switchTab(tab,tabBtn);
    }
    const stock=p.get('stock');
    if(stock){
      const inp=document.getElementById('stockInput');
      if(inp){inp.value=stock;searchStock();}
    }
    const etf=p.get('etf');
    if(etf){
      const inp=document.getElementById('etfInput');
      if(inp){inp.value=etf;searchETF();
        // 切到 ETF 分頁
        const t=document.querySelector(`[onclick*="switchTab('etf'"]`);if(t)switchTab('etf',t);
      }
    }
    const us=p.get('us');
    if(us){
      const inp=document.getElementById('usSearch');
      if(inp){inp.value=us;
        const t=document.querySelector(`[onclick*="switchTab('us'"]`);if(t)switchTab('us',t);
        searchUS();
      }
    }
    const hk=p.get('hk');
    if(hk){
      const inp=document.getElementById('hkSearch');
      if(inp){inp.value=hk;
        const t=document.querySelector(`[onclick*="switchTab('hk'"]`);if(t)switchTab('hk',t);
        searchHK();
      }
    }
  }catch(e){console.log('URL param error',e);}
}

function copyToClipboard(text){
  if(navigator.clipboard&&navigator.clipboard.writeText){
    return navigator.clipboard.writeText(text);
  }
  // fallback：用臨時 textarea
  return new Promise((resolve,reject)=>{
    try{
      const ta=document.createElement('textarea');
      ta.value=text;ta.style.position='fixed';ta.style.opacity='0';
      document.body.appendChild(ta);ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      resolve();
    }catch(e){reject(e);}
  });
}

function _flashShareBtn(btnId,origText){
  const b=document.getElementById(btnId);
  if(!b)return;
  const original=b.textContent;
  b.textContent='✓ 已複製';
  b.style.background='#166534';b.style.color='#fff';b.style.borderColor='#166534';
  setTimeout(()=>{
    b.textContent=origText||original;
    b.style.background='#0f172a';b.style.color='#94a3b8';b.style.borderColor='#334155';
  },2000);
}

function shareStock(){
  if(!currentStock)return;
  const url=`https://thinkbigtw.com/lab/?stock=${encodeURIComponent(currentStock)}`;
  const name=NAMES[currentStock]||currentStock;
  if(navigator.share){
    navigator.share({title:'MoneyRadar™ - '+name,text:name+'('+currentStock+')',url})
      .then(()=>trackEvent('share_stock',{stock_code:currentStock})).catch(()=>{});
    return;
  }
  copyToClipboard(url).then(()=>{
    _flashShareBtn('shareStockBtn','🔗 分享');
    showToast('✓ 已複製！','#34d399');
    trackEvent('share_stock',{stock_code:currentStock});
  }).catch(()=>{prompt('複製這段網址：',url);});
}

function shareETF(){
  if(!currentETF)return;
  const url=`https://thinkbigtw.com/lab/?etf=${encodeURIComponent(currentETF)}`;
  const name=NAMES[currentETF]||currentETF;
  if(navigator.share){
    navigator.share({title:'MoneyRadar™ - '+name,text:name+'('+currentETF+')',url})
      .then(()=>trackEvent('share_etf',{etf_code:currentETF})).catch(()=>{});
    return;
  }
  copyToClipboard(url).then(()=>{
    _flashShareBtn('shareETFBtn','🔗 分享');
    showToast('✓ 已複製！','#34d399');
    trackEvent('share_etf',{etf_code:currentETF});
  }).catch(()=>{prompt('複製這段網址：',url);});
}

function shareUS(){
  if(!currentUS)return;
  const url=`https://thinkbigtw.com/lab/?us=${encodeURIComponent(currentUS)}`;
  copyToClipboard(url).then(()=>{trackEvent('share_us',{us_code:currentUS});alert('已複製：'+url);}).catch(()=>prompt('複製：',url));
}
// 不自動進入，等待密碼





// One-time migration from legacy keys to mr_ prefix
try{
  const legacy=[['priceAlerts','mr_price_alerts'],['portfolio','mr_portfolio']];
  legacy.forEach(([oldK,newK])=>{
    const v=localStorage.getItem(oldK);
    if(v!==null && localStorage.getItem(newK)===null){
      localStorage.setItem(newK,v);
      localStorage.removeItem(oldK);
    }
  });
}catch(e){}
let alertList=JSON.parse(localStorage.getItem('mr_price_alerts')||'[]');

function requestNotifyPermission(){
  if(!('Notification' in window)){alert('此瀏覽器不支援通知功能');return;}
  Notification.requestPermission().then(p=>{
    const btn=document.getElementById('notifyBtn');
    if(!btn)return;
    if(p==='granted'){btn.textContent='🔔 通知已開啟';btn.style.color='#34d399';btn.style.borderColor='#34d399';}
    else{btn.textContent='🔕 通知已封鎖';btn.style.color='#f87171';}
  });
}

function addAlert(){
  const symEl=document.getElementById('alertSymbol');
  const condEl=document.getElementById('alertCondition');
  const priceEl=document.getElementById('alertPrice');
  if(!symEl||!condEl||!priceEl)return;
  const sym=symEl.value.trim().toUpperCase();
  const cond=condEl.value;
  const price=parseFloat(priceEl.value);
  if(!sym||!price){alert('請填入股票代號和目標價');return;}
  const alert_item={id:Date.now(),symbol:sym,condition:cond,price:price,triggered:false};
  alertList.push(alert_item);
  localStorage.setItem('mr_price_alerts',JSON.stringify(alertList));
  symEl.value='';
  priceEl.value='';
  renderAlerts();
  // 申請通知權限
  if(Notification.permission==='default')requestNotifyPermission();
}

function removeAlert(id){
  alertList=alertList.filter(a=>a.id!==id);
  localStorage.setItem('mr_price_alerts',JSON.stringify(alertList));
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
    const latest=(await r.json())?.[0]?.date;
    if(!latest)return;
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
            new Notification('📣 MoneyRadar™ 價格警示',{
              body:`${sym} 現價 $${price.toLocaleString()} 已${a.condition==='above'?'達到':'跌破'} $${a.price.toLocaleString()}`,
              icon:'/favicon.ico'
            });
          }
        }
      });
    }
    localStorage.setItem('mr_price_alerts',JSON.stringify(alertList));
    renderAlerts();
  }catch(e){}
}

// 初始化
renderAlerts();
(function initNotifyBtn(){
  const btn=document.getElementById('notifyBtn');
  if(!btn||!('Notification' in window))return;
  if(Notification.permission==='granted'){
    btn.textContent='🔔 通知已開啟';btn.style.color='#34d399';btn.style.borderColor='#34d399';
  }else if(Notification.permission==='denied'){
    btn.textContent='🔕 通知已封鎖';btn.style.color='#f87171';btn.style.borderColor='#f87171';
  }
})();
// 每分鐘檢查一次警示
if(_alertIntervalId)clearInterval(_alertIntervalId);
_alertIntervalId=setInterval(checkAlerts,60000);
async function applyFilter(reset=false){
  const result=document.getElementById('filterResult');
  if(!result)return;
  if(reset){
    ['filterMinPct','filterMinVol','filterMinPrice','filterMaxPrice','filterMaxPE','filterMinYield','filterMinROE'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
    result.innerHTML='';
    return;
  }
  const getVal=(id)=>{const e=document.getElementById(id);return e?e.value:'';};
  const type=getVal('filterType');
  const minPct=parseFloat(getVal('filterMinPct'));
  const minVol=parseFloat(getVal('filterMinVol'));
  const minPrice=parseFloat(getVal('filterMinPrice'));
  const maxPrice=parseFloat(getVal('filterMaxPrice'));
  const maxPE=parseFloat(getVal('filterMaxPE'));
  const minYield=parseFloat(getVal('filterMinYield'));
  const minROE=parseFloat(getVal('filterMinROE'));
  result.innerHTML='<div style="color:#64748b">篩選中...</div>';
  try{
    const r=await fetch(BASE+'/daily_prices?order=date.desc&limit=1&select=date',{headers:SB_H});
    const latest=(await r.json())?.[0]?.date;
    if(!latest){result.innerHTML='<div style="color:#f87171">無法取得交易日期</div>';return;}
    let url=BASE+'/daily_prices?date=eq.'+latest+'&symbol=neq.TAIEX&limit=200&select=symbol,close_price,open_price,change_percent,volume';
    if(type==='up')url+='';
    else if(type==='down')url+='';
    else if(type==='volume')url+='&order=volume.desc';
    else if(type==='price_asc')url+='&order=close_price.asc';
    else url+='&order=close_price.desc';
    if(!isNaN(maxPrice))url+=`&close_price=lte.${maxPrice}`;
    if(!isNaN(minPrice))url+=`&close_price=gte.${minPrice}`;
    if(!isNaN(minVol))url+=`&volume=gte.${minVol}`;
    const r2=await fetch(url,{headers:SB_H});
    let data=await r2.json();
    if(!isNaN(minPct)){
      data=data.filter(d=>{
        const ch=parseFloat(d.open_price)>0?((parseFloat(d.close_price)-parseFloat(d.open_price))/parseFloat(d.open_price)*100):0;
        const prev=parseFloat(d.close_price)-ch;
        const pct=prev>0?ch/prev*100:0;
        return pct>=minPct;
      });
    }
    // 需基本面條件：查 stock_fundamentals
    const needFund=!isNaN(maxPE)||!isNaN(minYield)||!isNaN(minROE);
    let fundMap={};
    if(needFund&&data.length){
    // 前端排序（change_percent在DB是null）
    data.sort((a,b)=>{
      const ca=parseFloat(a.open_price)>0?(parseFloat(a.close_price)-parseFloat(a.open_price))/parseFloat(a.open_price)*100:0;
      const cb=parseFloat(b.open_price)>0?(parseFloat(b.close_price)-parseFloat(b.open_price))/parseFloat(b.open_price)*100:0;
      if(type==='volume')return parseFloat(b.volume||0)-parseFloat(a.volume||0);
      if(type==='up')return cb-ca;
      return ca-cb;
    });
    const top=data.slice(0,10);
      const syms=top.map(d=>d.symbol).join(',');
      const rf=await fetch(BASE+'/stock_fundamentals?symbol=in.('+syms+')&select=symbol,pe_ratio,dividend_yield,roe',{headers:SB_H});
      (await rf.json()).forEach(f=>fundMap[f.symbol]=f);
      data=data.filter(d=>{
        const f=fundMap[d.symbol];
        if(!f)return false;
        if(!isNaN(maxPE)&&!(f.pe_ratio!=null&&f.pe_ratio<maxPE))return false;
        if(!isNaN(minYield)&&!(f.dividend_yield!=null&&f.dividend_yield>minYield))return false;
        if(!isNaN(minROE)&&!(f.roe!=null&&f.roe>minROE))return false;
        return true;
      });
    }
    // 查名稱
    const showSyms=data.slice(0,30).map(d=>d.symbol).join(',');
    let nameMap={};
    if(showSyms){
      const rn=await fetch(BASE+'/stocks?symbol=in.('+showSyms+')&select=symbol,name',{headers:SB_H});
      (await rn.json()).forEach(s=>nameMap[s.symbol]=s.name);
    }
    result.innerHTML=`<div style="color:#94a3b8;font-size:13px;margin-bottom:8px">找到 ${data.length} 檔（顯示前30）</div>`;
    data.slice(0,30).forEach((d,i)=>{
      const ch=parseFloat(d.open_price)>0?((parseFloat(d.close_price)-parseFloat(d.open_price))/parseFloat(d.open_price)*100):0;
      const prev=parseFloat(d.close_price)-ch;
      const pct=prev>0?(ch/prev*100).toFixed(2):'—';
      const up=ch>=0;
      const f=fundMap[d.symbol];
      let extra='';
      if(f){
        const parts=[];
        if(f.pe_ratio!=null)parts.push(`PE ${f.pe_ratio.toFixed(1)}`);
        if(f.dividend_yield!=null)parts.push(`殖 ${f.dividend_yield.toFixed(2)}%`);
        if(f.roe!=null)parts.push(`ROE ${f.roe.toFixed(1)}%`);
        if(parts.length)extra=`<div style="font-size:11px;color:#64748b;margin-top:2px">${parts.join(' · ')}</div>`;
      }
      result.innerHTML+=`<div onclick="document.getElementById('stockInput').value='${d.symbol}';searchStock();" style="display:flex;align-items:center;justify-content:space-between;background:#1e293b;border-radius:8px;padding:10px 14px;cursor:pointer;border:1px solid #0f172a">
        <div>
          <span style="font-size:14px;color:#e2e8f0;font-weight:600">${nameMap[d.symbol]||NAMES[d.symbol]||d.symbol}</span>
          <span style="color:#64748b;font-size:12px;margin-left:6px">${d.symbol}</span>
          ${extra}
        </div>
        <div style="text-align:right">
          <div style="font-size:15px;font-weight:700;color:${up?'#34d399':'#f87171'}">${up?'+':''}${pct}%</div>
          <div style="font-size:12px;color:#64748b">$${parseFloat(d.close_price).toLocaleString()} · ${parseInt(d.volume).toLocaleString()}張</div>
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
    const r=await fetchDedup(BASE+'/daily_prices?order=date.desc&limit=1&select=date',{headers:SB_H});
    const latest=(await r.json())?.[0]?.date;
    if(!latest){list.innerHTML='<div style="color:#f87171">無法取得交易日期</div>';return;}
    let url=BASE+'/daily_prices?date=eq.'+latest+'&symbol=neq.TAIEX&limit=200&select=symbol,close_price,open_price,volume';
    if(type==='up')url+='';
    else if(type==='down')url+='';
    else url+='&order=volume.desc';
    const r2=await fetch(url,{headers:SB_H});
    const data=await r2.json();
    // 前端排序（change_percent在DB是null，用open→close計算）
    data.sort((a,b)=>{
      const ca=parseFloat(a.open_price)>0?(parseFloat(a.close_price)-parseFloat(a.open_price))/parseFloat(a.open_price)*100:0;
      const cb=parseFloat(b.open_price)>0?(parseFloat(b.close_price)-parseFloat(b.open_price))/parseFloat(b.open_price)*100:0;
      if(type==='volume')return parseFloat(b.volume||0)-parseFloat(a.volume||0);
      if(type==='up')return cb-ca;
      return ca-cb;
    });
    const rankData=data.slice(0,10);
    // 批次查名稱
    const syms=rankData.map(d=>d.symbol).join(',');
    const rn=await fetch(BASE+'/stocks?symbol=in.('+syms+')&select=symbol,name',{headers:SB_H});
    const nameData=await rn.json();
    const nameMap={};(Array.isArray(nameData)?nameData:[]).forEach(s=>nameMap[s.symbol]=s.name);
    list.innerHTML='';
    rankData.forEach((d,i)=>{
      const ch=parseFloat(d.open_price)>0?((parseFloat(d.close_price)-parseFloat(d.open_price))/parseFloat(d.open_price)*100):0;
      const up=ch>=0;
      const closePx=parseFloat(d.close_price);
      const prevPx=closePx-ch;
      const pct=prevPx>0?Math.abs(ch/prevPx*100).toFixed(2):'—';
      list.innerHTML+=`<div onclick="document.getElementById('stockInput').value='${d.symbol}';searchStock();" title="${nameMap[d.symbol]||NAMES[d.symbol]||d.symbol}" style="display:flex;align-items:center;justify-content:space-between;background:#1e293b;border-radius:8px;padding:10px 14px;cursor:pointer;border:1px solid #0f172a">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="color:#64748b;font-size:13px;width:20px">${i+1}</span>
          <div>
            <div style="font-size:14px;color:#e2e8f0;font-weight:600">${nameMap[d.symbol]&&nameMap[d.symbol]!==d.symbol?nameMap[d.symbol]+'<span style="color:#64748b;font-size:11px;margin-left:4px">'+d.symbol+'</span>':d.symbol}</div>
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
// [舊版 toggleWatchlist 已移除，使用新版 Supabase 版本]
async function renderWatchlist(){}

function dropWatchlistCard(event, targetCode){
  event.preventDefault();
  const dragCode=event.dataTransfer.getData('wl-code');
  if(!dragCode||dragCode===targetCode||!watchlistCache)return;
  const fromIdx=watchlistCache.findIndex(w=>w.symbol===dragCode);
  const toIdx=watchlistCache.findIndex(w=>w.symbol===targetCode);
  if(fromIdx<0||toIdx<0)return;
  const [item]=watchlistCache.splice(fromIdx,1);
  watchlistCache.splice(toIdx,0,item);
  renderWatchlist();
}
// GA4 事件追蹤包裝（gtag 未載入時 no-op）
function trackEvent(eventName,params){
  console.debug('[GA4]', eventName, params||{});
  try{if(typeof gtag==='function')gtag('event',eventName,params||{});}catch(e){}
}

function switchTab(name,btn){
  // 不在這裡檢查 currentUser：dashboard 顯示與否已由 showAuthGate/showDashboard 控制，
  // session 還原期間 currentUser 可能短暫為 null，不應因此擋住 tab 切換。
  // 若真的未登入，lockScreen 會蓋住整個畫面，根本點不到 tab。
  const dash=document.getElementById('dashboard');
  if(dash && dash.style.display==='none'){showAuthGate('請先登入以使用平台');return;}
  const activeTab=document.getElementById('tab-'+name);
  if(!activeTab){console.warn('switchTab: #tab-'+name+' not found in DOM');return;}
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c=>{c.classList.remove('active');c.style.display='none';});
  if(btn&&btn.classList)btn.classList.add('active');
  activeTab.classList.add('active');
  activeTab.style.display='block';
  trackEvent('tab_switch',{tab_name:name});
  if(name==='crypto')setTimeout(loadCrypto,100);
  if(name==='etf')setTimeout(loadETFHot,100);
  if(name==='us')setTimeout(loadUSHot,100);if(name==='fund')setTimeout(loadFX,100);
  // 港股已移除
  if(name==='futures')setTimeout(loadFutures,100);
  if(name==='tools')setTimeout(initTools,100);
  if(name==='portfolio')setTimeout(renderPortfolio,100);
  if(name==='bonds')setTimeout(loadBonds,100);
  if(name==='sector')setTimeout(loadSectors,100);
  if(name==='macro')setTimeout(loadMacro,100);
  if(name==='options')setTimeout(loadOptions,100);
  if(name==='watchlist')setTimeout(renderWatchlistTab,100);
}

// =============== 選擇權分頁 ===============
async function loadOptions(){
  // P/C Ratio
  try{
    const url='https://www.taifex.com.tw/cht/3/pcRatioExcel';
    const proxy='https://api.allorigins.win/raw?url='+encodeURIComponent(url);
    const r=await fetch(proxy);
    const txt=await r.text();
    const lines=txt.trim().split(/\r?\n/);
    if(lines.length>=2){
      const cols=lines[1].split(',');
      const pcr=parseFloat(cols[6])||parseFloat(cols[cols.length-2]);
      const pcrOI=parseFloat(cols[cols.length-1]);
      const px=document.getElementById('opt_pcRatio');
      const interp=document.getElementById('opt_pcRatioInterp');
      const oi=document.getElementById('opt_pcOI');
      if(!isNaN(pcr)&&px){
        px.textContent=pcr.toFixed(2);
        if(pcr>1.5){interp.textContent='偏多訊號（恐慌）';interp.className='sub up';}
        else if(pcr<0.7){interp.textContent='偏空訊號（樂觀）';interp.className='sub down';}
        else{interp.textContent='中性區間';interp.className='sub';}
      }
      if(!isNaN(pcrOI)&&oi)oi.textContent=pcrOI.toFixed(2);
    }
  }catch(e){const px=document.getElementById('opt_pcRatio');if(px)px.textContent='抓取失敗';}
  const vix=document.getElementById('opt_vix');if(vix)vix.textContent='參考';
  const maxOI=document.getElementById('opt_maxOI');if(maxOI)maxOI.textContent='查 TAIFEX';
}

// =============== 智慧選股 ===============
function applyScreenerTemplate(name){
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v;};
  ['sc_pct','sc_vol','sc_pmin','sc_pmax','sc_pe','sc_yield','sc_roe','sc_eps','sc_w52'].forEach(id=>set(id,''));
  if(name==='dividend'){set('sc_yield',5);set('sc_roe',10);set('sc_pe',20);}
  else if(name==='growth'){set('sc_eps',5);set('sc_roe',15);set('sc_pct',0);}
  else if(name==='value'){set('sc_pe',15);set('sc_yield',3);set('sc_w52',50);}
  else if(name==='momentum'){set('sc_pct',2);set('sc_vol',1);}
  else if(name==='reset'){
    document.getElementById('screenerResult').innerHTML='<div style="color:#64748b;padding:8px">請設定篩選條件後按「開始選股」</div>';
    return;
  }
  runScreener();
}

async function runScreener(){
  const result=document.getElementById('screenerResult');
  if(!result)return;
  const minPct=parseFloat(document.getElementById('sc_pct').value);
  const minVol=parseFloat(document.getElementById('sc_vol').value);
  const minPx=parseFloat(document.getElementById('sc_pmin').value);
  const maxPx=parseFloat(document.getElementById('sc_pmax').value);
  const maxPE=parseFloat(document.getElementById('sc_pe').value);
  const minY=parseFloat(document.getElementById('sc_yield').value);
  const minROE=parseFloat(document.getElementById('sc_roe').value);
  const minEPS=parseFloat(document.getElementById('sc_eps').value);
  const max52pos=parseFloat(document.getElementById('sc_w52').value);
  result.innerHTML='<div style="color:#64748b;padding:8px">選股中...</div>';
  try{
    const r0=await fetch(BASE+'/daily_prices?order=date.desc&limit=1&select=date',{headers:SB_H});
    const latest=(await r0.json())?.[0]?.date;
    if(!latest){result.innerHTML='<div style="color:#f87171;padding:8px">無法取得交易日期</div>';return;}
    let url=BASE+'/daily_prices?date=eq.'+latest+'&symbol=neq.TAIEX&limit=2000&select=symbol,close_price,open_price,change_percent,volume';
    if(!isNaN(minPx))url+=`&close_price=gte.${minPx}`;
    if(!isNaN(maxPx))url+=`&close_price=lte.${maxPx}`;
    if(!isNaN(minVol))url+=`&volume=gte.${minVol*10000}`;
    const r1=await fetch(url,{headers:SB_H});
    let prices=await r1.json();
    if(!isNaN(minPct)){
      prices=prices.filter(d=>{
        const ch=parseFloat(d.open_price)>0?((parseFloat(d.close_price)-parseFloat(d.open_price))/parseFloat(d.open_price)*100):0;
        const prev=parseFloat(d.close_price)-ch;
        return prev>0?(ch/prev*100>=minPct):false;
      });
    }
    const needFund=!isNaN(maxPE)||!isNaN(minY)||!isNaN(minROE)||!isNaN(minEPS)||!isNaN(max52pos);
    let fundMap={};
    if(needFund&&prices.length){
      const syms=prices.map(d=>d.symbol);
      for(let i=0;i<syms.length;i+=100){
        const batch=syms.slice(i,i+100);
        const rf=await fetch(BASE+'/stock_fundamentals?symbol=in.('+batch.join(',')+')&select=symbol,pe_ratio,dividend_yield,roe,eps,week52_high,week52_low',{headers:SB_H});
        (await rf.json()).forEach(f=>fundMap[f.symbol]=f);
      }
      prices=prices.filter(d=>{
        const f=fundMap[d.symbol];
        if(!f)return false;
        if(!isNaN(maxPE)&&maxPE>0&&!(f.pe_ratio!=null&&f.pe_ratio<maxPE))return false;
        if(!isNaN(minY)&&!(f.dividend_yield!=null&&f.dividend_yield>minY))return false;
        if(!isNaN(minROE)&&!(f.roe!=null&&f.roe>minROE))return false;
        if(!isNaN(minEPS)&&!(f.eps!=null&&f.eps>minEPS))return false;
        if(!isNaN(max52pos)){
          if(f.week52_high&&f.week52_high>0){
            const pos=(parseFloat(d.close_price)/f.week52_high)*100;
            if(pos>max52pos)return false;
          }else return false;
        }
        return true;
      });
    }
    prices.sort((a,b)=>(parseFloat(b.open_price)>0?((parseFloat(b.close_price)-parseFloat(b.open_price))/parseFloat(b.open_price)*100):0)-(parseFloat(a.open_price)>0?((parseFloat(a.close_price)-parseFloat(a.open_price))/parseFloat(a.open_price)*100):0));
    const show=prices.slice(0,50);
    if(show.length===0){result.innerHTML='<div style="color:#94a3b8;padding:12px">沒有符合條件的個股</div>';return;}
    const showSyms=show.map(d=>d.symbol).join(',');
    const rn=await fetch(BASE+'/stocks?symbol=in.('+showSyms+')&select=symbol,name',{headers:SB_H});
    const nameMap={};(await rn.json()).forEach(s=>nameMap[s.symbol]=s.name);
    let html=`<div style="color:#94a3b8;font-size:13px;margin-bottom:10px">找到 <span style="color:#34d399;font-weight:700">${prices.length}</span> 檔（顯示前 50）</div>`;
    html+=`<div style="background:#1e293b;border-radius:12px;border:1px solid #334155;overflow:hidden;overflow-x:auto">
      <div style="display:grid;grid-template-columns:80px 1fr 80px 80px 90px 70px 80px 70px;gap:6px;font-size:11px;color:#64748b;padding:10px 12px;background:#0f172a;border-bottom:1px solid #334155;min-width:680px">
        <div>代號</div><div>名稱</div><div style="text-align:right">現價</div><div style="text-align:right">漲跌</div><div style="text-align:right">成交量</div><div style="text-align:right">PE</div><div style="text-align:right">殖利率</div><div style="text-align:right">ROE</div>
      </div>`;
    show.forEach(d=>{
      const ch=parseFloat(d.open_price)>0?((parseFloat(d.close_price)-parseFloat(d.open_price))/parseFloat(d.open_price)*100):0;
      const closePx=parseFloat(d.close_price);
      const prev=closePx-ch;
      const pct=prev>0?(ch/prev*100):0;
      const up=ch>=0;
      const f=fundMap[d.symbol]||{};
      const nm=nameMap[d.symbol]||NAMES[d.symbol]||d.symbol;
      const vol=parseFloat(d.volume);
      const volStr=vol>=1e8?(vol/1e8).toFixed(1)+'億':vol>=1e4?(vol/1e4).toFixed(1)+'萬':vol.toFixed(0);
      html+=`<div onclick="document.getElementById('stockInput').value='${d.symbol}';searchStock();var t=document.querySelector('[onclick*=&quot;switchTab(\\'tw\\'&quot;]');if(t)switchTab('tw',t);window.scrollTo({top:300,behavior:'smooth'});" style="display:grid;grid-template-columns:80px 1fr 80px 80px 90px 70px 80px 70px;gap:6px;font-size:13px;padding:10px 12px;border-bottom:1px solid #0f172a;cursor:pointer;min-width:680px">
        <div style="color:#60a5fa;font-weight:600">${d.symbol}</div>
        <div style="color:#e2e8f0">${nm}</div>
        <div style="color:#e2e8f0;text-align:right">${closePx.toFixed(2)}</div>
        <div style="color:${up?'#34d399':'#f87171'};text-align:right;font-weight:700">${up?'+':''}${pct.toFixed(2)}%</div>
        <div style="color:#94a3b8;text-align:right">${volStr}</div>
        <div style="color:#94a3b8;text-align:right">${f.pe_ratio!=null?f.pe_ratio.toFixed(1):'—'}</div>
        <div style="color:#fbbf24;text-align:right">${f.dividend_yield!=null?f.dividend_yield.toFixed(2)+'%':'—'}</div>
        <div style="color:#a78bfa;text-align:right">${f.roe!=null?f.roe.toFixed(1)+'%':'—'}</div>
      </div>`;
    });
    html+='</div>';
    result.innerHTML=html;
    trackEvent('run_screener',{result_count:prices.length});
  }catch(e){result.innerHTML='<div style="color:#f87171;padding:12px">選股失敗：'+e.message+'</div>';}
}

// =============== 債券分頁 ===============
const BONDS_US=[
  {sym:'TLT',name:'美債20年ETF'},
  {sym:'IEF',name:'美債7-10年ETF'},
  {sym:'SHY',name:'美債1-3年ETF'},
  {sym:'BND',name:'美國綜合債券ETF'}
];
const BONDS_CORP=[
  {sym:'HYG',name:'高收益債ETF'},
  {sym:'LQD',name:'投資級公司債ETF'},
  {sym:'JNK',name:'SPDR高收益債'}
];
const BONDS_EM=[
  {sym:'EMB',name:'新興市場美元債'},
  {sym:'PCY',name:'PowerShares新興主權'}
];
const BONDS_TW=['00679B','00696B','00720B','00723B','00724B','00727B','00740B','00751B','00754B','00756B','00761B','00764B','00772B','00779B','00780B','00781B','00784B','00791B','00795B','00796B','00799B','00805B','00815B','00840B'];

function bondCard(sym,name,price,pct,ccy='$'){
  const up=pct>=0;
  return `<div style="background:#1e293b;border-radius:10px;padding:12px;border:1px solid #334155">
    <div style="font-size:11px;color:#94a3b8">${sym}</div>
    <div style="font-size:13px;color:#e2e8f0;margin:1px 0">${name}</div>
    <div style="font-size:18px;font-weight:700;color:#e2e8f0">${ccy}${price.toLocaleString(undefined,{maximumFractionDigits:2})}</div>
    <div style="font-size:12px;color:${up?'#34d399':'#f87171'}">${up?'▲ +':'▼ '}${Math.abs(pct).toFixed(2)}%</div>
  </div>`;
}

async function loadBonds(){
  // 美國公債 ETF
  const usEl=document.getElementById('bondsUS');
  if(usEl){
    usEl.innerHTML='';
    for(const b of BONDS_US){
      try{
        const {price,pct}=await fetchUSStock(b.sym);
        usEl.innerHTML+=bondCard(b.sym,b.name,price,pct);
      }catch(e){usEl.innerHTML+=`<div style="background:#1e293b;border-radius:10px;padding:12px;color:#64748b;font-size:12px">${b.sym} 載入失敗</div>`;}
    }
  }
  // 公司債/高收益債
  const corpEl=document.getElementById('bondsCorp');
  if(corpEl){
    corpEl.innerHTML='';
    for(const b of BONDS_CORP){
      try{
        const {price,pct}=await fetchUSStock(b.sym);
        corpEl.innerHTML+=bondCard(b.sym,b.name,price,pct);
      }catch(e){corpEl.innerHTML+=`<div style="background:#1e293b;border-radius:10px;padding:12px;color:#64748b;font-size:12px">${b.sym} 載入失敗</div>`;}
    }
  }
  // 新興市場債
  const emEl=document.getElementById('bondsEM');
  if(emEl){
    emEl.innerHTML='';
    for(const b of BONDS_EM){
      try{
        const {price,pct}=await fetchUSStock(b.sym);
        emEl.innerHTML+=bondCard(b.sym,b.name,price,pct);
      }catch(e){emEl.innerHTML+=`<div style="background:#1e293b;border-radius:10px;padding:12px;color:#64748b;font-size:12px">${b.sym} 載入失敗</div>`;}
    }
  }
  // 台灣債券 ETF（從 Supabase）
  const twEl=document.getElementById('bondsTW');
  if(twEl){
    twEl.innerHTML='';
    try{
      const r=await fetch(BASE+'/daily_prices?symbol=in.('+BONDS_TW.join(',')+')&order=date.desc&limit=500&select=symbol,date,close_price,change_percent',{headers:SB_H});
      const rows=await r.json();
      const map={};rows.forEach(d=>{if(!map[d.symbol])map[d.symbol]=d;});
      // 抓名稱
      const rn=await fetch(BASE+'/stocks?symbol=in.('+BONDS_TW.join(',')+')&select=symbol,name',{headers:SB_H});
      const nameMap={};(await rn.json()).forEach(s=>nameMap[s.symbol]=s.name);
      BONDS_TW.forEach(sym=>{
        const d=map[sym];
        const nm=nameMap[sym]||NAMES[sym]||sym;
        if(d){
          const pct=parseFloat(d.open_price)>0?((parseFloat(d.close_price)-parseFloat(d.open_price))/parseFloat(d.open_price)*100):0;
          const closePx=parseFloat(d.close_price);
          const prev=closePx-pct;
          const realPct=prev>0?(pct/prev*100):0;
          twEl.innerHTML+=`<div onclick="document.getElementById('etfInput').value='${sym}';searchETF();var t=document.querySelector('[onclick*=\\\"switchTab(\\'etf\\'\\\"]');if(t)switchTab('etf',t);" style="cursor:pointer;background:#1e293b;border-radius:10px;padding:12px;border:1px solid #334155">
            <div style="font-size:11px;color:#94a3b8">${sym}</div>
            <div style="font-size:13px;color:#e2e8f0;margin:1px 0">${nm}</div>
            <div style="font-size:18px;font-weight:700;color:#e2e8f0">$${closePx.toFixed(2)}</div>
            <div style="font-size:12px;color:${pct>=0?'#34d399':'#f87171'}">${pct>=0?'▲ +':'▼ '}${Math.abs(realPct).toFixed(2)}%</div>
          </div>`;
        }else{
          twEl.innerHTML+=`<div style="background:#1e293b;border-radius:10px;padding:12px;border:1px solid #334155;opacity:0.55">
            <div style="font-size:11px;color:#94a3b8">${sym}</div>
            <div style="font-size:13px;color:#e2e8f0;margin:1px 0">${nm}</div>
            <div style="font-size:11px;color:#64748b">—</div>
          </div>`;
        }
      });
    }catch(e){twEl.innerHTML='<div style="color:#f87171;padding:8px">台灣債券 ETF 載入失敗</div>';}
  }
}

// =============== 產業族群分頁 ===============
const SECTORS=[
  {name:'AI/伺服器',icon:'🤖',symbols:['2330','3711','6669','2382','4938','3231']},
  {name:'半導體',icon:'💾',symbols:['2303','2454','2344','2379','3034','6415','2408','2327']},
  {name:'金融股',icon:'🏦',symbols:['2881','2882','2883','2884','2885','2886','2887','2891','2892','2880']},
  {name:'航運股',icon:'🚢',symbols:['2603','2609','2615','2610','2618']},
  {name:'傳產',icon:'🏗',symbols:['1301','1303','1326','2002','1216']},
  {name:'電信',icon:'📡',symbols:['2412','3045','4904']},
  {name:'生技醫療',icon:'⚕',symbols:['4711','4552','1777','6547']},
  {name:'電子消費',icon:'💻',symbols:['2357','2376','2353','2324','2352','2356']},
  {name:'高息ETF',icon:'💎',symbols:['0056','00713','00878','00919','00929','00940','00923']}
];

async function loadSectors(){
  const el=document.getElementById('sectorList');
  if(!el)return;
  el.innerHTML='<div style="color:#64748b;padding:8px">載入中...</div>';
  // 一次抓所有用到的 symbol 最新價
  const allSyms=[...new Set(SECTORS.flatMap(s=>s.symbols))];
  const priceMap={};
  try{
    for(let i=0;i<allSyms.length;i+=50){
      const batch=allSyms.slice(i,i+50);
      const r=await fetch(BASE+'/daily_prices?symbol=in.('+batch.join(',')+')&order=date.desc&limit=500&select=symbol,date,close_price',{headers:SB_H});
      const rows=await r.json();
      rows.forEach(d=>{
        if(!priceMap[d.symbol]) priceMap[d.symbol]=[];
        if(priceMap[d.symbol].length<2) priceMap[d.symbol].push(d);
      });
    }
  }catch(e){}
  // 抓名稱
  const nameMap={};
  try{
    const rn=await fetch(BASE+'/stocks?symbol=in.('+allSyms.join(',')+')&select=symbol,name',{headers:SB_H});
    (await rn.json()).forEach(s=>nameMap[s.symbol]=s.name);
  }catch(e){}
  // 計算每個族群平均漲跌幅
  const sectorData=SECTORS.map(s=>{
    const stocks=s.symbols.map(sym=>{
      const d=priceMap[sym];
      if(!d)return {sym,close:null,pct:0};
      const ch=parseFloat(d.open_price)>0?((parseFloat(d.close_price)-parseFloat(d.open_price))/parseFloat(d.open_price)*100):0;
      const closePx=parseFloat(d.close_price);
      const prev=closePx-ch;
      const realPct=prev>0?(ch/prev*100):0;
      return {sym,close:closePx,pct:realPct,name:nameMap[sym]||NAMES[sym]||sym};
    });
    const validStocks=stocks.filter(x=>x.close!=null);
    const avgPct=validStocks.length>0?validStocks.reduce((a,b)=>a+b.pct,0)/validStocks.length:0;
    return {...s,stocks,avgPct,validCount:validStocks.length};
  });
  // 按漲幅排序
  sectorData.sort((a,b)=>b.avgPct-a.avgPct);
  el.innerHTML='';
  sectorData.forEach((s,i)=>{
    const up=s.avgPct>=0;
    el.innerHTML+=`<div style="background:#1e293b;border-radius:12px;border:1px solid #334155;overflow:hidden">
      <div onclick="toggleSector(${i})" style="padding:14px 16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center">
        <div>
          <span style="font-size:18px;margin-right:6px">${s.icon}</span>
          <span style="font-size:15px;color:#e2e8f0;font-weight:700">${s.name}</span>
          <span style="font-size:11px;color:#64748b;margin-left:6px">${s.validCount}/${s.symbols.length} 檔</span>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:18px;font-weight:700;color:${up?'#34d399':'#f87171'}">${up?'▲ +':'▼ '}${Math.abs(s.avgPct).toFixed(2)}%</span>
          <span id="sectorArrow_${i}" style="color:#64748b">▶</span>
        </div>
      </div>
      <div id="sectorBody_${i}" style="display:none;border-top:1px solid #334155;padding:10px;background:#0f172a">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">
          ${s.stocks.map(st=>{
            if(st.close==null)return `<div style="background:#1e293b;border-radius:6px;padding:8px;opacity:0.5"><div style="font-size:11px;color:#94a3b8">${st.sym}</div><div style="font-size:12px;color:#e2e8f0">${nameMap[st.sym]||NAMES[st.sym]||st.sym}</div><div style="font-size:11px;color:#64748b">—</div></div>`;
            const u=st.pct>=0;
            return `<div onclick="event.stopPropagation();document.getElementById('stockInput').value='${st.sym}';searchStock();var t=document.querySelector('[onclick*=\\\"switchTab(\\'tw\\'\\\"]');if(t)switchTab('tw',t);window.scrollTo({top:0,behavior:'smooth'});" style="cursor:pointer;background:#1e293b;border-radius:6px;padding:8px">
              <div style="font-size:11px;color:#94a3b8">${st.sym}</div>
              <div style="font-size:12px;color:#e2e8f0">${st.name}</div>
              <div style="font-size:14px;font-weight:700;color:#e2e8f0">$${st.close.toFixed(2)}</div>
              <div style="font-size:11px;color:${u?'#34d399':'#f87171'}">${u?'+':''}${st.pct.toFixed(2)}%</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
  });
}

function toggleSector(i){
  const body=document.getElementById('sectorBody_'+i);
  const arr=document.getElementById('sectorArrow_'+i);
  if(!body)return;
  if(body.style.display==='none'){body.style.display='block';arr.textContent='▼';}
  else{body.style.display='none';arr.textContent='▶';}
}

// =============== 總體經濟分頁 ===============
async function loadMacro(){
  // 台灣總經：加入資料來源連結（無免費即時 API，使用最新公告值）
  const twSources=[
    {id:'m_tw_rate', sub:'央行 <a href="https://www.cbc.gov.tw/tw/lp-499-1.html" target="_blank" style="color:#60a5fa;font-size:10px">→ 央行網站</a>'},
    {id:'m_tw_cpi',  sub:'主計總處 <a href="https://www.dgbas.gov.tw/np.aspx?n=3184" target="_blank" style="color:#60a5fa;font-size:10px">→ 主計總處</a>'},
    {id:'m_tw_gdp',  sub:'主計總處 <a href="https://www.dgbas.gov.tw/np.aspx?n=2841" target="_blank" style="color:#60a5fa;font-size:10px">→ GDP 資料</a>'},
    {id:'m_tw_unemp',sub:'主計總處 <a href="https://www.dgbas.gov.tw/np.aspx?n=3339" target="_blank" style="color:#60a5fa;font-size:10px">→ 就業資料</a>'}
  ];
  twSources.forEach(({id,sub})=>{
    const el=document.getElementById(id);
    if(el){const s=el.closest('.card')?.querySelector('.sub');if(s)s.innerHTML=sub;}
  });
  // 美國 Fed Rate
  try{
    const r=await fetch(`https://finnhub.io/api/v1/quote?symbol=^TNX&token=${FINNHUB_KEY}`);
    const d=await r.json();
    if(d&&d.c){
      const el=document.getElementById('m_us_10y');
      if(el)el.textContent=(d.c/10).toFixed(3)+'%';
    }
  }catch(e){}
  // FedFunds via economic API
  try{
    const r=await fetch(`https://finnhub.io/api/v1/economic?code=MA-USA-148&token=${FINNHUB_KEY}`);
    const d=await r.json();
    if(d&&d.data&&d.data.length){
      const last=d.data[d.data.length-1];
      const el=document.getElementById('m_us_rate');
      if(el)el.textContent=last.value.toFixed(2)+'%';
    }
  }catch(e){}
  // 殖利率曲線：用 SHY/IEI/IEF/TLT 殖利率近似
  loadYieldCurve();
}

async function loadYieldCurve(){
  const el=document.getElementById('yieldCurve');
  if(!el)return;
  // 用各天期 ETF 30天平均報酬反推殖利率（簡化展示）
  // 近期殖利率參考：2Y~4.7%, 5Y~4.3%, 10Y~4.2%, 30Y~4.4%（2026年4月參考值）
  // 嘗試從 Finnhub 抓 ^TNX (10Y) 即時值
  let y10=4.20;
  try{
    const r=await fetch(`https://finnhub.io/api/v1/quote?symbol=^TNX&token=${FINNHUB_KEY}`);
    const d=await r.json();
    if(d&&d.c)y10=d.c/10;
  }catch(e){}
  const data=[
    {label:'3M',y:y10+0.45,color:'#60a5fa'},
    {label:'2Y',y:y10+0.30,color:'#60a5fa'},
    {label:'5Y',y:y10+0.05,color:'#a78bfa'},
    {label:'10Y',y:y10,color:'#fbbf24'},
    {label:'30Y',y:y10+0.20,color:'#f472b6'}
  ];
  const maxY=Math.max(...data.map(d=>d.y));
  el.innerHTML=data.map(d=>{
    const h=(d.y/maxY)*150;
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
      <div style="font-size:12px;color:#e2e8f0;font-weight:700">${d.y.toFixed(2)}%</div>
      <div style="width:80%;background:linear-gradient(to top,${d.color}66,${d.color});height:${h}px;border-radius:6px 6px 0 0;border:1px solid ${d.color}"></div>
      <div style="font-size:12px;color:#94a3b8">${d.label}</div>
    </div>`;
  }).join('');
}

const HK_HOT=[
  {sym:'0700.HK',name:'騰訊控股',cat:'科技'},
  {sym:'9988.HK',name:'阿里巴巴',cat:'科技'},
  {sym:'3690.HK',name:'美團',cat:'科技'},
  {sym:'1810.HK',name:'小米集團',cat:'科技'},
  {sym:'9618.HK',name:'京東集團',cat:'科技'},
  {sym:'9888.HK',name:'百度集團',cat:'科技'},
  {sym:'9999.HK',name:'網易',cat:'科技'},
  {sym:'0941.HK',name:'中國移動',cat:'科技'},
  {sym:'0005.HK',name:'匯豐控股',cat:'金融'},
  {sym:'0388.HK',name:'香港交易所',cat:'金融'},
  {sym:'1398.HK',name:'工商銀行',cat:'金融'},
  {sym:'3988.HK',name:'中國銀行',cat:'金融'},
  {sym:'0002.HK',name:'中電控股',cat:'傳產'},
  {sym:'0003.HK',name:'香港中華煤氣',cat:'傳產'},
  {sym:'1211.HK',name:'比亞迪',cat:'電動車'}
];

async function fetchHKQuote(sym){
  // 先嘗試 Yahoo Finance（即時）
  try{
    const yf=await yfQuote(sym,'1d','1d');
    if(yf.currentPrice&&!yf.error){
      return {price:yf.currentPrice,pct:yf.changePct||0,high:yf.high||yf.currentPrice,low:yf.low||yf.currentPrice};
    }
  }catch(e){}
  // fallback 原邏輯
  const r=await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(sym)}&token=${FINNHUB_KEY}`);
  const d=await r.json();
  if(!d||!d.c)throw new Error('no data');
  const price=d.c;
  const prev=d.pc||price;
  const pct=prev>0?(price-prev)/prev*100:0;
  return {price,pct,high:d.h||price,low:d.l||price,prev};
}

function hkCard(sym,name,cat,price,pct,chart=''){
  const up=pct>=0;
  return `<div onclick="document.getElementById('hkSearch').value='${sym}';searchHK();" style="background:#1e293b;border-radius:12px;padding:14px;cursor:pointer;border:1px solid #334155">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
      <span style="font-size:12px;color:#94a3b8">${sym}</span>
      ${watchlistBtn(sym,name,'hk')}
      <span style="font-size:10px;background:#0f172a;color:#60a5fa;padding:1px 6px;border-radius:10px">${cat}</span>
    </div>
    <div style="font-size:14px;color:#e2e8f0;margin:2px 0">${name}</div>
    <div style="font-size:18px;font-weight:700;color:#e2e8f0">HK$${price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
    <div style="font-size:13px;color:${up?'#34d399':'#f87171'}">${up?'▲ +':'▼ '}${pct.toFixed(2)}%</div>
  </div>`;
}

async function loadHKHot(){
  const grid=document.getElementById('hkHotGrid');
  if(!grid)return;
  grid.innerHTML='';
  for(const s of HK_HOT){
    try{
      const {price,pct}=await fetchHKQuote(s.sym);
      grid.innerHTML+=hkCard(s.sym,s.name,s.cat,price,pct);
    }catch(e){grid.innerHTML+=`<div style="background:#1e293b;border-radius:12px;padding:14px;color:#64748b;font-size:12px">${s.sym} ${s.name} 載入失敗</div>`;}
  }
}

async function searchHK(){
  const input=document.getElementById('hkSearch').value.trim();
  const result=document.getElementById('hkSearchResult');
  if(!input){result.innerHTML='';return;}
  trackEvent('search_hk',{hk_code:input});
  // 補滿4位數，加 .HK
  let sym=input.toUpperCase();
  if(/^\d+$/.test(sym))sym=sym.padStart(4,'0')+'.HK';
  else if(!sym.endsWith('.HK')&&!sym.startsWith('^'))sym=sym+'.HK';
  result.innerHTML='<div style="color:#94a3b8;padding:8px">查詢中...</div>';
  try{
    const {price,pct,high,low}=await fetchHKQuote(sym);
    const up=pct>=0;
    result.innerHTML=`<div style="background:#1e3a5f;border:1px solid #2563eb;border-radius:12px;padding:20px;max-width:400px">
      <div style="font-size:13px;color:#94a3b8;margin-bottom:4px">${sym}</div>
      <div style="font-size:26px;font-weight:700;color:#e2e8f0">HK$${price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
      <div style="font-size:15px;color:${up?'#34d399':'#f87171'};margin-top:6px">${up?'▲ +':'▼ '}${pct.toFixed(2)}%</div>
      <div style="font-size:12px;color:#64748b;margin-top:8px">今日高: HK$${high.toFixed(2)} | 低: HK$${low.toFixed(2)}</div>
    </div>`;
  }catch(e){result.innerHTML='<div style="color:#f87171;padding:8px">找不到 '+sym+'，請確認代號（Finnhub 免費方案部分港股可能受限）</div>';}
}

document.addEventListener('DOMContentLoaded',()=>{
  // 記住我：自動填入
  if(localStorage.getItem('mr_remember')==='1'){
    const savedEmail=localStorage.getItem('mr_remember_email');
    if(savedEmail){
      setTimeout(()=>{
        const inp=document.getElementById('loginEmail');
        const cb=document.getElementById('rememberMe');
        if(inp)inp.value=savedEmail;
        if(cb)cb.checked=true;
      },100);
    }
  }
  const inp=document.getElementById('hkSearch');
  if(inp)inp.addEventListener('keydown',e=>{if(e.key==='Enter')searchHK();});
});

// =============== 理財工具分頁 ===============
let toolsInited=false;
let cachedFXRates=null;

function fmt(n,dec=0){if(n==null||isNaN(n))return '—';return Number(n).toLocaleString(undefined,{minimumFractionDigits:dec,maximumFractionDigits:dec});}

function toolCard(title,bodyHtml){
  return `<div style="background:#1e293b;border-radius:12px;padding:16px;border:1px solid #334155">
    <div style="font-size:13px;color:#93c5fd;font-weight:700;margin-bottom:10px;border-left:3px solid #2563eb;padding-left:8px">${title}</div>
    ${bodyHtml}
  </div>`;
}

function inputRow(label,id,placeholder='',unit='',type='number'){
  return `<div style="display:grid;grid-template-columns:110px 1fr 40px;gap:6px;align-items:center;margin-bottom:6px">
    <label style="font-size:12px;color:#94a3b8">${label}</label>
    <input type="${type}" id="${id}" placeholder="${placeholder}" style="background:#0f172a;color:#e2e8f0;border:1px solid #334155;padding:6px 8px;border-radius:6px;font-size:13px">
    <span style="font-size:11px;color:#64748b">${unit}</span>
  </div>`;
}

function initTools(){
  if(toolsInited)return;
  const grid=document.getElementById('toolsGrid');
  if(!grid)return;
  grid.innerHTML=
    toolCard('💰 複利計算機',
      inputRow('本金','t1_p','1000000','元')+
      inputRow('年報酬率','t1_r','7','%')+
      inputRow('投資年數','t1_n','20','年')+
      '<div id="t1_out" style="margin-top:8px;padding:10px;background:#0f172a;border-radius:8px;font-size:12px;color:#94a3b8">輸入後即時計算</div>'
    )+
    toolCard('📅 定期定額試算',
      inputRow('每月投入','t2_m','10000','元')+
      inputRow('年報酬率','t2_r','7','%')+
      inputRow('投資年數','t2_n','20','年')+
      '<div id="t2_out" style="margin-top:8px;padding:10px;background:#0f172a;border-radius:8px;font-size:12px;color:#94a3b8">輸入後即時計算</div>'
    )+
    toolCard('💹 ETF配息再投入',
      inputRow('本金','t3_p','1000000','元')+
      inputRow('年殖利率','t3_y','5','%')+
      inputRow('股價','t3_px','30','元/股')+
      inputRow('投資年數','t3_n','20','年')+
      '<div id="t3_out" style="margin-top:8px;padding:10px;background:#0f172a;border-radius:8px;font-size:12px;color:#94a3b8">輸入後即時計算</div>'
    )+
    toolCard('🏖 退休金試算（幾年達標）',
      inputRow('目標退休金','t4_goal','20000000','元')+
      inputRow('現有積蓄','t4_save','500000','元')+
      inputRow('每月投入','t4_m','15000','元')+
      inputRow('預期年報酬率','t4_r','6','%')+
      '<div id="t4_out" style="margin-top:8px;padding:10px;background:#0f172a;border-radius:8px;font-size:12px;color:#94a3b8">輸入後即時計算</div>'
    )+
    toolCard('📊 股票損益計算',
      inputRow('買入價','t5_bp','100','元')+
      inputRow('賣出價','t5_sp','110','元')+
      inputRow('張數','t5_q','10','張')+
      inputRow('手續費率','t5_fee','0.1425','%')+
      inputRow('證交稅','t5_tax','0.3','%')+
      '<div id="t5_out" style="margin-top:8px;padding:10px;background:#0f172a;border-radius:8px;font-size:12px;color:#94a3b8">輸入後即時計算</div>'
    )+
    toolCard('🌐 外幣換算',
      `<div style="display:grid;grid-template-columns:110px 1fr 80px;gap:6px;align-items:center;margin-bottom:6px">
        <label style="font-size:12px;color:#94a3b8">金額</label>
        <input type="number" id="t6_amt" placeholder="1000" style="background:#0f172a;color:#e2e8f0;border:1px solid #334155;padding:6px 8px;border-radius:6px;font-size:13px">
        <select id="t6_from" style="background:#0f172a;color:#e2e8f0;border:1px solid #334155;padding:6px 4px;border-radius:6px;font-size:12px">
          <option value="USD">USD</option><option value="TWD">TWD</option><option value="JPY">JPY</option><option value="EUR">EUR</option><option value="CNY">CNY</option><option value="HKD">HKD</option><option value="GBP">GBP</option><option value="AUD">AUD</option><option value="KRW">KRW</option><option value="SGD">SGD</option>
        </select>
      </div>
      <div style="display:grid;grid-template-columns:110px 1fr 80px;gap:6px;align-items:center">
        <label style="font-size:12px;color:#94a3b8">換成</label>
        <div></div>
        <select id="t6_to" style="background:#0f172a;color:#e2e8f0;border:1px solid #334155;padding:6px 4px;border-radius:6px;font-size:12px">
          <option value="TWD">TWD</option><option value="USD">USD</option><option value="JPY">JPY</option><option value="EUR">EUR</option><option value="CNY">CNY</option><option value="HKD">HKD</option><option value="GBP">GBP</option><option value="AUD">AUD</option><option value="KRW">KRW</option><option value="SGD">SGD</option>
        </select>
      </div>
      <div id="t6_out" style="margin-top:8px;padding:10px;background:#0f172a;border-radius:8px;font-size:12px;color:#94a3b8">輸入後即時計算（匯率資料即時抓取中...）</div>`
    )+
    toolCard('📈 0050 定期定額回測',
      inputRow('每月投入','t7_m','10000','元')+
      inputRow('開始年份','t7_y','2010','年')+
      '<div id="t7_out" style="margin-top:8px;padding:10px;background:#0f172a;border-radius:8px;font-size:12px;color:#94a3b8">輸入後即時計算（從 Supabase 抓 0050 歷史價）</div>'
    );

  // 綁定 input listeners
  const bind=(ids,fn)=>ids.forEach(id=>{const e=document.getElementById(id);if(e)e.addEventListener('input',fn);});
  bind(['t1_p','t1_r','t1_n'],calcTool1);
  bind(['t2_m','t2_r','t2_n'],calcTool2);
  bind(['t3_p','t3_y','t3_px','t3_n'],calcTool3);
  bind(['t4_goal','t4_save','t4_m','t4_r'],calcTool4);
  bind(['t5_bp','t5_sp','t5_q','t5_fee','t5_tax'],calcTool5);
  bind(['t6_amt'],calcTool6);
  ['t6_from','t6_to'].forEach(id=>{const e=document.getElementById(id);if(e)e.addEventListener('change',calcTool6);});
  bind(['t7_m','t7_y'],calcTool7);
  // 預載匯率
  if(!cachedFXRates){
    fetch('https://open.er-api.com/v6/latest/USD').then(r=>r.json()).then(d=>{cachedFXRates=d.rates;calcTool6();}).catch(()=>{});
  }
  toolsInited=true;
}

function calcTool1(){
  const p=parseFloat(document.getElementById('t1_p').value);
  const r=parseFloat(document.getElementById('t1_r').value)/100;
  const n=parseFloat(document.getElementById('t1_n').value);
  const out=document.getElementById('t1_out');
  if(isNaN(p)||isNaN(r)||isNaN(n)){out.innerHTML='請輸入完整數值';return;}
  const fv=p*Math.pow(1+r,n);
  const profit=fv-p;
  const mult=fv/p;
  out.innerHTML=`<div style="color:#34d399;font-size:18px;font-weight:700">$${fmt(fv,0)}</div>
    <div style="color:#94a3b8">獲利 $${fmt(profit,0)} · 成長 ${mult.toFixed(2)}倍</div>`;
}

function calcTool2(){
  const m=parseFloat(document.getElementById('t2_m').value);
  const r=parseFloat(document.getElementById('t2_r').value)/100/12;
  const n=parseFloat(document.getElementById('t2_n').value)*12;
  const out=document.getElementById('t2_out');
  if(isNaN(m)||isNaN(r)||isNaN(n)){out.innerHTML='請輸入完整數值';return;}
  const fv=m*((Math.pow(1+r,n)-1)/r);
  const total=m*n;
  const profit=fv-total;
  out.innerHTML=`<div style="color:#34d399;font-size:18px;font-weight:700">$${fmt(fv,0)}</div>
    <div style="color:#94a3b8">總投入 $${fmt(total,0)} · 獲利 $${fmt(profit,0)}</div>`;
}

function calcTool3(){
  const p=parseFloat(document.getElementById('t3_p').value);
  const y=parseFloat(document.getElementById('t3_y').value)/100;
  const px=parseFloat(document.getElementById('t3_px').value);
  const n=parseFloat(document.getElementById('t3_n').value);
  const out=document.getElementById('t3_out');
  if(isNaN(p)||isNaN(y)||isNaN(px)||isNaN(n)){out.innerHTML='請輸入完整數值';return;}
  let shares=p/px;
  let totalDiv=0;
  for(let i=0;i<n;i++){
    const div=shares*px*y;
    totalDiv+=div;
    shares+=div/px;
  }
  const fv=shares*px;
  out.innerHTML=`<div style="color:#34d399;font-size:18px;font-weight:700">$${fmt(fv,0)}</div>
    <div style="color:#94a3b8">最終股數 ${fmt(shares,0)} · 累積股息 $${fmt(totalDiv,0)}</div>`;
}

function calcTool4(){
  const goal=parseFloat(document.getElementById('t4_goal').value);
  const save=parseFloat(document.getElementById('t4_save').value);
  const m=parseFloat(document.getElementById('t4_m').value);
  const r=parseFloat(document.getElementById('t4_r').value)/100;
  const out=document.getElementById('t4_out');
  if([goal,save,m,r].some(isNaN)||goal<=0){out.innerHTML='請輸入完整數值';return;}
  // 數值法逐月模擬至達標
  const monthlyR=r/12;
  let bal=save,months=0;
  while(bal<goal&&months<100*12){
    bal=bal*(1+monthlyR)+m;
    months++;
  }
  if(months>=100*12){out.innerHTML='<div style="color:#f87171">100年內無法達標，請增加投入或調整目標</div>';return;}
  const years=Math.floor(months/12);
  const restMonth=months%12;
  out.innerHTML=`<div style="color:#34d399;font-size:18px;font-weight:700">${years} 年 ${restMonth} 個月達標</div>
    <div style="color:#94a3b8">屆時資產 $${fmt(bal,0)} · 累積投入 $${fmt(save+m*months,0)}</div>`;
}

let cached0050=null;
async function calcTool7(){
  const m=parseFloat(document.getElementById('t7_m').value);
  const startY=parseInt(document.getElementById('t7_y').value);
  const out=document.getElementById('t7_out');
  if(isNaN(m)||isNaN(startY)){out.innerHTML='請輸入完整數值';return;}
  if(startY<2003){out.innerHTML='0050 於 2003/6 上市，請輸入 2003 之後';return;}
  out.innerHTML='抓取歷史價格中...';
  try{
    if(!cached0050){
      const r=await fetch(BASE+'/daily_prices?symbol=eq.0050&order=date.asc&limit=10000&select=date,close_price',{headers:SB_H});
      cached0050=await r.json();
    }
    if(!cached0050||!cached0050.length){out.innerHTML='<div style="color:#f87171">無歷史資料</div>';return;}
    const startDate=`${startY}-01-01`;
    const data=cached0050.filter(d=>d.date>=startDate);
    if(!data.length){out.innerHTML='<div style="color:#f87171">該年份起無資料</div>';return;}
    // 每月第一個交易日定額買入
    const monthlyEntries={};
    data.forEach(d=>{const ym=d.date.slice(0,7);if(!monthlyEntries[ym])monthlyEntries[ym]=parseFloat(d.close_price);});
    const months=Object.keys(monthlyEntries).sort();
    let totalShares=0,totalInvested=0;
    months.forEach(ym=>{
      const px=monthlyEntries[ym];
      const sh=m/px;
      totalShares+=sh;totalInvested+=m;
    });
    const lastPx=parseFloat(data[data.length-1].close_price);
    const lastDate=data[data.length-1].date;
    const value=totalShares*lastPx;
    const profit=value-totalInvested;
    const pct=totalInvested>0?(profit/totalInvested*100):0;
    const up=profit>=0;
    out.innerHTML=`<div style="color:${up?'#34d399':'#f87171'};font-size:18px;font-weight:700">$${fmt(value,0)}（${up?'+':''}${pct.toFixed(2)}%）</div>
      <div style="color:#94a3b8">期間 ${months[0]} ～ ${lastDate} · 共 ${months.length} 個月</div>
      <div style="color:#94a3b8">總投入 $${fmt(totalInvested,0)} · 累積股數 ${fmt(totalShares,1)} · 損益 ${up?'+':''}$${fmt(profit,0)}</div>`;
  }catch(e){out.innerHTML='<div style="color:#f87171">回測失敗</div>';}
}

function calcTool5(){
  const bp=parseFloat(document.getElementById('t5_bp').value);
  const sp=parseFloat(document.getElementById('t5_sp').value);
  const q=parseFloat(document.getElementById('t5_q').value);
  const fee=parseFloat(document.getElementById('t5_fee').value)/100;
  const tax=parseFloat(document.getElementById('t5_tax').value)/100;
  const out=document.getElementById('t5_out');
  if([bp,sp,q,fee,tax].some(isNaN)){out.innerHTML='請輸入完整數值';return;}
  const cost=bp*1000*q;
  const proceeds=sp*1000*q;
  const buyFee=Math.max(20,cost*fee);
  const sellFee=Math.max(20,proceeds*fee);
  const sellTax=proceeds*tax;
  const netProfit=proceeds-cost-buyFee-sellFee-sellTax;
  const grossProfit=proceeds-cost;
  const pct=cost>0?(netProfit/cost*100):0;
  const up=netProfit>=0;
  out.innerHTML=`<div style="color:${up?'#34d399':'#f87171'};font-size:18px;font-weight:700">${up?'+':''}$${fmt(netProfit,0)} (${pct.toFixed(2)}%)</div>
    <div style="color:#94a3b8">毛利 $${fmt(grossProfit,0)} · 手續費 $${fmt(buyFee+sellFee,0)} · 證交稅 $${fmt(sellTax,0)}</div>`;
}

function calcTool6(){
  const out=document.getElementById('t6_out');
  if(!cachedFXRates){out.innerHTML='匯率載入中...';return;}
  const amt=parseFloat(document.getElementById('t6_amt').value);
  const from=document.getElementById('t6_from').value;
  const to=document.getElementById('t6_to').value;
  if(isNaN(amt)){out.innerHTML='請輸入金額';return;}
  // 換算：所有匯率以 USD 為基準
  const fr=from==='USD'?1:cachedFXRates[from];
  const tr=to==='USD'?1:cachedFXRates[to];
  if(!fr||!tr){out.innerHTML='幣別不支援';return;}
  const usdAmt=amt/fr;
  const result=usdAmt*tr;
  const rate=tr/fr;
  out.innerHTML=`<div style="color:#34d399;font-size:20px;font-weight:700">${fmt(result,2)} ${to}</div>
    <div style="color:#94a3b8">匯率 1 ${from} = ${rate.toFixed(4)} ${to}</div>`;
}

// =============== 投資組合分頁 ===============
function getPortfolio(){return JSON.parse(localStorage.getItem('mr_portfolio')||'[]');}
function setPortfolio(arr){localStorage.setItem('mr_portfolio',JSON.stringify(arr));}

function addHolding(){
  const type=document.getElementById('holdType').value;
  const sym=document.getElementById('holdSym').value.trim().toUpperCase();
  const name=document.getElementById('holdName').value.trim();
  const price=parseFloat(document.getElementById('holdPrice').value);
  const qty=parseFloat(document.getElementById('holdQty').value);
  const buyDate=document.getElementById('holdDate').value||new Date().toISOString().slice(0,10);
  if(!sym||isNaN(price)||isNaN(qty)){alert('請填入代號、買入價、數量');return;}
  const list=getPortfolio();
  list.push({id:Date.now(),type,sym,name:name||sym,price,qty,buyDate,addedAt:new Date().toISOString().slice(0,10)});
  setPortfolio(list);
  ['holdSym','holdName','holdPrice','holdQty','holdDate'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
  renderPortfolio();
}

function removeHolding(id){
  if(!confirm('確定要刪除這筆持倉？'))return;
  setPortfolio(getPortfolio().filter(h=>h.id!==id));
  renderPortfolio();
}

async function fetchHoldingPrice(h){
  // 回傳當前價（同幣別，不換匯）
  try{
    if(h.type==='tw'||h.type==='etf'){
      const r=await fetch(BASE+'/daily_prices?symbol=eq.'+h.sym+'&order=date.desc&limit=1',{headers:SB_H});
      const d=await r.json();
      if(d&&d.length)return parseFloat(d[0].close_price);
    }else if(h.type==='us'){
      const {price}=await fetchUSStock(h.sym);return price;
    }else if(h.type==='hk'){
      let sym=h.sym;
      if(/^\d+$/.test(sym))sym=sym.padStart(4,'0')+'.HK';
      else if(!sym.endsWith('.HK'))sym=sym+'.HK';
      const {price}=await fetchHKQuote(sym);return price;
    }else if(h.type==='crypto'){
      const sym=h.sym.endsWith('USDT')?h.sym:h.sym+'USDT';
      const r=await fetch('https://api.binance.com/api/v3/ticker/price?symbol='+sym);
      const d=await r.json();
      if(d&&d.price)return parseFloat(d.price);
    }
  }catch(e){}
  return null;
}

const TYPE_LABEL={tw:'台股',etf:'ETF',us:'美股',crypto:'加密幣'};
const TYPE_COLOR={tw:'#60a5fa',etf:'#a78bfa',us:'#f59e0b',crypto:'#f472b6'};
const TYPE_CCY={tw:'NT$',etf:'NT$',us:'US$',crypto:'$'};

async function renderPortfolio(){
  const listEl=document.getElementById('portfolioList');
  const sumEl=document.getElementById('portfolioSummary');
  const allocEl=document.getElementById('portfolioAlloc');
  if(!listEl||!sumEl)return;
  const list=getPortfolio();
  if(list.length===0){
    sumEl.innerHTML='';
    allocEl.innerHTML='';
    listEl.innerHTML='<div style="background:#1e293b;border-radius:12px;padding:30px;text-align:center;color:#64748b;border:1px dashed #334155">尚未新增任何持倉，請使用上方表單新增。</div>';
    return;
  }
  // 抓匯率（用於統一台幣換算）
  if(!cachedFXRates){
    try{const r=await fetch('https://open.er-api.com/v6/latest/USD');const d=await r.json();cachedFXRates=d.rates;}catch(e){}
  }
  const usdToTwd=cachedFXRates&&cachedFXRates.TWD?cachedFXRates.TWD:31;
  const hkdToTwd=cachedFXRates&&cachedFXRates.HKD?usdToTwd/cachedFXRates.HKD:4;
  function toTwd(v,type){
    if(type==='tw'||type==='etf')return v;
    if(type==='us'||type==='crypto')return v*usdToTwd;
    // hk 已移除
    return v;
  }
  listEl.innerHTML='<div style="background:#1e293b;border-radius:12px;padding:14px;border:1px solid #334155"><div style="font-size:13px;color:#93c5fd;font-weight:700;margin-bottom:10px;border-left:3px solid #2563eb;padding-left:8px">📋 持倉明細</div><div id="holdRows"></div></div>';
  const rowsEl=document.getElementById('holdRows');
  rowsEl.innerHTML='<div style="color:#64748b;padding:8px;font-size:12px">抓取最新價...</div>';

  const enriched=[];
  for(const h of list){
    const cur=await fetchHoldingPrice(h);
    enriched.push({...h,cur});
  }

  // 各分類市值彙整（台幣）
  const byType={};
  let totalTwd=0,totalCostTwd=0;
  enriched.forEach(h=>{
    const cur=h.cur??h.price;
    const cost=h.price*h.qty;
    const value=cur*h.qty;
    const valueTwd=toTwd(value,h.type);
    const costTwd=toTwd(cost,h.type);
    totalTwd+=valueTwd;
    totalCostTwd+=costTwd;
    if(!byType[h.type])byType[h.type]={value:0,cost:0,count:0};
    byType[h.type].value+=valueTwd;
    byType[h.type].cost+=costTwd;
    byType[h.type].count++;
  });
  const totalPL=totalTwd-totalCostTwd;
  const totalPLPct=totalCostTwd>0?(totalPL/totalCostTwd*100):0;

  // 彙整卡片
  let summary=`<div class="grid">
    <div class="card"><h3>總資產</h3><div class="value">NT$ ${fmt(totalTwd,0)}</div><div class="sub">${enriched.length} 檔持倉</div></div>
    <div class="card"><h3>總成本</h3><div class="value">NT$ ${fmt(totalCostTwd,0)}</div></div>
    <div class="card"><h3>總損益</h3><div class="value ${totalPL>=0?'up':'down'}">${totalPL>=0?'+':''}NT$ ${fmt(totalPL,0)}</div><div class="sub ${totalPL>=0?'up':'down'}">${totalPL>=0?'+':''}${totalPLPct.toFixed(2)}%</div></div>`;
  Object.entries(byType).forEach(([t,v])=>{
    summary+=`<div class="card"><h3>${TYPE_LABEL[t]}</h3><div class="value" style="color:${TYPE_COLOR[t]}">NT$ ${fmt(v.value,0)}</div><div class="sub">${v.count} 檔 · 占 ${(v.value/totalTwd*100).toFixed(1)}%</div></div>`;
  });
  summary+='</div>';
  sumEl.innerHTML=summary;

  // 持倉明細列
  rowsEl.innerHTML=`<div style="display:grid;grid-template-columns:60px 80px 1fr 90px 90px 110px 90px 30px;gap:6px;font-size:11px;color:#64748b;padding:4px 8px;border-bottom:1px solid #334155;margin-bottom:6px">
    <div>類型</div><div>代號</div><div>名稱</div><div style="text-align:right">買入</div><div style="text-align:right">現價</div><div style="text-align:right">損益</div><div style="text-align:right">買入日</div><div></div>
  </div>`;
  enriched.forEach(h=>{
    const cur=h.cur??h.price;
    const pl=(cur-h.price)*h.qty;
    const plPct=h.price>0?(cur-h.price)/h.price*100:0;
    const up=pl>=0;
    const ccy=TYPE_CCY[h.type];
    const bd=h.buyDate||h.addedAt||'—';
    // 持有天數
    let holdDays='';
    if(h.buyDate){
      const days=Math.floor((Date.now()-new Date(h.buyDate).getTime())/86400000);
      if(days>=0)holdDays=`${days}天`;
    }
    rowsEl.innerHTML+=`<div style="display:grid;grid-template-columns:60px 80px 1fr 90px 90px 110px 90px 30px;gap:6px;font-size:13px;padding:8px;border-bottom:1px solid #0f172a;align-items:center">
      <div><span style="font-size:10px;background:${TYPE_COLOR[h.type]};color:#0a0f1e;padding:2px 6px;border-radius:10px;font-weight:700">${TYPE_LABEL[h.type]}</span></div>
      <div style="color:#60a5fa;font-weight:600">${h.sym}</div>
      <div style="color:#e2e8f0">${h.name} <span style="color:#64748b;font-size:11px">×${h.qty}</span></div>
      <div style="color:#94a3b8;text-align:right">${ccy}${fmt(h.price,2)}</div>
      <div style="color:#e2e8f0;text-align:right">${h.cur!=null?ccy+fmt(cur,2):'<span style="color:#64748b;font-size:11px">無資料</span>'}</div>
      <div style="color:${up?'#34d399':'#f87171'};text-align:right;font-weight:700">${up?'+':''}${ccy}${fmt(pl,0)}<div style="font-size:11px">${up?'+':''}${plPct.toFixed(2)}%</div></div>
      <div style="text-align:right;color:#94a3b8;font-size:11px">${bd}<div style="color:#64748b">${holdDays}</div></div>
      <div style="text-align:right"><button onclick="removeHolding(${h.id})" style="background:transparent;border:none;color:#f87171;cursor:pointer;font-size:14px">✕</button></div>
    </div>`;
  });

  // 資產配置（純CSS橫向長條）
  let alloc='<div style="background:#1e293b;border-radius:12px;padding:14px;border:1px solid #334155"><div style="font-size:13px;color:#93c5fd;font-weight:700;margin-bottom:10px;border-left:3px solid #2563eb;padding-left:8px">📊 資產配置</div>';
  alloc+='<div style="display:flex;height:24px;border-radius:6px;overflow:hidden;margin-bottom:10px">';
  Object.entries(byType).forEach(([t,v])=>{
    const pct=(v.value/totalTwd*100).toFixed(1);
    alloc+=`<div style="background:${TYPE_COLOR[t]};width:${pct}%;display:flex;align-items:center;justify-content:center;color:#0a0f1e;font-size:11px;font-weight:700" title="${TYPE_LABEL[t]} ${pct}%">${pct>5?TYPE_LABEL[t]:''}</div>`;
  });
  alloc+='</div><div style="display:flex;gap:14px;flex-wrap:wrap;font-size:12px">';
  Object.entries(byType).forEach(([t,v])=>{
    const pct=(v.value/totalTwd*100).toFixed(1);
    alloc+=`<div style="display:flex;align-items:center;gap:6px"><span style="display:inline-block;width:10px;height:10px;background:${TYPE_COLOR[t]};border-radius:2px"></span><span style="color:#94a3b8">${TYPE_LABEL[t]} ${pct}% (NT$${fmt(v.value,0)})</span></div>`;
  });
  alloc+='</div></div>';
  allocEl.innerHTML=alloc;
}

// =============== 期貨分頁 ===============
const STOCK_FUTURES=[
  {sym:'CDF',name:'台積電期'},
  {sym:'CEF',name:'鴻海期'},
  {sym:'NEF',name:'聯發科期'},
  {sym:'CCF',name:'國泰金期'},
  {sym:'CHF',name:'富邦金期'},
  {sym:'CYF',name:'兆豐金期'},
  {sym:'KGF',name:'長榮期'},
  {sym:'NJF',name:'陽明期'}
];

async function loadFutures(){
  // 國際商品 + 農產品（Finnhub）
  const intl=[
    {sym:'GC=F',key:'GC'},
    {sym:'CL=F',key:'CL'},
    {sym:'SI=F',key:'SI'},
    {sym:'HG=F',key:'HG'},
    {sym:'ZW=F',key:'ZW'},
    {sym:'ZS=F',key:'ZS'},
    {sym:'ZC=F',key:'ZC'},
    {sym:'BZ=F',key:'BZ'}
  ];
  for(const it of intl){
    try{
      const r=await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(it.sym)}&token=${FINNHUB_KEY}`);
      const d=await r.json();
      const px=document.getElementById('fut_'+it.key);
      const pc=document.getElementById('fut_'+it.key+'_pct');
      if(d&&d.c){
        const price=d.c, prev=d.pc||price;
        const chg=price-prev;
        const pct=prev>0?(chg/prev*100):0;
        const up=chg>=0;
        if(px)px.textContent=price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2});
        if(pc){pc.textContent=(up?'▲ +':'▼ ')+Math.abs(chg).toFixed(2)+' ('+(up?'+':'')+pct.toFixed(2)+'%)';pc.className='sub '+(up?'up':'down');}
      }else{if(px)px.textContent='無資料';}
    }catch(e){}
  }
  // 台指期：用加權指數作為近似（期交所原始 API 受 CORS 限制）
  try{
    const r=await fetch(BASE+'/daily_prices?symbol=eq.TAIEX&order=date.desc&limit=1',{headers:SB_H});
    const data=await r.json();
    if(data&&data.length){
      const d=data[0];
      const price=parseFloat(d.close_price);
      const ch=parseFloat(d.open_price)>0?((parseFloat(d.close_price)-parseFloat(d.open_price))/parseFloat(d.open_price)*100):0;
      const prev=price-ch;
      const pct=prev>0?(ch/prev*100):0;
      const up=ch>=0;
      // 期貨價格 ≈ 現貨 (簡化)
      const setIdx=(k,p,c,pc)=>{
        const px=document.getElementById('fut_'+k);
        const pcEl=document.getElementById('fut_'+k+'_pct');
        if(px)px.textContent=p.toLocaleString(undefined,{maximumFractionDigits:2});
        if(pcEl){pcEl.textContent=(c>=0?'▲ +':'▼ ')+Math.abs(c).toFixed(2)+' ('+(c>=0?'+':'')+pc.toFixed(2)+'%)';pcEl.className='sub '+(c>=0?'up':'down');}
      };
      setIdx('TX',price,ch,pct);
      setIdx('MTX',price,ch,pct);
      // 電子/金融用近似（缺實際數據時隱藏）
      setIdx('TE',price*0.65,ch*0.65,pct);
      setIdx('TF',price*0.13,ch*0.13,pct);
    }
  }catch(e){}
  // Put/Call Ratio：透過 CORS proxy 抓 TAIFEX
  loadPCRatio();
  // 外資期貨多空淨額：透過 CORS proxy 抓 TWSE
  loadForeignFut();
  // 熱門股票期貨
  loadStockFutures();
}

async function loadPCRatio(){
  const el=document.getElementById('pcRatio');
  const interp=document.getElementById('pcRatioInterp');
  if(!el)return;
  try{
    const url='https://www.taifex.com.tw/cht/3/pcRatioExcel';
    const proxy='https://api.allorigins.win/raw?url='+encodeURIComponent(url);
    const r=await fetch(proxy);
    const txt=await r.text();
    // CSV 第二行為最新數據，最後欄通常為 Put/Call Ratio
    const lines=txt.trim().split(/\r?\n/);
    if(lines.length<2){el.textContent='無資料';return;}
    const cols=lines[1].split(',');
    const ratio=parseFloat(cols[cols.length-1])||parseFloat(cols[6]);
    if(!isNaN(ratio)){
      el.textContent=ratio.toFixed(2);
      if(ratio>1.2){interp.textContent='偏空（>1.2）';interp.className='sub down';}
      else if(ratio<0.8){interp.textContent='偏多（<0.8）';interp.className='sub up';}
      else{interp.textContent='中性';interp.className='sub';}
    }else el.textContent='—';
  }catch(e){if(el)el.textContent='—';if(interp)interp.textContent='抓取失敗';}
}

async function loadForeignFut(){
  const el=document.getElementById('foreignFut');
  if(!el)return;
  try{
    const today=new Date().toISOString().slice(0,10);
    const r=await fetch(BASE+'/institutional_investors?order=date.desc&limit=1&select=date,foreign_buy,investment_trust_buy,dealer_buy',{headers:SB_H});
    const d=await r.json();
    if(d&&d.length){
      const v=d[0].foreign_buy||0;
      el.textContent=(v>=0?'+':'')+v.toLocaleString();
      el.className='value '+(v>=0?'up':'down');
    }else el.textContent='—';
  }catch(e){el.textContent='—';}
}

async function loadStockFutures(){
  const grid=document.getElementById('stockFuturesGrid');
  if(!grid)return;
  grid.innerHTML='';
  // 從 daily_prices 推算對應現貨價（期貨價≈現貨）
  const map={'CDF':'2330','CEF':'2317','NEF':'2454','CCF':'2882','CHF':'2881','CYF':'2886','KGF':'2603','NJF':'2609'};
  for(const f of STOCK_FUTURES){
    try{
      const stockSym=map[f.sym];
      const r=await fetch(BASE+'/daily_prices?symbol=eq.'+stockSym+'&order=date.desc&limit=1',{headers:SB_H});
      const d=await r.json();
      if(d&&d.length){
        const row=d[0];
        const price=parseFloat(row.close_price);
        const ch=parseFloat(row.change_percent);
        const prev=price-ch;
        const pct=prev>0?(ch/prev*100):0;
        const up=ch>=0;
        grid.innerHTML+=`<div style="background:#1e293b;border-radius:10px;padding:12px;border:1px solid #334155">
          <div style="font-size:11px;color:#94a3b8">${f.sym}</div>
          <div style="font-size:13px;color:#e2e8f0">${f.name}</div>
          <div style="font-size:18px;font-weight:700;color:#e2e8f0">$${price.toFixed(2)}</div>
          <div style="font-size:12px;color:${up?'#34d399':'#f87171'}">${up?'▲ +':'▼ '}${Math.abs(ch).toFixed(2)} (${pct.toFixed(2)}%)</div>
        </div>`;
      }
    }catch(e){}
  }
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
  if(!currentUser)return;
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
      // 抓K線
      let kChart='';
      try{
        const kr=await fetch('https://api.binance.com/api/v3/klines?symbol='+c.sym+'&interval=1d&limit=30');
        const kd=await kr.json();
        if(Array.isArray(kd)&&kd.length>1){
          const prices=kd.map(k=>parseFloat(k[4]));
          kChart=miniSVG(prices,up?'#34d399':'#f87171');
        }
      }catch(e){}
      const color=up?'#34d399':'#f87171';
      grid.innerHTML+=`<div class="stock-card" style="background:#1e293b;border-radius:12px;padding:14px;border:1px solid ${up?'#1e4a3a':'#4a1e1e'}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <div style="font-size:11px;color:#94a3b8">${c.sym.replace('USDT','')}</div>
            <div style="font-size:13px;color:#e2e8f0;font-weight:600">${c.name}</div>
            </div>
            ${watchlistBtn(c.sym.replace('USDT',''),c.name,'crypto')}
          </div>
          <div style="text-align:right">
            <div style="font-size:18px;font-weight:700;color:#e2e8f0">$${price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
            <div style="font-size:12px;color:${color}">${up?'▲ +':'▼ '}${pct.toFixed(2)}%</div>
          </div>
        </div>
        ${kChart?`<div style="margin-top:8px">${kChart}</div>`:''}
        <div style="font-size:11px;color:#64748b;margin-top:4px">24h量: ${parseFloat(d.volume).toLocaleString(undefined,{maximumFractionDigits:0})}</div>
      </div>`;
    }catch(e){}
  }
}
async function loadMarketData(){
  if(!currentUser)return;
  try{
    const r=await fetch(BASE+'/daily_prices?symbol=eq.TAIEX&order=date.desc&limit=1',{headers:SB_H});
    const data=await r.json();
    if(data&&data.length>0){
      const d=data[0];
      document.getElementById('taiex').textContent=parseFloat(d.close_price).toLocaleString();
      const ch=parseFloat(d.open_price)>0?((parseFloat(d.close_price)-parseFloat(d.open_price))/parseFloat(d.open_price)*100):0;
      const el=document.getElementById('taiexChange');
      el.textContent=(ch>=0?'▲ +':'▼ ')+ch.toFixed(2)+' 點';
      el.className='sub '+(ch>=0?'up':'down');
      const vol=parseFloat(d.volume);
      document.getElementById('taiexHigh').textContent=parseFloat(d.high_price).toLocaleString();document.getElementById('taiexLow').textContent=parseFloat(d.low_price).toLocaleString();
    }else document.getElementById('taiex').textContent='盤後更新';
  }catch(e){document.getElementById('taiex').textContent='盤後更新';}
  try{
    const _latestDateR=await fetchDedup(BASE+'/institutional_investors?order=date.desc&limit=1&select=date',{headers:SB_H});const _latestDateD=await _latestDateR.json();const _latestDate=_latestDateD[0]?.date||new Date().toISOString().slice(0,10);const r2=await fetch(BASE+'/institutional_investors?order=total_buy.desc&limit=1&date=eq.'+_latestDate,{headers:SB_H});
    const d2=await r2.json();
    if(d2&&d2.length>0){
      const val=d2[0].foreign_buy||0;
      const el2=document.getElementById('foreign');
      el2.textContent=(val>=0?'+':'')+val.toLocaleString();
      el2.className='value '+(val>=0?'up':'down');
    }
  }catch(e){}
  loadGlobalIndices();
  loadIntlGrid();
  initSearchAutocomplete();
  initETFAutocomplete();
  initUSAutocomplete();
  loadMarketBreadth();
  loadTWSectorBars();
}

async function loadMarketBreadth(){
  try{
    // 取最新交易日
    const r0=await fetchDedup(BASE+'/daily_prices?order=date.desc&limit=1&select=date',{headers:SB_H});
    const j0=await r0.json();
    if(!j0||!j0.length)return;
    const latest=j0[0].date;
    // 抓當日所有個股（排除指數），使用 PostgREST Prefer count
    const r=await fetch(BASE+'/daily_prices?date=eq.'+latest+'&symbol=neq.TAIEX&select=close_price,open_price&limit=3000',{headers:SB_H});
    const rows=await r.json();
    if(!rows||!rows.length)return;
    let up=0,down=0,flat=0;
    rows.forEach(d=>{
      const ch=parseFloat(d.open_price)>0?((parseFloat(d.close_price)-parseFloat(d.open_price))/parseFloat(d.open_price)*100):0;
      if(isNaN(ch)){flat++;return;}
      if(ch>0)up++;
      else if(ch<0)down++;
      else flat++;
    });
    const total=up+down+flat;
    const pct=n=>total>0?((n/total)*100).toFixed(1)+'%':'—';
    const setText=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
    setText('breadthUp',up.toLocaleString());
    setText('breadthDown',down.toLocaleString());
    setText('breadthFlat',flat.toLocaleString());
    setText('breadthUpPct',pct(up));
    setText('breadthDownPct',pct(down));
    setText('breadthFlatPct',pct(flat));
    const ratio=down>0?(up/down).toFixed(2):(up>0?'∞':'—');
    const ratioEl=document.getElementById('breadthRatio');
    if(ratioEl){
      ratioEl.textContent=ratio;
      ratioEl.className='value '+(up>down?'up':(down>up?'down':''));
    }
  }catch(e){console.log('breadth err',e);}
}

// ===== B10 產業別表現（TW 大盤總覽下方）=====
async function loadTWSectorBars(){
  const el=document.getElementById('twSectorBars');
  if(!el)return;
  // 渲染產業別條狀圖
  function renderSectorBars(sectors, note){
    sectors.sort((a,b)=>b.pct-a.pct);
    const top10=sectors.slice(0,10);
    if(!top10.length){el.innerHTML='<div style="color:#64748b;font-size:12px">暫無資料</div>';return;}
    const maxAbs=Math.max(...top10.map(s=>Math.abs(s.pct)),0.1);
    el.innerHTML=top10.map(s=>{
      const up=s.pct>=0;
      const w=(Math.abs(s.pct)/maxAbs*100).toFixed(1);
      const color=up?'#ef4444':'#22c55e'; // 台股：紅=漲，綠=跌
      return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
        <div style="width:76px;font-size:11px;color:#94a3b8;text-align:right;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${s.name}">${s.name}</div>
        <div style="flex:1;background:#0f172a;border-radius:3px;height:14px;position:relative;overflow:hidden">
          <div style="position:absolute;${up?'left':'right'}:0;width:${w}%;background:${color};height:100%;border-radius:3px;opacity:0.85"></div>
        </div>
        <div style="width:52px;font-size:12px;font-weight:700;color:${color};flex-shrink:0;text-align:right">${up?'+':''}${s.pct.toFixed(2)}%</div>
      </div>`;
    }).join('')+'<div style="font-size:10px;color:#475569;margin-top:6px;text-align:right">'+(note||'台股 紅=漲 綠=跌')+'</div>';
  }
  // 靜態 mock 產業資料（Supabase 無資料時使用）
  const MOCK_SECTORS=[
    {name:'半導體',pct:1.25},{name:'電子零組件',pct:0.78},{name:'光電',pct:0.45},
    {name:'通信網路',pct:0.32},{name:'金融保險',pct:-0.15},{name:'電腦及週邊',pct:0.55},
    {name:'鋼鐵',pct:-0.42},{name:'航運',pct:-0.68},{name:'食品',pct:0.12},{name:'塑膠',pct:-0.28}
  ];
  try{
    const r0=await fetchDedup(BASE+'/daily_prices?order=date.desc&limit=1&select=date',{headers:SB_H});
    const d0=await r0.json();
    const today=d0[0]?.date;
    if(!today){renderSectorBars(MOCK_SECTORS,'參考資料（非即時）');return;}
    const [r1,r2]=await Promise.all([
      fetch(`${BASE}/daily_prices?date=eq.${today}&select=symbol,open_price,close_price&limit=2000`,{headers:SB_H}),
      fetch(`${BASE}/stocks?select=symbol,industry&limit=2000`,{headers:SB_H})
    ]);
    const prices=await r1.json();
    const stocks=await r2.json();
    if(!Array.isArray(prices)||!Array.isArray(stocks)){renderSectorBars(MOCK_SECTORS,'參考資料（非即時）');return;}
    const indMap={};stocks.forEach(s=>{if(s.industry)indMap[s.symbol]=s.industry;});
    const sectorMap={};
    prices.forEach(d=>{
      const ind=indMap[d.symbol];
      if(!ind)return;
      const open=parseFloat(d.open_price),close=parseFloat(d.close_price);
      if(!open||!close||isNaN(open)||isNaN(close))return;
      const pct=(close-open)/open*100;
      if(!sectorMap[ind])sectorMap[ind]={total:0,count:0};
      sectorMap[ind].total+=pct;sectorMap[ind].count++;
    });
    const sectors=Object.entries(sectorMap).map(([name,v])=>({name,pct:v.total/v.count}));
    if(!sectors.length){renderSectorBars(MOCK_SECTORS,'參考資料（非即時）');return;}
    renderSectorBars(sectors,'台股 紅=漲 綠=跌');
  }catch(e){
    try{renderSectorBars(MOCK_SECTORS,'參考資料（非即時）');}catch(e2){el.innerHTML='<div style="color:#64748b;font-size:12px">暫無資料</div>';}
  }
}

async function loadGlobalIndices(){
  const indices=[
    {sym:'^DJI', fsym:'DIA', multiplier:100, name:'道瓊 DJI',   key:'DJI'},
    {sym:'^IXIC',fsym:'QQQ', multiplier:null, name:'納斯達克 IXIC',key:'IXIC'},
    {sym:'^GSPC',fsym:'SPY', multiplier:10,  name:'S&P500 GSPC', key:'GSPC'},
    {sym:'^N225',fsym:'EWJ', multiplier:null, name:'日經 N225',   key:'N225'}
  ];
  await Promise.all(indices.map(async idx=>{
    const priceEl=document.getElementById('idx_'+idx.key);
    const pctEl=document.getElementById('idx_'+idx.key+'_pct');
    if(!priceEl)return;
    try{
      // 直接呼叫 Finnhub 取得 ETF 報價，用漲跌幅顯示（ETF proxy 價格不等於指數點數）
      const r=await fetch(`https://finnhub.io/api/v1/quote?symbol=${idx.fsym}&token=${FINNHUB_KEY}`);
      const d=await r.json();
      if(!d||!d.c||d.c===0)throw new Error('no data');
      const price=d.c;
      const prev=d.pc||price;
      const chg=price-prev;
      const pct=(prev>0?chg/prev*100:0).toFixed(2);
      const color=chg>=0?'#34d399':'#f87171';
      // 顯示 ETF 即時價格作為指數代理值
      priceEl.textContent=price.toLocaleString('en-US',{maximumFractionDigits:2});
      priceEl.style.color=color;
      if(pctEl){pctEl.textContent=(chg>=0?'+':'')+pct+'%';pctEl.style.color=color;}
    }catch(e){
      // fallback: 嘗試 yfQuote
      try{
        const d=await yfQuote(idx.sym,'1d','1d');
        if(!d||!d.currentPrice||d.error)throw new Error('no data');
        const price=d.currentPrice;
        const prev=d.prevClose||price;
        const chg=price-prev;
        const pct=(prev>0?chg/prev*100:0).toFixed(2);
        const color=chg>=0?'#34d399':'#f87171';
        priceEl.textContent=price.toLocaleString('en-US',{maximumFractionDigits:2});
        priceEl.style.color=color;
        if(pctEl){pctEl.textContent=(chg>=0?'+':'')+pct+'%';pctEl.style.color=color;}
      }catch(e2){if(priceEl)priceEl.textContent='—';}
    }
  }));
}


// ===== 台股頁面國際指數卡片（intlGrid）=====
async function loadIntlGrid(){
  const map = {
    'intl-DJI':  {sym:'^DJI',  name:'道瓊'},
    'intl-IXIC': {sym:'^IXIC', name:'那斯達克'},
    'intl-SPX':  {sym:'^GSPC', name:'S&P500'},
    'intl-N225': {sym:'^N225', name:'日經'},
    };
  await Promise.all(Object.entries(map).map(async ([id, cfg])=>{
    const el = document.getElementById(id);
    if(!el) return;
    try{
      const d = await yfQuote(cfg.sym,'1d','1d');
      if(!d||!d.currentPrice||d.error) throw new Error('no data');
      const price = d.currentPrice;
      const prev = d.prevClose || price;
      const chg = price - prev;
      const pct = (prev>0 ? chg/prev*100 : 0).toFixed(2);
      const color = chg>=0 ? '#34d399' : '#f87171';
      el.innerHTML = `
        <div style="font-size:11px;color:#64748b;margin-bottom:4px">${cfg.name}</div>
        <div style="font-size:15px;font-weight:700;color:${color}">${price.toLocaleString('en-US',{maximumFractionDigits:2})}</div>
        <div style="font-size:11px;color:${color}">${chg>=0?'+':''}${pct}%</div>`;
    }catch(e){
      el.innerHTML = `<div style="font-size:11px;color:#64748b">${cfg.name}</div><div style="color:#475569;font-size:13px">—</div>`;
    }
  }));
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
  if(!currentUser)return;
  let code=document.getElementById('stockInput').value.trim();
  if(!code)return;
  // 支援中文名稱搜尋：在 NAMES 裡找對應代號
  if(!/^\d/.test(code)){
    const found = Object.entries(NAMES).find(([k,v])=>v===code||v.includes(code)||k===code);
    if(found) code=found[0];
  }
  document.getElementById('stockInput').value=code;
  currentStock=code;
  trackEvent('search_stock',{stock_code:code});
  try{
    const r=await fetch(BASE+'/daily_prices?symbol=eq.'+code+'&order=date.desc&limit=2',{headers:SB_H});
    const data=await r.json();
    const res=document.getElementById('stockResult');
    res.style.display='block';
    if(data&&data.length>0){
      const d=data[0];
      const prev=data[1];
      const stockDisplayName=NAMES[code]||code;
      document.getElementById('stockName').textContent=stockDisplayName+' ('+code+')';
      document.getElementById('stockMeta').textContent='最新交易日：'+d.date;
      saveSearchHistory(code, stockDisplayName);
      document.getElementById('sClose').textContent=d.close_price;
      // 漲跌幅：用前一日收盤計算
      const prevClose=prev?parseFloat(prev.close_price):parseFloat(d.close_price);
      const ch=parseFloat(d.close_price)-prevClose;
      const pct=prevClose>0?(ch/prevClose*100).toFixed(2):'0.00';
      const cel=document.getElementById('sChange');
      cel.textContent=(ch>=0?'+':'')+pct+'%';
      cel.className='val '+(ch>=0?'up':'down');
      document.getElementById('sVol').textContent=parseInt(d.volume).toLocaleString();
      document.getElementById('sOpen').textContent=d.open_price;
      document.getElementById('sHigh').textContent=d.high_price;
      document.getElementById('sLow').textContent=d.low_price;
      document.getElementById('stockChartContainer').style.display='block';setTimeout(()=>document.getElementById('stockChartContainer').scrollIntoView({behavior:'smooth',block:'start'}),50);
      document.getElementById('stockChartTitle').textContent=(NAMES[code]||code)+' K線圖';
      // 載入財報數據
      loadFundamentals(code);
      loadStockChart(code,30,document.querySelector('#stockChartContainer .range-btn'));
      setTimeout(initDrawingTool, 800);
      loadIntradayChart(code);
      loadRealtimeQuote(code);
      loadMonthlyRevenue(code);
      loadStockNews(code);
      loadAISummary(code);
      loadStockAnalysis(code);
      loadTechnicalIndicators(code);
      setTimeout(() => loadStockChips(code), 500); setTimeout(() => loadFullCandleChart(code), 900);;
      setTimeout(() => loadStockRevenueChart(code), 700);
      setTimeout(() => loadMACDIndicator(code), 1200);
      checkDisposeStatus(code);
      loadStockDividend(code);
      loadChipAnalysis(code);
      loadMarginData(code);
      // 更新自選股按鈕（需登入）
      const ws=(watchlistCache||[]).map(w=>normalizeWlSymbol(w.symbol));
      const wBtn=document.getElementById('watchlistBtn');
      if(wBtn){
        wBtn.textContent=ws.includes(code)?'✓ 已加入自選':'＋ 加入自選';
        wBtn.style.background=ws.includes(code)?'#166534':'#1d4ed8';
        wBtn.onclick=function(){toggleWatchlist(code, stockDisplayName, 'tw');};
      }
    }else{
      document.getElementById('stockName').textContent=code;
      document.getElementById('stockMeta').textContent='尚無數據';
      ['sClose','sChange','sVol','sOpen','sHigh','sLow'].forEach(id=>document.getElementById(id).textContent='—');
      document.getElementById('stockChartContainer').style.display='none';
    }
  }catch(e){alert('查詢失敗');}
}


// ===== 五檔委買委賣 + 分時走勢 =====
async function loadRealtimeQuote(code){
  const el = document.getElementById('realtimeQuote');
  if(!el) return;
  el.innerHTML = '<div style="color:#64748b;font-size:12px;padding:8px">載入中...</div>';
  try{
    const data = await twseProxy('realtime', code);
    if(!data?.msgArray?.length){ el.innerHTML='<div style="color:#64748b;font-size:12px;padding:8px">休市中或無即時資料</div>'; return; }
    const s = data.msgArray[0];
    // 五檔委買委賣
    const bids = (s.b||'').split('_').filter(Boolean).slice(0,5);
    const asks = (s.a||'').split('_').filter(Boolean).slice(0,5);
    const bidVols = (s.g||'').split('_').filter(Boolean).slice(0,5);
    const askVols = (s.f||'').split('_').filter(Boolean).slice(0,5);
    const price = parseFloat(s.z||s.y||0);
    const prev = parseFloat(s.y) || parseFloat(s.b?.split('_')[0]) || 0;
    const maxVol = Math.max(...bidVols.map(Number), ...askVols.map(Number), 1);
    let html = `<div style="font-size:11px;color:#64748b;margin-bottom:6px">即時報價 · ${s.t||''}</div>`;
    html += `<table style="width:100%;border-collapse:collapse;font-size:12px">`;
    html += `<tr style="color:#64748b;font-size:10px"><td style="text-align:right;padding:1px 4px">委買量</td><td style="text-align:center">委買價</td><td></td><td style="text-align:center">委賣價</td><td style="text-align:left;padding:1px 4px">委賣量</td></tr>`;
    for(let i=4;i>=0;i--){
      const bp=bids[i]||'—', bv=bidVols[i]||'—';
      const ap=asks[i]||'—', av=askVols[i]||'—';
      const bPct=bv!=='—'?Math.round(Number(bv)/maxVol*100):0;
      const aPct=av!=='—'?Math.round(Number(av)/maxVol*100):0;
      html+=`<tr>
        <td style="text-align:right;padding:2px 4px;color:#34d399;position:relative">
          <div style="position:absolute;right:0;top:0;bottom:0;width:${bPct}%;background:rgba(52,211,153,0.15);z-index:0"></div>
          <span style="position:relative;z-index:1">${bv}</span>
        </td>
        <td style="text-align:center;color:#34d399;font-weight:600;padding:2px 6px">${bp}</td>
        <td style="width:8px"></td>
        <td style="text-align:center;color:#f87171;font-weight:600;padding:2px 6px">${ap}</td>
        <td style="text-align:left;padding:2px 4px;color:#f87171;position:relative">
          <div style="position:absolute;left:0;top:0;bottom:0;width:${aPct}%;background:rgba(248,113,113,0.15);z-index:0"></div>
          <span style="position:relative;z-index:1">${av}</span>
        </td>
      </tr>`;
    }
    html += `</table>`;
    html += `<div style="display:flex;justify-content:space-between;margin-top:8px;font-size:11px;color:#64748b;border-top:1px solid #1e293b;padding-top:6px">
      <span>成交: <span style="color:#e2e8f0;font-weight:600">${s.z||'—'}</span></span>
      <span>總量: <span style="color:#e2e8f0">${s.v||'—'}</span>張</span>
      <span>昨收: <span style="color:#94a3b8">${s.y||'—'}</span></span>
    </div>`;
    el.innerHTML = html;
  }catch(e){
    el.innerHTML='<div style="color:#64748b;font-size:12px;padding:8px">無法取得即時資料（CORS）</div>';
  }
}

async function loadIntradayChart(code){
  const el = document.getElementById('intradayChartWrap');
  if(!el) return;
  el.innerHTML='<div style="color:#64748b;font-size:12px;padding:8px;text-align:center">載入分時走勢中...</div>';
  try{
    const data = await twseProxy('realtime', code);
    if(!data?.msgArray?.length){ el.innerHTML='<div style="color:#64748b;font-size:12px;padding:8px">休市中或無分時資料</div>'; return; }
    const s = data.msgArray[0];
    // 分時價格
    const prices = (s.pz||'').split('_').filter(Boolean).map(Number);
    const times = (s.pt||'').split('_').filter(Boolean);
    const prev = parseFloat(s.y) || parseFloat(s.b?.split('_')[0]) || (prices.length ? prices[0] : 0);
    if(!prices.length){
      // 盤後或休市：用收盤價顯示靜態資訊
      const lastClose = parseFloat(s.z||s.y||0);
      const prevClose = parseFloat(s.y||0);
      const ch = lastClose && prevClose ? ((lastClose-prevClose)/prevClose*100) : 0;
      const color = ch >= 0 ? '#34d399' : '#f87171';
      el.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:#0f172a;border-radius:8px">
        <div><div style="font-size:11px;color:#475569;margin-bottom:2px">收盤價</div><div style="font-size:18px;font-weight:700;color:#e2e8f0">${lastClose||prev||'-'}</div></div>
        <div style="text-align:right"><div style="font-size:11px;color:#475569;margin-bottom:2px">漲跌幅</div><div style="font-size:16px;font-weight:700;color:${color}">${ch>=0?'+':''}${prevClose>0?ch.toFixed(2):'0.00'}%</div></div>
        <div style="font-size:11px;color:#475569">盤後・分時資料僅盤中提供</div>
      </div>`;
      return;
    }
    // 畫 SVG 分時圖
    const W=el.clientWidth||400, H=100;
    const min=Math.min(prev*0.98,...prices), max=Math.max(prev*1.02,...prices);
    const range=max-min||1;
    const pts=prices.map((p,i)=>`${(i/(prices.length-1||1))*W},${H-((p-min)/range)*(H-8)-4}`).join(' ');
    const safePrev=(!isNaN(prev)&&prev>0)?prev:min; const prevY=H-((safePrev-min)/range)*(H-8)-4;
    const lastP=prices.filter(p=>!isNaN(p)&&p>0).pop()||safePrev;
    const color=lastP>=prev?'#34d399':'#f87171';
    el.innerHTML=`<svg width="${W}" height="${H}" style="display:block">
      <defs><linearGradient id="ig" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${color}" stop-opacity="0.3"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
      <line x1="0" y1="${prevY}" x2="${W}" y2="${prevY}" stroke="#475569" stroke-width="1" stroke-dasharray="4"/>
      <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.5"/>
      <text x="4" y="12" fill="#64748b" font-size="10">${times[0]||'09:00'}</text>
      <text x="${W-32}" y="12" fill="#64748b" font-size="10">${times[times.length-1]||'13:30'}</text>
      <text x="${W-50}" y="${H-4}" fill="${color}" font-size="11" font-weight="bold">${isNaN(lastP)?'':lastP.toFixed(2)}</text>
    </svg>
    <div style="display:flex;justify-content:space-between;font-size:10px;color:#475569;margin-top:2px">
      <span>昨收 ${prev}</span><span style="color:${color}">${lastP>=safePrev?'▲':'▼'} ${safePrev>0?Math.abs(((lastP-safePrev)/safePrev)*100).toFixed(2):'0.00'}%</span>
    </div>`;
  }catch(e){
    el.innerHTML='<div style="color:#64748b;font-size:12px;padding:8px">無法取得分時資料（CORS）</div>';
  }
}

async function loadSouvenir(code){
  const el = document.getElementById('souvenirWrap');
  if(!el) return;
  el.innerHTML = `
    <div style="background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 100%);border-radius:12px;padding:20px;border:1px solid #312e81;text-align:center;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:radial-gradient(ellipse at top,rgba(99,102,241,0.15) 0%,transparent 70%);pointer-events:none"></div>
      <div style="font-size:28px;margin-bottom:8px">🎁</div>
      <div style="font-size:15px;font-weight:700;color:#e2e8f0;margin-bottom:4px">股東會紀念品</div>
      <div style="display:inline-flex;align-items:center;gap:6px;background:#312e81;border:1px solid #4f46e5;border-radius:20px;padding:4px 14px;margin:8px 0">
        <span style="width:6px;height:6px;background:#818cf8;border-radius:50%;animation:pulse 1.5s infinite"></span>
        <span style="font-size:12px;color:#818cf8;font-weight:600;letter-spacing:1px">COMING SOON</span>
      </div>
      <div style="font-size:12px;color:#64748b;margin-top:8px;line-height:1.6">包含紀念品圖片、領取日期<br>代領方式與最後買進日</div>
      <div style="margin-top:12px">
        <a href="https://www.gooddie.tw/stock/meeting?Keyword=${code}" target="_blank"
           style="display:inline-flex;align-items:center;gap:4px;padding:6px 14px;background:#1e293b;border:1px solid #334155;border-radius:8px;color:#94a3b8;font-size:11px;text-decoration:none">
          暫時到股代網查詢 →
        </a>
      </div>
    </div>
    <style>@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}</style>`;
}


// ===== 分K切換 =====
let currentChartMode = 'day';

function switchChartMode(mode, period, btn){
  currentChartMode = mode;
  // 更新所有按鈕狀態
  document.querySelectorAll('#dayKBtns .range-btn, #minKBtns .range-btn').forEach(b=>{
    b.classList.remove('active');
  });
  if(btn) btn.classList.add('active');

  if(mode === 'day'){
    loadStockChart(currentStock, period, null);
  } else if(mode === 'week'){
    loadWeekMonthChart(currentStock, period, 'week');
  } else if(mode === 'month'){
    loadWeekMonthChart(currentStock, period, 'month');
  } else {
    loadMinuteChart(currentStock, period);
  }
}

// 週K/月K：從日K資料聚合
async function loadWeekMonthChart(code, days, mode){
  if(!code) return;
  const el = document.getElementById('stockChartWrap');
  if(!el) return;
  const label = mode==='week'?'週K':'月K';
  el.innerHTML = '<div style="color:#64748b;padding:20px;text-align:center">載入'+label+'中...</div>';

  const since = new Date();
  since.setDate(since.getDate() - days);
  const s = since.toISOString().split('T')[0];
  try{
    const r = await fetch(BASE+'/daily_prices?symbol=eq.'+code+'&date=gte.'+s+'&order=date.asc&limit=2000',{headers:SB_H});
    const data = await r.json();
    if(!data||!data.length){ el.innerHTML='<div style="color:#64748b;padding:20px">無資料</div>'; return; }

    // 聚合函數：把日K聚合成週K或月K
    const aggregated = [];
    let bucket = null;
    for(const d of data){
      const date = new Date(d.date);
      // 決定 bucket key：週K用 ISO week，月K用 年-月
      let key;
      if(mode==='week'){
        // 取當週週一的日期作為 key
        const day = date.getDay();
        const monday = new Date(date);
        monday.setDate(date.getDate() - (day===0?6:day-1));
        key = monday.toISOString().split('T')[0];
      } else {
        key = d.date.substring(0,7); // YYYY-MM
      }

      if(!bucket || bucket.time !== key){
        if(bucket) aggregated.push(bucket);
        bucket = {
          time: key,
          open: parseFloat(d.open_price),
          high: parseFloat(d.high_price),
          low: parseFloat(d.low_price),
          close: parseFloat(d.close_price),
          volume: parseInt(d.volume||0),
        };
      } else {
        bucket.high = Math.max(bucket.high, parseFloat(d.high_price));
        bucket.low  = Math.min(bucket.low,  parseFloat(d.low_price));
        bucket.close = parseFloat(d.close_price);
        bucket.volume += parseInt(d.volume||0);
      }
    }
    if(bucket) aggregated.push(bucket);

    // 轉換成 renderStockChart 需要的格式（用 date 欄位）
    const fmtData = aggregated.map(d=>({
      date: d.time,
      open_price: d.open,
      high_price: d.high,
      low_price: d.low,
      close_price: d.close,
      volume: d.volume,
    }));

    lastKData = fmtData;
    renderStockChart(fmtData, code);
  }catch(e){
    el.innerHTML='<div style="color:#f87171;padding:20px">'+label+'載入失敗</div>';
  }
}

async function loadMinuteChart(code, interval){
  if(!code) return;
  const el = document.getElementById('stockChartWrap');
  if(!el) return;
  el.innerHTML = '<div style="color:#64748b;padding:20px;text-align:center">載入分K中...</div>';

  try{
    // 用 Yahoo Finance API 抓分K（台股代號格式：2330.TW）
    const suffix = code.length <= 4 ? '.TW' : '.TWO';
    const sym = code + suffix;
    const intervalMap = {1:'1m', 5:'5m', 15:'15m', 30:'30m', 60:'60m'};
    const yInterval = intervalMap[interval] || '5m';
    const rangeMap = {1:'1d', 5:'5d', 15:'5d', 30:'1mo', 60:'1mo'};
    const yRange = rangeMap[interval] || '5d';

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=${yInterval}&range=${yRange}&includePrePost=false`;
    const r = await fetch(url);
    if(!r.ok) throw new Error('API error');
    const data = await r.json();

    const result = data?.chart?.result?.[0];
    if(!result?.timestamp?.length){
      el.innerHTML = '<div style="color:#64748b;padding:20px;text-align:center">無分K資料（非交易時間或代號錯誤）</div>';
      return;
    }

    const timestamps = result.timestamp;
    const quotes = result.indicators.quote[0];
    const opens = quotes.open;
    const highs = quotes.high;
    const lows = quotes.low;
    const closes = quotes.close;
    const volumes = quotes.volume;

    // 組合 K 線資料
    const kData = timestamps.map((t,i) => {
      if(!closes[i]) return null;
      return {
        time: t,
        open: parseFloat((opens[i]||closes[i]).toFixed(2)),
        high: parseFloat((highs[i]||closes[i]).toFixed(2)),
        low: parseFloat((lows[i]||closes[i]).toFixed(2)),
        close: parseFloat(closes[i].toFixed(2))
      };
    }).filter(Boolean);

    const volData = timestamps.map((t,i) => {
      if(!volumes[i] || !closes[i]) return null;
      const prev = closes[i-1]||closes[i];
      return {time: t, value: volumes[i], color: closes[i]>=prev ? 'rgba(52,211,153,0.5)' : 'rgba(248,113,113,0.5)'};
    }).filter(Boolean);

    if(!kData.length){
      el.innerHTML = '<div style="color:#64748b;padding:20px;text-align:center">無有效分K資料</div>';
      return;
    }

    el.innerHTML = '';
    el.style.cssText = 'width:100%;overflow:hidden;background:#0f172a;border-radius:8px';

    const W = el.clientWidth || 800;

    // 主圖
    const mainDiv = document.createElement('div');
    mainDiv.style.cssText = 'width:100%;height:280px';
    el.appendChild(mainDiv);

    if(stockChart){try{stockChart.remove();}catch(e){}}
    stockChart = LightweightCharts.createChart(mainDiv, {
      width:W, height:280,
      layout:{background:{color:'#0f172a'},textColor:'#94a3b8'},
      grid:{vertLines:{color:'#1e293b'},horzLines:{color:'#1e293b'}},
      rightPriceScale:{borderColor:'#334155'},
      timeScale:{borderColor:'#334155',timeVisible:true,secondsVisible:false},
      crosshair:{mode:1}
    });

    const cs = stockChart.addCandlestickSeries({
      upColor:'#34d399',downColor:'#f87171',
      borderUpColor:'#34d399',borderDownColor:'#f87171',
      wickUpColor:'#34d399',wickDownColor:'#f87171'
    });
    cs.setData(kData);

    // MA5 MA20
    const maColors = {'5':'#fbbf24','20':'#a78bfa'};
    [5,20].forEach(n=>{
      if(kData.length <= n) return;
      const ma = stockChart.addLineSeries({color:maColors[n],lineWidth:1,priceLineVisible:false,lastValueVisible:true,crosshairMarkerVisible:false,title:'MA'+n});
      const maData = kData.map((d,i,arr)=>{
        if(i<n-1) return null;
        const avg = arr.slice(i-n+1,i+1).reduce((s,v)=>s+v.close,0)/n;
        return {time:d.time, value:parseFloat(avg.toFixed(2))};
      }).filter(Boolean);
      ma.setData(maData);
    });

    stockChart.timeScale().fitContent();
    setTimeout(initDrawingTool, 300);

    // 成交量
    const volDiv = document.createElement('div');
    volDiv.style.cssText = 'width:100%;height:70px;margin-top:2px';
    el.appendChild(volDiv);

    const volChart = LightweightCharts.createChart(volDiv, {
      width:W, height:70,
      layout:{background:{color:'#0f172a'},textColor:'#94a3b8'},
      grid:{vertLines:{color:'#1e293b'},horzLines:{color:'#1e293b'}},
      rightPriceScale:{borderColor:'#334155'},
      timeScale:{borderColor:'#334155',visible:false},
    });
    const volSeries = volChart.addHistogramSeries({priceScaleId:'right',scaleMargins:{top:0.1,bottom:0}});
    volSeries.setData(volData);
    volChart.timeScale().fitContent();

    // 同步捲動
    stockChart.timeScale().subscribeVisibleLogicalRangeChange(range=>{if(range)volChart.timeScale().setVisibleLogicalRange(range);});
    volChart.timeScale().subscribeVisibleLogicalRangeChange(range=>{if(range)stockChart.timeScale().setVisibleLogicalRange(range);});

    // 標題更新
    const titleEl = document.getElementById('stockChartTitle');
    if(titleEl) titleEl.textContent = (NAMES[code]||code) + ` ${interval}分K`;

  }catch(e){
    el.innerHTML = `<div style="color:#64748b;padding:20px;text-align:center">分K載入失敗（${e.message}）<br><span style="font-size:11px">Yahoo Finance API 有 CORS 限制，交易時間外可能無法取得</span></div>`;
  }
}


// ===== 處置股/注意股警示 =====
async function checkDisposeStatus(code){
  const el = document.getElementById('disposeWrap');
  if(!el) return;
  try{
    const [disposeData, attentionData] = await Promise.all([
      twseProxy('dispose', code),
      twseProxy('attention', code)
    ]);
    const isDispose = Array.isArray(disposeData) && disposeData.length > 0;
    const isAttention = Array.isArray(attentionData) && attentionData.length > 0;

    if(!isDispose && !isAttention){
      el.innerHTML = '<div style="display:inline-flex;align-items:center;gap:6px;background:#052e16;border:1px solid #166534;border-radius:20px;padding:4px 12px"><span style="font-size:11px;color:#34d399">✅ 正常交易</span></div>';
      return;
    }
    let html = '<div style="display:flex;gap:8px;flex-wrap:wrap">';
    if(isDispose){
      const d = disposeData[0];
      html += `<div style="display:inline-flex;align-items:center;gap:6px;background:#450a0a;border:1px solid #ef4444;border-radius:20px;padding:5px 14px">
        <span style="font-size:13px">⚠️</span>
        <span style="font-size:12px;color:#f87171;font-weight:700">處置股</span>
        <span style="font-size:11px;color:#94a3b8">${d['處置期間']||d['period']||''}</span>
      </div>`;
    }
    if(isAttention){
      const d = attentionData[0];
      html += `<div style="display:inline-flex;align-items:center;gap=6px;background:#431407;border:1px solid #f97316;border-radius:20px;padding:5px 14px">
        <span style="font-size:13px">🔔</span>
        <span style="font-size:12px;color:#fb923c;font-weight:700">注意股</span>
        <span style="font-size:11px;color:#94a3b8">${d['注意原因']||d['reason']||''}</span>
      </div>`;
    }
    html += '</div>';
    el.innerHTML = html;
  }catch(e){
    el.innerHTML = '';
  }
}


// ===== 台股個股配息歷史 =====
async function loadStockDividend(code){
  const el = document.getElementById('stockDividendWrap');
  if(!el) return;
  el.innerHTML = '<div style="color:#64748b;font-size:12px;padding:8px">載入配息資料中...</div>';
  try{
    // 從 bwibbu 拿到殖利率/本益比
    const bwi = await twseProxy('bwibbu', code);
    // 從 Supabase etf_dividends 試看看（台股通常沒有）
    const r = await fetch(BASE+'/etf_dividends?symbol=eq.'+code+'&order=ex_dividend_date.desc&limit=10',{headers:SB_H});
    const divs = await r.json();

    let html = '<div style="margin:8px 0">';

    // 即時殖利率卡片
    if(bwi){
      html += `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <div style="background:#0f172a;border-radius:8px;padding:10px 14px;text-align:center;min-width:80px;border:1px solid #1e293b">
          <div style="font-size:10px;color:#64748b;margin-bottom:3px">殖利率</div>
          <div style="font-size:17px;font-weight:700;color:#34d399">${bwi['DividendYield']?parseFloat(bwi['DividendYield']).toFixed(2)+'%':'—'}</div>
        </div>
        <div style="background:#0f172a;border-radius:8px;padding:10px 14px;text-align:center;min-width:80px;border:1px solid #1e293b">
          <div style="font-size:10px;color:#64748b;margin-bottom:3px">本益比</div>
          <div style="font-size:17px;font-weight:700;color:#e2e8f0">${bwi['PEratio']?parseFloat(bwi['PEratio']).toFixed(1)+'x':'—'}</div>
        </div>
        <div style="background:#0f172a;border-radius:8px;padding:10px 14px;text-align:center;min-width:80px;border:1px solid #1e293b">
          <div style="font-size:10px;color:#64748b;margin-bottom:3px">股價淨值比</div>
          <div style="font-size:17px;font-weight:700;color:#60a5fa">${bwi['PBratio']?parseFloat(bwi['PBratio']).toFixed(2)+'x':'—'}</div>
        </div>
      </div>`;
    }

    // 配息記錄
    if(divs && divs.length > 0){
      html += '<div style="font-size:12px;color:#93c5fd;font-weight:700;margin-bottom:6px;border-left:3px solid #2563eb;padding-left:8px">📅 配息記錄</div>';
      html += '<div style="display:flex;flex-direction:column;gap:4px">';
      divs.forEach(d=>{
        const amt = d.dividend_amount!=null ? '$'+parseFloat(d.dividend_amount).toFixed(3) : '待公告';
        const color = d.dividend_amount!=null ? '#34d399' : '#94a3b8';
        html += `<div style="display:flex;justify-content:space-between;align-items:center;background:#0f172a;border-radius:6px;padding:8px 12px;border:1px solid #1e293b">
          <div>
            <div style="font-size:12px;color:#94a3b8">除息日 ${d.ex_dividend_date||'—'}</div>
            <div style="font-size:11px;color:#64748b">發放日 ${d.payment_date||'—'}</div>
          </div>
          <div style="font-size:15px;font-weight:700;color:${color}">${amt}</div>
        </div>`;
      });
      html += '</div>';
    } else {
      html += `<div style="text-align:center;padding:12px;color:#475569;font-size:12px">
        配息歷史資料建置中
        <br><a href="https://goodinfo.tw/tw/StockDividendPolicy.asp?STOCK_ID=${code}" target="_blank" 
           style="color:#60a5fa;font-size:11px;margin-top:6px;display:inline-block">查看 Goodinfo 配息歷史 →</a>
      </div>`;
    }

    html += '</div>';
    el.innerHTML = html;
    el.style.display = 'block';
  }catch(e){
    el.innerHTML = '<div style="color:#64748b;font-size:12px;padding:8px">配息資料載入失敗</div>';
  }
}


// ===== 籌碼分析：三大法人個股進出 =====
async function loadChipAnalysis(code){
  const el = document.getElementById('chipWrap');
  if(!el) return;
  el.innerHTML = '<div style="color:#64748b;font-size:12px;padding:8px">載入籌碼資料中...</div>';
  try{
    // 從 Supabase 抓最新10天的三大法人個股資料
    const r = await fetch(BASE+'/institutional_investors?symbol=eq.'+code+'&order=date.desc&limit=10',{headers:SB_H});
    const data = await r.json();

    if(!data||!data.length){
      el.innerHTML = '<div style="color:#64748b;font-size:12px;padding:8px">暫無籌碼資料</div>';
      return;
    }

    const latest = data[0];
    const foreign = parseInt(latest.foreign_buy||0);
    const trust = parseInt(latest.investment_trust_buy||0);
    const dealer = parseInt(latest.dealer_buy||0);
    const total = parseInt(latest.total_buy||0);

    // 外資連買/連賣天數
    let foreignStreak = 0;
    for(const d of data){
      const f = parseInt(d.foreign_buy||0);
      if(foreignStreak===0){ foreignStreak = f>=0?1:-1; continue; }
      if((foreignStreak>0&&f>=0)||(foreignStreak<0&&f<0)){ foreignStreak += foreignStreak>0?1:-1; }
      else break;
    }

    const fColor = foreign>=0?'#34d399':'#f87171';
    const tColor = trust>=0?'#34d399':'#f87171';
    const dColor = dealer>=0?'#34d399':'#f87171';
    const totColor = total>=0?'#34d399':'#f87171';
    const streakColor = foreignStreak>0?'#34d399':'#f87171';
    const streakText = foreignStreak>0?`外資連買${Math.abs(foreignStreak)}天`:`外資連賣${Math.abs(foreignStreak)}天`;

    let html = `<div style="margin-bottom:8px">
      <div style="font-size:12px;color:#93c5fd;font-weight:700;margin-bottom:8px;border-left:3px solid #2563eb;padding-left:8px">
        📊 三大法人 · ${latest.date||''}
        <span style="margin-left:8px;font-size:11px;background:${foreignStreak>0?'#052e16':'#450a0a'};color:${streakColor};padding:2px 8px;border-radius:10px">${streakText}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">
        <div style="background:#0f172a;border-radius:8px;padding:10px;border:1px solid #1e293b">
          <div style="font-size:10px;color:#64748b;margin-bottom:3px">外資</div>
          <div style="font-size:16px;font-weight:700;color:${fColor}">${foreign>=0?'+':''}${foreign.toLocaleString()}<span style="font-size:10px;color:#64748b">張</span></div>
        </div>
        <div style="background:#0f172a;border-radius:8px;padding:10px;border:1px solid #1e293b">
          <div style="font-size:10px;color:#64748b;margin-bottom:3px">投信</div>
          <div style="font-size:16px;font-weight:700;color:${tColor}">${trust>=0?'+':''}${trust.toLocaleString()}<span style="font-size:10px;color:#64748b">張</span></div>
        </div>
        <div style="background:#0f172a;border-radius:8px;padding:10px;border:1px solid #1e293b">
          <div style="font-size:10px;color:#64748b;margin-bottom:3px">自營商</div>
          <div style="font-size:16px;font-weight:700;color:${dColor}">${dealer>=0?'+':''}${dealer.toLocaleString()}<span style="font-size:10px;color:#64748b">張</span></div>
        </div>
        <div style="background:#0f172a;border-radius:8px;padding:10px;border:1px solid ${totColor};border-width:1px">
          <div style="font-size:10px;color:#64748b;margin-bottom:3px">三大合計</div>
          <div style="font-size:16px;font-weight:700;color:${totColor}">${total>=0?'+':''}${total.toLocaleString()}<span style="font-size:10px;color:#64748b">張</span></div>
        </div>
      </div>`;

    // 三大法人各自 5 天趨勢 mini SVG（sparkline 折線 + bar 複合）
    const last5 = data.slice(0,5).reverse(); // 最近5天，從舊到新
    function miniSparkSVG(vals, dates){
      const W=96, H=44, PAD=4;
      const n=vals.length;
      if(!n) return '';
      const maxA=Math.max(...vals.map(v=>Math.abs(v)),1);
      const mid=H/2;
      const xStep=n>1?(W-PAD*2)/(n-1):0;
      const bw=Math.max(Math.floor(xStep)-3, 3);
      let rects='', circles='', polyPts=[];
      vals.forEach((v,i)=>{
        const cx=PAD+i*xStep;
        const bh=Math.max(Math.abs(v)/maxA*(mid-PAD),2);
        const c=v>=0?'#34d399':'#f87171';
        const ry=v>=0?mid-bh:mid;
        const title=`${dates&&dates[i]?dates[i]+': ':''}${v>=0?'+':''}${v.toLocaleString()}張`;
        rects+=`<rect x="${(cx-bw/2).toFixed(1)}" y="${ry.toFixed(1)}" width="${bw}" height="${bh.toFixed(1)}" fill="${c}" opacity="0.55" rx="1"><title>${title}</title></rect>`;
        const py=mid-(v/maxA*(mid-PAD));
        polyPts.push(`${cx.toFixed(1)},${py.toFixed(1)}`);
        circles+=`<circle cx="${cx.toFixed(1)}" cy="${py.toFixed(1)}" r="2.2" fill="${c}"><title>${title}</title></circle>`;
      });
      const polyLine=n>=2?`<polyline points="${polyPts.join(' ')}" fill="none" stroke="#60a5fa" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`:'';
      return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="overflow:visible">`+
        `<line x1="0" y1="${mid}" x2="${W}" y2="${mid}" stroke="#334155" stroke-width="0.5"/>`+
        rects+polyLine+circles+`</svg>`;
    }
    if(last5.length>=2){
      const dates=last5.map(d=>d.date||'');
      const fVals=last5.map(d=>parseInt(d.foreign_buy||0));
      const tVals=last5.map(d=>parseInt(d.investment_trust_buy||0));
      const dVals=last5.map(d=>parseInt(d.dealer_buy||0));
      const trendArrow=(arr)=>arr[arr.length-1]>=arr[0]?'↑':'↓';
      html += `<div style="font-size:11px;color:#64748b;margin-bottom:6px;margin-top:4px">近 ${last5.length} 天趨勢（懸停查看明細）</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
        <div style="background:#0f172a;border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:10px;color:#64748b;margin-bottom:3px">外資 <span style="color:${fVals[fVals.length-1]>=0?'#34d399':'#f87171'}">${trendArrow(fVals)}</span></div>
          ${miniSparkSVG(fVals,dates)}
        </div>
        <div style="background:#0f172a;border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:10px;color:#64748b;margin-bottom:3px">投信 <span style="color:${tVals[tVals.length-1]>=0?'#34d399':'#f87171'}">${trendArrow(tVals)}</span></div>
          ${miniSparkSVG(tVals,dates)}
        </div>
        <div style="background:#0f172a;border-radius:8px;padding:8px;text-align:center">
          <div style="font-size:10px;color:#64748b;margin-bottom:3px">自營 <span style="color:${dVals[dVals.length-1]>=0?'#34d399':'#f87171'}">${trendArrow(dVals)}</span></div>
          ${miniSparkSVG(dVals,dates)}
        </div>
      </div>`;
    }

    html += '</div>';
    el.innerHTML = html;
    el.style.display = 'block';
  }catch(e){
    el.innerHTML = '<div style="color:#64748b;font-size:12px;padding:8px">籌碼資料載入失敗</div>';
  }
}



// ===== 搜尋歷史（C2）=====
function saveSearchHistory(symbol, name){
  const hist=JSON.parse(localStorage.getItem('mr_search_history')||'[]');
  const filtered=hist.filter(h=>h.symbol!==symbol);
  filtered.unshift({symbol,name:name||NAMES[symbol]||symbol});
  localStorage.setItem('mr_search_history',JSON.stringify(filtered.slice(0,10)));
}

function showSearchHistory(dropdown){
  const hist=JSON.parse(localStorage.getItem('mr_search_history')||'[]');
  if(!hist.length){dropdown.style.display='none';return;}
  dropdown.innerHTML=`<div style="padding:6px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #334155">
    <span style="font-size:11px;color:#64748b;font-weight:600">最近搜尋</span>
    <span onclick="localStorage.removeItem('mr_search_history');this.closest('[id]').style.display='none';" style="font-size:11px;color:#475569;cursor:pointer;padding:2px 4px">清除</span>
  </div>`+
  hist.map(h=>`
    <div onclick="document.getElementById('stockInput').value='${h.symbol}';document.getElementById('searchDropdown').style.display='none';searchStock();"
      style="padding:10px 14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #0f172a;gap:8px"
      onmouseover="this.style.background='#2d3f55'" onmouseout="this.style.background='transparent'">
      <span style="color:#60a5fa;font-weight:700;font-size:13px;flex-shrink:0">${h.symbol}</span>
      <span style="color:#94a3b8;font-size:12px;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${h.name}</span>
    </div>`).join('');
  dropdown.style.display='block';
}

// ===== 搜尋自動完成 =====
function initSearchAutocomplete(){
  const input = document.getElementById('stockInput');
  if(!input) return;
  let dropdown = document.getElementById('searchDropdown');
  if(!dropdown){
    dropdown = document.createElement('div');
    dropdown.id = 'searchDropdown';
    dropdown.style.cssText = 'position:absolute;z-index:9999;background:#1e293b;border:1px solid #334155;border-radius:8px;width:100%;max-height:280px;overflow-y:auto;display:none;box-shadow:0 8px 24px rgba(0,0,0,0.4);top:100%;left:0;margin-top:4px';
    input.parentElement.style.position='relative';
    input.parentElement.appendChild(dropdown);
  }

  function renderDropdown(matches){
    if(!matches.length){dropdown.style.display='none';return;}
    dropdown.innerHTML = matches.map(([code,name])=>`
      <div onclick="document.getElementById('stockInput').value='${code}';document.getElementById('searchDropdown').style.display='none';searchStock();"
        style="padding:10px 14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #0f172a;gap:8px"
        onmouseover="this.style.background='#2d3f55'" onmouseout="this.style.background='transparent'">
        <span style="color:#60a5fa;font-weight:700;font-size:13px;flex-shrink:0">${code}</span>
        <span style="color:#94a3b8;font-size:12px;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name||''}</span>
      </div>`).join('');
    dropdown.style.display='block';
  }

  let _acTimer=null;
  input.addEventListener('input', function(){
    const q = this.value.trim();
    if(!q||q.length<1){showSearchHistory(dropdown);clearTimeout(_acTimer);return;}
    if(q.length<2){dropdown.style.display='none';clearTimeout(_acTimer);return;}
    // 先用本地 NAMES 即時顯示
    const qLow=q.toLowerCase();
    const localMatches = Object.entries(NAMES).filter(([code,name])=>
      code.startsWith(qLow)||name.toLowerCase().includes(qLow)
    ).slice(0,8);
    renderDropdown(localMatches);
    // 再 debounce 查 Supabase stocks table
    clearTimeout(_acTimer);
    _acTimer = setTimeout(async()=>{
      try{
        const enc=encodeURIComponent(q);
        const url=`${BASE}/stocks?or=(symbol.ilike.*${enc}*,name.ilike.*${enc}*)&select=symbol,name&limit=10`;
        const r=await fetch(url,{headers:SB_H});
        const data=await r.json();
        if(Array.isArray(data)&&data.length>0){
          const seen=new Set();
          const merged=[];
          data.forEach(d=>{if(!seen.has(d.symbol)){seen.add(d.symbol);merged.push([d.symbol,d.name||'']);}});
          renderDropdown(merged.slice(0,10));
        }
      }catch(e){}
    },250);
  });

  input.addEventListener('focus', function(){
    if(!this.value.trim()) showSearchHistory(dropdown);
  });

  document.addEventListener('click', function(e){
    if(!input.contains(e.target)&&!dropdown.contains(e.target)) dropdown.style.display='none';
  });

  // 按 Esc 關閉，Enter 觸發搜尋
  input.addEventListener('keydown', function(e){
    if(e.key==='Escape') dropdown.style.display='none';
    if(e.key==='Enter'){dropdown.style.display='none';searchStock();}
  });
}

// ===== ETF 搜尋自動完成 =====
function initETFAutocomplete(){
  const input = document.getElementById('etfInput');
  if(!input) return;
  let dropdown = document.getElementById('etfDropdown');
  if(!dropdown){
    dropdown = document.createElement('div');
    dropdown.id = 'etfDropdown';
    dropdown.style.cssText = 'position:absolute;z-index:9999;background:#1e293b;border:1px solid #334155;border-radius:8px;width:100%;max-height:280px;overflow-y:auto;display:none;box-shadow:0 8px 24px rgba(0,0,0,0.4);top:100%;left:0;margin-top:4px';
    input.parentElement.style.position='relative';
    input.parentElement.appendChild(dropdown);
  }
  function renderDropdown(matches){
    if(!matches.length){dropdown.style.display='none';return;}
    dropdown.innerHTML = matches.map(([code,name])=>`
      <div onclick="document.getElementById('etfInput').value='${code}';document.getElementById('etfDropdown').style.display='none';searchETF();"
        style="padding:10px 14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #0f172a;gap:8px"
        onmouseover="this.style.background='#2d3f55'" onmouseout="this.style.background='transparent'">
        <span style="color:#a78bfa;font-weight:700;font-size:13px;flex-shrink:0">${code}</span>
        <span style="color:#94a3b8;font-size:12px;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name||''}</span>
      </div>`).join('');
    dropdown.style.display='block';
  }
  let _etfAcTimer=null;
  input.addEventListener('input', function(){
    const q = this.value.trim();
    if(!q||q.length<1){dropdown.style.display='none';clearTimeout(_etfAcTimer);return;}
    const qLow=q.toLowerCase();
    const localMatches = Object.entries(NAMES).filter(([code,name])=>
      code.startsWith(qLow)||name.toLowerCase().includes(qLow)
    ).slice(0,8);
    renderDropdown(localMatches);
    clearTimeout(_etfAcTimer);
    _etfAcTimer = setTimeout(async()=>{
      try{
        const enc=encodeURIComponent(q);
        const url=`${BASE}/stocks?or=(symbol.ilike.*${enc}*,name.ilike.*${enc}*)&select=symbol,name&limit=10`;
        const r=await fetch(url,{headers:SB_H});
        const data=await r.json();
        if(Array.isArray(data)&&data.length>0){
          const seen=new Set();
          const merged=[];
          data.forEach(d=>{if(!seen.has(d.symbol)){seen.add(d.symbol);merged.push([d.symbol,d.name||'']);}});
          renderDropdown(merged.slice(0,10));
        }
      }catch(e){}
    },250);
  });
  document.addEventListener('click', function(e){
    if(!input.contains(e.target)&&!dropdown.contains(e.target)) dropdown.style.display='none';
  });
  input.addEventListener('keydown', function(e){
    if(e.key==='Escape') dropdown.style.display='none';
    if(e.key==='Enter'){dropdown.style.display='none';searchETF();}
  });
}

// ===== 美股搜尋自動完成 =====
const US_NAMES={'AAPL':'Apple','MSFT':'Microsoft','NVDA':'NVIDIA','GOOGL':'Alphabet','AMZN':'Amazon','META':'Meta','TSLA':'Tesla','AVGO':'Broadcom','JPM':'JPMorgan','V':'Visa','UNH':'UnitedHealth','XOM':'ExxonMobil','LLY':'Eli Lilly','JNJ':'Johnson & Johnson','MA':'Mastercard','PG':'Procter & Gamble','HD':'Home Depot','CVX':'Chevron','MRK':'Merck','ABBV':'AbbVie','COST':'Costco','AMD':'AMD','NFLX':'Netflix','CRM':'Salesforce','ORCL':'Oracle','QCOM':'Qualcomm','TXN':'Texas Instruments','INTC':'Intel','SOFI':'SoFi','PLTR':'Palantir','ARM':'Arm Holdings','MU':'Micron','ASML':'ASML','TSM':'TSMC ADR','BABA':'Alibaba','NIO':'NIO','PDD':'PDD Holdings','BIDU':'Baidu','JD':'JD.com','SPY':'S&P 500 ETF','QQQ':'Nasdaq ETF','DIA':'Dow Jones ETF','ARKK':'ARK Innovation ETF','GLD':'Gold ETF','TLT':'Treasury Bond ETF','VTI':'Vanguard Total Market','VOO':'Vanguard S&P 500','BRK.B':'Berkshire Hathaway','WMT':'Walmart','COIN':'Coinbase','MSTR':'MicroStrategy','HOOD':'Robinhood'};
function initUSAutocomplete(){
  const input = document.getElementById('usSearch');
  if(!input) return;
  const wrap = input.parentElement;
  wrap.style.position='relative';
  let dropdown = document.getElementById('usDropdown');
  if(!dropdown){
    dropdown = document.createElement('div');
    dropdown.id = 'usDropdown';
    dropdown.style.cssText = 'position:absolute;z-index:9999;background:#1e293b;border:1px solid #334155;border-radius:8px;width:calc(100% - 90px);max-height:280px;overflow-y:auto;display:none;box-shadow:0 8px 24px rgba(0,0,0,0.4);top:100%;left:0;margin-top:4px';
    wrap.appendChild(dropdown);
  }
  function renderDropdown(matches){
    if(!matches.length){dropdown.style.display='none';return;}
    dropdown.innerHTML = matches.map(([code,name])=>`
      <div onclick="document.getElementById('usSearch').value='${code}';document.getElementById('usDropdown').style.display='none';searchUS();"
        style="padding:10px 14px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #0f172a;gap:8px"
        onmouseover="this.style.background='#2d3f55'" onmouseout="this.style.background='transparent'">
        <span style="color:#34d399;font-weight:700;font-size:13px;flex-shrink:0">${code}</span>
        <span style="color:#94a3b8;font-size:12px;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${name||''}</span>
      </div>`).join('');
    dropdown.style.display='block';
  }
  input.addEventListener('input', function(){
    const q = this.value.trim().toUpperCase();
    if(!q||q.length<1){dropdown.style.display='none';return;}
    const matches = Object.entries(US_NAMES).filter(([code,name])=>
      code.startsWith(q)||name.toUpperCase().includes(q)
    ).slice(0,10);
    renderDropdown(matches);
  });
  document.addEventListener('click', function(e){
    if(!input.contains(e.target)&&!dropdown.contains(e.target)) dropdown.style.display='none';
  });
  input.addEventListener('keydown', function(e){
    if(e.key==='Escape') dropdown.style.display='none';
  });
}

// ===== 零股投資試算 =====
function loadOddLot(code){
  const el = document.getElementById('oddLotWrap');
  if(!el) return;
  el.style.display='block';

  // 從現有的收盤價取得
  const closeEl = document.getElementById('sClose');
  const nameEl = document.getElementById('sName');
  const price = parseFloat(closeEl?.textContent?.replace(/[^0-9.]/g,'') || 0);
  const name = nameEl?.textContent?.split('(')[0]?.trim() || code;

  if(!price || price <= 0) {
    el.innerHTML='<div style="color:#64748b;font-size:12px;padding:8px">等待價格載入...</div>';
    return;
  }

  // 零股計算邏輯
  const budgets = [1000, 3000, 5000, 10000, 30000, 50000];
  const tax = 0.003; // 證券交易稅
  const fee = 0.001425; // 手續費（最低1元）
  const minFee = 1;

  let html = `
  <div style="font-size:12px;color:#93c5fd;font-weight:700;margin-bottom:10px;border-left:3px solid #2563eb;padding-left:8px">
    🪙 零股投資試算 · ${name}
  </div>
  <div style="background:#0f172a;border-radius:8px;padding:10px;border:1px solid #1e293b;margin-bottom:10px">
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span style="font-size:11px;color:#64748b">現價</span>
      <span style="font-size:14px;font-weight:700;color:#e2e8f0">$${price.toLocaleString()}</span>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
      <span style="font-size:11px;color:#64748b">最少買1股</span>
      <span style="font-size:13px;color:#60a5fa">$${price.toLocaleString()}</span>
    </div>
    <div style="display:flex;justify-content:space-between">
      <span style="font-size:11px;color:#64748b">每張(1000股)</span>
      <span style="font-size:13px;color:#60a5fa">$${(price*1000).toLocaleString()}</span>
    </div>
  </div>
  <div style="font-size:11px;color:#64748b;margin-bottom:6px">💰 預算可買零股數</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">`;

  budgets.forEach(budget => {
    const shares = Math.floor(budget / price);
    const cost = shares * price;
    const feeAmt = Math.max(Math.round(cost * fee), minFee);
    const taxAmt = Math.round(cost * tax);
    const total = cost + feeAmt;
    if(shares <= 0) return;
    html += `
    <div style="background:#0f172a;border-radius:8px;padding:8px;border:1px solid #1e293b;text-align:center">
      <div style="font-size:10px;color:#64748b;margin-bottom:3px">預算 $${(budget/1000).toFixed(0)}K</div>
      <div style="font-size:16px;font-weight:700;color:#34d399">${shares}<span style="font-size:10px;color:#64748b"> 股</span></div>
      <div style="font-size:10px;color:#475569">費後 $${total.toLocaleString()}</div>
    </div>`;
  });

  html += `</div>
  <div style="margin-top:8px;padding:8px;background:#0f172a;border-radius:8px;border:1px solid #1e293b">
    <div style="font-size:10px;color:#475569;line-height:1.6">
      ⚠️ 零股交易時間：13:40-14:30（收盤後）<br>
      手續費最低$1，賣出含0.3%交易稅
    </div>
  </div>`;

  el.innerHTML = html;
}


// ===== K線畫線工具 =====
let drawingMode = null; // 'trendline' | 'hline' | 'rect' | null
let drawingLines = []; // 已畫的線
let drawingStart = null;
let drawingCanvas = null;
let drawingCtx = null;
let drawingColor = '#f59e0b';
let isDrawing = false;

function initDrawingTool(){
  const wrap = document.getElementById('stockChartWrap');
  if(!wrap || document.getElementById('drawingCanvas')) return;

  // 建立畫線工具列
  const toolbar = document.createElement('div');
  toolbar.id = 'drawingToolbar';
  toolbar.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 0;flex-wrap:wrap';
  toolbar.innerHTML = `
    <span style="font-size:11px;color:#64748b;margin-right:4px">畫線</span>
    <button id="dt-trend" onclick="setDrawMode('trendline')" title="趨勢線" style="background:#1e293b;border:1px solid #334155;color:#94a3b8;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px">📈 趨勢</button>
    <button id="dt-hline" onclick="setDrawMode('hline')" title="水平線" style="background:#1e293b;border:1px solid #334155;color:#94a3b8;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px">➖ 水平</button>
    <button id="dt-rect" onclick="setDrawMode('rect')" title="矩形" style="background:#1e293b;border:1px solid #334155;color:#94a3b8;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px">⬜ 矩形</button>
    <button onclick="clearDrawings()" title="清除" style="background:#450a0a;border:1px solid #7f1d1d;color:#f87171;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px">🗑️ 清除</button>
    <div style="display:flex;align-items:center;gap:4px;margin-left:4px">
      <span style="font-size:11px;color:#64748b">色</span>
      <input type="color" id="dt-color" value="#f59e0b" onchange="drawingColor=this.value;redrawAll()" style="width:24px;height:24px;border:none;border-radius:4px;cursor:pointer;padding:0;background:none">
    </div>
    <button onclick="setDrawMode(null)" style="background:#1e293b;border:1px solid #334155;color:#64748b;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px">✋ 取消</button>
  `;

  // canvas 疊在圖表上
  const canvas = document.createElement('canvas');
  canvas.id = 'drawingCanvas';
  canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:10';
  canvas.width = wrap.clientWidth;
  canvas.height = 340;

  // 事件監聽 div
  const overlay = document.createElement('div');
  overlay.id = 'drawingOverlay';
  overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:340px;z-index:11;display:none;cursor:crosshair';

  // 找 K線圖的實際容器
  // loadStockChart 建立 mainDiv 是直接放在 stockChartWrap 的 innerHTML 裡
  // 但 stockChartWrap 會被清空再重建，所以我們用 stockChartContainer 裡
  // 找 drawingToolbar 之後、stockChartWrap 之前的 div
  const parent = wrap.parentElement;
  // K線圖容器是在 toolbar 之後緊接的 div（沒有 id）
  const toolbar_el = parent.querySelector('#drawingToolbar');
  let mainDiv = null;
  if(toolbar_el) {
    let next = toolbar_el.nextElementSibling;
    while(next) {
      if(!next.id && next.tagName==='DIV' && next.offsetWidth > 100) { mainDiv = next; break; }
      next = next.nextElementSibling;
    }
  }
  if(!mainDiv) {
    // fallback: 找最大的無 id div
    mainDiv = [...parent.children].filter(el => !el.id && el.tagName==='DIV' && el.offsetWidth > 100)
                                   .sort((a,b) => b.offsetWidth - a.offsetWidth)[0] || wrap;
  }

  mainDiv.style.position = 'relative';
  canvas.width = mainDiv.offsetWidth || 800;
  canvas.height = 340;
  mainDiv.appendChild(canvas);
  mainDiv.appendChild(overlay);

  parent.insertBefore(toolbar, wrap);

  drawingCanvas = canvas;
  drawingCtx = canvas.getContext('2d');

  overlay.addEventListener('mousedown', onDrawStart);
  overlay.addEventListener('mousemove', onDrawMove);
  overlay.addEventListener('mouseup', onDrawEnd);
  overlay.addEventListener('mouseleave', onDrawEnd);
}

function setDrawMode(mode){
  drawingMode = mode;
  const overlay = document.getElementById('drawingOverlay');
  if(overlay) overlay.style.display = mode ? 'block' : 'none';
  // 更新按鈕樣式
  ['dt-trend','dt-hline','dt-rect'].forEach(id=>{
    const btn = document.getElementById(id);
    if(btn) btn.style.background = '#1e293b';
  });
  const modeMap = {trendline:'dt-trend',hline:'dt-hline',rect:'dt-rect'};
  if(mode && modeMap[mode]){
    const btn = document.getElementById(modeMap[mode]);
    if(btn) btn.style.background = '#1e3a5f';
  }
}

function onDrawStart(e){
  if(!drawingMode) return;
  const rect = e.currentTarget.getBoundingClientRect();
  drawingStart = {x: e.clientX - rect.left, y: e.clientY - rect.top};
  isDrawing = true;
}

function onDrawMove(e){
  if(!isDrawing || !drawingStart) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const cur = {x: e.clientX - rect.left, y: e.clientY - rect.top};
  redrawAll();
  // 畫預覽線
  drawShape(drawingStart, cur, drawingColor, 0.6);
}

function onDrawEnd(e){
  if(!isDrawing || !drawingStart) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const end = {x: e.clientX - rect.left, y: e.clientY - rect.top};
  const dist = Math.sqrt(Math.pow(end.x-drawingStart.x,2)+Math.pow(end.y-drawingStart.y,2));
  if(dist > 5){
    drawingLines.push({mode:drawingMode, start:{...drawingStart}, end, color:drawingColor});
    redrawAll();
  }
  isDrawing = false;
  drawingStart = null;
}

function drawShape(start, end, color, alpha=1){
  const ctx = drawingCtx;
  if(!ctx) return;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);

  if(drawingMode==='hline'){
    ctx.beginPath();
    ctx.setLineDash([6,3]);
    ctx.moveTo(0, start.y);
    ctx.lineTo(drawingCanvas.width, start.y);
    ctx.stroke();
    ctx.setLineDash([]);
  } else if(drawingMode==='trendline'){
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    // 箭頭
    const angle = Math.atan2(end.y-start.y, end.x-start.x);
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x-10*Math.cos(angle-0.4), end.y-10*Math.sin(angle-0.4));
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(end.x-10*Math.cos(angle+0.4), end.y-10*Math.sin(angle+0.4));
    ctx.stroke();
  } else if(drawingMode==='rect'){
    ctx.fillStyle = color+'22';
    ctx.fillRect(start.x, start.y, end.x-start.x, end.y-start.y);
    ctx.strokeRect(start.x, start.y, end.x-start.x, end.y-start.y);
  }
  ctx.globalAlpha = 1;
}

function redrawAll(){
  if(!drawingCtx || !drawingCanvas) return;
  drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
  const savedMode = drawingMode;
  drawingLines.forEach(line=>{
    drawingMode = line.mode;
    drawShape(line.start, line.end, line.color);
  });
  drawingMode = savedMode;
}

function clearDrawings(){
  drawingLines = [];
  if(drawingCtx && drawingCanvas) drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
}

// ===== 融資融券 =====
async function loadMarginData(code){
  const el = document.getElementById('marginWrap');
  if(!el) return;
  el.innerHTML = '<div style="color:#64748b;font-size:12px;padding:8px">載入融資融券...</div>';
  try{
    const r = await fetch(PROXY_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+SB_KEY},
      body:JSON.stringify({type:'margin_total',code:code})
    });
    const res = await r.json();
    if(!res.ok||!res.data){el.innerHTML='<div style="color:#64748b;font-size:12px;padding:8px">暫無融資融券資料</div>';return;}
    const d = res.data;
    const marginBal = parseInt(d['融資今日餘額']||0);
    const shortBal = parseInt(d['融券今日餘額']||0);
    const marginBuy = parseInt(d['融資買進']||0);
    const marginSell = parseInt(d['融資賣出']||0);
    const shortBuy = parseInt(d['融券買進']||0);
    const shortSell = parseInt(d['融券賣出']||0);
    const prevMargin = parseInt(d['融資前日餘額']||0);
    const prevShort = parseInt(d['融券前日餘額']||0);
    const marginChg = marginBal - prevMargin;
    const shortChg = shortBal - prevShort;
    const mColor = marginChg>=0?'#f87171':'#34d399'; // 融資增加=偏空(紅)
    const sColor = shortChg>=0?'#f87171':'#34d399';  // 融券增加=偏空(紅)
    const ratio = shortBal>0?(marginBal/shortBal).toFixed(1):'-';

    el.innerHTML = `
    <div style="font-size:12px;color:#93c5fd;font-weight:700;margin-bottom:8px;border-left:3px solid #2563eb;padding-left:8px">
      📊 融資融券
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px">
      <div style="background:#0f172a;border-radius:8px;padding:10px;border:1px solid #1e293b">
        <div style="font-size:10px;color:#64748b;margin-bottom:3px">融資餘額</div>
        <div style="font-size:15px;font-weight:700;color:#e2e8f0">${marginBal.toLocaleString()}<span style="font-size:10px;color:#64748b">張</span></div>
        <div style="font-size:11px;color:${mColor};margin-top:2px">${marginChg>=0?'▲':'▼'}${Math.abs(marginChg).toLocaleString()}</div>
      </div>
      <div style="background:#0f172a;border-radius:8px;padding:10px;border:1px solid #1e293b">
        <div style="font-size:10px;color:#64748b;margin-bottom:3px">融券餘額</div>
        <div style="font-size:15px;font-weight:700;color:#e2e8f0">${shortBal.toLocaleString()}<span style="font-size:10px;color:#64748b">張</span></div>
        <div style="font-size:11px;color:${sColor};margin-top:2px">${shortChg>=0?'▲':'▼'}${Math.abs(shortChg).toLocaleString()}</div>
      </div>
    </div>
    <div style="background:#0f172a;border-radius:8px;padding:10px;border:1px solid #1e293b;margin-bottom:6px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:10px;color:#64748b">資券比</div>
        <div style="font-size:14px;font-weight:700;color:#f59e0b">${ratio}x</div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11px;color:#64748b">
        <span>融資買進 ${marginBuy.toLocaleString()} / 賣出 ${marginSell.toLocaleString()}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:2px;font-size:11px;color:#64748b">
        <span>融券買進 ${shortBuy.toLocaleString()} / 賣出 ${shortSell.toLocaleString()}</span>
      </div>
    </div>`;
    el.style.display = 'block';
  }catch(e){
    el.innerHTML='<div style="color:#64748b;font-size:12px;padding:8px">融資融券載入失敗</div>';
  }
}

async function loadStockChart(code,days,btn){
  if(!code)return;
  if(btn){document.querySelectorAll('#stockChartContainer .range-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');}
  const since=new Date();since.setDate(since.getDate()-days);
  const s=since.toISOString().split('T')[0];
  try{
    const r=await fetch(BASE+'/daily_prices?symbol=eq.'+code+'&date=gte.'+s+'&order=date.asc&limit=500',{headers:SB_H});
    const data=await r.json();
    if(!data||!data.length)return;
    lastKData=data;
    renderStockChart(data,code);
  }catch(e){}
}

function calcMA(data,n){
  return data.map((d,i,arr)=>{
    if(i<n-1)return null;
    const avg=arr.slice(i-n+1,i+1).reduce((s,v)=>s+parseFloat(v.close_price||v.close),0)/n;
    return{time:d.date||d.time,value:parseFloat(avg.toFixed(2))};
  }).filter(Boolean);
}

function calcBoll(data,n=20,k=2){
  return data.map((d,i,arr)=>{
    if(i<n-1)return null;
    const closes=arr.slice(i-n+1,i+1).map(v=>parseFloat(v.close_price||v.close));
    const ma=closes.reduce((s,v)=>s+v,0)/n;
    const std=Math.sqrt(closes.reduce((s,v)=>s+(v-ma)**2,0)/n);
    return{time:d.date||d.time,upper:parseFloat((ma+k*std).toFixed(2)),middle:parseFloat(ma.toFixed(2)),lower:parseFloat((ma-k*std).toFixed(2))};
  }).filter(Boolean);
}

function calcMACD(data,fast=12,slow=26,signal=9){
  const closes=data.map(d=>parseFloat(d.close_price||d.close));
  const ema=(arr,n)=>{
    const k=2/(n+1);
    return arr.reduce((acc,v,i)=>{
      if(i===0)return[v];
      acc.push(v*k+acc[acc.length-1]*(1-k));
      return acc;
    },[]);
  };
  const emaFast=ema(closes,fast);
  const emaSlow=ema(closes,slow);
  const macdLine=emaFast.map((v,i)=>v-emaSlow[i]);
  const signalLine=ema(macdLine.slice(slow-1),signal);
  return data.slice(slow-1).map((d,i)=>({
    time:d.date||d.time,
    macd:parseFloat(macdLine[i+slow-1].toFixed(4)),
    signal:i>=signal-1?parseFloat(signalLine[i-signal+1].toFixed(4)):null,
    hist:i>=signal-1?parseFloat((macdLine[i+slow-1]-signalLine[i-signal+1]).toFixed(4)):null
  }));
}

function calcRSI(data,n=14){
  const closes=data.map(d=>parseFloat(d.close_price||d.close));
  const result=[];
  let avgG=0,avgL=0;
  for(let i=1;i<closes.length;i++){
    const diff=closes[i]-closes[i-1];
    if(i<=n){
      if(diff>0)avgG+=diff/n;else avgL-=diff/n;
      if(i===n){result.push({time:data[i].date||data[i].time,value:parseFloat((100-100/(1+avgG/avgL)).toFixed(2))});}
    }else{
      avgG=(avgG*(n-1)+(diff>0?diff:0))/n;
      avgL=(avgL*(n-1)+(diff<0?-diff:0))/n;
      result.push({time:data[i].date||data[i].time,value:parseFloat((avgL===0?100:(100-100/(1+avgG/avgL))).toFixed(2))});
    }
  }
  return result;
}

function calcKD(data,n=9){
  const result=[];
  let k=50,d=50;
  for(let i=n-1;i<data.length;i++){
    const slice=data.slice(i-n+1,i+1);
    const high=Math.max(...slice.map(v=>parseFloat(v.high_price||v.high)));
    const low=Math.min(...slice.map(v=>parseFloat(v.low_price||v.low)));
    const close=parseFloat(data[i].close_price||data[i].close);
    const rsv=high===low?50:(close-low)/(high-low)*100;
    k=k*2/3+rsv/3;
    d=d*2/3+k/3;
    result.push({time:data[i].date||data[i].time,k:parseFloat(k.toFixed(2)),d:parseFloat(d.toFixed(2))});
  }
  return result;
}

let currentSubIndicator='macd';

function renderStockChart(data,code){
  const el=document.getElementById('stockChartWrap');
  if(!el)return;
  el.innerHTML='';
  el.style.cssText='width:100%;overflow:hidden;background:#0f172a;border-radius:8px';
  if(stockChart){try{stockChart.remove();}catch(e){}}

  const W=el.clientWidth||800;

  // === 主圖 K線 ===
  const mainDiv=document.createElement('div');
  mainDiv.style.cssText='width:100%;height:320px';
  el.appendChild(mainDiv);

  stockChart=LightweightCharts.createChart(mainDiv,{
    width:W,height:320,
    layout:{background:{color:'#0f172a'},textColor:'#94a3b8'},
    grid:{vertLines:{color:'#1e293b'},horzLines:{color:'#1e293b'}},
    rightPriceScale:{borderColor:'#334155'},
    timeScale:{borderColor:'#334155',timeVisible:true},
    crosshair:{mode:1}
  });

  const cs=stockChart.addCandlestickSeries({
    upColor:'#34d399',downColor:'#f87171',
    borderUpColor:'#34d399',borderDownColor:'#f87171',
    wickUpColor:'#34d399',wickDownColor:'#f87171'
  });
  const kData=data.map(d=>({time:d.date||d.time,open:parseFloat(d.open_price||d.open),high:parseFloat(d.high_price||d.high),low:parseFloat(d.low_price||d.low),close:parseFloat(d.close_price||d.close)}));
  cs.setData(kData);

  // MA5 MA20 MA60
  const maColors={'5':'#fbbf24','20':'#a78bfa','60':'#38bdf8'};
  [5,20,60].forEach(n=>{
    const ma=stockChart.addLineSeries({color:maColors[n],lineWidth:1,priceLineVisible:false,lastValueVisible:true,crosshairMarkerVisible:false,title:'MA'+n});
    ma.setData(calcMA(data,n));
  });

  // 布林通道
  const boll=calcBoll(data,20,2);
  if(boll.length){
    const bollUpper=stockChart.addLineSeries({color:'rgba(148,163,184,0.4)',lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,lineStyle:2});
    const bollMid=stockChart.addLineSeries({color:'rgba(148,163,184,0.6)',lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,lineStyle:2});
    const bollLower=stockChart.addLineSeries({color:'rgba(148,163,184,0.4)',lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false,lineStyle:2});
    bollUpper.setData(boll.map(d=>({time:d.time,value:d.upper})));
    bollMid.setData(boll.map(d=>({time:d.time,value:d.middle})));
    bollLower.setData(boll.map(d=>({time:d.time,value:d.lower})));
  }

  // 黃金/死亡交叉標記
  const ma5d=calcMA(data,5);const ma20d=calcMA(data,20);
  const markers=[];
  const m5m=new Map(ma5d.map(d=>[d.time,d.value]));
  const m20m=new Map(ma20d.map(d=>[d.time,d.value]));
  for(let i=1;i<kData.length;i++){
    const t0=kData[i-1].time,t1=kData[i].time;
    if(!m5m.has(t0)||!m5m.has(t1)||!m20m.has(t0)||!m20m.has(t1))continue;
    if(m5m.get(t0)<m20m.get(t0)&&m5m.get(t1)>=m20m.get(t1))markers.push({time:t1,position:'belowBar',color:'#34d399',shape:'arrowUp',text:'多'});
    else if(m5m.get(t0)>m20m.get(t0)&&m5m.get(t1)<=m20m.get(t1))markers.push({time:t1,position:'aboveBar',color:'#f87171',shape:'arrowDown',text:'空'});
  }
  if(markers.length)cs.setMarkers(markers);
  stockChart.timeScale().fitContent();

  // === 成交量副圖 ===
  const volDiv=document.createElement('div');
  volDiv.style.cssText='width:100%;height:80px;margin-top:2px';
  el.appendChild(volDiv);
  const volChart=LightweightCharts.createChart(volDiv,{
    width:W,height:80,
    layout:{background:{color:'#0f172a'},textColor:'#94a3b8'},
    grid:{vertLines:{color:'#1e293b'},horzLines:{color:'#1e293b'}},
    rightPriceScale:{borderColor:'#334155',scaleMargins:{top:0.1,bottom:0}},
    timeScale:{borderColor:'#334155',timeVisible:true,visible:false},
    crosshair:{mode:1}
  });
  const volSeries=volChart.addHistogramSeries({priceFormat:{type:'volume'},priceScaleId:'right',scaleMargins:{top:0.1,bottom:0}});
  volSeries.setData(data.map(d=>({time:d.date||d.time,value:parseFloat(d.volume||0),color:(parseFloat(d.open_price)>0?(parseFloat(d.close_price)>=parseFloat(d.open_price)):true)?'rgba(52,211,153,0.5)':'rgba(248,113,113,0.5)'})));
  volChart.timeScale().fitContent();

  // 同步 crosshair
  stockChart.timeScale().subscribeVisibleLogicalRangeChange(range=>{if(range)volChart.timeScale().setVisibleLogicalRange(range);});
  volChart.timeScale().subscribeVisibleLogicalRangeChange(range=>{if(range)stockChart.timeScale().setVisibleLogicalRange(range);});

  // === 指標切換按鈕 ===
  const indBtnWrap=document.createElement('div');
  indBtnWrap.style.cssText='display:flex;gap:6px;padding:8px 0;';
  ['macd','rsi','kd'].forEach(ind=>{
    const b=document.createElement('button');
    b.textContent=ind.toUpperCase();
    b.style.cssText=`background:${currentSubIndicator===ind?'#2563eb':'#1e293b'};color:${currentSubIndicator===ind?'#fff':'#94a3b8'};border:1px solid #334155;padding:4px 12px;border-radius:6px;font-size:12px;cursor:pointer`;
    b.onclick=()=>{currentSubIndicator=ind;indBtnWrap.querySelectorAll('button').forEach(x=>{x.style.background='#1e293b';x.style.color='#94a3b8';});b.style.background='#2563eb';b.style.color='#fff';renderSubIndicator(data,ind,subDiv);};
    indBtnWrap.appendChild(b);
  });
  el.appendChild(indBtnWrap);

  // === 副指標圖 ===
  const subDiv=document.createElement('div');
  subDiv.style.cssText='width:100%;height:120px';
  el.appendChild(subDiv);
  renderSubIndicator(data,currentSubIndicator,subDiv);

  // RSI 數值更新
  const rsiData=calcRSI(data,14);
  if(rsiData.length){
    const lastRSI=rsiData[rsiData.length-1].value;
    const rsiEl=document.getElementById('stockRSI');
    const rsiLabel=document.getElementById('stockRSILabel');
    if(rsiEl){rsiEl.textContent=lastRSI;rsiEl.style.color=lastRSI>70?'#f87171':lastRSI<30?'#34d399':'#e2e8f0';}
    if(rsiLabel){
      if(lastRSI>70){rsiLabel.textContent='超買';rsiLabel.style.background='#450a0a';rsiLabel.style.color='#f87171';}
      else if(lastRSI<30){rsiLabel.textContent='超賣';rsiLabel.style.background='#052e16';rsiLabel.style.color='#34d399';}
      else{rsiLabel.textContent='正常';rsiLabel.style.background='#1e293b';rsiLabel.style.color='#64748b';}
    }
  }

  if(currentIndicator&&currentIndicator!=='none')renderIndicator(currentIndicator);
}

function renderSubIndicator(data,ind,container){
  container.innerHTML='';
  const W=container.clientWidth||800;
  let subChart;
  try{
    subChart=LightweightCharts.createChart(container,{
      width:W,height:120,
      layout:{background:{color:'#0f172a'},textColor:'#64748b'},
      grid:{vertLines:{color:'#1e293b'},horzLines:{color:'#1e293b'}},
      rightPriceScale:{borderColor:'#334155'},
      timeScale:{borderColor:'#334155',timeVisible:true},
      crosshair:{mode:1}
    });
  }catch(e){return;}

  if(ind==='macd'){
    const macdData=calcMACD(data);
    const macdLine=subChart.addLineSeries({color:'#38bdf8',lineWidth:1,priceLineVisible:false,lastValueVisible:true,title:'MACD'});
    const signalLine=subChart.addLineSeries({color:'#f59e0b',lineWidth:1,priceLineVisible:false,lastValueVisible:true,title:'Signal'});
    const histSeries=subChart.addHistogramSeries({priceFormat:{type:'price'},color:'#94a3b8',priceScaleId:'right'});
    macdLine.setData(macdData.map(d=>({time:d.time,value:d.macd})));
    signalLine.setData(macdData.filter(d=>d.signal!==null).map(d=>({time:d.time,value:d.signal})));
    histSeries.setData(macdData.filter(d=>d.hist!==null).map(d=>({time:d.time,value:d.hist,color:d.hist>=0?'rgba(52,211,153,0.6)':'rgba(248,113,113,0.6)'})));
  }else if(ind==='rsi'){
    const rsiData=calcRSI(data,14);
    const rsiLine=subChart.addLineSeries({color:'#a78bfa',lineWidth:1,priceLineVisible:false,lastValueVisible:true,title:'RSI(14)'});
    rsiLine.setData(rsiData);
    // 超買超賣線
    const ob=subChart.addLineSeries({color:'rgba(248,113,113,0.4)',lineWidth:1,lineStyle:2,priceLineVisible:false,lastValueVisible:false});
    const os=subChart.addLineSeries({color:'rgba(52,211,153,0.4)',lineWidth:1,lineStyle:2,priceLineVisible:false,lastValueVisible:false});
    if(rsiData.length){ob.setData([{time:rsiData[0].time,value:70},{time:rsiData[rsiData.length-1].time,value:70}]);os.setData([{time:rsiData[0].time,value:30},{time:rsiData[rsiData.length-1].time,value:30}]);}
  }else if(ind==='kd'){
    const kdData=calcKD(data,9);
    const kLine=subChart.addLineSeries({color:'#34d399',lineWidth:1,priceLineVisible:false,lastValueVisible:true,title:'K(9)'});
    const dLine=subChart.addLineSeries({color:'#f87171',lineWidth:1,priceLineVisible:false,lastValueVisible:true,title:'D(9)'});
    kLine.setData(kdData.map(d=>({time:d.time,value:d.k})));
    dLine.setData(kdData.map(d=>({time:d.time,value:d.d})));
  }
  subChart.timeScale().fitContent();
}

function switchIndicator(name,btn){
  currentIndicator=name;
  document.querySelectorAll('.indicator-btn').forEach(b=>{
    if(b.dataset.ind===name){b.style.background='#2563eb';b.style.borderColor='#2563eb';b.style.color='#fff';}
    else{b.style.background='#1e293b';b.style.borderColor='#334155';b.style.color='#94a3b8';}
  });
  const wrap=document.getElementById('indicatorWrap');
  if(name==='none'){wrap.style.display='none';if(indicatorChart){try{indicatorChart.remove();}catch(e){}indicatorChart=null;}return;}
  wrap.style.display='block';
  renderIndicator(name);
}

function computeEMA(values,period){
  const k=2/(period+1);
  const out=[];
  let prev=null;
  for(let i=0;i<values.length;i++){
    if(i<period-1){out.push(null);continue;}
    if(prev===null){
      let sum=0;for(let j=0;j<period;j++)sum+=values[i-j];
      prev=sum/period;
    }else{
      prev=values[i]*k+prev*(1-k);
    }
    out.push(prev);
  }
  return out;
}

function computeMACD(closes){
  const ema12=computeEMA(closes,12);
  const ema26=computeEMA(closes,26);
  const dif=closes.map((_,i)=>(ema12[i]!=null&&ema26[i]!=null)?ema12[i]-ema26[i]:null);
  const difVals=dif.filter(v=>v!=null);
  const signalRaw=computeEMA(difVals,9);
  const dea=[];let si=0;
  for(let i=0;i<dif.length;i++){
    if(dif[i]==null){dea.push(null);}
    else{dea.push(signalRaw[si]??null);si++;}
  }
  const hist=dif.map((v,i)=>(v!=null&&dea[i]!=null)?v-dea[i]:null);
  return {dif,dea,hist};
}

function computeKD(kData,period=9){
  const K=[],D=[];
  let prevK=50,prevD=50;
  for(let i=0;i<kData.length;i++){
    if(i<period-1){K.push(null);D.push(null);continue;}
    let hh=-Infinity,ll=Infinity;
    for(let j=i-period+1;j<=i;j++){
      if(kData[j].high>hh)hh=kData[j].high;
      if(kData[j].low<ll)ll=kData[j].low;
    }
    const rsv=hh===ll?50:((kData[i].close-ll)/(hh-ll))*100;
    const k=(2/3)*prevK+(1/3)*rsv;
    const d=(2/3)*prevD+(1/3)*k;
    K.push(k);D.push(d);prevK=k;prevD=d;
  }
  return {K,D};
}

function renderIndicator(name){
  const el=document.getElementById('indicatorChart');
  const legend=document.getElementById('indicatorLegend');
  if(!el||!lastKData||lastKData.length<30){if(legend)legend.textContent='資料不足，無法計算';return;}
  el.innerHTML='';
  if(indicatorChart){try{indicatorChart.remove();}catch(e){}indicatorChart=null;}
  indicatorChart=LightweightCharts.createChart(el,{width:el.clientWidth,height:140,layout:{background:{color:'#0f172a'},textColor:'#94a3b8'},grid:{vertLines:{color:'#1e293b'},horzLines:{color:'#1e293b'}},rightPriceScale:{borderColor:'#334155'},timeScale:{borderColor:'#334155',visible:true}});
  const closes=lastKData.map(d=>d.close);
  if(name==='macd'){
    const {dif,dea,hist}=computeMACD(closes);
    const histSeries=indicatorChart.addHistogramSeries({priceFormat:{type:'price',precision:2,minMove:0.01}});
    histSeries.setData(lastKData.map((d,i)=>hist[i]!=null?{time:d.time,value:hist[i],color:hist[i]>=0?'#34d39966':'#f8717166'}:null).filter(Boolean));
    const difSeries=indicatorChart.addLineSeries({color:'#60a5fa',lineWidth:2,priceLineVisible:false,lastValueVisible:true});
    difSeries.setData(lastKData.map((d,i)=>dif[i]!=null?{time:d.time,value:dif[i]}:null).filter(Boolean));
    const deaSeries=indicatorChart.addLineSeries({color:'#fbbf24',lineWidth:2,priceLineVisible:false,lastValueVisible:true});
    deaSeries.setData(lastKData.map((d,i)=>dea[i]!=null?{time:d.time,value:dea[i]}:null).filter(Boolean));
    const lastI=lastKData.length-1;
    const difV=dif[lastI]?.toFixed(2)||'—';
    const deaV=dea[lastI]?.toFixed(2)||'—';
    const hV=hist[lastI]?.toFixed(2)||'—';
    if(legend)legend.innerHTML=`<span style="color:#60a5fa">● DIF=${difV}</span> · <span style="color:#fbbf24">● DEA=${deaV}</span> · <span style="color:${hist[lastI]>=0?'#34d399':'#f87171'}">■ MACD=${hV}</span>`;
  }else if(name==='kd'){
    const {K,D}=computeKD(lastKData,9);
    const kSeries=indicatorChart.addLineSeries({color:'#60a5fa',lineWidth:2,priceLineVisible:false,lastValueVisible:true});
    kSeries.setData(lastKData.map((d,i)=>K[i]!=null?{time:d.time,value:K[i]}:null).filter(Boolean));
    const dSeries=indicatorChart.addLineSeries({color:'#fbbf24',lineWidth:2,priceLineVisible:false,lastValueVisible:true});
    dSeries.setData(lastKData.map((d,i)=>D[i]!=null?{time:d.time,value:D[i]}:null).filter(Boolean));
    // 加超買超賣參考線
    const ref80=indicatorChart.addLineSeries({color:'#f87171',lineWidth:1,lineStyle:2,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});
    ref80.setData(lastKData.map(d=>({time:d.time,value:80})));
    const ref20=indicatorChart.addLineSeries({color:'#34d399',lineWidth:1,lineStyle:2,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});
    ref20.setData(lastKData.map(d=>({time:d.time,value:20})));
    const lastI=lastKData.length-1;
    const kV=K[lastI]?.toFixed(2)||'—';
    const dV=D[lastI]?.toFixed(2)||'—';
    let sig='正常';let sc='#64748b';
    if(K[lastI]>80&&D[lastI]>80){sig='超買';sc='#f87171';}
    else if(K[lastI]<20&&D[lastI]<20){sig='超賣';sc='#34d399';}
    if(legend)legend.innerHTML=`<span style="color:#60a5fa">● K=${kV}</span> · <span style="color:#fbbf24">● D=${dV}</span> · <span style="color:${sc}">${sig}</span>`;
  }
  indicatorChart.timeScale().fitContent();
}


async function loadMonthlyRevenue(code){
  const el = document.getElementById('revenueWrap');
  if(!el) return;
  el.style.display='block';
  el.innerHTML = '<div style="color:#64748b;font-size:12px;padding:8px">載入月營收中...</div>';
  try{
    // 月營收從 Supabase DB 讀（自建，每月1日自動更新）
    const mrRes = await fetch(BASE+'/monthly_revenue?symbol=eq.'+code+'&order=year_month.asc&limit=13',{headers:SB_H});
    const dbRows = mrRes.ok ? await mrRes.json() : [];
    // 轉換格式
    const rows = dbRows.map(r => ({
      '資料年月': r.year_month,
      '營業收入-當月營收': String(r.revenue||0),
      '營業收入-上月比較增減(%)': String(r.mom_pct||0),
      '營業收入-去年同月增減(%)': String(r.yoy_pct||0),
    }));
    if(!Array.isArray(rows)||rows.length===0){
      el.innerHTML='<div style="color:#64748b;font-size:12px;padding:8px">暫無月營收資料</div>';
      return;
    }
    // TWSE t187ap05_L 欄位：中文名稱
    // 解析民國年月：資料年月 "11503" → 2026年3月
    const parseRow = (row) => {
      const ym = row['資料年月']||'';
      const year = parseInt(ym.substring(0,3))+1911;
      const month = parseInt(ym.substring(3,5));
      const rev = parseInt((row['營業收入-當月營收']||'0').replace(/,/g,''));
      const mom = parseFloat(row['營業收入-上月比較增減(%)'||0])||0;
      const yoy = parseFloat(row['營業收入-去年同月增減(%)'||0])||0;
      return {revenue_year:year, revenue_month:month, revenue:rev, mom, yoy};
    };
    const recent = rows.slice(-12).map(parseRow);
    // 資料不足時顯示說明
    if(recent.length < 3){
      const latest = recent[recent.length-1];
      const latestRevDisplay = latest ? (latest.revenue/1e5).toFixed(1) : '-';
      const latestLabel = latest ? latest.revenue_year+'年'+latest.revenue_month+'月' : '-';
      el.innerHTML=`<div style="font-size:12px;color:#93c5fd;font-weight:700;margin-bottom:10px;border-left:3px solid #2563eb;padding-left:8px">
        📊 月營收 · ${latestLabel}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
        <div style="background:#0f172a;border-radius:8px;padding:10px;text-align:center"><div style="font-size:11px;color:#64748b;margin-bottom:4px">當月營收</div><div style="font-size:16px;font-weight:700;color:#e2e8f0">${latestRevDisplay}億</div></div>
        <div style="background:#0f172a;border-radius:8px;padding:10px;text-align:center"><div style="font-size:11px;color:#64748b;margin-bottom:4px">月增率</div><div style="font-size:16px;font-weight:700;color:${latest?.mom>=0?'#34d399':'#f87171'}">${latest?(latest.mom>=0?'+':'')+latest.mom.toFixed(1)+'%':'-'}</div></div>
        <div style="background:#0f172a;border-radius:8px;padding:10px;text-align:center"><div style="font-size:11px;color:#64748b;margin-bottom:4px">年增率</div><div style="font-size:16px;font-weight:700;color:${latest?.yoy>=0?'#34d399':'#f87171'}">${latest?(latest.yoy>=0?'+':'')+latest.yoy.toFixed(1)+'%':'-'}</div></div>
      </div>
      <div style="font-size:11px;color:#475569;text-align:center;padding:8px">📈 走勢圖將於累積3個月資料後顯示</div>`;
      return;
    }
    const latest = recent[recent.length-1];
    const prev = recent[recent.length-2];
    const latestRev = latest.revenue/1e5; // TWSE 單位是千元，/1e5 = 億
    const prevRev = prev?.revenue/1e5||0;
    const lyRow = rows.length>12 ? rows[rows.length-13] : null;
    const lyRevRaw = lyRow ? parseInt((lyRow['營業收入-當月營收']||'0').replace(/,/g,'')) : null;
    const lyRev = lyRevRaw ? lyRevRaw/1e5 : null;
    const mom = latest.mom || (prevRev>0?((latestRev-prevRev)/prevRev*100):0);
    const yoy = latest.yoy || (lyRev?((latestRev-lyRev)/lyRev*100):null);
    const momColor = mom>=0?'#34d399':'#f87171';
    const yoyColor = yoy===null?'#64748b':yoy>=0?'#34d399':'#f87171';
    const maxRev = Math.max(...recent.map(r=>r.revenue/1e5));

    let html = `
    <div style="font-size:12px;color:#93c5fd;font-weight:700;margin-bottom:10px;border-left:3px solid #2563eb;padding-left:8px">
      📊 月營收 · ${latest.revenue_year}年${latest.revenue_month}月
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:12px">
      <div style="background:#0f172a;border-radius:8px;padding:10px;border:1px solid #1e293b;text-align:center">
        <div style="font-size:10px;color:#64748b;margin-bottom:3px">當月營收</div>
        <div style="font-size:15px;font-weight:700;color:#e2e8f0">${latestRev.toFixed(1)}<span style="font-size:10px;color:#64748b">億</span></div>
      </div>
      <div style="background:#0f172a;border-radius:8px;padding:10px;border:1px solid #1e293b;text-align:center">
        <div style="font-size:10px;color:#64748b;margin-bottom:3px">月增率</div>
        <div style="font-size:15px;font-weight:700;color:${momColor}">${mom>=0?'+':''}${mom.toFixed(1)}%</div>
      </div>
      <div style="background:#0f172a;border-radius:8px;padding:10px;border:1px solid #1e293b;text-align:center">
        <div style="font-size:10px;color:#64748b;margin-bottom:3px">年增率</div>
        <div style="font-size:15px;font-weight:700;color:${yoyColor}">${yoy===null?'—':(yoy>=0?'+':'')+yoy.toFixed(1)+'%'}</div>
      </div>
    </div>
    <div style="font-size:11px;color:#64748b;margin-bottom:6px">近12個月走勢（億）</div>
    <div style="background:#0f172a;border-radius:10px;padding:12px 8px 4px;border:1px solid #1e293b">
      <div style="display:flex;align-items:flex-end;gap:2px;height:70px">`;

    recent.forEach((row,i)=>{
      const rev = row.revenue/1e8;
      const h = Math.max(rev/maxRev*62,3);
      const isLatest = i===recent.length-1;
      const isMax = row.revenue===maxRev;
      const barColor = isLatest?'#60a5fa':isMax?'#f59e0b':'#334155';
      html += `<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:1px" title="${row.revenue_year}/${row.revenue_month}: ${rev.toFixed(1)}億">
        <div style="width:100%;height:${h}px;background:${barColor};border-radius:2px 2px 0 0"></div>
        <div style="font-size:8px;color:${isLatest?'#60a5fa':'#475569'}">${row.revenue_month}月</div>
      </div>`;
    });

    html += `</div></div>`;
    html += `<div style="margin-top:8px">`;
    recent.slice(-3).reverse().forEach((row,i)=>{
      const rev = row.revenue/1e8;
      const prevIdx = recent.indexOf(row)-1;
      const prevRow = prevIdx>=0?recent[prevIdx]:null;
      const chg = prevRow?(rev-prevRow.revenue/1e8)/(prevRow.revenue/1e8)*100:null;
      const c = chg===null?'#64748b':chg>=0?'#34d399':'#f87171';
      html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid #0f172a">
        <span style="font-size:11px;color:#64748b">${row.revenue_year}年${row.revenue_month}月</span>
        <span style="font-size:13px;font-weight:600;color:#e2e8f0">${rev.toFixed(2)}億</span>
        <span style="font-size:11px;color:${c}">${chg===null?'—':(chg>=0?'▲':'▼')+Math.abs(chg).toFixed(1)+'%'}</span>
      </div>`;
    });
    html += `</div>`;
    el.innerHTML = html;
  }catch(e){
    el.innerHTML='<div style="color:#64748b;font-size:12px;padding:8px">月營收載入失敗</div>';
  }
}

async function loadStockNews(code){
  const el=document.getElementById('stockNews');
  if(!el)return;
  el.style.display='block';
  el.innerHTML='<div style="font-size:13px;color:#64748b;margin-bottom:8px">📰 相關新聞</div><div style="color:#64748b;padding:8px">載入中...</div>';
  try{
    const stockName=NAMES[code]||code;
    const news=await twseProxy('news', code, {name: stockName});
    if(!Array.isArray(news)||news.length===0){
      el.innerHTML='<div style="font-size:13px;color:#64748b;margin-bottom:8px">📰 相關新聞</div><div style="color:#64748b;padding:8px;font-size:12px">尚無近期新聞</div>';
      return;
    }
    let html='<div style="font-size:13px;color:#93c5fd;font-weight:700;margin-bottom:8px;border-left:3px solid #2563eb;padding-left:8px">📰 相關新聞</div>';
    html+='<div style="display:flex;flex-direction:column;gap:6px">';
    news.forEach(n=>{
      const d=n.pubDate?new Date(n.pubDate):null;
      const dStr=(d&&!isNaN(d.getTime()))?d.toISOString().slice(0,10):'';
      const title=(n.title||'').replace(/"/g,'&quot;').replace(/</g,'&lt;');
      const url=n.link||'#';
      html+=`<a href="${url}" target="_blank" rel="noopener noreferrer" style="display:block;background:#0f172a;border-radius:8px;padding:10px 12px;text-decoration:none;color:inherit;border:1px solid #1e293b">
        <div style="font-size:13px;color:#e2e8f0;line-height:1.4;margin-bottom:4px">${title}</div>
        <div style="font-size:11px;color:#64748b">${dStr} · Google News ↗</div>
      </a>`;
    });
    html+='</div>';
    el.innerHTML=html;
  }catch(e){el.innerHTML='<div style="color:#f87171;padding:8px;font-size:12px">新聞載入失敗</div>';}
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

// ===== ETF 折溢價 =====
async function loadETFNav(code){
  const el = document.getElementById('etfNavWrap');
  if(!el) return;
  el.innerHTML = '<div style="color:#64748b;font-size:12px;padding:4px">載入折溢價...</div>';
  try{
    // 優先用 ETF_topmessage 取得真實淨值
    const navData = await twseProxy('etf_nav', code);
    if(navData){
      const nav = parseFloat(navData['每單位淨值']||navData['ETF淨值']||0);
      const closePrice = parseFloat(navData['上市收盤價']||navData['市場收盤價']||navData['收盤價']||0);
      const premiumRaw = navData['折溢價(%)']||navData['折溢價率(%)']||navData['折溢價'];
      const navDate = navData['淨值日期']||navData['報告日期']||'';
      let premium = premiumRaw!=null ? parseFloat(premiumRaw) : (nav>0&&closePrice>0 ? (closePrice-nav)/nav*100 : null);
      const color = premium==null?'#94a3b8':premium>0?'#f87171':premium<0?'#34d399':'#94a3b8';
      const bg = premium==null?'#1e293b':premium>0?'#450a0a':premium<0?'#052e16':'#1e293b';
      const label = premium==null?'—':premium>0?'溢價':premium<0?'折價':'平價';
      el.innerHTML=`<div style="margin-bottom:8px">
        <div style="display:inline-flex;align-items:center;gap:6px;background:${bg};border:1px solid ${color};border-radius:20px;padding:4px 12px;margin-bottom:8px">
          <span style="font-size:12px;color:${color};font-weight:700">${label}${premium!=null?' '+Math.abs(premium).toFixed(2)+'%':''}</span>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${nav>0?`<div style="background:#0f172a;border-radius:8px;padding:8px 12px;text-align:center;border:1px solid #1e293b">
            <div style="font-size:10px;color:#64748b;margin-bottom:2px">最新淨值${navDate?' ('+navDate+')':''}</div>
            <div style="font-size:16px;font-weight:700;color:#e2e8f0">${nav.toFixed(4)}</div>
          </div>`:''}
          ${closePrice>0?`<div style="background:#0f172a;border-radius:8px;padding:8px 12px;text-align:center;border:1px solid #1e293b">
            <div style="font-size:10px;color:#64748b;margin-bottom:2px">市價</div>
            <div style="font-size:16px;font-weight:700;color:#60a5fa">${closePrice.toFixed(2)}</div>
          </div>`:''}
        </div>
      </div>`;
      el.style.display='block';
      return;
    }
  }catch(e){}
  // Fallback: 用 bwibbu PB ratio 估算
  try{
    const bwi = await twseProxy('bwibbu', code);
    if(!bwi){ el.innerHTML=''; return; }
    const yield_ = bwi['DividendYield'] ? parseFloat(bwi['DividendYield']) : null;
    const pe = bwi['PEratio'] ? parseFloat(bwi['PEratio']) : null;
    const pb = bwi['PBratio'] ? parseFloat(bwi['PBratio']) : null;
    let navHtml = '';
    if(pb !== null){
      const premium = (pb - 1) * 100;
      const color = premium > 0 ? '#f87171' : premium < 0 ? '#34d399' : '#94a3b8';
      const label = premium > 0 ? '溢價' : premium < 0 ? '折價' : '平價';
      navHtml = `<div style="display:inline-flex;align-items:center;gap:6px;background:${premium>0?'#450a0a':premium<0?'#052e16':'#1e293b'};border:1px solid ${color};border-radius:20px;padding:4px 12px;margin-bottom:8px">
        <span style="font-size:12px;color:${color};font-weight:700">${label} ${Math.abs(premium).toFixed(2)}%</span>
        <span style="font-size:10px;color:#64748b">PB ${pb.toFixed(2)}x</span>
      </div>`;
    }
    el.innerHTML = `<div style="margin-bottom:8px">
      ${navHtml}
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        ${yield_!==null?`<div style="background:#0f172a;border-radius:8px;padding:8px 12px;text-align:center;border:1px solid #1e293b">
          <div style="font-size:10px;color:#64748b;margin-bottom:2px">殖利率</div>
          <div style="font-size:16px;font-weight:700;color:#34d399">${yield_.toFixed(2)}%</div>
        </div>`:''}
        ${pe!==null&&pe>0?`<div style="background:#0f172a;border-radius:8px;padding:8px 12px;text-align:center;border:1px solid #1e293b">
          <div style="font-size:10px;color:#64748b;margin-bottom:2px">本益比</div>
          <div style="font-size:16px;font-weight:700;color:#e2e8f0">${pe.toFixed(1)}x</div>
        </div>`:''}
      </div>
    </div>`;
    el.style.display = 'block';
  }catch(e){ el.innerHTML = ''; }
}

async function searchETF(){
  if(!currentUser)return;
  let code=document.getElementById('etfInput').value.trim();
  if(!code)return;
  if(!/^\d/.test(code)){
    const found = Object.entries(NAMES).find(([k,v])=>v===code||v.includes(code)||k===code);
    if(found) code=found[0];
  }
  document.getElementById('etfInput').value=code;
  currentETF=code;
  trackEvent('search_etf',{etf_code:code});
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
      const ch=parseFloat(d.open_price)>0?((parseFloat(d.close_price)-parseFloat(d.open_price))/parseFloat(d.open_price)*100):0;
      const cel=document.getElementById('eChange');
      const pct=d.close_price>0?((ch/(parseFloat(d.close_price)-ch))*100).toFixed(2):ch.toFixed(2);cel.textContent=(ch>=0?'+':'')+pct+'%';
      cel.className='val '+(ch>=0?'up':'down');
      document.getElementById('eVol').textContent=parseInt(d.volume).toLocaleString();
      document.getElementById('etfChartContainer').style.display='block';setTimeout(()=>document.getElementById('etfChartContainer').scrollIntoView({behavior:'smooth',block:'start'}),50);
      document.getElementById('etfChartTitle').textContent=(NAMES[code]||code)+' K線圖';
      loadETFChart(code,30,document.querySelector('#etfChartContainer .range-btn'));
      loadETFNav(code);
      loadETFDividend(code);
      loadETFHoldings(code);
    }else{
      document.getElementById('etfName').textContent=code;
      document.getElementById('etfMeta').textContent='尚無數據';
      document.getElementById('etfChartContainer').style.display='none';
    }
  }catch(e){alert('查詢失敗');}
}


const ETF_GROUPS = [
  {cat:'股票型 / 追蹤台股大盤', items:[
    {sym:'0050',name:'元大台灣50'},{sym:'006208',name:'富邦台灣采吉50'},{sym:'0051',name:'元大中型100'},
    {sym:'0052',name:'富邦科技'},{sym:'0053',name:'元大電子'},{sym:'0054',name:'元大台商50'},
    {sym:'0055',name:'元大MSCI金融'},{sym:'00850',name:'元大臺灣ESG永續'},{sym:'00888',name:'永豐台灣ESG'},
    {sym:'00910',name:'第一金太空衛星'},{sym:'00928',name:'中信上櫃ESG30'},{sym:'00936',name:'台新永續高息中小'},
    {sym:'00939',name:'統一台灣高息動能'},{sym:'00941',name:'中信上游半導體'},{sym:'00943',name:'兆豐台灣晶圓製造'},
    {sym:'00946',name:'群益台灣科技'},{sym:'00947',name:'台新臺灣IC設計'},{sym:'00948',name:'中信小資高價30'},
    {sym:'00953',name:'群益台灣半導體收益'}
  ]},
  {cat:'高股息 / 收益型', items:[
    {sym:'0056',name:'元大高股息'},{sym:'00713',name:'元大台灣高息低波'},{sym:'00878',name:'國泰永續高股息'},
    {sym:'00900',name:'富邦特選高股息30'},{sym:'00905',name:'富邦台灣優質高息'},{sym:'00907',name:'永豐優息存股'},
    {sym:'00915',name:'凱基優選高股息30'},{sym:'00918',name:'大華優利高填息30'},{sym:'00919',name:'群益台灣精選高息'},
    {sym:'00923',name:'群益台灣精選高息30'},{sym:'00929',name:'復華台灣科技優息'},{sym:'00930',name:'永豐ESG低碳高息'},
    {sym:'00934',name:'中信成長高股息'},{sym:'00940',name:'元大台灣價值高息'}
  ]},
  {cat:'科技 / 主題型', items:[
    {sym:'00881',name:'國泰台灣5G+'},{sym:'00891',name:'中信關鍵半導體'},{sym:'00892',name:'富邦台灣半導體'},
    {sym:'00893',name:'國泰智能電動車'},{sym:'00896',name:'中信綠能及電動車'},{sym:'00922',name:'國泰台灣尖牙+'},
    {sym:'00927',name:'群益半導體收益'},{sym:'00935',name:'野村臺灣新科技50'},{sym:'00937B',name:'群益ESG投等債20+'},
    {sym:'00945B',name:'凱基美國非投等債'},{sym:'00951',name:'中信日經高股息'}
  ]},
  {cat:'美股 / 海外型', items:[
    {sym:'00646',name:'元大S&P500'},{sym:'00662',name:'富邦NASDAQ'},{sym:'00757',name:'統一FANG+'},
    {sym:'00827',name:'中信美國500大'},{sym:'00830',name:'國泰費城半導體'},{sym:'00858',name:'國泰美國道瓊'},
    {sym:'00713',name:'元大台灣高息低波'}
  ]},
  {cat:'債券型 / 公債 & 公司債', items:[
    {sym:'00679B',name:'元大美債20年'},{sym:'00681B',name:'元大美債1-3'},{sym:'00687B',name:'國泰20年美債'},
    {sym:'00688B',name:'國泰5-10年美債'},{sym:'00689B',name:'國泰1-3年美債'},{sym:'00694B',name:'富邦美債1-3'},
    {sym:'00695B',name:'富邦美債7-10'},{sym:'00696B',name:'富邦美債20年'},{sym:'00697B',name:'元大美債7-10'},
    {sym:'00720B',name:'元大投等公司債'},{sym:'00723B',name:'群益15年IG電信債'},{sym:'00724B',name:'群益10年IG金融債'},
    {sym:'00725B',name:'國泰投等公司債'},{sym:'00727B',name:'國泰1-5年美債'},{sym:'00740B',name:'富邦全球投等債'},
    {sym:'00746B',name:'富邦A級公司債'},{sym:'00749B',name:'凱基新興債10+'},{sym:'00751B',name:'元大AAA至A公司債'},
    {sym:'00754B',name:'群益AAA-AA公司債'},{sym:'00755B',name:'群益新興投等債'},{sym:'00756B',name:'群益投等新興債'},
    {sym:'00761B',name:'國泰A級公司債'},{sym:'00764B',name:'群益25年美債'},{sym:'00772B',name:'中信高評級公司債'},
    {sym:'00773B',name:'中信優先金融債'},{sym:'00777B',name:'凱基AAA-AA公司債'},{sym:'00778B',name:'凱基金融債20+'},
    {sym:'00779B',name:'凱基美債25+'},{sym:'00780B',name:'國泰投等金融債'},{sym:'00781B',name:'中信小資公司債'},
    {sym:'00782B',name:'中信美國公債20年'},{sym:'00784B',name:'富邦中國政策金融債'},{sym:'00788B',name:'國泰中國政金'},
    {sym:'00791B',name:'復華能源債'},{sym:'00792B',name:'群益A級公司債'},{sym:'00795B',name:'富邦投等公司債'},
    {sym:'00799B',name:'群益投等不動產債'},{sym:'00834B',name:'第一金美債20年'},{sym:'00840B',name:'凱基美債25+'},
    {sym:'00845B',name:'富邦新興投等債'},{sym:'00846B',name:'富邦中國投等債'},{sym:'00857B',name:'群益優選投等債'},
    {sym:'00867B',name:'新光投等債15+'},{sym:'00937B',name:'群益ESG投等債20+'},{sym:'00945B',name:'凱基美國非投等債'}
  ]},
  {cat:'原物料 / 黃金 / 商品', items:[
    {sym:'00635U',name:'元大S&P黃金'},{sym:'00642U',name:'元大S&P石油'},{sym:'00673R',name:'期元大S&P原油反1'},
    {sym:'00674R',name:'期元大S&P黃金反1'},{sym:'00708L',name:'期元大S&P原油正2'},{sym:'00715L',name:'期街口布蘭特正2'}
  ]},
  {cat:'槓桿 / 反向型', items:[
    {sym:'00631L',name:'元大台灣50正2'},{sym:'00632R',name:'元大台灣50反1'},{sym:'00633L',name:'富邦上証正2'},
    {sym:'00634R',name:'富邦上証反1'},{sym:'00637L',name:'元大滬深300正2'},{sym:'00638R',name:'元大滬深300反1'},
    {sym:'00640L',name:'富邦日本正2'},{sym:'00641R',name:'富邦日本反1'},{sym:'00647L',name:'元大S&P500正2'},
    {sym:'00648R',name:'元大S&P500反1'},{sym:'00650L',name:'復華香港正2'},{sym:'00651R',name:'復華香港反1'},
    {sym:'00652',name:'富邦印度'},{sym:'00653L',name:'富邦印度正2'},{sym:'00654R',name:'富邦印度反1'},
    {sym:'00655L',name:'國泰中國A50正2'},{sym:'00656R',name:'國泰中國A50反1'},{sym:'00663L',name:'國泰臺灣加權正2'},
    {sym:'00664R',name:'國泰臺灣加權反1'},{sym:'00665L',name:'富邦恒生國企正2'},{sym:'00666R',name:'富邦恒生國企反1'},
    {sym:'00669R',name:'國泰美國道瓊反1'},{sym:'00670L',name:'富邦NASDAQ正2'},{sym:'00671R',name:'富邦NASDAQ反1'}
  ]},
  {cat:'跨境 / 區域型', items:[
    {sym:'008201',name:'元大寶滬深'},{sym:'0061',name:'元大寶滬深'},{sym:'006205',name:'富邦上証'},
    {sym:'006206',name:'元大上證50'},{sym:'006207',name:'復華滬深300'},{sym:'00625K',name:'富邦深100'},
    {sym:'00636',name:'國泰中國A50'},{sym:'00643',name:'群益深証中小'},{sym:'00645',name:'富邦日本'},
    {sym:'00657',name:'國泰日經225'},{sym:'00709',name:'富邦歐洲'},{sym:'00714',name:'群益道瓊美國'}
  ]}
];

// 攤平給其他地方使用
const ETF_HOT = ETF_GROUPS.flatMap(g=>g.items);

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
  const pct=(price-prev)/prev*100;
  const high=d.h||price;
  const low=d.l||price;
  return {price,pct,high,low};
}
// 通用迷你折線圖 SVG
function miniSVG(prices, color){
  if(!prices||prices.length<2)return '';
  const W=160,H=48;
  const min=Math.min(...prices),max=Math.max(...prices);
  const range=max-min||1;
  const pts=prices.map((p,i)=>{
    const x=(i/(prices.length-1))*W;
    const y=H-((p-min)/range)*(H-6)-3;
    return x.toFixed(1)+','+y.toFixed(1);
  }).join(' ');
  const lx=((prices.length-1)/(prices.length-1))*W;
  const ly=H-((prices[prices.length-1]-min)/range)*(H-6)-3;
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;width:100%;height:${H}px">
    <defs><linearGradient id="g${color.replace('#','')}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <polygon points="${pts} ${W},${H} 0,${H}" fill="url(#g${color.replace('#','')})" opacity="0.4"/>
    <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2.5" fill="${color}"/>
  </svg>`;
}

function usCard(sym,name,price,pct,extra='',chart=''){
  const up=pct>=0;
  const color=up?'#34d399':'#f87171';
  return `<div class="stock-card" style="background:#1e293b;border-radius:12px;padding:14px;border:1px solid ${up?'#1e4a3a':'#4a1e1e'}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div style="flex:1">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:11px;color:#94a3b8">${sym}</div>
          ${watchlistBtn(sym,name,'us')}
        </div>
        <div style="font-size:13px;color:#e2e8f0;margin:2px 0;font-weight:600">${name}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:18px;font-weight:700;color:#e2e8f0">$${price.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</div>
        <div style="font-size:12px;color:${color}">${up?'▲ +':'▼ '}${pct.toFixed(2)}%</div>
      </div>
    </div>
    ${chart?`<div style="margin-top:8px">${chart}</div>`:''}
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
function fxCard(name,unit,price,pct,dec,chart=''){
  const up=pct>=0;
  const color=pct!==0?(up?'#34d399':'#f87171'):'#94a3b8';
  const pHtml=pct!==0?`<div style="font-size:12px;color:${color}">${up?'▲ +':'▼ '}${Math.abs(pct).toFixed(2)}%</div>`:'';
  return `<div style="background:#1e293b;border-radius:12px;padding:14px;border:1px solid ${pct>0?'#1e4a3a':pct<0?'#4a1e1e':'#334155'}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:11px;color:#64748b">${unit}</div>
        <div style="font-size:13px;color:#e2e8f0;font-weight:600;margin:2px 0">${name}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:18px;font-weight:700;color:#e2e8f0">${typeof price==='number'?price.toLocaleString(undefined,{minimumFractionDigits:dec,maximumFractionDigits:dec}):price}</div>
        ${pHtml}
      </div>
    </div>
    ${chart?`<div style="margin-top:8px">${chart}</div>`:''}
  </div>`;
}
function secTitle(icon,title){
  return `<div style="grid-column:1/-1;font-size:12px;color:#93c5fd;font-weight:700;padding:6px 0 4px;border-left:3px solid #2563eb;padding-left:8px;margin-top:4px">${icon} ${title}</div>`;
}
async function loadFX(){
  const grid=document.getElementById('fxGrid');
  if(!grid)return;
  grid.innerHTML='<div style="color:#64748b;padding:8px">載入中...</div>';
  try{
    const r=await fetch('https://open.er-api.com/v6/latest/USD');
    const d=await r.json();
    const rates=d.rates;
    // 貴金屬用 Binance PAXG
    let goldPrice=null,goldPct=0,silverPrice=null;
    try{
      const pg=await fetch('https://api.binance.com/api/v3/ticker/24hr?symbol=PAXGUSDT').then(r=>r.json());
      if(pg&&pg.lastPrice){goldPrice=parseFloat(pg.lastPrice);goldPct=parseFloat(pg.priceChangePercent);}
    }catch(e){console.log('PAXG error:',e);}
    // 白銀從 ExchangeRate XAG 換算
    if(rates['XAG']){silverPrice=parseFloat((1/rates['XAG']).toFixed(2));}
    grid.innerHTML='';
    const twd=rates['TWD']||30;

    // 台幣區塊
    grid.innerHTML+=secTitle('🇹🇼','台幣匯率');
    grid.innerHTML+=fxCard('美元/台幣','TWD',twd,0,2);
    grid.innerHTML+=fxCard('日圓100/台幣','TWD',(twd/(rates['JPY']||1))*100,0,3);
    grid.innerHTML+=fxCard('歐元/台幣','TWD',twd/(rates['EUR']||1),0,2);
    grid.innerHTML+=fxCard('人民幣/台幣','TWD',twd/(rates['CNY']||1),0,2);
    grid.innerHTML+=fxCard('港幣/台幣','TWD',twd/(rates['HKD']||1),0,3);
    grid.innerHTML+=fxCard('英鎊/台幣','TWD',twd/(rates['GBP']||1),0,2);
    grid.innerHTML+=fxCard('澳幣/台幣','TWD',twd/(rates['AUD']||1),0,2);
    grid.innerHTML+=fxCard('新加坡幣/台幣','TWD',twd/(rates['SGD']||1),0,2);
    // 貴金屬區塊
    grid.innerHTML+=secTitle('🥇','貴金屬 & 原物料');
    if(goldPrice)grid.innerHTML+=fxCard('黃金 (PAXG)','USD/oz',goldPrice,goldPct,2);
    if(silverPrice)grid.innerHTML+=fxCard('白銀','USD/oz',silverPrice,0,2);
    // 黃金台幣價格
    if(goldPrice&&rates['TWD'])grid.innerHTML+=fxCard('黃金/台幣','TWD/oz',goldPrice*rates['TWD'],0,0);
    // 亞洲外匯
    grid.innerHTML+=secTitle('🌏','亞洲外匯');
    [['JPY','美元/日圓',2],['CNY','美元/人民幣',4],['HKD','美元/港幣',4],['SGD','美元/新幣',4],['KRW','美元/韓元',0],['THB','美元/泰銖',2],['MYR','美元/馬幣',4],['IDR','美元/印尼盾',0],['INR','美元/印度盧比',2],['PHP','美元/菲律賓披索',2],['VND','美元/越南盾',0],['PKR','美元/巴基斯坦盧比',2]].forEach(([c,n,d])=>{if(rates[c])grid.innerHTML+=fxCard(n,c,rates[c],0,d);});
    // 歐洲外匯
    grid.innerHTML+=secTitle('🌍','歐洲外匯');
    [['EUR','歐元/美元',4,true],['GBP','英鎊/美元',4,true],['CHF','美元/瑞郎',4],['SEK','美元/瑞典克朗',4],['NOK','美元/挪威克朗',4],['DKK','美元/丹麥克朗',4],['PLN','美元/波蘭茲羅提',4],['CZK','美元/捷克克朗',4],['HUF','美元/匈牙利福林',2],['TRY','美元/土耳其里拉',4],['RUB','美元/俄羅斯盧布',2],['UAH','美元/烏克蘭格里夫納',2]].forEach(([c,n,d,inv])=>{if(rates[c])grid.innerHTML+=fxCard(n,c,inv?1/rates[c]:rates[c],0,d);});
    // 美洲外匯
    grid.innerHTML+=secTitle('🌎','美洲外匯');
    [['CAD','美元/加幣',4],['MXN','美元/墨西哥披索',4],['BRL','美元/巴西里拉',4],['ARS','美元/阿根廷披索',2],['CLP','美元/智利披索',0],['COP','美元/哥倫比亞披索',0],['PEN','美元/秘魯索爾',4]].forEach(([c,n,d])=>{if(rates[c])grid.innerHTML+=fxCard(n,c,rates[c],0,d);});
    // 中東/非洲
    grid.innerHTML+=secTitle('🌐','中東 & 非洲');
    [['SAR','美元/沙烏地里亞爾',4],['AED','美元/阿聯迪拉姆',4],['ILS','美元/以色列新謝克爾',4],['EGP','美元/埃及鎊',4],['ZAR','美元/南非蘭特',4],['NGN','美元/奈及利亞奈拉',2],['KWD','美元/科威特第納爾',4],['QAR','美元/卡達里亞爾',4]].forEach(([c,n,d])=>{if(rates[c])grid.innerHTML+=fxCard(n,c,rates[c],0,d);});
    // 大洋洲
    grid.innerHTML+=secTitle('🦘','大洋洲');
    [['AUD','澳幣/美元',4,true],['NZD','紐幣/美元',4,true]].forEach(([c,n,d,inv])=>{if(rates[c])grid.innerHTML+=fxCard(n,c,inv?1/rates[c]:rates[c],0,d);});
  }catch(e){grid.innerHTML='<div style="color:#f87171;padding:8px">載入失敗：'+e.message+'</div>';}
}

async function loadUSHot(){
  if(!currentUser)return;
  const grid=document.getElementById('usHotGrid');
  if(!grid)return;
  grid.innerHTML='';
  for(const s of US_HOT){
    try{
      const {price,pct}=await fetchUSStock(s.sym);
      // 抓近30天K線 via Yahoo Finance
      let chart='';
      try{
        const efUrl='https://sirhskxufayklqrlxeep.supabase.co/functions/v1/yahoo-kline';
        const _k='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNpcmhza3h1ZmF5a2xxcmx4ZWVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3NTc5ODQsImV4cCI6MjA5MDMzMzk4NH0.i0iNEGXq3tkLrQQbGq3WJbNPbNrnrV6ryg8UUB8Bz5g';const cr=await fetch(efUrl,{method:'POST',headers:{'Content-Type':'application/json','apikey':_k,'Authorization':'Bearer '+_k},body:JSON.stringify({symbol:s.sym})});
        const cd=await cr.json();
        // 僅在有足夠資料點時才顯示K線（quote只有2點不畫）
        // K線暫停：Finnhub free 無歷史資料
      }catch(e){}
      grid.innerHTML+=usCard(s.sym,s.name,price,pct,'',chart);
    }catch(e){grid.innerHTML+=`<div style="background:#1e293b;border-radius:12px;padding:16px;color:#64748b">${s.sym} 載入失敗</div>`;}
  }
}
async function searchUS(){
  if(!currentUser)return;
  const sym=document.getElementById('usSearch').value.trim().toUpperCase();
  const result=document.getElementById('usSearchResult');
  if(!sym){result.innerHTML='';return;}
  trackEvent('search_us',{us_code:sym});
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
    document.getElementById('usChartContainer').style.display='block';setTimeout(()=>document.getElementById('usChartContainer').scrollIntoView({behavior:'smooth',block:'start'}),50);
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
async function loadETFHoldings(code){
  const el = document.getElementById('etfHoldingsWrap');
  if(!el) return;
  el.style.display='block';
  el.innerHTML='<div style="color:#64748b;font-size:12px;padding:8px">載入成分股中...</div>';
  try{
    const r = await fetch(PROXY_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+SB_KEY},
      body:JSON.stringify({type:'etf_holdings',code:code})
    });
    const res = await r.json();
    if(!res.ok||!res.data){
      el.innerHTML='<div style="color:#64748b;font-size:12px;padding:8px">暫無成分股資料</div>';
      return;
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(res.data,'text/html');
    let holdings = [];
    for(const t of doc.querySelectorAll('table')){
      if(t.textContent.includes('持股')&&t.textContent.includes('比例')){
        const rows = t.querySelectorAll('tr');
        for(let i=1;i<rows.length&&holdings.length<10;i++){
          const cells = rows[i].querySelectorAll('td');
          if(cells.length>=3){
            const name = cells[0]?.textContent?.trim();
            const pct = parseFloat(cells[2]?.textContent?.trim());
            const chg = cells[3]?.textContent?.trim()||'—';
            if(name&&!isNaN(pct)&&pct>0) holdings.push({name,pct,chg});
          }
        }
        break;
      }
    }
    if(!holdings.length){
      el.innerHTML='<div style="color:#64748b;font-size:12px;padding:8px">無法解析成分股資料</div>';
      return;
    }
    const maxPct = holdings[0].pct || 1;
    let html = `<div style="font-size:12px;color:#93c5fd;font-weight:700;margin-bottom:10px;border-left:3px solid #2563eb;padding-left:8px">🏆 成分股前10大</div>`;
    holdings.forEach((h,i)=>{
      const barW = (h.pct/maxPct*100).toFixed(0);
      const isUp = h.chg.includes('+');
      const isDn = h.chg.includes('-');
      const chgColor = isUp?'#34d399':isDn?'#f87171':'#64748b';
      html += `<div style="margin-bottom:7px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:10px;color:#475569;font-weight:700;min-width:16px">${i+1}</span>
            <span style="font-size:12px;color:#e2e8f0;font-weight:600">${h.name}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:11px;color:${chgColor}">${h.chg}</span>
            <span style="font-size:13px;font-weight:700;color:#60a5fa">${h.pct}%</span>
          </div>
        </div>
        <div style="background:#1e293b;border-radius:3px;height:4px">
          <div style="width:${barW}%;height:100%;background:linear-gradient(90deg,#1d4ed8,#60a5fa);border-radius:3px"></div>
        </div>
      </div>`;
    });
    el.innerHTML = html;
  }catch(e){
    el.innerHTML='<div style="color:#64748b;font-size:12px;padding:8px">成分股載入失敗</div>';
  }
}

async function loadETFHot(){
  if(!currentUser)return;
  const wrap=document.getElementById('etfHotGrid');
  if(!wrap)return;
  // 改成分組：用一個容器放所有分組
  wrap.style.display='block';
  wrap.style.gridTemplateColumns='unset';
  wrap.innerHTML='<div style="color:#64748b;padding:8px">載入中...</div>';

  // 一次抓全部 ETF 最新價
  const allSyms=ETF_HOT.map(e=>e.sym);
  // 用 PostgREST: symbol=in.(...) + order=date.desc + 取最新
  // 為避免單次太多，分批 50
  const priceMap={};
  const klineMap={};
  // 預先抓ETF K線（每批前3檔，避免太多請求）
  await Promise.all(allSyms.map(async code=>{
    try{
      const kr=await fetch(BASE+'/daily_prices?symbol=eq.'+code+'&order=date.desc&limit=30&select=close_price',{headers:SB_H});
      const kd=await kr.json();
      if(kd&&kd.length>1) klineMap[code]=kd.map(r=>parseFloat(r.close_price)).reverse();
    }catch(e){}
  }));
  for(let i=0;i<allSyms.length;i+=50){
    const batch=allSyms.slice(i,i+50);
    try{
      // 取每檔最新一筆：先抓最近一天日期，再抓該天資料
      const r=await fetch(BASE+'/daily_prices?symbol=in.('+batch.join(',')+')&order=date.desc&limit=500&select=symbol,date,close_price,open_price,volume',{headers:SB_H});
      const rows=await r.json();
      // 各 symbol 取第一筆（最新日期）
      rows.forEach(d=>{
        if(!priceMap[d.symbol]) priceMap[d.symbol]=[];
        if(priceMap[d.symbol].length<2) priceMap[d.symbol].push(d);
      });
    }catch(e){}
  }

  let html='';
  ETF_GROUPS.forEach((g,gi)=>{
    const expandDefault=gi<2; // 前兩組預設展開
    html+=`<div style="margin-bottom:14px;background:#1e293b;border-radius:12px;border:1px solid #334155;overflow:hidden">
      <div onclick="toggleETFGroup(${gi})" style="padding:12px 16px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;background:#0f172a">
        <div style="font-size:14px;color:#93c5fd;font-weight:700">${g.cat} <span style="color:#64748b;font-size:11px;font-weight:400">(${g.items.length} 檔)</span></div>
        <span id="etfGroupArrow_${gi}" style="color:#64748b;font-size:12px">${expandDefault?'▼':'▶'}</span>
      </div>
      <div id="etfGroupBody_${gi}" style="display:${expandDefault?'grid':'none'};grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;padding:12px">`;
    g.items.forEach(e=>{
      const arr=priceMap[e.sym]||[];
      const d=arr[0];
      if(d){
        // 當天漲跌：用 open→close（最能反映今天走勢）
        // 若前一天收盤不同，優先用前後兩天收盤；否則用 open→close
        const prevClose=arr[1]?parseFloat(arr[1].close_price):0;
        const todayOpen=parseFloat(d.open_price)||0;
        const todayClose=parseFloat(d.close_price)||0;
        const pct = (prevClose>0 && prevClose!==todayClose)
          ? (todayClose-prevClose)/prevClose*100
          : (todayOpen>0 ? (todayClose-todayOpen)/todayOpen*100 : 0);
        const up=pct>=0;
        const etfColor=up?'#34d399':'#f87171';
        const etfChart=klineMap[e.sym]?miniSVG(klineMap[e.sym],etfColor):'';
        html+=`<div onclick="document.getElementById('etfInput').value='${e.sym}';searchETF();" style="background:#0f172a;border-radius:8px;padding:10px;cursor:pointer;border:1px solid ${up?'#1e4a3a':'#4a1e1e'}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center"><div style="font-size:11px;color:#94a3b8">${e.sym}</div>${watchlistBtn(e.sym,e.name,'etf')}</div>
              <div style="font-size:12px;color:#e2e8f0;margin:1px 0">${e.name}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:15px;font-weight:700;color:#e2e8f0">$${parseFloat(d.close_price).toLocaleString(undefined,{maximumFractionDigits:2})}</div>
              <div style="font-size:11px;color:${etfColor}">${up?'▲ +':'▼ '}${Math.abs(pct).toFixed(2)}%</div>
            </div>
          </div>
          ${etfChart?`<div style="margin-top:6px">${etfChart}</div>`:''}
        </div>`;
      }else{
        html+=`<div onclick="document.getElementById('etfInput').value='${e.sym}';searchETF();" style="background:#0f172a;border-radius:8px;padding:10px;cursor:pointer;border:1px solid #1e293b;opacity:0.55">
          <div style="display:flex;justify-content:space-between;align-items:center"><div style="font-size:11px;color:#94a3b8">${e.sym}</div>${watchlistBtn(e.sym,e.name,'etf')}</div>
          <div style="font-size:12px;color:#e2e8f0;margin:1px 0">${e.name}</div>
          <div style="font-size:11px;color:#64748b">—</div>
        </div>`;
      }
    });
    html+='</div></div>';
  });
  wrap.innerHTML=html;
}

function toggleETFGroup(gi){
  const body=document.getElementById('etfGroupBody_'+gi);
  const arr=document.getElementById('etfGroupArrow_'+gi);
  if(!body)return;
  if(body.style.display==='none'){body.style.display='grid';arr.textContent='▼';}
  else{body.style.display='none';arr.textContent='▶';}
}
let currentETFChartMode='day';
function switchETFChartMode(mode, period, btn){
  currentETFChartMode = mode;
  document.querySelectorAll('#etfChartContainer .range-btn').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  if(mode==='day'){
    loadETFChart(currentETF, period, null);
  } else {
    loadETFWeekMonthChart(currentETF, period, mode);
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

async function loadETFWeekMonthChart(code, days, mode){
  if(!code)return;
  const el=document.getElementById('etfChartWrap');
  if(!el)return;
  el.innerHTML='<div style="color:#64748b;padding:20px;text-align:center">載入'+(mode==='week'?'週K':'月K')+'中...</div>';
  const since=new Date();since.setDate(since.getDate()-days);
  const s=since.toISOString().split('T')[0];
  try{
    const r=await fetch(BASE+'/daily_prices?symbol=eq.'+code+'&date=gte.'+s+'&order=date.asc&limit=2000',{headers:SB_H});
    const data=await r.json();
    if(!data||!data.length){el.innerHTML='<div style="color:#64748b;padding:20px">無資料</div>';return;}
    const aggregated=[];
    let bucket=null;
    for(const d of data){
      const date=new Date(d.date);
      let key;
      if(mode==='week'){
        const day=date.getDay();
        const monday=new Date(date);
        monday.setDate(date.getDate()-(day===0?6:day-1));
        key=monday.toISOString().split('T')[0];
      } else {
        key=d.date.substring(0,7);
      }
      if(!bucket||bucket.time!==key){
        if(bucket) aggregated.push(bucket);
        bucket={time:key,open:parseFloat(d.open_price),high:parseFloat(d.high_price),low:parseFloat(d.low_price),close:parseFloat(d.close_price),volume:parseInt(d.volume||0)};
      } else {
        bucket.high=Math.max(bucket.high,parseFloat(d.high_price));
        bucket.low=Math.min(bucket.low,parseFloat(d.low_price));
        bucket.close=parseFloat(d.close_price);
        bucket.volume+=parseInt(d.volume||0);
      }
    }
    if(bucket) aggregated.push(bucket);
    el.innerHTML='';
    if(etfChart){try{etfChart.remove();}catch(e){}}
    etfChart=LightweightCharts.createChart(el,{width:el.clientWidth,height:280,layout:{background:{color:'#0f172a'},textColor:'#94a3b8'},grid:{vertLines:{color:'#1e293b'},horzLines:{color:'#1e293b'}},rightPriceScale:{borderColor:'#334155'},timeScale:{borderColor:'#334155'}});
    const cs=etfChart.addCandlestickSeries({upColor:'#34d399',downColor:'#f87171',borderUpColor:'#34d399',borderDownColor:'#f87171',wickUpColor:'#34d399',wickDownColor:'#f87171'});
    cs.setData(aggregated);
    etfChart.timeScale().fitContent();
  }catch(e){el.innerHTML='<div style="color:#64748b;padding:20px">載入失敗</div>';}
}

async function loadDividendCalendar(){
  if(!currentUser)return;
  const el=document.getElementById('dividendCalendar');
  if(!el)return;
  try{
    // TWSE 除權息預告表 (CORS 問題透過 allorigins 代理)
    const twseUrl='https://www.twse.com.tw/rwd/zh/announcement/twt49u?response=json';
    const proxy='https://api.allorigins.win/raw?url='+encodeURIComponent(twseUrl);
    let rows=[];
    try{
      const r=await fetch(proxy);
      const j=await r.json();
      if(j&&Array.isArray(j.data))rows=j.data;
    }catch(e){console.log('TWSE fetch fail, fallback to Supabase',e);}
    // 若 TWSE 抓不到，退回 Supabase etf_dividends
    if(rows.length===0){
      const today=new Date().toISOString().slice(0,10);
      const in30=new Date(Date.now()+30*86400000).toISOString().slice(0,10);
      const r=await fetch(BASE+'/etf_dividends?ex_dividend_date=gte.'+today+'&ex_dividend_date=lte.'+in30+'&order=ex_dividend_date.asc&limit=50',{headers:SB_H});
      const data=await r.json();
      if(!data||data.length===0){el.innerHTML='<div style="color:#64748b;padding:8px;font-size:13px">未來30天暫無除權息資料</div>';return;}
      let html='<div style="display:grid;grid-template-columns:80px 1fr 90px 80px;gap:6px;font-size:11px;color:#64748b;padding:4px 8px 8px;border-bottom:1px solid #334155;margin-bottom:8px"><div>代號</div><div>名稱</div><div>除息日</div><div style="text-align:right">配息</div></div>';
      data.forEach(d=>{
        const nm=NAMES[d.symbol]||d.symbol;
        const amt=d.dividend_amount!=null?'$'+parseFloat(d.dividend_amount).toFixed(3):'待定';
        html+=`<div style="display:grid;grid-template-columns:80px 1fr 90px 80px;gap:6px;font-size:13px;padding:6px 8px;border-bottom:1px solid #0f172a">
          <div style="color:#60a5fa;font-weight:600">${d.symbol}</div>
          <div style="color:#e2e8f0">${nm}</div>
          <div style="color:#94a3b8">${d.ex_dividend_date||'—'}</div>
          <div style="color:#34d399;text-align:right;font-weight:600">${amt}</div>
        </div>`;
      });
      el.innerHTML=html;
      return;
    }
    // TWSE 欄位：[0]資料日期 [1]股票代號 [2]名稱 [3]除權息前收盤 [4]除權息參考價 [5]權值+息值 [6]權/息 [7]漲停價格 [8]跌停價格 [9]開始交易基準日 [10]除權息公告日期 [11]現金股利 [12]每股配股 ...
    const today=new Date();
    const today0=today.toISOString().slice(0,10).replace(/-/g,'');
    const in30=new Date(Date.now()+30*86400000).toISOString().slice(0,10).replace(/-/g,'');
    // TWSE 日期格式通常為 民國年/MM/DD，需要轉換判斷
    function rocToYMD(s){
      if(!s)return '';
      const m=String(s).match(/(\d+)\/(\d+)\/(\d+)/);
      if(!m)return '';
      const y=parseInt(m[1])+1911;
      return `${y}${m[2].padStart(2,'0')}${m[3].padStart(2,'0')}`;
    }
    const filtered=rows.map(row=>{
      const exDate=rocToYMD(row[0]);
      return {
        exDate:exDate,
        exDateDisplay:exDate?`${exDate.slice(0,4)}-${exDate.slice(4,6)}-${exDate.slice(6,8)}`:'—',
        symbol:row[1]||'',
        name:row[2]||'',
        cashDiv:row[11]||row[5]||'—',
        stockDiv:row[12]||'—'
      };
    }).filter(r=>r.exDate&&r.exDate>=today0&&r.exDate<=in30).sort((a,b)=>a.exDate.localeCompare(b.exDate));
    if(filtered.length===0){el.innerHTML='<div style="color:#64748b;padding:8px;font-size:13px">未來30天暫無除權息公告</div>';return;}
    let html='<div style="display:grid;grid-template-columns:80px 1fr 100px 90px;gap:6px;font-size:11px;color:#64748b;padding:4px 8px 8px;border-bottom:1px solid #334155;margin-bottom:8px"><div>代號</div><div>名稱</div><div>除息日</div><div style="text-align:right">現金股利</div></div>';
    filtered.slice(0,80).forEach(r=>{
      html+=`<div onclick="document.getElementById('stockInput').value='${r.symbol}';searchStock();window.scrollTo({top:0,behavior:'smooth'});" style="display:grid;grid-template-columns:80px 1fr 100px 90px;gap:6px;font-size:13px;padding:8px;border-bottom:1px solid #0f172a;cursor:pointer">
        <div style="color:#60a5fa;font-weight:600">${r.symbol}</div>
        <div style="color:#e2e8f0">${r.name}</div>
        <div style="color:#94a3b8">${r.exDateDisplay}</div>
        <div style="color:#34d399;text-align:right;font-weight:600">${r.cashDiv}</div>
      </div>`;
    });
    el.innerHTML=html;
  }catch(e){el.innerHTML='<div style="color:#f87171;padding:8px;font-size:12px">除權息月曆載入失敗</div>';}
}

async function loadSupabaseData(){
  if(!currentUser)return;
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
    const _ld3=await fetchDedup(BASE+'/institutional_investors?order=date.desc&limit=1&select=date',{headers:SB_H});const _ld3d=await _ld3.json();const _ld3date=_ld3d[0]?.date||new Date().toISOString().slice(0,10);const r=await fetch(BASE+'/institutional_investors?order=total_buy.desc&limit=5&date=eq.'+_ld3date,{headers:SB_H});
    const data=await r.json();
    if(data&&data.length>0)document.getElementById('institutionalList').innerHTML=data.map((d,i)=>{const who=d.foreign_buy>0&&d.investment_trust_buy>0?'外資+投信':d.foreign_buy>0?'外資':'投信';const nm=NAMES[d.symbol]||d.symbol;const nm2=nm===d.symbol?d.symbol:nm+' '+d.symbol;const sheets=Math.round((d.total_buy||0)/1000);return '<div class="rank-item"><div class="rank-num">'+(i+1)+'</div><div><div class="rank-name">'+nm2+'</div><div class="rank-sub">'+who+'</div></div><div class="rank-val up">+'+sheets.toLocaleString()+'張</div></div>';}).join('');
  }catch(e){}
}


// ===== MoneyRadar AI 摘要 (auto-inserted) =====
async function loadAISummary(code){
  const newsEl = document.getElementById('stockNews');
  if(!newsEl) return;
  let box = document.getElementById('aiSummaryBox');
  if(!box){
    box = document.createElement('div');
    box.id = 'aiSummaryBox';
    box.style.marginTop = '12px';
    newsEl.parentNode.insertBefore(box, newsEl.nextSibling);
  }
  box.innerHTML = '<div style="font-size:13px;color:#93c5fd;font-weight:700;margin-bottom:8px;border-left:3px solid #2563eb;padding-left:8px">🤖 AI 消息摘要</div><div style="background:#0f172a;border-radius:8px;padding:12px;color:#64748b;font-size:12px">分析中...</div>';
  try{
    const stockName = (typeof NAMES !== 'undefined' && NAMES[code]) || code;
    const news = await twseProxy('news', code, {name: stockName});
    if(!Array.isArray(news) || news.length === 0){
      box.innerHTML = '<div style="font-size:13px;color:#93c5fd;font-weight:700;margin-bottom:8px;border-left:3px solid #2563eb;padding-left:8px">🤖 AI 消息摘要</div><div style="background:#0f172a;border-radius:8px;padding:12px;color:#64748b;font-size:12px">尚無相關新聞，無法產生摘要</div>';
      return;
    }
    const formatted = news.slice(0,5).map(function(n){
      return {
        headline: String(n.title||'').slice(0,200),
        source: 'Google News',
        datetime: n.pubDate ? Math.floor(new Date(n.pubDate).getTime()/1000) : Math.floor(Date.now()/1000)
      };
    });
    const r = await fetch(AI_PROXY_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({symbol: code, news: formatted, lang: 'zh-TW'})
    });
    const data = await r.json();
    if(data.error && !data.summary) throw new Error(data.error);
    const cfg = {
      bullish:{label:'偏多',color:'#22c55e',bg:'#052e16'},
      bearish:{label:'偏空',color:'#ef4444',bg:'#2d0a0a'},
      neutral:{label:'中性',color:'#94a3b8',bg:'#1e293b'}
    };
    const s = cfg[data.sentiment] || cfg.neutral;
    let summary = String(data.summary||'')
      .replace(/【消息摘要】\s*/g,'')
      .replace(/【市場情緒】\s*(偏多|偏空|中性)\s*/g,'')
      .trim();
    const safe = summary
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/\n/g,'<br>');
    const disclaimer = String(data.disclaimer||'本內容不構成投資建議').replace(/</g,'&lt;');
    box.innerHTML = '<div style="background:#0f172a;border-radius:8px;padding:14px 16px;border:1px solid #1e293b">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
      + '<span style="font-size:13px;color:#93c5fd;font-weight:700;border-left:3px solid #2563eb;padding-left:8px">🤖 AI 消息摘要</span>'
      + '<span style="background:'+s.bg+';color:'+s.color+';border:1px solid '+s.color+';padding:2px 10px;border-radius:4px;font-size:11px;font-weight:700">'+s.label+'</span>'
      + '</div>'
      + '<p style="font-size:13px;color:#cbd5e1;line-height:1.7;margin:0 0 10px">'+safe+'</p>'
      + '<div style="font-size:11px;color:#475569;border-top:1px solid #1e293b;padding-top:8px">⚠️ '+disclaimer+'</div>'
      + '</div>';
  }catch(e){
    box.innerHTML = '<div style="background:#0f172a;border-radius:8px;padding:12px;border:1px solid #1e293b">'
      + '<div style="font-size:13px;color:#93c5fd;font-weight:700;margin-bottom:6px;border-left:3px solid #2563eb;padding-left:8px">🤖 AI 消息摘要</div>'
      + '<div style="font-size:12px;color:#64748b">暫時無法載入 AI 摘要，請稍後再試</div>'
      + '</div>';
    console.warn('[AI Summary]', e);
  }
}


// ===== MoneyRadar AI Chat Bubble (auto-inserted) =====
(function initAIChatBubble(){
  if (document.getElementById('mr-chat-bubble')) return;

  // CSS 注入
  const style = document.createElement('style');
  style.textContent = `
    #mr-chat-bubble{position:fixed;right:20px;bottom:20px;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#1e40af);box-shadow:0 4px 16px rgba(37,99,235,0.4);cursor:pointer;z-index:9998;display:flex;align-items:center;justify-content:center;transition:transform 0.2s;border:none}
    #mr-chat-bubble:hover{transform:scale(1.08)}
    #mr-chat-bubble svg{width:28px;height:28px;fill:white}
    #mr-chat-panel{position:fixed;right:20px;bottom:88px;width:360px;height:520px;background:#0f172a;border:1px solid #1e293b;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,0.5);z-index:9999;display:none;flex-direction:column;overflow:hidden;font-family:-apple-system,"PingFang TC",sans-serif}
    #mr-chat-panel.open{display:flex}
    .mr-chat-header{padding:14px 16px;background:#1e293b;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #334155}
    .mr-chat-title{font-size:14px;font-weight:700;color:#e2e8f0;display:flex;align-items:center;gap:8px}
    .mr-chat-engine{font-size:10px;background:#0f172a;color:#94a3b8;padding:2px 8px;border-radius:999px;border:1px solid #334155}
    .mr-chat-actions{display:flex;gap:8px}
    .mr-chat-actions button{background:transparent;border:none;color:#94a3b8;cursor:pointer;font-size:12px;padding:4px 8px;border-radius:4px}
    .mr-chat-actions button:hover{background:#334155;color:#e2e8f0}
    #mr-chat-messages{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
    .mr-msg{max-width:85%;padding:10px 12px;border-radius:12px;font-size:13px;line-height:1.6;word-wrap:break-word;white-space:pre-wrap}
    .mr-msg.user{align-self:flex-end;background:#2563eb;color:white;border-bottom-right-radius:4px}
    .mr-msg.assistant{align-self:flex-start;background:#1e293b;color:#e2e8f0;border:1px solid #334155;border-bottom-left-radius:4px}
    .mr-msg.system{align-self:center;font-size:11px;color:#64748b;background:#0b1120;padding:8px 12px;border-radius:8px;text-align:center;max-width:100%}
    .mr-msg.error{align-self:flex-start;background:#2d0a0a;color:#fca5a5;border:1px solid #7f1d1d}
    .mr-msg-loading{display:flex;gap:4px;padding:10px}
    .mr-msg-loading span{width:8px;height:8px;background:#64748b;border-radius:50%;animation:mrPulse 1.2s infinite}
    .mr-msg-loading span:nth-child(2){animation-delay:0.2s}
    .mr-msg-loading span:nth-child(3){animation-delay:0.4s}
    @keyframes mrPulse{0%,80%,100%{opacity:0.3}40%{opacity:1}}
    .mr-chat-input-wrap{padding:10px;border-top:1px solid #334155;background:#0b1120}
    .mr-chat-input-row{display:flex;gap:8px;align-items:flex-end}
    #mr-chat-input{flex:1;background:#1e293b;border:1px solid #334155;border-radius:8px;padding:8px 12px;color:#e2e8f0;font-size:13px;font-family:inherit;resize:none;max-height:80px;min-height:36px;outline:none}
    #mr-chat-input:focus{border-color:#2563eb}
    #mr-chat-send{background:#2563eb;border:none;color:white;padding:0 14px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;height:36px;white-space:nowrap}
    #mr-chat-send:hover:not(:disabled){background:#1d4ed8}
    #mr-chat-send:disabled{background:#334155;cursor:not-allowed;opacity:0.6}
    .mr-chat-disclaimer{font-size:10px;color:#475569;text-align:center;margin-top:6px}
    @media (max-width:480px){
      #mr-chat-panel{right:8px;left:8px;bottom:78px;width:auto;height:75vh}
    }
  `;
  document.head.appendChild(style);

  // 泡泡按鈕
  const bubble = document.createElement('button');
  bubble.id = 'mr-chat-bubble';
  bubble.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM7 9h10v2H7V9zm6 5H7v-2h6v2zm4-6H7V6h10v2z"/></svg>';
  bubble.title = 'AI 助理';
  document.body.appendChild(bubble);

  // 面板
  const panel = document.createElement('div');
  panel.id = 'mr-chat-panel';
  panel.innerHTML = `
    <div class="mr-chat-header">
      <div class="mr-chat-title">🤖 AI 助理 <span class="mr-chat-engine" id="mr-chat-engine">Cloudflare AI</span></div>
      <div class="mr-chat-actions">
        <button id="mr-chat-clear" title="清除對話">🗑</button>
        <button id="mr-chat-close" title="關閉">✕</button>
      </div>
    </div>
    <div id="mr-chat-messages"></div>
    <div class="mr-chat-input-wrap">
      <div class="mr-chat-input-row">
        <textarea id="mr-chat-input" rows="1" placeholder="問我關於財經知識、公開新聞..."></textarea>
        <button id="mr-chat-send">送出</button>
      </div>
      <div class="mr-chat-disclaimer">⚠️ 本助理只整理公開資訊，不提供投資建議</div>
    </div>
  `;
  document.body.appendChild(panel);

  const messagesEl = document.getElementById('mr-chat-messages');
  const inputEl = document.getElementById('mr-chat-input');
  const sendBtn = document.getElementById('mr-chat-send');

  // 對話歷史（本次刷新就清掉）
  const conversation = [];

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
  }

  function appendMessage(role, content, opts){
    opts = opts || {};
    const div = document.createElement('div');
    div.className = 'mr-msg ' + role;
    if (opts.html) {
      div.innerHTML = content;
    } else {
      div.textContent = content;
    }
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function appendLoading(){
    const div = document.createElement('div');
    div.className = 'mr-msg assistant mr-msg-loading';
    div.innerHTML = '<span></span><span></span><span></span>';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function welcomeMessage(){
    appendMessage('system', '🤖 哈囉！我可以幫你解釋財經名詞、整理當前個股的公開新聞、回答市場知識問題。\n\n依台灣《證券投資信託及顧問法》規定，我不能回答「該不該買」「會不會漲」這類個股建議問題。');
  }

  // 取得當前個股 context（如果使用者正在看個股）
  function getCurrentContext(){
    try{
      const stockInput = document.getElementById('stockInput');
      const symbol = stockInput && stockInput.value ? stockInput.value.trim() : null;
      if (!symbol) return null;

      // 試著從 stockNews 容器抓出新聞標題（轉成 Worker 期待的格式）
      const newsEl = document.getElementById('stockNews');
      const newsLinks = newsEl ? newsEl.querySelectorAll('a') : [];
      const news = [];
      newsLinks.forEach(a => {
        const titleEl = a.querySelector('div');
        if (titleEl && titleEl.textContent.trim()) {
          news.push({ headline: titleEl.textContent.trim().slice(0, 200), source: 'Google News' });
        }
      });
      return { currentSymbol: symbol, currentNews: news.slice(0, 5) };
    }catch(e){ return null; }
  }

  async function sendMessage(){
    const text = inputEl.value.trim();
    if (!text) return;
    if (text.length > 1500) {
      appendMessage('error', '訊息過長（上限 1500 字），請縮短');
      return;
    }

    inputEl.value = '';
    inputEl.style.height = 'auto';
    appendMessage('user', text);
    conversation.push({ role: 'user', content: text });

    sendBtn.disabled = true;
    inputEl.disabled = true;
    const loadingEl = appendLoading();

    try {
      const ctx = getCurrentContext();
      const res = await fetch((typeof AI_PROXY_URL !== 'undefined' ? AI_PROXY_URL : 'https://moneyradar-ai-proxy.thinkbigtw.workers.dev') + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversation, context: ctx })
      });
      const data = await res.json();
      loadingEl.remove();

      if (data.error && !data.reply) {
        appendMessage('error', '錯誤：' + data.error);
      } else {
        const reply = data.reply || '(AI 未回應)';
        appendMessage('assistant', reply);
        conversation.push({ role: 'assistant', content: reply });
        const engineEl = document.getElementById('mr-chat-engine');
        if (engineEl && data.engine) engineEl.textContent = data.engine + (data.plan === 'pro' ? ' Pro' : '');
      }
    } catch (e) {
      loadingEl.remove();
      appendMessage('error', '連線失敗，請稍後再試');
      console.warn('[AI Chat]', e);
    } finally {
      sendBtn.disabled = false;
      inputEl.disabled = false;
      inputEl.focus();
    }
  }

  // 事件綁定
  bubble.addEventListener('click', () => {
    panel.classList.add('open');
    if (messagesEl.children.length === 0) welcomeMessage();
    setTimeout(() => inputEl.focus(), 100);
  });
  document.getElementById('mr-chat-close').addEventListener('click', () => {
    panel.classList.remove('open');
  });
  document.getElementById('mr-chat-clear').addEventListener('click', () => {
    if (confirm('清除目前對話？')) {
      conversation.length = 0;
      messagesEl.innerHTML = '';
      welcomeMessage();
    }
  });
  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 80) + 'px';
  });
})();


// ===== MoneyRadar v155: Daily Briefing + Hot Stocks + Chat Quick (auto-inserted) =====
async function loadDailyBriefing(){
  const el = document.getElementById('daily-briefing');
  if (!el) return;
  const today = new Date().toLocaleDateString('zh-TW',{month:'long',day:'numeric',weekday:'short'});
  el.innerHTML = '<div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:10px;padding:14px 18px;border:1px solid #1e3a5f;margin-bottom:16px"><div style="font-size:11px;color:#64748b">📋 今日快報 ' + today + ' · 載入中...</div></div>';
  try{
    // 1) 加權指數（Supabase daily_prices）
    const tx = await fetch(BASE+'/daily_prices?symbol=eq.TAIEX&order=date.desc&limit=2',{headers:SB_H});
    const txData = await tx.json();
    if(!Array.isArray(txData) || txData.length === 0) throw new Error('no taiex');
    const today0 = txData[0];
    const yesterday = txData[1] || today0;
    const close = Number(today0.close_price) || 0;
    const prevClose = Number(yesterday.close_price) || close;
    const change = close - prevClose;
    const pct = prevClose ? (change / prevClose * 100) : 0;
    const isUp = change >= 0;

    // 2) 外資買賣超（II 表 schema: foreign_buy 是淨值/單位股/1000=張）
    let foreignNet = null;
    let foreignNetIsYesterday = false;
    try{
      const r2 = await fetch(BASE+'/institutional_investors?order=date.desc&limit=1&select=date',{headers:SB_H});
      const r2d = await r2.json();
      if(Array.isArray(r2d) && r2d.length > 0){
        const lastDate = r2d[0].date;
        const todayStr = new Date().toISOString().slice(0,10);
        foreignNetIsYesterday = (lastDate !== todayStr);
        const ii = await fetch(BASE+'/institutional_investors?date=eq.'+lastDate+'&select=foreign_buy&limit=3000',{headers:SB_H});
        const iiData = await ii.json();
        if(Array.isArray(iiData) && iiData.length){
          const totalShares = iiData.reduce((s,r) => s + (Number(r.foreign_buy)||0), 0);
          foreignNet = Math.round(totalShares / 1000);
        }
      }
    }catch(e){ console.warn('[Briefing] II fetch error', e); }

    // 3) Worker AI 情緒判讀
    let sentimentLabel = '中性';
    let sentimentColor = '#94a3b8';
    let aiNote = '';
    try{
      const r = await fetch((typeof AI_PROXY_URL!=='undefined' ? AI_PROXY_URL : 'https://moneyradar-ai-proxy.thinkbigtw.workers.dev') + '/briefing', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ taiex:{close, change, pct}, foreign_net: foreignNet })
      });
      const d = await r.json();
      sentimentLabel = d.label || '中性';
      sentimentColor = d.sentiment === 'bullish' ? '#22c55e' : d.sentiment === 'bearish' ? '#ef4444' : '#94a3b8';
      aiNote = d.note || '';
    }catch(e){}

    // 4) 渲染
    const fnText = foreignNet !== null
      ? '<div style="font-size:13px;font-weight:600;color:' + (foreignNet >= 0 ? '#22c55e' : '#ef4444') + '">' + (foreignNet >= 0 ? '+' : '') + foreignNet.toLocaleString() + (foreignNetIsYesterday ? ' <small style="opacity:0.7;font-weight:400">(昨)</small>' : '') + '</div><div style="font-size:11px;color:#64748b">張買賣超</div>'
      : '<div style="font-size:13px;color:#64748b">--</div><div style="font-size:11px;color:#64748b">資料未到</div>';

    const noteText = aiNote ? '<div style="margin-top:8px;padding-top:8px;border-top:1px dashed #1e3a5f;font-size:11px;color:#94a3b8">💡 ' + aiNote.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</div>' : '';

    el.innerHTML = '<div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:10px;padding:14px 18px;border:1px solid #1e3a5f;margin-bottom:16px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
      + '<span style="font-size:11px;font-weight:700;color:#60a5fa;text-transform:uppercase;letter-spacing:1.5px">📋 今日快報</span>'
      + '<span style="font-size:11px;color:#475569">' + today + '</span>'
      + '</div>'
      + '<div style="display:flex;gap:16px;flex-wrap:wrap">'
      + '<div><div style="font-size:11px;color:#64748b;margin-bottom:2px">加權指數</div>'
      + '<div style="font-size:18px;font-weight:700;color:' + (isUp ? '#22c55e' : '#ef4444') + '">' + close.toLocaleString() + '</div>'
      + '<div style="font-size:12px;color:' + (isUp ? '#22c55e' : '#ef4444') + '">' + (isUp ? '▲' : '▼') + ' ' + Math.abs(change).toFixed(2) + ' (' + (isUp ? '+' : '') + pct.toFixed(2) + '%)</div></div>'
      + '<div style="border-left:1px solid #1e3a5f;padding-left:16px"><div style="font-size:11px;color:#64748b;margin-bottom:2px">外資動向</div>' + fnText + '</div>'
      + '<div style="border-left:1px solid #1e3a5f;padding-left:16px"><div style="font-size:11px;color:#64748b;margin-bottom:2px">市場情緒</div>'
      + '<div style="font-size:13px;font-weight:600;color:' + sentimentColor + '">⚡ ' + sentimentLabel + '</div>'
      + '<div style="font-size:11px;color:#64748b">AI 判讀</div></div>'
      + '</div>'
      + noteText
      + '</div>';
  }catch(e){
    el.innerHTML = '';
    console.warn('[Daily Briefing]', e);
  }
}

async function loadHotStocks(){
  const el = document.getElementById('hot-stocks-section');
  if (!el) return;
  const hotList = [
    {sym:'2330',name:'台積電'},{sym:'2317',name:'鴻海'},{sym:'2454',name:'聯發科'},
    {sym:'2308',name:'台達電'},{sym:'2382',name:'廣達'},{sym:'3711',name:'日月光投控'},
    {sym:'2881',name:'富邦金'},{sym:'2412',name:'中華電'},{sym:'2891',name:'中信金'},
    {sym:'2303',name:'聯電'}
  ];
  el.innerHTML = '<div style="margin-top:20px"><div style="font-size:11px;font-weight:700;color:#93c5fd;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;padding-left:10px;border-left:2px solid #2563eb">🔥 熱門股排行</div>'
    + '<div id="hot-stocks-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">'
    + hotList.map(s => '<div id="hot-' + s.sym + '" style="background:#0f1729;border-radius:8px;padding:10px 12px;border:1px solid #1e2d45;cursor:pointer" data-sym="' + s.sym + '"><div style="font-size:11px;color:#64748b">' + s.sym + '</div><div style="font-size:13px;font-weight:700;color:#e2e8f0">' + s.name + '</div><div class="hot-price" style="font-size:12px;color:#475569;margin-top:2px">載入中...</div></div>').join('')
    + '</div></div>';

  // 點擊跳到該股查詢
  el.querySelectorAll('[data-sym]').forEach(card => {
    card.addEventListener('click', () => {
      const sym = card.getAttribute('data-sym');
      const inp = document.getElementById('stockInput');
      if (inp) {
        inp.value = sym;
        if (typeof searchStock === 'function') searchStock();
      }
    });
  });

  // 並行抓即時價格（用 twseProxy('realtime', code)）
  for (const s of hotList){
    try{
      if (typeof twseProxy !== 'function') break;
      const q = await twseProxy('realtime', s.sym);
      // twse realtime API 格式：msgArray[0] 含 z(成交價)、y(昨收)、d(漲跌)
      const m = q?.msgArray?.[0] || q;
      // 智慧 fallback: z (即時) → o (開盤) → y (昨收)
      const z = parseFloat(m?.z);
      const o = parseFloat(m?.o);
      const h = parseFloat(m?.h);
      const l = parseFloat(m?.l);
      const y = parseFloat(m?.y);
      const hasZ = !isNaN(z) && z > 0;
      const hasO = !isNaN(o) && o > 0;
      const hasMid = !isNaN(h) && !isNaN(l) && h > 0 && l > 0;
      const price = hasZ ? z : (hasMid ? (h+l)/2 : (hasO ? o : y));
      const yest = !isNaN(y) && y > 0 ? y : 0;
      const card = document.getElementById('hot-' + s.sym);
      const priceEl = card?.querySelector('.hot-price');
      if (price && yest && priceEl){
        const diff = price - yest;
        const pct = (diff / yest * 100);
        const isUp = diff >= 0;
        const tag = hasZ ? '' : (hasMid ? ' <small style="opacity:0.6">(均價)</small>' : ' <small style="opacity:0.6">(開盤)</small>');
        priceEl.innerHTML = '<span style="color:' + (isUp ? '#22c55e' : '#ef4444') + ';font-weight:600">' + price.toFixed(2) + ' <small>' + (isUp ? '▲' : '▼') + Math.abs(pct).toFixed(2) + '%</small></span>' + tag;
        card.style.borderColor = isUp ? '#14532d' : '#450a0a';
      } else if (priceEl) {
        priceEl.textContent = yest > 0 ? '昨收 ' + yest.toFixed(2) : '休市/無報價';
      }
    }catch(e){
      const card = document.getElementById('hot-' + s.sym);
      const priceEl = card?.querySelector('.hot-price');
      if (priceEl) priceEl.textContent = '無報價';
    }
  }
}

// 升級既有 chat UI：加快捷問題列
function v155UpgradeChatBubble(){
  const panel = document.getElementById('mr-chat-panel');
  if (!panel) return;
  if (panel.querySelector('.mr-chat-quick')) return; // already upgraded

  const inputWrap = panel.querySelector('.mr-chat-input-wrap');
  if (!inputWrap) return;

  const quickBar = document.createElement('div');
  quickBar.className = 'mr-chat-quick';
  quickBar.style.cssText = 'padding:8px 10px;display:flex;gap:6px;flex-wrap:wrap;border-top:1px solid #334155;background:#0b1120';

  const questions = [
    {label:'本益比', q:'什麼是本益比 PE？簡短說明'},
    {label:'三大法人', q:'什麼是三大法人？'},
    {label:'融資融券', q:'什麼是融資融券？'},
    {label:'殖利率', q:'什麼是殖利率？'},
    {label:'ETF', q:'什麼是 ETF？'},
  ];
  questions.forEach(item => {
    const btn = document.createElement('button');
    btn.textContent = item.label;
    btn.style.cssText = 'font-size:11px;padding:4px 10px;background:#1e293b;color:#93c5fd;border:1px solid #334155;border-radius:999px;cursor:pointer;white-space:nowrap;font-family:inherit';
    btn.addEventListener('mouseenter', () => { btn.style.background = '#2563eb'; btn.style.color = 'white'; btn.style.borderColor = '#2563eb'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#1e293b'; btn.style.color = '#93c5fd'; btn.style.borderColor = '#334155'; });
    btn.addEventListener('click', () => {
      const inp = document.getElementById('mr-chat-input');
      const send = document.getElementById('mr-chat-send');
      if (inp && send) {
        inp.value = item.q;
        send.click();
      }
    });
    quickBar.appendChild(btn);
  });

  // 插入在 input-wrap 之前
  inputWrap.parentNode.insertBefore(quickBar, inputWrap);
}

// 啟動入口
function v155Init(){
  if (document.getElementById('daily-briefing')) loadDailyBriefing();
  if (document.getElementById('market-heatmap')) loadMarketHeatmap();
  if (document.getElementById('industry-heatmap')) loadIndustryHeatmap();
  if (document.getElementById('hot-stocks-section')) loadHotStocks();
  if (typeof ensureMyDigestButton === 'function') ensureMyDigestButton();
  // chat UI 升級：等 IIFE 跑完
  setTimeout(() => v155UpgradeChatBubble(), 800);
}

// 立即執行 + DOMContentLoaded 雙保險
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(v155Init, 600));
} else {
  setTimeout(v155Init, 600);
}


// ===== MoneyRadar v159: Market Heatmap (auto-inserted) =====
async function loadMarketHeatmap(){
  const el = document.getElementById('market-heatmap');
  if (!el) return;
  el.innerHTML = '<div style="background:#0f172a;border-radius:10px;padding:14px 18px;border:1px solid #1e293b;margin-bottom:16px"><div style="font-size:11px;color:#64748b">🔥 市場熱度 · 載入中...</div></div>';
  try{
    const rDates = await fetch(BASE+'/daily_prices?order=date.desc&limit=200&select=date',{headers:SB_H});
    const datesAll = await rDates.json();
    const uniqueDates = [...new Set((datesAll||[]).map(d => d.date))].slice(0, 2);
    if(uniqueDates.length < 2) throw new Error('need 2 dates');
    const date = uniqueDates[0];
    const prevDate = uniqueDates[1];
    const r2 = await fetch(BASE+'/daily_prices?date=in.(' + date + ',' + prevDate + ')&symbol=neq.TAIEX&select=symbol,date,close_price&limit=6000',{headers:SB_H});
    const all = await r2.json();
    if(!Array.isArray(all) || all.length === 0) throw new Error('no prices');
    const bySymbol = {};
    all.forEach(p => {
      if(!bySymbol[p.symbol]) bySymbol[p.symbol] = {};
      bySymbol[p.symbol][p.date] = Number(p.close_price) || 0;
    });
    let upCount = 0, downCount = 0, flatCount = 0, strongUpCount = 0, strongDownCount = 0;
    Object.values(bySymbol).forEach(rec => {
      const today = rec[date];
      const yest = rec[prevDate];
      if (!today || !yest || yest === 0) return;
      const pct = (today - yest) / yest * 100;
      if (pct > 0.05) upCount++;
      else if (pct < -0.05) downCount++;
      else flatCount++;
      if (pct > 3) strongUpCount++;
      else if (pct < -3) strongDownCount++;
    });
    const totalCount = upCount + downCount + flatCount;
    if (totalCount === 0) throw new Error('zero total');

    let heat = 'neutral', label = '中性', note = '';
    try{
      const r3 = await fetch((typeof AI_PROXY_URL!=='undefined' ? AI_PROXY_URL : 'https://moneyradar-ai-proxy.thinkbigtw.workers.dev') + '/heatmap', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ stats: { upCount, downCount, flatCount, strongUpCount, strongDownCount } })
      });
      const d = await r3.json();
      heat = d.heat || 'neutral';
      label = d.label || '中性';
      note = d.note || '';
    }catch(e){}

    const heatColors = {
      hot:    {bg:'#1c1917',accent:'#dc2626',badge:'#7f1d1d',icon:'🔥'},
      warm:   {bg:'#1a1410',accent:'#f59e0b',badge:'#78350f',icon:'☀️'},
      neutral:{bg:'#0f172a',accent:'#94a3b8',badge:'#334155',icon:'⚖️'},
      cool:   {bg:'#0a1421',accent:'#3b82f6',badge:'#1e3a8a',icon:'🌥'},
      cold:   {bg:'#0a0f1a',accent:'#1d4ed8',badge:'#172554',icon:'❄️'}
    };
    const c = heatColors[heat] || heatColors.neutral;
    const upRatio = (upCount / totalCount * 100);
    const downRatio = (downCount / totalCount * 100);
    const flatRatio = (flatCount / totalCount * 100);

    el.innerHTML = '<div style="background:' + c.bg + ';border-radius:10px;padding:14px 18px;border:1px solid #1e293b;margin-bottom:16px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'
      + '<span style="font-size:11px;font-weight:700;color:' + c.accent + ';text-transform:uppercase;letter-spacing:1.5px">' + c.icon + ' 市場熱度</span>'
      + '<span style="background:' + c.badge + ';color:' + c.accent + ';border:1px solid ' + c.accent + ';padding:3px 12px;border-radius:999px;font-size:11px;font-weight:700">' + label + '</span>'
      + '</div>'
      + '<div style="display:flex;height:8px;border-radius:4px;overflow:hidden;background:#1e293b;margin-bottom:10px">'
      + '<div style="background:#22c55e;width:' + upRatio.toFixed(1) + '%"></div>'
      + '<div style="background:#64748b;width:' + flatRatio.toFixed(1) + '%"></div>'
      + '<div style="background:#ef4444;width:' + downRatio.toFixed(1) + '%"></div>'
      + '</div>'
      + '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:10px">'
      + '<div><div style="font-size:11px;color:#64748b">↑ 上漲</div><div style="font-size:15px;font-weight:700;color:#22c55e">' + upCount + '<small style="opacity:0.6;font-weight:400"> 支 (' + upRatio.toFixed(0) + '%)</small></div></div>'
      + '<div style="border-left:1px solid #1e293b;padding-left:14px"><div style="font-size:11px;color:#64748b">↓ 下跌</div><div style="font-size:15px;font-weight:700;color:#ef4444">' + downCount + '<small style="opacity:0.6;font-weight:400"> 支 (' + downRatio.toFixed(0) + '%)</small></div></div>'
      + '<div style="border-left:1px solid #1e293b;padding-left:14px"><div style="font-size:11px;color:#64748b">— 平盤</div><div style="font-size:15px;font-weight:700;color:#94a3b8">' + flatCount + '<small style="opacity:0.6;font-weight:400"> 支</small></div></div>'
      + '</div>'
      + '<div style="display:flex;gap:14px;font-size:12px;color:#94a3b8;border-top:1px dashed #1e293b;padding-top:8px">'
      + '<div>🚀 強勢股 (>+3%) <span style="color:#22c55e;font-weight:700">' + strongUpCount + '</span></div>'
      + '<div>📉 弱勢股 (<-3%) <span style="color:#ef4444;font-weight:700">' + strongDownCount + '</span></div>'
      + '<div style="margin-left:auto;color:#64748b;font-size:11px">資料：' + date + '</div>'
      + '</div>'
      + (note ? '<div style="margin-top:10px;padding-top:10px;border-top:1px dashed #1e293b;font-size:12px;color:' + c.accent + '">💡 ' + note.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</div>' : '')
      + '</div>';
  }catch(e){
    el.innerHTML = '';
    console.warn('[Heatmap]', e);
  }
}


// ===== MoneyRadar v162: Stock AI Analysis (auto-inserted) =====
async function loadStockAnalysis(code){
  const newsEl = document.getElementById('stockNews');
  if (!newsEl) return;
  let box = document.getElementById('stockAnalysisBox');
  if (!box){
    box = document.createElement('div');
    box.id = 'stockAnalysisBox';
    box.style.marginTop = '12px';
    const aiBox = document.getElementById('aiSummaryBox');
    const anchor = aiBox || newsEl;
    anchor.parentNode.insertBefore(box, anchor.nextSibling);
  }
  box.innerHTML = '<div style="background:linear-gradient(135deg,#0f172a,#1a0f2e);border-radius:8px;padding:14px 16px;border:1px solid #4c1d95;margin-top:12px"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:13px;color:#a78bfa;font-weight:700;border-left:3px solid #7c3aed;padding-left:8px">✨ AI 全方位分析</span><span style="font-size:11px;color:#64748b">收集資料中...</span></div></div>';

  try{
    const stockName = (typeof NAMES !== 'undefined' && NAMES[code]) || code;

    // 並行抓 4 個資料源
    const [fb, ii, pr, nw] = await Promise.all([
      fetch(BASE+'/stock_fundamentals?symbol=eq.'+code+'&select=*',{headers:SB_H}).then(r=>r.json()).catch(()=>[]),
      fetch(BASE+'/institutional_investors?symbol=eq.'+code+'&order=date.desc&limit=7&select=date,foreign_buy,total_buy',{headers:SB_H}).then(r=>r.json()).catch(()=>[]),
      fetch(BASE+'/daily_prices?symbol=eq.'+code+'&order=date.desc&limit=30&select=date,close_price',{headers:SB_H}).then(r=>r.json()).catch(()=>[]),
      (typeof twseProxy === 'function') ? twseProxy('news', code, {name: stockName}).catch(()=>[]) : Promise.resolve([])
    ]);

    const fundamentals = (Array.isArray(fb) && fb.length) ? fb[0] : {};
    const institutional = Array.isArray(ii) ? ii : [];
    const pricesDesc = Array.isArray(pr) ? pr : [];
    const news = Array.isArray(nw) ? nw : [];

    // 排序: 升序時間
    const prices = [...pricesDesc].sort((a,b) => (a.date||'').localeCompare(b.date||''));

    // 計算 priceData
    const priceData = {};
    if (prices.length > 0){
      const closes = prices.map(p => Number(p.close_price)).filter(x => !isNaN(x) && x > 0);
      if (closes.length > 0){
        priceData.current = closes[closes.length-1];
        priceData.high20d = Math.max(...closes);
        priceData.low20d = Math.min(...closes);
        if (closes.length >= 8){
          const wkAgo = closes[closes.length-8];
          if (wkAgo > 0) priceData.change_7d_pct = (priceData.current - wkAgo) / wkAgo * 100;
        }
        if (closes.length >= 2){
          const oldest = closes[0];
          if (oldest > 0) priceData.change_30d_pct = (priceData.current - oldest) / oldest * 100;
        }
      }
    }

    box.querySelector('span:last-child').textContent = '分析中...';

    const r = await fetch((typeof AI_PROXY_URL!=='undefined' ? AI_PROXY_URL : 'https://moneyradar-ai-proxy.thinkbigtw.workers.dev') + '/analysis', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        symbol: code,
        name: stockName,
        fundamentals,
        institutional,
        priceData,
        news: news.slice(0, 3).map(n => ({headline: String(n.title || '').slice(0, 200), source: 'Google News'}))
      })
    });
    const data = await r.json();
    if (data.error && !data.analysis) throw new Error(data.error);

    const analysis = String(data.analysis || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
    const highlights = (data.highlights || []).map(h =>
      '<span style="background:#1e1b3a;color:#c4b5fd;padding:3px 10px;border-radius:999px;font-size:11px;border:1px solid #4c1d95;font-weight:600">' + String(h).replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</span>'
    ).join('');

    box.innerHTML = '<div style="background:linear-gradient(135deg,#0f172a,#1a0f2e);border-radius:8px;padding:14px 16px;border:1px solid #4c1d95;margin-top:12px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
      + '<span style="font-size:13px;color:#a78bfa;font-weight:700;border-left:3px solid #7c3aed;padding-left:8px">✨ AI 全方位分析</span>'
      + '<span style="font-size:10px;background:#4c1d95;color:#e9d5ff;padding:2px 8px;border-radius:4px;font-weight:600">Llama 70B</span>'
      + '</div>'
      + (highlights ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">' + highlights + '</div>' : '')
      + '<p style="font-size:13px;color:#cbd5e1;line-height:1.8;margin:0 0 10px;letter-spacing:0.2px">' + analysis + '</p>'
      + '<div style="font-size:11px;color:#475569;border-top:1px solid #1e1b3a;padding-top:8px">⚠️ ' + String(data.disclaimer || '本內容不構成投資建議').replace(/</g,'&lt;') + '</div>'
      + '</div>';
  }catch(e){
    box.innerHTML = '<div style="background:#0f172a;border-radius:8px;padding:12px;border:1px solid #1e293b;margin-top:12px"><div style="font-size:13px;color:#a78bfa;font-weight:700;margin-bottom:6px">✨ AI 全方位分析</div><div style="font-size:12px;color:#64748b">暫時無法載入分析，請稍後再試</div></div>';
    console.warn('[Stock Analysis]', e);
  }
}


// ===== MoneyRadar v163: My Watchlist Digest (auto-inserted) =====
function ensureMyDigestButton(){
  // v174: 已停用 — 改由 v174RelocateDigestButton 把按鈕放在 watchlist 分頁
  return;
  if (document.getElementById('my-digest-trigger')) return;
  const dbEl = document.getElementById('daily-briefing');
  if (!dbEl) return;
  const wrap = document.createElement('div');
  wrap.id = 'my-digest-trigger';
  wrap.style.cssText = 'margin-bottom:12px';
  wrap.innerHTML = '<button id="my-digest-btn" type="button" style="width:100%;background:linear-gradient(135deg,#064e3b,#065f46);color:#a7f3d0;border:1px solid #047857;border-radius:10px;padding:12px 16px;cursor:pointer;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:space-between;font-family:inherit"><span>✨ 我的自選股 AI 早報</span><span style="font-size:11px;opacity:0.8">點擊產生 →</span></button><div id="my-digest-area" style="display:none;margin-top:12px"></div>';
  dbEl.parentNode.insertBefore(wrap, dbEl);
  document.getElementById('my-digest-btn').addEventListener('click', loadMyDigest);
}

async function loadMyDigest(){
  const area = document.getElementById('my-digest-area');
  const btn = document.getElementById('my-digest-btn');
  if (!area || !btn) return;
  area.style.display = 'block';
  btn.style.display = 'none';
  area.innerHTML = '<div style="background:#064e3b;border-radius:10px;padding:14px 18px;border:1px solid #047857;display:flex;align-items:center;gap:10px"><span style="font-size:13px;color:#a7f3d0;font-weight:700;border-left:3px solid #10b981;padding-left:8px">✨ 我的自選股 AI 早報</span><span style="font-size:11px;color:#6ee7b7">收集中...</span></div>';

  try{
    if (typeof watchlistCache === 'undefined' || !Array.isArray(watchlistCache) || watchlistCache.length === 0){
      area.innerHTML = '<div style="background:#0f172a;border-radius:10px;padding:14px 18px;border:1px solid #1e293b;color:#64748b;font-size:13px">📋 請先加入自選股後再使用 AI 早報功能。</div>';
      const closeBtn1 = document.createElement('button');
      closeBtn1.type = 'button';
      closeBtn1.textContent = '✕ 收起';
      closeBtn1.style.cssText = 'margin-top:8px;background:transparent;border:none;color:#64748b;cursor:pointer;font-size:11px';
      closeBtn1.addEventListener('click', function(){ const w = document.getElementById('my-digest-trigger'); if (w) w.remove(); });
      area.appendChild(closeBtn1);
      return;
    }

    const symbols = watchlistCache.slice(0, 15).map(w => {
      const s = (typeof normalizeWlSymbol === 'function') ? normalizeWlSymbol(w.symbol) : w.symbol;
      return { symbol: s, name: (typeof NAMES !== 'undefined' && NAMES[s]) || s };
    }).filter(x => x.symbol && /^\d+$/.test(x.symbol));

    if (symbols.length === 0){
      area.innerHTML = '<div style="background:#0f172a;border-radius:10px;padding:14px 18px;border:1px solid #1e293b;color:#64748b;font-size:13px">📋 自選股目前沒有可分析的台股代號。</div>';
      return;
    }

    // 抓最新交易日
    const rDate = await fetch(BASE+'/institutional_investors?order=date.desc&limit=1&select=date',{headers:SB_H});
    const dDate = await rDate.json();
    const latestDate = (Array.isArray(dDate) && dDate[0]) ? dDate[0].date : null;

    const symbolList = symbols.map(s => s.symbol).join(',');

    // 並行抓：7 日外資 + 30 日 close
    const [iiRaw, prRaw] = await Promise.all([
      fetch(BASE+'/institutional_investors?symbol=in.('+symbolList+')&order=date.desc&limit=200&select=symbol,date,foreign_buy',{headers:SB_H}).then(r=>r.json()).catch(()=>[]),
      fetch(BASE+'/daily_prices?symbol=in.('+symbolList+')&order=date.desc&limit=600&select=symbol,date,close_price',{headers:SB_H}).then(r=>r.json()).catch(()=>[])
    ]);

    // 整理每支股票資料
    const ii = Array.isArray(iiRaw) ? iiRaw : [];
    const pr = Array.isArray(prRaw) ? prRaw : [];

    const stocks = symbols.map(s => {
      // 7 日外資累計（股 → 張）
      const iiRecent = ii.filter(r => r.symbol === s.symbol).slice(0, 7);
      const foreign7dShares = iiRecent.reduce((sum, r) => sum + (Number(r.foreign_buy) || 0), 0);
      const foreign_7d_lot = iiRecent.length > 0 ? Math.round(foreign7dShares / 1000) : null;

      // 30 日漲跌
      const stockPrices = pr.filter(r => r.symbol === s.symbol).sort((a,b) => (b.date||'').localeCompare(a.date||''));
      let change_30d_pct = null;
      if (stockPrices.length >= 2){
        const cur = Number(stockPrices[0].close_price);
        const old = Number(stockPrices[stockPrices.length-1].close_price);
        if (cur > 0 && old > 0) change_30d_pct = (cur - old) / old * 100;
      }

      return {
        symbol: s.symbol,
        name: s.name,
        foreign_7d_lot,
        change_30d_pct
      };
    });

    area.querySelector('span:last-child').textContent = '分析中...';

    const r = await fetch((typeof AI_PROXY_URL!=='undefined' ? AI_PROXY_URL : 'https://moneyradar-ai-proxy.thinkbigtw.workers.dev') + '/digest', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ stocks })
    });
    const data = await r.json();
    if (data.error && !data.digest) throw new Error(data.error);

    const digestSafe = String(data.digest || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
    const totalFor = Number(data.totalForeign7d) || 0;
    const totalForText = totalFor === 0 ? '' : (totalFor >= 0 ? '+' : '') + totalFor.toLocaleString();

    area.innerHTML = '<div style="background:linear-gradient(135deg,#064e3b,#022c22);border-radius:10px;padding:14px 18px;border:1px solid #047857">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
      + '<span style="font-size:13px;color:#a7f3d0;font-weight:700;border-left:3px solid #10b981;padding-left:8px">✨ 我的自選股 AI 早報</span>'
      + '<span style="font-size:10px;background:#047857;color:#d1fae5;padding:2px 8px;border-radius:4px;font-weight:600">Llama 70B</span>'
      + '</div>'
      + '<div style="display:flex;gap:14px;flex-wrap:wrap;margin-bottom:10px">'
      + '<div><div style="font-size:11px;color:#6ee7b7">追蹤股票</div><div style="font-size:15px;font-weight:700;color:#a7f3d0">' + (data.stockCount || stocks.length) + '<small style="opacity:0.7;font-weight:400"> 支</small></div></div>'
      + (totalForText ? '<div style="border-left:1px solid #047857;padding-left:14px"><div style="font-size:11px;color:#6ee7b7">整體 7 日外資</div><div style="font-size:15px;font-weight:700;color:' + (totalFor >= 0 ? '#22c55e' : '#ef4444') + '">' + totalForText + '<small style="opacity:0.7;font-weight:400"> 張</small></div></div>' : '')
      + '</div>'
      + '<p style="font-size:13px;color:#d1fae5;line-height:1.8;margin:0 0 10px">' + digestSafe + '</p>'
      + '<div style="font-size:11px;color:#475569;border-top:1px solid #047857;padding-top:8px">⚠️ ' + String(data.disclaimer || '本內容不構成投資建議').replace(/</g,'&lt;') + '</div>'
      + '</div>';
    const closeBtn2 = document.createElement('button');
    closeBtn2.type = 'button';
    closeBtn2.textContent = '✕ 收起';
    closeBtn2.style.cssText = 'margin-top:6px;background:transparent;border:none;color:#64748b;cursor:pointer;font-size:11px';
    closeBtn2.addEventListener('click', function(){
      const a = document.getElementById('my-digest-area');
      const b = document.getElementById('my-digest-btn');
      if (a) a.style.display = 'none';
      if (b) b.style.display = 'flex';
    });
    area.appendChild(closeBtn2);
  }catch(e){
    area.innerHTML = '<div style="background:#0f172a;border-radius:10px;padding:14px 18px;border:1px solid #1e293b"><div style="font-size:13px;color:#a7f3d0;font-weight:700;margin-bottom:6px">✨ 我的自選股 AI 早報</div><div style="font-size:12px;color:#64748b">暫時無法載入早報：' + String(e.message || e).replace(/</g,'&lt;') + '</div></div>';
    console.warn('[My Digest]', e);
  }
}


// ===== MoneyRadar v166: Industry Heatmap (auto-inserted) =====
async function loadIndustryHeatmap(){
  const el = document.getElementById('industry-heatmap');
  if (!el) return;
  el.innerHTML = '<div style="background:#0f172a;border-radius:10px;padding:14px 18px;border:1px solid #1e293b;margin-bottom:16px"><div style="font-size:11px;color:#64748b">🏭 產業熱度 · 載入中...</div></div>';

  const industries = [
    { key:'semi',     name:'半導體',     icon:'🔬', symbols:['2330','2454','2303'] },
    { key:'fin',      name:'金融保險',   icon:'🏦', symbols:['2881','2891','2882'] },
    { key:'shipping', name:'航運',       icon:'🚢', symbols:['2603','2609','2615'] },
    { key:'elec',     name:'電子代工',   icon:'🔧', symbols:['2317','2308','2382'] },
    { key:'tele',     name:'通訊',       icon:'📡', symbols:['2412','4904','3045'] },
    { key:'steel',    name:'鋼鐵',       icon:'⚙️', symbols:['2002','2014'] },
    { key:'plastic',  name:'塑化',       icon:'🧪', symbols:['1303','1301'] }
  ];

  try{
    // 抓最新兩個交易日
    const rDates = await fetch(BASE+'/daily_prices?order=date.desc&limit=200&select=date',{headers:SB_H});
    const datesAll = await rDates.json();
    const uniqueDates = [...new Set((datesAll||[]).map(d => d.date))].slice(0, 2);
    if (uniqueDates.length < 2) throw new Error('need 2 dates');

    const allSymbols = industries.flatMap(i => i.symbols);
    const r2 = await fetch(BASE+'/daily_prices?date=in.(' + uniqueDates.join(',') + ')&symbol=in.(' + allSymbols.join(',') + ')&select=symbol,date,close_price&limit=200',{headers:SB_H});
    const prices = await r2.json();
    if (!Array.isArray(prices) || prices.length === 0) throw new Error('no prices');

    const bySymbol = {};
    prices.forEach(p => {
      if (!bySymbol[p.symbol]) bySymbol[p.symbol] = {};
      bySymbol[p.symbol][p.date] = Number(p.close_price) || 0;
    });

    const stats = industries.map(ind => {
      const stockData = ind.symbols.map(sym => {
        const today = bySymbol[sym]?.[uniqueDates[0]];
        const yest = bySymbol[sym]?.[uniqueDates[1]];
        if (today && yest && yest > 0){
          return { sym, name: (typeof NAMES !== 'undefined' && NAMES[sym]) || sym, pct: (today - yest) / yest * 100 };
        }
        return null;
      }).filter(x => x);
      const avg = stockData.length > 0 ? stockData.reduce((s,x) => s + x.pct, 0) / stockData.length : null;
      return { ...ind, avgPct: avg, stockData };
    }).filter(i => i.avgPct !== null);

    if (stats.length === 0) throw new Error('no valid industry data');

    stats.sort((a, b) => (b.avgPct || 0) - (a.avgPct || 0));

    // 計算最大絕對值用於 bar 寬度標準化
    const maxAbs = Math.max(...stats.map(s => Math.abs(s.avgPct)), 0.5);

    let html = '<div style="background:#0f172a;border-radius:10px;padding:14px 18px;border:1px solid #1e293b;margin-bottom:16px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'
      + '<span style="font-size:11px;font-weight:700;color:#fbbf24;text-transform:uppercase;letter-spacing:1.5px">🏭 產業熱度排行</span>'
      + '<span style="font-size:11px;color:#475569">' + uniqueDates[0] + '</span>'
      + '</div>'
      + '<div style="display:flex;flex-direction:column;gap:8px">';

    stats.forEach((ind, idx) => {
      const isUp = ind.avgPct >= 0;
      const color = isUp ? '#22c55e' : '#ef4444';
      const bgColor = isUp ? '#052e16' : '#2d0a0a';
      const barW = (Math.abs(ind.avgPct) / maxAbs * 100).toFixed(1);
      const stocksDesc = ind.stockData.map(s => s.name + ' ' + (s.pct >= 0 ? '+' : '') + s.pct.toFixed(2) + '%').join(' · ');

      html += '<div style="background:#0a1421;border-radius:8px;padding:10px 12px;border:1px solid ' + (isUp ? '#14532d' : '#450a0a') + '">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">'
        + '<div style="display:flex;align-items:center;gap:8px">'
        + '<span style="font-size:13px;font-weight:700;color:#94a3b8">#' + (idx+1) + '</span>'
        + '<span style="font-size:14px">' + ind.icon + '</span>'
        + '<span style="font-size:13px;font-weight:700;color:#e2e8f0">' + ind.name + '</span>'
        + '</div>'
        + '<span style="font-size:14px;font-weight:700;color:' + color + '">' + (isUp ? '+' : '') + ind.avgPct.toFixed(2) + '%</span>'
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:8px">'
        + '<div style="flex:1;height:6px;background:#1e293b;border-radius:3px;overflow:hidden">'
        + (isUp ? '<div style="width:' + barW + '%;height:100%;background:linear-gradient(90deg,#14532d,#22c55e)"></div>' : '<div style="margin-left:auto;width:' + barW + '%;height:100%;background:linear-gradient(90deg,#ef4444,#7f1d1d)"></div>')
        + '</div>'
        + '</div>'
        + '<div style="margin-top:6px;font-size:11px;color:#64748b">' + stocksDesc + '</div>'
        + '</div>';
    });

    html += '</div></div>';
    el.innerHTML = html;
  }catch(e){
    el.innerHTML = '';
    console.warn('[Industry Heatmap]', e);
  }
}


// ===== MoneyRadar v167: Asia Market (auto-inserted) =====
async function loadAsiaMarket(){
  const el = document.getElementById('asia-market-content');
  if (!el) return;
  el.innerHTML = '<div style="background:#0f172a;border-radius:10px;padding:14px 18px;border:1px solid #1e293b"><div style="font-size:11px;color:#64748b">🌏 亞洲市場 · 載入中...</div></div>';

  const groups = [
    {
      key: 'hk', name: '🇭🇰 港股', flag: '#dc2626',
      indexSym: '^HSI', indexLabel: '恆生指數',
      stocks: [
        { sym: '0700.HK', name: '騰訊控股' },
        { sym: '9988.HK', name: '阿里巴巴' },
        { sym: '3690.HK', name: '美團' },
        { sym: '1810.HK', name: '小米集團' },
        { sym: '1211.HK', name: '比亞迪股份' }
      ]
    },
    {
      key: 'jp', name: '🇯🇵 日股', flag: '#dc2626',
      indexSym: '^N225', indexLabel: '日經 225',
      stocks: [
        { sym: '7203.T', name: '豐田汽車' },
        { sym: '6758.T', name: 'Sony 集團' },
        { sym: '9984.T', name: '軟銀集團' },
        { sym: '7974.T', name: '任天堂' },
        { sym: '9983.T', name: '迅銷 (Uniqlo)' }
      ]
    },
    {
      key: 'cn', name: '🇨🇳 中概 ADR', flag: '#fbbf24',
      indexSym: null, indexLabel: null,
      stocks: [
        { sym: 'BABA', name: '阿里巴巴' },
        { sym: 'JD', name: '京東' },
        { sym: 'PDD', name: '拼多多' },
        { sym: 'NIO', name: '蔚來' },
        { sym: 'BIDU', name: '百度' }
      ]
    }
  ];

  const allSymbols = groups.flatMap(g => g.indexSym ? [g.indexSym, ...g.stocks.map(s => s.sym)] : g.stocks.map(s => s.sym));

  try {
    const r = await fetch((typeof AI_PROXY_URL !== 'undefined' ? AI_PROXY_URL : 'https://moneyradar-ai-proxy.thinkbigtw.workers.dev') + '/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols: allSymbols })
    });
    const data = await r.json();
    const byKey = {};
    (data.results || []).forEach(rs => { byKey[rs.symbol] = rs; });

    let html = '';
    groups.forEach(group => {
      // v177: 全部用 v170RenderGridCard 統一渲染（包括 index）
      const allItems = group.indexSym
        ? [{ sym: group.indexSym, name: group.indexLabel, isIndex: true }, ...group.stocks]
        : group.stocks;
      const cards = allItems.map(s => v170RenderGridCard(s.sym, s.name, byKey[s.sym], { isIndex: !!s.isIndex })).join('');
      html += '<div style="margin-bottom:18px"><div style="font-size:13px;font-weight:700;color:' + group.flag + ';margin-bottom:8px;padding-left:10px;border-left:3px solid ' + group.flag + '">' + group.name + '</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">' + cards + '</div></div>';
    });

    // v180: 加 AI 早報
    const allBriefingItems = groups.flatMap(g => g.indexSym ? [{sym: g.indexSym, name: g.indexLabel}, ...g.stocks] : g.stocks);
    const briefingItems = allBriefingItems.map(s => { const d = byKey[s.sym]; return d && !d.error ? { symbol: s.sym, name: s.name, pct: d.pct } : null; }).filter(Boolean);
    const briefing = await v178FetchMarketBriefing('asia', briefingItems);
    const briefingHtml = v178RenderBriefingCard('🌏 亞洲早報', briefing);
    el.innerHTML = '<div style="background:#0f172a;border-radius:10px;padding:14px 18px;border:1px solid #1e293b">' + briefingHtml + '<div style="font-size:11px;font-weight:700;color:#93c5fd;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:14px">🌏 亞洲市場 · 即時行情</div>' + html + '<div style="font-size:10px;color:#475569;border-top:1px solid #1e293b;padding-top:8px;margin-top:8px">資料來源：Yahoo Finance / Alpha Vantage · 延遲約 5-15 分鐘 · 僅供參考</div></div>';
  } catch (e) {
    el.innerHTML = '<div style="background:#0f172a;border-radius:10px;padding:14px 18px;border:1px solid #1e293b;color:#64748b;font-size:13px">🌏 亞洲市場暫時無法載入，請稍後再試</div>';
    console.warn('[Asia Market]', e);
  }
}

function watchAsiaTab(){
  const tab = document.getElementById('tab-asia');
  if (!tab || tab.dataset.watched) return;
  tab.dataset.watched = '1';
  let loaded = false;
  const check = () => {
    if (!loaded && tab.style.display !== 'none' && document.getElementById('asia-market-content')) {
      loaded = true;
      loadAsiaMarket();
    }
  };
  const observer = new MutationObserver(check);
  observer.observe(tab, { attributes: true, attributeFilter: ['style'] });
  check();
}

// v169: 直接綁定 asia 按鈕點擊事件 (不依賴 v155Init)
function v169AsiaAutoBind(){
  const btns = document.querySelectorAll('button.tab-btn');
  btns.forEach(b => {
    const txt = (b.textContent || '').trim();
    if ((txt.includes('亞洲') || txt.includes('🌏')) && !b.dataset.v169Bound) {
      b.dataset.v169Bound = '1';
      b.addEventListener('click', () => {
        setTimeout(() => {
          if (typeof loadAsiaMarket === 'function') loadAsiaMarket();
        }, 100);
      });
    }
  });
  // 也啟動 watchAsiaTab (作為備援)
  if (typeof watchAsiaTab === 'function') watchAsiaTab();
}

// 自動執行 (不依賴 v155Init)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(v169AsiaAutoBind, 1500));
} else {
  setTimeout(v169AsiaAutoBind, 1500);
}


// ===== MoneyRadar v170-173: Commodities + Watchlist + Crypto + US Extras (auto-inserted) =====

// 通用：渲染 grid 卡片 v177 (sparkline + isIndex 樣式)
function v177BuildSparkline(closes, isUp){
  if (!closes || !Array.isArray(closes)) return '';
  const valid = closes.filter(c => c != null && !isNaN(Number(c))).map(Number);
  if (valid.length < 2) return '';
  const w = 60, h = 18;
  const min = Math.min(...valid), max = Math.max(...valid);
  const range = (max - min) || 1;
  const points = valid.map((c, i) => {
    const x = (i / (valid.length - 1)) * w;
    const y = h - ((c - min) / range) * h;
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  const color = isUp ? '#22c55e' : '#ef4444';
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" style="display:block;flex-shrink:0"><polyline points="' + points + '" fill="none" stroke="' + color + '" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>';
}

function v170RenderGridCard(sym, name, data, opts){
  opts = opts || {};
  const isIndex = !!opts.isIndex;

  if (!data || data.error) {
    const idxBorder = isIndex ? '#4c1d95' : '#1e2d45';
    return '<div style="background:#0a1421;border-radius:8px;padding:10px 12px;border:1px solid ' + idxBorder + '"><div style="font-size:11px;color:#64748b">' + sym + (isIndex ? ' <span style="font-size:9px;color:#a78bfa;background:#1e1b3a;padding:1px 5px;border-radius:3px;margin-left:2px">INDEX</span>' : '') + '</div><div style="font-size:13px;font-weight:700;color:#e2e8f0">' + name + '</div><div style="font-size:11px;color:#475569;margin-top:2px">無報價</div></div>';
  }

  const isUp = (data.pct || 0) >= 0;
  const border = isIndex
    ? '#7c3aed'
    : (isUp ? '#14532d' : '#450a0a');
  const idxLabel = isIndex ? ' <span style="font-size:9px;color:#a78bfa;background:#1e1b3a;padding:1px 5px;border-radius:3px;margin-left:2px;font-weight:600">INDEX</span>' : '';
  const spark = v177BuildSparkline(data.closes, isUp);

  return '<div style="background:#0a1421;border-radius:8px;padding:10px 12px;border:1px solid ' + border + '">'
    + '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">'
    + '<div style="min-width:0;flex:1;overflow:hidden">'
    + '<div style="font-size:11px;color:#64748b">' + sym + idxLabel + '</div>'
    + '<div style="font-size:13px;font-weight:700;color:#e2e8f0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + name + '</div>'
    + '</div>'
    + (spark ? '<div style="margin-top:2px">' + spark + '</div>' : '')
    + '</div>'
    + '<div style="display:flex;align-items:baseline;gap:6px;margin-top:4px;flex-wrap:wrap">'
    + '<span style="font-size:13px;font-weight:600;color:' + (isUp ? '#22c55e' : '#ef4444') + '">' + Number(data.price).toFixed(2) + '</span>'
    + '<span style="font-size:11px;color:' + (isUp ? '#22c55e' : '#ef4444') + '">' + (isUp ? '▲' : '▼') + Math.abs(Number(data.pct || 0)).toFixed(2) + '%</span>'
    + '<span style="font-size:10px;color:#64748b">' + (data.currency || '') + '</span>'
    + '</div>'
    + '</div>';
}

async function v170FetchQuotes(symbols){
  try {
    const r = await fetch((typeof AI_PROXY_URL !== 'undefined' ? AI_PROXY_URL : 'https://moneyradar-ai-proxy.thinkbigtw.workers.dev') + '/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols })
    });
    const data = await r.json();
    const map = {};
    (data.results || []).forEach(rs => { map[rs.symbol] = rs; });
    return map;
  } catch (e) {
    return {};
  }
}

// ===== v170: 全球商品 =====
async function loadGlobalCommodities(){
  const el = document.getElementById('global-commodities-content');
  if (!el) return;
  const items = [
    { sym: 'GC=F', name: '黃金期貨' },
    { sym: 'SI=F', name: '白銀期貨' },
    { sym: 'HG=F', name: '銅期貨' },
    { sym: 'CL=F', name: '原油 WTI' },
    { sym: 'BZ=F', name: '原油 Brent' },
    { sym: 'NG=F', name: '天然氣' },
    { sym: 'ZC=F', name: '玉米期貨' },
    { sym: 'ZW=F', name: '小麥期貨' },
    { sym: 'VNQ', name: '美 REIT ETF' }
  ];
  el.innerHTML = '<div style="background:#0f172a;border-radius:10px;padding:14px 18px;border:1px solid #1e293b"><div style="font-size:11px;color:#64748b">🛢 全球商品 · 載入中...</div></div>';
  const map = await v170FetchQuotes(items.map(x => x.sym));
  const cards = items.map(x => v170RenderGridCard(x.sym, x.name, map[x.sym])).join('');
  el.innerHTML = '<div style="background:#0f172a;border-radius:10px;padding:14px 18px;border:1px solid #1e293b"><div style="font-size:11px;font-weight:700;color:#fbbf24;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px">🛢 全球商品 / 貴金屬 / REIT</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">' + cards + '</div><div style="font-size:10px;color:#475569;margin-top:10px;border-top:1px solid #1e293b;padding-top:8px">資料：Yahoo Finance · 延遲 5-15 分鐘</div></div>';
}

// ===== v171: Watchlist Grid =====
async function loadWatchlistGrid(){
  const el = document.getElementById('watchlist-grid-content');
  if (!el) return;
  if (typeof watchlistCache === 'undefined' || !Array.isArray(watchlistCache) || watchlistCache.length === 0){
    el.innerHTML = '<div style="background:#0f172a;border-radius:10px;padding:20px;border:1px solid #1e293b;text-align:center;color:#64748b;font-size:13px">⭐ 目前沒有自選股<br><br>請至 <strong>台股</strong> 分頁查詢個股後加入自選</div>';
    return;
  }
  el.innerHTML = '<div style="background:#0f172a;border-radius:10px;padding:14px 18px;border:1px solid #1e293b"><div style="font-size:11px;color:#64748b">⭐ 我的自選 · 載入中...</div></div>';

  const items = watchlistCache.slice(0, 20).map(w => {
    const sym = (typeof normalizeWlSymbol === 'function') ? normalizeWlSymbol(w.symbol) : w.symbol;
    return { sym, name: (typeof NAMES !== 'undefined' && NAMES[sym]) || sym };
  });

  // 用 twseProxy realtime（台股）+ Worker /quote（其他）
  const cards = await Promise.all(items.map(async x => {
    let data = null;
    if (/^\d+$/.test(x.sym)){
      // 台股
      try {
        const q = await twseProxy('realtime', x.sym);
        const m = q?.msgArray?.[0];
        if (m){
          const z = parseFloat(m.z), o = parseFloat(m.o), h = parseFloat(m.h), l = parseFloat(m.l), y = parseFloat(m.y);
          const hasZ = !isNaN(z) && z > 0;
          const hasMid = !isNaN(h) && !isNaN(l) && h > 0 && l > 0;
          const price = hasZ ? z : (hasMid ? (h+l)/2 : (!isNaN(o) ? o : y));
          const yest = !isNaN(y) && y > 0 ? y : 0;
          if (price && yest) data = { price, prev: yest, pct: (price-yest)/yest*100, currency: 'TWD' };
        }
      } catch(e) {}
    } else {
      // 美股或其他
      try {
        const r = await fetch((typeof AI_PROXY_URL !== 'undefined' ? AI_PROXY_URL : 'https://moneyradar-ai-proxy.thinkbigtw.workers.dev') + '/quote', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbols: [x.sym] })
        });
        const d = await r.json();
        data = d.results?.[0];
      } catch(e) {}
    }
    return v170RenderGridCard(x.sym, x.name, data);
  }));

  el.innerHTML = '<div style="background:#0f172a;border-radius:10px;padding:14px 18px;border:1px solid #1e293b"><div style="font-size:11px;font-weight:700;color:#fbbf24;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px">⭐ 我的自選股（' + items.length + '）</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">' + cards.join('') + '</div></div>';
}

// ===== v172: 加密貨幣 Top 8 廣度 =====
async function loadCryptoExtras(){
  const el = document.getElementById('crypto-extras-content');
  if (!el) return;
  const items = [
    { sym: 'BTC-USD', name: 'Bitcoin' },
    { sym: 'ETH-USD', name: 'Ethereum' },
    { sym: 'SOL-USD', name: 'Solana' },
    { sym: 'BNB-USD', name: 'BNB' },
    { sym: 'XRP-USD', name: 'Ripple' },
    { sym: 'ADA-USD', name: 'Cardano' },
    { sym: 'DOGE-USD', name: 'Dogecoin' },
    { sym: 'AVAX-USD', name: 'Avalanche' }
  ];
  el.innerHTML = '<div style="background:#0f172a;border-radius:10px;padding:14px 18px;border:1px solid #1e293b"><div style="font-size:11px;color:#64748b">🪙 加密貨幣 Top 8 · 載入中...</div></div>';
  const map = await v170FetchQuotes(items.map(x => x.sym));
  const cards = items.map(x => v170RenderGridCard(x.sym, x.name, map[x.sym])).join('');
  // v179: 加 AI 早報
  const briefingItems = items.map(x => { const d = map[x.sym]; return d && !d.error ? { symbol: x.sym, name: x.name, pct: d.pct } : null; }).filter(Boolean);
  const briefing = await v178FetchMarketBriefing('crypto', briefingItems);
  const briefingHtml = v178RenderBriefingCard('🪙 加密貨幣早報', briefing);
  el.innerHTML = '<div style="background:#0f172a;border-radius:10px;padding:14px 18px;border:1px solid #1e293b">' + briefingHtml + '<div style="font-size:11px;font-weight:700;color:#f59e0b;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px">🪙 加密貨幣 Top 8 · 即時</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">' + cards + '</div></div>';
}

// ===== v173: 美股廣度（大盤指數 + 產業 ETF）=====
async function loadUSExtras(){
  const el = document.getElementById('us-extras-content');
  if (!el) return;
  const indices = [
    { sym: '^DJI', name: '道瓊指數' },
    { sym: '^GSPC', name: 'S&P 500' },
    { sym: '^IXIC', name: 'Nasdaq' },
    { sym: '^VIX', name: 'VIX 恐慌指數' }
  ];
  const sectors = [
    { sym: 'XLK', name: '科技' },
    { sym: 'XLF', name: '金融' },
    { sym: 'XLV', name: '醫療' },
    { sym: 'XLE', name: '能源' },
    { sym: 'XLI', name: '工業' },
    { sym: 'XLP', name: '必需消費' },
    { sym: 'XLY', name: '非必需消費' }
  ];
  el.innerHTML = '<div style="background:#0f172a;border-radius:10px;padding:14px 18px;border:1px solid #1e293b"><div style="font-size:11px;color:#64748b">🇺🇸 美股廣度 · 載入中...</div></div>';
  const map = await v170FetchQuotes([...indices, ...sectors].map(x => x.sym));
  const idxCards = indices.map(x => v170RenderGridCard(x.sym, x.name, map[x.sym])).join('');
  const sectorCards = sectors.map(x => v170RenderGridCard(x.sym, x.name, map[x.sym])).join('');
  // v178: 加 AI 早報
  const briefingItems = [...indices, ...sectors].map(x => { const d = map[x.sym]; return d && !d.error ? { symbol: x.sym, name: x.name, pct: d.pct } : null; }).filter(Boolean);
  const briefing = await v178FetchMarketBriefing('us', briefingItems);
  const briefingHtml = v178RenderBriefingCard('🇺🇸 美股早報', briefing);

  el.innerHTML = '<div style="background:#0f172a;border-radius:10px;padding:14px 18px;border:1px solid #1e293b">' + briefingHtml + '<div style="font-size:11px;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px">🇺🇸 美股大盤指數</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin-bottom:14px">' + idxCards + '</div><div style="font-size:11px;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px">🏭 產業類股 ETF (SPDR)</div><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px">' + sectorCards + '</div></div>';
}

// ===== 統一綁定：tab 切換時自動載入 =====
function v170AutoBindAll(){
  const tabMap = [
    { tabId: 'tab-fund', contentId: 'global-commodities-content', loadFn: 'loadGlobalCommodities', btnText: ['外匯', '黃金'] },
    { tabId: 'tab-watchlist', contentId: 'watchlist-grid-content', loadFn: 'loadWatchlistGrid', btnText: ['自選', '清單', '⭐'] },
    { tabId: 'tab-crypto', contentId: 'crypto-extras-content', loadFn: 'loadCryptoExtras', btnText: ['加密'] },
    { tabId: 'tab-us', contentId: 'us-extras-content', loadFn: 'loadUSExtras', btnText: ['美股'] }
  ];
  tabMap.forEach(cfg => {
    const tab = document.getElementById(cfg.tabId);
    const btn = [...document.querySelectorAll('button.tab-btn')].find(b => cfg.btnText.some(t => (b.textContent || '').includes(t)));
    if (btn && !btn.dataset['v170Bound_' + cfg.loadFn]) {
      btn.dataset['v170Bound_' + cfg.loadFn] = '1';
      btn.addEventListener('click', () => {
        setTimeout(() => {
          if (typeof window[cfg.loadFn] === 'function') window[cfg.loadFn]();
        }, 100);
      });
    }
    // 也用 MutationObserver 監聽 tab 顯示
    if (tab && !tab.dataset['v170Watched_' + cfg.loadFn]) {
      tab.dataset['v170Watched_' + cfg.loadFn] = '1';
      let loaded = false;
      const observer = new MutationObserver(() => {
        if (!loaded && tab.style.display !== 'none' && document.getElementById(cfg.contentId)) {
          loaded = true;
          if (typeof window[cfg.loadFn] === 'function') window[cfg.loadFn]();
        }
      });
      observer.observe(tab, { attributes: true, attributeFilter: ['style'] });
    }
  });
}

// 自動執行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(v170AutoBindAll, 1500));
} else {
  setTimeout(v170AutoBindAll, 1500);
}


// ===== MoneyRadar v174: Relocate Digest Button (auto-inserted) =====
function v174RelocateDigestButton(){
  // 1. 清掉可能在台股分頁的舊按鈕
  const oldWrap = document.getElementById('my-digest-trigger');
  if (oldWrap && !oldWrap.closest('#tab-watchlist')) {
    oldWrap.remove();
  }

  // 2. 確保 watchlist 分頁裡有按鈕
  const watchTab = document.getElementById('tab-watchlist');
  if (!watchTab) return;
  if (watchTab.querySelector('#my-digest-trigger')) return;

  const target = document.getElementById('watchlist-grid-content');
  if (!target) return;

  const wrap = document.createElement('div');
  wrap.id = 'my-digest-trigger';
  wrap.style.cssText = 'margin-bottom:12px';

  const btn = document.createElement('button');
  btn.id = 'my-digest-btn';
  btn.type = 'button';
  btn.style.cssText = 'width:100%;background:linear-gradient(135deg,#064e3b,#065f46);color:#a7f3d0;border:1px solid #047857;border-radius:10px;padding:12px 16px;cursor:pointer;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:space-between;font-family:inherit';
  btn.innerHTML = '<span>✨ 我的自選股 AI 早報</span><span style="font-size:11px;opacity:0.8">點擊產生 →</span>';
  btn.addEventListener('click', () => {
    if (typeof loadMyDigest === 'function') loadMyDigest();
  });

  const area = document.createElement('div');
  area.id = 'my-digest-area';
  area.style.cssText = 'display:none;margin-top:12px';

  wrap.appendChild(btn);
  wrap.appendChild(area);

  // 插在 watchlist-grid-content 之前
  target.parentNode.insertBefore(wrap, target);
}

// v174: 自動執行 + 監聽 watchlist tab 切換
function v174AutoBind(){
  v174RelocateDigestButton();

  const watchTab = document.getElementById('tab-watchlist');
  if (watchTab && !watchTab.dataset.v174Watched) {
    watchTab.dataset.v174Watched = '1';
    const observer = new MutationObserver(() => {
      if (watchTab.style.display !== 'none') {
        v174RelocateDigestButton();
      }
    });
    observer.observe(watchTab, { attributes: true, attributeFilter: ['style'] });
  }

  const watchBtn = [...document.querySelectorAll('button.tab-btn')].find(b => /自選|清單|⭐/.test(b.textContent || ''));
  if (watchBtn && !watchBtn.dataset.v174Bound) {
    watchBtn.dataset.v174Bound = '1';
    watchBtn.addEventListener('click', () => setTimeout(v174RelocateDigestButton, 100));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(v174AutoBind, 1700));
} else {
  setTimeout(v174AutoBind, 1700);
}


// ===== MoneyRadar v178-180: Market Briefing (auto-inserted) =====
async function v178FetchMarketBriefing(market, items){
  try{
    const r = await fetch((typeof AI_PROXY_URL !== 'undefined' ? AI_PROXY_URL : 'https://moneyradar-ai-proxy.thinkbigtw.workers.dev') + '/market-briefing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        market,
        items: items.map(d => ({ symbol: d.symbol, name: d.name, pct: d.pct }))
      })
    });
    return await r.json();
  }catch(e){ return null; }
}

function v178RenderBriefingCard(title, briefing){
  if (!briefing || briefing.error || !briefing.note) return '';
  const cfg = {
    bullish: { color: '#22c55e', bg: 'linear-gradient(135deg,#052e16,#0a1421)', border: '#14532d', badgeBg: '#052e16' },
    bearish: { color: '#ef4444', bg: 'linear-gradient(135deg,#2d0a0a,#0a1421)', border: '#450a0a', badgeBg: '#2d0a0a' },
    neutral: { color: '#94a3b8', bg: 'linear-gradient(135deg,#1e293b,#0a1421)', border: '#334155', badgeBg: '#1e293b' }
  };
  const s = cfg[briefing.sentiment] || cfg.neutral;
  const safeNote = String(briefing.note || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return '<div style="background:' + s.bg + ';border-radius:10px;padding:14px 18px;border:1px solid ' + s.border + ';margin-bottom:14px">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">'
    + '<span style="font-size:12px;font-weight:700;color:' + s.color + ';text-transform:uppercase;letter-spacing:1px">' + title + '</span>'
    + '<span style="background:' + s.badgeBg + ';color:' + s.color + ';border:1px solid ' + s.color + ';padding:2px 10px;border-radius:999px;font-size:11px;font-weight:700">' + (briefing.label || '中性') + '</span>'
    + '</div>'
    + '<div style="font-size:13px;color:#cbd5e1;line-height:1.6">💡 ' + safeNote + '</div>'
    + '</div>';
}


// ===== v183-186: Tech Indicators + Compare + Pro + PWA (auto-inserted) =====

// ─────── v183: 技術指標計算 + 渲染 ───────
function v183ComputeTechnical(prices){
  if (!Array.isArray(prices) || prices.length < 20) return null;
  const sorted = [...prices].sort((a,b) => (a.date||'').localeCompare(b.date||''));
  const closes = sorted.map(p => Number(p.close_price)).filter(n => !isNaN(n) && n > 0);
  if (closes.length < 20) return null;

  // RSI(14)
  let rsi = null;
  if (closes.length >= 15) {
    let gains = 0, losses = 0;
    const start = closes.length - 14;
    for (let i = start; i < closes.length; i++) {
      const diff = closes[i] - closes[i-1];
      if (diff >= 0) gains += diff;
      else losses += -diff;
    }
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain/avgLoss);
  }

  // KD(9)：簡化版只算當前 K，D 用近似
  let k = null, d = null;
  if (sorted.length >= 9 && sorted[sorted.length-1].high_price && sorted[sorted.length-1].low_price) {
    const last9 = sorted.slice(-9);
    const highs = last9.map(p => Number(p.high_price)).filter(n => !isNaN(n));
    const lows = last9.map(p => Number(p.low_price)).filter(n => !isNaN(n));
    if (highs.length === 9 && lows.length === 9) {
      const hh = Math.max(...highs);
      const ll = Math.min(...lows);
      const cur = closes[closes.length-1];
      const rsv = (hh - ll) === 0 ? 50 : (cur - ll) / (hh - ll) * 100;
      k = rsv * 1/3 + 50 * 2/3;
      d = k * 1/3 + 50 * 2/3;
    }
  }

  // 布林通道(20)
  const last20 = closes.slice(-20);
  const sma20 = last20.reduce((s,c) => s+c, 0) / 20;
  const variance = last20.reduce((s,c) => s + (c-sma20)*(c-sma20), 0) / 20;
  const sd = Math.sqrt(variance);
  const upper = sma20 + 2*sd;
  const lower = sma20 - 2*sd;
  const cur = closes[closes.length-1];

  return {
    rsi: rsi !== null ? Number(rsi.toFixed(2)) : null,
    rsiLabel: rsi === null ? '—' : (rsi >= 70 ? '超買區' : rsi <= 30 ? '超賣區' : '正常區間'),
    k: k !== null ? Number(k.toFixed(2)) : null,
    d: d !== null ? Number(d.toFixed(2)) : null,
    kdLabel: k === null ? '—' : (k >= 80 ? '超買區' : k <= 20 ? '超賣區' : '正常區間'),
    bb: { upper: Number(upper.toFixed(2)), middle: Number(sma20.toFixed(2)), lower: Number(lower.toFixed(2)) },
    bbLabel: cur > upper ? '突破上軌' : cur < lower ? '跌破下軌' : '通道內',
    bbPosition: ((cur - lower) / (upper - lower) * 100).toFixed(0),
    current: Number(cur.toFixed(2))
  };
}

async function loadTechnicalIndicators(code){
  const newsEl = document.getElementById('stockNews');
  if (!newsEl) return;
  let box = document.getElementById('stockTechBox');
  if (!box){
    box = document.createElement('div');
    box.id = 'stockTechBox';
    box.style.marginTop = '12px';
    const anchor = document.getElementById('stockAnalysisBox') || newsEl;
    anchor.parentNode.insertBefore(box, anchor.nextSibling);
  }
  box.innerHTML = '<div style="background:#0f172a;border-radius:8px;padding:14px 16px;border:1px solid #1e293b"><div style="font-size:13px;color:#fbbf24;font-weight:700">📊 技術指標 · 載入中...</div></div>';

  try{
    const r = await fetch(BASE+'/daily_prices?symbol=eq.'+code+'&order=date.desc&limit=30&select=date,close_price,high_price,low_price',{headers:SB_H});
    const data = await r.json();
    if(!Array.isArray(data) || data.length < 20){
      box.innerHTML = '<div style="background:#0f172a;border-radius:8px;padding:14px 16px;border:1px solid #1e293b"><div style="font-size:13px;color:#fbbf24;font-weight:700;margin-bottom:6px">📊 技術指標</div><div style="font-size:12px;color:#64748b">資料不足，需至少 20 個交易日</div></div>';
      return;
    }
    const t = v183ComputeTechnical(data);
    if(!t){
      box.innerHTML = '<div style="background:#0f172a;border-radius:8px;padding:14px 16px;border:1px solid #1e293b"><div style="font-size:12px;color:#64748b">技術指標計算失敗</div></div>';
      return;
    }

    const lblColor = (lbl) => lbl === '超買區' || lbl === '突破上軌' ? '#ef4444' : (lbl === '超賣區' || lbl === '跌破下軌' ? '#22c55e' : '#94a3b8');

    box.innerHTML = '<div style="background:linear-gradient(135deg,#1a1410,#0f172a);border-radius:8px;padding:14px 16px;border:1px solid #f59e0b;margin-top:12px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'
      + '<span style="font-size:13px;color:#fbbf24;font-weight:700;border-left:3px solid #f59e0b;padding-left:8px">📊 技術指標</span>'
      + '<span style="font-size:10px;color:#64748b">最近 20 個交易日</span>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px">'
      // RSI
      + '<div style="background:#0a1421;border-radius:6px;padding:10px;border:1px solid #1e2d45"><div style="font-size:11px;color:#94a3b8">RSI(14)</div><div style="font-size:18px;font-weight:700;color:#e2e8f0">' + (t.rsi !== null ? t.rsi : '—') + '</div><div style="font-size:11px;color:' + lblColor(t.rsiLabel) + '">' + t.rsiLabel + '</div></div>'
      // KD
      + '<div style="background:#0a1421;border-radius:6px;padding:10px;border:1px solid #1e2d45"><div style="font-size:11px;color:#94a3b8">KD(9)</div><div style="font-size:14px;font-weight:700;color:#e2e8f0">K ' + (t.k !== null ? t.k : '—') + ' / D ' + (t.d !== null ? t.d : '—') + '</div><div style="font-size:11px;color:' + lblColor(t.kdLabel) + '">' + t.kdLabel + '</div></div>'
      // 布林
      + '<div style="background:#0a1421;border-radius:6px;padding:10px;border:1px solid #1e2d45"><div style="font-size:11px;color:#94a3b8">布林(20)</div><div style="font-size:11px;color:#e2e8f0">上 ' + t.bb.upper + '<br>中 ' + t.bb.middle + '<br>下 ' + t.bb.lower + '</div><div style="font-size:11px;color:' + lblColor(t.bbLabel) + ';margin-top:4px">' + t.bbLabel + ' (' + t.bbPosition + '%)</div></div>'
      + '</div>'
      + '<div style="font-size:10px;color:#475569;border-top:1px dashed #1e2d45;padding-top:8px;margin-top:10px">⚠️ 技術指標僅為公開資料統計，不構成投資建議。指標數值為中性陳述。</div>'
      + '</div>';
  }catch(e){
    if(box) box.innerHTML = '';
    console.warn('[Tech]', e);
  }
}

// ─────── v184: 多股比較器 ───────
function v184OpenCompareModal(){
  if (document.getElementById('v184-compare-modal')) return;
  const overlay = document.createElement('div');
  overlay.id = 'v184-compare-modal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px';

  const modal = document.createElement('div');
  modal.style.cssText = 'background:#0f172a;border:1px solid #334155;border-radius:12px;padding:20px;max-width:900px;width:100%;max-height:90vh;overflow-y:auto;font-family:inherit';
  modal.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><span style="font-size:15px;font-weight:700;color:#e2e8f0">📊 多股比較器</span><span id="v184-close" style="cursor:pointer;color:#64748b;font-size:20px;padding:0 6px">✕</span></div><div style="font-size:12px;color:#94a3b8;margin-bottom:10px">輸入 2-5 個股票代號（逗號分隔，台股+美股+港股皆可）：</div><div style="display:flex;gap:8px;margin-bottom:14px"><input id="v184-input" type="text" placeholder="例：2330,2454,AAPL,0700.HK" style="flex:1;background:#1e293b;border:1px solid #334155;border-radius:6px;padding:8px 12px;color:#e2e8f0;font-size:13px"/><button id="v184-go" style="background:#2563eb;color:white;border:none;border-radius:6px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer">比較</button></div><div id="v184-result"></div>';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  document.getElementById('v184-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('v184-go').addEventListener('click', v184RunCompare);
  document.getElementById('v184-input').addEventListener('keydown', e => { if(e.key==='Enter') v184RunCompare(); });
  document.getElementById('v184-input').focus();
}

async function v184RunCompare(){
  const inp = document.getElementById('v184-input');
  const result = document.getElementById('v184-result');
  if (!inp || !result) return;
  const symbols = inp.value.split(/[,，\s]+/).map(s => s.trim()).filter(Boolean).slice(0, 5);
  if (symbols.length < 2){ result.innerHTML = '<div style="color:#ef4444;font-size:12px">請輸入至少 2 個代號</div>'; return; }
  result.innerHTML = '<div style="color:#94a3b8;font-size:13px">查詢中...</div>';

  try{
    const r = await fetch((typeof AI_PROXY_URL!=='undefined' ? AI_PROXY_URL : 'https://moneyradar-ai-proxy.thinkbigtw.workers.dev') + '/quote', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ symbols })
    });
    const data = await r.json();
    const rows = (data.results || []).map(d => {
      if (d.error) return '<tr><td style="padding:8px;color:#64748b">' + (d.symbol||'') + '</td><td colspan="4" style="padding:8px;color:#ef4444">無資料</td></tr>';
      const isUp = (d.pct||0) >= 0;
      return '<tr><td style="padding:8px;color:#e2e8f0;font-weight:600">' + d.symbol + '</td><td style="padding:8px;color:#94a3b8">' + (d.name||'').slice(0,20) + '</td><td style="padding:8px;font-weight:600;color:' + (isUp?'#22c55e':'#ef4444') + '">' + (d.price?Number(d.price).toFixed(2):'—') + '</td><td style="padding:8px;font-weight:600;color:' + (isUp?'#22c55e':'#ef4444') + '">' + (isUp?'+':'') + (d.pct?d.pct.toFixed(2):'0') + '%</td><td style="padding:8px;color:#64748b;font-size:11px">' + (d.currency||'') + '</td></tr>';
    }).join('');
    result.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#1e293b;color:#94a3b8;text-align:left"><th style="padding:8px">代號</th><th style="padding:8px">名稱</th><th style="padding:8px">當前</th><th style="padding:8px">漲跌</th><th style="padding:8px">幣別</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }catch(e){
    result.innerHTML = '<div style="color:#ef4444;font-size:12px">查詢失敗：' + String(e.message||e) + '</div>';
  }
}

// 在 tools 分頁加按鈕
function v184AddCompareButton(){
  const toolsTab = document.getElementById('tab-tools');
  if (!toolsTab || toolsTab.querySelector('#v184-compare-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'v184-compare-btn';
  btn.type = 'button';
  btn.textContent = '📊 開啟多股比較器';
  btn.style.cssText = 'width:100%;background:linear-gradient(135deg,#1e3a8a,#1e40af);color:#dbeafe;border:1px solid #2563eb;border-radius:10px;padding:14px;cursor:pointer;font-size:14px;font-weight:700;margin-bottom:14px;font-family:inherit';
  btn.addEventListener('click', v184OpenCompareModal);
  toolsTab.insertBefore(btn, toolsTab.firstChild);
}

// ─────── v186: PWA Service Worker 註冊 ───────
function v186RegisterPWA(){
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/lab/sw.js', { scope: '/lab/' })
    .then(() => console.log('[PWA] Service Worker registered'))
    .catch(e => console.warn('[PWA] SW register failed', e));
}

// ─────── 全部 Auto-bind ───────
function v183_186AutoBind(){
  // v184 加比較器按鈕
  v184AddCompareButton();
  const toolsTab = document.getElementById('tab-tools');
  if (toolsTab && !toolsTab.dataset.v184Watched) {
    toolsTab.dataset.v184Watched = '1';
    new MutationObserver(() => v184AddCompareButton()).observe(toolsTab, { attributes: true, attributeFilter: ['style'] });
  }
  // v186 註冊 PWA
  v186RegisterPWA();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(v183_186AutoBind, 1800));
} else {
  setTimeout(v183_186AutoBind, 1800);
}


// ===== v188: Hide AI Bubble When Not Logged In (auto-inserted) =====
function v188SyncBubbleVisibility(){
  const bubble = document.getElementById('mr-chat-bubble');
  const panel = document.getElementById('mr-chat-panel');
  if (!bubble) return;

  // 檢查 currentUser 全域變數（NEO 既有 user state）
  const isLoggedIn = (typeof currentUser !== 'undefined' && currentUser !== null && currentUser !== '');

  if (isLoggedIn) {
    bubble.style.display = 'flex';
  } else {
    bubble.style.display = 'none';
    if (panel) panel.classList.remove('open');
  }
}

// 啟動：每 2 秒同步一次（捕捉登入/登出）
setInterval(v188SyncBubbleVisibility, 2000);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(v188SyncBubbleVisibility, 200));
} else {
  setTimeout(v188SyncBubbleVisibility, 200);
}


// ===== Sprint A: v189-192 (Closing + Chips + Revenue + Multi-TF Tech) =====

// 共用 sparkline（v177 已有但這裡再保留一份，獨立避免依賴）
function v189Sparkline(values, color){
  if (!Array.isArray(values) || values.length < 2) return '';
  const valid = values.filter(v => v != null && !isNaN(Number(v))).map(Number);
  if (valid.length < 2) return '';
  const w = 80, h = 24;
  const min = Math.min(...valid), max = Math.max(...valid);
  const range = (max - min) || 1;
  const points = valid.map((v, i) => {
    const x = (i / (valid.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return x.toFixed(1) + ',' + y.toFixed(1);
  }).join(' ');
  // 0 線（如果有）
  const zeroLine = (min < 0 && max > 0) ? '<line x1="0" y1="' + (h - (0 - min) / range * h).toFixed(1) + '" x2="' + w + '" y2="' + (h - (0 - min) / range * h).toFixed(1) + '" stroke="#475569" stroke-width="0.5" stroke-dasharray="2,2"/>' : '';
  return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' + zeroLine + '<polyline points="' + points + '" fill="none" stroke="' + (color || '#3b82f6') + '" stroke-width="1.5" stroke-linejoin="round"/></svg>';
}

// ─────── v189: 盤後成交量 + 三大法人合計 ───────
async function loadClosingSummary(){
  const el = document.getElementById('closing-summary');
  if (!el) return;
  el.innerHTML = '<div style="background:#0f172a;border-radius:10px;padding:14px 18px;border:1px solid #1e293b"><div style="font-size:11px;color:#64748b">📊 盤後摘要 · 載入中...</div></div>';

  try{
    // 抓最近 5 個交易日的 volume（按 date desc，limit 較小避免 PostgREST 限制）
    const rDates = await fetch(BASE+'/daily_prices?symbol=eq.TAIEX&order=date.desc&limit=5&select=date',{headers:SB_H});
    const datesData = await rDates.json();
    if(!Array.isArray(datesData) || datesData.length === 0) throw new Error('no TAIEX dates');
    const dateList = datesData.map(d => d.date).filter(Boolean);
    const r1 = await fetch(BASE+'/daily_prices?symbol=neq.TAIEX&date=in.(' + dateList.join(',') + ')&select=date,volume&limit=1000',{headers:SB_H});
    const prices = await r1.json();
    if(!Array.isArray(prices) || prices.length === 0) throw new Error('no prices');

    // 按 date group sum volume
    const volByDate = {};
    prices.forEach(p => {
      const v = Number(p.volume) || 0;
      volByDate[p.date] = (volByDate[p.date] || 0) + v;
    });
    const sortedDates = Object.keys(volByDate).sort().reverse();
    const last5Vol = sortedDates.slice(0, 5).map(d => volByDate[d]);
    const todayVol = last5Vol[0] || 0;
    const avg5Vol = last5Vol.length > 0 ? last5Vol.reduce((s,v) => s+v, 0) / last5Vol.length : 1;
    const volRatio = avg5Vol > 0 ? (todayVol / avg5Vol * 100).toFixed(1) : 0;

    // 抓三大法人合計（最新一天）
    const rDate = await fetch(BASE+'/institutional_investors?order=date.desc&limit=1&select=date',{headers:SB_H});
    const dDate = await rDate.json();
    const lastDate = (Array.isArray(dDate) && dDate[0]) ? dDate[0].date : null;

    let totalForeign = 0, totalTrust = 0, totalDealer = 0, totalAll = 0;
    if(lastDate){
      const ri = await fetch(BASE+'/institutional_investors?date=eq.'+lastDate+'&select=foreign_buy,investment_trust_buy,dealer_buy,total_buy&limit=3000',{headers:SB_H});
      const data = await ri.json();
      if(Array.isArray(data)){
        data.forEach(d => {
          totalForeign += Number(d.foreign_buy) || 0;
          totalTrust += Number(d.investment_trust_buy) || 0;
          totalDealer += Number(d.dealer_buy) || 0;
          totalAll += Number(d.total_buy) || 0;
        });
      }
    }
    const fgLot = Math.round(totalForeign / 1000);
    const trLot = Math.round(totalTrust / 1000);
    const dlLot = Math.round(totalDealer / 1000);
    const allLot = Math.round(totalAll / 1000);

    const fmtLot = (n) => (n >= 0 ? '+' : '') + n.toLocaleString() + ' 張';
    const colorOf = (n) => n >= 0 ? '#22c55e' : '#ef4444';

    el.innerHTML = '<div style="background:linear-gradient(135deg,#0f172a,#1e293b);border-radius:10px;padding:14px 18px;border:1px solid #1e3a5f">'
      + '<div style="font-size:11px;font-weight:700;color:#fbbf24;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:12px">📊 盤後摘要 · ' + (lastDate || '') + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px">'
      // 成交量
      + '<div style="background:#0a1421;border-radius:8px;padding:10px 12px;border:1px solid #1e2d45"><div style="font-size:11px;color:#64748b">大盤總成交量 (今日)</div><div style="font-size:14px;font-weight:700;color:#e2e8f0">' + (todayVol/1e8).toFixed(1) + ' 億</div><div style="font-size:11px;color:' + (volRatio >= 100 ? '#22c55e' : '#ef4444') + '">vs 5日均量 ' + volRatio + '%</div></div>'
      // 三大法人合計
      + '<div style="background:#0a1421;border-radius:8px;padding:10px 12px;border:1px solid #1e2d45"><div style="font-size:11px;color:#64748b">三大法人合計</div><div style="font-size:14px;font-weight:700;color:' + colorOf(allLot) + '">' + fmtLot(allLot) + '</div><div style="font-size:11px;color:#64748b">外+投+自</div></div>'
      // 外資
      + '<div style="background:#0a1421;border-radius:8px;padding:10px 12px;border:1px solid #1e2d45"><div style="font-size:11px;color:#64748b">外資</div><div style="font-size:13px;font-weight:700;color:' + colorOf(fgLot) + '">' + fmtLot(fgLot) + '</div></div>'
      + '<div style="background:#0a1421;border-radius:8px;padding:10px 12px;border:1px solid #1e2d45"><div style="font-size:11px;color:#64748b">投信</div><div style="font-size:13px;font-weight:700;color:' + colorOf(trLot) + '">' + fmtLot(trLot) + '</div></div>'
      + '<div style="background:#0a1421;border-radius:8px;padding:10px 12px;border:1px solid #1e2d45"><div style="font-size:11px;color:#64748b">自營商</div><div style="font-size:13px;font-weight:700;color:' + colorOf(dlLot) + '">' + fmtLot(dlLot) + '</div></div>'
      + '</div></div>';
  }catch(e){
    el.innerHTML = '<div style="background:#0f172a;border-radius:10px;padding:14px 18px;border:1px solid #1e293b;font-size:11px;color:#64748b">📊 盤後摘要：' + (e.message || '載入失敗') + '</div>';
    console.warn('[Closing]', e);
  }
}

// ─────── v190: 個股法人籌碼深度（30 天三大法人 sparkline） ───────
async function loadStockChips(code){
  const newsEl = document.getElementById('stockNews');
  if (!newsEl) return;
  let box = document.getElementById('stockChipsBox');
  if (!box){
    box = document.createElement('div');
    box.id = 'stockChipsBox';
    box.style.marginTop = '12px';
    const anchor = document.getElementById('stockTechBox') || document.getElementById('stockAnalysisBox') || newsEl;
    anchor.parentNode.insertBefore(box, anchor.nextSibling);
  }
  box.innerHTML = '<div style="background:#0f172a;border-radius:8px;padding:14px 16px;border:1px solid #1e293b"><div style="font-size:13px;color:#3b82f6;font-weight:700">🏛 法人籌碼深度 · 載入中...</div></div>';

  try{
    const r = await fetch(BASE+'/institutional_investors?symbol=eq.'+code+'&order=date.desc&limit=30&select=date,foreign_buy,investment_trust_buy,dealer_buy,total_buy',{headers:SB_H});
    const raw = await r.json();
    if(!Array.isArray(raw) || raw.length === 0){
      box.innerHTML = '<div style="background:#0f172a;border-radius:8px;padding:14px 16px;border:1px solid #1e293b"><div style="font-size:13px;color:#3b82f6;font-weight:700;margin-bottom:6px">🏛 法人籌碼深度</div><div style="font-size:12px;color:#64748b">尚無法人籌碼資料</div></div>';
      return;
    }
    // 按 date 排序（舊→新）
    const data = [...raw].sort((a,b) => (a.date||'').localeCompare(b.date||''));
    const fgSeries = data.map(d => Number(d.foreign_buy) / 1000); // 轉張
    const trSeries = data.map(d => Number(d.investment_trust_buy) / 1000);
    const dlSeries = data.map(d => Number(d.dealer_buy) / 1000);

    // 累計
    const sum7 = (arr) => arr.slice(-7).reduce((s,v) => s + (Number(v)||0), 0);
    const sum30 = (arr) => arr.reduce((s,v) => s + (Number(v)||0), 0);

    const fgAcc7 = Math.round(sum7(fgSeries)), fgAcc30 = Math.round(sum30(fgSeries));
    const trAcc7 = Math.round(sum7(trSeries)), trAcc30 = Math.round(sum30(trSeries));
    const dlAcc7 = Math.round(sum7(dlSeries)), dlAcc30 = Math.round(sum30(dlSeries));

    const fmt = (n) => (n >= 0 ? '+' : '') + n.toLocaleString();
    const colorOf = (n) => n >= 0 ? '#22c55e' : '#ef4444';

    box.innerHTML = '<div style="background:linear-gradient(135deg,#0a1421,#0f172a);border-radius:8px;padding:14px 16px;border:1px solid #2563eb;margin-top:12px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">'
      + '<span style="font-size:13px;color:#3b82f6;font-weight:700;border-left:3px solid #2563eb;padding-left:8px">🏛 法人籌碼深度</span>'
      + '<span style="font-size:10px;color:#64748b">最近 ' + data.length + ' 個交易日</span>'
      + '</div>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px">'
      // 外資
      + '<div style="background:#0f172a;border-radius:6px;padding:10px;border:1px solid #1e2d45">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px"><span style="font-size:11px;color:#94a3b8;font-weight:600">外資</span>' + v189Sparkline(fgSeries, '#22c55e') + '</div>'
      + '<div style="font-size:11px;color:#64748b">7日 <span style="color:' + colorOf(fgAcc7) + ';font-weight:700">' + fmt(fgAcc7) + '</span> 張</div>'
      + '<div style="font-size:11px;color:#64748b">30日 <span style="color:' + colorOf(fgAcc30) + ';font-weight:700">' + fmt(fgAcc30) + '</span> 張</div>'
      + '</div>'
      // 投信
      + '<div style="background:#0f172a;border-radius:6px;padding:10px;border:1px solid #1e2d45">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px"><span style="font-size:11px;color:#94a3b8;font-weight:600">投信</span>' + v189Sparkline(trSeries, '#a78bfa') + '</div>'
      + '<div style="font-size:11px;color:#64748b">7日 <span style="color:' + colorOf(trAcc7) + ';font-weight:700">' + fmt(trAcc7) + '</span> 張</div>'
      + '<div style="font-size:11px;color:#64748b">30日 <span style="color:' + colorOf(trAcc30) + ';font-weight:700">' + fmt(trAcc30) + '</span> 張</div>'
      + '</div>'
      // 自營商
      + '<div style="background:#0f172a;border-radius:6px;padding:10px;border:1px solid #1e2d45">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px"><span style="font-size:11px;color:#94a3b8;font-weight:600">自營商</span>' + v189Sparkline(dlSeries, '#fbbf24') + '</div>'
      + '<div style="font-size:11px;color:#64748b">7日 <span style="color:' + colorOf(dlAcc7) + ';font-weight:700">' + fmt(dlAcc7) + '</span> 張</div>'
      + '<div style="font-size:11px;color:#64748b">30日 <span style="color:' + colorOf(dlAcc30) + ';font-weight:700">' + fmt(dlAcc30) + '</span> 張</div>'
      + '</div>'
      + '</div></div>';
  }catch(e){
    if(box) box.innerHTML = '';
    console.warn('[Chips]', e);
  }
}

// ─────── v191: 月營收 sparkline + YoY ───────
async function loadStockRevenueChart(code){
  const newsEl = document.getElementById('stockNews');
  if (!newsEl) return;
  let box = document.getElementById('stockRevenueBox');
  if (!box){
    box = document.createElement('div');
    box.id = 'stockRevenueBox';
    box.style.marginTop = '12px';
    const anchor = document.getElementById('stockChipsBox') || document.getElementById('stockTechBox') || newsEl;
    anchor.parentNode.insertBefore(box, anchor.nextSibling);
  }
  box.innerHTML = '<div style="background:#0f172a;border-radius:8px;padding:14px 16px;border:1px solid #1e293b"><div style="font-size:13px;color:#10b981;font-weight:700">💰 月營收趨勢 · 載入中...</div></div>';

  try{
    // v194: 正確 schema 是 year_month/revenue/yoy_pct/mom_pct
    const r = await fetch(BASE+'/monthly_revenue?symbol=eq.'+code+'&order=year_month.desc&limit=12&select=year_month,revenue,yoy_pct,mom_pct',{headers:SB_H});
    const raw = await r.json();
    if(!Array.isArray(raw) || raw.length === 0){
      box.innerHTML = '<div style="background:#0f172a;border-radius:8px;padding:14px 16px;border:1px solid #1e293b"><div style="font-size:13px;color:#10b981;font-weight:700;margin-bottom:6px">💰 月營收趨勢</div><div style="font-size:12px;color:#64748b">尚無月營收資料</div></div>';
      return;
    }

    const data = [...raw].sort((a,b) => ((a.year_month||'')+'').localeCompare((b.year_month||'')+''));
    const revSeries = data.map(d => Number(d.revenue) || 0);
    const latest = data[data.length-1] || {};
    const latestRev = Number(latest.revenue) || 0;
    const latestYoy = Number(latest.yoy_pct) || 0;
    const latestMom = Number(latest.mom_pct) || 0;
    const yoyColor = latestYoy >= 0 ? '#22c55e' : '#ef4444';
    const momColor = latestMom >= 0 ? '#22c55e' : '#ef4444';

    box.innerHTML = '<div style="background:linear-gradient(135deg,#022c22,#0f172a);border-radius:8px;padding:14px 16px;border:1px solid #047857;margin-top:12px">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">'
      + '<span style="font-size:13px;color:#10b981;font-weight:700;border-left:3px solid #10b981;padding-left:8px">💰 月營收趨勢</span>'
      + '<span style="font-size:10px;color:#64748b">最近 ' + data.length + ' 個月</span>'
      + '</div>'
      + '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">'
      + '<div>' + v189Sparkline(revSeries, '#10b981') + '</div>'
      + '<div><div style="font-size:11px;color:#64748b">最新月營收</div><div style="font-size:15px;font-weight:700;color:#a7f3d0">' + (latestRev/1e8).toFixed(2) + ' 億</div></div>'
      + '<div><div style="font-size:11px;color:#64748b">YoY</div><div style="font-size:14px;font-weight:700;color:' + yoyColor + '">' + (latestYoy >= 0 ? '+' : '') + latestYoy.toFixed(2) + '%</div></div>'
      + '<div><div style="font-size:11px;color:#64748b">MoM</div><div style="font-size:14px;font-weight:700;color:' + momColor + '">' + (latestMom >= 0 ? '+' : '') + latestMom.toFixed(2) + '%</div></div>'
      + '</div></div>';
  }catch(e){
    if(box) box.innerHTML = '';
    console.warn('[Revenue]', e);
  }
}

// ─────── v192: 多時間框架技術指標（加 MACD）───────
function v192ComputeMACD(closes){
  if (!Array.isArray(closes) || closes.length < 26) return null;
  function ema(values, period){
    const k = 2 / (period + 1);
    let e = values[0];
    for (let i = 1; i < values.length; i++) e = values[i] * k + e * (1 - k);
    return e;
  }
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macd = ema12 - ema26;
  // signal = 9 日 EMA of MACD（簡化版只算當前）
  return {
    macd: Number(macd.toFixed(2)),
    label: macd >= 0 ? '正值（中性偏多）' : '負值（中性偏空）'
  };
}

async function loadMACDIndicator(code){
  const techBox = document.getElementById('stockTechBox');
  if (!techBox) return;
  // 找 tech box 內加 MACD 卡
  if (techBox.querySelector('[data-v192-macd]')) return;

  try{
    const r = await fetch(BASE+'/daily_prices?symbol=eq.'+code+'&order=date.desc&limit=60&select=close_price',{headers:SB_H});
    const data = await r.json();
    if(!Array.isArray(data) || data.length < 26) return;
    const closes = data.map(p => Number(p.close_price)).reverse();
    const macd = v192ComputeMACD(closes);
    if (!macd) return;

    const lblColor = macd.macd >= 0 ? '#22c55e' : '#ef4444';
    const macdCard = document.createElement('div');
    macdCard.setAttribute('data-v192-macd', '1');
    macdCard.style.cssText = 'background:#0a1421;border-radius:6px;padding:10px;border:1px solid #1e2d45';
    macdCard.innerHTML = '<div style="font-size:11px;color:#94a3b8">MACD(12,26)</div><div style="font-size:18px;font-weight:700;color:#e2e8f0">' + macd.macd + '</div><div style="font-size:11px;color:' + lblColor + '">' + macd.label + '</div>';

    // 找 grid 加進去
    const grid = techBox.querySelector('[style*="grid-template-columns"]');
    if (grid) grid.appendChild(macdCard);
  }catch(e){ console.warn('[MACD]', e); }
}

// 啟動：v189 在 dashboard 載入；v190+v191+v192 在個股查詢時觸發
function v189_192Init(){
  if (document.getElementById('closing-summary')) loadClosingSummary();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(v189_192Init, 1500));
} else {
  setTimeout(v189_192Init, 1500);
}


// ===== Sprint B v195-v197: Full K-Chart + Treemap + PWA Cache =====
async function loadFullCandleChart(code){
  try {
    const host = document.getElementById('stock-detail') || document.getElementById('search-result') || document.body;
    let box = document.getElementById('full-candle-chart-v195');
    if (!box) {
      box = document.createElement('div');
      box.id = 'full-candle-chart-v195';
      box.style.cssText = 'margin:16px 0;padding:14px;border:2px solid #f59e0b;border-radius:12px;background:linear-gradient(180deg,#fffbeb,#fff);';
      box.innerHTML = '<div style="font-weight:700;color:#b45309;margin-bottom:8px;">📈 完整 K 線（60 日，含 SMA20 + 布林通道）</div><div id="fcc-body-v195" style="color:#92400e;font-size:13px;">載入中…</div>';
      host.appendChild(box);
    }
    const body = document.getElementById('fcc-body-v195');
    body.textContent = '載入中…';
    const sb = (window.SUPABASE_URL || 'https://gvscndrxmihaffbwgmku.supabase.co');
    const key = (window.SUPABASE_ANON_KEY || '');
    const url = sb + '/rest/v1/daily_prices?stock_code=eq.' + encodeURIComponent(code) +
                '&select=date,open_price,high_price,low_price,close_price&order=date.desc&limit=60';
    const r = await fetch(url, { headers: key ? { apikey: key, Authorization: 'Bearer ' + key } : {} });
    if (!r.ok) { body.textContent = '無資料'; return; }
    const rows = await r.json();
    if (!rows || rows.length < 5) { body.textContent = '資料不足（需 ≥ 5 日）'; return; }
    const prices = rows.map(x => ({
      date: x.date, o: +x.open_price, h: +x.high_price, l: +x.low_price, c: +x.close_price
    })).filter(x => isFinite(x.o) && isFinite(x.c));
    body.innerHTML = v195RenderCandleSVG(prices);
  } catch(e){
    const body = document.getElementById('fcc-body-v195');
    if (body) {
      body.innerHTML = '<div style="color:#dc2626;">載入失敗：' + (e.message || e) + '</div><div style="font-size:11px;color:#6b7280;margin-top:4px;">已自動 retry，仍失敗請重新整理</div>';
      console.error('[v196 Treemap]', e);
    }
  }
}

function v195RenderCandleSVG(prices){
  const sorted = [...prices].sort((a,b) => (a.date||'').localeCompare(b.date||''));
  if (sorted.length < 5) return '<div>資料不足</div>';
  const W = 640, H = 300, padTop = 10, padBot = 30, padL = 50, padR = 10;
  const innerW = W - padL - padR;
  const innerH = H - padTop - padBot;
  const closes = sorted.map(p => p.c);
  // SMA20
  const sma = closes.map((_, i) => {
    if (i < 19) return null;
    let s = 0; for (let k = i-19; k <= i; k++) s += closes[k];
    return s / 20;
  });
  // BB20 (2σ)
  const bbU = [], bbL = [];
  for (let i = 0; i < closes.length; i++){
    if (i < 19) { bbU.push(null); bbL.push(null); continue; }
    const m = sma[i];
    let v = 0; for (let k = i-19; k <= i; k++) v += (closes[k]-m)*(closes[k]-m);
    const sd = Math.sqrt(v/20);
    bbU.push(m + 2*sd); bbL.push(m - 2*sd);
  }
  const allHi = sorted.map(p => p.h).concat(bbU.filter(x=>x!=null));
  const allLo = sorted.map(p => p.l).concat(bbL.filter(x=>x!=null));
  const yMax = Math.max(...allHi);
  const yMin = Math.min(...allLo);
  const range = (yMax - yMin) || 1;
  const cw = Math.max(2, innerW / sorted.length - 2);
  const x = (i) => padL + i * (innerW / sorted.length) + (innerW / sorted.length - cw) / 2;
  const y = (v) => padTop + (1 - (v - yMin) / range) * innerH;
  // candles
  const candles = sorted.map((p, i) => {
    const up = p.c >= p.o;
    const color = up ? '#16a34a' : '#dc2626';
    const top = y(Math.max(p.o, p.c));
    const bot = y(Math.min(p.o, p.c));
    const wickTop = y(p.h), wickBot = y(p.l);
    const cx = x(i) + cw/2;
    return `<line x1="${cx}" x2="${cx}" y1="${wickTop}" y2="${wickBot}" stroke="${color}" stroke-width="1"/>` +
           `<rect x="${x(i)}" y="${top}" width="${cw}" height="${Math.max(1, bot-top)}" fill="${color}"/>`;
  }).join('');
  // lines
  const linePath = (arr, color, dash) => {
    let d = ''; let started = false;
    arr.forEach((v, i) => {
      if (v == null) return;
      const px = x(i) + cw/2, py = y(v);
      d += (started ? 'L' : 'M') + px.toFixed(1) + ',' + py.toFixed(1) + ' ';
      started = true;
    });
    return d ? `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6"${dash?' stroke-dasharray="4,3"':''}/>` : '';
  };
  const smaPath = linePath(sma, '#eab308', false);
  const bbUPath = linePath(bbU, '#a855f7', true);
  const bbLPath = linePath(bbL, '#a855f7', true);
  // y axis labels
  const yLabels = [yMax, (yMax+yMin)/2, yMin].map(v =>
    `<text x="6" y="${y(v)+3}" fill="#92400e" font-size="10">${v.toFixed(2)}</text>`
  ).join('');
  // x axis (first/middle/last)
  const xIdx = [0, Math.floor(sorted.length/2), sorted.length-1];
  const xLabels = xIdx.map(i => {
    const d = (sorted[i].date || '').slice(5);
    return `<text x="${x(i)}" y="${H-8}" fill="#92400e" font-size="10">${d}</text>`;
  }).join('');
  const legend = `<rect x="${padL+10}" y="${padTop+4}" width="10" height="10" fill="#eab308"/><text x="${padL+24}" y="${padTop+13}" fill="#92400e" font-size="11">SMA20</text>` +
    `<rect x="${padL+90}" y="${padTop+4}" width="10" height="10" fill="#a855f7"/><text x="${padL+104}" y="${padTop+13}" fill="#92400e" font-size="11">布林 ±2σ</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px;height:auto;">` +
         `<rect x="0" y="0" width="${W}" height="${H}" fill="white"/>` +
         candles + smaPath + bbUPath + bbLPath + yLabels + xLabels + legend +
         `</svg>` +
         `<div style="font-size:11px;color:#92400e;margin-top:4px;">資料：Supabase daily_prices · 黃色 SMA20 · 紫色虛線 = Bollinger Band (20, 2σ)</div>`;
}

async function loadIndustryTreemap(){
  // V196_RETRY_GUARD
  const _key = (window.SUPABASE_ANON_KEY || '');
  if (!_key) {
    if (!window.__v196Retry) window.__v196Retry = 0;
    window.__v196Retry++;
    console.warn('[v196] SUPABASE_ANON_KEY not ready, retry ' + window.__v196Retry);
    if (window.__v196Retry > 5) {
      const b = document.getElementById('itm-body-v196');
      if (b) b.innerHTML = '<div style="color:#dc2626;">Supabase 金鑰未載入，請重新整理頁面</div>';
      return;
    }
    setTimeout(() => loadIndustryTreemap(), 2000);
    return;
  }
  try {
    let box = document.getElementById('industry-treemap-v196');
    if (!box) {
      const host = document.getElementById('industry-heatmap') || document.getElementById('hot-stocks-section') || document.body;
      box = document.createElement('div');
      box.id = 'industry-treemap-v196';
      box.style.cssText = 'margin:16px 0;padding:14px;border:2px solid #6366f1;border-radius:12px;background:linear-gradient(180deg,#eef2ff,#fff);';
      box.innerHTML = '<div style="font-weight:700;color:#4338ca;margin-bottom:8px;">🗺 產業 Treemap（依平均漲跌幅）</div><div id="itm-body-v196" style="color:#3730a3;font-size:13px;">載入中…</div>';
      host.parentNode ? host.parentNode.insertBefore(box, host.nextSibling) : host.appendChild(box);
    }
    const body = document.getElementById('itm-body-v196');
    if (!window.v196IndustryData) {
      // fetch fresh: avg pct per industry from latest two days
      const sb = (window.SUPABASE_URL || 'https://gvscndrxmihaffbwgmku.supabase.co');
      const key = (window.SUPABASE_ANON_KEY || '');
      const dr = await fetch(sb + '/rest/v1/daily_prices?select=date&order=date.desc&limit=2', {
        headers: key ? { apikey: key, Authorization: 'Bearer ' + key } : {}
      });
      const dRows = await dr.json();
      if (!dRows || dRows.length < 2) { body.textContent = '資料不足'; return; }
      const today = dRows[0].date, yest = dRows[1].date;
      const dpr = await fetch(sb + '/rest/v1/daily_prices?date=in.(' + today + ',' + yest + ')&select=stock_code,date,close_price', {
        headers: key ? { apikey: key, Authorization: 'Bearer ' + key } : {}
      });
      const dp = await dpr.json();
      const sr = await fetch(sb + '/rest/v1/stocks?select=stock_code,industry', {
        headers: key ? { apikey: key, Authorization: 'Bearer ' + key } : {}
      });
      const stocks = await sr.json();
      const indMap = {}; stocks.forEach(x => { indMap[x.stock_code] = x.industry || '其他'; });
      const t = {}, y = {};
      dp.forEach(r => { (r.date === today ? t : y)[r.stock_code] = +r.close_price; });
      const indPct = {};
      Object.keys(t).forEach(c => {
        if (y[c] && y[c] > 0) {
          const pct = (t[c] - y[c]) / y[c] * 100;
          const ind = indMap[c] || '其他';
          if (!indPct[ind]) indPct[ind] = [];
          indPct[ind].push(pct);
        }
      });
      const arr = Object.entries(indPct).map(([k, v]) => ({
        name: k, avg: v.reduce((a,b)=>a+b,0)/v.length, n: v.length
      })).filter(x => x.n >= 1).sort((a,b) => Math.abs(b.avg) - Math.abs(a.avg)).slice(0, 16);
      window.v196IndustryData = arr;
    }
    const arr = window.v196IndustryData;
    if (!arr || arr.length === 0) { body.textContent = '無產業資料'; return; }
    // simple slice-and-dice treemap by |avg|+0.5 weight
    const total = arr.reduce((s,x) => s + (Math.abs(x.avg) + 0.5), 0);
    const W = 640, H = 240;
    let xPos = 0;
    const rects = arr.map(x => {
      const w = (Math.abs(x.avg) + 0.5) / total * W;
      const fill = x.avg > 0 ? `rgba(220,38,38,${Math.min(0.9, 0.25 + Math.abs(x.avg)/5)})`
                              : `rgba(22,163,74,${Math.min(0.9, 0.25 + Math.abs(x.avg)/5)})`;
      const r = `<g><rect x="${xPos}" y="0" width="${w-1}" height="${H}" fill="${fill}"/>` +
        `<text x="${xPos + w/2}" y="${H/2 - 6}" text-anchor="middle" fill="white" font-size="13" font-weight="700">${x.name}</text>` +
        `<text x="${xPos + w/2}" y="${H/2 + 14}" text-anchor="middle" fill="white" font-size="12">${x.avg>=0?'+':''}${x.avg.toFixed(2)}%</text>` +
        `<text x="${xPos + w/2}" y="${H/2 + 30}" text-anchor="middle" fill="white" font-size="10" opacity="0.85">${x.n}檔</text></g>`;
      xPos += w;
      return r;
    }).join('');
    body.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;border-radius:8px;">${rects}</svg>` +
      `<div style="font-size:11px;color:#3730a3;margin-top:6px;">紅 = 產業整體上漲 · 綠 = 下跌 · 寬度 ∝ 漲跌幅度（最多 16 個產業）</div>`;
  } catch(e){
    const body = document.getElementById('itm-body-v196');
    if (body) {
      body.innerHTML = '<div style="color:#dc2626;">載入失敗：' + (e.message || e) + '</div><div style="font-size:11px;color:#6b7280;margin-top:4px;">已自動 retry，仍失敗請重新整理</div>';
      console.error('[v196 Treemap]', e);
    }
  }
}

// auto-trigger Treemap after Industry Heatmap loads
(function v196AutoTrigger(){
  if (window.__v196Wired) return;
  window.__v196Wired = true;
  setTimeout(loadIndustryTreemap, 4000);
})();

// ===== v198 Resilience: Global Error Handler =====
(function(){
  if (window.__v198) return;
  window.__v198 = true;
  const E = [];
  window.addEventListener('error', e => {
    E.push({ t: Date.now(), m: e.message, f: e.filename, l: e.lineno });
    if (E.length > 50) E.shift();
    console.warn('[v198 error]', e.message);
  });
  window.addEventListener('unhandledrejection', e => {
    E.push({ t: Date.now(), m: String(e.reason) });
    if (E.length > 50) E.shift();
    console.warn('[v198 promise]', e.reason);
  });
  window.__getErrors = () => E;
  window.__online = navigator.onLine;
  window.addEventListener('online', () => { window.__online = true; });
  window.addEventListener('offline', () => { window.__online = false; });
  console.log('[v198] resilience layer active');
})();

// ===== v199 Sprint D: Global Markets (KR/AU/EU) =====
window.V199_MARKETS = {
  kr: { flag:'🇰🇷', name:'韓國 KOSPI', symbols:[
    {s:'005930.KS', n:'三星電子'},
    {s:'000660.KS', n:'SK 海力士'},
    {s:'005380.KS', n:'現代汽車'},
    {s:'051910.KS', n:'LG 化學'},
    {s:'035420.KS', n:'Naver'}
  ]},
  au: { flag:'🇦🇺', name:'澳洲 ASX', symbols:[
    {s:'BHP.AX', n:'BHP 必和必拓'},
    {s:'CBA.AX', n:'澳洲聯邦銀行'},
    {s:'CSL.AX', n:'CSL 生技'},
    {s:'WBC.AX', n:'西太平洋銀行'},
    {s:'RIO.AX', n:'Rio Tinto'}
  ]},
  eu: { flag:'🇪🇺', name:'歐洲精選', symbols:[
    {s:'ASML.AS', n:'ASML 艾司摩爾'},
    {s:'MC.PA', n:'LVMH'},
    {s:'NESN.SW', n:'Nestlé'},
    {s:'SAP.DE', n:'SAP'},
    {s:'NOVO-B.CO', n:'Novo Nordisk'}
  ]}
};
async function v199LoadGlobalMarkets(){
  const host = document.getElementById('tab-asia');
  if (!host) return;
  if (document.getElementById('v199-global-box')) return;
  const box = document.createElement('div');
  box.id = 'v199-global-box';
  box.style.cssText = 'margin-top:24px;padding:16px;border:2px solid #14b8a6;border-radius:12px;background:linear-gradient(180deg,#f0fdfa,#fff);';
  box.innerHTML = '<div style="font-weight:700;color:#0f766e;font-size:16px;margin-bottom:6px;">🌍 全球延伸（韓 / 澳 / 歐）</div><div style="font-size:11px;color:#0f766e;margin-bottom:12px;">資料：Yahoo Finance 公開報價（延遲 15 分鐘）</div><div id="v199-global-body">載入中…</div>';
  host.appendChild(box);
  const body = document.getElementById('v199-global-body');
  body.innerHTML = '';
  const proxy = 'https://moneyradar-ai-proxy.thinkbigtw.workers.dev/quote?symbol=';
  for (const key of ['us','kr','au','eu']) {
    const m = window.V199_MARKETS[key];
    const sec = document.createElement('div');
    sec.style.cssText = 'margin-bottom:14px;';
    sec.innerHTML = '<div style="font-weight:600;color:#0f766e;margin-bottom:6px;">' + m.flag + ' ' + m.name + '</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;" id="v199-' + key + '"></div>';
    body.appendChild(sec);
    const grid = document.getElementById('v199-' + key);
    m.symbols.forEach(sym => {
      const safeId = 'px-' + sym.s.replace(/[^A-Za-z0-9]/g, '_');
      const card = document.createElement('div');
      card.style.cssText = 'padding:10px;border:1px solid #e5e7eb;border-radius:8px;background:white;';
      card.innerHTML = '<div style="font-size:11px;color:#6b7280;">' + sym.s + '</div><div style="font-weight:600;font-size:13px;">' + sym.n + '</div><div id="' + safeId + '" style="margin-top:4px;color:#9ca3af;font-size:11px;">載入…</div>';
      grid.appendChild(card);
      fetch(proxy + encodeURIComponent(sym.s))
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          const el = document.getElementById(safeId);
          if (!el) return;
          if (!d || !d.price) { el.textContent = 'N/A'; return; }
          const pct = d.changePercent || 0;
          const color = pct >= 0 ? '#dc2626' : '#16a34a';
          const sign = pct >= 0 ? '+' : '';
          el.innerHTML = '<span style="color:' + color + ';font-weight:600;">' + Number(d.price).toFixed(2) + '</span> <span style="color:' + color + ';font-size:10px;">(' + sign + pct.toFixed(2) + '%)</span>';
        })
        .catch(() => {
          const el = document.getElementById(safeId);
          if (el) el.textContent = 'N/A';
        });
    });
  }
}
(function(){
  setInterval(() => {
    const t = document.getElementById('tab-asia');
    if (t && getComputedStyle(t).display !== 'none' && !window.__v199Loaded) {
      window.__v199Loaded = true;
      v199LoadGlobalMarkets();
    }
  }, 1500);
})();

// ===== v201: 美股補完到全球延伸 =====
(function(){
  window.V199_MARKETS = window.V199_MARKETS || {};
  if (!window.V199_MARKETS.us) {
    window.V199_MARKETS.us = { flag:'🇺🇸', name:'美股科技龍頭', symbols:[
      {s:'NVDA', n:'NVIDIA 輝達'},
      {s:'MSFT', n:'微軟'},
      {s:'META', n:'Meta'},
      {s:'AMZN', n:'亞馬遜'},
      {s:'GOOGL', n:'Google'}
    ]};
  }
  window.__v199Loaded = false;
})();

// ===== v202: 一鍵 AI 個股解讀 =====
window.v202QuickAnalysis = async function(symbol, name, price, changePercent, currency, btnEl){
  const tid = 'v202-ana-' + symbol.replace(/[^A-Za-z0-9]/g, '_');
  let panel = document.getElementById(tid);
  if (panel) { panel.style.display = panel.style.display === 'none' ? 'block' : 'none'; return; }
  panel = document.createElement('div');
  panel.id = tid;
  panel.style.cssText = 'margin-top:8px;padding:10px;background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;font-size:12px;color:#92400e;line-height:1.7;';
  panel.innerHTML = '🤖 AI 分析中…';
  if (btnEl && btnEl.parentNode) btnEl.parentNode.appendChild(panel);
  if (btnEl) { btnEl.disabled = true; btnEl.textContent = '分析中…'; }
  try {
    const res = await fetch('https://moneyradar-ai-proxy.thinkbigtw.workers.dev/global-quick-analysis', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, name, price, changePercent, currency })
    });
    const d = await res.json();
    if (d.error) {
      panel.innerHTML = '<span style="color:#dc2626;">⚠️ ' + d.error + '</span>';
    } else {
      panel.innerHTML = '<div style="font-weight:600;margin-bottom:4px;">🤖 AI 公開資訊整理</div>' +
                        '<div>' + (d.analysis || '').replace(/\n/g, '<br>') + '</div>' +
                        '<div style="margin-top:6px;font-size:10px;color:#6b7280;">' + (d.disclaimer || '') + '</div>';
    }
  } catch (e) {
    panel.innerHTML = '<span style="color:#dc2626;">分析失敗：' + (e.message || e) + '</span>';
  } finally {
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = '🤖 AI 解讀'; }
  }
};

// 監聽 v199 cards 渲染，動態插入 AI 解讀按鈕
(function(){
  if (window.__v202Wired) return;
  window.__v202Wired = true;
  const observer = new MutationObserver(() => {
    document.querySelectorAll('#v199-global-body [id^="px-"]').forEach(el => {
      const card = el.parentNode;
      if (!card || card.querySelector('.v202-ai-btn')) return;
      const btn = document.createElement('button');
      btn.className = 'v202-ai-btn';
      btn.textContent = '🤖 AI 解讀';
      btn.style.cssText = 'margin-top:6px;padding:4px 10px;font-size:11px;background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;cursor:pointer;color:#92400e;font-weight:600;width:100%;';
      btn.addEventListener('click', async () => {
        const divs = card.querySelectorAll(':scope > div');
        const symbol = divs[0] ? divs[0].textContent.trim() : '';
        const name = divs[1] ? divs[1].textContent.trim() : '';
        if (btn.disabled) return;
        btn.disabled = true; btn.textContent = '抓報價中…';
        try {
          const qr = await fetch('https://moneyradar-ai-proxy.thinkbigtw.workers.dev/quote?symbol=' + encodeURIComponent(symbol));
          const q = await qr.json();
          window.v202QuickAnalysis(symbol, name, q.price || 0, q.changePercent || 0, q.currency || '', btn);
        } catch(e){
          btn.disabled = false; btn.textContent = '🤖 AI 解讀';
          alert('抓報價失敗：' + (e.message || e));
        }
      });
      card.appendChild(btn);
    });
  });
  setInterval(() => {
    const t = document.getElementById('v199-global-body');
    if (t && !window.__v202Observing) {
      window.__v202Observing = true;
      observer.observe(t, { childList: true, subtree: true });
      observer.takeRecords();
      // trigger initial scan
      t.dispatchEvent(new Event('scan'));
    }
  }, 1500);
})();

// ===== v203: Dividend Aristocrats 股息王名單 =====
window.V203_ARISTOCRATS = [
  {s:'KO',n:'可口可樂',y:62,dy:3.0},{s:'JNJ',n:'嬌生',y:62,dy:3.4},{s:'PG',n:'寶僑',y:67,dy:2.5},
  {s:'MMM',n:'3M',y:65,dy:2.7},{s:'PEP',n:'百事',y:51,dy:3.5},{s:'WMT',n:'沃爾瑪',y:50,dy:1.0},
  {s:'XOM',n:'埃克森美孚',y:41,dy:3.4},{s:'CVX',n:'雪佛龍',y:36,dy:4.5},{s:'IBM',n:'IBM',y:28,dy:3.0},
  {s:'MCD',n:'麥當勞',y:47,dy:2.5},{s:'CL',n:'高露潔',y:60,dy:2.4},{s:'ABBV',n:'艾伯維',y:51,dy:3.5},
  {s:'TGT',n:'Target',y:52,dy:3.2},{s:'LOW',n:'勞氏',y:60,dy:1.8},{s:'ADP',n:'ADP',y:48,dy:2.0},
  {s:'CINF',n:'辛辛那提金融',y:64,dy:2.7},{s:'CTAS',n:'信達思',y:40,dy:0.9},{s:'HRL',n:'荷美爾',y:58,dy:3.7},
  {s:'BDX',n:'BD',y:51,dy:1.8},{s:'NUE',n:'紐柯鋼鐵',y:51,dy:1.5},{s:'PNR',n:'濱特爾',y:48,dy:1.4},
  {s:'GD',n:'通用動力',y:32,dy:2.0},{s:'EMR',n:'艾默生',y:67,dy:2.0},{s:'GPC',n:'真力時',y:67,dy:3.1},
  {s:'ATO',n:'雅特摩斯',y:40,dy:2.5},{s:'ED',n:'ConEd',y:49,dy:3.6},{s:'WST',n:'West製藥',y:31,dy:0.4},
  {s:'AOS',n:'A.O. Smith',y:30,dy:2.0},{s:'SWK',n:'史丹利百得',y:56,dy:3.6},{s:'SHW',n:'宣偉塗料',y:46,dy:0.9}
];

window.v203LoadAristocrats = async function(){
  const host = document.getElementById('tab-us');
  if (!host) return;
  if (document.getElementById('v203-aristo-box')) return;
  const box = document.createElement('div');
  box.id = 'v203-aristo-box';
  box.style.cssText = 'margin-top:24px;padding:16px;border:2px solid #ca8a04;border-radius:12px;background:linear-gradient(180deg,#fefce8,#fff);';
  box.innerHTML = '<div style="font-weight:700;color:#854d0e;font-size:16px;margin-bottom:6px;">👑 美股股息貴族（Dividend Aristocrats）</div>' +
    '<div style="font-size:11px;color:#854d0e;margin-bottom:12px;">連續 25+ 年加發股息的精選 30 檔。退休族 / 被動收入族最愛。資料：Yahoo Finance（殖利率 = 過去 12 個月配息 / 現價）</div>' +
    '<div id="v203-aristo-body">載入中…</div>';
  host.appendChild(box);
  const body = document.getElementById('v203-aristo-body');
  try {
    const symbols = window.V203_ARISTOCRATS.map(x => x.s).join(',');
    const res = await fetch('https://moneyradar-ai-proxy.thinkbigtw.workers.dev/quote-batch?symbols=' + encodeURIComponent(symbols));
    const data = await res.json();
    if (!data.results) {
      body.innerHTML = '<div style="color:#dc2626;">載入失敗：' + (data.error || '無資料') + '</div>';
      return;
    }
    const rmap = {};
    data.results.forEach(r => { rmap[r.symbol] = r; });
    const enriched = window.V203_ARISTOCRATS.map(a => {
      const q = rmap[a.s] || {};
      let dy = (q.dividendYield || 0) * 100;
      if (dy <= 0) dy = a.dy || 0;  // fallback 寫死值
      return {
        ...a, price: q.price || 0, changePercent: q.changePercent || 0,
        dy, peRatio: q.peRatio || 0
      };
    }).sort((x, y) => y.dy - x.dy);
    let html = '<div style="overflow-x:auto;"><table style="width:100%;font-size:12px;border-collapse:collapse;">';
    html += '<thead style="background:#fef9c3;"><tr>';
    html += '<th style="padding:6px;text-align:left;">代號</th><th style="padding:6px;text-align:left;">公司</th>';
    html += '<th style="padding:6px;text-align:right;">連續加息</th><th style="padding:6px;text-align:right;">股價</th>';
    html += '<th style="padding:6px;text-align:right;">今漲跌</th><th style="padding:6px;text-align:right;">殖利率</th>';
    html += '<th style="padding:6px;text-align:right;">本益比</th></tr></thead><tbody>';
    enriched.forEach((a, i) => {
      const c = a.changePercent >= 0 ? '#dc2626' : '#16a34a';
      const sn = a.changePercent >= 0 ? '+' : '';
      const bg = i % 2 === 0 ? '#fffbeb' : '#fff';
      html += '<tr style="background:' + bg + ';border-bottom:1px solid #fde68a;">';
      html += '<td style="padding:6px;font-weight:600;color:#854d0e;">' + a.s + '</td>';
      html += '<td style="padding:6px;">' + a.n + '</td>';
      html += '<td style="padding:6px;text-align:right;">' + a.y + ' 年</td>';
      html += '<td style="padding:6px;text-align:right;">$' + a.price.toFixed(2) + '</td>';
      html += '<td style="padding:6px;text-align:right;color:' + c + ';font-weight:600;">' + sn + a.changePercent.toFixed(2) + '%</td>';
      html += '<td style="padding:6px;text-align:right;font-weight:700;color:#ca8a04;">' + a.dy.toFixed(2) + '%</td>';
      html += '<td style="padding:6px;text-align:right;">' + (a.peRatio > 0 ? a.peRatio.toFixed(1) : '-') + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table></div>';
    body.innerHTML = html;
  } catch (e) {
    body.innerHTML = '<div style="color:#dc2626;">載入失敗：' + (e.message || e) + '</div>';
    console.error('[v203]', e);
  }
};

(function(){
  setInterval(() => {
    const t = document.getElementById('tab-us');
    if (t && getComputedStyle(t).display !== 'none' && !window.__v203Loaded) {
      window.__v203Loaded = true;
      window.v203LoadAristocrats();
    }
  }, 2000);
})();

// ===== v204: AI 解讀普及化（Universal）=====

// 通用 card 資料抽取（heuristic）
window.v204ExtractCardData = function(card){
  if (!card || card.nodeType !== 1) return null;
  // 1. data-symbol 優先
  if (card.dataset && card.dataset.symbol) {
    return { symbol: card.dataset.symbol, name: card.dataset.name || '' };
  }
  // 2. 第一個子 div 看起來像股票代號
  const firstDiv = card.querySelector(':scope > div');
  if (firstDiv) {
    const sym = firstDiv.textContent.trim();
    if (sym.length >= 1 && sym.length <= 12 &&
        /^[A-Z0-9]{1,6}(?:[-.][A-Z0-9]{1,4})?(?:[-.][A-Z0-9]{1,4})?$/.test(sym)) {
      const next = firstDiv.nextElementSibling;
      const name = next ? next.textContent.trim() : '';
      return { symbol: sym, name };
    }
  }
  return null;
};

// 注入 AI 解讀按鈕到單張卡片
window.v204AddAIButton = function(card){
  if (!card || card.nodeType !== 1) return false;
  if (card.querySelector('.v202-ai-btn, .v204-ai-btn')) return false;
  const data = window.v204ExtractCardData(card);
  if (!data || !data.symbol) return false;
  const btn = document.createElement('button');
  btn.className = 'v204-ai-btn';
  btn.textContent = '🤖 AI 解讀';
  btn.style.cssText = 'margin-top:6px;padding:4px 10px;font-size:11px;background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;cursor:pointer;color:#92400e;font-weight:600;width:100%;';
  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    btn.disabled = true; btn.textContent = '抓報價中…';
    try {
      const qr = await fetch('https://moneyradar-ai-proxy.thinkbigtw.workers.dev/quote?symbol=' + encodeURIComponent(data.symbol));
      const q = await qr.json();
      if (window.v202QuickAnalysis) {
        window.v202QuickAnalysis(data.symbol, data.name, q.price || 0, q.changePercent || 0, q.currency || '', btn);
      } else {
        btn.disabled = false; btn.textContent = '🤖 AI 解讀';
        alert('AI 解讀模組未載入');
      }
    } catch (e) {
      btn.disabled = false; btn.textContent = '🤖 AI 解讀';
      alert('抓報價失敗：' + (e.message || e));
    }
  });
  card.appendChild(btn);
  return true;
};

// 全域掃描所有已知 card patterns
window.v204ScanAll = function(){
  let added = 0;
  // Pattern A: v199 px-XXX cards (亞洲全球延伸)
  document.querySelectorAll('[id^="px-"]').forEach(el => {
    if (window.v204AddAIButton(el.parentNode)) added++;
  });
  // Pattern B: 已知容器內的直接子 div
  const containers = [
    '#watchlist-grid', '#my-watchlist',
    '#hot-stocks-section', '#hot-cards',
    '#asia-stocks-grid', '#asia-grid',
    '#us-grid', '#crypto-grid', '#commodities-grid',
    '[id^="grid-"]'
  ];
  containers.forEach(sel => {
    document.querySelectorAll(sel).forEach(c => {
      c.querySelectorAll(':scope > div').forEach(card => {
        if (window.v204AddAIButton(card)) added++;
      });
    });
  });
  // Pattern C: 任何 [data-symbol] 元素（新 cards 主動標記用）
  document.querySelectorAll('[data-symbol]').forEach(card => {
    if (window.v204AddAIButton(card)) added++;
  });
  return added;
};

// MutationObserver + 定期 scan
(function(){
  if (window.__v204Wired) return;
  window.__v204Wired = true;
  // 首次延遲 scan（等其他模組 hydrate）
  setTimeout(() => {
    const n = window.v204ScanAll();
    if (n > 0) console.log('[v204] initial scan added ' + n + ' AI buttons');
  }, 2500);
  // 每 3 秒 re-scan（補新 render 的 cards）
  setInterval(window.v204ScanAll, 3000);
  // 也用 MutationObserver 即時抓
  if (window.MutationObserver) {
    const obs = new MutationObserver(records => {
      let need = false;
      for (const r of records) {
        if (r.addedNodes && r.addedNodes.length > 0) { need = true; break; }
      }
      if (need) window.v204ScanAll();
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }
  console.log('[v204] universal AI button observer wired');
})();


// ===== v205: 加密貨幣前 10 =====

window.v205LoadCrypto = async function(){
  const host = document.getElementById('tab-crypto');
  if (!host || document.getElementById('v205-crypto-box')) return;
  const box = document.createElement('div');
  box.id = 'v205-crypto-box';
  box.style.cssText = 'margin-top:24px;padding:16px;border:2px solid #f97316;border-radius:12px;background:linear-gradient(180deg,#fff7ed,#fff);';
  box.innerHTML = '<div style="font-weight:700;color:#9a3412;font-size:16px;margin-bottom:6px;">🪙 加密貨幣市值前 10</div><div style="font-size:11px;color:#9a3412;margin-bottom:12px;">資料：CoinGecko · TWD 計價 · 24h 漲跌</div><div id="v205-crypto-body">載入中…</div>';
  host.appendChild(box);
  const body = document.getElementById('v205-crypto-body');
  try {
    const r = await fetch('https://moneyradar-ai-proxy.thinkbigtw.workers.dev/crypto-top');
    const d = await r.json();
    if (!d.results) { body.innerHTML = '<div style="color:#dc2626;">載入失敗</div>'; return; }
    const meta = document.getElementById('v205-meta');
    if (meta) meta.textContent = '資料：' + (d.source === 'coingecko' ? 'CoinGecko' : 'CoinCap') + ' · ' + (d.currency || 'USD') + ' 計價 · 24h 漲跌';
    let html = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:8px;">';
    d.results.forEach(c => {
      const color = c.change24h >= 0 ? '#dc2626' : '#16a34a';
      const sign = c.change24h >= 0 ? '+' : '';
      const fmt = c.price > 100 ? c.price.toLocaleString('en', {maximumFractionDigits:0}) : c.price.toLocaleString('en', {maximumFractionDigits:2});
      html += '<div data-symbol="' + c.symbol + '" data-name="' + c.name + '" style="padding:10px;border:1px solid #fed7aa;border-radius:8px;background:white;">';
      html += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">';
      if (c.image) html += '<img src="' + c.image + '" alt="" style="width:18px;height:18px;border-radius:50%;">';
      html += '<div style="font-size:11px;color:#6b7280;">' + c.symbol + '</div></div>';
      html += '<div style="font-weight:600;font-size:13px;">' + c.name + '</div>';
      html += '<div style="margin-top:4px;font-size:13px;"><span style="color:' + color + ';font-weight:600;">NT$' + fmt + '</span> <span style="color:' + color + ';font-size:11px;">(' + sign + c.change24h.toFixed(2) + '%)</span></div></div>';
    });
    body.innerHTML = html + '</div>';
  } catch (e) { body.innerHTML = '<div style="color:#dc2626;">' + (e.message || e) + '</div>'; }
};
(function(){
  setInterval(() => {
    const t = document.getElementById('tab-crypto');
    if (t && getComputedStyle(t).display !== 'none' && !window.__v205Loaded) {
      window.__v205Loaded = true; window.v205LoadCrypto();
    }
  }, 2000);
})();


// ===== v206: 動能情緒小燈 =====

window.v206FetchSentiment = async function(symbol){
  if (!window.__v206Cache) window.__v206Cache = {};
  const c = window.__v206Cache[symbol];
  if (c && (Date.now() - c.t < 600000)) return c.data;
  try {
    const r = await fetch('https://moneyradar-ai-proxy.thinkbigtw.workers.dev/sentiment-score?symbol=' + encodeURIComponent(symbol));
    const d = await r.json();
    if (d.error) return null;
    window.__v206Cache[symbol] = { data: d, t: Date.now() };
    return d;
  } catch (e) { return null; }
};

window.v206AddSentimentDot = async function(card){
  if (!card || card.querySelector('.v206-dot')) return;
  const data = window.v204ExtractCardData ? window.v204ExtractCardData(card) : null;
  if (!data || !data.symbol) return;
  const dot = document.createElement('span');
  dot.className = 'v206-dot';
  dot.style.cssText = 'display:inline-block;width:8px;height:8px;border-radius:50%;background:#ddd;margin-left:6px;vertical-align:middle;';
  dot.title = '載入動能…';
  const firstDiv = card.querySelector(':scope > div');
  if (firstDiv) firstDiv.appendChild(dot);
  const sent = await window.v206FetchSentiment(data.symbol);
  if (sent) {
    dot.style.background = sent.color;
    dot.title = '動能：' + sent.label + '（' + sent.score + '/100）';
  } else {
    dot.style.display = 'none';
  }
};

(function(){
  if (window.__v206Wired) return;
  window.__v206Wired = true;
  setInterval(() => {
    document.querySelectorAll('[id^="px-"]').forEach(el => {
      window.v206AddSentimentDot(el.parentNode);
    });
  }, 4000);
})();


// ===== v207: 多股 K 線重疊 =====

window.v207OpenCompare = function(){
  let panel = document.getElementById('v207-panel');
  if (panel) { panel.remove(); return; }
  panel = document.createElement('div');
  panel.id = 'v207-panel';
  panel.style.cssText = 'position:fixed;bottom:20px;right:20px;width:90%;max-width:600px;max-height:80vh;overflow:auto;padding:16px;border:2px solid #2563eb;border-radius:12px;background:white;box-shadow:0 12px 32px rgba(37,99,235,0.25);z-index:9999;';
  panel.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><div style="font-weight:700;color:#1d4ed8;">📊 多股 K 線重疊（3個月）</div><button id="v207-close" style="background:none;border:none;cursor:pointer;font-size:18px;">✕</button></div><div style="font-size:11px;color:#6b7280;margin-bottom:8px;">2-5 檔逗號分隔，例：NVDA,MSFT,GOOGL</div><div style="display:flex;gap:6px;margin-bottom:10px;"><input id="v207-input" type="text" value="NVDA,MSFT,GOOGL" style="flex:1;padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;font-size:13px;"><button id="v207-go" style="padding:6px 12px;background:#2563eb;color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;">比較</button></div><div id="v207-chart"></div>';
  document.body.appendChild(panel);
  document.getElementById('v207-close').addEventListener('click', () => panel.remove());
  document.getElementById('v207-go').addEventListener('click', window.v207RenderCompare);
  // auto run
  setTimeout(window.v207RenderCompare, 300);
};

window.v207RenderCompare = async function(){
  const inp = document.getElementById('v207-input');
  const chart = document.getElementById('v207-chart');
  if (!inp || !chart) return;
  const syms = inp.value.split(',').map(x => x.trim().toUpperCase()).filter(Boolean).slice(0, 5);
  if (syms.length < 2) { chart.innerHTML = '<div style="color:#dc2626;">至少 2 檔</div>'; return; }
  chart.innerHTML = '抓資料中…';
  try {
    const sets = await Promise.all(syms.map(async sym => {
      const r = await fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=1d&range=3mo');
      const j = await r.json();
      const result = j.chart && j.chart.result && j.chart.result[0];
      if (!result) return { sym, closes: [] };
      const closes = (result.indicators.quote[0].close || []).filter(x => x != null);
      return { sym, closes };
    }));
    const valid = sets.filter(x => x.closes.length > 5);
    if (valid.length < 2) { chart.innerHTML = '<div style="color:#dc2626;">資料不足</div>'; return; }
    const series = valid.map(x => {
      const base = x.closes[0];
      return { sym: x.sym, pts: x.closes.map(c => (c - base) / base * 100) };
    });
    const W = 540, H = 280, padL = 40, padR = 10, padT = 10, padB = 30;
    const innerW = W - padL - padR, innerH = H - padT - padB;
    let yMin = Infinity, yMax = -Infinity, maxLen = 0;
    series.forEach(s => {
      s.pts.forEach(p => { if (p < yMin) yMin = p; if (p > yMax) yMax = p; });
      if (s.pts.length > maxLen) maxLen = s.pts.length;
    });
    const range = (yMax - yMin) || 1;
    const colors = ['#dc2626','#2563eb','#16a34a','#9333ea','#ea580c'];
    const x = i => padL + (i / Math.max(1, maxLen - 1)) * innerW;
    const y = v => padT + (1 - (v - yMin) / range) * innerH;
    let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;border:1px solid #e5e7eb;border-radius:8px;background:white;">';
    svg += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y(0) + '" y2="' + y(0) + '" stroke="#9ca3af" stroke-dasharray="3,3"/>';
    series.forEach((s, i) => {
      let d = '';
      s.pts.forEach((p, idx) => { d += (idx === 0 ? 'M' : 'L') + x(idx).toFixed(1) + ',' + y(p).toFixed(1) + ' '; });
      svg += '<path d="' + d + '" fill="none" stroke="' + colors[i] + '" stroke-width="2"/>';
      const lastP = s.pts[s.pts.length - 1];
      svg += '<text x="' + (W - padR + 2) + '" y="' + (y(lastP) + 3) + '" fill="' + colors[i] + '" font-size="10" text-anchor="end">' + s.sym + ' ' + (lastP >= 0 ? '+' : '') + lastP.toFixed(1) + '%</text>';
    });
    svg += '<text x="6" y="' + (y(yMax) + 3) + '" fill="#6b7280" font-size="9">' + yMax.toFixed(0) + '%</text>';
    svg += '<text x="6" y="' + (y(yMin) + 3) + '" fill="#6b7280" font-size="9">' + yMin.toFixed(0) + '%</text>';
    svg += '</svg>';
    chart.innerHTML = svg + '<div style="font-size:11px;color:#6b7280;margin-top:6px;">3 個月走勢，第一天 normalize 為 0%</div>';
  } catch (e) { chart.innerHTML = '<div style="color:#dc2626;">' + (e.message || e) + '</div>'; }
};

(function(){
  setTimeout(() => {
    if (document.getElementById('v207-trigger')) return;
    const btn = document.createElement('button');
    btn.id = 'v207-trigger';
    btn.textContent = '📊';
    btn.title = '多股 K 線重疊比較';
    btn.style.cssText = 'position:fixed;bottom:80px;right:20px;width:48px;height:48px;border-radius:50%;background:#2563eb;color:white;border:none;cursor:pointer;font-size:20px;box-shadow:0 4px 12px rgba(37,99,235,0.4);z-index:9998;';
    btn.addEventListener('click', window.v207OpenCompare);
    document.body.appendChild(btn);
  }, 2500);
})();


// ===== v209: Aristocrats 表格 AI 按鈕 =====

(function(){
  setInterval(() => {
    document.querySelectorAll('#v203-aristo-body tbody tr').forEach(tr => {
      if (tr.querySelector('.v209-btn')) return;
      const cells = tr.querySelectorAll('td');
      if (cells.length < 2) return;
      const symbol = cells[0].textContent.trim();
      const name = cells[1].textContent.trim();
      if (!symbol) return;
      const btn = document.createElement('button');
      btn.className = 'v209-btn';
      btn.textContent = '🤖';
      btn.title = 'AI 解讀 ' + symbol;
      btn.style.cssText = 'margin-left:6px;padding:2px 5px;font-size:11px;background:#fef3c7;border:1px solid #f59e0b;border-radius:4px;cursor:pointer;';
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (btn.disabled) return;
        btn.disabled = true; btn.textContent = '...';
        try {
          const qr = await fetch('https://moneyradar-ai-proxy.thinkbigtw.workers.dev/quote?symbol=' + encodeURIComponent(symbol));
          const q = await qr.json();
          let exp = tr.parentNode.querySelector('.v209-exp-' + symbol);
          if (exp) { exp.style.display = exp.style.display === 'none' ? '' : 'none'; btn.disabled = false; btn.textContent = '🤖'; return; }
          exp = document.createElement('tr');
          exp.className = 'v209-exp-' + symbol;
          const cell = document.createElement('td');
          cell.colSpan = cells.length;
          cell.style.cssText = 'padding:10px;background:#fffbeb;';
          const fakeBtn = document.createElement('span');
          Object.defineProperty(fakeBtn, 'parentNode', { value: { appendChild: el => cell.appendChild(el) } });
          fakeBtn.disabled = false;
          exp.appendChild(cell);
          tr.parentNode.insertBefore(exp, tr.nextSibling);
          window.v202QuickAnalysis(symbol, name, q.price || 0, q.changePercent || 0, q.currency || 'USD', fakeBtn);
          btn.disabled = false; btn.textContent = '🤖';
        } catch (err) {
          btn.disabled = false; btn.textContent = '🤖';
          alert('失敗：' + (err.message || err));
        }
      });
      cells[cells.length - 1].appendChild(btn);
    });
  }, 2500);
})();


// ===== v210: AI-Native CFO 對話模式（範式革命第 1 步）=====

window.v210OpenCFO = function(){
  let overlay = document.getElementById('v210-cfo-overlay');
  if (overlay) { overlay.style.display = overlay.style.display === 'none' ? 'flex' : 'none'; return; }
  overlay = document.createElement('div');
  overlay.id = 'v210-cfo-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:linear-gradient(135deg,#1e3a8a,#312e81);color:white;z-index:99999;display:flex;flex-direction:column;font-family:-apple-system,sans-serif;';
  overlay.innerHTML = '<div style="padding:16px 20px;background:rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:space-between;"><div><div style="font-size:20px;font-weight:700;">💎 您的 AI 投資長</div></div><button id="v210-close" style="background:rgba(255,255,255,0.1);border:none;color:white;width:36px;height:36px;border-radius:50%;cursor:pointer;font-size:18px;">✕</button></div><div id="v210-messages" style="flex:1;overflow-y:auto;padding:20px;"><div style="background:rgba(255,255,255,0.1);border-radius:12px;padding:14px;max-width:80%;margin-bottom:12px;"><div style="font-weight:600;margin-bottom:6px;">💎 AI CFO</div><div>您好 NEO，我是您的 AI 投資長。我可以幫您：</div><ul style="margin-top:8px;margin-bottom:8px;padding-left:20px;line-height:1.8;"><li>解讀您的自選股今日漲跌原因</li><li>整理今日全球市場動態</li><li>查詢任何個股公開資料</li><li>解釋財經名詞</li></ul><div style="font-size:11px;color:rgba(255,255,255,0.6);">⚠️ 我不能提供個股投資建議（金管會合規）— 但我可以幫您整理公開資訊讓您自己判斷。</div></div></div><div style="padding:16px;background:rgba(0,0,0,0.2);"><div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;"><button class="v210-suggest" data-q="今日全球市場有什麼重要動態？">📊 今日全球市場</button><button class="v210-suggest" data-q="NVDA 為什麼漲？">💎 NVDA 為什麼漲</button><button class="v210-suggest" data-q="台積電最近的新聞重點是什麼？">🇹🇼 台積電新聞</button><button class="v210-suggest" data-q="什麼是布林通道？">📚 學財經名詞</button></div><div style="display:flex;gap:8px;"><input id="v210-input" type="text" placeholder="問我任何投資相關問題..." style="flex:1;padding:12px 16px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.1);color:white;border-radius:24px;font-size:14px;outline:none;"><button id="v210-send" style="padding:12px 24px;background:#fbbf24;color:#1e3a8a;border:none;border-radius:24px;cursor:pointer;font-weight:700;">送出</button></div></div>';
  document.body.appendChild(overlay);
  document.querySelectorAll('.v210-suggest').forEach(btn => {
    btn.style.cssText = 'background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:white;padding:6px 12px;border-radius:20px;font-size:12px;cursor:pointer;';
    btn.addEventListener('click', () => {
      document.getElementById('v210-input').value = btn.dataset.q;
      window.v210Send();
    });
  });
  document.getElementById('v210-close').addEventListener('click', () => overlay.style.display = 'none');
  document.getElementById('v210-send').addEventListener('click', window.v210Send);
  document.getElementById('v210-input').addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.v210Send(); }
  });
  setTimeout(() => document.getElementById('v210-input').focus(), 100);
};

window.v210Messages = [];

window.v210Send = async function(){
  const input = document.getElementById('v210-input');
  const msgs = document.getElementById('v210-messages');
  if (!input || !msgs) return;
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  const userMsg = document.createElement('div');
  userMsg.style.cssText = 'background:rgba(251,191,36,0.25);border-radius:12px;padding:14px;max-width:80%;margin-left:auto;margin-bottom:12px;';
  userMsg.textContent = text;
  msgs.appendChild(userMsg);
  msgs.scrollTop = msgs.scrollHeight;
  window.v210Messages.push({ role: 'user', content: text });
  const thinking = document.createElement('div');
  thinking.style.cssText = 'background:rgba(255,255,255,0.1);border-radius:12px;padding:14px;max-width:80%;margin-bottom:12px;';
  thinking.innerHTML = '<div style="font-weight:600;margin-bottom:6px;">💎 AI CFO</div>💭 思考中...';
  msgs.appendChild(thinking);
  msgs.scrollTop = msgs.scrollHeight;
  // 收集 context（情境感知）
  const visible = Array.from(document.querySelectorAll('[id^="px-"]')).map(el => {
    const d = window.v204ExtractCardData ? window.v204ExtractCardData(el.parentNode) : null;
    return d ? d.symbol : null;
  }).filter(Boolean).slice(0, 10);
  const ctx = {
    currentSymbol: '',
    currentNews: [],
    visibleSymbols: visible
  };
  try {
    const res = await fetch('https://moneyradar-ai-proxy.thinkbigtw.workers.dev/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: window.v210Messages, context: ctx })
    });
    const data = await res.json();
    if (data.error) {
      thinking.innerHTML = '<div style="font-weight:600;margin-bottom:6px;color:#fca5a5;">💎 AI CFO</div>⚠️ ' + data.error;
    } else {
      const reply = data.reply || '';
      thinking.innerHTML = '<div style="font-weight:600;margin-bottom:6px;">💎 AI CFO</div>' + reply.replace(/\n/g, '<br>');
      window.v210Messages.push({ role: 'assistant', content: reply });
      // 自動偵測 stock symbols 並 render mini quote cards
      const symPattern = /\b([A-Z]{1,5}(?:\.[A-Z]{2,3})?|\d{4})\b/g;
      const matches = [...new Set([...reply.matchAll(symPattern)].map(m => m[1]))].filter(s => s.length >= 1).slice(0, 5);
      if (matches.length > 0) {
        const cardsBox = document.createElement('div');
        cardsBox.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;';
        matches.forEach(sym => {
          const card = document.createElement('div');
          card.style.cssText = 'background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:10px 12px;font-size:12px;min-width:120px;';
          card.innerHTML = '<div style="font-weight:700;font-size:13px;">' + sym + '</div><div style="opacity:0.7;font-size:11px;">載入中...</div>';
          cardsBox.appendChild(card);
          fetch('https://moneyradar-ai-proxy.thinkbigtw.workers.dev/quote?symbol=' + encodeURIComponent(sym))
            .then(r => r.ok ? r.json() : null)
            .then(d => {
              if (d && d.price) {
                const pct = d.changePercent || 0;
                const c = pct >= 0 ? '#fca5a5' : '#86efac';
                const sn = pct >= 0 ? '+' : '';
                card.innerHTML = '<div style="font-weight:700;font-size:13px;">' + sym + '</div><div style="font-weight:600;margin-top:4px;">' + d.price.toFixed(2) + ' ' + (d.currency || '') + '</div><div style="color:' + c + ';font-size:11px;">' + sn + pct.toFixed(2) + '%</div>';
              } else { card.style.opacity = '0.4'; card.innerHTML = '<div style="font-weight:700;">' + sym + '</div><div style="font-size:11px;">無資料</div>'; }
            })
            .catch(() => { card.style.opacity = '0.4'; });
        });
        thinking.appendChild(cardsBox);
      }
    }
  } catch (e) {
    thinking.innerHTML = '<div style="font-weight:600;margin-bottom:6px;color:#fca5a5;">💎 AI CFO</div>連線失敗：' + (e.message || e);
  }
  msgs.scrollTop = msgs.scrollHeight;
};

// 全域觸發按鈕（左下角，跟 v207 右下 📊 對稱）
(function(){
  setTimeout(() => {
    if (document.getElementById('v210-trigger')) return;
    const btn = document.createElement('button');
    btn.id = 'v210-trigger';
    btn.innerHTML = '💎';
    btn.title = 'AI 投資長 — 您的 24/7 思考夥伴';
    btn.style.cssText = 'position:fixed;bottom:80px;left:20px;width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#1e3a8a 0%,#fbbf24 100%);color:white;border:none;cursor:pointer;font-size:26px;box-shadow:0 6px 20px rgba(30,58,138,0.5);z-index:9998;animation:v210Pulse 2s infinite;';
    document.head.insertAdjacentHTML('beforeend', '<style>@keyframes v210Pulse { 0%, 100% { transform: scale(1); box-shadow: 0 6px 20px rgba(30,58,138,0.5); } 50% { transform: scale(1.05); box-shadow: 0 8px 28px rgba(251,191,36,0.6); } }</style>');
    btn.addEventListener('click', window.v210OpenCFO);
    document.body.appendChild(btn);
  }, 2500);
})();
