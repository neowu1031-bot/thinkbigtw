/* Controller tests use a minimal DOM/media double, not a browser or video decoder. */
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const code = fs.readFileSync('assets/homesplit/hero-media.js','utf8');
function setup(reduced=false, rejectPlay=false) {
  function target(extra={}) { return Object.assign({events:{},addEventListener(name,fn){this.events[name]=fn;},fire(name){this.events[name]?.();}},extra); }
  const classes=new Set();
  const frame={classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}};
  const source=target({dataset:{src:'/assets/neo_hero_wide.mp4'},hasAttribute(name){return name==='src' && Boolean(this.src);},removeAttribute(name){delete this[name];}});
  const button=target({hidden:true,textContent:''});
  const video=target({parentElement:frame,paused:true,loads:0,plays:0,querySelector(){return source;},load(){this.loads++;},pause(){this.paused=true;},play(){this.plays++;if(rejectPlay)return Promise.reject(new Error('autoplay denied'));this.paused=false;this.fire('playing');return Promise.resolve();}});
  const preference=target({matches:reduced});
  const document=target({hidden:false,querySelector(){return null;},getElementById(id){return id==='brand-hero-video'?video:button;}});
  let visibility;
  class Observer {constructor(fn){visibility=fn;}observe(){} }
  const window={matchMedia:()=>preference,IntersectionObserver:Observer};
  vm.runInNewContext(code,{window,document,IntersectionObserver:Observer});
  return {source,button,video,preference,document,classes,setReduced(value){preference.matches=value;preference.fire('change');},setVisible(value){visibility([{isIntersecting:value}]);}};
}
test('reduced motion never assigns the MP4 source and keeps the poster',()=>{
  const x=setup(true);assert.equal(x.source.src,undefined);assert.equal(x.video.plays,0);assert.equal(x.button.hidden,true);assert.equal(x.classes.size,0);
});
test('autoplay starts muted; explicit pause survives leaving and returning',()=>{
  const x=setup();assert.equal(x.source.src,'/assets/neo_hero_wide.mp4');assert.equal(x.video.muted,true);assert.ok(x.classes.has('is-playing'));
  x.button.fire('click');assert.ok(x.video.paused);assert.equal(x.classes.size,0);
  const plays=x.video.plays;x.setVisible(false);x.setVisible(true);assert.equal(x.video.plays,plays);
  x.button.fire('click');assert.ok(!x.video.paused);assert.ok(x.classes.has('is-playing'));
});
test('live preference changes unload media and restore autoplay only when allowed',()=>{
  const x=setup();x.setReduced(true);assert.ok(x.video.paused);assert.equal(x.source.src,undefined);assert.equal(x.button.hidden,true);assert.equal(x.classes.size,0);
  x.setReduced(false);assert.ok(!x.video.paused);assert.ok(x.classes.has('is-playing'));
});
test('offscreen and hidden-tab media pauses; reduced motion prevents resumption',()=>{
  const x=setup();x.setVisible(false);assert.ok(x.video.paused);x.setVisible(true);assert.ok(!x.video.paused);
  x.document.hidden=true;x.document.fire('visibilitychange');assert.ok(x.video.paused);
  x.setReduced(true);x.document.hidden=false;x.document.fire('visibilitychange');assert.ok(x.video.paused);assert.equal(x.source.src,undefined);
});
test('autoplay rejection retains poster; late rejection cannot expose reduced-motion controls',async()=>{
  const x=setup(false,true);await Promise.resolve();assert.equal(x.classes.size,0);assert.equal(x.button.textContent,'播放主視覺');
  const y=setup(false,true);y.setReduced(true);await Promise.resolve();assert.ok(y.button.hidden);assert.equal(y.source.src,undefined);
});
test('failed media source falls back to poster',()=>{
  const x=setup();x.source.fire('error');assert.equal(x.classes.size,0);assert.ok(x.video.paused);assert.ok(x.button.hidden);
});
