// Helper: laat Playwright-verzoeken naar Apps Script afhandelen door de echte Code.gs (in node, met nep-Drive uit apps-script/mockenv.js).
const MK=require('../apps-script/mockenv');
module.exports=function(opts){ const E=MK(opts); E.calls=[];E.delay=0;
  E.route=async r=>{ const q=r.request(), u=new URL(q.url()), par=Object.fromEntries(u.searchParams.entries());
    let out; if(q.method()==='POST'){ const b=q.postData()||'{}'; E.calls.push('POST '+(JSON.parse(b).action||'')); out=E.ctx.doPost({parameter:par,postData:{contents:b}}); }
    else { E.calls.push('GET '+(par.action||'')); out=E.ctx.doGet({parameter:par}); }
    if(E.delay) await new Promise(res=>setTimeout(res,E.delay));
    r.fulfill({status:200,contentType:out.m==='js'?'application/javascript':'application/json',headers:{'access-control-allow-origin':'*'},body:out.t}); };
  return E; };
