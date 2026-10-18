const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('dist/game.js','utf8');const context={};vm.createContext(context);vm.runInContext(source.split('const RigDataModel=')[0]+';globalThis.models={MathModel,PhysicsModel};',context);const {MathModel:M,PhysicsModel:P}=context.models;
let scenarios=0;
for(const config of [{},{volatility:'low'},{volatility:'high'},{customWeights:[12,7,25,23,12,4,2,1,1,1,1]}]){
 const math=M.buildMath(config),counts={};let total=0;
 for(let t=0;t<M.TICKETS;t++){const o=M.outcomeForTicket(math,t);counts[o.kind]=(counts[o.kind]||0)+1;total+=o.multiplier;}
 assert.equal(total,math.returnUnits);assert.equal((counts.water||0)+(counts.icicle||0),math.outcomes[1].weight);assert.ok(Math.abs((counts.water||0)-(counts.icicle||0))<=1);assert.equal(counts.dead,math.outcomes[0].weight);
}
for(const seed of [1,2,23,42,365,20260923,4294967295])for(const kind of ['icicle','water','dead','win']){
 const r=new P.Round(seed,1,{},0,{kind,multiplier:kind==='win'?5:0});let settlements=0,catches=0,anchor=null;
 while(r.state!=='settled'){
  r.step();for(const e of r.events.splice(0)){if(e.type==='settle')settlements++;if(e.type==='icicle'){catches++;anchor={...r.p};assert.equal(r.score,0);}}
  if(r.state==='caught'){assert.equal(r.p.x,anchor.x);assert.equal(r.p.y,anchor.y);assert.equal(r.p.vx,0);assert.equal(r.p.vy,0);}
 }
 r.step();assert.equal(r.events.length,0);assert.equal(settlements,1);assert.equal(r.payout,kind==='win'?5:0);assert.equal(r.terminalCause,kind==='win'?'ice':kind);
 if(kind==='icicle'){assert.equal(catches,1);assert.equal(r.obstacles[0].type,'icicle');assert.ok(r.obstacles[0].used);assert.equal(r.score,0);assert.ok(r.book.frames.some(f=>f.state==='flight'));}
 scenarios++;
}
// Natural paid draw reaches the new hazard without fixture forcing.
const math=M.buildMath(),ticket=math.outcomes[1].upper-1,r=new P.Round(42,2,{},ticket);while(r.state!=='settled')r.step();assert.equal(r.terminalCause,'icicle');assert.equal(r.payoutCents,0);
const forced=new P.Round(42,1,{},0,{kind:'icicle',multiplier:100});while(forced.state!=='settled')forced.step();assert.equal(forced.payoutCents,0);
const manifest=JSON.parse(fs.readFileSync('dist/journey-manifest.json'));const ids=manifest.screens.map(s=>s.id);assert.equal(new Set(ids).size,ids.length);assert.ok(ids.includes('icicle'));manifest.flows.forEach(f=>f.steps.forEach(s=>assert.ok(ids.includes(s))));
console.log(JSON.stringify({passed:true,roundScenarios:scenarios+2,exhaustiveTicketProfiles:4,defaultRtp:math.rtp,icicleTickets:Math.floor(math.outcomes[1].weight/2),previewCatalogue:ids.length}));
