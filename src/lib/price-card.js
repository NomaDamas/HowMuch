import { t, numberFormat } from './i18n.js';
export const amount = (value, currency) => Number.isFinite(value) && ['KRW','EUR','JPY','USD'].includes(currency)
  ? new Intl.NumberFormat(numberFormat(), {style:'currency', currency, maximumFractionDigits: currency==='KRW'||currency==='JPY'?0:2}).format(value) : '';
// Returns short display strings only: a price, one line of basis, and a type label.
export function summarizeCard(result) {
  const e=result?.estimate;
  // Tier 3: unit market price (food etc.): no model, price per kg / piece
  if(result?.pricingMode==='market_unit'&&e?.unit){
    const price=amount(e.median,e.currency), region=e.region&&e.region!=='전국'?e.region:t('price.region.all');
    return {price:price+' / '+e.unit,basis:region+' · '+t('price.sources',{n:e.sampleCount}),type:t('price.market'),label:t('price.unitLabel',{p:price,u:e.unit,r:region})};
  }
  // Tier 2: model unknown: rough average of comparable listings
  if(result?.pricingMode==='type_estimate'&&e){
    const price=t('price.approx',{p:amount(e.mean,e.currency)});
    return {price,basis:t('price.avgOf',{n:e.sampleCount}),type:t('price.estimate'),label:t('price.estLabel',{p:price})};
  }
  if(result?.status==='followup_required') return {price:t('price.askModel'),basis:t('price.askModelBasis'),type:t('price.hold')};
  const lo = typeof result?.lowest==='string'?result.offers?.find(o=>o.id===result.lowest||o.url===result.lowest):result?.lowest;
  const price=amount(lo?.comparePrice??lo?.price,lo?.compareCurrency??lo?.currency);
  if(price) {
    const n=result.representative?.sampleCount??result.offers.length;
    const basis=(n===1?t('price.single'):t('price.compare',{n}))+' · '+(result.representative?.basis==='delivered'?t('price.delivered'):t('price.item'));
    return {price,basis,type:t('price.verified'),label:price+' · '+basis};
  }
  return {price:t('price.none'), basis:t('price.none'),type:t('price.none')};
}
export function spatialHandoff(title,label,template) {
  if(!title||!label) return null;
  const q = new URLSearchParams({name:Array.from(title).slice(0,120).join(''),label:Array.from(label).slice(0,120).join('')});
  if(template){
    const pts=template.pts.map(([dx,dy,r,g,b])=>[+dx.toFixed(3),+dy.toFixed(3),r,g,b]);
    const token=btoa(JSON.stringify({v:1,aspect:+template.aspect.toFixed(4),height:+template.height.toFixed(4),pts})).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
    q.set('sig',token);
  }
  return 'howmuch-ar://place?'+q.toString().replaceAll('+','%20');
}
