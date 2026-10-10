const VERSION='v12';const C='workout-'+VERSION;
const FILES=['./','index.html','app.js','duration.js','style.css','config.js','manifest.json','workouts.json','icons/icon-192.png','icons/apple-touch-icon.png'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(FILES.map(f=>new Request(f,{cache:'reload'})))))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener('message',e=>{if(e.data==='version')e.source&&e.source.postMessage({version:VERSION})});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);
 if(e.request.method!=='GET'||u.origin!==location.origin)return; // nooit cross-origin (Apps Script) onderscheppen
 const p=u.pathname, netFirst=e.request.mode==='navigate'||/\/$|index\.html$|app\.js$|duration\.js$|sw\.js$|config\.js$|style\.css$|\.json$/.test(p);
 if(netFirst){e.respondWith(fetch(e.request,{cache:'no-cache'}).then(r=>{if(r.ok){const cl=r.clone();caches.open(C).then(c=>c.put(e.request,cl));}return r}).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('index.html'))));return}
 e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});
