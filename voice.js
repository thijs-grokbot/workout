/* Stem: opnemen (MediaRecorder), persoonlijke trainer (action coach) of naar de inbox van de trainer. Tikken blijft altijd mogelijk. */
const Voice=(()=>{
  let ctx={v:'vandaag'}, rec=null, vbarEl=null, fab=null, hideT=null;
  const MAX=60;
  const pickMime=()=>{ if(!window.MediaRecorder)return null; for(const m of ['audio/mp4','audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus']) try{ if(MediaRecorder.isTypeSupported(m))return m; }catch(e){} return ''; };
  const extOf=m=>/mp4|m4a|aac/.test(m)?'m4a':/webm/.test(m)?'webm':/wav/.test(m)?'wav':/ogg/.test(m)?'webm':'m4a';
  const b64=blob=>new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(String(r.result).split(',')[1]||''); r.onerror=rej; r.readAsDataURL(blob); });
  const nowStamp=()=>{ const d=new Date(); return ymd(d)+'_'+pad(d.getHours())+pad(d.getMinutes())+pad(d.getSeconds()); };
  const aiOn=()=>!!LS.get('aiOn',false);
  async function ping(){ if(!syncOn())return; try{ const j=await api('GET',{action:'ping'},null,CFG,1); if(j&&j.ok){ LS.set('aiOn',!!j.ai); if(j.trainer)LS.set('trainerFromPing',j.trainer); LS.set('pingVersion',j.version||''); } }catch(e){} }

  /* recorder: start() -> {stop():Promise<{blob,mime,sec}>, cancel(), level():0..1} */
  async function start(onTick,onAuto){
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder) throw new Error('Opnemen wordt op dit toestel niet ondersteund');
    const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
    const mime=pickMime(); let mr; try{ mr=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream); }catch(e){ mr=new MediaRecorder(stream); }
    const chunks=[]; mr.ondataavailable=e=>{ if(e.data&&e.data.size)chunks.push(e.data); };
    let an=null, buf=null, ac=null; try{ ac=new (window.AudioContext||window.webkitAudioContext)(); const src=ac.createMediaStreamSource(stream); an=ac.createAnalyser(); an.fftSize=256; buf=new Uint8Array(an.fftSize); src.connect(an); }catch(e){}
    const t0=Date.now(); let done=false; const tick=setInterval(()=>{ const s=(Date.now()-t0)/1000; onTick&&onTick(s); if(s>=MAX&&!done)onAuto&&onAuto(); },100);
    mr.start(250);
    const cleanup=()=>{ clearInterval(tick); stream.getTracks().forEach(t=>t.stop()); try{ac&&ac.close();}catch(e){} };
    return {
      level(){ if(!an)return Math.random()*.5; an.getByteTimeDomainData(buf); let m=0; for(const v of buf)m=Math.max(m,Math.abs(v-128)); return Math.min(1,m/64); },
      stop(){ if(done)return Promise.reject(new Error('al gestopt')); done=true; return new Promise(res=>{ mr.onstop=()=>{ cleanup(); const type=(mr.mimeType||mime||chunks[0]&&chunks[0].type||'audio/mp4'); res({blob:new Blob(chunks,{type}),mime:type,sec:(Date.now()-t0)/1000}); }; try{ mr.requestData&&mr.requestData(); }catch(e){} mr.stop(); }); },
      cancel(){ done=true; try{ mr.stop(); }catch(e){} cleanup(); } };
  }

  /* UI */
  function ensureFab(){ if(fab)return fab; fab=document.createElement('button'); fab.className='fab'; fab.id='micfab'; fab.setAttribute('aria-label','Inspreken voor je persoonlijke trainer'); fab.innerHTML=MIC; fab.onclick=toggle; document.body.appendChild(fab); return fab; }
  function bar(html,cls=''){ clearTimeout(hideT); if(!vbarEl){ vbarEl=document.createElement('div'); vbarEl.setAttribute('role','status'); vbarEl.setAttribute('aria-live','polite'); document.body.appendChild(vbarEl); }
    vbarEl.className='vbar '+cls; vbarEl.innerHTML=html; return vbarEl; }
  function closeBar(){ clearTimeout(hideT); if(vbarEl){ vbarEl.remove(); vbarEl=null; } }
  function flashDone(txt,ms=2000){ bar(esc(txt),'done'); hideT=setTimeout(closeBar,ms); }
  const who=n=>`<span class="who">${esc(String(n).toUpperCase())}</span>`;
  const workoutForCtx=()=>{ if(ctx.v==='w'&&ctx.arg){ const w=byId(ctx.arg); if(w)return w; } const t=today();
    return PLAN.find(w=>w.date===t&&w.type!=='rest')||PLAN.find(w=>w.date===t)||PLAN.find(w=>w.date>t)||null; };

  async function toggle(){
    unlockAudio();
    if(rec){ return finish(); }
    if(fab.classList.contains('busy'))return;
    if(!syncOn()){ bar(`<div class="m a">${who(TRAINER())}Koppel eerst de app, dan kan ik je horen.</div><div class="ch"><button data-v="close">Sluit</button><button class="y" data-v="koppel">Koppel</button></div>`); return; }
    try{
      const wave='<div class="wv">'+Array.from({length:22},()=>'<i></i>').join('')+'</div>';
      bar(`<div class="m u">${who('Jij')}Ik luister… <span id="vsec">0:00</span></div>${wave}<div class="ch"><button data-v="cancel">Annuleer</button><button class="y" data-v="stop">Klaar</button></div>`);
      fab.classList.add('rec'); fab.setAttribute('aria-label','Stop opnemen');
      rec=await start(s=>{ const el=document.getElementById('vsec'); if(el)el.textContent=fmt(s)+(s>MAX-10?' · stopt bij 1:00':''); const lv=rec&&rec.level(); vbarEl&&vbarEl.querySelectorAll('.wv i').forEach((i,ix)=>{ i.style.height=(6+Math.random()*34*(lv||0)*(1-Math.abs(ix-11)/14))+'px'; }); },()=>finish());
    }catch(e){ rec=null; fab.classList.remove('rec'); bar(`<div class="m a">${who(TRAINER())}${esc(/denied|NotAllowed|Permission/i.test(e.name+e.message)?'Geen toegang tot de microfoon. Sta het toe in Instellingen › Safari, of gebruik gewoon tikken.':e.message)}</div><div class="ch"><button data-v="close">Sluit</button></div>`); }
  }
  async function finish(){ const r=rec; rec=null; fab.classList.remove('rec'); fab.classList.add('busy'); fab.setAttribute('aria-label','Inspreken voor je persoonlijke trainer');
    let a; try{ a=await r.stop(); }catch(e){ fab.classList.remove('busy'); return closeBar(); }
    if(a.sec<0.8||a.blob.size<500){ fab.classList.remove('busy'); return flashDone('Te kort, probeer opnieuw'); }
    const w=workoutForCtx();
    bar(`<div class="m a">${who(TRAINER())}Even luisteren…</div>`);
    try{ const data=await b64(a.blob);
      if(aiOn()&&w){ try{ return await coach(a,data,w); }catch(e){ console.warn('coach mislukt, naar inbox',e); await toInbox(a,data,w,'coach niet bereikbaar: '+e.message); return flashDone('Verstuurd naar '+TRAINER()+' ✓',2500); } }
      await toInbox(a,data,w); flashDone('Verstuurd naar '+TRAINER()+' ✓');
    }catch(e){ bar(`<div class="m a">${who(TRAINER())}Versturen lukte niet (${esc(e.message)}). Probeer het zo nog eens.</div><div class="ch"><button data-v="close">Sluit</button></div>`); }
    finally{ fab.classList.remove('busy'); } }
  async function toInbox(a,data,w,note){ const base='inbox/'+nowStamp(), ext=extOf(a.mime);
    const j=await api('POST',null,{action:'writefile',path:base+'.'+ext,content:data,encoding:'base64'}); if(!j||!j.ok)throw new Error((j&&j.error)||'upload mislukt');
    await api('POST',null,{action:'writefile',path:base+'.json',content:{type:'stem',at:new Date().toISOString(),audio:base.split('/')[1]+'.'+ext,mime:a.mime,seconds:Math.round(a.sec),screen:location.hash,workout_id:w&&w.id,date:today(),profile_id:PROFILE().id,note:note||''}}); }
  function contextFor(w){ const f=new Date(); f.setDate(f.getDate()-14); const fs=ymd(f);
    const recent=allLogs().filter(l=>l.date>=fs&&isMeaningful(l)).map(l=>{ const m={...l}; delete m.screenshot; return m; }).slice(-12);
    const wk=weekOf(w.date); return {recent_logs:recent,week:PLAN.filter(x=>wk.includes(x.date)),today_log:(()=>{const l=LS.get(logKey(w.id));if(!l)return null;const m={...l};delete m.screenshot;return m;})(),profile:PROFILE().aftrap||null}; }
  async function coach(a,data,w){
    const j=await api('POST',null,{action:'coach',audio:{mime:a.mime,data},date:today(),workout:w,context:contextFor(w)},CFG,1);
    if(!j||!j.ok){ if(j&&j.ai===false){ LS.set('aiOn',false); } throw new Error((j&&j.error)||'geen antwoord'); }
    const name=j.trainer||TRAINER();
    if(/^\s*(terug|ongedaan|maak .*ongedaan)/i.test(j.transcript||'')&&window.__lastUndo){ window.__lastUndo(); window.__lastUndo=null; return flashDone('Teruggezet ✓'); }
    if(!j.change||!j.workout){ bar(`<div class="m old">“${esc(j.transcript||'')}”</div><div class="m a">${who(name)}${esc(j.message||'Prima!')}</div><div class="ch"><button class="y" data-v="close">Oké</button></div>`); return; }
    const d=diffWorkouts(w,j.workout);
    const rows=[...d.verwijderd.map(x=>`<li><span class="tag t-del">WEG</span>${esc(x)}</li>`),...d.gewijzigd.map(x=>`<li><span class="tag t-chg">ANDERS</span>${esc(x.exercise)}: <s class="mu">${esc(x.voor)}</s> → <b>${esc(x.na)}</b></li>`),...d.toegevoegd.map(x=>`<li><span class="tag t-add">NIEUW</span>${esc(x.exercise)} ${esc(x.na)}</li>`)];
    if(!rows.length){ bar(`<div class="m a">${who(name)}${esc(j.message||'Er verandert niets.')}</div><div class="ch"><button class="y" data-v="close">Oké</button></div>`); return; }
    const el=bar(`<div class="m old">“${esc(j.transcript||'')}”</div><div class="m a">${who(name)}${esc(j.message||'Zo aanpassen?')}</div><ul class="diff">${rows.join('')}</ul><div class="ch"><button data-v="no">Nee</button><button class="y" data-v="yes">Akkoord</button></div>`);
    el.dataset.pending='1'; pending={w:j.workout,transcript:j.transcript,diff:d};
  }
  let pending=null;
  function accept(){ if(!pending)return; const p=pending; pending=null;
    applyWorkout(p.w,{source:'stem',transcript:p.transcript});
    const names=[...p.diff.gewijzigd.map(x=>x.exercise),...p.diff.toegevoegd.map(x=>x.exercise)];
    LS.set('glow',{id:p.w.id,names,rounds:p.diff.gewijzigd.some(x=>x.exercise==='Rondes'),until:Date.now()+2500});
    route();
    flashDone('Aangepast ✓',2000); }
  document.addEventListener('click',e=>{ const b=e.target.closest('.vbar [data-v]'); if(!b)return; const v=b.dataset.v;
    if(v==='stop')return finish(); if(v==='cancel'){ if(rec){ rec.cancel(); rec=null; fab.classList.remove('rec'); } return closeBar(); }
    if(v==='close')return closeBar(); if(v==='koppel'){ closeBar(); location.hash='#instellingen'; return; }
    if(v==='no'){ pending=null; return flashDone('Niets aangepast',1500); } if(v==='yes')return accept(); });
  function applyGlow(){ const g=LS.get('glow',null); if(!g||g.until<Date.now())return; if(!(ctx.v==='w'&&ctx.arg===g.id)&&ctx.v!=='vandaag')return;
    const els=[...document.querySelectorAll('[data-ex]')].filter(el=>g.names.includes(el.dataset.ex)); if(g.rounds) els.push(...document.querySelectorAll('header .tabs button'),document.querySelector('.hero'));
    els.filter(Boolean).forEach(el=>{ el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); setTimeout(()=>el.classList.remove('pulse'),1300); });
  }
  return {
    after(v,arg,tab){ ctx={v,arg,tab}; const f=ensureFab(); const show=v!=='aftrap'; f.hidden=!show; if(!show){ closeBar(); } setTimeout(applyGlow,50); },
    start, b64, extOf, ping, nowStamp, aiOn,
    _test:{diff:()=>pending}
  };
})();
