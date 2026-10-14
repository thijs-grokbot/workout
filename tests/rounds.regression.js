// v14.1: warming-up afvinken toont 'Verder met ronde 1' (één tik); na een ronde + 'Verder' gaat de app naar de volgende ronde, na de laatste naar cooling-down.
const pw=require(process.env.PW||'/workspace/mkb-websites/tools/node_modules/playwright');const assert=require('assert');const fs=require('fs');
const U=process.argv[2]||'http://localhost:8765/';const P=JSON.parse(fs.readFileSync(__dirname+'/fixture-plan-w41-42.json'));const W=Array.isArray(P)?P:P.workouts;
(async()=>{const b=await pw.webkit.launch();const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block'});const posted=[];
await c.route(/script\.google\.com/,r=>{const q=r.request();if(q.method()==='POST')posted.push(JSON.parse(q.postData()));r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({ok:true,workouts:W,logs:[]})})});
const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
const go=h=>p.evaluate(x=>{location.hash=x},h);
const tab=()=>p.evaluate(()=>(document.querySelector('header .tabs .on')||{}).textContent||'');
await p.goto(U);await p.evaluate(()=>{localStorage.clear();localStorage.aftrapDone='1';localStorage.cfg=JSON.stringify({API_URL:'https://script.google.com/macros/s/M/exec',TOKEN:'t'});history.replaceState(null,'','/');});
await p.reload();await go('#w/2026-10-14-kracht-a');await p.waitForTimeout(400);
for(let i=0;i<10;i++){ const n=await p.$$('.ex:not(.done) [data-chk]'); if(!n.length)break; await n[0].click(); await p.waitForTimeout(120); }
if(!/Verder met Ronde 1/i.test(await p.innerText('main')))console.log('DBG',await p.evaluate(()=>[localStorage.nextRound,document.querySelectorAll('.ex:not(.done)').length,location.hash].join(' # ')));assert.match(await p.innerText('main'),/Verder met Ronde 1/i,'geen kaart na warming-up');
assert.match(await tab(),/Warm-up/,'warming-up verliet zichzelf');
await p.click('#gonext');await p.waitForTimeout(300);
assert.match(await tab(),/Ronde 1/,'één tik ging niet naar ronde 1');
assert.strictEqual(await p.$('#gonext'),null,'kaart bleef staan');
await p.screenshot({path:__dirname+'/shots/v141-ronde1.png'});
// ronde 1 afronden -> rust, 'Verder' -> ronde 2
await p.click('#next');await p.waitForTimeout(300);
assert.strictEqual(await p.evaluate(()=>location.hash),'#w/2026-10-14-kracht-a/r1','route wisselde vóór Verder');
assert.strictEqual(await p.evaluate(()=>document.querySelector('#overlay').style.display),'block','geen rustscherm');
await p.screenshot({path:__dirname+'/shots/v141-rust.png'});
await p.click('.rest .foot .btn');await p.waitForTimeout(300);
assert.strictEqual(await p.evaluate(()=>location.hash),'#w/2026-10-14-kracht-a/r2','Verder ging niet naar ronde 2');
assert.match(await tab(),/Ronde 2/);
await p.screenshot({path:__dirname+'/shots/v141-ronde2.png'});
// ronde 2 afronden -> rust, 'Verder' -> cooling-down
await p.click('#next');await p.waitForTimeout(200);await p.click('.rest .foot .btn');await p.waitForTimeout(300);
assert.match(await tab(),/Cool-down/,'na laatste ronde niet naar cooling-down');
await p.screenshot({path:__dirname+'/shots/v141-cooldown.png'});
// cooling-down afvinken -> kaart 'Verder met Afsluiten' -> afsluitscherm
for(let i=0;i<10;i++){ const n=await p.$$('.ex:not(.done) [data-chk]'); if(!n.length)break; await n[0].click(); await p.waitForTimeout(120); }
assert.match(await p.innerText('main'),/Verder met Afsluiten/);
await p.click('#gonext');await p.waitForTimeout(300);
assert.match(await p.evaluate(()=>location.hash),/\/klaar$/,'niet naar afsluiten');
// uitvinken mag de kaart niet tonen
await go('#w/2026-10-14-kracht-a');await p.waitForTimeout(300);
const first=await p.$('.ex.done .exr');await first.click();await p.waitForTimeout(200);
assert.strictEqual(await p.$('#gonext'),null,'kaart na uitvinken');
assert.ok(posted.every(x=>x.action==='log'),'iets anders dan logs verstuurd: '+posted.map(x=>x.action).join(','));
assert.deepStrictEqual(errs,[]);console.log('rondes-regressie OK');await b.close();})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
