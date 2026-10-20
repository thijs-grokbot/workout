// v15.3: afgeronde server-log is leidend (oude lokale namen 'Set 1: …' nooit uploaden), weergavenaam zonder ' n/m', overname 'X 2/3' <- 'X 1/3'.
const pw=require(process.env.PW||'/workspace/mkb-websites/tools/node_modules/playwright');const assert=require('assert');
const U=process.argv[2]||'http://localhost:8765/';const S=__dirname+'/shots/';
const bp=n=>({exercise:`Bench press ${n}/3`,reps:'8',load_unit:'2× kg',load_range:[8,16],load_default:12,load_step:2,reps_range:[6,10],reps_default:8,reps_step:1}), rs=n=>({exercise:'Rust',duration_sec:90});
const W=[{id:'2026-10-20-boven',date:'2026-10-20',type:'strength',title:'Bovenlichaam kracht',rounds:1,blocks:[{name:'Superset 2',items:[bp(1),rs(1),bp(2),rs(2),bp(3)]}]},
         {id:'2026-10-21-test',date:'2026-10-21',type:'strength',title:'Test',rounds:1,blocks:[{name:'Hoofd',items:[bp(1),bp(2)]}]}];
const SL={workout_id:'2026-10-20-boven',date:'2026-10-20',status:'gedaan',profile_id:'thijs',sets:[1,2,3].map(n=>({exercise:`Bench press ${n}/3`,done:true,load_done:14,reps_done:'8'})),run:{},feedback:{},updated_at:'2026-10-20T17:00:00Z'};
const LOC={workout_id:'2026-10-20-boven',date:'2026-10-20',status:'gedaan',profile_id:'thijs',sets:[1,2,3].map(n=>({exercise:`Set ${n}: Dumbbell bench press`,done:true,load_done:12,reps_done:'8'})),run:{},feedback:{},updated_at:'2026-10-20T18:30:00Z'};
(async()=>{const b=await pw.webkit.launch();const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block',hasTouch:true});
await c.addInitScript(()=>{const D=Date;const off=new D('2026-10-21T16:00:00+02:00').getTime()-D.now();window.Date=class extends D{constructor(...a){super(...(a.length?a:[D.now()+off]))}static now(){return D.now()+off}};});
const posted=[];await c.route(/script\.google\.com/,r=>{const q=r.request();const a=new URL(q.url()).searchParams.get('action')||'';if(q.method()==='POST'){try{posted.push(JSON.parse(q.postData()));}catch(e){}}
  r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(a==='ping'?{ok:true,version:'generic-1'}:a==='plan'?{ok:true,workouts:W}:a==='logs'?{ok:true,logs:[SL]}:{ok:true})});});
const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(U);await p.evaluate(l=>{localStorage.clear();localStorage.aftrapDone='1';localStorage.mile='100';localStorage.swipeHint='1';localStorage.cfg=JSON.stringify({API_URL:'https://script.google.com/macros/s/M/exec',TOKEN:'t-123456789012'});
  localStorage['log:2026-10-20-boven']=JSON.stringify(l);localStorage.queue=JSON.stringify(['2026-10-20-boven']);history.replaceState(null,'','/#vandaag');},LOC);
await p.reload();await p.waitForFunction(()=>/^"ok/.test(localStorage.serverLogsState||''),null,{timeout:15000});await p.waitForTimeout(1500);
const loc=await p.evaluate(()=>JSON.parse(localStorage['log:2026-10-20-boven']));
assert.deepStrictEqual(loc.sets.map(s=>s.exercise),['Bench press 1/3','Bench press 2/3','Bench press 3/3'],'oude lokale state niet weggegooid');
assert.strictEqual(posted.filter(x=>x.log&&x.log.workout_id==='2026-10-20-boven').length,0,'afgeronde log toch geüpload');
assert.deepStrictEqual(await p.evaluate(()=>JSON.parse(localStorage.queue||'[]')),[]);
// Bekijk workout + workoutweergave: geen upload
await p.evaluate(()=>location.hash='#voorbeeld/2026-10-20-boven');await p.waitForTimeout(600);
await p.evaluate(()=>location.hash='#w/2026-10-20-boven');await p.waitForTimeout(600);await p.evaluate(()=>flush());await p.waitForTimeout(600);
assert.strictEqual(posted.filter(x=>x.log&&x.log.workout_id==='2026-10-20-boven').length,0,'upload na bekijken');
// weergavenaam + overname met 'X n/m'
await p.evaluate(()=>location.hash='#w/2026-10-21-test');await p.waitForTimeout(700);
const nm=await p.$$eval('main .ex .nm',e=>e.map(x=>x.textContent.trim()));assert.ok(nm.length>=2&&nm.every(t=>t==='Bench press'),'n/m nog zichtbaar: '+nm);
assert.ok(await p.$('main .ex[data-ex="Bench press 2/3"]'),'interne sleutel gewijzigd');
await p.click('main .ex[data-ex="Bench press 1/3"] [data-w][data-d="1"]');await p.waitForTimeout(200);
assert.match(await p.textContent('main .ex[data-ex="Bench press 2/3"] [data-wt]'),/14/,'overname 1/3 -> 2/3 werkt niet');
await p.screenshot({path:S+'v153-namen.png'});
assert.deepStrictEqual(errs,[]);console.log('serverwins-regressie OK');await b.close();})().catch(e=>{console.error(e);process.exit(1);});
