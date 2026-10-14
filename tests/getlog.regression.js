// v14.2: plan 'Roeien of fietsen' vs log 'Roeien/fietsen' mag geen extra set toevoegen aan een bestaande (Mike) log.
const pw=require(process.env.PW||'/workspace/mkb-websites/tools/node_modules/playwright');const assert=require('assert');const fs=require('fs');
const U=process.argv[2]||'http://localhost:8765/';
const P=JSON.parse(fs.readFileSync(__dirname+'/fixture-plan-w41-42.json'));
const W=JSON.parse(JSON.stringify(Array.isArray(P)?P:P.workouts));
const w=W.find(x=>x.id==='2026-10-14-kracht-a');
const mike={workout_id:w.id,date:w.date,status:'gedaan',sets:[
  {round:1,block:'Warming-up',exercise:'Roeien/fietsen',reps_done:'5 min',done:true,ts:'2026-10-14T10:00:00.000Z'},
  {round:1,block:'Warming-up',exercise:'Heupen openen',reps_done:'1 min',done:true},
  {round:1,block:'Warming-up',exercise:'Bodyweight squats',reps_done:'10',done:true},
  {round:1,block:'Warming-up',exercise:'Lunges',reps_done:'10',done:true},
  {round:1,block:'Hoofdset',exercise:'Goblet squat',reps_done:'10',load_done:20,done:true},
  {round:2,block:'Hoofdset',exercise:'Goblet squat',reps_done:'10',load_done:20,done:true},
],rpe:7,feedback:{},run:{},notes:'',updated_at:'2026-10-14T10:00:00.000Z'};
(async()=>{const b=await pw.webkit.launch();const c=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});const posted=[];
await c.route(/script\.google\.com/,r=>{const q=r.request();if(q.method()==='POST')posted.push(JSON.parse(q.postData()));
 r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify({ok:true,workouts:W,logs:[mike]})})});
const p=await c.newPage();
await p.goto(U);await p.evaluate(()=>{localStorage.clear();localStorage.aftrapDone='1';localStorage.cfg=JSON.stringify({API_URL:'https://script.google.com/macros/s/M/exec',TOKEN:'t'});history.replaceState(null,'','/');});
await p.reload();await p.waitForFunction(()=>/^"ok/.test(localStorage.serverLogsState||''),null,{timeout:15000});
await p.evaluate(h=>location.hash=h,'#w/2026-10-14-kracht-a/b0');await p.waitForTimeout(500);
const names=await p.evaluate(()=>JSON.parse(localStorage['log:2026-10-14-kracht-a']).sets.map(s=>s.exercise));
assert.ok(!names.includes('Roeien of fietsen'),'extra set toegevoegd: '+names.join('|'));
assert.ok(names.includes('Roeien/fietsen'),'Mike-set verdween');
assert.strictEqual(names.length,mike.sets.length,'sets-aantal veranderde: '+names.length);
assert.ok(await p.$('text=Roeien'),'UI toont oefening niet via fuzzy match');
// openen + navigeren mag niets syncen met de plan-naam
await p.click('#next');await p.waitForTimeout(400);
const after=await p.evaluate(()=>JSON.parse(localStorage['log:2026-10-14-kracht-a']).sets.map(s=>s.exercise));
assert.ok(!after.includes('Roeien of fietsen'),'pollutie na actie: '+after.join('|'));
assert.ok(!posted.some(x=>x.log&&(x.log.sets||[]).some(s=>s.exercise==='Roeien of fietsen')),'pollutie naar server');
console.log('getlog-regressie OK');await b.close();})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
