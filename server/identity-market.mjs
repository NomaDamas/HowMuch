const clean=v=>typeof v==='string'?v.trim():'';
const norm=v=>clean(v).normalize('NFKC').toLowerCase().replace(/[^\p{L}\d]/gu,'');
function hasToken(text,value){
  const val=clean(value).normalize('NFKC').toLowerCase().match(/[\p{L}\d]+/gu)||[];
  if(!val.length)return false;
  const pattern=val.join('[\\s_./-]*');
  return new RegExp('(?:^|[^\\p{L}\\d])'+pattern+'(?=$|[^\\p{L}\\d])','u').test(clean(text).normalize('NFKC').toLowerCase());
}
const material=/안경|선글라스|의류|재킷|자켓|점퍼|코트|셔츠|바지|원피스|상의|하의|가디건|니트|티셔츠|패딩|후드|블라우스|청바지|스웨터|의복|\b(glasses|eyeglasses|sunglasses|eyewear|frame|frames|jacket|coat|shirt|t-shirt|clothing|apparel|trousers|pants|dress|hoodie|sweater|blazer|garment|jeans|cardigan|skirt)\b/i;
const variants=/신발|운동화|구두|부츠|샌들|가방|백팩|핸드백|손목시계|스마트워치|시계|렌즈|전동공구|수공구|공구|드릴|그라인더|임팩트|스니커즈|러닝화|카메라|헤드폰|이어폰|스마트폰|노트북|시리즈|\b(shoes?|footwear|sneakers?|boots?|sandals?|trainers?|bags?|handbags?|backpacks?|purses?|watches|watch|chronograph|lenses|lens|drills?|tools?|wrenches|wrench|saws?|grinders?|jumpers?|sweatshirts?|headphones?|earbuds?|cameras?|laptops?|phones?)\b/i;
export function needsModel(plan){const label=[plan?.category,plan?.name].join(' ');return plan?.requiresExactModel===true || material.test(label) || variants.test(label);}
export function identityProof(plan) {
  const brand=clean(plan.brand),model=clean(plan.model);
  const strings=v=>Array.isArray(v)?v.filter(x=>typeof x==='string'&&x.trim()).slice(0,4).map(x=>x.trim().slice(0,180)):[];
  const brandEvidence=strings(plan.brandEvidence),modelEvidence=strings(plan.visibleModelEvidence);
  const bad=/^(unknown|generic|unbranded|none|null|unspecified|알수없음|미상|무지|없음)$/i;
  // For easily confused fashion variants, visual style or a logo alone can never establish SKU.
  if(!brand||!model||bad.test(norm(brand))||bad.test(norm(model))||norm(brand)===norm(model)||
    norm(model).length<4 || /^\d{1,4}$/.test(model) || /^(black|blue|red|plaid|cotton|shirt|sunglasses|jacket|classic|안경|체크셔츠|자켓|선글라스)$/i.test(norm(model)) ||
    !brandEvidence.some(x=>hasToken(x,brand))||!modelEvidence.some(x=>hasToken(x,model)))return null;
  return {brand,model,brandEvidence,modelEvidence};
}
export function modelMatches(offer,identity){return !!identity&&hasToken([offer?.title,offer?.model,offer?.sku].join(' '),identity.model)&&hasToken([offer?.title,offer?.brand].join(' '),identity.brand);}
export const requestLabel=()=>({reason:'exact_model_not_visible',prompt:'제품 본체의 각인, 신발 안쪽 태그, 의류 라벨 등에서 브랜드와 모델번호가 함께 보이도록 가까이 비춰 주세요.'});
