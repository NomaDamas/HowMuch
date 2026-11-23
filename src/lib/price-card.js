export const amount = (value, currency) => Number.isFinite(value) && ['KRW','EUR','JPY','USD'].includes(currency)
  ? new Intl.NumberFormat('ko-KR', {style:'currency', currency}).format(value) : '';
export function summarizeCard(result) {
  const reference=result?.pricingMode==='category_reference'&&result.referenceMarket?.listings?.[0];
  if(reference){const price=amount(reference.price,reference.currency),basis=reference.quantity+reference.unit+' 구성 · 배송비 제외';return {price,basis:'유사 상품 · '+basis,type:'동일 상품 아님',label:'유사 상품 참고 '+price+' / '+reference.quantity+reference.unit};}
  const p = result?.produceMarket;
  if (p?.samples?.length && p.quantity>0 && p.unit) return {
    price:amount(p.median,p.currency), basis:p.region+' · '+p.quantity+p.unit+' 기준'+(p.cut?' · '+p.cut:'')+(p.grade&&p.grade!=='unknown'?' · '+p.grade:''), type:p.cut?'축수산물 참고 시세':'농산물 참고 시세',
    label:amount(p.median,p.currency)+' / '+p.quantity+p.unit+' · '+p.region+' 참고가'
  };
  if(result?.status==='followup_required') return {price:'품번을 비춰 주세요',basis:'모델 식별 필요',type:'가격 보류'};
  const lo = typeof result?.lowest==='string'?result.offers?.find(o=>o.id===result.lowest||o.url===result.lowest):result?.lowest;
  const price=amount(lo?.comparePrice??lo?.price,lo?.compareCurrency??lo?.currency);
  if(price) {
    const n=result.representative?.sampleCount??result.offers.length;
    const basis=(n===1?'단일 판매가':'비교 '+n+'건')+' · '+(result.representative?.basis==='delivered'?'배송비 포함':'상품가 기준');
    return {price,basis,type:'확인한 판매가',label:price+' · '+basis};
  }
  return {price:'가격 미확인', basis:'동일 상품 가격 근거 없음',type:'가격 조사'};
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
