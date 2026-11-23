const clean=v=>typeof v==='string'?v.trim():'';
const norm=v=>clean(v).normalize('NFKC').toLowerCase().replace(/[^\p{L}\d]/gu,'');
const squash=v=>clean(v).normalize('NFKC').toLowerCase().replace(/[^\p{L}\d]+/gu,' ').trim();
function hasToken(text,value){
  const val=squash(value).split(' ').filter(Boolean);
  if(!val.length)return false;
  return new RegExp('(?:^|[^\\p{L}\\d])'+val.join('\\s*')+'(?=$|[^\\p{L}\\d])','u').test(' '+squash(text)+' ');
}
const material=/안경|선글라스|의류|재킷|자켓|점퍼|코트|셔츠|바지|원피스|상의|하의|가디건|니트|티셔츠|패딩|후드|블라우스|청바지|스웨터|의복|\b(glasses|eyeglasses|sunglasses|eyewear|frame|frames|jacket|coat|shirt|t-shirt|clothing|apparel|trousers|pants|dress|hoodie|sweater|blazer|garment|jeans|cardigan|skirt)\b/i;
const variants=/신발|운동화|구두|부츠|샌들|가방|백팩|핸드백|손목시계|스마트워치|시계|렌즈|전동공구|수공구|공구|드릴|그라인더|임팩트|스니커즈|러닝화|카메라|헤드폰|이어폰|스마트폰|노트북|시리즈|\b(shoes?|footwear|sneakers?|boots?|sandals?|trainers?|bags?|handbags?|backpacks?|purses?|watches|watch|chronograph|lenses|lens|drills?|tools?|wrenches|wrench|saws?|grinders?|jumpers?|sweatshirts?|headphones?|earbuds?|cameras?|laptops?|phones?)\b/i;
const apparelAliases=/패션|옷감|의상|의류|의복|옷(?:$|\s)|웃옷|겉옷|반팔|긴팔|민소매|맨투맨|티샤쓰|티셔쓰|[흰검면]티|기본티|무지티|반소매|아우터|이너웨어|캐주얼웨어|웨어|선글래스|썬글라스|돋보기|고글|바람막이|잠바|쟈켓|재킷|\b(?:tees?|tee[\s-]?shirts?|t[\s-]?shirts?|tops?|bottoms?|fashion|garments?|wearables?|outerwear|underwear|activewear|sportswear|knitwear|menswear|womenswear|pullover[s]?|jackets?|coats?|shirts?|blouses?|hoodies?|sweaters?|dresses|skirts?|vests?|denim|spectacles?|goggles?|sunnies|eyeglass|sunglass|optical frames?)\b/i;
export function needsModel(plan){const label=[plan?.category,plan?.name].join(' ').normalize('NFKC').replace(/[_/–—]/g,' ');return plan?.requiresExactModel===true || plan?.reference?.kind==='basic-tee' || material.test(label) || apparelAliases.test(label) || variants.test(label);}
export function identityProof(plan) {
  const brand=clean(plan.brand),model=clean(plan.model);
  const strings=v=>Array.isArray(v)?v.filter(x=>typeof x==='string'&&x.trim()).slice(0,4).map(x=>x.trim().slice(0,180)):[];
  const brandEvidence=strings(plan.brandEvidence),modelEvidence=strings(plan.visibleModelEvidence);
  const bad=/^(unknown|generic|unbranded|nobrand|nonbrand|none|null|unspecified|알수없음|미상|무지|무브랜드|노브랜드|없음)$/i;
  // For easily confused fashion variants, visual style or a logo alone can never establish SKU.
  if(!brand||!model||bad.test(norm(brand))||bad.test(norm(model))||norm(brand)===norm(model)||
    norm(model).length<4 || /^\d{1,4}$/.test(model) || /^(black|blue|red|plaid|cotton|shirt|sunglasses|jacket|classic|안경|체크셔츠|자켓|선글라스)$/i.test(norm(model)) ||
    !brandEvidence.some(x=>hasToken(x,brand))||!modelEvidence.some(x=>hasToken(x,model)))return null;
  return {brand,model,brandEvidence,modelEvidence,modelAliases:aliasList(plan.modelAliases),brandAliases:aliasList(plan.brandAliases)};
}
const aliasList=v=>Array.isArray(v)?v.filter(x=>typeof x==='string'&&x.trim()).slice(0,4).map(x=>x.trim().slice(0,100)):[];
export function modelMatches(offer,identity){
  if(!identity)return false;
  const models=[identity.model,...aliasList(identity.modelAliases)],brands=[identity.brand,...aliasList(identity.brandAliases)];
  return models.some(m=>hasToken([offer?.title,offer?.model,offer?.sku].join(' '),m))&&brands.some(b=>hasToken([offer?.title,offer?.brand].join(' '),b));
}
export const requestLabel=()=>({reason:'exact_model_not_visible',prompt:'제품 본체의 각인, 신발 안쪽 태그, 의류 라벨 등에서 브랜드와 모델번호가 함께 보이도록 가까이 비춰 주세요.'});

// No literal label is visible, but the VLM recognised a specific product line from its design. This is only a
// hypothesis: it becomes a price only when >=2 independent merchants list a title matching brand+model AND the
// merchant photos visually match the cutout (agent-runtime.mjs). Evidence strings say so explicitly.
export function inferredProof(plan){
  const brand=clean(plan?.brand),model=clean(plan?.model),conf=Number(plan?.confidence);
  const bad=/^(unknown|generic|unbranded|nobrand|nonbrand|none|null|unspecified|알수없음|미상|무지|무브랜드|노브랜드|없음)$/i;
  if(!brand||!model||!(conf>=.85)||bad.test(norm(brand))||bad.test(norm(model))||norm(brand)===norm(model)||norm(model).length<3||/^\d{1,3}$/.test(model))return null;
  if(material.test([plan?.category,plan?.name].join(' '))||apparelAliases.test([plan?.category,plan?.name].join(' ')))return null; // apparel/eyewear still need a label
  return {brand,model,brandEvidence:['visual-search inferred: '+brand],modelEvidence:['visual-search inferred: '+model],inferred:true,modelAliases:aliasList(plan.modelAliases),brandAliases:aliasList(plan.brandAliases)};
}
