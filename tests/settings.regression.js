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
const st=()=>p.evaluate(()=>({cfg:JSON.parse(localStorage.cfg||'{}'),q:JSON.parse(localStorage.queue||'[]'),tok:document.querySelector('#tok')?.value,ph:document.querySelector('#tok')?.placeholder,sl:localStorage.serverLogsState}));
// v14: geen tokenveld meer (magic link). Koppeling, persistentie, wachtrij en achtergrond-render blijven getest.
const b64u=x=>Buffer.from(x).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
await p.goto(U);await p.evaluate(()=>{localStorage.clear();sessionStorage.clear();localStorage.aftrapDone='1';localStorage['log:x']=JSON.stringify({workout_id:'x',date:'2026-10-10',status:'gedaan',sets:[],updated_at:'2026-10-10T10:00:00Z'});localStorage.queue='["x"]'});
// 1) magic link met u= -> opgeslagen, hash direct weg, toast, wachtrij verstuurd, plan+logs opgehaald
await p.goto(U+'#k='+TOK+'&u='+b64u(API));await p.waitForTimeout(300);
let h=await p.evaluate(()=>location.href);assert.ok(!h.includes(TOK),'token nog in URL: '+h);
let s=await st();assert.strictEqual(s.cfg.TOKEN,TOK);assert.strictEqual(s.cfg.API_URL,API);
assert.match(await p.evaluate(()=>document.body.innerText),/Gekoppeld ✓/);
await p.waitForFunction(()=>JSON.parse(localStorage.queue).length===0&&/^"ok/.test(localStorage.serverLogsState||'')&&localStorage.plan,null,{timeout:15000});
assert.ok(posted.some(x=>x.log&&x.log.workout_id==='x'&&x.token===TOK),'wachtrij niet verstuurd');
// 2) herladen -> koppeling blijft; instellingen tonen Gekoppeld zonder token in DOM
await p.reload();await p.waitForTimeout(800);await p.evaluate(()=>location.hash='#instellingen');await p.waitForTimeout(300);
s=await st();assert.strictEqual(s.cfg.TOKEN,TOK);assert.match(await p.textContent('main'),/Gekoppeld ✓/);
assert.ok(!(await p.content()).includes(TOK),'token zichtbaar in DOM');assert.strictEqual(await p.$('#tok'),null,'tokenveld mag niet bestaan');
// 3) achtergrond-render (visibilitychange) laat koppeling intact
await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await p.waitForTimeout(2500);s=await st();assert.strictEqual(s.cfg.TOKEN,TOK);
// 4) Koppel-scherm: hele link plakken in het veld werkt; getypte tekst overleeft achtergrond-render
await p.evaluate(()=>{localStorage.removeItem('cfg')});await p.goto(U+'#instellingen');await p.reload();await p.waitForTimeout(800);
assert.match(await p.textContent('h1'),/Koppel de app/);await p.evaluate(()=>document.querySelector('details').open=true);
await p.fill('#link','https://thijs-grokbot.github.io/workout/#k='+TOK);await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await p.waitForTimeout(1500);
assert.match(await p.inputValue('#link'),/#k=/,'linkveld gewist door achtergrond-render');
await p.click('#linkgo');s=await st();assert.strictEqual(s.cfg.TOKEN,TOK);assert.ok(s.cfg.API_URL,'API-URL uit config.js');
// 5) ongeldige link -> niets opgeslagen
await p.evaluate(()=>{localStorage.removeItem('cfg')});await p.goto(U+'#instellingen');await p.reload();await p.waitForTimeout(500);await p.evaluate(()=>document.querySelector('details').open=true);
await p.fill('#link','https://example.com/#x=1');await p.click('#linkgo');s=await st();assert.strictEqual(s.cfg.TOKEN,undefined);
const real=errs.filter(e=>!/access control checks|Load failed|cancelled/i.test(e));
assert.deepStrictEqual(real,[]);console.log('settings-regressie OK (5 scenario\'s)');await b.close()})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
