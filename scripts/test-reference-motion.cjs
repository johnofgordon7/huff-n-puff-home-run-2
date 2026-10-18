const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),{createHash}=require('crypto');
const source=fs.readFileSync('dist/game.js','utf8'),normal=s=>s.replace(/\r\n/g,'\n');
// Approved source: f4e29c167478664fd7f2a4087d34bbe4e1f9380e. Normalize line endings only.
const hash=s=>createHash('sha256').update(normal(s)).digest('hex');
// Compare the complete mathematics, RNG, route compilation, physics and rig data.
assert.equal(hash(source.slice(0,source.indexOf('// Curves distilled'))),'48b6f90e41eba4c838b7c3025b57e1170a7d981f818d04eeff9b60bc54798217');
const financial=s=>normal(s).split('\n').find(line=>line.includes('if(!round.preview){balanceCents+=round.payoutCents;'));
// History now records replay metadata; verify the wallet/statistics behaviour directly.
for(const preview of [false,true]){
 const ctx={round:{preview,payoutCents:250,stakeCents:100,math:{rtp:96},seed:42,config:{},outcome:{},pigIndex:1,balanceBefore:10},balanceCents:900,sessionPaid:0,sessionBet:0,stats:{n:0,stake:0,paid:0},history:[],roundNumber:1,activeStake:1,e:{payout:2.5},currencyPreset:{currency:'USD'},window:{},$:()=>({textContent:''}),money:String};
 vm.createContext(ctx);vm.runInContext(financial(source),ctx);assert.equal(ctx.balanceCents,preview?900:1150);assert.equal(ctx.stats.n,preview?0:1);assert.equal(ctx.sessionBet,preview?0:100);assert.equal(ctx.history.length,preview?0:1);
 if(!preview){assert.equal(ctx.history[0].seed,42);assert.equal(ctx.history[0].balanceAfter,11.5);}
}

const modelSource=source.slice(source.indexOf('const ReferenceMotionModel='),source.indexOf('const ChickenRigModel='));
const feedbackSource=source.slice(source.indexOf('class FlightFeedback'),source.indexOf('const flightFeedback='));
const models={};vm.createContext(models);vm.runInContext(modelSource+feedbackSource+';globalThis.M=ReferenceMotionModel;globalThis.F=FlightFeedback;',models);const {M,F}=models;
const near=(a,b,tol=1e-9)=>assert.ok(Math.abs(a-b)<tol,`${a} ≠ ${b}`);

// Anticipation compresses into the quick swing, then gives way to recoil.
assert.ok(M.batter(.75,false,0).stretch<.95);assert.ok(M.batter(.91,false,0).shift>20);
near(M.batter(.92,false,0).shift,25);assert.ok(Math.abs(M.batter(2,false,1.08).shift)<.02);
assert.ok(M.impact(0,'strike').scaleX<.85);assert.ok(M.impact(.115,'strike').scaleX>1.15);near(M.impact(.3,'strike').scaleX,1);
near(M.birdTurn(0),0);near(M.birdTurn(M.BIRD_DURATION),Math.PI*2);near(M.birdTurn(2),Math.PI*2);
assert.ok((M.birdTurn(M.BIRD_DURATION)-M.birdTurn(M.BIRD_DURATION-1e-5))/1e-5<.01,'the full turn must ease to a stop');
near(Math.cos(M.birdTurn(M.BIRD_DURATION)),Math.cos(M.birdTurn(0)));near(Math.sin(M.birdTurn(M.BIRD_DURATION)),Math.sin(M.birdTurn(0)));
const body=Object.freeze({x:100,y:200,vx:1200,vy:300,angle:.3,omega:2.4}),incoming=Object.freeze({...body,vy:-400}),event=Object.freeze({x:100,y:200});
const feedback=new F(),before=JSON.stringify(body);feedback.hit('bird',event,body,incoming);for(let i=0;i<60;i++)feedback.step(1/120,body,'flight');near(feedback.birdOffset,Math.PI*2);assert.equal(JSON.stringify(body),before);
feedback.hit('bird',event,body,incoming);for(let i=0;i<60;i++)feedback.step(1/120,body,'flight');near(feedback.birdOffset,Math.PI*4);for(const value of Object.values(feedback.sample(.5)))assert.ok(Number.isFinite(value));
feedback.reset();for(const value of Object.values(feedback.sample(.5)))assert.ok(Number.isFinite(value));

// Recovery blends belly → tuck → upright, and ends with a planted, neutral pose.
for(let i=0;i<=160;i++){const m=M.recovery(i/100);near(m.weights.reduce((a,b)=>a+b,0),1);assert.ok(m.weights.every(v=>v>=0&&v<=1));assert.ok(m.offsetY<=0);}
assert.equal(M.recovery(0).weights[3],1);assert.equal(M.recovery(.27).weights[4],1);assert.ok(M.recovery(.51).offsetY<-25);
const planted=M.recovery(.8);assert.equal(planted.weights[5],1);near(planted.offsetY,0);near(planted.angle,0);near(planted.compression,0);
const reduced=M.recovery(0,true);assert.equal(reduced.weights[5],1);near(reduced.offsetY,0);near(reduced.angle,0);

// Execute the actual sprite draw routine and verify the shared contact plane.
const rigSource=source.slice(source.indexOf('const ChickenRigModel='),source.indexOf('// Presentation-only idle deformation'));
const rigContext={RigDataModel:{RIG_PARTS:{}},ReferenceMotionModel:M};vm.createContext(rigContext);vm.runInContext(rigSource+';globalThis.draw=ChickenRigModel.drawChicken;',rigContext);
function canvas(){let matrix=[1,0,0,1,0,0],stack=[];const records=[];return {globalAlpha:1,records,save(){stack.push([matrix.slice(),this.globalAlpha]);},restore(){[matrix,this.globalAlpha]=stack.pop();},translate(x,y){matrix[4]+=matrix[0]*x+matrix[2]*y;matrix[5]+=matrix[1]*x+matrix[3]*y;},rotate(t){const [a,b,c,d]=matrix,co=Math.cos(t),si=Math.sin(t);matrix[0]=a*co+c*si;matrix[1]=b*co+d*si;matrix[2]=c*co-a*si;matrix[3]=d*co-b*si;},scale(x,y){matrix[0]*=x;matrix[1]*=x;matrix[2]*=y;matrix[3]*=y;},drawImage(sprite,x,y,w,h){const ys=[[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map(([px,py])=>matrix[1]*px+matrix[3]*py+matrix[5]);records.push({top:Math.min(...ys),bottom:Math.max(...ys),alpha:this.globalAlpha});}};}
const art={penguPoses:Array.from({length:6},(_,i)=>({width:[90,130,100,135,120,100][i],height:[140,80,125,75,120,135][i]})),pigStyle:{scale:1,spring:1,settle:18,bob:0}};
for(const t of [0,.18,.27,.42,.51,.65,.8,2]){const ctx=canvas(),m=M.recovery(t),bounds=rigContext.draw(ctx,art,300,586,Math.PI/2,136,'win',t,0,{}, {...m,groundY:623});assert.ok(ctx.records.length);for(const sprite of ctx.records)near(sprite.bottom,623+m.offsetY,1e-7);near(bounds.top,Math.min(...ctx.records.map(s=>s.top)),1e-7);assert.ok(M.captionY(501,bounds.top,bounds.groundTop,null,1/60)+17.5<=bounds.top-10.5,'35px score text clears the tallest visible pose by at least 10.5px');}
// Headroom is reserved during the slide; the caption follows recovery smoothly.
for(const style of [{scale:.83,spring:1.25},{scale:1,spring:1},{scale:1.2,spring:.65}]){
 art.pigStyle={...style,settle:18,bob:0};let previousCaption=501,maxCaptionStep=0;
 for(let frame=0;frame<120;frame++){const ctx=canvas(),age=frame<60?0:(frame-60)/60,m=frame<60?{weights:[0,0,0,1,0,0],angle:0,offsetY:0,compression:.16}:M.recovery(age),bounds=rigContext.draw(ctx,art,300,586,Math.PI/2,136,'win',frame/60,0,{}, {...m,groundY:623}),caption=M.captionY(501,bounds.top,bounds.groundTop,previousCaption,1/60);if(frame>=60)maxCaptionStep=Math.max(maxCaptionStep,Math.abs(caption-previousCaption));assert.ok(caption+17.5<=bounds.top-10.5);previousCaption=caption;}
 assert.ok(maxCaptionStep<8,'caption movement must stay smooth throughout recovery for each pig style');
}

// Water closes over the pig, with a delayed crown and fading ripples; it stays empty.
assert.equal(M.water(0).visible,true);assert.equal(M.water(.15).crown,0);assert.ok(M.water(.2).crown>0);assert.equal(M.water(.36).crown,1);
for(const age of [M.SUBMERGE_DURATION,.7,1,2,20])assert.equal(M.water(age).visible,false);
near(M.water(M.SUBMERGE_DURATION).opacity,0);near(M.water(1).crown,0);near(M.water(2).rippleAlpha,0);
assert.equal(M.water(0,true).visible,false);near(M.water(.36,true).crown,0);
for(const cause of ['dead','water','icicle','rock'])near(M.resultDelay(cause,0),0);
near(M.resultDelay('ice',5),.8);near(M.resultDelay('ice',2),.8);near(M.resultDelay('ice',5,true),0);

const eventSource=source.slice(source.indexOf('function handleEvents(){'),source.indexOf('function springCamera('));
const resultSource=source.slice(source.indexOf('function cancelResultPresentation(){'),source.indexOf('function showWin('));
const homeSource=source.slice(source.indexOf('function returnHome('),source.indexOf('function openMenu('));
function presentation({reduced=false,multiplier=5,preview=false,autoplay=false}={}){
 const elements=new Map(),cues=[],popups=[];const element=id=>{if(id==='session-stats')return null;if(!elements.has(id)){const classes=new Set();elements.set(id,{style:{},textContent:'',classList:{add:n=>classes.add(n),remove:n=>classes.delete(n),toggle:(n,on)=>on?classes.add(n):classes.delete(n),contains:n=>classes.has(n)}});}return elements.get(id);};
 const round={state:'settled',preview,events:[{type:'settle',cause:'ice',multiplier,payout:multiplier,distance:123}],payoutCents:multiplier*100,stakeCents:100,p:{x:1000,y:586},math:{rtp:97}};
 const context={window:{},currencyPreset:{currency:"USD"},autoSession:null,sharedPanelOpen:false,round,ReferenceMotionModel:M,clock:10,reduced,balanceCents:10000,sessionPaid:0,sessionBet:0,stats:{n:0,stake:0,paid:0},history:[],roundNumber:1,activeStake:1,autoEnabled:autoplay,autoLeft:autoplay?2:0,settledAt:0,recoveryAt:0,pendingWin:null,waterReaction:null,GROUND:620,chickenRig:{impulse(){}},$:element,winTier:n=>n>=5?{label:'Nice Win'}:null,showWin:(...args)=>popups.push(args),audio:{event:n=>cues.push(n)},updateControls(){},money:n=>'$'+n.toFixed(2),burst(){}};
 vm.createContext(context);vm.runInContext(resultSource+eventSource+homeSource+';globalThis.run=handleEvents;globalThis.advance=advanceResultPresentation;globalThis.home=returnHome;globalThis.cancel=cancelResultPresentation;',context);return {context,cues,popups,element};
}
const h=presentation({autoplay:true});h.context.run();assert.equal(h.context.balanceCents,10500);assert.equal(h.context.stats.n,1);assert.equal(h.context.autoLeft,1);assert.ok(h.context.pendingWin);assert.equal(h.cues.length,0);assert.equal(h.popups.length,0);
h.context.home();assert.ok(h.context.round,'return-home is blocked during ground recovery');h.context.run();assert.equal(h.context.balanceCents,10500);assert.equal(h.context.stats.n,1);
h.context.clock=10.79;h.context.advance();assert.equal(h.popups.length,0);h.context.clock=10.8;h.context.advance();h.context.advance();assert.equal(h.popups.length,1);assert.deepEqual(h.cues,['win']);assert.equal(h.context.balanceCents,10500);assert.equal(h.context.stats.n,1);assert.equal(h.context.pendingWin,null);
const low=presentation({multiplier:2});low.context.run();assert.ok(low.context.pendingWin);low.context.clock=10.8;low.context.advance();assert.equal(low.popups.length,0);assert.equal(low.element('result').classList.contains('show'),true);assert.deepEqual(low.cues,['win']);
const rm=presentation({reduced:true});rm.context.run();assert.equal(rm.context.pendingWin,null);assert.equal(rm.popups.length,1);assert.equal(rm.context.balanceCents,10500);
const preview=presentation({preview:true});preview.context.run();assert.equal(preview.context.balanceCents,10000);assert.equal(preview.context.stats.n,0);
const stale=presentation();stale.context.run();stale.context.round={state:'settled'};stale.context.clock=11;stale.context.advance();assert.equal(stale.popups.length,0);assert.equal(stale.cues.length,0);assert.equal(stale.context.pendingWin,null);
const canceled=presentation();canceled.context.run();canceled.context.cancel();canceled.context.clock=11;canceled.context.advance();assert.equal(canceled.popups.length,0);
assert.ok(source.includes("if(round?.state==='settled'&&!pendingWin&&autoEnabled"),'autoplay must wait for recovery and the result reveal');
// Drive the actual frame/round/draw wiring together at every supported playback speed.
const physics={};vm.createContext(physics);vm.runInContext(source.slice(0,source.indexOf('const RigDataModel='))+';globalThis.P=PhysicsModel;',physics);
const drawingSource=source.slice(source.indexOf('function drawChickenInFlight(){'),source.indexOf('function draw(){'));
const frameSource=source.slice(source.indexOf('function frame(now){'),source.indexOf('// Optional agent controls'));
const timelines=[];
for(const speedIndex of [0,1,2]){
 const h=presentation({preview:true}),c=h.context,poses=[];c.round=new physics.P.Round(20260923,1,{},0,{kind:'win',multiplier:5});c.round.preview=true;
 Object.assign(c,{clock:0,last:0,acc:0,scoreDisplay:0,reviewOpen:false,document:{hidden:false},speeds:[1,2,3],speedIndex,PLAYBACK_PACE:.8,STEP:physics.P.STEP,cam:{x:0,y:0},previousCam:null,width:500,canvas:{style:{}},flightFeedback:new F(),squash:0,boost:0,trail:[],streakWord:null,returning:false,ctx:new Proxy({createLinearGradient:()=>({addColorStop(){}})},{get:(object,key)=>object[key]||(()=>{})}),clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),mix:(a,b,t)=>a+(b-a)*t,shadow(){},glow(){},stroked(){},impactRing(){},drawChicken(_ctx,_art,_x,_y,_angle,_size,phase,_clock,_compression,_rig,pose){poses.push({time:c.clock,phase,pose});},art:{},springCamera(){},stepEffects:dt=>c.flightFeedback.step(dt,c.round.p,c.round.state),requestAnimationFrame(){},setTimeout(){},startRound(){throw Error('A new round must not start before the result');}});
 c.snowMarks=[];c.audio.update=()=>{};h.element('win-overlay').hidden=true;h.element('modal-backdrop').hidden=true;
 const popup=c.showWin;c.showWin=(...args)=>{popup(...args);h.element('win-overlay').hidden=false;};
 vm.runInContext(drawingSource+frameSource+';globalThis.draw=drawChickenInFlight;globalThis.tick=frame;',c);c.draw=()=>vm.runInContext('drawChickenInFlight()',c);
 for(let i=0;i<3600&&!h.popups.length;i++)c.tick(i*1000/60);
 assert.equal(h.popups.length,1,'a complete safe round must eventually reveal its result');
 const recovery=poses.filter(p=>p.phase==='win');assert.ok(recovery.length>=40,'0.8 seconds of recovery must be drawn before the popup at every speed');
 assert.ok(recovery.some(p=>p.pose.weights[4]>.95),'the tuck pose must be visibly drawn');assert.ok(recovery.some(p=>p.pose.weights[5]>.95),'upright celebration must be drawn before reveal');
 assert.ok(c.clock-c.recoveryAt>=.8);assert.ok(c.clock-c.recoveryAt<.84);assert.equal(c.balanceCents,10000);assert.equal(c.stats.n,0);
 timelines.push({speed:speedIndex+1,drawnRecoveryFrames:recovery.length,revealDelay:+(c.clock-c.recoveryAt).toFixed(3)});
}
console.log(JSON.stringify({passed:true,physicsAndMathUnchanged:true,groundedPoseCheckpoints:8,tumbleEndpointContinuous:true,submergedWaterStaysEmpty:true,settlementExactlyOnce:true,reducedMotionImmediate:true,completeRoundTimelines:timelines}));
