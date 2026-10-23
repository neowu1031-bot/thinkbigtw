(() => {
'use strict';
const roles={
 retail:{name:'AI 門市主管',hello:'嗨，我是你的 AI 門市主管。我們可以一起看 A、B、C 店的示範數據，找出這週先做什麼。你想先看哪家店？',quick:['幫我比較 A／B／C 店','A 店這週先做什麼？','B 店有人來卻沒買，怎麼辦？','C 店客單變小，先看哪裡？']},
 sales:{name:'AI 業務助理',hello:'嗨，我是你的 AI 業務助理。這裡有三位示範潛客的詢價，我可以陪你整理報價重點、寫跟進草稿，也能一起排下次聯絡。先看看誰需要跟進嗎？',quick:['整理三位潛客的需求','幫潛客 B 寫跟進訊息','整理潛客 A 的報價重點','安排下次聯絡建議']},
 service:{name:'AI 客服接待',hello:'嗨，我是你的 AI 客服接待。今天用日常選物示範店練習接待，我可以幫你回商品問題、確認客人需求，再整理預約草稿。這裡不會真的預約，你想先試哪種問題？',quick:['客人問有哪些商品，怎麼回？','店裡幾點營業？','客人想預約，先問什麼？','幫我回覆馬克杯的使用問題']}
};
const $=id=>document.getElementById(id),thread=$('thread');
let role='retail',messages=[],transcript=[],consent=false,pending='',controller=null,epoch=0;
function scroll(){const box=thread.parentElement;box.scrollTop=box.scrollHeight;}
function add(who,content){const at=new Date();transcript.push({role:who,content,time:at.toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false})});const item=document.createElement('article');item.className='chat-message '+who;const bubble=document.createElement('p');bubble.className='bubble';bubble.textContent=content;const time=document.createElement('time');time.dateTime=at.toISOString();time.textContent=(who==='user'?'你':'AI 同事')+' · '+transcript.at(-1).time;item.append(bubble,time);thread.append(item);scroll();}
function renderTool(step){
 const body=document.createElement('div'),r=step.result;
 const text=value=>typeof value==='string'||typeof value==='number'?String(value):'未提供';
 const line=(label,value)=>{const p=document.createElement('p');p.textContent=label+'：'+text(value);body.append(p);};
 const rows=items=>{const table=document.createElement('table');items.forEach(([label,value])=>{const tr=document.createElement('tr'),th=document.createElement('th'),td=document.createElement('td');th.scope='row';th.textContent=label;td.textContent=text(value);tr.append(th,td);table.append(tr);});body.append(table);};
 const data=r&&typeof r==='object'?r:{};
 switch(step.name){
 case 'draft_followup': line('收件人',data.lead);line('草稿',data.draft);line('狀態','示範，不會寄出');break;
 case 'schedule_contact': line('日期時間',data.slot);line('對象',data.lead);line('事項','聯絡跟進');line('提醒',data.notice);break;
 case 'weekly_tasks': if(Array.isArray(r))r.forEach(item=>{if(!item||typeof item!=='object')return;const label=document.createElement('label'),check=document.createElement('input'),span=document.createElement('span');check.type='checkbox';span.textContent=text(item.task)+'（'+text(item.owner)+'／追蹤：'+text(item.metric)+'）';label.append(check,span);body.append(label);});break;
 case 'store_data': {
 line('門市',data.store);const m=Array.isArray(data.metrics)?data.metrics:[];rows([['指標','前期 → 本期'],['來客數',text(m[0])+' → '+text(m[3])],['成交率',text(m[1])+'% → '+text(m[4])+'%'],['客單價',text(m[2])+' → '+text(m[5])]]);line('說明','等長兩期，金額為新台幣');break;}
 case 'revenue_breakdown': rows([['前期推算營收',data.previousRevenue],['本期推算營收',data.revenue],['目標',data.target],['達成率（%）',typeof data.achievementPercent==='number'?data.achievementPercent.toFixed(1):undefined],['目標差距',data.gap],['來客變動影響',data.effects?.traffic],['成交變動影響',data.effects?.conversion],['客單變動影響',data.effects?.basket]]);line('說明','金額為新台幣；推算值與變動拆解不代表因果');break;
 case 'lead_data': rows([['對象',data.name],['公司',data.company],['稱呼',data.contact],['詢價',data.inquiry],['目前狀態',data.status],['下一步',data.next]]);break;
 case 'booking_draft': line('時間',data.slot);line('人數',data.people);line('品項','到店商品諮詢（30 分鐘）');line('提醒',data.notice);break;
 case 'product_hours': if(Array.isArray(r))r.forEach(item=>{if(item&&typeof item==='object')line(text(item.name),item.info);});else line('營業時間',data.hours);break;
 case 'available_slots': line('可選時段',Array.isArray(data.slots)?data.slots.filter(x=>typeof x==='string').join('、'):undefined);line('提醒',data.notice);break;
 default: line('摘要','示範步驟已整理，請參考同事回覆。');
 }
 return body;
}
function addSteps(steps){
 if(!Array.isArray(steps))return;
 steps.slice(0,3).forEach(step=>{
  if(!step||typeof step.title!=='string'||typeof step.action!=='string')return;
  const card=document.createElement('details');card.className='tool-step';
  card.open=['draft_followup','booking_draft','schedule_contact','weekly_tasks'].includes(step.name);
  const summary=document.createElement('summary');summary.textContent=step.title;
  const result=renderTool(step);card.append(summary,result);thread.append(card);
  transcript.push({role:'assistant',content:step.title+'\n'+result.textContent,time:new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false})});
 });scroll();
}
function resizeInput(){const input=$('message');input.style.height='auto';input.style.height=Math.min(input.scrollHeight,104)+'px';}
function busy(value){$('send').disabled=value;document.querySelectorAll('#quick button').forEach(b=>b.disabled=value);$('typing').hidden=!value;}
function reset(){epoch++;controller?.abort();controller=null;messages=[];transcript=[];pending='';thread.replaceChildren();$('consent-card').hidden=true;$('chat-status').textContent='';$('message').value='';resizeInput();busy(false);add('assistant',roles[role].hello);}
function open(selected){role=selected;$('chooser').hidden=true;$('chat').hidden=false;document.body.classList.add('chat-open');$('employee-name').textContent=roles[role].name;$('retail-link').hidden=role!=='retail';$('quick').replaceChildren();roles[role].quick.forEach(text=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',()=>offer(text));$('quick').append(b);});reset();$('chat-title').focus();}
function offer(text){if(controller||pending)return;text=text.trim();if(!text)return;if(text.length>1200){$('chat-status').textContent='訊息請控制在 1200 字內。';return;}if(!consent){pending=text;$('consent-card').hidden=false;scroll();$('agree').focus();return;}send(text);}
async function send(text){
 const history=[...messages,{role:'user',content:text}];
 if(history.length>10||history.reduce((n,m)=>n+m.content.length,0)>6000){$('chat-status').textContent='這段聊得很完整了，請先下載，再按「重新聊」繼續。';return;}
 const turn=epoch,active=new AbortController();controller=active;busy(true);$('chat-status').textContent='';add('user',text);$('message').value='';resizeInput();scroll();const timer=setTimeout(()=>active.abort(),25000);
 try{const response=await fetch('https://moneyradar-ai-proxy.thinkbigtw.workers.dev/thinkbig-experience',{method:'POST',headers:{'Content-Type':'application/json'},signal:active.signal,body:JSON.stringify({role,messages:history,consent:true})});if(!response.ok)throw Error(response.status===429?'rate':'offline');const data=await response.json();if(data.mode!=='live-ai'||typeof data.reply!=='string'||!data.reply.trim()||data.reply.length>1600)throw Error('offline');if(turn!==epoch)return;messages=[...history,{role:'assistant',content:data.reply}];addSteps(data.steps);add('assistant',data.reply);
 }catch(error){if(turn!==epoch)return;$('chat-status').textContent=error.message==='rate'?'現在有點忙，請稍後再送一次。':'暫時連不上 AI，這則沒有取得回覆。請稍後再送一次。';$('message').value=text;resizeInput();
 }finally{clearTimeout(timer);if(turn===epoch){controller=null;busy(false);}}
}
document.querySelectorAll('[data-role]').forEach(b=>b.addEventListener('click',()=>open(b.dataset.role)));
$('chat-theme').addEventListener('change',()=>{$('chat').dataset.theme=$('chat-theme').value;});
$('message').addEventListener('input',resizeInput);
$('back').addEventListener('click',()=>{reset();$('chat').hidden=true;$('chooser').hidden=false;document.body.classList.remove('chat-open');document.querySelector(`[data-role="${role}"]`).focus();});
$('reset-chat').addEventListener('click',()=>{reset();$('message').focus();});
$('chat-form').addEventListener('submit',e=>{e.preventDefault();offer($('message').value);});
$('agree').addEventListener('click',()=>{consent=true;const text=pending;pending='';$('consent-card').hidden=true;send(text);$('message').focus();});
$('cancel-consent').addEventListener('click',()=>{$('message').value=pending;resizeInput();pending='';$('consent-card').hidden=true;$('message').focus();});
$('export-chat').addEventListener('click',()=>{const e=escapeReportHTML;const content=reportDocument('對話紀錄',`<h1>${e(roles[role].name)}・對話紀錄</h1><p>示範資料；AI 建議請再核對。未發送訊息或完成預約。</p>${transcript.map(m=>`<section class="card"><p class="label">${e(m.role==='user'?'你':'AI 同事')} · ${e(m.time)}</p><p class="message">${e(m.content)}</p></section>`).join('')}`,undefined,roles[role].name+'・聊天示範','/experience/');const url=URL.createObjectURL(new Blob([content],{type:'text/html;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='ThinkBIG-對話紀錄.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
})();
