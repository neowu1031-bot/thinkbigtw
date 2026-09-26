/* Local-only behavior: native required fields must never suppress inline feedback. */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require(process.env.JSDOM_MODULE || 'jsdom');
const fs=require('node:fs');
function setup(){
 const dom=new JSDOM(fs.readFileSync('enterprise/index.html','utf8'),{runScripts:'outside-only',url:'https://example.invalid/enterprise/'});
 dom.window.fetch=()=>{throw Error('The local summary must never make a request')};
 dom.window.eval(fs.readFileSync('assets/homesplit/site.js','utf8'));
 const d=dom.window.document,form=d.querySelector('#consult-form');
 return {dom,d,form,submit:()=>form.querySelector('[type=submit]').click()};
}
test('empty and whitespace forms show focusable inline errors; workflow and timing are required',()=>{
 const x=setup();const {d,form,submit}=x;
 assert.equal(form.noValidate,true);submit();
 assert.match(d.querySelector('#brief-status').textContent,/請填寫部門/);assert.equal(d.activeElement.name,'role');
 d.querySelector('[name=role]').value='   ';submit();assert.equal(d.activeElement.name,'role');
 d.querySelector('[name=role]').value='行政';submit();assert.equal(d.activeElement.name,'workflow');assert.match(d.querySelector('#brief-status').textContent,/至少選一個/);
 d.querySelector('[name=workflow]').checked=true;submit();assert.equal(d.activeElement.name,'timing');assert.match(d.querySelector('#brief-status').textContent,/請選擇/);
 assert.equal(d.querySelector('#brief-output').hidden,true);x.dom.window.close();
});
test('valid data generates only a local preview; edits hide stale output',()=>{
 const x=setup();const {d,submit}=x;
 d.querySelector('[name=role]').value=' 行政 ';d.querySelector('[name=workflow]').checked=true;d.querySelector('[name=timing]').selectedIndex=1;submit();
 assert.equal(d.querySelector('#brief-output').hidden,false);assert.match(d.querySelector('#brief-text').textContent,/部門／職位：行政/);assert.match(d.querySelector('#brief-status').textContent,/尚未送出/);assert.equal(d.querySelectorAll('[aria-invalid=true]').length,0);
 d.querySelector('[name=role]').dispatchEvent(new x.dom.window.Event('input',{bubbles:true}));assert.equal(d.querySelector('#brief-output').hidden,true);assert.match(d.querySelector('#brief-status').textContent,/重新產生/);x.dom.window.close();
});
