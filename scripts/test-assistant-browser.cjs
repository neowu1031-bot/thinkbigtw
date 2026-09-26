/* Local mocked API only; never submits a real inquiry or calls a paid model. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'); const path=require('node:path'); const assert=require('node:assert/strict');
const origin=process.env.REVIEW_ORIGIN || 'http://127.0.0.1:8765';
const out=process.env.REVIEW_OUTPUT || '/tmp/homesplit-review-v5'; fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const results=[];
 try{
  for(const width of [375,1440]){
   const context=await browser.newContext({viewport:{width,height:812},reducedMotion:'reduce'});const calls=[],media=[],errors=[];let inquiryCount=0;
   await context.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());if(url.pathname.endsWith('.mp4'))media.push(url.pathname);
    if(url.origin===origin)return route.continue();
    const cors={'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
    if(url.pathname.startsWith('/thinkbig-') && request.method()==='OPTIONS')return route.fulfill({status:204,headers:cors});
    if(url.pathname==='/thinkbig-chat'){
     calls.push({path:url.pathname,body:request.postDataJSON()});
     return route.fulfill({headers:cors,contentType:'application/json',body:JSON.stringify({reply:'我們可先確認流程、資料與驗收責任。你可以整理需求摘要，預覽後再送出。',inquirySuggested:true})});
    }
    if(url.pathname==='/thinkbig-inquiry'){
     calls.push({path:url.pathname,body:request.postDataJSON()});inquiryCount++;
     return route.fulfill({headers:cors,status:inquiryCount===1?503:200,contentType:'application/json',body:JSON.stringify(inquiryCount===1?{error:'receipt_unconfirmed'}:{accepted:true})});
    }
    return route.abort();
   });
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   for(const route of ['/','/pricing/personal/','/about/','/guides/glossary/','/enterprise/']){
    await page.goto(origin+route,{waitUntil:'networkidle'});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),route+' overflow '+width);
   }
   await page.goto(origin,{waitUntil:'networkidle'});assert.equal(media.length,0,'reduced motion fetched MP4');
   await page.locator('#tb-ai-launcher').click();
   await page.locator('.ai-chips button').first().waitFor();
   assert.equal(calls.length,0,'open makes network API call');
   assert.equal(await page.locator('#tb-ai-input').evaluate(el=>el===document.activeElement),true);
   await page.screenshot({path:path.join(out,`${width}-assistant.png`)});
   await page.locator('.ai-chips button').filter({hasText:'資料會離開公司嗎'}).click();
   assert.ok((await page.locator('.ai-log').innerText()).includes('外部服務'));assert.equal(calls.length,0);
   await page.locator('#tb-ai-input').fill('我想諮詢');await page.locator('#tb-ai-input').press('Shift+Enter');
   assert.equal(calls.length,0);await page.locator('#tb-ai-input').press('Enter');
   await page.locator('.ai-inline-action').waitFor();assert.equal(calls.length,1);
   await page.locator('.ai-inline-action').click();
   const form=page.locator('.ai-inquiry-form');await form.locator('[name=name]').fill('測試訪客');await form.locator('[name=need]').fill('整理跨部門工作流程');await form.locator('[name=contact]').fill('private@example.invalid');
   await form.locator('[type=submit]').click();
   assert.equal(calls.length,1,'preview submitted inquiry');assert.ok(await page.locator('.ai-confirm').isDisabled());
   await page.screenshot({path:path.join(out,`${width}-inquiry-preview.png`)});
   await page.locator('.ai-edit').click();assert.ok(await form.isVisible());await form.locator('[type=submit]').click();
   await page.locator('.ai-consent input').check();await page.locator('.ai-confirm').click();
   await page.locator('.ai-receipt').filter({hasText:'尚未確認收件'}).waitFor();
   assert.ok(!(await page.locator('.ai-inquiry').innerText()).includes('已送出，顧問會'));
   assert.equal(await page.locator('.ai-receipt a').getAttribute('href'),'https://lin.ee/n5KW430');
   await page.locator('.ai-confirm').click();await page.locator('.ai-inquiry').filter({hasText:'已送出，顧問會主動與你聯繫'}).waitFor();
   const sent=calls.filter(x=>x.path==='/thinkbig-inquiry');assert.equal(sent.length,2);assert.deepEqual(sent[0].body,sent[1].body);
   assert.ok(!JSON.stringify(calls.filter(x=>x.path==='/thinkbig-chat')).includes('private@example.invalid'));
   assert.ok(await page.evaluate(()=>document.querySelector('#tb-ai-dialog').scrollWidth<=document.querySelector('#tb-ai-dialog').clientWidth));
   const persisted=await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length}));assert.deepEqual(persisted,{local:0,session:0});
   // Native modal keyboard focus must stay inside; Escape returns to launcher.
   for(let i=0;i<12;i++){await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.querySelector('#tb-ai-dialog').contains(document.activeElement)));}
   await page.keyboard.press('Escape');assert.equal(await page.locator('#tb-ai-dialog').isVisible(),false);assert.ok(await page.locator('#tb-ai-launcher').evaluate(e=>e===document.activeElement));
   assert.deepEqual(errors,[]);results.push({width,checks:'layout, reduced motion, FAQ, Enter/Shift+Enter, consent, preview/edit, failure, retry dedupe, success, focus, no contact-to-model, no storage',pass:true});
   await context.close();
  }
  fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
