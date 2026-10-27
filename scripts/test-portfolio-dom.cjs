/* DOM behavior only: no claims about layout, native focus, or browser console.
   JSDOM_MODULE=/path/to/jsdom node scripts/test-portfolio-dom.cjs */
const {JSDOM,VirtualConsole}=require(process.env.JSDOM_MODULE||'jsdom');
const fs=require('node:fs');const assert=require('node:assert/strict');const path=require('node:path');
const root=path.resolve(__dirname,'..');const source=fs.readFileSync(path.join(root,'portfolio/erp-demo/erp.js'),'utf8');
const KEY='tb-erp-demo-v1', tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function boot(en=false,saved=null,blocked=false){
  const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(fs.readFileSync(path.join(root,`portfolio/erp-demo/${en?'en/':''}index.html`),'utf8'),{url:`http://localhost/portfolio/erp-demo/${en?'en/':''}`,runScripts:'outside-only',virtualConsole:vc});
  const w=dom.window,q=s=>w.document.querySelector(s);let blob;
  w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
  w.HTMLDialogElement.prototype.close=function(value){if(value)this.returnValue=value;this.open=false;this.dispatchEvent(new w.Event('close'));};
  w.URL.createObjectURL=value=>{blob=value;return 'blob:demo';};w.URL.revokeObjectURL=()=>{};
  w.HTMLAnchorElement.prototype.click=function(){};
  w.fetch=()=>{throw Error('Unexpected network request');};
  if(saved!==null)w.localStorage.setItem(KEY,saved);
  if(blocked)Object.defineProperty(w,'localStorage',{get(){throw new Error('Storage denied');}});
  w.eval(source);
  const click=s=>{assert.ok(q(s),`Missing control ${s}`);q(s).click();};
  const input=(selector,value)=>{const el=q(selector);assert.ok(el,selector);el.value=String(value);el.dispatchEvent(new w.Event('input',{bubbles:true}));el.dispatchEvent(new w.Event('change',{bubbles:true}));};
  const submit=s=>{assert.ok(q(s).checkValidity(),`Invalid form: ${s}`);q(s).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));};
  const nav=view=>click(`[data-action=navigate][data-view=${view}]`);
  const data=()=>JSON.parse(w.localStorage.getItem(KEY));
  const readBlob=()=>new Promise(resolve=>{const reader=new w.FileReader();reader.onload=()=>resolve(reader.result);reader.readAsText(blob);});
  return {dom,w,q,click,input,submit,nav,data,errors,readBlob};
}
module.exports={boot};
if(require.main===module)(async()=>{
  let checks=0;
  for(const en of [false,true]){
    let b=boot(en);let {q,click,input,submit,nav,data,w}=b;
    assert.equal(data().products.length,20);assert.equal(data().suppliers.length,5);assert.equal(data().customers.length,8);assert.equal(data().orders.length,120);assert.equal(new Set(data().orders.map(o=>o.date)).size,60);checks+=5;
    nav('products');click('[data-action=add-product]');
    input('[name=sku]','QA-001');input('[name=name]','測試商品 <script>alert(1)</script>');input('[name=nameEn]','QA product');input('[name=cost]',10);input('[name=price]',20);input('[name=safety]',5);submit('#product-form');
    let p=data().products.find(p=>p.sku==='QA-001');assert.ok(p);assert.equal(p.stock,0);assert.equal(q('#product-results script'),null);checks+=3;
    const id=p.id;
    input('#product-search','QA-001');assert.equal(q('#product-results tbody').children.length,1);input('#category-filter','tools');assert.match(q('#product-results').textContent,/沒有資料|No records/);input('#category-filter','');checks+=2;
    click(`[data-action=edit-product][data-id="${id}"]`);input('[name=price]',25);submit('#product-form');assert.equal(data().products.find(p=>p.id===id).price,2500);checks++;
    function order(view,qty,unit){nav(view);input('[data-field=productId]',id);input('[data-field=qty]',qty);if(unit!==undefined)input('[data-field=unit]',unit);submit('#order-form');}
    order('purchases',10,12.5);assert.equal(data().products.find(p=>p.id===id).stock,10);assert.equal(data().products.find(p=>p.id===id).cost,1250);checks+=2;
    order('sales',3);p=data().products.find(p=>p.id===id);assert.equal(p.stock,7);assert.equal(data().orders.at(-1).total,7500);assert.equal(data().orders.at(-1).cost,3750);checks+=3;
    const saved=w.localStorage.getItem(KEY);order('sales',8);assert.match(q('#order-error').textContent,/庫存不足|insufficient stock/);assert.equal(w.localStorage.getItem(KEY),saved);checks+=2;
    // Duplicate lines must be aggregated before any inventory changes.
    input('[data-field=qty]',4);click('[data-action=add-line]');input('[name=product-2]',id);input('[name=quantity-2]',4);submit('#order-form');assert.equal(w.localStorage.getItem(KEY),saved);assert.match(q('#order-error').textContent,/庫存不足|insufficient stock/);checks+=2;
    // One invalid line must roll back the entire multi-product order.
    nav('sales');input('[data-field=qty]',1);click('[data-action=add-line]');input('[name=product-2]',id);input('[name=quantity-2]',8);submit('#order-form');assert.equal(w.localStorage.getItem(KEY),saved);checks++;
    // Reload and language switch both read the same persisted state.
    const reopened=boot(!en,saved);assert.equal(reopened.data().products.find(p=>p.id===id).stock,7);assert.equal(reopened.q('#storage-status').textContent,'');reopened.dom.window.close();checks+=2;
    nav('inventory');assert.ok(q('#erp-content').textContent.includes('QA-001'));checks++;
    nav('reports');assert.equal(q('#erp-content').querySelectorAll('svg').length,2);assert.ok(q('#erp-content').textContent.includes('QA-001'));click('[data-action=export]');assert.ok((await b.readBlob()).includes('QA-001'));checks+=3;
    nav('contacts');assert.equal(q('#erp-content').querySelectorAll('tbody tr').length,13);checks++;
    click('#assistant-open');click('[data-question=stock]');assert.match(q('#assistant-answer').textContent,/安全量|safety/);click('[data-question=sales]');assert.match(q('#assistant-answer').textContent,/銷售額|sales/);click('[data-question=top]');assert.ok(q('#assistant-answer').textContent.length);input('#assistant-question','hello');submit('#assistant-form');assert.match(q('#assistant-answer').textContent,/固定腳本|scripted/);click('#assistant-close');checks+=4;
    // Stocked products cannot disappear from the ledger.
    nav('products');click(`[data-action=delete-product][data-id="${id}"]`);assert.equal(data().products.find(p=>p.id===id).active,true);assert.equal(q('#confirm-dialog').open,false);checks+=2;
    order('sales',7);nav('products');click(`[data-action=delete-product][data-id="${id}"]`);q('#confirm-dialog').close('confirm');await tick();assert.equal(data().products.find(p=>p.id===id).active,false);assert.equal(data().orders.filter(o=>o.lines.some(l=>l.productId===id)).length,3);checks+=2;
    // A deleted SKU remains reserved, preserving historical identity.
    click('[data-action=add-product]');input('[name=sku]','QA-001');input('[name=name]','duplicate');submit('#product-form');assert.match(q('#product-error').textContent,/已使用|already in use/);checks++;
    // CSV formulas and quoted delimiters are escaped.
    input('[name=sku]','QA-CSV');input('[name=name]','=1+1,"quoted"');input('[name=nameEn]','=2+2');submit('#product-form');click('[data-action=export]');const csv=await b.readBlob();assert.ok(csv.includes("'=1+1,"));assert.ok(csv.includes('""quoted""'));checks+=2;
    // Stale tabs cannot overwrite a newer saved document.
    const external=data();external.products[0].price+=100;w.localStorage.setItem(KEY,JSON.stringify(external));click('[data-action=add-product]');input('[name=sku]','STALE');input('[name=name]','stale');submit('#product-form');assert.match(q('#product-error').textContent,/另一個分頁|Another tab/);assert.ok(!data().products.some(p=>p.sku==='STALE'));checks+=2;
    click('#reset-data');q('#confirm-dialog').close('cancel');await tick();assert.ok(data().products.some(p=>p.sku==='QA-CSV'));click('#reset-data');q('#confirm-dialog').close('confirm');await tick();assert.equal(data().products.length,20);assert.equal(data().orders.length,120);assert.ok(!data().products.some(p=>p.sku==='QA-CSV'));checks+=4;
    assert.deepEqual(b.errors,[]);checks++;b.dom.window.close();
  }
  for(const saved of ['broken JSON',JSON.stringify({version:1,products:[]})]){
    const b=boot(false,saved);assert.equal(b.w.localStorage.getItem(KEY),saved);assert.match(b.q('#storage-status').textContent,/保留原資料/);b.click('#reset-data');b.q('#confirm-dialog').close('confirm');await tick();assert.equal(b.data().products.length,20);assert.equal(b.q('#storage-status').textContent,'');assert.deepEqual(b.errors,[]);b.dom.window.close();checks+=5;
  }
  const unavailable=boot(true,null,true);assert.match(unavailable.q('#storage-status').textContent,/unavailable/);unavailable.nav('products');unavailable.click('[data-action=add-product]');unavailable.input('[name=sku]','VOLATILE');unavailable.input('[name=name]','temporary');unavailable.submit('#product-form');assert.ok(unavailable.q('#product-results').textContent.includes('VOLATILE'));assert.deepEqual(unavailable.errors,[]);unavailable.dom.window.close();checks+=3;
  const navSource=fs.readFileSync(path.join(root,'nav.js'),'utf8');
  for(const base of ['portfolio/','portfolio/ai-agent/','portfolio/ai-agent/deck/','portfolio/erp-demo/']){
    for(const en of [false,true]){
      const route=base+(en?'en/':'');
      const dom=new JSDOM(fs.readFileSync(path.join(root,route,'index.html'),'utf8'),{url:'http://localhost/'+route,runScripts:'outside-only'});
      dom.window.eval(navSource);await tick();
      const nav=dom.window.document.querySelector('#tb-nav');
      assert.equal(nav.querySelectorAll('a[href="/experience/"]').length,0);
      if(en)assert.ok(nav.querySelector(`a[lang="zh-Hant"][href="/${base}"]`));
      else assert.equal(nav.querySelector('a.tb-lang-toggle').getAttribute('href'),'/'+base+'en/');
      dom.window.close();checks+=2;
    }
  }
  console.log(`PASS: ${checks} ERP DOM assertions (Chinese + English). Layout and native browser behavior not covered.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
