/* DOM/state/static regression coverage only; browser/layout acceptance belongs to GM. */
const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {boot}=require('./test-portfolio-dom.cjs');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const script=read('assets/portfolio/anatomy/anatomy.js');
let count=0;
function eq(a,b,message){assert.deepEqual(a,b,message);count++;}
function ok(a,message){assert.ok(a,message);count++;}
function environment(w,{reduced=false,mobile=false}={}){
 const queries=new Map(),frames=new Map(),observers=[];let next=0;
 w.matchMedia=q=>{
  if(!queries.has(q)){
   const listeners=[];
   queries.set(q,{matches:q.includes('reduced-motion')?reduced:mobile,addEventListener:(event,cb)=>listeners.push(cb),change(value){this.matches=value;listeners.forEach(cb=>cb(this));}});
  }return queries.get(q);
 };
 w.requestAnimationFrame=fn=>{frames.set(++next,fn);return next;};
 w.cancelAnimationFrame=id=>frames.delete(id);
 w.IntersectionObserver=class{constructor(cb){this.cb=cb;observers.push(this);}observe(){}};
 Object.defineProperty(w.document,'hidden',{value:false,configurable:true});
 w.eval(script);
 return {queries,frames,observers,step(time){const list=[...frames.values()];frames.clear();list.forEach(fn=>fn(time));}};
}
for(const en of [false,true]){
 const b=boot(en),{w,q,data}=b;
 const saved=JSON.stringify(data()),env=environment(w);
 eq(q('[data-order-flow] svg').getAttribute('viewBox'),'0 0 960 270');
 const controls=[...w.document.querySelectorAll('[data-flow-step]')];eq(controls.length,4);
 const choices=[...w.document.querySelectorAll('[data-flow-art]')];eq(choices.length,4);
 for(let i=0;i<4;i++){
  for(const event of ['pointerenter','focus','click']){
   controls[i].dispatchEvent(new w.Event(event));
   eq(q('.anatomy-description').textContent,q(`#anatomy-step-${i}`).textContent);
   eq(controls.filter(c=>c.getAttribute('aria-pressed')==='true').length,1);
   eq(controls[i].getAttribute('aria-pressed'),'true');
   eq(choices[i].dataset.active,'true');
  }
  choices[(i+1)%4].dispatchEvent(new w.Event('pointerenter'));
  eq(controls[(i+1)%4].getAttribute('aria-pressed'),'true');
  choices[i].dispatchEvent(new w.Event('click'));eq(controls[i].getAttribute('aria-pressed'),'true');
 }
 env.queries.get('(max-width: 600px)').change(true);
 eq(q('[data-order-flow] svg').getAttribute('viewBox'),'0 0 480 490');
 env.queries.get('(max-width: 600px)').change(false);
 eq(q('[data-order-flow] svg').getAttribute('viewBox'),'0 0 960 270');
 eq(JSON.stringify(data()),saved,'Illustration must not mutate ERP data');
 eq(b.errors,[]);w.close();
 const p=`portfolio/${en?'en/':''}index.html`;
 const dom=new JSDOM(read(p),{runScripts:'outside-only',pretendToBeVisual:true});
 const win=dom.window,doc=win.document;
 const e=environment(win);const svg=doc.querySelector('[data-warehouse]'),card=svg.closest('a');
 const counter=svg.querySelector('[data-stock-counter]');
 eq(doc.querySelectorAll('.anatomy-cover svg[role=img]').length,3);
 eq(doc.querySelector('.coming-soon a'),null);
 eq(doc.querySelectorAll('.project-card[href]').length,2);
 card.dispatchEvent(new win.Event('pointerenter'));eq(e.frames.size,0,'No animation while offscreen');
 e.observers[0].cb([{isIntersecting:false},{isIntersecting:true}]);eq(e.frames.size,1,'Newest intersection entry wins');
 e.step(0);e.step(800);eq(counter.textContent,'12');
 ok(svg.querySelector('[data-parcel=incoming]').getAttribute('transform')!=='translate(0 0)');
 e.step(1600);eq(counter.textContent,'13');eq(svg.querySelector('[data-parcel=incoming]').getAttribute('opacity'),'0');
 e.step(2200);eq(counter.textContent,'13');eq(svg.querySelector('[data-parcel=outgoing]').getAttribute('opacity'),'1');
 e.step(3800);eq(counter.textContent,'12');eq(svg.querySelector('[data-parcel=outgoing]').getAttribute('opacity'),'0');
 e.step(4000);eq(e.frames.size,0,'Cycle stops after four seconds');
 card.dispatchEvent(new win.Event('pointerleave'));card.dispatchEvent(new win.Event('focusin'));eq(e.frames.size,1);
 e.queries.get('(prefers-reduced-motion: reduce)').change(true);eq(e.frames.size,0);eq(counter.textContent,'12');
 card.dispatchEvent(new win.Event('pointerenter'));eq(e.frames.size,0,'Reduced motion cannot start animation');
 e.queries.get('(prefers-reduced-motion: reduce)').change(false);
 card.dispatchEvent(new win.Event('focusin'));eq(e.frames.size,1);
 e.observers[0].cb([{isIntersecting:false}]);eq(e.frames.size,0);eq(counter.textContent,'12');
 e.observers[0].cb([{isIntersecting:true}]);eq(e.frames.size,1);
 Object.defineProperty(doc,'hidden',{value:true,configurable:true});doc.dispatchEvent(new win.Event('visibilitychange'));eq(e.frames.size,0);
 win.close();
 const plain=new JSDOM(read(`portfolio/erp-demo/${en?'en/':''}index.html`));
 eq(plain.window.document.querySelectorAll('.anatomy-step p').length,4,'No-JS explanations exist');
 plain.window.close();
}
for(const key of ['agent-workbench','warehouse-conveyor','empty-display','erp-order-flow']){
 const file=`assets/portfolio/anatomy/${key}.svg`,text=read(file);
 ok(Buffer.byteLength(text)<150000,file+' <150KB');
 const dom=new JSDOM(text,{contentType:'image/svg+xml'}),svg=dom.window.document.documentElement;
 eq(svg.getAttribute('role'),'img');ok(svg.getAttribute('aria-label'));ok(svg.querySelector('title').textContent);
 eq(svg.querySelectorAll('script,foreignObject,image').length,0,'Self-contained vector only');
 ok(!/NaN|Infinity|undefined/.test(text));dom.window.close();
}
for(const p of ['portfolio/index.html','portfolio/en/index.html','portfolio/erp-demo/index.html','portfolio/erp-demo/en/index.html']){
 const dom=new JSDOM(read(p)),doc=dom.window.document,ids=[...doc.querySelectorAll('[id]')].map(e=>e.id);
 eq(new Set(ids).size,ids.length,p+' has unique IDs');
 for(const svg of doc.querySelectorAll('.anatomy-svg')){
  ok(svg.getAttribute('aria-label'));ok(svg.querySelector('title'));
 }
 for(const resource of doc.querySelectorAll('[src*="/anatomy/"],[href*="/anatomy/"]'))ok(fs.existsSync(path.join(root,resource.getAttribute('src')||resource.getAttribute('href'))));
 dom.window.close();
}
console.log(`PASS: ${count} anatomy DOM/state/asset assertions. No layout, native focus, visual or contrast claim.`);
