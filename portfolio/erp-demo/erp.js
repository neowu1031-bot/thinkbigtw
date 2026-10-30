/* Standalone ERP demo. No network requests; amounts are stored in integer cents.
   A posted order, stock balances and its ledger entries are saved as one document. */
(() => {
  'use strict';
  const en = document.documentElement.lang === 'en';
  const t = (zh, english) => en ? english : zh;
  const KEY = 'tb-erp-demo-v1';
  const $ = selector => document.querySelector(selector);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const name = item => en ? (item.nameEn || item.name) : item.name;
  const number = value => new Intl.NumberFormat(en ? 'en-US' : 'zh-TW', {maximumFractionDigits:2}).format(value);
  const money = cents => 'NT$ ' + number(cents / 100);
  const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const today = () => dateKey();
  const currentMonth = () => today().slice(0,7);
  const uid = prefix => `${prefix}-${crypto.randomUUID()}`;
  const categories = [['paper','紙品','Paper'],['writing','書寫','Writing'],['filing','收納','Filing'],['tools','事務用品','Office tools']];
  const categoryName = key => { const c = categories.find(c => c[0] === key); return c ? c[en ? 2 : 1] : key; };
  const modules = [['dashboard','首頁待辦','Overview'],['crm','客戶管理','CRM'],['attendance','員工出勤','Attendance'],['receivables','報價與收款','Quotes & payments'],['products','商品','Products'],['purchases','進貨單','Purchases'],['sales','出貨（銷貨）','Sales / shipping'],['inventory','庫存','Inventory'],['contacts','客戶與供應商','Contacts'],['reports','報表','Reports']];
  let view = 'dashboard', search = '', category = '', reportMonth = currentMonth();
  let editing = null, orderLines = [], lineSequence = 0;
  let state, lastSaved = null, volatile = false, corrupt = false;
  let undoState = null, sortKey = 'sku', sortDirection = 1, onlyLow = false, selected = new Set();
  let agentChange = null;
  let mode = 'manual', orderFilter = '', orderSearch = '', orderPeriod = '', orderSort = 'newest', pendingIntent = null;
  const posted = o => !o.status || o.status === 'posted';
  const content = $('#erp-content');

  function seed() {
    const catalog = [
      ['A4 再生影印紙','A4 recycled paper','paper',95,135],['A5 筆記本','A5 notebook','paper',28,45],
      ['方格便條紙','Grid memo pad','paper',16,28],['牛皮信封組','Kraft envelopes','paper',22,36],
      ['索引便條','Index notes','paper',18,32],['黑色原子筆','Black ballpoint pen','writing',8,15],
      ['藍色原子筆','Blue ballpoint pen','writing',8,15],['自動鉛筆','Mechanical pencil','writing',20,35],
      ['螢光筆組','Highlighter set','writing',32,55],['白板筆','Whiteboard marker','writing',14,25],
      ['雙孔資料夾','Ring binder','filing',35,58],['透明文件袋','Clear document sleeve','filing',6,12],
      ['桌上收納盒','Desk organizer','filing',65,100],['伸縮書擋','Adjustable bookend','filing',75,120],
      ['名片收納冊','Business card album','filing',42,68],['長尾夾組','Binder clips','tools',24,40],
      ['紙膠帶','Paper tape','tools',18,30],['迷你釘書機','Mini stapler','tools',48,80],
      ['不鏽鋼剪刀','Office scissors','tools',38,65],['直尺 30cm','30 cm ruler','tools',12,22]
    ];
    const data = {version:1,products:[],suppliers:[],customers:[],orders:[],movements:[]};
    const start = new Date(); start.setDate(start.getDate()-59);
    catalog.forEach((p,i) => {
      const stock = i >= 16 ? 3+i%3 : 48+i*2;
      const id = `P${String(i+1).padStart(3,'0')}`;
      data.products.push({id,sku:`ST-${String(i+1).padStart(3,'0')}`,name:p[0],nameEn:p[1],category:p[2],cost:p[3]*100,price:p[4]*100,safety:12,stock,active:true});
      data.movements.push({id:`M-open-${id}`,date:dateKey(start),productId:id,sku:`ST-${String(i+1).padStart(3,'0')}`,name:p[0],nameEn:p[1],kind:'opening',qty:stock,balance:stock,orderId:''});
    });
    for (let i=1;i<=5;i++) data.suppliers.push({id:`S0${i}`,name:`示範供應商 S0${i}`,nameEn:`Demo supplier S0${i}`,contact:`虛構窗口 S0${i}`,contactEn:`Fictional contact S0${i}`,area:['台北','桃園','台中','台南','高雄'][i-1],areaEn:['Taipei','Taoyuan','Taichung','Tainan','Kaohsiung'][i-1]});
    for (let i=1;i<=8;i++) data.customers.push({id:`C0${i}`,name:`示範文具行 C0${i}`,nameEn:`Demo stationery store C0${i}`,contact:`虛構窗口 C0${i}`,contactEn:`Fictional contact C0${i}`,area:['台北','新北','桃園','新竹','台中','嘉義','台南','高雄'][i-1],areaEn:['Taipei','New Taipei','Taoyuan','Hsinchu','Taichung','Chiayi','Tainan','Kaohsiung'][i-1]});
    for (let day=0;day<60;day++) {
      const date = new Date(start); date.setDate(start.getDate()+day);
      const p = data.products[day%16];
      addOrder(data,'purchase',data.suppliers[day%5].id,[{productId:p.id,qty:5+day%5,unit:p.cost}],dateKey(date),`PO-DEMO-${day+1}`);
      const sold = data.products[(day*7)%16];
      addOrder(data,'sale',data.customers[day%8].id,[{productId:sold.id,qty:Math.min(sold.stock,2+day%4),unit:sold.price}],dateKey(date),`SO-DEMO-${day+1}`);
    }
    upgradeOperations(data);
    return data;
  }

  function addOrder(data,type,partyId,lines,date,id,status='posted',kind='order') {
    const party = (type === 'purchase' ? data.suppliers : data.customers).find(p => p.id === partyId);
    if (!party || !lines.length) throw new Error(t('請選擇往來對象與至少一項商品。','Choose a contact and at least one product.'));
    const totals = new Map();
    for (const line of lines) {
      const p = data.products.find(p => p.id === line.productId && p.active);
      if (!p || !Number.isSafeInteger(line.qty) || line.qty <= 0 || line.qty > 100000 || !Number.isSafeInteger(line.unit) || line.unit < 0 || line.unit > 100000000) throw new Error(t('請輸入有效商品、正整數數量與非負單價。','Enter a valid product, a positive whole quantity, and a non-negative unit price.'));
      totals.set(p.id,(totals.get(p.id)||0)+line.qty);
    }
    for (const [id,qty] of totals) {
      const p = data.products.find(p => p.id === id);
      if (status === 'posted' && type === 'sale' && qty > p.stock) throw new Error(t(`${name(p)} 庫存不足：可出貨 ${p.stock}，本單合計 ${qty}。`,`${name(p)} has insufficient stock: ${p.stock} available, ${qty} requested in this order.`));
      if (status === 'posted' && type === 'purchase' && p.stock+qty > 100000000) throw new Error(t('數量超過示範範圍。','Quantity exceeds the demo limit.'));
    }
    const due = new Date(date+'T12:00:00'); due.setDate(due.getDate()+14);
    const order = {id,type,date,partyId,partyName:party.name,partyNameEn:party.nameEn,lines:[],total:0,cost:0,status,kind,dueDate:dateKey(due),paid:type==='purchase'||(id.includes('DEMO') && Number(id.split('-').at(-1))%3!==0)};
    for (const line of lines) {
      const p = data.products.find(p => p.id === line.productId);
      const cost = p.cost;
      if (status === 'posted' && type === 'purchase') p.cost = Math.round((p.stock*p.cost+line.qty*line.unit)/(p.stock+line.qty));
      if (status === 'posted') p.stock += (type === 'purchase' ? 1 : -1)*line.qty;
      order.lines.push({...line,sku:p.sku,name:p.name,nameEn:p.nameEn,cost});
      order.total += line.qty*line.unit;
      order.cost += line.qty*cost;
      if (status === 'posted') data.movements.push({id:uid('M'),date,productId:p.id,sku:p.sku,name:p.name,nameEn:p.nameEn,kind:type,qty:(type==='purchase'?1:-1)*line.qty,balance:p.stock,orderId:id});
    }
    data.orders.push(order);
  }

  // Treat saved state as untrusted. Invalid data is retained until an explicit reset.
  function valid(data) {
    const int = value => Number.isSafeInteger(value) && value >= 0;
    const str = value => typeof value === 'string' && value.length <= 300;
    const date = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (!data || data.version !== 1 || !['products','suppliers','customers','orders','movements'].every(k => Array.isArray(data[k]))) return false;
    if (!data.products.every(p => p && ['id','sku','name','nameEn','category'].every(k=>str(p[k])) && [p.stock,p.cost,p.price,p.safety].every(int) && typeof p.active === 'boolean')) return false;
    if (new Set(data.products.map(p=>p.id)).size !== data.products.length) return false;
    if (![...data.suppliers,...data.customers].every(p => p && ['id','name','nameEn','contact','contactEn','area','areaEn'].every(k=>str(p[k])))) return false;
    const ids = new Set(data.products.map(p=>p.id));
    if (!data.orders.every(o => o && str(o.id) && (!o.status || ['draft','confirmed','posted'].includes(o.status)) && (!o.kind || ['order','quote'].includes(o.kind)) && (o.paid===undefined || typeof o.paid==='boolean') && (!o.dueDate || date(o.dueDate)) && date(o.date) && ['purchase','sale'].includes(o.type) && str(o.partyName) && str(o.partyNameEn) && int(o.total) && int(o.cost) && Array.isArray(o.lines) && o.lines.length && o.lines.every(l => l && ids.has(l.productId) && str(l.sku) && str(l.name) && str(l.nameEn) && int(l.qty) && l.qty>0 && int(l.unit) && int(l.cost)))) return false;
    if (!data.movements.every(m => m && ids.has(m.productId) && date(m.date) && ['opening','purchase','sale'].includes(m.kind) && str(m.id) && str(m.sku) && str(m.name) && str(m.nameEn) && str(m.orderId) && Number.isSafeInteger(m.qty) && int(m.balance))) return false;
    if(data.operationsVersion!==undefined){
      if(data.operationsVersion!==1||!['crm','employees','attendance','leaves'].every(k=>Array.isArray(data[k])))return false;
      const customers=new Set(data.customers.map(c=>c.id));
      if(data.crm.length!==customers.size||new Set(data.crm.map(c=>c.customerId)).size!==customers.size||!data.crm.every(c=>customers.has(c.customerId)&&['talk','quote','won','lost'].includes(c.stage)&&date(c.next)&&Array.isArray(c.notes)&&c.notes.every(n=>date(n.date)&&str(n.text))))return false;
      if(!data.employees.length||!data.employees.every(e=>str(e.id)&&str(e.name)&&str(e.nameEn)))return false;
      const employees=new Set(data.employees.map(e=>e.id));
      if(!data.attendance.every(a=>str(a.id)&&employees.has(a.employeeId)&&date(a.date)&&/^\d{2}:\d{2}$/.test(a.in)&&(a.out===''||/^\d{2}:\d{2}$/.test(a.out))&&int(a.overtime)))return false;
      if(!data.leaves.every(l=>str(l.id)&&employees.has(l.employeeId)&&date(l.date)&&['annual','sick'].includes(l.kind)&&['pending','approved','rejected'].includes(l.status)))return false;
    }
    return data.products.every(p => data.movements.filter(m=>m.productId===p.id).reduce((sum,m)=>sum+m.qty,0) === p.stock);
  }
  function storageNotice(message) { $('#storage-status').textContent = message; }
  function load() {
    try {
      lastSaved = localStorage.getItem(KEY);
      if (lastSaved !== null) {
        const parsed = JSON.parse(lastSaved);
        if (!valid(parsed)) throw new Error('Invalid saved demo');
        state = parsed;
        // Upgrade legacy v1 records in memory; the next transaction persists metadata.
        for (const o of state.orders) {
          o.status ||= 'posted'; o.kind ||= 'order';
          if (!o.dueDate) {const due=new Date(o.date+'T12:00:00');due.setDate(due.getDate()+14);o.dueDate=dateKey(due);}
          if (o.paid===undefined) o.paid=o.type==='purchase'||!o.id.includes('DEMO')||Number(o.id.split('-').at(-1))%3!==0;
        }
      } else { state = seed(); localStorage.setItem(KEY,JSON.stringify(state)); lastSaved = JSON.stringify(state); }
    } catch (error) {
      state = seed(); volatile = true; corrupt = lastSaved !== null;
      storageNotice(corrupt ? t('既有示範資料無法讀取，已保留原資料。本頁暫用初始資料；重設後才能重新儲存。','Saved demo data could not be read and has been preserved. This session uses sample data; reset to save again.') : t('瀏覽器無法儲存資料，目前僅在本頁暫存；重新整理將還原。','Browser storage is unavailable. Changes last only for this page session and will be lost on refresh.'));
    }
  }
  function transact(change) {
    if (!volatile) {
      const latest = localStorage.getItem(KEY);
      if (latest !== lastSaved) {
        throw new Error(t('另一個分頁已更新資料，請重新整理後再操作。','Another tab changed the data. Reload this page before continuing.'));
      }
    }
    const next = JSON.parse(JSON.stringify(state));
    upgradeOperations(next);
    change(next);
    if (!volatile) {
      const raw = JSON.stringify(next);
      try { localStorage.setItem(KEY,raw); } catch (_) { throw new Error(t('瀏覽器無法儲存，本次操作未套用。請釋放儲存空間後重試。','Browser storage could not save this change. Nothing was applied; free some space and try again.')); }
      lastSaved = raw;
    }
    undoState = state;
    state = next;
    showUndo();
  }
  const announce = message => { $('#app-status').textContent = message; };
  function activeProducts() { return state.products.filter(p=>p.active); }
  function lowStock() { return activeProducts().filter(p=>p.stock<=p.safety); }
  const salesFor = month => state.orders.filter(o=>o.type==='sale' && posted(o) && o.date.startsWith(month));
  const sum = (rows,key) => rows.reduce((total,row)=>total+row[key],0);
  const units = rows => rows.reduce((total,o)=>total+sum(o.lines,'qty'),0);
  const options = (items,selected) => items.map(([value,label])=>`<option value="${escape(value)}"${value===selected?' selected':''}>${escape(label)}</option>`).join('');
  const button = (action,label,extra='') => `<button type="button" data-action="${action}" ${extra}>${label}</button>`;
  function table(headers,rows,cls='') {
    return `<div class="table-scroll" tabindex="0" role="region" aria-label="${escape(t('可橫向捲動的資料表','Scrollable data table'))}"><table class="${cls}"><thead><tr>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>`<tr>${row.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}" class="empty-state">${t('目前沒有資料。可新增商品或建立單據開始操作。','No records yet. Add a product or post an order to get started.')}</td></tr>`}</tbody></table></div>`;
  }
  function metric(label,value,note='',detail='month-sales') { return `<button type="button" class="metric" data-action="drill" data-detail="${detail}"><small>${label} ↗</small><strong>${value}</strong><span>${note}</span></button>`; }
  function render(focus=false) {
    renderAgentData();
    $('#module-nav').innerHTML = modules.map(([key,zh,english])=>button('navigate',t(zh,english),`data-view="${key}" ${key===view?'aria-current="page"':''}`)).join('');
    const title = modules.find(m=>m[0]===view);
    content.innerHTML = `<header class="module-head"><h2 id="module-title" tabindex="-1">${t(title[1],title[2])}</h2>${button('export',t('匯出 CSV','Export CSV'))}</header>`;
    ({dashboard:renderDashboard,crm:()=>renderCRM(content),attendance:()=>renderAttendance(content),receivables:()=>renderReceivables(content),products:renderProducts,purchases:renderOrder,sales:renderOrder,inventory:renderInventory,contacts:renderContacts,reports:renderReports})[view]();
    if (pendingIntent) updatePreview();
    if (focus) $('#module-title').focus({preventScroll:true});
  }
  function renderDashboard() {
    renderOverview(content);
    const sales = salesFor(currentMonth()), purchases = state.orders.filter(o=>o.type==='purchase' && posted(o) && o.date.startsWith(currentMonth()));
    const waiting = state.orders.filter(o=>!posted(o));
    content.insertAdjacentHTML('beforeend',`<section class="manual-start"><div><span class="eyebrow">${t('今天先處理這些事','START HERE')}</span><h3>${t('貨進來、貨出去，都從這裡開始。','Receive, ship, and keep stock in view.')}</h3><p>${t('選進貨或出貨 → 填商品與數量 → 確認。也能切到 Agent 版，用一句話準備同一張單。','Choose receive or ship → enter items and quantities → confirm. Agent mode prepares the same order from one request.')}</p></div><div class="quick-actions">${button('navigate',t('建立進貨單','Receive stock'),'data-view="purchases" class="primary"')}${button('navigate',t('建立出貨單','Ship stock'),'data-view="sales"')}${button('navigate',t('管理商品','Manage products'),'data-view="products"')}</div></section><div class="metrics">${metric(t('需要補貨','Needs replenishment'),number(lowStock().length),t('點開查看商品','Open product list'),'low')}${metric(t('本月進貨數量','Units received this month'),number(units(purchases)),t(`${purchases.length} 張進貨單`,`${purchases.length} purchase orders`),'purchases')}${metric(t('本月出貨數量','Units shipped this month'),number(units(sales)),t(`${sales.length} 張出貨單`,`${sales.length} sales orders`),'month-sales')}</div><section class="erp-panel"><h3>${t('待完成單據','Orders to finish')} · ${waiting.length}</h3>${waiting.length?orderTable(waiting.slice(-5).reverse()):`<p class="hint">${t('目前沒有待完成單據。可以直接建立進貨或出貨單。','All orders are complete. You can create a new purchase or sale.')}</p>`}</section><section id="manual-data" class="erp-panel stock-snapshot" aria-label="${t('庫存與單據','Stock and orders')}"></section>`);
    renderAgentData($('#manual-data'));
  }

  function productRows() {
    const q = search.trim().toLocaleLowerCase();
    return activeProducts().filter(p=>(!onlyLow||p.stock<=p.safety)&&(!category||p.category===category)&&(!q||`${p.sku} ${p.name} ${p.nameEn}`.toLocaleLowerCase().includes(q))).sort((a,b)=>sortDirection*(typeof a[sortKey]==='number'?a[sortKey]-b[sortKey]:String(sortKey==='name'?name(a):a[sortKey]).localeCompare(String(sortKey==='name'?name(b):b[sortKey]),en?'en':'zh-TW')));
  }
  function productTable() {
    return table([`<input type="checkbox" id="select-all" aria-label="${t('選取目前列表','Select visible products')}" ${productRows().length && productRows().every(p=>selected.has(p.id))?'checked':''}>`,t('編號 / 商品','Code / Product'),t('分類','Category'),t('成本 / 售價','Cost / Price'),t('庫存 / 安全量','Stock / Safety'),t('操作','Actions')],productRows().map(p=>[
      `<input type="checkbox" data-select="${escape(p.id)}" aria-label="${escape(t('選取 ','Select ')+name(p))}" ${selected.has(p.id)?'checked':''}>`,
      `<strong>${escape(p.sku)}</strong><br>${escape(name(p))}`,escape(categoryName(p.category)),`${money(p.cost)}<br>${money(p.price)}`,
      `<span class="${p.stock<=p.safety?'warning':''}">${p.stock}</span> / <input class="inline-safety" type="number" min="0" max="100000" step="1" data-safety="${escape(p.id)}" value="${p.safety}" aria-label="${escape(name(p)+' '+t('安全庫存','safety stock'))}">`,
      `<div class="table-actions">${button('edit-product',t('編輯','Edit'),`data-id="${escape(p.id)}" aria-label="${escape(t('編輯 ','Edit ')+name(p))}"`)}${button('delete-product',t('刪除','Delete'),`data-id="${escape(p.id)}" class="danger" aria-label="${escape(t('刪除 ','Delete ')+name(p))}"`)}</div>`
    ]));
  }
  function renderProducts() {
    content.insertAdjacentHTML('beforeend',`<div class="toolbar"><label>${t('搜尋商品','Search products')}<input id="product-search" type="search" value="${escape(search)}" placeholder="${t('商品名稱或編號','Product name or code')}"></label><label>${t('分類','Category')}<select id="category-filter">${options([['',t('所有分類','All categories')],...categories.map(c=>[c[0],c[en?2:1]])],category)}</select></label>${button('add-product',t('新增商品','Add product'),'class="primary"')}</div><div class="toolbar compact"><label>${t('排序','Sort by')}<select id="product-sort">${options([['sku',t('編號','Product code')],['name',t('名稱','Name')],['stock',t('庫存','Stock')],['price',t('售價','Price')],['safety',t('安全庫存','Safety stock')]],sortKey)}</select></label>${button('sort-direction',sortDirection===1?'↑':'↓',`aria-label="${t('切換排序方向','Reverse sort order')}"`)}<label class="check-label"><input type="checkbox" id="low-only" ${onlyLow?'checked':''}>${t('只看庫存不足','Low stock only')}</label></div><div class="batch-bar"><span id="selected-count">${selected.size} ${t('項已選','selected')}</span><label>${t('批次安全庫存','Safety stock for selection')}<input id="batch-safety" type="number" min="0" max="100000" value="30"></label>${button('batch-safety',t('套用安全庫存','Apply safety stock'))}${button('batch-delete',t('刪除所選','Delete selected'))}</div><div id="product-editor"></div><div id="product-results">${productTable()}</div><p class="hint">${t('新商品從零庫存開始，數量由進出貨異動。尚有庫存的商品不可刪除；歷史單據會保留。','New products start at zero stock. Use orders to change quantities. Products with stock cannot be deleted; order history is retained.')}</p>`);
  }
  function showProduct(id) {
    editing = id || '';
    const p = state.products.find(p=>p.id===id) || {sku:'',name:'',nameEn:'',category:'paper',cost:0,price:0,safety:10};
    $('#product-editor').innerHTML = `<form id="product-form" class="edit-panel"><h3>${id?t('編輯商品','Edit product'):t('新增商品','Add product')}</h3><div class="form-grid"><label>${t('商品編號','Product code')}<input name="sku" required maxlength="40" value="${escape(p.sku)}"></label><label>${t('商品名稱（中文）','Product name (Chinese)')}<input name="name" required maxlength="80" value="${escape(p.name)}"></label><label>${t('英文名稱（選填）','English name (optional)')}<input name="nameEn" maxlength="100" value="${escape(p.nameEn)}"></label><label>${t('分類','Category')}<select name="category">${options(categories.map(c=>[c[0],c[en?2:1]]),p.category)}</select></label><label>${t('成本（NT$）','Cost (NT$)')}<input name="cost" type="number" min="0" max="1000000" step="0.01" required value="${p.cost/100}" ${id&&p.stock>0?'readonly':''}></label><label>${t('售價（NT$）','Price (NT$)')}<input name="price" type="number" min="0" max="1000000" step="0.01" required value="${p.price/100}"></label><label>${t('安全庫存','Safety stock')}<input name="safety" type="number" min="0" max="100000" step="1" required value="${p.safety}"></label></div><p class="hint">${t('有庫存時成本依進貨加權平均計算；歷史銷貨毛利不受後續修改影響。','For stocked products, cost uses a moving weighted average of purchases. Past sales keep their original cost.')}</p><p id="product-error" class="form-error" role="alert"></p><div class="form-actions">${button('cancel-product',t('取消','Cancel'))}<button type="submit" class="primary">${t('儲存商品','Save product')}</button></div></form>`;
    $('#product-form [name=sku]').focus();
  }
  function saveProduct(form) {
    const f = new FormData(form), value = key => String(f.get(key)||'').trim();
    const product = {sku:value('sku'),name:value('name'),nameEn:value('nameEn')||value('name'),category:value('category'),cost:Math.round(Number(value('cost'))*100),price:Math.round(Number(value('price'))*100),safety:Number(value('safety'))};
    try {
      if (!product.sku || !product.name || !Number.isInteger(product.safety)) throw new Error(t('請填寫商品編號、名稱與有效安全庫存。','Enter a product code, name, and valid safety stock.'));
      transact(data=>{
        if (data.products.some(p=>p.id!==editing && p.sku.toLowerCase()===product.sku.toLowerCase())) throw new Error(t('商品編號已使用，請換一個編號。','This product code is already in use. Choose another.'));
        const p = data.products.find(p=>p.id===editing);
        if (p) Object.assign(p,{...product,cost:p.stock>0?p.cost:product.cost});
        else data.products.push({...product,id:uid('P'),stock:0,active:true});
      });
      editing=null; search=''; category=''; render(); announce(t('商品已儲存。','Product saved.')); $('[data-action=add-product]').focus();
    } catch (error) { $('#product-error').textContent=error.message; }
  }
  function orderType() { return view==='purchases'?'purchase':'sale'; }
  function renderOrder() {
    const purchase = orderType()==='purchase';
    orderLines=[]; lineSequence=0;
    content.insertAdjacentHTML('beforeend',`<form id="order-form" class="edit-panel"><ol class="order-steps"><li>${t('選擇客戶或供應商','Choose a contact')}</li><li>${t('填商品與數量','Enter items and quantities')}</li><li>${t('確認入庫或出貨','Confirm receipt or shipment')}</li></ol><h3>${purchase?t('建立進貨單','New purchase order'):t('建立銷貨單','New sales order')}</h3><div class="form-grid"><label>${purchase?t('供應商','Supplier'):t('客戶','Customer')}<select name="party" required>${options((purchase?state.suppliers:state.customers).map(p=>[p.id,name(p)]))}</select></label><label>${t('單據日期','Order date')}<input type="date" name="date" value="${today()}" readonly></label></div><div id="order-lines"></div>${button('add-line',t('新增品項','Add line'))}<p class="hint">${t('可先存草稿，再確認與出入庫；直接出入庫會立即更新庫存。最近一次操作可復原。','Save a draft, confirm it, then receive or ship. Direct posting updates stock immediately. You can undo the latest change.')}</p><p id="order-error" class="form-error" role="alert"></p><div class="form-actions"><output id="order-total" class="order-total"></output>${button('save-draft',t('存為草稿','Save draft'))}<button type="submit" class="primary" ${activeProducts().length?'':'disabled'}>${purchase?t('確認入庫','Receive stock'):t('確認出貨','Ship order')}</button></div></form><section class="order-history"><h3>${t('單據與狀態','Orders and status')}</h3>${orderToolbar()}<div id="order-results">${orderTable(filteredOrders())}</div></section>`);
    addLine();
  }
  function addLine() {
    const products = activeProducts();
    if (!products.length) { $('#order-lines').innerHTML=`<p class="empty-state">${t('請先至商品模組新增商品。','Add a product in Products first.')}</p>`; return; }
    const line = {key:++lineSequence,productId:products[0].id,qty:1,unit:(orderType()==='purchase'?products[0].cost:products[0].price)/100};
    orderLines.push(line);
    $('#order-lines').insertAdjacentHTML('beforeend',`<div class="order-line" data-line="${line.key}"><label>${t('商品','Product')}<select name="product-${line.key}" data-field="productId">${options(products.map(p=>[p.id,`${p.sku} · ${name(p)}`]),line.productId)}</select></label><label>${t('數量','Quantity')}<input name="quantity-${line.key}" data-field="qty" type="number" min="1" max="100000" step="1" value="1" required></label><label>${t('單價（NT$）','Unit price (NT$)')}<input name="unit-${line.key}" data-field="unit" type="number" min="0" max="1000000" step="0.01" value="${line.unit}" required></label>${button('remove-line',t('移除','Remove'),`data-key="${line.key}" aria-label="${t('移除品項','Remove line')} ${line.key}"`)}<div class="line-meta"></div></div>`);
    updateTotal();
  }
  function updateTotal() {
    for (const line of orderLines) {
      const p = state.products.find(p=>p.id===line.productId);
      const row = $(`[data-line="${line.key}"]`);
      row.querySelector('.line-meta').textContent=t(`目前庫存 ${p.stock} 件 · 小計 ${money(Math.round(line.unit*100)*line.qty)}`,`${p.stock} units in stock · Subtotal ${money(Math.round(line.unit*100)*line.qty)}`);
      row.querySelector('[data-action=remove-line]').disabled=orderLines.length===1;
    }
    $('#order-total').textContent=t('合計 ','Total ')+money(orderLines.reduce((total,l)=>total+Math.round(l.unit*100)*l.qty,0));
  }
  function postOrder(form, status='posted') {
    const submit = form.querySelector('[type=submit]'); submit.disabled=true;
    try {
      const type = orderType(), party = new FormData(form).get('party');
      const lines = orderLines.map(l=>({productId:l.productId,qty:l.qty,unit:Math.round(l.unit*100)}));
      transact(data=>addOrder(data,type,party,lines,today(),uid(type==='purchase'?'PO':'SO'),status));
      render(); announce(status==='draft'?t('草稿已儲存，庫存尚未異動。','Draft saved. Stock is unchanged.'):type==='purchase'?t('進貨單已入庫，庫存已更新。','Purchase received. Inventory updated.'):t('銷貨單已出貨，庫存已更新。','Order shipped. Inventory updated.'));
      $('#order-form select').focus();
    } catch (error) { $('#order-error').textContent=error.message; submit.disabled=false; }
  }
  function orderTable(orders) {
    return table([t('日期 / 單號','Date / Order'),t('往來對象','Contact'),t('進出貨','Type'),t('數量','Units'),t('金額 / 明細','Amount / Details')],orders.map(o=>[
      `${escape(o.date)}<br><small title="${escape(o.id)}">${escape(o.id.startsWith('PO-DEMO')||o.id.startsWith('SO-DEMO')?o.id:o.id.slice(0,11))}</small>`,o.type==='sale'?customerLink(o.partyId):escape(en?o.partyNameEn:o.partyName),`<span class="order-status" data-status="${o.status||'posted'}">${statusName(o)}</span>${o.kind==='quote'?`<small>${t('報價','Quote')}</small>`:''}${o.type==='sale'&&posted(o)?`<small class="payment-note">${o.paid===false?t('未付款','Unpaid'):t('已付款','Paid')}${o.paid===false&&o.dueDate?` · ${t('到期','due')} ${escape(o.dueDate)}`:''}</small>`:''}`,number(sum(o.lines,'qty')),
      `<details><summary>${money(o.total)}</summary><ul class="order-detail">${o.lines.map(l=>`<li>${escape(l.sku)} · ${escape(name(l))}<br>${l.qty} × ${money(l.unit)} = ${money(l.qty*l.unit)}</li>`).join('')}</ul></details><div class="table-actions">${!posted(o)?button('advance-order',o.status==='draft'?t('確認單據','Confirm order'):t('完成出入庫','Post stock'),`data-id="${escape(o.id)}"`):''}${button('print-order',t('檢視 / 列印','View / Print'),`data-id="${escape(o.id)}"`)}</div>`
    ]));
  }
  const movementKind = kind => ({opening:t('期初','Opening'),purchase:t('進貨','Purchase'),sale:t('銷貨','Sale')}[kind]);
  function renderInventory() {
    content.insertAdjacentHTML('beforeend',`<h3>${t('即時庫存','Current stock')}</h3>${table([t('編號','Product code'),t('商品','Product'),t('現有量','On hand'),t('安全量','Safety'),t('狀態','Status')],activeProducts().map(p=>[escape(p.sku),escape(name(p)),number(p.stock),number(p.safety),p.stock<=p.safety?`<span class="warning">${t('需補貨','Low stock')}</span>`:`<span class="ok">${t('充足','In stock')}</span>`]))}<section class="erp-panel"><h3>${t('庫存異動紀錄','Stock movements')}</h3><p class="hint">${t('匯出 CSV 包含所有異動；期初庫存與進出貨均可追溯。','CSV includes every movement, from opening stock to posted orders.')}</p>${table([t('日期','Date'),t('商品','Product'),t('原因','Reason'),t('異動量','Change'),t('異動後庫存','Balance'),t('單號','Order')],state.movements.slice().reverse().map(m=>[escape(m.date),`${escape(m.sku)}<br>${escape(name(m))}`,movementKind(m.kind),(m.qty>0?'+':'')+m.qty,number(m.balance),escape(m.orderId||'—')]))}</section>`);
  }
  function renderContacts() {
    content.insertAdjacentHTML('beforeend',`<p class="hint">${t('以下均為虛構往來對象，沒有真實公司或個人聯絡資料。','All contacts below are fictional. No real business or personal contact details are used.')}</p>`);
    for (const kind of ['customers','suppliers']) content.insertAdjacentHTML('beforeend',`<section class="erp-panel"><h3>${kind==='customers'?t('客戶','Customers'):t('供應商','Suppliers')}</h3>${table([t('編號','ID'),t('名稱','Name'),t('聯絡窗口','Contact'),t('區域','Area')],state[kind].map(p=>[escape(p.id),escape(name(p)),escape(en?p.contactEn:p.contact),escape(en?p.areaEn:p.area)]),'contacts-table')}</section>`);
  }
  function bestsellers(orders) {
    const result = new Map();
    for (const o of orders) for (const l of o.lines) {
      const item = result.get(l.productId)||{id:l.productId,sku:l.sku,name:l.name,nameEn:l.nameEn,qty:0,revenue:0,cost:0};
      item.qty+=l.qty; item.revenue+=l.qty*l.unit; item.cost+=l.qty*l.cost; result.set(l.productId,item);
    }
    return [...result.values()].sort((a,b)=>b.qty-a.qty||b.revenue-a.revenue);
  }
  function chart(rows,title) {
    if (!rows.length) return `<p class="empty-state">${t('這個月份尚無銷貨資料。','No sales in this month yet.')}</p>`;
    const max = Math.max(1,...rows.map(r=>r.value)), height = rows.length*42+16;
    return `<svg class="report-chart" viewBox="0 0 600 ${height}" role="img" aria-label="${escape(title)}"><title>${escape(title)}</title>${rows.map((r,i)=>`<text x="0" y="${i*42+26}" fill="#44454a" font-size="13">${escape(r.label)}</text><rect x="125" y="${i*42+9}" width="${Math.max(0,r.value/max*340)}" height="24" rx="2" fill="#91344f"/><text x="475" y="${i*42+26}" fill="#191a1d" font-size="13">${escape(r.display||number(r.value))}</text>`).join('')}</svg>`;
  }
  function monthlyRows() {
    const months = [...new Set([currentMonth(),...state.orders.map(o=>o.date.slice(0,7))])].sort();
    return months.map(month=>{ const sales=salesFor(month);return {month,count:sales.length,revenue:sum(sales,'total'),cost:sum(sales,'cost'),qty:units(sales)}; });
  }
  function renderReports() {
    const months = monthlyRows(), sales = salesFor(reportMonth), ranked = bestsellers(sales), revenue = sum(sales,'total'), profit = revenue-sum(sales,'cost');
    content.insertAdjacentHTML('beforeend',`<div class="toolbar"><label>${t('報表月份','Report month')}<select id="report-month">${options(months.map(m=>[m.month,m.month]),reportMonth)}</select></label></div><div class="metrics report-summary">${metric(t('月銷售額','Monthly sales'),money(revenue))}${metric(t('銷售成本','Cost of goods sold'),money(sum(sales,'cost')))}${metric(t('毛利','Gross profit'),money(profit))}${metric(t('毛利率','Gross margin'),revenue?number(profit/revenue*100)+'%':'—')}</div><p class="hint">${t('金額為新台幣假資料。毛利＝銷售額－出貨時的加權平均成本；未計稅額、運費與營運支出。','Amounts are fictional NTD values. Gross profit is sales minus weighted average cost at shipment; tax, shipping, and operating expenses are excluded.')}</p><section class="erp-panel"><h3>${t('月銷售趨勢','Monthly sales')}</h3>${chart(months.map(m=>({label:m.month,value:m.revenue,display:money(m.revenue)})),t('各月份銷售額','Sales by month'))}${table([t('月份','Month'),t('銷貨單','Orders'),t('銷售額','Sales'),t('毛利','Gross profit')],months.map(m=>[m.month,m.count,money(m.revenue),money(m.revenue-m.cost)]))}</section><section class="erp-panel"><h3>${t('熱銷商品','Bestsellers')} · ${reportMonth}</h3>${chart(ranked.slice(0,5).map(p=>({label:p.sku,value:p.qty,display:t(`${p.qty} 件`,`${p.qty} units`)})),t('本月前五項商品銷售數量','Top five products by units sold this month'))}${table([t('商品','Product'),t('數量','Units'),t('銷售額','Sales'),t('毛利','Gross profit')],ranked.map(p=>[`${escape(p.sku)}<br>${escape(name(p))}`,p.qty,money(p.revenue),money(p.revenue-p.cost)]))}</section>`);
  }
  function exportCSV() {
    let headers,rows;
    if(view==='crm'){
      headers=[t('客戶','Customer'),t('階段','Stage'),t('下次跟進','Next follow-up'),t('聯絡紀錄','Notes')];
      rows=state.crm.map(r=>[name(state.customers.find(c=>c.id===r.customerId)),stages().find(s=>s[0]===r.stage)[1],r.next,r.notes.map(n=>n.date+' '+n.text).join(' / ')]);
    } else if(view==='attendance'){
      headers=[t('員工','Employee'),t('日期','Date'),t('上班','In'),t('下班','Out'),t('加班分鐘','Overtime minutes')];
      rows=state.attendance.map(a=>[name(state.employees.find(e=>e.id===a.employeeId)),a.date,a.in,a.out,a.overtime]);
    } else if (view==='products') {
      headers=[t('編號','Product code'),t('中文名稱','Chinese name'),t('英文名稱','English name'),t('分類','Category'),t('庫存','Stock'),t('安全庫存','Safety stock'),t('成本 NTD','Cost NTD'),t('售價 NTD','Price NTD')];
      rows=productRows().map(p=>[p.sku,p.name,p.nameEn,categoryName(p.category),p.stock,p.safety,p.cost/100,p.price/100]);
    } else if (view==='inventory') {
      headers=[t('日期','Date'),t('單號','Order'),t('編號','Product code'),t('商品','Product'),t('原因','Reason'),t('異動量','Change'),t('結餘','Balance')];
      rows=state.movements.map(m=>[m.date,m.orderId,m.sku,name(m),movementKind(m.kind),m.qty,m.balance]);
    } else if (view==='contacts') {
      headers=[t('類型','Type'),t('編號','ID'),t('名稱','Name'),t('聯絡窗口','Contact'),t('區域','Area')];
      rows=['customers','suppliers'].flatMap(kind=>state[kind].map(p=>[kind==='customers'?t('客戶','Customer'):t('供應商','Supplier'),p.id,name(p),en?p.contactEn:p.contact,en?p.areaEn:p.area]));
    } else if (view==='reports') {
      headers=[t('月份','Month'),t('編號','Product code'),t('商品','Product'),t('銷售數量','Units sold'),t('銷售額 NTD','Sales NTD'),t('成本 NTD','Cost NTD'),t('毛利 NTD','Gross profit NTD')];
      rows=bestsellers(salesFor(reportMonth)).map(p=>[reportMonth,p.sku,name(p),p.qty,p.revenue/100,p.cost/100,(p.revenue-p.cost)/100]);
    } else {
      headers=[t('單號','Order'),t('日期','Date'),t('類型','Type'),t('往來對象','Contact'),t('商品編號','Product code'),t('商品','Product'),t('數量','Quantity'),t('單價 NTD','Unit price NTD'),t('小計 NTD','Subtotal NTD'),t('單位成本 NTD','Unit cost NTD')];
      const orders=state.orders.filter(o=>view==='dashboard'||o.type===orderType());
      rows=orders.flatMap(o=>o.lines.map(l=>[o.id,o.date,movementKind(o.type),en?o.partyNameEn:o.partyName,l.sku,name(l),l.qty,l.unit/100,l.qty*l.unit/100,l.cost/100]));
    }
    // Escape delimiters and prevent spreadsheet formulas in user-controlled strings.
    const cell=value=>`"${(typeof value==='string' && /^[\s]*[=+\-@]/.test(value)?"'"+value:String(value??'')).replace(/"/g,'""')}"`;
    const csv='\uFEFF'+[headers,...rows].map(row=>row.map(cell).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
    const link=document.createElement('a'); link.href=url;link.download=`thinkbig-demo-${view}-${view==='reports'?reportMonth:today()}.csv`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    announce(t('CSV 已匯出（示範資料）。','CSV exported (demo data).'));
  }
  async function confirmAction(title,description) {
    const dialog=$('#confirm-dialog');
    $('#confirm-title').textContent=title;$('#confirm-description').textContent=description;dialog.returnValue='cancel';openDialog(dialog,dialog.querySelector('[value=cancel]'));
    return new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue==='confirm'),{once:true}));
  }
  async function deleteProduct(id) {
    const p=state.products.find(p=>p.id===id);
    if (p.stock>0) { announce(t('此商品仍有庫存，請先透過銷貨出清再刪除。','This product still has stock. Ship the remaining units before deleting it.')); return; }
    if (!await confirmAction(t('刪除此商品？','Delete this product?'),t(`${name(p)} 將從可選商品移除，既有單據與報表仍會保留。`,`${name(p)} will be removed from available products. Existing orders and reports will be kept.`))) return;
    try {
      transact(data=>{data.products.find(p=>p.id===id).active=false;});
      render();announce(t('商品已刪除，歷史紀錄已保留。','Product deleted. History retained.'));$('[data-action=add-product]').focus();
    } catch (error) { announce(error.message); }
  }
  async function reset() {
    if (!await confirmAction(t('重設示範資料？','Reset demo data?'),t('你新增的商品與單據將清除，並還原示範資料。此操作無法復原。','Your added products and orders will be removed and replaced with sample data. This cannot be undone.'))) return;
    const next=seed(),raw=JSON.stringify(next);
    try { localStorage.setItem(KEY,raw);lastSaved=raw;volatile=false;corrupt=false;storageNotice(''); }
    catch (_) { if (corrupt) { announce(t('無法重設瀏覽器內的資料，請確認儲存權限後重試。','Could not reset browser data. Check storage permissions and try again.'));return; } volatile=true;storageNotice(t('目前僅在本頁暫存；重新整理將還原。','Changes last only for this page session and will be lost on refresh.')); }
    state=next;agentChange=null;undoState=null;showUndo();pendingIntent=null;$('#agent-preview').innerHTML='';$('#agent-result').textContent='';view='dashboard';search='';category='';onlyLow=false;selected.clear();orderFilter='';orderPeriod='';orderSearch='';reportMonth=currentMonth();editing=null;render();announce(t('已還原初始示範資料。','Initial demo data restored.'));$('#reset-data').focus();
  }
  const prompts = [
    ['stock','本週哪些商品快缺貨？','Which products need restocking this week?'],
    ['sales','本月銷售與毛利如何？','How are sales and gross profit this month?'],
    ['top','本月哪些商品最熱銷？','What are this month’s bestsellers?'],
    ['margin','哪項商品毛利率最低？','Which product has the lowest margin?'],
    ['overdue','哪個客戶欠款最久？','Which customer has the oldest overdue payment?'],
    ['restock','下週該補什麼貨？','What should we restock next week?'],
    ['unpaid','這週誰還沒付款？','Who has unpaid orders due this week?'],
    ['value','目前庫存值多少？','What is the current inventory value?']
  ];
  const weekStart = () => {const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-(d.getDay()+6)%7);return dateKey(d);};
  const weekEnd = () => {const d=new Date(weekStart()+'T12:00:00');d.setDate(d.getDate()+6);return dateKey(d);};
  const receivables = () => state.orders.filter(o=>o.type==='sale'&&posted(o)&&o.paid===false);
  const dueDate = o => o.dueDate||o.date;
  function insights(key) {
    const sales=salesFor(currentMonth()), ranked=bestsellers(sales);
    let rows=[], message='', detail=key;
    if(key==='stock') {
      rows=lowStock();message=t('依目前庫存與安全量計算。\n','Based on current stock and safety levels.\n')+rows.map(p=>`${name(p)} · ${p.stock} / ${p.safety} · ${t('至少補','add at least')} ${Math.max(1,p.safety+1-p.stock)}`).join('\n');
      if(!rows.length)message+=t('目前皆高於安全量。','All products are above safety stock.');
    } else if(key==='restock') {
      const since=new Date();since.setDate(since.getDate()-7);
      const recent=bestsellers(state.orders.filter(o=>o.type==='sale'&&posted(o)&&o.date>=dateKey(since)));
      rows=activeProducts().map(p=>({...p,need:Math.max(0,p.safety+(recent.find(r=>r.id===p.id)?.qty||0)-p.stock)})).filter(p=>p.need>0);
      message=t('以近 7 天出貨量＋安全量－現有庫存估算；不含未到貨採購，非需求預測。\n','Estimate: last 7 days’ shipments + safety stock − on hand; excludes open purchases, not a demand forecast.\n')+(rows.map(p=>`${name(p)} · ${t('建議補','suggested quantity')} ${p.need}`).join('\n')||t('暫無需補貨品項。','No replenishment suggested.'));
    } else if(key==='margin') {
      rows=ranked.filter(p=>p.revenue>0).sort((a,b)=>(a.revenue-a.cost)/a.revenue-(b.revenue-b.cost)/b.revenue);
      message=rows.length?`${name(rows[0])} · ${number((rows[0].revenue-rows[0].cost)/rows[0].revenue*100)}%\n${t('依本月已出貨單據成本快照計算。','Calculated from this month’s posted sales and cost snapshots.')}`:t('本月尚無可計算的銷貨。','No posted sales this month.');
    } else if(key==='overdue'||key==='unpaid') {
      rows=receivables().filter(o=>key==='overdue'?dueDate(o)<today():dueDate(o)>=weekStart()&&dueDate(o)<=weekEnd()).sort((a,b)=>dueDate(a).localeCompare(dueDate(b)));
      message=rows.length?(key==='overdue'?rows.slice(0,1):rows).map(o=>`${en?o.partyNameEn:o.partyName} · ${money(o.total)} · ${t('到期','due')} ${dueDate(o)}${key==='overdue'?` · ${Math.floor((new Date(today()+'T12:00:00')-new Date(dueDate(o)+'T12:00:00'))/86400000)} ${t('天未付','days overdue')}`:''}`).join('\n'):t('此範圍沒有未付款單據。','No unpaid orders in this period.');
    } else if(key==='value') {
      rows=activeProducts();message=`${money(rows.reduce((n,p)=>n+p.stock*p.cost,0))} · ${rows.length} ${t('項商品；依現有量與加權成本計算。','products; on-hand units × weighted cost.')}`;
    } else if(key==='top') {
      rows=ranked;message=rows.slice(0,5).map(p=>`${name(p)} · ${p.qty} ${t('件','units')} · ${money(p.revenue)}`).join('\n')||t('本月尚無銷貨。','No sales this month.');
    } else {
      rows=sales;detail='sales';message=t(`${currentMonth()} 銷售額 ${money(sum(rows,'total'))}，毛利 ${money(sum(rows,'total')-sum(rows,'cost'))}；${rows.length} 張、${units(rows)} 件。`,`${currentMonth()}: sales ${money(sum(rows,'total'))}, gross profit ${money(sum(rows,'total')-sum(rows,'cost'))}; ${rows.length} orders, ${units(rows)} units.`);
    }
    return {message,rows,detail};
  }
  function questionKey(question) {
    if(prompts.some(p=>p[0]===question))return question;
    const rules=[['restock',/下週|next week/i],['overdue',/欠款最久|逾期|oldest|overdue/i],['unpaid',/沒付款|未付|欠款|unpaid/i],['margin',/毛利.*最低|最低.*毛利|lowest.*margin/i],['value',/庫存.*值|inventory value/i],['stock',/stock|inventory|缺貨|庫存|補貨/i],['top',/top|best|熱銷/i],['sales',/sales|profit|銷售|毛利/i]];
    return rules.find(([,re])=>re.test(question))?.[0];
  }
  function answer(question) {
    const key=questionKey(question), result=key?insights(key):null;
    $('#assistant-answer').textContent=result?.message||t('這是固定腳本示意。請選上方問題，或問「哪個客戶欠款最久？」。','This is a scripted preview. Choose a question above or ask about overdue payments.');
    $('#assistant-detail')?.remove();
    if(result)$('#assistant-answer').insertAdjacentHTML('afterend',button('insight-detail',t('點我看明細 →','View details →'),`id="assistant-detail" data-detail="${key}"`));
  }

  $('#assistant-prompts').innerHTML=prompts.map(([key,zh,english])=>button('ask',t(zh,english),`data-question="${key}"`)).join('');
  $('#assistant-open').addEventListener('click',()=>{$('#assistant-answer').textContent='';$('#assistant-detail')?.remove();openDialog($('#assistant-dialog'),$('#assistant-question'));});
  $('#assistant-close').addEventListener('click',()=>$('#assistant-dialog').close());
  $('#assistant-form').addEventListener('submit',event=>{event.preventDefault();answer($('#assistant-question').value);});
  $('#reset-data').addEventListener('click',reset);
  document.addEventListener('click',event=>{
    const target=event.target.closest('[data-action]');if(!target) return;
    switch(target.dataset.action) {
      case 'navigate':view=target.dataset.view;editing=null;orderPeriod='';orderSearch='';orderFilter='';announce('');render(true);break;
      case 'export':exportCSV();break;
      case 'add-product':showProduct();break;
      case 'edit-product':showProduct(target.dataset.id);break;
      case 'cancel-product':editing=null;$('#product-editor').innerHTML='';$('[data-action=add-product]').focus();break;
      case 'delete-product':deleteProduct(target.dataset.id);break;
      case 'add-line':addLine();$('#order-lines .order-line:last-child select')?.focus();break;
      case 'remove-line':if(orderLines.length>1){orderLines=orderLines.filter(l=>l.key!==Number(target.dataset.key));target.closest('.order-line').remove();updateTotal();$('[data-action=add-line]').focus();}break;
      case 'ask':answer(target.dataset.question);break;
    }
  });
  content.addEventListener('input',event=>{
    if (event.target.id==='product-search') { search=event.target.value;$('#product-results').innerHTML=productTable(); }
    const row=event.target.closest('[data-line]');
    if(row) {
      const line=orderLines.find(l=>l.key===Number(row.dataset.line)),field=event.target.dataset.field;
      if(field==='productId') { line.productId=event.target.value;const p=state.products.find(p=>p.id===line.productId);line.unit=(orderType()==='purchase'?p.cost:p.price)/100;row.querySelector('[data-field=unit]').value=line.unit; }
      else if(field) line[field]=Number(event.target.value);
      updateTotal();
    }
  });
  content.addEventListener('change',event=>{
    if(event.target.id==='category-filter'){category=event.target.value;$('#product-results').innerHTML=productTable();}
    if(event.target.id==='report-month'){reportMonth=event.target.value;render();$('#report-month').focus();}
  });
  content.addEventListener('submit',event=>{
    event.preventDefault();
    if(event.target.id==='product-form')saveProduct(event.target);
    if(event.target.id==='order-form')postOrder(event.target);
  });
  window.addEventListener('storage',event=>{
    if(event.key===KEY||event.key===null)storageNotice(t('另一個分頁已變更示範資料。請重新整理以載入最新資料；未送出的表單不會自動覆蓋。','Another tab changed demo data. Reload to get the latest version; your unfinished form has been left in place.'));
  });
  // All mutations share the same transaction boundary, including the Agent preview.
  function showUndo() {
    const box=$('#undo-toast');if(!box)return;
    box.hidden=!undoState;
    box.querySelector('span').textContent=t('最近一次變更已儲存','Latest change saved');
  }
  function undo() {
    if(!undoState)return;
    const previous=undoState;
    try {transact(data=>{for(const key of Object.keys(data))delete data[key];Object.assign(data,previous);});undoState=null;agentChange=null;showUndo();selected.clear();render();announce(t('已復原最近一次變更。','Latest change undone.'));$('#agent-result').textContent=t('已復原，兩版資料同步。','Undone. Both modes are in sync.');(mode==='agent'?$('#agent-input'):$('#module-title')).focus();}
    catch(error){announce(error.message);}
  }
  function openDialog(dialog,focus) {
    dialog._returnFocus=document.activeElement;
    dialog.showModal();
    (focus||dialog.querySelector('button,input,select'))?.focus();
  }
  function statusName(o) {return o.status==='draft'?t('草稿','Draft'):o.status==='confirmed'?t('已確認','Confirmed'):o.type==='purchase'?t('已入庫','Received'):t('已出貨','Shipped');}
  function filteredOrders() {
    return state.orders.filter(o=>o.type===orderType()&&(!orderFilter||(orderFilter==='unpaid'?posted(o)&&o.paid===false:(o.status||'posted')===orderFilter))&&(!orderPeriod||(posted(o)&&o.date.startsWith(orderPeriod)))&&(!orderSearch||`${o.id} ${o.partyName} ${o.partyNameEn} ${o.lines.map(l=>l.sku+' '+l.name+' '+l.nameEn).join(' ')}`.toLowerCase().includes(orderSearch.toLowerCase()))).sort((a,b)=>orderSort==='amount'?b.total-a.total:orderSort==='oldest'?a.date.localeCompare(b.date):b.date.localeCompare(a.date)||state.orders.indexOf(b)-state.orders.indexOf(a));
  }
  function orderToolbar() {
    return `<div class="toolbar"><label>${t('搜尋單據','Search orders')}<input id="order-search" type="search" value="${escape(orderSearch)}" placeholder="${t('單號、客戶或商品','Order, contact or product')}"></label><label>${t('狀態','Status')}<select id="order-filter">${options([['',t('全部','All')],['draft',t('草稿','Draft')],['confirmed',t('已確認','Confirmed')],['posted',t('已完成','Posted')],['unpaid',t('未付款','Unpaid')]],orderFilter)}</select></label><label>${t('排序','Sort')}<select id="order-sort">${options([['newest',t('日期新到舊','Newest first')],['oldest',t('日期舊到新','Oldest first')],['amount',t('金額高到低','Highest amount')]],orderSort)}</select></label>${orderPeriod?button('clear-period',`${orderPeriod} ×`, `aria-label="${t('清除日期篩選','Clear date filter')}"`):''}</div>`;
  }
  function advanceOrder(id) {
    try {
      transact(data=>{
        const o=data.orders.find(o=>o.id===id);
        if(!o||posted(o))throw Error(t('單據已完成，無需重複過帳。','Order already posted.'));
        if(o.status==='draft'){o.status='confirmed';return;}
        data.orders=data.orders.filter(row=>row.id!==id);
        addOrder(data,o.type,o.partyId,o.lines,today(),o.id,'posted',o.kind);
        const replacement=data.orders.at(-1);replacement.createdDate=o.createdDate||o.date;replacement.dueDate=o.dueDate;replacement.paid=false;
      });render();announce(t('單據狀態已更新。','Order status updated.'));$('#module-title').focus();
    }catch(error){announce(error.message);}
  }
  function navigate(next) {mode='manual';applyMode();view=next;editing=null;render(true);}
  function drill(detail) {
    orderSearch='';orderFilter='posted';orderPeriod=detail==='today'?today():view==='reports'?reportMonth:currentMonth();
    if(detail==='low'){onlyLow=true;search='';category='';navigate('products');}
    else navigate(detail==='purchases'?'purchases':'sales');
  }
  function detailInsight(key) {
    $('#assistant-dialog').open&&$('#assistant-dialog').close();
    const result=insights(key);
    $('#detail-title').textContent=prompts.find(p=>p[0]===key)?.[en?2:1]||t('明細','Details');
    let html=`<p class="hint">${escape(result.message).replace(/\n/g,'<br>')}</p>`;
    if(['sales','overdue','unpaid'].includes(key))html+=orderTable(result.rows);
    else if(['top','margin'].includes(key))html+=table([t('商品','Product'),t('數量','Units'),t('銷售額','Sales'),t('毛利率','Margin')],result.rows.map(p=>[escape(name(p)),p.qty,money(p.revenue),p.revenue?number((p.revenue-p.cost)/p.revenue*100)+'%':'—']));
    else html+=table([t('商品','Product'),t('庫存','Stock'),t('安全量','Safety'),key==='value'?t('庫存價值','Stock value'):t('建議補量','Suggested quantity')],result.rows.map(p=>[escape(name(p)),p.stock,p.safety,key==='value'?money(p.stock*p.cost):p.need??Math.max(1,p.safety+1-p.stock)]));
    $('#detail-body').innerHTML=html;openDialog($('#detail-dialog'));
  }
  function printOrder(id) {
    const o=state.orders.find(o=>o.id===id);if(!o)return;
    $('#detail-title').textContent=(o.kind==='quote'?t('報價單','Quotation'):o.type==='purchase'?t('進貨單','Purchase order'):t('銷貨單','Sales order'))+' · '+statusName(o);
    $('#detail-body').innerHTML=`<div class="print-sheet"><p>${t('示範單據・非正式交易憑證','Demo document · not a transaction receipt')}</p><p>${escape(o.id)}<br>${escape(o.date)} · ${escape(en?o.partyNameEn:o.partyName)}</p><ol class="status-flow"><li>${t('草稿','Draft')}</li><li>${t('已確認','Confirmed')}</li><li>${o.type==='purchase'?t('已入庫','Received'):t('已出貨','Shipped')}</li></ol>${table([t('商品','Product'),t('數量','Quantity'),t('單價','Unit price'),t('小計','Subtotal')],o.lines.map(l=>[escape(l.sku+' · '+name(l)),l.qty,money(l.unit),money(l.unit*l.qty)]))}<p class="order-total">${t('合計','Total')} ${money(o.total)}</p></div>${button('print',t('列印單據','Print document'),'class="primary no-print"')}`;
    openDialog($('#detail-dialog'));
  }
  function paletteResults() {
    const q=$('#command-search').value.trim().toLowerCase();
    const commands=[...modules.map(([key,zh,english])=>({label:t(zh,english),type:'module',id:key})),{label:t('快速建立銷貨單','Create sales order'),type:'module',id:'sales'},{label:t('快速建立進貨單','Create purchase order'),type:'module',id:'purchases'},{label:t('新增商品','Add product'),type:'new-product',id:''},...activeProducts().map(p=>({label:p.sku+' · '+name(p),type:'product',id:p.id})),...state.customers.map(p=>({label:p.id+' · '+name(p),type:'customer',id:p.id})),...state.orders.slice().reverse().map(o=>({label:o.id+' · '+(en?o.partyNameEn:o.partyName),type:'order',id:o.id}))];
    const found=commands.filter(c=>!q||c.label.toLowerCase().includes(q)).slice(0,40);
    $('#command-results').innerHTML=found.map(c=>button('command-result',escape(c.label),`data-kind="${c.type}" data-id="${escape(c.id)}"`)).join('')||`<p class="empty-state">${t('找不到結果，試試商品編號或客戶代號。','No results. Try a SKU or contact ID.')}</p>`;
  }
  function applyMode() {
    document.body.dataset.mode=mode;
    if(mode==='agent')renderAgentData();
    $('#agent-workspace').hidden=mode!=='agent';$('.erp-layout').hidden=mode==='agent';
    document.querySelectorAll('[data-action=mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
  }
  const agentExamples = [
    ['A4 再生影印紙 售出 5 個給 C01','Sell 5 A4 recycled paper to C01'],
    ['進貨 A5 筆記本 20 個','Receive 20 A5 notebook from S01'],
    ['本週哪些商品快缺貨','Which products have low stock'],
    ['方格便條紙 還剩多少','How many Grid memo pad are left']
  ];
  function renderAgentData(panel=$('#agent-data')) {
    if(!panel)return;
    if(panel.id==='agent-data')document.querySelectorAll('.ops-agent-nav button').forEach(b=>{if(b.dataset.view===agentView)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    if(panel.id==='agent-data' && agentView!=='inventory'){panel.innerHTML='';({dashboard:renderOverview,crm:renderCRM,attendance:renderAttendance,receivables:renderReceivables})[agentView](panel);return;}
    const products=activeProducts().slice().sort((a,b)=>Number(b.id===agentChange?.id)-Number(a.id===agentChange?.id));
    panel.innerHTML=`<header><span class="eyebrow">${panel.id==='agent-data'?t('03 · 看資料變化','03 · See what changed'):t('兩版同步 · 即時資料','SHARED LIVE RECORDS')}</span><h3>${t('現在的庫存','Stock right now')}</h3><p class="hint">${t('確認後同步更新；底色標出最近一次變動。','Updates after confirmation. Highlight shows the latest change.')}</p></header><div class="agent-stock-scroll" tabindex="0" role="region" aria-label="${t('商品庫存，可上下捲動','Product stock, scroll for more')}"><table><thead><tr><th>${t('商品','Product')}</th><th>${t('現有數量','On hand')}</th><th>${t('提醒','Status')}</th></tr></thead><tbody>${products.map(p=>`<tr data-product="${escape(p.id)}" class="${agentChange?.id===p.id?'agent-changed':''}"><td>${escape(name(p))}</td><td>${agentChange?.id===p.id&&agentChange.before!==p.stock?`<span class="agent-before">${agentChange.before} → </span>`:''}<strong>${p.stock}</strong></td><td>${p.stock<=p.safety?t('需補貨','Low stock'):t('充足','In stock')}</td></tr>`).join('')}</tbody></table></div><h3 class="agent-orders-heading">${t('最近單據','Recent orders')}</h3><div class="agent-orders">${state.orders.slice(-3).reverse().map(o=>`<article class="${agentChange?.orderId===o.id?'agent-changed':''}"><strong>${o.type==='purchase'?t('進貨單','Purchase order'):o.kind==='quote'?t('報價草稿','Quote draft'):t('出貨單','Sales order')}</strong><span>${statusName(o)}</span><small>${escape(o.id)}</small><p>${escape(o.lines.map(l=>name(l)+' × '+l.qty).join(', '))}</p></article>`).join('')||`<p>${t('還沒有單據。確認第一筆操作後會出現在這裡。','No orders yet. Confirm your first action to see it here.')}</p>`}</div>`;
  }
  // Taiwanese synonyms plus English equivalents. IDs and exact names also work.
  const saleWords=/售出|賣掉|賣出|賣了|賣|出了|出貨|銷貨|sell|sold|ship/i;
  const purchaseWords=/進貨|進了|補貨|補進|買進|入庫|採購|receive|purchase|restock|buy/i;
  function resolveProduct(text) {
    const q=text.toLowerCase();
    if(/A4\s*(紙|paper)/i.test(text))return activeProducts().find(p=>p.id==='P001');
    const exact=activeProducts().filter(p=>[p.sku,p.name,p.nameEn].some(n=>q.includes(n.toLowerCase())));
    if(exact.length>1)return null;
    if(exact.length===1)return exact[0];
    const aliases=[...text.matchAll(/(?:文具\s*)?\b([ABCD])\b(?:\s*款)?/gi)];
    if(new Set(aliases.map(m=>m[1].toUpperCase())).size>1)return null;
    const match=aliases[0]||text.match(/文具([ABCD])(?![A-Za-z0-9])/i);
    return match?state.products.find(p=>p.id===`P00${'ABCD'.indexOf(match[1].toUpperCase())+1}`&&p.active):null;
  }
  function resolveParty(text,type) {
    const parties=type==='purchase'?state.suppliers:state.customers,q=text.toLowerCase();
    const found=parties.filter(p=>[p.id,p.name,p.nameEn].some(n=>new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?![0-9])','i').test(q)));
    if(found.length===1)return found[0];
    if(found.length>1)return null;
    if(type!=='purchase' && /鼎成|Dingcheng|王老闆|Mr Wang/i.test(text))return parties[0];
    if(type!=='purchase')return /大成/.test(text)?parties[0]:/順達/.test(text)?parties[1]:null;
    // A missing supplier is an explicit editable default on the confirmation card.
    return /(?:供應商|supplier|from)\s*\S+/i.test(text)?null:parties[0];
  }
  function parseAgent(text) {
    if(/刪除|delete|清空|reset|不要|別|取消|不賣|不進|不出|不補|don't|do not|cancel|\bnot\b/i.test(text))return null;
    if(/然後|再把|順便|同時|並且|and then|also|;|；/i.test(text))return null;
    const p=resolveProduct(text), quote=/報價|quotation|quote/i.test(text);
    if(/安全(?:庫存|量)|safety/i.test(text)&&/改|設|調|set|change|update/i.test(text)) {
      const value=text.match(/(?:改成|改為|設為|設成|調成|調到|to|=)\s*(\d+)(?![\d.])/i);
      if(!p||!value)return null;return {type:'safety',productId:p.id,qty:Number(value[1])};
    }
    if(p&&/剩|還有|幾個|多少|庫存|left|on hand|how many/i.test(text)&&!saleWords.test(text)&&!purchaseWords.test(text))return {type:'stock',productId:p.id};
    if(quote){const quantity=text.replace(/ST-\d+|[PCS]\d{2,3}/gi,'').match(/(\d+)\s*(?:個|件|本|支|箱|boxes|units?)/i);return {type:'quote',partyId:resolveParty(text,'sale')?.id||'',productId:p?.id||'',qty:quantity?Number(quantity[1]):1};}
    // Analytical questions must win over words such as 補貨 / restock.
    const key=questionKey(text);
    if(key&&(/哪些|什麼|哪個|這週|本週|下週|本月|最低|最久|誰|值|which|what|who|week|month|lowest|oldest/i.test(text)))return {type:'insight',key};
    const purchase=purchaseWords.test(text),sale=saleWords.test(text);
    if(purchase===sale)return null;
    const type=purchase?'purchase':'sale',party=resolveParty(text,type);
    if(!p||!party)return null;
    let scrubbed=text;
    for(const token of [p.sku,p.name,p.nameEn])scrubbed=scrubbed.replace(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),'');
    scrubbed=scrubbed.replace(/ST-\d+|[PCS]\d{2,3}|30cm/gi,'');
    const quantities=[...scrubbed.matchAll(/(-?\d+(?:\.\d+)?)/g)].map(m=>Number(m[1]));
    if(!p||!party||quantities.length!==1||!Number.isInteger(quantities[0])||quantities[0]<=0||quantities[0]>100000)return null;
    return {type,partyId:party.id,productId:p.id,qty:quantities[0]};
  }
  function agentRespond(text) {
    pendingIntent=null;$('#agent-preview').innerHTML='';$('#agent-result').textContent='';
    setTimeout(()=>$('#agent-result').scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}),0);
    if(operationsAgent(text))return;
    const intent=parseAgent(text);
    if(!intent){$('#agent-result').innerHTML=`<p>${t('這個示範版還聽不懂這句。可以問：今天營收、今天的打卡紀錄、待跟進客戶、未收款、某商品還剩多少；或下指令：售出／進貨某商品幾個、開報價、請假。','This demo does not understand that yet. Try: today’s revenue, today’s clock-ins, follow-ups, unpaid invoices, stock of a product; or: sell/receive a quantity, create a quote, request leave.')}</p>${agentExamples.slice(0,3).map(([zh,english])=>button('agent-example',escape(t(zh,english)),`data-text="${escape(t(zh,english))}"`)).join('')}`;return;}
    if(intent.type==='stock'){const p=state.products.find(p=>p.id===intent.productId);$('#agent-result').innerHTML=`<p>${escape(name(p))} · ${p.stock} ${t('件；安全量','units; safety stock')} ${p.safety}</p>${button('agent-product',t('點我看明細 →','View details →'),`data-id="${escape(p.id)}"`)}`;return;}
    if(intent.type==='insight'){const r=insights(intent.key);$('#agent-result').innerHTML=`<p>${escape(r.message).replace(/\n/g,'<br>')}</p>${button('insight-detail',t('點我看明細 →','View details →'),`data-detail="${intent.key}"`)}`;return;}
    pendingIntent=intent;$('#agent-result').textContent=t('請檢查下方內容；按確認後才會寫入。','Review the fields below. Nothing changes until you confirm.');
    const purchase=intent.type==='purchase',safety=intent.type==='safety',parties=purchase?state.suppliers:state.customers;
    $('#agent-preview').innerHTML=`<form id="agent-confirm" class="edit-panel"><span class="eyebrow">${t('02 · 確認再執行','02 · Review and confirm')}</span><h3>${t('我理解成：','My understanding: ')}${safety?t('修改安全庫存','Update safety stock'):intent.type==='quote'?t('建立報價草稿','Create quotation draft'):purchase?t('建立進貨單並入庫','Create and receive purchase'):t('建立銷貨單並出貨','Create and ship sale')}</h3><div class="form-grid">${!safety?`<label>${purchase?t('供應商','Supplier'):t('客戶','Customer')}<select name="party" required>${options([['',t('請選擇','Choose a contact')],...parties.map(p=>[p.id,name(p)])],intent.partyId)}</select></label>`:''}<label>${t('商品','Product')}<select name="product" required>${options([['',t('請選擇商品','Choose a product')],...activeProducts().map(p=>[p.id,p.sku+' · '+name(p)])],intent.productId)}</select></label><label>${safety?t('新安全庫存','New safety stock'):t('數量','Quantity')}<input name="qty" type="number" min="${safety?0:1}" max="100000" step="1" required value="${intent.qty}"></label>${!safety?`<label>${t('單價（NT$）','Unit price (NT$)')}<input name="unit" type="number" min="0" max="1000000" step="0.01" required></label>`:''}</div><p id="agent-impact" aria-live="polite"></p><p id="agent-error" role="alert" class="form-error"></p><div class="form-actions">${button('agent-cancel',t('取消','Cancel'))}<button type="submit" class="primary">${t('確認執行','Confirm action')}</button></div></form>`;
    updatePreview(true);$('#agent-confirm select')?.focus();
  }
  function updatePreview(updatePrice=false) {
    if(!pendingIntent)return;
    const form=$('#agent-confirm'),p=state.products.find(p=>p.id===form.elements.product.value),qty=Number(form.elements.qty.value),type=pendingIntent.type;
    if(updatePrice&&form.elements.unit)form.elements.unit.value=p?(type==='purchase'?p.cost:p.price)/100:0;
    $('#agent-impact').textContent=!p?t('請選擇商品後檢查影響。','Choose a product to preview the change.'):type==='safety'?`${name(p)} · ${t('安全庫存','Safety stock')} ${p.safety} → ${qty}`:type==='quote'?`${name(p)} × ${qty} · ${t('草稿不異動庫存','Draft: no stock change')} (${p.stock} → ${p.stock})`:`${name(p)} × ${qty} · ${t('庫存','Stock')} ${p.stock} → ${p.stock+(type==='purchase'?qty:-qty)} · ${money(qty*Math.round(Number(form.elements.unit.value)*100))}`;
  }
  function confirmAgent(form) {
    if(!pendingIntent||!form.reportValidity())return;
    const intent={...pendingIntent},id=form.elements.product.value,qty=Number(form.elements.qty.value),unit=Math.round(Number(form.elements.unit?.value||0)*100),party=form.elements.party?.value;
    const before=state.products.find(p=>p.id===id);
    try {
      transact(data=>{
        if(intent.type==='safety'){const p=data.products.find(p=>p.id===id&&p.active);if(!p||!Number.isInteger(qty)||qty<0||qty>100000)throw Error(t('請輸入有效安全庫存。','Enter a valid safety level.'));p.safety=qty;}
        else addOrder(data,intent.type==='purchase'?'purchase':'sale',party,[{productId:id,qty,unit}],today(),uid(intent.type==='purchase'?'PO':intent.type==='quote'?'QT':'SO'),intent.type==='quote'?'draft':'posted',intent.type==='quote'?'quote':'order');
        if(intent.type==='quote'){const c=data.crm.find(c=>c.customerId===party);if(c&&c.stage!=='won')c.stage='quote';}
      });
      const after=state.products.find(p=>p.id===id),order=intent.type==='safety'?null:state.orders.at(-1);
      agentChange={id,before:before.stock,orderId:order?.id};pendingIntent=null;$('#agent-preview').innerHTML='';
      $('#agent-result').innerHTML=`<article class="agent-receipt"><h3>${t('已完成 · 做了這些事','Done · Here is what changed')}</h3>${order?`<p>${intent.type==='quote'?t('建立報價草稿','Created quote draft'):intent.type==='purchase'?t('建立進貨單並入庫','Created purchase order and received stock'):t('建立出貨單並出貨','Created sales order and shipped stock')}<br><strong>${escape(order.id)}</strong></p>`:''}<p>${escape(name(after))}<br>${intent.type==='safety'?t('補貨提醒門檻','Low-stock threshold'):t('庫存','Stock')} <strong>${intent.type==='safety'?before.safety:before.stock} → ${intent.type==='safety'?after.safety:after.stock}</strong>${intent.type==='quote'?t('（草稿不改庫存）',' (draft leaves stock unchanged)'):''}</p>${button('undo',t('復原這次操作','Undo this action'))}</article>`;
      render();$('#agent-input').focus();
    }catch(error){$('#agent-error').textContent=error.message;}
  }
  function setupWorkspace() {
    $('#storage-status').insertAdjacentElement('afterend',$('#app-status'));
    // Keep the explanatory illustration after the working controls.
    const flow=$('.anatomy-flow');
    flow?.remove();
    $('.erp-heading').insertAdjacentHTML('beforeend',`<div class="workspace-tools"><div class="mode-switch" role="group" aria-label="${t('操作模式','Workspace mode')}">${button('mode',t('手動版','Manual'),'data-mode="manual" aria-pressed="true"')}${button('mode',t('Agent 版','Agent'),'data-mode="agent" aria-pressed="false"')}</div>${button('command',t('搜尋 / 指令','Search / Commands')+' <kbd>⌘ K</kbd>')}${button('theme',t('深色主題','Dark theme'),'id="theme-toggle"')}${button('tour',t('操作導覽','Quick tour'))}</div>`);
    $('.demo-notice').insertAdjacentHTML('afterend','<section id="tour" aria-label="'+t('操作導覽','Quick tour')+'" hidden></section>');
    $('.erp-layout').insertAdjacentHTML('beforebegin',`<p class="shared-data-note">${t('同一份資料，兩種操作方式：手動選單填寫，或讓 Agent 依一句話準備。切換不會重設庫存。','One dataset, two ways to work: fill in a form or ask Agent to prepare it. Switching keeps your stock and orders.')}</p>`);
    const notice=$('.demo-notice'), shared=$('.shared-data-note');
    notice.insertAdjacentHTML('beforebegin',`<div class="demo-help"><span class="demo-caption">${t('假資料示範 · 兩版共用庫存','Demo data · Shared stock')}</span><details id="demo-help"><summary>${t('怎麼玩','How to play')}</summary><div class="demo-help-body"></div></details></div>`);
    const help=$('.demo-help-body');
    help.append(notice,shared);
    const extras=document.createElement('div');extras.className='help-tools';
    document.querySelectorAll('.workspace-tools > button').forEach(el=>extras.append(el));
    help.append(extras);
    $('.erp-layout').insertAdjacentHTML('beforebegin',`<section id="agent-workspace" hidden><div class="agent-intro"><span class="eyebrow">${t('你的營運工作台','YOUR OPERATIONS DESK')}</span><h2>${t('說一句，處理今天的營運。','One request. Run today’s operations.')}</h2><p>${t('客戶跟進、請假、報價與庫存。每次修改都由你確認。','Follow-ups, leave, quotes and stock. You confirm every change.')}</p></div><div class="agent-desk"><section class="agent-conversation" aria-label="${t('操作與確認','Request and confirmation')}"><span class="eyebrow">${t('01 · 說出要做的事','01 · Make a request')}</span><form id="agent-form"><label for="agent-input">${t('想處理什麼事？','What would you like to do?')}</label><div class="agent-input-row"><input id="agent-input" maxlength="300" autocomplete="off" placeholder="${t('例如：A4 再生影印紙 售出 5 個給 C01','Example: Sell 5 A4 recycled paper to C01')}" required><button type="submit" class="primary">${t('送出指令','Preview action')}</button><button type="button" id="voice-button" hidden>${t('語音輸入','Voice input')}</button></div></form><div id="agent-result" role="status" aria-live="polite"></div><div id="agent-preview"></div><p id="voice-note" class="hint" hidden></p><div class="agent-examples">${agentExamples.map(([zh,english])=>button('agent-example',escape(t(zh,english)),`data-text="${escape(t(zh,english))}"`)).join('')}</div><p class="hint">${t('本機示範：依範例辨識文字，未連接 AI 或正式資料。先確認，才會改動資料。','Local demo: recognizes example patterns; no AI or live business connection. Changes require your confirmation.')}</p></section><section id="agent-data" aria-label="${t('庫存與單據','Stock and orders')}"></section></div></section>`);
    document.body.insertAdjacentHTML('beforeend',`<div id="undo-toast" hidden><span role="status"></span>${button('undo',t('復原','Undo'))}</div><dialog id="command-dialog" aria-labelledby="command-title"><header class="assistant-top"><h2 id="command-title">${t('搜尋與指令','Search and commands')}</h2>${button('close-dialog',t('關閉','Close'))}</header><label>${t('搜尋商品、客戶、單據或功能','Search products, customers, orders or actions')}<input id="command-search" type="search" autocomplete="off"></label><p class="hint">${t('↑ ↓ 選擇 · Enter 開啟 · Esc 關閉','↑ ↓ select · Enter open · Esc close')}</p><div id="command-results"></div></dialog><dialog id="detail-dialog" aria-labelledby="detail-title"><header class="assistant-top"><h2 id="detail-title"></h2>${button('close-dialog',t('關閉','Close'))}</header><div id="detail-body"></div></dialog>`);
    document.querySelectorAll('dialog').forEach(dialog=>{
      dialog.addEventListener('keydown',event=>{
        if(event.key!=='Tab')return;
        const items=[...dialog.querySelectorAll('button,input,select,textarea,a[href],summary,[tabindex="0"]')].filter(el=>!el.disabled&&!el.hidden&&el.getClientRects().length);
        if(!items.length){event.preventDefault();return;}
        const first=items[0],last=items.at(-1);
        if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus();}
      });
      dialog.addEventListener('close',()=>{if(document.querySelector('dialog[open]'))return;if(dialog._returnFocus?.isConnected)dialog._returnFocus.focus();else $('#module-title')?.focus();});
    });
    $('#agent-form').addEventListener('submit',event=>{event.preventDefault();agentRespond($('#agent-input').value.trim());});
    $('#agent-preview').addEventListener('submit',event=>{event.preventDefault();if(event.target.id==='ops-agent-confirm')return;confirmAgent(event.target);});
    $('#agent-preview').addEventListener('input',event=>updatePreview(event.target.name==='product'));
    $('#command-search').addEventListener('input',paletteResults);
    $('#command-dialog').addEventListener('keydown',event=>{
      const items=[...$('#command-results').querySelectorAll('button')],index=items.indexOf(document.activeElement);
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();items[(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}
      if(event.key==='Enter'&&document.activeElement===$('#command-search')){event.preventDefault();items[0]?.click();}
    });
    document.addEventListener('keydown',event=>{if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();if(document.querySelector('dialog[open]'))return;openCommands();}});
    let theme=window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light',seen=false;
    try{theme=localStorage.getItem('tb-erp-theme')||theme;seen=localStorage.getItem('tb-erp-tour')==='done';}catch(_){}
    setTheme(theme);if(!seen)showTour(0);
  }
  let tourStep=0;
  function showTour(step) {
    tourStep=step;const tour=$('#tour');tour.hidden=false;
    const steps=[
      [t('先看今天需要處理什麼','Start with what needs attention'),t('點儀表板數字可看原始單據，缺貨提醒可直接篩出商品。','Click dashboard figures to see their source orders. Low-stock alerts open a filtered product list.')],
      [t('一句話也能開單','Create an order in a sentence'),t('切到 Agent 版，選一個範例。先看確認卡與庫存變化，再按確認執行。','Switch to Agent, choose an example, review the fields and stock change, then confirm.')],
      [t('放心試，也能復原','Try it and undo'),t('右下角可復原最近一次變更。⌘K / Ctrl+K 隨時找商品、客戶與單據。','Undo the latest change at the bottom right. Use ⌘K / Ctrl+K to find products, contacts and orders.')]
    ];
    tour.innerHTML=`<div><span class="eyebrow">${t('30 秒上手','A 30-SECOND TOUR')} · ${step+1} / 3</span><h2>${steps[step][0]}</h2><p>${steps[step][1]}</p></div><div class="table-actions">${button('tour-skip',t('關閉提示','Dismiss'))}${button('tour-next',step===2?t('開始操作','Get started'):t('下一步','Next'),'class="primary"')}</div>`;
  }
  function finishTour(){ $('#tour').hidden=true;try{localStorage.setItem('tb-erp-tour','done');}catch(_){} }
  function setTheme(theme){document.body.dataset.theme=theme;$('#theme-toggle').textContent=theme==='dark'?t('淺色主題','Light theme'):t('深色主題','Dark theme');try{localStorage.setItem('tb-erp-theme',theme);}catch(_){} }
  function openCommands(){$('#command-search').value='';paletteResults();openDialog($('#command-dialog'),$('#command-search'));}
  async function batchProducts(kind) {
    const ids=[...selected].filter(id=>activeProducts().some(p=>p.id===id));
    if(!ids.length){announce(t('請先勾選商品。','Select products first.'));return;}
    const safety=Number($('#batch-safety').value);
    if(kind==='safety'&&(!$('#batch-safety').value||!Number.isInteger(safety)||safety<0||safety>100000)){announce(t('安全庫存請填 0–100000 的整數。','Enter a safety level from 0 to 100000.'));return;}
    if(kind==='delete'&&!await confirmAction(t('刪除所選商品？','Delete selected products?'),t('僅零庫存可刪除；整批會一起檢查，也可以復原。','Only zero-stock products can be deleted. The entire batch is checked together and can be undone.')))return;
    try{transact(data=>{const products=data.products.filter(p=>ids.includes(p.id));if(kind==='delete'&&products.some(p=>p.stock>0))throw Error(t('所選商品仍有庫存，整批未刪除。','Some selected products have stock. Nothing was deleted.'));products.forEach(p=>{if(kind==='delete')p.active=false;else p.safety=safety;});});selected.clear();render();announce(t('已套用批次變更，可復原。','Batch updated. Undo is available.'));}
    catch(error){announce(error.message);}
  }
  document.addEventListener('click',event=>{
    const target=event.target.closest('[data-action]');if(!target)return;
    switch(target.dataset.action){
      case 'mode':mode=target.dataset.mode;applyMode();if(mode==='agent')$('#agent-input').focus();break;
      case 'theme':setTheme(document.body.dataset.theme==='dark'?'light':'dark');break;
      case 'command':openCommands();break;
      case 'close-dialog':target.closest('dialog').close();break;
      case 'undo':undo();break;
      case 'tour':showTour(0);break;
      case 'tour-skip':finishTour();break;
      case 'tour-next':if(tourStep===2)finishTour();else showTour(tourStep+1);break;
      case 'sort-direction':sortDirection*=-1;render();$('[data-action=sort-direction]').focus();break;
      case 'batch-safety':batchProducts('safety');break;
      case 'batch-delete':batchProducts('delete');break;
      case 'save-draft':if($('#order-form').reportValidity())postOrder($('#order-form'),'draft');break;
      case 'advance-order':advanceOrder(target.dataset.id);break;
      case 'clear-period':orderPeriod='';render();break;
      case 'drill':drill(target.dataset.detail);break;
      case 'insight-detail':detailInsight(target.dataset.detail);break;
      case 'print-order':printOrder(target.dataset.id);break;
      case 'print':window.print();break;
      case 'agent-example':$('#agent-input').value=target.dataset.text;agentRespond(target.dataset.text);break;
      case 'agent-cancel':pendingIntent=null;$('#agent-preview').innerHTML='';$('#agent-result').textContent=t('已取消，資料未變更。','Cancelled. Nothing changed.');$('#agent-input').focus();break;
      case 'agent-product':{const p=state.products.find(p=>p.id===target.dataset.id);search=p.sku;category='';onlyLow=false;navigate('products');break;}
      case 'command-result':{
        const {kind,id}=target.dataset;$('#command-dialog').close();orderSearch='';orderFilter='';orderPeriod='';
        if(kind==='module')navigate(id);
        if(kind==='new-product'){navigate('products');showProduct();}
        if(kind==='product'){search=state.products.find(p=>p.id===id).sku;onlyLow=false;category='';navigate('products');}
        if(kind==='customer'){orderSearch=state.customers.find(p=>p.id===id).name;navigate('sales');$('#order-form [name=party]').value=id;}
        if(kind==='order')printOrder(id);break;
      }
    }
  });
  content.addEventListener('input',event=>{
    if(event.target.id==='order-search'){orderSearch=event.target.value;$('#order-results').innerHTML=orderTable(filteredOrders());}
  });
  content.addEventListener('change',event=>{
    const el=event.target;
    if(el.id==='product-sort'){sortKey=el.value;$('#product-results').innerHTML=productTable();}
    if(el.id==='low-only'){onlyLow=el.checked;selected.clear();$('#product-results').innerHTML=productTable();$('#selected-count').textContent=`0 ${t('項已選','selected')}`;}
    if(el.id==='select-all'){for(const p of productRows())el.checked?selected.add(p.id):selected.delete(p.id);$('#product-results').innerHTML=productTable();$('#select-all').focus();}
    if(el.dataset.select){el.checked?selected.add(el.dataset.select):selected.delete(el.dataset.select);$('#select-all').checked=productRows().every(p=>selected.has(p.id));}
    if(el.dataset.select||el.id==='select-all')$('#selected-count').textContent=`${selected.size} ${t('項已選','selected')}`;
    if(el.dataset.safety){
      const p=state.products.find(p=>p.id===el.dataset.safety),value=Number(el.value);
      if(!el.value||!Number.isInteger(value)||value<0||value>100000){el.value=p.safety;announce(t('請填 0–100000 的整數。','Enter a whole number from 0 to 100000.'));return;}
      try{transact(data=>{data.products.find(row=>row.id===p.id).safety=value;});el.closest('td').querySelector('span').classList.toggle('warning',p.stock<=value);announce(t('安全庫存已儲存，可復原。','Safety stock saved. Undo is available.'));}
      catch(error){el.value=p.safety;announce(error.message);}
    }
    if(el.id==='order-filter'||el.id==='order-sort'){if(el.id==='order-filter')orderFilter=el.value;else orderSort=el.value;$('#order-results').innerHTML=orderTable(filteredOrders());}
  });

  let agentView='inventory', customerId='C01', overdueOnly=false;
  const stages=()=>[['talk',t('洽談','Discussion')],['quote',t('報價','Quotation')],['won',t('成交','Won')],['lost',t('流失','Lost')]];
  function offsetDate(days){const d=new Date();d.setDate(d.getDate()+days);return dateKey(d);}
  function upgradeOperations(data){
    if(data.operationsVersion===1)return;
    data.customers[0].name='鼎成文具（虛構）';data.customers[0].nameEn='Dingcheng Stationery (fictional)';
    data.customers[0].contact='王老闆（虛構）';data.customers[0].contactEn='Mr Wang (fictional)';
    data.crm=data.customers.map((c,i)=>({customerId:c.id,stage:['talk','quote','won','lost'][i%4],next:offsetDate(i-2),notes:[]}));
    data.employees=[{id:'E01',name:'小陳（虛構）',nameEn:'Chen (fictional)'},{id:'E02',name:'小林（虛構）',nameEn:'Lin (fictional)'},{id:'E03',name:'小許（虛構）',nameEn:'Hsu (fictional)'}];
    data.attendance=[];for(let day=1;day<=new Date().getDate();day++)for(const [i,e] of data.employees.entries())data.attendance.push({id:`AT-${day}-${e.id}`,employeeId:e.id,date:`${currentMonth()}-${String(day).padStart(2,'0')}`,in:i===1?'09:12':'08:55',out:day===new Date().getDate()?'':'18:00',overtime:day===new Date().getDate()?0:i*30});
    data.leaves=[];data.operationsVersion=1;
  }
  function customerLink(id){const c=state.customers.find(c=>c.id===id);return c?button('ops-customer',escape(name(c)),`data-id="${escape(id)}" class="text-link"`):escape(id);}
  function unpaid(){return state.orders.filter(o=>o.type==='sale'&&posted(o)&&!o.paid);}
  function overdue(o,days=0){return o.dueDate<offsetDate(-days);}
  function morning(){const due=unpaid().filter(o=>overdue(o));return t(`今天營收 ${money(sum(salesFor(currentMonth()).filter(o=>o.date===today()),'total'))}；${state.orders.filter(o=>o.type==='sale'&&!posted(o)).length} 張單待出貨、${lowStock().length} 項商品需補貨。逾期應收 ${due.length} 筆，${state.crm.filter(c=>c.next&&c.next<=today()).length} 位客戶待跟進；今天已有 ${state.attendance.filter(a=>a.date===today()).length} 人打卡。`,`Today's revenue is ${money(sum(salesFor(currentMonth()).filter(o=>o.date===today()),'total'))}; ${state.orders.filter(o=>o.type==='sale'&&!posted(o)).length} orders await shipping and ${lowStock().length} products need replenishment. ${due.length} payments are overdue, ${state.crm.filter(c=>c.next&&c.next<=today()).length} customers need follow-up, and ${state.attendance.filter(a=>a.date===today()).length} people have clocked in.`);}
  function renderOverview(target){target.insertAdjacentHTML('beforeend',`<section class="morning"><h3>${t('今日營運 · 晨報','Today · Morning brief')}</h3><p>${morning()}</p></section><div class="ops-metrics">${[[t('今日營收','Today’s revenue'),money(sum(salesFor(currentMonth()).filter(o=>o.date===today()),'total')),'sales'],[t('待出貨','Awaiting shipment'),state.orders.filter(o=>o.type==='sale'&&!posted(o)).length,'receivables'],[t('缺貨提醒','Low stock'),lowStock().length,'inventory'],[t('逾期應收','Overdue payments'),unpaid().filter(o=>overdue(o)).length,'receivables'],[t('今日出勤','Clocked in today'),state.attendance.filter(a=>a.date===today()).length,'attendance'],[t('待跟進客戶','Follow-ups due'),state.crm.filter(c=>c.next&&c.next<=today()).length,'crm']].map(([label,value,v])=>button('ops-view',`<small>${label}</small><strong>${value}</strong>`,`data-view="${v}"`)).join('')}</div>`);}
  function renderCRM(target){
    const record=state.crm.find(c=>c.customerId===customerId)||state.crm[0],c=state.customers.find(c=>c.id===record.customerId);
    target.insertAdjacentHTML('beforeend',`<h3>${t('商機階段','Opportunity pipeline')}</h3><div class="pipeline">${stages().map(([key,label])=>`<section><h4>${label} <span>${state.crm.filter(c=>c.stage===key).length}</span></h4>${state.crm.filter(c=>c.stage===key).map(c=>`<article>${customerLink(c.customerId)}<small class="${c.next&&c.next<=today()?'warning':''}">${t('下次跟進','Next follow-up')} ${escape(c.next||'—')}</small></article>`).join('')}</section>`).join('')}</div>${table([t('客戶','Customer'),t('聯絡人','Contact'),t('下次跟進','Next follow-up')],state.customers.map(c=>[customerLink(c.id),escape(en?c.contactEn:c.contact),escape(state.crm.find(r=>r.customerId===c.id)?.next||'—')]))}<section class="erp-panel"><h3>${escape(name(c))}</h3><form data-ops-form="crm" class="edit-panel"><input type="hidden" name="customerId" value="${c.id}"><div class="form-grid"><label>${t('商機階段','Stage')}<select name="stage">${options(stages(),record.stage)}</select></label><label>${t('下次跟進日期','Next follow-up date')}<input name="next" type="date" value="${escape(record.next)}" required></label><label>${t('聯絡紀錄','Contact note')}<input name="note" maxlength="300" placeholder="${t('記下這次聯絡內容','Record this conversation')}"></label></div><div class="form-actions"><button class="primary">${t('儲存紀錄','Save record')}</button>${button('ops-quote',t('為此客戶開報價','Create quote for customer'),`data-id="${c.id}"`)}</div></form><ul class="contact-history">${record.notes.map(n=>`<li>${escape(n.date)} · ${escape(n.text)}</li>`).join('')||`<li>${t('尚無聯絡紀錄。','No contact notes yet.')}</li>`}</ul><h3>${t('此客戶的報價與訂單','Customer quotes and orders')}</h3>${orderTable(state.orders.filter(o=>o.partyId===c.id&&o.type==='sale').slice(-8).reverse())}</section>`);
  }
  function renderAttendance(target){
    const month=state.attendance.filter(a=>a.date.startsWith(currentMonth()));
    target.insertAdjacentHTML('beforeend',`<h3>${t('本月出勤統計','Attendance this month')} · ${currentMonth()}</h3>${table([t('員工','Employee'),t('出勤天數','Days'),t('遲到次數','Late arrivals'),t('加班分鐘','Overtime minutes')],state.employees.map(e=>{const rows=month.filter(a=>a.employeeId===e.id);return [escape(name(e)),rows.length,rows.filter(a=>a.in>'09:00').length,sum(rows,'overtime')]}))}<section class="erp-panel"><h3>${t('請假申請','Request leave')}</h3><form data-ops-form="leave" class="edit-panel"><div class="form-grid"><label>${t('員工','Employee')}<select name="employeeId">${options(state.employees.map(e=>[e.id,name(e)]),'E01')}</select></label><label>${t('日期（一天）','Date (one day)')}<input name="date" type="date" required value="${offsetDate(1)}"></label><label>${t('假別','Leave type')}<select name="kind">${options([['annual',t('特休','Annual leave')],['sick',t('病假','Sick leave')]],'annual')}</select></label></div><div class="form-actions"><button class="primary">${t('送出申請','Submit request')}</button></div></form>${table([t('員工','Employee'),t('日期','Date'),t('假別','Type'),t('審核','Review')],state.leaves.map(l=>[escape(name(state.employees.find(e=>e.id===l.employeeId))),l.date,l.kind==='annual'?t('特休','Annual leave'):t('病假','Sick leave'),l.status==='pending'?`${button('ops-leave-approve',t('核准','Approve'),`data-id="${l.id}"`)} ${button('ops-leave-reject',t('駁回','Reject'),`data-id="${l.id}"`)}`:l.status==='approved'?t('已核准','Approved'):t('已駁回','Rejected')]))}</section><section class="erp-panel"><h3>${t('打卡紀錄','Clock records')}</h3>${table([t('日期','Date'),t('員工','Employee'),t('上班','In'),t('下班','Out'),t('狀態','Status')],month.slice().reverse().map(a=>[a.date,escape(name(state.employees.find(e=>e.id===a.employeeId))),a.in,a.out||'—',`${a.in>'09:00'?`<span class="warning">${t('遲到','Late')}</span>`:t('準時','On time')}${a.overtime?` · ${t('加班','Overtime')} ${a.overtime} ${t('分','min')}`:''}`]))}</section>`);
  }
  function renderReceivables(target){
    const rows=state.orders.filter(o=>o.type==='sale'&&(!overdueOnly||(posted(o)&&!o.paid&&overdue(o,30)))).slice().reverse();
    target.insertAdjacentHTML('beforeend',`<p class="hint">${t('報價 → 確認訂單 → 出貨扣庫存 → 登記收款。金額均為虛構交易示範。','Quote → confirm order → ship and deduct stock → record payment. All amounts are fictional transaction data.')}</p><form data-ops-form="quote" class="edit-panel"><div class="form-grid"><label>${t('客戶','Customer')}<select name="customerId">${options(state.customers.map(c=>[c.id,name(c)]),customerId)}</select></label><label>${t('商品','Product')}<select name="productId">${options(activeProducts().map(p=>[p.id,name(p)]),'P001')}</select></label><label>${t('數量','Quantity')}<input name="qty" type="number" min="1" max="100000" step="1" value="50" required></label></div><div class="form-actions"><button class="primary">${t('建立報價草稿','Create quote draft')}</button></div></form><label class="check-label"><input type="checkbox" data-ops-overdue ${overdueOnly?'checked':''}>${t('只看逾期超過 30 天','Only overdue by more than 30 days')}</label>${table([t('單號 / 客戶','Order / Customer'),t('狀態','Status'),t('應收金額','Amount'),t('到期日','Due date'),t('下一步','Next step')],rows.map(o=>[`${escape(o.id)}<br>${customerLink(o.partyId)}`,o.status==='draft'?t('報價草稿','Quote draft'):o.status==='confirmed'?t('待出貨','Awaiting shipment'):o.paid?t('已收款','Paid'):t('待收款','Unpaid'),money(o.total),`<span class="${!o.paid&&posted(o)&&overdue(o)?'warning':''}">${o.dueDate}</span>`,!posted(o)?button('advance-order',o.status==='draft'?t('轉訂單','Convert to order'):t('出貨扣庫存','Ship & deduct stock'),`data-id="${o.id}"`):!o.paid?button('ops-pay',t('登記收款','Record payment'),`data-id="${o.id}"`):'—']))}`);
  }
  function opsNavigate(v){if(mode==='agent'&&['dashboard','crm','attendance','receivables','inventory'].includes(v)){agentView=v;renderAgentData();}else navigate(v);}
  function createQuote(data,customerId,productId,qty){const p=data.products.find(p=>p.id===productId);addOrder(data,'sale',customerId,[{productId,qty,unit:p?.price}],today(),uid('QT'),'draft','quote');const c=data.crm.find(c=>c.customerId===customerId);if(c.stage!=='won')c.stage='quote';}
  function createLeave(data,employeeId,date,kind){if(!data.employees.some(e=>e.id===employeeId)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!['annual','sick'].includes(kind))throw Error(t('請檢查員工、日期與假別。','Check employee, date and leave type.'));if(data.leaves.some(l=>l.employeeId===employeeId&&l.date===date&&l.status!=='rejected'))throw Error(t('這一天已有請假申請。','A leave request already exists for this date.'));data.leaves.push({id:uid('LV'),employeeId,date,kind,status:'pending'});}
  function setupOperations(){
    $('#agent-data').insertAdjacentHTML('beforebegin',`<nav class="ops-agent-nav" aria-label="${t('營運模組','Operations modules')}">${modules.filter(m=>['dashboard','crm','attendance','receivables','inventory'].includes(m[0])).map(([v,zh,english])=>button('ops-view',t(zh,english),`data-view="${v}"`)).join('')}</nav>`);
    $('.agent-examples').insertAdjacentHTML('beforeend',[[t('王老闆說下週要下單，幫我記下來、週一提醒我','Mr Wang will order next week; note this and remind me Monday')],[t('小陳明天請特休一天','Chen needs annual leave tomorrow')],[t('這個月誰加班最多','Who has the most overtime this month')],[t('幫鼎成開一張報價，A4 紙 50 箱','Quote 50 boxes of A4 paper for Dingcheng')],[t('哪些客戶超過 30 天沒付款','Which payments are over 30 days overdue')],[t('每日晨報','Morning brief')]].map(([q])=>button('agent-example',escape(q),`data-text="${escape(q)}"`)).join(''));
    document.addEventListener('submit',e=>{const f=e.target;if(!f.dataset.opsForm)return;e.preventDefault();if(!f.reportValidity())return;const fields=Object.fromEntries(new FormData(f));try{transact(data=>{if(f.dataset.opsForm==='crm'){const r=data.crm.find(c=>c.customerId===fields.customerId);r.stage=fields.stage;r.next=fields.next;if(fields.note.trim())r.notes.push({date:today(),text:fields.note.trim()});}if(f.dataset.opsForm==='quote')createQuote(data,fields.customerId,fields.productId,Number(fields.qty));if(f.dataset.opsForm==='leave')createLeave(data,fields.employeeId,fields.date,fields.kind);});if(f.id==='ops-agent-confirm'){$('#agent-preview').innerHTML='';$('#agent-result').textContent=t('已儲存，兩版資料同步。','Saved. Both modes are in sync.');}render();announce(t('已儲存，兩版資料同步。','Saved. Both modes are in sync.'));}catch(error){announce(error.message);$('#agent-result').textContent=error.message;}});
    document.addEventListener('change',e=>{if(e.target.hasAttribute('data-ops-overdue')){overdueOnly=e.target.checked;render();}});
    document.addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action,id=b.dataset.id;if(a==='ops-view')opsNavigate(b.dataset.view);if(a==='ops-customer'){customerId=id;opsNavigate('crm');}if(a==='ops-quote'){customerId=id;opsNavigate('receivables');}if(a==='ops-pay'||a==='ops-leave-approve'||a==='ops-leave-reject'){if(!await confirmAction(t('確認更新紀錄','Confirm record update'),a==='ops-pay'?t('將此筆應收標為已收款。','Mark this receivable as paid.'):t('更新此筆請假審核結果。','Update this leave review.')))return;try{transact(data=>{if(a==='ops-pay'){const o=data.orders.find(o=>o.id===id);if(!o||!posted(o)||o.paid)throw Error(t('此單已處理。','Already processed.'));o.paid=true;o.paidDate=today();}else{const l=data.leaves.find(l=>l.id===id);if(l.status!=='pending')throw Error(t('此單已處理。','Already processed.'));l.status=a==='ops-leave-approve'?'approved':'rejected';}});render();announce(t('紀錄已更新，可復原。','Record updated. Undo is available.'));}catch(error){announce(error.message);}}});
  }
  function operationsAgent(text){
    if(/不要|取消|別|don't|do not|cancel/i.test(text))return false;
    if(/打卡|出勤|上班|遲到|clock|attendance/i.test(text)&&!/請假|特休|病假|leave/i.test(text)){const rows=state.attendance.filter(a=>a.date===today()),late=rows.filter(a=>a.in>'09:00');$('#agent-result').textContent=t(`今天 ${rows.length} 人打卡${rows.length?'：'+rows.map(a=>`${name(state.employees.find(e=>e.id===a.employeeId))} ${a.in}${a.in>'09:00'?'（遲到）':''}`).join('、'):''}。${late.length?`遲到 ${late.length} 人。`:'沒有人遲到。'}完整紀錄在下方「打卡紀錄」。`,`${rows.length} clocked in today${rows.length?': '+rows.map(a=>`${name(state.employees.find(e=>e.id===a.employeeId))} ${a.in}${a.in>'09:00'?' (late)':''}`).join(', '):''}. ${late.length?`${late.length} late.`:'No one was late.'} Full records are below.`);opsNavigate('attendance');return true;}
    if(/請假|假單|leave request/i.test(text)&&!/小陳|Chen/i.test(text)){const pending=state.leaves.filter(l=>l.status==='pending');$('#agent-result').textContent=t(`目前有 ${pending.length} 張假單待審核。可在下方「請假申請」送出或核准。`,`${pending.length} leave requests await review. Submit or approve them below.`);opsNavigate('attendance');return true;}
    if(/客戶|跟進|聯絡|follow.?up|customers? due/i.test(text)&&!/報價|售出|賣|付款|收款|30|quote|sell|paid/i.test(text)){const due=state.crm.filter(c=>c.next&&c.next<=today());$('#agent-result').textContent=t(`${due.length} 位客戶今天前要跟進。名單在下方客戶管理。`,`${due.length} customers need follow-up by today. See the list below.`);opsNavigate('crm');return true;}
    if(/收款|應收|付款|帳款|receivable|unpaid/i.test(text)&&!/30/.test(text)){const u=unpaid();$('#agent-result').textContent=t(`還有 ${u.length} 筆未收款，其中 ${u.filter(o=>overdue(o)).length} 筆已逾期。`,`${u.length} unpaid invoices, ${u.filter(o=>overdue(o)).length} overdue.`);opsNavigate('receivables');return true;}
    if(/營收|業績|今天|今日|revenue|today/i.test(text)&&!/售出|進貨|賣|買|報價|請假|特休/.test(text)){$('#agent-result').textContent=morning();opsNavigate('dashboard');return true;}
    if(/晨報|morning brief/i.test(text)){$('#agent-result').textContent=morning();opsNavigate('dashboard');return true;}
    if(/加班最多|most overtime/i.test(text)){const ranks=state.employees.map(e=>({e,total:sum(state.attendance.filter(a=>a.employeeId===e.id&&a.date.startsWith(currentMonth())),'overtime')})).sort((a,b)=>b.total-a.total);$('#agent-result').textContent=t(`本月加班最多：${name(ranks[0].e)}，${ranks[0].total} 分鐘。`,`Most overtime this month: ${name(ranks[0].e)}, ${ranks[0].total} minutes.`);opsNavigate('attendance');return true;}
    if(/30.*(?:付款|overdue)|payments.*30/i.test(text)){overdueOnly=true;opsNavigate('receivables');$('#agent-result').textContent=t('已列出逾期超過 30 天的未收款單據。','Showing unpaid invoices overdue by more than 30 days.');return true;}
    if(/王老闆|Mr Wang/i.test(text)&&/提醒|remind/i.test(text)){const d=new Date();d.setDate(d.getDate()+((8-d.getDay())%7||7));customerId='C01';opsNavigate('crm');$('#agent-preview').innerHTML=`<form id="ops-agent-confirm" data-ops-form="crm" class="edit-panel"><h3>${t('確認聯絡紀錄與提醒','Review note and reminder')}</h3><input type="hidden" name="customerId" value="C01"><input type="hidden" name="stage" value="${state.crm[0].stage}"><label>${t('聯絡紀錄','Note')}<input name="note" maxlength="300" value="${escape(text)}" required></label><label>${t('下次週一（日期可改）','Next Monday (editable)')}<input name="next" type="date" value="${dateKey(d)}" required></label><button class="primary">${t('確認儲存','Confirm save')}</button>${button('agent-cancel',t('取消','Cancel'))}</form>`;return true;}
    if(/小陳|Chen/i.test(text)&&/明天.*特休|annual leave tomorrow/i.test(text)){opsNavigate('attendance');$('#agent-preview').innerHTML=`<form id="ops-agent-confirm" data-ops-form="leave" class="edit-panel"><h3>${t('確認小陳特休一天','Review Chen’s one-day annual leave')}</h3><input type="hidden" name="employeeId" value="E01"><input type="hidden" name="kind" value="annual"><label>${t('請假日期','Leave date')}<input name="date" type="date" value="${offsetDate(1)}" required></label><p>${t('送出後待核准，不會自動核准。','Submitted requests await approval.')}</p><button class="primary">${t('確認申請','Confirm request')}</button>${button('agent-cancel',t('取消','Cancel'))}</form>`;return true;}
    return false;
  }

  load();upgradeOperations(state);setupWorkspace();setupOperations();render();
})();
