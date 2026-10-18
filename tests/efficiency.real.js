// v14.3: aerobe efficiëntie op de ECHTE logs (alleen lokaal; data staat in private/, gaat niet in de repo).
// Formule: (afstand_m + 8 × elevation_m) / (duur_min × avg_hr). Runs < 20 min tellen niet mee. Controlewaarden (v14.3.1): 12/10 = 0,91 · 15/10 = 0,91 · 18/10 = 0,93; 11/10 (8 min) valt weg.
const pw=require(process.env.PW||'/workspace/mkb-websites/tools/node_modules/playwright');const assert=require('assert');const fs=require('fs');
const U=process.argv[2]||'http://localhost:8765/', PRIV=__dirname+'/../private/';
if(!fs.existsSync(PRIV+'logs-real.json')){console.log('efficiëntie-test overgeslagen (geen private/logs-real.json)');process.exit(0);}
const LOGS=JSON.parse(fs.readFileSync(PRIV+'logs-real.json')).logs, W=JSON.parse(fs.readFileSync(PRIV+'plan-real.json')).workouts;
const EXPECT={'2026-10-12':0.91,'2026-10-15':0.91,'2026-10-18':0.93};
(async()=>{const b=await pw.webkit.launch();const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block'});const posted=[];
await c.addInitScript(()=>{const D=Date;const off=new D('2026-10-18T13:00:00+02:00').getTime()-D.now();window.Date=class extends D{constructor(...a){super(...(a.length?a:[D.now()+off]))}static now(){return D.now()+off}};});
await c.route(/script\.google\.com/,r=>{const q=r.request();if(q.method()==='POST')posted.push(1);const a=new URL(q.url()).searchParams.get('action');r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(a==='logs'?{ok:true,logs:LOGS}:{ok:true,workouts:W})})});
const p=await c.newPage();await p.goto(U);await p.evaluate(()=>{localStorage.clear();localStorage.aftrapDone='1';localStorage.cfg=JSON.stringify({API_URL:'https://script.google.com/macros/s/M/exec',TOKEN:'t'});history.replaceState(null,'','/#progressie/hardlopen');});
await p.reload();await p.waitForFunction(()=>/^"ok/.test(localStorage.serverLogsState||''),null,{timeout:15000});await p.evaluate(()=>{location.hash='#week';});await p.waitForTimeout(100);await p.evaluate(()=>{location.hash='#progressie/hardlopen';});await p.waitForTimeout(500);
const rows=await p.evaluate(()=>allLogs().filter(l=>runTypeOf(l)==='run_z2'&&l.run).sort((a,b)=>a.date.localeCompare(b.date)).map(l=>({d:l.date,id:l.workout_id,km:l.run.distance_km,min:l.run.duration_min,hr:l.run.avg_hr,elev:l.run.elevation_m??null,eff:aeroEff(l.run)})));
console.log('datum      | km   | min  | hr  | hm   | corr. m | min×hr  | m/slag (raw) | getoond | Mike');
const dev=[];for(const r of rows){ const cm=r.km*1000+8*(r.elev||0), den=r.min*r.hr, shown=r.eff==null?'–':r.eff.toFixed(2).replace('.',','), ex=EXPECT[r.d];
  console.log(`${r.d} | ${r.km} | ${r.min} | ${r.hr} | ${r.elev??'–'} | ${cm} | ${den.toFixed(1)} | ${r.eff==null?'–':r.eff.toFixed(4)} | ${shown} | ${ex!=null?String(ex).replace('.',','):''}`);
  assert.ok(r.eff==null||Math.abs(r.eff-cm/den)<1e-12,'formule wijkt af');
  if(ex!=null&&Math.abs(Math.round(r.eff*100)/100-ex)>1e-9)dev.push(`${r.d}: berekend ${r.eff.toFixed(4)} (≈${shown}), Mike ${ex}`); }
for(const d of Object.keys(EXPECT)) assert.ok(rows.find(r=>r.d===d),'log '+d+' ontbreekt');
const card=await p.innerText('.chart');assert.match(card,/Aerobe efficiëntie/i);assert.match(card,/m\/slag/i);
assert.strictEqual(posted.length,0,'test schreef iets');
await p.screenshot({path:__dirname+'/shots/v143-progressie-hardlopen-echt.png',fullPage:true});
assert.deepStrictEqual(dev,[],'controlewaarden wijken af');
const r11=rows.find(r=>r.d==='2026-10-11');assert.ok(r11&&r11.eff===null,'11/10 (8 min) telt nog mee');
assert.ok(!/11\/10/.test(card),'11/10 staat nog in de grafiek');console.log('alle controlewaarden kloppen; 11/10 valt weg');
console.log('efficiëntie-test OK (formule)');await b.close();})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
