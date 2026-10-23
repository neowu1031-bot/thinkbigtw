import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {handleThinkBig,toTraditionalTW} from './thinkbig.js';
import {sandboxTools,executeSandboxPlan} from './retail-experience.js';
const probes={
admin:['已訂會議室','會議室訂好了','幫你訂好 A 室了','已預訂會議室','已完成採購','已下單紙袋','已採購完成','已付款','會議室已保留','已幫你借好會議室','已發會議邀請給大家'],
accounting:['已付款','已匯款給廠商','已請款','款項已付清','已轉帳','已開立發票','付款完成','已幫你付了 HM-03','已沖帳','已入帳 NT$200'],
marketing:['已發布','貼文已發布','已發文','貼文已上線','已排程發布','已刊登','已投放廣告','已貼到 IG','發布完成','已幫你 PO 上去了'],
media:['已上片','影片已上傳','已上架 YouTube','已發片','影片已上線','已排程發布','上傳完成','已幫你上傳'],
training:['已通知新人','已寄出測驗','已發給新人','已把測驗傳給大家','已排入新人課表','已建立帳號'],
research:['已上網查詢','已爬取競品網站','已查過最新網路評論','已連網比對','我剛搜尋了網路'],
benign:['幫你整理好示範內容了，想先看哪一項？','草稿放在卡片裡，還沒發布，要主管覆核喔','HM-02 帳列 2000、入帳 1800，差 200，要先請出納核對嗎？','還沒付款也還沒請款，先確認驗收紀錄？']
};
const allow=['幫你整理好示範內容了，想先看哪一項？','草稿放在卡片裡，還沒發布，要主管覆核喔','HM-02 帳列 2000、入帳 1800，差 200，要先請出納核對嗎？','還沒付款也還沒請款，先確認驗收紀錄？','已入帳 NT$4,800，待核對差異 NT$200','狀態：未請款、未付款','主管覆核後手動發布；未排入平台','僅本次示範草稿；未預約，由行政專員確認','未採購、未付款，待採購專員覆核','只用預置示範資料，未連網查詢','幫你擬好了，放在待送匣 👇 要不要語氣再熱情一點？','標題建議好了，要不要再短一點？'];
// 修正前完整過濾函式快照，確保 chat / retail 的既有輸出完全相同。
const oldFilter=vm.runInNewContext("(function filterReply(reply, context = 'chat') {\n  // Models sometimes answer in Simplified Chinese; normalise to Taiwan Traditional (OpenCC cn→twp).\n  reply = toTraditionalTW(reply).replace(/臺/g, '台').replace(/客制/g, '客製').replace(/匯入/g, '導入');\n  // The widget renders plain text (textContent), so strip Markdown the model may emit.\n  reply = reply.replace(/\\*\\*(.+?)\\*\\*/g, '$1').replace(/^#{1,6}\\s*/gm, '').replace(/^\\s*-{3,}\\s*$/gm, '').replace(/^\\s*[-*]\\s+/gm, '・').replace(/\\n{3,}/g, '\\n\\n').trim();\n  // NEO 9/27: the advisor never surfaces the Hermes name.\n  reply = reply.replace(/Hermes(?:\\s*Agent)?/gi, '開源 AI 助理');\n  // Receipt claims must come exclusively from the confirmed database write, never a model.\n  const isDemo = context === 'retail' || context === 'experience';\n  const receiptClaim = isDemo\n    ? /已收到(?!的).{0,20}(?:資料|需求|預約)/.test(reply)\n    : /已收到.{0,8}資料|(?:我們|我)?已收到(?:您的|你的|您|你).{0,20}(?:資料|需求|預約)/.test(reply);\n  // 體驗回覆先去掉空白，避免拆字繞過假完成攔截；分析「已收到的」則保留。\n  const demoCompletion = context === 'experience' && /已收到(?!的)|(?:已|經|我).{0,6}(?:寄|發送|傳送|送達|通知|排入|排進|加入行事曆|訂位)|(?:預約|訂位|寄送|發送)(?:完成|成功)|寄出了/.test(reply.replace(/\\s+/gu, ''));\n  if (receiptClaim || demoCompletion || /已.{0,8}(送出|轉交|提交|轉給|收件|預約)|顧問會主動/.test(reply)) {\n    reply = context === 'experience' ? '這裡只能幫你擬草稿，不會送出訊息、接收資料或完成預約。要不要先一起確認草稿內容？' : context === 'retail' ? '這個體驗不會替你送出或預約任何事情。若想討論正式導入，請按頁面下方「討論我的門市需求」。' : '如需顧問聯繫，請點「整理諮詢摘要」，核對需求及聯絡方式後再確認送出。是否收件以介面顯示的送出結果為準。';\n  }\n  return reply;\n}\n)",{toTraditionalTW});
const currentSource=readFileSync(new URL('./thinkbig.js',import.meta.url),'utf8');
const currentFilter=vm.runInNewContext('('+currentSource.slice(currentSource.indexOf('function filterReply('),currentSource.indexOf('export function cleanReply'))+')',{toTraditionalTW});
async function replyFor(role,reply){
 const req=new Request('https://local.test/thinkbig-experience',{method:'POST',headers:{Origin:'https://thinkbigtw.com','Content-Type':'application/json'},body:JSON.stringify({role,consent:true,messages:[{role:'user',content:'整理示範工作'}]})});
 const response=await handleThinkBig(req,{RATE_LIMITER:{limit:async()=>({success:true})},AI:{run:async(_,p)=>({response:p.max_tokens===450?'{"calls":[]}':reply})}});
 assert.equal(response.status,200);return (await response.json()).reply;
}
const blocked=reply=>reply.startsWith('這裡只能幫你擬草稿');
for(const role of Object.keys(sandboxTools)){
 const claims=probes[role]||['已通知客人','已寄出草稿','已排入行事曆'];
 for(const claim of claims)test(`${role}：探針 ${claim}`,async()=>{
  assert.equal(blocked(await replyFor(role,claim)),!claim.startsWith('已入帳'));
 });
 test(`${role}：拆字仍攔截`,async()=>assert.ok(blocked(await replyFor(role,'已 付 款'))));
 const calls=Object.entries(sandboxTools[role]).map(([name,spec])=>({name,args:Object.fromEntries(Object.entries(spec).map(([key,values])=>[key,values[0]]))}));
 const cards=executeSandboxPlan(role,{calls});
 function strings(value){return typeof value==='string'?[value]:value&&typeof value==='object'?Object.values(value).flatMap(strings):[];}
 test(`${role}：所有卡片原文不誤殺`,async()=>{
  const originals=strings(cards.map(card=>card.result));assert.ok(originals.length>=2);
  for(const original of originals)assert.ok(!blocked(await replyFor(role,original)),original);
 });
}
for(const sentence of [...allow,...probes.benign,'未付款','未排入平台','已入帳 NT$200'])test(`正常句保留：${sentence}`,async()=>assert.ok(!blocked(await replyFor('accounting',sentence))));
const corpus=[...Object.values(probes).flat(),...allow,'已收到您的資料','已收到的資料','已送出','顧問會主動聯繫','**草稿**','我已經發送通知','預約成功','寄出了'];
for(const context of ['chat','retail'])test(`${context}：修正前後逐句輸出一致`,()=>{
 for(const sentence of corpus)assert.equal(currentFilter(sentence,context),oldFilter(sentence,context),sentence);
});
