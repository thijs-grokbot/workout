// Regressietest instellingen/token (WebKit). Gebruik: node tests/settings.regression.js <app-url>
const pw=require(process.env.PW||'/workspace/mkb-websites/tools/node_modules/playwright');const assert=require('assert');
const API='https://script.google.com/macros/s/MOCK/exec',TOK='SECRET_TOKEN_1234',U=process.argv[2]||'http://localhost:8765/';
(async()=>{const b=await pw.webkit.launch();const c=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});const posted=[];
await c.route(/script\.google\.com/,r=>{const q=r.request();const u=new URL(q.url());const a=u.searchParams.get('action');
 if(q.method()==='POST')posted.push(JSON.parse(q.postData()));
 const tokOk=(u.searchParams.get('token')||(q.method()==='POST'&&JSON.parse(q.postData()).token))===TOK;
 setTimeout(()=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},
  body:JSON.stringify(!tokOk?{ok:false,error:'unauthorized'}:a==='plan'?{ok:true,workouts:[{id:'t1',date:'2026-10-10',type:'rest',title:'Rust'}]}:a==='logs'?{ok:true,logs:[]}:{ok:true})}),800)});
const p=await c.newPage();const errs=[];if(process.env.DEBUG){p.on('requestfailed',r=>console.log('reqfail',r.url().slice(0,90),(r.failure()||{}).errorText));p.on('console',m=>console.log('console',m.text().slice(0,150)));}p.on('pageerror',e=>errs.push(e.message));
const st=()=>p.evaluate(()=>({cfg:JSON.parse(localStorage.cfg||'{}'),q:JSON.parse(localStorage.queue||'[]'),tok:document.querySelector('#tok')?.value,ph:document.querySelector('#tok')?.placeholder,sync:document.querySelector('#sync').textContent,sl:localStorage.serverLogsState}));
await p.goto(U);await p.evaluate(()=>{localStorage.clear();sessionStorage.clear();localStorage['log:x']=JSON.stringify({workout_id:'x',date:'2026-10-10',status:'gedaan',sets:[],updated_at:'2026-10-10T10:00:00Z'});localStorage.queue='["x"]'});
await p.goto(U+'#instellingen');await p.reload();await p.waitForTimeout(1200);
const openAdv=()=>p.evaluate(()=>{const d=document.querySelector('details.adv');if(d)d.open=true});await openAdv();
// 1) invullen, app even naar achtergrond (token kopiëren uit Notities) -> achtergrond-plan-load mag velden niet wissen
await p.fill('#api',API);await p.fill('#tok',TOK);
await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await p.waitForTimeout(2500);
let s=await st();assert.strictEqual(s.tok,TOK,'token-veld gewist door achtergrond-render');
await p.click('#test');await p.waitForFunction(()=>/✓|✗/.test(document.querySelector('#res').textContent));
assert.match(await p.textContent('#res'),/✓ Verbinding werkt/);
// 2) opslaan -> synchroon in localStorage, gemaskeerd zichtbaar, sync aan, wachtrij geflusht, plan+logs opgehaald
await p.click('#save');s=await st();await openAdv();s=await st();
assert.strictEqual(s.cfg.TOKEN,TOK);assert.strictEqual(s.cfg.API_URL,API);
assert.strictEqual(s.tok,'');assert.match(s.ph,/opgeslagen: SEC…34/);assert.notStrictEqual(s.sync,'lokaal');
await p.waitForFunction(()=>JSON.parse(localStorage.queue).length===0&&/^"ok/.test(localStorage.serverLogsState||''),null,{timeout:15000});
assert.ok(posted.some(x=>x.log&&x.log.workout_id==='x'&&x.token===TOK),'wachtrij niet verstuurd');
await openAdv();
// 3) opnieuw opslaan met leeg tokenveld -> token blijft
await p.click('#save');s=await st();assert.strictEqual(s.cfg.TOKEN,TOK,'leeg veld overschreef token');
await openAdv();
// 4) gemaskeerde waarde plakken -> token blijft
await p.fill('#tok','SEC…34');await p.click('#save');await openAdv();s=await st();assert.strictEqual(s.cfg.TOKEN,TOK,'gemaskeerde waarde overschreef token');
// 5) herladen -> localStorage wint van config.js
await p.reload();await p.waitForTimeout(1500);await openAdv();s=await st();assert.strictEqual(s.cfg.TOKEN,TOK);assert.notStrictEqual(s.sync,'lokaal');
assert.match(s.ph,/opgeslagen/);
// 6) Test verbinding met leeg veld gebruikt opgeslagen token
await p.click('#test');await p.waitForFunction(()=>/✓|✗/.test(document.querySelector('#res').textContent));assert.match(await p.textContent('#res'),/✓/);
// 7) magic link met u= -> opgeslagen, hash direct weg, toast, plan+logs opgehaald
const b64u=x=>Buffer.from(x).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
await p.evaluate(()=>{localStorage.clear();sessionStorage.clear()});
await p.goto(U+'#k='+TOK+'&u='+b64u(API));await p.waitForTimeout(300);
let h=await p.evaluate(()=>location.href);assert.ok(!h.includes(TOK),'token nog in URL: '+h);
s=await st();assert.strictEqual(s.cfg.TOKEN,TOK);assert.strictEqual(s.cfg.API_URL,API);
assert.match(await p.evaluate(()=>document.body.innerText),/Gekoppeld ✓/);
await p.waitForFunction(()=>/^"ok/.test(localStorage.serverLogsState||'')&&localStorage.plan,null,{timeout:15000}).catch(async e=>{console.log('DBG',await p.evaluate(()=>JSON.stringify({sl:localStorage.serverLogsState,plan:!!localStorage.plan,cfg:localStorage.cfg})));throw e});
// 8) Koppel-scherm: hele link plakken in het veld werkt
await p.evaluate(()=>{localStorage.clear();sessionStorage.clear()});await p.goto(U+'#instellingen');await p.reload();await p.waitForTimeout(800);
assert.match(await p.textContent('h1'),/Koppel de app/);
await p.fill('#link','https://thijs-grokbot.github.io/workout/#k='+TOK+'&u='+b64u(API));await p.click('#linkgo');s=await st();
assert.strictEqual(s.cfg.TOKEN,TOK);assert.match(await p.textContent('h1'),/Instellingen/);
// 9) ongeldige link -> niets opgeslagen
await p.evaluate(()=>{localStorage.clear()});await p.goto(U+'#instellingen');await p.reload();await p.waitForTimeout(500);
await p.fill('#link','https://example.com/#x=1');await p.click('#linkgo');s=await st();assert.strictEqual(s.cfg.TOKEN,undefined);
const real=errs.filter(e=>!/access control checks|Load failed|cancelled/i.test(e));
assert.deepStrictEqual(real,[]);console.log('settings-regressie OK (9 scenario\'s)');await b.close()})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
