/* Geometry and motion state tests; real layout/paint is in review-v9d.cjs. */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require(process.env.JSDOM_MODULE||'jsdom');
const html=fs.readFileSync('harness/index.html','utf8').match(/<figure class="mcp-network"[\s\S]*?<\/figure>/)[0];
const source=fs.readFileSync('assets/homesplit/harness-protocol.js','utf8');
function setup({mobile=false,reduced=false,observer=true}={}){
 const dom=new JSDOM(html,{runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,media=new Map(),frames=new Map();
 let io,ro,id=0;
 w.matchMedia=q=>{if(!media.has(q)){const handlers=[];media.set(q,{matches:q.includes('reduced-motion')?reduced:mobile,addEventListener:(_,f)=>handlers.push(f),change(v){this.matches=v;handlers.forEach(f=>f());}});}return media.get(q);};
 w.requestAnimationFrame=f=>{frames.set(++id,f);return id;};
 if(observer)w.IntersectionObserver=class{constructor(fn){io=fn;}observe(){}};
 w.ResizeObserver=class{constructor(fn){ro=fn;}observe(){}};
 const map=w.document.querySelector('.mcp-network-map'),hub=w.document.querySelector('.mcp-hub');
 map.getBoundingClientRect=()=>({left:20,top:100,width:1000,height:800});
 hub.getBoundingClientRect=()=>({left:440,top:320,width:160,height:160});
 [...w.document.querySelectorAll('.mcp-agent,.mcp-tool')].forEach((e,i)=>{e.getBoundingClientRect=()=>({left:40+i*10,top:120+i*40,width:160,height:80});});
 w.eval(source);
 return {w,dom,frames,media,map,diagram:w.document.querySelector('.mcp-network'),enter(v){io([{isIntersecting:v}]);},resize(){ro();},flush(){const f=[...frames.values()];frames.clear();f.forEach(fn=>fn());},close(){dom.window.close();}};
}
test('connects all 9 agent nodes and 7 tools to the hub without changing official links',()=>{
 const x=setup();try{
  const wires=x.diagram.querySelectorAll('.mcp-wire');assert.equal(wires.length,16);assert.equal(x.diagram.querySelectorAll('.mcp-pulse').length,16);
  assert.equal(x.diagram.querySelectorAll('.mcp-agent a').length,8);assert.equal(x.diagram.querySelectorAll('button').length,0);
  assert.equal(wires[0].getAttribute('d'),'M 100 60 L 500 300');
  assert.match(wires[9].getAttribute('d'),/^M 500 300 V .* H .* V /);
  assert.ok([...wires].every(p=>!p.getAttribute('d').includes('NaN')));
 }finally{x.close();}
});
test('mobile routing uses vertical trunk and updates SVG dimensions after resize',()=>{
 const x=setup({mobile:true});try{
  assert.equal(x.diagram.querySelector('.mcp-wire').getAttribute('d'),'M 500 300 H 12 V 60 H 20');
  x.map.getBoundingClientRect=()=>({left:20,top:100,width:335,height:1550});x.resize();x.resize();assert.equal(x.frames.size,1);x.flush();
  assert.equal(x.diagram.querySelector('svg').getAttribute('viewBox'),'0 0 335 1550');
  x.media.get('(max-width: 760px)').change(false);x.flush();assert.match(x.diagram.querySelector('.mcp-wire').getAttribute('d'),/ L /);
 }finally{x.close();}
});
test('flow pauses offscreen, in hidden tabs and on live reduced-motion changes; content stays visible',()=>{
 const x=setup();try{
  assert.equal(x.diagram.classList.contains('mcp-entered'),false);x.enter(true);assert.ok(x.diagram.classList.contains('mcp-running'));
  x.enter(false);assert.ok(x.diagram.classList.contains('mcp-entered'));assert.equal(x.diagram.classList.contains('mcp-running'),false);
  x.enter(true);Object.defineProperty(x.w.document,'hidden',{value:true,configurable:true});x.w.document.dispatchEvent(new x.w.Event('visibilitychange'));assert.equal(x.diagram.classList.contains('mcp-running'),false);
  Object.defineProperty(x.w.document,'hidden',{value:false});x.media.get('(prefers-reduced-motion: reduce)').change(true);assert.equal(x.diagram.classList.contains('mcp-running'),false);
  x.media.get('(prefers-reduced-motion: reduce)').change(false);assert.ok(x.diagram.classList.contains('mcp-running'));
 }finally{x.close();}
});
test('initial reduced motion and missing IntersectionObserver retain readable static content',()=>{
 for(const opts of [{reduced:true},{observer:false}]){const x=setup(opts);try{assert.ok(x.diagram.classList.contains('mcp-entered'));assert.equal(x.diagram.classList.contains('mcp-running'),false);assert.equal(x.diagram.querySelectorAll('.mcp-wire').length,16);}finally{x.close();}}
});
