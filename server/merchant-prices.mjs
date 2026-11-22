// Curated public storefronts only. Search/navigation suggestions never grant network access.
const merchants = ['apple.com','adafruit.com','lego.com','amazon.com','amazon.co.jp','coupang.com','nike.com','store.google.com','samsung.com','danawa.com','smartstore.naver.com','brand.naver.com','shopping.naver.com','ikea.com','uniqlo.com','emart.ssg.com','ssg.com','walmart.com','target.com','bestbuy.com','sparkfun.com','mouser.com','digikey.com','rei.com','nintendo.com','logitech.com','bhphotovideo.com','yes24.com','aladin.co.kr','kyobobook.co.kr','oliveyoung.co.kr','kurly.com','musinsa.com','11st.co.kr','gmarket.co.kr','auction.co.kr','adidas.com','newbalance.com'];
export function merchantUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:' || u.username || u.password || u.port || !merchants.some(h => h===u.hostname || u.hostname.endsWith('.'+h))) return null;
    if (u.pathname === '/' || /\/(cart|checkout|order|login|account|logout|add-to-cart|purchase|pay)(\/|$)/i.test(u.pathname)) return null;
    u.hash=''; return u.href;
  } catch { return null; }
}
const tag = value => String(value || '').split('/').pop().toLowerCase();
const number = value => (typeof value==='number' || (typeof value==='string' && /^\d+(?:\.\d+)?$/.test(value))) && Number.isFinite(Number(value)) ? Number(value) : null;
const array = value => Array.isArray(value) ? value : value ? [value] : [];
export function productObservations(docs, pageUrl, checkedAt = new Date().toISOString()) {
  if (!merchantUrl(pageUrl)) return [];
  const observations=[];
  function inspect(node) {
    if (Array.isArray(node)) return node.forEach(inspect);
    if (!node || typeof node!=='object') return;
    if (Array.isArray(node['@graph'])) inspect(node['@graph']);
    if (!array(node['@type']).includes('Product') || typeof node.name!=='string' || !node.name.trim()) return;
    for (const offer of array(node.offers)) {
      if (!array(offer?.['@type']).includes('Offer')) continue; // AggregateOffer lowPrice is not a purchasable offer.
      const price=number(offer.price), currency=offer.priceCurrency;
      if (offer.priceValidUntil && /^\d{4}-\d{2}-\d{2}/.test(String(offer.priceValidUntil)) && Date.parse(String(offer.priceValidUntil)) < Date.now()) continue;
      if (offer.validThrough && /^\d{4}-\d{2}-\d{2}/.test(String(offer.validThrough)) && Date.parse(String(offer.validThrough)) < Date.now()) continue;
      if (!(price>0) || !['USD','KRW','EUR','JPY'].includes(currency) || (currency==='KRW'||currency==='JPY') && !Number.isInteger(price)) continue;
      const condition=({newcondition:'new',usedcondition:'used',refurbishedcondition:'used',damagedcondition:'used'})[tag(offer.itemCondition)] || 'unknown';
      const availability=({instock:'in_stock',limitedavailability:'in_stock',outofstock:'out_of_stock',soldout:'out_of_stock',discontinued:'out_of_stock'})[tag(offer.availability)] || 'unknown';
      // Only accept unconditional shipping with one rate; location-, tier-, and currency-dependent rates need checkout.
      const shippingRules=array(offer.shippingDetails);
      const rule=shippingRules.length===1 ? shippingRules[0] : null;
      const rate=rule && !rule.shippingDestination && !rule.eligibleTransactionVolume && !rule.shippingConditions && rule.shippingRate?.currency===currency ? number(rule.shippingRate.value) : null;
      const shipping=rate!==null && rate>=0 ? rate : undefined;
      const evidence=[`Product: ${node.name}`,`Offer.price: ${price} ${currency}`,`Availability: ${availability}; condition: ${condition}`,shipping===undefined?'Shipping not confirmed':`Shipping: ${shipping} ${currency}`];
      const photo = array(node.image)[0];
      observations.push({title:node.name.slice(0,240),url:pageUrl,merchant:new URL(pageUrl).hostname,price,currency,condition,availability,shipping,checkedAt,evidence,confidence:.9,model:String(node.model || node.mpn || '').slice(0,100),sku:String(node.sku || '').slice(0,100),photo:typeof photo==='string'?photo:photo?.contentUrl || photo?.url});
      if(typeof node.material==='string')observations.at(-1).sourceMaterial=node.material.slice(0,100);
    }
  }
  docs.forEach(inspect); return observations;
}
// Report like-for-like listing prices when freight is unknown; never equate unknown freight to zero.
export function compareObservations(rows, preferred='KRW') {
  const offers=[...new Map(rows.map(row=>[[row.url,row.title,row.price,row.currency,row.condition,row.shipping].join('|'),row])).values()].map((o,i)=>({...o,id:'offer-'+i}));
  const eligible=offers.filter(o=>o.availability==='in_stock' && o.condition!=='unknown');
  const first=[...eligible].sort((a,b)=>Number(b.currency===preferred)-Number(a.currency===preferred)||Number(b.condition==='new')-Number(a.condition==='new'))[0];
  if (!first) return {offers};
  const cohort=eligible.filter(o=>o.currency===first.currency && o.condition===first.condition);
  const delivered=cohort.every(o=>Number.isFinite(o.shipping));
  const total=o=>o.price+(delivered?o.shipping:0);
  cohort.sort((a,b)=>total(a)-total(b));
  const mid=cohort.length/2;
  return {offers,lowest:cohort[0].id,highest:cohort.at(-1).id,representative:{min:total(cohort[0]),max:total(cohort.at(-1)),median:cohort.length%2?total(cohort[Math.floor(mid)]):(total(cohort[mid-1])+total(cohort[mid]))/2,currency:first.currency,condition:first.condition,basis:delivered?'delivered':'item_only',sampleCount:cohort.length}};
}
