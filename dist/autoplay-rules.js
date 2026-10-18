/* UI scheduling limits only; outcome selection and payouts remain in the game engine. */
(function(root){
 function create(settings,stakeCents,balanceCents){
  const limit=key=>{if(settings[key]==null)return null;const n=Number(settings[key]);if(!Number.isFinite(n)||n<=0)throw Error('Invalid autoplay limit');return Math.round(n*stakeCents);};
  return {openingBalanceCents:balanceCents,lossCents:limit('loss'),profitCents:limit('profit'),singleCents:limit('single')};
 }
 function reason(session,balanceCents,payoutCents){
  if(!session)return null;
  if(session.singleCents!==null&&payoutCents>=session.singleCents)return 'Single-win limit reached';
  if(session.profitCents!==null&&balanceCents-session.openingBalanceCents>=session.profitCents)return 'Profit limit reached';
  if(session.lossCents!==null&&session.openingBalanceCents-balanceCents>=session.lossCents)return 'Loss limit reached';
  return null;
 }
 function nextRemaining(remaining){return remaining==='infinite'?'infinite':Math.max(0,remaining-1);}
 const rules={create,reason,nextRemaining};if(typeof module!=='undefined')module.exports=rules;else root.HuffAutoplayRules=rules;
})(globalThis);
