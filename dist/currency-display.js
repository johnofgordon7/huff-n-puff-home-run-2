// Host display adapter; retain ISO codes in saved settings and game state.
import * as shared from './vendor/incentive-ui/0.1.62-preview/library/localization.js';
export * from './vendor/incentive-ui/0.1.62-preview/library/localization.js';
const iso=code=>code==='RMB'?'CNY':code;
export function currencySymbol(code){
 return new Intl.NumberFormat(shared.locale(),{style:'currency',currency:iso(code),currencyDisplay:'narrowSymbol'}).formatToParts(0).find(part=>part.type==='currency').value;
}
export function money(value,currency=shared.settings().currency,language=shared.settings().language){
 const locale=shared.languages.find(item=>item.code===language)?.locale||language||'en-GB';
 return new Intl.NumberFormat(locale,{style:'currency',currency:iso(currency),currencyDisplay:'narrowSymbol'}).format(value);
}
