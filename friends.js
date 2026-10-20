/* v16: vrienden. Alleen kerncijfers (workouts deze week/maand, reeks, laatste actieve dag); delen staat standaard uit.
   Zichtbaar als de backend het meldt (ping friends:true) en je met een eigen account bent ingelogd. */
const FRIENDS=(()=>{
  const TXT='Vrienden zien alleen je aantal workouts deze week en maand, je reeks en je laatste actieve dag. Nooit je logs, notities, plannen of gezondheidsdata. Delen staat uit tot je het aanzet.';
  const on=()=>!!LS.get('friendsApi',false)&&ACC.mode()==='account'&&syncOn();
  const me=()=>(ACC.active()||{}).id||'';
  const key=()=>'friends:'+me();
  const cache=()=>LS.get(key(),null);
  let last=0, busy=false;
  async function load(force){ if(!on())return null; if(!force&&Date.now()-last<60000)return cache(); last=Date.now();
    try{ const j=await api('GET',{action:'friends'},null,CFG,1); if(j&&j.ok){ LS.set(key(),j); return j; } }catch(e){} return cache(); }
  const ago=ds=>{ if(!ds)return 'nog niet actief'; const n=Math.round((new Date(today()+'T12:00')-new Date(ds+'T12:00'))/864e5); return n<=0?'vandaag actief':n===1?'gisteren actief':n+' dagen geleden actief'; };
  const stat=f=>f.shares?`🔥 ${f.streak} · ${f.week} deze week`:'deelt nog niet';
  function card(){ if(!on())return ''; const c=cache(); load().then(j=>{ const el=document.querySelector('#frcard'); if(el&&j)el.outerHTML=inner(j); });
    return inner(c); }
  function inner(c){ const L=(c&&c.friends)||[];
    return `<a class="card frc" id="frcard" href="#vrienden"><div class="rh2"><b class="h">Vrienden</b><span class="mu">›</span></div>${
      L.length?L.slice(0,3).map(f=>`<div class="frr"><span class="sp">${esc(f.name)}</span><span class="mu">${esc(stat(f))}</span></div>`).join('')+(L.length>3?`<div class="mu frm">+${L.length-3}</div>`:'')
      :`<div class="mu">Nodig een vriend uit en zie elkaars reeks.</div>`}</a>`; }
  async function view(arg){
    subHead('','Vrienden'); const pre=arg&&/^VR/i.test(arg)?arg.toUpperCase():'';
    let c=cache(); paint(c,pre); c=await load(true); if(location.hash.slice(1).split('/')[0]==='vrienden')paint(c,pre);
  }
  function paint(c,pre){
    if(!c){ app.innerHTML=`<div class="card mu">Laden…</div>`; setBar(''); return; }
    if(c.consent_needed){ app.innerHTML=`<div class="card"><p>${TXT}</p><label class="cons"><input type="checkbox" id="frok" class="cb"><span>Ik ga akkoord</span></label></div>`;
      setBar(`<button class="btn" id="frgo" disabled>Doorgaan</button>`); const ok=app.querySelector('#frok'), go=bar.querySelector('#frgo');
      ok.onchange=()=>{ go.disabled=!ok.checked; };
      go.onclick=async()=>{ go.disabled=true; const j=await api('POST',null,{action:'friend_consent',consent:true},CFG,1).catch(()=>null); if(!j||!j.ok){ toast('Lukt niet, probeer opnieuw'); go.disabled=false; return; } paint(await load(true),pre); };
      return; }
    const L=c.friends||[], oc=c.open_code;
    app.innerHTML=`<label class="tgrow card"><span class="sp">Deel mijn cijfers met vrienden<div class="mu frh">${TXT}</div></span><input type="checkbox" class="tg" id="frsh" ${c.share?'checked':''}></label>
      <h2>Je vrienden</h2>${L.length?`<div class="card frl">${L.map(f=>`<div class="frr2"><span class="sp"><b>${esc(f.name)}</b><div class="mu">${f.shares?`🔥 ${f.streak} ${f.streak===1?"dag":"dagen"} · ${f.week} deze week · ${f.month} deze maand · ${ago(f.last_active)}`:'deelt nog niet'}</div></span><button class="frx" data-rm="${esc(f.id)}" aria-label="${esc(f.name)} verwijderen">✕</button></div>`).join('')}</div>`:`<div class="card mu">Nog geen vrienden.</div>`}
      ${oc?`<h2>Je uitnodiging</h2><div class="card"><div class="frcode">${esc(oc.code)}</div><div class="mu">Eén keer te gebruiken, geldig tot ${new Date(oc.expires).toLocaleDateString('nl-NL',{day:'numeric',month:'long'})}.</div></div>`:''}
      <h2>Code van een vriend</h2><form class="card frf" id="fracc"><input id="frcode" name="code" type="text" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="VR-XXXXXX" value="${esc(pre)}"><button class="btn ghost sm" type="submit">Toevoegen</button></form>`;
    setBar(`<button class="btn" id="frinv">${oc?'Deel uitnodiging':'Vriend uitnodigen'}</button>`);
    app.querySelector('#frsh').onchange=async e=>{ const v=e.target.checked; const j=await api('POST',null,{action:'friend_share',on:v},CFG,1).catch(()=>null); if(!j||!j.ok){ e.target.checked=!v; toast('Lukt niet'); return; } c.share=j.share; LS.set(key(),c); toast(v?'Delen staat aan':'Delen staat uit'); };
    app.querySelector('#fracc').onsubmit=async e=>{ e.preventDefault(); if(busy)return; const v=app.querySelector('#frcode').value.trim(); if(!v)return; busy=true;
      const j=await api('POST',null,{action:'friend_accept',code:v},CFG,1).catch(()=>null); busy=false;
      if(!j||!j.ok){ toast(j&&j.code==='own_code'?'Dat is je eigen code':j&&j.code==='locked'?'Te vaak geprobeerd, wacht even':'Code werkt niet'); return; }
      toast(j.friend.name+' is nu je vriend'); history.replaceState(null,'','#vrienden'); paint(await load(true),''); };
    app.onclick=async e=>{ const b=e.target.closest('[data-rm]'); if(!b)return; const f=L.find(x=>x.id===b.dataset.rm); if(!confirm((f?f.name:'Deze vriend')+' verwijderen? Jullie zien elkaars cijfers dan niet meer.'))return;
      const j=await api('POST',null,{action:'friend_remove',u:b.dataset.rm},CFG,1).catch(()=>null); if(!j||!j.ok){ toast('Lukt niet'); return; } paint(await load(true),''); };
    bar.querySelector('#frinv').onclick=async()=>{ let code=oc&&oc.code;
      if(!code){ const j=await api('POST',null,{action:'friend_invite'},CFG,1).catch(()=>null); if(!j||!j.ok){ toast('Lukt niet'); return; } code=j.code; paint(await load(true),''); }
      const url=location.origin+location.pathname+'#vrienden/'+code, t='Train je mee? Voeg me toe als vriend in VOLGAS met code '+code;
      if(navigator.share){ try{ await navigator.share({title:'VOLGAS',text:t,url}); }catch(x){} }
      else { try{ await navigator.clipboard.writeText(t+' '+url); toast('Gekopieerd'); }catch(x){ toast(code); } } };
  }
  return {card,view,on,load};
})();
