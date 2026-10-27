/* Browser acceptance. Run a local server first; third-party traffic is stubbed.
   PLAYWRIGHT_MODULE=/path/to/playwright node scripts/test-portfolio-browser.cjs */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const origin=process.env.REVIEW_ORIGIN||'http://127.0.0.1:8766';
const out=process.env.REVIEW_OUTPUT||'/tmp/portfolio-browser-review';
const routes=['/portfolio/','/portfolio/en/','/portfolio/ai-agent/','/portfolio/ai-agent/en/','/portfolio/ai-agent/deck/','/portfolio/ai-agent/deck/en/','/portfolio/erp-demo/','/portfolio/erp-demo/en/'];
const KEY='tb-erp-demo-v1';
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const results=[];
 try{
  for(const width of [1440,375]){
   const context=await browser.newContext({viewport:{width,height:960},reducedMotion:'reduce'});
   await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.fulfill({status:200,body:''}));
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   for(const url of routes){
    assert.equal((await page.goto(origin+url)).status(),200);
    await page.waitForLoadState('networkidle');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${url}: overflow at ${width}px`);
    assert.equal(await page.locator('#tb-nav a[href="/experience/"]').count(),0);
    if(!url.includes('/deck/'))await page.screenshot({path:path.join(out,`${width}-${url.replaceAll('/','_')}.png`),fullPage:true});
   }
   for(const en of [false,true]){
    const suffix=en?'en/':'';
    await page.goto(origin+`/portfolio/${suffix}`);await page.locator(`.project-card[href="/portfolio/ai-agent/${suffix}"]`).click();assert.equal(new URL(page.url()).pathname,`/portfolio/ai-agent/${suffix}`);
    await page.locator(`.project-card[href="/portfolio/ai-agent/deck/${suffix}"]`).click();assert.equal(new URL(page.url()).pathname,`/portfolio/ai-agent/deck/${suffix}`);
    await page.goto(origin+`/portfolio/ai-agent/${suffix}`);await page.locator('.project-card[href="/experience/"]').click();assert.equal(new URL(page.url()).pathname,'/experience/');
    await page.goto(origin+`/portfolio/${suffix}`);await page.locator(`.project-card[href="/portfolio/erp-demo/${suffix}"]`).click();
    const nav=async view=>page.locator(`[data-action=navigate][data-view=${view}]`).click();
    const stored=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
    await page.locator('#reset-data').click();await page.locator('#confirm-dialog [value=confirm]').click();
    await nav('products');await page.locator('[data-action=add-product]').click();
    for(const [field,value] of Object.entries({sku:'BROWSER-QA',name:'驗收商品',nameEn:'Acceptance product',cost:'10',price:'20',safety:'5'}))await page.locator(`#product-form [name=${field}]`).fill(value);
    await page.locator('#product-form [type=submit]').click();const id=(await stored()).products.find(p=>p.sku==='BROWSER-QA').id;
    for(const [view,qty] of [['purchases','10'],['sales','3']]){
     await nav(view);await page.locator('[data-field=productId]').selectOption(id);await page.locator('[data-field=qty]').fill(qty);await page.locator('#order-form [type=submit]').click();
    }
    assert.equal((await stored()).products.find(p=>p.id===id).stock,7);
    await page.locator('[data-field=productId]').selectOption(id);await page.locator('[data-field=qty]').fill('8');await page.locator('#order-form [type=submit]').click();assert.ok(await page.locator('#order-error').isVisible());assert.equal((await stored()).products.find(p=>p.id===id).stock,7);
    await page.reload();assert.equal((await stored()).products.find(p=>p.id===id).stock,7);
    for(const view of ['products','purchases','sales','inventory','contacts','reports']){await nav(view);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${view} overflow`);}
    const downloadPromise=page.waitForEvent('download');await page.locator('[data-action=export]').click();await (await downloadPromise).saveAs(path.join(out,`${width}-${suffix?'en':'zh'}-report.csv`));
    await page.locator('#assistant-open').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'assistant-question');
    const drawer=await page.locator('#assistant-dialog').boundingBox();assert.ok(drawer.y>=0&&drawer.y<2&&drawer.x>=0&&drawer.x+drawer.width<=width+1,'Assistant must be a visible fixed drawer');
    await page.screenshot({path:path.join(out,`${width}-${en?'en':'zh'}-assistant.png`)});await page.locator('[data-question=stock]').click();assert.ok((await page.locator('#assistant-answer').innerText()).length);
    for(let i=0;i<20;i++){await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.querySelector('#assistant-dialog').contains(document.activeElement)));}
    await page.keyboard.press('Escape');assert.ok(await page.locator('#assistant-open').evaluate(e=>e===document.activeElement));
    await page.locator('#reset-data').click();await page.locator('#confirm-dialog [value=confirm]').click();await page.waitForFunction(()=>{try{return JSON.parse(localStorage.getItem('tb-erp-demo-v1')).products.length===20}catch(e){return false}},null,{timeout:5000}).catch(()=>{});assert.equal((await stored()).products.length,20);assert.equal((await stored()).orders.length,120);
   }
   assert.deepEqual(errors,[]);results.push({width,pages:routes.length,bilingualERP:true,consoleErrors:errors});await context.close();
  }
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
