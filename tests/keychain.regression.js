// v15.3 sleutelhanger: echte <form>, username-veld (niet display:none), new-/current-password, submit in de form, navigatie na succes.
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
const chk=(p,view)=>p.evaluate(()=>{const f=document.querySelector('form#af');const vis=e=>e&&getComputedStyle(e).display!=='none'&&!e.hidden;
  const u=f&&f.querySelector('input[autocomplete="username"]'),pw=f?[...f.querySelectorAll('input[type=password]')].map(i=>[i.id,i.name,i.autocomplete]):[];
  const sb=f&&f.querySelector('button[type=submit]');return {form:!!f,u:u&&[u.id,u.name,u.value,u.readOnly,vis(u)],pw,sub:!!sb&&getComputedStyle(sb).display!=='none'};});
(async()=>{const b=await pw.webkit.launch();
const E=BE({props:{TOKEN:M,INVITE_CODES:'VG-7K2P=Sam'}});seedThijs(E);
let {c,p}=await ctx(b,E,{cfg:{API_URL:API,TOKEN:M}});
await p.waitForFunction(()=>location.hash==='#wachtwoord',null,{timeout:20000});await p.waitForTimeout(300);
let r=await chk(p);assert.ok(r.form&&r.sub,'geen form/submit: '+JSON.stringify(r));assert.deepStrictEqual(r.u,['un','username','thijs',true,true]);
assert.deepStrictEqual(r.pw,[['p','new-password','new-password'],['p2','new-password-confirm','new-password']]);
let navs=0;await p.exposeFunction('nav',()=>navs++);await p.evaluate(()=>addEventListener('hashchange',()=>window.nav()));
await p.fill('#p','Sterk-wachtwoord-42');await p.fill('#p2','Sterk-wachtwoord-42');
let subm=await p.evaluate(()=>new Promise(res=>{document.querySelector('#af').addEventListener('submit',e=>res(e.defaultPrevented||'pending'),{once:true});document.querySelector('#go').click();}));
await p.waitForFunction(()=>location.hash==='#vandaag',null,{timeout:15000});assert.ok(navs>0,'geen navigatie na succes');
assert.strictEqual(await p.evaluate(()=>history.length>1),true);
assert.strictEqual(await p.evaluate(()=>getComputedStyle(document.querySelector('#un')||document.body).display),'block'); // form is weg na navigatie: body
await c.close();
// inloggen
({c,p}=await ctx(b,E,{}));await p.evaluate(()=>location.hash='#inloggen');await p.waitForTimeout(500);
r=await chk(p);assert.ok(r.form&&r.sub);assert.deepStrictEqual(r.u.slice(0,2),['u','username']);assert.strictEqual(r.u[4],true);assert.deepStrictEqual(r.pw,[['p','password','current-password']]);
await p.fill('#u','thijs');await p.fill('#p','Sterk-wachtwoord-42');await p.click('#go');await p.waitForFunction(()=>location.hash==='#vandaag',null,{timeout:15000});await c.close();
// registreren
({c,p}=await ctx(b,E,{}));await p.evaluate(()=>location.hash='#registreren');await p.waitForTimeout(500);
r=await chk(p);assert.ok(r.form&&r.sub);assert.deepStrictEqual(r.u.slice(0,2),['u','username']);assert.deepStrictEqual(r.pw,[['p','new-password','new-password']]);
await c.close();await b.close();console.log('sleutelhanger-regressie OK');})().catch(e=>{console.error(e);process.exit(1);});
