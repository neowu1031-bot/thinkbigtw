/** Original scenes using Anatomy by Ryan (MIT); see vendor/anatomy/LICENSE.
 * Build only: node scripts/build-portfolio-anatomy.mjs. No network/packages.
 */
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import * as k from './vendor/anatomy/iso-kit.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const out = 'assets/portfolio/anatomy/';
const read = p => readFileSync(root+p, 'utf8');
const write = (p,s) => writeFileSync(root+p,s);
const esc = s => s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const P = k.fitProjection(k.boxCorners({x:-112,y:-70,w:224,d:140},-10,110),600,360,{pad:48});
class Scene {
  constructor(p=P){this.p=p;this.s=[];this.count=0;}
  solid(paths,lit=false){this.count++;this.s.push(k.solidSvg(paths,{tone:'mid',crease:'lo',lit}));}
  box(x,y,z,w,d,h,lit=false,r=1){this.solid(k.slabOf({x,y,w,d,r:this.p===P?r:0},z,h,this.p,this.p===P?2:1,this.p===P?.5:0),lit);}
  line(d,free=false){this.s.push(k.lineSvg(d,{tone:'lo',free}));}
  bolt(x,y,z){this.s.push(k.dotsSvg([k.iso([x,y,z],this.p)],{size:1,tone:'mid'}));}
  top(x,y,z,w,d){this.line(k.planOutline({x,y,w,d,r:1},z,this.p,2));}
  base(w=208,d=128){
    for(const x of [-w/2+12,w/2-20])for(const y of [-d/2+12,d/2-20]){
      this.box(x,y,-10,8,8,5);this.box(x-1,y-1,-5,10,10,2);
    }
    this.box(-w/2,-d/2,-3,w,d,6,false,3);this.top(-w/2+4,-d/2+4,3,w-8,d-8);
    for(const x of [-w/2+8,w/2-8])for(const y of [-d/2+8,d/2-8])this.bolt(x,y,3);
  }
  parcel(x,y,z,w=22,d=19,h=18,lit=false){
    this.box(x,y,z,w,d,h,lit);this.box(x+w*.43,y,z+h,w*.14,d,.5);
    // Printed label is a closed inlay on the carton top.
    this.top(x+3,y+4,z+h+.1,w*.25,d*.45);
  }
  gear(x,y,z,r){
    const ring=Array.from({length:48},(_,i)=>{const a=i*Math.PI/24,rr=i%4===0||i%4===3?r-2:r;return [x+Math.cos(a)*rr,y+Math.sin(a)*rr];});
    this.solid(k.extrude(ring,z,3,this.p,{convex:false}));
    this.box(x-2,y-2,z+3,4,4,3); // square drive spindle
    this.line(k.ring(x,y,r*.48,z+3,this.p,24));
  }
  get svg(){return this.s.join('');}
}
function agent(){
 const s=new Scene();s.base();
 // Back-to-front independent drawer cabinets; handles lie on the front face.
 for(const x of [-83,35]){
   s.box(x,-33,3,48,68,59);
   for(let i=0;i<4;i++){
     const z=7+i*13;s.box(x+3,35,z,42,2,11);
     s.box(x+11,37,z+4,3,3,3);s.box(x+34,37,z+4,3,3,3);
     s.box(x+11,40,z+4,26,2,3);s.box(x+5,37.1,z+7,5,.5,2);
   }
 }
 s.box(-91,-42,62,182,88,6,false,3);
 for(const x of [-83,83])for(const y of [-34,38])s.bolt(x,y,68);
 for(const [x,y,r] of [[-60,-12,15],[-33,1,13]]){s.box(x-r-2,y-r-2,68,r*2+4,r*2+4,2);s.gear(x,y,70,r);}
 s.box(0,-26,68,34,36,4);s.box(4,-23,72,26,29,27);
 s.box(7,6,77,20,1,17,true); // front inset dispatch screen
 const m=k.sideMatrix([10,7],82,s.p,'left');
 s.s.push(k.faceTextSvg(m,'AI',{size:6,tone:'hi'}));
 for(let i=0;i<6;i++)s.top(7+i*3,-17,99,1,13);
 s.box(1,10,68,34,22,3);
 for(let i=0;i<6;i++)s.box(5+(i%3)*9,14+Math.floor(i/3)*8,71,5,4,1);
 return s;
}
function shelving(s,x=-80,y=-43,z=3,w=139){
 for(const a of [x,x+w-5]){s.box(a-2,y-2,z,9,9,3);s.box(a,y,z+3,5,5,87);}
 for(const h of [8,36,64]){
   s.box(x,y,z+h,w,34,3);
   for(const a of [x+5,x+w-10])s.box(a,y+3,z+h-4,5,26,4);
   for(let i=0;i<3;i++)s.parcel(x+12+i*(w-24)/3,y+6,z+h+3,22,20,19);
 }
 for(const a of [x,x+w-5]){s.box(a-2,y+29,z,9,9,3);s.box(a,y+31,z+3,5,5,87);for(const h of [16,44,72])s.bolt(a+2.5,y+33.5,z+h);}
}
function belt(s,x=-80,y=18,z=3,w=167){
 for(const a of [x+7,x+w-13])for(const b of [y+2,y+28])s.box(a,b,z,6,6,20);
 s.box(x,y,z+20,w,34,5);
 for(let i=0;i<12;i++)s.box(x+2+i*(w-4)/12,y+3,z+25,(w-4)/12-1,28,2);
 for(const b of [y,y+32])s.box(x,b,z+25,w,2,6);
 for(const a of [x,x+w-4])s.box(a,y,z+20,4,34,5);
}
function warehouse(){
 const s=new Scene();s.base();shelving(s);belt(s);
 s.s.push('<g data-parcel="incoming">');s.parcel(-61,24,30,24,20,20,true);s.s.push('</g>');
 s.s.push('<g data-parcel="outgoing" opacity="0">');s.parcel(43,24,30,24,20,20,true);s.s.push('</g>');
 s.box(77,-35,3,10,12,41);s.box(65,-41,44,31,18,22);s.box(68,-23,48,25,1,14,true);
 const matrix=k.sideMatrix([71,-21.8],51,s.p,'left');
 s.s.push(`<text class="iso-face-text" data-stock-counter="" transform="${matrix}" font-size="9">12</text>`);
 return s;
}
function empty(){
 const s=new Scene();s.base();
 for(const x of [-75,65])for(const y of [-37,27]){s.box(x,y,3,10,10,18);s.box(x-1,y-1,3,12,12,2);s.box(x-1,y-1,19,12,12,2);}
 s.box(-80,-42,21,160,84,8);
 for(let i=0;i<8;i++)s.box(-65+i*18,42,24,7,.6,2);
 s.box(-53,-28,29,106,56,18);
 for(const x of [-70,62])for(const y of [-34,26])s.box(x,y,29,8,8,1);
 s.box(-88,-48,47,176,96,7,false,3);
 s.top(-83,-43,54,166,86);
 for(const x of [-78,78])for(const y of [-38,38])s.bolt(x,y,54);
 for(const x of [-66,56])for(const y of [-29,19]){s.box(x,y,54,10,10,1);s.top(x+2,y+2,55,6,6);}
 s.box(-16,48,48,32,.8,4);

 return s;
}
function flow(){
 const stages=[];
 for(let i=0;i<4;i++){
   const s=new Scene({origin:[120+i*240,177],scale:.83,azimuth:45,elevation:30});s.base(146,90);
   if(i===0){
     s.box(-42,-25,3,84,56,6);s.box(-42,-25,9,4,56,19);s.box(38,-25,9,4,56,19);s.box(-38,-25,9,76,4,19);
     for(let j=0;j<4;j++)s.box(-31,-15,9+j*2,62,39,1);
     s.box(-24,-9,17,48,29,1,true);
     for(let j=0;j<4;j++)s.line(k.lineOnTop([-17,-3+j*5],[12-(j%2)*9,-3+j*5],18,s.p),true);
   }else if(i===1){
     shelving(s,-52,-28,3,104);
   }else if(i===2){
     belt(s,-60,-17,3,120);s.parcel(-10,-12,30,32,24,27,true);
   }else{
     s.box(-40,-25,3,80,57,13);s.box(-40,-25,16,80,45,31);
     s.box(-33,-20,47,66,34,3);s.box(-25,-16,50,50,25,1,true);
     for(let j=0;j<4;j++)s.box(-17+j*10,-9,51,5,6+j*3,.6);
     s.box(-31,20,21,62,1,7);s.box(-28,21,21,56,25,1);
     for(let j=0;j<4;j++)s.line(k.lineOnTop([-20,25+j*4],[15-j*4,25+j*4],22,s.p),true);
     for(let j=0;j<6;j++)s.box(40,-18+j*5,25,.5,2,12);
   }
   stages.push(`<g data-flow-art="${i}"${i===0?' data-active="true"':''}>${s.svg}</g>`);
 }
 return {svg:stages.join('')};
}
const names={
 'agent-workbench':['抽屜與齒輪工作台，中央 AI 將工作分派至不同部門','A drawer-and-gear workbench with a central AI dispatch console'],
 'warehouse-conveyor':['倉庫貨架與輸送帶，示意貨物進出和庫存計數','Warehouse shelving and a conveyor illustrating incoming goods, outgoing goods and stock counts'],
 'empty-display':['留給下一件作品的空展示台','An empty display plinth for the next project'],
 'erp-order-flow':['銷貨單流經收單盤、庫存貨架、出貨輸送帶與報表機','A sales order moves through an order tray, inventory shelves, shipping conveyor and report printer']
};
const art={ 'agent-workbench':agent(), 'warehouse-conveyor':warehouse(), 'empty-display':empty(), 'erp-order-flow':flow() };
const css=read(out+'anatomy.css');
function svg(key,en=false,standalone=false){
 const isFlow=key==='erp-order-flow', label=names[key][+en];
 return `<svg xmlns="http://www.w3.org/2000/svg" class="anatomy-svg ${isFlow?'anatomy-flow-svg':'project-cover'}" viewBox="0 0 ${isFlow?'960 270':'600 360'}" width="${isFlow?960:600}" height="${isFlow?270:360}" role="img" aria-label="${esc(label)}"${key==='warehouse-conveyor'?' data-warehouse=""':''}><title>${label}</title><!-- Geometry: Anatomy by Ryan, MIT; assets/portfolio/anatomy/LICENSE -->${standalone?`<style>${css}</style>`:''}${art[key].svg}</svg>`;
}
for(const key of Object.keys(art)){
 const data=svg(key,false,true)+'\n';if(Buffer.byteLength(data)>=150*1024)throw Error(key+' exceeds 150KB');
 write(out+key+'.svg',data);console.log(`${key}: ${Buffer.byteLength(data)} bytes, ${art[key].count||'four assemblies'} solids`);
}
const captions=[['分派工作','Dispatch','部門任務，各有其位。','A place for every team’s work.'],['進出有序','Stock in motion','進貨 +1 ／ 出貨 −1 · 示意','Receive +1 / Ship −1 · Illustration'],['預留下一件','Up next','下一個實際應用，準備中。','Making room for what comes next.']];
const keys=Object.keys(art).slice(0,3);
for(const en of [false,true]){
 const path=`portfolio/${en?'en/':''}index.html`;let page=read(path);
 if(!page.includes('portfolio-page anatomy-index'))page=page.replace('portfolio-page ', 'portfolio-page anatomy-index ');
 // First migration replaces only the cover, leaving all card content and links intact.
 page=page.replace(/(<a class="project-card"[^>]*>)(?:<img class="project-cover"[^>]*>|<svg class="project-cover erp-cover"[\s\S]*?<\/svg>)/g,'$1<!-- ANATOMY:COVER -->');
 page=page.replace(/<div class="project-cover empty-cover"[\s\S]*?<\/div>/,'<!-- ANATOMY:COVER -->');
 page=page.replace(/<!-- ANATOMY:COVER:START -->[\s\S]*?<!-- ANATOMY:COVER:END -->/g,'<!-- ANATOMY:COVER -->');
 let n=0;page=page.replace(/<!-- ANATOMY:COVER -->/g,()=>{
 const i=n++,c=captions[i];return `<!-- ANATOMY:COVER:START --><div class="anatomy-cover"><div class="anatomy-caption"><span>FIG. 0${i+1}</span><span>${c[en?1:0]}</span></div>${svg(keys[i],en)}<div class="anatomy-caption anatomy-caption-bottom"><span>${c[en?3:2]}</span></div></div><!-- ANATOMY:COVER:END -->`;
 });if(n!==3)throw Error('Expected three covers in '+path);
 if(!page.includes('/anatomy/anatomy.css'))page=page.replace('</head>','<link rel="stylesheet" href="/assets/portfolio/anatomy/anatomy.css">\n<script defer src="/assets/portfolio/anatomy/anatomy.js"></script>\n</head>');
 write(path,page);
}
const steps=[
 ['下單','Order','把客戶、品項與數量記在同一張銷貨單，草稿不動庫存。','Record the customer, items and quantities on one sales order; a draft leaves stock unchanged.'],
 ['扣庫存','Deduct stock','確認出貨時才扣庫存，數量不足就不會過帳。','Stock is deducted when you post the shipment; insufficient stock prevents posting.'],
 ['出貨','Ship','同一次出貨過帳會更新單據狀態，留下可追溯的庫存紀錄。','The same shipment posting updates the order status and records a traceable stock movement.'],
 ['報表','Report','已出貨的銷售會反映在營收與毛利報表，方便回頭核對。','Posted sales appear in revenue and gross-profit reports so you can check the results.']
];
for(const en of [false,true]){
 const path=`portfolio/erp-demo/${en?'en/':''}index.html`;let page=read(path);
 const figure=`<!-- ANATOMY:FLOW:START --><figure class="anatomy-flow" data-order-flow="" aria-labelledby="anatomy-flow-title"><figcaption class="anatomy-flow-heading"><span class="anatomy-kicker">FIG. 04 / ORDER TO REPORT</span><h2 id="anatomy-flow-title">${en?'How a sales order flows through ERP':'一張銷貨單怎麼流過 ERP'}</h2><p>${en?'Hover, tap or use Tab to explore each step.':'滑過、點選，或按 Tab，看看每一步。'}</p></figcaption>${svg('erp-order-flow',en)}<div class="anatomy-steps" role="group" aria-label="${en?'Sales order steps':'銷貨單流程'}">${steps.map((s,i)=>`<div class="anatomy-step"><button type="button" data-flow-step="${i}" aria-pressed="${i===0}" aria-describedby="anatomy-step-${i}"><span aria-hidden="true">0${i+1}</span>${s[en?1:0]}</button><p id="anatomy-step-${i}">${s[en?3:2]}</p></div>`).join('')}</div><p class="anatomy-flow-note">${en?'Process illustration · In this demo, stock deduction and shipment are posted together.':'流程圖解・此 Demo 的扣庫存與出貨在同一次過帳完成。'}</p></figure><!-- ANATOMY:FLOW:END -->`;
 if(page.includes('<!-- ANATOMY:FLOW:START -->'))page=page.replace(/<!-- ANATOMY:FLOW:START -->[\s\S]*?<!-- ANATOMY:FLOW:END -->/,figure);
 else page=page.replace('<p id="storage-status"',figure+'<p id="storage-status"');
 if(!page.includes('/anatomy/anatomy.css'))page=page.replace('</head>','<link rel="stylesheet" href="/assets/portfolio/anatomy/anatomy.css">\n<script defer src="/assets/portfolio/anatomy/anatomy.js"></script>\n</head>');
 write(path,page);
}
