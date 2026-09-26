/* Real browser review. Serves this worktree only; all external requests blocked.
   NODE_PATH=/tmp/homesplit-v5-tools/node_modules node scripts/review-v8.cjs
   Optional CHROME_PATH, REVIEW_OUTPUT. No hosted service or production API. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const out=process.env.REVIEW_OUTPUT || '/tmp/homesplit-review-v8';fs.mkdirSync(out,{recursive:true});
const routes=[...fs.readFileSync(path.join(root,'sitemap.xml'),'utf8').matchAll(/<loc>https:\/\/thinkbigtw.com([^<]*)<\/loc>/g)].map(m=>m[1]);
routes.push('/404.html','/erp/',...fs.readdirSync(path.join(root,'tbos/en')).filter(f=>f.endsWith('.html')).map(f=>'/tbos/en/'+f));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp4':'video/mp4','.ico':'image/x-icon'};
const server=http.createServer((req,res)=>{
 let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 let file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)&&file!==root){res.writeHead(403).end();return;}
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 const exists=fs.existsSync(file);if(!exists)file=path.join(root,'404.html');
 res.writeHead(exists?200:404,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
});
(async()=>{
 let browser;const results=[];
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  for(const width of [375,768,1440]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
   await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   for(const route of routes){
    await page.goto(origin+route,{waitUntil:'networkidle'});
    const data=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,h1:document.querySelectorAll('h1').length,main:document.querySelectorAll('main').length,missing:[...document.images].filter(i=>!i.complete||!i.naturalWidth).filter(i=>i.loading!=='lazy').map(i=>i.src)}));
    assert.ok(data.scroll<=data.width+1,`${route}@${width} overflow ${data.scroll}`);
    assert.equal(data.h1,1);assert.equal(data.main,1);assert.deepEqual(data.missing,[]);assert.deepEqual(errors,[]);
    if(['/','/enterprise/','/pricing/personal/','/enterprise/rag/'].includes(route))await page.screenshot({path:path.join(out,(route.replaceAll('/','-')||'home')+width+'.png'),fullPage:true});
    results.push({route,width,...data});
   }
   await context.close();
  }
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const page=await context.newPage();await page.goto(origin+'/pricing/personal/');
  const card=page.locator('.variant').first();await card.hover();await page.waitForTimeout(240);
  assert.equal(await card.evaluate(el=>getComputedStyle(el).transform),'matrix(1, 0, 0, 1, 0, -2)');
  assert.equal(await card.locator('.tb-hover-halo').evaluate(el=>getComputedStyle(el).opacity),'1');
  await card.focus();assert.equal(await card.evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
  await page.screenshot({path:path.join(out,'personal-hover.png'),fullPage:true});
  await page.goto(origin+'/enterprise/');const model=page.locator('.governance-model');await model.scrollIntoViewIfNeeded();await page.waitForTimeout(1600);
  assert.ok(await model.evaluate(el=>el.classList.contains('model-entered')));
  await page.locator('.model-motion-control').click();assert.equal(await model.locator('button').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.model-flow-dot').first().evaluate(el=>getComputedStyle(el).animationPlayState),'paused');
  await page.screenshot({path:path.join(out,'governance-desktop.png'),fullPage:true});
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.model-wires path').first().evaluate(el=>getComputedStyle(el).animationName),'none');
  await context.close();
  const touch=await browser.newContext({viewport:{width:375,height:812},isMobile:true,hasTouch:true});
  await touch.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const mobile=await touch.newPage();await mobile.goto(origin+'/pricing/personal/');await mobile.locator('.variant').first().hover();
  assert.equal(await mobile.locator('.variant').first().evaluate(el=>getComputedStyle(el).transform),'none');await touch.close();
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({pass:true,checks:results.length,results},null,2));console.log('PASS v8 browser review',results.length,'route/width combinations plus hover/focus/reduced/touch checks');
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
