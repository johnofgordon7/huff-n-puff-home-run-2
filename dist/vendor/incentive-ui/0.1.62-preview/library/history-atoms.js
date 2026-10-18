import {replayButton} from './current-masters.js?v=0.1.62-preview';
import {escape as e, icon} from './core.js';

// Figma component set 117:2555. These are shared atoms, not whole history views.
export const historyAtomVariants = ['date','title','loss','win','cancelled','bonus','bet-detail','expandable-bet-row','history-detail','freebet','freebet-bonus','replay'];
const guidance = 'This history only displays the last 10 games you’ve played. For a complete history please refer to your operator account';
const badge = (text,cancelled=false) => `<span class="history-atom-badge${cancelled?' cancelled':''}">${e(text)}</span>`;

export function historyAtom(p){
 const raw=p.variable||p.status||'date';const variant=raw==='freebet'?'bonus':raw==='freebet-bonus'?'expandable-bet-row':raw;
 if(!historyAtomVariants.includes(variant))throw Error('Unknown history atom variant: '+variant);
 const cls=`history-atom atom-${variant}${p.surface==='secondary'?' atom-surface-secondary':''}${p.winning?' atom-winning':''}`;
 if(variant==='replay')return `<div class="history-atom atom-replay"><div class="atom-detail-field"><p class="atom-detail-label">Date</p><p>${e(p.date??'21/10/2024')}</p></div><div class="atom-detail-field"><p class="atom-detail-label">Time</p><p>${e(p.time??'12:00:14')}</p></div>${replayButton(p)}</div>`;
 if(variant==='date')return `<div class="${cls}"><p>${e(p.date??'21/10/2024')}</p></div>`;
 if(variant==='title')return `<div class="${cls}"><p class="atom-id">Bet ID</p><p class="atom-stake">Stake</p><p class="atom-winnings">Winnings</p></div>`;
 if(variant==='history-detail')return `<div class="${cls}"><p>${e(p.historyGuidance??p.guidance??p['History guidance']??guidance)}</p></div>`;
 if(variant==='bet-detail'){
  const fields=p.fields??[{label:'Date',value:p.date??'21/10/2024',badge:p.freeBet===false?null:'FREE BET'},{label:'Time',value:p.time??'12:00:14'}];
  if(!Array.isArray(fields)||fields.length!==2)throw Error('bet-detail requires two fields');
  return `<div class="${cls}">${fields.map(f=>`<div class="atom-detail-field"><p class="atom-detail-label">${e(f.label)}</p><div class="atom-detail-value"><span class="${f.tone==='winnings'?'atom-winning-text':''}">${e(f.value)}</span>${f.badge?badge(f.badge):''}</div></div>`).join('')}</div>`;
 }
 const id=p.id??'1209374677091';
 const free=variant==='bonus'||variant==='expandable-bet-row';
 const result=variant==='cancelled'?badge('CANCELLED',true):`<span>${e(p.win??(variant==='win'?'$10.00':'-'))}</span>`;
 return `<button type="button" class="${cls}" data-action="detail" data-value="${e(p.rowKey??id)}" aria-label="${p.expanded?'Collapse':'Expand'} bet ${e(id)}" aria-expanded="${p.expanded===true}" ${p.disabled?'disabled':''}>
  <span class="atom-id">${e(id)}</span>
  <span class="atom-stake"><span>${e(p.stake??p.bet??'$1.00')}</span>${free?`<span class="atom-badges">${badge('FREE BET')}${variant==='expandable-bet-row'?badge('BONUS'):''}</span>`:''}</span>
  <span class="atom-winnings">${result}</span>${icon(p.expanded?'arrow up':'arrow down')}
 </button>`;
}
