// v14.2: warming-up → Verder; ronde klaar → fullscreen rust (Skip / Akkoord); ‹ → mini-balk; geen grijze middenknoppen.
const pw=require(process.env.PW||'/workspace/mkb-websites/tools/node_modules/playwright');const assert=require('assert');const fs=require('fs');
const U=process.argv[2]||'http://localhost:8765/';const P=JSON.parse(fs.readFileSync(__dirname+'/fixture-plan-w41-42.json'));const W=Array.isArray(P)?P:P.workouts;
(async()=>{const b=await pw.webkit.launch();const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block'});const posted=[];
await c.route(/script\.google\.com/,r=>{const q=r.request();if(q.method()==='POST')posted.push(JSON.parse(q.postData()));r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({ok:true,workouts:W,logs:[]})})});
const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
const go=h=>p.evaluate(x=>{location.hash=x},h);
const tab=()=>p.evaluate(()=>(document.querySelector('header .tabs .on')||{}).textContent||'');
await p.goto(U);await p.evaluate(()=>{localStorage.clear();localStorage.aftrapDone='1';localStorage.cfg=JSON.stringify({API_URL:'https://script.google.com/macros/s/M/exec',TOKEN:'t'});history.replaceState(null,'','/');});
await p.reload();await go('#w/2026-10-14-kracht-a');await p.waitForTimeout(400);
assert.strictEqual(await p.$('#rest'),null,'grijze Rust-knop nog aanwezig');
assert.ok(!(await p.innerText('main')).includes('Afsluiten →'),'grijze Afsluiten-knop nog aanwezig');
await p.screenshot({path:__dirname+'/shots/v142-warmup-tim.png'});
for(let i=0;i<10;i++){ const n=await p.$$('.ex:not(.done) [data-chk]'); if(!n.length)break; await n[0].click(); await p.waitForTimeout(120); }
assert.match(await p.innerText('main'),/Verder met Ronde 1/i,'geen kaart na warming-up');
assert.match(await tab(),/Warm-up/,'warming-up verliet zichzelf');
await p.click('#gonext');await p.waitForTimeout(300);
assert.match(await tab(),/Ronde 1/,'één tik ging niet naar ronde 1');
assert.strictEqual(await p.$('#gonext'),null,'kaart bleef staan');
await p.screenshot({path:__dirname+'/shots/v142-ronde1.png'});
// alles afvinken in ronde 1 mag GEEN rust starten
for(let i=0;i<12;i++){ const n=await p.$$('.ex:not(.done) .exr'); if(!n.length)break; await n[0].click(); await p.waitForTimeout(120); }
assert.notStrictEqual(await p.evaluate(()=>document.querySelector('#overlay').style.display),'block','rust startte automatisch na afvinken');
assert.strictEqual(await p.evaluate(()=>localStorage.rest||'null'),'null','rust-state gezet na afvinken');
assert.strictEqual(await p.evaluate(()=>location.hash),'#w/2026-10-14-kracht-a/r1','route wisselde na afvinken');
// later nog iets wijzigen (uit- en weer aanvinken) → nog steeds geen rust
const d0=await p.$('.ex.done .exr');await d0.click();await p.waitForTimeout(150);await (await p.$('.ex:not(.done) .exr')).click();await p.waitForTimeout(200);
assert.notStrictEqual(await p.evaluate(()=>document.querySelector('#overlay').style.display),'block','rust startte na wijziging');
await p.click('#next');await p.waitForTimeout(300);
assert.strictEqual(await p.evaluate(()=>location.hash),'#w/2026-10-14-kracht-a/r1','route wisselde vóór Skip');
assert.strictEqual(await p.evaluate(()=>document.querySelector('#overlay').style.display),'block','geen rustscherm');
assert.ok(await p.$('#skiprest'),'geen Skip-knop');
await p.screenshot({path:__dirname+'/shots/v142-rust.png'});
// ‹ → mini-balk
await p.click('.rest .back');await p.waitForTimeout(150);
assert.strictEqual(await p.evaluate(()=>document.querySelector('#minirest').style.display),'flex','geen mini-balk');
await p.screenshot({path:__dirname+'/shots/v142-minirest.png'});
// timer af → popup Akkoord
await p.evaluate(()=>{const r=JSON.parse(localStorage.rest);r.end=Date.now()-1000;localStorage.rest=JSON.stringify(r);});
await p.waitForTimeout(400);
assert.ok(await p.$('#akkoord'),'geen Akkoord-popup');
assert.match(await p.innerText('#overlay'),/Klaar voor de volgende ronde/i);
await p.waitForTimeout(1200);await p.screenshot({path:__dirname+'/shots/v142-akkoord.png'});
await p.click('#akkoord');await p.waitForTimeout(300);
assert.strictEqual(await p.evaluate(()=>location.hash),'#w/2026-10-14-kracht-a/r2','Akkoord ging niet naar ronde 2');
assert.match(await tab(),/Ronde 2/);
await p.screenshot({path:__dirname+'/shots/v142-ronde2.png'});
// ronde 2 → Skip → cooling-down
await p.click('#next');await p.waitForTimeout(200);await p.click('#skiprest');await p.waitForTimeout(300);
assert.match(await tab(),/Cool-down/,'na laatste ronde niet naar cooling-down');
await p.screenshot({path:__dirname+'/shots/v142-cooldown.png'});
for(let i=0;i<10;i++){ const n=await p.$$('.ex:not(.done) [data-chk]'); if(!n.length)break; await n[0].click(); await p.waitForTimeout(120); }
assert.match(await p.innerText('main'),/Verder met Afsluiten/);
await p.click('#gonext');await p.waitForTimeout(300);
assert.match(await p.evaluate(()=>location.hash),/\/klaar$/,'niet naar afsluiten');
await go('#w/2026-10-14-kracht-a');await p.waitForTimeout(300);
const first=await p.$('.ex.done .exr');await first.click();await p.waitForTimeout(200);
assert.strictEqual(await p.$('#gonext'),null,'kaart na uitvinken');
assert.ok(posted.every(x=>x.action==='log'),'iets anders dan logs verstuurd: '+posted.map(x=>x.action).join(','));
assert.deepStrictEqual(errs,[]);console.log('rondes-regressie OK');await b.close();})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
