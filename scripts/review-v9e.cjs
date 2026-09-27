/* Local-only visual review. NODE_PATH=/tmp/homesplit-v5-tools/node_modules node scripts/review-v9e.cjs
   Optional BROWSER=webkit, CHROME_PATH, REVIEW_OUTPUT, PLAYWRIGHT_BROWSERS_PATH. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const playwright=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'..');
const out=process.env.REVIEW_OUTPUT || '/Users/wustanley/think-big/ops-docs/homesplit/preview-v9e';
fs.mkdirSync(out,{recursive:true});
const engine=process.env.BROWSER || 'chromium';
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp'};
const server=http.createServer((req,res)=>{
 let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');
 if(!fs.existsSync(file)){res.writeHead(404).end();return;}
 res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);
});
(async()=>{
 let browser;const results=[];
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const origin='http://127.0.0.1:'+server.address().port;
  browser=await playwright[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
  for(const width of [1440,1024,768,375]){
   const mobile=width===375;
   const context=await browser.newContext({viewport:{width,height:1000},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile});
   await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
   const page=await context.newPage();
   const missing=[];page.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400)missing.push(r.url());});
   await page.goto(origin+'/harness/',{waitUntil:'networkidle'});
   await page.locator('.tool-logo img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
   const geometry=await page.evaluate(()=>{
    const wall=document.querySelector('.tool-cloud');
    return {width:innerWidth,scroll:document.documentElement.scrollWidth,columns:getComputedStyle(wall).gridTemplateColumns.split(' ').length,
     logos:[...wall.querySelectorAll('.tool-logo')].map(li=>{
      const img=li.querySelector('img'),art=li.querySelector('.tool-logo-art'),box=li.getBoundingClientRect(),a=art.getBoundingClientRect();
      return {alt:img.alt,src:img.getAttribute('src'),loaded:img.complete&&img.naturalWidth>0,height:img.getBoundingClientRect().height,
       top:box.top,contained:a.left>=box.left&&a.right<=box.right,filter:getComputedStyle(art).filter,opacity:getComputedStyle(art).opacity};
     })};
   });
   assert.equal(geometry.logos.length,24);assert.equal(new Set(geometry.logos.map(l=>l.alt)).size,24);
   assert.equal(geometry.columns,mobile?3:6);assert.equal(geometry.logos.length % geometry.columns,0);geometry.rows=geometry.logos.length/geometry.columns;assert.ok(geometry.scroll<=width,'horizontal overflow');assert.deepEqual(missing,[]);
   for(const logo of geometry.logos){
    assert.ok(logo.alt&&logo.loaded&&logo.contained,JSON.stringify(logo));assert.equal(logo.height,mobile?24:30);
    assert.equal(logo.filter,'grayscale(1)');assert.equal(logo.opacity,'0.6');
   }
   const rowCounts=Object.values(geometry.logos.reduce((rows,logo)=>{const y=Math.round(logo.top);rows[y]=(rows[y]||0)+1;return rows;},{}));
   assert.deepEqual(rowCounts,Array(geometry.rows).fill(geometry.columns));geometry.rowCounts=rowCounts;
   await page.locator('.tool-cloud').screenshot({path:path.join(out,`logo-wall-${width}.png`)});
   await page.screenshot({path:path.join(out,`harness-${width}.png`),fullPage:true});
   await page.locator('.hero').screenshot({path:path.join(out,`harness-hero-${width}.png`)});
   const logo=page.locator('.tool-logo').first(),art=logo.locator('.tool-logo-art');
   if(mobile){
    await logo.tap();await page.waitForTimeout(220);
    assert.equal(await art.evaluate(e=>getComputedStyle(e).filter),'grayscale(1)','touch must not reveal color');
   }else{
    await logo.hover();await page.waitForTimeout(220);
    assert.equal(await art.evaluate(e=>getComputedStyle(e).opacity),'1');
    assert.equal(await art.evaluate(e=>getComputedStyle(e).filter),'grayscale(0)');
    await page.mouse.move(0,0);await page.keyboard.press('Tab');await logo.focus();await page.waitForTimeout(220);
    assert.equal(await logo.evaluate(e=>e.matches(':focus-visible')),true);
    assert.equal(await art.evaluate(e=>getComputedStyle(e).opacity),'1');
    await page.screenshot({path:path.join(out,'harness-focus-1440.png')});
   }
   await page.emulateMedia({reducedMotion:'reduce'});
   assert.equal(await art.evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
   results.push(geometry);await context.close();
  }
  fs.writeFileSync(path.join(out,`results-${engine}.json`),JSON.stringify({pass:true,results},null,2));
  console.log('PASS: 24 logos; 1440/1024/768/375 layout, images, keyboard focus, desktop hover, touch and reduced motion.');
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{fs.writeFileSync(path.join(out,`failure-${engine}.txt`),e.stack);console.error(e);process.exitCode=1;});
