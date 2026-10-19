/* Aftrap (onboarding, 8 vragen). Alles ook met tikken + Volgende; mic alleen bij open vragen (2,4,5,8). */
const AF={
  trainers:['Mike','Sam','Kim'],
  doelen:['HYROX','Sterker','Fitter','Sneller lopen','Afvallen','Gezond blijven'],
  freq:['2×','3×','4×','5×+'],
  events:['HYROX','Hardloopwedstrijd','Ander event','Nee, gewoon fit'],
  over:['Beginner','Sportief','Ervaren','Gevoelige knie'],
  voeding:['Meer eiwit','Afvallen','Aankomen','Geen'],
  overig:['Thuis trainen','Wisselend rooster','Blessure','Niets'] };
const afGet=()=>Object.assign({doelen:[],over_jou:{chips:[]},voeding:[],overig:{chips:[]},event:{}},LS.get('aftrapDraft',null)||(PROFILE().aftrap)||{});
const afSet=a=>LS.set('aftrapDraft',a);
let afRec=null;
function viewAftrap(step){
  hd.innerHTML=''; Voice.after('aftrap'); setBar('');
  const a=afGet(), tn=a.trainer_name||PROFILE().trainer_name||'Mike';
  const go=s=>location.replace('#aftrap/'+s);
  const chips=(list,sel,key)=>`<div class="ch2">${list.map(c=>`<button class="${(Array.isArray(sel)?sel.includes(c):sel===c)?'on':''}" data-c="${esc(c)}" data-k="${key}">${esc(c)}</button>`).join('')}</div>`;
  const said=t=>t?`<div class="card" style="margin-top:14px;font-size:17px"><div class="lbl" style="margin-bottom:6px">Jij zei</div>“${esc(t)}”</div>`:'';
  const ob=(n,q,body,{opt=false,mic=false,btn='Volgende',sub=''}={})=>{
    app.innerHTML=`<div class="ob"><div class="obtop">${BRAND.replace('href="#vandaag"','href="#aftrap/0"')}<div class="row" style="gap:10px">${opt?'<button class="btn ghost sm" id="skip" style="width:120px">Overslaan</button>':''}</div></div>
      <div class="pd">${Array.from({length:8},(_,i)=>`<span class="${i+1===n?'on':i+1<n?'dn':''}"></span>`).join('')}</div>${sub?`<div class="lbl" style="margin-top:18px">${sub}</div>`:''}<div class="q">${q}</div>${body}</div>
      ${mic?`<div class="bmh" id="bmh">Tik een keuze of vertel het gewoon</div><button class="bigmic" id="bigmic" aria-label="Inspreken">${MIC}</button>`:''}`;
    setBar(`<button class="btn" id="next">${btn}</button>`); };
  const s=String(step||'0');
  if(s==='0'){ app.innerHTML=`<div class="ob" style="padding-top:calc(var(--sat) + 120px);text-align:center"><div style="transform:scale(2.2);display:inline-block;margin-bottom:40px">${BRAND}</div>
     <div class="q" style="font-size:52px">Aftrap</div><div style="font-size:19px;line-height:1.4;color:#E6E6EA">Acht korte vragen. Daarna zet je persoonlijke trainer je sportschema voor je klaar.</div><div class="mu" style="margin-top:18px">± 2 minuten</div>
     ${LS.get('aftrapDone',0)?'<a class="btn ghost sm" href="#vandaag" style="margin-top:28px">Terug naar de app</a>':''}</div>`;
    setBar(`<button class="btn" id="next">Begin de aftrap</button>`); bar.querySelector('#next').onclick=()=>go(1); return; }
  if(s==='1') ob(1,'Hoe heet je trainer?',`<div class="mu" style="margin-bottom:12px">Je persoonlijke trainer kijkt mee, stuurt bij en zet je trainingen klaar.</div>${chips([...AF.trainers,'Zelf ✎'],AF.trainers.includes(tn)?tn:'Zelf ✎','trainer')}`);
  else if(s==='1b') ob(1,'Hoe heet je trainer?',`<div class="mu" style="margin-bottom:12px">Verzin zelf een naam.</div><input class="namein" id="tname" maxlength="24" autocomplete="off" autocapitalize="words" enterkeyhint="done" value="${esc(AF.trainers.includes(tn)?'':tn)}" placeholder="Naam van je trainer" autofocus>`);
  else if(s==='2') ob(2,'Wat wil je bereiken?','<div class="mu" style="margin-bottom:12px">Kies er één of meer.</div>'+chips(AF.doelen,a.doelen,'doelen')+said(a.doelen_transcript),{mic:true});
  else if(s==='3') ob(3,'Hoe vaak per week?',chips(AF.freq,a.frequentie,'frequentie')+`<div class="mu" style="margin-top:14px">${esc(tn)} verdeelt kracht en hardlopen over je week.</div>`);
  else if(s==='4'){ const e=a.event||{}, has=e.type&&!/^Nee/.test(e.type); const dt=e.datum||ymd(new Date(Date.now()+150*864e5)); const D=new Date(dt+'T12:00'), wks=Math.max(0,Math.round((D-new Date())/6048e5));
    ob(4,'Train je ergens naartoe?',chips(AF.events,e.type,'event')+(has?`<div class="step" style="margin-top:12px"><button data-m="-1" aria-label="maand eerder">−</button><b class="v">${MAAND[D.getMonth()]} ${D.getFullYear()}</b><button data-m="1" aria-label="maand later">+</button></div>
      <div class="step" style="margin-top:10px"><button data-dt="-5" aria-label="doeltijd sneller">−</button><b class="v">Doel ${esc(e.doeltijd||'1:10')}</b><button data-dt="5" aria-label="doeltijd langzamer">+</button></div>
      <div class="mu" style="margin-top:10px;text-align:center">nog ${wks} weken</div>`:'')+said(e.transcript),{mic:true}); }
  else if(s==='5') ob(5,'Vertel kort iets over jezelf',chips(AF.over,a.over_jou.chips,'over')+said(a.over_jou.transcript)+`<div class="mu" style="margin-top:12px">Alleen jij en ${esc(tn)} zien dit.</div>`,{opt:true,mic:true});
  else if(s==='6') ob(6,'Wat weeg je ongeveer?',`<div class="step" style="height:72px;margin-top:10px"><button data-kg="-1" style="width:72px;height:72px;font-size:30px" aria-label="minder">−</button><b class="v" style="font-size:36px">${a.gewicht_kg?a.gewicht_kg+' kg':'– kg'}</b><button data-kg="1" style="width:72px;height:72px;font-size:30px" aria-label="meer">+</button></div><div class="mu" style="margin-top:12px">Helpt ${esc(tn)} met gewichten kiezen.</div>`,{opt:true});
  else if(s==='7') ob(7,'Doelen met voeding?',chips(AF.voeding,a.voeding,'voeding'),{opt:true});
  else if(s==='8') ob(8,`Nog iets wat ${esc(tn)} moet weten?`,'<div class="mu" style="margin-bottom:12px">Blessures, werkrooster, materiaal thuis…</div>'+chips(AF.overig,a.overig.chips,'overig')+said(a.overig.transcript),{opt:true,mic:true,btn:'Klaar'});
  else if(s==='9') return aftrapKlaar(a);
  const n=s==='1b'?1:+s, next=()=>{ if(s==='1b'){ const v=(app.querySelector('#tname').value||'').trim(); if(!v){ app.querySelector('#tname').focus(); return; } a.trainer_name=v.slice(0,24); afSet(a); } go(n+1); };
  bar.querySelector('#next').onclick=next;
  const sk=app.querySelector('#skip'); if(sk) sk.onclick=()=>go(n+1);
  const ti=app.querySelector('#tname'); if(ti){ ti.addEventListener('keydown',e=>{ if(e.key==='Enter')next(); }); setTimeout(()=>ti.focus(),50); }
  app.onclick=e=>{ const b=e.target.closest('button'); if(!b)return; const d=b.dataset;
    if(d.k==='trainer'){ if(/^Zelf/.test(d.c))return go('1b'); a.trainer_name=d.c; afSet(a); return viewAftrap(s); }
    if(d.k==='frequentie'){ a.frequentie=d.c; }
    if(d.k==='event'){ a.event=Object.assign({},a.event,{type:d.c}); if(!a.event.datum)a.event.datum=ymd(new Date(Date.now()+150*864e5)); }
    const multi={doelen:'doelen',voeding:'voeding'}[d.k]; if(multi){ const L=a[multi]; const i=L.indexOf(d.c); i>=0?L.splice(i,1):L.push(d.c); if(d.c==='Geen'&&i<0)a[multi]=['Geen']; else a[multi]=a[multi].filter(x=>x!=='Geen'||d.c==='Geen'); }
    if(d.k==='over'||d.k==='overig'){ const o=d.k==='over'?a.over_jou:a.overig; const i=o.chips.indexOf(d.c); i>=0?o.chips.splice(i,1):o.chips.push(d.c); }
    if(d.m){ const D=new Date((a.event.datum||today())+'T12:00'); D.setMonth(D.getMonth()+(+d.m)); if(D>new Date())a.event.datum=ymd(D); }
    if(d.dt){ const [hh,mm]=(a.event.doeltijd||'1:10').split(':').map(Number); let t=Math.max(10,hh*60+mm+(+d.dt)); a.event.doeltijd=Math.floor(t/60)+':'+pad(t%60); }
    if(d.kg){ a.gewicht_kg=Math.max(30,Math.min(250,(a.gewicht_kg||80)+(+d.kg))); }
    if(b.id==='bigmic') return afMic(s,a);
    if(d.k||d.m||d.dt||d.kg){ afSet(a); viewAftrap(s); } };
}
async function afMic(s,a){ const mb=app.querySelector('#bigmic'), hint=app.querySelector('#bmh');
  if(afRec){ const r=afRec; afRec=null; mb.classList.remove('rec'); hint.textContent='Even luisteren…';
    try{ const au=await r.stop(); const data=await Voice.b64(au.blob); const key={'2':'doelen','4':'event','5':'over_jou','8':'overig'}[s];
      const opts={'2':AF.doelen,'4':AF.events,'5':AF.over,'8':AF.overig}[s];
      let tr='', ch=[];
      if(syncOn()&&Voice.aiOn()){ try{ const j=await api('POST',null,{action:'transcribe',question:app.querySelector('.q').textContent,options:opts,audio:{mime:au.mime,data}},CFG,1); if(j&&j.ok){ tr=j.transcript; ch=j.chips||[]; } }catch(e){} }
      if(!tr&&syncOn()){ const base='inbox/'+Voice.nowStamp()+'_aftrap-'+key; await api('POST',null,{action:'writefile',path:base+'.'+Voice.extOf(au.mime),content:data,encoding:'base64'}).catch(()=>{}); tr='(ingesproken · '+TRAINER()+' luistert het terug)'; }
      if(!tr) tr='(ingesproken, niet verstuurd: app niet gekoppeld)';
      if(key==='doelen'){ a.doelen_transcript=tr; ch.forEach(c=>{ if(!a.doelen.includes(c))a.doelen.push(c); }); }
      else if(key==='event'){ a.event=Object.assign({},a.event,{transcript:tr}); if(ch[0])a.event.type=ch[0]; }
      else { const o=a[key]; o.transcript=tr; ch.forEach(c=>{ if(!o.chips.includes(c))o.chips.push(c); }); }
      afSet(a); viewAftrap(s);
    }catch(e){ console.warn('afmic',e); const h=app.querySelector('#bmh'); if(h)h.textContent='Dat lukte niet. Tik gewoon je keuze.'; }
    return; }
  try{ afRec=await Voice.start(sec=>{ const h=app.querySelector('#bmh'); if(h)h.textContent='Ik luister… '+fmt(sec)+' · tik om te stoppen'; },()=>afMic(s,a)); mb.classList.add('rec'); }
  catch(e){ console.warn('mic',e); hint.textContent='Microfoon niet beschikbaar. Tik gewoon je keuze.'; }
}
function aftrapKlaar(a){ const tn=a.trainer_name||'Mike';
  const ev=a.event&&a.event.type&&!/^Nee/.test(a.event.type)?a.event.type+(a.event.doeltijd?' '+a.event.doeltijd:''):'', evT=ev&&a.event.type.toLowerCase();
  const dl=[ev,...a.doelen.filter(d=>!evT||d.toLowerCase()!==evT).map((d,i)=>ev||i?d.toLowerCase():d)].filter(Boolean); // v15 audit: doel en event ontdubbelen
  const items=[['✓',dl.length?dl.join(' · '):'Doel: fit blijven'],['✓',(a.frequentie||'?')+' per week'],['…','Startgewichten kiezen']];
  app.innerHTML=`<div class="ob" style="padding-top:calc(var(--sat) + 110px);text-align:center"><div class="av" style="width:96px;height:96px;font-size:34px;margin:0 auto 22px;box-shadow:0 0 0 10px rgba(255,107,26,.2)">${esc(initials(tn))}</div>
   <div class="q" style="font-size:44px">${esc(tn)} stelt je<br>eerste week samen</div><div class="ring" style="height:10px;margin:22px 30px"><i id="afp" style="width:10%;transition:width 2.4s"></i></div>
   <div class="card" style="text-align:left;margin-top:10px">${items.map(([x,t])=>`<div class="li" style="min-height:52px"><span class="ok" style="width:24px">${x}</span><span>${esc(t)}</span></div>`).join('')}</div></div>`;
  setBar('');
  const prof=Object.assign(LS.get('profile',{}),{id:PROFILE().id,name:PROFILE().name,trainer_name:tn,aftrap:Object.assign({},a,{done_at:new Date().toISOString()})});
  LS.set('profile',prof); LS.set('aftrapDone',1); localStorage.removeItem('aftrapDraft'); LS.set('aftrapPending',1); sendAftrap();
  requestAnimationFrame(()=>{ const p=document.getElementById('afp'); if(p)p.style.width='100%'; });
  setTimeout(()=>{ if(location.hash==='#aftrap/9') location.replace('#vandaag'); },2800); }
async function sendAftrap(){ if(!LS.get('aftrapPending',0)||!syncOn())return; const p=PROFILE();
  try{ const j=await api('POST',null,{action:'writefile',path:'profiel/'+p.id+'-aftrap.json',content:{profile_id:p.id,trainer_name:p.trainer_name,aftrap:p.aftrap}}); if(j&&j.ok)LS.set('aftrapPending',0); }catch(e){} }
