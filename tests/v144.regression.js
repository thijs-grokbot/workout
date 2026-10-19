// v14.4: gezondheidsdata (GET action=health), TRIMP (anker 140), HRV % baseline, rusthartslag, wekelijkse Zone 2-test.
// Alleen synthetische data. Screenshots 390 px: lege staat en met data.
const pw=require(process.env.PW||'/workspace/mkb-websites/tools/node_modules/playwright');const assert=require('assert');const fs=require('fs');
const U=process.argv[2]||'http://localhost:8765/';const P=JSON.parse(fs.readFileSync(__dirname+'/fixture-plan-w41-42.json'));const W=Array.isArray(P)?P:P.workouts;
const S=__dirname+'/shots/';
const L=(id,date,status,run,x)=>Object.assign({workout_id:id,date,status,sets:[],run:run||{},feedback:{},updated_at:date+'T18:00:00Z'},x||{});
const add=(ds,n)=>{const d=new Date(ds+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const TODAY='2026-10-18';
// 8 weken synthetische ochtenden: HRV rond 55 ms, laatste week hoger (62); rusthartslag 56 → 53
function synthHealth(){const out=[];for(let i=55;i>=0;i--){const d=add(TODAY,-i);if(i%9===4)continue; // af en toe een gat
  const hrv=i<7?62+(i%3):55+((i*7)%5)-2, rhr=i<7?53:i<28?55:56;
  out.push({date:d,hrv_samples:[{ts:d+'T03:10:00+02:00',sdnn_ms:hrv-3},{ts:d+'T06:50:00+02:00',sdnn_ms:hrv+3}],resting_hr:rhr,workouts:[],received_at:d+'T07:00:00Z'});}
  return out;}
// runs: elke week een Zone 2-run rond 8:00/km met dalende HR (basis wordt beter) + een tempo-run
function synthLogs(){const L2=[];for(let w=7;w>=0;w--){const d=add(TODAY,-7*w-2);const km=6, pace=480+((w%3)-1)*8;
  L2.push(L(d+'-z2',d,'gedaan',{duration_min:+(km*pace/60).toFixed(1),distance_km:km,avg_hr:140+w}));
  const t=add(d,-2);L2.push(L(t+'-tempo',t,'gedaan',{duration_min:33,distance_km:5,avg_hr:150}));}
  return L2;}
async function ctx(b,day,logs,health,posted,healthMode){const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block',hasTouch:true});
  await c.addInitScript(d=>{const D=Date;const off=new D(d+'T09:00:00+02:00').getTime()-D.now();window.Date=class extends D{constructor(...a){super(...(a.length?a:[D.now()+off]))}static now(){return D.now()+off}};},day);
  const seen=[];
  await c.route(/script\.google\.com/,r=>{const q=r.request();const u=new URL(q.url());const a=u.searchParams.get('action');seen.push(q.method()+' '+a);
    if(q.method()==='POST'){posted.push(JSON.parse(q.postData()));}
    let body={ok:true};
    if(a==='logs')body={ok:true,logs};else if(a==='plan')body={ok:true,workouts:W};
    else if(a==='health')body=healthMode==='old'?{error:'unknown action: health'}:{ok:true,days:health.filter(h=>h.date>=u.searchParams.get('from')&&h.date<=u.searchParams.get('to'))};
    r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)})});
  const p=await c.newPage();p.errs=[];p.on('pageerror',e=>p.errs.push(e.message));p.seen=seen;
  await p.goto(U);await p.evaluate(()=>{localStorage.clear();localStorage.aftrapDone='1';localStorage.mile='100';localStorage.cfg=JSON.stringify({API_URL:'https://script.google.com/macros/s/M/exec',TOKEN:'t'});history.replaceState(null,'','/#vandaag');});
  await p.reload();await p.waitForFunction(()=>(localStorage.healthState||'').length>2,null,{timeout:15000});
  await p.evaluate(()=>location.hash='#progressie/hardlopen');await p.waitForTimeout(500);return {c,p};}
(async()=>{const b=await pw.webkit.launch();const posted=[];
// ---------- 1) formules (pure functies)
let {c,p}=await ctx(b,TODAY,[],[],posted);
const f=await p.evaluate(()=>({one:trimp(1,140,60,194),hour:trimp(60,140,60,194),hi:trimp(30,160,60,194),lo:trimp(30,120,60,194),none:trimp(30,0,60,194)}));
assert.strictEqual(f.one,1,'1 min op 140 bpm moet 1 punt zijn');assert.strictEqual(f.hour,60);
assert.ok(Math.abs(f.hi-30*Math.exp(1.92*20/134))<1e-9);assert.ok(f.lo<30&&f.hi>30);assert.strictEqual(f.none,0);
// HRV %: 7 d / 28 d; te weinig ochtenden -> null
const hp=await p.evaluate(()=>{const H={};for(let i=0;i<28;i++){const d=new Date('2026-10-18T12:00');d.setDate(d.getDate()-i);const ds=ymd(d);H[ds]={date:ds,hrv_samples:[{sdnn_ms:i<7?66:50}]};}
  const few={};Object.keys(H).slice(0,9).forEach(k=>few[k]=H[k]);return {full:hrvPct(H,'2026-10-18'),few:hrvPct(few,'2026-10-18')};});
const dh=await p.evaluate(()=>dayHrv({hrv_samples:[{ts:'2026-10-18T01:10:00Z',sdnn_ms:50},{ts:'2026-10-18T05:00:00Z',sdnn_ms:60},{ts:'2026-10-18T14:00:00Z',sdnn_ms:20}]}));
assert.strictEqual(dh,55,'overdag-meting telt mee in ochtend-HRV');
assert.ok(Math.abs(hp.full.pct-100*66/((7*66+21*50)/28))<1e-9,JSON.stringify(hp));assert.strictEqual(hp.few,null,'<10 ochtenden moet leeg blijven');
// Zone 2-test omrekening: 6 km in 50 min (8:20/km) op 140 -> buiten ±20 s; 6 km in 48,5 min (8:05) bij 140 -> 140*485/480
const zt=await p.evaluate(()=>z2Tests(480,[{workout_id:'a-z2',date:'2026-10-14',status:'gedaan',run:{duration_min:48.5,distance_km:6,avg_hr:140}},{workout_id:'b-z2',date:'2026-10-15',status:'gedaan',run:{duration_min:51,distance_km:6,avg_hr:138}},{workout_id:'c-z2',date:'2026-10-16',status:'gedaan',run:{duration_min:15,distance_km:1.9,avg_hr:139}}]));
const zv=Object.values(zt);assert.strictEqual(zv.length,1);assert.strictEqual(zv[0].d,'2026-10-14');assert.ok(Math.abs(zv[0].hr-140*485/480)<1e-9);
// ---------- 2) lege staat (geen health, geen logs)
let main=await p.innerText('main');
assert.match(main,/Belasting · herstel · basis/i);assert.match(main,/Nog geen HRV/);assert.match(main,/Nog geen rusthartslag/);assert.match(main,/Nog geen sessies met hartslag/);
assert.match(main,/Zone 2-test · 8:00 \/km/i);assert.match(main,/Nog te weinig data/);assert.ok(!/NaN|undefined|Infinity/.test(main),'rommel in lege staat');
assert.ok(!/\bAI\b|drempel|efficiënt/i.test(main));
assert.strictEqual(await p.evaluate(()=>localStorage.healthState),'"ok 0"');
await p.screenshot({path:S+'v144-progressie-leeg.png',fullPage:true});
assert.deepStrictEqual(p.errs,[]);await c.close();
// ---------- 3) oude backend (generic-1/2): 'unknown action' -> nette lege staat, geen fout
({c,p}=await ctx(b,TODAY,synthLogs(),[],posted,'old'));
assert.match(await p.evaluate(()=>localStorage.healthState),/nog niet beschikbaar/);main=await p.innerText('main');assert.match(main,/Nog geen HRV/);
assert.match(main,/Belasting · TRIMP week\s*\n\s*\d+/i,'TRIMP uit logs moet ook zonder health werken');assert.deepStrictEqual(p.errs,[]);await c.close();
// ---------- 4) synthetische data
({c,p}=await ctx(b,TODAY,synthLogs(),synthHealth(),posted));main=await p.innerText('main');
assert.ok(!/Nog geen/.test(main),main);assert.ok(!/NaN|undefined|Infinity/.test(main));
const m=main.match(/Herstel · HRV\s*\n\s*(\d+)%/i);assert.ok(m,'HRV % ontbreekt');assert.ok(+m[1]>103,'HRV hoger in laatste week verwacht: '+m[1]);
assert.match(main,/Rusthartslag\s*\n\s*53\s*bpm/i);
assert.match(main,/Zone 2-test · 8:00 \/km\s*\n\s*\d+\s*bpm/i);
assert.strictEqual(await p.$$eval('main .body3 .mrow',e=>e.length),3);assert.strictEqual(await p.$$eval('main .body3 .spk polyline',e=>e.length),3,'sparklines');
assert.strictEqual(await p.$$eval('main .body3 .ar.ok',e=>e.length)>=2,true,'herstel en rusthartslag moeten groen');
await p.screenshot({path:S+'v144-progressie-data.png',fullPage:true});
await p.screenshot({path:S+'v144-progressie-data-top.png'});
// streak-ketting: hele reeks, scrollbaar, vandaag rechts, daglabels, kleuren
await p.evaluate(()=>location.hash='#vandaag');await p.waitForTimeout(500);
const ck=await p.evaluate(()=>{const c=document.querySelector('main .chain.scroll');const L=[...c.querySelectorAll('.lk')];const last=L[L.length-1];
  const cs=e=>getComputedStyle(e.querySelector('i'));const ok=L.find(x=>x.classList.contains('ok')),ms=L.find(x=>x.classList.contains('miss'));
  return {n:L.length,today:last.classList.contains('today'),lbl:L.slice(-7).map(x=>x.innerText.trim()),scrollEnd:Math.abs(c.scrollLeft+c.clientWidth-c.scrollWidth)<=2,scrolls:c.scrollWidth>c.clientWidth,
   okBg:ok&&cs(ok).backgroundColor,okTx:ok&&cs(ok).color,msBg:ms&&cs(ms).backgroundColor,msTx:ms&&cs(ms).color,msBd:ms&&cs(ms).borderTopStyle,noswipe:c.hasAttribute('data-noswipe'),
   lastRight:Math.round(last.getBoundingClientRect().right)<=innerWidth};});
assert.ok(ck.n>40,'niet de hele reeks: '+ck.n);assert.ok(ck.today&&ck.scrollEnd&&ck.scrolls&&ck.lastRight&&ck.noswipe,JSON.stringify(ck));
assert.deepStrictEqual(ck.lbl,['ma','di','wo','do','vr','za','zo']);
assert.strictEqual(ck.okBg,'rgb(255, 107, 26)');assert.strictEqual(ck.okTx,'rgb(0, 0, 0)');assert.strictEqual(ck.msBg,'rgb(0, 0, 0)');assert.strictEqual(ck.msTx,'rgb(255, 107, 26)');assert.strictEqual(ck.msBd,'dashed');
await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await p.waitForTimeout(200);await p.screenshot({path:S+'v144-vandaag-ketting.png'});
await p.evaluate(()=>location.hash='#week');await p.waitForTimeout(400);
const wk=await p.evaluate(()=>{const L=[...document.querySelectorAll('main .chain .lk')];return {n:L.length,scroll:!!document.querySelector('main .chain.scroll'),lbl:L.map(x=>x.innerText.trim())};});
assert.deepStrictEqual(wk,{n:7,scroll:false,lbl:['ma','di','wo','do','vr','za','zo']});await p.screenshot({path:S+'v144-week.png'});
// app schrijft nooit health
assert.ok(!p.seen.some(s=>/^POST health/.test(s)),'app POST health');assert.ok(p.seen.includes('GET health'));
assert.deepStrictEqual(p.errs,[]);await c.close();
// ---------- 5) optionele logvelden hrv_ms / resting_hr / Zone 2-test-vinkje
posted.length=0;({c,p}=await ctx(b,'2026-10-15',[],[],posted));
await p.evaluate(()=>location.hash='#w/2026-10-15-z2/klaar');await p.waitForTimeout(400);
let route=await p.evaluate(()=>location.hash);
if(!(await p.$('details.more'))){ // id kan anders zijn: pak de eerste z2 uit het plan
  const id=await p.evaluate(()=>PLAN.find(w=>w.type==='run_z2').id);await p.evaluate(id=>location.hash='#w/'+id+'/klaar',id);await p.waitForTimeout(400);route=await p.evaluate(()=>location.hash);}
await p.click('details.more summary');await p.fill('[data-lf="hrv_ms"]','58');await p.press('[data-lf="hrv_ms"]','Tab');await p.waitForTimeout(150);
assert.ok(await p.$eval('details.more',d=>d.open),'Meer klapt dicht na invullen');
await p.fill('[data-lf="resting_hr"]','52');await p.press('[data-lf="resting_hr"]','Tab');await p.waitForTimeout(150);
await p.check('[data-z2test]');await p.waitForTimeout(150);
const lg=await p.evaluate(()=>allLogs().find(l=>l.hrv_ms!=null));assert.strictEqual(lg.hrv_ms,58);assert.strictEqual(lg.resting_hr,52);assert.strictEqual(lg.run.z2_test,true);
assert.match(await p.innerText('details.more summary'),/HRV 58 · rust 52 · Zone 2-test/);
await p.screenshot({path:S+'v144-afronden-meer.png',fullPage:true});
const hd=await p.evaluate(d=>{const H=healthDays();return H[d];},lg.date);assert.strictEqual(hd.hrv_manual,58);assert.strictEqual(hd.resting_hr,52);
// krachtworkout krijgt ook HRV/rust-velden, maar geen hoogtemeters/test-vinkje
const kid=await p.evaluate(()=>PLAN.find(w=>w.type==='strength').id);await p.evaluate(id=>location.hash='#w/'+id+'/klaar',kid);await p.waitForTimeout(400);
assert.ok(await p.$('[data-lf="hrv_ms"]'));assert.strictEqual(await p.$('[data-run="elevation_m"]'),null);assert.strictEqual(await p.$('[data-z2test]'),null);
// rustdag: geen velden
const rid=await p.evaluate(()=>(PLAN.find(w=>w.type==='rest')||{}).id);if(rid){await p.evaluate(id=>location.hash='#w/'+id+'/klaar',rid);await p.waitForTimeout(300);assert.strictEqual(await p.$('[data-lf]'),null);}
assert.deepStrictEqual(p.errs,[]);await c.close();
await b.close();console.log('v14.4 regressie OK');})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
