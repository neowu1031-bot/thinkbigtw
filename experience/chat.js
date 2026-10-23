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
function busy(value){$('send').disabled=value;document.querySelectorAll('#quick button').forEach(b=>b.disabled=value);$('typing').hidden=!value;}
function reset(){epoch++;controller?.abort();controller=null;messages=[];transcript=[];pending='';thread.replaceChildren();$('consent-card').hidden=true;$('chat-status').textContent='';$('message').value='';busy(false);add('assistant',roles[role].hello);}
function open(selected){role=selected;$('chooser').hidden=true;$('chat').hidden=false;document.body.classList.add('chat-open');$('employee-name').textContent=roles[role].name;$('retail-link').hidden=role!=='retail';$('quick').replaceChildren();roles[role].quick.forEach(text=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.addEventListener('click',()=>offer(text));$('quick').append(b);});reset();$('chat-title').focus();}
function offer(text){if(controller||pending)return;text=text.trim();if(!text)return;if(text.length>1200){$('chat-status').textContent='訊息請控制在 1200 字內。';return;}if(!consent){pending=text;$('consent-card').hidden=false;scroll();$('agree').focus();return;}send(text);}
async function send(text){
 const history=[...messages,{role:'user',content:text}];
 if(history.length>10||history.reduce((n,m)=>n+m.content.length,0)>6000){$('chat-status').textContent='這段聊得很完整了，請先下載，再按「重新聊」繼續。';return;}
 const turn=epoch,active=new AbortController();controller=active;busy(true);$('chat-status').textContent='';add('user',text);$('message').value='';scroll();const timer=setTimeout(()=>active.abort(),25000);
 try{const response=await fetch('https://moneyradar-ai-proxy.thinkbigtw.workers.dev/thinkbig-experience',{method:'POST',headers:{'Content-Type':'application/json'},signal:active.signal,body:JSON.stringify({role,messages:history,consent:true})});if(!response.ok)throw Error(response.status===429?'rate':'offline');const data=await response.json();if(data.mode!=='live-ai'||typeof data.reply!=='string'||!data.reply.trim()||data.reply.length>1600)throw Error('offline');if(turn!==epoch)return;messages=[...history,{role:'assistant',content:data.reply}];add('assistant',data.reply);
 }catch(error){if(turn!==epoch)return;$('chat-status').textContent=error.message==='rate'?'現在有點忙，請稍後再送一次。':'暫時連不上 AI，這則沒有取得回覆。請稍後再送一次。';$('message').value=text;
 }finally{clearTimeout(timer);if(turn===epoch){controller=null;busy(false);}}
}
document.querySelectorAll('[data-role]').forEach(b=>b.addEventListener('click',()=>open(b.dataset.role)));
document.querySelectorAll('[data-theme]').forEach(b=>b.addEventListener('click',()=>{$('chat').dataset.theme=b.dataset.theme;document.querySelectorAll('[data-theme]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));}));
$('back').addEventListener('click',()=>{reset();$('chat').hidden=true;$('chooser').hidden=false;document.body.classList.remove('chat-open');document.querySelector(`[data-role="${role}"]`).focus();});
$('reset-chat').addEventListener('click',()=>{reset();$('message').focus();});
$('chat-form').addEventListener('submit',e=>{e.preventDefault();offer($('message').value);});
$('agree').addEventListener('click',()=>{consent=true;const text=pending;pending='';$('consent-card').hidden=true;send(text);$('message').focus();});
$('cancel-consent').addEventListener('click',()=>{$('message').value=pending;pending='';$('consent-card').hidden=true;$('message').focus();});
$('export-chat').addEventListener('click',()=>{const e=escapeReportHTML;const content=reportDocument('對話紀錄',`<h1>${e(roles[role].name)}・對話紀錄</h1><p>示範資料；AI 建議請再核對。未發送訊息或完成預約。</p>${transcript.map(m=>`<section class="card"><p class="label">${e(m.role==='user'?'你':'AI 同事')} · ${e(m.time)}</p><p class="message">${e(m.content)}</p></section>`).join('')}`,undefined,roles[role].name+'・聊天示範','/experience/');const url=URL.createObjectURL(new Blob([content],{type:'text/html;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='ThinkBIG-對話紀錄.html';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
})();
