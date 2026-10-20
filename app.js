'use strict';
const APP_VERSION='v15.1', APP_BUILD='volgas';
const VLABEL=APP_VERSION+' · '+APP_BUILD;
const CFG = Object.assign({}, window.CONFIG || {});
function applyStoredCfg(){ let c={}; try{ c=JSON.parse(localStorage.getItem('cfg')||'{}')||{}; }catch(e){}
  for(const k of ['API_URL','TOKEN']) if(c[k]) CFG[k]=c[k]; }   // localStorage gaat voor config.js; lege waarden nooit
applyStoredCfg();
const syncOn=()=>!!(CFG.API_URL&&CFG.TOKEN);

const clean=v=>String(v||'').replace(/[\u200B-\u200D\uFEFF\s]+/g,'').replace(/\\_/g,'_');
CFG.API_URL=clean(CFG.API_URL).replace(/[.,;]+$/,''); CFG.TOKEN=clean(CFG.TOKEN);
ACC.init(); // v15: actief account (sessietoken) gaat voor de oude koppeling
/* ---------- Magic link: #k=<token>&u=<base64url exec-URL, optioneel> ---------- */
function b64urlDecode(x){ try{ x=String(x).replace(/-/g,'+').replace(/_/g,'/'); while(x.length%4)x+='='; return decodeURIComponent(escape(atob(x))); }catch(e){ return ''; } }
function parseLink(text){ // accepteert de hele link, alleen de hash, of "k=…&u=…"
  const t=String(text||'').trim(); const i=t.indexOf('#'); const h=(i>=0?t.slice(i+1):t).replace(/^[?#]/,'');
  const p=new URLSearchParams(h); const k=clean(p.get('k')||''); if(!k||k.length<16)return null;
  let u=p.get('u')?clean(b64urlDecode(p.get('u'))):''; if(u&&!/^https:\/\/script\.google(usercontent)?\.com\/.+\/exec$/.test(u))u='';
  return {TOKEN:k,API_URL:u||clean((window.CONFIG||{}).API_URL||'')||CFG.API_URL||''};
}
let justLinked=false;
function handleMagicLink(){ if(!/(^|[#&])k=/.test(location.hash))return false; const v=parseLink(location.hash);
  history.replaceState(null,'',location.pathname+location.search+'#vandaag'); // token direct uit de adresbalk/geschiedenis
  if(v&&v.API_URL){ localStorage.setItem('cfg',JSON.stringify(v)); applyStoredCfg(); justLinked=true; } return true; }
handleMagicLink();
// Cross-origin naar Apps Script: simpele requests (geen custom headers -> geen preflight), redirect volgen, geen cookies,
// 60 s timeout (koude start kan ~40 s duren) en 1x opnieuw proberen.
function jsonp(url,timeout=60000){ return new Promise((res,rej)=>{ const cb='__wcb'+Date.now()+Math.floor(Math.random()*1e4); const sc=document.createElement('script');
  const done=(f,v)=>{ clearTimeout(t); delete window[cb]; sc.remove(); f(v); }; const t=setTimeout(()=>done(rej,new Error('JSONP time-out')),timeout);
  window[cb]=d=>done(res,d); sc.onerror=()=>done(rej,new Error('JSONP laadfout'));
  sc.onload=()=>setTimeout(()=>{ if(window[cb]) done(rej,new Error('geen JSONP-antwoord: Code.gs nog niet bijgewerkt (callback)')); },100); sc.src=url+(url.includes('?')?'&':'?')+'callback='+cb; document.head.appendChild(sc); }); }
function jsonpUrl(params,cfg){ return cfg.API_URL+'?'+new URLSearchParams({...params,token:cfg.TOKEN,_:Date.now()}); }
let lastTransport='', apiChain=Promise.resolve();
// Apps Script geeft soms (vooral bij gelijktijdige requests/koude start) een 404-HTML-pagina zonder CORS terug.
// Daarom: requests één voor één, 3 pogingen met pauze, daarna JSONP.
function api(method,params,body,cfg=CFG,tries=3){ const run=()=>apiX(method,params,body,cfg,tries); const p=apiChain.then(run,run).then(j=>{ if(j&&j.error==='unauthorized'&&cfg===CFG&&ACC.mode()==='account')ACC.onUnauthorized(); return j; }); apiChain=p.catch(()=>{}); return p; }
async function apiX(method,params,body,cfg,tries){
  let last;
  for(let i=0;i<tries;i++){
    try{ const j=await api0(method,params,body,cfg,1); lastTransport='fetch'; return j; }
    catch(e){ last=e; if(/time-out/.test(e.message))break; await new Promise(r=>setTimeout(r,800*(i+1))); }
  }
  try{
    if(method==='GET'){ const j=await jsonp(jsonpUrl(params,cfg)); lastTransport='jsonp'; return j; }
    if(body&&body.action==='log'&&body.log){ const lg={...body.log}; delete lg.screenshot;
    if(JSON.stringify(lg).length<6000){ const j=await jsonp(jsonpUrl({action:'log',data:JSON.stringify({log:lg})},cfg)); lastTransport='jsonp'; return j; } }
  }catch(e2){ last=new Error(last.message+' / '+e2.message); }
  throw last;
}
async function api0(method,params,body,cfg=CFG,tries=2){
  let last;
  for(let i=0;i<tries;i++){
    const ac=new AbortController(), t=setTimeout(()=>ac.abort(),60000);
    try{
      const url=cfg.API_URL+(method==='GET'?'?'+new URLSearchParams({...params,token:cfg.TOKEN,_:Date.now()}):'');
      const opt={method,redirect:'follow',credentials:'omit',signal:ac.signal};
      if(method==='POST'){opt.headers={'Content-Type':'text/plain;charset=utf-8'};opt.body=JSON.stringify({...body,token:cfg.TOKEN});}
      const r=await fetch(url,opt); const txt=await r.text(); let j;
      try{ j=JSON.parse(txt); }catch(e){ throw new Error(/<html|<!doctype/i.test(txt)?'geen JSON maar een webpagina (toegang van de web-app moet op "Iedereen" staan)':'onverwacht antwoord (HTTP '+r.status+')'); }
      return j;
    }catch(e){ last=e.name==='AbortError'?new Error('time-out na 60 s'):e; if(/geen JSON|onverwacht/.test(last.message))break; }
    finally{ clearTimeout(t); }
  }
  throw last;
}
const $ = s => document.querySelector(s); let app = $('#app');
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
// Lokale aanpassingen (stem/trainer) winnen tot de server dezelfde workout teruggeeft
function applyOverrides(arr){ const ov=LS.get('overrides',{}); let ch=false;
  for(const id in ov){ const i=arr.findIndex(w=>w.id===id); const o=ov[id];
    if(i>=0&&JSON.stringify(arr[i])===JSON.stringify(o.workout)&&o.written){ delete ov[id]; ch=true; continue; }
    if(i>=0)arr[i]=o.workout; else if(o.workout.date>=ymd(new Date(Date.now()-14*864e5)))arr.push(o.workout); }
  if(ch)LS.set('overrides',ov); return arr.sort((a,b)=>a.date.localeCompare(b.date)); }
let PLAN = applyOverrides(LS.get('plan', []));
async function loadPlan(){
  try{
    let url, data;
    if(syncOn()){
      const f=new Date(),t=new Date(); f.setDate(f.getDate()-Math.max(CFG.PLAN_DAYS_BACK||14,120)); t.setDate(t.getDate()+(CFG.PLAN_DAYS_AHEAD||28));
      data=await api('GET',{action:'plan',from:ymd(f),to:ymd(t)});
    } else { const r=await fetch('workouts.json?'+Date.now()); data=await r.json(); }
    if(data && data.error) throw new Error(data.error);
    const arr=Array.isArray(data)?data:(data.workouts||[]);
    if(arr.length){LS.set('plan',arr.slice().sort((a,b)=>a.date.localeCompare(b.date))); PLAN=applyOverrides(arr); LS.set('planAt',Date.now());}
  }catch(e){ console.warn('plan offline, cache gebruikt',e); }
  softRoute();
}
// Achtergrond-updates (plan/logs) mogen een scherm met invoervelden niet opnieuw tekenen (wiste ingetypte tekst)
function softRoute(){ const v=(location.hash.slice(1)||'vandaag').split('/'); const a=document.activeElement;
  if(v[0]==='instellingen'||v[0]==='aftrap'||(v[0]==='w'&&v[2]==='klaar')||(a&&/INPUT|TEXTAREA/.test(a.tagName)))return; route(); }
const byId = id => PLAN.find(w=>w.id===id);

/* ---------- logs (Mike's log-object) ---------- */
const logKey = id => 'log:'+id;
function getLog(w){
  let l=LS.get(logKey(w.id));
  if(!l){ l={workout_id:w.id,date:w.date,profile_id:(LS.get('profile',{}).id||'thijs'),status:'',sets:[],rpe:null,feedback:{},run:{},notes:'',skipped_reason:''}; }
  // zorg dat alle sets bestaan — maar NOOIT in een afgeronde/bestaande log (bv. van Mike) sets bijmaken
  if(REAL_STATUS.includes(l.status)) return l;
  (w.blocks||[]).forEach((b,bi)=>{ const R=isMain(b)?(w.rounds||1):1;
    b.items.forEach((it,ii)=>{ for(let r=1;r<=R;r++){ if(!l.sets.find(s=>s.block===b.name&&sameEx(s.exercise,it.exercise)&&s.round===r))
      l.sets.push({round:r,block:b.name,exercise:it.exercise,reps_done:it.reps_default!=null?String(it.reps_default):(it.reps??''),load_done:it.load_default??(it.load_range?it.load_range[0]:null),load_unit:it.load_unit||'',done:false}); }});});
  return l;
}
const isMain = b => /hoofd/i.test(b.name);
// v15.1: werkblokken voor tellingen. Zonder 'Hoofd'-blok (bv. supersets) alle blokken behalve warming-up/cooling-down
const workBlocks=w=>{ const B=w.blocks||[], m=B.filter(isMain); return m.length?m:B.filter(b=>!/warm|cool/i.test(b.name||'')); };
// 'Roeien of fietsen' == 'Roeien/fietsen' == 'roeien - fietsen'
const exKey = x => String(x||'').toLowerCase().replace(/\s+of\s+/g,'/').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'');
const sameEx = (a,b) => a===b||exKey(a)===exKey(b);
// Een log telt pas als er echt iets in staat; lege/onaangeraakte logs worden niet bewaard, niet gequeued en niet gesynct.
const REAL_STATUS=['gedaan','deels','overgeslagen'];
function isMeaningful(l){ if(!l)return false; if(REAL_STATUS.includes(l.status))return true; if((l.sets||[]).some(s=>s.done))return true;
  if(l.rpe!=null&&l.rpe!=='')return true; if(String(l.notes||'').trim()||String(l.skipped_reason||'').trim())return true;
  if(Object.values(l.run||{}).some(v=>v!=null&&v!==''))return true; if(Object.keys(l.feedback||{}).length||l.screenshot||l.amrap_rounds||(l.adjustments||[]).length)return true; return false; }
function logTs(l){ if(!l)return ''; let t=l.updated_at||l.synced_at||l.finished_at||''; if(!t)(l.sets||[]).forEach(s=>{ if(s.ts&&s.ts>t)t=s.ts; }); return String(t); }
// v15.1: load_unit 'reps' = de stepper telt herhalingen (geen kg). reps_done volgt de teller.
const isRepsU=u=>/^\s*reps\s*$/i.test(String(u||''));
const isRestItem=it=>!!(it&&it.duration_sec&&/^rust\b/i.test(String(it.exercise||''))&&it.load_range==null&&it.load_default==null);
function saveLog(l,sync=true){ (l.sets||[]).forEach(s=>{ if(isRepsU(s.load_unit)&&s.load_done!=null&&s.load_done!=='')s.reps_done=String(s.load_done); }); l.updated_at=new Date().toISOString(); if(!l.profile_id)l.profile_id=(LS.get('profile',{}).id||'thijs'); const ac=ACC.active(); if(ac)l.account=ac.id; const q=new Set(LS.get('queue',[]));
  if(!isMeaningful(l)){ q.delete(l.workout_id); LS.set('queue',[...q]); syncLabel(); if((l.sets||[]).some(s=>s.touched))LS.set(logKey(l.workout_id),l); else localStorage.removeItem(logKey(l.workout_id)); return; } // v15.1: aangepaste stepper vóór de eerste ✓ blijft lokaal bewaard (niet verstuurd)
  LS.set(logKey(l.workout_id),l);
  if(sync){ q.add(l.workout_id); LS.set('queue',[...q]); flush(); } }
/* server-logs ophalen en mergen: per workout_id wint de nieuwste updated_at; lokale niet-gesyncte logs nooit overschreven door ouder */
let serverLogsState=LS.get('serverLogsState','');
function mergeServerLogs(arr){
  const q=new Set(LS.get('queue',[])); let n=0;
  (arr||[]).forEach(sl=>{ if(!sl||!sl.workout_id||/TEST/i.test(sl.workout_id)||sl.date==='2000-01-01')return;
    const loc=LS.get(logKey(sl.workout_id)), sm=isMeaningful(sl), lm=isMeaningful(loc);
    if(!sm&&loc) return;                                 // lege server-log verslaat nooit een lokale
    if(loc&&lm){ if(logTs(loc)>=logTs(sl)) return; }      // beide echt: nieuwste wint
    // anders (lokaal ontbreekt of is leeg/onaangeraakt): server wint altijd
    const m={...sl}; delete m.screenshot; if(sl.screenshot&&!/^data:/.test(sl.screenshot))m.screenshot_file=sl.screenshot;
    m.feedback=m.feedback||{}; m.sets=m.sets||[]; m.run=m.run||{};
    LS.set(logKey(sl.workout_id),m); if(q.has(sl.workout_id)){ q.delete(sl.workout_id); } n++; });
  LS.set('queue',[...q]); return n;
}
async function loadServerLogs(){
  if(!syncOn())return;
  const f=new Date(); f.setDate(f.getDate()-180); const t=new Date(); t.setDate(t.getDate()+7);
  try{ const j=await api('GET',{action:'logs',from:ymd(f),to:ymd(t)});
    if(j&&j.ok&&Array.isArray(j.logs)){ const n=mergeServerLogs(j.logs); serverLogsState='ok '+j.logs.length+' ('+new Date().toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})+')'; LS.set('serverLogsState',serverLogsState); if(n)softRoute(); }
    else { serverLogsState=(j&&/unknown action/.test(j.error||''))?'nog niet beschikbaar (Code.gs-update nodig)':'fout: '+((j&&j.error)||'?'); LS.set('serverLogsState',serverLogsState); }
  }catch(e){ serverLogsState='niet bereikbaar ('+e.message+')'; LS.set('serverLogsState',serverLogsState); }
  await loadHealth();
}
/* v14.4: gezondheidsdata (HRV, rusthartslag, workouts uit Apple Gezondheid) — alleen lezen via GET action=health */
async function loadHealth(){ if(!syncOn())return; const f=new Date(); f.setDate(f.getDate()-120);
  try{ const j=await api('GET',{action:'health',from:ymd(f),to:ymd(new Date())});
    if(j&&j.ok&&Array.isArray(j.days)){ const m={}; j.days.forEach(d=>{ if(d&&/^\d{4}-\d{2}-\d{2}$/.test(d.date))m[d.date]=d; }); LS.set('health',m); LS.set('healthState','ok '+j.days.length); if((location.hash||'').startsWith('#progressie'))softRoute(); }
    else LS.set('healthState',(j&&/unknown action/.test(j.error||''))?'nog niet beschikbaar (Code.gs v3 nodig)':'fout: '+((j&&j.error)||'?'));
  }catch(e){ LS.set('healthState','niet bereikbaar'); } }
const allLogs = () => Object.keys(localStorage).filter(k=>k.startsWith('log:')).map(k=>LS.get(k)).filter(Boolean);

/* ---------- sync-wachtrij: hele log-object, idempotent (overschrijft op server) ---------- */
let flushing=false;
async function flush(){
  const q=LS.get('queue',[]); syncLabel();
  if(!syncOn()||flushing||!q.length||!navigator.onLine) return;
  flushing=true;
  for(const id of q){
    const l=LS.get(logKey(id)); if(!l||!isMeaningful(l)){ LS.set('queue',LS.get('queue',[]).filter(x=>x!==id)); continue; }
    try{
      const j=await api('POST',null,{action:'log',log:l}); if(!j.ok) throw new Error(j.error||'sync mislukt');
      if((LS.get(logKey(id))||{}).updated_at===l.updated_at) LS.set('queue',LS.get('queue',[]).filter(x=>x!==id));
    }catch(e){ console.warn(e); break; }
  }
  flushing=false; syncLabel();
}
function syncLabel(){ const n=LS.get('queue',[]).length, el=document.querySelector('#avbtn'); if(!el)return; const i=el.querySelector('i'); if(i)i.className=syncOn()?(n?'':'on'):'';
  el.title=!syncOn()?'niet gekoppeld':(n?n+' te syncen':'gesynct'); }
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
const bar=$('#bar'), ov=$('#overlay'); let hd=$('#hd');
function setBar(h){ bar.innerHTML=h||''; bar.style.display=h?'':'none'; document.body.classList.toggle('hasfoot',!!h); }
const MIC='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="9" y="3" width="6" height="12" rx="3" fill="currentColor"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
const BRAND='<a class="brand" href="#vandaag" aria-label="VOLGAS">VOL<b>GAS</b></a>';
const PROFILE=()=>Object.assign({id:'thijs',name:'Thijs Hogeveen'},LS.get('profile',{}));
const TRAINER=()=>PROFILE().trainer_name||LS.get('trainerFromPing','')||CFG.TRAINER_NAME||'Mike';
const initials=n=>String(n||'?').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0].toUpperCase()).join('');
const avatar=()=>`<button class="av" id="avbtn" aria-label="Profiel en instellingen">${esc(initials(PROFILE().name))}<i class="${syncOn()?'on':''}"></i></button>`;
function appHead(active){ const T=[['vandaag','Vandaag'],['morgen','Morgen'],['week','Week'],['progressie','Progressie']];
  hd.innerHTML=`<div class="top">${BRAND}${avatar()}</div><nav class="tabs">${T.map(([k,l])=>`<a href="#${k}" class="${k===active?'on':''}">${l}</a>`).join('')}</nav>`; }
function subHead(lbl,title,back='#vandaag'){ hd.innerHTML=`<div class="top"><a class="back" href="${back}" aria-label="Terug">‹</a><div class="tt"><b class="h">${esc(title)}</b>${lbl?`<div class="sub">${esc(lbl)}</div>`:''}</div>${avatar()}</div>`; }
hd.addEventListener('click',e=>{ if(e.target.closest('#avbtn')) openProfile(); });

/* ---------- rust (één blok, tijdstempels) ---------- */
let R=LS.get('rest',null), restT=null; // {end,dur,next,label,backTo,min}
const mini=document.createElement('button'); mini.id='minirest'; mini.className='minirest'; mini.setAttribute('aria-label','Rust openen'); document.body.appendChild(mini);
mini.onclick=()=>{ if(!R)return; R.min=false; LS.set('rest',R); openTimer(); };
function openTimer(){ drawTimer(); clearInterval(restT); restT=setInterval(drawTimer,250); }
function closeTimer(){ ov.style.display='none'; ov.className='rest'; ov.innerHTML=''; clearInterval(restT); mini.style.display='none'; }
function startRest(sec,next,label){ unlockAudio(); wake(); R={end:Date.now()+sec*1000,dur:sec,plan:sec,next:next??(R&&R.next)??'',label:label??(R&&R.label)??'',min:false}; LS.set('rest',R); ov.classList.remove('fin'); openTimer(); }
function restBackTo(h){ if(R){ R.backTo=h; LS.set('rest',R); } }
function stopRest(){ const back=R&&R.backTo; R=null; LS.set('rest',null); closeTimer(); if(back&&location.hash!==back) location.replace(back); }
const restQ=()=>/^ronde/i.test(R.next||'')?'Klaar voor de volgende ronde?':/cool/i.test(R.next||'')?'Klaar voor de cooling-down?':'Klaar om verder te gaan?';
function drawTimer(){ const saved=LS.get('rest',null); if(saved)R=saved; if(!R)return closeTimer();
  const left=Math.max(0,(R.end-Date.now())/1000), done=left<=0;
  if(done&&!R.signaled){ R.signaled=true; R.min=false; LS.set('rest',R); beep(); flash(ov); }
  // mini-balk onderin als de rust is weggeklikt
  if(R.min){ ov.style.display='none'; mini.style.display='flex'; mini.innerHTML=`<span class="ml">Rust</span><b>${fmt(Math.ceil(left))}</b><span class="mn">${esc(R.next||'')}</span><i style="width:${Math.min(100,100*(1-left/R.dur))}%"></i>`; return; }
  mini.style.display='none'; ov.style.display='block'; ov.classList.toggle('fin',done);
  const pct=Math.min(100,100*(1-left/R.dur));
  ov.innerHTML=`<div style="padding-top:var(--sat)"><div class="top"><button class="back" data-t="min" aria-label="Rust verkleinen">‹</button><div class="tt"><b class="h">${done?'Rust voorbij':'Rust'}</b>${R.label?`<div class="mu" style="font-size:14px">${esc(String(R.label).split(' · ')[0])}</div>`:''}</div></div></div>
   <main><div class="card" style="padding:22px 16px"><div class="lbl" style="text-align:center">Plan ${fmt(R.plan||R.dur)}</div>
   <div class="big3">${done?'GO!':fmt(Math.ceil(left))}</div><div class="ring" style="margin:6px 6px 18px"><i style="width:${pct}%"></i></div>
   <div class="adj">${[-30,-15,15,30].map(s=>`<button data-t="${s}">${s<0?'−':'+'}${Math.abs(s)}</button>`).join('')}</div></div>
   ${R.next?`<h2>Straks</h2><div class="card"><b style="font-size:18px">${esc(R.next)}</b></div>`:''}</main>
   <div class="foot" style="position:fixed"><button class="btn" data-t="stop" id="skiprest">Verder</button></div>
   ${done?`<div class="scrim" style="z-index:21"></div><div class="pop restpop" role="dialog" style="z-index:22"><b class="h" style="font-size:26px;display:block;margin-bottom:6px">${restQ()}</b><div class="mu" style="margin-bottom:16px">${esc(R.next||'')}</div><button class="btn" data-t="stop" id="akkoord">Akkoord</button></div>`:''}`; }
ov.addEventListener('click',e=>{ const b=e.target.closest('[data-t]'); if(!b||!R)return; const t=b.dataset.t;
  if(t==='stop')return stopRest();
  if(t==='min'){ R.min=true; LS.set('rest',R); return drawTimer(); }
  const d=+t; R.end=Math.max(Date.now(),R.end+d*1000); R.dur=Math.max(1,R.dur+d); R.signaled=R.end>Date.now()?false:R.signaled; LS.set('rest',R); drawTimer(); });
if(R) openTimer();

/* ---------- streak (reeks) ---------- */
const TIERS=[['Vonk',1,6,'✨','t-vonk'],['Vlam',7,20,'🔥','t-vlam'],['Vuur',21,49,'🔥','t-vuur'],['Inferno',50,1e9,'🔥','t-inferno']];
const tierOf=n=>TIERS.find(t=>n>=t[1]&&n<=t[2])||TIERS[0];
// v14.3: telt per DATUM (workout_id hoeft niet met het plan te kloppen). Gedaan/deels telt, geplande rustdag telt, overgeslagen/gemist breekt.
const DONE_ST=['gedaan','deels'];
function dayState(ds){ const t=today(), L=allLogs().filter(l=>l.date===ds), ws=PLAN.filter(w=>w.date===ds);
  if(L.some(l=>DONE_ST.includes(l.status)||(!l.status&&((l.sets||[]).some(s=>s.done)||(l.run&&(l.run.distance_km||l.run.duration_min))))))return 'done';
  if(L.some(l=>l.status==='overgeslagen'))return 'skip';
  if(ws.length&&ws.every(w=>w.type==='rest'))return ds>t?'future':'rest';
  if(!ws.length)return ds<t?'free':'future';
  return ds<t?'miss':ds===t?'open':'future'; }
function streak(){ const logs=allLogs().filter(isMeaningful); if(!logs.length)return 0;
  const first=logs.map(l=>l.date).sort()[0], t=today(); let n=0; const d=new Date(first+'T12:00');
  for(;ymd(d)<=t;d.setDate(d.getDate()+1)){ const s=dayState(ymd(d));
    if(s==='done'||s==='rest'||s==='free'){ n++; continue; }
    if(s==='open'||s==='future')continue; n=0; }
  return n; }
function streakCard(t){ const n=streak(), T=tierOf(n);
  return `<div class="card streak reeks ${T[4]}"><a class="rh" href="#reeks" aria-label="Je reeks: ${n} ${n===1?'dag':'dagen'} ${T[0]}"><span class="em">${T[3]}</span><span class="sp shl"><b class="h">${n} ${n===1?'dag':'dagen'}</b><span class="nt">${T[0]}</span></span><span class="mu" style="font-size:22px">›</span></a>${chainStrip(t,true)}</div>`; }
function viewStreak(){ const n=streak(), cur=tierOf(n); subHead('','Je reeks');
  app.innerHTML=`
  ${TIERS.map(T=>`<div class="card tier ${T[4]} ${T===cur?'cur':''}"><span class="em">${T[3]}</span><div class="sp"><b class="h">${T[0]}</b><div class="mu" style="font-size:15px">${T[2]>1e6?T[1]+'+ dagen':T[1]+'–'+T[2]+' dagen'}</div></div>${T===cur?`<span class="n">${n}</span>`:''}</div>`).join('')}
  <h2>Mijlpalen</h2><div class="miles">${[7,21,50,100].map(m=>`<div class="${n>=m||LS.get('mile',0)>=m?'got':''}"><span>🏅</span>${m}</div>`).join('')}</div>
  <p class="mu" style="margin-top:14px;font-size:14px">Rustdagen tellen mee. Een gemiste geplande training breekt je reeks.</p>`; }
function checkMilestone(){ const n=streak(), m=[100,50,21,7].find(x=>n>=x); if(!m||LS.get('mile',0)>=m)return; LS.set('mile',m); celebrate(m); }
function celebrate(m){ const d=document.createElement('div'); d.className='celebrate'; const T=tierOf(m);
  d.innerHTML=`<div class="em">${T[3]}</div><div class="q">${m} dagen!</div><div style="font-size:17px">Je bent nu <b style="color:var(--ac)">${T[0]}</b> 🏅</div><div class="mu" style="font-size:15px;margin-top:10px">${esc(TRAINER())}: “Sterk volgehouden, zo blijven gaan.”</div><button class="btn">Door met trainen</button>`;
  if(!matchMedia('(prefers-reduced-motion:reduce)').matches) for(let i=0;i<40;i++){ const c=document.createElement('i'); c.className='confetti'; c.style.left=Math.random()*100+'%'; c.style.background=['#FF6B1A','#fff','#FFB020','#E5484D'][i%4]; c.style.animationDelay=Math.random()*.6+'s'; d.appendChild(c); }
  d.onclick=e=>{ if(e.target.closest('button'))d.remove(); }; document.body.appendChild(d); setTimeout(()=>d.querySelectorAll('.confetti').forEach(c=>c.remove()),2600); }

/* ---------- routing ---------- */
function route(){
  const h=location.hash.slice(1)||'vandaag', [v,arg,tab]=h.split('/');
  clearInterval(runT); clearInterval(itemT); app.onclick=null; app.onchange=null; bar.onclick=null; hd.onclick=null; setBar(''); closeSheet();
  document.body.classList.toggle('onb',v==='aftrap'); document.body.classList.toggle('auth',ACC.isAuthView(v));
  if(ACC.gate(v)){ Voice.after('aftrap'); return; }
  if(v!=='aftrap'&&!LS.get('aftrapDone',0)&&!/instellingen/.test(v)){ location.replace('#aftrap/0'); return; }
  if(v==='aftrap')return viewAftrap(arg||'0');
  if(v==='instellingen'){ viewSettings(); return Voice.after(v); }
  if(v==='morgen'){ viewMorgen(); return Voice.after(v); }
  if(v==='week'){ viewWeek(); return Voice.after(v); }
  if(v==='progressie'){ viewProg(arg); return Voice.after(v); }
  if(v==='reeks'){ viewStreak(); return Voice.after(v); }
  if(v==='voorbeeld'){ viewPreview(byId(arg),tab); return Voice.after(v,arg,tab); }
  if(v==='w'){ const w=byId(arg); if(w&&w.type==='rest'&&!tab){ viewRestDay(w); return Voice.after(v,arg,tab); } viewWorkout(w,tab); return Voice.after(v,arg,tab); }
  viewToday(); Voice.after('vandaag'); checkMilestone();
}
addEventListener('hashchange',()=>{ if(handleMagicLink()){ syncLabel(); toast('Gekoppeld ✓'); loadPlan(); loadServerLogs().then(flush); } route(); scrollTo(0,0); swCleanup(); });
const MAAND=['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'], DAG=['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];
const longDate=ds=>{const d=new Date(ds+'T12:00');return DAG[d.getDay()]+' '+d.getDate()+' '+MAAND[d.getMonth()];};
const isRun=w=>w.type==='run_z2'||w.type==='run_tempo';
function statusOf(w){ const l=LS.get(logKey(w.id)); if(!l)return ''; if(l.status)return l.status; return (l.sets||[]).some(s=>s.done)?'bezig':''; }
const ST={gedaan:['ok','✓ Gedaan'],deels:['part','Deels'],overgeslagen:['skip','Overgeslagen'],bezig:['part','Bezig']};
function stBadge(w){ const s=statusOf(w); if(ST[s])return `<span class="st ${ST[s][0]}">${ST[s][1]}</span>`; if(w.type==='rest')return `<span class="st">Rust</span>`; if(w.date<=today()&&dayState(w.date)==='done')return `<span class="st ok">✓ Gedaan</span>`; return `<span class="st">${w.date===today()?'Vandaag':w.date<today()?'Open':'Gepland'}</span>`; }
function durOf(w){ if(w.duration_min)return w.duration_min; if(w.amrap_min)return w.amrap_min+15; const iv=w.intervals; if(iv)return (iv.warmup_min||0)+iv.reps*(iv.work_min||0)+(iv.reps-1)*(iv.rest_min||0)+(iv.cooldown_min||0); return w.est_min||null; }
function weekOf(ds){ const d=new Date(ds+'T12:00'); d.setDate(d.getDate()-((d.getDay()+6)%7)); return Array.from({length:7},(_,i)=>{const x=new Date(d);x.setDate(d.getDate()+i);return ymd(x)}); }
const cap=s=>s?s[0].toUpperCase()+s.slice(1):s;
const mikeline=t=>`<div class="mike"><div class="av s">${esc(initials(TRAINER()))}</div><span>${t}</span></div>`;
const offlineTag=()=>navigator.onLine?'':' · offline';
addEventListener('offline',()=>softRoute()); addEventListener('online',()=>softRoute());
// streak-ketting: één vakje per dag met daglabel. Gehaald/rustdag = oranje vakje met zwarte letters; gemist/overgeslagen = zwart, gestippeld, oranje letters.
// all=true (Vandaag): de hele reeks terug, horizontaal scrollbaar, vandaag rechts. Anders (Week): de 7 dagen van die week.
function chainDays(t,all){ if(!all)return weekOf(t); const td=today(), lim=addDays(td,-180);
  let s=[...PLAN.map(w=>w.date),...allLogs().map(l=>l.date)].filter(d=>d&&d<=td).sort()[0]||td; if(s<lim)s=lim; if(s>addDays(td,-6))s=addDays(td,-6);
  const out=[]; for(let d=s;d<=td;d=addDays(d,1))out.push(d); return out; }
function chainStrip(t,all){ const days=chainDays(t,all), td=today(), S=days.map(dayState), fill=s=>s==='done'||s==='rest'||s==='free';
  return `<div class="chain${all?' scroll':''}" ${all?'data-noswipe':''} aria-label="${all?'Je hele reeks':'Reeks deze week'}">${days.map((ds,i)=>{ const ws=PLAN.filter(x=>x.date===ds), w=ws.find(x=>x.type!=='rest')||ws[0], s=S[i], wd=(new Date(ds+'T12:00').getDay()+6)%7;
    const c=fill(s)?'ok':(s==='miss'||s==='skip')?'miss':'';
    return `<a class="lk ${c} ${fill(s)&&i<days.length-1&&fill(S[i+1])?'cn':''} ${ds===td?'today':''} ${all&&wd===0&&i?'mon':''}" href="${w?'#w/'+esc(w.id):'#week'}" aria-label="${esc(cap(DAG[(wd+1)%7]))} ${+ds.slice(8)}/${+ds.slice(5,7)}: ${s==='done'?'gedaan':s==='rest'?'rustdag':s==='free'?'vrij':s==='miss'?'gemist':s==='skip'?'overgeslagen':'open'}"><i>${DAYS[wd]}</i></a>`; }).join('')}</div>`; }
const scrollChain=()=>{ const cs=app.querySelector('.chain.scroll'); if(cs) cs.scrollLeft=cs.scrollWidth; };
const wkNo=ds=>+isoWeek(ds).split('-W')[1];
function restCard(w){ const it=(w.blocks||[]).flatMap(b=>b.items||[]);
  return `<div class="card restday"><span class="em">🛌</span><b class="h">Rustdag</b><div class="mu">Herstel hoort bij je schema.</div>
   ${it.length?`<div class="rl2">${it.map(i=>`<div class="li"><span class="sp">${esc(i.exercise)}</span><span class="mu">${esc(i.reps||'')}</span></div>`).join('')}</div>`:''}
   ${it.length?`<a class="rlink" href="#w/${esc(w.id)}/b0">Herstel bijhouden ›</a>`:''}</div>`; }
// v15 audit: korte titels op één regel en hero-titel = naam van de workout; details als chips
const ivTxt=w=>w.intervals&&w.intervals.reps?`${w.intervals.reps}× ${w.intervals.work_min||''} min`:'';
function shortTitle(w){ const d=durOf(w), t=String(w.title||'');
  if(w.type==='rest')return 'Rust'; if(w.type==='run_z2')return 'Zone 2'+(d?' · '+d+' min':'');
  if(w.type==='run_tempo')return 'Tempo-intervallen'+(w.intervals&&w.intervals.reps?' '+w.intervals.reps+'×'+(w.intervals.work_min||''):'');
  if(w.type==='home'||/^thuis-backup/i.test(t))return t.replace(/^thuis-backup\s*/i,'Thuis · ').replace(/ · $/,'')||'Thuis';
  return t; }
function heroTitle(w){ const t=String(w.title||''); if(w.type==='run_z2')return 'Zone 2'; if(w.type==='run_tempo')return 'Tempo-intervallen'; if(w.type==='home'||/^thuis-backup/i.test(t))return 'Thuis'; return t; }
const tipsOf=w=>(w.tips||[]).filter(x=>!/^\s*\d+\s*rondes?\b/i.test(x)||!/rust/i.test(x)); // "2 rondes, 2–3 min rust" staat al in de chips/tabs
const pvLink=w=>w.type==='rest'?'':`<a class="card row pvlink" href="#voorbeeld/${esc(w.id)}"><span class="sp"><b>Bekijk de hele workout</b></span><span class="mu" style="font-size:22px">›</span></a>`;
function heroCard(w,ey,view){ if(w.type==='rest')return restCard(w); const d=durOf(w), n=workBlocks(w).reduce((a,b)=>a+b.items.filter(i=>!isRestItem(i)).length,0), st=statusOf(w);
  const home=w.type==='home'||/^thuis-backup/i.test(w.title||''), amr=w.amrap_min?`${w.amrap_min} min AMRAP`:'', rest=String(w.title||'').replace(/^thuis-backup\s*/i,'');
  const C=[st==='deels'?'Deels gedaan':'',st==='overgeslagen'?'Overgeslagen':'',w.type==='run_tempo'?ivTxt(w):'',home?(amr||rest):'',!isRun(w)&&!home&&n?(w.rounds>1?w.rounds+' rondes':'1 ronde'):'',!isRun(w)&&!home&&n?n+' oefeningen':'',d?'± '+d+' min':'',w.rest_sec?'Rust '+fmt(w.rest_sec):''].filter(Boolean);
  return `<div class="card hero"><div class="big">${esc(heroTitle(w))}</div>
   <div class="chips">${[...new Set(C)].map(c=>`<span class="chip">${esc(c)}</span>`).join('')}</div>
   ${view?`<a class="btn" href="#voorbeeld/${esc(w.id)}" id="view">Bekijk workout</a>`:`<a class="btn" href="#w/${esc(w.id)}" id="start">${st?'▶ Verder met training':'▶ Start training'}</a>`}</div>`; }
const tomorrow=()=>{ const d=new Date(today()+'T12:00'); d.setDate(d.getDate()+1); return ymd(d); };
// Korte deep-link naar de Morgen-tab (geen volle kaart meer onder Vandaag)
function morgenLink(n){ if(!n)return ''; const d=durOf(n), tom=n.date===tomorrow();
  return `<a class="card morgen row" href="${tom?'#morgen':n.type==='rest'?'#w/'+esc(n.id):'#voorbeeld/'+esc(n.id)}" style="margin-top:12px"><span class="ic">${isRun(n)?'🏃':n.type==='rest'?'🛌':'🏋️'}</span><span class="sp"><div class="lbl">${tom?'Morgen':'Volgende · '+esc(longDate(n.date))}</div><b style="font-size:18px">${esc(shortTitle(n))}</b></span><span class="mu" style="font-size:22px">›</span></a>`; }

/* ---------- Vandaag ---------- */
function viewToday(){
  appHead('vandaag'); const t=today();
  const unl=!syncOn()?`<a class="card row" href="#instellingen" style="border:2px solid var(--ac)"><span class="sp"><b>Niet gekoppeld</b><div class="mu" style="font-size:14px">Tik om te koppelen met ${esc(TRAINER())}</div></span><span class="chip part">Koppel</span></a>`:'';
  if(!PLAN.length){ app.innerHTML=unl+`<div class="lbl">${esc(longDate(t))}</div><h1>Nog geen plan</h1><p class="mu">Er is nog geen workout geladen.</p>`; return; }
  const todays=PLAN.filter(w=>w.date===t); let w=todays[0], ey=longDate(t);
  if(!w){ w=PLAN.find(x=>x.date>t); if(w) ey='Eerstvolgende · '+longDate(w.date); }
  let h=unl+`<div class="lbl" style="margin-bottom:10px">${esc(cap(ey))} · week ${wkNo(t)}${offlineTag()}</div>`;
  if(!w) h+=`<h1>Niets gepland</h1>`;
  else if(w.date===t&&statusOf(w)==='gedaan') h+=summaryBody(w,true);
  else { h+=heroCard(w,ey)+pvLink(w); if(tipsOf(w).length) h+=`<div class="note">${tipsOf(w).map(esc).join(' · ')}</div>`;
    if(todays.length>1) h+='<h2>Ook vandaag</h2>'+todays.slice(1).map(x=>`<a class="card wl" href="#w/${esc(x.id)}"><span class="sp"><b>${esc(shortTitle(x))}</b></span>${stBadge(x)}</a>`).join(''); }
  // v15 audit: geen Morgen-kaart (tab ernaast), geen vaste trainersregel (alleen bij nieuws), geen versie (staat in het profiel), reeks één keer onderaan
  const lastAdj=Object.values(LS.get('overrides',{})).filter(o=>o.workout.date>=t).sort((a,b)=>(b.at||'').localeCompare(a.at||''))[0];
  if(lastAdj) h+=mikeline(esc(TRAINER())+' heeft je training aangepast op jouw wens');
  app.innerHTML=h+streakCard(t); scrollChain();
  const st=app.querySelector('#start'); if(st) st.onclick=()=>{unlockAudio();LS.set('training',1);wake();};
}
/* ---------- Morgen ---------- */
function viewMorgen(){
  appHead('morgen'); const t=tomorrow();
  const unl=!syncOn()?`<a class="card row" href="#instellingen" style="border:2px solid var(--ac)"><span class="sp"><b>Niet gekoppeld</b><div class="mu" style="font-size:14px">Tik om te koppelen met ${esc(TRAINER())}</div></span><span class="chip part">Koppel</span></a>`:'';
  if(!PLAN.length){ app.innerHTML=unl+`<div class="lbl">${esc(longDate(t))}</div><h1>Nog geen plan</h1>`; return; }
  const tomorrows=PLAN.filter(w=>w.date===t); let w=tomorrows[0];
  let h=unl+`<div class="lbl" style="margin-bottom:10px">${esc(cap(longDate(t)))} · week ${wkNo(t)}${offlineTag()}</div>`;
  if(!w){ const next=PLAN.find(x=>x.date>t);
    h+=`<h1>Niets gepland</h1><p class="mu" style="margin-bottom:16px">Er staat morgen niets in je schema.</p>`;
    if(next) h+=morgenLink(next);
  } else {
    h+=heroCard(w,longDate(t),true);
    if(tipsOf(w).length) h+=`<div class="note">${tipsOf(w).map(esc).join(' · ')}</div>`;
    if(tomorrows.length>1) h+='<h2>Ook morgen</h2>'+tomorrows.slice(1).map(x=>`<a class="card wl" href="#${x.type==='rest'?'w':'voorbeeld'}/${esc(x.id)}"><span class="sp"><b>${esc(shortTitle(x))}</b></span>${stBadge(x)}</a>`).join('');
  }
  app.innerHTML=h;
}
function summaryBody(w,onToday){
  const l=LS.get(logKey(w.id))||{}, sets=l.sets||[], WB=workBlocks(w), main=WB.map(b=>b.name), restN=new Set(WB.flatMap(b=>b.items||[]).filter(isRestItem).map(i=>i.exercise));
  const ms=sets.filter(s=>(main.includes(s.block)||(!s.block&&main.length))&&!restN.has(s.exercise)), msd=ms.filter(s=>s.done);
  const ru=l.run||{}, run=isRun(w), mins=ru.duration_min!=null?Math.round(ru.duration_min):(l.started_at&&l.finished_at?Math.round((new Date(l.finished_at)-new Date(l.started_at))/6e4):null);
  const kg=msd.filter(s=>!isRepsU(s.load_unit)).reduce((a,s)=>{ const v=+s.load_done||0, r=num(s.reps_done)||0, m=/2×/.test(s.load_unit||'')?2:1; return a+v*r*m; },0);
  const stat=(a,b)=>`<div class="stat"><div class="num">${a}</div><div class="s">${b}</div></div>`;
  const pace=ru.duration_min&&ru.distance_km?fmt(ru.duration_min*60/ru.distance_km):'–';
  const bigTxt=run?(ru.distance_km!=null?esc(String(ru.distance_km).replace('.',','))+' km':'Gelopen')+(l.rpe!=null?' · RPE '+esc(l.rpe):''):[mins?mins+' min':'',l.rpe!=null?'RPE '+esc(l.rpe):''].filter(Boolean).join(' · ')||'Gedaan';
  let h=`<div class="card hero">${onToday?`<div class="lbl">${esc(shortTitle(w))} · gedaan ✓</div>`:''}<div class="big" style="${onToday?'margin-top:6px;':''}font-size:40px">${bigTxt}</div>
   <div class="row" style="margin-top:12px">${run?stat(mins!=null?fmt(mins*60):'–','tijd')+stat(pace,'/km')+stat(ru.avg_hr??'–','gem. HR')+(ru.max_hr?stat(esc(ru.max_hr),'max. HR'):''):stat(msd.length+'/'+ms.length,'sets')+stat(kg?Math.round(kg).toLocaleString('nl-NL'):'–','kg totaal')+stat(w.rounds||1,'rondes')}</div></div>`;
  const fbo=l.feedback&&typeof l.feedback==='object'&&!Array.isArray(l.feedback)?l.feedback:{}, fbs=typeof l.feedback==='string'?l.feedback.trim():'';
  const fb=Object.entries(fbo).filter(([,v])=>typeof v==='string');
  if(fb.length) h+=`<div class="card exs">${fb.map(([e,v])=>`<div class="li" style="min-height:52px"><span class="sp">${esc(e)}</span><b style="color:${v==='goed'?'var(--ok)':'var(--ac)'}">${esc(cap(v))}</b></div>`).join('')}</div>`;
  if(fbs&&fbs!==String(l.notes||'').trim()) h+=`<div class="note">${esc(fbs)}</div>`;
  if(l.notes) h+=`<div class="note">${esc(l.notes)}</div>`;
  if(onToday) h+=`<a class="btn ghost sm" href="#w/${esc(w.id)}">Workout bekijken</a>`;
  const n=!onToday&&PLAN.find(x=>x.date>w.date); if(n) h+=morgenLink(n);
  return h; }

/* ---------- Rustdag ---------- */
function viewRestDay(w){ subHead(cap(longDate(w.date)),'Rustdag',w.date===tomorrow()?'#morgen':'#vandaag'); app.innerHTML=restCard(w); }

/* ---------- Voorvertoning: alleen lezen, start niets en schrijft niets ---------- */
function viewPreview(w,tab){
  if(!w){ subHead('','Niet gevonden'); app.innerHTML='<h1>Workout niet gevonden</h1>'; return; }
  if(w.type==='rest') return viewRestDay(w);
  const back=w.date===tomorrow()?'#morgen':'#vandaag'; let h='';
  if(isRun(w)){ subHead('Voorvertoning',heroTitle(w),back); const P=phasesOf(w), d=durOf(w);
    h+=`<div class="card"><div class="row" style="gap:18px">${d?`<div><div class="lbl">Duur</div><div class="num" style="font-size:30px">± ${d} min</div></div>`:''}${w.hr_target?`<div><div class="lbl">Doel-HR</div><div class="num" style="font-size:30px">${esc(w.hr_target)}</div></div>`:''}</div></div>
     <div class="card exs pv">${P.map(q=>`<div class="li"><span class="sp"><b>${esc(q.name)}</b>${q.hint?`<div class="sub">${esc(q.hint)}</div>`:''}</span><span class="mu">${fmt(q.sec)}</span></div>`).join('')}</div>`;
  } else { const T=tabsOf(w); let ti=Math.max(0,T.findIndex(t=>t.key===tab)); const cur=T[ti], main=cur&&isMain(cur.block), R=w.rounds||1;
    subHead('Voorvertoning', w.title, back);
    if(T.length>1) hd.insertAdjacentHTML('beforeend',`<div class="tabs" data-noswipe>${T.map((t,i)=>`<button class="${i===ti?'on':''}" data-ptab="${t.key}">${esc(t.label)}</button>`).join('')}</div>`);
    if(cur) h+=`<div class="card exs pv">${cur.block.items.map(it=>{ const u=it.load_unit||'kg', u2=u.replace(/\s*kg$/,'').trim();
      const load=isRepsU(u)?'':it.load_range?(u2?u2+' ':'')+it.load_range.join('–')+' kg':it.load_default!=null?(u2?u2+' ':'')+it.load_default+' kg':'';
      const reps=it.reps?it.reps+(/^\d+$/.test(String(it.reps))?' reps':''):'';
      return `<div class="li"><span class="sp"><b>${esc(it.exercise)}</b>${it.notes?`<div class="sub">${esc(it.notes)}</div>`:''}${it.alternatives?`<div class="alt">↔ ${esc(it.alternatives)}</div>`:''}</span><span class="pvr">${esc(reps)}${load?`<small>${esc(load)}</small>`:''}</span></div>`; }).join('')}</div>`;
    if(main&&w.rest_sec) h+=`<div class="hint">Rust tussen rondes ${fmt(w.rest_sec)}</div>`;
    hd.onclick=e=>{ const b=e.target.closest('[data-ptab]'); if(b) location.replace('#voorbeeld/'+w.id+'/'+b.dataset.ptab); };
  }
  app.innerHTML=h;
  if(w.date>today()){ setBar(`<a class="btn ghost" id="pvback" href="${back}">Starten kan ${w.date===tomorrow()?'morgen':'op '+esc(longDate(w.date))} via Vandaag</a>`); return; }
  setBar(`<a class="btn" id="pvstart" href="#w/${esc(w.id)}">▶ ${statusOf(w)?'Verder met training':'Start training'}</a>`);
  bar.querySelector('#pvstart').onclick=()=>{ unlockAudio(); LS.set('training',1); wake(); };
}

/* ---------- Workout (kracht / thuis / rust) ---------- */
function tabsOf(w){ const T=[]; (w.blocks||[]).forEach((b,bi)=>{ if(isMain(b)) for(let r=1;r<=(w.rounds||1);r++)T.push({key:'r'+r,label:(w.rounds||1)>1?'Ronde '+r:(w.amrap_min?'AMRAP':'Hoofdset'),block:b,round:r});
  else T.push({key:'b'+bi,label:/warm/i.test(b.name)?'Warm-up':/cool/i.test(b.name)?'Cool-down':b.name,block:b,round:1}); }); return T; }
function prevLoad(w,ex){ let best=null; allLogs().forEach(l=>{ if(l.workout_id===w.id||l.date>=w.date)return; (l.sets||[]).forEach(s=>{ if(s.exercise===ex&&s.done&&s.load_done!=null&&(!best||l.date>best.d))best={d:l.date,v:s.load_done}; }); }); return best; }
const num=v=>{const m=String(v??'').match(/\d+([.,]\d+)?/);return m?+m[0].replace(',','.'):null;};
let curW=null;
function viewWorkout(w,tab){
  curW=w||null;
  if(!w){ subHead('','Niet gevonden'); app.innerHTML='<h1>Workout niet gevonden</h1>'; return; }
  if(tab==='samenvatting') return viewSummary(w);
  if(isRun(w)&&tab!=='klaar') return viewRun(w);
  const l=getLog(w), T=tabsOf(w);
  if(tab==='klaar') return viewFinish(w,l);
  let ti=Math.max(0,T.findIndex(t=>t.key===tab)); if(!tab){ const first=T.findIndex(t=>isMain(t.block)); const open=T.findIndex(t=>l.sets.some(s=>s.block===t.block.name&&s.round===t.round&&!s.done)); ti=open>=0?open:(first>=0?first:0); }
  const cur=T[ti]; const go=k=>location.replace('#w/'+w.id+'/'+k);
  const main=cur&&isMain(cur.block), R=w.rounds||1;
  subHead('', w.title); // v15 audit: sectie staat in de tab
  if(T.length>1) hd.insertAdjacentHTML('beforeend',`<div class="tabs" data-noswipe>${T.map((t,i)=>`<button class="${i===ti?'on':''}" data-tab="${t.key}">${esc(t.label)}</button>`).join('')}</div>`);
  const sets=cur?cur.block.items.map(it=>({it,k:l.sets.findIndex(s=>s.block===cur.block.name&&sameEx(s.exercise,it.exercise)&&s.round===cur.round)})).filter(x=>x.k>=0):[];
  const firstOpen=sets.find(x=>!l.sets[x.k].done);
  let h=w.amrap_min&&main?amrapCard(w,l):'';
  const nr=LS.get('nextRound',null); if(nr&&nr.id===w.id&&cur&&cur.key===nr.fromKey&&!firstOpen){ h+=`<div class="card hero" style="text-align:center"><div class="lbl">${esc(nr.from)} klaar</div><div class="big" style="font-size:40px;margin:8px 0">Verder met ${esc(nr.label)}</div><button class="btn" id="gonext">▶ Verder met ${esc(nr.label)}</button></div>`; }
  h+='<div class="card exs">';
  const WBk=new Set(workBlocks(w)); // v15.1: elk set-item in een werkblok (ook alleen reps) krijgt een reps-stepper
  sets.forEach(({it,k})=>{ const s=l.sets[k]; const hasLoad=!!(it.load_range||it.load_default!=null||(it.load_unit&&!it.duration_sec)); const def=itemDur(it); // v15.1: ook zonder startwaarde, en in elk blok (superset)
    const hasReps=!!(it.reps_range||it.reps_default!=null); if(hasReps&&!s.done&&num(s.reps_done)==null&&it.reps_default!=null)s.reps_done=String(it.reps_default); // v15.1: reps_* = eigen reps-stepper
    const unit=it.load_unit||'kg', rc=isRepsU(unit), u2=rc?'':unit.replace(/\s*kg$/,'').trim(); if(rc&&!isRepsU(s.load_unit))s.load_unit='reps';
    const loadTxt=hasLoad&&s.load_done!=null&&s.load_done!==''?(rc?(s.load_done!=null?s.load_done+' reps':''):((u2?u2+'':'')+(s.load_done!=null?s.load_done:'')+' kg')):'';
    const sub=def?(LS.get(itKey(w,k))&&LS.get(itKey(w,k)).start?'Loopt':''):rc?(main&&s.load_done!=null?s.load_done+' reps':(it.reps?it.reps+' reps':'')):[it.reps?(main&&s.reps_done?s.reps_done:it.reps)+(/^\d+$/.test(String(main&&s.reps_done?s.reps_done:it.reps))?' reps':''):'',loadTxt||(it.load_range?it.load_range.join('–')+' kg':'')].filter(Boolean).join(' · ');
    h+=`<div class="ex ${s.done?'done':''} ${firstOpen&&firstOpen.k===k?'active':''}" data-ex="${esc(it.exercise)}" data-k="${k}"><div class="x" data-del="${esc(it.exercise)}">✕<small>Verwijder</small></div><div class="mv">`;
 const ri=isRestItem(it);
    if(def&&!s.done){ const st=LS.get(itKey(w,k)); const dur=st?st.dur:def; const x=itState(st)||{left:dur,run:false};
      h+=`<div class="tim itimer${ri?' ri':''}" data-it="${k}"><button class="play ${x.run?'pause':''}" data-ip="${k}" aria-label="${x.run?'pauze':'start'}">${x.run?'❚❚':'▶'}</button><div class="sp" data-chk="${k}"><div class="nm">${esc(it.exercise)}</div><div class="sub">${esc(sub)}</div></div>
       <button class="clock itl" data-iset="${k}" aria-label="tijd wijzigen">${fmt(Math.ceil(x.left))}</button>${st&&st.start?`<button class="rs" data-ir="${k}" aria-label="reset">↺</button>`:''}</div>`; }
    else h+=`<div class="exr${ri?' ri':''}" data-chk="${k}"><div class="set">${s.done?'✓':''}</div><div class="sp"><div class="nm">${esc(it.exercise)}</div><div class="sub">${esc(ri?fmt(def):hasReps?[s.reps_done?s.reps_done+(/^\d+$/.test(String(s.reps_done))?' reps':''):'',loadTxt].filter(Boolean).join(' · '):rc?(it.reps?it.reps+' reps':''):[it.reps?it.reps+(/^\d+$/.test(String(it.reps))?' reps':''):'',it.load_range?(u2?u2+' ':'')+it.load_range.join('–')+' kg':hasLoad&&!main?loadTxt:''].filter(Boolean).join(' · '))}</div>${it.notes?`<div class="sub">${esc(it.notes)}</div>`:''}${it.alternatives?`<div class="alt">↔ ${esc(it.alternatives)}</div>`:''}</div></div>`;
    if(!def&&!s.done&&((hasLoad||hasReps||(it.reps&&WBk.has(cur.block)))||(main&&firstOpen&&firstOpen.k===k))){ const rn=num(s.reps_done), pv=prevLoad(w,it.exercise); // v15.1: elk open set-item met load/reps toont direct zijn steppers
      h+=`<div class="steps">${hasLoad?`<div class="step" ${rc?'style="grid-column:1/-1"':''}><button data-w="${k}" data-d="-1" aria-label="${rc?'minder reps':'minder gewicht'}" ${+s.load_done<=0?'disabled':''}>−</button><button class="v" data-wt="${k}">${esc(u2?u2:'')}${s.load_done??'–'} ${rc?'reps':'kg'}</button><button data-w="${k}" data-d="1" aria-label="${rc?'meer reps':'meer gewicht'}">+</button></div>`:''}
       ${rc?'':`<div class="step" ${hasLoad?'':'style="grid-column:1/-1"'}><button data-r="${k}" data-d="-1" aria-label="minder reps" ${rn==null||rn<=0?'disabled':''}>−</button><button class="v" data-reps="${k}">${esc(s.reps_done||'–')}${hasReps&&num(s.reps_done)!=null&&/^\d+$/.test(String(s.reps_done))?' reps':''}</button><button data-r="${k}" data-d="1" aria-label="meer reps" ${rn==null?'disabled':''}>+</button></div>`}</div>${pv&&hasLoad?`<div class="prev">Vorige keer ${pv.v} ${rc?'reps':'kg'}</div>`:''}`; }
    h+='</div></div>'; });
  h+='</div>';
  if(sets.length&&!localStorage.getItem('swipeHint')){ localStorage.setItem('swipeHint','1'); sessionStorage.setItem('swipeHintS','1'); } // alleen de eerste sessie
  const showHint=sets.length&&sessionStorage.getItem('swipeHintS'); if(showHint) h+='<div class="hint">⟵ Swipe naar links om te verwijderen</div>';
  if(main&&tipsOf(w).length) h+=`<div class="note">${tipsOf(w).map(esc).join(' · ')}</div>`;
  h+=`<button class="btn red sm" id="reset" style="margin-top:16px">Reset deze workout</button>`;
  app.innerHTML=h;
  const restS=w.rest_sec||90, last=ti>=T.length-1;
  const nextName=()=>{ const n=T[ti+1]; return n?n.label+' · '+(n.block.items[0]||{}).exercise:'Afsluiten'; };
  const label=main?(last?'Ronde klaar · afsluiten':'Ronde klaar · rust '+fmt(restS)):(last?'Afsluiten →':'Volgende →');
  setBar(`<button class="btn" id="next">${label}</button>`);
  const check=k=>{ const s=l.sets[k]; s.done=!s.done; s.ts=new Date().toISOString(); if(!l.started_at)l.started_at=s.ts; saveLog(l);
    if(s.done){ const allDone=l.sets.filter(x=>x.block===s.block&&x.round===s.round).every(x=>x.done);
      // v14.2: geen automatische rust na de laatste oefening; rust start alleen via de oranje knop onderin
      if(allDone&&!main){ const n=T[ti+1]||{key:'klaar',label:'Afsluiten'}; LS.set('nextRound',{id:w.id,key:n.key,label:n.label,from:cur.label,fromKey:cur.key}); return viewWorkout(w,cur.key); } }
    viewWorkout(w,cur.key); };
  const gn=app.querySelector('#gonext'); if(gn) gn.onclick=()=>{ const x=LS.get('nextRound',null); LS.set('nextRound',null); go(x&&x.key||T[ti+1].key); };
  bar.querySelector('#next').onclick=()=>{ LS.set('training',1); wake();
    if(main){ const now=new Date().toISOString(); sets.forEach(({k})=>{ if(!l.sets[k].done){l.sets[k].done=true;l.sets[k].ts=now;} }); if(!l.started_at)l.started_at=now; saveLog(l);
      if(!last){ startRest(restS,nextName(),w.title+' · na '+cur.label.toLowerCase()); restBackTo('#w/'+w.id+'/'+T[ti+1].key); return; } return location.hash='#w/'+w.id+'/klaar'; }
    if(!last)return go(T[ti+1].key); location.hash='#w/'+w.id+'/klaar'; };
  app.onclick=e=>{ const b=e.target.closest('button,[data-chk],[data-del]'); if(!b)return; const d=b.dataset;
    if(d.del!=null){ const exEl=b.closest('.ex'); if(exEl&&exEl.classList.contains('swiping')) return deleteExercise(w,d.del); return; }
    const sw=b.closest('.ex.swiping'); if(sw){ sw.classList.remove('swiping'); sw.querySelector('.mv').style.transform=''; return; }
    if(d.ip!=null){ unlockAudio(); wake(); LS.set('training',1); const key=itKey(w,d.ip); const it=cur.block.items.find(i=>sameEx(i.exercise,l.sets[d.ip].exercise));
      let st=LS.get(key)||{dur:itemDur(it),start:0,pausedAt:0,pausedTotal:0};
      if(!st.start)st.start=Date.now(); else if(st.pausedAt){st.pausedTotal+=Date.now()-st.pausedAt;st.pausedAt=0;} else st.pausedAt=Date.now();
      LS.set(key,st); return viewWorkout(w,cur.key); }
    if(d.ir!=null){ const st=LS.get(itKey(w,d.ir)); if(st)LS.set(itKey(w,d.ir),{dur:st.dur,start:0,pausedAt:0,pausedTotal:0}); return viewWorkout(w,cur.key); }
    if(d.iset!=null) return pickDur(d.iset);
    if(d.w!=null){ const s=l.sets[d.w], it=cur.block.items.find(i=>sameEx(i.exercise,s.exercise)); s.touched=true; const st=it.load_step||(isRepsU(it.load_unit)?1:2.5); s.load_done=Math.max(0,Math.round(((+s.load_done||0)+st*d.d)*10)/10); saveLog(l); return viewWorkout(w,cur.key); }
    if(d.r!=null){ const s=l.sets[d.r], it=cur.block.items.find(i=>sameEx(i.exercise,s.exercise))||{}, rr=it.reps_range; s.touched=true; let n=num(s.reps_done); if(n==null)n=it.reps_default!=null?+it.reps_default:null; if(n==null)return;
      let v=n+(+d.d)*(+it.reps_step||1); v=Math.max(rr?+rr[0]:0,Math.min(rr?+rr[1]:1e4,v)); s.reps_done=String(v); saveLog(l); return viewWorkout(w,cur.key); }
    if(d.wt!=null){ const s=l.sets[d.wt]; s.touched=true; const v=prompt(isRepsU(s.load_unit)?'Aantal reps':'Gewicht in kg',s.load_done??''); if(v!==null&&v.trim()!==''&&!isNaN(+v.replace(',','.'))){s.load_done=+v.replace(',','.');saveLog(l);} return viewWorkout(w,cur.key); }
    if(d.reps!=null){ const s=l.sets[d.reps]; s.touched=true; const v=prompt('Reps gedaan',s.reps_done); if(v!==null){s.reps_done=v.trim();saveLog(l);} return viewWorkout(w,cur.key); }
    if(d.am){ l.amrap_rounds=Math.max(0,(l.amrap_rounds||0)+(+d.am)); saveLog(l); return viewWorkout(w,cur.key); }
    if(b.id==='amgo'){ unlockAudio(); wake(); const k='run:'+w.id; if(!LS.get(k))LS.set(k,{start:Date.now(),pausedAt:0,pausedTotal:0}); return viewWorkout(w,cur.key); }
    if(b.id==='reset'){ if(confirm('Alle voortgang van deze workout wissen?')){ localStorage.removeItem(logKey(w.id)); Object.keys(localStorage).filter(x=>x.startsWith('it:'+w.id+':')).forEach(x=>localStorage.removeItem(x)); localStorage.removeItem('run:'+w.id); saveLog(getLog(w)); viewWorkout(w); } return; }
    if(d.chk!=null) return check(+d.chk);
  };
  hd.onclick=e=>{ const t=e.target.closest('[data-tab]'); if(t)go(t.dataset.tab); };
  const pickDur=k=>{ const key=itKey(w,k), it=cur.block.items.find(i=>sameEx(i.exercise,l.sets[k].exercise)), st=LS.get(key);
    const v=prompt('Tijd (bv. 5, 5:30 of 45s)', fmt(st?st.dur:itemDur(it))); if(!v)return;
    let sec; const t=v.trim().toLowerCase(); if(/s$/.test(t))sec=parseFloat(t); else if(t.includes(':')){const p=t.split(':').map(Number);sec=p[0]*60+p[1];} else sec=parseFloat(t.replace(',','.'))*60;
    if(sec>0){ LS.set(key,{dur:Math.round(sec),start:0,pausedAt:0,pausedTotal:0}); viewWorkout(w,cur.key); } };
  bindSwipeDelete();
  clearInterval(itemT); itemT=setInterval(()=>{ if(!app.querySelector('.itimer'))return; tickItems(w,l,()=>viewWorkout(w,cur.key)); },250);
  if(w.amrap_min){ runT=setInterval(()=>{ const el=app.querySelector('#amclock'); if(!el)return clearInterval(runT); const st=LS.get('run:'+w.id); if(!st)return; const left=w.amrap_min*60-(Date.now()-st.start)/1000; el.textContent=fmt(Math.ceil(Math.max(0,left))); if(left<=0&&!st.done){st.done=true;LS.set('run:'+w.id,st);beep(4);flash(app);} },250); }
}
function amrapCard(w,l){ const st=LS.get('run:'+w.id); const left=st?Math.max(0,w.amrap_min*60-(Date.now()-st.start)/1000):w.amrap_min*60;
  return `<div class="card" style="text-align:center"><div class="lbl">Zoveel mogelijk rondes in ${w.amrap_min} min</div><div class="big3" style="font-size:88px" id="amclock">${fmt(Math.ceil(left))}</div>
  ${st?'':'<button class="btn" id="amgo">Start AMRAP</button>'}
  <div class="step" style="margin-top:12px"><button data-am="-1" aria-label="min één">−</button><div class="v">${l.amrap_rounds||0} rondes</div><button data-am="1" aria-label="plus één">+</button></div></div>`; }
/* swipe-left op oefening -> Verwijder */
function bindSwipeDelete(){ app.querySelectorAll('.ex').forEach(el=>{ const mv=el.querySelector('.mv'); let x0=null,y0=0,dx=0,lock=null;
  el.addEventListener('touchstart',e=>{ if(e.target.closest('.step,button.clock'))return; const t=e.touches[0]; x0=t.clientX; y0=t.clientY; dx=0; lock=null; mv.style.transition='none'; },{passive:true});
  el.addEventListener('touchmove',e=>{ if(x0==null)return; const t=e.touches[0]; dx=t.clientX-x0; const dy=t.clientY-y0; if(lock==null&&(Math.abs(dx)>8||Math.abs(dy)>8))lock=Math.abs(dx)>Math.abs(dy);
    if(lock){ el.classList.add('swiping'); mv.style.transform=`translateX(${Math.max(-120,Math.min(0,dx+(el.dataset.open?-96:0)))}px)`; } },{passive:true});
  el.addEventListener('touchend',()=>{ if(x0==null)return; mv.style.transition=''; x0=null; if(!lock){ return; }
    const open=dx<-50; el.dataset.open=open?'1':''; el.classList.toggle('swiping',open); mv.style.transform=open?'translateX(-96px)':''; swipeBlock=Date.now(); },{passive:true}); }); }
let swipeBlock=0;
function deleteExercise(w,ex){ const before=JSON.parse(JSON.stringify(w)); const nw=JSON.parse(JSON.stringify(w));
  (nw.blocks||[]).forEach(b=>b.items=b.items.filter(i=>i.exercise!==ex));
  applyWorkout(nw,{source:'swipe'},{silentWrite:true});
  undoToast('Verwijderd · '+ex,()=>{ applyWorkout(before,{source:'swipe',undo:true},{silentWrite:true}); route(); toast('Teruggezet'); });
  route(); }
let undoT=null, writeT=null;
function undoToast(txt,undo){ document.querySelectorAll('.utoast').forEach(x=>x.remove()); clearTimeout(undoT);
  const d=document.createElement('div'); d.className='utoast'; d.innerHTML=`<span class="sp">${esc(txt)}</span><button>Ongedaan</button>`; document.body.appendChild(d);
  d.querySelector('button').onclick=()=>{ d.remove(); clearTimeout(undoT); undo(); }; undoT=setTimeout(()=>d.remove(),5000); window.__lastUndo=undo; }

/* ---------- aanpassingen (stem / swipe): override lokaal + veilig naar plan van de trainer ---------- */
function itemsOf(w){ const m={}; (w.blocks||[]).forEach(b=>b.items.forEach(i=>{ m[i.exercise]=i; })); return m; }
const itemTxt=i=>isRepsU(i.load_unit)?[i.load_default!=null?i.load_default+' reps':i.reps&&i.reps+' reps',i.duration_sec&&fmt(i.duration_sec)].filter(Boolean).join(' · '):[i.reps&&(i.reps+(/^\d+$/.test(String(i.reps))?' reps':'')),i.load_default!=null&&((i.load_unit&&/2×/.test(i.load_unit)?'2×':'')+i.load_default+' kg'),i.load_range&&i.load_range.join('–')+' kg',i.duration_sec&&fmt(i.duration_sec)].filter(Boolean).join(' · ');
function diffWorkouts(a,b){ const A=itemsOf(a), B=itemsOf(b), d={verwijderd:[],gewijzigd:[],toegevoegd:[]};
  for(const k in A){ if(!B[k])d.verwijderd.push(k); else if(JSON.stringify(A[k])!==JSON.stringify(B[k]))d.gewijzigd.push({exercise:k,voor:itemTxt(A[k]),na:itemTxt(B[k])}); }
  for(const k in B) if(!A[k])d.toegevoegd.push({exercise:k,na:itemTxt(B[k])});
  if((a.rounds||1)!==(b.rounds||1))d.gewijzigd.push({exercise:'Rondes',voor:String(a.rounds||1),na:String(b.rounds||1)});
  if((a.rest_sec||0)!==(b.rest_sec||0))d.gewijzigd.push({exercise:'Rust',voor:fmt(a.rest_sec||0),na:fmt(b.rest_sec||0)});
  return d; }
function applyWorkout(nw,meta,opt={}){ const old=byId(nw.id)||nw; const diff=diffWorkouts(old,nw);
  const ov=LS.get('overrides',{}); ov[nw.id]={workout:nw,at:new Date().toISOString(),written:false,source:meta.source}; LS.set('overrides',ov);
  const i=PLAN.findIndex(w=>w.id===nw.id); if(i>=0)PLAN[i]=nw; else PLAN.push(nw);
  // log met adjusted_by + diff zodat de trainer het ziet
  const l=getLog(nw); l.adjusted_by='user'; (l.adjustments=l.adjustments||[]).push({at:new Date().toISOString(),by:'user',source:meta.source,undo:!!meta.undo,transcript:meta.transcript||undefined,diff});
  saveLog(l);
  clearTimeout(writeT); writeT=setTimeout(writeOverrides,opt.silentWrite?6000:300);
  return diff; }
async function writeOverrides(){ if(!syncOn()||!navigator.onLine)return; const ov=LS.get('overrides',{});
  for(const id in ov){ const o=ov[id]; if(o.written)continue; const wk=isoWeek(o.workout.date);
    try{ const r=await api('POST',null,{action:'readfile',path:'plan/week-'+wk+'.json'});
      const arr=r&&r.ok&&Array.isArray(r.json)?r.json:null; if(!arr||!arr.some(w=>w.id===id)){ o.written='inbox'; await api('POST',null,{action:'writefile',path:'inbox/'+o.workout.date+'_aanpassing_'+id+'.json',content:{type:'aanpassing',by:'user',at:o.at,workout:o.workout}}); continue; }
      const next=arr.map(w=>w.id===id?o.workout:w);
      const j=await api('POST',null,{action:'writeplan',week:wk,workouts:next}); if(j&&j.ok)o.written=true; }
    catch(e){ console.warn('aanpassing nog niet weggeschreven',e); }
  }
  const cur=LS.get('overrides',{}); for(const id in ov) if(cur[id]&&cur[id].at===ov[id].at)cur[id].written=ov[id].written; LS.set('overrides',cur); }

/* ---------- duur-timers per oefening ---------- */
const itKey=(w,k)=>'it:'+w.id+':'+k;
function itState(st){ if(!st)return null; const now=st.pausedAt||Date.now(); const el=Math.min(st.dur,st.start?(now-st.start-st.pausedTotal)/1000:0); return {el,left:st.dur-el,pct:100*el/st.dur,run:!!st.start&&!st.pausedAt&&el<st.dur}; }

function tickItems(w,l,rerender){ document.querySelectorAll('.itimer').forEach(el=>{ const k=+el.dataset.it, st=LS.get(itKey(w,k)); const x=itState(st); if(!x)return;
  el.querySelector('.itl').textContent=fmt(Math.ceil(x.left));
  if(x.left<=0&&!st.fired){ st.fired=true; LS.set(itKey(w,k),st); beep(); const card=el.closest('.ex'); card.classList.add('fin'); flash(card);
    const s=l.sets[k]; if(!s.done){ s.done=true; s.ts=new Date().toISOString(); saveLog(l); } setTimeout(rerender,1200); } }); }

/* ---------- Afsluiten ---------- */
const RPE_HEAD=`<div class="rpeh lbl" style="font-size:14px"><button class="rl lbl" data-rpeinfo style="font-size:14px;color:var(--ac)">RPE</button>&nbsp;· hoe zwaar voelde het?<button class="info" data-rpeinfo aria-label="Uitleg RPE">i</button></div>`;
function rpeInfo(){ const s=document.createElement('div'); s.innerHTML=`<div class="scrim"></div><div class="card pop" role="dialog"><b class="h" style="font-size:28px">Wat is RPE?</b>
 <div style="font-size:16px;line-height:1.45;margin-top:10px;color:#E6E6EA">Rate of Perceived Exertion: hoe zwaar de training vóelde, van 1 tot 10.</div>
 <div style="margin-top:12px;font-size:15px;line-height:1.6">${[['1–3','licht, kon makkelijk praten'],['4–6','pittig, nog ruim over'],['7–8','zwaar, 2–3 herhalingen over'],['9–10','alles gegeven']].map(([a,b])=>`<div class="row"><b class="num" style="width:56px;color:var(--ac);font-family:var(--cond);font-size:20px">${a}</b><span>${b}</span></div>`).join('')}</div>
 <div class="mu" style="font-size:14px;margin-top:10px">${esc(TRAINER())} gebruikt dit om je volgende training te kiezen.</div><button class="btn" style="margin-top:16px">Begrepen</button></div>`;
  document.body.appendChild(s); s.onclick=e=>{ if(e.target.closest('.btn')||e.target.classList.contains('scrim'))s.remove(); }; }
let finMore=false;
function viewFinish(w,l){
  const run=isRun(w), ru=l.run||{};
  const mainEx=[...new Set((w.blocks||[]).filter(isMain).flatMap(b=>b.items.map(i=>i.exercise)))];
  const ms=l.sets.filter(s=>(w.blocks||[]).some(b=>isMain(b)&&b.name===s.block)), msd=ms.filter(s=>s.done);
  if(!l.status&&msd.length) l.status=msd.length===ms.length?'gedaan':'deels';
  const mins=l.started_at?Math.round((Date.now()-new Date(l.started_at))/6e4):null;
  subHead(heroTitle(w),'Afsluiten','#w/'+w.id);
  const need=l.status==='deels'||l.status==='overgeslagen';
  const mc=(lbl,key,mode,val)=>`<label class="card mcard"><div class="lbl">${lbl}</div><input inputmode="${mode}" data-run="${key}" value="${esc(val??'')}" placeholder="–" aria-label="${lbl}"></label>`;
  let h='';
  if(run){ const pace=ru.duration_min&&ru.distance_km?fmt(ru.duration_min*60/ru.distance_km)+' /km':'–';
    h+=`<div class="lbl" style="margin-bottom:8px">Uit je horloge of ingesproken</div><div class="g2">${mc('Tijd (min)','duration_min','decimal',ru.duration_min)}${mc('Afstand (km)','distance_km','decimal',ru.distance_km!=null?String(ru.distance_km).replace('.',','):'')}${mc('Gem. HR','avg_hr','numeric',ru.avg_hr)}<div class="card mcard"><div class="lbl">Tempo</div><div class="num" style="font-size:34px">${pace}</div></div>${mc('Max HR','max_hr','numeric',ru.max_hr).replace('class="card mcard"','class="card mcard" style="grid-column:span 2"')}</div>
    <label class="card row file" style="margin-top:10px"><span class="sp">📷 Screenshot horloge (optioneel)${l.screenshot?' · ✓ bijgevoegd':''}</span><input type="file" accept="image/*" id="shot" style="width:110px"></label>
`; }
  if(w.type!=='rest') h+=`<details class="card more" ${finMore?'open':''} ontoggle="finMore=this.open"><summary>Meer (optioneel)${ru.elevation_m!=null?' · '+esc(ru.elevation_m)+' hm':''}${(ru.block_paces||[]).length?' · '+ru.block_paces.length+' blokken':''}${l.hrv_ms!=null?' · HRV '+esc(l.hrv_ms):''}${l.resting_hr!=null?' · rust '+esc(l.resting_hr):''}${ru.z2_test?' · Zone 2-test':''}</summary>
     ${run?`<label class="field"><span class="lbl">Hoogtemeters (m)</span><input inputmode="numeric" data-run="elevation_m" value="${esc(ru.elevation_m??'')}" placeholder="bv. 60"></label>`:''}
     ${w.type==='run_tempo'?`<label class="field"><span class="lbl">Tempo per blok (min:sec per km)</span><input data-bp value="${esc((ru.block_paces||[]).map(fmt).join(', '))}" placeholder="bv. 5:30, 5:25, 5:28"></label>`:''}
     ${w.type==='run_z2'?`<label class="field row" style="gap:10px"><input type="checkbox" data-z2test ${ru.z2_test?'checked':''} style="width:24px;height:24px"><span>Dit was mijn wekelijkse Zone 2-test</span></label>`:''}
     <div class="g2" style="margin-top:10px"><label class="field"><span class="lbl">HRV (ms)</span><input inputmode="numeric" data-lf="hrv_ms" value="${esc(l.hrv_ms??'')}" placeholder="–"></label><label class="field"><span class="lbl">Rusthartslag</span><input inputmode="numeric" data-lf="resting_hr" value="${esc(l.resting_hr??'')}" placeholder="–"></label></div></details>`;
  if(w.type!=='rest') h+=`<div style="margin-top:${run?18:0}px">${RPE_HEAD}<div class="rpe">${Array.from({length:10},(_,i)=>`<button data-rpe="${i+1}" class="${l.rpe===i+1?'on':''}">${i+1}</button>`).join('')}</div></div>`;
  if(!run&&w.type!=='rest'&&mainEx.length){ const ld=e=>{ const x=msd.filter(s=>s.exercise===e&&s.load_done!=null).pop(); return x?' · '+x.load_done+' kg':''; };
    h+=`<h2>Per oefening</h2><div class="card" style="padding:12px">${mainEx.map((e,i)=>`<b style="display:block;margin-top:${i?12:0}px">${esc(e)}${ld(e)}</b><div class="fb">${['te licht','goed','te zwaar'].map(f=>`<button data-fb="${esc(e)}" data-v="${f}" class="${l.feedback[e]===f?'on':''}">${cap(f)}</button>`).join('')}</div>`).join('')}</div>`; }
  h+=`<h2>Status</h2><div class="seg3">${['gedaan','deels','overgeslagen'].map(s=>`<button data-status="${s}" class="${l.status===s?'on'+(s==='overgeslagen'?' bad':''):''}">${cap(s)}</button>`).join('')}</div>
   ${need?`<label class="field" style="display:block;margin-top:10px"><span class="lbl">Reden (verplicht)</span><input data-f="skipped_reason" value="${esc(l.skipped_reason)}" placeholder="bv. ziek, geen tijd, blessure"></label>`:''}
   <details class="card" style="margin-top:12px" ${l.notes?'open':''}><summary>Notitie voor ${esc(TRAINER())}</summary><div class="field"><textarea data-f="notes" placeholder="Hoe voelde het?">${esc(l.notes)}</textarea></div></details>`;
  app.innerHTML=h;
  setBar(`<button class="btn" id="save">Opslaan</button>`);
  bar.querySelector('#save').onclick=()=>{ app.querySelectorAll('[data-f]').forEach(i=>l[i.dataset.f]=i.value);
    if(!l.status){ alert('Kies eerst een status.'); return; }
    if((l.status==='deels'||l.status==='overgeslagen')&&!String(l.skipped_reason||'').trim()){ alert('Vul een reden in.'); return; }
    l.finished_at=new Date().toISOString(); saveLog(l); LS.set('training',0); if(WL){WL.release();WL=null;} location.hash='#w/'+w.id+'/samenvatting'; };
  app.onclick=e=>{ if(e.target.closest('[data-rpeinfo]'))return rpeInfo(); const b=e.target.closest('button'); if(!b)return; const d=b.dataset;
    app.querySelectorAll('[data-f]').forEach(i=>l[i.dataset.f]=i.value);
    if(d.status){ l.status=l.status===d.status?'':d.status; saveLog(l); return viewFinish(w,l); }
    if(d.rpe){ l.rpe=+d.rpe; saveLog(l); return viewFinish(w,l); }
    if(d.fb){ l.feedback[d.fb]=d.v; saveLog(l); return viewFinish(w,l); } };
  app.onchange=e=>{ const t=e.target;
    if(t.dataset.f){ l[t.dataset.f]=t.value; saveLog(l); }
    if(t.dataset.run){ l.run=l.run||{}; const v=t.value.replace(',','.').trim(); l.run[t.dataset.run]=v===''||isNaN(+v)?null:+v; saveLog(l); viewFinish(w,l); }
    if(t.dataset.lf){ const v=t.value.replace(',','.').trim(); if(v===''||isNaN(+v))delete l[t.dataset.lf]; else l[t.dataset.lf]=+v; saveLog(l); viewFinish(w,l); }
    if(t.dataset.z2test!=null){ l.run=l.run||{}; if(t.checked)l.run.z2_test=true; else delete l.run.z2_test; saveLog(l); viewFinish(w,l); }
    if(t.dataset.bp!=null){ l.run=l.run||{}; const a=t.value.split(/[,;\s]+/).map(parsePace).filter(x=>x); if(a.length)l.run.block_paces=a; else delete l.run.block_paces; saveLog(l); viewFinish(w,l); }
    if(t.id==='shot'&&t.files[0]) resizeImg(t.files[0]).then(d=>{ l.screenshot=d; saveLog(l); viewFinish(w,l); }); };
}
function resizeImg(file){ return new Promise(res=>{ const img=new Image(); img.onload=()=>{ const m=1080,sc=Math.min(1,m/Math.max(img.width,img.height)); const c=document.createElement('canvas'); c.width=img.width*sc;c.height=img.height*sc; c.getContext('2d').drawImage(img,0,0,c.width,c.height); res(c.toDataURL('image/jpeg',.7)); }; img.src=URL.createObjectURL(file); }); }
function viewSummary(w){ const run=isRun(w); subHead(shortTitle(w),run?'Lekker gelopen!':'Lekker bezig!');
  app.innerHTML=summaryBody(w,false); setBar(`<a class="btn ghost" href="#vandaag">Terug naar Vandaag</a>`); }

/* ---------- Week ---------- */
function viewWeek(){
  appHead('week'); const off=LS.get('weekOff',0), b=new Date(); b.setDate(b.getDate()+off*7); const wk=weekOf(ymd(b)), td=today();
  const sm=(a,z)=>a.slice(5,7)===z.slice(5,7)?`${+a.slice(8)}–${+z.slice(8)} ${MAAND[+z.slice(5,7)-1].slice(0,3)}`:`${+a.slice(8)} ${MAAND[+a.slice(5,7)-1].slice(0,3)} – ${+z.slice(8)} ${MAAND[+z.slice(5,7)-1].slice(0,3)}`;
  // v15 audit: één kopregel met ‹ ›, "Nu" alleen buiten de huidige week; ketting verticaal als daglabel; één regel per rij; pillen alleen voor uitzonderingen
  let h=`<div class="wkhd" data-noswipe><h1>Week ${wkNo(wk[0])}</h1><span class="lbl">${sm(wk[0],wk[6])}${offlineTag()}</span><span class="sp"></span>
   ${off!==0?'<button class="wnav now" data-off="0">Nu</button>':''}<button class="wnav" data-off="-1" aria-label="Vorige week">‹</button><button class="wnav" data-off="1" aria-label="Volgende week">›</button></div>`;
  const S=wk.map(dayState), fill=s=>s==='done'||s==='rest'||s==='free';
  const pill=w=>{ const s=statusOf(w); if(s==='gedaan'||(!ST[s]&&w.type!=='rest'&&w.date<=td&&dayState(w.date)==='done'))return '<span class="st ok" aria-label="Gedaan">✓</span>';
    if(ST[s])return `<span class="st ${ST[s][0]}">${ST[s][1]}</span>`; return w.date===td&&w.type!=='rest'?'<span class="st now">Vandaag</span>':''; };
  h+=`<div class="chain vert" aria-label="Reeks deze week">${wk.map((ds,i)=>{ const ws=PLAN.filter(w=>w.date===ds), w0=ws.find(x=>x.type!=='rest')||ws[0], s=S[i];
    const c=fill(s)?'ok':(s==='miss'||s==='skip')?'miss':'';
    const lk=`<a class="lk ${c} ${fill(s)&&i<6&&fill(S[i+1])?'cn':''} ${ds===td?'today':''}" href="${w0?'#w/'+esc(w0.id):'#week'}" aria-label="${esc(cap(DAG[(i+1)%7]))} ${+ds.slice(8)}/${+ds.slice(5,7)}: ${s==='done'?'gedaan':s==='rest'?'rustdag':s==='free'?'vrij':s==='miss'?'gemist':s==='skip'?'overgeslagen':'open'}"><i>${DAYS[i]}</i></a>`;
    const rows=!ws.length?`<div class="card wl wrest"><span class="sp mu">${PLAN.some(x=>x.date>=ds)?'Rust':'Nog niet gepland'}</span></div>`:ws.map(w=>w.type==='rest'
      ?`<a class="card wl wrest" href="#w/${esc(w.id)}"><span class="sp mu">Rust</span>${pill(w)}</a>`
      :`<a class="card wl ${ds===td?'today':''}" href="#w/${esc(w.id)}"><span class="sp"><b>${esc(shortTitle(w))}</b></span>${pill(w)}</a>`).join('');
    return `<div class="wday">${lk}<div class="wrows">${rows}</div></div>`; }).join('')}</div>`;
  app.innerHTML=h;
  app.onclick=e=>{const o=e.target.closest('[data-off]'); if(!o)return; LS.set('weekOff',o.dataset.off==='0'?0:off+(+o.dataset.off)); viewWeek();};
}

/* ---------- Progressie ---------- */
// type van een log-run: uit het plan (workout_id), anders uit het id-achtervoegsel
function runTypeOf(l){ const w=byId(l.workout_id); if(w&&isRun(w))return w.type; if(/-z2$/.test(l.workout_id))return 'run_z2'; if(/-tempo$/.test(l.workout_id))return 'run_tempo'; return w?w.type:null; }
const dec2=v=>v.toFixed(2).replace('.',',');
const Z2_DEFAULT=120; // min/week als het plan geen Zone 2 voor die week bevat
function z2Planned(wk){ return PLAN.filter(w=>w.type==='run_z2'&&isoWeek(w.date)===wk).reduce((a,w)=>a+(w.duration_min||(w.blocks||[]).flatMap(b=>b.items||[]).reduce((s,i)=>s+((itemDur(i)||0)/60),0)),0); }
const parsePace=s=>{ const m=String(s).trim().match(/^(\d{1,2})[:.](\d{2})$/); return m?+m[1]*60+ +m[2]:null; };
/* ---------- v14.4: belasting · herstel · basis ---------- */
// TRIMP met 140 bpm als anker: per sessie duur_min × e^(1,92 × (gem.HR − 140) / (HRmax − HRrust)). 1 min op 140 bpm = 1 punt.
const HR_ANCHOR=140, HR_MAX_DEF=194, HR_REST_DEF=60, Z2_TEST_DEF='8:00', Z2_TEST_TOL=20;
const addDays=(ds,n)=>{ const d=new Date(ds+'T12:00'); d.setDate(d.getDate()+n); return ymd(d); };
const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const median=a=>{ if(!a.length)return null; const s=[...a].sort((x,y)=>x-y), m=s.length>>1; return s.length%2?s[m]:(s[m-1]+s[m])/2; };
function healthDays(){ const H={}; Object.entries(LS.get('health',{})||{}).forEach(([k,v])=>{ if(v&&typeof v==='object')H[k]={...v}; });
  allLogs().forEach(l=>{ const hv=num(l.hrv_ms), rh=num(l.resting_hr); if(hv==null&&rh==null)return;   // optionele logvelden als aanvulling
    const d=H[l.date]=H[l.date]||{date:l.date,hrv_samples:[],workouts:[]}; if(hv>0&&!(d.hrv_samples||[]).length)d.hrv_manual=hv; if(rh>0&&d.resting_hr==null)d.resting_hr=rh; });
  return H; }
// nacht/ochtend: metingen vóór 10:00 (lokale tijd) hebben voorrang; de avondpoging stuurt ook overdag-metingen mee
function dayHrv(d){ const all=((d&&d.hrv_samples)||[]).filter(x=>+x.sdnn_ms>0), am=all.filter(x=>x.ts&&new Date(x.ts).getHours()<10), s=(am.length?am:all).map(x=>+x.sdnn_ms); return s.length?mean(s):(d&&d.hrv_manual>0?d.hrv_manual:null); }
function hrRest(H,ds){ const v=[]; for(let i=0;i<28;i++){ const d=H[addDays(ds,-i)]; if(d&&d.resting_hr>0)v.push(+d.resting_hr); } return median(v)||HR_REST_DEF; }
function hrMax(){ let m=HR_MAX_DEF; allLogs().forEach(l=>{ const x=num(l.run&&l.run.max_hr); if(x>m&&x<230)m=x; }); return m; }
const trimp=(min,hr,rest,max)=>min>0&&hr>0?min*Math.exp(1.92*(hr-HR_ANCHOR)/Math.max(20,max-rest)):0;
function dayTrimp(H,ds,mx){ const rest=hrRest(H,ds), d=H[ds], hw=((d&&d.workouts)||[]).filter(w=>+w.avg_hr>0&&+w.duur_min>0);
  if(hw.length)return hw.reduce((a,w)=>a+trimp(+w.duur_min,+w.avg_hr,rest,mx),0);          // horloge/Gezondheid heeft voorrang
  return allLogs().filter(l=>l.date===ds&&l.status!=='overgeslagen'&&l.run&&+l.run.avg_hr>0&&+l.run.duration_min>0).reduce((a,l)=>a+trimp(+l.run.duration_min,+l.run.avg_hr,rest,mx),0); }
// ochtend-HRV als % van de persoonlijke baseline: gemiddelde 7 dagen / gemiddelde 28 dagen (min. 3 resp. 10 ochtenden)
function hrvPct(H,ds){ const v7=[],v28=[]; for(let i=0;i<28;i++){ const x=dayHrv(H[addDays(ds,-i)]); if(x==null)continue; v28.push(x); if(i<7)v7.push(x); }
  return v7.length>=3&&v28.length>=10?{pct:100*mean(v7)/mean(v28),n7:v7.length,n28:v28.length}:null; }
const weekEnd=ds=>addDays(weekOf(ds)[0],6), lastWeeks=n=>{ const t=today(), out=[]; for(let i=n-1;i>=0;i--)out.push(weekOf(addDays(t,-7*i))[0]); return out; };
function z2TestPace(){ const w=PLAN.find(x=>x.z2_test_pace); return parsePace(w?w.z2_test_pace:Z2_TEST_DEF)||480; }
// wekelijkse Zone 2-test: HR bij vast tempo. Per week de run die als test is gemarkeerd, anders de langste Zone 2-run (≥20 min) binnen ±20 s/km van het testtempo; lineair omgerekend naar het testtempo.
function z2Tests(P,logs){ const by={}; (logs||allLogs()).filter(l=>runTypeOf(l)==='run_z2'&&l.status!=='overgeslagen'&&l.run&&+l.run.duration_min>=20&&+l.run.distance_km>0&&+l.run.avg_hr>0).forEach(l=>{
    const pace=l.run.duration_min*60/l.run.distance_km; if(Math.abs(pace-P)>Z2_TEST_TOL&&!l.run.z2_test)return; const wk=weekOf(l.date)[0], c=by[wk];
    const x={d:l.date,pace,hr:l.run.avg_hr*pace/P,raw:+l.run.avg_hr,mark:!!l.run.z2_test,min:+l.run.duration_min};
    if(!c||(x.mark&&!c.mark)||(x.mark===c.mark&&x.min>c.min))by[wk]=x; }); return by; }
function spark(vals,goodUp){ const v=vals.map(x=>x==null?null:+x), ok=v.filter(x=>x!=null); if(ok.length<1)return '<svg class="spk" viewBox="0 0 96 30"></svg>';
  const lo=Math.min(...ok), hi=Math.max(...ok), X=i=>4+i*(88/Math.max(1,v.length-1)), Y=x=>hi===lo?15:26-(x-lo)/(hi-lo)*22;
  const pts=v.map((x,i)=>x==null?null:X(i).toFixed(1)+','+Y(x).toFixed(1)).filter(Boolean);
  const last=v.length-1-[...v].reverse().findIndex(x=>x!=null);
  return `<svg class="spk" viewBox="0 0 96 30" aria-hidden="true">${pts.length>1?`<polyline points="${pts.join(' ')}"/>`:''}<circle cx="${X(last).toFixed(1)}" cy="${Y(v[last]).toFixed(1)}" r="3.2"/></svg>`; }
const arrow=(d,goodUp)=>d==null?'<span class="ar mu">·</span>':d===0?'<span class="ar mu">=</span>':`<span class="ar ${(d>0)===goodUp?'ok':'bad'}">${d>0?'▲':'▼'}</span>`;
function bodyCard(runs){ const H=healthDays(), t=today(), mx=hrMax(), W8=lastWeeks(8);
  // 1) belasting
  const wkT=W8.map(w=>{ let s=0; for(let i=0;i<7;i++){ const ds=addDays(w,i); if(ds<=t)s+=dayTrimp(H,ds,mx); } return s; });
  const prev=wkT.slice(-4,-1).filter(x=>x>0), cur=wkT[wkT.length-1], prevAvg=prev.length?mean(prev):null, tToday=dayTrimp(H,t,mx);
  // v15: de week loopt nog. Ma–wo alleen een pijl omhoog als je de hele vorige week al voorbij bent; daarna naar rato van de verstreken dagen
  const dw=(new Date(t+'T12:00').getDay()+6)%7+1, exp=prevAvg==null?null:prevAvg*dw/7;
  const dLoad=prevAvg==null?null:dw<4?(cur>prevAvg*1.1?1:null):cur>exp*1.1?1:cur<exp*0.9?-1:0, anyLoad=wkT.some(x=>x>0);
  // 2) herstel (HRV % baseline)
  const hdays=Object.keys(H).filter(k=>dayHrv(H[k])!=null).sort(), nH=hdays.filter(k=>k>addDays(t,-28)).length;
  const wkH=W8.map(w=>{ for(let i=6;i>=0;i--){ const ds=addDays(w,i); if(ds>t)continue; const r=hrvPct(H,ds); if(r)return r.pct; } return null; });
  const hNow=(()=>{ for(let i=0;i<7;i++){ const r=hrvPct(H,addDays(t,-i)); if(r)return r; } return null; })();
  const dRec=hNow?(hNow.pct>=103?1:hNow.pct<=97?-1:0):null;
  // 3) rusthartslag
  const rdays=Object.keys(H).filter(k=>H[k].resting_hr>0).sort(), lastR=rdays.length?H[rdays[rdays.length-1]]:null;
  const wkR=W8.map(w=>{ const v=[]; for(let i=0;i<7;i++){ const d=H[addDays(w,i)]; if(d&&d.resting_hr>0)v.push(+d.resting_hr); } return v.length?mean(v):null; });
  const base28=median(rdays.filter(k=>k>addDays(t,-28)).map(k=>+H[k].resting_hr)), rNowWk=wkR[wkR.length-1];
  const dRhr=rNowWk!=null&&base28!=null&&rdays.length>=5?(rNowWk<=base28-1?-1:rNowWk>=base28+1?1:0):null;
  // 4) basis: Zone 2-test
  const P=z2TestPace(), Z=z2Tests(P), wkZ=W8.map(w=>Z[w]?Z[w].hr:null), zk=Object.keys(Z).sort(), zl=zk.length?Z[zk[zk.length-1]]:null, zp=zk.length>1?Z[zk[zk.length-2]]:null;
  const dZhr=zl&&zp?(zl.hr<=zp.hr-1?-1:zl.hr>=zp.hr+1?1:0):null, dBase=dZhr==null?null:-dZhr; // pijl = richting van de HR; lager bij zelfde tempo = beter (groen)
  const row=(lbl,val,sub,sp,ar,empty)=>`<div class="mrow${empty?' empty':''}"><div class="sp"><div class="lbl">${lbl}</div>${empty?`<div class="mu mt">${empty}</div>`:`<div class="num mv">${val}</div>${sub?`<div class="mu ms">${sub}</div>`:''}`}</div>${empty?'':sp+ar}</div>`;
  const verdict=(()=>{ const k=[dLoad,dRec,dBase]; if(k.filter(x=>x!=null).length<2)return 'Nog te weinig data voor een totaalbeeld.';
    if(dLoad===1&&dRec===-1)return 'Belasting stijgt terwijl je herstel daalt: houd het deze week rustig.';
    if(dRec===-1&&dRhr===1)return 'Herstel en rusthartslag wijzen op vermoeidheid.';
    if((dLoad==null||dLoad>=0)&&(dRec==null||dRec>=0)&&(dBase==null||dBase>=0))return 'Belasting, herstel en basis gaan dezelfde kant op.';
    return 'Gemengd beeld: kijk per regel wat afwijkt.'; })();
  let h=`<div class="card body3"><div class="lbl">Belasting · herstel · basis</div><div class="vd">${verdict}</div>`;
  h+=row('Belasting · TRIMP week',anyLoad?Math.round(cur):'','vandaag '+Math.round(tToday)+' · anker 140 bpm',spark(wkT),arrow(dLoad,true),anyLoad?'':'Nog geen sessies met hartslag.');
  h+=row('Herstel · HRV',hNow?Math.round(hNow.pct)+'%':'',hNow?'van je baseline (7 d vs 28 d) · '+hNow.n28+' ochtenden':'',spark(wkH),arrow(dRec,true),hNow?'':(nH?`Verschijnt na 10 ochtenden met HRV (nu ${nH}).`:'Nog geen HRV. Zet de Opdracht ‘VOLGAS Gezondheid’ aan.'));
  h+=row('Rusthartslag',lastR?Math.round(lastR.resting_hr)+' <small class="mu">bpm</small>':'',lastR?(base28!=null&&rdays.length>=5?'28 d mediaan '+Math.round(base28):'')+(lastR.date!==t?' · '+(+lastR.date.slice(8))+'/'+(+lastR.date.slice(5,7)):''):'',spark(wkR),arrow(dRhr,false),lastR?'':'Nog geen rusthartslag.');
  h+=`</div>`;
  h+=`<div class="card"><div class="row"><div class="sp"><div class="lbl">Zone 2-test · ${fmt(P)} /km</div>${zl?`<div class="num" style="font-size:40px">${Math.round(zl.hr)} <small class="mu" style="font-size:16px">bpm</small></div>`:''}</div>${zl?spark(wkZ)+arrow(dZhr,false):''}</div>
   <div class="mu" style="font-size:13px;margin-top:4px">${zl?`Wekelijkse check: hartslag bij vast tempo (lager = betere basis). Laatste: ${+zl.d.slice(8)}/${+zl.d.slice(5,7)}, ${fmt(zl.pace)} /km bij ${Math.round(zl.raw)} bpm${zl.mark?' · test':''}.`:`Eén keer per week: loop een Zone 2-run op ± ${fmt(P)} /km (±${Z2_TEST_TOL} s). De app pakt die automatisch.`}</div></div>`;
  return h; }
function runProgress(){ let h='';
  const runs=allLogs().filter(l=>isMeaningful(l)&&l.status!=='overgeslagen'&&l.run&&(l.run.distance_km||l.run.duration_min)).sort((a,b)=>a.date.localeCompare(b.date));
  h+=bodyCard(runs);
  if(!runs.length) return h+`<div class="card mu">Nog geen loopsessies met tijd of afstand.</div>`;
  const z2=runs.filter(l=>runTypeOf(l)==='run_z2');
  // b) Zone 2-minuten per week met doellijn
  const curWk=isoWeek(today()), wkSet=new Set([...z2.map(l=>isoWeek(l.date)),curWk]); const zw=[...wkSet].sort().slice(-6);
  const zv=zw.map(k=>{ const act=z2.filter(l=>isoWeek(l.date)===k).reduce((a,l)=>a+(+l.run.duration_min||0),0), pl=z2Planned(k); return {k,act,goal:pl>0?Math.round(pl):Z2_DEFAULT,fromPlan:pl>0}; });
  const zmx=Math.max(...zv.map(x=>Math.max(x.act,x.goal)))*1.1||1, zc=zv[zv.length-1];
  h+=`<div class="card chart"><div class="row"><div class="sp"><div class="lbl">Zone 2 · deze week</div><div class="num" style="font-size:40px">${Math.round(zc.act)} <small class="mu" style="font-size:16px">/ ${zc.goal} min</small></div></div></div>
   <div class="bars z2b">${zv.map((x,i)=>`<div class="col ${i===zv.length-1?'hi':''}"><b style="height:${Math.max(3,100*x.act/zmx)}%"></b><i class="goal" style="bottom:calc(${100*x.goal/zmx}% - 1px)" title="doel ${x.goal} min"></i></div>`).join('')}</div>
   <div class="axis z2a">${zv.map(x=>`<span>wk ${+x.k.split('-W')[1]}</span>`).join('')}</div>
   <div class="mu" style="font-size:12px;margin-top:6px">Lijn = doel ${zc.fromPlan?'uit het plan':'(standaard '+Z2_DEFAULT+' min/week)'}</div></div>`;
  // c) tempo-intervallen apart: gemiddeld tempo per blok, alleen tegen eerdere tempo-sessies
  const tp=runs.filter(l=>runTypeOf(l)==='run_tempo').map(l=>{ const bp=(l.run.block_paces||[]).filter(x=>+x>0), r=l.run;
    return {d:l.date,blocks:bp.length,p:bp.length?bp.reduce((a,b)=>a+b,0)/bp.length:(r.distance_km&&r.duration_min?r.duration_min*60/r.distance_km:null)}; }).filter(x=>x.p);
  if(tp.length){ const lt=tp[tp.length-1], earlier=tp.slice(0,-1), avgE=earlier.length?earlier.reduce((a,x)=>a+x.p,0)/earlier.length:null, dd=avgE?Math.round(avgE-lt.p):null;
    h+=`<div class="card"><div class="row"><div class="sp"><div class="lbl">Tempo-intervallen</div><div class="num" style="font-size:40px">${fmt(lt.p)} <small class="mu" style="font-size:16px">/km ${lt.blocks?'per blok':'hele sessie'}</small></div></div>${dd!=null?`<div class="${dd>0?'ok':'mu'}">${dd>0?'▲ '+dd+' s sneller':dd<0?'▼ '+(-dd)+' s trager':'='}</div>`:''}</div>
     <div class="mu" style="font-size:13px;margin-top:4px">${earlier.length?'Vergeleken met '+earlier.length+' eerdere tempo-sessie'+(earlier.length>1?'s':''):'Eerste tempo-sessie; vergelijking volgt na de volgende.'}${lt.blocks?'':' Vul bij afsluiten je bloktempo’s in voor tempo per blok.'}</div>
     ${tp.length>1?`<div class="effl">${tp.slice(-4).reverse().map(x=>`<span><b>${fmt(x.p)}</b> ${+x.d.slice(8)}/${+x.d.slice(5,7)}</span>`).join('')}</div>`:''}</div>`; }
  const m=today().slice(0,7), km=runs.filter(l=>l.date.startsWith(m)).reduce((a,l)=>a+(+l.run.distance_km||0),0), longest=Math.max(...runs.map(l=>+l.run.distance_km||0));
  h+=`<div class="card exs"><div class="li"><span class="sp">Km deze maand</span><b class="num" style="font-size:22px">${String(Math.round(km*10)/10).replace('.',',')} km</b></div><div class="li"><span class="sp">Langste run</span><b class="num" style="font-size:22px">${String(longest).replace('.',',')} km</b></div><div class="li"><span class="sp">Sessies</span><b class="num" style="font-size:22px">${runs.length}</b></div></div>
   <h2>Laatste loopsessies</h2><div class="card exs">${runs.slice(-8).reverse().map(l=>{const r=l.run,w=byId(l.workout_id);return `<div class="li"><span class="sp"><b>${+l.date.slice(8)}/${+l.date.slice(5,7)}</b> · ${esc(w?heroTitle(w):{run_z2:'Zone 2',run_tempo:'Tempo-intervallen'}[runTypeOf(l)]||l.workout_id)}</span><span class="mu" style="font-size:14px">${r.distance_km!=null?esc(String(r.distance_km).replace('.',','))+' km':''}${r.duration_min!=null?' · '+Math.round(r.duration_min)+'′':''}${r.avg_hr?' · ♥ '+esc(r.avg_hr):''}</span></div>`}).join('')}</div>`;
  return h; }

function viewProg(k){ appHead('progressie'); k=k==='hardlopen'?'hardlopen':(k||LS.get('progTab','kracht')); LS.set('progTab',k);
  let h=`<div class="seg3" style="grid-template-columns:1fr 1fr;margin:8px 0 12px" data-noswipe><a class="btn ${k==='kracht'?'':'ghost'} sm" href="#progressie/kracht">Kracht</a><a class="btn ${k==='hardlopen'?'':'ghost'} sm" href="#progressie/hardlopen">Hardlopen</a></div>`;
  if(k==='kracht'){ const data={}, meta={};
    allLogs().sort((a,b)=>a.date.localeCompare(b.date)).forEach(l=>(l.sets||[]).forEach(s=>{ if(!s.done||s.load_done==null||s.load_done==='')return; const wk=isoWeek(l.date);
      (data[s.exercise]??={})[wk]=Math.max(data[s.exercise][wk]||0,+s.load_done); (meta[s.exercise]??=[]).push({d:l.date,v:+s.load_done,r:s.reps_done,u:s.load_unit}); }));
    const ex=Object.keys(data).sort((a,b)=>meta[b].length-meta[a].length);
    if(!ex.length) h+=`<div class="card mu">Nog geen afgevinkte sets met gewicht. Na je eerste krachttraining verschijnt hier je progressie.</div>`;
    ex.forEach((e,ei)=>{ const wks=Object.keys(data[e]).sort().slice(-8), vals=wks.map(x=>data[e][x]), mx=Math.max(...vals), mn=Math.min(...vals), lastV=vals[vals.length-1], delta=lastV-vals[0];
      const two=/2×/.test((meta[e].slice(-1)[0]||{}).u||''), U=isRepsU((meta[e].slice(-1)[0]||{}).u)?'reps':'kg';
      h+=`<div class="card"><div class="row"><div class="sp"><div class="lbl">${esc(e)}</div><div class="num" style="font-size:${ei?30:40}px">${two?'2×':''}${lastV} ${U}</div></div><div class="${delta>0?'ok':'mu'}">${delta>0?'▲ +'+Math.round(delta*10)/10+' '+U:delta<0?'▼ '+Math.round(delta*10)/10+' '+U:'='}</div></div>
       <div class="bars" style="height:${ei?70:110}px">${vals.map((v,i)=>`<div class="${i===vals.length-1?'hi':''}" style="height:${mx===mn?60:15+85*(v-mn)/(mx-mn)}%"></div>`).join('')}</div>
       <div class="axis">${wks.map(x=>`<span>wk ${+x.split('-W')[1]}</span>`).join('')}</div></div>`; });
  } else h+=runProgress();
  app.innerHTML=h;
}

/* ---------- Loopsessie (Zone 2 / tempo-intervallen) ---------- */
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
  let lastI=state().i; const z2=w.type==='run_z2';
  // v15 audit: per herhaling één rij ("1 · 3:00 hard · 2:00 herstel"); opnieuw / volgende / afsluiten klein in de timerkaart, ▶ Start is de hoofdknop
  const groups=[]; P.forEach((q,i)=>{ if(q.work)groups.push({rep:q.rep,ix:[i],txt:`${q.rep} · ${fmt(q.sec)} hard`}); else if(q.name==='Herstel'&&groups.length&&groups[groups.length-1].rep){ const g=groups[groups.length-1]; g.ix.push(i); g.txt+=` · ${fmt(q.sec)} herstel`; } else groups.push({ix:[i],txt:q.name,sec:q.sec}); });
  const ctl=(s,p)=>`<div class="rctl"><button class="lnk2" id="rst">Opnieuw</button><button class="lnk2" id="skip" ${!st||s.i>=P.length?'disabled':''}>${z2?'Stop':(p&&p.work?'Herhaling klaar':'Volgende blok')}</button><a class="lnk2" href="#w/${esc(w.id)}/klaar">Afsluiten</a></div>`;
  subHead(z2?(durOf(w)?durOf(w)+' min':''):ivTxt(w), heroTitle(w));
  app.innerHTML=`<div id="runbody"></div>`; const body=app.querySelector('#runbody');
  function draw(){ const s=state(); if(s.i!==lastI){ beep(s.i>=P.length?4:2, P[s.i]&&P[s.i].work?1046:660); flash(app); lastI=s.i; if(s.i>=P.length&&st&&!st.done){st.done=true;LS.set(k,st);} }
    const p=P[s.i], pct=100*s.el/total; let h='';
    if(z2) h+=`<div class="card hero" style="text-align:center"><div class="lbl">Doel-hartslag</div><div class="big" style="font-size:64px">${esc(w.hr_target||'130–140')}</div><div style="font-size:14px;color:#2A1206">${esc((w.blocks?.[0]?.items?.[0]?.notes)||'Praattest: je kunt hele zinnen praten.')}</div></div>
      <div class="g2"><div class="card" style="margin:0;text-align:center"><div class="lbl">Verstreken</div><div class="num" style="font-size:44px">${fmt(s.el)}</div></div><div class="card" style="margin:0;text-align:center"><div class="lbl">Resterend</div><div class="num" style="font-size:44px">${fmt(total-s.el)}</div></div></div><div class="ring" style="margin:14px 0"><i style="width:${pct}%"></i></div>`;
    else h+=`<div class="card" style="text-align:center;padding:22px 16px"><div class="lbl">${p?esc(p.name):'Klaar!'}</div><div class="big3">${fmt(Math.ceil(s.left))}</div><div style="font-size:18px">${esc(p?p.hint:'Goed gedaan. Vul je gegevens in.')}</div><div class="ring" style="margin:12px 0 6px"><i style="width:${pct}%"></i></div><div class="mu" style="font-size:13px">Totaal ${fmt(s.el)} / ${fmt(total)}</div>${ctl(s,p)}</div>
      <div class="card exs">${groups.map(g=>{ const on=g.ix.includes(s.i), dn=g.ix.every(i=>i<s.i); return `<div class="li" style="min-height:52px;${on&&g.rep?'color:var(--ac);font-weight:700':''}"><span class="sp">${dn?'✓ ':''}${esc(g.txt)}</span>${g.rep?'':`<span class="mu">${fmt(g.sec)}</span>`}</div>`; }).join('')}</div>`;
    if(z2) h+=`<div class="card" style="padding:10px 12px">${ctl(s,p)}</div>`;
    body.innerHTML=h;
    setBar(s.i>=P.length?`<a class="btn" href="#w/${esc(w.id)}/klaar">Klaar · afsluiten</a>`:`<button class="btn" id="go">${!st?'▶ Start':st.pausedAt?'▶ Verder':'❚❚ Pauze'}</button>`); }
  const onClick=e=>{ const id=(e.target.closest('[id]')||{}).id;
    if(id==='go'){ unlockAudio(); wake(); if(!st)st={start:Date.now(),pausedAt:0,pausedTotal:0}; else if(st.pausedAt){st.pausedTotal+=Date.now()-st.pausedAt;st.pausedAt=0;} else st.pausedAt=Date.now(); LS.set(k,st); draw(); }
    if(id==='skip'&&st){ const s=state(); if(s.i<P.length){ st.start-=s.left*1000; LS.set(k,st); draw(); } }
    if(id==='rst'&&confirm('Sessietimer opnieuw starten?')){ st=null; localStorage.removeItem(k); lastI=0; draw(); } };
  app.onclick=onClick; bar.onclick=onClick;
  runT=setInterval(()=>{ if(!location.hash.startsWith('#w/'+w.id)||/\/(klaar|samenvatting)$/.test(location.hash)){bar.onclick=null;return clearInterval(runT);} draw(); },500); draw();
}

/* ---------- Profiel (bottom-sheet) ---------- */
let sheetEl=null;
function closeSheet(){ if(sheetEl){ sheetEl.remove(); sheetEl=null; } }
function openProfile(){ ACC.openSheet(); }

/* ---------- Instellingen (koppeling via magic link; geen tokenveld) ---------- */
function viewSettings(){
  subHead('','Instellingen');
  const q=LS.get('queue',[]).length, linked=syncOn(), acc=ACC.active(), last=(String(serverLogsState).match(/\((\d\d:\d\d)\)/)||[])[1];
  const sub=`Sync aan · ${q} in wachtrij${last?' · laatst '+last:''}${serverLogsState&&!/^ok/.test(serverLogsState)?' · logs: '+esc(serverLogsState):''}`;
  app.innerHTML=`${linked?`<div class="card row"><span class="sp"><b>Koppeling met ${esc(TRAINER())}</b><div class="mu" id="res" style="font-size:14px">${sub}</div></span><b class="ok">Gekoppeld ✓</b></div>`
   :`<h1>Koppel de app</h1><div class="note">Open de koppellink die je van ${esc(TRAINER())} kreeg. Of kopieer hem en tik op <b>Plakken &amp; koppelen</b>.</div>
   <button class="btn" id="paste">📋 Plakken &amp; koppelen</button>
   <details class="card"><summary>Plakken lukt niet?</summary><div class="field"><input id="link" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Houd ingedrukt → Plak"></div><button class="btn ghost sm" id="linkgo" style="margin-top:8px">Koppel</button></details>
   <div class="card mu" id="res" style="font-size:14px">Sync staat uit (niet gekoppeld) · ${q} in wachtrij</div>`}
   <div class="g2"><button class="btn ghost sm" id="refresh" ${linked?'':'disabled'}>Vernieuwen</button><button class="btn ghost sm" id="diag">Diagnose</button></div>
   <pre class="card diag" id="dout" hidden></pre><button class="btn ghost sm" id="copy" hidden>Kopieer</button>
   <a class="card row" href="#aftrap/1" style="text-decoration:none;color:inherit"><span class="sp"><b>Aftrap opnieuw doen</b></span><span class="mu">›</span></a>
   ${acc?`<div class="card" id="htok"><b>Sleutel voor de iOS-Opdracht</b><div class="mu" style="font-size:14px;margin-top:4px">Voor de Opdracht "VOLGAS Gezondheid". Je ziet de sleutel één keer; een nieuwe sleutel maakt de oude ongeldig.</div><button class="btn ghost sm" id="htgo" style="margin-top:10px">Maak sleutel</button></div>`:''}
   <div class="card"><div class="lbl">Versie</div><b style="font-size:18px">${VLABEL}</b><div class="mu" id="swv" style="font-size:14px">service worker: …</div></div>
   ${linked&&!acc?'<button class="btn red sm" id="clr">Koppeling wissen</button>':''}`;
  swVersion().then(v=>{const el=app.querySelector('#swv'); if(el)el.textContent='service worker: '+v;});
  const val=()=>{ const st=LS.get('cfg',{}); return {API_URL:st.API_URL||CFG.API_URL||'',TOKEN:st.TOKEN||CFG.TOKEN||''}; };
  const link=async txt=>{ const v=parseLink(txt); const r=app.querySelector('#res');
    if(!v){ r.textContent='✗ Geen geldige koppellink (moet #k=… bevatten)'; return; } if(!v.API_URL){ r.textContent='✗ Geen API-URL in link of config'; return; }
    if(saveSettings(v)) toast('Gekoppeld ✓'); };
  app.onclick=async e=>{ const id=e.target.id, r=app.querySelector('#res');
    if(id==='paste'){ try{ const t=await navigator.clipboard.readText(); return link(t); }catch(err){ r.textContent='Plakken lukt niet automatisch: open "Plakken lukt niet?" en houd het veld ingedrukt → Plak.'; const d=app.querySelector('details'); if(d)d.open=true; return; } }
    if(id==='linkgo') return link(app.querySelector('#link').value);
    if(id==='clr'&&confirm('Koppeling wissen? (logs blijven bewaard)')){ localStorage.removeItem('cfg'); location.reload(); }
    if(id==='diag') return diagnose(val());
    if(id==='htgo'){ if(!confirm('Nieuwe sleutel maken? Een oude sleutel in de Opdracht werkt daarna niet meer.'))return; e.target.disabled=true; e.target.textContent='Bezig…';
      const x=await api('POST',null,{action:'healthtoken'},CFG,1).catch(()=>null); const box=app.querySelector('#htok');
      if(!x||!x.ok||!x.health_token){ e.target.disabled=false; e.target.textContent='Maak sleutel'; return toast('Lukt niet: '+((x&&x.error)||'geen verbinding')); }
      box.innerHTML=`<b>Sleutel voor de iOS-Opdracht</b><div class="mu" style="font-size:14px;margin:4px 0 8px">Plak deze in de Opdracht bij "token". Hij wordt niet nog eens getoond.</div><pre class="card diag" id="htv" style="user-select:all;white-space:pre-wrap;word-break:break-all">${esc(x.health_token)}</pre><button class="btn ghost sm" id="htcp">Kopieer</button>`; return; }
    if(id==='htcp'){ const t=app.querySelector('#htv').textContent; try{ await navigator.clipboard.writeText(t); }catch(err){} e.target.textContent='✓ Gekopieerd'; return; }
    if(id==='refresh'){ e.target.textContent='Bezig…'; await loadPlan(); await loadServerLogs(); await flush(); await writeOverrides(); return viewSettings(); }
    if(id==='copy'){ const t=app.querySelector('#dout').textContent; try{ await navigator.clipboard.writeText(t); e.target.textContent='✓ Gekopieerd'; }catch(err){ const ta=document.createElement('textarea'); ta.value=t; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); e.target.textContent='✓ Gekopieerd'; } return; } };
  app.querySelector('#link')?.addEventListener('paste',e=>setTimeout(()=>{ if(parseLink(e.target.value))link(e.target.value); },50));
}
function saveSettings(v){
  const r=app.querySelector('#res');
  if(v.API_URL&&!/^https:\/\//.test(v.API_URL)){ alert('URL moet met https:// beginnen'); return false; }
  const ok=saveCfg(v);
  if(!ok){ if(r)r.textContent='✗ Opslaan mislukt (opslag vol of geblokkeerd?)'; return false; }
  sessionStorage.removeItem('cfgDraft'); syncLabel(); viewSettings();
  const r2=app.querySelector('#res'); if(r2)r2.textContent='✓ Gekoppeld · sync aan · bezig met synchroniseren…';
  (async()=>{ await loadPlan(); await loadServerLogs(); await flush(); if((location.hash||'').includes('instellingen'))viewSettings(); })();
  return true;
}
// synchroon opslaan, teruglezen ter controle, CFG direct bijwerken (geen reload nodig)
function saveCfg(v){
  const prev=LS.get('cfg',{}); const next={API_URL:v.API_URL||'',TOKEN:v.TOKEN||prev.TOKEN||''};
  try{ localStorage.setItem('cfg',JSON.stringify(next)); }catch(e){ return false; }
  const back=LS.get('cfg',{}); if(back.API_URL!==next.API_URL||back.TOKEN!==next.TOKEN)return false;
  CFG.API_URL=next.API_URL; CFG.TOKEN=next.TOKEN; return true;
}
function swVersion(){ return new Promise(res=>{ const c=navigator.serviceWorker&&navigator.serviceWorker.controller; if(!c)return res('geen (niet actief)');
  const t=setTimeout(()=>res('onbekend (oud?)'),1500); navigator.serviceWorker.addEventListener('message',function h(e){ if(e.data&&e.data.version){clearTimeout(t);navigator.serviceWorker.removeEventListener('message',h);res(e.data.version);} }); c.postMessage('version'); }); }
async function diagnose(v){
  const out=app.querySelector('#dout'), cp=app.querySelector('#copy'); out.hidden=false; cp.hidden=false; cp.textContent='Kopieer';
  const L=[]; const log=x=>{L.push(x); out.textContent=L.join('\n');};
  const mask=t=>t?t.slice(0,3)+'…'+t.slice(-2)+' ('+t.length+' tekens)':'(leeg)';
  log('App '+VLABEL+' · SW '+(await swVersion())+' · '+new Date().toLocaleString('nl-NL'));
  log('Standalone: '+(navigator.standalone||matchMedia('(display-mode: standalone)').matches)+' · online: '+navigator.onLine);
  log('UA: '+navigator.userAgent);
  log('1. URL: '+(v.API_URL||'(leeg)')); log('   geldig /exec: '+/^https:\/\/script\.google(usercontent)?\.com\/.+\/exec$/.test(v.API_URL)); log('   token: '+mask(v.TOKEN));
  if(!v.API_URL)return;
  const url=v.API_URL+'?'+new URLSearchParams({action:'plan',from:today(),to:today(),token:v.TOKEN,_:Date.now()});
  log('2. fetch GET (redirect follow, credentials omit, geen headers)… kan ~1 min duren'); let t0=Date.now();
  try{ const ac=new AbortController(), tt=setTimeout(()=>ac.abort(),60000);
    const r=await fetch(url,{redirect:'follow',credentials:'omit',signal:ac.signal}); const body=await r.text(); clearTimeout(tt);
    log('   status '+r.status+' · type '+r.type+' · redirected '+r.redirected+' · '+(Date.now()-t0)+' ms');
    log('   final URL: '+(r.url?r.url.replace(/token=[^&]*/,'token=***').slice(0,160):'(onbekend)'));
    log('   content-type: '+r.headers.get('content-type'));
    log('   body: '+body.slice(0,120).split(v.TOKEN).join('***'));
    if(/<html|<!doctype/i.test(body)) log('   ⚠ HTML in plaats van JSON (login-/foutpagina)');
  }catch(e){ log('   FOUT '+e.name+': '+e.message+' · '+(Date.now()-t0)+' ms'); }
  log('3. JSONP-fallback…'); t0=Date.now();
  try{ const j=await jsonp(jsonpUrl({action:'plan',from:today(),to:today()},v)); log('   ok '+JSON.stringify(j).slice(0,120)+' · '+(Date.now()-t0)+' ms'); }
  catch(e){ log('   FOUT '+e.message+' · '+(Date.now()-t0)+' ms'); }
  log('Wachtrij: '+LS.get('queue',[]).length);
}


/* ---------- swipe tussen tabs: interactief (volgende scherm schuift mee met de vinger) ---------- */
const MAIN_TABS=['vandaag','morgen','week','progressie'];
const VIEWS={vandaag:()=>viewToday(),morgen:()=>viewMorgen(),week:()=>viewWeek(),progressie:()=>viewProg()};
function curMain(){ const v=(location.hash.slice(1)||'vandaag').split('/')[0]; return MAIN_TABS.includes(v)?v:null; }
// render een hoofdtab los van de pagina (voor het meeschuivende buurscherm); schrijft niets
function renderOff(v){ const A=app, H=hd; app=document.createElement('main'); hd=document.createElement('header'); let html='';
  try{ VIEWS[v](); html=app.innerHTML; }catch(e){} finally{ app=A; hd=H; } return html; }
let sw0=null, D=null;
app.addEventListener('touchstart',e=>{ if(D&&D.anim)return; if(e.touches.length!==1||ov.style.display==='block'||document.querySelector('.sheet,.pop')){sw0=null;return;}
  if(e.target.closest('input,textarea,select,.step,.itimer,.ex,.rpe,.fb,.seg3,.bars,.chart,[data-noswipe]')){sw0=null;return;}
  const t=e.touches[0]; sw0={x:t.clientX,y:t.clientY,t:Date.now(),lock:null,dx:0}; },{passive:true});
app.addEventListener('touchmove',e=>{ if(!sw0)return; const t=e.touches[0], dx=t.clientX-sw0.x, dy=t.clientY-sw0.y;
  if(!sw0.lock){ if(Math.abs(dx)<8&&Math.abs(dy)<8)return; sw0.lock=Math.abs(dx)>Math.abs(dy)*1.2?'h':'v'; if(sw0.lock==='h')dragStart(); }
  if(sw0.lock!=='h')return; if(e.cancelable)e.preventDefault(); sw0.dx=dx; dragMove(dx); },{passive:false});
app.addEventListener('touchend',()=>{ if(!sw0)return; const s=sw0; sw0=null; if(s.lock!=='h')return; dragEnd(s.dx,s.dx/Math.max(1,Date.now()-s.t)); },{passive:true});
app.addEventListener('touchcancel',()=>{ if(sw0&&sw0.lock==='h')dragEnd(0,0); sw0=null; },{passive:true});
function dragStart(){ const m=curMain(); D={main:m,i:MAIN_TABS.indexOf(m),W:innerWidth,ghost:null,target:null}; if(m) app.style.transition='none'; }
function dragMove(dx){ if(!D||!D.main)return; const dir=dx<0?1:-1, target=MAIN_TABS[D.i+dir]||null;
  if(!target){ app.style.transform=`translateX(${dx/3}px)`; if(D.ghost){D.ghost.remove();D.ghost=null;D.target=null;} return; }
  if(target!==D.target){ if(D.ghost)D.ghost.remove(); const g=document.createElement('main'); g.className='swghost'; g.setAttribute('aria-hidden','true');
    g.style.top=Math.max(0,hd.getBoundingClientRect().bottom)+'px'; g.innerHTML=renderOff(target); document.body.appendChild(g); D.ghost=g; D.target=target; D.dir=dir; }
  app.style.transform=`translateX(${dx}px)`; D.ghost.style.transform=`translateX(${dx+D.dir*D.W}px)`; }
function dragEnd(dx,v){ if(!D)return; if(!D.main){ D=null; if(Math.abs(dx)>=70) swipe(dx<0?1:-1); return; }
  const go=D.target&&(Math.abs(dx)>D.W*0.28||(Math.abs(v)>0.45&&Math.abs(dx)>30)), tr='transform .22s cubic-bezier(.2,.8,.2,1)'; D.anim=true;
  app.style.transition=tr; if(D.ghost)D.ghost.style.transition=tr;
  requestAnimationFrame(()=>{ if(!D)return;
    if(go){ app.style.transform=`translateX(${-D.dir*D.W}px)`; D.ghost.style.transform='translateX(0)'; }
    else { app.style.transform='translateX(0)'; if(D.ghost)D.ghost.style.transform=`translateX(${D.dir*D.W}px)`; } });
  setTimeout(()=>{ if(!D)return; if(go){ D.commit=true; location.hash='#'+D.target; setTimeout(swCleanup,400); } else swCleanup(); },240); }
function swCleanup(){ if(!D)return; if(D.ghost)D.ghost.remove(); app.style.transition='none'; app.style.transform=''; D=null; requestAnimationFrame(()=>{ app.style.transition=''; }); }
function swipe(dir){
  const h=location.hash.slice(1)||'vandaag', [v,arg,tab]=h.split('/');
  if(v==='w'||v==='voorbeeld'){ const w=byId(arg); if(!w||w.type==='rest'||isRun(w)||tab==='klaar'||tab==='samenvatting')return; const T=tabsOf(w).map(t=>t.key);
    let i=T.indexOf(tab); if(i<0){ const btn=hd.querySelector('.tabs .on'); i=btn?T.indexOf(btn.dataset.tab||btn.dataset.ptab):0; }
    const j=i+dir; if(j<0||j>=T.length)return; location.replace('#'+v+'/'+w.id+'/'+T[j]); return; }
  const i=MAIN_TABS.indexOf(v==='reeks'?'vandaag':v); if(i<0)return; const j=i+dir; if(j<0||j>=MAIN_TABS.length)return; location.hash='#'+MAIN_TABS[j];
}
/* ---------- versie / updates ---------- */
// niet-interactieve toast: blokkeert nooit taps, verdwijnt na ~2 s
function toast(t){ document.querySelectorAll('.toast').forEach(x=>x.remove()); const d=document.createElement('div'); d.className='toast'; d.setAttribute('role','status'); d.textContent=t; document.body.appendChild(d); setTimeout(()=>d.classList.add('out'),1800); setTimeout(()=>d.remove(),2300); }
// 'Bijgewerkt'-melding hoogstens één keer per versie
try{ if(localStorage.getItem('toastShownFor')!==APP_VERSION){ const first=!localStorage.getItem('toastShownFor'); localStorage.setItem('toastShownFor',APP_VERSION); if(!first)setTimeout(()=>toast('Bijgewerkt naar '+APP_VERSION),400); } }catch(e){}
sessionStorage.removeItem('updated');

/* ---------- start ---------- */
if('serviceWorker' in navigator){
  const hadCtrl=!!navigator.serviceWorker.controller; let reloaded=false;
  navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).then(reg=>{ reg.update().catch(()=>{}); document.addEventListener('visibilitychange',()=>{ if(!document.hidden)reg.update().catch(()=>{}); }); }).catch(()=>{});
  // stil één keer herladen als een nieuwe SW de controle neemt; bewaakt met sessionStorage (max 1x per 30 s) tegen lussen
  navigator.serviceWorker.addEventListener('controllerchange',()=>{ if(!hadCtrl||reloaded)return; const last=+sessionStorage.getItem('swReloadAt')||0;
    if(Date.now()-last<30000)return; reloaded=true; sessionStorage.setItem('swReloadAt',String(Date.now())); location.reload(); });
}
// lege lokale logs van oudere versies opruimen
Object.keys(localStorage).filter(k=>k.startsWith('log:')).forEach(k=>{ if(!isMeaningful(LS.get(k)))localStorage.removeItem(k); });
LS.set('queue',LS.get('queue',[]).filter(id=>isMeaningful(LS.get(logKey(id)))));
syncLabel(); route(); loadPlan(); loadServerLogs().then(flush).then(()=>{ writeOverrides(); sendAftrap(); }); Voice.ping();
if(!syncOn()) ACC.probe().then(ok=>{ if(ok) route(); });
if(justLinked) setTimeout(()=>toast('Gekoppeld ✓'),300);
document.addEventListener('visibilitychange',()=>{ if(!document.hidden){ loadPlan(); loadServerLogs().then(flush).then(()=>{ writeOverrides(); sendAftrap(); }); Voice.ping(); } });
