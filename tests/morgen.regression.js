// v14.2: vier tabs (Vandaag, Morgen, Week, Progressie); Morgen toont de workout van de volgende dag; swipe tussen tabs; deep-link vanaf Vandaag.
const pw=require(process.env.PW||'/workspace/mkb-websites/tools/node_modules/playwright');const assert=require('assert');const fs=require('fs');
const U=process.argv[2]||'http://localhost:8765/';const P=JSON.parse(fs.readFileSync(__dirname+'/fixture-plan-w41-42.json'));const W=Array.isArray(P)?P:P.workouts;
(async()=>{const b=await pw.webkit.launch();const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block',hasTouch:true});
await c.addInitScript(()=>{const D=Date;const fixed=new D('2026-10-14T09:00:00+02:00').getTime();const off=fixed-D.now();window.Date=class extends D{constructor(...a){super(...(a.length?a:[D.now()+off]))}static now(){return D.now()+off}};});
await c.route(/script\.google\.com/,r=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({ok:true,workouts:W,logs:[]})}));
const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(U);await p.evaluate(()=>{localStorage.clear();localStorage.aftrapDone='1';localStorage.cfg=JSON.stringify({API_URL:'https://script.google.com/macros/s/M/exec',TOKEN:'t'});history.replaceState(null,'','/#vandaag');});
await p.reload();await p.waitForTimeout(800);
const tabs=await p.$$eval('header nav.tabs a',a=>a.map(x=>x.textContent));
assert.deepStrictEqual(tabs,['Vandaag','Morgen','Week','Progressie']);
assert.strictEqual(await p.$('header .dots'),null,'v15 audit: geen pagina-stipjes onder de tabs');
assert.strictEqual(await p.$('main a.morgen'),null,'v15 audit: geen Morgen-kaart op Vandaag (tab staat ernaast)');
await p.click('header nav.tabs a[href="#morgen"]');await p.waitForTimeout(300);
assert.strictEqual(await p.evaluate(()=>location.hash),'#morgen');
const m=await p.innerText('main');assert.match(m,/Donderdag 15 oktober/i);assert.match(m,/Thuis[\s\S]*20 min AMRAP/i);
assert.match(await p.innerText('header nav.tabs a.on'),/Morgen/);
assert.strictEqual(await p.$('#start'),null,'Morgen mag geen startknop hebben');assert.strictEqual(await p.$('.pvlink'),null,'dubbele bekijk-link');
const vb=await p.$('#view[href="#voorbeeld/2026-10-15-thuis"]');assert.ok(vb,'Bekijk workout wijst niet naar voorvertoning van morgen');assert.strictEqual((await vb.innerText()).trim(),'Bekijk workout');
await vb.click();await p.waitForTimeout(300);assert.match(await p.evaluate(()=>location.hash),/^#voorbeeld\/2026-10-15-thuis/);
assert.strictEqual(await p.$('#pvstart'),null,'voorvertoning van morgen kan starten');assert.match(await p.innerText('#bar'),/Starten kan morgen via Vandaag/);
await p.screenshot({path:__dirname+'/shots/v144-morgen-voorvertoning.png'});
await p.click('#pvback');await p.waitForTimeout(300);assert.strictEqual(await p.evaluate(()=>location.hash),'#morgen');
assert.strictEqual(await p.evaluate(()=>localStorage.training||'0'),'0','training gestart vanuit Morgen');
await p.screenshot({path:__dirname+'/shots/v142-morgen.png',fullPage:true});
// swipe: Morgen → Week → Progressie, terug → Week → Morgen → Vandaag
const sw=async dx=>{await p.evaluate(dx=>{const el=document.querySelector('#app');const mk=(type,x)=>{const e=new Event(type,{bubbles:true,cancelable:true});const pt={identifier:1,target:el,clientX:x,clientY:400};Object.defineProperty(e,'touches',{value:type==='touchend'?[]:[pt]});Object.defineProperty(e,'changedTouches',{value:[pt]});return e;};
 el.dispatchEvent(mk('touchstart',200));for(let k=1;k<=6;k++)el.dispatchEvent(mk('touchmove',200+dx*k/6));el.dispatchEvent(mk('touchend',200+dx));},dx);await p.waitForTimeout(700);};
const seq=[];for(const dx of [-150,-150,150,150,150]){await sw(dx);seq.push(await p.evaluate(()=>location.hash));}
assert.deepStrictEqual(seq,['#week','#progressie','#week','#morgen','#vandaag']);
assert.ok(await p.isVisible('#micfab'));
// rustdag morgen
await p.evaluate(()=>{});
assert.deepStrictEqual(errs,[]);console.log('morgen-regressie OK');await b.close();})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
