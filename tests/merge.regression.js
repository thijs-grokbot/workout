// Regressie: server-logs (Mike) moeten lege/onaangeraakte lokale logs verslaan. node tests/merge.regression.js <app-url>
const pw=require(process.env.PW||'/workspace/mkb-websites/tools/node_modules/playwright');const assert=require('assert');
const U=process.argv[2]||'http://localhost:8765/', API='https://script.google.com/macros/s/MOCK/exec';
const LOGS=require(process.env.LOGS_FIXTURE||'./fixture-logs-2026-10-12_13.json').logs, PLAN=require('./fixture-plan-w41-42.json');
const empty=(id,date,ts)=>({workout_id:id,date,status:'',sets:[{round:1,block:'Hoofdset',exercise:'Zone 2 lopen',reps_done:'45 min',load_done:null,done:false}],rpe:null,feedback:{},run:{},notes:'',skipped_reason:'',updated_at:ts});
(async()=>{const b=await pw.webkit.launch();const c=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});const posted=[];
await c.addInitScript(()=>{const D=Date;const fixed=new D('2026-10-13T19:00:00+02:00').getTime();window.Date=class extends D{constructor(...a){super(...(a.length?a:[fixed]))}static now(){return fixed}};});
await c.route(/script\.google\.com/,r=>{const q=r.request();const a=new URL(q.url()).searchParams.get('action');if(q.method()==='POST')posted.push(JSON.parse(q.postData()));
 r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(a==='plan'?{ok:true,workouts:PLAN}:a==='logs'?{ok:true,logs:LOGS}:{ok:true})})});
const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(U);await p.evaluate(([API,e1,e2])=>{localStorage.clear();sessionStorage.clear();localStorage.cfg=JSON.stringify({API_URL:API,TOKEN:'x'.repeat(24)});
 localStorage['log:2026-10-12-z2']=JSON.stringify(e1);            // leeg, NIEUWER dan server
 localStorage['log:2026-10-13-tempo']=JSON.stringify(e2);         // leeg, ouder
 localStorage.queue=JSON.stringify(['2026-10-12-z2','2026-10-13-tempo']);},[API,empty('2026-10-12-z2','2026-10-12','2026-10-12T18:00:00.000Z'),empty('2026-10-13-tempo','2026-10-13','2026-10-13T15:32:00.000Z')]);
await p.reload();await p.waitForFunction(()=>/^"ok/.test(localStorage.serverLogsState||''),null,{timeout:20000});await p.waitForTimeout(800);
const st=await p.evaluate(()=>({z:JSON.parse(localStorage['log:2026-10-12-z2']).status,t:JSON.parse(localStorage['log:2026-10-13-tempo']).status,q:JSON.parse(localStorage.queue||'[]')}));
assert.strictEqual(st.z,'gedaan','z2: leeg lokaal log versloeg Mike');assert.strictEqual(st.t,'gedaan','tempo niet gemerged');
assert.ok(!posted.some(x=>x.log&&!x.log.status&&!(x.log.sets||[]).some(s=>s.done)),'leeg log naar server gestuurd');
// Vandaag (13/10 = tempo) toont Gedaan, Week toont beide als gedaan, Progressie toont runs
assert.match(await p.innerText('main'),/Gedaan/);
await p.goto(U+'#week');await p.waitForTimeout(400);const wk=await p.innerText('main');
assert.match(wk,/Zone 2 duurloop 45 min\s*\n?.*\n?.*Gedaan/);assert.ok((wk.match(/Gedaan/g)||[]).length>=2,wk);
await p.goto(U+'#progressie');await p.waitForTimeout(400);const pr=await p.innerText('main');assert.match(pr,/6[.,]24 km/);assert.match(pr,/142/);
// workout openen maakt geen leeg log aan
await p.evaluate(()=>localStorage.removeItem('log:2026-10-14-kracht-a'));await p.goto(U+'#w/2026-10-14-kracht-a');await p.waitForTimeout(400);
await p.goto(U+'#w/2026-10-14-kracht-a/klaar');await p.waitForTimeout(300);
assert.strictEqual(await p.evaluate(()=>localStorage['log:2026-10-14-kracht-a']),undefined,'leeg log aangemaakt bij openen');
// echte actie: afvinken + weer uitvinken -> geen leeg log in wachtrij
await p.goto(U+'#w/2026-10-14-kracht-a/r1');await p.waitForTimeout(300);await p.click('.ex .check >> nth=0');await p.waitForTimeout(200);
await p.waitForTimeout(500);assert.ok(await p.evaluate(()=>!!localStorage['log:2026-10-14-kracht-a']));assert.ok(posted.some(x=>x.log&&x.log.workout_id==='2026-10-14-kracht-a'&&x.log.sets.some(s=>s.done)),'echte log niet gesynct');
await p.click('.ex .check >> nth=0');await p.waitForTimeout(200);
const n0=posted.length;await p.waitForTimeout(500);assert.ok(!(await p.evaluate(()=>JSON.parse(localStorage.queue||'[]').includes('2026-10-14-kracht-a'))),'leeg log in wachtrij');assert.strictEqual(await p.evaluate(()=>localStorage['log:2026-10-14-kracht-a']),undefined,'leeg log bewaard');assert.strictEqual(posted.length,n0,'leeg log gesynct');
// geen toast/overlay die taps blokkeert
const blockers=await p.evaluate(()=>[...document.querySelectorAll('.toast,.overlay')].filter(e=>getComputedStyle(e).display!=='none'&&getComputedStyle(e).pointerEvents!=='none').length);assert.strictEqual(blockers,0);
assert.deepStrictEqual(errs.filter(e=>!/access control|Load failed|cancelled/i.test(e)),[]);console.log('merge-regressie OK');await b.close()})().catch(e=>{console.error('FAIL',e.message,(e.stack||'').split('\n').find(x=>x.includes('merge.regression')));process.exit(1)});
