/* Native Chrome acceptance for task 1b, including screenshots, axe and print output.
   Requires PLAYWRIGHT_MODULE and AXE_MODULE; serve the repo on localhost:8766 first. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const origin=process.env.REVIEW_ORIGIN||'http://127.0.0.1:8766';
const out=process.env.REVIEW_OUTPUT||'/tmp/erp-worldclass-review';
const axe=process.env.AXE_MODULE||'/tmp/tb-portfolio-qa/node_modules/axe-core/axe.min.js';
const KEY='tb-erp-demo-v1';
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const results=[];
 try{
  for(const width of [1440,375])for(const en of [false,true]){
   const context=await browser.newContext({viewport:{width,height:960},reducedMotion:'reduce'});
   await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.fulfill({status:200,body:''}));
   const page=await context.newPage(),errors=[],timings=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   await page.goto(origin+`/portfolio/erp-demo/${en?'en/':''}`);await page.waitForLoadState('networkidle');
   const data=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);
   const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Viewport overflow');
   const shot=async name=>page.screenshot({path:path.join(out,`${width}-${en?'en':'zh'}-${name}.png`),fullPage:true});
   const audit=async label=>{await page.addScriptTag({path:axe});const result=await page.evaluate(async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}));});fs.writeFileSync(path.join(out,`${width}-${en?'en':'zh'}-${label}-axe.json`),JSON.stringify(result,null,2));assert.deepEqual(result.filter(v=>['critical','serious'].includes(v.impact)),[],label+' accessibility');};
   await noOverflow();await shot('tour');
   await page.locator('[data-action=tour-next]').click();await page.locator('[data-action=tour-next]').click();await page.locator('[data-action=tour-next]').click();assert.ok(await page.locator('#tour').isHidden());
   await shot('dashboard');await audit('light-dashboard');
   const performanceSample=await page.evaluate(()=>{const a=performance.now();document.querySelector('[data-action=navigate][data-view=products]').click();return performance.now()-a;});timings.push({action:'products DOM render',ms:performanceSample});
   await page.locator('#product-sort').selectOption('stock');await page.locator('#low-only').check();await noOverflow();await shot('low-stock');
   await page.locator('[data-mode=agent]').click();await page.locator('#agent-input').fill(en?'Sell 5 ST-001 to C01':'文具A 售出 5 個給大成');
   const before=await data();await page.locator('#agent-form [type=submit]').click();assert.deepEqual(await data(),before);
   await page.locator('#agent-confirm [name=qty]').fill('3');await noOverflow();await shot('agent-preview');await audit('light-agent');
   await page.locator('#agent-confirm [type=submit]').click();assert.equal((await data()).products[0].stock,before.products[0].stock-3);
   await page.locator('[data-action=undo]').click();assert.deepEqual(await data(),before);
   await page.locator('[data-action=theme]').click();await noOverflow();await shot('dark-agent');await audit('dark-agent');
   await page.locator('[data-mode=manual]').click();
   await page.keyboard.press('Control+k');assert.equal(await page.evaluate(()=>document.activeElement.id),'command-search');await page.locator('#command-search').fill('ST-003');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.ok(await page.locator('#command-dialog').isHidden());assert.equal(await page.locator('#product-search').inputValue(),'ST-003');
   await page.locator('[data-action=navigate][data-view=sales]').click();await page.locator('[data-action=save-draft]').click();const draft=(await data()).orders.at(-1);assert.equal(draft.status,'draft');await page.locator(`[data-action=advance-order][data-id="${draft.id}"]`).click();assert.equal((await data()).orders.find(o=>o.id===draft.id).status,'confirmed');
   await page.locator(`[data-action=print-order][data-id="${draft.id}"]`).click();await noOverflow();await shot('document');await page.emulateMedia({media:'print'});assert.ok(await page.locator('#detail-dialog').isVisible());assert.ok(await page.locator('#tb-nav').isHidden());await page.pdf({path:path.join(out,`${width}-${en?'en':'zh'}-document.pdf`),format:'A4'});await page.emulateMedia({media:'screen'});await page.keyboard.press('Escape');
   await page.locator('#assistant-open').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'assistant-question');
   const box=await page.locator('#assistant-dialog').boundingBox();assert.ok(box.y>=0&&box.y<2&&box.x>=0&&box.x+box.width<=width+1);
   await page.locator('[data-question=overdue]').click();await shot('dark-assistant');
   for(let i=0;i<24;i++){await page.keyboard.press(i<12?'Tab':'Shift+Tab');assert.ok(await page.evaluate(()=>document.querySelector('#assistant-dialog').contains(document.activeElement)));}
   await audit('dark-assistant');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'assistant-open');
   assert.deepEqual(errors,[]);results.push({width,en,consoleErrors:errors,timings});await context.close();
  }
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
