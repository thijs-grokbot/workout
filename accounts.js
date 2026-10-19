/* v15: accounts. Inloggen, registreren met uitnodiging, wachtwoord kiezen (Thijs), wisselen en uitloggen.
   Laag bovenop de bestaande token-koppeling. Zonder login-ondersteuning op de server (oude Code.gs) blijft alles in token-modus.
   Bewaart nooit een wachtwoord op het toestel; alleen sessietokens (90 dagen rollend) per account. */
const ACC=(()=>{
  const DEVICE=['accounts','acct','cfg','weekOff','progTab','swipeHint','accountsApi','loginName'];
  const AUTH_VIEWS=['inloggen','registreren','wachtwoord'];
  const CONSENT='Je gegevens staan in de Google Drive van Thijs en spraakopnames gaan naar Google voor spraakherkenning.';
  const EYE='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  const EYEX=EYE.replace('</svg>','<path d="M3 3l18 18"/></svg>');
  const j=k=>{ try{ return JSON.parse(localStorage.getItem(k)||'null'); }catch(e){ return null; } };
  const put=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
  const list=()=>(j('accounts')||[]).filter(a=>a&&a.id);
  const sess=()=>{ try{ return JSON.parse(sessionStorage.getItem('sessAcct')||'null'); }catch(e){ return null; } };
  function active(){ const s=sess(); if(s&&s.token)return s; const id=j('acct'); return list().find(a=>a.id===id&&a.token)||null; }
  const mode=()=>active()?'account':'token';
  let needsPw=false, busy=false;
  function init(){ const a=active(); if(a&&a.token) CFG.TOKEN=a.token; }
  const apiOk=()=>!!j('accountsApi');
  // publieke ping (zonder token): heeft de server accounts?
  async function probe(){ if(!CFG.API_URL)return false; try{ const r=await fetch(CFG.API_URL+'?action=ping&_='+Date.now(),{redirect:'follow',credentials:'omit'}); const x=JSON.parse(await r.text());
      put('accountsApi',!!(x&&x.accounts)); return !!(x&&x.accounts); }catch(e){ return apiOk(); } }
  // uitslag van de gewone ping (met token)
  function onPing(x){ if(!x)return; if(x.accounts) put('accountsApi',true);
    if(x.accounts&&mode()==='token'&&x.admin&&x.needs_password&&x.user){ needsPw=x.user; if(!AUTH_VIEWS.includes(view())) location.replace('#wachtwoord'); }
    if(x.accounts&&mode()==='account'&&x.user){ const a=active(); if(a&&(a.name!==x.name||a.trainer!==x.trainer)) store({...a,name:x.name||a.name,trainer:x.trainer||a.trainer},!sess()); } }
  function onUnauthorized(){ const a=active(); if(!a)return; // verlopen of ingetrokken: naar Inloggen met naam ingevuld; wachtrij en lokale logs blijven staan
    if(sess()) sessionStorage.removeItem('sessAcct'); else put('accounts',list().map(x=>x.id===a.id?{...x,token:null}:x));
    put('loginName',a.id); CFG.TOKEN=''; if(!AUTH_VIEWS.includes(view())) location.replace('#inloggen'); }
  const view=()=>(location.hash.slice(1)||'vandaag').split('/')[0];
  function store(a,remember){ if(remember){ put('accounts',[...list().filter(x=>x.id!==a.id),a]); put('acct',a.id); sessionStorage.removeItem('sessAcct'); }
    else sessionStorage.setItem('sessAcct',JSON.stringify(a)); }
  function wipe(){ Object.keys(localStorage).forEach(k=>{ if(DEVICE.includes(k)||k.startsWith('q:'))return; localStorage.removeItem(k); }); PLAN=[]; serverLogsState=''; }
  function stashQueue(id){ const q=LS.get('queue',[]); if(!q.length)return; put('q:'+id,q.map(w=>[w,localStorage.getItem(logKey(w))])); }
  function restoreQueue(id){ const s=j('q:'+id); if(!s)return; s.forEach(([w,v])=>{ if(v)localStorage.setItem(logKey(w),v); }); LS.set('queue',s.map(x=>x[0])); localStorage.removeItem('q:'+id); }
  // account actief maken: lokale gegevens van een ander account worden weggezet (wachtrij bewaard per account) en van de server geladen
  async function activate(a,remember,{aftrap=false}={}){
    const cur=active(), dataOf=(LS.get('profile',{}).id||'thijs');
    if(dataOf!==a.id){ try{ await flush(); }catch(e){} stashQueue(dataOf); wipe(); restoreQueue(a.id); }
    store(a,remember); CFG.TOKEN=a.token; const c=LS.get('cfg',{}); if(c.TOKEN){ c.TOKEN=''; LS.set('cfg',c); } // master-token van dit toestel af
    localStorage.removeItem('loginName'); needsPw=false;
    LS.set('profile',{...LS.get('profile',{}),id:a.id,name:a.name||cap(a.id)}); if(a.trainer)LS.set('trainerFromPing',a.trainer);
    if(aftrap){ LS.set('aftrapDone',0); location.replace('#aftrap/0'); } else { LS.set('aftrapDone',1); location.replace('#vandaag'); loadProfile(a.id); }
    syncLabel(); loadPlan(); loadServerLogs().then(flush); Voice.ping(); }
  async function loadProfile(id){ try{ const r=await api('POST',null,{action:'readfile',path:'profiel/'+id+'-aftrap.json'}); const x=r&&r.ok&&r.json; if(!x)return;
    LS.set('profile',{...LS.get('profile',{}),id,aftrap:x.aftrap||LS.get('profile',{}).aftrap,trainer_name:x.trainer_name||LS.get('profile',{}).trainer_name}); softRoute(); }catch(e){} }
  async function call(body,ms=30000){ const ac=new AbortController(), t=setTimeout(()=>ac.abort(),ms);
    try{ const r=await fetch(CFG.API_URL,{method:'POST',redirect:'follow',credentials:'omit',signal:ac.signal,headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body)});
      return JSON.parse(await r.text()); }finally{ clearTimeout(t); } }
  const ERR={bad_login:'Wachtwoord klopt niet. Probeer het opnieuw.',locked:'Te vaak geprobeerd. Wacht 5 minuten.',bad_invite:'Deze code werkt niet (meer).',taken:'Deze naam is al in gebruik.',
    bad_username:'3–20 tekens: a–z, 0–9, punt of streepje.',consent:'Vink de toestemming aan.',net:'Geen verbinding. Probeer het opnieuw.'};
  const errOf=x=>!x?ERR.net:ERR[x.code]||(/minimaal 8/.test(x.error||'')?'Minimaal 8 tekens.':x.error||ERR.net);
  /* ---------- schermen ---------- */
  const fld=(label,inp,{eye=false,err=''}={})=>`<label class="fl" for="${inp.id}">${label}</label><div class="fld${err?' err':''}">${inp.html}${eye?`<button type="button" class="eye" data-eye="${inp.id}" aria-label="Toon wachtwoord">${EYE}</button>`:''}</div>${err?`<div class="errt" role="alert">${esc(err)}</div>`:''}`;
  const inp=(id,attrs,val='')=>({id,html:`<input id="${id}" name="${id}" ${attrs} value="${esc(val)}">`});
  const authHead=(back)=>{ hd.innerHTML=`<div class="top">${back?`<a class="back" href="${back}" aria-label="Terug">‹</a>`:BRAND.replace('href="#vandaag"','href="#inloggen"')}</div>`; };
  function wire(form,submit){ // oogjes, enter, knop boven toetsenbord, dubbel tikken
    form.addEventListener('click',e=>{ const b=e.target.closest('[data-eye]'); if(!b)return; const i=form.querySelector('#'+b.dataset.eye), s=i.selectionStart, show=i.type==='password';
      i.type=show?'text':'password'; b.innerHTML=show?EYEX:EYE; b.setAttribute('aria-label',show?'Verberg wachtwoord':'Toon wachtwoord'); i.focus(); try{ i.setSelectionRange(s,s); }catch(x){} });
    form.addEventListener('submit',e=>{ e.preventDefault(); if(!busy)submit(); });
    form.addEventListener('input',e=>{ const f=e.target.closest('.fld'); if(f&&f.classList.contains('err')){ f.classList.remove('err'); app.querySelectorAll('.errt[role=alert]').forEach(x=>x.remove()); } });
    const vv=window.visualViewport; if(vv){ const f=()=>{ const kb=Math.max(0,innerHeight-vv.height-vv.offsetTop); bar.style.bottom=kb?kb+'px':''; }; vv.addEventListener('resize',f); vv.addEventListener('scroll',f); KBF=()=>{ vv.removeEventListener('resize',f); vv.removeEventListener('scroll',f); bar.style.bottom=''; }; } }
  let KBF=null; function leave(){ if(KBF){ KBF(); KBF=null; } busy=false; }
  function setBusy(on,label,busyLabel){ busy=on; const b=bar.querySelector('button'); if(!b)return; b.disabled=on; b.style.opacity=on?'.75':''; b.innerHTML=on?`<span class="spin"></span>${busyLabel}`:label;
    app.querySelectorAll('input').forEach(i=>i.readOnly=on); }
  function viewLogin(st={}){
    authHead(sessionStorage.getItem('addAcct')&&active()?'#vandaag':''); const name=st.name??(j('loginName')||'');
    app.innerHTML=`<form id="af" class="auth" autocomplete="on" novalidate><div class="q">Inloggen</div>
      ${fld('Gebruikersnaam',inp('u','type="text" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="text" enterkeyhint="next" required',name))}
      ${fld('Wachtwoord',inp('p','type="password" autocomplete="current-password" autocapitalize="off" enterkeyhint="go" required'),{eye:true,err:st.err})}
      <label class="tgrow"><span class="sp">Ingelogd blijven</span><input type="checkbox" class="tg" id="rem" ${st.rem===false?'':'checked'}></label>
      <button type="submit" hidden></button></form>`;
    setBar(`<a class="lnk" href="#registreren">Ik heb een uitnodiging</a><button class="btn" type="submit" form="af" id="go">Inloggen</button>`);
    const f=app.querySelector('#af'), u=f.querySelector('#u'), p=f.querySelector('#p');
    u.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); p.focus(); } });
    wire(f,async()=>{ const id=u.value.trim().toLowerCase(), rem=f.querySelector('#rem').checked; if(!id||!p.value){ (id?p:u).focus(); return; }
      setBusy(true,'Inloggen','Inloggen…'); let x=null; try{ x=await call({action:'login',username:id,password:p.value,remember:rem}); }catch(e){}
      setBusy(false,'Inloggen');
      if(!x||!x.ok){ const pw=p.value; viewLogin({name:id,err:errOf(x),rem}); const p2=app.querySelector('#p'); p2.value=pw; p2.focus(); return; }
      sessionStorage.removeItem('addAcct'); leave(); activate({id:x.user.id,name:x.user.name,trainer:x.user.trainer,token:x.token,exp:x.expires},rem,{aftrap:!!x.needs_aftrap}); });
    if(!name) u.focus(); else if(!st.err) p.focus();
  }
  function viewRegister(st={}){
    authHead('#inloggen'); const v=st.v||{};
    app.innerHTML=`<form id="af" class="auth" autocomplete="on" novalidate><div class="q">Je uitnodiging</div>
      ${fld('Uitnodigingscode',inp('c','type="text" autocomplete="one-time-code" autocapitalize="characters" autocorrect="off" spellcheck="false" enterkeyhint="next"',v.c||''),{err:st.f==='c'?st.err:''})}
      ${fld('Gebruikersnaam',inp('u','type="text" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="text" enterkeyhint="next" maxlength="20"',v.u||''),{err:st.f==='u'?st.err:''})}
      ${fld('Wachtwoord',inp('p','type="password" autocomplete="new-password" autocapitalize="off" minlength="8" enterkeyhint="go"'),{eye:true,err:st.f==='p'?st.err:''})}
      <label class="cons"><input type="checkbox" id="ok" class="cb"><span>${CONSENT}</span></label>${st.f==='x'?`<div class="errt" role="alert">${esc(st.err)}</div>`:''}
      <button type="submit" hidden></button></form>`;
    setBar(`<button class="btn" type="submit" form="af" id="go" disabled>Account maken</button>`);
    const f=app.querySelector('#af'), go=bar.querySelector('#go'), ok=f.querySelector('#ok');
    ok.onchange=()=>{ go.disabled=!ok.checked; };
    f.querySelector('#c').addEventListener('input',e=>{ const i=e.target, s=i.selectionStart; i.value=i.value.toUpperCase(); try{ i.setSelectionRange(s,s); }catch(x){} });
    wire(f,async()=>{ if(!ok.checked)return; const c=f.querySelector('#c').value, u=f.querySelector('#u').value.trim().toLowerCase(), p=f.querySelector('#p').value, vv={c,u};
      if(!/^[a-z0-9][a-z0-9.-]{2,19}$/.test(u)) return viewRegister({v:vv,f:'u',err:ERR.bad_username});
      if(p.length<8) return viewRegister({v:vv,f:'p',err:'Minimaal 8 tekens.'});
      setBusy(true,'Account maken','Account maken…'); let x=null; try{ x=await call({action:'register',invite:c,username:u,password:p,consent:true,remember:true}); }catch(e){}
      setBusy(false,'Account maken');
      if(!x||!x.ok){ const fk=x&&x.code==='bad_invite'?'c':x&&/taken|bad_username/.test(x.code)?'u':x&&!x.code&&/tekens/.test(x.error||'')?'p':'x'; viewRegister({v:vv,f:fk,err:errOf(x)}); app.querySelector('#ok').checked=true; bar.querySelector('#go').disabled=false; return; }
      leave(); activate({id:x.user.id,name:x.user.name,trainer:x.user.trainer,token:x.token,exp:x.expires},true,{aftrap:true}); });
  }
  function strength(pw){ if(!pw)return 0; let s=0, cl=[/[a-z]/,/[A-Z]/,/\d/,/[^A-Za-z0-9]/].filter(r=>r.test(pw)).length;
    if(pw.length>=8)s++; if(pw.length>=12)s++; if(cl>=2)s++; if(cl>=3||pw.length>=16)s++; return Math.max(1,Math.min(4,s)); }
  const SW=['','Zwak','Matig','Sterk','Heel sterk'];
  function viewSetPw(){
    const id=needsPw||PROFILE().id||'thijs'; authHead('');
    app.innerHTML=`<form id="af" class="auth" novalidate><div class="q" style="font-size:36px">Kies een wachtwoord voor je account</div><div class="hint2">Gebruikersnaam: <b>${esc(id)}</b></div>
      <input type="text" name="username" autocomplete="username" value="${esc(id)}" hidden readonly>
      ${fld('Wachtwoord',inp('p','type="password" autocomplete="new-password" autocapitalize="off" minlength="8" enterkeyhint="next"'),{eye:true})}
      <div class="sbar" aria-hidden="true"><span></span><span></span><span></span><span></span></div><div class="sw" id="sw" aria-live="polite"></div>
      ${fld('Herhaal wachtwoord',inp('p2','type="password" autocomplete="new-password" autocapitalize="off" enterkeyhint="go"'),{eye:true})}<div class="sw" id="eq" aria-live="polite"></div><div class="errt" id="er" hidden></div>
      <button type="submit" hidden></button></form>`;
    setBar(`<button class="btn" type="submit" form="af" id="go" disabled>Opslaan</button>`);
    const f=app.querySelector('#af'), p=f.querySelector('#p'), p2=f.querySelector('#p2'), go=bar.querySelector('#go');
    const upd=()=>{ const s=strength(p.value); f.querySelectorAll('.sbar span').forEach((b,i)=>b.className=i<s?(s<2?'w':'on'):'');
      const sw=f.querySelector('#sw'); sw.textContent=p.value?SW[s]:''; sw.className='sw '+(s>=3?'ok':s===2?'mid':'bad');
      const eq=f.querySelector('#eq'); eq.textContent=p2.value?(p2.value===p.value?'✓ Hetzelfde':'Niet hetzelfde'):''; eq.className='sw '+(p2.value===p.value?'ok':'bad');
      go.disabled=!(p.value.length>=8&&s>=2&&p.value===p2.value); };
    p.oninput=upd; p2.oninput=upd; p.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); p2.focus(); } });
    wire(f,async()=>{ if(go.disabled)return; setBusy(true,'Opslaan','Opslaan…'); let x=null; try{ x=await call({action:'setpassword',token:CFG.TOKEN,password:p.value,remember:true}); }catch(e){}
      setBusy(false,'Opslaan'); upd(); if(!x||!x.ok){ const er=f.querySelector('#er'); er.hidden=false; er.textContent=errOf(x); return; }
      leave(); toast('Wachtwoord opgeslagen ✓'); activate({id:x.user.id,name:x.user.name,trainer:x.user.trainer,token:x.token,exp:x.expires},true,{aftrap:false}); });
    p.focus();
  }
  // route-hook: true = afgehandeld
  function gate(v){
    if(!AUTH_VIEWS.includes(v)) leave();
    if(v==='inloggen'&&syncOn()&&mode()==='token'&&!sessionStorage.getItem('addAcct')){ location.replace(needsPw?'#wachtwoord':'#vandaag'); return true; } // gekoppeld toestel: geen inlogscherm
    if(v==='inloggen'){ hd.innerHTML=''; viewLogin(); return true; }
    if(v==='registreren'){ viewRegister(); return true; }
    if(v==='wachtwoord'){ if(!needsPw||mode()!=='token'){ location.replace('#vandaag'); return true; } viewSetPw(); return true; }
    if(v==='instellingen')return false;
    if(needsPw&&mode()==='token'){ location.replace('#wachtwoord'); return true; }
    if(!syncOn()&&apiOk()&&mode()==='token'){ location.replace('#inloggen'); return true; }
    return false; }
  const isAuthView=v=>AUTH_VIEWS.includes(v);
  /* ---------- profiel-sheet (08) en uitloggen (09) ---------- */
  function sheetHtml(){ const p=PROFILE(), a=active(), others=list().filter(x=>!a||x.id!==a.id), multi=apiOk();
    const linkState=!syncOn()?'<b class="bad">Niet gekoppeld</b>':'<b class="ok">Gekoppeld ✓</b>';
    return `<div class="scrim" data-close></div><div class="sheet" role="dialog" aria-label="Profiel"><div class="grab"></div>
     <div class="li me"><div class="av">${esc(initials(p.name))}</div><div class="sp"><b class="h" style="font-size:22px">${esc(p.name)}</b><div class="mu" style="font-size:14px">${esc(a?a.id+' · ':'')}trainer ${esc(TRAINER())}</div></div></div>
     ${others.map(o=>`<button class="li acc" data-acc="${esc(o.id)}"><div class="av g">${esc(initials(o.name||o.id))}</div><div class="sp"><b>${esc(o.name||o.id)}</b><div class="mu" style="font-size:14px">${o.token?'trainer '+esc(o.trainer||'Mike'):'Opnieuw inloggen'}</div></div><span class="mu" style="font-size:22px">›</span></button>`).join('')}
     ${multi?`<a class="li add" href="#inloggen" data-add><div class="av dash">+</div><b>Account toevoegen</b></a>`:''}
     <a class="li" href="#instellingen"><span class="sp">Koppeling</span>${linkState}</a>
     <div class="li"><span class="sp">Versie</span><span class="mu">${VLABEL}</span></div>
     ${a?'<button class="danger" id="out">Uitloggen</button>':''}</div>`; }
  function openSheet(){ closeSheet(); sheetEl=document.createElement('div'); sheetEl.innerHTML=sheetHtml(); document.body.appendChild(sheetEl);
    sheetEl.onclick=async e=>{ if(e.target.closest('[data-close]'))return closeSheet();
      if(e.target.closest('[data-add]')){ sessionStorage.setItem('addAcct','1'); localStorage.removeItem('loginName'); setTimeout(closeSheet,0); return; }
      const ac=e.target.closest('[data-acc]'); if(ac){ closeSheet(); return switchTo(ac.dataset.acc); }
      if(e.target.closest('#out'))return confirmLogout();
      if(e.target.closest('a'))setTimeout(closeSheet,0); };
    let y0=null; const sh=sheetEl.querySelector('.sheet'); sh.addEventListener('touchstart',e=>{y0=e.touches[0].clientY},{passive:true}); sh.addEventListener('touchend',e=>{ if(y0!=null&&e.changedTouches[0].clientY-y0>80&&sh.scrollTop<=0)closeSheet(); y0=null; },{passive:true}); }
  async function switchTo(id){ const a=list().find(x=>x.id===id); if(!a)return;
    if(!a.token){ put('loginName',id); sessionStorage.setItem('addAcct','1'); location.hash='#inloggen'; return; }
    activate(a,true,{aftrap:false}); }
  async function confirmLogout(){ try{ await flush(); }catch(e){} const n=LS.get('queue',[]).length;
    const d=document.createElement('div'); d.className='popwrap';
    d.innerHTML=`<div class="scrim" style="z-index:40" data-x></div><div class="pop card" role="alertdialog" aria-labelledby="lo" style="z-index:41"><b class="h" id="lo" style="font-size:30px">Uitloggen?</b>
      <div class="lomsg">${n?`Er staan nog ${n} ${n===1?'training':'trainingen'} klaar om te versturen. Toch uitloggen?`:'Je trainingen blijven bewaard. Op dit apparaat log je daarna opnieuw in.'}</div>
      <button class="btn dang" id="lo-yes">Uitloggen</button><button class="btn ghost" id="lo-no" style="margin-top:12px">Annuleer</button></div>`;
    document.body.appendChild(d);
    d.onclick=async e=>{ if(e.target.closest('#lo-no')||e.target.closest('[data-x]'))return d.remove(); if(e.target.closest('#lo-yes')){ d.remove(); closeSheet(); await logout(); } }; }
  async function logout(){ const a=active(); if(!a)return; try{ await flush(); }catch(e){}
    try{ await api('POST',null,{action:'logout'},CFG,1); }catch(e){}
    if(sess()) sessionStorage.removeItem('sessAcct'); put('accounts',list().filter(x=>x.id!==a.id)); localStorage.removeItem('acct');
    localStorage.removeItem('q:'+a.id); wipe(); CFG.TOKEN=''; put('loginName',a.id); sessionStorage.removeItem('addAcct'); location.replace('#inloggen'); }
  return {init,mode,active,list,probe,onPing,onUnauthorized,gate,isAuthView,openSheet,apiOk,strength,needsPassword:()=>needsPw,CONSENT};
})();
