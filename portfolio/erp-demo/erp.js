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
  const modules = [['dashboard','儀表板','Dashboard'],['products','商品','Products'],['purchases','進貨單','Purchases'],['sales','銷貨單','Sales'],['inventory','庫存','Inventory'],['contacts','客戶與供應商','Contacts'],['reports','報表','Reports']];
  let view = 'dashboard', search = '', category = '', reportMonth = currentMonth();
  let editing = null, orderLines = [], lineSequence = 0;
  let state, lastSaved = null, volatile = false, corrupt = false;
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
    return data;
  }

  function addOrder(data,type,partyId,lines,date,id) {
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
      if (type === 'sale' && qty > p.stock) throw new Error(t(`${name(p)} 庫存不足：可出貨 ${p.stock}，本單合計 ${qty}。`,`${name(p)} has insufficient stock: ${p.stock} available, ${qty} requested in this order.`));
      if (type === 'purchase' && p.stock+qty > 100000000) throw new Error(t('數量超過示範範圍。','Quantity exceeds the demo limit.'));
    }
    const order = {id,type,date,partyId,partyName:party.name,partyNameEn:party.nameEn,lines:[],total:0,cost:0};
    for (const line of lines) {
      const p = data.products.find(p => p.id === line.productId);
      const cost = p.cost;
      if (type === 'purchase') p.cost = Math.round((p.stock*p.cost+line.qty*line.unit)/(p.stock+line.qty));
      p.stock += (type === 'purchase' ? 1 : -1)*line.qty;
      order.lines.push({...line,sku:p.sku,name:p.name,nameEn:p.nameEn,cost});
      order.total += line.qty*line.unit;
      order.cost += line.qty*cost;
      data.movements.push({id:uid('M'),date,productId:p.id,sku:p.sku,name:p.name,nameEn:p.nameEn,kind:type,qty:(type==='purchase'?1:-1)*line.qty,balance:p.stock,orderId:id});
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
    if (!data.orders.every(o => o && str(o.id) && date(o.date) && ['purchase','sale'].includes(o.type) && str(o.partyName) && str(o.partyNameEn) && int(o.total) && int(o.cost) && Array.isArray(o.lines) && o.lines.length && o.lines.every(l => l && ids.has(l.productId) && str(l.sku) && str(l.name) && str(l.nameEn) && int(l.qty) && l.qty>0 && int(l.unit) && int(l.cost)))) return false;
    if (!data.movements.every(m => m && ids.has(m.productId) && date(m.date) && ['opening','purchase','sale'].includes(m.kind) && str(m.id) && str(m.sku) && str(m.name) && str(m.nameEn) && str(m.orderId) && Number.isSafeInteger(m.qty) && int(m.balance))) return false;
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
    change(next);
    if (!volatile) {
      const raw = JSON.stringify(next);
      try { localStorage.setItem(KEY,raw); } catch (_) { throw new Error(t('瀏覽器無法儲存，本次操作未套用。請釋放儲存空間後重試。','Browser storage could not save this change. Nothing was applied; free some space and try again.')); }
      lastSaved = raw;
    }
    state = next;
  }
  const announce = message => { $('#app-status').textContent = message; };
  function activeProducts() { return state.products.filter(p=>p.active); }
  function lowStock() { return activeProducts().filter(p=>p.stock<=p.safety); }
  const salesFor = month => state.orders.filter(o=>o.type==='sale' && o.date.startsWith(month));
  const sum = (rows,key) => rows.reduce((total,row)=>total+row[key],0);
  const units = rows => rows.reduce((total,o)=>total+sum(o.lines,'qty'),0);
  const options = (items,selected) => items.map(([value,label])=>`<option value="${escape(value)}"${value===selected?' selected':''}>${escape(label)}</option>`).join('');
  const button = (action,label,extra='') => `<button type="button" data-action="${action}" ${extra}>${label}</button>`;
  function table(headers,rows,cls='') {
    return `<div class="table-scroll" tabindex="0" role="region" aria-label="${escape(t('可橫向捲動的資料表','Scrollable data table'))}"><table class="${cls}"><thead><tr>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.map(row=>`<tr>${row.map(cell=>`<td>${cell}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${headers.length}" class="empty-state">${t('目前沒有資料。可新增商品或建立單據開始操作。','No records yet. Add a product or post an order to get started.')}</td></tr>`}</tbody></table></div>`;
  }
  function metric(label,value,note='') { return `<div class="metric"><small>${label}</small><strong>${value}</strong><span>${note}</span></div>`; }
  function render(focus=false) {
    $('#module-nav').innerHTML = modules.map(([key,zh,english])=>button('navigate',t(zh,english),`data-view="${key}" ${key===view?'aria-current="page"':''}`)).join('');
    const title = modules.find(m=>m[0]===view);
    content.innerHTML = `<header class="module-head"><h2 id="module-title" tabindex="-1">${t(title[1],title[2])}</h2>${button('export',t('匯出 CSV','Export CSV'))}</header>`;
    ({dashboard:renderDashboard,products:renderProducts,purchases:renderOrder,sales:renderOrder,inventory:renderInventory,contacts:renderContacts,reports:renderReports})[view]();
    if (focus) $('#module-title').focus({preventScroll:true});
  }
  function renderDashboard() {
    const sales = salesFor(currentMonth()), purchases = state.orders.filter(o=>o.type==='purchase' && o.date.startsWith(currentMonth()));
    content.insertAdjacentHTML('beforeend',`<div class="metrics">${metric(t('今日銷售','Sales today'),money(sum(state.orders.filter(o=>o.type==='sale'&&o.date===today()),'total')),today())}${metric(t('庫存不足','Low stock'),number(lowStock().length),t('品項達安全庫存或以下','products at or below safety stock'))}${metric(t('本月進貨','Received this month'),number(units(purchases)),t(`${purchases.length} 張進貨單`,`${purchases.length} purchase orders`))}${metric(t('本月出貨','Shipped this month'),number(units(sales)),t(`${sales.length} 張銷貨單`,`${sales.length} sales orders`))}</div><div class="dashboard-columns"><section><h3>${t('補貨提醒','Stock to review')}</h3><ul class="stock-alerts">${lowStock().map(p=>`<li><span>${escape(name(p))}</span><span class="warning">${p.stock} / ${p.safety}</span></li>`).join('')||`<li>${t('目前庫存皆高於安全量。','All products are above safety stock.')}</li>`}</ul><p class="hint">${t('目前庫存 / 安全庫存；本示範不做需求預測。','Current stock / safety stock. No demand forecast is used.')}</p></section><section><h3>${t('本月營運','This month at a glance')}</h3>${metric(t('銷售額（示範資料）','Sales (demo data)'),money(sum(sales,'total')))}${metric(t('毛利（示範資料）','Gross profit (demo data)'),money(sum(sales,'total')-sum(sales,'cost')))}<p class="hint">${t('試著新增一項商品，再建立進貨單與銷貨單。數據會隨操作更新。','Add a product, then post a purchase and a sale. These figures update as you go.')}</p></section></div><section class="erp-panel"><h3>${t('最近單據','Recent orders')}</h3>${orderTable(state.orders.slice(-6).reverse())}</section>`);
  }
  function productRows() {
    const q = search.trim().toLocaleLowerCase();
    return activeProducts().filter(p=>(!category||p.category===category)&&(!q||`${p.sku} ${p.name} ${p.nameEn}`.toLocaleLowerCase().includes(q)));
  }
  function productTable() {
    return table([t('編號 / 商品','SKU / Product'),t('分類','Category'),t('成本 / 售價','Cost / Price'),t('庫存 / 安全量','Stock / Safety'),t('操作','Actions')],productRows().map(p=>[
      `<strong>${escape(p.sku)}</strong><br>${escape(name(p))}`,escape(categoryName(p.category)),`${money(p.cost)}<br>${money(p.price)}`,`<span class="${p.stock<=p.safety?'warning':''}">${p.stock} / ${p.safety}</span>`,
      `<div class="table-actions">${button('edit-product',t('編輯','Edit'),`data-id="${escape(p.id)}" aria-label="${escape(t('編輯 ','Edit ')+name(p))}"`)}${button('delete-product',t('刪除','Delete'),`data-id="${escape(p.id)}" class="danger" aria-label="${escape(t('刪除 ','Delete ')+name(p))}"`)}</div>`
    ]));
  }
  function renderProducts() {
    content.insertAdjacentHTML('beforeend',`<div class="toolbar"><label>${t('搜尋商品','Search products')}<input id="product-search" type="search" value="${escape(search)}" placeholder="${t('商品名稱或編號','Product name or SKU')}"></label><label>${t('分類','Category')}<select id="category-filter">${options([['',t('所有分類','All categories')],...categories.map(c=>[c[0],c[en?2:1]])],category)}</select></label>${button('add-product',t('新增商品','Add product'),'class="primary"')}</div><div id="product-editor"></div><div id="product-results">${productTable()}</div><p class="hint">${t('新商品從零庫存開始，數量由進出貨異動。尚有庫存的商品不可刪除；歷史單據會保留。','New products start at zero stock. Use orders to change quantities. Products with stock cannot be deleted; order history is retained.')}</p>`);
  }
  function showProduct(id) {
    editing = id || '';
    const p = state.products.find(p=>p.id===id) || {sku:'',name:'',nameEn:'',category:'paper',cost:0,price:0,safety:10};
    $('#product-editor').innerHTML = `<form id="product-form" class="edit-panel"><h3>${id?t('編輯商品','Edit product'):t('新增商品','Add product')}</h3><div class="form-grid"><label>${t('商品編號','SKU')}<input name="sku" required maxlength="40" value="${escape(p.sku)}"></label><label>${t('商品名稱（中文）','Product name (Chinese)')}<input name="name" required maxlength="80" value="${escape(p.name)}"></label><label>${t('英文名稱（選填）','English name (optional)')}<input name="nameEn" maxlength="100" value="${escape(p.nameEn)}"></label><label>${t('分類','Category')}<select name="category">${options(categories.map(c=>[c[0],c[en?2:1]]),p.category)}</select></label><label>${t('成本（NT$）','Cost (NT$)')}<input name="cost" type="number" min="0" max="1000000" step="0.01" required value="${p.cost/100}" ${id&&p.stock>0?'readonly':''}></label><label>${t('售價（NT$）','Price (NT$)')}<input name="price" type="number" min="0" max="1000000" step="0.01" required value="${p.price/100}"></label><label>${t('安全庫存','Safety stock')}<input name="safety" type="number" min="0" max="100000" step="1" required value="${p.safety}"></label></div><p class="hint">${t('有庫存時成本依進貨加權平均計算；歷史銷貨毛利不受後續修改影響。','For stocked products, cost uses a moving weighted average of purchases. Past sales keep their original cost.')}</p><p id="product-error" class="form-error" role="alert"></p><div class="form-actions">${button('cancel-product',t('取消','Cancel'))}<button type="submit" class="primary">${t('儲存商品','Save product')}</button></div></form>`;
    $('#product-form [name=sku]').focus();
  }
  function saveProduct(form) {
    const f = new FormData(form), value = key => String(f.get(key)||'').trim();
    const product = {sku:value('sku'),name:value('name'),nameEn:value('nameEn')||value('name'),category:value('category'),cost:Math.round(Number(value('cost'))*100),price:Math.round(Number(value('price'))*100),safety:Number(value('safety'))};
    try {
      if (!product.sku || !product.name || !Number.isInteger(product.safety)) throw new Error(t('請填寫商品編號、名稱與有效安全庫存。','Enter a SKU, name, and valid safety stock.'));
      transact(data=>{
        if (data.products.some(p=>p.id!==editing && p.sku.toLowerCase()===product.sku.toLowerCase())) throw new Error(t('商品編號已使用，請換一個編號。','This SKU is already in use. Choose another.'));
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
    content.insertAdjacentHTML('beforeend',`<form id="order-form" class="edit-panel"><h3>${purchase?t('建立進貨單','New purchase order'):t('建立銷貨單','New sales order')}</h3><div class="form-grid"><label>${purchase?t('供應商','Supplier'):t('客戶','Customer')}<select name="party" required>${options((purchase?state.suppliers:state.customers).map(p=>[p.id,name(p)]))}</select></label><label>${t('單據日期','Order date')}<input type="date" name="date" value="${today()}" readonly></label></div><div id="order-lines"></div>${button('add-line',t('新增品項','Add line'))}<p class="hint">${t('確認後立即入庫或出貨。單據為已完成紀錄，不提供作廢；可用頁首按鈕重設整份示範。','Posting receives or ships stock immediately. Posted orders cannot be voided in this demo; use Reset demo data to start over.')}</p><p id="order-error" class="form-error" role="alert"></p><div class="form-actions"><output id="order-total" class="order-total"></output><button type="submit" class="primary" ${activeProducts().length?'':'disabled'}>${purchase?t('確認入庫','Receive stock'):t('確認出貨','Ship order')}</button></div></form><section class="order-history"><h3>${t('已完成單據','Posted orders')}</h3>${orderTable(state.orders.filter(o=>o.type===orderType()).slice().reverse())}</section>`);
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
  function postOrder(form) {
    const submit = form.querySelector('[type=submit]'); submit.disabled=true;
    try {
      const type = orderType(), party = new FormData(form).get('party');
      const lines = orderLines.map(l=>({productId:l.productId,qty:l.qty,unit:Math.round(l.unit*100)}));
      transact(data=>addOrder(data,type,party,lines,today(),uid(type==='purchase'?'PO':'SO')));
      render(); announce(type==='purchase'?t('進貨單已入庫，庫存已更新。','Purchase received. Inventory updated.'):t('銷貨單已出貨，庫存已更新。','Order shipped. Inventory updated.'));
      $('#order-form select').focus();
    } catch (error) { $('#order-error').textContent=error.message; submit.disabled=false; }
  }
  function orderTable(orders) {
    return table([t('日期 / 單號','Date / Order'),t('往來對象','Contact'),t('進出貨','Type'),t('數量','Units'),t('金額 / 明細','Amount / Details')],orders.map(o=>[
      `${escape(o.date)}<br><small title="${escape(o.id)}">${escape(o.id.startsWith('PO-DEMO')||o.id.startsWith('SO-DEMO')?o.id:o.id.slice(0,11))}</small>`,escape(en?o.partyNameEn:o.partyName),o.type==='purchase'?t('已入庫','Received'):t('已出貨','Shipped'),number(sum(o.lines,'qty')),
      `<details><summary>${money(o.total)}</summary><ul class="order-detail">${o.lines.map(l=>`<li>${escape(l.sku)} · ${escape(name(l))}<br>${l.qty} × ${money(l.unit)} = ${money(l.qty*l.unit)}</li>`).join('')}</ul></details>`
    ]));
  }
  const movementKind = kind => ({opening:t('期初','Opening'),purchase:t('進貨','Purchase'),sale:t('銷貨','Sale')}[kind]);
  function renderInventory() {
    content.insertAdjacentHTML('beforeend',`<h3>${t('即時庫存','Current stock')}</h3>${table([t('編號','SKU'),t('商品','Product'),t('現有量','On hand'),t('安全量','Safety'),t('狀態','Status')],activeProducts().map(p=>[escape(p.sku),escape(name(p)),number(p.stock),number(p.safety),p.stock<=p.safety?`<span class="warning">${t('需補貨','Low stock')}</span>`:`<span class="ok">${t('充足','In stock')}</span>`]))}<section class="erp-panel"><h3>${t('庫存異動紀錄','Stock movements')}</h3><p class="hint">${t('匯出 CSV 包含所有異動；期初庫存與進出貨均可追溯。','CSV includes every movement, from opening stock to posted orders.')}</p>${table([t('日期','Date'),t('商品','Product'),t('原因','Reason'),t('異動量','Change'),t('異動後庫存','Balance'),t('單號','Order')],state.movements.slice().reverse().map(m=>[escape(m.date),`${escape(m.sku)}<br>${escape(name(m))}`,movementKind(m.kind),(m.qty>0?'+':'')+m.qty,number(m.balance),escape(m.orderId||'—')]))}</section>`);
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
    if (view==='products') {
      headers=[t('編號','SKU'),t('中文名稱','Chinese name'),t('英文名稱','English name'),t('分類','Category'),t('庫存','Stock'),t('安全庫存','Safety stock'),t('成本 NTD','Cost NTD'),t('售價 NTD','Price NTD')];
      rows=productRows().map(p=>[p.sku,p.name,p.nameEn,categoryName(p.category),p.stock,p.safety,p.cost/100,p.price/100]);
    } else if (view==='inventory') {
      headers=[t('日期','Date'),t('單號','Order'),t('編號','SKU'),t('商品','Product'),t('原因','Reason'),t('異動量','Change'),t('結餘','Balance')];
      rows=state.movements.map(m=>[m.date,m.orderId,m.sku,name(m),movementKind(m.kind),m.qty,m.balance]);
    } else if (view==='contacts') {
      headers=[t('類型','Type'),t('編號','ID'),t('名稱','Name'),t('聯絡窗口','Contact'),t('區域','Area')];
      rows=['customers','suppliers'].flatMap(kind=>state[kind].map(p=>[kind==='customers'?t('客戶','Customer'):t('供應商','Supplier'),p.id,name(p),en?p.contactEn:p.contact,en?p.areaEn:p.area]));
    } else if (view==='reports') {
      headers=[t('月份','Month'),t('編號','SKU'),t('商品','Product'),t('銷售數量','Units sold'),t('銷售額 NTD','Sales NTD'),t('成本 NTD','Cost NTD'),t('毛利 NTD','Gross profit NTD')];
      rows=bestsellers(salesFor(reportMonth)).map(p=>[reportMonth,p.sku,name(p),p.qty,p.revenue/100,p.cost/100,(p.revenue-p.cost)/100]);
    } else {
      headers=[t('單號','Order'),t('日期','Date'),t('類型','Type'),t('往來對象','Contact'),t('商品編號','SKU'),t('商品','Product'),t('數量','Quantity'),t('單價 NTD','Unit price NTD'),t('小計 NTD','Subtotal NTD'),t('單位成本 NTD','Unit cost NTD')];
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
    $('#confirm-title').textContent=title;$('#confirm-description').textContent=description;dialog.returnValue='cancel';dialog.showModal();
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
    state=next;view='dashboard';search='';category='';reportMonth=currentMonth();editing=null;render();announce(t('已還原初始示範資料。','Initial demo data restored.'));$('#reset-data').focus();
  }
  const prompts=[['stock','本週哪些商品快缺貨？','Which products need restocking this week?'],['sales','本月銷售與毛利如何？','How are sales and gross profit this month?'],['top','本月哪些商品最熱銷？','What are this month’s bestsellers?']];
  function answer(question) {
    let message;
    if (/stock|inventory|缺貨|庫存|補貨/i.test(question)) {
      const rows=lowStock();
      message=t('依目前庫存與安全量計算，未做需求預測。\n','Based on current stock and safety levels, without demand forecasting.\n')+(rows.length?rows.map(p=>t(`${name(p)}：庫存 ${p.stock}，安全量 ${p.safety}，建議至少補 ${Math.max(1,p.safety+1-p.stock)} 件。`,`${name(p)}: ${p.stock} in stock, safety level ${p.safety}. Add at least ${Math.max(1,p.safety+1-p.stock)} units.`)).join('\n'):t('所有商品皆高於安全庫存。','All products are above safety stock.'));
    } else if (/top|best|熱銷/i.test(question)) {
      const rows=bestsellers(salesFor(currentMonth())).slice(0,3);
      message=rows.length?rows.map((p,i)=>`${i+1}. ${name(p)} · ${number(p.qty)} ${t('件','units')} · ${money(p.revenue)}`).join('\n'):t('本月還沒有銷貨資料。','No sales have been recorded this month.');
    } else if (/sales|profit|銷售|毛利/i.test(question)) {
      const rows=salesFor(currentMonth());message=t(`${currentMonth()} 銷售額 ${money(sum(rows,'total'))}，毛利 ${money(sum(rows,'total')-sum(rows,'cost'))}。共 ${rows.length} 張單據、${units(rows)} 件商品。`,`${currentMonth()}: sales of ${money(sum(rows,'total'))} and gross profit of ${money(sum(rows,'total')-sum(rows,'cost'))}. ${rows.length} orders, ${units(rows)} units.`);
    } else message=t('這是固定腳本示意。請詢問「庫存」、「本月銷售」或「熱銷商品」，或點選上方問題。','This is a scripted preview. Ask about stock, monthly sales, or bestsellers, or choose a question above.');
    $('#assistant-answer').textContent=message;
  }
  $('#assistant-prompts').innerHTML=prompts.map(([key,zh,english])=>button('ask',t(zh,english),`data-question="${key}"`)).join('');
  $('#assistant-open').addEventListener('click',()=>{$('#assistant-answer').textContent='';$('#assistant-dialog').showModal();});
  $('#assistant-close').addEventListener('click',()=>$('#assistant-dialog').close());
  $('#assistant-dialog').addEventListener('close',()=>$('#assistant-open').focus());
  $('#assistant-form').addEventListener('submit',event=>{event.preventDefault();answer($('#assistant-question').value);});
  $('#reset-data').addEventListener('click',reset);
  document.addEventListener('click',event=>{
    const target=event.target.closest('[data-action]');if(!target) return;
    switch(target.dataset.action) {
      case 'navigate':view=target.dataset.view;editing=null;announce('');render(true);break;
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
  load();render();
})();
