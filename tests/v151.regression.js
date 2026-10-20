// v15.1: compacte rijen in een workoutblok, dunne rustrij (alleen duration_sec + naam "Rust…"), load_unit 'reps' = reps-teller (log bewaart unit reps).
// Synthetische workout met dezelfde opbouw als een superset-plan (3 sets + 2 rustmomenten). WebKit 390x844.
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
await p.screenshot({path:S+'v151-superset1.png'});
const m=await p.evaluate(()=>{const ex=[...document.querySelectorAll('main .ex')],bar=document.querySelector('#bar').getBoundingClientRect();
  return {n:ex.length,ri:[...document.querySelectorAll('main .ri')].map(e=>Math.round(e.getBoundingClientRect().height)),visible:ex.filter(e=>e.getBoundingClientRect().bottom<=bar.top+1).length,
    txt:document.querySelector('main .exs').innerText,steps:document.querySelectorAll('main [data-w]').length,repsStep:document.querySelectorAll('main [data-r]').length,stepTxt:(document.querySelector('main [data-wt]')||{}).textContent};});
assert.strictEqual(m.n,8);assert.strictEqual(m.ri.length,2,'geen dunne rustrijen');assert.ok(m.ri.every(h=>h<=44),'rustrij niet dun: '+m.ri);
assert.ok(m.visible>=4,'superset past niet bijna op één scherm: '+m.visible+'/8 zichtbaar');
assert.ok(!/kg/.test(m.txt),'kg bij reps-items: '+m.txt);assert.strictEqual(m.stepTxt.trim(),'6 reps');assert.strictEqual(m.steps,12,'niet elk set-item heeft een reps-teller: '+m.steps);assert.strictEqual(m.repsStep,0,'dubbele reps-stepper');
assert.ok(await p.$('main .ri .play'),'geen play-knop op rustrij');
await p.click('main [data-w][data-d="1"]');await p.waitForTimeout(200);assert.strictEqual((await p.textContent('main [data-wt]')).trim(),'7 reps');
await p.click('main .ex.active [data-chk]');await p.waitForTimeout(1500);
const s=await p.evaluate(()=>JSON.parse(localStorage['log:2026-10-20-boven']).sets.find(x=>x.exercise==='Set 1: Pull-ups'));
assert.deepStrictEqual([s.load_done,s.reps_done,s.load_unit,s.done],[7,'7','reps',true],'log-unit fout: '+JSON.stringify(s));
const sent=posted.filter(x=>x.log&&x.log.workout_id==='2026-10-20-boven').pop();assert.ok(sent,'log niet verstuurd');const ss=sent.log.sets.find(x=>x.exercise==='Set 1: Pull-ups');assert.deepStrictEqual([ss.load_done,ss.reps_done,ss.load_unit],[7,'7','reps']);
// rustrij: play start de timer
await p.click('main .ri .play');await p.waitForTimeout(1300);assert.match(await p.textContent('main .ri .clock'),/1:2\d/);
// Superset 2: kg-items houden kg + reps-stepper
const t2=await p.evaluate(()=>tabsOf(byId('2026-10-20-boven')).find(t=>t.block.name==='Superset 2').key);await p.evaluate(t=>location.hash='#w/2026-10-20-boven/'+t,t2);await p.waitForTimeout(400);
const st2=await p.evaluate(()=>{const a=document.querySelector('main .ex.active');const S=[...a.querySelectorAll('.step')];return {n:S.length,top:S.map(s=>Math.round(s.getBoundingClientRect().top)),h:S.map(s=>Math.round(s.getBoundingClientRect().height)),kg:a.querySelector('[data-wt]').textContent.trim(),reps:a.querySelector('[data-reps]').textContent.trim()};});
await p.screenshot({path:S+'v151-superset2.png'});assert.strictEqual(st2.n,2);assert.strictEqual(st2.top[0],st2.top[1],'kg en reps niet op één rij');assert.ok(st2.h.every(h=>h<=52));assert.strictEqual(st2.kg,'2×12 kg');assert.strictEqual(st2.reps,'8 reps');
await p.click('main .ex.active [data-w][data-d="1"]');await p.waitForTimeout(150);await p.click('main .ex.active [data-r][data-d="1"]');await p.waitForTimeout(150);
for(let i=0;i<4;i++){await p.click('main .ex.active [data-r][data-d="1"]');await p.waitForTimeout(100);} // clamp op reps_range [6,10]
assert.strictEqual((await p.textContent('main .ex.active [data-wt]')).trim(),'2×14 kg');assert.strictEqual((await p.textContent('main .ex.active [data-reps]')).trim(),'10 reps');
await p.click('main .ex.active [data-chk]');await p.waitForTimeout(1200);
const b1=await p.evaluate(()=>JSON.parse(localStorage['log:2026-10-20-boven']).sets.find(x=>x.exercise==='Set 1: Dumbbell bench press'));assert.deepStrictEqual([b1.load_done,b1.reps_done,b1.load_unit,b1.done],[14,'10','2× kg',true]);
const sb=posted.filter(x=>x.log&&x.log.workout_id==='2026-10-20-boven').pop().log.sets.find(x=>x.exercise==='Set 1: Dumbbell bench press');assert.deepStrictEqual([sb.load_done,sb.reps_done],[14,'10'],'niet allebei gelogd');
// oud formaat (row, geen reps_*): kg-stepper + reps-stepper met de planwaarde
const old=await p.evaluate(()=>{const a=document.querySelector('main .ex.active');return {nm:a.querySelector('.nm').textContent,kg:a.querySelector('[data-wt]').textContent.trim(),reps:a.querySelector('[data-reps]').textContent.trim()};});
assert.deepStrictEqual(old,{nm:'Set 1: Eenarmige row',kg:'– kg',reps:'8 per kant'});
const set2=await p.evaluate(()=>JSON.parse(localStorage['log:2026-10-20-boven']).sets.find(x=>x.exercise==='Set 2: Dumbbell bench press'));assert.deepStrictEqual([set2.load_done,set2.reps_done],[12,'8'],'reps_default niet als startwaarde');

// alleen reps (geen load_*): reps-stepper zichtbaar
const t3=await p.evaluate(()=>tabsOf(byId('2026-10-20-boven')).find(t=>t.block.name==='Superset 3').key);await p.evaluate(t=>location.hash='#w/2026-10-20-boven/'+t,t3);await p.waitForTimeout(400);
assert.strictEqual(await p.$$eval('main [data-r]',x=>x.length),2);assert.strictEqual(await p.$$eval('main [data-w]',x=>x.length),0);await p.click('main [data-r][data-d="1"]');await p.waitForTimeout(200);assert.match(await p.textContent('main [data-reps]'),/^5/);
// samenvatting: reps-teller telt niet mee als kg
const kg=await p.evaluate(()=>{const l=getLog(byId('2026-10-20-boven'));l.status='gedaan';saveLog(l,false);const d=document.createElement('div');d.innerHTML=summaryBody(byId('2026-10-20-boven'),false);return d.innerText;});
assert.match(kg,/2×?\s*|/);const kgv=await p.evaluate(()=>{const l=getLog(byId('2026-10-20-boven'));return l.sets.filter(s=>s.done&&!isRepsU(s.load_unit)).reduce((a,s)=>a+(+s.load_done||0)*(num(s.reps_done)||0)*(/2×/.test(s.load_unit)?2:1),0);});
assert.match(kg,new RegExp(String(kgv)+'\\s*kg totaal'),'kg-totaal telt reps-teller mee: '+kg);
assert.deepStrictEqual(errs,[]);console.log(`v15.1 OK: ${m.visible}/8 rijen van Superset 1 zichtbaar, rustrijen ${m.ri.join('/')} px`);await b.close();})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
