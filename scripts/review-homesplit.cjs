/* Local browser review: diagnosis only, no external requests or submissions.
   Uses an existing Playwright install, does not download a browser.
   PLAYWRIGHT_MODULE=/absolute/path/to/playwright node scripts/review-homesplit.cjs
*/
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.REVIEW_ORIGIN || 'http://127.0.0.1:8787';
const out = process.env.REVIEW_OUTPUT || '/tmp/homesplit-review-v2';
(async function () {
  fs.mkdirSync(out, {recursive:true});
  const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const results = [];
  try {
    for (const width of [375,768,1440]) {
      const context = await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
      await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      const page = await context.newPage();
      for (const route of ['/','/enterprise/','/enterprise/departments/','/enterprise/process/','/enterprise/process/worksheet/','/trust/','/guides/','/guides/choose-ai-partner/','/guides/local-ai-data/','/guides/ai-acceptance/','/pricing/enterprise/','/pricing/personal/']) {
        const errors = [];
        const capture = e => errors.push(e.message);
        page.on('pageerror',capture);
        await page.goto(origin+route,{waitUntil:'networkidle'});
        const size = await page.evaluate(() => ({width:innerWidth,scroll:document.documentElement.scrollWidth}));
        if (width===375) {
          const menu = page.locator('#tb-nav details');
          await menu.locator('summary').click();
          if (!(await menu.locator('a[href="/trust/"]').isVisible())) throw new Error('mobile trust link not visible');
          await page.keyboard.press('Escape');
          if (await menu.evaluate(e=>e.open)) throw new Error('mobile menu did not close');
        }
        if (route==='/') {
          const requests = [];
          const captureRequest = r => requests.push(r.url());
          const before = await page.evaluate(() => ({local:{...localStorage},session:{...sessionStorage}}));
          page.on('request',captureRequest);
          await page.locator('#quiz-next').click();
          if (!(await page.locator('#quiz-error').innerText()).includes('請先選')) throw new Error('missing-answer validation');
          await page.locator('[name=q0][value=sales]').check();
          await page.locator('#quiz-next').click();
          await page.locator('#quiz-back').click();
          if (!(await page.locator('[name=q0][value=sales]').isChecked())) throw new Error('back lost answer');
          await page.locator('[name=q0][value=service]').check();
          await page.locator('#quiz-next').click();
          for(const [i,value] of [[1,'clear'],[2,'ready'],[3,'owner'],[4,'local'],[5,'defined']]) {
            await page.locator(`[name=q${i}][value=${value}]`).check();
            await page.locator('#quiz-next').click();
          }
          if (!(await page.locator('#result-title').innerText()).includes('試行')) throw new Error('pilot result missing');
          if (!(await page.locator('#result-department').innerText()).includes('客服')) throw new Error('department mismatch');
          if (await page.locator('#quiz-result a').getAttribute('href') !== '/enterprise/#consult') throw new Error('answers in URL');
          const after = await page.evaluate(() => ({local:{...localStorage},session:{...sessionStorage}}));
          if (JSON.stringify(before)!==JSON.stringify(after)) throw new Error('diagnosis persisted data');
          page.off('request',captureRequest);
          if(requests.length) throw new Error('diagnosis triggered request: '+requests.join(','));
          await page.screenshot({path:path.join(out,`${width}-diagnosis-result.png`),fullPage:false});
          await page.locator('#quiz-reset').click();
          if(await page.locator('#readiness input:checked').count()) throw new Error('reset retained answers');
          if(!(await page.locator('[data-question="0"]').isVisible())) throw new Error('reset did not return to start');

          await page.locator('[data-ai-question="privacy"]').click();
          if (!(await page.locator('#tb-ai-dialog').isVisible())) throw new Error('AI dialog did not open');
          if (!(await page.locator('.ai-log').innerText()).includes('網站常見問題')) throw new Error('local FAQ label missing');
          await page.keyboard.press('Escape');
        }
        await page.screenshot({path:path.join(out,`${width}-${route.replaceAll('/','_')||'home'}.png`),fullPage:true});
        results.push({route,width,overflow:size.scroll>size.width,errors});
        page.off('pageerror',capture);
      }
      await context.close();
    }
    const noJS = await browser.newContext({javaScriptEnabled:false,viewport:{width:375,height:900}});
    await noJS.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    const readable = await noJS.newPage();await readable.goto(origin+'/');
    if(await readable.locator('#readiness fieldset:visible').count()!==6) throw new Error('no-JS questions missing');
    if(!(await readable.locator('#tb-nav summary').isVisible())) throw new Error('no-JS menu missing');
    await noJS.close();
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
    console.log(JSON.stringify(results,null,2));
    if(results.some(r=>r.overflow||r.errors.length)) process.exitCode=1;
  } finally { await browser.close(); }
})().catch(e=>{console.error(e.message);process.exitCode=1});
