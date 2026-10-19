// Live-check READ-ONLY tegen de echte link. Token komt uit een lokaal bestand (nooit in de repo).
// Toegestaan: alleen GET ping/plan/logs/health. Alle andere requests (POST, writes) worden geblokkeerd.
// Gebruik: node tests/live.readonly.js [tokenbestand] [prefix]
const pw=require(process.env.PW||'/workspace/mkb-websites/tools/node_modules/playwright');const fs=require('fs');
const T=fs.readFileSync(process.argv[2]||'/tmp/.wtok','utf8').trim();const U=process.env.LIVE_URL||'https://thijs-grokbot.github.io/workout/';const S=__dirname+'/shots/';const PFX=process.argv[3]||'live';
const ALLOW=['ping','plan','logs','health'];
(async()=>{const b=await pw.webkit.launch();const c=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,serviceWorkers:'block',hasTouch:true});
const blocked=[],reads=[];
await c.route(/script\.google(usercontent)?\.com/,r=>{const q=r.request();const u=new URL(q.url());const a=u.searchParams.get('action')||'';
 if(q.method()!=='GET'||!ALLOW.includes(a)){blocked.push(q.method()+' '+(a||'post'));return r.abort();} reads.push(a);r.continue();});
const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(U+'#k='+encodeURIComponent(T));await p.waitForFunction(()=>/^"?ok/.test(localStorage.serverLogsState||''),null,{timeout:60000});
await p.waitForFunction(()=>(localStorage.healthState||'').length>2,null,{timeout:30000}).catch(()=>{});await p.waitForTimeout(1000);
await p.evaluate(()=>{localStorage.aftrapDone=localStorage.aftrapDone||'1';localStorage.mile=localStorage.mile||'100';location.hash='#week';});await p.waitForTimeout(800);
await p.evaluate(()=>{location.hash='#vandaag';});await p.waitForTimeout(2000);
const snap=()=>p.evaluate(()=>JSON.stringify(Object.keys(localStorage).filter(k=>/^log:|^queue$/.test(k)).sort().map(k=>[k,localStorage[k]])));const before=await snap();
const info=await p.evaluate(()=>{const c=document.querySelector('main .chain');const L=[...c.querySelectorAll('.lk')];return {ver:(typeof APP_VERSION!=='undefined'?APP_VERSION:'')+' · '+((document.querySelector('.ver')||{}).textContent||'geen versieregel'),hash:location.hash,mode:typeof ACC!=='undefined'?ACC.mode():'n.v.t.',accountsApi:localStorage.accountsApi||null,streak:(document.querySelector('.streak .h')||{}).textContent,
  chainN:L.length,chainScroll:c.classList.contains('scroll'),chainLastToday:L[L.length-1].classList.contains('today'),chainAtEnd:Math.abs(c.scrollLeft+c.clientWidth-c.scrollWidth)<=2,
  chainLast7:L.slice(-7).map(e=>e.innerText.trim()+':'+((e.className.match(/\b(ok|miss)\b/)||['-'])[0])).join(' '),health:localStorage.healthState,logs:localStorage.serverLogsState};});
await p.evaluate(()=>scrollTo(0,document.body.scrollHeight));await p.waitForTimeout(200);await p.screenshot({path:S+PFX+'-vandaag.png'});
await p.evaluate(()=>location.hash='#morgen');await p.waitForTimeout(800);await p.screenshot({path:S+PFX+'-morgen.png'});
const morgen=await p.evaluate(()=>({start:!!document.querySelector('#start'),view:(document.querySelector('#view')||{}).textContent||null,rest:!!document.querySelector('.restday')}));
if(morgen.view){await p.click('#view');await p.waitForTimeout(600);morgen.pv=await p.evaluate(()=>({hash:location.hash,pvstart:!!document.querySelector('#pvstart'),bar:document.querySelector('#bar').innerText}));}
await p.evaluate(()=>location.hash='#week');await p.waitForTimeout(800);await p.screenshot({path:S+PFX+'-week.png'});
const wk=await p.evaluate(()=>[...document.querySelectorAll('main .chain .lk')].map(e=>e.innerText.trim()).join(' '));
await p.evaluate(()=>location.hash='#progressie/hardlopen');await p.waitForTimeout(1000);await p.screenshot({path:S+PFX+'-progressie-hardlopen.png',fullPage:true});
const prog=await p.evaluate(()=>[...document.querySelectorAll('main .card')].slice(0,2).map(c=>c.innerText.replace(/\n+/g,' · ')).join(' || '));
const after=await snap();
console.log(JSON.stringify({info,morgen,wk,prog,logsUnchanged:before===after,reads:[...new Set(reads)],blocked,errs},null,1));await b.close();})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
