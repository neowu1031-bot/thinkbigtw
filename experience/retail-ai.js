(() => {
'use strict';
const endpoint='https://moneyradar-ai-proxy.thinkbigtw.workers.dev/thinkbig-retail';
const form=document.getElementById('ai-form'), status=document.getElementById('ai-status'), thread=document.getElementById('ai-thread'), question=document.getElementById('ai-question'), send=document.getElementById('ai-send'), download=document.getElementById('ai-export');
const keys=['prev-traffic','prev-conversion','prev-basket','now-traffic','now-conversion','now-basket'];
let history=[],controller=null,epoch=0;
function reset(){epoch++;controller?.abort();controller=null;history=[];thread.replaceChildren();download.hidden=true;send.disabled=false;status.textContent='對話已清除；下次將使用目前的門市數據。';}
function add(role,text){const box=document.createElement('article');box.className='ai-message';const label=document.createElement('strong');label.textContent=role==='user'?'你的問題':'AI 建議・待覆核';const p=document.createElement('p');p.textContent=text;box.append(label,p);thread.append(box);}
form.addEventListener('submit',async e=>{
 e.preventDefault();if(controller)return;
 if(!document.getElementById('metrics').reportValidity())return;
 if(!document.getElementById('ai-consent').checked)return;
 if(history.length>=10){status.textContent='本次體驗已達 5 輪，請清除對話後重新開始。';return;}
 const text=question.value.trim();if(!text)return;
 const pending=[...history,{role:'user',content:text}];if(text.length>1200||pending.reduce((n,m)=>n+m.content.length,0)>18000){status.textContent='訊息請控制在 1200 字內，累計對話最多 18000 字。';return;}const myEpoch=epoch;controller=new AbortController();const active=controller;const timer=setTimeout(()=>active.abort(),25000);send.disabled=true;status.textContent='AI 正在參考數據，整理分析與下一步…';
 try{const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},signal:active.signal,body:JSON.stringify({metrics:keys.map(k=>Number(document.getElementById(k).value)),target:Number(document.getElementById('target').value),messages:pending,consent:true})});
 if(!response.ok)throw new Error(response.status===429?'rate_limited':'unavailable');
 const data=await response.json();if(typeof data.reply!=='string'||data.reply.length>2400||data.mode!=='live-ai')throw new Error('unavailable');if(epoch!==myEpoch)return;
 history=[...pending,{role:'assistant',content:data.reply.slice(0,2400)}];add('user',text);add('assistant',data.reply);question.value='';download.hidden=false;status.textContent='AI 已回覆。可補充情況繼續追問；建議仍需由主管核對。';
 }catch(error){if(epoch!==myEpoch)return;status.textContent=error.message==='rate_limited'?'目前使用較頻繁，請稍後再試。':'目前無法連上 AI 服務，未產生 AI 回答。你仍可使用上方的本機數據拆解，或稍後重試。';}
 finally{clearTimeout(timer);if(epoch===myEpoch){controller=null;send.disabled=false;}}
});
document.getElementById('ai-reset').addEventListener('click',reset);
document.getElementById('ai-consent').addEventListener('change',e=>{if(!e.target.checked)reset();});
document.getElementById('metrics').addEventListener('input',reset);
document.querySelectorAll('[data-case]').forEach(b=>b.addEventListener('click',reset));
download.addEventListener('click',()=>{const content=discussionReport(Array.from(thread.querySelectorAll('.ai-message p'),p=>({content:p.textContent}))); const url=URL.createObjectURL(new Blob([content],{type:'text/html;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='ThinkBIG-AI討論紀錄.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
})();
