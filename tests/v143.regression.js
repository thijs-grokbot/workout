// v14.3: interactieve tab-swipe, rustdag zonder CTA, voorvertoning schrijft niets, streak per datum, ketting op één lijn.
const pw=require(process.env.PW||'/workspace/mkb-websites/tools/node_modules/playwright');const assert=require('assert');const fs=require('fs');
const U=process.argv[2]||'http://localhost:8765/';const P=JSON.parse(fs.readFileSync(__dirname+'/fixture-plan-w41-42.json'));const W=Array.isArray(P)?P:P.workouts;
const S=__dirname+'/shots/';
// synthetische logs (geen echte gezondheidsdata)
const L=(id,date,status,run)=>({workout_id:id,date,status,sets:[],run:run||{},feedback:{},updated_at:date+'T18:00:00Z'});
const BASE=[L('2026-10-10-kracht-b','2026-10-10','gedaan'),L('2026-10-11-z2','2026-10-11','gedaan',{duration_min:45,distance_km:6,avg_hr:140}),
 L('2026-10-12-z2','2026-10-12','gedaan',{duration_min:50,distance_km:6.5,avg_hr:141,elevation_m:40}),L('2026-10-13-tempo','2026-10-13','gedaan',{duration_min:33,distance_km:5,avg_hr:150}),
 L('2026-10-14-kracht-a','2026-10-14','gedaan'),
 L('2026-10-15-z2','2026-10-15','gedaan',{duration_min:40,distance_km:5.2,avg_hr:140})]; // plan heeft 2026-10-15-thuis!
async function ctx(b,day,logs,posted){ const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block',hasTouch:true});
  await c.addInitScript(d=>{const D=Date;const off=new D(d+'T09:00:00+02:00').getTime()-D.now();window.Date=class extends D{constructor(...a){super(...(a.length?a:[D.now()+off]))}static now(){return D.now()+off}};},day);
  await c.route(/script\.google\.com/,r=>{const q=r.request();const a=new URL(q.url()).searchParams.get('action');if(q.method()==='POST'){posted.push(JSON.parse(q.postData()));}
    r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(a==='logs'?{ok:true,logs}:a==='plan'?{ok:true,workouts:W}:{ok:true})})});
  const p=await c.newPage(); p.errs=[]; p.on('pageerror',e=>p.errs.push(e.message));
  await p.goto(U);await p.evaluate(()=>{localStorage.clear();localStorage.aftrapDone='1';localStorage.mile='100';localStorage.cfg=JSON.stringify({API_URL:'https://script.google.com/macros/s/M/exec',TOKEN:'t'});history.replaceState(null,'','/#vandaag');});
  await p.reload();await p.waitForFunction(()=>/^"ok/.test(localStorage.serverLogsState||''),null,{timeout:15000});await p.evaluate(()=>{location.hash='#week';});await p.waitForTimeout(150);await p.evaluate(()=>{location.hash='#vandaag';});await p.waitForTimeout(400);
  return {c,p}; }
const touch=(p,pts,hold)=>p.evaluate(([pts,hold])=>{const el=document.querySelector('#app');const mk=(type,x,y)=>{const e=new Event(type,{bubbles:true,cancelable:true});const pt={identifier:1,target:el,clientX:x,clientY:y};Object.defineProperty(e,'touches',{value:type==='touchend'?[]:[pt]});Object.defineProperty(e,'changedTouches',{value:[pt]});return e;};
  el.dispatchEvent(mk('touchstart',pts[0][0],pts[0][1]));for(const q of pts.slice(1))el.dispatchEvent(mk('touchmove',q[0],q[1]));if(!hold){const l=pts[pts.length-1];el.dispatchEvent(mk('touchend',l[0],l[1]));}},[pts,hold]);
(async()=>{const b=await pw.webkit.launch();const posted=[];
// ---------- streak + ketting + rustdag (vandaag = vr 16/10 = rustdag)
let {c,p}=await ctx(b,'2026-10-16',BASE,posted);
assert.match(await p.innerText('.streak .h'),/^7 dagen$/i,'streak telt 15-z2 (plan: thuis) of rustdag niet: '+await p.innerText('.streak .h'));
assert.strictEqual(await p.$('#start'),null,'Start training op rustdag');
assert.ok(await p.$('.restday'),'geen rustdag-weergave');
assert.ok(!/Start training/i.test(await p.innerText('main')));
const ch=await p.$$eval('main .chain .lk i',els=>els.map(e=>{const r=e.getBoundingClientRect();return [Math.round(r.top),Math.round(r.width),Math.round(r.height)];}));
assert.strictEqual(ch.length,7);assert.ok(ch.every(x=>x[0]===ch[0][0]&&x[1]===ch[0][1]&&x[2]===ch[0][2]),'ketting niet op één lijn / ongelijk: '+JSON.stringify(ch));
assert.strictEqual(ch[0][1],ch[0][2],'geen vierkantjes');
const cls=await p.$$eval('main .chain .lk',e=>e.map(x=>x.className.replace(/\s+/g,' ').trim()));
assert.ok(/ok/.test(cls[cls.length-2])&&/ok/.test(cls[cls.length-1])&&/today/.test(cls[cls.length-1]),'do (15-z2) en vr (rustdag) niet gevuld: '+cls.join('|'));
await p.screenshot({path:S+'v143-vandaag-rustdag.png',fullPage:true});
await p.evaluate(()=>location.hash='#week');await p.waitForTimeout(300);
assert.ok(await p.$('main .wday:nth-child(5) .wl.wrest'),'week toont geen Rust-rij bij rustdag');assert.ok(!/Rustdag/.test(await p.innerText('main')),'v15: Rustdag + Rust dubbel');
assert.ok(await p.$('main .wday:nth-child(4) .wl .st.ok'),'andere workout op die dag telt niet als gedaan in Week');assert.match(await p.innerText('main .wday:nth-child(4)'),/Thuis · 20 min AMRAP/);
const ch2=await p.$$eval('main .chain .lk i',els=>els.map(e=>Math.round(e.getBoundingClientRect().left)));assert.ok(ch2.every(y=>y===ch2[0]),'v15: verticale ketting staat niet in één kolom');
await p.screenshot({path:S+'v143-week.png'});
await p.evaluate(()=>location.hash='#w/2026-10-16-rust');await p.waitForTimeout(300);
assert.ok(await p.$('.restday'));assert.strictEqual(await p.evaluate(()=>document.querySelector('#bar').style.display),'none','knop onderin op rustdag');
await c.close();
// overgeslagen breekt
({c,p}=await ctx(b,'2026-10-16',[...BASE.slice(0,5),L('2026-10-15-thuis','2026-10-15','overgeslagen')],posted));
assert.match(await p.innerText('.streak .h'),/^1 dag$/i,'overgeslagen brak streak niet');
assert.ok(/miss/.test(await p.$eval('main .chain .lk[aria-label*=" 15/10:"]',e=>e.className)),'overgeslagen niet gestippeld');
await p.screenshot({path:S+'v143-ketting-overgeslagen.png',clip:{x:0,y:600,width:390,height:244}});
await c.close();
// gemist breekt
({c,p}=await ctx(b,'2026-10-16',BASE.slice(0,5),posted));
assert.match(await p.innerText('.streak .h'),/^1 dag$/i,'gemist brak streak niet');
await c.close();
// feedback als tekst (zoals Mike logt) mag niet per letter getoond worden
({c,p}=await ctx(b,'2026-10-14',[...BASE.slice(0,4),Object.assign(L('2026-10-14-kracht-a','2026-10-14','gedaan'),{feedback:'Z2 lekker gelopen'})],posted));
assert.strictEqual(await p.$$eval('main .exs .li',x=>x.filter(e=>/^\S$/.test(e.innerText.split('\n')[0].trim())).length),0,'feedback per letter');
assert.match(await p.innerText('main'),/Z2 lekker gelopen/);
await c.close();
// v14.4: efficiëntiekaart vervangen door belasting · herstel · basis; korte run telt niet als Zone 2-test
({c,p}=await ctx(b,'2026-10-16',[...BASE,L('2026-10-16-x-z2','2026-10-16','gedaan',{duration_min:8,distance_km:1,avg_hr:151})],posted));
await p.evaluate(()=>location.hash='#progressie/hardlopen');await p.waitForTimeout(400);
assert.ok(await p.$('main .body3'));assert.ok(!/efficiënt|m\/slag/i.test(await p.innerText('main')),'oude efficiëntiekaart nog zichtbaar');
assert.ok(!Object.values(await p.evaluate(()=>z2Tests(480))).some(x=>x.d==='2026-10-16'),'korte run als Zone 2-test');
await c.close();
// ---------- rustdag op Morgen (vandaag do 15/10, morgen = rust)
({c,p}=await ctx(b,'2026-10-15',BASE.slice(0,5),posted));
await p.evaluate(()=>location.hash='#morgen');await p.waitForTimeout(300);
assert.ok(await p.$('.restday'));assert.strictEqual(await p.$('#start'),null);assert.strictEqual(await p.$('.pvlink'),null);
await p.screenshot({path:S+'v143-morgen-rustdag.png'});
await c.close();
// ---------- voorvertoning + swipe (vandaag wo 14/10 kracht A)
({c,p}=await ctx(b,'2026-10-14',BASE.slice(0,4),posted));
const snap=()=>p.evaluate(()=>{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(!/^(serverLogsState|lastSync|toastShownFor|swReloadAt|progTab|weekOff)$/.test(k))o[k]=localStorage.getItem(k);}return o;});
const before=await snap(), nPost=posted.length;
assert.ok(await p.$('.pvlink'),'geen voorvertoning-link op Vandaag');
await p.click('.pvlink');await p.waitForTimeout(300);
assert.match(await p.evaluate(()=>location.hash),/^#voorbeeld\/2026-10-14-kracht-a/);
const tabs=await p.$$eval('header .tabs button',x=>x.map(e=>e.dataset.ptab));assert.ok(tabs.length>=4,'geen tabs in voorvertoning');
await p.screenshot({path:S+'v143-voorbeeld-warmup.png'});
for(const k of tabs){ await p.click(`header .tabs [data-ptab="${k}"]`);await p.waitForTimeout(150); }
await p.click('header .tabs [data-ptab="r1"]');await p.waitForTimeout(200);
const r1=await p.innerText('main');assert.match(r1,/Goblet squat/);assert.match(r1,/KG|kg/);
assert.strictEqual((await p.$$('main [data-chk], main .play')).length,0,'interactieve elementen in voorvertoning');
await p.screenshot({path:S+'v143-voorbeeld-ronde.png'});
// swipe binnen voorvertoning
await touch(p,[[300,400],[250,402],[180,404],[120,405]]);await p.waitForTimeout(400);
assert.match(await p.evaluate(()=>location.hash),/\/r2$/,'swipe in voorvertoning ging niet naar ronde 2');
assert.strictEqual(await p.evaluate(()=>document.querySelector('#overlay').style.display),'none','rust gestart in voorvertoning');
const after=await snap();assert.deepStrictEqual(after,before,'voorvertoning schreef naar localStorage');assert.strictEqual(posted.length,nPost,'voorvertoning stuurde iets naar de server');
// grote oranje knop start echt
assert.match(await p.innerText('#bar'),/Start training/);
await p.click('#pvstart');await p.waitForTimeout(300);assert.match(await p.evaluate(()=>location.hash),/^#w\/2026-10-14-kracht-a$/);
// ---------- interactieve swipe hoofdtabs: vanaf Progressie naar links
await p.evaluate(()=>location.hash='#progressie/hardlopen');await p.waitForTimeout(400);
await touch(p,[[100,500],[112,501],[160,502],[220,503]],true);await p.waitForTimeout(50);
const mid=await p.evaluate(()=>{const g=document.querySelector('.swghost');return {ghost:!!g,txt:g?g.innerText.slice(0,200):'',tf:document.querySelector('#app').style.transform,gtf:g&&g.style.transform};});
assert.ok(mid.ghost,'geen meeschuivend buurscherm');assert.match(mid.txt,/Week \d+/i,'buurscherm is niet Week');assert.match(mid.tf,/translateX\(120px\)/);
await p.screenshot({path:S+'v143-swipe-midden.png'});
await p.evaluate(()=>{const el=document.querySelector('#app');const e=new Event('touchend',{bubbles:true});Object.defineProperty(e,'touches',{value:[]});Object.defineProperty(e,'changedTouches',{value:[{clientX:220,clientY:503}]});el.dispatchEvent(e);});
await p.waitForTimeout(800);
assert.strictEqual(await p.evaluate(()=>location.hash),'#week','swipe vanaf Progressie ging niet naar Week');
assert.strictEqual(await p.$('.swghost'),null,'buurscherm bleef hangen');assert.strictEqual(await p.evaluate(()=>document.querySelector('#app').style.transform),'');
// kleine, langzame sleep → terugveren
await touch(p,[[200,500],[215,500]],true);await p.waitForTimeout(400);
await p.evaluate(()=>{const el=document.querySelector('#app');const mk=(type,x)=>{const e=new Event(type,{bubbles:true,cancelable:true});const pt={identifier:1,target:el,clientX:x,clientY:500};Object.defineProperty(e,'touches',{value:type==='touchend'?[]:[pt]});Object.defineProperty(e,'changedTouches',{value:[pt]});return e;};el.dispatchEvent(mk('touchmove',240));el.dispatchEvent(mk('touchend',240));});await p.waitForTimeout(800);
assert.strictEqual(await p.evaluate(()=>location.hash),'#week','kleine sleep wisselde tab');assert.strictEqual(await p.$('.swghost'),null);
// verticaal scrollen blijft werken (geen lock, geen transform)
await touch(p,[[200,600],[203,560],[205,480],[206,380]],true);
assert.strictEqual(await p.$('.swghost'),null,'verticale beweging startte swipe');assert.strictEqual(await p.evaluate(()=>document.querySelector('#app').style.transform),'');
await p.evaluate(()=>{const el=document.querySelector('#app');const e=new Event('touchend',{bubbles:true});Object.defineProperty(e,'touches',{value:[]});Object.defineProperty(e,'changedTouches',{value:[{clientX:206,clientY:380}]});el.dispatchEvent(e);});
// verder naar Morgen en Vandaag
await touch(p,[[100,500],[160,500],[260,500]]);await p.waitForTimeout(800);assert.strictEqual(await p.evaluate(()=>location.hash),'#morgen');
await touch(p,[[100,500],[160,500],[260,500]]);await p.waitForTimeout(800);assert.strictEqual(await p.evaluate(()=>location.hash),'#vandaag');
await touch(p,[[100,500],[160,500],[260,500]]);await p.waitForTimeout(800);assert.strictEqual(await p.evaluate(()=>location.hash),'#vandaag','voorbij Vandaag');
assert.deepStrictEqual(p.errs,[]);await c.close();
console.log('v14.3-regressie OK');await b.close();})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
