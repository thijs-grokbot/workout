'use strict';
const CFG = Object.assign({}, window.CONFIG || {}, (()=>{try{return JSON.parse(localStorage.getItem('cfg')||'{}')}catch(e){return {}}})());
const $ = s => document.querySelector(s), app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const LS = { get:(k,d)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}}, set:(k,v)=>localStorage.setItem(k,JSON.stringify(v)) };
const pad = n => String(n).padStart(2,'0');
const ymd = d => d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const today = () => ymd(new Date());
const fmt = s => { s=Math.max(0,Math.round(s)); return Math.floor(s/60)+':'+pad(s%60); };
const TYPES = {strength:'Kracht',home:'Thuis',run_z2:'Zone 2',run_tempo:'Tempo-intervallen',rest:'Rust'};
const DAYS = ['ma','di','wo','do','vr','za','zo'];
function isoWeek(ds){const d=new Date(ds+'T12:00');const t=new Date(d);t.setDate(d.getDate()+3-(d.getDay()+6)%7);const y=t.getFullYear();const w1=new Date(y,0,4);return y+'-W'+pad(1+Math.round(((t-w1)/864e5-3+(w1.getDay()+6)%7)/7))}

/* ---------- plan ---------- */
let PLAN = LS.get('plan', []);
async function loadPlan(){
  try{
    let url, data;
    if(CFG.API_URL){
      const f=new Date(),t=new Date(); f.setDate(f.getDate()-(CFG.PLAN_DAYS_BACK||14)); t.setDate(t.getDate()+(CFG.PLAN_DAYS_AHEAD||28));
      url=CFG.API_URL+'?action=plan&from='+ymd(f)+'&to='+ymd(t)+'&token='+encodeURIComponent(CFG.TOKEN||'');
    } else url='workouts.json?'+Date.now();
    const r=await fetch(url,{cache:'no-store'}); data=await r.json();
    if(data && data.error) throw new Error(data.error);
    const arr=Array.isArray(data)?data:(data.workouts||[]);
    if(arr.length){PLAN=arr.sort((a,b)=>a.date.localeCompare(b.date)); LS.set('plan',PLAN); LS.set('planAt',Date.now());}
  }catch(e){ console.warn('plan offline, cache gebruikt',e); }
  route();
}
const byId = id => PLAN.find(w=>w.id===id);

/* ---------- logs (Mike's log-object) ---------- */
const logKey = id => 'log:'+id;
function getLog(w){
  let l=LS.get(logKey(w.id));
  if(!l){ l={workout_id:w.id,date:w.date,status:'',sets:[],rpe:null,feedback:{},run:{},notes:'',skipped_reason:''}; }
  // zorg dat alle sets bestaan
  (w.blocks||[]).forEach((b,bi)=>{ const R=isMain(b)?(w.rounds||1):1;
    b.items.forEach((it,ii)=>{ for(let r=1;r<=R;r++){ if(!l.sets.find(s=>s.block===b.name&&s.exercise===it.exercise&&s.round===r))
      l.sets.push({round:r,block:b.name,exercise:it.exercise,reps_done:it.reps??'',load_done:it.load_default??(it.load_range?it.load_range[0]:null),load_unit:it.load_unit||'',done:false}); }});});
  return l;
}
const isMain = b => /hoofd/i.test(b.name);
function saveLog(l,sync=true){ l.updated_at=new Date().toISOString(); LS.set(logKey(l.workout_id),l);
  if(sync){ const q=new Set(LS.get('queue',[])); q.add(l.workout_id); LS.set('queue',[...q]); flush(); } }
const allLogs = () => Object.keys(localStorage).filter(k=>k.startsWith('log:')).map(k=>LS.get(k)).filter(Boolean);

/* ---------- sync-wachtrij: hele log-object, idempotent (overschrijft op server) ---------- */
let flushing=false;
async function flush(){
  const q=LS.get('queue',[]); syncLabel();
  if(!CFG.API_URL||flushing||!q.length||!navigator.onLine) return;
  flushing=true;
  for(const id of q){
    const l=LS.get(logKey(id)); if(!l) continue;
    try{
      const r=await fetch(CFG.API_URL,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'log',token:CFG.TOKEN,log:l})});
      const j=await r.json(); if(!j.ok) throw new Error(j.error||'sync mislukt');
      if((LS.get(logKey(id))||{}).updated_at===l.updated_at) LS.set('queue',LS.get('queue',[]).filter(x=>x!==id));
    }catch(e){ console.warn(e); break; }
  }
  flushing=false; syncLabel();
}
function syncLabel(){ const n=LS.get('queue',[]).length; $('#sync').textContent=!CFG.API_URL?'lokaal':(n?('⏳ '+n+' te syncen'):'✓ gesynct'); }
addEventListener('online',flush); setInterval(flush,30000); document.addEventListener('visibilitychange',()=>{if(!document.hidden)flush()});

/* ---------- audio / signaal / wake lock ---------- */
let AC=null;
function unlockAudio(){ try{ if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)(); if(AC.state==='suspended')AC.resume();
  const o=AC.createOscillator(),g=AC.createGain();g.gain.value=0.0001;o.connect(g).connect(AC.destination);o.start();o.stop(AC.currentTime+.01);}catch(e){} }
document.addEventListener('touchend',unlockAudio,{passive:true}); document.addEventListener('click',unlockAudio);
function beep(n=3,f=880){ try{ if(AC){ if(AC.state==='suspended')AC.resume(); for(let i=0;i<n;i++){const o=AC.createOscillator(),g=AC.createGain();o.frequency.value=f;o.connect(g).connect(AC.destination);
  const t=AC.currentTime+i*.35;g.gain.setValueAtTime(.5,t);g.gain.exponentialRampToValueAtTime(.001,t+.3);o.start(t);o.stop(t+.3);} } }catch(e){}
  try{ navigator.vibrate&&navigator.vibrate([400,200,400]); }catch(e){} }
function flash(el){ el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
let WL=null; async function wake(){ try{ if('wakeLock' in navigator && !WL){ WL=await navigator.wakeLock.request('screen'); WL.addEventListener('release',()=>WL=null);} }catch(e){} }
document.addEventListener('visibilitychange',()=>{ if(!document.hidden && LS.get('training',0)) wake(); });
const btnLink=(href,txt,cls='primary')=>`<a class="btn ${cls}" href="${href}">${txt}</a>`;
const bar=$('#bar'), ov=$('#overlay');
function setBar(h){ bar.innerHTML=h||''; bar.style.display=h?'':'none'; }

/* ---------- rusttimer (timestamp-gebaseerd, overleeft achtergrond/herladen) ---------- */
let R=LS.get('rest',null), restT=null; // {end,dur,next}
function openTimer(){ ov.style.display='block'; drawTimer(); clearInterval(restT); restT=setInterval(drawTimer,250); }
function closeTimer(){ ov.style.display='none'; ov.classList.remove('finished','flash'); clearInterval(restT); }
function startRest(sec,next){ unlockAudio(); wake(); R={end:Date.now()+sec*1000,dur:sec,next:next??(R&&R.next)??''}; LS.set('rest',R); ov.classList.remove('finished'); openTimer(); }
function stopRest(){ R=null; LS.set('rest',null); closeTimer(); }
function drawTimer(){
  const left=R?Math.max(0,(R.end-Date.now())/1000):0, done=R&&left<=0;
  if(done&&!ov.classList.contains('finished')){ ov.classList.add('finished'); if(!R.signaled){R.signaled=true;LS.set('rest',R);beep();} setTimeout(()=>flash(ov.querySelector('.timer')),0); }
  if(done){ ov.innerHTML=`<div class="timer"><div class="eyebrow">Rust voorbij</div><div class="digits">Go!</div>${R.next?`<div class="lg">Volgende: <b>${esc(R.next)}</b></div>`:''}</div><div class="bar"><button class="btn primary" data-t="stop">Verder</button></div>`; return; }
  const pct=R?100*(1-left/R.dur):0;
  ov.innerHTML=`<div class="timer"><div class="eyebrow">Rust</div><div class="digits">${fmt(Math.ceil(left))}</div><div class="ring"><i style="width:${pct}%"></i></div>
   ${R&&R.next?`<div class="meta">Hierna: ${esc(R.next)}</div>`:''}
   <div class="presets">${[60,90,120,180].map(s=>`<button class="btn ${R&&R.dur===s?'on':''}" data-t="${s}">${fmt(s)}</button>`).join('')}</div>
   <button class="btn" data-t="custom">Eigen tijd…</button>
   <div class="grid2" style="margin-top:8px"><button class="btn" data-t="p15">+15 s</button><button class="btn danger" data-t="stop">Stop</button></div></div>`;
}
ov.addEventListener('click',e=>{ const b=e.target.closest('[data-t]'); if(!b)return; const t=b.dataset.t;
  if(t==='stop')return stopRest();
  if(t==='p15'&&R){R.end+=15000;R.dur+=15;LS.set('rest',R);return drawTimer();}
  if(t==='custom'){ const v=prompt('Rusttijd (bv. 45 of 2:30)','1:15'); if(!v)return; const p=v.split(/[:.]/).map(Number); const s=p.length>1?p[0]*60+p[1]:p[0]; if(s>0)startRest(s); return;}
  startRest(+t); });
if(R) openTimer();

/* ---------- routing ---------- */
function route(){
  const h=location.hash.slice(1)||'vandaag', [v,arg,tab]=h.split('/');
  document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('on',a.dataset.v===v));
  clearInterval(runT); clearInterval(itemT); app.onclick=null; app.onchange=null; bar.onclick=null; setBar('');
  if(v==='instellingen')return viewSettings(); if(v==='week')return viewWeek(); if(v==='progressie')return viewProg();
  if(v==='w')return viewWorkout(byId(arg),tab);
  return viewToday();
}
addEventListener('hashchange',()=>{route();scrollTo(0,0)});
const MAAND=['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'], DAG=['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];
const longDate=ds=>{const d=new Date(ds+'T12:00');return DAG[d.getDay()]+' '+d.getDate()+' '+MAAND[d.getMonth()];};
const isRun=w=>w.type==='run_z2'||w.type==='run_tempo';
function statusOf(w){ const l=LS.get(logKey(w.id)); if(!l)return ''; if(l.status)return l.status; return (l.sets||[]).some(s=>s.done)?'bezig':''; }
const ST={gedaan:['ok','✓ Gedaan'],deels:['part','Deels'],overgeslagen:['skip','Overgeslagen'],bezig:['part','Bezig']};
function stBadge(w){ const s=statusOf(w); if(ST[s])return `<span class="st ${ST[s][0]}">${ST[s][1]}</span>`; return `<span class="st">${w.date===today()?'Vandaag':w.date<today()?'Open':'Gepland'}</span>`; }
function durOf(w){ if(w.duration_min)return w.duration_min; if(w.amrap_min)return w.amrap_min+15; const iv=w.intervals; if(iv)return (iv.warmup_min||0)+iv.reps*(iv.work_min||0)+(iv.reps-1)*(iv.rest_min||0)+(iv.cooldown_min||0); return w.est_min||null; }
function weekOf(ds){ const d=new Date(ds+'T12:00'); d.setDate(d.getDate()-((d.getDay()+6)%7)); return Array.from({length:7},(_,i)=>{const x=new Date(d);x.setDate(d.getDate()+i);return ymd(x)}); }

/* ---------- Vandaag ---------- */
function viewToday(){
  const t=today(); if(!PLAN.length){ app.innerHTML='<div class="eyebrow">'+longDate(t)+'</div><h1>Nog geen plan</h1><p class="meta">Er is nog geen workout geladen. Verbinding nodig?</p>'; return; }
  const todays=PLAN.filter(w=>w.date===t); let w=todays[0], ey=longDate(t);
  if(!w){ w=PLAN.find(x=>x.date>t); if(w) ey='Eerstvolgende · '+longDate(w.date); }
  let h='';
  if(!w) h=`<div class="eyebrow">${longDate(t)}</div><h1>Niets gepland</h1>`;
  else {
    const d=durOf(w);
    h+=`<div class="eyebrow">${esc(ey)}${offlineTag()}</div><h1>${esc(w.title)}</h1>
    <div><span class="chip ${w.type==='strength'||w.type==='home'?'k':''}">${isRun(w)?'Lopen':TYPES[w.type]}</span>${d?`<span class="chip">± ${d} min</span>`:''}${w.rounds>1?`<span class="chip">${w.rounds} rondes</span>`:''}${w.hr_target?`<span class="chip">HR ${esc(w.hr_target)}</span>`:''}</div>
    <div class="card"><ul class="list">${(w.blocks||[]).map(b=>`<li><span>${esc(b.name)}${isMain(b)?' · '+b.items.length+' oefeningen':''}</span><span class="meta">${isMain(b)&&w.rounds>1?w.rounds+' rondes':esc(b.duration||'')}</span></li>`).join('')}</ul></div>
    ${(w.tips||[]).length?`<div class="note">${w.tips.map(esc).join(' · ')}</div>`:''}`;
    if(todays.length>1) h+='<h2>Ook vandaag</h2><div class="card"><ul class="list">'+todays.slice(1).map(x=>`<li><a href="#w/${esc(x.id)}">${esc(x.title)}</a>${stBadge(x)}</li>`).join('')+'</ul></div>';
    setBar(`<a class="btn primary" href="#w/${esc(w.id)}" id="start">${statusOf(w)?'Verder met training':'Start training'}</a>`);
    bar.querySelector('#start').onclick=()=>{unlockAudio();LS.set('training',1);wake();};
  }
  const wk=weekOf(t), ws=PLAN.filter(x=>wk.includes(x.date));
  if(ws.length) h+='<h2>Deze week</h2><div class="card"><ul class="list">'+ws.map(x=>`<li><a href="#w/${esc(x.id)}">${DAYS[wk.indexOf(x.date)][0].toUpperCase()+DAYS[wk.indexOf(x.date)][1]} · ${esc(x.title)}</a>${stBadge(x)}</li>`).join('')+'</ul></div>';
  const nxt=PLAN.filter(x=>x.date>wk[6]).slice(0,3);
  if(nxt.length) h+='<h2>Daarna</h2><div class="card"><ul class="list">'+nxt.map(x=>`<li><a href="#w/${esc(x.id)}">${esc(x.date.slice(8))}/${+x.date.slice(5,7)} · ${esc(x.title)}</a>${stBadge(x)}</li>`).join('')+'</ul></div>';
  app.innerHTML=h;
}
const offlineTag=()=>navigator.onLine?'':' · Offline · wordt gesynct';
addEventListener('offline',()=>route()); addEventListener('online',()=>route());

/* ---------- Workout (kracht / thuis / rust) ---------- */
function tabsOf(w){ const T=[]; (w.blocks||[]).forEach((b,bi)=>{ if(isMain(b)) for(let r=1;r<=(w.rounds||1);r++)T.push({key:'r'+r,label:(w.rounds||1)>1?'Ronde '+r:(w.amrap_min?'AMRAP':'Hoofdset'),block:b,round:r});
  else T.push({key:'b'+bi,label:/warm/i.test(b.name)?'Warm-up':/cool/i.test(b.name)?'Cool-down':b.name,block:b,round:1}); }); return T; }
function prevLoad(w,ex){ let best=null; allLogs().forEach(l=>{ if(l.workout_id===w.id||l.date>=w.date)return; (l.sets||[]).forEach(s=>{ if(s.exercise===ex&&s.done&&s.load_done!=null&&(!best||l.date>best.d))best={d:l.date,v:s.load_done}; }); }); return best; }
const num=v=>{const m=String(v??'').match(/\d+([.,]\d+)?/);return m?+m[0].replace(',','.'):null;};

function viewWorkout(w,tab){
  if(!w){ app.innerHTML='<h1>Workout niet gevonden</h1>'; return; }
  if(isRun(w)&&tab!=='klaar') return viewRun(w);
  const l=getLog(w), T=tabsOf(w);
  if(tab==='klaar') return viewFinish(w,l);
  let ti=Math.max(0,T.findIndex(t=>t.key===tab)); if(!tab){ const first=T.findIndex(t=>isMain(t.block)); const open=T.findIndex(t=>l.sets.some(s=>s.block===t.block.name&&s.round===t.round&&!s.done)); ti=open>=0?open:(first>=0?first:0); }
  const cur=T[ti]; const go=k=>location.replace('#w/'+w.id+'/'+k);
  const sets=cur?cur.block.items.map(it=>({it,k:l.sets.findIndex(s=>s.block===cur.block.name&&s.exercise===it.exercise&&s.round===cur.round)})):[];
  const firstOpen=sets.find(x=>!l.sets[x.k].done);
  let h=`<div class="eyebrow">${esc(w.title)} · ${esc(cur?cur.block.name:'')}${offlineTag()}</div><h1>${esc(cur?cur.label:w.title)}</h1>
   ${T.length>1?`<div class="tabs">${T.map((t,i)=>`<button class="tab ${i===ti?'on':''}" data-tab="${t.key}">${esc(t.label)}</button>`).join('')}</div>`:''}`;
  if(w.amrap_min&&cur&&isMain(cur.block)) h+=amrapCard(w,l);
  sets.forEach(({it,k})=>{ const s=l.sets[k]; const hasLoad=it.load_range||it.load_default!=null; const main=isMain(cur.block);
    const unit=it.load_unit||'kg', u2=unit.replace(/\s*kg$/,'').trim();
    const sum=[it.reps&&(main?(s.reps_done||it.reps):it.reps)+(/^\d+$/.test(String(s.reps_done||it.reps))?' reps':''),hasLoad&&(s.done?s.load_done+' kg':'')+(it.load_range?(s.done?' (':(u2?u2+' ':'')+'')+it.load_range.join('–')+(s.done?')':' kg'):'')].filter(Boolean).join(' · ');
    h+=`<div class="ex ${s.done?'done':''} ${firstOpen&&firstOpen.k===k?'active':''}" data-chk="${k}"><div class="check">${s.done?'✓':''}</div>
     <div><div class="name">${esc(it.exercise)}</div><div class="meta">${esc(sum)}</div>${it.notes?`<div class="meta">${esc(it.notes)}</div>`:''}${it.alternatives?`<div class="alt">↔ ${esc(it.alternatives)}</div>`:''}</div>`;
    h+=itRow(w,k,it,s);
    if(main&&!s.done){ const pv=prevLoad(w,it.exercise), mn=it.load_range?it.load_range[0]:0;
      if(hasLoad) h+=`<div class="stepper"><button data-w="${k}" data-d="-1" ${+s.load_done<=0?'disabled':''}>−</button><button class="val" data-wt="${k}">${s.load_done??'–'} kg<small>${esc(u2?u2+' · ':'')}${it.load_range?'bereik '+it.load_range.join('–'):''}${pv?' · vorige keer '+pv.v:''}</small></button><button data-w="${k}" data-d="1">+</button></div>`;
      const rn=num(s.reps_done);
      h+=`<div class="stepper"><button data-r="${k}" data-d="-1" ${rn==null||rn<=0?'disabled':''}>−</button><button class="val" data-reps="${k}">${esc(s.reps_done||'–')}${/^\d+$/.test(String(s.reps_done))?' reps':''}<small>doel ${esc(it.reps)}</small></button><button data-r="${k}" data-d="1" ${rn==null?'disabled':''}>+</button></div>`; }
    h+='</div>'; });
  if(cur&&isMain(cur.block)&&(w.tips||[]).length) h+=`<div class="note">${w.tips.map(esc).join(' · ')}</div>`;
  h+=`<p style="margin-top:24px"><a class="btn" href="#w/${esc(w.id)}/klaar">Afsluiten →</a></p>
   <p><button class="btn small danger" id="reset">Reset deze workout</button></p>`;
  app.innerHTML=h;
  const restLbl=w.rest_sec?fmt(w.rest_sec):'1:30';
  setBar(`<button class="btn" id="rest">Rust ${restLbl}</button><button class="btn primary" id="next">${firstOpen?'Volgende ✓':(ti<T.length-1?'Volgende tab →':'Afsluiten →')}</button>`);
  const nextName=()=>{ const n=T[ti+1]; return n?n.label+': '+(n.block.items[0]||{}).exercise:'Afsluiten'; };
  const check=k=>{ const s=l.sets[k]; s.done=!s.done; s.ts=new Date().toISOString(); saveLog(l);
    if(s.done){ const allDone=l.sets.filter(x=>x.block===s.block&&x.round===s.round).every(x=>x.done);
      if(allDone&&isMain(cur.block)&&w.rest_sec&&ti<T.length-1){ startRest(w.rest_sec,nextName()); return go(T[ti+1].key); } }
    viewWorkout(w,cur.key); };
  bar.querySelector('#rest').onclick=()=>startRest(w.rest_sec||90,firstOpen?firstOpen.it.exercise:nextName());
  bar.querySelector('#next').onclick=()=>{ LS.set('training',1); wake(); if(firstOpen)return check(firstOpen.k); if(ti<T.length-1)return go(T[ti+1].key); location.hash='#w/'+w.id+'/klaar'; };
  app.onclick=e=>{ const b=e.target.closest('button,[data-chk]'); if(!b)return; const d=b.dataset;
    if(d.tab)return go(d.tab);
    if(d.ip!=null){ unlockAudio(); wake(); LS.set('training',1); const key=itKey(w,d.ip); const it=cur.block.items.find(i=>i.exercise===l.sets[d.ip].exercise);
      let st=LS.get(key)||{dur:itemDur(it),start:0,pausedAt:0,pausedTotal:0};
      if(!st.start)st.start=Date.now(); else if(st.pausedAt){st.pausedTotal+=Date.now()-st.pausedAt;st.pausedAt=0;} else st.pausedAt=Date.now();
      LS.set(key,st); return viewWorkout(w,cur.key); }
    if(d.ir!=null){ const st=LS.get(itKey(w,d.ir)); if(st)LS.set(itKey(w,d.ir),{dur:st.dur,start:0,pausedAt:0,pausedTotal:0}); return viewWorkout(w,cur.key); }
    if(d.iset!=null) return pickDur(d.iset);
    if(d.w!=null){ const s=l.sets[d.w], it=cur.block.items.find(i=>i.exercise===s.exercise); const st=it.load_step||2.5; s.load_done=Math.max(0,Math.round(((+s.load_done||0)+st*d.d)*10)/10); saveLog(l); return viewWorkout(w,cur.key); }
    if(d.r!=null){ const s=l.sets[d.r]; const n=num(s.reps_done); if(n==null)return; s.reps_done=String(Math.max(0,n+(+d.d))); saveLog(l); return viewWorkout(w,cur.key); }
    if(d.wt!=null){ const s=l.sets[d.wt]; const v=prompt('Gewicht in kg',s.load_done??''); if(v!==null&&v.trim()!==''&&!isNaN(+v.replace(',','.'))){s.load_done=+v.replace(',','.');saveLog(l);} return viewWorkout(w,cur.key); }
    if(d.reps!=null){ const s=l.sets[d.reps]; const v=prompt('Reps gedaan',s.reps_done); if(v!==null){s.reps_done=v.trim();saveLog(l);} return viewWorkout(w,cur.key); }
    if(d.am){ l.amrap_rounds=Math.max(0,(l.amrap_rounds||0)+(+d.am)); saveLog(l); return viewWorkout(w,cur.key); }
    if(b.id==='amgo'){ unlockAudio(); wake(); const k='run:'+w.id; let st=LS.get(k); if(!st){LS.set(k,{start:Date.now(),pausedAt:0,pausedTotal:0});} return viewWorkout(w,cur.key); }
    if(b.id==='reset'){ if(confirm('Alle voortgang van deze workout wissen?')){ localStorage.removeItem(logKey(w.id)); Object.keys(localStorage).filter(x=>x.startsWith('it:'+w.id+':')).forEach(x=>localStorage.removeItem(x)); localStorage.removeItem('run:'+w.id); saveLog(getLog(w)); viewWorkout(w); } return; }
    if(d.chk!=null) return check(+d.chk);
  };
  const pickDur=k=>{ const key=itKey(w,k), it=cur.block.items.find(i=>i.exercise===l.sets[k].exercise), st=LS.get(key);
    const v=prompt('Tijd (bv. 5, 5:30 of 45s)', fmt(st?st.dur:itemDur(it))); if(!v)return;
    let sec; const t=v.trim().toLowerCase(); if(/s$/.test(t))sec=parseFloat(t); else if(t.includes(':')){const p=t.split(':').map(Number);sec=p[0]*60+p[1];} else sec=parseFloat(t.replace(',','.'))*60;
    if(sec>0){ LS.set(key,{dur:Math.round(sec),start:0,pausedAt:0,pausedTotal:0}); viewWorkout(w,cur.key); } };
  app.querySelectorAll('[data-iset]').forEach(b=>{ let t; b.addEventListener('touchstart',()=>{t=setTimeout(()=>{t=null;pickDur(+b.dataset.iset)},550)},{passive:true}); b.addEventListener('touchend',e=>{ if(t)clearTimeout(t); else e.preventDefault(); }); b.addEventListener('contextmenu',e=>e.preventDefault()); });
  clearInterval(itemT); itemT=setInterval(()=>{ if(!app.querySelector('.itimer'))return; tickItems(w,l,()=>viewWorkout(w,cur.key)); },250);
  if(w.amrap_min){ runT=setInterval(()=>{ const el=app.querySelector('#amclock'); if(!el)return clearInterval(runT); const st=LS.get('run:'+w.id); if(!st)return; const left=w.amrap_min*60-(Date.now()-st.start)/1000; el.textContent=fmt(Math.ceil(Math.max(0,left))); if(left<=0&&!st.done){st.done=true;LS.set('run:'+w.id,st);beep(4);flash(app);} },250); }
}
function amrapCard(w,l){ const st=LS.get('run:'+w.id); const left=st?Math.max(0,w.amrap_min*60-(Date.now()-st.start)/1000):w.amrap_min*60;
  return `<div class="card" style="text-align:center"><div class="eyebrow">Zoveel mogelijk rondes in ${w.amrap_min} min</div><div class="digits sm" id="amclock">${fmt(Math.ceil(left))}</div>
  ${st?'':'<button class="btn primary" id="amgo">Start AMRAP</button>'}
  <div class="stepper" style="margin-top:12px"><button data-am="-1">−</button><div class="val">${l.amrap_rounds||0} rondes<small>aantal afgerond</small></div><button data-am="1" class="plus">+1</button></div></div>`; }

/* ---------- Duur-timers per oefening ---------- */
// parseDur/itemDur komen uit duration.js (strikte regel, zie tests/duration.test.js)
const itKey=(w,k)=>'it:'+w.id+':'+k;
function itState(st){ if(!st)return null; const now=st.pausedAt||Date.now(); const el=Math.min(st.dur,st.start?(now-st.start-st.pausedTotal)/1000:0); return {el,left:st.dur-el,pct:100*el/st.dur,run:!!st.start&&!st.pausedAt&&el<st.dur}; }
function itRow(w,k,it,s){ const def=itemDur(it); if(!def||s.done)return '';
  const st=LS.get(itKey(w,k)); const dur=st?st.dur:def; const x=itState(st)||{el:0,left:dur,pct:0,run:false};
  return `<div class="itimer" data-it="${k}"><button class="ib ${x.run?'':'go'}" data-ip="${k}" aria-label="${x.run?'pauze':'start'}">${x.run?'❚❚':'▶'}</button>
   <button class="val" data-iset="${k}"><span class="itl">${fmt(Math.ceil(x.left))}</span><small>van ${fmt(dur)} · tik om te wijzigen</small><span class="ring"><i style="width:${x.pct}%"></i></span></button>
   <button class="ib" data-ir="${k}" aria-label="reset">↺</button></div>`; }
function tickItems(w,l,rerender){ document.querySelectorAll('.itimer').forEach(el=>{ const k=+el.dataset.it, st=LS.get(itKey(w,k)); const x=itState(st); if(!x)return;
  el.querySelector('.itl').textContent=fmt(Math.ceil(x.left)); el.querySelector('i').style.width=x.pct+'%';
  if(x.left<=0&&!st.fired){ st.fired=true; LS.set(itKey(w,k),st); beep(); const card=el.closest('.ex'); card.classList.add('fin'); flash(card);
    const s=l.sets[k]; if(!s.done){ s.done=true; s.ts=new Date().toISOString(); saveLog(l); } setTimeout(rerender,1200); } }); }

/* ---------- Afsluiten ---------- */
function viewFinish(w,l){
  const run=isRun(w), ru=l.run||{};
  const mainEx=[...new Set((w.blocks||[]).filter(isMain).flatMap(b=>b.items.map(i=>i.exercise)))];
  const need=l.status==='deels'||l.status==='overgeslagen';
  let h=`<div class="eyebrow">${esc(w.title)} · afsluiten${offlineTag()}</div><h1>Hoe ging het?</h1>`;
  if(run) h+=`<div class="grid2"><label class="field"><span>Duur (min)</span><input inputmode="decimal" data-run="duration_min" value="${esc(ru.duration_min)}"></label><label class="field"><span>Afstand (km)</span><input inputmode="decimal" data-run="distance_km" value="${esc(ru.distance_km)}"></label>
   <label class="field"><span>Gem. HR</span><input inputmode="numeric" data-run="avg_hr" value="${esc(ru.avg_hr)}"></label><label class="field"><span>Max HR</span><input inputmode="numeric" data-run="max_hr" value="${esc(ru.max_hr)}"></label></div>
   <label class="field"><span>Screenshot horloge (optioneel)</span><input type="file" accept="image/*" id="shot" class="file"></label>${l.screenshot?'<div class="meta">✓ Screenshot bijgevoegd</div>':''}`;
  if(w.type!=='rest') h+=`<h2>Zwaarte (RPE)</h2><div class="rpe">${Array.from({length:10},(_,i)=>`<button data-rpe="${i+1}" class="${l.rpe===i+1?'on':''}">${i+1}</button>`).join('')}</div>`;
  if(!run&&w.type!=='rest'&&mainEx.length) h+='<h2>Per oefening</h2>'+mainEx.map(e=>`<div class="card"><div class="name">${esc(e)}</div><div class="seg">${['te licht','goed','te zwaar'].map(f=>`<button data-fb="${esc(e)}" data-v="${f}" class="${l.feedback[e]===f?(f==='goed'?'on':'on warn'):''}">${f[0].toUpperCase()+f.slice(1)}</button>`).join('')}</div></div>`).join('');
  h+=`<h2>Status</h2><div class="seg">${['gedaan','deels','overgeslagen'].map(s=>`<button data-status="${s}" class="${l.status===s?'on '+(s==='gedaan'?'':s==='deels'?'warn':'bad'):''}">${s[0].toUpperCase()+s.slice(1)}</button>`).join('')}</div>
   ${need?`<label class="field"><span>Reden (verplicht)</span><input data-f="skipped_reason" value="${esc(l.skipped_reason)}" placeholder="bv. ziek, geen tijd, blessure"></label>`:''}
   <label class="field"><span>Notitie voor Mike</span><textarea data-f="notes" placeholder="Hoe voelde het?">${esc(l.notes)}</textarea></label>
   <p><a class="btn" href="#w/${esc(w.id)}">← Terug naar training</a></p>`;
  app.innerHTML=h;
  setBar(`<button class="btn primary" id="save">Opslaan</button>`);
  bar.querySelector('#save').onclick=()=>{ app.querySelectorAll('[data-f]').forEach(i=>l[i.dataset.f]=i.value);
    if(!l.status){ alert('Kies eerst een status.'); return; }
    if((l.status==='deels'||l.status==='overgeslagen')&&!String(l.skipped_reason||'').trim()){ alert('Vul een reden in.'); return; }
    l.finished_at=new Date().toISOString(); saveLog(l); LS.set('training',0); if(WL){WL.release();WL=null;} location.hash='#vandaag'; };
  app.onclick=e=>{ const b=e.target.closest('button'); if(!b)return; const d=b.dataset;
    app.querySelectorAll('[data-f]').forEach(i=>l[i.dataset.f]=i.value);
    if(d.status){ l.status=l.status===d.status?'':d.status; saveLog(l); return viewFinish(w,l); }
    if(d.rpe){ l.rpe=+d.rpe; saveLog(l); return viewFinish(w,l); }
    if(d.fb){ l.feedback[d.fb]=d.v; saveLog(l); return viewFinish(w,l); } };
  app.onchange=e=>{ const t=e.target;
    if(t.dataset.f){ l[t.dataset.f]=t.value; saveLog(l); }
    if(t.dataset.run){ l.run=l.run||{}; const v=t.value.replace(',','.'); l.run[t.dataset.run]=v===''?null:+v; saveLog(l); }
    if(t.id==='shot'&&t.files[0]) resizeImg(t.files[0]).then(d=>{ l.screenshot=d; saveLog(l); viewFinish(w,l); }); };
}
function resizeImg(file){ return new Promise(res=>{ const img=new Image(); img.onload=()=>{ const m=1080,sc=Math.min(1,m/Math.max(img.width,img.height)); const c=document.createElement('canvas'); c.width=img.width*sc;c.height=img.height*sc; c.getContext('2d').drawImage(img,0,0,c.width,c.height); res(c.toDataURL('image/jpeg',.7)); }; img.src=URL.createObjectURL(file); }); }

/* ---------- Week ---------- */
function viewWeek(){
  const off=LS.get('weekOff',0), b=new Date(); b.setDate(b.getDate()+off*7); const wk=weekOf(ymd(b));
  let h=`<div class="eyebrow">${wk[0].slice(8)}/${+wk[0].slice(5,7)} – ${wk[6].slice(8)}/${+wk[6].slice(5,7)}${offlineTag()}</div><h1>Week ${+isoWeek(wk[0]).split('-W')[1]}</h1>
   <div class="grid3"><button class="btn" data-off="-1" aria-label="vorige week">←</button><button class="btn" data-off="0">Nu</button><button class="btn" data-off="1" aria-label="volgende week">→</button></div>`;
  wk.forEach((ds,i)=>{ const ws=PLAN.filter(w=>w.date===ds);
    if(!ws.length) h+=`<div class="day ${ds===today()?'today':''}"><b>${DAYS[i]}</b><div class="meta">—</div><span></span></div>`;
    ws.forEach(w=>{ const d=durOf(w); h+=`<a class="day ${ds===today()?'today':''}" href="#w/${esc(w.id)}"><b>${DAYS[i]}</b><div><div class="name">${esc(w.title)}</div><div class="meta">${TYPES[w.type]||''}${d?' · '+d+' min':''}${w.rounds>1?' · '+w.rounds+' rondes':''}</div></div>${stBadge(w)}</a>`; }); });
  app.innerHTML=h;
  app.onclick=e=>{const o=e.target.dataset.off; if(o==null)return; LS.set('weekOff',o==='0'?0:off+(+o)); viewWeek();};
}

/* ---------- Progressie ---------- */
function viewProg(){
  const data={}, meta={};
  allLogs().sort((a,b)=>a.date.localeCompare(b.date)).forEach(l=>(l.sets||[]).forEach(s=>{ if(!s.done||s.load_done==null||s.load_done==='')return; const wk=isoWeek(l.date);
    (data[s.exercise]??={})[wk]=Math.max(data[s.exercise][wk]||0,+s.load_done); (meta[s.exercise]??=[]).push({d:l.date,v:s.load_done,r:s.reps_done,fb:(l.feedback||{})[s.exercise]}); }));
  const ex=Object.keys(data);
  let h='<div class="eyebrow">Zwaarste afgevinkte gewicht per week</div><h1>Progressie</h1>';
  if(!ex.length) h+='<div class="card meta">Nog geen afgevinkte sets met gewicht. Na je eerste krachttraining verschijnt hier je progressie.</div>';
  ex.forEach(e=>{ const wks=Object.keys(data[e]).sort().slice(-8), mx=Math.max(...wks.map(k=>data[e][k])), last=meta[e].slice(-3).reverse();
    h+=`<div class="card"><div class="name">${esc(e)}</div><div class="bars">${wks.map((k,i)=>`<div class="${i===wks.length-1?'last':''}" style="height:${Math.max(10,data[e][k]/mx*100)}%"><span>${data[e][k]}</span></div>`).join('')}</div>
     <div class="axis">${wks.map(k=>`<span>wk ${+k.split('-W')[1]}</span>`).join('')}</div>
     <ul class="list">${last.map(x=>`<li><span>${x.d.slice(8)}/${+x.d.slice(5,7)} · ${x.v} kg × ${esc(x.r)}</span><span class="meta">${esc(x.fb||'')}</span></li>`).join('')}</ul></div>`; });
  app.innerHTML=h;
}

/* ---------- Loopsessie (Zone 2 / tempo-intervallen), fasen met timestamps ---------- */
function phasesOf(w){
  const P=[], iv=w.intervals;
  if(w.type==='run_tempo'&&iv){
    if(iv.warmup_min)P.push({name:'Warming-up',sec:iv.warmup_min*60,hint:'Rustig inlopen, Zone 2'});
    for(let i=1;i<=iv.reps;i++){ P.push({name:`Herhaling ${i} van ${iv.reps}`,work:true,rep:i,sec:(iv.work_min||0)*60+(iv.work_sec||0),hint:iv.work_target||w.hr_target||''});
      if(i<iv.reps&&(iv.rest_min||iv.rest_sec))P.push({name:'Herstel',sec:(iv.rest_min||0)*60+(iv.rest_sec||0),hint:iv.rest_target||'Dribbelen of wandelen'}); }
    if(iv.cooldown_min)P.push({name:'Cooling-down',sec:iv.cooldown_min*60,hint:'Rustig uitlopen'});
  } else P.push({name:'Zone 2',sec:(w.duration_min||30)*60,hint:'Praattest / neusademhaling'});
  return P;
}
let runT=null, itemT=null;
function viewRun(w){
  const P=phasesOf(w), k='run:'+w.id, total=P.reduce((a,p)=>a+p.sec,0); let st=LS.get(k,null);
  const state=()=>{ if(!st)return {i:0,left:P[0].sec,el:0}; const now=st.pausedAt||Date.now(); const el=(now-st.start-st.pausedTotal)/1000; let acc=0;
    for(let i=0;i<P.length;i++){ if(el<acc+P[i].sec)return {i,left:acc+P[i].sec-el,el}; acc+=P[i].sec; } return {i:P.length,left:0,el:total}; };
  let lastI=state().i;
  const z2=w.type==='run_z2';
  app.innerHTML=`<div class="eyebrow">${esc(w.title)} · ${z2?'Zone 2':'tempo-intervallen'}${offlineTag()}</div><div id="runbody"></div>`;
  const body=app.querySelector('#runbody');
  function draw(){ const s=state(); if(s.i!==lastI){ beep(s.i>=P.length?4:2, P[s.i]&&P[s.i].work?1046:660); flash(app); lastI=s.i; if(s.i>=P.length&&st&&!st.done){st.done=true;LS.set(k,st);} }
    const p=P[s.i], pct=100*s.el/total;
    let h='';
    if(z2) h+=`<h1>Zone 2</h1><div class="card" style="text-align:center"><div class="eyebrow">Doel-hartslag</div><div class="hr">${esc(w.hr_target||'130–140')} <small>bpm</small></div><div class="meta">${esc((w.blocks?.[0]?.items?.[0]?.notes)||'Praattest: je kunt hele zinnen praten.')}</div></div>
      <div class="grid2"><div class="card c"><div class="eyebrow">Verstreken</div><div class="t72">${fmt(s.el)}</div></div><div class="card c"><div class="eyebrow">Resterend</div><div class="t72">${fmt(total-s.el)}</div></div></div><div class="ring"><i style="width:${pct}%"></i></div>`;
    else { h+=`<h1>${p?esc(p.name):'Klaar!'}</h1><div class="card" style="text-align:center"><div class="eyebrow">${p&&p.work?'Tempo':'Blok'}</div><div class="digits">${fmt(Math.ceil(s.left))}</div><div class="lg">${esc(p?p.hint:'Goed gedaan. Vul je gegevens in.')}</div><div class="ring" style="margin-top:12px"><i style="width:${pct}%"></i></div><div class="meta">Totaal ${fmt(s.el)} / ${fmt(total)}</div></div>
      <div class="card"><ul class="list">${P.map((q,i)=>`<li class="${i===s.i?'cur':''}"><span>${i<s.i?'✓ ':''}${esc(q.name)}</span><span class="meta">${fmt(q.sec)}</span></li>`).join('')}</ul></div>`; }
    h+=`<div class="grid2"><button class="btn" id="rst">Opnieuw</button><button class="btn" id="skip" ${!st||s.i>=P.length?'disabled':''}>${z2?'Stop':(p&&p.work?'Herhaling klaar':'Volgende blok')}</button></div>`;
    body.innerHTML=h;
    setBar(s.i>=P.length?`<a class="btn primary" href="#w/${esc(w.id)}/klaar">Klaar → afsluiten</a>`:`<button class="btn primary" id="go">${!st?'▶ Start':st.pausedAt?'▶ Verder':'❚❚ Pauze'}</button><a class="btn" href="#w/${esc(w.id)}/klaar" style="max-width:40%">Afsluiten</a>`);
  }
  const onClick=e=>{ const id=(e.target.closest('[id]')||{}).id;
    if(id==='go'){ unlockAudio(); wake(); if(!st)st={start:Date.now(),pausedAt:0,pausedTotal:0}; else if(st.pausedAt){st.pausedTotal+=Date.now()-st.pausedAt;st.pausedAt=0;} else st.pausedAt=Date.now(); LS.set(k,st); draw(); }
    if(id==='skip'&&st){ const s=state(); if(s.i<P.length){ if(z2){ st.start-=s.left*1000; } else st.start-=s.left*1000; LS.set(k,st); draw(); } }
    if(id==='rst'&&confirm('Sessietimer opnieuw starten?')){ st=null; localStorage.removeItem(k); lastI=0; draw(); } };
  app.onclick=onClick; bar.onclick=onClick;
  runT=setInterval(()=>{ if(!location.hash.startsWith('#w/'+w.id)||location.hash.endsWith('/klaar')){bar.onclick=null;return clearInterval(runT);} draw(); },500); draw();
}

/* ---------- Instellingen (API-URL + token alleen lokaal op het toestel) ---------- */
function viewSettings(){
  const c=LS.get('cfg',{}), q=LS.get('queue',[]).length;
  app.innerHTML=`<div class="eyebrow">Sync met Google Drive</div><h1>Instellingen</h1>
   <div class="note">Deze gegevens blijven alleen op deze telefoon (niet in de code). Leeg = alleen lokaal.</div>
   <label class="field"><span>API-URL (Apps Script /exec)</span><input id="api" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(c.API_URL||'')}"></label>
   <label class="field"><span>Token</span><input id="tok" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(c.TOKEN||'')}"></label>
   <div class="grid2"><button class="btn" id="test">Test verbinding</button><button class="btn danger" id="clr">Wissen</button></div>
   <div class="card meta" id="res">${CFG.API_URL?'Sync staat aan':'Sync staat uit (lokaal)'} · ${q} in wachtrij</div>`;
  setBar(`<button class="btn primary" id="save">Opslaan</button>`);
  const val=()=>({API_URL:app.querySelector('#api').value.trim(),TOKEN:app.querySelector('#tok').value.trim()});
  app.onclick=async e=>{ const id=e.target.id, r=app.querySelector('#res');
    if(id==='clr'&&confirm('Sync-gegevens wissen? (logs blijven bewaard)')){ localStorage.removeItem('cfg'); location.reload(); }
    if(id==='test'){ const v=val(); if(!/^https:\/\//.test(v.API_URL)){r.textContent='Vul een https-URL in.';return;} r.textContent='Bezig…';
      try{ const j=await (await fetch(v.API_URL+'?action=plan&from='+today()+'&to='+today()+'&token='+encodeURIComponent(v.TOKEN))).json();
        r.textContent=j.ok?'✓ Verbinding werkt':'✗ '+(j.error==='unauthorized'?'Token klopt niet':j.error); }catch(err){ r.textContent='✗ Geen verbinding ('+err.message+')'; } } };
  bar.querySelector('#save').onclick=()=>{ const v=val(); if(v.API_URL&&!/^https:\/\//.test(v.API_URL)){alert('URL moet met https:// beginnen');return;} LS.set('cfg',v); location.replace('#vandaag'); location.reload(); };
}

/* ---------- start ---------- */
if('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(()=>{});
syncLabel(); route(); loadPlan(); flush();
