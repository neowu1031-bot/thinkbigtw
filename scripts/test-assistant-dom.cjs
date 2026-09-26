/* Behavioral DOM tests; do not claim layout, native focus trapping or Lighthouse. */
const {JSDOM}=require(process.env.JSDOM_MODULE || 'jsdom');
const fs=require('node:fs');const assert=require('node:assert/strict');
const tick=()=>new Promise(r=>setTimeout(r,20));
(async()=>{
 const dom=new JSDOM('<!doctype html><html><head></head><body></body></html>',{url:'https://thinkbigtw.com',runScripts:'outside-only'});
 const w=dom.window;const calls=[];let fail=true;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'));};
 w.HTMLElement.prototype.scrollIntoView=function(){};
 w.fetch=async(url,options)=>{
  calls.push({url,body:JSON.parse(options.body)});
  if(url.endsWith('/thinkbig-chat'))return {ok:true,json:async()=>({reply:'可以整理需求摘要。',inquirySuggested:true})};
  return fail?{ok:false,status:503}:{ok:true,json:async()=>({accepted:true})};
 };
 w.eval(fs.readFileSync('assets/agent-faq.generated.js','utf8'));w.eval(fs.readFileSync('ask-ai.js','utf8'));
 w.document.querySelector('script[src="/assets/agent-faq.generated.js"]').dispatchEvent(new w.Event('load'));
 const q=s=>w.document.querySelector(s),click=s=>q(s).click();
 click('#tb-ai-launcher');assert.equal(calls.length,0);assert.equal(w.document.activeElement.id,'tb-ai-input');
 click('.ai-chips button');assert.equal(calls.length,0);
 q('#tb-ai-input').value='我想諮詢';q('.ai-composer').dispatchEvent(new w.Event('submit',{cancelable:true}));await tick();
 assert.equal(calls.length,1);click('.ai-inline-action');
 q('[name=name]').value='測試訪客';q('[name=need]').value='整理詢問';q('[name=contact]').value='private@example.invalid';
 q('.ai-inquiry-form').dispatchEvent(new w.Event('submit',{cancelable:true}));
 assert.equal(calls.length,1);assert.ok(q('.ai-confirm').disabled);assert.ok(q('.ai-preview').textContent.includes('private@example.invalid'));
 click('.ai-edit');assert.equal(q('.ai-inquiry-form').hidden,false);q('.ai-inquiry-form').dispatchEvent(new w.Event('submit',{cancelable:true}));
 click('.ai-consent input');click('.ai-confirm');await tick();
 assert.ok(q('.ai-receipt').textContent.includes('尚未確認'));assert.ok(!q('.ai-inquiry').textContent.includes('已送出，顧問會'));
 fail=false;click('.ai-confirm');await tick();assert.ok(q('.ai-inquiry').textContent.includes('已送出，顧問會主動與你聯繫'));
 assert.deepEqual(calls[1].body,calls[2].body);assert.ok(!JSON.stringify(calls[0]).includes('private@example.invalid'));
 assert.equal(w.localStorage.length,0);assert.equal(w.sessionStorage.length,0);
 click('.ai-close');assert.equal(w.document.activeElement.id,'tb-ai-launcher');
 dom.window.close();console.log('PASS DOM: FAQ no API, chat, preview/edit, explicit consent, failure, retry dedupe, success, no contact-to-model, no storage, focus restoration');
})().catch(e=>{console.error(e);process.exitCode=1;});
