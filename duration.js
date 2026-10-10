// Strikte duur-herkenning: alleen een tekst die PUUR een tijd is krijgt een ▶-timer.
// Toegestaan: "40 s", "1 min", "5–6 min" (bovengrens), "90 sec", "2 minuten", "1:30 min", optioneel gevolgd
// door een beschrijvend woord zonder cijfers ("5–6 min rustig"). Nooit: kale getallen, m/meter, ×-herhalingen,
// per been/kant, reps. Een expliciet item.duration_sec (getal) gaat altijd voor.
(function(root){
  const NUM='\\d+(?:[.,]\\d+)?';
  const RE=new RegExp('^\\s*(?:±|~|ca\\.?\\s*)?('+NUM+'|\\d+:\\d{2})(?:\\s*[–—-]\\s*('+NUM+'|\\d+:\\d{2}))?\\s*(minuten|minuut|min|seconden|sec|s)\\.?(?:\\s+([a-zà-ÿ ]+))?\\s*$','i');
  const BAD=/\b(per|been|kant|reps?|herh|m|meter|km)\b|\/|×|\bx\b/i;
  function toNum(v){ if(v.includes(':')){const [a,b]=v.split(':').map(Number);return a+b/60;} return +v.replace(',','.'); }
  function parseDur(text){
    if(text==null)return null; const t=String(text).trim(); const m=t.match(RE); if(!m)return null;
    if(m[4]&&BAD.test(m[4]))return null;
    const n=toNum(m[2]||m[1]); const isMin=/^m/i.test(m[3]);
    if(m[1].includes(':')&&!isMin)return null;
    const sec=Math.round(isMin?n*60:n); return sec>0?sec:null;
  }
  function itemDur(it){ if(!it)return null; if(typeof it.duration_sec==='number'&&it.duration_sec>0)return Math.round(it.duration_sec); return parseDur(it.reps); }
  root.parseDur=parseDur; root.itemDur=itemDur;
  if(typeof module!=='undefined')module.exports={parseDur,itemDur};
})(typeof window!=='undefined'?window:globalThis);
