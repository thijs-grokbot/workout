// v14 schermen + stemflow (WebKit, 390×844). Gebruik: node tests/screens.js [app-url]. Schrijft tests/shots/NN-*.png
const pw=require(process.env.PW||'/workspace/mkb-websites/tools/node_modules/playwright');const assert=require('assert');const fs=require('fs');
const U=process.argv[2]||'http://localhost:8765/', OUT=__dirname+'/shots/';
const PLAN=JSON.parse(fs.readFileSync(__dirname+'/fixture-plan-w41-42.json','utf8'));const W=Array.isArray(PLAN)?PLAN:PLAN.workouts;
const API='https://script.google.com/macros/s/MOCK/exec',TOK='TESTTOKEN_xyz';
// synthetische logs (geen echte gezondheidsdata)
const LOGS=[{workout_id:'2026-10-10-kracht-b',date:'2026-10-10',status:'gedaan',rpe:7,feedback:{'Goblet squat':'te licht','Farmer carry':'te zwaar','Wall balls':'goed'},run:{},notes:'',
  sets:[1,2].flatMap(r=>[['Goblet squat',20],['Farmer carry',24],['Wall balls',8]].map(([e,v])=>({round:r,block:'Hoofdset',exercise:e,reps_done:'10',load_done:v,load_unit:'kg',done:true}))),updated_at:'2026-10-10T18:00:00Z'},
 {workout_id:'2026-10-11-z2',date:'2026-10-11',status:'gedaan',rpe:4,run:{duration_min:45,distance_km:7.6,avg_hr:136,max_hr:149},sets:[],feedback:{},updated_at:'2026-10-11T10:00:00Z'},
 {workout_id:'2026-10-12-z2',date:'2026-10-12',status:'gedaan',rpe:5,run:{duration_min:44,distance_km:7.9,avg_hr:138,max_hr:151},sets:[],feedback:{},updated_at:'2026-10-12T10:00:00Z'}];
const KA=W.find(w=>w.id==='2026-10-14-kracht-a');
const NEW=JSON.parse(JSON.stringify(KA)); NEW.blocks.forEach(b=>{ b.items=b.items.filter(i=>!/pull-ups/i.test(i.exercise)); b.items.forEach(i=>{ if(i.exercise==='Goblet squat'){i.load_default=(i.load_default||22)-4;} }); });
(async()=>{const b=await pw.webkit.launch();const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block'});const calls=[];
await c.route(/script\.google\.com/,r=>{const q=r.request();const u=new URL(q.url());let body={};if(q.method()==='POST')body=JSON.parse(q.postData());const a=u.searchParams.get('action')||body.action;calls.push({a,body});
 const res=a==='ping'?{ok:true,version:'generic-2',ai:true,trainer:'Mike'}:a==='plan'?{ok:true,workouts:W}:a==='logs'?{ok:true,logs:LOGS}:a==='readfile'?{ok:true,json:W.filter(w=>w.date>='2026-10-12'&&w.date<='2026-10-18')}
  :a==='coach'?{ok:true,ai:true,trainer:'Mike',transcript:'Ik ben moe. Pull-ups eruit en goblet squat wat lichter.',message:'Pull-ups eruit en goblet squat 20 kg. Oké?',change:true,workout:NEW}
  :a==='transcribe'?{ok:true,transcript:'Werk op kantoor, vroeger gevoetbald. Knie is gevoelig.',chips:['Sportief','Gevoelige knie']}:{ok:true};
 setTimeout(()=>r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(res)}),a==='coach'?600:150)});
await c.addInitScript(()=>{ // nep-microfoon
  if(!window.MediaRecorder){ window.MediaRecorder=class{ constructor(st,o){this.mimeType='audio/mp4';this.state='inactive';} static isTypeSupported(m){return m==='audio/mp4';}
    start(){this.state='recording';} requestData(){} stop(){this.state='inactive'; setTimeout(()=>{ this.ondataavailable&&this.ondataavailable({data:new Blob([new Uint8Array(4000)],{type:'audio/mp4'})}); this.onstop&&this.onstop(); },20);} }; }
  const fake=async()=>{ try{ const ac=new AudioContext(); const o=ac.createOscillator(); const d=ac.createMediaStreamDestination(); o.connect(d); o.start(); return d.stream; }catch(e){ return {getTracks:()=>[]}; } };
  if(!navigator.mediaDevices) Object.defineProperty(navigator,'mediaDevices',{value:{}}); try{ Object.defineProperty(MediaDevices.prototype,'getUserMedia',{value:fake,configurable:true,writable:true}); }catch(e){} try{ Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:fake,configurable:true}); }catch(e){} });
const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));if(process.env.DEBUG)p.on('console',m=>console.log('console',m.text().slice(0,200)));
const shot=async n=>{ await p.waitForTimeout(350); await p.screenshot({path:OUT+n+'.png'}); };
const go=async h=>{ await p.evaluate(x=>location.hash=x,h); await p.waitForTimeout(250); };
await p.goto(U);await p.evaluate(([A,T])=>{localStorage.clear();localStorage.cfg=JSON.stringify({API_URL:A,TOKEN:T});},[API,TOK]);await p.reload();await p.waitForTimeout(800);
// Aftrap
assert.match(await p.evaluate(()=>location.hash),/aftrap/,'aftrap niet getoond');
await shot('01-aftrap-welkom'); await p.click('#next'); await shot('02-aftrap-1-trainer');
assert.strictEqual(await p.$('#bigmic'),null,'mic op 02');
await p.click('text=Zelf verzinnen ✎'); await p.fill('#tname','Mike'); await shot('02b-aftrap-1b-trainer-zelf'); await p.click('#next');
await p.click('button[data-c="HYROX"]'); await p.click('button[data-c="Sneller lopen"]'); assert.ok(await p.$('#bigmic'),'mic op 03'); await shot('03-aftrap-2-doelen'); await p.click('#next');
await p.click('button[data-c="4×"]'); await shot('04-aftrap-3-frequentie'); await p.click('#next');
await p.click('button[data-c="HYROX"]'); await shot('05-aftrap-4-evenement'); await p.click('#next');
await p.click('button[data-c="Sportief"]'); await p.click('#bigmic'); await p.waitForTimeout(1500); if(process.env.DEBUG)console.log('HINT',await p.textContent('#bmh'),await p.getAttribute('#bigmic','class')); await p.click('#bigmic'); await p.waitForTimeout(1000); if(process.env.DEBUG)console.log('CALLS',calls.map(x=>x.a).join(',')); await p.waitForFunction(()=>/Jij zei/i.test(document.body.innerText),null,{timeout:8000}).catch(async e=>{ console.log('DBG',await p.evaluate(()=>[document.querySelector('#bmh')&&document.querySelector('#bmh').textContent,localStorage.aiOn,typeof MediaRecorder].join(' / '))); throw e; }); await shot('06-aftrap-5-over-jou'); await p.click('#next');
await p.click('button[data-kg="1"]'); await shot('07-aftrap-6-gewicht'); await p.click('#next');
await p.click('button[data-c="Meer eiwit"]'); await shot('08-aftrap-7-voeding'); await p.click('#next');
await p.click('button[data-c="Thuis trainen"]'); await shot('09-aftrap-8-overig'); await p.click('#next');
await p.waitForTimeout(200); await p.screenshot({path:OUT+'10-aftrap-klaar.png'});
await p.waitForFunction(()=>location.hash==='#vandaag',null,{timeout:6000});
const prof=await p.evaluate(()=>JSON.parse(localStorage.profile));assert.strictEqual(prof.trainer_name,'Mike');assert.deepStrictEqual(prof.aftrap.over_jou.chips.sort(),['Gevoelige knie','Sportief']);
await p.waitForFunction(()=>localStorage.aftrapPending==='0',null,{timeout:6000});
assert.ok(calls.some(x=>x.a==='writefile'&&/profiel\/thijs-aftrap\.json/.test(x.body.path)),'aftrap niet weggeschreven');
// App
await p.waitForTimeout(800); await shot('11-vandaag');
const txt=await p.evaluate(()=>document.body.innerText); assert.ok(!/\bAI\b/.test(txt),'woord AI in UI'); assert.ok(!/drempel/i.test(txt));
await go('#reeks'); await shot('12-streak-niveaus');
await p.evaluate(()=>celebrate(7)); await shot('13-streak-mijlpaal'); await p.click('.celebrate .btn');
await go('#w/2026-10-14-kracht-a/r1'); await p.click('.ex[data-k] .exr >> nth=0');
await p.evaluate(()=>{ const el=document.querySelectorAll('.ex')[2]; el.classList.add('swiping'); el.dataset.open='1'; el.querySelector('.mv').style.transform='translateX(-96px)'; }); await shot('14-ronde-swipe-verwijderen');
await p.click('.ex.swiping .x'); await p.waitForTimeout(300); assert.match(await p.evaluate(()=>document.body.innerText),/Verwijderd/); await p.click('.utoast button'); await p.waitForTimeout(300);
assert.strictEqual(await p.evaluate(()=>byId('2026-10-14-kracht-a').blocks[1].items.length),KA.blocks[1].items.length,'ongedaan maken werkte niet');
// stem: luistert -> voorstel -> akkoord -> aangepast + gloed
await go('#w/2026-10-14-kracht-a/r1');
await p.click('#micfab'); await p.waitForSelector('.fab.rec'); await p.waitForTimeout(1300); await shot('15-stem-luistert');
await p.click('#micfab'); await p.waitForSelector('.vbar [data-v="yes"]',{timeout:8000}); await shot('16-stem-voorstel');
const cc=calls.find(x=>x.a==='coach'); assert.ok(cc.body.audio&&cc.body.audio.data.length>100&&/audio|video/.test(cc.body.audio.mime),'audio niet meegestuurd'); assert.strictEqual(cc.body.workout.id,'2026-10-14-kracht-a'); assert.ok(cc.body.context.recent_logs.length>=1);
assert.match(await p.textContent('.vbar'),/MIKE/); assert.match(await p.textContent('.vbar'),/WEG/);
await p.click('.vbar [data-v="yes"]'); await p.waitForTimeout(250); await p.screenshot({path:OUT+'17-stem-aangepast-gloed.png'});
assert.match(await p.textContent('.vbar'),/Aangepast ✓/); if(!(await p.$('.pulse')))console.log('DBG',await p.evaluate(()=>[localStorage.glow,location.hash,[...document.querySelectorAll('[data-ex]')].map(e=>e.dataset.ex).join('|')].join(' ## '))); assert.ok(await p.$('.pulse'),'geen gloed');
assert.ok(!(await p.evaluate(()=>document.body.innerText)).includes('Ring/TRX row of pull-ups'));
await p.waitForTimeout(2300); assert.strictEqual(await p.$('.vbar'),null,'balk niet weg na 2 s');
await p.waitForFunction(()=>Object.values(JSON.parse(localStorage.overrides||'{}')).every(o=>o.written===true),null,{timeout:6000});
const wp=calls.filter(x=>x.a==='writeplan').pop(); assert.strictEqual(wp.body.week,'2026-W42'); assert.ok(wp.body.workouts.length>=7,'writeplan zou hele week moeten bevatten'); assert.ok(wp.body.workouts.find(w=>w.id===KA.id).blocks[1].items.length===NEW.blocks[1].items.length);
const lg=await p.evaluate(()=>JSON.parse(localStorage['log:2026-10-14-kracht-a'])); assert.strictEqual(lg.adjusted_by,'user'); assert.ok(lg.adjustments.some(a=>a.source==='stem'&&a.diff.verwijderd.length));
// rust, afsluiten, samenvatting
await p.evaluate(()=>startRest(90,'Goblet squat · 10 × 20 kg','Kracht A · na ronde 1')); await p.waitForTimeout(1200); await shot('18-rust'); await p.click('.rest .foot .btn');
await go('#w/2026-10-14-kracht-a/klaar'); await p.click('button[data-rpe="7"]'); await p.click('button[data-fb="Goblet squat"][data-v="te licht"]'); await shot('19-afsluiten-kracht');
await p.click('.info'); await shot('20-rpe-uitleg'); await p.click('.pop .btn');
await p.click('button[data-status="gedaan"]').catch(()=>{}); await p.evaluate(()=>{ const l=JSON.parse(localStorage['log:2026-10-14-kracht-a']); l.status='gedaan'; localStorage['log:2026-10-14-kracht-a']=JSON.stringify(l); }); await go('#w/2026-10-14-kracht-a/klaar');
await p.click('#save'); await p.waitForFunction(()=>/samenvatting/.test(location.hash)); await shot('22-samenvatting-kracht');
await go('#w/2026-10-13-tempo/klaar'); for(const [k,v] of [['duration_min','48'],['distance_km','9,2'],['avg_hr','158'],['max_hr','176']]){ await p.fill(`input[data-run="${k}"]`,v); await p.press(`input[data-run="${k}"]`,'Tab'); await p.waitForTimeout(100);} await p.click('button[data-rpe="8"]'); await shot('21-afsluiten-hardlopen');
await p.click('button[data-status="gedaan"]'); await p.click('#save'); await p.waitForFunction(()=>/samenvatting/.test(location.hash)); await shot('23-samenvatting-hardlopen');
await go('#progressie/kracht'); await shot('24-progressie-kracht'); await go('#progressie/hardlopen'); await shot('25-progressie-hardlopen');
await go('#vandaag'); await p.click('#avbtn'); await shot('26-profiel'); assert.match(await p.textContent('.sheet'),/Gekoppeld ✓/);
// FAB op alle app-schermen, niet op aftrap 01/02/04/07/08/10
for(const h of ['#vandaag','#week','#progressie','#reeks','#w/2026-10-14-kracht-a','#w/2026-10-13-tempo','#instellingen']){ await go(h); assert.ok(await p.isVisible('#micfab'),'geen FAB op '+h); }
await go('#week'); await shot('x-week'); await go('#w/2026-10-13-tempo'); await shot('x-hardlopen-sessie'); await go('#instellingen'); await shot('x-instellingen');
const all=await p.evaluate(()=>document.documentElement.outerHTML); assert.ok(!all.includes(TOK),'token zichtbaar in DOM');
const real=errs.filter(e=>!/access control checks|Load failed|cancelled/i.test(e)); assert.deepStrictEqual(real,[]);
console.log('schermen + stemflow OK ('+fs.readdirSync(OUT).length+' screenshots)'); await b.close(); })().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
