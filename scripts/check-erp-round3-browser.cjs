/* Invoked by test-portfolio-browser.cjs for both widths and languages. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async function round3(page,{width,en,stored}){
 const out=process.env.ERP_ROUND3_OUTPUT||path.resolve(__dirname,'../docs/verification/erp-round3');
 fs.mkdirSync(out,{recursive:true});
 const nav=v=>page.locator(`#module-nav [data-view="${v}"]`).click();
 const ask=async text=>{await page.locator('#agent-input').fill(text);await page.locator('#agent-form [type=submit]').click();};
 const confirm=()=>page.locator('#confirm-dialog [value=confirm]').click();
 await nav('crm');
 await page.locator('#erp-content [name=stage]').selectOption('won');
 await page.locator('#erp-content [name=note]').fill('Browser QA contact');
 await page.locator('#erp-content [data-ops-form=crm] button.primary').click();
 assert.equal((await stored()).crm[0].stage,'won');
 await page.locator('#erp-content [data-action=ops-quote]').click();
 await page.locator('#erp-content [name=qty]').fill('2');
 const stock=(await stored()).products[0].stock;
 await page.locator('#erp-content [data-ops-form=quote] button.primary').click();
 const id=(await stored()).orders.at(-1).id;
 assert.equal((await stored()).products[0].stock,stock);
 for(const stage of ['confirmed','posted']){await page.locator(`#erp-content [data-action=advance-order][data-id="${id}"]`).click();assert.equal((await stored()).orders.find(o=>o.id===id).status,stage);}
 assert.equal((await stored()).products[0].stock,stock-2);
 await page.locator(`#erp-content [data-action=ops-pay][data-id="${id}"]`).click();await confirm();
 await page.waitForFunction(id=>JSON.parse(localStorage.getItem('tb-erp-demo-v1')).orders.find(o=>o.id===id).paid,id);
 await page.locator('[data-mode=agent]').click();
 await ask(en?'Mr Wang will order next week; note this and remind me Monday':'王老闆說下週要下單，幫我記下來、週一提醒我');
 const count=(await stored()).crm[0].notes.length;
 await page.locator('#ops-agent-confirm button.primary').click();assert.equal((await stored()).crm[0].notes.length,count+1);
 await ask(en?'Chen needs annual leave tomorrow':'小陳明天請特休一天');assert.equal((await stored()).leaves.length,0);
 await page.locator('#ops-agent-confirm button.primary').click();assert.equal((await stored()).leaves[0].status,'pending');
 await page.locator('#agent-data [data-action=ops-leave-approve]').click();await confirm();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('tb-erp-demo-v1')).leaves[0].status==='approved');
 await ask(en?'Quote 50 boxes of A4 paper for Dingcheng':'幫鼎成開一張報價，A4 紙 50 箱');
 assert.equal(await page.locator('#agent-confirm [name=qty]').inputValue(),'50');await page.locator('#agent-confirm [type=submit]').click();
 assert.equal((await stored()).orders.at(-1).lines[0].qty,50);
 await ask(en?'Who has the most overtime this month':'這個月誰加班最多');assert.match(await page.locator('#agent-result').innerText(),/Hsu|小許/);
 await ask(en?'Which payments are over 30 days overdue':'哪些客戶超過 30 天沒付款');assert.equal(await page.locator('#agent-data [data-ops-overdue]').isChecked(),true);
 await page.locator('#agent-data [data-ops-overdue]').uncheck();
 await ask(en?'Morning brief':'每日晨報');assert.match(await page.locator('#agent-result').innerText(),/revenue|營收/);
 await page.reload();assert.equal((await stored()).leaves[0].status,'approved');
 await page.locator('#demo-help').evaluate(e=>e.open=true);
 if(await page.locator('body').getAttribute('data-theme')==='dark')await page.locator('#theme-toggle').click();
 await page.locator('#demo-help').evaluate(e=>e.open=false);
 for(const mode of ['manual','agent']){
  await page.locator(`[data-mode=${mode}]`).click();
  for(const view of ['dashboard','crm','attendance','receivables']){
   if(mode==='manual')await nav(view);else await page.locator(`.ops-agent-nav [data-view=${view}]`).click();
   assert.equal(await page.locator('.anatomy-flow').count(),0);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${mode}/${view} ${width}px overflow`);
   const target=page.locator(mode==='manual'?'#erp-content':'#agent-data');
   assert.ok((await target.innerText()).trim().length>100);
   await page.screenshot({path:path.join(out,`${width}-${en?'en':'zh'}-${mode}-${view}.png`),fullPage:true});
  }
 }
 await page.locator('#demo-help').evaluate(e=>e.open=true);await page.locator('#theme-toggle').click();await page.locator('#demo-help').evaluate(e=>e.open=false);
 await page.screenshot({path:path.join(out,`${width}-${en?'en':'zh'}-agent-dark.png`),fullPage:true});
 await page.locator('[data-mode=manual]').click();
 fs.writeFileSync(path.join(out,`${width}-${en?'en':'zh'}-pass.json`),JSON.stringify({width,en,modules:4,modes:2,flow:true,persistence:true},null,2));
};
