// v15 end-to-end: app (WebKit, 390 px) tegen de ECHTE Code.gs generic-4 in node met nep-Drive. Synthetische data.
// Wachtwoord kiezen (Thijs, via bestaande koppeling), inloggen/fout/slot/bezig, registreren met code + toestemming -> Aftrap,
// isolatie tussen accounts, wisselen, verlopen token, uitloggen (synct eerst), niet-ingelogd-blijven, oude backend = token-modus.
const pw=require(process.env.PW||'/workspace/mkb-websites/tools/node_modules/playwright');const assert=require('assert');const fs=require('fs');const BE=require('./e2e-backend');
const U=process.argv[2]||'http://localhost:8765/';const S=__dirname+'/shots/';const P=JSON.parse(fs.readFileSync(__dirname+'/fixture-plan-w41-42.json'));const W=Array.isArray(P)?P:P.workouts;
const M='master-tok';const DAY='2026-10-15';
function seedThijs(E){ const by={};W.forEach(w=>{const k=E.ctx.isoWeek_(w.date);(by[k]=by[k]||[]).push(w);});for(const k in by)E.dir('plan').createFile('week-'+k+'.json',JSON.stringify(by[k]));
  [['2026-10-12-z2',{duration_min:50,distance_km:6.5,avg_hr:141}],['2026-10-13-tempo',{duration_min:33,distance_km:5,avg_hr:150}],['2026-10-14-kracht-a',null]].forEach(([id,run])=>
    E.dir('logs').createFile(id.slice(0,10)+'_'+id+'.json',JSON.stringify({workout_id:id,date:id.slice(0,10),status:'gedaan',profile_id:'thijs',sets:[],run:run||{},feedback:{},updated_at:id.slice(0,10)+'T18:00:00Z'})));
  E.dir('profiel').createFile('thijs-aftrap.json',JSON.stringify({profile_id:'thijs',trainer_name:'Mike',aftrap:{doelen:['HYROX']}})); }
async function ctx(b,E,{cfg=null,keep=null}={}){ const c=keep||await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block',hasTouch:true});
  if(!keep){ await c.addInitScript(d=>{const D=Date;const off=new D(d+'T09:00:00+02:00').getTime()-D.now();window.Date=class extends D{constructor(...a){super(...(a.length?a:[D.now()+off]))}static now(){return D.now()+off}};},DAY);
    await c.route(/script\.google(usercontent)?\.com/,r=>E.route(r)); }
  const p=await c.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));
  await p.goto(U);await p.waitForTimeout(600);await p.evaluate(cfg=>{localStorage.clear();sessionStorage.clear();if(cfg){localStorage.cfg=JSON.stringify(cfg);localStorage.aftrapDone='1';localStorage.mile='100';}history.replaceState(null,'','/#vandaag');},cfg);
  await p.reload();await p.waitForTimeout(900);return {c,p}; }
const API='https://script.google.com/macros/s/M/exec';
const logIds=p=>p.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('log:')).sort());
const hash=p=>p.evaluate(()=>location.hash);
(async()=>{const b=await pw.webkit.launch();
// ===== A) oude backend (generic-3): token-modus blijft, geen inlogscherm
{ const c=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await c.route(/script\.google\.com/,r=>{const a=new URL(r.request().url()).searchParams.get('action');
    r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(a==='ping'?(new URL(r.request().url()).searchParams.get('token')?{ok:true,version:'generic-3'}:{ok:false,error:'unauthorized'}):a==='plan'?{ok:true,workouts:W}:a==='logs'?{ok:true,logs:[]}:{ok:true})})});
  const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(U);await p.evaluate(a=>{localStorage.clear();localStorage.aftrapDone='1';localStorage.cfg=JSON.stringify({API_URL:a,TOKEN:'oud-token-1234567890'});history.replaceState(null,'','/#vandaag');},API);await p.reload();await p.waitForTimeout(1500);
  assert.strictEqual(await hash(p),'#vandaag','oude backend: geen login/wachtwoord');assert.strictEqual(await p.evaluate(()=>ACC.mode()),'token');
  await p.evaluate(()=>{localStorage.removeItem('cfg');history.replaceState(null,'','/#vandaag');});await p.reload();await p.waitForTimeout(1500);
  assert.notStrictEqual(await hash(p),'#inloggen','oude backend zonder koppeling mag niet naar inloggen');assert.match(await p.innerText('main'),/Niet gekoppeld/);
  await p.click('#avbtn');await p.waitForTimeout(200);const sh=await p.innerText('.sheet');assert.ok(!/Account toevoegen|Uitloggen/.test(sh),'accountknoppen bij oude backend');
  assert.deepStrictEqual(errs,[]);await c.close(); }
// ===== B) Thijs: bestaande koppeling (master) -> eenmalig wachtwoord kiezen
const E=BE({props:{TOKEN:M,INVITE_CODES:'VG-7K2P=Sam'}});seedThijs(E);
let {c,p}=await ctx(b,E,{cfg:{API_URL:API,TOKEN:M}});
await p.waitForFunction(()=>location.hash==='#wachtwoord',null,{timeout:20000});
assert.match(await p.innerText('main'),/Kies een wachtwoord voor je account[\s\S]*Gebruikersnaam/i);assert.strictEqual(await p.inputValue('#un'),'thijs');assert.strictEqual(await p.$('header nav.tabs a'),null);
assert.ok(await p.evaluate(()=>document.querySelector('#micfab').hidden),'mic op wachtwoordscherm');
const go=()=>p.evaluate(()=>document.querySelector('#go').disabled);
await p.fill('#p','kort');assert.strictEqual(await go(),true);assert.match(await p.innerText('#sw'),/Zwak/);
await p.fill('#p','Vuurwerk-2026!');await p.fill('#p2','Vuurwerk-2026');assert.match(await p.innerText('#eq'),/Niet hetzelfde/);assert.strictEqual(await go(),true);
await p.fill('#p2','Vuurwerk-2026!');assert.match(await p.innerText('#eq'),/✓ Hetzelfde/);assert.match(await p.innerText('#sw'),/Sterk|Heel sterk/);assert.strictEqual(await go(),false);
await p.click('[data-eye="p"]');assert.strictEqual(await p.getAttribute('#p','type'),'text');assert.strictEqual(await p.getAttribute('[data-eye="p"]','aria-label'),'Verberg wachtwoord');await p.click('[data-eye="p"]');
await p.screenshot({path:S+'v15-07-wachtwoord-kiezen.png'});
const logsBefore=await logIds(p);assert.strictEqual(logsBefore.length,3);
await p.click('#go');await p.waitForFunction(()=>location.hash==='#vandaag',null,{timeout:10000});await p.waitForTimeout(600);
let st=await p.evaluate(()=>({mode:ACC.mode(),acc:JSON.parse(localStorage.accounts),cfg:JSON.parse(localStorage.cfg),aftrap:localStorage.aftrapDone,pw:Object.values(localStorage).some(v=>/Vuurwerk/.test(v))}));
assert.strictEqual(st.mode,'account');assert.strictEqual(st.acc[0].id,'thijs');assert.match(st.acc[0].token,/^s1\./);assert.strictEqual(st.cfg.TOKEN,'','master-token staat nog op het toestel');
assert.strictEqual(st.pw,false,'wachtwoord lokaal opgeslagen');assert.deepStrictEqual(await logIds(p),logsBefore,'logs veranderd na wachtwoord kiezen');assert.strictEqual(st.aftrap,'1','Thijs moet niet naar Aftrap');
const TH=st.acc[0].token;await p.evaluate(()=>location.reload());await p.waitForTimeout(1200);assert.strictEqual(await hash(p),'#vandaag','na herstart geen wachtwoordscherm meer');
assert.ok(E.calls.filter(x=>x==='GET plan').length>0);
// Thijs logt een training (account-veld)
await p.evaluate(()=>{const w=PLAN.find(x=>x.date==='2026-10-15');const l=getLog(w);l.status='gedaan';saveLog(l);});await p.waitForTimeout(1500);
const lg=JSON.parse(E.tree()['logs/2026-10-15_'+(await p.evaluate(()=>PLAN.find(x=>x.date==='2026-10-15').id))+'.json']);assert.strictEqual(lg.account,'thijs');assert.strictEqual(lg.profile_id,'thijs');
await p.close();
// ===== C) nieuw toestel: inloggen (fout, bezig, ok)
({c,p}=await ctx(b,E));await p.waitForFunction(()=>location.hash==='#inloggen',null,{timeout:10000});
await p.screenshot({path:S+'v15-01-inloggen.png'});
const attrs=await p.evaluate(()=>({u:[...document.querySelector('#u').attributes].map(a=>a.name+'='+a.value).join(' '),p:document.querySelector('#p').getAttribute('autocomplete'),form:!!document.querySelector('form#af'),rem:document.querySelector('#rem').checked,fs:getComputedStyle(document.querySelector('#u')).fontSize}));
assert.match(attrs.u,/autocomplete=username/);assert.match(attrs.u,/autocapitalize=off/);assert.strictEqual(attrs.p,'current-password');assert.ok(attrs.form&&attrs.rem);assert.ok(parseFloat(attrs.fs)>=16);
await p.fill('#u','Thijs ');await p.fill('#p','fout-wachtwoord');await p.press('#p','Enter');await p.waitForSelector('.errt');
assert.strictEqual(await p.innerText('.errt'),'Wachtwoord klopt niet. Probeer het opnieuw.');assert.ok(await p.$('.fld.err #p'));assert.strictEqual(await p.inputValue('#p'),'fout-wachtwoord','wachtwoord moet blijven staan');
await p.screenshot({path:S+'v15-04-inloggen-fout.png'});
await p.fill('#u','bestaatniet');await p.fill('#p','x');await p.click('#go');await p.waitForTimeout(300);assert.strictEqual(await p.innerText('.errt'),'Wachtwoord klopt niet. Probeer het opnieuw.','onbekende naam verraadt zich');
E.delay=1500;await p.fill('#u','thijs');await p.fill('#p','Vuurwerk-2026!');await p.click('#go');await p.waitForTimeout(250);
assert.match(await p.innerText('#go'),/Inloggen…/);assert.ok(await p.evaluate(()=>document.querySelector('#u').readOnly&&document.querySelector('#go').disabled));
await p.screenshot({path:S+'v15-03-inloggen-bezig.png'});
await p.waitForFunction(()=>location.hash==='#vandaag',null,{timeout:10000});E.delay=0;await p.waitForTimeout(800);
await p.waitForFunction(()=>Object.keys(localStorage).filter(k=>k.startsWith('log:')).length===4,null,{timeout:8000});assert.strictEqual((await logIds(p)).length,4,'zelfde data op nieuw toestel');assert.match(await p.innerText('main'),/dag/i);
await p.screenshot({path:S+'v15-vandaag-thijs.png'});
// ===== D) account toevoegen: registreren met uitnodiging -> Aftrap
await p.click('#avbtn');await p.waitForTimeout(200);await p.click('[data-add]');await p.waitForTimeout(400);assert.strictEqual(await hash(p),'#inloggen');
assert.strictEqual(await p.inputValue('#u'),'','naam van vorig account ingevuld');
await p.click('a.lnk');await p.waitForTimeout(300);assert.strictEqual(await hash(p),'#registreren');
assert.strictEqual(await p.evaluate(()=>document.querySelector('#ok').checked),false,'toestemming staat standaard aan');assert.strictEqual(await go(),true,'knop actief zonder toestemming');
assert.ok((await p.innerText('.cons')).includes('Je gegevens staan in de Google Drive van Thijs en spraakopnames gaan naar Google voor spraakherkenning.'));
assert.strictEqual(await p.getAttribute('#c','autocomplete'),'one-time-code');
await p.fill('#c','vg-nope');await p.fill('#u','sanne');await p.fill('#p','Sanne-2026!');await p.click('.cons');assert.strictEqual(await go(),false);
await p.click('#go');await p.waitForSelector('.errt');assert.strictEqual(await p.innerText('.errt'),'Deze code werkt niet (meer).');
await p.fill('#c','vg 7k2p');assert.strictEqual(await p.inputValue('#c'),'VG 7K2P');await p.fill('#u','thijs');await p.fill('#p','Sanne-2026!');await p.click('#go');await p.waitForSelector('.errt');assert.strictEqual(await p.innerText('.errt'),'Deze naam is al in gebruik.');
await p.fill('#u','sanne');await p.fill('#p','Sanne-2026!');
await p.screenshot({path:S+'v15-05-registreren.png'});
await p.click('#go');await p.waitForFunction(()=>location.hash==='#aftrap/0',null,{timeout:10000});await p.waitForTimeout(300);
assert.match(await p.innerText('body'),/Aftrap[\s\S]*persoonlijke trainer/i);await p.screenshot({path:S+'v15-06-naar-aftrap.png'});
st=await p.evaluate(()=>({logs:Object.keys(localStorage).filter(k=>k.startsWith('log:')),plan:JSON.parse(localStorage.plan||'[]').length,acc:JSON.parse(localStorage.accounts).map(a=>a.id).sort(),cur:ACC.active().id,prof:JSON.parse(localStorage.profile)}));
assert.deepStrictEqual(st.logs,[],'sanne ziet logs van thijs (lokaal)');assert.strictEqual(st.plan,0,'sanne ziet plan van thijs');assert.deepStrictEqual(st.acc,['sanne','thijs']);assert.strictEqual(st.cur,'sanne');assert.strictEqual(st.prof.id,'sanne');
assert.ok(JSON.parse(E.PROPS.USER_sanne).consent.text_version==='v16-1');
// sanne rondt de aftrap af (kort), logt iets; dat komt in users/sanne
await p.evaluate(()=>{localStorage.aftrapDone='1';location.hash='#vandaag';});await p.waitForTimeout(400);
E.post({action:'writeplan',token:M,u:'sanne',week:'2026-W42',workouts:[{id:'2026-10-15-s-z2',date:'2026-10-15',type:'run_z2',title:'Zone 2 · 30 min',duration_min:30}]});
await p.evaluate(()=>loadPlan());await p.waitForTimeout(600);await p.evaluate(()=>{const w=PLAN.find(x=>x.id==='2026-10-15-s-z2');const l=getLog(w);l.status='gedaan';l.run={duration_min:30,distance_km:4,avg_hr:138};saveLog(l);});await p.waitForTimeout(1500);
assert.ok(E.tree()['users/sanne/logs/2026-10-15_2026-10-15-s-z2.json'],'log sanne niet in users/sanne');assert.ok(!E.tree()['logs/2026-10-15_2026-10-15-s-z2.json'],'log sanne bij thijs');
// ===== E) profiel-sheet + wisselen
await p.click('#avbtn');await p.waitForTimeout(250);const sh=await p.innerText('.sheet');
assert.match(sh,/SANNE[\s\S]*sanne · trainer Sam/i);assert.match(sh,/Thijs Hogeveen[\s\S]*trainer Mike/);assert.strictEqual((sh.match(/Sanne/gi)||[]).length,2,'huidig account dubbel in de sheet: '+sh);
assert.match(sh,/Account toevoegen/);assert.match(sh,/Koppeling/);assert.match(sh,/Versie[\s\S]*v1[56]/);assert.match(sh,/Uitloggen/);
await p.screenshot({path:S+'v15-08-profiel-sheet.png'});
await p.click('[data-acc="thijs"]');await p.waitForTimeout(1500);assert.strictEqual(await p.evaluate(()=>ACC.active().id),'thijs');
assert.strictEqual((await logIds(p)).length,4);assert.ok(!(await logIds(p)).some(k=>/s-z2/.test(k)),'thijs ziet log van sanne');
await p.click('#avbtn');await p.waitForTimeout(200);await p.click('[data-acc="sanne"]');await p.waitForTimeout(1500);
assert.deepStrictEqual(await logIds(p),['log:2026-10-15-s-z2']);
// ===== F) uitloggen: synct eerst; met wachtrij -> waarschuwing
await p.evaluate(()=>{const w=PLAN.find(x=>x.id==='2026-10-15-s-z2');const l=getLog(w);l.notes='nog niet verstuurd';saveLog(l,false);LS.set('queue',['2026-10-15-s-z2']);});
await c.setOffline(true);await p.click('#avbtn');await p.waitForTimeout(200);await p.click('#out');await p.waitForTimeout(400);
assert.match(await p.innerText('.pop'),/Er staan nog 1 training klaar om te versturen\. Toch uitloggen\?/);await p.click('#lo-no');await c.setOffline(false);await p.waitForTimeout(300);
await p.click('#avbtn');await p.waitForTimeout(200);await p.click('#out');await p.waitForTimeout(1500);
assert.match(await p.innerText('.pop'),/Je trainingen blijven bewaard/);assert.match(JSON.parse(E.tree()['users/sanne/logs/2026-10-15_2026-10-15-s-z2.json']).notes,/nog niet verstuurd/,'uitloggen synct niet eerst');
await p.screenshot({path:S+'v15-09-uitloggen-bevestigen.png'});
await p.click('#lo-yes');await p.waitForFunction(()=>location.hash==='#inloggen',null,{timeout:10000});await p.waitForTimeout(300);
assert.strictEqual(await p.inputValue('#u'),'sanne','naam niet ingevuld na uitloggen');assert.deepStrictEqual(await logIds(p),[],'lokale logs van sanne blijven staan');
assert.deepStrictEqual(await p.evaluate(()=>JSON.parse(localStorage.accounts).map(a=>a.id)),['thijs'],'ander account uitgelogd');
assert.ok(!Object.keys(E.PROPS).some(k=>k.startsWith('SESS_')&&JSON.parse(E.PROPS[k]).u==='sanne'&&E.calls.includes('POST logout')),'sessie niet ingetrokken');
// ===== G) slot na 5 fouten
for(let i=0;i<5;i++){await p.fill('#p','fout'+i);await p.click('#go');await p.waitForTimeout(250);}
assert.strictEqual(await p.innerText('.errt'),'Te vaak geprobeerd. Wacht 5 minuten.');
// ===== H) verlopen token -> inloggen met naam ingevuld, logs blijven
await p.evaluate(()=>{localStorage.acct=JSON.stringify('thijs');localStorage.aftrapDone='1';history.replaceState(null,'','/#vandaag');});await p.reload();await p.waitForTimeout(1200);assert.strictEqual(await hash(p),'#vandaag');
for(const k of Object.keys(E.PROPS)) if(k.startsWith('SESS_')&&JSON.parse(E.PROPS[k]).u==='thijs') delete E.PROPS[k]; // server trekt sessies in
await p.evaluate(()=>loadPlan());await p.waitForFunction(()=>location.hash==='#inloggen',null,{timeout:10000});
assert.strictEqual(await p.inputValue('#u'),'thijs');assert.strictEqual((await logIds(p)).length,4,'logs weg na verlopen token');
await p.fill('#p','Vuurwerk-2026!');await p.click('#go');await p.waitForFunction(()=>location.hash==='#vandaag',null,{timeout:10000});
// ===== I) niet ingelogd blijven -> alleen sessionStorage
await p.waitForTimeout(1500);await p.evaluate(()=>{localStorage.clear();sessionStorage.clear();});{const e0=p.errs;await p.close();p=await c.newPage();p.errs=e0;p.on('pageerror',e=>p.errs.push(e.message));}await p.goto(U+'#vandaag');await p.waitForFunction(()=>location.hash==='#inloggen',null,{timeout:10000});
await p.fill('#u','thijs');await p.fill('#p','Vuurwerk-2026!');await p.click('#rem');await p.click('#go');await p.waitForFunction(()=>location.hash==='#vandaag',null,{timeout:10000});
st=await p.evaluate(()=>({ls:localStorage.accounts||null,ss:!!sessionStorage.sessAcct}));assert.strictEqual(st.ls,null);assert.strictEqual(st.ss,true);
assert.deepStrictEqual(p.errs,[]);await c.close();await b.close();console.log('v15 e2e OK');})().catch(e=>{console.error('FAIL',e.message,(e.stack.match(/v15.e2e.js:(\d+)/g)||[]).join(' '));process.exit(1)});
