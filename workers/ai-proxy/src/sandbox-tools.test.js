import test from 'node:test';
import assert from 'node:assert/strict';
import {executeSandboxPlan,sandboxTools,employeeExperience} from './retail-experience.js';
import {handleThinkBig} from './thinkbig.js';
const execute=(role,name,args)=>executeSandboxPlan(role,{calls:[{name,args}]});
for(const [role,tools] of Object.entries(sandboxTools))for(const [name,spec] of Object.entries(tools)) {
 const args=Object.fromEntries(Object.entries(spec).map(([k,values])=>[k,values[0]]));
 test(`${name}: executes only enum-validated parameters`,()=>{
  const result=execute(role,name,args);assert.equal(result.length,1);assert.match(result[0].title,/示範/);assert.ok(result[0].result);
  for(const bad of [null,[],{...args,extra:'https://evil.test'},...Object.keys(args).flatMap(k=>[{...args,[k]:'<script>已寄出</script>'},{...args,[k]:{}},{...args,[k]:null},{...args,[k]:true},{...args,[k]:[args[k]]},Object.fromEntries(Object.entries(args).filter(([key])=>key!==k))])])assert.deepEqual(execute(role,name,bad),[]);
 });
}
test('unknown and cross-role tools ignored; first three attempts bound execution',()=>{
 for(const name of ['__proto__','constructor','fetch','booking_draft'])assert.deepEqual(execute('retail',name,{}),[]);
 assert.deepEqual(executeSandboxPlan('__proto__',{calls:[]}),[]);
 const call={name:'weekly_tasks',args:{store:'B'}};
 assert.equal(executeSandboxPlan('retail',{calls:Array(8).fill(call)}).length,3);
 assert.equal(executeSandboxPlan('retail',{calls:[{name:'bad',args:{}},{name:'bad',args:{}},{name:'bad',args:{}},call]}).length,0);
 assert.deepEqual(executeSandboxPlan('retail',null),[]);
 assert.deepEqual(executeSandboxPlan('retail',{calls:{}}),[]);
 assert.deepEqual(executeSandboxPlan('sales',{calls:[{name:'lead_data',args:{lead:'A'},url:'evil'}]}),[]);
});
test('results are isolated across calls and requests',()=>{
 const a=execute('retail','store_data',{store:'A'});a[0].result.metrics[0]=999;
 assert.equal(execute('retail','store_data',{store:'A'})[0].result.metrics[0],1000);
 const plan={calls:[{name:'draft_followup',args:{lead:'B'}},{name:'schedule_contact',args:{lead:'B',slot:'下個示範營業日 11:00'}}]};
 assert.equal(executeSandboxPlan('sales',plan).length,2);
 assert.deepEqual(executeSandboxPlan('sales',plan),executeSandboxPlan('sales',plan));
});
const body={role:'sales',consent:true,messages:[{role:'user',content:'幫潛客 B 跟進'}]};
test('bad JSON and malformed plans never execute tools',async()=>{
 for(const response of ['{broken','```json\n{}\n```','null','[]','{"calls":"bad"}']){
 let calls=0;const r=await employeeExperience(body,{AI:{run:async()=>{calls++;return {response};}}});
 assert.equal(r.status,200);assert.deepEqual(r.body.steps,[]);assert.ok(calls<=2);
 }
});
test('two-stage context uses validated results; final failure retains demo artifacts',async()=>{
 for(const fail of [false,true]){
 let calls=0;
 const r=await employeeExperience(body,{AI:{run:async(_,p)=>{
 calls++;if(calls===1)return {response:JSON.stringify({calls:[{name:'draft_followup',args:{lead:'B'}},{name:'fetch',args:{url:'evil'}}]})};
 assert.match(p.messages[0].content,/待送匣/);assert.doesNotMatch(p.messages[0].content,/evil/);
 if(fail)throw Error('offline');return {response:'請核對示範待送匣。'};
 }}});
 assert.equal(calls,2);assert.equal(r.status,200);assert.equal(r.body.steps.length,1);assert.match(r.body.steps[0].title,/不會寄出/);
 }
});
test('route blocks all receipt words outside demo cards',async()=>{
 for(const response of ['已寄出訊息','已預約','已收到']){
 const request=new Request('https://example.test/thinkbig-experience',{method:'POST',headers:{Origin:'https://thinkbigtw.com','Content-Type':'application/json'},body:JSON.stringify(body)});
 const r=await handleThinkBig(request,{RATE_LIMITER:{limit:async()=>({success:true})},AI:{run:async(_,p)=>({response:p.max_tokens===450?'{"calls":[]}':response})}});
 assert.equal(r.status,200);assert.doesNotMatch((await r.json()).reply,/已寄出|已預約|已收到/);
 }
});

const validPlan={calls:[{name:'draft_followup',args:{lead:'B'}}]};
for(const [label,planned] of [
 ['JSON 圍欄',{response:'```json\n'+JSON.stringify(validPlan)+'\n```'}],
 ['前後文字',{response:'以下是計畫：'+JSON.stringify(validPlan)+'\n請確認。'}],
 ['response 物件',{response:validPlan}],
 ['直接物件',validPlan]
]) {
 test(`工具計畫容錯：${label}`,async()=>{
  let calls=0;
  const r=await employeeExperience(body,{AI:{run:async()=>++calls===1?planned:{response:'請核對草稿。'}}});
  assert.equal(r.status,200);assert.equal(calls,2);
  assert.deepEqual(r.body.steps.map(s=>s.name),['draft_followup']);
 });
}
test('容錯計畫仍限制白名單、型別及前三次嘗試',async()=>{
 for(const wrap of [p=>({response:'計畫：'+JSON.stringify(p)+' 完畢'}),p=>({response:p}),p=>p]) {
  for(const [plan,expected] of [
   [{calls:Array(4).fill(validPlan.calls[0])},3],
   [{calls:[{name:'fetch',args:{}},{name:'draft_followup',args:{lead:['B']}},{name:'booking_draft',args:{}},validPlan.calls[0]]},0]
  ]) {
   let calls=0;
   const r=await employeeExperience(body,{AI:{run:async()=>++calls===1?wrap(plan):{response:'請核對草稿。'}}});
   assert.equal(r.body.steps.length,expected);
  }
 }
});

test('所有卡片只標示一次示範',()=>{
 for(const [role,tools] of Object.entries(sandboxTools))for(const [name,spec] of Object.entries(tools)){
  const args=Object.fromEntries(Object.entries(spec).map(([k,v])=>[k,v[0]]));
  const [step]=execute(role,name,args);
  for(const text of [step.title,step.action])assert.equal((text.match(/示範/g)||[]).length,1);
 }
});
test('三位潛客草稿有稱呼、詢價細節與可回覆的下一步',()=>{
 for(const lead of ['A','B','C']){
  const [{result:data}]=execute('sales','lead_data',{lead});
  const [{result:{draft}}]=execute('sales','draft_followup',{lead});
  assert.ok(data.company);assert.ok(data.contact);assert.ok(data.item);
  for(const text of [data.company,data.contact,data.item])assert.ok(draft.includes(text));
  assert.match(draft,/方便.*嗎？/);assert.doesNotMatch(draft,/2 個工作天後詢問/);
 }
});
for(const role of ['retail','sales','service'])test(`${role}：第二段要求同事口吻且保留草稿確認界線`,async()=>{
 let calls=0,replyPrompt;
 await employeeExperience({...body,role},{AI:{run:async(_,p)=>{
  if(++calls===1)return {response:'{"calls":[]}'};
  replyPrompt=p.messages[0].content;
  return {response:'幫你整理好了，要先看哪一項？'};
 }}});assert.equal(calls,2);
  assert.match(replyPrompt,/禁止.*工具.*工具結果.*根據資料/);
  assert.match(replyPrompt,/LINE.*短句.*先講結果/);
  assert.match(replyPrompt,/所有草稿均須人工確認/);
});
