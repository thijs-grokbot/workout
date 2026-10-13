// Echte MediaRecorder-opname (Chromium nep-microfoon). Route B (geen trainer-sleutel) -> inbox; route A -> coach met audio.
const pw=require(process.env.PW||'/workspace/mkb-websites/tools/node_modules/playwright');const assert=require('assert');const fs=require('fs');
const U=process.argv[2]||'http://localhost:8765/';const PLAN=JSON.parse(fs.readFileSync(__dirname+'/fixture-plan-w41-42.json','utf8'));const W=Array.isArray(PLAN)?PLAN:PLAN.workouts;
(async()=>{const b=await pw.chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 for(const ai of [false,true]){
 const c=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block',permissions:['microphone']});const calls=[];
 await c.route(/script\.google\.com/,r=>{const q=r.request();const u=new URL(q.url());let body={};if(q.method()==='POST')body=JSON.parse(q.postData());const a=u.searchParams.get('action')||body.action;calls.push({a,body});
  const res=a==='ping'?{ok:true,version:'generic-2',ai,trainer:'Mike'}:a==='plan'?{ok:true,workouts:W}:a==='logs'?{ok:true,logs:[]}:a==='coach'?{ok:true,ai:true,transcript:'gaat goed',message:'Top, ga zo door!',change:false}:{ok:true};
  r.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(res)})});
 const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(U);await p.evaluate(()=>{localStorage.clear();localStorage.cfg=JSON.stringify({API_URL:'https://script.google.com/macros/s/MOCK/exec',TOKEN:'T'});localStorage.aftrapDone='1';});
 await p.goto(U+'#w/2026-10-14-kracht-a/r1');await p.reload();await p.waitForTimeout(1200);
 await p.click('#micfab');await p.waitForSelector('.fab.rec',{timeout:6000}).catch(async e=>{console.log('DBG',await p.evaluate(()=>(document.querySelector('.vbar')||{}).textContent+' / '+location.hash));throw e;});await p.waitForTimeout(2500);await p.click('#micfab');
 if(!ai){ await p.waitForFunction(()=>/Verstuurd naar Mike ✓/.test((document.querySelector('.vbar')||{}).textContent||''),null,{timeout:10000});
  const au=calls.find(x=>x.a==='writefile'&&/^inbox\/.+\.(webm|m4a)$/.test(x.body.path)), js=calls.find(x=>x.a==='writefile'&&/^inbox\/.+\.json$/.test(x.body.path));
  assert.ok(au&&au.body.encoding==='base64'&&au.body.content.length>2000,'audio niet in inbox'); assert.ok(js&&js.body.content.workout_id==='2026-10-14-kracht-a');
  assert.ok(!calls.some(x=>x.a==='coach'),'coach aangeroepen zonder sleutel'); console.log(' route B ok:',au.body.path,Math.round(au.body.content.length*3/4/1024)+' KB');
 } else { await p.waitForFunction(()=>/ga zo door/.test((document.querySelector('.vbar')||{}).textContent||''),null,{timeout:10000});
  const cc=calls.find(x=>x.a==='coach'); assert.ok(cc.body.audio.data.length>2000&&/webm|mp4/.test(cc.body.audio.mime)); console.log(' route A ok:',cc.body.audio.mime); }
 assert.deepStrictEqual(errs,[]); await c.close(); }
 console.log('stem Chromium OK'); await b.close(); })().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
