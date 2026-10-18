const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const source=fs.readFileSync('dist/game.js','utf8');
const audioSource=source.slice(source.indexOf('const AUDIO_ASSETS='),source.indexOf('function resize()',source.indexOf('const AUDIO_ASSETS=')));
const files=['music','bat-hit','miss','bounce','collect','hazard','record','splash','bird','wind','slide'];
const tick=()=>new Promise(resolve=>setImmediate(resolve));

function harness({review=false,fail=[],pending=[],resumeFailure=false,suspendFailure=false,delayedSuspend=false}={}){
 const requests=[],instances=[],waiters=new Map(),listeners=new Map(),saved=new Map(),elements=new Map();
 class Param{
  constructor(value=0){this.value=value;this.calls=[];}
  call(method,value,time){this.value=value;this.calls.push({method,value,time});}
  cancelScheduledValues(time){this.calls.push({method:'cancel',time});}
  setTargetAtTime(value,time){this.call('target',value,time);}
  setValueAtTime(value,time){this.call('set',value,time);}
  exponentialRampToValueAtTime(value,time){this.call('exponential',value,time);}
 }
 class Node{
  constructor(ctx,kind){this.ctx=ctx;this.kind=kind;this.connections=[];this.disconnected=false;ctx.nodes.push(this);}
  connect(node){this.connections.push(node);}
  disconnect(){this.disconnected=true;this.connections=[];}
 }
 class Source extends Node{
  constructor(ctx,kind){super(ctx,kind);this.playbackRate=new Param(1);this.frequency=new Param(440);this.started=false;this.ended=false;this.loop=false;}
  start(time=0,offset=0,duration){assert.equal(this.started,false,'a source can only start once');this.started=true;this.startTime=Math.max(this.ctx.currentTime,time);this.offset=offset;if(!this.loop&&this.buffer)this.endTime=this.startTime+(duration??(this.buffer.duration-offset))/this.playbackRate.value;}
  stop(time=this.ctx.currentTime){this.stopTime=time;if(time<=this.ctx.currentTime)this.finish();}
  finish(){if(this.ended)return;this.ended=true;this.onended?.();}
 }
 class AudioContext{
  constructor(){this.currentTime=0;this.sampleRate=1000;this.state='suspended';this.nodes=[];this.destination={};this.resumeCalls=0;this.suspendCalls=0;instances.push(this);}
  createGain(){const node=new Node(this,'gain');node.gain=new Param(1);return node;}
  createBufferSource(){return new Source(this,'buffer');}
  createOscillator(){return new Source(this,'oscillator');}
  createBiquadFilter(){const node=new Node(this,'filter');node.frequency=new Param();return node;}
  createBuffer(channels,length,rate){const data=new Float32Array(length);return {duration:length/rate,name:'fallback',getChannelData:()=>data};}
  decodeAudioData(data){const name=files[new Uint8Array(data)[0]];if(fail.includes(name))return Promise.reject(Error('Decode failed'));const buffer={name,duration:name==='music'?47.92:1.5};if(pending.includes(name))return new Promise(resolve=>waiters.set(name,()=>resolve(buffer)));return Promise.resolve(buffer);}
  resume(){this.resumeCalls++;if(resumeFailure)return Promise.reject(Error('Resume denied'));this.state='running';return Promise.resolve();}
  suspend(){this.suspendCalls++;if(suspendFailure)return Promise.reject(Error('Suspend denied'));if(delayedSuspend){delayedSuspend=false;return new Promise(resolve=>waiters.set('__suspend',()=>{this.state='suspended';resolve();}));}this.state='suspended';return Promise.resolve();}
  advance(seconds){this.currentTime+=seconds;for(const node of this.nodes)if(node instanceof Source&&node.started&&!node.ended&&(node.stopTime<=this.currentTime||node.endTime<=this.currentTime))node.finish();}
 }
 const on=(type,handler)=>{const list=listeners.get(type)||[];list.push(handler);listeners.set(type,list);};
 const element=id=>{if(!elements.has(id))elements.set(id,{attributes:{},classList:{toggle:()=>{}},setAttribute(name,value){this.attributes[name]=value;}});return elements.get(id);};
 const context={console,Map,Set,Promise,Math,Float32Array,REVIEW_FRAME:review,reviewOpen:false,soundOn:true,musicOn:true,round:{state:'idle',p:{vx:0,vy:0}},clamp:(n,a,b)=>Math.max(a,Math.min(b,n)),$:element,settingsStore:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)},document:{hidden:false,addEventListener:on},window:{AudioContext,addEventListener:on},fetch:async url=>{requests.push(url);const name=url.split('/').at(-1).replace('.mp3','');const data=new ArrayBuffer(8);new Uint8Array(data)[0]=files.indexOf(name);return {ok:true,arrayBuffer:async()=>data};}};
 vm.createContext(context);vm.runInContext(audioSource+';globalThis.audio=audio;globalThis.api={updateSound,updateMusic};',context);
 return {context,audio:context.audio,requests,instances,waiters,saved,element,dispatch:(type,event={})=>{for(const handler of listeners.get(type)||[])handler(event);},active:()=>instances[0]?.nodes.filter(n=>n.started&&!n.ended&&!n.disconnected)||[]};
}

(async()=>{
 const h=harness();await tick();assert.equal(h.requests.length,11,'assets should preload before interaction');assert.equal(h.instances.length,0,'preloading must not construct Web Audio');h.audio.init();h.dispatch('pointerdown',{isTrusted:false});assert.equal(h.instances.length,0,'synthetic interactions must not unlock audio');
 h.dispatch('pointerdown',{isTrusted:true});await Promise.all(h.audio.decoding.values());assert.equal(h.instances.length,1);assert.equal(h.audio.buffers.size,11);assert.equal(h.audio.music.buffer.name,'music');assert.equal(h.audio.music.loop,true);assert.equal(h.audio.music.loopEnd,47.92);assert.equal(h.audio.musicBus.gain.value,.22);
 for(let i=0;i<10;i++){h.audio.init();h.audio.init(true);h.audio.resume();}assert.equal(h.instances.length,1);assert.equal(h.active().filter(n=>n.buffer?.name==='music').length,1,'repeated unlock/play must not stack music');
 const effectsLevel=h.audio.effects.gain.value;h.context.musicOn=false;h.context.api.updateMusic();assert.equal(h.audio.musicBus.gain.value,0);assert.equal(h.audio.effects.gain.value,effectsLevel);assert.equal(h.saved.get('huff-home-run-music'),'off');assert.equal(h.element('menu-music').attributes['aria-pressed'],'false');
 h.context.musicOn=true;h.context.api.updateMusic();assert.equal(h.audio.musicBus.gain.value,.22);assert.equal(h.saved.get('huff-home-run-music'),'on');assert.equal(h.active().filter(n=>n.buffer?.name==='music').length,1);
 h.context.soundOn=false;h.context.api.updateSound();assert.equal(h.audio.master.gain.value,0);assert.equal(h.context.musicOn,true,'master mute must preserve the music preference');assert.equal(h.element('menu-sound').attributes['aria-pressed'],'false');h.audio.event('strike');assert.equal(h.audio.voices.size,0,'muted effects must not accumulate');h.context.soundOn=true;h.context.api.updateSound();assert.equal(h.audio.master.gain.value,.7);
 const mappings={strike:'bat-hit',miss:'miss',bounce:'bounce',pickup:'collect',multiply:'collect',bird:'bird',rock:'hazard',dynamite:'hazard',icicle:'hazard',splash:'splash',win:'record'};
 for(const [event,file] of Object.entries(mappings)){h.context.round={state:'flight',p:{vx:800,vy:-400}};h.audio.beginRound();h.audio.event(event);assert.equal(h.audio.voices.size,1,event+' should play one generated cue');const voice=[...h.audio.voices][0];assert.equal(voice.source.buffer.name,file,event+' should use the correct sound');if(event==='multiply')assert.equal(voice.source.playbackRate.value,1.22);}
 h.audio.event('win');assert.equal(h.audio.voices.size,1,'settlement should not double the celebration');assert.equal(h.audio.musicBus.gain.value,.085,'record cue should duck the soundtrack');h.instances[0].advance(2);h.audio.update();assert.equal(h.audio.musicBus.gain.value,.22);assert.equal(h.audio.voices.size,0,'finished cues must disconnect and leave the voice pool');
 h.audio.event('win',true);h.audio.event('win',true);assert.equal(h.audio.voices.size,1,'changing preview tiers should replace the previous celebration');
 h.context.round={state:'crash',p:{vx:0,vy:0}};h.audio.beginRound();h.audio.event('rock');h.audio.event('rock');h.audio.event('lose');assert.equal(h.audio.voices.size,1,'one collision should produce one impact, without a second loss cue');
 h.audio.beginRound();for(let i=0;i<80;i++)h.audio.event('pickup');assert.equal(h.audio.voices.size,12);assert.equal(h.active().filter(n=>n.buffer?.name==='collect').length,12,'voice stealing must clean old sources');h.instances[0].advance(2);assert.equal(h.audio.voices.size,0);
 h.context.round={state:'flight',p:{vx:1200,vy:200}};h.audio.update();assert.ok(h.audio.loops.get('wind').gain.gain.value>0);assert.ok(h.audio.loops.get('wind').source.playbackRate.value>1);assert.equal(h.audio.loops.get('slide').gain.gain.value,0);h.context.round.state='slide';h.audio.update();assert.equal(h.audio.loops.get('wind').gain.gain.value,0);assert.ok(h.audio.loops.get('slide').gain.gain.value>0);
 h.audio.event('pickup');h.context.document.hidden=true;h.audio.pause();assert.equal(h.instances[0].state,'suspended');assert.equal(h.audio.voices.size,0,'hidden tabs must discard queued or in-flight cues');h.audio.event('strike');assert.equal(h.audio.voices.size,0);h.context.document.hidden=false;h.context.reviewOpen=true;h.audio.resume();assert.equal(h.instances[0].state,'suspended','outcome review must stay silent even if the tab is visible');h.context.reviewOpen=false;h.audio.resume();assert.equal(h.instances[0].state,'running');assert.equal(h.audio.master.gain.value,.7);assert.equal(h.active().filter(n=>n.buffer?.name==='music').length,1);
 const review=harness({review:true});await tick();review.audio.init(true);review.audio.event('win',true);assert.equal(review.requests.length,0);assert.equal(review.instances.length,0,'review frames must never load or unlock audio');
 const late=harness({pending:['bat-hit']});await tick();late.audio.init(true);await tick();late.audio.event('strike');assert.ok(late.audio.voices.size>0,'an unready generated cue should use immediate synthesis');late.waiters.get('bat-hit')();await Promise.all(late.audio.decoding.values());assert.equal(late.active().filter(n=>n.buffer?.name==='bat-hit').length,0,'decoder completion must never replay a stale hit');late.instances[0].advance(1);late.audio.event('strike');assert.equal([...late.audio.voices][0].source.buffer.name,'bat-hit');
 const fallback=harness({fail:['record']});await tick();fallback.audio.init(true);await Promise.all(fallback.audio.decoding.values());fallback.audio.event('win',true);fallback.audio.event('win',true);assert.equal(fallback.audio.voices.size,4,'synthesized celebration previews should replace previous fallback notes');assert.ok([...fallback.audio.voices].every(voice=>voice.type==='win'));
 const hidden=harness({pending:['music','wind','slide']});await tick();hidden.audio.init(true);await tick();hidden.context.reviewOpen=true;hidden.audio.pause();for(const resume of hidden.waiters.values())resume();await Promise.all(hidden.audio.decoding.values());assert.equal(hidden.audio.music,null,'async music completion during review must not start a source');assert.equal(hidden.audio.loops.get('wind').buffer.name,'fallback');hidden.context.reviewOpen=false;hidden.audio.resume();hidden.instances[0].advance(.2);assert.equal(hidden.audio.music.buffer.name,'music');assert.equal(hidden.audio.loops.get('wind').buffer.name,'wind');assert.equal(hidden.active().filter(n=>n.loop).length,3,'resume should keep exactly music, wind and slide loops');
 const raced=harness({delayedSuspend:true});await tick();raced.audio.init(true);await Promise.all(raced.audio.decoding.values());raced.audio.pause();assert.equal(raced.instances[0].state,'running','suspend can remain pending while the browser still reports running');raced.audio.event('strike');assert.equal(raced.audio.voices.size,0,'a pending pause must immediately silence event playback');raced.audio.resume();raced.waiters.get('__suspend')();await tick();assert.equal(raced.instances[0].state,'running','a quick return must recover even when an older suspend completes later');assert.equal(raced.audio.master.gain.value,.7);assert.equal(raced.active().filter(n=>n.buffer?.name==='music').length,1);
 const errors=[];const catchRejection=error=>errors.push(error);process.on('unhandledRejection',catchRejection);const failed=harness({fail:files,resumeFailure:true,suspendFailure:true});await tick();failed.audio.init(true);await Promise.all(failed.audio.decoding.values());failed.audio.pause();await tick();process.removeListener('unhandledRejection',catchRejection);assert.equal(errors.length,0,'unavailable/undecodable assets and browser resume failures must be handled');assert.equal(failed.audio.buffers.size,0);
 const settingSource=source.slice(source.indexOf('let soundOn=true,'),source.indexOf('class FlightFeedback'));
 for(const preference of [null,'off','on']){const settings={saved:preference,buildMath:()=>({}),settingsStore:{getItem:key=>key==='huff-home-run-music'?preference:null}};vm.createContext(settings);vm.runInContext(settingSource+';globalThis.preference=musicOn;',settings);assert.equal(settings.preference,preference!=='off','music should default on and restore saved settings');}
 assert.ok(source.includes("if(e.type==='miss'){audio.event('miss');"));assert.ok(source.includes('acc=0;audio.resume();updateControls();'),'closing outcome review should resume audio');
 console.log(JSON.stringify({passed:true,preloadedAssets:11,eventMappings:Object.keys(mappings).length,maxEffectVoices:12,reviewFramesSilent:true,staleCuesSuppressed:true}));
})().catch(error=>{console.error(error);process.exitCode=1;});
