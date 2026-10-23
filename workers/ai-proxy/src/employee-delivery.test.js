import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {employeeExperience,sandboxTools,executeSandboxPlan} from './retail-experience.js';
import {handleThinkBig} from './thinkbig.js';
const source=readFileSync(new URL('../../../experience/chat.js',import.meta.url),'utf8');
const roles=vm.runInNewContext('('+source.slice(source.indexOf('const roles=')+12,source.indexOf('\nconst $=')-1)+')');
const targets={media:/30 秒.*腳本/,marketing:/3 版.*貼文/,sales:/可寄.*跟進信/,service:/直接回覆.*追問/,retail:/營收.*3 件事/,accounting:/對帳差異表/,admin:/會議摘要與待辦/,training:/第一週.*5 題.*答案/,research:/競品比較表.*3 個假設/};
for(const role of Object.keys(sandboxTools))test(`${role}：主打快捷問題與完整交件提示（mock）`,async()=>{
 assert.match(roles[role].quick[0],targets[role]);
 let calls=0;
 const result=await employeeExperience({role,consent:true,messages:[{role:'user',content:roles[role].quick[0]}]},{AI:{run:async(_,p)=>{
  calls++;assert.match(p.messages[0].content,/直接交出完整成品/);assert.match(p.messages[0].content,/純文字表格.*｜/);assert.match(p.messages[0].content,/最後一句追問要不要調整/);
  if(calls===1)return {response:'{"calls":[]}'};
  assert.equal(p.max_tokens,1400);assert.match(p.messages[0].content,/本部門主打交件/);assert.match(p.messages[0].content,/即使上方卡片已經有內容也要交件/);
  return {response:'示範成品\n鏡號｜秒數｜畫面｜台詞｜字幕\n'+ '字'.repeat(2300)};
 }}});
 assert.equal(result.status,200);assert.equal(calls,2);assert.ok(result.body.reply.length>1600);assert.ok(result.body.reply.length<=2400);
});
test('路由保留 2400 字與分隔表格，超長回覆截斷且下一輪可用',async()=>{
 const ask=async messages=>handleThinkBig(new Request('https://local.test/thinkbig-experience',{method:'POST',headers:{Origin:'https://thinkbigtw.com','Content-Type':'application/json'},body:JSON.stringify({role:'media',consent:true,messages})}),{RATE_LIMITER:{limit:async()=>({success:true})},AI:{run:async(_,p)=>({response:p.max_tokens===450?'{"calls":[]}':'鏡號｜秒數\n'+ '字'.repeat(2500)})}});
 const result=await (await ask([{role:'user',content:'寫腳本'}])).json();assert.equal(result.reply.length,2400);assert.match(result.reply,/鏡號｜秒數/);
 assert.equal((await ask([{role:'user',content:'寫腳本'},{role:'assistant',content:result.reply},{role:'user',content:'換個鉤子'}])).status,200);
});
test('總對話 18000 字接受，18001 字拒絕，不呼叫 AI',async()=>{
 const messages=[...Array.from({length:7},()=>({role:'assistant',content:'字'.repeat(2400)})),{role:'user',content:'字'.repeat(1200)}];
 let calls=0;const env={AI:{run:async(_,p)=>{calls++;return {response:p.max_tokens===450?'{"calls":[]}':'示範草稿'};}}};
 const body={role:'media',consent:true,messages};assert.equal((await employeeExperience(body,env)).status,200);assert.equal(calls,2);
 messages.splice(0,0,{role:'assistant',content:'字'});assert.equal((await employeeExperience(body,env)).status,400);assert.equal(calls,2);
});
test('前端上下限及表格捲動樣式一致，維持文字安全渲染',()=>{
 assert.match(source,/data.reply.length>2400/);assert.match(source,/>18000/);assert.match(source,/bubble.textContent=content/);assert.match(source,/content.includes\('｜'\)/);
 const css=readFileSync(new URL('../../../experience/chat.css',import.meta.url),'utf8');assert.match(css,/\.assistant \.bubble.has-table\{[^}]*white-space:pre;[^}]*overflow-x:auto/);
});
test('示範成品具備分鏡、五天訓練、五題答案、三個假設及完整跟進信',()=>{
 const get=(role,name,args={})=>executeSandboxPlan(role,{calls:[{name,args} ]})[0].result;
 const script=get('media','video_script').rows;assert.ok(script.some(r=>r[1].includes('0–3 秒')));assert.ok(script.some(r=>r[1].includes('27–30 秒')));assert.ok(script.some(r=>r[0].includes('配樂')));
 assert.equal(get('training','onboarding_list').rows.length,5);assert.equal(get('training','training_quiz').rows.length,5);
 assert.equal(get('research','market_hypotheses').rows.filter(r=>r[0].startsWith('假設')).length,3);
 const letter=get('sales','draft_followup',{lead:'A'}).draft;for(const word of ['主旨','陳店長','報價重點','15:00','業務專員'])assert.ok(letter.includes(word));
});
