import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../../../experience/experience.js',import.meta.url),'utf8');
test('聊天頁沒有門市表單時仍可載入並共用下載報告',()=>{
 const context=vm.createContext({document:{getElementById:()=>null}});
 vm.runInContext(source,context);
 assert.match(vm.runInContext('discussionReport([{content:"測試問題"},{content:"測試回答"}])',context),/測試回答/);
});
test('門市頁仍可載入案例、送出表單並綁定報告下載',()=>{
 const elements=new Map();
 const element=id=>{if(!elements.has(id))elements.set(id,{value:'',listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},focus(){}});return elements.get(id);};
 const context=vm.createContext({document:{getElementById:element,querySelectorAll:()=>[]}});
 vm.runInContext(source,context);
 assert.equal(element('prev-traffic').value,1000);
 element('metrics').listeners.submit({preventDefault(){}});
 assert.match(element('result').innerHTML,/本期推算營收/);
 assert.equal(typeof element('download').listeners.click,'function');
});
