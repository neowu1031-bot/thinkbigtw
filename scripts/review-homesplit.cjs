/* Read-only browser review: no form filling/submission or external requests.
   Uses an existing Playwright install, does not download a browser.
   PLAYWRIGHT_MODULE=/absolute/path/to/playwright node scripts/review-homesplit.cjs
*/
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const origin = process.env.REVIEW_ORIGIN || 'http://127.0.0.1:8787';
const out = process.env.REVIEW_OUTPUT || '/tmp/homesplit-review';
(async function () {
  fs.mkdirSync(out, {recursive:true});
  const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
  const results = [];
  try {
    for (const width of [375,768,1440]) {
      const context = await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
      await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
      const page = await context.newPage();
      for (const route of ['/','/enterprise/','/trust/','/pricing/personal/']) {
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
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
    console.log(JSON.stringify(results,null,2));
    if(results.some(r=>r.overflow||r.errors.length)) process.exitCode=1;
  } finally { await browser.close(); }
})().catch(e=>{console.error(e.message);process.exitCode=1});
