/** Draft preview translations and illustrative demo presets; not exchange rates. */
export const languages = [{"code": "en", "label": "English", "locale": "en-GB"}, {"code": "pt_BR", "label": "Português (Brasil)", "locale": "pt-BR"}, {"code": "fr", "label": "Français", "locale": "fr"}, {"code": "de", "label": "Deutsch", "locale": "de"}, {"code": "it", "label": "Italiano", "locale": "it"}, {"code": "es_419", "label": "Español (Latinoamérica)", "locale": "es-419"}, {"code": "pt", "label": "Português", "locale": "pt-PT"}, {"code": "sk", "label": "Slovenčina", "locale": "sk"}, {"code": "es", "label": "Español", "locale": "es"}, {"code": "sw", "label": "Kiswahili", "locale": "sw"}];
export const currencies = ["NZD", "PEN", "PLN", "RMB", "RON", "RSD", "RWF", "THB", "TWD", "TZS", "XAF", "XOF", "ZAR", "ZMW", "SEK", "CAD", "NOK", "AUD", "KES", "UGX", "GBP", "USD", "NAD", "ETB", "GHS", "GNF", "HUF", "INR", "ISK", "JPY", "LRD", "MWK", "MXN", "MYR", "NGN", "AOA", "CHF", "MZN", "ARS", "CNY", "BGN", "CZK", "BRL", "EUR", "CDF", "DKK", "SLL"];
export const translations = await fetch(new URL('./translations.json?v=0.1.62-preview',import.meta.url)).then(r=>{if(!r.ok)throw Error('Translations unavailable');return r.json()});
let config={language:'en',currency:'USD'};
export const settings=()=>({...config});
export const locale=()=>languages.find(l=>l.code===config.language).locale;
export function configure(next){if(next.language&&!languages.some(l=>l.code===next.language))throw Error('Unsupported language');if(next.currency&&!currencies.includes(next.currency))throw Error('Unsupported currency');config={...config,...next};}
export function preset(code=config.currency){
 if(!currencies.includes(code))throw Error('Unsupported currency');
 const scale=['GNF','SLL','UGX','CDF','TZS'].includes(code)?1000:['RWF','MWK','NGN','AOA','ARS','JPY','HUF','ISK','XAF','XOF'].includes(code)?100:['KES','ETB','INR','LRD','MZN','RSD','THB','TWD','ZAR','ZMW','NAD','GHS','MXN'].includes(code)?10:1;
 const steps=[.1,.2,.4,.6,.8,1,2,3,4,5,6,7,8,9,10,15,20,25,50,75,100,150,200].map(n=>Math.round(n*scale*100)/100);
 return {currency:code,balance:10000*scale,stake:scale,min:steps[0],max:steps.at(-1),steps,demo:true};
}
export function money(value,currency=config.currency,language=config.language){
 const loc=languages.find(l=>l.code===language)?.locale||language||'en-GB';
 if(!currencies.includes(currency))return currency+Number(value).toFixed(2);
 // RMB is a supported product label for CNY. SLL is intentionally kept as supplied.
 const iso=currency==='RMB'?'CNY':currency;
 const formatted=new Intl.NumberFormat(loc,{style:'currency',currency:iso,currencyDisplay:'code'}).format(value);
 return currency==='RMB'?formatted.replace('CNY','RMB'):formatted;
}
export function number(value){return new Intl.NumberFormat(locale(),{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);}
export function t(input){const raw=String(input),trim=raw.trim(),dict=translations[config.language];if(dict[trim])return raw.replace(trim,dict[trim]);const plain=trim.replace(/:$/,'');if(dict[plain])return raw.replace(plain,dict[plain]);const key=Object.keys(translations.en).find(k=>k.toLowerCase()===trim.toLowerCase());return key?raw.replace(trim,dict[key]):raw;}
const originals=new WeakMap();
export function translateTree(root){
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
 while(node=walker.nextNode()){if(node.parentElement?.closest('style,script,code,pre,[data-no-translate]'))continue;let record=originals.get(node);if(!record||node.nodeValue!==record.output)record={source:node.nodeValue};const output=t(record.source);if(node.nodeValue!==output)node.nodeValue=output;record.output=output;originals.set(node,record);}
 for(const el of root.querySelectorAll('[aria-label],[title],[placeholder]'))for(const key of ['aria-label','title','placeholder'])if(el.hasAttribute(key)){const store=el.__localeAttributes??={};let r=store[key];if(!r||el.getAttribute(key)!==r.output)r={source:el.getAttribute(key)};r.output=t(r.source);if(el.getAttribute(key)!==r.output)el.setAttribute(key,r.output);store[key]=r;}
 for(const el of root.querySelectorAll('is-component'))if(el.shadowRoot)translateTree(el.shadowRoot);
}
export function watch(root){translateTree(root);const observer=new MutationObserver(()=>translateTree(root));observer.observe(root,{childList:true,subtree:true,characterData:true});return observer;}
export function refresh(root=document){translateTree(root);for(const el of root.querySelectorAll('is-component'))el.render();}
// Preserve authored dimensions. Shrink only overflowing labels/values, never below 10px.
export function fitText(root){
 for(const el of root.querySelectorAll('.button.fluid span,.wing .text small,.wing .text strong,.value:not(.autoplay),.balance strong,.balance small,.replay-footer-values span')){
  el.style.fontSize='';el.style.whiteSpace='nowrap';
  let size=parseFloat(getComputedStyle(el).fontSize);el.style.fontSize=size+'px';
  while(el.scrollWidth>el.clientWidth+1&&size>10){size=Math.max(10,size-.5);el.style.fontSize=size+'px';}
  if(el.scrollWidth>el.clientWidth+1&&!el.closest('.wing,.button.fluid')){el.style.whiteSpace='normal';el.style.overflowWrap='anywhere';}
 }
}
