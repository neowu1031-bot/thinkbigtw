/* Behavioral tests only: DOM/rAF/observer behavior, not browser layout or paint. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require(process.env.JSDOM_MODULE || 'jsdom');
const source = fs.readFileSync('assets/homesplit/interactions.js', 'utf8');
const graph = fs.readFileSync('enterprise/index.html', 'utf8').match(/<figure[^>]+class="governance-model"[\s\S]*?<\/figure>/)[0];
function setup({fine=true, reduced=false, diagram=false}={}) {
  const dom = new JSDOM('<!doctype html><body><a class="variant" href="/hermes-starter/"><span>Hermes</span><span>NT$999</span></a><a class="button" href="/enterprise/#consult">諮詢 ›</a><p><a href="/trust/">資料政策</a></p><article class="resource"><h3>非連結</h3></article>'+(diagram?graph:''), {url:'https://thinkbigtw.com',runScripts:'outside-only'});
  const w = dom.window, media = new Map(), frames = new Map(), observers = [];
  w.matchMedia = query => {
    if (!media.has(query)) {
      const handlers=[]; const m={matches:query.includes('prefers-reduced-motion')?reduced:fine,
        addEventListener:(_,fn)=>handlers.push(fn),change(value){this.matches=value;handlers.forEach(fn=>fn());}};
      media.set(query,m);
    }
    return media.get(query);
  };
  let id=0;
  w.requestAnimationFrame = fn => {frames.set(++id,fn);return id;};
  w.cancelAnimationFrame = key => frames.delete(key);
  w.IntersectionObserver = class {constructor(fn){this.fn=fn;observers.push(this);}observe(el){this.el=el;}unobserve(){}};
  w.eval(source); w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const card=w.document.querySelector('.variant');
  card.getBoundingClientRect=()=>({left:10,top:20,width:300,height:200});
  return {w,dom,card,frames,media,observers,flush(){const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());},close(){w.close();}};
}
function pointer(x,type,px=90,py=70,pointerType='mouse') {
  const e=new x.w.Event(type);Object.assign(e,{clientX:px,clientY:py,pointerType});x.card.dispatchEvent(e);
}
test('enhancement preserves native link targets, plan labels and noninteractive content',()=>{
 const x=setup();try{
  assert.equal(x.card.getAttribute('href'),'/hermes-starter/');assert.equal(x.card.textContent,'HermesNT$999');
  assert.equal(x.card.querySelectorAll('a').length,0);
  assert.equal(x.w.document.querySelector('.button').getAttribute('href'),'/enterprise/#consult');
  assert.equal(x.w.document.querySelector('.tb-hover-arrow').textContent,'›');
  assert.equal(x.w.document.querySelector('article').dataset.tbFeedback,undefined);
  for(const span of x.w.document.querySelectorAll('.tb-hover-halo,.tb-hover-shine,.tb-hover-underline'))assert.equal(span.getAttribute('aria-hidden'),'true');
 }finally{x.close();}
});
test('spotlight coalesces movement and cancels pending work on pointer leave',()=>{
 const x=setup();try{
  pointer(x,'pointerenter');pointer(x,'pointermove',110,80);pointer(x,'pointermove',210,120);
  assert.equal(x.frames.size,1);x.flush();
  assert.equal(x.card.querySelector('.tb-hover-shine').style.transform,'translate3d(60px,-40px,0)');
  pointer(x,'pointermove');assert.equal(x.frames.size,1);pointer(x,'pointerleave');assert.equal(x.frames.size,0);
  assert.equal(x.card.querySelector('.tb-hover-shine').style.transform,'');
 }finally{x.close();}
});
test('touch and reduced motion never schedule spotlight frames; preference changes cancel work',()=>{
 for(const options of [{fine:false},{reduced:true}]){const x=setup(options);pointer(x,'pointermove');assert.equal(x.frames.size,0);x.close();}
 const x=setup();try{
  pointer(x,'pointermove',100,100,'touch');assert.equal(x.frames.size,0);
  pointer(x,'pointermove');assert.equal(x.frames.size,1);
  x.media.get('(prefers-reduced-motion: reduce)').change(true);assert.equal(x.frames.size,0);
 }finally{x.close();}
});
test('new advisor controls receive feedback without duplicate layers',async()=>{
 const x=setup();try{
  const button=x.w.document.createElement('button');button.textContent='送出';x.w.document.body.append(button);
  await new Promise(r=>setTimeout(r,0));assert.equal(button.querySelectorAll('.tb-hover-halo').length,1);
  button.append(x.w.document.createTextNode('摘要'));await new Promise(r=>setTimeout(r,0));
  assert.equal(button.querySelectorAll('.tb-hover-halo').length,1);
 }finally{x.close();}
});
test('fixed and absolute controls retain their positioning after enhancement',async()=>{
 const x=setup();try{
  for(const position of ['fixed','absolute']){
   const button=x.w.document.createElement('button');button.style.position=position;button.textContent='暫停';x.w.document.body.append(button);
   await new Promise(r=>setTimeout(r,0));
   assert.ok(button.classList.contains('tb-hover-button'));assert.equal(button.classList.contains('tb-hover-surface'),false);
  }
 }finally{x.close();}
});
test('governance enters once, pauses outside viewport and obeys pause control/live preference',()=>{
 const x=setup({diagram:true});try{
  const d=x.w.document.querySelector('.governance-model'),control=d.querySelector('button'),io=x.observers[0];
  assert.equal(d.classList.contains('model-entered'),false);
  io.fn([{target:d,isIntersecting:true}]);assert.ok(d.classList.contains('model-entered'));assert.ok(d.classList.contains('model-in-view'));
  control.click();assert.equal(control.getAttribute('aria-pressed'),'true');assert.ok(d.classList.contains('model-paused'));
  io.fn([{target:d,isIntersecting:false}]);assert.ok(d.classList.contains('model-entered'));assert.equal(d.classList.contains('model-in-view'),false);
  io.fn([{target:d,isIntersecting:true}]);assert.ok(d.classList.contains('model-paused'));
  control.click();assert.equal(control.getAttribute('aria-pressed'),'false');assert.equal(control.firstChild.textContent,'暫停資料流動');
  x.media.get('(prefers-reduced-motion: reduce)').change(true);assert.equal(control.hidden,true);assert.equal(d.classList.contains('model-ready'),false);
  x.media.get('(prefers-reduced-motion: reduce)').change(false);assert.ok(d.classList.contains('model-settled'));
 }finally{x.close();}
});
test('reduced motion starts with a static visible governance diagram',()=>{
 const x=setup({diagram:true,reduced:true});try{
  const d=x.w.document.querySelector('.governance-model');assert.ok(d.classList.contains('model-entered'));assert.equal(d.classList.contains('model-ready'),false);assert.equal(d.querySelector('button').hidden,true);
 }finally{x.close();}
});
