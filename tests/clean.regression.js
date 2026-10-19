// v14.2 clean: streak-ketting op Week + onderaan Vandaag; Week past op 390×844; datum rechts op titelregel; geen subregels; Vonk uitgelijnd.
const pw=require(process.env.PW||'/workspace/mkb-websites/tools/node_modules/playwright');const assert=require('assert');const fs=require('fs');
const U=process.argv[2]||'http://localhost:8765/';const P=JSON.parse(fs.readFileSync(__dirname+'/fixture-plan-w41-42.json'));const W=Array.isArray(P)?P:P.workouts;
const LOGS=[{workout_id:'2026-10-12-z2',date:'2026-10-12',status:'gedaan',sets:[],run:{duration_min:44},updated_at:'2026-10-12T10:00:00Z'},{workout_id:'2026-10-13-tempo',date:'2026-10-13',status:'gedaan',sets:[],run:{},updated_at:'2026-10-13T10:00:00Z'}];
(async()=>{const b=await pw.webkit.launch();const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block'});
await c.addInitScript(()=>{const D=Date;const off=new D('2026-10-14T09:00:00+02:00').getTime()-D.now();window.Date=class extends D{constructor(...a){super(...(a.length?a:[D.now()+off]))}static now(){return D.now()+off}};});
await c.route(/script\.google\.com/,r=>{const a=new URL(r.request().url()).searchParams.get('action');r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(a==='logs'?{ok:true,logs:LOGS}:{ok:true,workouts:W,logs:[]})})});
const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(U);await p.evaluate(()=>{localStorage.clear();localStorage.aftrapDone='1';localStorage.cfg=JSON.stringify({API_URL:'https://script.google.com/macros/s/M/exec',TOKEN:'t'});history.replaceState(null,'','/#vandaag');});
await p.reload();await p.waitForFunction(()=>/^"ok/.test(localStorage.serverLogsState||''),null,{timeout:15000});await p.evaluate(()=>{location.hash='#week';location.hash='#vandaag';});await p.waitForTimeout(500);
// Vonk uitgelijnd met 'N dagen'
const al=await p.evaluate(()=>{const h=document.querySelector('.streak .h').getBoundingClientRect(),n=document.querySelector('.streak .nt').getBoundingClientRect();return Math.abs((h.top+h.bottom)/2-(n.top+n.bottom)/2);});
assert.ok(al<=2,'Vonk niet uitgelijnd: '+al);
// ketting onderaan Vandaag, 7 schakels, laatste blok vóór versie
assert.strictEqual(await p.$$eval('main .chain .lk',x=>x.length),7);
assert.ok(await p.evaluate(()=>{const ch=document.querySelector('main .chain'), rc=ch.closest('.reeks');return rc&&rc===document.querySelector('main').lastElementChild&&document.querySelectorAll('main .streak').length===1&&!document.querySelector('main .ver');}),'v15: reeks niet één keer onderaan (kaart met ketting) of versie nog op Vandaag');
assert.ok(await p.$('.chain .lk.ok'),'geen gesloten schakel voor gedane dag');
await p.screenshot({path:__dirname+'/shots/v142-vandaag.png',fullPage:true});
// Week
await p.evaluate(()=>location.hash='#week');await p.waitForTimeout(400);
assert.strictEqual(await p.$$eval('main .chain .lk',x=>x.length),7,'geen ketting op Week');
const hd=await p.evaluate(()=>{const h=document.querySelector('.wkhd h1').getBoundingClientRect(),l=document.querySelector('.wkhd .lbl').getBoundingClientRect();return {same:l.top<h.bottom&&l.bottom>h.top,right:Math.round(innerWidth-l.right)};});
assert.ok(hd.same,'datum niet op titelregel');
const nav=await p.evaluate(()=>[...document.querySelectorAll('.wkhd .wnav')].map(b=>[b.textContent.trim(),Math.round(b.getBoundingClientRect().height)]));assert.deepStrictEqual(nav,[['‹',56],['›',56]],'v15: ‹ › 56 px in de kopregel, geen Nu in de huidige week');
assert.strictEqual(await p.$$eval('main .wl .mu[style]',x=>x.length),0,'subregels nog aanwezig');
const fit=await p.evaluate(()=>{const r=[...document.querySelectorAll('main .wl')].pop().getBoundingClientRect();return r.bottom<=innerHeight;});
assert.ok(fit,'week past niet op één scherm');
await p.screenshot({path:__dirname+'/shots/v142-week.png'});
await p.evaluate(()=>location.hash='#morgen');await p.waitForTimeout(300);await p.screenshot({path:__dirname+'/shots/v142-morgen.png',fullPage:true});
await p.evaluate(()=>location.hash='#progressie/kracht');await p.waitForTimeout(300);await p.screenshot({path:__dirname+'/shots/v142-progressie.png',fullPage:true});
const txt=await p.evaluate(()=>document.body.innerText);assert.ok(!/\bAI\b/.test(txt)&&!/drempel/i.test(txt));
assert.deepStrictEqual(errs,[]);console.log('clean-regressie OK');await b.close();})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
