(() => {
'use strict';
const roles={
 marketing:{"name":"AI 行銷企劃","hello":"嗨，我是你的AI 行銷企劃。這裡用大想成業（Think BIG；示範資料，人名與數字皆為虛構）的資料，看活動成效，寫貼文草稿與內容日曆。所有內容只供示範，草稿請同事覆核。想先試哪一項？","quick":["查活動成效","擬社群貼文草稿","排內容日曆"]},
 media:{"name":"AI 影音企劃","hello":"嗨，我是你的AI 影音企劃。這裡用大想成業（Think BIG；示範資料，人名與數字皆為虛構）的資料，整理短影音分鏡、標題與發片時程。所有內容只供示範，草稿請同事覆核。想先試哪一項？","quick":["擬短影音腳本","建議標題與封面字","排發片時程"]},
 accounting:{"name":"AI 會計助理","hello":"嗨，我是你的AI 會計助理。這裡用大想成業（Think BIG；示範資料，人名與數字皆為虛構）的資料，核對帳款差異，整理請款與月報。所有內容只供示範，草稿請同事覆核。想先試哪一項？","quick":["對帳找差異","整理待請款清單","月報摘要"]},
 admin:{"name":"AI 行政助理","hello":"嗨，我是你的AI 行政助理。這裡用大想成業（Think BIG；示範資料，人名與數字皆為虛構）的資料，整理會議待辦、會議室草稿與採購。所有內容只供示範，草稿請同事覆核。想先試哪一項？","quick":["整理會議重點與待辦","訂會議室草稿","整理採購清單"]},
 training:{"name":"AI 訓練專員","hello":"嗨，我是你的AI 訓練專員。這裡用大想成業（Think BIG；示範資料，人名與數字皆為虛構）的資料，準備新人清單、小測驗與 SOP。所有內容只供示範，草稿請同事覆核。想先試哪一項？","quick":["整理新人到職訓練清單","出 5 題小測驗","整理 SOP 步驟"]},
 research:{"name":"AI 市調分析師","hello":"嗨，我是你的AI 市調分析師。這裡用大想成業（Think BIG；示範資料，人名與數字皆為虛構）的資料，用虛構資料比較競品、評論與市場假設。所有內容只供示範，草稿請同事覆核。想先試哪一項？","quick":["整理競品資料表","歸納顧客評論重點","列可驗證的市場假設"]},
 retail:{name:'AI 門市主管',hello:'嗨，我是你的 AI 門市主管。這裡是大想成業（Think BIG）的示範資料，人名與數字皆為虛構。我們可以一起看 A、B、C 店的示範數據，找出這週先做什麼。你想先看哪家店？',quick:['幫我比較 A／B／C 店','A 店這週先做什麼？','B 店有人來卻沒買，怎麼辦？','C 店客單變小，先看哪裡？']},
 sales:{name:'AI 業務助理',hello:'嗨，我是你的 AI 業務助理。這裡是大想成業（Think BIG）的示範資料，人名與數字皆為虛構。這裡有三位示範潛客的詢價，我可以陪你整理報價重點、寫跟進草稿，也能一起排下次聯絡。先看看誰需要跟進嗎？',quick:['整理三位潛客的需求','幫潛客 B 寫跟進訊息','整理潛客 A 的報價重點','安排下次聯絡建議']},
 service:{name:'AI 客服接待',hello:'嗨，我是你的 AI 客服接待。今天用大想成業示範店練習接待。示範資料，人名與數字皆為虛構，我可以幫你回商品問題、確認客人需求，再整理預約草稿。這裡不會真的預約，你想先試哪種問題？',quick:['客人問有哪些商品，怎麼回？','店裡幾點營業？','客人想預約，先問什麼？','幫我回覆馬克杯的使用問題']}
};
const $=id=>document.getElementById(id),thread=$('thread');
let role='retail',messages=[],transcript=[],consent=false,pending='',controller=null,epoch=0;
const quotaKey='thinkbig-experience-quota';
let quota={date:'',count:0},storageFailed=false;
function today(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
function used(){
 const date=today();if(quota.date!==date)quota={date,count:0};
 if(!storageFailed)try{const saved=JSON.parse(localStorage.getItem(quotaKey));if(saved?.date===date&&Number.isInteger(saved.count)&&saved.count>=0)quota.count=Math.max(quota.count,Math.min(5,saved.count));}catch{storageFailed=true;}
 return quota.count;
}
function saveQuota(count){quota={date:today(),count};try{localStorage.setItem(quotaKey,JSON.stringify(quota));}catch{storageFailed=true;}}
function showCTA(){
 if(thread.querySelector('.experience-cta'))return;
 const card=document.createElement('article'),title=document.createElement('h3'),body=document.createElement('p'),links=document.createElement('div');
 card.className='experience-cta';title.textContent='感謝您的體驗！';body.textContent='現在就預約，讓我們為您個人／企業搭建一個專屬的 AI Agent 吧';
 for(const [label,url] of [['預約諮詢','/contact/'],['LINE 洽詢','https://lin.ee/n5KW430']]){const a=document.createElement('a');a.textContent=label;a.href=url;if(label==='LINE 洽詢'){a.target='_blank';a.rel='noopener noreferrer';}links.append(a);}
 card.append(title,body,links);thread.append(card);scroll();
}
function updateQuota(){
 const count=used(),exhausted=count>=5;
 $('quota-remaining').textContent='每段對話最多 5 題（前端每日計數）；還可以問 '+(5-count)+' 題';
 $('message').disabled=exhausted;$('message').placeholder=exhausted?'本次體驗額度已用完':'想請同事幫什麼忙？';
 $('send').disabled=!!controller||exhausted;document.querySelectorAll('#quick button').forEach(b=>b.disabled=!!controller||exhausted);
 if(exhausted&&!controller){$('chat-status').textContent='本次體驗額度已用完';showCTA();}
}
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
 case 'campaign_results':
 case 'reconcile_accounts':
 case 'monthly_summary':
 case 'competitor_table':
 case 'review_themes': {
 const items=Array.isArray(data.rows)?data.rows.filter(row=>Array.isArray(row)&&row.length===2):[];
 rows(items.map(([label,value])=>[text(label),value]));
 break;
 }
 case 'social_draft':
 case 'video_titles':
 case 'meeting_room': {
 const items=Array.isArray(data.rows)?data.rows.filter(row=>Array.isArray(row)&&row.length===2):[];
 body.className='artifact-draft';items.forEach(([label,value])=>line(text(label),value));
 break;
 }
 case 'content_calendar':
 case 'release_schedule': {
 const items=Array.isArray(data.rows)?data.rows.filter(row=>Array.isArray(row)&&row.length===2):[];
 body.className='artifact-calendar';items.forEach(([label,value])=>line(text(label),value));
 break;
 }
 case 'video_script':
 case 'sop_steps':
 case 'training_quiz': {
 const items=Array.isArray(data.rows)?data.rows.filter(row=>Array.isArray(row)&&row.length===2):[];
 const list=document.createElement('ol');items.forEach(([label,value])=>{const item=document.createElement('li');item.textContent=text(label)+'：'+text(value);list.append(item);});body.append(list);
 break;
 }
 case 'payment_list':
 case 'meeting_notes':
 case 'purchase_list':
 case 'onboarding_list':
 case 'market_hypotheses': {
 const items=Array.isArray(data.rows)?data.rows.filter(row=>Array.isArray(row)&&row.length===2):[];
 items.forEach(([label,value])=>{const item=document.createElement('label'),check=document.createElement('input'),span=document.createElement('span');check.type='checkbox';span.textContent=text(label)+'：'+text(value);item.append(check,span);body.append(item);});
 break;
 }
 default: line('摘要','示範步驟已整理，請參考同事回覆。');
 }
 return body;
}
function addSteps(steps){
 if(!Array.isArray(steps))return;
 steps.slice(0,3).forEach(step=>{
  if(!step||typeof step.title!=='string'||typeof step.action!=='string')return;
  const card=document.createElement('details');card.className='tool-step';
  card.open=['campaign_results','social_draft','content_calendar','video_script','video_titles','release_schedule','reconcile_accounts','payment_list','monthly_summary','meeting_notes','meeting_room','purchase_list','onboarding_list','training_quiz','sop_steps','competitor_table','review_themes','market_hypotheses','draft_followup','booking_draft','schedule_contact','weekly_tasks'].includes(step.name);
  const summary=document.createElement('summary');summary.textContent=step.title;
  const result=renderTool(step);card.append(summary,result);thread.append(card);
  transcript.push({role:'assistant',content:step.title+'\n'+result.textContent,time:new Date().toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',hour12:false})});
 });scroll();
}
function resizeInput(){const input=$('message');input.style.height='auto';input.style.height=Math.min(input.scrollHeight,104)+'px';}
function busy(value){$('send').disabled=value;document.querySelectorAll('#quick button').forEach(b=>b.disabled=value);$('typing').hidden=!value;updateQuota();}
function reset(){epoch++;controller?.abort();controller=null;messages=[];transcript=[];pending='';thread.replaceChildren();$('consent-card').hidden=true;$('chat-status').textContent='';$('message').value='';resizeInput();busy(false);add('assistant',roles[role].hello);updateQuota();}
function open(selected){role=selected;$('chooser').hidden=true;$('chat').hidden=false;document.body.classList.add('chat-open');$('employee-name').textContent=roles[role].name;$('retail-link').hidden=role!=='retail';$('quick').replaceChildren();roles[role].quick.forEach(text=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',()=>offer(text));$('quick').append(b);});reset();$('chat-title').focus();}
function offer(text){updateQuota();if(used()>=5||controller||pending)return;text=text.trim();if(!text)return;if(text.length>1200){$('chat-status').textContent='訊息請控制在 1200 字內。';return;}if(!consent){pending=text;$('consent-card').hidden=false;scroll();$('agree').focus();return;}send(text);}
async function send(text){
 if(!text||controller)return;updateQuota();if(used()>=5)return;
 const history=[...messages,{role:'user',content:text}];
 if(history.length>10||history.reduce((n,m)=>n+m.content.length,0)>6000){$('chat-status').textContent='這段聊得很完整了，請先下載，再按「重新聊」繼續。';return;}
 saveQuota(used()+1);
 const turn=epoch,active=new AbortController();controller=active;busy(true);$('chat-status').textContent='';add('user',text);$('message').value='';resizeInput();scroll();const timer=setTimeout(()=>active.abort(),25000);
 try{const response=await fetch('https://moneyradar-ai-proxy.thinkbigtw.workers.dev/thinkbig-experience',{method:'POST',headers:{'Content-Type':'application/json'},signal:active.signal,body:JSON.stringify({role,messages:history,consent:true})});const data=await response.json();if(!response.ok){if(data.error==='demo_limit'){if(turn!==epoch)return;saveQuota(5);showCTA();throw Error('demo_limit');}throw Error(response.status===429?'rate':'offline');}if(data.mode!=='live-ai'||typeof data.reply!=='string'||!data.reply.trim()||data.reply.length>1600)throw Error('offline');if(turn!==epoch)return;messages=[...history,{role:'assistant',content:data.reply}];addSteps(data.steps);add('assistant',data.reply);
 }catch(error){if(turn!==epoch)return;$('chat-status').textContent=error.message==='rate'?'現在有點忙，請稍後再送一次。':'暫時連不上 AI，這則沒有取得回覆。請稍後再送一次。';if(error.message!=='demo_limit')$('message').value=text;resizeInput();
 }finally{clearTimeout(timer);if(turn===epoch){controller=null;busy(false);}}
}
updateQuota();
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
