export const amount = (value, currency) => Number.isFinite(value) && ['KRW','EUR','JPY','USD'].includes(currency)
  ? new Intl.NumberFormat('ko-KR', {style:'currency', currency}).format(value) : '';
export function summarizeCard(result) {
  const e=result?.estimate;
  // Tier 3: unit market price (food etc.): no model, price per kg / piece
  if(result?.pricingMode==='market_unit'&&e?.unit){
    const price=amount(e.median,e.currency);
    return {price:price+' / '+e.unit,basis:(e.region||'전국')+' · '+e.sampleCount+'곳 시세 · '+(e.observedAt||''),type:'시장 시세',label:price+' / '+e.unit+' · '+(e.region||'전국')+' 시세'};
  }
  // Tier 2: model unknown: rough average of comparable listings
  if(result?.pricingMode==='type_estimate'&&e){
    const price='약 '+amount(e.mean,e.currency);
    return {price,basis:e.sampleCount+'개 비슷한 상품 평균 · '+amount(e.min,e.currency)+'~'+amount(e.max,e.currency),type:'대략 시세 · 모델 미확인',label:price+' (모델 미확인 평균)'};
  }
  if(result?.status==='followup_required') return {price:'모델명을 알려 주세요',basis:'가격을 찾지 못했어요 · 모델명 입력 또는 라벨 촬영',type:'가격 보류'};
  const lo = typeof result?.lowest==='string'?result.offers?.find(o=>o.id===result.lowest||o.url===result.lowest):result?.lowest;
  const price=amount(lo?.comparePrice??lo?.price,lo?.compareCurrency??lo?.currency);
  if(price) {
    const n=result.representative?.sampleCount??result.offers.length;
    const basis=(n===1?'단일 판매가':'비교 '+n+'건')+' · '+(result.representative?.basis==='delivered'?'배송비 포함':'상품가 기준');
    return {price,basis,type:'확인한 판매가',label:price+' · '+basis};
  }
  return {price:'가격 미확인', basis:'가격 근거를 찾지 못했어요',type:'가격 조사'};
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
