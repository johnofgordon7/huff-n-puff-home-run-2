import {keepBonusSpacing} from './bonus-spacing.js';
import {multiplierBar,multiplierStates,maintenanceScreen} from './new-components.js?v=0.1.62-preview';
import {t, money as formatMoney, number as formatNumber, settings as localeSettings, locale as currentLocale, translateTree, fitText} from './localization.js';
import {complianceHeader,header,footer,bonusControl,bonusBuy,bonusModal,replayButton,replayIndicator} from './current-masters.js?v=0.1.62-preview';
import {historyContent,historyPanel,historyHeading,historyRows,expandedHistoryKey,historyListStates} from './history.js?v=0.1.62-preview';
import {historyAtom} from './history-atoms.js';
import {VERSION,base,inventory,layouts,artwork,wingArtwork,betArtwork,selectionArtwork,escape as e,asset,art,child,parseVariant,defaults,emit,icon,icons,action,heading} from './core.js?v=0.1.62-preview';
export {VERSION,inventory};
// Load once before defining components, so nested previews are styled immediately.
const componentCSS = (await Promise.all(['styles.css','current-masters.css','button-states.css'].map(file=>fetch(new URL(file+'?v='+VERSION+'-headers',base)).then(r=>{if(!r.ok)throw Error('Component styles unavailable');return r.text()})))).join('\n');
const sharedSheet = typeof CSSStyleSheet!=='undefined' && 'replaceSync' in CSSStyleSheet.prototype ? new CSSStyleSheet() : null;
if(sharedSheet)sharedSheet.replaceSync(componentCSS);
const yes=x=>x===true||x==='yes'||x==='on'||x==='true';
const disabled=p=>p.disabled||p.state==='disabled'?'disabled':'';
const money=(n,c=localeSettings().currency)=>formatMoney(n,c);

const tag=(name,p={},extra='')=>child(name,p,extra);
const boolName=p=>yes(p.checked)||p.state==='on'||p.state==='checked';
const brand=()=>`<div class="brand" role="img" aria-label="Incentive Studios"><img alt="" src="${art('brand','imgGroup')}"><img alt="" src="${art('brand','imgGroup1')}"></div>`;
function controlIcon(p){
 const size=['large','small','x-small'].includes(p.size)?p.size:'large',type=['play','arrow','stop'].includes(p.type)?p.type:'play';
 return `<span class="control-icon ${size} ${type}" aria-hidden="true">${type==='stop'?'<i></i>':`<img alt="" src="${asset('control-icon-'+type+'-'+size+'.svg')}">`}</span>`;
}
function button(p,secondary=false){return `<button type="button" class="button ${p.fluid?'fluid':''} ${secondary?'secondary':''}" data-state="${e(p.state||'default')}" data-action="${e(p.action||'activate')}" ${disabled(p)}><span>${e(p.label??p.Label??'Button')}</span></button>`}
function binary(p,kind){const checked=boolName(p);return `<button type="button" class="binary ${p.labelled?'labelled-binary':''} ${p.text==='left'?'text-left':''}" role="${kind==='switch'?'switch':'checkbox'}" aria-label="${e(p.label||kind)}" aria-checked="${checked}" data-action="toggle" ${disabled(p)}><span class="${kind==='switch'?'switch':'check'}">${kind==='checkbox'&&checked?`<i class="check-mark" aria-hidden="true" style="mask-image:url('${asset('checkbox-mark-current.svg')}')"></i>`:''}</span>${p.label?`<span>${e(p.label)}</span>`:''}</button>`}
function menuItem(p){return `<button type="button" class="menu-item" data-state="${e(p.state||'default')}" ${yes(p.switch)?`role="switch" aria-checked="${yes(p.checked)}"`:''} data-action="${yes(p.switch)?'toggle':e(p.action||'activate')}" ${disabled(p)}><span class="label">${yes(p.icon)?icon(p.iconName||'tutorial'):''}<span>${e(p.label||'Tutorial')}</span></span>${yes(p.switch)?'<span class="switch"></span>':''}</button>`}
function balance(p){const free=p.content!=='Balance',count=p.content==='Free Bets'||p.freeBetType==='count';return `<div class="balance" role="group" aria-label="Payment source"><button type="button" class="${free?'muted':'selected'}" data-action="balance-select" data-value="Balance" aria-pressed="${!free}"><small>Balance:</small><strong>${e(p.balance||'$10.00')}</strong></button><button type="button" class="${free?'selected':'muted'}" data-action="balance-select" data-value="${count?'Free Bets':'Free Bet Credits'}" aria-pressed="${free}"><small>Free Bets:</small><strong>${e(count?(p.freeCount??5):(p.freeCredits||'$5.00'))}</strong></button></div>`}
function round(p){
 if(['bonus','active-bonus'].includes(p.type))return bonusControl(p);
 const small=p.shape==='sm-round',files=small?{default:'state-b3f45.svg',hover:'state-a9f6e.svg',pressed:'state-89f8b.svg',focus:'state-38cd4.svg'}:{default:'state-f1228.svg',hover:'state-37178.svg',pressed:'state-3e4e2.svg',focus:'state-3294c.svg'};
 const backgrounds=Object.entries(files).map(([state,file])=>`<img class="round-art round-art-${state}" alt="" aria-hidden="true" src="${asset(file)}">`).join('');
 return `<button type="button" data-state="${e(p.state||'default')}" class="round-control ${small?'small':''}" data-action="${e(p.action||'activate')}" aria-label="${e(p.ariaLabel||p.label||p.icon||'Autoplay')}" ${disabled(p)}>${backgrounds}${p.type==='text'?e(p.label||'0.10'):icon(p.icon||'autoplay')}</button>`;
}
function bet(p){
 const size=p.size||'large',shape=p.shape||'circle',type=p.type||'play-icon',state=p.disabled?'disabled':p.state||'default';
 if(type==='stop-icon'&&shape!=='circle')return '<p class="error">Stop is only authored as a large circular control.</p>';
 const images=type==='word'&&size==='large'?'': ['default','hover','pressed','focus'].map(s=>{const a=betArtwork[`type=${type}, state=${s}, shape=${shape}, size=${size}`];return a?`<span aria-hidden="true" class="bet-art bet-art-${s}" style="left:${a.x}px;top:${a.y}px">${a.html?a.html.replaceAll(/@ASSET@([^" ]+)/g,(_,file)=>asset(file)):a.file?`<img src="${asset(a.file)}" alt="">`:a.svg}</span>`:''}).join('');
 return `<button type="button" class="bet ${e(size)} ${e(shape)} ${type==='word'?'word':''}" data-state="${e(state)}" data-action="${e(p.action||'play')}" aria-label="${e(p.label||(type==='stop-icon'?'Stop':'Play'))}" ${disabled(p)}>${images}<span class="bet-disabled-surface" aria-hidden="true">${type==='word'?'':controlIcon({type:type.replace('-icon',''),size:size==='extra-small'?'x-small':size})}</span>${type==='word'?`<span class="bet-label">${e(p.label||'BET')}</span>`:''}</button>`
}
function wing(p,small=false){
 const right=p.side==='right',size=small?'sm':'lg',side=right?'right':'left';
 const wingFiles={"lg-left-default": "state-19357.svg", "lg-left-hover": "state-05dc3.svg", "lg-left-pressed": "state-6dc4b.svg", "lg-left-focus": "state-09bd3.svg", "lg-right-default": "state-bf291.svg", "lg-right-hover": "state-24d46.svg", "lg-right-pressed": "state-c4144.svg", "lg-right-focus": "state-34e4e.svg", "sm-left-default": "state-6c9a7.svg", "sm-left-hover": "state-9f504.svg", "sm-left-pressed": "state-68cae.svg", "sm-left-focus": "state-145d0.svg", "sm-right-default": "state-7b572.svg", "sm-right-hover": "state-2fc1a.svg", "sm-right-pressed": "state-1736d.svg", "sm-right-focus": "state-a8922.svg"};
 wingFiles[size+'-'+side+'-disabled']='wing-disabled-'+size+'-'+side+'.svg';
 const background=['default','hover','pressed','focus','disabled'].map(state=>`<span class="wing-bg wing-bg-${state}"><img alt="" src="${asset(wingFiles[size+'-'+side+'-'+state])}"></span>`).join('');
 const label=p.label||(small?'Bet Amount':right?'Difficulty':'Bet Amount');
 const value=p.value||(small?'1,000,000':right&&p.state!=='focus'?'Medium':'$2.00');
 const control=`<button type="button" data-state="${e(p.state||'default')}" class="wing ${p.stepper?'with-stepper':''} ${right?'right':''} ${small?'small':''} ${p.state==='focus'?'focus':''}" data-action="${e(p.action||(right?'difficulty':'stake'))}" ${disabled(p)}>${background}<span class="text"><small>${e(label)}</small><strong>${e(value)}</strong></span><span class="wing-arrow wing-arrow-up"><img alt="" class="wing-arrow-light" src="${asset('state-34d70.svg')}"><img class="wing-arrow-dark" alt="" src="${asset('state-32f08.svg')}"></span><span class="wing-arrow wing-arrow-down"><img alt="" class="wing-arrow-light" src="${asset('state-603fa.svg')}"><img class="wing-arrow-dark" alt="" src="${asset('state-c86f5.svg')}"></span></button>`;
 return !p.stepper?control:`<div class="wing-step-wrap ${small?'small':''}">${control}<div class="wing-stepper"><button type="button" aria-label="Increase stake" data-action="stake-increase" ${disabled(p)||p.increaseDisabled?'disabled':''}></button><button type="button" aria-label="Decrease stake" data-action="stake-decrease" ${disabled(p)||p.decreaseDisabled?'disabled':''}></button></div></div>`
}
function stakeState(p){
 const number=(v,f)=>{const n=Number(String(v??'').replace(/[^0-9.-]/g,''));return Number.isFinite(n)&&n>0?n:f};
 const min=number(p.minStake,.1),max=Math.max(min,number(p.maxStake,4));
 const values=[...new Set([min,...(Array.isArray(p.stakes)?p.stakes:[.1,.2,.4,.8,1,2,4]),max].map(Number).filter(v=>Number.isFinite(v)&&v>=min&&v<=max))].sort((a,b)=>a-b);
 const value=Math.max(min,Math.min(max,number(p.stake,2)));
 return {min,max,values,value,label:money(value,p.currency||localeSettings().currency),progress:value/max*100};
}
function turboState(p){const speeds=[...new Set([1,...(Array.isArray(p.turboSpeeds)?p.turboSpeeds:[2,3,4])].map(Number).filter(v=>Number.isFinite(v)&&v>=1&&v<=16))].sort((a,b)=>a-b);const requested=Number(p.turboSpeed??(yes(p.turbo)?2:1));return {speeds,speed:speeds.includes(requested)?requested:1}}
function controller(p,small,xs=false){const stake=stakeState(p),running=yes(p.autoplayActive),remaining=p.autoplayRemaining==='infinite'?'∞':p.autoplayRemaining;let right=p.difficultyAvailable===undefined?yes(p.Right):yes(p.difficultyAvailable),extra=p['Extra controls']||'yes',max=yes(p['Max Stake']);if(p.region==='UK'){extra='no';max=false}const subset=layouts.filter(l=>xs?l.size==='extra-small':small?l.id.startsWith('71:'):l.id.startsWith('12:'));const selected=subset.find(l=>{const v=parseVariant(l.name);return yes(v.Right)===right&&yes(v['Max Stake'])===max&&(xs?v.Autoplay===(p.region==='UK'?'no':p.Autoplay??extra)&&v.Turbo===(p.region==='UK'?'no':p.Turbo??extra):v['Extra controls']===extra)});if(!selected)return '<p class="error">This positional combination is not authored in Figma. Choose an existing variant.</p>';let secondaryIndex=0;const content=selected.children.filter(c=>c.visible).map(c=>{const pos=`style="left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px"`;if(c.name==='max-bet-progress'||c.name==='progress-bar')return `<div class="progress" role="progressbar" aria-label="Stake towards maximum" aria-valuemin="0" aria-valuemax="${stake.max}" aria-valuenow="${stake.value}" aria-valuetext="${e(stake.label)} of ${e(money(stake.max,p.currency||localeSettings().currency))}" style="left:${c.x}px;top:${c.y-6}px;width:${c.h}px"><i style="width:${stake.progress}%"></i></div>`;if(c.name.includes('control-bet-button'))return tag('control-bet-button',{...parseVariant(c.main),...(running?{type:'stop-icon',runtimeStop:true,action:'stop',label:'Stop autoplay'}:{}),disabled:p.disabled||(!running&&p.playDisabled)},pos);if(c.name.includes('control-button-primary')){const v=parseVariant(c.main);return tag(small?'control-button-primary-sm':'control-button-primary-lg',{...v,label:v.side==='right'?'Difficulty':'Bet Amount',value:v.side==='right'?(p.difficulty||'Medium'):stake.label,stepper:v.side==='left',decreaseDisabled:stake.value<=stake.min,increaseDisabled:stake.value>=stake.max,disabled:p.disabled||p.stakeDisabled},pos)}if(c.name==='control-button-secondary'){const which=c.icon||(secondaryIndex++===0?'fast-forward':'autoplay');return tag('control-button-secondary',{...parseVariant(c.main),type:'icon',icon:which,ariaLabel:which==='fast-forward'?'Turbo: normal speed. Activate to speed up':'Autoplay settings',...(which==='fast-forward'&&turboState(p).speed>1?{type:'text',label:`×${turboState(p).speed}`,ariaLabel:`Game speed ${turboState(p).speed} times. Activate to change speed`}:{}),...(which==='autoplay'&&running?{type:'text',label:String(remaining),ariaLabel:`Autoplay: ${remaining==='∞'?'infinite':remaining} spins remaining`}:{}),action:which==='autoplay'?(running?'stop':'autoplay'):'turbo',disabled:p.disabled||(which==='autoplay'&&!running&&p.autoplayDisabled)},pos)}return ''}).join('');return `<div class="controller-wrap">${yes(p.bonusAvailable)?`<div class="bonus-slot">${tag('control-button-secondary',{shape:'round',type:'bonus',action:'bonus',disabled:p.disabled})}</div>`:''}<div class="controller" data-figma-variant="${selected.id}" style="width:${selected.w}px;height:${selected.h}px">${content}</div></div>`}
function choices(p,difficulty=false){
 const three=!difficulty&&String(p.Columns)==='3',right=p.Arrow==='Right';
 const supplied=p.values||(difficulty?['Hard','Difficult','Medium','Easy']:three?[10,9,8,7,6,5,4,3,2,1,.8,.6,.4,.2,.1]:[4,2,1,.8,.4,.2,.1]);
 const sorted=difficulty?supplied:[...new Set(supplied.map(Number).filter(Number.isFinite))].sort((a,b)=>a-b);
 const values=difficulty?sorted:three?Array.from({length:Math.ceil(sorted.length/3)},(_,i)=>Array.from({length:3},(_,column)=>sorted[i*3+column]??null)).reverse().flat():sorted.slice().reverse();
 const key=difficulty?'difficulty':`${three?3:1}-${right?'Right':'Left'}`,a=selectionArtwork[key];
 const selected=p.value??(difficulty?'Medium':right?null:1);
 return `<section class="selection ${three?'columns3':''} ${difficulty?'difficulty':''} ${right?'arrow-right':''}" aria-label="${e(p.label||(difficulty?'Game Difficulty':'Bet Amount'))}"><span class="selection-background" aria-hidden="true">${a.file?`<img src="${asset(a.file)}" alt="">`:a.svg}</span><header class="selection-heading"><h3>${e(p.label||(difficulty?'Game Difficulty':'Bet Amount'))}</h3><button class="icon-button" type="button" data-action="close" aria-label="Close ${difficulty?'Game Difficulty':'Bet Amount'}">${icon('close')}</button></header><div class="selection-scroll" data-initial-scroll="0"><div class="choices">${values.map(v=>v===null?'<span aria-hidden="true"></span>':tag('bet-value',{selectionManaged:true,size:three?'Small':'Large',label:difficulty?v:formatNumber(Number(v)),value:v,state:String(selected)===String(v)?'pressed':'default',action:'select'})).join('')}</div></div></section>`
}
function autoLine(p){const value=p.value??null;return `<div class="auto-row" role="group" aria-label="${e(p.label||'Stopping limit')}"><p data-no-translate>${localeSettings().language==='en'?e(p.label||'Stop if I LOSE').replace(/(A SINGLE WIN|LOSE|WINS)/g,'<strong>$1</strong>'):e(t(p.label||'Stop if I LOSE'))}</p><div class="choices">${[...(p.values||[5,10,20,50]),'none'].map(v=>tag('button-small',{selectionManaged:true,label:v==='none'?'No Limit':v+'x Bet',value:v,state:(v==='none'?value==='none':value!==null&&Number(value)===v)?'pressed':'default',action:'select'})).join('')}</div></div>`}
const roundChoices=p=>{const custom=Array.isArray(p.roundChoices)?[...new Set(p.roundChoices.filter(v=>Number.isInteger(v)&&v>0))]:[];const finite=custom.length?custom:(yes(p.infiniteAvailable)?[10,20,50,100]:[10,20,50,75,100]);return yes(p.infiniteAvailable)?[...finite,'infinite']:finite};
const selectedRounds=p=>{if(p.rounds==null)return null;const value=p.rounds==='infinite'?'infinite':Number(p.rounds??roundChoices(p)[0]);return roundChoices(p).includes(value)?value:null;};
function autoplay(p){const expanded=p.advancedOpen===undefined?yes(p.basic):yes(p.advancedOpen);return `<section class="panel autoplay-sheet ${expanded?'is-expanded':''}"><header class="modal-heading"><h2>Auto Play</h2><button type="button" class="icon-button autoplay-close" data-action="close" aria-label="Close autoplay">${icon('close')}</button></header><div class="panel-body"><div class="auto-rounds"><h3>Number of rounds</h3><div class="choices round-choices" style="grid-template-columns:repeat(${roundChoices(p).length},minmax(0,1fr))" role="group" aria-label="Number of rounds">${roundChoices(p).map(v=>tag('button-small',{selectionManaged:true,label:v==='infinite'?'∞':v,ariaLabel:v==='infinite'?'Infinite rounds':`${v} rounds`,value:v,state:selectedRounds(p)===v?'pressed':'default',action:'rounds'})).join('')}</div></div>${`<div class="advanced-heading">${expanded?'<strong>Advanced Auto Play</strong>':'<span></span>'}<button type="button" data-action="advanced" aria-expanded="${expanded}">${expanded?'Hide':'View'} Advanced <img class="autoplay-chevron" src="${asset(expanded?'0a85c.svg':'3b948.svg')}" alt=""></button></div>`}${expanded?`${p.specialAvailable===false?'':`<div class="special-feature-condition">${tag('switch',{label:'Stop if special feature triggered',checked:yes(p.special)})}</div>`}${tag('autoplay-line',{label:'Stop if I LOSE',value:p.loss??(p.limitSelections?.loss?'none':null),field:'loss'})}${tag('autoplay-line',{label:'Stop if my WINS reach',value:p.profit??(p.limitSelections?.profit?'none':null),field:'profit'})}${tag('autoplay-line',{label:'Stop if A SINGLE WIN hits',value:p.single??(p.limitSelections?.single?'none':null),field:'single'})}`:''}</div><div class="actions">${action('RESET','reset',{secondary:true})}${action('START','start',{disabled:selectedRounds(p)===null})}</div></section>`}
function menu(p){const items=p.items||[{label:'How to play',icon:'info',action:'information'},{label:'Tutorial',icon:'tutorial',action:'tutorial'},{label:'User History',icon:'user-history',action:'history'},{label:'Music',icon:'music',switch:true,key:'music'},{label:'Sound Effects',icon:'sound-effects',switch:true,key:'sound'},{label:'Exit Game',icon:'exit-game',action:'exit'}];return `<nav class="menu" aria-label="Game menu">${items.map(i=>tag('menu-item',{label:i.label,icon:'yes',iconName:i.icon,switch:i.switch?'yes':'no',action:i.action,key:i.key,checked:yes(p[i.key])})).join('')}</nav>`}
function bonus(p){const two=p.offer==='ante-bet-chaos';const offers=p.offers||[{title:'Ante Bet',description:'No seagull or plane will end your run',price:'$2.00',key:'ante-bet'},{title:'Chaos',description:'Activate the Chaos bonus',price:'$5.00',key:'chaos'}];return `<section class="bonus-panel ${two?'two':''}">${heading('Buy Bonus')}<div class="bonus-offers">${offers.slice(0,two?2:1).map((o,i)=>`<div class="offer"><h3>${e(o.title)}</h3><img src="${art('bonus',i?'imgImage2Traced':'imgFrame')}" alt=""><p>${e(o.description)}</p>${!two?`<p>Each bet costs an extra ${e(o.price)} until this bonus is deactivated.</p>`:''}${action((p.active===o.key?'Deactivate':'Activate')+(two?' '+o.price:''),'bonus-select',{value:o.key})}${!two?action('Cancel','close',{secondary:true}):''}</div>`).join('')}</div></section>`}


function adaptiveOnboarding(p,kind){
 const tutorial=kind==='tutorial',loading=kind==='loading';
 const slides=p.slides||[{title:'FEATURE TITLE',text:'Feature explanation'}],idx=Math.max(0,Math.min(slides.length-1,Number(p.step||0))),slide=slides[idx];
 const logo=p.logo?tag('game-logo',{src:p.logo,alt:p.gameName||'Game logo'}):`<h1>${e(p.gameName||'')}</h1>`;
 const tutorialContent=`<h1>${e(p.Heading||'How to Play')}</h1><div class="tutorial-slider"><button class="icon-button" aria-label="Previous step" data-action="previous" ${idx===0?'disabled':''}>${icon('arrow left')}</button>${tag('image-box',{src:slide.image,alt:slide.title})}<button class="icon-button" aria-label="Next step" data-action="next" ${idx===slides.length-1?'disabled':''}>${icon('arrow right')}</button></div><div class="dots">${slides.map((s,i)=>`<button class="dot" data-action="step" data-value="${i}" aria-label="Step ${i+1}" aria-current="${i===idx}"></button>`).join('')}</div><div class="tutorial-copy"><h2>${e(p['Feature title']||slide.title)}</h2><p>${e(p['Feature explanation']||slide.text)}</p></div><div class="onboarding-actions tutorial-actions">${action('PLAY','play')}${tag('checkbox',{label:'Don’t show me again',checked:p.remember})}</div>`;
 const startContent=`${logo}<div class="opening-prompt">${loading?`${tag('loading')}<p role="status">${e(p.message||'Loading...')}</p>`:`<h2>${e(p.soundHeading||'Play with sound?')}</h2>${p.soundDescription?`<p>${e(p.soundDescription)}</p>`:''}<div class="onboarding-actions sound-actions">${action('SOUND ON','sound-on')}${action('SOUND OFF','sound-off',{secondary:true})}</div>`}</div>`;
 return `<section class="screen adaptive opening-layout ${tutorial?'opening-tutorial':loading?'opening-loading':'opening-sound'}"><div class="onboarding-main">${tutorial?tutorialContent:startContent}</div><footer class="onboarding-footer">${brand()}</footer></section>`;
}
function onboarding(p,kind){if(p.adaptive)return adaptiveOnboarding(p,kind);if(kind==='tutorial'){const slides=p.slides||[{title:'FEATURE TITLE',text:'Feature explanation'},{title:'Choose your stake',text:'Select the bet amount before you play.'},{title:'Ready to play',text:'Start a round when you are ready.'}],idx=Math.max(0,Math.min(slides.length-1,Number(p.step||0))),slide=slides[idx];return `<section class="screen ${p.adaptive?'adaptive':''}"><h1>${e(p.Heading||'How to Play')}</h1><div class="tutorial-slider"><button class="icon-button" aria-label="Previous step" data-action="previous" ${idx===0?'disabled':''}>${icon('arrow left')}</button>${tag('image-box',{src:slide.image,alt:slide.title})}<button class="icon-button" aria-label="Next step" data-action="next" ${idx===slides.length-1?'disabled':''}>${icon('arrow right')}</button></div><div class="dots">${slides.map((s,i)=>`<button class="dot" data-action="step" data-value="${i}" aria-label="Step ${i+1}" aria-current="${i===idx}"></button>`).join('')}</div><div class="tutorial-copy"><h2>${e(p['Feature title']||slide.title)}</h2><p>${e(p['Feature explanation']||slide.text)}</p></div><div class="bottom">${action('PLAY','play')}${tag('checkbox',{label:'Don’t show me again',checked:p.remember})}</div></section>`}return `<section class="screen center ${p.adaptive?'adaptive':''}">${p.logo?tag('game-logo',{src:p.logo,alt:p.gameName||'Game logo'}):`<h1>${e(p.gameName||'')}</h1>`}<div class="onboarding-spacer"></div>${kind==='loading'?`${tag('loading')}<p>${e(p.message||'Loading...')}</p>`:`<h2>${e(p.soundHeading||'Play with sound?')}</h2><p>${e(p.soundDescription||'')}</p>${action('SOUND ON','sound-on')}${action('SOUND OFF','sound-off',{secondary:true})}`}<div class="bottom">${brand()}</div></section>`}
function interruption(p){return `<section class="screen interruption">${tag('game-logo',{src:p.logo,alt:'Game logo'})}<div class="message"><h2>${e(p.Heading||'Oops something went wrong!')}</h2><p>${e(p.Message||'An error occurred, but don’t worry. Please try again, or come back later if the issue persists.')}</p></div><div class="bottom">${action(p.primaryLabel||'RECONNECT','retry')}${p['Show secondary action']!==false?action(p.secondaryLabel||'TRY AGAIN LATER','later',{secondary:true}):''}</div></section>`}
function help(p){const sections=p.sections||[{title:p.gameName||'Introduction',paragraphs:p.paragraphs||['Choose a bet amount and press Play to begin.','Game-specific rules and payout values should be supplied by your product team.']}];return `<section class="panel help-panel">${historyHeading({...p,title:p.title||'How to Play',search:'yes',searchScope:'how-to-play'})}<div class="help-scroll">${sections.map(section=>`<section><h3>${e(section.title)}</h3>${(section.paragraphs||[]).map(t=>`<p>${e(t)}</p>`).join('')}</section>`).join('')}${p.limits?`<section><h3>Multiplier and Bet Limits (per single bet)</h3><table><thead><tr><th></th><th>Minimum</th><th>Maximum</th></tr></thead><tbody>${p.limits.map(row=>`<tr>${row.map(c=>`<td>${e(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></section>`:''}${(p.notes||[]).map(t=>`<p>${e(t)}</p>`).join('')}</div></section>`}

export function template(name,p){
 if(name.startsWith('history/content/'))return historyContent(p,name.split('/').at(-1));
 if(name.startsWith('onboarding/'))return onboarding(p,name.split('/').at(-1));
 switch(name){
 case 'primary-button':return button(p);
 case 'secondary-button':return button(p,true);
 case 'header-buttons':{const state=String(p.state||p['Property 1']||'default').toLowerCase();return `<button type="button" class="header-state-button" data-state="${e(state)}" data-action="${e(p.action||'information')}" aria-label="${e(p.label||'Information')}" ${disabled({...p,state})}>${icon(p.icon||'info')}</button>`;}
 case 'large icons':return controlIcon(p);
 case 'icon':return icon(p.icon,p.state);
 case 'switch':case 'checkbox':return binary(p,name);
 case 'switch-text':case 'checkbox-text':return binary({...p,labelled:true,label:p.label||'Stop if special feature triggered'},name.split('-')[0]);
 case 'menu-item':return menuItem(p);
 case 'balance':return balance(p);
 case 'control-button-secondary':return round(p);
 case 'control-bet-button':return bet(p);
 case 'control-button-primary-lg':return wing(p);
 case 'control-button-primary-sm':return wing(p,true);
 case 'bet-value':case 'button-small':return `<button data-state="${e(p.state||'default')}" class="value ${p.size==='Large'?'large':''} ${name==='button-small'?'autoplay':''}" aria-pressed="${p.state==='pressed'}" data-action="${e(p.action||'select')}" ${p.ariaLabel?`aria-label="${e(p.ariaLabel)}"`:''} ${disabled(p)}>${name==='button-small'&&yes(p.icon)?icon('infinite'):e(p.label??p.value??(name==='button-small'?10:'0.10'))}</button>`;
 case 'game-control-large':case 'game-control-small':case 'game-control-extra-small':return controller(p,name.endsWith('small'),name==='game-control-extra-small');
 case 'action-boxes':return choices(p);
 case 'difficulty-panel':return choices(p,true);
 case 'header':return header(p);
 case 'footer':return footer(p);
 case 'bonus-buy':return bonusBuy(p);
 case 'bonus-modal':return bonusModal(p);
 case 'replay-button':return replayButton(p);
 case 'replay':return replayIndicator(p);
 case 'bet-history-lines':return historyAtom(p);
 case 'header-balance':return `<div class="header-balance">${tag('balance',{...p,content:p.content||'Balance'})}<div class="header-buttons ${p.shape==='round'?'round':''}"><button aria-label="Information" data-action="information">${icon('info')}</button><button aria-label="Menu" data-action="menu" aria-expanded="${yes(p.menuOpen)}" aria-controls="game-menu">${icon(yes(p.menuOpen)?'close':'menu')}</button></div>${yes(p.menuOpen)?`<div class="header-menu" id="game-menu">${tag('menu',{music:p.music,sound:p.sound})}</div>`:''}</div>`;
 case 'compliance-header':return complianceHeader(p);
 case 'last-win-notification':return `<div class="last-win ${p.size==='Small Screen'?'small':''}"><span>Bet: <strong>${e(p.bet||'$1.00')}</strong></span><span>Win: <strong>${e(p.win||'$12.00')}</strong></span></div>`;
 case 'image-box':case 'game-logo':return `<div class="placeholder ${name==='image-box'?'image':'logo'}" role="img" aria-label="${e(p.alt||name)}">${p.src?`<img src="${e(p.src)}" alt="${e(p.alt||'')}">`:''}</div>`;
 case 'incentive-studios':return brand();
 case 'loading':return `<div class="loading" role="status" aria-label="${e(p.label||'Loading')}"><img src="${asset('130f9.png')}" alt=""></div>`;
 case 'modal-heading':return historyHeading(p);
 case 'autoplay-line':return autoLine(p);
 case 'autoplay-sheet':return autoplay(p);
 case 'menu':return menu(p);
 case 'bonus-modals':return bonus(p);
 case 'bet-history-atoms':return historyAtom(p);
 case 'history/panel':return historyPanel(p);
 case 'how-to-play':return help(p);
 case 'game/interruption':return interruption(p);
 case 'maintenance-screen':return maintenanceScreen(p);
 case 'multiplier-bar':return multiplierBar(p);
 default:throw Error('Component is not included in this release: '+name);
 }
}
export class IncentiveComponent extends HTMLElement{
 static observedAttributes=['name','options'];
 constructor(){super();this.attachShadow({mode:'open'});if(sharedSheet&&'adoptedStyleSheets' in this.shadowRoot)this.shadowRoot.adoptedStyleSheets=[sharedSheet];else{const style=document.createElement('style');style.textContent=componentCSS;this.shadowRoot.append(style)}this._options={};this._state={};this.shadowRoot.addEventListener('click',ev=>{const b=ev.target.closest('[data-action]');if(b&&!b.disabled)this.handle(b.dataset.action,b.dataset.value??this.options.value)});this.shadowRoot.addEventListener('change',ev=>{const f=ev.target.dataset.field;if(f){this._state[f]=ev.target.value;emit(this,'change',{field:f,value:ev.target.value});if(f==='query')this.render()}});this.shadowRoot.addEventListener('is-action',ev=>{if(ev.target===this)return;ev.stopPropagation();const source=ev.target;this.handle(ev.detail.action,ev.detail.value,source)});}
 get name(){const name=this.getAttribute('name')||'';return name==='button-autoplay'?'button-small':name}
 get options(){const p={...defaults(this.name),...this._options,...this._state};if(['replay-button','multiplier-bar'].includes(this.name)){p.state=this._state.state??this._options.state??this._options['Property 1']??p.state;p.state=String(p.state||'default').replace('Default','default').replace('focused','focus').replace('frist-amount','first-amount');}return p}
 set options(value){this._options={...value};this._state={};if(this.isConnected)this.render()}
 disconnectedCallback(){this._progressObserver?.disconnect();this._bonusSpacing?.();document.removeEventListener('pointerdown',this._outside);document.removeEventListener('keydown',this._escape)}
 connectedCallback(){this._outside??=(ev)=>{if(['header-balance','header'].includes(this.name)&&this.options.menuOpen&&!ev.composedPath().includes(this)){this._state.menuOpen=false;this.render()}};this._escape??=(ev)=>{if(ev.key==='Escape'&&this.options.menuOpen){this._state.menuOpen=false;this.render();this.shadowRoot.querySelector('[data-action="menu"]')?.focus({preventScroll:true})}};document.addEventListener('pointerdown',this._outside);document.addEventListener('keydown',this._escape);if(this.hasAttribute('options'))this.attributeChangedCallback('options',null,this.getAttribute('options'));else this.render();}
 attributeChangedCallback(name,old,value){if(old===value)return;if(name==='options'){try{this._options=value?JSON.parse(value):{};this._state={}}catch{this._options={};this.error='Invalid options JSON'}}if(this.isConnected)this.render()}
 render(){
  this.lang=currentLocale();
  const root=this.shadowRoot;
  this._bonusSpacing?.();this._bonusSpacing=null;
  const motionSelectors=['.progress i','.switch','button.value','button.binary'];
  const before=motionSelectors.map(selector=>{const el=root.querySelector(selector);if(!el)return null;const style=getComputedStyle(el);return {selector,width:style.width,backgroundColor:style.backgroundColor,color:style.color,left:selector==='.switch'?getComputedStyle(el,'::after').left:null}});
  const scrollPositions=[...root.querySelectorAll('.selection-scroll,.history-scroll,.bonus-modal-scroll')].map(el=>({className:el.className,top:el.scrollTop,left:el.scrollLeft}));
  const path=[];let focus=root.activeElement;
  // Dialogs stay mounted through countdown updates, retaining selection and focus.
  const dialogFocused=focus?.closest('dialog');
  if(!dialogFocused)while(focus){path.push({name:focus.localName,action:focus.dataset?.action,value:focus.dataset?.value,field:focus.dataset?.field,label:focus.getAttribute('aria-label'),component:focus.getAttribute('name'),index:[...focus.parentNode.children].indexOf(focus)});focus=focus.shadowRoot?.activeElement;}
  let html;try{html=template(this.name,this.options)}catch(err){html=`<p class="error" role="alert">${e(err.message)}</p>`}
  for(const node of [...root.childNodes])if(node.nodeName!=='STYLE'&&node.nodeName!=='DIALOG')node.remove();
  this._progressObserver?.disconnect();
  const content=document.createElement('template');content.innerHTML=html;root.insertBefore(content.content,root.querySelector('dialog'));for(const el of root.querySelectorAll('[class]'))for(const name of [...el.classList])if(!name.startsWith('studio-'))el.classList.add('studio-'+name);translateTree(root);requestAnimationFrame(()=>fitText(root));
  if(this.name==='how-to-play'){
   const query=String(this.options.query||'').trim().toLocaleLowerCase(),matches=[];
   if(query)for(const el of root.querySelectorAll('.help-scroll h3,.help-scroll p,.help-scroll td,.help-scroll th'))if(el.textContent.toLocaleLowerCase().includes(query))matches.push(el);
   const index=matches.length?((Number(this.options.matchIndex||0)%matches.length)+matches.length)%matches.length:0;
   matches.forEach((el,i)=>{el.classList.add('help-search-match');if(i===index)el.setAttribute('data-search-current','true')});
   const count=root.querySelector('.history-search-count');if(count)count.textContent=`${matches.length?index+1:0}/${matches.length}`;
   root.querySelectorAll('[data-action=previous-match],[data-action=next-match]').forEach(b=>b.disabled=!matches.length);
   if(matches[index])matches[index].scrollIntoView({block:'nearest'});
  }
  if(this.name.startsWith('game-control-')&&root.querySelector('.bonus-slot'))this._bonusSpacing=keepBonusSpacing(this,()=>root.querySelector('.bonus-slot is-component'),()=>matchMedia('(max-width:767px)').matches?'above':'beside');
  for(const el of root.querySelectorAll('.selection-scroll,.history-scroll,.bonus-modal-scroll')){if(el.closest('dialog'))continue;const saved=scrollPositions.find(x=>x.className===el.className);el.scrollTop=saved?.top??Number(el.dataset.initialScroll||0);el.scrollLeft=saved?.left??0;}
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)for(const old of before){if(!old)continue;const el=root.querySelector(old.selector);if(!el)continue;const style=getComputedStyle(el),from={},to={};for(const key of old.selector==='.progress i'?['width']:['backgroundColor','color'])if(old[key]!==style[key]){from[key]=old[key];to[key]=style[key]}if(Object.keys(from).length)el.animate([from,to],{duration:parseFloat(getComputedStyle(this).getPropertyValue('--motion-standard'))||180,easing:'ease-out'});if(old.left!==null&&old.left!==getComputedStyle(el,'::after').left)el.animate([{left:old.left},{left:getComputedStyle(el,'::after').left}],{duration:parseFloat(getComputedStyle(this).getPropertyValue('--motion-standard'))||180,easing:'ease-out',pseudoElement:'::after'});}
  for(const dialog of root.querySelectorAll('dialog[open]')){const kind=dialog.getAttribute('aria-label');for(const child of root.querySelectorAll('is-component'))if(child.shadowRoot?.querySelector(`[data-action="${kind}"]`))child.setAttribute('data-dialog-active','');}
  const bonusScroll=root.querySelector('.bonus-modal-scroll'),bonusThumb=root.querySelector('.bonus-scroll-track i');if(bonusScroll&&bonusThumb){const sync=()=>{const max=bonusScroll.scrollHeight-bonusScroll.clientHeight;const track=bonusThumb.parentElement;bonusThumb.style.top=(1+bonusScroll.scrollTop/Math.max(1,max)*Math.max(0,track.clientHeight-bonusThumb.offsetHeight-2))+'px';bonusScroll.closest('.bonus-modal').classList.toggle('at-scroll-end',bonusScroll.scrollTop>=max-1)};bonusScroll.addEventListener('scroll',sync);sync()}
  if(this.name.startsWith('game-control-'))requestAnimationFrame(()=>{
   if(!this.isConnected)return;const track=root.querySelector('.progress'),controller=root.querySelector('.controller');
   const left=[...root.querySelectorAll('is-component')].map(n=>n.shadowRoot?.querySelector('.wing:not(.right)')).find(Boolean);
   if(!track||!controller||!left)return;
   const sync=()=>{const c=controller.getBoundingClientRect(),r=left.getBoundingClientRect(),scale=c.width/controller.offsetWidth||1;track.style.left=(r.left-c.left)/scale+'px';track.style.width=r.width/scale+'px'};
   sync();this._progressObserver?.disconnect();this._progressObserver=new ResizeObserver(sync);this._progressObserver.observe(left);this._progressObserver.observe(controller);
  });
  let scope=root;for(const step of path){const candidates=[...scope.querySelectorAll(step.name)];const next=candidates.find(x=>step.field?x.dataset.field===step.field:step.action?x.dataset.action===step.action&&x.dataset.value===step.value:step.component?x.getAttribute('name')===step.component&&[...x.parentNode.children].indexOf(x)===step.index:step.label?x.getAttribute('aria-label')===step.label:false);if(!next)break;next.focus({preventScroll:true});scope=next.shadowRoot;if(!scope)break;}
 }

 handle(actionName,value,source){const p=this.options,n=this.name;let refresh=false;
 if(n==='multiplier-bar'&&['multiplier-next','multiplier-previous'].includes(actionName)){const i=multiplierStates.indexOf(p.state);this._state.state=multiplierStates[Math.max(0,Math.min(4,i+(actionName==='multiplier-next'?1:-1)))];this.render();emit(this,'change',{state:this._state.state});return;}
 if(n.startsWith('game-control-')){
  if(p.disabled)return;
  if(p.stakeDisabled&&['stake','stake-increase','stake-decrease','difficulty'].includes(actionName))return;
  if(p.playDisabled&&actionName==='play')return;
  if(p.autoplayDisabled&&actionName==='autoplay')return;
 }

 if(actionName==='balance-select'&&['balance','header-balance','header'].includes(n)){this._state.content=value;if(value==='Free Bets'||p.content==='Free Bets')this._state.freeBetType='count';refresh=true;}
 if(['header-balance','header'].includes(n)){
  if(actionName==='menu'){this._state.menuOpen=!(p.menuOpen??p.type==='menu open');refresh=true;}
  if(actionName==='toggle'&&source?.name==='menu'){this._state[value.key]=value.checked;emit(this,actionName,value);return;}
  if(['information','history','tutorial'].includes(actionName)){this._state.menuOpen=false;this.render();this.openDialog(actionName==='information'?'how-to-play':actionName==='history'?'history/panel':'onboarding/tutorial',{},actionName);emit(this,actionName,value);return;}
  if(actionName==='exit'){this._state.menuOpen=false;refresh=true;}
 }

 if(actionName==='toggle'){if(n==='menu'){const key=source?.options.key;if(!key)return;this._state[key]=yes(value);value={key,checked:this._state[key]};}else if(n.startsWith('onboarding/')){this._state.remember=source.options.checked;value={remember:this._state.remember}}else if(n==='autoplay-sheet'){this._state.special=source.options.checked;value={special:this._state.special}}else{this._state.checked=!boolName(p);this._state.state=this._state.checked?'on':'off';value=this._state.checked;refresh=true}}
 if(['select','rounds'].includes(actionName)){if(n==='autoplay-sheet'){if(source?.name==='autoplay-line'){const field=source.options.field;this._state[field]=value==='none'?null:value;this._state.limitSelections={...p.limitSelections,[field]:value==='none'};value={field,value:this._state[field]}}else {const next=value==='infinite'&&yes(p.infiniteAvailable)?'infinite':Number(value);this._state.rounds=selectedRounds(p)===next?null:next}}else if(n==='autoplay-line'){value=String(value)===String(p.value)?null:value==='none'?'none':Number(value);this._state.value=value}else if(n==='bet-value'||n==='button-small'){if(p.selectionManaged){emit(this,actionName,p.value??p.label);return}const selected=p.state!=='pressed';this._state.state=selected?'pressed':'default';value=selected?(p.value??p.label??(n==='button-small'?10:'0.10')):null}else this._state.value=value;refresh=true}
 if(n==='autoplay-sheet'&&actionName==='change'&&source?.name==='autoplay-line'){const field=source.options.field;this._state[field]=value.value===''?0:Number(value.value);this._state[field+'Custom']=value.value;value={field,value:this._state[field]};}
 if(n==='autoplay-sheet'&&actionName==='advanced'){this._state.advancedOpen=!(p.advancedOpen===undefined?yes(p.basic):yes(p.advancedOpen));refresh=true}
 if(n==='autoplay-sheet'&&actionName==='reset'){this._state={advancedOpen:p.advancedOpen,rounds:null,special:false,limitSelections:{},loss:null,profit:null,single:null};refresh=true}
 if(n==='autoplay-sheet'&&actionName==='start'&&selectedRounds(p)===null)return;
 if(n==='autoplay-sheet'&&actionName==='start')value={rounds:selectedRounds(p),special:yes(p.special),limitSelections:p.limitSelections||{},loss:p.loss??null,profit:p.profit??null,single:p.single??null};
 if(n==='bonus-buy'&&['bonus-buy','bonus-confirm','bonus-cancel'].includes(actionName)){
  if(p.disabled||p.active)return;
  const requiresConfirmation=yes(p.requiresConfirmation)||p.type==='confirmation';
  this._state.requiresConfirmation=requiresConfirmation;
  const pending=actionName==='bonus-buy'&&requiresConfirmation;
  const activated=actionName==='bonus-confirm'||(actionName==='bonus-buy'&&!requiresConfirmation);
  this._state.type=pending?'confirmation':'single-button';
  if(activated)this._state.active=true;
  value={key:p.key,price:p.price||'$2.00',requiresConfirmation,active:activated,duration:'session'};
  if(activated)actionName='bonus-activate';
  refresh=true;
 }
 if(n==='bonus-modal'&&['bonus-buy','bonus-activate','bonus-cancel'].includes(actionName)){
  this._state.confirming=actionName==='bonus-buy'&&value.requiresConfirmation?value.key:null;
  if(actionName==='bonus-activate')this._state.activeKeys=[...new Set([...(p.activeKeys||[]),value.key])];
  refresh=true;
 }
 if(n==='control-button-secondary'&&['bonus','bonus-exit'].includes(actionName)&&!p.action){this._state.type=actionName==='bonus'?'active-bonus':'bonus';refresh=true;}
 if(actionName==='bonus-select'){this._state.active=p.active===value?null:value;refresh=true;value={offer:value,active:this._state.active!==null}}
 if(['how-to-play','modal-heading'].includes(n)&&actionName==='search-toggle'){this._state.searchOpen=!(p.searchOpen??p.search==='search open');refresh=true}
 if(n.startsWith('history/content/')&&historyListStates.includes(n.split('/').at(-1))&&actionName==='detail'){
  const state=n.split('/').at(-1);this._state.expandedKey=expandedHistoryKey(p,state)===value?null:value;refresh=true;
 }
 if(['how-to-play','modal-heading'].includes(n)&&actionName==='search-close'){this._state.searchOpen=false;this._state.query='';refresh=true}
 if(n==='how-to-play'&&actionName==='change'&&value.field==='query'){this._state.query=value.value;this._state.matchIndex=0;refresh=true;}
 if(n==='how-to-play'&&['previous-match','next-match'].includes(actionName)){this._state.matchIndex=Number(p.matchIndex||0)+(actionName==='next-match'?1:-1);refresh=true;}
 if(n==='history/panel'){
  if(actionName==='detail')this._state.expandedKey=source.options.expandedKey;
  if(actionName==='change'&&value.field==='query'){this._state.query=value.value;this._state.matchIndex=0;this._state.expandedKey=null;refresh=true;}
  if(['clear-search','search-close'].includes(actionName)){this._state.query='';this._state.matchIndex=0;this._state.expandedKey=null;if(actionName==='search-close')this._state.searchOpen=false;if(p.contentState==='no-results')this._state.contentState='overview';refresh=true}
  if(['previous-match','next-match'].includes(actionName)){const matches=historyRows(p,p.contentState||'overview').filter(r=>Object.values(r).some(v=>String(v).toLowerCase().includes(String(p.query||'').toLowerCase())));if(matches.length){this._state.matchIndex=(Number(p.matchIndex??0)+(actionName==='next-match'?1:-1)+matches.length)%matches.length;refresh=true;}}
 }

 if(n==='onboarding/tutorial'&&['next','previous','step'].includes(actionName)){const max=(p.slides||[1,2,3]).length-1;this._state.step=Math.max(0,Math.min(max,actionName==='step'?Number(value):Number(p.step||0)+(actionName==='next'?1:-1)));value=this._state.step;refresh=true}
 if(n.startsWith('game-control-')&&['stake','difficulty','autoplay','bonus'].includes(actionName)){this.openDialog(actionName==='stake'?'action-boxes':actionName==='difficulty'?'difficulty-panel':actionName==='autoplay'?'autoplay-sheet':'bonus-modals',{value:actionName==='difficulty'?p.difficulty||'Medium':stakeState(p).value,...(actionName==='stake'?{values:stakeState(p).values.slice().reverse(),...(p.stakeColumns?{Columns:String(p.stakeColumns)}:{})}:{}),...(actionName==='autoplay'?{...p.autoplaySettings,infiniteAvailable:yes(p.infiniteAvailable)}:{})},actionName);}
 if(n.startsWith('game-control-')&&['stake-increase','stake-decrease'].includes(actionName)){
  const stake=stakeState(p),next=actionName==='stake-increase'?stake.values.find(v=>v>stake.value):stake.values.slice().reverse().find(v=>v<stake.value);
  if(next===undefined||p.disabled)return;
  this._state.stake=next;actionName='stake-change';value=next;refresh=true;
 }
 if(n.startsWith('game-control-')&&actionName==='stop'){
  this._state.autoplayActive=false;this._state.autoplayRemaining=0;value={remaining:p.autoplayRemaining};refresh=true;
 }
 if(n.startsWith('game-control-')&&actionName==='turbo'){const {speeds,speed}=turboState(p);this._state.turboSpeed=speeds[(speeds.indexOf(speed)+1)%speeds.length];this._state.turbo=this._state.turboSpeed>1;value={speed:this._state.turboSpeed};refresh=true}
 if(refresh){this.render();if(actionName==='detail'&&n.startsWith('history/content/')){[...this.shadowRoot.querySelectorAll('[data-history-key]')].find(x=>x.dataset.historyKey===String(value))?.shadowRoot.querySelector('button')?.focus({preventScroll:true});}if(n==='history/panel'&&['previous-match','next-match'].includes(actionName)){this.shadowRoot.querySelector('.history-scroll is-component')?.shadowRoot.querySelector('[data-search-current]')?.scrollIntoView({block:'nearest'});}}emit(this,actionName,value);
 }
 scrollSelectionIntoView(){const scroller=this.shadowRoot.querySelector('.selection-scroll');if(!scroller)return;const selected=[...scroller.querySelectorAll('is-component')].find(el=>el.shadowRoot?.querySelector('[aria-pressed="true"]'));if(selected){const a=selected.getBoundingClientRect(),b=scroller.getBoundingClientRect();scroller.scrollTop+=a.top-b.top-(b.height-a.height)/2;}}
 focusPrimary(){this.shadowRoot.querySelector('is-component[name="control-bet-button"]')?.shadowRoot.querySelector('button:not(:disabled)')?.focus({preventScroll:true});}
 completeAutoplayRound(){
  if(!this.name.startsWith('game-control-')||!yes(this.options.autoplayActive))return;
  const current=this.options.autoplayRemaining;
  const remaining=current==='infinite'?'infinite':Math.max(0,Number(current)-1);
  this._state.autoplayRemaining=remaining;this._state.autoplayActive=remaining==='infinite'||remaining>0;
  this.render();emit(this,remaining===0?'autoplay-complete':'autoplay-progress',{remaining});
 }
 openDialog(name,options,kind){if(this.shadowRoot.querySelector('dialog[open]'))return;const opener=this.shadowRoot.activeElement;const activeControl=[...this.shadowRoot.querySelectorAll('is-component')].find(x=>x.shadowRoot?.querySelector(`[data-action="${kind}"]`));activeControl?.setAttribute('data-dialog-active','');const dialog=document.createElement('dialog');dialog.setAttribute('aria-label',kind);const nativeClose=dialog.close.bind(dialog);let closing=false;dialog.close=()=>{if(closing||!dialog.open)return;if(matchMedia('(prefers-reduced-motion: reduce)').matches){nativeClose();return}closing=true;dialog.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(6px)'}],{duration:parseFloat(getComputedStyle(this).getPropertyValue('--motion-fast'))||125,easing:'ease-in',fill:'forwards'}).finished.then(()=>nativeClose(),()=>nativeClose())};dialog.addEventListener('cancel',ev=>{ev.preventDefault();dialog.close()});const selection=['stake','difficulty'].includes(kind);if(selection)dialog.classList.add('selection-dialog');dialog.innerHTML=(name==='onboarding/tutorial'?`<div class="dialog-close"><button class="icon-button" aria-label="Close tutorial">${icon('close')}</button></div>`:'')+tag(name,options);this.shadowRoot.append(dialog);dialog.querySelector('.dialog-close button')?.addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{dialog.remove();this.shadowRoot.querySelectorAll('[data-dialog-active]').forEach(x=>x.removeAttribute('data-dialog-active'));(opener?.isConnected?(opener.shadowRoot?.querySelector('button')||opener):[...this.shadowRoot.querySelectorAll('is-component')].map(x=>x.shadowRoot?.querySelector(`[data-action="${kind}"]`)).find(Boolean))?.focus({preventScroll:true})});dialog.addEventListener('is-action',ev=>{ev.stopPropagation();const {action,value}=ev.detail;if(action==='select'&&['stake','difficulty'].includes(kind)){if(kind==='stake')this._state.stake=Math.max(stakeState(this.options).min,Math.min(stakeState(this.options).max,Number(value)));if(kind==='difficulty')this._state.difficulty=value;dialog.close();this.render();const target=[...this.shadowRoot.querySelectorAll('is-component')].find(x=>x.shadowRoot.querySelector(`[data-action="${kind}"]`));target?.shadowRoot.querySelector('button')?.focus({preventScroll:true});emit(this,kind+'-change',value)}if(['close','start','bonus-select'].includes(action)){dialog.close();if(kind==='autoplay'&&action==='start'){this._state.autoplaySettings={...this.options.autoplaySettings,...value};this._state.autoplayRemaining=value.rounds;this._state.autoplayActive=true;this.render();this.shadowRoot.querySelector('is-component[name="control-bet-button"]')?.shadowRoot.querySelector('button')?.focus({preventScroll:true})}emit(this,action,value)}});dialog.showModal();
 if(kind==='stake')requestAnimationFrame(()=>dialog.querySelector('is-component')?.scrollSelectionIntoView());
 if(kind==='stake'&&this.options.stakePlacement==='above'){
  dialog.dataset.placement='above';
  const position=()=>{const trigger=this.shadowRoot.querySelector('is-component[name^="control-button-primary"]');if(!trigger||!dialog.open)return;const r=trigger.getBoundingClientRect(),available=Math.max(80,r.top-20);dialog.style.setProperty('--stake-scroll-max',Math.max(36,available-56)+'px');dialog.style.maxHeight=available+'px';const d=dialog.getBoundingClientRect();dialog.style.left=Math.max(8,Math.min(r.left,innerWidth-d.width-8))+'px';dialog.style.top=Math.max(8,r.top-d.height-10)+'px';};
  position();const observer=new ResizeObserver(position);observer.observe(this);window.addEventListener('resize',position);dialog.addEventListener('close',()=>{observer.disconnect();window.removeEventListener('resize',position)},{once:true});
 }
 }
}
customElements.define('is-component',IncentiveComponent);
