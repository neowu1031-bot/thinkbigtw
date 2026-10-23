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
// Downloaded documents are inert, self-contained HTML. Escape every dynamic text value.
function escapeReportHTML(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function reportDocument(title,content,date=new Date().toLocaleDateString('zh-TW')){
 return `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeReportHTML(title)}｜Think BIG</title><style>
:root{--pink:#c24870;--accent:#a55270;--ink:#252629;--paper:#f7f6f2}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Noto Sans TC","Microsoft JhengHei",sans-serif;font-size:14px;line-height:1.65}main{max-width:790px;margin:32px auto;padding:32px;background:white;border-radius:12px}header{border-bottom:2px solid var(--pink);padding-bottom:16px;margin-bottom:22px}header strong{color:var(--accent)}header p{margin:4px 0;color:#68646a;font-size:12px}h1{font-size:27px;line-height:1.35;letter-spacing:-.03em;margin:0 0 20px}h2{font-size:17px;margin:22px 0 10px}p{margin:8px 0}.card{border:1px solid #e1dcde;border-radius:8px;padding:14px 18px;margin:10px 0;break-inside:avoid;page-break-inside:avoid}.tint{background:#f7f0f3}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:14px}.metrics span{display:block;font-size:12px;color:#68646a}.metrics strong{font-size:17px;font-variant-numeric:tabular-nums}table{width:100%;border-collapse:collapse;text-align:left;font-variant-numeric:tabular-nums}th,td{padding:7px 4px;border-bottom:1px solid #e1dcde}th{font-size:12px}td,th{overflow-wrap:anywhere}.effects{display:flex;flex-wrap:wrap;gap:12px}.effects p{flex:1;min-width:140px}.effects strong{display:block}.positive{color:#22634b}.negative{color:#a03350}.neutral{color:#625a60}ol{padding-left:24px}li{padding:5px 0;break-inside:avoid}.small,footer{font-size:11px;color:#68646a}footer{border-top:1px solid #e1dcde;padding-top:14px;margin-top:22px}.message{white-space:pre-wrap;overflow-wrap:anywhere}.label{font-size:12px;color:var(--accent);font-weight:700}h1,p,strong,li{overflow-wrap:anywhere}@page{size:A4 portrait;margin:14mm}@media(max-width:600px){main{margin:0;padding:24px 16px;border-radius:0}.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}h1{font-size:24px}body{font-size:13px}}@media print{body,main{background:white}body{font-size:10pt}main{max-width:none;margin:0;padding:0;border-radius:0}h1{font-size:21pt}h2{break-after:avoid}.card{padding:10px 14px}.metrics strong{font-size:13pt}header{margin-bottom:16px}footer{font-size:9pt}.tint{background:white}}
</style></head><body><main><header><strong>Think BIG｜AI 門市主管・互動模擬</strong><p>產出日期：${escapeReportHTML(date)}</p></header>${content}<footer>https://thinkbigtw.com/experience/retail/<br>互動模擬結果，供初步討論</footer></main></body></html>`;
}
function actionReport({v,target,a,title,question,actions,date}){
 const e=escapeReportHTML;
 const row=(label,x,y)=>`<tr><th scope="row">${e(label)}</th><td>${e(x)}</td><td>${e(y)}</td></tr>`;
 const stats=[['本期目標',money(target)],['本期推算營收',money(a.now)],['目標達成率',a.rate.toFixed(1)+'%'],['與目標差距',money(a.gap)]];
 return reportDocument('門市行動清單',`<h1>${e(title)}</h1><section class="card"><h2>兩期營運數據</h2><table><thead><tr><th>指標</th><th>前期</th><th>本期</th></tr></thead><tbody>${row('來客數',v[0],v[3])}${row('成交率',v[1]+'%',v[4]+'%')}${row('客單價',money(v[2]),money(v[5]))}</tbody></table><div class="metrics">${stats.map(([label,value])=>`<div><span>${e(label)}</span><strong>${e(value)}</strong></div>`).join('')}</div></section><section class="card tint"><h2>營收變動拆解</h2><div class="effects">${a.effects.map((n,i)=>`<p>${e(a.names[i])}影響<strong class="${n>0?'positive':n<0?'negative':'neutral'}">${e((n>0?'+':n<0?'−':'±')+money(Math.abs(n)))}</strong></p>`).join('')}</div></section><section class="card"><h2>下結論前，先確認</h2><p>${e(question)}</p>${a.prev===0||v[0]===0||v[3]===0?'<p>有零值資料：先確認是否停業、尚未開店或漏填。缺失資料不應以 0 代替。</p>':''}</section><section class="card"><h2>本週三項行動</h2><ol>${actions.map(text=>{const i=text.indexOf('：');return `<li>${i<0?e(text):`<strong>${e(text.slice(0,i))}</strong>：${e(text.slice(i+1))}`}</li>`}).join('')}</ol></section><p class="small">方法：營收＝來客數 × 成交率 × 客單價。固定依來客 → 成交 → 客單順序拆解，三項加總等於營收差額；改變順序會改變分配。這是數學拆解，不是因果證明。成交率與客單若經四捨五入，推算營收可能與實收不同。兩期應等長，營收未另行調整退貨、稅務或毛利。本清單使用預設規則，未呼叫生成式 AI。</p>`,date);
}
function discussionReport(messages,date){
 const e=escapeReportHTML;
 return reportDocument('AI 討論紀錄',`<h1>AI 討論紀錄</h1><p class="label">AI 建議・待主管覆核</p>${messages.map((m,i)=>i%2===0?`<section class="card"><p class="label">你的問題</p><p class="message">${e(m.content)}</p>${messages[i+1]?`<p class="label">AI 建議</p><p class="message">${e(messages[i+1].content)}</p>`:''}</section>`:'').join('')}`,date);
}
if(typeof module!=='undefined')module.exports={analyze,actionReport,discussionReport,escapeReportHTML};
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
 report=actionReport({v,target,a,title,question,actions});
 document.getElementById('download').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([report],{type:'text/html;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='ThinkBIG-門市行動清單.html';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 document.getElementById('result-title').focus({preventScroll:true});
 });load('traffic');
}
