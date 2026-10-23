import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {sandboxTools,executeSandboxPlan} from './retail-experience.js';
const source=readFileSync(new URL('../../../experience/chat.js',import.meta.url),'utf8');
class Element {
 constructor(tag){this.tag=tag;this.children=[];this.value='';}
 set textContent(value){this.text=String(value);this.children=[];}
 get textContent(){return (this.text||'')+this.children.map(c=>c.textContent).join('');}
 set innerHTML(value){throw Error('不得使用 innerHTML');}
 append(...children){this.children.push(...children);}
}
const context=vm.createContext({document:{createElement:tag=>new Element(tag)}});
vm.runInContext(source.slice(source.indexOf('function renderTool('),source.indexOf('function busy(')),context);
for(const [role,tools] of Object.entries(sandboxTools))for(const [name,spec] of Object.entries(tools))test(`人性化卡片：${name}`,()=>{
 for(const args of [Object.fromEntries(Object.entries(spec).map(([k,v])=>[k,v[0]])),Object.fromEntries(Object.entries(spec).map(([k,v])=>[k,v.at(-1)]))]){
 const [step]=executeSandboxPlan(role,{calls:[{name,args}]});context.step=step;
 const card=vm.runInContext('renderTool(step)',context);
 assert.ok(card.textContent.length>5);
 if(Array.isArray(step.result.rows)){
  for(const [label,value] of step.result.rows){assert.ok(card.textContent.includes(label));assert.ok(card.textContent.includes(value));}
  assert.doesNotMatch(card.textContent,/示範步驟已整理/);
 }
 assert.doesNotMatch(card.textContent,/\[object Object\]|"(?:lead|draft|metrics)"\s*:/);
 if(name==='draft_followup'){assert.ok(card.textContent.includes(step.result.draft));assert.match(card.textContent,/示範，不會寄出/);}
 if(name==='weekly_tasks')assert.equal(card.children.filter(c=>c.tag==='label').length,3);
 }
});
test('未知工具與不合法欄位不洩漏原始資料，HTML 僅作文字',()=>{
 context.step={name:'unknown',result:{secret:'不應露出'}};
 assert.doesNotMatch(vm.runInContext('renderTool(step).textContent',context),/secret|不應露出/);
 context.step={name:'draft_followup',result:{lead:{private:'hidden'},draft:'<img src=x onerror=alert(1)>'}};
 const card=vm.runInContext('renderTool(step)',context);
 assert.match(card.textContent,/<img src=x onerror=alert\(1\)>/);
 assert.doesNotMatch(card.textContent,/private|hidden|\[object Object\]/);
});
test('沒有卡片時移除向下指引，有卡片時指向上方',()=>{
 const replySource=source.slice(source.indexOf('function replyForCards('),source.indexOf('function addSteps('));
 const clean=vm.runInNewContext(replySource+';replyForCards');
 assert.equal(clean('擬好了 👇',[]),'擬好了');
 assert.equal(clean('擬好了 👇',[{title:'腳本',action:'整理'}]),'擬好了 👆');
 assert.equal(clean('擬好了 👇',[{title:'腳本'}]),'擬好了');
});
test('草稿、腳本與清單卡片預設展開',()=>{
 const fragment=source.slice(source.indexOf('function addSteps('),source.indexOf('function resizeInput('));
 const rendered=[];
 const ctx=vm.createContext({document:{createElement:tag=>new Element(tag)},thread:{append:card=>rendered.push(card)},transcript:[],scroll:()=>{},renderTool:()=>new Element('div')});
 vm.runInContext(fragment,ctx);
 for(const name of ['draft_followup','social_draft','video_script','payment_list','purchase_list','onboarding_list','weekly_tasks']){
  ctx.step={name,title:'內容',action:'整理'};vm.runInContext('addSteps([step])',ctx);assert.equal(rendered.at(-1).open,true,name);
 }
});
