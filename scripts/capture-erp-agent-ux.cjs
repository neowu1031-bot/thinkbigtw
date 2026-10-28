const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const out='docs/verification/erp-agent-ux';fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 try {
  for(const width of [1280,375])for(const en of [false,true]){
   const context=await browser.newContext({viewport:{width,height:width===375?812:900},reducedMotion:'reduce'});
   const origin='http://127.0.0.1:8766';
   await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.fulfill({status:200,body:''}));
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
   await page.goto(origin+'/portfolio/erp-demo/'+(en?'en/':''));
   await page.waitForLoadState('networkidle');
   const title=await page.locator('#module-title').boundingBox();
   assert.ok(title && title.y+title.height<(width===375?812:900)/2,'Workspace heading above mid-screen');
   await page.screenshot({path:`${out}/manual-first-${en?'en':'zh'}-${width}.png`});
   await page.locator('[data-action=tour-skip]').click();
   await page.reload();
   assert.ok(await page.locator('#tour').isHidden(),'Dismissal persists');
   await page.screenshot({path:`${out}/manual-${en?'en':'zh'}-${width}.png`});
   if(width===375){
    await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));
    const nav=await page.locator('#module-nav').boundingBox();
    assert.ok(nav.y>=0 && nav.y+nav.height<=812,'Mobile navigation stays visible');
    await page.evaluate(()=>scrollTo(0,0));
   }
   await page.locator('[data-mode=agent]').click();
   await page.evaluate(()=>scrollTo(0,0));
   await page.screenshot({path:`${out}/agent-first-${en?'en':'zh'}-${width}.png`});
   await page.locator('.agent-examples button').first().click();
   await page.locator('#agent-confirm [type=submit]').click();
   await page.locator('.agent-receipt').waitFor();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert.deepEqual(errors,[]);
   await page.screenshot({path:`${out}/agent-${en?'en':'zh'}-${width}.png`});
   await context.close();
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
