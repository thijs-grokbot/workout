const assert=require('assert');const {parseDur,itemDur}=require('../duration.js');
const yes={'5–6 min':360,'5–6 min rustig':360,'Roeien 5–6 min':null,'40 s':40,'20 s':20,'30 s':30,'1 min':60,'3–5 min':300,'45 sec':45,'2 minuten':120,'90 seconden':90,'1:30 min':90,'5 min':300};
const no=['10','8/been','8 per been','20 m','2× 20 m','2× 15 m','10 per kant','8–10','10 reps','2× 20 s','5× 4 min / 2 min dribbel','10 reps · 30 s rust','400 m','1 km','15','30 s per kant','1 min per been','1:30'];
let n=0;for(const [t,v] of Object.entries(yes)){assert.strictEqual(parseDur(t),v,t);n++}
for(const t of no){assert.strictEqual(parseDur(t),null,t);n++}
// items: alleen eigen reps-tekst telt, blok-duur lekt niet
assert.strictEqual(itemDur({exercise:'Squats',reps:'10'}),null);
assert.strictEqual(itemDur({exercise:'Lunges',reps:'8/been'}),null);
assert.strictEqual(itemDur({exercise:'Farmer carry',reps:'20 m',load_range:[20,24]}),null);
assert.strictEqual(itemDur({exercise:'Wall balls',reps:'10'}),null);
assert.strictEqual(itemDur({exercise:'Plank',reps:'40 s'}),40);
assert.strictEqual(itemDur({exercise:'Suitcase hold',reps:'20 s'}),20);
assert.strictEqual(itemDur({exercise:'Roeien',reps:'5–6 min'}),360);
assert.strictEqual(itemDur({exercise:'Rekken',reps:'3–5 min'}),300);
assert.strictEqual(itemDur({exercise:'X',reps:'10',duration_sec:30}),30);
// echte data: alleen tijd-items krijgen een timer
const W=require('../workouts.json');const got=[];for(const w of W)for(const b of w.blocks||[])for(const i of b.items)if(itemDur(i))got.push(i.exercise);
assert.deepStrictEqual(got,['Roeien/fietsen','Heupen openen','Armzwaaien','Rustig fietsen/wandelen','Rekken heupen, hamstrings, kuiten','Zone 2 lopen','Wandelen','Mobility']);
console.log('OK',n+10,'tests');
