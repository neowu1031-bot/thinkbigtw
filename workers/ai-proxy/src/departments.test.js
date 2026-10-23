import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import {sandboxTools,executeSandboxPlan} from './retail-experience.js';
import {departmentRoles} from './department-demos.js';
import {handleThinkBig} from './thinkbig.js';
const roles=['retail','sales','service','marketing','media','accounting','admin','training','research'];
const payload=role=>({role,consent:true,messages:[{role:'user',content:'幫我整理這個部門的工作',extra:'不得轉送'}]});
const request=(body,origin='https://thinkbigtw.com')=>new Request('https://local.test/thinkbig-experience',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
const limiter={limit:async()=>({success:true})};
for(const role of roles){
 test(`${role}：請求執行本部門三項工作並保留同事口吻`,async()=>{
  let calls=0;
  const plan={calls:Object.entries(sandboxTools[role]).map(([name,spec])=>({name,args:Object.fromEntries(Object.entries(spec).map(([key,values])=>[key,values[0]]))}))};
  const env={RATE_LIMITER:limiter,AI:{run:async(_,p)=>{
   calls++;assert.deepEqual(p.messages[1],{role:'user',content:'幫我整理這個部門的工作'});
   assert.match(p.messages[0].content,/只操作本次請求示範資料/);
   if(calls===1)return {response:JSON.stringify(plan)};
   assert.match(p.messages[0].content,/短句.*先講結果/);assert.match(p.messages[0].content,/禁止.*工具/);
   assert.match(p.messages[0].content,/所有草稿均須人工確認/);
   if(departmentRoles[role]){
    assert.ok(p.messages[0].content.includes(departmentRoles[role].title));
    assert.match(p.messages[0].content,/大想成業（Think BIG；示範資料，人名與數字皆為虛構）/);
    for(const other of Object.keys(departmentRoles).filter(r=>r!==role))assert.ok(!p.messages[0].content.includes(departmentRoles[other].title));
   }
   return {response:'幫你整理好示範內容了，想先看哪一項？'};
  }}};
  const response=await handleThinkBig(request(payload(role)),env);assert.equal(response.status,200);
  const result=await response.json();assert.equal(result.mode,'live-ai');assert.equal(calls,2);
  assert.deepEqual(result.steps.map(s=>s.name),plan.calls.map(s=>s.name));
 });
 test(`${role}：防護在 AI 前攔截，同時保留假完成過濾`,async()=>{
  let calls=0;const env={RATE_LIMITER:limiter,AI:{run:async(_,p)=>{calls++;return {response:p.max_tokens===450?'{"calls":[]}':'已排入行事曆'};}}};
  for(const bad of [{...payload(role),consent:false},{...payload(role),data:{}},{...payload(role),messages:[{role:'user',content:'字'.repeat(1201)}]},{...payload(role),messages:[{role:'assistant',content:'字'.repeat(1601)},...payload(role).messages]},{...payload(role),messages:[{role:'assistant',content:'字'},...Array.from({length:5},()=>({role:'user',content:'字'.repeat(1200)}))]}])assert.equal((await handleThinkBig(request(bad),env)).status,400);
  assert.equal((await handleThinkBig(request(payload(role),'https://evil.test'),env)).status,403);
  assert.equal((await handleThinkBig(request(payload(role)),{})).status,503);
  assert.equal((await handleThinkBig(request(payload(role)),{RATE_LIMITER:{limit:async()=>({success:false})}})).status,429);
  assert.equal(calls,0);
  const response=await handleThinkBig(request(payload(role)),env);assert.equal(response.status,200);assert.doesNotMatch((await response.json()).reply,/已排入/);
 });
 test(`${role}：資料副本隔離、跨部門拒絕、最多三次`,()=>{
  const [name,spec]=Object.entries(sandboxTools[role])[0];const call={name,args:Object.fromEntries(Object.entries(spec).map(([k,v])=>[k,v[0]]))};
  const before=executeSandboxPlan(role,{calls:[call]});const copy=structuredClone(before);
  before[0].result.changed='不得保留';if(before[0].result.rows)before[0].result.rows[0][1]='不得保留';
  assert.deepEqual(executeSandboxPlan(role,{calls:[call]}),copy);
  assert.equal(executeSandboxPlan(role,{calls:Array(4).fill(call)}).length,3);
  const other=roles.find(r=>r!==role);const cross=Object.keys(sandboxTools[other])[0];
  assert.deepEqual(executeSandboxPlan(role,{calls:[{name:cross,args:{}}]}),[]);
 });
}
test('未知角色與非字串角色回傳 400 且不呼叫 AI',async()=>{
 for(const role of ['unknown','__proto__','constructor',null,{},['marketing'],true,9]){
  const response=await handleThinkBig(request(payload(role)),{RATE_LIMITER:limiter,AI:{run:()=>{throw Error('不得呼叫');}}});
  assert.equal(response.status,400);assert.equal((await response.json()).error,'invalid_role');
 }
 assert.deepEqual(Object.keys(sandboxTools).sort(),roles.toSorted());
});
test('組織圖九個部門、快捷問題與插畫資源完整，聊天版本正確',()=>{
 const page=readFileSync(new URL('../../../experience/index.html',import.meta.url),'utf8');
 const source=readFileSync(new URL('../../../experience/chat.js',import.meta.url),'utf8');
 const config=vm.runInNewContext('('+source.slice(source.indexOf('const roles=')+12,source.indexOf('\nconst $=')-1)+')');
 assert.deepEqual(Object.keys(config).sort(),roles.toSorted());
 assert.equal((page.match(/data-role=/g)||[]).length,9);
 assert.match(page,/大想成業（Think BIG）/);
 const cards=[...page.matchAll(/<button type="button" data-role="[^"]+">([\s\S]*?)<\/button>/g)];
 assert.equal(cards.length,9);
 for(const [,card] of cards) assert.ok(card.includes('示範資料，人名與數字皆為虛構'));

 for(const role of roles){assert.ok(page.includes(`data-role="${role}"`));assert.ok(config[role].quick.length>=3&&config[role].quick.length<=4);}
 for(const [,path] of page.matchAll(/src="(\/assets\/illustrations\/[^\"]+)"/g))assert.ok(existsSync(new URL('../../..'+path,import.meta.url)));
 assert.match(page,/chat\.css\?v=20261023g/);assert.match(page,/chat\.js\?v=20261023g/);
});
test('九部門點選沿用聊天、快捷問題、同意與返回流程，未同意不得送出',()=>{
 const source=readFileSync(new URL('../../../experience/chat.js',import.meta.url),'utf8');
 class Element{
  constructor(){this.children=[];this.listeners={};this.style={};this.value='';this.dataset={};this.hidden=false;this.scrollHeight=42;}
  append(...items){this.children.push(...items);}
  replaceChildren(){this.children=[];}
  addEventListener(name,fn){this.listeners[name]=fn;}
  focus(){}
 }
 const elements=new Map();const get=id=>{if(!elements.has(id))elements.set(id,new Element());return elements.get(id);};
 get('thread').parentElement=new Element();
 const buttons=roles.map(role=>{const el=new Element();el.dataset.role=role;return el;});
 let network=0;
 const context=vm.createContext({document:{getElementById:get,createElement:()=>new Element(),body:{classList:{add(){},remove(){}}},querySelectorAll:selector=>selector==='[data-role]'?buttons:[],querySelector:selector=>buttons.find(b=>selector.includes(`"${b.dataset.role}"`))},fetch:()=>{network++;throw Error('不得連外');},Date});
 vm.runInContext(source,context);
 for(const button of buttons){
  button.listeners.click();assert.equal(get('chooser').hidden,true);assert.equal(get('chat').hidden,false);
  assert.ok(get('employee-name').textContent.startsWith('AI '));
  assert.ok(get('quick').children.length>=3);assert.ok(get('thread').children.length>0);
  get('quick').children[0].listeners.click();assert.equal(get('consent-card').hidden,false);assert.equal(network,0);
  get('cancel-consent').listeners.click();assert.equal(get('consent-card').hidden,true);assert.ok(get('message').value.length>0);
  get('back').listeners.click();assert.equal(get('chooser').hidden,false);assert.equal(get('chat').hidden,true);
 }
 assert.equal(network,0);
});
