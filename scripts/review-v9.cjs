/* Local-only card review. NODE_PATH=/tmp/homesplit-v5-tools/node_modules node scripts/review-v9.cjs
   Optional BROWSER=webkit, CHROME_PATH, REVIEW_OUTPUT, PLAYWRIGHT_BROWSERS_PATH. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const playwright=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'..'),out=process.env.REVIEW_OUTPUT || '/tmp/homesplit-review-v9';
fs.mkdirSync(out,{recursive:true});
const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp4':'video/mp4'};
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
  const origin='http://127.0.0.1:'+server.address().port,engine=process.env.BROWSER||'chromium';
  browser=await playwright[engine].launch({headless:true,...(engine==='chromium'?{executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{})});
  for(const width of [375,600,601,768,1024,1440]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',deviceScaleFactor:1});
   await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
   const page=await context.newPage();await page.goto(origin+'/pricing/personal/',{waitUntil:'networkidle'});
   assert.equal(await page.locator('.variant').count(),7);
   for(const card of await page.locator('.variant').all()){
    await card.scrollIntoViewIfNeeded();await card.locator('img').evaluate(i=>i.decode());
   }
   const result=await page.evaluate(()=>{
    const box=e=>{const r=e.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    return {width:innerWidth,scroll:document.documentElement.scrollWidth,cards:[...document.querySelectorAll('.variant')].map(c=>({href:c.getAttribute('href'),card:box(c),image:box(c.querySelector('img')),name:box(c.querySelector('.v-name')),price:box(c.querySelector('.v-price')),src:c.querySelector('img').currentSrc,blend:getComputedStyle(c.querySelector('img')).mixBlendMode,overflow:c.scrollWidth>c.clientWidth}))};
   });
   assert.ok(result.scroll<=width,`page overflow @${width}: ${result.scroll}`);
   for(const c of result.cards){
    assert.equal(c.overflow,false,`${c.href} overflow @${width}`);
    assert.equal(c.image.width,width<=600?88:136);
    assert.equal(c.blend,'multiply');
    assert.ok(c.name.right<=c.image.left+1,`${c.href} title overlaps art`);
    assert.ok(c.price.top>=c.image.bottom-1,`${c.href} price overlaps art`);
    assert.ok(c.price.width>c.image.width,`${c.href} price must span full card`);
    assert.ok(c.image.right<=c.card.right&&c.image.top<c.price.top,`${c.href} art outside card header`);
   }
   if([375,1440].includes(width))for(const id of ['tier1','tier2','tier3'])await page.locator('#'+id).screenshot({path:path.join(out,`${id}-${width}.png`)});
   results.push(result);await context.close();
  }
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({pass:true,results},null,2));
  console.log('PASS: 7 cards × 6 widths; no horizontal overflow, art/price collision or missing images.');
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{fs.writeFileSync(path.join(out,'failure.txt'),e.stack);console.error(e);process.exitCode=1;});
