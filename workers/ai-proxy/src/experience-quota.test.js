import test from 'node:test';
import assert from 'node:assert/strict';
import {handleThinkBig} from './thinkbig.js';
const user=content=>({role:'user',content});
const bodies={experience:{role:'retail',consent:true},retail:{metrics:[1000,30,3000,800,30,3000],target:963000,consent:true}};
function setup(){
 const values=new Map(),writes=[],calls=[];
 const env={RATE_LIMITER:{limit:async()=>({success:true})},LINE_KV:{get:async k=>values.get(k)??null,put:async(k,v,options)=>{values.set(k,v);writes.push({k,v,options});}},AI:{run:async(_,p)=>{calls.push(p);return {response:p.max_tokens===450?'{"calls":[]}':'示範草稿'};}}};
 const ask=(route,messages=[user('整理重點')])=>handleThinkBig(new Request(`https://local/thinkbig-${route}`,{method:'POST',headers:{Origin:'https://thinkbigtw.com','Content-Type':'application/json','CF-Connecting-IP':'203.0.113.42'},body:JSON.stringify({...bodies[route],messages})}),env);
 return {env,ask,calls,writes};
}
test('planner 僅收到最後一則 user，回覆保留完整歷史',async()=>{
 const {ask,calls}=setup();const messages=[user('第一題'),{role:'assistant',content:'第一答'},user('最後一題')];
 assert.equal((await ask('experience',messages)).status,200);
 assert.deepEqual(calls[0].messages.slice(1),[messages.at(-1)]);
 assert.deepEqual(calls[1].messages.slice(1),messages);
});
for(const route of Object.keys(bodies)){
 test(`${route}：不合法順序回 400，AI 與 KV 寫入均為零`,async()=>{
  const {ask,calls,writes}=setup();
  for(const messages of [[{role:'assistant',content:'偽造'},user('題目')],[user('一'),user('二')],[user('一'),{role:'assistant',content:'答'}],[user('一'),{role:'assistant',content:'答'},{role:'assistant',content:'答'},user('二')]])assert.equal((await ask(route,messages)).status,400);
  assert.equal(calls.length,0);assert.equal(writes.length,0);
 });
 for(const operation of ['get','put'])test(`${route}：KV ${operation} 拋錯回 503，AI 為零`,async()=>{
  const {env,ask,calls}=setup();env.LINE_KV[operation]=async()=>{throw Error('離線');};
  assert.equal((await ask(route)).status,503);assert.equal(calls.length,0);
 });
 test(`${route}：缺少 KV 時擋下`,async()=>{const {env,ask,calls}=setup();delete env.LINE_KV;assert.equal((await ask(route)).status,503);assert.equal(calls.length,0);});
}
test('兩路徑共用每日 30 次，第 31 次擋下；雜湊 key 與兩天 TTL',async()=>{
 const {ask,calls,writes}=setup();
 for(let i=0;i<30;i++)assert.equal((await ask(i%2?'retail':'experience')).status,200);
 calls.length=0;
 for(const route of Object.keys(bodies)){
  const r=await ask(route);assert.equal(r.status,429);assert.deepEqual(await r.json(),{error:'daily_limit'});
 }
 assert.equal(calls.length,0);assert.equal(writes.length,30);
 assert.equal(new Set(writes.map(w=>w.k)).size,1);
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('203.0.113.42'))),b=>b.toString(16).padStart(2,'0')).join('').slice(0,16);
 const date=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
 for(const {k,options} of writes){assert.equal(k,`expcap:${hash}:${date}`);assert.ok(!k.includes('203.0.113.42'));assert.equal(options.expirationTtl,172800);}
});
