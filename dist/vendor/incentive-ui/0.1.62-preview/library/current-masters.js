import {escape as e,asset,icon,child,action} from './core.js?v=0.1.62-preview';

export function replayButton(p={}){
 const state=p.state||p['Property 1']||'default',dark=state!=='Default'&&state!=='default';
 return `<button type="button" class="replay-button" data-state="${e(state.toLowerCase())}" data-action="replay" ${p.disabled||state==='disabled'?'disabled':''}><img class="replay-light" src="${asset('ac7f6.svg')}" width="15" height="15" alt=""><img class="replay-dark" src="${asset('95bf7.svg')}" width="15" height="15" alt=""><span>Replay</span></button>`;
}
export const replayIndicator=(p={})=>`<img class="replay-indicator" data-playing="${p.playing!==false}" src="${asset('fab2d.svg')}" width="24" height="24" alt="Replay playing">`;
export function complianceHeader(p){
 const state=p.compliance||'positive',file={positive:'d79ea.svg',negative:'de5bd.svg',neutral:'22807.svg'}[state],net=p.net||({positive:'+$4.00',negative:'-$2.00',neutral:'$0.00'}[state]);
 return `<div class="compliance current-compliance"><div class="compliance-left"><span>${e(p['Game Name']||p.gameName||'Game Name')}</span><div class="session"><span><img src="${asset('91148.svg')}" alt="" width="10" height="10">${e(p.time||'13:37')}</span><span><img src="${asset('b6029.svg')}" alt="" width="10" height="12.057">${e(p.elapsed||'00:03:12')}</span></div></div><span class="compliance-net"><img src="${asset(file)}" width="10" height="10" alt="">${e(net)}</span></div>`;
}
export function header(p){
 const replay=p.type==='session-replay',open=p.menuOpen??p.type==='menu open';
 return `<div class="header-balance current-header ${replay?'replay-header':''}">${replay?`<div class="replay-title">${replayIndicator(p)}<strong>Replay Round</strong></div>`:child('balance',{...p,content:p.content||'Balance'})}<div class="header-buttons round">${replay?'':`<button type="button" aria-label="Information" data-action="information">${icon('info')}</button>`}<button type="button" aria-label="${replay?'Close replay':open?'Close menu':'Menu'}" data-action="${replay?'close':'menu'}" ${replay?'':`aria-expanded="${open}" aria-controls="game-menu"`}>${icon(replay||open?'close':'menu')}</button></div>${p.menuOpen===true?`<div class="header-menu" id="game-menu">${child('menu',{music:p.music,sound:p.sound})}</div>`:''}</div>`;
}
export function footer(p){
 if(p.type==='session-replay')return `<section class="replay-footer" aria-label="Replay round summary"><div class="replay-summary"><div><span>Bet Amount</span><strong>${e(p.stake??'£2.00')}</strong></div><div><span>Win</span><strong>${e(p.winnings??'£2000.00')}</strong></div><div><span>Multiplier</span><strong>${e(p.multiplier??'1000x')}</strong></div></div><div class="replay-metadata"><span>Bet ID: ${e(p.betId??'0000 0000 000')}</span><span>${e(p.dateTime??'19:23  26.01.2026')}</span></div></section>`;
 return `<div class="last-win ${p.type==='last-win-sm'?'small':''}"><span>Bet: <strong>${e(p['Bet Amount']??p.bet??'$1.00')}</strong></span><span>Win: <strong>${e(p['Last Win Amount']??p.win??'$12.00')}</strong></span></div>`;
}
export function bonusControl(p){
 const active=p.type==='active-bonus'||p.state==='pressed';
 return `<button type="button" data-state="${e(p.state||'default')}" class="bonus-control ${active?'active-bonus':''}" aria-label="${active?'Exit bonus':'Bonus'}" data-action="${e(p.action||(active?'bonus-exit':'bonus'))}" ${p.disabled||p.state==='disabled'?'disabled':''}>${Object.entries({default:'state-f61c3.svg',hover:'state-f0db1.svg',focus:'state-32b79.svg'}).map(([st,f])=>`<img class="bonus-background bonus-background-${st}" src="${asset(f)}" alt="">`).join('')}${active?'<span>EXIT<br>BONUS</span>':`<span><img class="bonus-mark" src="${asset('state-ecf58.svg')}" alt=""><img class="bonus-mark-hover" src="${asset('state-5c715.svg')}" alt="">BONUS</span>`}</button>`;
}
export function bonusBuy(p){
 const bonusAction=(label,name,props)=>action(label,name,{...props,fluid:true});
 const active=p.active===true,confirm=!active&&p.type==='confirmation',price=p.price||'$2.00';
 return `<section class="bonus-buy ${confirm?'confirmation':''}"><div class="bonus-art"><img src="${asset('39358.png')}" alt=""></div><div class="bonus-buy-content"><div class="bonus-copy"><h3>${e(p.title||'Remove seagulls & planes')}</h3><p>${e(p.description||`Activate this bonus for the rest of your session.`)}</p></div><div class="bonus-buy-actions">${active?bonusAction('Active','bonus-active',{disabled:true}):confirm?`${bonusAction('Confirm','bonus-confirm',{disabled:p.disabled})}${bonusAction('Cancel','bonus-cancel',{secondary:true,disabled:p.disabled})}`:bonusAction(`Buy: ${price}`,'bonus-buy',{disabled:p.disabled})}</div></div></section>`;
}
export function bonusModal(p){
 const type=p.type||'1 bonus',many=type==='2+ bonuses',count=many?4:type==='2 bonuses'?2:1;
 const offers=p.offers||Array.from({length:count},(_,i)=>({key:String(i),price:type==='2 bonuses'&&i===1?'$200.00':'$2.00',requiresConfirmation:i%2===1}));
 return `<section class="bonus-modal ${many?'many':count===2?'two':'one'}"><header class="bonus-modal-heading"><div><h2>Bonus Buys</h2><p>Both bonuses last for your session. Some activate on Buy; others ask you to confirm.</p></div><button type="button" class="icon-button" data-action="close" aria-label="Close bonus buys">${icon('close')}</button></header><div class="bonus-modal-scroll" tabindex="${many?'0':'-1'}" aria-label="Bonus offers"><div class="bonus-modal-offers">${offers.map((offer,i)=>child('bonus-buy',{...offer,key:offer.key??String(i),active:(p.activeKeys||[]).includes(offer.key??String(i)),type:p.confirming===(offer.key??String(i))?'confirmation':'single-button'})).join('')}</div></div>${many?'<div class="bonus-scroll-track" aria-hidden="true"><i></i></div><div class="bonus-scroll-fade" aria-hidden="true"></div>':''}</section>`;
}
