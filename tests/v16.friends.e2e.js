// v16 vrienden end-to-end: thijs <-> proefvriend tegen de ECHTE Code.gs generic-5 (node, nep-Drive). Uitnodigen, toestemming, accepteren, cijfers, delen uit, verwijderen, geen detaildata, oude backend zonder kaart.
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
(async()=>{const b=await pw.webkit.launch();
const E=BE({props:{TOKEN:M,INVITE_CODES:'VG-7K2P'}});seedThijs(E);
const bodies=[];const orig=E.route;E.route=async r=>{ const u=new URL(r.request().url());const a=u.searchParams.get('action')||(r.request().postData()&&JSON.parse(r.request().postData()).action);
  if(a==='friends'){ const out=E.ctx.doGet({parameter:Object.fromEntries(u.searchParams.entries())});bodies.push(out.t);return r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:out.t}); } return orig(r); };
// Thijs: wachtwoord kiezen via koppeling -> account-modus
let T=await ctx(b,E,{cfg:{API_URL:API,TOKEN:M}});let p=T.p;
await p.waitForFunction(()=>location.hash==='#wachtwoord',null,{timeout:20000});await p.fill('#p','Thijs-sterk-2026!');await p.fill('#p2','Thijs-sterk-2026!');await p.click('#go');
await p.waitForFunction(()=>location.hash==='#vandaag',null,{timeout:15000});await p.reload();await p.waitForTimeout(1500);
await p.waitForSelector('#frcard',{timeout:8000});assert.match(await p.textContent('#frcard'),/Nodig een vriend uit/);
// proefvriend: account via invite (backend) en inloggen in de app
const reg=JSON.parse(E.ctx.doPost({parameter:{},postData:{contents:JSON.stringify({action:'register',invite:'VG-7K2P',username:'proefvriend',password:'Proef-sterk-2026',consent:true})}}).t);assert.ok(reg.ok);
const pv=JSON.parse(E.PROPS.USER_proefvriend);pv.consent.text_version='v15-1';E.PROPS.USER_proefvriend=JSON.stringify(pv); // bestaande v15-gebruiker
let V=await ctx(b,E,{cfg:{API_URL:API}});let q=V.p;await q.evaluate(()=>{location.hash='#inloggen';});await q.waitForTimeout(500);
await q.fill('#u','proefvriend');await q.fill('#p','Proef-sterk-2026');await q.click('#go');await q.waitForTimeout(1500);
if(await q.evaluate(()=>location.hash.startsWith('#aftrap')))await q.evaluate(()=>{localStorage.aftrapDone='1';location.hash='#vandaag';});
await q.reload();await q.waitForTimeout(1500);if(!(await q.$('#frcard')))console.log('DBG',await q.evaluate(()=>[location.hash,localStorage.friendsApi,localStorage.accounts&&'acc',localStorage.cfg,document.querySelector('main')&&document.querySelector('main').innerText.slice(0,200)]));assert.ok(await q.$('#frcard'),'geen vriendenkaart bij proefvriend');
// Thijs: toestemming v16, delen aan, uitnodigen
await p.click('#frcard');await p.waitForSelector('#frok');await p.screenshot({path:S+'v16-toestemming.png'});
assert.ok(await p.$eval('#frgo',b=>b.disabled));await p.check('#frok');await p.click('#frgo');await p.waitForSelector('#frsh');
assert.strictEqual(await p.$eval('#frsh',e=>e.checked),false,'delen staat niet standaard uit');
await p.click('label.tgrow');await p.waitForTimeout(600);assert.strictEqual(JSON.parse(E.PROPS.USER_thijs).friends_share,true);
await p.click('#frinv');await p.waitForSelector('.frcode',{timeout:8000});const code=(await p.textContent('.frcode')).trim();assert.match(code,/^VR-[A-Z2-9]{6}$/);
assert.strictEqual((await p.textContent('#frinv')).trim(),'Deel uitnodiging');
// proefvriend: link met code -> toestemming -> accepteren
await q.evaluate(c=>location.hash='#vrienden/'+c,code);await q.waitForSelector('#frok');await q.check('#frok');await q.click('#frgo');await q.waitForSelector('#frcode');
assert.strictEqual(await q.inputValue('#frcode'),code,'code uit link niet ingevuld');await q.click('#fracc button[type=submit]');await q.waitForTimeout(1200);
const rowQ=await q.textContent('.frl');assert.match(rowQ,/Thijs Hogeveen/);assert.match(rowQ,/🔥 \d+ dag(en)? · \d+ deze week · \d+ deze maand · /);
await q.screenshot({path:S+'v16-vrienden-proefvriend.png'});
// Thijs ziet proefvriend, die deelt nog niet
await p.evaluate(()=>location.hash='#vandaag');await p.waitForTimeout(300);await p.evaluate(()=>location.hash='#vrienden');await p.waitForTimeout(1500);
assert.match(await p.textContent('.frl'),/Proefvriend[\s\S]*deelt nog niet/);assert.ok(!(await p.$('.frcode')),'gebruikte code nog zichtbaar');await p.screenshot({path:S+'v16-vrienden-thijs.png'});
// vandaag-kaart proefvriend
await q.evaluate(()=>location.hash='#vandaag');await q.waitForTimeout(1500);assert.match(await q.textContent('#frcard'),/Thijs Hogeveen[\s\S]*🔥 \d+ · \d+ deze week/);
await q.evaluate(()=>document.querySelector('#frcard').scrollIntoView());await q.screenshot({path:S+'v16-kaart.png'});
// geen detaildata in friends-antwoorden
for(const t of bodies)assert.ok(!/notes|rpe|"sets"|workout_id|run|health|avg_hr|plan|exercise/i.test(t),'detaildata: '+t.slice(0,200));
// isolatie: sessie van proefvriend leest geen logs van thijs
const sp=await q.evaluate(()=>JSON.parse(localStorage.accounts)[0].token);
assert.strictEqual(JSON.parse(E.ctx.doGet({parameter:{action:'logs',token:sp,u:'thijs'}}).t).logs.length,0);
// verwijderen door Thijs: aan beide kanten
p.once('dialog',d=>d.accept());await p.click('[data-rm="proefvriend"]');await p.waitForTimeout(1200);assert.match(await p.textContent('main'),/Nog geen vrienden/);
await q.evaluate(()=>location.hash='#vrienden');await q.waitForTimeout(1500);assert.match(await q.textContent('main'),/Nog geen vrienden/);
// oude backend (geen friends-vlag): geen kaart, #vrienden -> vandaag
await q.evaluate(()=>{localStorage.friendsApi='false';location.hash='#vandaag';});await q.waitForTimeout(400);
await q.route(/script\.google\.com/,r=>{ const a=new URL(r.request().url()).searchParams.get('action'); if(a==='ping')return r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({ok:true,version:'generic-4',accounts:true,user:'proefvriend'})}); return r.fallback(); });
await q.reload();await q.waitForTimeout(1500);assert.strictEqual(await q.$('#frcard'),null,'kaart bij oude backend');await q.evaluate(()=>location.hash='#vrienden');await q.waitForTimeout(300);assert.strictEqual(await q.evaluate(()=>location.hash),'#vandaag');
for(const x of [p,q])assert.deepStrictEqual(x.errs.filter(e=>!/access control checks/.test(e)),[]); // afgebroken fetch bij herladen (testartefact)
assert.ok(!/\bAI\b/.test(require('fs').readFileSync(__dirname+'/../friends.js','utf8')));
await b.close();console.log('v16 vrienden-e2e OK');})().catch(e=>{console.error(e);process.exit(1);});
