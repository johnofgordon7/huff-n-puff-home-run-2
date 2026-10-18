const MathModel=(()=>{
const TICKETS=10000;
const MAX_MULTIPLIER=100;
const DEFAULT_CONFIG=Object.freeze({rtp:97,deadSpin:12,volatility:'medium',gravity:720,lift:650,drop:540});
const profiles={
 low:[[.5,4000],[1,2800],[2,1400],[3,350],[5,130],[10,20],[20,5],[50,2],[100,0]],
 medium:[[.5,2500],[1,2300],[2,1200],[3,400],[5,200],[10,90],[20,20],[50,3],[100,1]],
 high:[[.5,800],[1,2200],[2,500],[3,200],[5,140],[10,120],[20,80],[50,24],[100,8]]
};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function buildMath(input={}){
 const config={...DEFAULT_CONFIG,...input};
 if(!profiles[config.volatility])throw Error('Unknown volatility profile');
 if(!config.customWeights&&(!Number.isFinite(+config.rtp)||+config.rtp<80||+config.rtp>99.99))throw Error('RTP must be between 80.00% and 99.99%.');
 config.rtp=Math.round(+config.rtp*100)/100;
 for(const [key,lo,hi] of [['gravity',500,1000],['lift',450,900],['drop',350,800]]){
  if(!Number.isFinite(+config[key]))throw Error('Invalid '+key);config[key]=clamp(Math.round(+config[key]),lo,hi);
 }
 if(config.customWeights){
  const weights=config.customWeights;
  if(!Array.isArray(weights)||weights.length!==11||weights.some(w=>!Number.isSafeInteger(w)||w<0||w>1000000000))throw Error('Use whole-number weights from 0 to 1,000,000,000.');
  const total=weights.reduce((a,b)=>a+b,0);if(!total)throw Error('Give at least one outcome a weight above zero.');
  const shares=weights.map(w=>w/total*TICKETS),tickets=shares.map(Math.floor);
  const order=shares.map((n,i)=>({i,f:n-tickets[i]})).sort((a,b)=>b.f-a.f||a.i-b.i);
  for(let n=TICKETS-tickets.reduce((a,b)=>a+b,0),i=0;i<n;i++)tickets[order[i].i]++;
  let upper=0;
  const outcomes=[0,0,...profiles.medium.map(x=>x[0])].map((multiplier,i)=>{const lower=upper;upper+=tickets[i];return {kind:i===0?'dead':i===1?'water':'win',multiplier,weight:tickets[i],lower,upper};});
  const totalReturn=outcomes.reduce((n,o)=>n+o.weight*o.multiplier,0),mean=totalReturn/TICKETS,lossTickets=tickets[0]+tickets[1];
  config.customWeights=[...weights];config.rtp=mean*100;config.deadSpin=tickets[0]/100;
  return {config,outcomes,totalTickets:TICKETS,returnUnits:totalReturn,rtp:mean*100,lossTickets,hitRate:(TICKETS-lossTickets)/100,profitRate:outcomes.filter(o=>o.multiplier>1).reduce((n,o)=>n+o.weight,0)/100,sd:Math.sqrt(outcomes.reduce((n,o)=>n+o.weight*(o.multiplier-mean)**2,0)/TICKETS),maxMultiplier:MAX_MULTIPLIER};
 }
 const buckets=profiles[config.volatility].map(([multiplier,weight])=>({kind:'win',multiplier,weight}));
 const targetReturn=Math.round(config.rtp*100),otherReturn=buckets.reduce((s,b)=>s+(b.multiplier===1?0:b.multiplier*b.weight),0);
 buckets.find(b=>b.multiplier===1).weight=targetReturn-otherReturn;
 const lossTickets=TICKETS-buckets.reduce((s,b)=>s+b.weight,0);
 if(lossTickets<0||buckets.some(b=>b.weight<0||!Number.isInteger(b.weight)))throw Error('Invalid outcome weights');
 if(!Number.isFinite(+config.deadSpin))throw Error('Invalid dead spin rate');
 const dead=Math.min(lossTickets,Math.max(0,Math.round(+config.deadSpin*100)));
 config.deadSpin=dead/100;
 const water=lossTickets-dead;
 const outcomes=[{kind:'dead',multiplier:0,weight:dead},{kind:'water',multiplier:0,weight:water},...buckets];
 let upper=0;for(const o of outcomes){o.lower=upper;upper+=o.weight;o.upper=upper;}
 const totalReturn=outcomes.reduce((s,o)=>s+o.weight*o.multiplier,0);
 if(upper!==TICKETS||totalReturn!==targetReturn)throw Error('RTP reconciliation failed');
 const mean=totalReturn/TICKETS,variance=outcomes.reduce((s,o)=>s+o.weight*(o.multiplier-mean)**2,0)/TICKETS;
 return {config,outcomes,totalTickets:TICKETS,returnUnits:totalReturn,rtp:mean*100,lossTickets,hitRate:100*(TICKETS-lossTickets)/TICKETS,profitRate:outcomes.filter(o=>o.multiplier>1).reduce((s,o)=>s+o.weight,0)/100,sd:Math.sqrt(variance),maxMultiplier:MAX_MULTIPLIER};
}
function outcomeForTicket(math,ticket){
 if(!Number.isInteger(ticket)||ticket<0||ticket>=TICKETS)throw Error('Invalid ticket');
 const outcome=math.outcomes.find(o=>ticket<o.upper);
 // Share the existing zero-return flight bucket; never change payout weights.
 const kind=outcome.kind==='water'&&ticket-outcome.lower>=Math.ceil(outcome.weight/2)?'icicle':outcome.kind;
 return {...outcome,kind,ticket};
}
function uniformTicket(cryptoSource=globalThis.crypto){
 const limit=Math.floor(4294967296/TICKETS)*TICKETS,a=new Uint32Array(1);do{cryptoSource.getRandomValues(a);}while(a[0]>=limit);return a[0]%TICKETS;
}
function payoutCents(stakeCents,multiplier){
 if(!Number.isInteger(stakeCents)||stakeCents<10||stakeCents%10!==0)throw Error('Stake must use ten-cent increments');
 const payout=stakeCents*multiplier;if(!Number.isInteger(payout))throw Error('Fractional-cent payout');return payout;
}

return {buildMath,outcomeForTicket,uniformTicket,payoutCents,TICKETS,MAX_MULTIPLIER,DEFAULT_CONFIG};
})();
const PhysicsModel=(()=>{
const {buildMath,outcomeForTicket,payoutCents}=MathModel;
const GROUND=620,STEP=1/120;
function random(seed){let s=seed>>>0;return ()=>{s+=0x6D2B79F5;let t=Math.imul(s^s>>>15,1|s);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;};}
function applyPickup(value,type,n){return type==='add'?value+n:type==='multiply'?value*n:type==='bird'?value/2:value;}
function advanceAir(p,dt,c){const speed=Math.hypot(p.vx,p.vy);p.vx-=p.vx*speed*.000017*dt;p.vy+=(c.gravity-p.vy*speed*.000004)*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;}
function pickupImpulse(p,type,config){
 if(type==='bird'||type==='dynamite'){p.vy=Math.max(config.drop,p.vy+config.drop*.75);p.vx*=.965;p.omega+=2.4;}
 else{p.vy=-config.lift;p.vx=Math.max(1180,p.vx*1.012);p.omega-=1.5;}
}
function buildField(rng){
 const items=[],bins=new Map(),cell=150;
 const add=o=>{o.id=items.length+1;o.phase=rng()*Math.PI*2;items.push(o);const k=Math.floor(o.x/cell)+','+Math.floor(o.y/cell);if(!bins.has(k))bins.set(k,[]);bins.get(k).push(o);};
 // Reserve one opening encounter before distributing the rest of the field.
 add({x:1250+rng()*100,y:447+rng()*24,type:'add',value:2,hit:false});
 // Irregular world-space distribution, generated before the flight. No path mask.
 for(let attempt=0;attempt<1300&&items.length<440;attempt++){
  const x=1000+rng()*25000,y=-1550+rng()*2050,cx=Math.floor(x/cell),cy=Math.floor(y/cell);let crowded=false;
  for(let ix=cx-1;ix<=cx+1;ix++)for(let iy=cy-1;iy<=cy+1;iy++)if(bins.get(ix+','+iy)?.some(o=>(o.x-x)**2+(o.y-y)**2<135**2))crowded=true;
  if(crowded)continue;const type=rng()<.19?'bird':rng()<.34?'multiply':'add';
  add({x,y,type,value:type==='bird'?2:type==='multiply'?[2,3,4,5][Math.floor(rng()*4)]:[1,2,5,10][Math.floor(rng()*4)],hit:false});
 }
 return items;
}
function solveOperations(hits,target,rng){
 const halves=hits.filter(o=>o.type==='bird').length,unit=2**halves;
 const choices=hits.map(o=>o.type==='bird'?null:[['add',1],['add',2],['add',5],['add',10],['multiply',2],['multiply',3],['multiply',4],['multiply',5]].map(o=>({o,key:rng()})).sort((a,b)=>a.key-b.key).map(x=>x.o));
 const failed=new Set();let visits=0;
 function solve(i,value,needMultiply=0){
  if(i<0)return value===0&&needMultiply===0?[]:null;
  if(value<0||value>2000*unit||!Number.isInteger(value)||visits++>70000)return null;
  const key=i+':'+value+':'+needMultiply;if(failed.has(key))return null;
  if(hits[i].type==='bird'){const prev=solve(i-1,value*2,needMultiply);if(prev)return [...prev,['bird',2]];}
  else for(const [type,n] of choices[i]){
   if(i===0&&type!=='add')continue;
   const previous=type==='add'?value-n*unit:value/n;
   if(previous<=0&&i>0)continue;
   const prev=solve(i-1,previous,Math.max(0,needMultiply-(type==='multiply'?1:0)));if(prev)return [...prev,[type,n]];
  }
  failed.add(key);return null;
 }
 const diverse=solve(hits.length-1,target*unit,hits.length-halves>=4?1:0);
 if(diverse)return diverse;visits=0;return solve(hits.length-1,target*unit,0);
}
function distanceToSegment(x,y,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a.x-t*dx,y-a.y-t*dy);}
function simulateWorld(seed,outcome,config){
 const rng=random(seed),pickups=outcome.kind==='dead'?[]:buildField(rng),frames=[],obstacles=[],hits=[],bins=new Map();
 for(const item of pickups){const cell=Math.floor(item.x/200);if(!bins.has(cell))bins.set(cell,[]);bins.get(cell).push(item);}
 let p={x:645,y:210,vx:0,vy:0,angle:0,omega:0},state='windup',time=0,flightTime=0,bounces=0,endTime=0,cause='',contactTime=null;
 function finish(reason,events){state='settled';cause=reason;p.vx=0;p.vy=0;events.push({type:'settle',cause:reason});}
 for(let tick=1;tick<4200&&state!=='settled';tick++){
  time=tick*STEP;const events=[];
  if(state==='windup'){
   if(outcome.kind==='dead'){const t=Math.min(1,time/.92);p.x=645+Math.sin(t*Math.PI)*38;p.y=210-Math.sin(t*Math.PI)*68;p.angle=Math.sin(t*Math.PI)*-.32;if(time>=.92){p.x=645;p.y=210;p.angle=0;events.push({type:'miss'});finish('dead',events);}}
   else{const t=Math.max(0,time-.15);p.x=645+166*t;p.y=210-222*t+676*t*t;p.angle=t*.7;if(time>=.92){state='flight';p={x:773,y:440,vx:1580+rng()*130,vy:-90,angle:-.08,omega:-.6};events.push({type:'strike'});}}
  }else{
   flightTime+=STEP;
   if(state==='sinking'){p.vy+=520*STEP;p.x+=p.vx*STEP;p.y+=p.vy*STEP;p.vx*=Math.exp(-5*STEP);p.angle+=p.omega*STEP;if(time-endTime>.7)finish('water',events);}
   else if(state==='caught'){p.vx=0;p.vy=0;p.omega=0;p.angle=.28+Math.sin((time-endTime)*20)*.18*Math.exp(-(time-endTime)*5);if(time-endTime>.9)finish('icicle',events);}
   else if(state==='crash'){p.vy+=830*STEP;p.x+=p.vx*STEP;p.y=Math.min(GROUND-32,p.y+p.vy*STEP);p.vx*=Math.exp(-4*STEP);p.angle+=p.omega*STEP;if(time-endTime>.75)finish('rock',events);}
   else if(state==='flight'){
    const previous={...p};advanceAir(p,STEP,config);
    // Every visible item participates in the same swept collision query.
    for(let cell=Math.floor((previous.x-52)/200);cell<=Math.floor((p.x+52)/200);cell++)for(const item of bins.get(cell)||[]){
     if(item.hit||distanceToSegment(item.x,item.y,previous,p)>52)continue;
     item.hit=true;item.hitTick=tick;hits.push(item);const beforeVy=p.vy;pickupImpulse(p,item.type,config);
     events.push({type:'contact',itemId:item.id,x:item.x,y:item.y,beforeVy,afterVy:p.vy});
    }
    const surface=['icicle','rock'].includes(outcome.kind)?GROUND-100:GROUND-40;
    if(outcome.kind!=='win'&&p.vy>0&&p.y>=surface){
     contactTime=time;endTime=time;cause=outcome.kind;const o={id:pickups.length+1,type:outcome.kind==='water'?'hole':outcome.kind==='icicle'?'icicle':'rock',x:p.x+25,y:GROUND,used:true,hitTick:tick,hitTime:time};obstacles.push(o);
     if(cause==='icicle'){state='caught';p.y=surface;p.vx=0;p.vy=0;p.omega=0;events.push({type:'icicle',x:p.x,y:p.y,obstacleId:o.id});}
     else if(cause==='water'){state='sinking';p.vy=140;p.vx*=.22;p.omega=2.7;events.push({type:'splash',x:p.x,y:GROUND,obstacleId:o.id});}
     else{state='crash';p.vx=-Math.max(80,p.vx*.12);p.vy=85;p.omega=-6;events.push({type:'rock',x:p.x,y:p.y,obstacleId:o.id});}
    }else if(p.y>=GROUND-34){
     contactTime??=time;p.y=GROUND-34;const impact=p.vy;
     if(impact>220&&bounces<2){p.vy=-impact*(bounces===0?.24:.16);p.vx*=.69;p.omega+=impact*.005;bounces++;events.push({type:'bounce',x:p.x,y:GROUND,impact});}
     else{state='slide';p.vy=0;p.omega=0;events.push({type:'slide',x:p.x,y:GROUND});}
    }
   }else if(state==='slide'){p.vx=Math.max(0,p.vx-(140+.0015*p.vx*p.vx)*STEP);p.x+=p.vx*STEP;p.y=GROUND-34;p.vy=0;if(p.vx<15)finish('ice',events);}
   if(state==='flight'||state==='slide'){const target=state==='slide'?0:Math.atan2(p.vy,p.vx)*.7,delta=Math.atan2(Math.sin(target-p.angle),Math.cos(target-p.angle));p.omega+=(delta*24-p.omega*4.7)*STEP;p.angle+=p.omega*STEP;}
  }
  frames.push({tick,time,flightTime,state,p:{...p},events});
 }
 return {frames,pickups,obstacles,hits,cause,contactTime,state,distance:Math.max(0,Math.round((p.x-645)/45))};
}
function compileRoute(seed,outcome,config){
 if(!['dead','water','icicle','rock','win'].includes(outcome.kind))throw Error('Unsupported outcome');
 for(let attempt=0;attempt<160;attempt++){
  const sceneSeed=(seed+Math.imul(attempt,2654435761))>>>0,book=simulateWorld(sceneSeed,outcome,config),rng=random(sceneSeed^0xa531f49);
  if(book.state!=='settled')continue;
  if(outcome.kind!=='dead'&&(book.hits.length<(attempt<60?5:2)||book.hits.length>20||book.contactTime<(attempt<60?4.5:2)||book.contactTime>17))continue;
  const target=outcome.kind==='win'?outcome.multiplier:[.5,1,2,3,5,10][Math.floor(rng()*6)];
  const operations=outcome.kind==='dead'?[]:solveOperations(book.hits,target,rng);if(!operations)continue;
  book.hits.forEach((item,i)=>{[item.type,item.value]=operations[i];});
  let score=0;const history=[];const byId=new Map(book.pickups.map(o=>[o.id,o]));
  for(const frame of book.frames){
   const events=[];
   for(const event of frame.events){
    if(event.type!=='contact'){events.push(event);if(event.type==='icicle'){score=0;events.push({type:'score',score:0});}continue;}
    const item=byId.get(event.itemId);score=applyPickup(score,item.type,item.value);history.push({type:item.type,value:item.value,time:frame.time});
    events.push({...event,type:item.type==='bird'?'bird':'pickup',multiplied:item.type==='multiply',value:item.value});events.push({type:'score',score,itemType:item.type,value:item.value});
   }
   frame.events=events;frame.score=score;frame.historyCount=history.length;
  }
  if(outcome.kind==='win'&&score!==outcome.multiplier)throw Error('Visual payout reconciliation failed');
  return {...book,history,score,attempts:attempt+1};
 }
 throw Error('Could not compile a matching flight');
}
class Round{
 constructor(seed=1,stake=1,config={},ticket=0,forced=null){
  this.math=buildMath(config);this.config=Object.freeze({...this.math.config});this.outcome=forced?{...forced,ticket:null}:outcomeForTicket(this.math,ticket);this.seed=seed;this.stake=stake;this.stakeCents=Math.round(stake*100);payoutCents(this.stakeCents,this.outcome.multiplier);
  if(this.outcome.kind==='icicle')this.outcome={...this.outcome,multiplier:0};
  if(this.outcome.kind==='rock')this.outcome={...this.outcome,kind:'water'};
  this.book=compileRoute(seed,this.outcome,this.config);this.state='windup';this.time=0;this.flightTime=0;this.score=0;this.events=[];this.history=[];this.tick=0;this.distance=0;this.terminalCause='';this.p={x:645,y:210,vx:0,vy:0,angle:0,omega:0};this.previous={...this.p};
  this.pickups=this.book.pickups.map(o=>({...o,hit:false}));this.obstacles=this.book.obstacles.map(o=>({...o,used:false,hitTime:undefined}));this.payout=0;this.payoutCents=0;
 }
 step(dt=STEP){
  if(this.state==='settled')return;if(Math.abs(dt-STEP)>1e-9)throw Error('Use the fixed physics timestep');
  const f=this.book.frames[this.tick++];if(!f)throw Error('Missing physics frame');
  this.previous={...this.p};this.p={...f.p};this.state=f.state;this.time=f.time;this.flightTime=f.flightTime;this.score=f.score;this.history=this.book.history.slice(0,f.historyCount);this.distance=Math.max(0,Math.round((this.p.x-645)/45));
  for(const e of f.events){
   if(e.itemId){const item=this.pickups.find(p=>p.id===e.itemId);if(item)item.hit=true;}
   if(e.obstacleId){const o=this.obstacles.find(o=>o.id===e.obstacleId);if(o){o.used=true;o.hitTime=this.time;}}
   if(e.type==='settle'){this.terminalCause=e.cause;this.payoutCents=payoutCents(this.stakeCents,this.outcome.multiplier);this.payout=this.payoutCents/100;this.events.push({...e,payout:this.payout,multiplier:this.outcome.multiplier,distance:this.distance});}
   else this.events.push({...e});
  }
 }
}

return {random,applyPickup,advanceAir,pickupImpulse,Round,GROUND,STEP};
})();
const RigDataModel=(()=>{
const RIG_PARTS={"body":{"rect":[0,0,232,232],"box":[528,1068,464,463]},"chest":{"rect":[236,0,147,177],"box":[735,1056,293,353]},"neck":{"rect":[387,0,136,178],"box":[717,756,271,356]},"face":{"rect":[527,0,179,167],"box":[603,519,357,334]},"eye-r":{"rect":[710,0,96,109],"box":[614,595,191,218]},"eye-l":{"rect":[810,0,67,99],"box":[833,556,134,198]},"pupil":{"rect":[881,0,25,25],"box":[885,582,49,50]},"wattle-l":{"rect":[910,0,48,83],"box":[837,755,96,166]},"wattle-r":{"rect":[962,0,43,88],"box":[794,755,85,176]},"hair-04":{"rect":[0,236,89,41],"box":[508,470,178,81]},"hair-05":{"rect":[93,236,90,78],"box":[524,532,179,155]},"hair-03":{"rect":[187,236,47,93],"box":[630,349,93,186]},"hair-02":{"rect":[238,236,92,66],"box":[694,399,183,132]},"hair-01-b":{"rect":[334,236,78,43],"box":[676,466,155,86]},"hair-01-f":{"rect":[416,236,56,68],"box":[763,473,112,136]},"mouth":{"rect":[476,236,51,103],"box":[830,662,102,205]},"beak-bot-02":{"rect":[531,236,36,33],"box":[874,820,71,66]},"beak-top":{"rect":[571,236,43,44],"box":[829,615,86,88]},"wing-l-03":{"rect":[618,236,107,214],"box":[948,834,214,428]},"wing-r-01":{"rect":[729,236,124,109],"box":[499,1149,248,217]},"wing-r-02":{"rect":[0,454,219,269],"box":[297,775,438,537]},"wing-r-04":{"rect":[223,454,179,66],"box":[381,1176,357,132]},"tail-03":{"rect":[406,454,31,76],"box":[568,950,61,151]},"tail-01":{"rect":[441,454,72,59],"box":[438,989,143,118]},"tail-02":{"rect":[517,454,68,105],"box":[452,892,135,209]},"leg-up-l":{"rect":[589,454,94,78],"box":[672,1441,188,155]},"leg-low-l":{"rect":[687,454,35,74],"box":[698,1587,69,148]},"leg-up-r":{"rect":[726,454,86,85],"box":[630,1443,172,169]},"leg-low-r":{"rect":[816,454,35,74],"box":[673,1598,69,148]},"foot-l":{"rect":[855,454,36,31],"box":[716,1721,71,62]},"foot-r":{"rect":[895,454,38,34],"box":[687,1735,75,67]},"toe-l-b":{"rect":[937,454,25,13],"box":[678,1729,49,26]},"toe-l-01":{"rect":[966,454,53,30],"box":[751,1754,106,59]},"toe-l-02":{"rect":[0,727,55,19],"box":[768,1744,109,38]},"toe-l-03":{"rect":[59,727,52,15],"box":[768,1732,104,29]},"toe-r-b":{"rect":[115,727,24,19],"box":[658,1732,48,37]},"toe-r-01":{"rect":[143,727,21,48],"box":[707,1775,42,96]},"toe-r-02":{"rect":[168,727,42,41],"box":[724,1774,84,81]},"toe-r-03":{"rect":[214,727,50,34],"box":[744,1762,100,67]},"eye-closed-l":{"rect":[268,727,67,99],"box":[833,556,134,198]},"eye-closed-r":{"rect":[339,727,96,109],"box":[614,595,191,218]}};

return {RIG_PARTS};
})();
// Curves distilled from the supplied win/lose animatics. These only affect drawing.
const ReferenceMotionModel=(()=>{
 const cap=t=>Math.max(0,Math.min(1,t)),ease=t=>{t=cap(t);return t*t*(3-2*t);};
 const curve=(keys,time)=>{if(time<=keys[0][0])return keys[0][1];for(let i=1;i<keys.length;i++){const [t,b]=keys[i],[start,a]=keys[i-1];if(time<=t)return a+(b-a)*ease((time-start)/(t-start));}return keys.at(-1)[1];};
 const blend=(from,to,t)=>Array.from({length:6},(_,i)=>(i===from?1-ease(t):0)+(i===to?ease(t):0));
 // With the shared 0.8 playback pace, the turn lasts 450ms and the dip 575ms.
 const BIRD_DURATION=.36,RECOVERY_DURATION=.8,SUBMERGE_DURATION=.46;
 function batter(phase,miss,elapsed,reduced=false){
  if(phase<0)return {index:0,lean:0,shift:0,stretch:1};
  const anticipation=ease((phase-.12)/.64),swing=ease((phase-.76)/.16);
  if(reduced)return {index:phase<.92?0:miss?3:2,lean:0,shift:0,stretch:1};
  if(phase<.76)return {index:phase<.16?0:1,lean:-.08*anticipation,shift:-14*anticipation,stretch:1-.065*anticipation};
  if(phase<.92)return {index:swing<.65?1:2,lean:-.08+.19*swing,shift:-14+39*swing,stretch:.935+.11*swing};
  const recoil=Math.exp(-Math.max(0,elapsed)*7);
  return {index:miss&&elapsed>.2?3:2,lean:.11*recoil,shift:25*recoil,stretch:1+.045*recoil};
 }
 function impact(age,kind){
  const strike=kind==='strike',positive=strike||kind==='pickup'||kind==='multiply';
  if(!positive)return {scaleX:1,scaleY:1};
  const compression=curve([[0,strike?.20:.08],[.04,.07],[.115,strike?-.18:-.09],[.17,-.03],[.26,0]],age);
  return {scaleX:1-compression,scaleY:1+compression*.48};
 }
 const birdTurn=age=>Math.PI*2*ease(age/BIRD_DURATION);
 function recovery(age,reduced=false){
  if(reduced)return {weights:[0,0,0,0,0,1],angle:0,offsetY:0,compression:0};
  const t=Math.max(0,age),weights=t<.26?blend(3,4,(t-.06)/.20):blend(4,5,(t-.28)/.26);
  return {weights,angle:curve([[0,0],[.16,-.28],[.30,.20],[.54,-.035],[.8,0]],t),offsetY:curve([[0,0],[.36,0],[.51,-26],[.65,0],[.72,-4],[.8,0]],t),compression:curve([[0,.16],[.18,.26],[.38,.10],[.52,-.05],[.66,.08],[.8,0]],t)};
 }
 function water(age,reduced=false){
  const t=Math.max(0,age),dip=ease(t/SUBMERGE_DURATION);
  return {visible:!reduced&&t<SUBMERGE_DURATION,offsetY:-32+dip*135,angle:curve([[0,.58],[.18,.93],[SUBMERGE_DURATION,1.22]],t),scaleX:1-.12*Math.sin(Math.PI*dip),scaleY:.84-.10*Math.sin(Math.PI*dip),opacity:1-ease((t-(SUBMERGE_DURATION-.15))/.15),crown:reduced?0:curve([[0,0],[.16,0],[.36,1],[.60,.65],[1,0]],t),ripple:reduced?0:cap((t-.06)/1.1),rippleAlpha:reduced?0:curve([[0,0],[.08,.65],[.45,.40],[1.15,0]],t)};
 }
 const resultDelay=(cause,payout,reduced=false)=>cause==='ice'&&payout>0&&!reduced?RECOVERY_DURATION:0;
 function captionY(base,top,ceiling,previous,dt,reduced=false){const target=Math.min(base,ceiling-44),current=Number.isFinite(previous)?previous:base,next=current+(target-current)*(reduced?1:1-Math.exp(-16*Math.max(0,dt)));return Math.min(base,top-28,next);}
 return {batter,impact,birdTurn,recovery,water,resultDelay,captionY,BIRD_DURATION,RECOVERY_DURATION,SUBMERGE_DURATION};
})();
const ChickenRigModel=(()=>{
const {RIG_PARTS}=RigDataModel;
const cap=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,t)=>a+(b-a)*t;
class ChickenRig{
 constructor(){this.reset();}
 reset(){this.time=0;this.flap=0;this.energy=0;this.blinkKick=0;this.lastVy=0;this.state='idle';this.groundScoreY=null;this.groundScoreClock=0;this.joints={neck:{x:0,v:0},head:{x:0,v:0},stretch:{x:1,v:0},body:{x:0,v:0},comb:{x:0,v:0},legs:{x:0,v:0},jaw:{x:0,v:0}};}
 spring(name,target,k,dt){const j=this.joints[name];j.v+=((target-j.x)*k-j.v*Math.sqrt(k)*1.55)*dt;j.x+=j.v*dt;}
 impulse(type){
  const sign=type==='bird'?-1:1;
  if(type==='strike'||type==='pickup'||type==='bird'){
   this.joints.neck.v+=sign*5;this.joints.head.v-=sign*9;this.joints.stretch.v+=type==='strike'?4:2;this.joints.comb.v-=sign*9;this.joints.legs.v-=sign*5;this.joints.body.v-=3;this.joints.jaw.v+=4;this.energy=1;
  }
  if(type==='bounce'||type==='rock'||type==='splash'){
   this.joints.body.v+=8;this.joints.neck.v-=8;this.joints.head.v+=12;this.joints.stretch.v-=5;this.joints.legs.v+=8;this.joints.comb.v+=15;this.blinkKick=.19;this.energy=1;
  }
  if(type==='miss'){this.joints.neck.v=3;this.joints.head.v=-6;this.joints.comb.v=6;this.blinkKick=.15;}
 }
 step(dt,p=null,state='idle'){
  this.time+=dt;this.state=state;this.energy=Math.max(0,this.energy-dt*1.6);this.blinkKick=Math.max(0,this.blinkKick-dt);
  const flight=state==='flight',slide=state==='slide',dead=state==='crash'||state==='caught'||state==='sinking',vy=p?.vy||0;
  const falling=cap(vy/650,-1,1),panic=flight?cap((vy-50)/750,0,1):0;
  this.flap+=dt*(flight?15+panic*15+this.energy*7:2.2);
  this.spring('neck',flight?-.12-falling*.16:slide?.3:dead?-.4:Math.sin(this.time*1.7)*.04,80,dt);
  this.spring('head',flight?-.7+falling*.2:slide?-.88:dead?.4:Math.sin(this.time*1.2+.4)*.06,58,dt);
  this.spring('stretch',flight?.84+panic*.13:slide?.7:dead?.76:state==='windup'?.94:1+Math.sin(this.time*2)*.012,95,dt);
  this.spring('body',slide?.26:dead?.35:flight?Math.sin(this.flap*2)*.012:Math.sin(this.time*2)*.014,105,dt);
  this.spring('comb',flight?falling*.12:Math.sin(this.time*2.5)*.025,48,dt);
  this.spring('legs',flight?-.3+falling*.3:slide?.9:dead?-.6:0,45,dt);
  this.spring('jaw',flight?.65+panic*.25:dead?.85:slide?.45:.15+Math.sin(this.time*1.9)*.12,90,dt);
  this.lastVy=vy;
 }
}
function drawRigPart(ctx,atlas,name,alpha=1){
 const p=RIG_PARTS[name];if(!p||!atlas||alpha<=.001)return;ctx.save();ctx.globalAlpha*=alpha;ctx.drawImage(atlas,...p.rect,...p.box);ctx.restore();
}
function bone(ctx,x,y,angle,draw,sx=1,sy=1){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.scale(sx,sy);ctx.translate(-x,-y);draw();ctx.restore();}
function neckPoint(x,y,angle,stretch){
 const t=(1112-y)/356,a=angle*t;
 const centerX=860-10*t-(Math.abs(angle)>.0001?356*stretch*(1-Math.cos(a))/angle:0);
 const centerY=1112-(Math.abs(angle)>.0001?356*stretch*Math.sin(a)/angle:356*stretch*t);
 const dx=x-(860-10*t);return {x:centerX+dx*Math.cos(a),y:centerY+dx*Math.sin(a)};
}
function drawNeck(ctx,atlas,angle,stretch){
 const part=RIG_PARTS.neck,[ax,ay,aw,ah]=part.rect,[bx,by,bw,bh]=part.box;
 // 18 connected texture strips form a bending, stretching neck mesh.
 const strips=18;
 for(let i=0;i<strips;i++){
  const t=(i+.5)/strips,sy=by+bh*t,center=neckPoint(bx+bw/2,sy,angle,stretch),rotation=angle*(1112-sy)/356;
  ctx.save();ctx.translate(center.x,center.y);ctx.rotate(rotation);
  ctx.drawImage(atlas,ax,ay+ah*i/strips,aw,Math.min(ah/strips+1,ah-ah*i/strips),-bw/2,-bh/strips*stretch/2,bw,bh/strips*stretch+2);ctx.restore();
 }
}
function drawFlightMesh(ctx,sprite,w,h,m){
 const cols=8,rows=6,vertices=[];
 const weight=(u,v,x,y,sx,sy)=>Math.exp(-(((u-x)/sx)**2+((v-y)/sy)**2));
 for(let row=0;row<=rows;row++)for(let col=0;col<=cols;col++){
  const u=col/cols,v=row/rows,wing=weight(u,v,.83,.78,.22,.18),feet=weight(u,v,.10,.65,.19,.28),head=weight(u,v,.69,.26,.25,.30);
  vertices.push({sx:u*w,sy:v*h,x:u*w+feet*m.feet*w*.14+head*m.head*w*.045,y:v*h+wing*m.wing*h*.75+feet*m.feet*h*.6+head*m.head*h*.4});
 }
 const triangle=(a,b,c)=>{
  const sx1=b.sx-a.sx,sy1=b.sy-a.sy,sx2=c.sx-a.sx,sy2=c.sy-a.sy,det=sx1*sy2-sx2*sy1;
  const dx1=b.x-a.x,dy1=b.y-a.y,dx2=c.x-a.x,dy2=c.y-a.y,A=(dx1*sy2-dx2*sy1)/det,B=(dy1*sy2-dy2*sy1)/det,C=(dx2*sx1-dx1*sx2)/det,D=(dy2*sx1-dy1*sx2)/det;
  ctx.save();ctx.beginPath();const cx=(a.x+b.x+c.x)/3,cy=(a.y+b.y+c.y)/3;for(const [i,v] of [a,b,c].entries()){const dx=v.x-cx,dy=v.y-cy,len=Math.hypot(dx,dy)||1;ctx[i?'lineTo':'moveTo'](v.x+dx/len*.35,v.y+dy/len*.35);}ctx.closePath();ctx.clip();ctx.transform(A,B,C,D,a.x-A*a.sx-C*a.sy,a.y-B*a.sx-D*a.sy);ctx.drawImage(sprite,0,0,w,h);ctx.restore();
 };
 ctx.save();ctx.translate(-w/2,-h/2);
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const i=row*(cols+1)+col,a=vertices[i],b=vertices[i+1],c=vertices[i+cols+1],d=vertices[i+cols+2];triangle(a,b,d);triangle(a,d,c);}ctx.restore();
}
function drawChicken(ctx,art,x,y,angle,size,phase,clock,squash=0,rig=null,poseMotion=null){
 const poses=art.penguPoses;if(!poses)return;const idle=phase==='idle'&&art.idleActive&&!art.reduced;
 const style=art.pigStyle||{scale:1,spring:1,settle:18,bob:0};size*=style.scale;
 const flying=phase==='flight',sliding=phase==='slide',hurt=phase==='crash'||phase==='caught',water=phase==='sinking',win=phase==='win';
 // Keep a consistent airborne silhouette; alternating unrelated poses caused visible snapping.
 const idx=win?5:hurt||water?4:sliding?3:flying?1:0;
 let visual=rig?.penguVisual;
 if(!visual||clock<visual.clock||clock-visual.clock>.5){visual={clock,weights:poses.map((_,i)=>i===idx?1:0)};if(rig)rig.penguVisual=visual;}
 const dt=Math.max(0,Math.min(.05,clock-visual.clock)),ease=1-Math.exp(-style.settle*dt);visual.clock=clock;
 visual.weights=art.officialCharacters?poses.map((_,i)=>i===idx?1:0):(poseMotion?.weights||visual.weights.map((w,i)=>w+((i===idx?1:0)-w)*ease));
 const motion=rig?.flightMotion,wobble=flying&&!art.reduced?Math.sin(clock*(style.settle/5))*style.bob*.01:0;
 const compression=art.reduced?0:poseMotion?.compression??(flying&&motion?Math.max(-.13,Math.min(.18,motion.compression)):Math.max(0,Math.min(.18,Math.abs(squash)*.12))),breath=art.reduced||flying||poseMotion?0:Math.sin(clock*1.9)*.006;
 const rotation=poseMotion?.angle??((flying||sliding||hurt||win?angle-Math.PI/2:angle)+wobble),grounded=Number.isFinite(poseMotion?.groundY);
 const sx=(1+compression*.45*style.spring+breath)*(poseMotion?.scaleX||1)*(flying?motion?.scaleX||1:1),sy=(1-compression*style.spring-breath)*(poseMotion?.scaleY||1)*(flying?motion?.scaleY||1:1);
 const contact=grounded?poseMotion.groundY+(poseMotion.offsetY||0):y;
 const extent=sprite=>{const unit=size*.98/Math.max(sprite.width,sprite.height);return (Math.abs(Math.sin(rotation))*sprite.width*sx+Math.abs(Math.cos(rotation))*sprite.height*sy)*unit/2;};
 // Reserve headroom before standing up, so changing pose weights cannot jerk the score.
 const groundTop=grounded?Math.min(...poses.map(sprite=>contact-2*extent(sprite))):Infinity;let top=Infinity;
 ctx.save();ctx.translate(x,y);ctx.globalAlpha*=poseMotion?.opacity??1;
 const alpha=ctx.globalAlpha;
 visual.weights.forEach((weight,i)=>{if(weight<.005)return;const sprite=poses[i],unit=size*.98/Math.max(sprite.width,sprite.height),w=sprite.width*unit,h=sprite.height*unit;ctx.save();ctx.globalAlpha=alpha*weight;
  // Each pose shares the same contact plane; the celebration no longer floats.
  const bottom=extent(sprite);top=Math.min(top,grounded?contact-2*bottom:y-bottom);
  if(grounded)ctx.translate(0,contact-y-bottom);
  ctx.rotate(rotation);ctx.scale(sx,sy);if(i===1&&motion&&flying&&!art.officialCharacters)drawFlightMesh(ctx,sprite,w,h,motion);else if(i===0&&idle)drawIdleSprite(ctx,sprite,-w/2,-h/2,w,h,clock+.7,style.spring);else ctx.drawImage(sprite,-w/2,-h/2,w,h);ctx.restore();});
 ctx.restore();return {top,groundTop};
}

return {ChickenRig,drawRigPart,drawChicken};
})();
// Presentation-only idle deformation: anchored feet, breathing chest, small head turns.
function drawIdleSprite(ctx,sprite,x,y,w,h,clock,strength=1){
 const rows=28,breath=Math.sin(clock*1.65)*.012*strength,look=Math.sin(clock*.72)*2.8*strength;
 for(let i=0;i<rows;i++){const t=(i+.5)/rows,head=Math.max(0,1-t/.58),chest=Math.exp(-Math.pow((t-.42)/.22,2)),rowH=h/rows,wide=1+breath*chest,shift=look*head*head;ctx.drawImage(sprite,0,i*sprite.height/rows,sprite.width,sprite.height/rows,x+w*(1-wide)/2+shift,y+i*rowH,w*wide,rowH+.6);}
}
const ActorsModel=(()=>{
// Native chicken attachments retain the supplied PSD artwork and registration.
function prepareBatter(image,cutoff=173){
 const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),data=pixels.data,w=canvas.width,h=canvas.height,seen=new Uint8Array(w*h),queue=new Int32Array(w*h);let head=0,tail=0;
 const background=i=>{const k=i*4,r=data[k],g=data[k+1],b=data[k+2];return r>cutoff&&g>cutoff&&b>cutoff&&Math.max(r,g,b)-Math.min(r,g,b)<20;};
 const offer=i=>{if(i>=0&&i<w*h&&!seen[i]&&background(i)){seen[i]=1;queue[tail++]=i;}};
 for(let x=0;x<w;x++){offer(x);offer((h-1)*w+x);}for(let y=0;y<h;y++){offer(y*w);offer(y*w+w-1);}
 // Background keying happens only in the texture upload; source pixels are preserved on disk.
 while(head<tail){const i=queue[head++],x=i%w;if(x)offer(i-1);if(x<w-1)offer(i+1);if(i>=w)offer(i-w);if(i<w*(h-1))offer(i+w);}
 for(let i=0;i<seen.length;i++)if(seen[i])data[i*4+3]=0;
 ctx.putImageData(pixels,0,0);return canvas;
}
function drawBatter(ctx,image,x,y,phase,miss,elapsed=0,clock=0){
 const poses=image.penguinPoses;if(!poses)return;
 if(image.officialCharacter){
  // The supplied wolf is a portrait: preserve its artwork, with a separate bat prop.
  const m=ReferenceMotionModel.batter(phase,miss,elapsed,image.reducedMotion),sprite=poses[0];
  const h=288,w=h*sprite.width/sprite.height,idle=phase<0&&!image.reducedMotion;
  ctx.save();ctx.translate(x,y);ctx.translate(m.shift*.22,0);
  if(idle)drawIdleSprite(ctx,sprite,-w*.48,-h,w,h,clock,.42);
  else{ctx.save();ctx.translate(0,-h*.13);ctx.rotate(m.lean*.3);ctx.drawImage(sprite,-w*.48,-h*.87,w,h);ctx.restore();}
  const swing=phase<0?0:Math.max(0,Math.min(1,(phase-.79)/.15));
  const recoil=Math.max(0,Math.min(1,(phase-1.02)/.35));
  const batAngle=-2.05+swing*2.7-recoil*.36;
  ctx.save();ctx.translate(46,-122);ctx.rotate(batAngle);
  const wood=ctx.createLinearGradient(0,-14,0,14);wood.addColorStop(0,'#ffdfa1');wood.addColorStop(.42,'#d99944');wood.addColorStop(1,'#8e4a20');
  ctx.fillStyle=wood;ctx.strokeStyle='#57321e';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(-23,-4);ctx.lineTo(35,-5);ctx.bezierCurveTo(65,-7,96,-16,135,-16);ctx.quadraticCurveTo(150,-16,150,0);ctx.quadraticCurveTo(150,16,135,16);ctx.bezierCurveTo(96,16,65,7,35,5);ctx.lineTo(-23,4);ctx.closePath();ctx.fill();ctx.stroke();
  ctx.strokeStyle='#654123';ctx.lineWidth=2;for(let i=-12;i<27;i+=5){ctx.beginPath();ctx.moveTo(i,-4);ctx.lineTo(i+3,4);ctx.stroke();}
  ctx.restore();ctx.restore();return;
 }
 const idle=phase<0&&!image.reducedMotion,m=ReferenceMotionModel.batter(phase,miss,elapsed,image.reducedMotion),sprite=poses[m.index],h=303,w=h*sprite.width/sprite.height;
 ctx.save();ctx.translate(x,y);if(idle)drawIdleSprite(ctx,sprite,-w*.46,-h,w,h,clock,.9);
 else{
  // Deform the complete held-bat sprite above fixed soles, preserving the grip.
  const rows=32;for(let i=0;i<rows;i++){const t=(i+.5)/rows,upper=(1-t)**1.5,rowH=h/rows,shift=(m.shift+m.lean*h*(1-t))*upper;
   ctx.drawImage(sprite,0,i*sprite.height/rows,sprite.width,sprite.height/rows,-w*(m.index===2?.50:.46)+shift,-h*m.stretch+i*rowH*m.stretch,w,rowH*m.stretch+.6);
  }
 }ctx.restore();
}

function prepareHorizon(image){
 const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const g=c.getContext('2d');g.drawImage(image,0,0);
 const fade=g.createLinearGradient(0,0,0,c.height*.16);fade.addColorStop(0,'transparent');fade.addColorStop(1,'#000');g.globalCompositeOperation='destination-in';g.fillStyle=fade;g.fillRect(0,0,c.width,c.height);return c;
}

return {prepareBatter,drawBatter,prepareHorizon};
})();
(()=>{
const embeddedArt=window.__reviewArt||{"johnny-sheet.png":"assets/official-hnp-v1/wolf.webp","horizon.webp":"assets/huff/forest-stadium.png","chicken/rig-atlas.png":"assets/official-hnp-v1/pig-wood.webp","pig-straw":"assets/official-hnp-v1/pig-straw.webp","pig-brick":"assets/official-hnp-v1/pig-brick.webp","official-hat":"assets/official-hnp-v1/hard-hat.webp","props.png":"assets/huff/props.png","bird.png":"assets/huff/seagull.webp","home-sign":"assets/huff/home-plate-sign.webp"};
const {Round,GROUND,STEP}=PhysicsModel;
const {buildMath,DEFAULT_CONFIG,TICKETS,uniformTicket,outcomeForTicket}=MathModel;
const {prepareBatter,prepareHorizon,drawBatter}=ActorsModel;
const {ChickenRig,drawChicken}=ChickenRigModel;
const REVIEW_FRAME=document.documentElement.dataset.coreFlow==='preview'&&window.parent!==window;let reviewOpen=false;const reviewStorage={getItem:()=>null,setItem:()=>{}};let settingsStore=reviewStorage;if(!REVIEW_FRAME){try{settingsStore=localStorage;}catch{}}
const $=id=>document.getElementById(id),canvas=$('canvas'),ctx=canvas.getContext('2d',{alpha:false});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,t)=>a+(b-a)*t;
let currencyPreset={currency:'USD',balance:10000,stake:1};
const money=n=>window.huffLocale?window.huffLocale.money(n):'$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const names=Object.keys(embeddedArt);
const chickenRig=new ChickenRig();
const art={};let assetsReady=false,batterTexture=null;
let width=1252,height=900,scale=1,dpr=1,clock=0,last=0,acc=0,round=null,roundNumber=0,balanceCents=1000000,stake=1,activeStake=1;
let speedIndex=0,speeds=[1,2,3];
let previousCam=null;
// Presentation only: preserve fixed-step physics and outcome sequence at a readable pace.
const PLAYBACK_PACE=.8;
let cam={x:0,y:0,vx:0,vy:0},particles=[],trail=[],rings=[],snowMarks=[],shake=0,squash=0,flash=0,boost=0,boostColor='#ffdc30',streakWord=null;
let openingPending=!REVIEW_FRAME,loadingError=null,autoSession=null,sharedPanelOpen=false;
let returning=false,settledAt=0,recoveryAt=0,pendingWin=null,waterReaction=null,autoLeft=0,autoEnabled=false,history=[],scoreDisplay=0,toastTimer,holdTimer,held=false,menuFocus=null;
let sessionPaid=0,sessionBet=0;const sessionStarted=Date.now();
let soundOn=true,musicOn=true,stats={n:0,stake:0,paid:0},activeMath=buildMath();
try{soundOn=settingsStore.getItem('huff-home-run-sound')!=='off';musicOn=settingsStore.getItem('huff-home-run-music')!=='off';const saved=settingsStore.getItem('huff-home-run-config-v1');if(saved)activeMath=buildMath(JSON.parse(saved));}catch{}
class FlightFeedback {
 constructor(){this.reset();}
 reset(){this.color='#ffb52e';this.kind='strike';this.pulse=0;this.stretch=0;this.joy=0;this.unstable=0;this.time=0;this.lastVy=0;this.angle=0;this.angularV=0;this.wobble=0;this.wobbleV=0;this.compression=0;this.compressionV=0;this.wing=0;this.wingV=0;this.feet=0;this.feetV=0;this.head=0;this.headV=0;this.previous=null;this.tumble=0;this.birdAge=Infinity;this.birdFrom=0;this.birdOffset=0;this.impactAge=Infinity;this.impactKind='';}
 hit(kind,event={},p={vx:0,vy:0,x:0,y:0},incoming=p){
  if(['strike','pickup','multiply','bird','rock'].includes(kind)){this.kind=kind;this.color=kind==='bird'||kind==='rock'?'#ff4b45':kind==='pickup'?'#8bff34':'#ffb52e';this.pulse=1;}
  const speed=Math.hypot(incoming.vx||0,incoming.vy||0),force=Math.min(1,speed/1600);
  const nx=(event.x??p.x)-p.x,ny=(event.y??p.y)-p.y;
  const turn=kind==='rock'?(Math.sign(p.omega)||-1):(Math.sign((incoming.vx||0)*ny-(incoming.vy||0)*nx)||1);
  if(kind==='strike'||kind==='pickup'||kind==='multiply'){this.impactAge=0;this.impactKind=kind;}
  if(kind==='strike'){this.compression=.12;this.compressionV=-1.8;this.wobbleV=-.7;this.stretch=.16;}
  if(kind==='pickup'||kind==='multiply'){this.joy=1;this.wobbleV-=.65;this.headV-=.4;this.wingV+=.55;this.stretch=.07;}
  if(kind==='bird'){this.birdFrom=this.birdOffset;this.birdAge=0;this.unstable=.5;this.wobbleV+=turn*(1+force*.8);this.compressionV+=.65;this.wingV+=turn*.8;this.feetV-=turn*.55;}
  if(kind==='rock'){this.unstable=1;this.compressionV+=3.2;this.wobbleV+=turn*3;this.tumble=turn*(2.8+force*2);}
  if(kind==='bounce'){const impact=Math.min(1,(event.impact||0)/750);this.compressionV+=.8+impact*1.5;this.wobbleV-=impact*.8;this.feetV+=impact*.6;}
  if(kind==='slide'||kind==='splash'){this.compressionV+=.5;this.feetV+=.5;this.tumble*=.35;}
 }
 spring(name,target,k,damping,dt){const v=name+'V';this[v]+=((target-this[name])*k-this[v]*damping)*dt;this[name]+=this[v]*dt;}
 step(dt,p={vx:0,vy:0,angle:0},state='idle'){
  this.previous={angle:this.angle,wing:this.wing,feet:this.feet,head:this.head,compression:this.compression,joy:this.joy,birdOffset:this.birdOffset,impactAge:this.impactAge};
  this.birdAge+=dt;this.impactAge+=dt;if(Number.isFinite(this.birdAge))this.birdOffset=this.birdFrom+ReferenceMotionModel.birdTurn(this.birdAge);
  this.time+=dt;this.pulse*=Math.exp(-3.2*dt);this.stretch*=Math.exp(-9*dt);this.joy*=Math.exp(-2.8*dt);this.unstable*=Math.exp(-3.5*dt);
  const flight=state==='flight',crash=state==='crash',speed=Math.hypot(p.vx||0,p.vy||0),air=Math.min(1,speed/1600);
  const accel=Math.max(-1,Math.min(1,((p.vy||0)-this.lastVy)/180));this.lastVy=p.vy||0;
  this.spring('wobble',0,65,14,dt);this.spring('compression',-this.stretch,100,18,dt);
  let target=flight?Math.atan2(p.vy||0,Math.max(180,Math.abs(p.vx||0)))*.72:crash?this.angle+this.tumble*dt*5:state==='windup'?(p.angle||0):0;
  if(flight)target+=this.wobble-this.joy*.16;
  const delta=Math.atan2(Math.sin(target-this.angle),Math.cos(target-this.angle));if(crash)this.angularV+=(this.tumble-this.angularV)*12*dt;else this.angularV+=(delta*85-this.angularV*18)*dt;this.angle+=this.angularV*dt;this.tumble*=Math.exp(-2.8*dt);
  // Incommensurate airflow oscillations, attenuated as speed drops; no repeated flap cycle.
  const flutter=(Math.sin(this.time*11.7)+Math.sin(this.time*17.3+.8)*.45)*.035*air;
  this.spring('wing',flight?(-this.angularV*.045+flutter+this.joy*.11+accel*.045):0,48,11,dt);
  this.spring('feet',flight?(-this.angularV*.07+this.wing*.36+Math.sin(this.time*6.1)*.012*air):state==='slide'?.10:0,28,9,dt);
  this.spring('head',flight?(-this.angularV*.025-this.joy*.075+this.wing*.15):0,58,13,dt);
 }
 sample(t){const prev=this.previous||this;const result={};for(const key of ['angle','wing','feet','head','compression','joy'])result[key]=prev[key]+(this[key]-prev[key])*t;result.angle+=prev.birdOffset+(this.birdOffset-prev.birdOffset)*t;const age=Number.isFinite(this.impactAge)?prev.impactAge+(this.impactAge-prev.impactAge)*t:Infinity;return {...result,...ReferenceMotionModel.impact(age,this.impactKind)};}
}
const flightFeedback=new FlightFeedback();
const AUDIO_ASSETS={music:'music',strike:'bat-hit',miss:'miss',bounce:'bounce',pickup:'collect',hazard:'hazard',win:'record',splash:'splash',bird:'bird',wind:'wind',slide:'slide'};
class Soundscape {
 constructor(){
  this.ctx=null;this.unlocked=false;this.active=false;this.buffers=new Map();this.decoding=new Map();this.loops=new Map();this.voices=new Set();this.music=null;this.duckUntil=0;this.lastImpactRound=null;this.lastWinRound=undefined;
  // Fetch bytes early; creating or resuming audio waits for a real interaction.
  this.downloads=REVIEW_FRAME?[]:Object.entries(AUDIO_ASSETS).map(([name,file])=>{
   const bytes=Promise.resolve().then(()=>fetch('assets/audio/'+file+'.mp3')).then(response=>{if(!response.ok)throw Error('Audio unavailable');return response.arrayBuffer();}).catch(()=>null);
   return [name,bytes];
  });
 }
 allowed(){return !REVIEW_FRAME&&!reviewOpen&&!document.hidden;}
 init(fromGesture=false){
  if(!this.allowed()||(!this.unlocked&&!fromGesture))return;
  this.unlocked=true;
  if(!this.ctx){
   const C=window.AudioContext||window.webkitAudioContext;if(!C)return;
   try{this.ctx=new C();}catch{return;}
   const a=this.ctx;this.master=a.createGain();this.master.gain.value=soundOn?.7:0;this.master.connect(a.destination);
   this.effects=a.createGain();this.effects.gain.value=.75;this.effects.connect(this.master);
   this.musicBus=a.createGain();this.musicBus.gain.value=0;this.musicBus.connect(this.master);
   const buffer=a.createBuffer(1,a.sampleRate*2,a.sampleRate),data=buffer.getChannelData(0);let last=0;
   for(let i=0;i<data.length;i++){last=(last+.02*(Math.random()*2-1))/1.02;data[i]=last*3.5;}
   this.noiseBuffer=buffer;
   this.ensureLoop('wind');this.ensureLoop('slide');
   for(const [name,bytes] of this.downloads){
    const decoded=bytes.then(data=>data?a.decodeAudioData(data.slice(0)):null).then(buffer=>{
     if(!buffer)return;this.buffers.set(name,buffer);
     if(name==='music')this.syncMusic();
     if((name==='wind'||name==='slide')&&this.active&&this.allowed())this.ensureLoop(name);
    }).catch(()=>{});
    this.decoding.set(name,decoded);
   }
  }
  this.resume();
 }
 ramp(param,value,time=.08){const t=this.ctx.currentTime;param.cancelScheduledValues(t);param.setTargetAtTime(value,t,time);}
 set(enabled){if(!this.ctx)return;this.ramp(this.master.gain,enabled&&this.active&&this.allowed()?.7:0,.04);if(!enabled)this.clearVoices();}
 setMusic(){if(this.ctx)this.syncMusic();}
 syncMusic(){
  if(!this.ctx)return;
  if(musicOn&&this.active&&this.allowed()&&!this.music&&this.buffers.has('music')){
   const source=this.ctx.createBufferSource();source.buffer=this.buffers.get('music');source.loop=true;source.loopStart=0;source.loopEnd=source.buffer.duration;source.connect(this.musicBus);source.start();this.music=source;
  }
  this.ramp(this.musicBus.gain,musicOn&&this.active&&this.allowed()?(this.ctx.currentTime<this.duckUntil?.085:.22):0,.12);
 }
 ensureLoop(name){
  const buffer=this.buffers.get(name)||this.noiseBuffer,old=this.loops.get(name);if(old?.buffer===buffer)return;
  const source=this.ctx.createBufferSource(),gain=this.ctx.createGain();source.buffer=buffer;source.loop=true;source.loopStart=0;source.loopEnd=buffer.duration;gain.gain.value=0;
  let filter=null;if(buffer===this.noiseBuffer){filter=this.ctx.createBiquadFilter();filter.type=name==='wind'?'lowpass':'highpass';filter.frequency.value=name==='wind'?1200:2300;source.connect(filter);filter.connect(gain);}else source.connect(gain);
  gain.connect(this.effects);source.start();const voice={source,gain,filter,buffer};source.onended=()=>this.disconnect(voice);this.loops.set(name,voice);
  if(old){this.ramp(old.gain.gain,0,.025);try{old.source.stop(this.ctx.currentTime+.15);}catch{this.disconnect(old);}}
 }
 disconnect(voice){for(const node of [voice.source,voice.filter,voice.gain]){try{node?.disconnect();}catch{}}this.voices.delete(voice);}
 track(source,gain,filter=null,type='fallback'){
  while(this.voices.size>=12){const oldest=this.voices.values().next().value;try{oldest.source.stop();}catch{}this.disconnect(oldest);}
  const voice={source,gain,filter,type};this.voices.add(voice);source.onended=()=>this.disconnect(voice);return voice;
 }
 clearVoices(type=null){for(const voice of [...this.voices])if(!type||voice.type===type){try{voice.source.stop();}catch{}this.disconnect(voice);}}
 pause(){
  this.active=false;if(!this.ctx)return;this.clearVoices();this.ramp(this.master.gain,0,.025);this.ramp(this.musicBus.gain,0,.025);for(const loop of this.loops.values())this.ramp(loop.gain.gain,0,.025);
  // A fast return can race a pending suspend. Reconcile its completion with the latest intent.
  try{Promise.resolve(this.ctx.suspend()).then(()=>{if(this.active&&this.allowed())this.resume();}).catch(()=>{});}catch{}
 }
 resume(){
  if(!this.ctx||!this.unlocked||!this.allowed())return;
  this.active=true;this.ensureLoop('wind');this.ensureLoop('slide');this.set(soundOn);this.syncMusic();
  try{Promise.resolve(this.ctx.resume()).then(()=>{if(!this.active||!this.allowed())this.pause();}).catch(()=>{});}catch{}
 }
 ready(){return !!this.ctx&&this.active&&this.ctx.state==='running'&&soundOn&&this.allowed();}
 play(name,volume=.7,rate=1,offset=0,duration=null){
  if(!this.ready()||!this.buffers.has(name))return false;
  const a=this.ctx,source=a.createBufferSource(),gain=a.createGain();source.buffer=this.buffers.get(name);source.playbackRate.value=rate;gain.gain.value=volume;source.connect(gain);gain.connect(this.effects);this.track(source,gain,null,name);
  const start=Math.min(offset,Math.max(0,source.buffer.duration-.01));if(duration===null)source.start(0,start);else{gain.gain.setValueAtTime(volume,a.currentTime);gain.gain.exponentialRampToValueAtTime(.0001,a.currentTime+duration/rate);source.start(0,start,Math.min(duration,source.buffer.duration-start));}return true;
 }
 tone(f,duration=.15,type='sine',volume=.3,delay=0,end=f,cue='fallback'){
  if(!this.ready())return;const a=this.ctx,t=a.currentTime+delay,o=a.createOscillator(),g=a.createGain();o.type=type;o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(Math.max(20,end),t+duration);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(volume,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(this.effects);this.track(o,g,null,cue);o.start(t);o.stop(t+duration+.05);
 }
 noise(duration=.15,volume=.7,freq=1700){
  if(!this.ready())return;const a=this.ctx,t=a.currentTime,s=a.createBufferSource(),f=a.createBiquadFilter(),g=a.createGain();s.buffer=this.noiseBuffer;f.type='lowpass';f.frequency.value=freq;g.gain.setValueAtTime(volume,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);s.connect(f);f.connect(g);g.connect(this.effects);this.track(s,g,f);s.start();s.stop(t+duration+.02);
 }
 beginRound(){this.lastImpactRound=null;this.lastWinRound=undefined;this.duckUntil=0;this.clearVoices();this.syncMusic();}
 event(type,preview=false){
  if(!this.ready())return;
  if(type==='lose')return; // Each losing ending already has its own miss, impact or splash cue.
  const hazard=type==='rock'||type==='dynamite'||type==='icicle';
  if(hazard||type==='splash'){if(this.lastImpactRound===round)return;this.lastImpactRound=round;}
  if(type==='win'){
   if(!preview&&this.lastWinRound===round)return;this.lastWinRound=round;this.clearVoices('win');
   this.duckUntil=this.ctx.currentTime+(this.buffers.get('win')?.duration||2.5);this.syncMusic();
  }
  const name=hazard?'hazard':type==='multiply'?'pickup':type,volume=({strike:.9,miss:.62,bounce:.66,pickup:.57,multiply:.65,bird:.55,rock:.75,dynamite:.75,icicle:.75,splash:.75,win:.76})[type]??.6;
  // Never queue a one-shot while its download/decoder is pending: a late hit would be misleading.
  if(this.play(name,volume,type==='multiply'?1.22:1))return;
  if(type==='strike'){this.noise(.065,.85,5200);this.tone(185,.10,'triangle',.5,0,60);}
  if(type==='miss'){this.noise(.3,.4,2400);this.tone(520,.35,'triangle',.15,0,110);}
  if(type==='pickup'||type==='multiply'){this.tone(type==='multiply'?1318.5:1046.5,.14,'triangle',.28);this.tone(type==='multiply'?1975.5:1568,.19,'sine',.2,.055);}
  if(type==='bird'){this.tone(1800,.12,'sine',.18,0,2100);this.tone(540,.16,'triangle',.15,.08,170);}
  if(type==='bounce'){this.tone(135,.18,'sine',.4,0,45);this.noise(.15,.4,2300);}
  if(hazard){this.noise(.4,.75,2600);this.tone(95,.35,'sawtooth',.15,0,28);}
  if(type==='splash'){this.noise(.8,.7,4300);this.tone(250,.2,'sine',.25,0,70);}
  if(type==='win'){[392,523.25,659.25,783.99].forEach(f=>this.tone(f,.6,'triangle',.12,0,f,'win'));}
 }
 update(){
  if(!this.ctx||!this.active||!this.allowed())return;const flight=round?.state==='flight',sliding=round?.state==='slide',velocity=flight?Math.hypot(round.p.vx,round.p.vy):0;
  const wind=this.loops.get('wind'),slide=this.loops.get('slide');
  if(wind){this.ramp(wind.gain.gain,flight?Math.min(.38,velocity/4200):0,.15);this.ramp(wind.source.playbackRate,clamp(.7+velocity/2800,.7,1.35),.15);if(wind.filter)this.ramp(wind.filter.frequency,500+velocity*.8,.1);}
  if(slide){this.ramp(slide.gain.gain,sliding?Math.min(.45,Math.abs(round.p.vx)/950):0,.12);this.ramp(slide.source.playbackRate,sliding?clamp(.65+Math.abs(round.p.vx)/1300,.65,1.2):.65,.15);}
  if(this.duckUntil&&this.ctx.currentTime>=this.duckUntil){this.duckUntil=0;this.syncMusic();}
 }
}
const audio=new Soundscape();
function updateSound(){$('sound').classList.toggle('muted',!soundOn);$('sound').setAttribute('aria-label',soundOn?'Mute sound':'Enable sound');$('sound').setAttribute('aria-pressed',String(soundOn));audio.set(soundOn);if($('menu-sound')){$('menu-sound').textContent='Sound: '+(soundOn?'ON':'OFF');$('menu-sound').setAttribute('aria-pressed',String(soundOn));}try{settingsStore.setItem('huff-home-run-sound',soundOn?'on':'off');}catch{}}
function updateMusic(){audio.setMusic();if($('menu-music')){$('menu-music').textContent='Music: '+(musicOn?'ON':'OFF');$('menu-music').setAttribute('aria-pressed',String(musicOn));}try{settingsStore.setItem('huff-home-run-music',musicOn?'on':'off');}catch{}}
updateSound();
for(const type of ['pointerdown','keydown'])document.addEventListener(type,event=>{if(event.isTrusted)audio.init(true);},{capture:true});
window.addEventListener('pagehide',()=>audio.pause());
window.addEventListener('pageshow',()=>audio.resume());
function resize(){const r=canvas.getBoundingClientRect();dpr=Math.min(devicePixelRatio||1,2);height=900;scale=r.height/height;width=r.width/scale;canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);if(!round){cam.x=645-width/2;cam.y=0;}else cam.x=round.p.x-width*.51;}
new ResizeObserver(resize).observe($('arena'));
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3200);}
const busy=()=>!!pendingWin||!!round&&(round.state!=='settled'||!!round.regionalPending);
function updateControls(){
 $('balance').textContent=money(balanceCents/100);$('bet-value').textContent=money(stake);$('footer-bet').textContent=money(activeStake);
 $('multiplier').textContent=(round?.state==='settled'?round.outcome.multiplier:(round?.score||0)).toFixed(2)+'×';
 $('play').disabled=!assetsReady||busy()||autoEnabled||!$('win-overlay').hidden;$('bet-selector').disabled=busy()||autoEnabled||!$('win-overlay').hidden;
 for(const id of ['menu','info','turbo'])$(id).disabled=!!pendingWin;$('auto').disabled=!!pendingWin&&!autoEnabled;
 $('auto-count').textContent=autoEnabled?autoLeft:'';$('auto').classList.toggle('active',autoEnabled);$('auto').setAttribute('aria-label',autoEnabled?'Stop autoplay':'Autoplay settings');
 $('rtp-badge').textContent=activeMath.rtp.toFixed(2)+'%';$('stake-fill').style.width=(12+78*Math.log10(stake/.1+1)/Math.log10(2001))+'%';
 if($('apply-tuning'))$('apply-tuning').disabled=busy()||autoEnabled;
 document.querySelectorAll('[data-scenario]').forEach(b=>b.disabled=busy()||autoEnabled);
 if(window.huffUI)window.dispatchEvent(new CustomEvent('huff-state',{detail:window.huffUI.read()}));
}
// One character asset and one presentation component for all win tiers.
const WIN_TIERS=[{min:5,label:'Nice Win',color:'#9deedc'},{min:10,label:'Big Win',color:'#80d8ff'},{min:25,label:'Mega Win',color:'#b7a0ff'},{min:50,label:'Epic Win',color:'#ed9bff'},{min:100,label:'Legendary Win',color:'#f5cf73'}];
const winTier=multiplier=>[...WIN_TIERS].reverse().find(t=>multiplier>=t.min)||null;
let winAnimation=0,winTimer=0,winFocus=null,winPreview=false,winAmount=0,winCounting=false;
function cancelResultPresentation(){pendingWin=null;waterReaction=null;}
function revealRoundResult(multiplier,payout,preview){
 $('result').classList.add('show');if(!round?.replay&&payout>0&&winTier(multiplier)){$('result').classList.remove('show');showWin(multiplier,payout,preview);}audio.event(payout>0?'win':'lose');updateControls();
}
function advanceResultPresentation(){
 if(!pendingWin)return;
 if(pendingWin.owner!==round||round.state!=='settled'){pendingWin=null;updateControls();return;}
 if(clock<pendingWin.at)return;
 const result=pendingWin;pendingWin=null;revealRoundResult(result.multiplier,result.payout,result.preview);
}
function showWin(multiplier,payout,preview=false){
 const tier=winTier(multiplier);if(!tier)return false;
 cancelAnimationFrame(winAnimation);clearTimeout(winTimer);closeBet();winFocus=document.activeElement;winPreview=preview;winAmount=payout;winCounting=!reduced;
 const overlay=$('win-overlay'),card=overlay.querySelector('.win-card'),level=WIN_TIERS.indexOf(tier);
 card.dataset.tier=level;card.style.setProperty('--win-color',tier.color);$('win-title').textContent=tier.label;$('win-multiple').textContent=multiplier.toFixed(2)+'× BET';$('win-preview').hidden=!preview;$('win-final').textContent=tier.label+', '+money(payout)+', '+multiplier.toFixed(2)+' times bet.';
 $('win-confetti').innerHTML=Array.from({length:12+level*7},(_,i)=>'<i style="--x:'+((i*37)%100)+'%;--fall:'+(2.4+(i%5)*.35)+'s;--delay:-'+(i%7)*.4+'s"></i>').join('');
 $('win-stop').hidden=!autoEnabled;$('win-continue').textContent=reduced?'Continue':'Skip count-up';overlay.hidden=false;for(const el of document.querySelectorAll('.arena,.topbar,.statusbar,#modal-backdrop'))el.inert=true;$('win-amount').textContent=reduced?money(payout):money(0);$('win-continue').focus();updateControls();
 const began=performance.now(),duration=1100+level*250;
 function count(now){if(overlay.hidden)return;const progress=Math.min(1,(now-began)/duration);$('win-amount').textContent=money(payout*(1-Math.pow(1-progress,3)));if(progress<1)winAnimation=requestAnimationFrame(count);else finishWinCount();}
 if(reduced)finishWinCount();else winAnimation=requestAnimationFrame(count);return true;
}
function finishWinCount(){cancelAnimationFrame(winAnimation);winCounting=false;$('win-amount').textContent=money(winAmount);$('win-continue').textContent='Continue';if(autoEnabled&&!winPreview){clearTimeout(winTimer);winTimer=setTimeout(closeWin,1800);}}
function closeWin(){cancelAnimationFrame(winAnimation);clearTimeout(winTimer);$('win-overlay').hidden=true;for(const el of document.querySelectorAll('.arena,.topbar,.statusbar,#modal-backdrop'))el.inert=false;settledAt=clock;updateControls();if(winFocus?.isConnected&&!winFocus.disabled)winFocus.focus();else $('play').focus();}
$('win-continue').onclick=()=>winCounting?finishWinCount():closeWin();
$('win-stop').onclick=()=>{clearTimeout(winTimer);stopAuto(false);$('win-stop').hidden=true;$('win-continue').focus();};
function openWinPreviews(){if(busy()){toast('Let this round finish before previewing celebrations.');return;}stopAuto(false);openModal('Win celebration previews','<p>Official Huff n Puff characters, shared across every tier. Previews do not use or award credits.</p><div class="menu-list">'+WIN_TIERS.map(t=>'<button data-win-preview="'+t.min+'">'+t.label+' · '+t.min+'×</button>').join('')+'</div>');document.querySelectorAll('[data-win-preview]').forEach(b=>b.onclick=()=>{const n=Number(b.dataset.winPreview);showWin(n,n*stake,true);audio.event('win',true);});}
setInterval(()=>{$('session-clock').textContent=new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});const elapsed=Math.floor((Date.now()-sessionStarted)/1000);$('session-time').textContent=String(Math.floor(elapsed/60)).padStart(2,'0')+':'+String(elapsed%60).padStart(2,'0');const net=(sessionPaid-sessionBet)/100;$('session-result').textContent=(net>0?'+':'')+money(net);$('session-result').style.color=net<0?'var(--ig-secondary-text)':'var(--ig-positive)';},1000);

const PIG_STYLES=[
 {id:'straw',name:'Straw Pig',feeling:'Light & floaty',scale:.83,spring:1.25,settle:23,bob:3.2},
 {id:'wood',name:'Wood Pig',feeling:'Balanced',scale:1,spring:1,settle:18,bob:1.7},
 {id:'brick',name:'Brick Pig',feeling:'Heavy & steady',scale:1.2,spring:.65,settle:12,bob:.55}
];
// Cosmetic selection uses its own random value and never enters the round model.
function selectPig(index){const style=PIG_STYLES[index];art.pigStyle=style;art.penguPoses=art.pigTeams[style.id];$('win-penguin').src=art.penguPoses[5].toDataURL();chickenRig.penguVisual=null;}
function nextSeed(){if(REVIEW_FRAME)return 20260923;const a=new Uint32Array(1);crypto.getRandomValues(a);return a[0];}
function startRound(forced=null,previewConfig=null,replayRecord=null){if(reviewOpen||openingPending)return;
 if(!forced&&window.regional){if(autoEnabled&&!window.regional.autoMax){stopAuto(false);return;}const why=window.regional.canBet(stake*1);if(why){if(!why.includes('minimum round')){stopAuto(false);toast(why)}return;}}
 if(!assetsReady||busy()||!$('win-overlay').hidden)return;
 if(!forced&&balanceCents<Math.round(stake*100)){stopAuto(false);toast('Not enough demo credits. Reset the balance in the menu.');return;}
 let next;try{next=new Round(replayRecord?.seed??nextSeed(),replayRecord?.stake??stake,forced&&previewConfig?previewConfig:activeMath.config,forced?0:uniformTicket(),forced);}catch(error){stopAuto(false);toast('This round could not start. '+error.message);return;}
 cancelResultPresentation();chickenRig.reset();chickenRig.penguVisual=null;previousCam=null;flightFeedback.reset();next.preview=!!forced;next.replay=!!replayRecord;next.replayRecord=replayRecord;next.balanceBefore=balanceCents/100;next.pigIndex=replayRecord?.pigIndex??Math.floor(Math.random()*PIG_STYLES.length);audio.init();round=next;audio.beginRound();activeStake=next.stake;selectPig(next.pigIndex);
 if(!round.preview){round.regional=window.regional?.accept(round.stake);balanceCents-=round.stakeCents;roundNumber++;}
 scoreDisplay=0;trail=[];particles=[];rings=[];snowMarks=[];boost=0;shake=0;squash=0;flash=0;acc=0;returning=false;canvas.style.opacity='1';
 cam={x:645-width/2,y:0,vx:0,vy:0};$('result').classList.remove('show');document.querySelector('.brand').classList.add('flying');closeBet();
 $('footer-bet').parentElement.firstChild.textContent=round.preview?'Preview: ':'Bet: ';
 if(round.replay){clearTimeout(toastTimer);$('toast').classList.remove('show');}else if(round.preview)toast('Preview only — no credits used.');else toast(art.pigStyle.name+' · '+art.pigStyle.feeling);updateControls();
}
function stopAuto(show=true){autoEnabled=false;autoLeft=0;autoSession=null;updateControls();if(show)toast('Autoplay stopped. The current round will finish.');}
function handlePlay(){if(!sharedPanelOpen&&!round?.replay&&!busy()&&!autoEnabled)startRound();}
$('play').addEventListener('click',()=>{if(!held)handlePlay();held=false;});
$('play').addEventListener('pointerdown',()=>{held=false;clearTimeout(holdTimer);if(busy())return;holdTimer=setTimeout(()=>{held=true;openAuto();},650);});
for(const e of ['pointerup','pointercancel','pointerleave'])$('play').addEventListener(e,()=>clearTimeout(holdTimer));
$('info').onclick=()=>openRules();
$('sound').onclick=()=>{audio.init();soundOn=!soundOn;updateSound();};
$('turbo').onclick=()=>{if(window.regional&&!window.regional.profile.turbo)return;speedIndex=(speedIndex+1)%speeds.length;$('speed-value').textContent=speeds[speedIndex]+'×';$('speed-value').hidden=speedIndex===0;$('turbo').classList.toggle('active',speedIndex>0);$('turbo').setAttribute('aria-label','Game speed: '+speeds[speedIndex]+' times');};
let betSteps=[.1,.2,.4,.6,.8,1,2,3,4,5,6,7,8,9,10,15,20,25,50,75,100,150,200];
function closeBet(){const hadFocus=$('bet-popover').contains(document.activeElement);$('bet-popover').hidden=true;if(hadFocus)$('bet-selector').focus();$('bet-selector').setAttribute('aria-expanded','false');}
function openBet(){if(busy()||autoEnabled||!$('win-overlay').hidden)return;if(!$('bet-popover').hidden){closeBet();return;}
 const rows=[];for(let i=0;i<betSteps.length;i+=3)rows.unshift(betSteps.slice(i,i+3));
 $('bet-options').innerHTML=rows.map(row=>row.map(n=>`<button data-stake="${n}" class="${n===stake?'selected':''}" aria-pressed="${n===stake}">${n.toFixed(2)}</button>`).join('')+'<span aria-hidden="true"></span>'.repeat(3-row.length)).join('');
 document.querySelectorAll('[data-stake]').forEach(b=>b.onclick=()=>{stake=Number(b.dataset.stake);activeStake=stake;closeBet();updateControls();$('bet-selector').focus();});
 $('bet-popover').hidden=false;$('bet-selector').setAttribute('aria-expanded','true');const selected=$('bet-options').querySelector('.selected');if(selected){$('bet-options').scrollTop=Math.max(0,selected.offsetTop-160);selected.focus();}
}
$('bet-selector').onclick=openBet;$('close-bet').onclick=closeBet;
document.addEventListener('pointerdown',e=>{if(!$('bet-popover').hidden&&!e.target.closest('.bet-popover')&&!e.target.closest('.bet-selector'))closeBet();});
function openModal(title,html,wide=false){closeBet();menuFocus=document.activeElement;$('modal-title').textContent=title;$('modal-content').innerHTML=html;document.querySelector('.modal').classList.toggle('wide',wide);$('modal-backdrop').hidden=false;$('close-modal').focus();}
function closeModal(){$('modal-backdrop').hidden=true;menuFocus?.focus?.();}
$('close-modal').onclick=closeModal;$('modal-backdrop').onclick=e=>{if(e.target===$('modal-backdrop'))closeModal();};
function openAuto(){if(autoEnabled){stopAuto();return;}if(pendingWin)return;openModal('Autoplay','<p>Choose how many rounds to play with your selected bet.</p><div class="auto-options"><button data-rounds="10">10</button><button data-rounds="25">25</button><button data-rounds="50">50</button><button data-rounds="100">100</button></div><p class="muted-text">Tap the A button to stop. The current round will finish. Speed changes playback only.</p>');
 document.querySelectorAll('[data-rounds]').forEach(b=>b.onclick=()=>{autoLeft=Number(b.dataset.rounds);autoEnabled=true;closeModal();if(!busy())startRound();else updateControls();});
}
$('auto').onclick=openAuto;
function openRules(){openModal('How to play',`<ol><li><strong>Pick your bet and press play.</strong><br>Each play randomly selects Straw, Wood or Brick Pig, each with a different size and animation style. The wolf batter swings at the selected pig. A complete miss is a Missed Swing and loses the bet immediately.</li><li><strong>Positive pickups launch you upward.</strong><br>Numbered hard hats marked 1, 2, 5 and 10 add bet multiples. x2, x3, x4 and x5 multiply the current total. All positive pickups give an upward impulse.</li><li><strong>Negative hits send you downward.</strong><br>A seagull halves your current total and knocks the flight path down.</li><li><strong>Avoid the ground hazards.</strong><br>Landing in the woodland pond or getting caught on a broken tree stump ends the round with no win. Any running total is lost; nothing is credited.</li><li><strong>Stop safely on the grass.</strong><br>Your running total is credited when Pig finishes sliding.</li></ol><div class="rule-row"><span>Theoretical RTP</span><strong>${activeMath.rtp.toFixed(2)}%</strong></div><div class="rule-row"><span>Maximum win</span><strong>100× bet</strong></div><div class="rule-row"><span>Bet range</span><strong>$0.10–$200.00</strong></div><p class="muted-text">Demo credits only. Each result is drawn before its animation. Short sessions fluctuate around the theoretical return. Game tuning changes the weights for future rounds. This prototype is not a certified gambling system.</p>`);}
function openHistory(){openModal('My rounds',history.length?'<table class="history"><thead><tr><th>Round</th><th>Bet</th><th>Result</th><th>Win</th></tr></thead><tbody>'+history.map(r=>`<tr><td>#${r.number}</td><td>${money(r.stake)}</td><td>${r.cause==='dead'?'Missed swing':r.cause==='icicle'?'Caught on tree stump':r.cause==='water'?'Woodland pond':r.multiplier.toFixed(2)+'×'}</td><td class="${r.payout>0?'win':''}">${money(r.payout)}</td></tr>`).join('')+'</tbody></table><p class="muted-text">Preview rounds are excluded.</p>':'<p>Your completed rounds will appear here.</p>');}
function returnHome(force=false){if(pendingWin&&!force)return;cancelResultPresentation();chickenRig.reset();chickenRig.penguVisual=null;previousCam=null;round=null;cam={x:645-width/2,y:0,vx:0,vy:0};trail=[];particles=[];rings=[];snowMarks=[];$('result').classList.remove('show');document.querySelector('.brand').classList.remove('flying');canvas.style.opacity='1';returning=false;$('footer-bet').parentElement.firstChild.textContent='Bet: ';updateControls();}
function openMenu(){openModal('Huff n Puff Home Run 2','<div class="menu-list"><button id="menu-outcomes">Outcomes</button><button id="menu-how">How to play</button><button id="menu-history">My rounds</button><button id="menu-tuning">Game tuning & RTP</button><button id="menu-sound">Sound: '+(soundOn?'ON':'OFF')+'</button><button id="menu-wins">Win celebration previews</button><button id="menu-music">Music: '+(musicOn?'ON':'OFF')+'</button><button id="menu-fullscreen">Toggle fullscreen</button><button id="menu-reset">Reset demo balance</button></div><p class="muted-text">Demo credits · Local play</p>');
 $('menu-outcomes').hidden=REVIEW_FRAME;$('menu-outcomes').onclick=openOutcomes; $('menu-sound').setAttribute('aria-pressed',String(soundOn));$('menu-sound').onclick=()=>{$('sound').click();};$('menu-wins').onclick=openWinPreviews;
 $('menu-how').onclick=openRules;$('menu-history').onclick=openHistory;$('menu-tuning').onclick=openTuning;
 $('menu-music').setAttribute('aria-pressed',String(musicOn));$('menu-music').onclick=()=>{audio.init();musicOn=!musicOn;updateMusic();};
 $('menu-fullscreen').onclick=async()=>{closeModal();try{if(document.fullscreenElement)await document.exitFullscreen();else await $('game').requestFullscreen();}catch{toast('Fullscreen is unavailable in this view.');}};
 $('menu-reset').onclick=()=>{if(busy()){toast('Let this round finish before resetting.');return;}balanceCents=Math.round(currencyPreset.balance*100);history=[];sessionPaid=sessionBet=0;stats={n:0,stake:0,paid:0};stopAuto(false);roundNumber=0;$('last-win').textContent=money(0);returnHome();closeModal();toast('Demo balance: '+money(currencyPreset.balance));};
}
$('menu').onclick=openMenu;
function readDraft(){return {customWeights:$('custom-weights').checked?[...document.querySelectorAll('.outcome-weight')].map(el=>el.value.trim()===''?NaN:Number(el.value)):null,rtp:+$('tune-rtp').value,deadSpin:+$('tune-dead').value,volatility:$('tune-volatility').value,gravity:+$('tune-gravity').value,lift:+$('tune-lift').value,drop:+$('tune-drop').value};}
function mathPreview(){
 try{const m=buildMath(readDraft());$('tune-dead').max=(m.lossTickets/100).toFixed(2);$('tune-dead').value=m.config.deadSpin;
  $('draft-rtp').textContent=m.rtp.toFixed(2)+'%';$('draft-hit').textContent=m.hitRate.toFixed(2)+'%';$('draft-loss').textContent=(m.lossTickets/100).toFixed(2)+'%';
  for(const k of ['dead','gravity','lift','drop'])$('out-'+k).textContent=$('tune-'+k).value+(k==='dead'?'%':'');
  $('math-proof').textContent='Σ(weight × multiplier) = '+m.returnUnits.toLocaleString()+'\n'+m.returnUnits.toLocaleString()+' ÷ '+TICKETS.toLocaleString()+' = '+(m.rtp/100).toFixed(4)+' = '+m.rtp.toFixed(2)+'% RTP\nAll '+TICKETS.toLocaleString()+' tickets accounted for. Exact-cent payouts at every selectable stake.';
  const custom=$('custom-weights').checked;
  if(!$('weight-rows').children.length)$('weight-rows').innerHTML=m.outcomes.map((o,i)=>{const label=o.kind==='win'?o.multiplier+'×':o.kind==='dead'?'Missed swing':'Pond / stump';return `<tr><td>${label}</td><td><input class="outcome-weight" aria-label="${label} weight" type="number" min="0" max="1000000000" step="1" value="${m.config.customWeights?.[i]??o.weight}"></td><td class="weight-probability"></td><td class="weight-return"></td></tr>`;}).join('');
  [...$('weight-rows').children].forEach((row,i)=>{const input=row.querySelector('input'),o=m.outcomes[i];input.disabled=!custom;if(!custom)input.value=o.weight;input.oninput=mathPreview;row.querySelector('.weight-probability').textContent=(o.weight/100).toFixed(2)+'%';row.querySelector('.weight-return').textContent=(o.weight*o.multiplier/100).toFixed(3)+'%';});
  for(const k of ['rtp','volatility','dead'])$('tune-'+k).disabled=custom;
  $('weight-total').textContent=custom?'Total weight: '+m.config.customWeights.reduce((a,b)=>a+b,0).toLocaleString()+' · Probabilities automatically scaled to 100%.':'Enable custom weights to edit each outcome.';
  $('tune-error').textContent='';$('apply-tuning').disabled=busy()||autoEnabled;return m;
 }catch(e){$('tune-error').textContent=e.message;for(const id of ['draft-rtp','draft-hit','draft-loss'])$(id).textContent='—';$('weight-total').textContent='Correct the weights to calculate probabilities.';$('apply-tuning').disabled=true;return null;}
}
function openTuning(){if(autoEnabled){stopAuto(false);toast('Autoplay stopped for tuning.');}
 const c=activeMath.config;
 openModal('Game tuning & RTP',`<div class="tuning-summary"><div><span>THEORETICAL RTP</span><strong id="draft-rtp">97.00%</strong></div><div><span>ANY RETURN</span><strong id="draft-hit">—</strong></div><div><span>ZERO RETURN</span><strong id="draft-loss">—</strong></div></div>
 <div class="tuning-grid"><div class="tuning-field"><label for="tune-rtp">Target RTP (%)</label><input id="tune-rtp" type="number" min="80" max="99.99" step="0.01" value="${c.customWeights?97:c.rtp}"><small>Weights reconcile exactly to the chosen target.</small></div><div class="tuning-field"><label for="tune-volatility">Volatility</label><select id="tune-volatility"><option value="low">Low · frequent smaller returns</option><option value="medium">Medium · balanced</option><option value="high">High · rarer larger returns</option></select><small>Changes the payout distribution while preserving RTP.</small></div>
 <div class="tuning-field"><label for="tune-dead">Missed swings <output id="out-dead"></output></label><input id="tune-dead" type="range" min="0" max="${activeMath.lossTickets/100}" step="0.01" value="${c.deadSpin}"><small>Redistributes zero-return rounds. Capped at the total loss rate.</small></div><div class="tuning-field"><label for="tune-gravity">Gravity <output id="out-gravity"></output></label><input id="tune-gravity" type="range" min="500" max="1000" step="10" value="${c.gravity}"><small>Animation only. Higher values pull Pig down faster.</small></div>
 <div class="tuning-field"><label for="tune-lift">Positive pickup lift <output id="out-lift"></output></label><input id="tune-lift" type="range" min="450" max="900" step="10" value="${c.lift}"><small>Every positive pickup sets an upward velocity.</small></div><div class="tuning-field"><label for="tune-drop">Negative hit drop <output id="out-drop"></output></label><input id="tune-drop" type="range" min="350" max="800" step="10" value="${c.drop}"><small>Every negative hit sets a downward velocity.</small></div></div>
 <p id="tune-error" class="panel-error"></p><div class="tuning-actions"><button class="action" id="apply-tuning">Apply to next rounds</button><button class="action secondary" id="reset-tuning">Restore 97% defaults</button></div><p class="panel-note">The current round keeps its starting settings. Apply is available when it finishes. Applying starts a fresh observed-RTP sample.</p>
 <label class="custom-weights-toggle"><input id="custom-weights" type="checkbox"> Edit custom outcome weights</label><p class="panel-note">Higher weights make an outcome more likely. Zero disables it. Any positive total is allowed; probabilities scale to 100%. The Pond / stump bucket is split equally between the two zero-return endings (an odd ticket goes to water). Custom weights calculate RTP directly and replace the target RTP, volatility and missed-swing controls.</p><p id="weight-total" class="panel-note" aria-live="polite"></p><pre class="math-proof" id="math-proof"></pre><table class="math-table"><caption>Outcome weights</caption><thead><tr><th>Outcome</th><th>Weight</th><th>Probability</th><th>RTP contribution</th></tr></thead><tbody id="weight-rows"></tbody></table>
 <div class="tuning-divider"></div><div class="simulation" id="session-stats">Played since last maths change: <strong>${stats.n}</strong> rounds · Observed return: <strong>${stats.stake?(stats.paid/stats.stake*100).toFixed(2)+'%':'—'}</strong><br>Actual credits returned ÷ credits bet. This fluctuates; it is not the theoretical RTP.</div>
 <div class="tuning-actions"><button class="action secondary" id="simulate">Simulate 100,000 draws</button></div><div id="simulation-result" class="simulation">Simulation uses the draft weights above and does not spend credits.</div>
 <div class="tuning-divider"></div><strong>Animation previews</strong><p class="panel-note">No credits used. Excluded from your round history and observed RTP.</p><div class="scenario-buttons"><button data-scenario="dead">Missed swing</button><button data-scenario="win">Lift & drop · 5×</button><button data-scenario="water">Woodland pond</button><button data-scenario="icicle">Caught on tree stump</button></div>`,true);
 $('tune-volatility').value=c.volatility;
 $('custom-weights').onchange=()=>{if(!$('custom-weights').checked){$('tune-rtp').value=97;$('tune-dead').max=100;}mathPreview();};
 for(const k of ['rtp','volatility','dead','gravity','lift','drop'])$('tune-'+k).oninput=mathPreview;
 $('apply-tuning').onclick=()=>{if(busy()){toast('Let the current round finish.');return;}const m=mathPreview();if(!m)return;activeMath=m;stats={n:0,stake:0,paid:0};try{settingsStore.setItem('huff-home-run-config-v1',JSON.stringify(m.config));}catch{}updateControls();closeModal();toast(m.rtp.toFixed(2)+'% RTP applied. Missed swings: '+m.config.deadSpin.toFixed(2)+'%.');};
 $('reset-tuning').onclick=()=>{$('custom-weights').checked=false;for(const [key,value] of Object.entries(DEFAULT_CONFIG)){const el=$('tune-'+({deadSpin:'dead',volatility:'volatility'}[key]||key));if(el)el.value=value;}$('tune-dead').max=100;$('tune-dead').value=DEFAULT_CONFIG.deadSpin;mathPreview();};
 $('simulate').onclick=()=>{const m=mathPreview();if(!m)return;$('simulate').disabled=true;$('simulation-result').textContent='Drawing 100,000 independent tickets…';setTimeout(()=>{const N=100000,limit=Math.floor(4294967296/TICKETS)*TICKETS,a=new Uint32Array(10000);let n=0,total=0,misses=0;while(n<N){crypto.getRandomValues(a);for(const raw of a){if(raw>=limit)continue;const o=outcomeForTicket(m,raw%TICKETS);total+=o.multiplier;if(o.kind==='dead')misses++;if(++n===N)break;}}const sem=1.96*m.sd/Math.sqrt(N)*100;if($('simulation-result'))$('simulation-result').innerHTML=`Observed: <strong>${(total/N*100).toFixed(3)}%</strong> · Target: <strong>${m.rtp.toFixed(2)}%</strong><br>100,000 independent draws · Missed swings: ${misses.toLocaleString()}<br>Approximate 95% sampling band around target: ±${sem.toFixed(3)} percentage points.<br><span class="muted-text">Sampling demonstrates variation; the exact weighted sum above establishes theoretical RTP.</span>`;if($('simulate'))$('simulate').disabled=false;},30);};
 document.querySelectorAll('[data-scenario]').forEach(b=>b.onclick=()=>{if(busy())return;const draft=mathPreview();if(!draft)return;const kind=b.dataset.scenario;closeModal();startRound({kind,multiplier:kind==='win'?5:0},draft.config);});mathPreview();if(c.customWeights){[...document.querySelectorAll('.outcome-weight')].forEach((el,i)=>el.value=c.customWeights[i]);$('custom-weights').checked=true;mathPreview();}updateControls();
}
$('tuning').onclick=openTuning;
document.addEventListener('keydown',e=>{
 if(sharedPanelOpen||openingPending||round?.replay)return;
 if(e.composedPath().some(n=>n?.matches?.('button,input,select,textarea')))return;
 if(!$('win-overlay').hidden){if(e.key==='Escape'){e.preventDefault();closeWin();}if(e.key==='Tab'){const buttons=[...$('win-overlay').querySelectorAll('button')].filter(b=>!b.hidden);if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===buttons.at(-1)){e.preventDefault();buttons[0].focus();}}if(e.code==='Space'&&document.activeElement.tagName!=='BUTTON'){e.preventDefault();closeWin();}return;}
 if(!$('bet-popover').hidden&&e.key==='Tab'){const buttons=[...$('bet-popover').querySelectorAll('button')];if(e.shiftKey&&document.activeElement===buttons[0]){e.preventDefault();buttons.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===buttons.at(-1)){e.preventDefault();buttons[0].focus();}return;}
 if(!$('modal-backdrop').hidden){if(e.key==='Escape')closeModal();if(e.key==='Tab'){const f=[...$('modal-backdrop').querySelectorAll('button,input,select,[tabindex="0"]')].filter(el=>!el.disabled),first=f[0],last=f.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}return;}
 if(e.key==='Escape')closeBet();if(e.code==='Space'&&!e.repeat&&!['INPUT','BUTTON','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();handlePlay();}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){audio.pause();}else{last=performance.now();acc=0;audio.resume();}});
function burst(x,y,count,color,speed=250,kind='spark'){
 for(let i=0;i<count;i++){const a=Math.random()*Math.PI*2,v=speed*(.25+Math.random()*.75);particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-60,life:.4+Math.random()*.5,max:.9,size:2+Math.random()*5,color,kind,rot:Math.random()*6.28});}
 if(particles.length>450)particles.splice(0,particles.length-450);
}
function impactRing(x,y,color,size=100){rings.push({x,y,life:.45,max:.45,color,size});}
function handleEvents(){
 for(const e of round.events.splice(0)){
  chickenRig.impulse(e.type);
  if(e.type==='strike'){flightFeedback.hit('strike',e,round.p,round.previous);audio.event('strike');shake=5;squash=.32;boost=1.1;boostColor='#ffb52e';flash=0;burst(round.p.x,round.p.y,30,'#ffe37b',410);impactRing(round.p.x,round.p.y,'#fff5bd',118);}
  if(e.type==='miss'){audio.event('miss');streakWord={text:'WHIFF!',x:770,y:415,life:.8};}
  if(e.type==='pickup'){flightFeedback.hit(e.multiplied?'multiply':'pickup',e,round.p,round.previous);audio.event(e.multiplied?'multiply':'pickup');boost=.95;boostColor=flightFeedback.color;squash=.15;burst(e.x,e.y,e.multiplied?24:16,boostColor,240);impactRing(e.x,e.y,boostColor,e.multiplied?110:85);}
  if(e.type==='bird'){flightFeedback.hit('bird',e,round.p,round.previous);audio.event('bird');boost=.8;boostColor='#ff4b45';shake=1.5;squash=.19;burst(e.x,e.y,15,'#fff9e9',190,'feather');impactRing(e.x,e.y,'#ff4b45',80);}
  if(e.type==='bounce'){flightFeedback.hit('bounce',e,round.p,round.previous);audio.event('bounce');shake=Math.min(7,e.impact/100);squash=.5;burst(e.x,e.y,24,'#b4d568',220,'snow');snowMarks.push({x:e.x,y:GROUND+4,length:95,life:4});}
  if(e.type==='slide'){flightFeedback.hit('slide',e,round.p,round.previous);squash=.3;burst(e.x,e.y,12,'#a1c454',160,'snow');}
  if(e.type==='rock'){flightFeedback.hit('rock',e,round.p,round.previous);audio.event('rock');shake=7;flash=.04;boost=0;squash=.65;burst(e.x,e.y,38,'#fff0cc',330,'feather');impactRing(e.x,e.y,'#ff9b71',135);}
  if(e.type==='icicle'){flightFeedback.hit('rock',e,round.p,round.previous);audio.event('rock');shake=5;boost=0;squash=.5;trail=[];burst(e.x,e.y,30,'#bc915b',220,'ice');impactRing(e.x,e.y,'#eaffff',105);}
  if(e.type==='splash'){flightFeedback.hit('splash',e,round.p,round.previous);audio.event('splash');shake=4;boost=0;trail=[];waterReaction={owner:round,x:e.x,age:0,sprayed:false};}
  if(e.type==='score')$('multiplier').textContent=e.score.toFixed(2)+'×';
  if(e.type==='settle'){
   if(!round.preview&&Date.now()<(window.regional?.nextAt||0)){round.regionalPending=true;round.events.push(e);continue;}round.regionalPending=false;
   const celebrate=e.payout>0&&(round.preview||!window.regional||window.regional.id==='demo'||round.payoutCents>(round.chargeCents??round.stakeCents));
   settledAt=clock;recoveryAt=clock;
   if(!round.preview){balanceCents+=round.payoutCents;sessionPaid+=round.payoutCents;sessionBet+=round.stakeCents;stats.n++;stats.stake+=round.stakeCents;stats.paid+=round.payoutCents;history.unshift({...round.regional,currency:currencyPreset.currency,number:roundNumber,stake:activeStake,rtp:round.math.rtp,seed:round.seed,config:{...round.config},outcome:{...round.outcome},pigIndex:round.pigIndex,timestamp:Date.now(),balanceBefore:round.balanceBefore,balanceAfter:balanceCents/100,...e});history=history.slice(0,60);window.regional?.settle(round.payoutCents/100);if(e.payout>0)$('last-win').textContent=money(e.payout);}
   if(autoEnabled&&!round.preview){autoLeft=Math.max(0,autoLeft-1);const reason=window.HuffAutoplayRules?.reason(autoSession,balanceCents,round.payoutCents);if(reason||autoLeft===0){autoEnabled=false;autoLeft=0;autoSession=null;if(reason)toast('Autoplay stopped. '+reason+'.');}}
   $('result').classList.toggle('loss',e.payout===0);
   $('result-label').textContent=round.replay?'ROUND REPLAY':round.preview?'ANIMATION PREVIEW':e.cause==='dead'?'MISSED SWING':e.payout>0?(celebrate?(winTier(e.multiplier)?.label.toUpperCase()||'YOU WIN'):'RETURN'):'ROUND OVER';
   $('result-value').textContent=e.payout>0?money(e.payout):e.cause==='dead'?'SWING & A MISS':e.cause==='water'?'SPLASH!':e.cause==='icicle'?'STUMPED!':'HARD COLLISION!';
   $('result-value').style.fontSize=['dead','icicle'].includes(e.cause)?'23px':'';
   $('result-extra').textContent=round.preview?'No credits used':e.cause==='dead'?'The batter missed. No win this round.':e.distance+' m · '+(e.payout>0?e.multiplier.toFixed(2)+'×':'No win this round');
   const delay=ReferenceMotionModel.resultDelay(e.cause,e.payout,reduced);
   if(delay){$('result').classList.remove('show');pendingWin={owner:round,at:clock+delay,multiplier:e.multiplier,payout:e.payout,preview:round.preview};updateControls();}
   else revealRoundResult(e.multiplier,e.payout,round.preview);
   if(e.payout>0&&!reduced)burst(round.p.x,GROUND-8,18,'#ffe477',120);
   if($('session-stats'))$('session-stats').innerHTML=`Played since last maths change: <strong>${stats.n}</strong> rounds · Observed return: <strong>${stats.stake?(stats.paid/stats.stake*100).toFixed(2)+'%':'—'}</strong><br>Actual credits returned ÷ credits bet. This fluctuates; it is not the theoretical RTP.`;
  }
 }
}
function springCamera(dt){
 const moving=round&&round.state!=='windup'&&round.outcome.kind!=='dead',home=645-width/2;
 const targetX=moving?Math.max(home,round.p.x-width*.51):home,targetVX=moving&&targetX>home?round.p.vx:0;
 let targetY=moving?Math.max(0,305-round.p.y):0,targetVY=moving&&targetY>0?-round.p.vy:0;
 if(round?.state==='sinking'||round?.state==='crash'||round?.state==='caught'||round?.state==='settled'){targetY=0;targetVY=0;}
 cam.vx+=((targetX-cam.x)*64+(targetVX-cam.vx)*16)*dt;cam.vy+=((targetY-cam.y)*49+(targetVY-cam.vy)*14)*dt;cam.x+=cam.vx*dt;cam.y+=cam.vy*dt;
}
function stepEffects(dt){
 if(waterReaction){if(waterReaction.owner!==round)waterReaction=null;else{waterReaction.age+=dt;if(!waterReaction.sprayed&&waterReaction.age>=.2){waterReaction.sprayed=true;if(!reduced)burst(waterReaction.x,GROUND-10,26,'#cbf5ff',310,'water');}}}
 flightFeedback.step(dt,round?.p,round?.state||'idle');
 chickenRig.flightMotion=reduced?null:flightFeedback.sample(1);
 chickenRig.step(dt,round?.p,round?.outcome.kind==='dead'?'idle':round?.state==='settled'?({ice:'win',water:'sinking',icicle:'crash',rock:'crash'}[round.terminalCause]||'idle'):round?.state||'idle');
 shake*=Math.exp(-14*dt);squash*=Math.exp(-12*dt);flash=Math.max(0,flash-dt);boost=Math.max(0,boost-dt);
 for(const p of particles){p.life-=dt;p.vy+=(p.kind==='snow'||p.kind==='ice'||p.kind==='water'?670:110)*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=Math.exp(-1.5*dt);p.rot+=dt*3;}
 particles=particles.filter(p=>p.life>0);for(const r of rings)r.life-=dt;rings=rings.filter(r=>r.life>0);
 for(const s of snowMarks)s.life-=dt;snowMarks=snowMarks.filter(s=>s.life>0);
 if(round?.state==='flight'){
  trail.push({x:round.p.x,y:round.p.y,life:.34,color:flightFeedback.color,hot:boost>0});
  if(boost>0&&Math.random()<.18)burst(round.p.x-25,round.p.y,1,boostColor,45);
 }else if(round?.state==='slide'&&round.p.vx>50&&!reduced){
  if(Math.random()<.65){particles.push({x:round.p.x-38,y:GROUND-3,vx:-Math.random()*110-round.p.vx*.2,vy:-Math.random()*90,life:.35,max:.4,size:1+Math.random()*3,color:'#aec96a',kind:'snow',rot:0});}
  if(Math.random()<.4)snowMarks.push({x:round.p.x-45,y:GROUND+1,length:25+Math.random()*30,life:2});
 }
 for(const t of trail)t.life-=dt;trail=trail.filter(t=>t.life>0).slice(-80);
}
function imageAt(name,x,y,w,h){const a=art[name];if(a)ctx.drawImage(a,x,y,w??a.width,h??a.height);}
function shadow(x,y,rx,ry,alpha=.2){ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle='#326880';ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();ctx.restore();}
function glow(x,y,r,color,alpha=.5){ctx.save();ctx.globalAlpha=alpha;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,color+'00');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();}
function stroked(text,x,y,size=35,color='#ffdf29',stroke='#433213',line=5){ctx.save();ctx.font=`900 italic ${size}px Arial, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.strokeStyle=stroke;ctx.lineWidth=line;ctx.strokeText(text,x,y);ctx.fillStyle=color;ctx.fillText(text,x,y);ctx.restore();}
function sparkle(x,y,size,color,alpha=1,rotation=0){ctx.save();ctx.translate(x,y);ctx.rotate(rotation);ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,-size);ctx.lineTo(size*.24,-size*.24);ctx.lineTo(size,0);ctx.lineTo(size*.24,size*.24);ctx.lineTo(0,size);ctx.lineTo(-size*.24,size*.24);ctx.lineTo(-size,0);ctx.lineTo(-size*.24,-size*.24);ctx.closePath();ctx.fill();ctx.restore();}
function multiplierSunburst(x,y,phase){
 const pulse=reduced?1:1+Math.sin(clock*2+phase)*.035;
 glow(x,y,70*pulse,'#ffe843',.62);
 ctx.save();ctx.translate(x,y);ctx.rotate(phase+(reduced?0:clock*.09));ctx.scale(pulse,pulse);
 const rays=ctx.createRadialGradient(0,0,12,0,0,83);
 rays.addColorStop(0,'#fff66eb3');rays.addColorStop(.4,'#ffe52b75');rays.addColorStop(1,'#ffe52b00');ctx.fillStyle=rays;
 for(let i=0;i<14;i++){
  const a=i*Math.PI*2/14,r=i%2?70:83,spread=i%2?.085:.13;
  ctx.beginPath();ctx.moveTo(Math.cos(a)*10,Math.sin(a)*10);ctx.lineTo(Math.cos(a-spread)*r,Math.sin(a-spread)*r);ctx.lineTo(Math.cos(a+spread)*r,Math.sin(a+spread)*r);ctx.closePath();ctx.fill();
 }
 ctx.restore();
}
function drawBackground(){
 const cameraLift=Math.max(0,cam.y),horizonY=359+cameraLift*.72;
 const sky=ctx.createLinearGradient(0,0,0,height);sky.addColorStop(0,'#64b8e0');sky.addColorStop(.6,'#a7d8e8');sky.addColorStop(1,'#e4eec7');ctx.fillStyle=sky;ctx.fillRect(0,0,width,height);
 // Sky fills the entire viewport at every camera altitude; the ballpark fades into it.

 const tile=1280,offset=((cam.x*.22)%tile+tile)%tile;
 for(let x=-offset-tile;x<width;x+=tile){ctx.save();if(Math.abs(Math.round((x+offset)/tile))%2){ctx.translate(x+tile,0);ctx.scale(-1,1);imageAt('horizon.webp',0,horizonY-500,tile,650);}else imageAt('horizon.webp',x,horizonY-500,tile,650);ctx.restore();}
 const snowY=horizonY+141;
 if(snowY<height){const snow=ctx.createLinearGradient(0,snowY,0,snowY+285);snow.addColorStop(0,'#83b747');snow.addColorStop(.3,'#689e39');snow.addColorStop(1,'#3d752e');ctx.fillStyle=snow;ctx.fillRect(0,snowY,width,height-snowY);}
 // Ice streaks occupy the physical ground and provide a speed reference.
 const gy=GROUND+cam.y;
 ctx.save();ctx.strokeStyle='#a9cc69';ctx.lineCap='round';
 for(let n=Math.floor(cam.x/210)-1;n<(cam.x+width)/210+1;n++){
  const seed=Math.abs(Math.sin(n*78.12)),x=n*210-cam.x+seed*85,y=gy+10+(seed-.3)*53;
  ctx.globalAlpha=.45;ctx.lineWidth=3+seed*4;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+24+seed*42,y);ctx.stroke();
  ctx.globalAlpha=.18;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+30,y+22);ctx.lineTo(x+95+seed*40,y+22);ctx.stroke();
 }
 ctx.restore();
 // Sparse foreground flakes drift at a separate depth.

}
function drawPickups(){
 if(!round)return;
 for(const item of round.pickups){if(item.hit)continue;let x=item.x-cam.x,y=item.y+cam.y;if(x< -90||x>width+100||y< -90||y>height+100)continue;
  const bob=Math.sin(clock*2.7+item.phase)*3;
  if(item.type==='bird'||item.type==='dynamite'){
   ctx.save();ctx.translate(x,y);const flap=1+Math.sin(clock*3+item.phase)*.025;ctx.scale(flap,flap);const bird=art['bird.png'],bw=108,bh=bw*bird.height/bird.width;imageAt('bird.png',-bw/2,-bh/2+bob,bw,bh);ctx.restore();
   if(item.type==='dynamite'){glow(x,y,48,'#ff482a',.24);ctx.fillStyle='#c91b2d';ctx.beginPath();ctx.roundRect(x-8,y+10,27,12,3);ctx.fill();sparkle(x+24,y+9,5,'#ffe780',.8,clock*4);}
  }else if(item.type==='multiply'){
   multiplierSunburst(x,y+bob,item.phase);
   stroked('x'+item.value,x,y+bob,50,'#fff044','#a95818',5);
  }else{
   const symbolScale=({1:.8,2:.95,5:1.08,10:1.2})[item.value]||1;
   ctx.save();ctx.translate(x,y+bob);ctx.scale(symbolScale,symbolScale);
   glow(0,0,55,'#ffdc75',.4);imageAt('hard-hat.png',-49,-45,98,88);stroked(String(item.value),0,6,36,'#fffbea','#6d380d',4);
   ctx.restore();
  }
 }
}
function readableBadge(text,x,y,color='#fff4d6',background='#10283f'){ctx.save();ctx.font='900 23px Arial';const w=ctx.measureText(text).width+20;ctx.fillStyle=background;ctx.strokeStyle='#fff2d5';ctx.lineWidth=2;ctx.beginPath();ctx.roundRect(x-w/2,y-18,w,36,8);ctx.fill();ctx.stroke();ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,x,y+1);ctx.restore();}
function drawObstacles(){
 if(!round)return;
 for(const o of round.obstacles){const x=o.x-cam.x,y=GROUND+cam.y;if(x< -240||x>width+240)continue;
  if(o.type==='icicle'){imageAt('icicle.png',x-70,y-150,140,170);}
  else imageAt('hole.png',x-146,y-20,302,95);
 }
}
function drawEffectsBehind(){
 for(const mark of snowMarks){ctx.save();ctx.globalAlpha=Math.min(.5,mark.life*.25);ctx.strokeStyle='#b6cf7b';ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(mark.x-cam.x,mark.y+cam.y);ctx.lineTo(mark.x-cam.x-mark.length,mark.y+cam.y);ctx.stroke();ctx.restore();}
 // A tapered ribbon follows the exact sampled route, with the most recent impact colour.
 for(let i=1;i<trail.length;i++){
  const a=trail[i-1],b=trail[i],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;
  const fa=clamp(a.life/.34,0,1),fb=clamp(b.life/.34,0,1),wa=(a.hot?25:10)*fa,wb=(b.hot?25:10)*fb;
  ctx.save();ctx.globalAlpha=fb*(b.hot?.46:.12);ctx.fillStyle=b.color;ctx.beginPath();ctx.moveTo(a.x-cam.x+nx*wa,a.y+cam.y+ny*wa);ctx.lineTo(b.x-cam.x+nx*wb,b.y+cam.y+ny*wb);ctx.lineTo(b.x-cam.x-nx*wb,b.y+cam.y-ny*wb);ctx.lineTo(a.x-cam.x-nx*wa,a.y+cam.y-ny*wa);ctx.closePath();ctx.fill();ctx.restore();
 }
 for(const r of rings){const t=1-r.life/r.max,eased=1-(1-t)**3;ctx.save();ctx.globalAlpha=(1-t)**1.4*.72;ctx.strokeStyle=r.color;ctx.shadowColor=r.color;ctx.shadowBlur=18;ctx.lineWidth=9*(1-t)+1;ctx.beginPath();ctx.arc(r.x-cam.x,r.y+cam.y,15+eased*r.size*.7,0,Math.PI*2);ctx.stroke();ctx.restore();}

}
function drawParticles(){
 for(const p of particles){const x=p.x-cam.x,y=p.y+cam.y;if(x< -20||x>width+20||y>height+30)continue;const fade=clamp(p.life/(p.max||.9),0,1);
  if(p.kind==='spark')sparkle(x,y,p.size,p.color,fade,p.rot);
  else {ctx.save();ctx.translate(x,y);ctx.rotate(p.rot);ctx.globalAlpha=fade;ctx.fillStyle=p.color;if(p.kind==='water'){ctx.beginPath();ctx.ellipse(0,0,p.size*.65,p.size*1.4,0,0,6.28);ctx.fill();}else if(p.kind==='feather'){ctx.fillStyle='#f6f3e4';ctx.beginPath();ctx.ellipse(0,0,p.size*.5,p.size*1.6,0,0,Math.PI*2);ctx.fill();}else ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size);ctx.restore();}
 }
}
function drawWaterReaction(){
 if(!waterReaction||waterReaction.owner!==round)return;
 const m=ReferenceMotionModel.water(waterReaction.age,reduced),x=waterReaction.x-cam.x,y=GROUND+cam.y+8;
 if(m.rippleAlpha>0){ctx.save();ctx.strokeStyle='#dbffff';ctx.lineWidth=3;ctx.globalAlpha=m.rippleAlpha;for(let i=0;i<3;i++){const radius=30+m.ripple*100+i*17;ctx.beginPath();ctx.ellipse(x,y+4,radius,radius*.14,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha*=.64;}ctx.restore();}
 if(m.crown<=0)return;
 const h=114*m.crown,w=96*(.8+waterReaction.age*.45);ctx.save();ctx.translate(x,y);ctx.globalAlpha=m.crown*.8;
 const fill=ctx.createLinearGradient(0,-h,0,10);fill.addColorStop(0,'#e3ffff');fill.addColorStop(.35,'#a8eff7');fill.addColorStop(1,'#66cddb');ctx.fillStyle=fill;ctx.strokeStyle='#e4ffff';ctx.lineWidth=2;
 ctx.beginPath();ctx.moveTo(-w,0);ctx.quadraticCurveTo(-w*.95,-h*.35,-w*.9,-h*.56);ctx.quadraticCurveTo(-w*.76,-h*.74,-w*.57,-h*.34);ctx.quadraticCurveTo(-w*.46,-h*.27,-w*.35,-h*.91);ctx.quadraticCurveTo(-w*.26,-h*1.05,-w*.12,-h*.43);ctx.quadraticCurveTo(0,-h*.32,w*.12,-h*.86);ctx.quadraticCurveTo(w*.24,-h*1.18,w*.35,-h*.36);ctx.quadraticCurveTo(w*.50,-h*.21,w*.65,-h*.65);ctx.quadraticCurveTo(w*.83,-h*.82,w*.90,-h*.34);ctx.quadraticCurveTo(w*.91,-h*.15,w,0);ctx.quadraticCurveTo(0,17,-w,0);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
}
function drawStart(){
 art.idleActive=!round;
 const x=-cam.x,y=cam.y-36;if(x+920<0||x+330>width)return;
 shadow(x+636,y+629,240,32,.08);imageAt('cliff.png',x+455,y+265,300,373);
 shadow(x+590,cam.y+640,89,13,.18);
 const phase=round?round.time:-1,miss=round?.outcome.kind==='dead',elapsed=round?.state==='settled'?clock-settledAt:Math.max(0,(round?.time||0)-.92);
 if(batterTexture)drawBatter(ctx,batterTexture,x+590,cam.y+640,phase,miss,elapsed,clock);
 if(!round){shadow(x+645,cam.y+275,26,7,.2);drawChicken(ctx,art,x+645,cam.y+210+(reduced?0:Math.sin(clock*1.9)*1.5),reduced?0:Math.sin(clock*.9)*.018,142,'idle',clock,0,chickenRig);}
 // Keep the sign clear of the batter and draw it in the foreground.
 const sign=art['home-sign'];if(sign){const sw=Math.min(125,width*.21),sh=sw*sign.height/sign.width,sx=x+645-Math.min(320,width*.34)-sw/2,sy=cam.y+640-sh;imageAt('home-sign',sx,sy,sw,sh);ctx.save();ctx.font=`900 ${Math.max(12,sw*.145)}px Arial, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff3cf';ctx.strokeStyle='#66380e';ctx.lineWidth=2;const distance=Math.max(0,Math.round(history[0]?.distance||0))+' m';ctx.strokeText(distance,sx+sw*.5,sy+sh*.55,sw*.72);ctx.fillText(distance,sx+sw*.5,sy+sh*.55,sw*.72);ctx.restore();}
}
function drawChickenInFlight(){
 if(!round)return;const alpha=clamp(acc/STEP,0,1),a=round.previous||round.p,b=round.p,p={...b,x:mix(a.x,b.x,alpha),y:mix(a.y,b.y,alpha),angle:a.angle+Math.atan2(Math.sin(b.angle-a.angle),Math.cos(b.angle-a.angle))*alpha},x=p.x-cam.x,y=p.y+cam.y;
 if(round.state==='windup'||round.outcome.kind==='dead'){shadow(645-cam.x,275+cam.y,26,7,.2);const missed=round.outcome.kind==='dead'&&round.state==='settled',fall=missed&&!reduced?Math.min(1,(clock-settledAt)/.45):0;drawChicken(ctx,art,x+fall*60,y+fall*340,reduced&&missed?Math.PI/2:p.angle,142,missed?'crash':'idle',clock,0,chickenRig);return;}
 const sink=round.state==='sinking'||round.state==='settled'&&round.terminalCause==='water';
 if(sink){const m=ReferenceMotionModel.water(waterReaction?.owner===round?waterReaction.age:Infinity,reduced);if(m.visible){ctx.save();ctx.beginPath();ctx.rect(x-200,-2000,400,GROUND+cam.y+2008);ctx.clip();drawChicken(ctx,art,x,GROUND+cam.y+m.offsetY,0,132,'sinking',clock,0,chickenRig,{...m,weights:[0,1,0,0,0,0]});ctx.restore();}return;}
 const altitude=Math.max(0,GROUND-p.y-34);shadow(x,GROUND+cam.y+3,Math.max(14,43-altitude*.035),Math.max(4,9-altitude*.006),.17*clamp(1-altitude/680,0,1));
 if(round.state==='flight'){
  const power=clamp(flightFeedback.pulse,0,1);glow(x,y,65,flightFeedback.color,.22+power*.32);
  if(power>.035&&!reduced){ctx.save();ctx.translate(x,y);ctx.rotate(Math.atan2(p.vy,p.vx));const length=flightFeedback.kind==='strike'?180:100;const g=ctx.createLinearGradient(-length,0,15,0);g.addColorStop(0,flightFeedback.color+'00');g.addColorStop(.62,flightFeedback.color+'a0');g.addColorStop(1,'#fff5c700');ctx.fillStyle=g;ctx.globalAlpha=power*.8;ctx.beginPath();ctx.moveTo(-length,0);ctx.quadraticCurveTo(-45,-38,15,-24);ctx.lineTo(15,24);ctx.quadraticCurveTo(-45,38,-length,0);ctx.fill();ctx.restore();}
 }
 const motion=flightFeedback.sample(alpha);chickenRig.flightMotion=reduced?null:motion;
 const caught=round.state==='caught'||round.terminalCause==='icicle';
 let angle=(caught&&reduced?.28:caught?p.angle:reduced?0:motion.angle)+Math.PI/2,size=132,compression=squash;
 let poseMotion=null;
 if(round.state==='slide'){size=136;poseMotion={groundY:GROUND+cam.y+3,angle:0,compression:reduced?0:.16+squash*.3};}
 if(round.state==='settled'&&round.terminalCause==='ice'){size=136;poseMotion={...ReferenceMotionModel.recovery(clock-recoveryAt,reduced),groundY:GROUND+cam.y+3};}
 const bounds=drawChicken(ctx,art,x,y,angle,size,round.state==='settled'?({ice:'win',icicle:'crash',rock:'crash'}[round.terminalCause]||'idle'):round.state,clock,compression,chickenRig,poseMotion);
 if(!caught&&(round.state!=='settled'||round.payout>0)){
  let ly=y-85;if(poseMotion&&bounds){const dt=clamp(clock-chickenRig.groundScoreClock,0,.05);ly=ReferenceMotionModel.captionY(ly,bounds.top,bounds.groundTop,chickenRig.groundScoreY,dt,reduced);chickenRig.groundScoreY=ly;}else chickenRig.groundScoreY=null;chickenRig.groundScoreClock=clock;
  stroked(money(scoreDisplay),x,ly,35,'#ffe68a','#3e2b18',5);
  const items=round.history.slice(-3).reverse();items.forEach((h,i)=>{const hy=ly-36-i*27;if(hy<35)return;stroked(h.type==='bird'?'÷2':h.type==='multiply'?'x'+h.value:String(h.value),x,hy,27,h.type==='bird'?'#ff6b65':h.type==='multiply'?'#ffc654':'#a5ff63',h.type==='bird'?'#6e2536':h.type==='multiply'?'#714519':'#2d6335',4);});
 }
}
function draw(){
 const physicalCamera=cam;if(previousCam){const t=clamp(acc/STEP,0,1);cam={...cam,x:mix(previousCam.x,cam.x,t),y:mix(previousCam.y,cam.y,t)};}
 ctx.setTransform(dpr*scale,0,0,dpr*scale,0,0);ctx.save();const amp=reduced?0:shake;ctx.translate(Math.sin(clock*95)*amp,Math.cos(clock*79)*amp*.5);
 drawBackground();if(!assetsReady){ctx.restore();cam=physicalCamera;return;}
 drawStart();drawPickups();drawObstacles();drawEffectsBehind();drawChickenInFlight();drawWaterReaction();drawParticles();
 if(streakWord?.life>0)stroked(streakWord.text,streakWord.x-cam.x,streakWord.y+cam.y,49,'#fff0b6','#6e4233',6);
 if(flash>0&&!reduced){ctx.globalAlpha=flash*.6;ctx.fillStyle='#fff5d0';ctx.fillRect(0,0,width,height);ctx.globalAlpha=1;}ctx.restore();cam=physicalCamera;
}
function frame(now){if(reviewOpen){last=now;requestAnimationFrame(frame);return;}
 const realDt=last?Math.min((now-last)/1000,.05):.016;last=now;
 if(!document.hidden){clock+=realDt;const dt=realDt*speeds[speedIndex]*PLAYBACK_PACE;acc+=dt;let steps=0;
  while(acc>=STEP&&steps<40){previousCam={...cam};if(round&&(round.state!=='settled'||round.regionalPending)){if(round.state!=='settled')round.step(STEP);handleEvents();}springCamera(STEP);stepEffects(STEP);if(streakWord)streakWord.life-=STEP;acc-=STEP;steps++;}
  scoreDisplay=mix(scoreDisplay,(round?.score||0)*activeStake,1-Math.exp(-realDt*22));if(Math.abs(scoreDisplay-(round?.score||0)*activeStake)<.01)scoreDisplay=(round?.score||0)*activeStake;
  advanceResultPresentation();
  if(round?.state==='settled'&&!pendingWin&&autoEnabled&&autoLeft>0&&$('win-overlay').hidden&&clock-settledAt>.9&&$('modal-backdrop').hidden&&!sharedPanelOpen)startRound();
  if(round?.state==='settled'&&!pendingWin&&!round.replay&&!autoEnabled&&!returning&&$('win-overlay').hidden&&clock-settledAt>1.8){returning=true;const completed=round;canvas.style.opacity='0';setTimeout(()=>{if(round===completed&&!reviewOpen)returnHome();},180);}
  audio.update(realDt);draw();
 }requestAnimationFrame(frame);
}
// Optional agent controls share the same demo state and actions as the game UI.
function registerGameTools(){if(REVIEW_FRAME)return;
 const context=document.modelContext;if(!context?.registerTool)return;
 const lifecycle=new AbortController();
 const state=()=>({ready:assetsReady,status:round?.state||'ready',demoBalance:balanceCents/100,bet:stake,multiplier:round?.score||0,speed:speeds[speedIndex],autoplayRemaining:autoEnabled?autoLeft:0,lastWin:$('last-win').textContent});
 function validate(input){if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw Error('This action accepts an empty object.');}
 const definitions=[
  {name:'read_game_state',title:'Read game state',description:'Read the current demo balance, selected bet, round state and playback speed.',annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){validate(input);return state();}},
  {name:'start_demo_round',title:'Start a demo round',description:'Start one round using the currently selected bet. Deducts demo credits only; the result appears after the animation.',annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){
   validate(input);
   if(!assetsReady)throw Error('The game is still loading.');
   if(busy()||autoEnabled)throw Error('Wait for the current round or stop autoplay first.');
   if(!$('modal-backdrop').hidden)throw Error('Close the open game panel first.');
   if(balanceCents<Math.round(stake*100))throw Error('Not enough demo credits. Reset the balance in the menu.');
   const before=roundNumber;handlePlay();
   if(roundNumber===before)throw Error('The round could not start. Please try again.');
   return {started:true,roundNumber,...state()};
  }}
 ];
 for(const tool of definitions){try{Promise.resolve(context.registerTool({...tool,inputSchema:{type:'object',properties:{},additionalProperties:false}},{signal:lifecycle.signal})).catch(error=>console.warn('Game tools unavailable',error));}catch(error){console.warn('Game tools unavailable',error);}}
 window.addEventListener('pagehide',event=>{if(!event.persisted)lifecycle.abort();});
}
registerGameTools();
function atlasCell(image,col,row,cols,rows,crop=null){
 const base=Math.floor(image.width/cols),ch=crop?crop[3]:Math.floor(image.height/rows),sx=crop?crop[0]:col*base,sy=crop?crop[1]:row*ch,cw=crop?crop[2]:(image===batterTexture&&row===1&&col===0?795:base),c=document.createElement('canvas');c.width=cw;c.height=ch;let g=c.getContext('2d',{willReadFrequently:true});g.drawImage(image,sx,sy,cw,ch,0,0,cw,ch);
 if(image===batterTexture&&row===1){if(col===0){g.clearRect(627,0,168,275);g.clearRect(627,370,168,257);}else{g.clearRect(0,275,168,95);}}
 const cleaned=c,d=cleaned.getContext('2d').getImageData(0,0,cw,ch).data;let minX=cw,minY=ch,maxX=0,maxY=0;
 for(let y=0;y<ch;y++)for(let x=0;x<cw;x++)if(d[(y*cw+x)*4+3]>32){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
 if(minX>maxX)return cleaned;const out=document.createElement('canvas');out.width=maxX-minX+1;out.height=maxY-minY+1;out.getContext('2d').drawImage(cleaned,minX,minY,out.width,out.height,0,0,out.width,out.height);return out;
}
Promise.all(names.map(name=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{art[name]=image;resolve();};image.onerror=()=>reject(Error(name));image.src=embeddedArt[name];}))).then(()=>{
 art['horizon.webp']=prepareHorizon(art['horizon.webp']);
 art.pigTeams={};art.reduced=reduced;art.officialCharacters=true;
 const teamCrops=[[0,0,475,530],[475,0,595,490],[1070,0,466,490],[0,560,625,464],[625,500,455,524],[1080,490,456,534]];
 for(const [id,key] of [['straw','pig-straw'],['wood','chicken/rig-atlas.png'],['brick','pig-brick']]){const sprite=atlasCell(art[key],0,0,1,1);art.pigTeams[id]=Array(6).fill(sprite);}
 selectPig(1);
 batterTexture=art['johnny-sheet.png'];batterTexture.reducedMotion=reduced;batterTexture.officialCharacter=true;batterTexture.penguinPoses=Array(4).fill(art['johnny-sheet.png']);
 ['hard-hat.png','icicle.png','hole.png','cliff.png'].forEach((name,i)=>{art[name]=atlasCell(art['props.png'],i%2,Math.floor(i/2),2,2);});
 art['hard-hat.png']=atlasCell(art['official-hat'],0,0,1,1);
 art['bird.png']=atlasCell(art['bird.png'],0,0,1,1);
 art['home-sign']=atlasCell(art['home-sign'],0,0,1,1);
 $('logo').hidden=true;document.querySelector('.brand').hidden=false;
 assetsReady=true;$('loading').hidden=true;resize();updateControls();
}).catch(error=>{if(REVIEW_FRAME)parent.postMessage({type:'fixture-error',message:'Artwork could not load. Use Replay to retry.'},'*');loadingError='An image could not load. Refresh to try again.';$('loading').textContent=loadingError;updateControls();console.error(error);});

function openOutcomes(){
 if(REVIEW_FRAME||pendingWin)return;stopAuto(false);clearTimeout(holdTimer);closeModal();reviewOpen=true;audio.pause();
 const host=document.createElement('div');host.id='core-flow-host';host.setAttribute('role','dialog');host.setAttribute('aria-modal','true');host.setAttribute('aria-label','Core Flow Testing');
 const frame=document.createElement('iframe');frame.src='outcomes.html';frame.title='Core Flow Testing';host.append(frame);document.body.append(host);$('game').inert=true;frame.focus();
 function closeReview(e){if(e.source!==frame.contentWindow||e.data?.type!=='close-core-flow')return;window.removeEventListener('message',closeReview);host.remove();$('game').inert=false;reviewOpen=false;returning=false;last=performance.now();acc=0;audio.resume();updateControls();$('menu').focus();}
 window.addEventListener('message',closeReview);
}
if(REVIEW_FRAME){
 soundOn=false;updateSound();
 const notify=()=>parent.postMessage({type:'fixture-next'},'*');
 const messages={
 loading:['Opening the ballpark…','Preparing game artwork.','Finish loading'],
 tutorial:['Choose your bet','Choose your bet, then press Play.','Next'],
 'tutorial-objective':['Collect rewards','Number pickups add value. Multipliers increase the running total.','Next'],
 'tutorial-hazards':['Watch the hazards','Seagulls halve the running total. Water and broken tree stumps end the round with no return, losing any running total. A safe landing settles the result.','Finish tutorial'],
 submitting:['Submitting bet…','Requested cost: $1.00. Acceptance is not yet confirmed.','Receive response'],
 accepted:['Bet accepted','Accepted cost: $1.00. Reference: REVIEW-001.','Launch'],
 resolving:['Resolving round','The animation is finishing. Wait for the settled receipt.','Show result'],
 funds:['Not enough demo credits','Balance: $0.20. Requested cost: $1.00. Shortfall: $0.80. No debit made.','Choose affordable bet'],
 rejected:['Bet not accepted','This request was rejected. No credits were deducted.','Return to ready'],
 timeout:['Result not yet known','Request REVIEW-001 may have been accepted. Check this request before starting another.','Check status'],
 checking:['Checking REVIEW-001','Looking up the existing request. No second bet will be submitted.','Receive status'],
 pending:['Still pending','REVIEW-001 has no final result yet. New bets remain locked.','Check again'],
 connection:['Connection lost','The last known round is REVIEW-001. Its outcome has not been confirmed.','Reconnect'],
 restored:['Connection restored','Round REVIEW-001 is active. Continue without paying another stake.','Resume round'],
 offline:['Still offline','Status cannot be confirmed. No new bet has been placed.','Check again'],
 resume:['Welcome back','Check the existing round before continuing.','Check round'],
 resumed:['Round recovered','Resume REVIEW-001 at its saved local checkpoint. No additional stake.','Resume'],
 'recovered-result':['Round completed while away','REVIEW-001 settled. Accepted cost $1.00 · Total return $5.00 · Net +$4.00. This receipt does not credit again.','Continue'],
 expired:['Checkpoint unavailable','The local checkpoint cannot be restored. This preview does not imply the round was lost.','Return to index'],
 error:['Something went wrong','No new request was sent. Retry this safe operation.','Try again'],
 'load-error':['The ballpark could not load','An artwork file is unavailable. Your balance has not changed.','Retry loading'],
 'wallet-stale':['Balance unavailable','A refreshed balance could not be confirmed. New bets are locked.','Check balance'],
 maintenance:['Temporarily unavailable','The service is unavailable. Existing round status must be checked before another bet.','Check status'],
 'autoplay-stopped':['Autoplay stopped','No further rounds are queued. The current round finishes normally.','Continue']
 };
 function fixture(id,multiplier){
  cancelResultPresentation();clearTimeout(winTimer);cancelAnimationFrame(winAnimation);clearTimeout(toastTimer);clearTimeout(holdTimer);autoEnabled=false;autoLeft=0;closeWin();closeModal();returnHome(true);$('loading').hidden=true;document.body.classList.remove('review-reduced');
  const next=()=>notify();
  if(id==='ready')return;
  if(id==='stake-selector'){openBet();return;}
  if(id==='rules'){openRules();return;}
  if(id==='menu'||id==='sound'){openMenu();return;}
  if(id==='tuning'){openTuning();return;}
  if(id==='history'){openHistory();return;}
  if(id==='autoplay'){openAuto();return;}
  if(id==='speed'){toast('Use the speed control to cycle normal, 2× and 3×. Preview only.');return;}
  if(id==='autoplay-active'){autoEnabled=true;autoLeft=10;startRound({kind:'win',multiplier:2});updateControls();return;}
  if(['active','hazard','resumed','miss','water','icicle','rock'].includes(id)){
   startRound({kind:({miss:'dead',water:'water',icicle:'icicle',rock:'rock'})[id]||'win',multiplier:['miss','water','icicle','rock'].includes(id)?0:5});return;
  }
  if(Number.isFinite(multiplier)||id==='reduced-motion'){
   const m=id==='reduced-motion'?25:multiplier;stake=1;activeStake=1;updateControls();
   if(m>=5){showWin(m,m,true);if(id==='reduced-motion'){document.body.classList.add('review-reduced');finishWinCount();}return;}
   $('result-label').textContent=m===0?'NO RETURN':m<1?'PARTIAL RETURN':m===1?'BREAK-EVEN':'YOU WIN';$('result-value').textContent=money(m);$('result-extra').textContent='Settled preview · Cost $1.00 · Net '+money(m-1);$('result').classList.toggle('loss',m<=1);$('result').classList.add('show');return;
  }
  const content=messages[id];if(content){openModal(content[0],'<p>'+content[1]+'</p><p class="muted-text">Isolated review fixture · no wallet or server changes</p><button class="action" id="fixture-action">'+content[2]+'</button>');$('fixture-action').onclick=next;}
 }
 window.addEventListener('message',e=>{if(e.source!==parent||e.data?.type!=='core-fixture'||!assetsReady)return;try{fixture(e.data.id,e.data.multiplier);}catch(err){openModal('Preview unavailable','<p>This fixture could not render. Choose another outcome or replay.</p>');parent.postMessage({type:'fixture-error',message:String(err.message)},'*');}});
 const readyTimer=setInterval(()=>{if(assetsReady){clearInterval(readyTimer);parent.postMessage({type:'fixture-ready'},'*');}},100);
}

// Narrow UI bridge: the original engine remains the owner of all round state.

window.huffUI={
 setCurrency(p){if(busy()||autoEnabled||round?.replay||!$('win-overlay').hidden)return false;
 currencyPreset=p;betSteps=[...p.steps];stake=activeStake=p.stake;balanceCents=Math.round(p.balance*100);history=[];roundNumber=0;sessionPaid=sessionBet=0;stats={n:0,stake:0,paid:0};returnHome();$('last-win').textContent=money(0);$('session-result').textContent=money(0);updateControls();return true;},
 refreshLocale(){$('last-win').textContent=money(history.find(r=>r.payout>0)?.payout||0);updateControls();},
 read:()=>({currency:currencyPreset.currency,minStake:betSteps[0],maxStake:betSteps.at(-1),replaying:!!round?.replay,replayRecord:round?.replayRecord||null,replayPlaying:!!round?.replay&&round.state!=='settled',sound:soundOn,music:musicOn,rtp:activeMath.rtp,ready:assetsReady,openingPending,loadingError,logo:new URL('assets/official-hnp-v1/logo.webp',location.href).href,hero:$('win-penguin').src,busy:busy(),winOpen:!$('win-overlay').hidden,stake,stakes:[...betSteps],balance:balanceCents/100,speed:speeds[speedIndex],speeds:[...speeds],autoplayActive:autoEnabled,remaining:autoLeft,roundNumber}),
 exitReplay(){if(!round?.replay)return;returnHome();},
 rounds:()=>history.map(r=>({...r})),
 replay(number){const r=history.find(r=>r.number===Number(number));if(!r||round?.replay||busy()||!$('win-overlay').hidden)return false;stopAuto(false);startRound(r.outcome,r.config,r);return !!round?.replay;},
 play(){if(!reviewOpen&&!sharedPanelOpen&&$('modal-backdrop').hidden)handlePlay();},
 stake(value){if(!round?.replay&&!busy()&&!autoEnabled&&$('win-overlay').hidden&&betSteps.includes(value)){stake=value;activeStake=value;updateControls();}},
 speed(value){if(window.regional&&!window.regional.speeds.includes(value))return;const i=speeds.indexOf(value);if(i<0)return;speedIndex=i;$('speed-value').textContent=value+'×';$('speed-value').hidden=i===0;$('turbo').classList.toggle('active',i>0);$('turbo').setAttribute('aria-label','Game speed: '+value+' times');updateControls();},
 start(settings){if(window.regional&&!window.regional.autoAllowed(Number(settings.rounds)))return;if(openingPending||!assetsReady||busy()||autoEnabled||!$('win-overlay').hidden||!$('modal-backdrop').hidden||![10,25,50,100].includes(settings.rounds)){updateControls();return;}try{autoSession=window.HuffAutoplayRules.create(settings,Math.round(stake*100),balanceCents);}catch(error){toast(error.message);updateControls();return;}autoLeft=settings.rounds;autoEnabled=true;startRound();},
 panelOpen(open){sharedPanelOpen=!!open;},
 tool(action){const ids={history:'menu-history',outcomes:'menu-outcomes',tuning:'menu-tuning',wins:'menu-wins',fullscreen:'menu-fullscreen',reset:'menu-reset'};if(!ids[action])return;openMenu();$(ids[action]).click();},
 music(enabled){audio.init();musicOn=!!enabled;},
 audioPreference(enabled){soundOn=!!enabled;musicOn=!!enabled;audio.init();updateSound();},
 sound(enabled){soundOn=enabled;audio.init();updateSound();},
 finishOpening(){openingPending=false;if(window.regional?.profile.minimumStake&&!roundNumber)stake=betSteps[0];updateControls();},
 stop(){stopAuto();}
};

requestAnimationFrame(frame);

})();
