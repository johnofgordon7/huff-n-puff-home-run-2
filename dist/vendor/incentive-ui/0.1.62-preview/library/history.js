import {escape as e,child,icon,action} from './core.js';

export const historyListStates=['overview','winning-bet','free-bet','free-bet-with-footer','cancelled-bet','replay'];
export function historyRows(p={},state='overview'){
 const second=state==='cancelled-bet'?'cancelled':state.startsWith('free-bet')?'bonus':'win';
 const defaults=['loss',second,'cancelled','bonus','loss','win','bonus'].map((status,i)=>({key:`sample-${i}`,id:'1209374677091',date:i<4?'21/10/2026':'20/10/2026',time:'12:00:14',bet:'$1.00',win:status==='win'||i===1&&status==='bonus'?'$10.00':'-',multiplier:['loss','cancelled'].includes(status)?'-':'10.00×',difficulty:'Easy',balanceBefore:'$100.00',balanceAfter:status==='loss'?'-':status==='cancelled'?'$100.00':'$110.00',freeCreditBefore:'$1.00',freeCreditAfter:'$0.00',status}));
 return (p.rows??defaults).map((r,i)=>({...r,key:String(r.key??`${r.id??'bet'}-${i}`)}));
}
export function expandedHistoryKey(p,state,rows=historyRows(p,state)){
 return p.expandedKey!==undefined?p.expandedKey:state==='overview'?null:rows[1]?.key??null;
}
function details(r,replay=false){
 const free=r.status==='bonus'||r.status==='expandable-bet-row';
 const pairs=[
 [{label:'Date',value:r.date??'-'},{label:'Time',value:r.time??'-'}],
 [{label:'Stake',value:r.stake??r.bet??'-',badge:free?'FREE BET':null},{label:'Winnings',value:r.win??'-',tone:r.status==='win'||free&&r.win&&r.win!=='-'?'winnings':null}],
 [{label:'Cashout Multiplier',value:r.multiplier??'-'},{label:'Difficulty',value:r.difficulty??'-'}],
 [{label:'Balance Before',value:r.balanceBefore??'-'},{label:'Balance After',value:r.balanceAfter??'-'}]
 ];
 if(free||replay)pairs.push([{label:'Free Credit Before',value:r.freeCreditBefore??'-'},{label:'Free Credit After',value:r.freeCreditAfter??'-'}]);
 return `<div class="history-expanded" id="history-expanded-${e(r.key)}">${pairs.map((fields,i)=>replay&&i===0?child('bet-history-atoms',{variable:'replay',date:r.date,time:r.time,value:{key:r.key,betId:r.id}}):child('bet-history-atoms',{variable:'bet-detail',fields})).join('')}</div>`;
}
export function historyContent(p,state){
 if(!historyListStates.includes(state)){
  const messages={loading:['Bet history loading...',''],error:['Content failed to load','Your bet history has failed to load.\nPlease try again or come back later'],empty:['No bets yet','Your settled bets will appear here.'],'no-results':['No matching bets','Try a different search or clear your search to see all bets.']};
  if(!messages[state])throw Error('Unknown history content state: '+state);
  const [title,copy]=messages[state];
  return `<div class="history-state history-state-${state}"><div class="history-state-copy">${state==='loading'?child('loading'):''}<h2>${e(p.title??title)}</h2>${copy?`<p>${e(p.message??copy)}</p>`:''}</div>${state==='error'?action('Try again','retry'):state==='no-results'?action('Clear search','clear-search'):''}</div>`;
 }
 const rows=historyRows(p,state),expanded=expandedHistoryKey(p,state,rows);let previousDate;
 const items=[];
 for(const r of rows){
  if(r.date!==previousDate){items.push(`<div class="history-date-group">${child('bet-history-atoms',{variable:'date',date:r.date??'-'})}${child('bet-history-atoms',{variable:'title'})}</div>`);previousDate=r.date;}
  const open=r.key===expanded;
  items.push(child('bet-history-atoms',{...r,variable:r.status||'loss',rowKey:r.key,expanded:open,surface:open?'secondary':'primary',winning:r.status==='win'||r.status==='bonus'&&r.win&&r.win!=='-'},`data-history-key="${e(r.key)}"${p.focusedKey===r.key?' data-search-current="true"':''}`));
  if(open)items.push(details(r,state==='replay'));
 }
 items.push(child('bet-history-atoms',{variable:'history-detail',guidance:p.guidance}));
 return `<div class="history-list">${items.join('')}</div>`;
}
export function historyHeading(p){
 const allowed=p.searchScope==='how-to-play',open=allowed&&(p.searchOpen??p.search==='search open'),available=allowed&&(p.search==='yes'||p.search==='search open'||open);
 return `<div class="history-heading"><h2>${e(p.title||'Bet History')}</h2>${open?`<button class="icon-button modal-search-close" data-action="close" aria-label="Close">${icon('close')}</button><div class="history-search"><div class="history-search-input">${icon('search')}<input type="search" aria-label="Search ${e(p.title||'content')}" data-field="query" value="${e(p.query||'')}"><span class="history-search-count" aria-live="polite">${e(p.matchCount?Number(p.matchIndex??0)+1:0)}/${e(p.matchCount??0)}</span></div><div class="history-search-actions"><button class="icon-button" data-action="previous-match" aria-label="Previous match" ${!p.matchCount?'disabled':''}>${icon('arrow up')}</button><button class="icon-button" data-action="next-match" aria-label="Next match" ${!p.matchCount?'disabled':''}>${icon('arrow down')}</button><button class="icon-button" data-action="search-close" aria-label="Close search">${icon('close')}</button></div></div>`:`<div class="row">${available?`<button class="icon-button" data-action="search-toggle" aria-label="Search">${icon('search')}</button>`:''}<button class="icon-button" data-action="close" aria-label="Close">${icon('close')}</button></div>`}</div>`;
}
export function historyPanel(p){
 const state=p.contentState==='no-results'?'overview':p.contentState||'overview',rows=historyRows(p,state);
 return `<section class="panel history">${child('modal-heading',{title:'Bet History',search:'no'})}<div class="history-scroll">${child('history/content/'+state,{rows,expandedKey:p.expandedKey,guidance:p.guidance})}</div></section>`;
}
