// Anchor Bonus to the visible stake boundary, including translated label overflow.
export function keepBonusSpacing(controller, getBonus, placement = () => 'above') {
 let frame=0;
 const observed=new Set();
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(update)};
 const resize=new ResizeObserver(schedule);
 const mutations=new MutationObserver(schedule);
 const roots=new Set();
 function watch(root){if(root&&!roots.has(root)){mutations.observe(root,{childList:true,subtree:true,characterData:true});roots.add(root)}}
 function update(){
  frame=0;
  const bonus=getBonus(),stake=controller.shadowRoot?.querySelector('is-component[name^="control-button-primary"]');
  const wing=stake?.shadowRoot?.querySelector('.wing');
  const button=bonus?.shadowRoot?.querySelector('.bonus-control');
  if(!button||!wing)return;
  const nextRoots=[controller.shadowRoot,bonus.shadowRoot,stake.shadowRoot];
  if(nextRoots.some(root=>!roots.has(root))||roots.size!==nextRoots.length){mutations.disconnect();roots.clear();nextRoots.forEach(watch)}
  const parts=[button,...button.querySelectorAll('.bonus-background,span')];
  const targets=[controller,wing,...parts];
  for(const el of observed)if(!targets.includes(el)){resize.unobserve(el);observed.delete(el)}
  for(const el of targets)if(!observed.has(el)){resize.observe(el);observed.add(el)}
  const bounds=parts.map(el=>el.getBoundingClientRect()),w=wing.getBoundingClientRect();
  const right=Math.max(...bounds.map(r=>r.right)),bottom=Math.max(...bounds.map(r=>r.bottom));
  const left=Math.min(...bounds.map(r=>r.left));
  const above=placement()==='above';
  const dx=above?w.left-left:w.left-16-right;
  const dy=above?w.top-16-bottom:(w.top+w.bottom)/2-(button.getBoundingClientRect().top+button.getBoundingClientRect().bottom)/2;
  const x=Number(bonus.dataset.spacingX||0)+dx,y=Number(bonus.dataset.spacingY||0)+dy;
  if(Math.abs(dx)>.05||Math.abs(dy)>.05){bonus.dataset.spacingX=x;bonus.dataset.spacingY=y;bonus.style.translate=`${x}px ${y}px`}
 }
 watch(controller.shadowRoot);resize.observe(controller);observed.add(controller);
 window.addEventListener('resize',schedule);document.fonts.ready.then(schedule);schedule();
 return ()=>{cancelAnimationFrame(frame);resize.disconnect();mutations.disconnect();window.removeEventListener('resize',schedule)};
}
