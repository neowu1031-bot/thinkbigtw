'use strict';
const samples={traffic:[1000,30,3000,800,30,3000],conversion:[1000,30,3000,1000,24,3000],basket:[1000,30,3000,1000,30,2400]};
const keys=['prev-traffic','prev-conversion','prev-basket','now-traffic','now-conversion','now-basket'];
const money=n=>'NT$ '+Math.round(n).toLocaleString('zh-TW');
function analyze(v,target){
 if(v.length!==6||v.some(n=>!Number.isFinite(n)||n<0)||!Number.isFinite(target)||target<=0||v[1]>100||v[4]>100)throw Error('請確認數字有效，成交率介於 0–100%，目標大於 0。');
 const [t,c,b,T,C,B]=v,prev=t*c/100*b,now=T*C/100*B;
 const effects=[(T-t)*c/100*b,T*(C-c)/100*b,T*C/100*(B-b)];
 const names=['來客數','成交率','客單價'];
 const low=effects.indexOf(Math.min(...effects));
 return {prev,now,effects,names,low,rate:now/target*100,gap:Math.max(0,target-now),hasDrop:effects[low]<-.01};
}
if(typeof module!=='undefined')module.exports={analyze};
if(typeof document!=='undefined'){
 let report='';
 const result=document.getElementById('result');
 const plans=[
 ['先核對人流與營業條件','是否有營業天數、商場活動、天氣或人流計數方式的變化？','店長：今天比對同星期、同時段人流及營業時數。','行銷：本週盤點新客來源，安排一項可追蹤的來客活動。','店長：每日追蹤來客、成交率與活動成本，一週後回看。'],
 ['先觀察接待與商品供應','是否有缺貨、排班變動、促銷結束，或客群結構改變？','店長：今天抽樣記錄未成交原因，先查缺貨與等候時間。','培訓：本週依觀察安排需求探索與異議處理演練。','店長：每日追蹤分時段成交率與未成交原因，一週後回看。'],
 ['先看商品組合與購買件數','是否有折扣、退貨、高單價商品缺貨，或購買組合改變？','店長：今天拆看每單件數、平均單件售價及折扣。','培訓：本週練習依需求推薦搭配，觀察客人接受度。','店長：每日追蹤客單價、毛利與退貨，一週後回看。']
 ];
 function load(name){keys.forEach((k,i)=>document.getElementById(k).value=samples[name][i]);document.getElementById('target').value=1000000;document.querySelectorAll('[data-case]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.case===name)));result.innerHTML='<p class="eyebrow">02 / 從數據到行動</p><h3>案例已載入</h3><p>按下「產出診斷與行動清單」，查看這家店的線索與下一步。</p>';report='';}
 document.querySelectorAll('[data-case]').forEach(b=>b.addEventListener('click',()=>load(b.dataset.case)));
 document.getElementById('metrics').addEventListener('input',()=>{document.querySelectorAll('[data-case]').forEach(b=>b.setAttribute('aria-pressed','false'));result.innerHTML='<h3>數據已更新</h3><p>請重新產出分析，以免使用前一次結果。</p>';report='';});
 document.getElementById('metrics').addEventListener('submit',e=>{
 e.preventDefault();const v=keys.map(k=>Number(document.getElementById(k).value));const target=Number(document.getElementById('target').value);let a;try{a=analyze(v,target)}catch(err){result.textContent=err.message;return;}
 const title=a.hasDrop?plans[a.low][0]:'目前未見負向營收因素';
 const question=a.hasDrop?plans[a.low][1]:'若仍未達標，目標設定、營業時數與人力配置是否合理？';
 const actions=a.hasDrop?plans[a.low].slice(2):['店長：確認本期與前期的期間、統計方式一致。','主管：檢視目標依據與成長條件，避免只以達成率判斷團隊。','團隊：保留有效做法，同步追蹤毛利、退貨與顧客回饋。'];
 const change=a.prev>0?((a.now/a.prev-1)*100).toFixed(1)+'%':'前期營收為 0，不計算成長率';
 const breakdown=a.names.map((n,i)=>n+'變動影響：'+(a.effects[i]>0?'+':'')+money(a.effects[i]));
 result.innerHTML='<p class="eyebrow">02 / 診斷與行動清單</p><h3 id="result-title" tabindex="-1">'+title+'</h3><div class="kpis"><div><span>本期推算營收</span><strong>'+money(a.now)+'</strong></div><div><span>目標達成率</span><strong>'+a.rate.toFixed(1)+'%</strong></div><div><span>距離目標</span><strong>'+money(a.gap)+'</strong></div><div><span>較前期營收</span><strong style="font-size:18px">'+change+'</strong></div></div><div class="evidence"><b>數據線索</b><ul>'+breakdown.map(t=>'<li>'+t+'</li>').join('')+'</ul><p class="small">固定依來客 → 成交 → 客單順序拆解，三項加總等於營收差額；改變順序會改變分配。這是數學拆解，不是因果證明。成交率與客單價若為四捨五入數字，推算營收可能與實收不同。</p></div><h3>下結論前，先確認</h3><p>'+question+'</p>'+(a.prev===0||v[0]===0||v[3]===0?'<p class="evidence">有零值資料：先確認是否停業、尚未開店或漏填。缺失資料不應以 0 代替。</p>':'')+'<h3>接下來一週，做這三件事</h3><ol>'+actions.map(t=>'<li>'+t+'</li>').join('')+'</ol><button class="button export" id="download" type="button">下載行動清單 ↓</button><p class="small">互動模擬結果，供初步討論。營收未包含另行輸入的退貨、稅務或毛利調整。</p>';
 report=['Think BIG｜AI 門市主管・互動模擬',title,'前期：來客 '+v[0]+' / 成交率 '+v[1]+'% / 客單 '+money(v[2]),'本期：來客 '+v[3]+' / 成交率 '+v[4]+'% / 客單 '+money(v[5]),'本期目標：'+money(target),'推算營收：'+money(a.now),'達成率：'+a.rate.toFixed(1)+'%',...breakdown,'待確認：'+question,...actions,'方法：營收＝來客×成交率×客單。固定順序拆解不代表因果；本工具使用預設規則，未呼叫生成式 AI。','https://thinkbigtw.com/experience/retail/'].join('\n');
 document.getElementById('download').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob(['\ufeff'+report],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='ThinkBIG-門市行動清單.txt';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 document.getElementById('result-title').focus({preventScroll:true});
 });load('traffic');
}
