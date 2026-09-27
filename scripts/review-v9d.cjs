/* Local browser acceptance; no outbound requests.
   NODE_PATH=/tmp/homesplit-v5-tools/node_modules node scripts/review-v9d.cjs
   Optional BROWSER=firefox|webkit, PLAYWRIGHT_BROWSERS_PATH, CHROME_PATH, REVIEW_OUTPUT. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const out=process.env.REVIEW_OUTPUT||'/Users/wustanley/think-big/ops-docs/homesplit/preview-v9d';
fs.mkdirSync(out,{recursive:true});
const engine=process.env.BROWSER||'chromium';
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
  for(const width of [1440,375,768]){
   const context=await browser.newContext({viewport:{width,height:1000},deviceScaleFactor:1,hasTouch:width===375});
   await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
   const page=await context.newPage(),errors=[],missing=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('response',r=>{if(r.url().startsWith(origin)&&r.status()>=400)missing.push(r.url());});
   await page.goto(origin+'/harness/',{waitUntil:'networkidle'});
   const diagram=page.locator('.mcp-network');await diagram.scrollIntoViewIfNeeded();
   await page.locator('#mcp img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
   await page.waitForTimeout(2000);
   const geometry=await page.evaluate(()=>{
    const network=document.querySelector('.mcp-network'),map=document.querySelector('.mcp-network-map');
    const cards=[...network.querySelectorAll('.mcp-agent-card,.mcp-hub,.mcp-tool')].map(e=>{
     const r=e.getBoundingClientRect();return {label:e.textContent.trim(),left:r.left,right:r.right,top:r.top,bottom:r.bottom,opacity:getComputedStyle(e).opacity};
    });
    return {width:innerWidth,scroll:document.documentElement.scrollWidth,wallColumns:getComputedStyle(document.querySelector('.tool-cloud')).gridTemplateColumns.split(' ').length,
     cards,agents:network.querySelectorAll('.mcp-agent').length,tools:network.querySelectorAll('.mcp-tool').length,links:network.querySelectorAll('.mcp-agent a').length,
     paths:[...network.querySelectorAll('.mcp-wire')].map(p=>p.getAttribute('d')),
     viewBox:network.querySelector('svg').getAttribute('viewBox'),mapHeight:map.clientHeight,
     loaded:[...network.querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth>0),
     running:network.classList.contains('mcp-running')};
   });
   assert.ok(geometry.scroll<=width,'horizontal overflow');assert.equal(geometry.agents,9);assert.equal(geometry.links,8);assert.equal(geometry.tools,7);
   assert.equal(geometry.paths.length,16);assert.ok(geometry.paths.every(d=>d&&!d.includes('NaN')));assert.ok(geometry.loaded);assert.ok(geometry.running);
   assert.equal(geometry.wallColumns,width<=760?3:6);assert.equal(await page.locator('.tool-logo').count(),22);assert.equal(await page.locator('#mcp button').count(),0);
   for(const c of geometry.cards){assert.ok(c.left>=0&&c.right<=width,JSON.stringify(c));assert.equal(c.opacity,'1');}
   for(let i=0;i<geometry.cards.length;i++)for(let j=i+1;j<geometry.cards.length;j++){
    const a=geometry.cards[i],b=geometry.cards[j];assert.ok(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top,'overlap: '+a.label+' / '+b.label);
   }
   if(width<=760)assert.ok(geometry.cards.slice(0,9).every((c,i,arr)=>i===0||c.top>=arr[i-1].bottom));
   assert.deepEqual(missing,[]);assert.deepEqual(errors,[]);
   if(width!==768){
    await page.screenshot({path:path.join(out,`harness-${width}.png`),fullPage:true});
    await page.locator('#mcp').screenshot({path:path.join(out,`harness-protocol-${width}.png`)});
   }
   await page.locator('.mcp-agent a').first().focus();
   assert.equal(await page.locator('.mcp-agent a').first().evaluate(e=>e===document.activeElement),true);
   await page.emulateMedia({reducedMotion:'reduce'});
   assert.equal(await page.locator('.mcp-pulse').first().evaluate(e=>getComputedStyle(e).display),'none');
   assert.ok(await page.locator('.mcp-agent-card').evaluateAll(es=>es.every(e=>getComputedStyle(e).opacity==='1'&&getComputedStyle(e).animationName==='none')));
   await page.emulateMedia({reducedMotion:'no-preference'});
   await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(150);
   assert.equal(await diagram.evaluate(e=>e.classList.contains('mcp-running')),false);
   results.push(geometry);await context.close();
  }
  fs.writeFileSync(path.join(out,`results-${engine}.json`),JSON.stringify({pass:true,results},null,2));
  console.log('PASS 1440/375/768: no overflow/overlap; 9 agents, 7 tools, 16 connections; logos, keyboard, motion preferences and v9c wall.');
 }finally{if(browser)await browser.close();server.close();}
})().catch(e=>{fs.writeFileSync(path.join(out,`failure-${engine}.txt`),e.stack);console.error(e);process.exitCode=1;});
