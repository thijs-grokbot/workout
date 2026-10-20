// v15.2 pull-to-refresh: alleen bovenaan, drempel 70px, niet vanaf steppers/rustbalk; touched invoer blijft staan.
const pw=require(process.env.PW||'/workspace/mkb-websites/tools/node_modules/playwright');const assert=require('assert');
const U=process.argv[2]||'http://localhost:8765/';const S=__dirname+'/shots/';
const pu=n=>({exercise:`Set ${n}: Pull-ups`,reps:'4–8',load_range:[1,20],load_default:6,load_step:1,load_unit:'reps'}), ps=n=>({exercise:`Set ${n}: Push-ups`,reps:'10–20',load_range:[1,40],load_default:15,load_step:1,load_unit:'reps'}), rs=n=>({exercise:`Rust na set ${n}`,reps:'1,5 min',duration_sec:90});
const bp=n=>({exercise:`Set ${n}: Dumbbell bench press`,reps:'8',load_unit:'2× kg',load_range:[8,16],load_default:12,load_step:2,reps_range:[6,10],reps_default:8,reps_step:1}) /* nieuw standaardformaat */, row=n=>({exercise:`Set ${n}: Eenarmige row`,reps:'8 per kant',load_unit:'kg'}) /* oud formaat, zonder reps_* */;
const W=[{id:'2026-10-20-boven',date:'2026-10-20',type:'strength',title:'Bovenlichaam kracht',rounds:1,rest_sec:90,blocks:[
  {name:'Warming-up',items:[{exercise:'Roeien rustig',reps:'5 min',duration_sec:300},{exercise:'Scapula pull-ups',reps:'8'}]},
  {name:'Superset 1',items:[pu(1),ps(1),rs(1),pu(2),ps(2),rs(2),pu(3),ps(3)]},
  {name:'Superset 2',items:[bp(1),row(1),rs(1),bp(2),row(2),rs(2),bp(3),row(3)]},
  {name:'Superset 3',items:[{exercise:'Set 1: Pull-ups (alleen reps)',reps:'4–6'},rs(1)]},
  {name:'Cooling-down',items:[{exercise:'Rekken',reps:'4 min',duration_sec:240}]}]}];
(async()=>{const b=await pw.webkit.launch();const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block',hasTouch:true});
await c.addInitScript(()=>{const D=Date;const off=new D('2026-10-20T16:00:00+02:00').getTime()-D.now();window.Date=class extends D{constructor(...a){super(...(a.length?a:[D.now()+off]))}static now(){return D.now()+off}};});
const posted=[];await c.route(/script\.google\.com/,r=>{const q=r.request();const a=new URL(q.url()).searchParams.get('action')||'';if(q.method()==='POST'){try{posted.push(JSON.parse(q.postData()));}catch(e){}}
  r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(a==='ping'?{ok:true,version:'generic-1'}:a==='plan'?{ok:true,workouts:W}:a==='logs'?{ok:true,logs:[]}:{ok:true})});});
const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(U);await p.evaluate(()=>{localStorage.clear();localStorage.aftrapDone='1';localStorage.mile='100';localStorage.swipeHint='1';localStorage.cfg=JSON.stringify({API_URL:'https://script.google.com/macros/s/M/exec',TOKEN:'t-123456789012'});history.replaceState(null,'','/#vandaag');});
await p.reload();await p.waitForFunction(()=>/^"ok/.test(localStorage.serverLogsState||''),null,{timeout:15000});await p.waitForTimeout(500);
const tab=await p.evaluate(()=>tabsOf(byId('2026-10-20-boven')).find(t=>t.block.name==='Superset 1').key);
await p.evaluate(t=>location.hash='#w/2026-10-20-boven/'+t,tab);await p.waitForSelector('main .exs',{timeout:4000}).catch(async e=>{console.log('DBG',tab,await p.evaluate(()=>[location.hash,(document.querySelector('#app')||{}).innerHTML]),errs);throw e;});await p.waitForTimeout(300);
const touch=async(sel,y0,y1)=>p.evaluate(([sel,y0,y1])=>{const t=document.querySelector(sel)||document.body;const mk=y=>({identifier:1,target:t,clientX:200,clientY:y});
  const f=(type,y)=>{const e=new Event(type,{bubbles:true,cancelable:true});Object.defineProperty(e,'touches',{value:type==='touchend'?[]:[mk(y)]});Object.defineProperty(e,'changedTouches',{value:[mk(y)]});return t.dispatchEvent(e);};
  f('touchstart',y0);for(let y=y0;y<=y1;y+=10)f('touchmove',y);f('touchend',y1);},[sel,y0,y1]);
const cnt=()=>posted.length+0;let gets=0;p.on('request',r=>{if(/script\.google\.com/.test(r.url())&&/action=plan/.test(r.url()))gets++;});
// invoer zonder vinkje: stepper aanpassen (touched draft)
await p.click('main .ex[data-ex="Set 2: Pull-ups"] [data-w][data-d="1"]');await p.waitForTimeout(200);
await p.evaluate(()=>scrollTo(0,0));
let g=gets;await touch('main .exr .nm, main h1, main',150,190);await p.waitForTimeout(800);assert.strictEqual(gets,g,'refresh onder drempel');
g=gets;await touch('main [data-w][data-d="1"]',150,300);await p.waitForTimeout(800);assert.strictEqual(gets,g,'refresh vanaf stepper');
g=gets;await touch('main .rbar',150,300);await p.waitForTimeout(800);assert.strictEqual(gets,g,'refresh vanaf rustbalk');
g=gets;await touch('main h1, main',150,300);await p.waitForTimeout(1500);assert.ok(gets>g,'geen refresh bij pull vanaf top');
assert.ok(await p.$('.ptr'),'geen indicator');assert.ok(!(await p.$('.ptr.spin')),'indicator blijft hangen');
assert.strictEqual((await p.textContent('main .ex[data-ex="Set 2: Pull-ups"] [data-wt]')).trim(),'7 reps','invoer verloren na refresh');
await p.reload();await p.waitForTimeout(1500);await p.evaluate(t=>location.hash='#w/2026-10-20-boven/'+t,tab);await p.waitForTimeout(500);
assert.strictEqual((await p.textContent('main .ex[data-ex="Set 2: Pull-ups"] [data-wt]')).trim(),'7 reps','invoer verloren na herladen');
assert.deepStrictEqual(errs,[]);console.log('ptr-regressie OK');await b.close();})().catch(e=>{console.error(e);process.exit(1);});
