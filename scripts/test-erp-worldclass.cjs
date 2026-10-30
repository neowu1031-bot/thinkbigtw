/* Behavior tests for task 1b. DOM assertions do not substitute for native Chrome QA. */
const assert=require('node:assert/strict');
const {boot}=require('./test-portfolio-dom.cjs');
const KEY='tb-erp-demo-v1',tick=()=>new Promise(r=>setTimeout(r,0));
let checks=0;
const eq=(a,b,n)=>{assert.deepEqual(a,b,n);checks++;};
const ok=(a,n)=>{assert.ok(a,n);checks++;};
(async()=>{
 for(const en of [false,true]){
  const b=boot(en),{q,click,input,submit,nav,data,w}=b;
  const snapshot=()=>w.localStorage.getItem(KEY);
  const agent=text=>{input('#agent-input',text);submit('#agent-form');};
  const product=id=>data().products.find(p=>p.id===id);
  // The tour is skippable, repeatable and remembered independently of business data.
  eq(q('#tour').hidden,false);click('[data-action=tour-next]');ok(q('#tour').textContent.includes('2 / 3'));click('[data-action=tour-next]');ok(q('#tour').textContent.includes('3 / 3'));click('[data-action=tour-next]');eq(q('#tour').hidden,true);eq(w.localStorage.getItem('tb-erp-tour'),'done');click('[data-action=tour]');click('[data-action=tour-skip]');eq(q('#tour').hidden,true);
  const theme=w.document.body.dataset.theme;click('[data-action=theme]');ok(w.document.body.dataset.theme!==theme);eq(w.localStorage.getItem('tb-erp-theme'),w.document.body.dataset.theme);
  // No write until explicit confirmation; editable stock delta follows the selected fields.
  click('[data-mode=agent]');eq(q('.erp-layout').hidden,true);const start=snapshot(),initial=product('P001').stock;
  agent(en?'Sell 5 ST-001 to C01':'文具A 售出 5 個給大成');ok(q('#agent-confirm'));eq(snapshot(),start);ok(q('#agent-impact').textContent.includes(`${initial} → ${initial-5}`));
  input('#agent-confirm [name=qty]',3);ok(q('#agent-impact').textContent.includes(`${initial} → ${initial-3}`));submit('#agent-confirm');eq(product('P001').stock,initial-3);eq(data().orders.at(-1).type,'sale');eq(data().orders.at(-1).partyId,'C01');eq(q('#undo-toast').hidden,false);
  click('[data-mode=manual]');nav('products');input('#product-search','ST-001');ok(q('#product-results').textContent.includes(String(initial-3)));click('[data-action=undo]');eq(snapshot(),start);eq(q('#undo-toast').hidden,true);
  // Taiwanese phrases, word order and English verbs are exercised as user inputs.
  click('[data-mode=agent]');
  const salePhrases=['文具A 售出 5 個給大成','把文具A 賣掉 5 個給大成','賣出文具A 5 個給大成','文具A 賣了 5 個給大成','文具A 出了 5 個給大成','文具A 出貨 5 個給大成','幫大成開銷貨 文具A 5 個','給大成文具A 5 個，賣掉','Sell 5 ST-001 to C01','Sold ST-001 5 to C01','Ship 5 ST-001 to C01','A4 再生影印紙售出 5 個給 C01','Sell 5 A4 recycled paper to C01'];
  const purchasePhrases=['進貨 B 款 20 個','B 款進了 20 個','補貨 B 款 20 個','B 款補進 20 個','買進 B 款 20 個','B 款入庫 20 個','採購 B 款 20 個','Receive 20 ST-002 from S01','Purchase 20 ST-002 from S01','Restock 20 ST-002 from S01','Buy 20 ST-002 from S01'];
  for(const text of [...salePhrases,...purchasePhrases]){const before=snapshot();agent(text);ok(q('#agent-confirm'),text);eq(snapshot(),before,text+' must only preview');eq(q('#agent-confirm [name=qty]').value,salePhrases.includes(text)?'5':'20');click('[data-action=agent-cancel]');eq(snapshot(),before);}
  for(const text of ['C 還剩多少','C 剩幾個','C 還有多少','How many ST-003 are left']){agent(text);eq(q('#agent-confirm'),null);ok(q('#agent-result').textContent.includes(String(product('P003').stock)));}
  const safety=product('P004').safety;
  for(const text of ['把 D 安全庫存改成 30','D 安全量設為 30','D 安全庫存調到 30','Set ST-004 safety stock to 30']){agent(text);ok(q('#agent-confirm'),text);eq(product('P004').safety,safety);submit('#agent-confirm');eq(product('P004').safety,30);click('[data-action=undo]');eq(product('P004').safety,safety);}
  for(const text of ['Sell -5 ST-001 to C01','Sell 1.5 ST-001 to C01','Sell 5 ST-001 to C99','售出文具A 5 個','不要賣文具A 5 個給大成','Sell 5 ST-001 and 2 ST-002 to C01','賣文具A和B 5 個給大成','文具A 售出 5 給大成，然後補貨20','把 D 安全庫存改成 30.5','hello']){const before=snapshot();agent(text);eq(q('#agent-confirm'),null,text);eq(q('#agent-result').querySelectorAll('[data-action=agent-example]').length,3);eq(snapshot(),before);}
  // Overselling is rejected at commit, including after editing the confirmation card.
  agent('Sell 5 ST-001 to C01');input('#agent-confirm [name=qty]',100000);const beforeOversell=snapshot();submit('#agent-confirm');eq(snapshot(),beforeOversell);ok(/庫存不足|insufficient/.test(q('#agent-error').textContent));click('[data-action=agent-cancel]');
  // Quote with missing product asks for it; draft/confirmed cannot move stock or revenue.
  agent('幫我開一張給順達的報價');ok(q('#agent-confirm'));eq(q('#agent-confirm [name=party]').value,'C02');eq(q('#agent-confirm [name=product]').value,'');input('#agent-confirm [name=product]','P002');input('#agent-confirm [name=qty]',2);const quoteStock=product('P002').stock,moves=data().movements.length;submit('#agent-confirm');const quote=data().orders.at(-1);eq(quote.kind,'quote');eq(quote.status,'draft');eq(product('P002').stock,quoteStock);eq(data().movements.length,moves);
  click('[data-mode=manual]');nav('sales');click(`[data-action=advance-order][data-id="${quote.id}"]`);eq(data().orders.find(o=>o.id===quote.id).status,'confirmed');eq(product('P002').stock,quoteStock);click(`[data-action=advance-order][data-id="${quote.id}"]`);eq(data().orders.find(o=>o.id===quote.id).status,'posted');eq(product('P002').stock,quoteStock-2);eq(data().movements.length,moves+1);eq(data().orders.filter(o=>o.id===quote.id).length,1);
  click('[data-action=undo]');eq(data().orders.find(o=>o.id===quote.id).status,'confirmed');eq(product('P002').stock,quoteStock);eq(data().movements.length,moves);
  nav('purchases');input('[data-field=productId]','P003');input('[data-field=qty]',10);const stock3=product('P003').stock;click('[data-action=save-draft]');const draft=data().orders.at(-1);eq(draft.status,'draft');eq(product('P003').stock,stock3);click(`[data-action=advance-order][data-id="${draft.id}"]`);eq(product('P003').stock,stock3);click(`[data-action=advance-order][data-id="${draft.id}"]`);eq(product('P003').stock,stock3+10);
  // Status, text, period and amount filters have observable results.
  input('#order-filter','draft');eq(q('#order-results').querySelectorAll('[data-status=posted]').length,0);input('#order-filter','');input('#order-search',draft.id);eq(q('#order-results tbody').children.length,1);input('#order-search','');input('#order-sort','amount');const first=q('#order-results [data-action=print-order]').dataset.id;eq(data().orders.find(o=>o.id===first).total,Math.max(...data().orders.filter(o=>o.type==='purchase').map(o=>o.total)));
  click(`[data-action=print-order][data-id="${draft.id}"]`);ok(q('#detail-dialog').open);ok(q('#detail-body').textContent.includes('ST-003'));ok(q('.print-sheet'));click('#detail-dialog [data-action=close-dialog]');
  // Product sorting, low-stock filter, inline edit and atomic batch updates.
  nav('products');input('#product-search','');input('#product-sort','stock');const sorted=[...q('#product-results').querySelectorAll('[data-safety]')].map(e=>product(e.dataset.safety).stock);eq(sorted,[...sorted].sort((a,b)=>a-b));click('#low-only');eq(q('#product-results tbody').children.length,data().products.filter(p=>p.active&&p.stock<=p.safety).length);click('#low-only');
  const safety1=product('P001').safety,safety2=product('P002').safety;input('[data-safety=P002]',41);eq(product('P002').safety,41);eq(product('P001').safety,safety1);click('[data-action=undo]');eq(product('P002').safety,safety2);
  click('[data-select=P001]');click('[data-select=P002]');input('#batch-safety',33);click('[data-action=batch-safety]');eq(product('P001').safety,33);eq(product('P002').safety,33);click('[data-action=undo]');eq(product('P001').safety,safety1);eq(product('P002').safety,safety2);
  click('[data-select=P001]');const beforeDelete=snapshot();click('[data-action=batch-delete]');q('#confirm-dialog').close('confirm');await tick();eq(snapshot(),beforeDelete);ok(/庫存|stock/.test(q('#app-status').textContent));
  // A new zero-stock product can be deleted and recovered with its identity intact.
  click('[data-action=add-product]');input('[name=sku]','UNDO-QA');input('[name=name]','復原驗收');submit('#product-form');const zero=data().products.find(p=>p.sku==='UNDO-QA');click(`[data-action=delete-product][data-id="${zero.id}"]`);q('#confirm-dialog').close('confirm');await tick();eq(product(zero.id).active,false);click('[data-action=undo]');eq(product(zero.id).active,true);
  // Every dashboard number opens source rows with a scope matching its figure.
  nav('dashboard');eq(q('#erp-content').querySelectorAll('.metric[data-action=drill]').length,3);click('[data-detail=low]');ok(q('#low-only').checked);nav('dashboard');click('[data-detail=month-sales]');const dates=[...q('#order-results').querySelectorAll('tbody tr td:first-child')].map(e=>e.textContent.slice(0,10));ok(dates.every(d=>d.startsWith(new Date().toLocaleDateString('sv-SE').slice(0,7))));
  // Eight calculated answers each expose an actionable source detail.
  click('#assistant-open');eq(w.document.activeElement.id,'assistant-question');eq(q('#assistant-prompts').children.length,8);
  for(const key of ['stock','sales','top','margin','overdue','restock','unpaid','value']){click(`[data-question=${key}]`);ok(q('#assistant-answer').textContent.length>10,key);click('#assistant-detail');ok(q('#detail-dialog').open);ok(q('#detail-body').textContent.length>10);click('#detail-dialog [data-action=close-dialog]');click('#assistant-open');}
  const month=new Date().toLocaleDateString('sv-SE').slice(0,7);
  const postedSales=data().orders.filter(o=>o.type==='sale'&&(!o.status||o.status==='posted')&&o.date.startsWith(month));
  const money=n=>'NT$ '+new Intl.NumberFormat(en?'en-US':'zh-TW',{maximumFractionDigits:2}).format(n/100);
  click('[data-question=sales]');ok(q('#assistant-answer').textContent.includes(money(postedSales.reduce((n,o)=>n+o.total,0))));ok(q('#assistant-answer').textContent.includes(money(postedSales.reduce((n,o)=>n+o.total-o.cost,0))));
  click('[data-question=value]');ok(q('#assistant-answer').textContent.includes(money(data().products.filter(p=>p.active).reduce((n,p)=>n+p.stock*p.cost,0))));
  click('[data-question=overdue]');const overdue=data().orders.filter(o=>o.type==='sale'&&o.status==='posted'&&o.paid===false&&o.dueDate<new Date().toLocaleDateString('sv-SE')).sort((a,b)=>a.dueDate.localeCompare(b.dueDate))[0];ok(q('#assistant-answer').textContent.includes(overdue.dueDate));ok(q('#assistant-answer').textContent.includes(en?overdue.partyNameEn:overdue.partyName));
  click('#assistant-close');
  // Command search reaches products, customer order lists and documents.
  w.document.dispatchEvent(new w.KeyboardEvent('keydown',{key:'k',ctrlKey:true,bubbles:true,cancelable:true}));ok(q('#command-dialog').open);eq(w.document.activeElement.id,'command-search');input('#command-search','ST-004');click('#command-results [data-kind=product]');eq(q('#product-search').value,'ST-004');
  click('[data-action=command]');input('#command-search','C02');click('#command-results [data-kind=customer]');eq(q('#order-form [name=party]').value,'C02');click('[data-action=command]');input('#command-search',draft.id);click('#command-results [data-kind=order]');ok(q('#detail-body').textContent.includes(draft.id));click('#detail-dialog [data-action=close-dialog]');
  // Persistence and legacy migration retain quantities and give old sales payment metadata.
  const reloaded=boot(!en,snapshot());eq(reloaded.data().products,data().products);eq(reloaded.q('#storage-status').textContent,'');reloaded.dom.window.close();
  const legacy=data();legacy.orders.forEach(o=>{delete o.status;delete o.kind;delete o.paid;delete o.dueDate;});const legacyBoot=boot(en,JSON.stringify(legacy));legacyBoot.click('#assistant-open');legacyBoot.click('[data-question=overdue]');ok(!/沒有未付款|No unpaid/.test(legacyBoot.q('#assistant-answer').textContent));legacyBoot.dom.window.close();
  // Undo cannot overwrite a change from another tab.
  nav('products');input('[data-safety=P004]',44);const external=data();external.products[0].price+=100;w.localStorage.setItem(KEY,JSON.stringify(external));click('[data-action=undo]');eq(data(),external);ok(/另一個分頁|Another tab/.test(q('#app-status').textContent));
  eq(b.errors,[]);b.dom.window.close();
 }
 console.log(`PASS: ${checks} task 1b behavior assertions (Chinese + English; 30+ command phrases).`);
})().catch(error=>{console.error(error);process.exitCode=1;});
