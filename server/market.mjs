const url = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
let cached, inflight;
export async function ecbRates() {
  if (cached && Date.now()-cached.loaded < 3600000) return cached;
  if (!inflight) inflight=(async()=>{
    const response=await fetch(url,{signal:AbortSignal.timeout(4000)});
    if (!response.ok) throw Error('exchange_rate_unavailable');
    const xml=await response.text(), date=/<Cube time='([0-9-]+)'/.exec(xml)?.[1];
    const age=Date.now()-Date.parse(date);
    if (!Number.isFinite(age) || age<0 || age>7*86400000) throw Error('exchange_rate_unavailable');
    const rates={EUR:1};
    for(const [,code,value] of xml.matchAll(/<Cube currency='([A-Z]{3})' rate='([0-9.]+)'/g)) if(Number(value)>0) rates[code]=Number(value);
    return cached={rates,date,url,loaded:Date.now()};
  })().finally(()=>{inflight=null});
  return inflight;
}
const median=xs=>xs.length%2 ? xs[xs.length>>1] : (xs[(xs.length>>1)-1]+xs[xs.length>>1])/2;
const round=(n,c)=>Number(n.toFixed(['JPY','KRW'].includes(c)?0:2));
export async function finalizeMarket(rows, currency='KRW', rates=ecbRates) {
  const fx=rows.some(o=>o.currency!==currency)?await rates().catch(()=>null):null;
  const offers=rows.map((o,i)=>({...o,id:'offer-'+i}));
  const eligible=offers.filter(o=>o.availability==='in_stock' && o.condition!=='unknown' &&
    (o.currency===currency || (fx?.rates[currency] && fx.rates[o.currency])));
  if (!eligible.length) return {offers};
  const condition=eligible.some(o=>o.condition==='new')?'new':'used';
  const cohort=eligible.filter(o=>o.condition===condition);
  const delivered=cohort.every(o=>Number.isFinite(o.shipping));
  for (const o of cohort) {
    o.compareCurrency=currency;
    o.comparePrice=round((o.price+(delivered?o.shipping:0))*(o.currency===currency?1:fx.rates[currency]/fx.rates[o.currency]),currency);
  }
  const byUrl=new Map();
  for(const o of cohort.sort((a,b)=>a.comparePrice-b.comparePrice)) {
    const canonical=new URL(o.url);canonical.hash='';
    for(const key of [...canonical.searchParams.keys()]) if (/^(utm_|ref$|tag$)/i.test(key)) canonical.searchParams.delete(key);
    canonical.searchParams.sort(); if(!byUrl.has(canonical.href))byUrl.set(canonical.href,o);
  }
  const unique=[...byUrl.values()];
  const middle=median(unique.map(o=>o.comparePrice));
  const sorted=unique.filter(o=>unique.length<4 || o.comparePrice>=middle/4 && o.comparePrice<=middle*4);
  if (!sorted.length)return {offers};
  const values=sorted.map(o=>o.comparePrice);
  return {offers,lowest:sorted[0].id,highest:sorted.at(-1).id,
    representative:{min:values[0],median:round(median(values),currency),max:values.at(-1),currency,condition,
      basis:delivered?'delivered':'item_only',sampleCount:sorted.length,
      ...(fx && sorted.some(o=>o.currency!==currency) && {exchange:{date:fx.date,url:fx.url}})}};
}
