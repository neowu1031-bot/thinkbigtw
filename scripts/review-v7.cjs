/* Real-browser release review. Uses local pages; blocks all external requests.
   REVIEW_ORIGIN should serve this worktree with 404.html as the HTTP 404 body. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const origin=process.env.REVIEW_ORIGIN || 'http://127.0.0.1:8797';
const out=process.env.REVIEW_OUTPUT || '/tmp/homesplit-review-v7';fs.mkdirSync(out,{recursive:true});
const products=['openclaw-starter','hermes-starter','full-agent','dual-agent','annual','annual-pro','annual-flagship','solo-pro','skill-pack','lobster','gift','print','subsidy','erp','enterprise-cloud','enterprise-local','harness'];
const routes=['/','/enterprise/','/pricing/personal/','/contact/','/faq/','/404.html',...products.map(p=>'/'+p+'/'),'/tbos/en/','/tbos/en/pricing.html','/tbos/en/services.html','/about/','/terms.html'];
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});const results=[];
 try{
  for(const width of [375,768,1440]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
   await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   for(const route of routes){
    await page.goto(origin+route,{waitUntil:'networkidle'});
    const metrics=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,main:document.querySelectorAll('main').length,h1:document.querySelectorAll('h1').length}));
    assert.ok(metrics.scroll<=width,route+' overflows '+width+': '+metrics.scroll);assert.equal(metrics.main,1,route+' main');assert.equal(metrics.h1,1,route+' h1');
    if(width===375 && await page.locator('#tb-ai-launcher').count()){
     const box=await page.locator('#tb-ai-launcher').boundingBox();assert.ok(box.width<=48 && box.height<=48,route+' mobile launcher');
    }
    if(['/pricing/personal/','/full-agent/','/harness/','/404.html','/tbos/en/pricing.html'].includes(route))await page.screenshot({path:path.join(out,route.replaceAll('/','_')+'-'+width+'.png'),fullPage:true});
    results.push({route,...metrics});
   }
   await page.goto(origin+'/enterprise/',{waitUntil:'networkidle'});
   await page.locator('#consult-form [type=submit]').click();assert.match(await page.locator('#brief-status').innerText(),/請填寫部門/);
   await page.locator('#role').fill('行政');await page.locator('[name=workflow]').first().check();await page.locator('#consult-form [type=submit]').click();assert.match(await page.locator('#brief-status').innerText(),/請選擇/);
   await page.locator('#timing').selectOption({index:1});await page.locator('#consult-form [type=submit]').click();assert.ok(await page.locator('#brief-output').isVisible());
   assert.deepEqual(errors,[],'browser console errors');await context.close();
  }
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));console.log('PASS '+results.length+' route/viewport checks plus form flow');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
