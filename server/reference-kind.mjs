import {needsModel} from './identity-market.mjs';
const basic=/\b(?:t[ -]?shirt|tee)\b|티셔츠/i, forbidden=/jacket|jumper|sweater|eyewear|sunglass|glasses|재킷|자켓|점퍼|안경|선글라스|코트|셔츠형 재킷/i;
const types={mug:/\bmugs?\b|머그|머그잔/i,bowl:/\bbowls?\b|그릇|볼 접시/i,plate:/\bplates?\b|접시/i,tumbler:/\btumblers?\b|텀블러/i,'basic-tee':basic};
const fabric={cotton:/\bcotton\b|면\s*\d|면소재/i,polyester:/polyester|폴리에스테르/i,linen:/\blinen\b|리넨|린넨/i};
const material={...fabric,ceramic:/ceramic|stoneware|porcelain|도자기|자기질|세라믹/i,glass:/\bglass\b|유리/i,steel:/stainless|스테인리스/i,plastic:/plastic|플라스틱/i};
export function referenceScope(plan){
 const name=[plan.name,plan.category].join(' '),p=plan.reference;
 if(!p||plan.kind!=='product'||forbidden.test(name)||!Object.hasOwn(types,p.kind)||!types[p.kind].test(name)||!Object.hasOwn(material,p.material))return null;
 if(typeof p.visualEvidence!=='string'||p.visualEvidence.length>180||!material[p.material].test(p.visualEvidence))return null;
 if(p.kind==='basic-tee'){
   if(!fabric[p.material]||!/^(?:unbranded|no brand|무브랜드)$/i.test(String(plan.brand||''))||typeof p.labelEvidence!=='string'||!/\bunbranded\b|\bno brand\b|무브랜드/i.test(p.labelEvidence)||!material[p.material].test(p.labelEvidence))return null;
 }else if(needsModel(plan))return null;
 return {kind:p.kind,material:p.material,visualEvidence:p.visualEvidence,...(p.kind==='basic-tee'?{labelEvidence:p.labelEvidence.slice(0,180)}:{})};
}
export function referenceRows(scope,observations,indices){
 if(!scope)return [];
 const rows=[],seen=new Set();
 for(const i of indices){const o=observations[i];if(!o||seen.has(o.url)||o.condition!=='new'||o.availability!=='in_stock')continue;
   const proof=[o.title,o.sourceMaterial].filter(Boolean).join(' ');
   if(!types[scope.kind]?.test(o.title)||!material[scope.material]?.test(proof))continue;
   // Require explicit units (including a merchant's structured individual unit field); never assume single item.
   const quantityText=o.title;
   const count=quantityText.match(/\b(?:set|pack) of (\d{1,2})\b|\b(\d{1,2})[\s-]*(?:pack|count|pieces?|pieces? set|pcs|units?)\b|(\d{1,2})\s*(?:개입|개\s*세트|장입|장\s*세트)|\b(single (?:mug|bowl|plate|tumbler|tee|t-shirt)|each)\b/i);
   if(!count)continue;
   const quantity=Number(count[1]||count[2]||count[3]||1);if(!Number.isSafeInteger(quantity)||quantity<1)continue;
   seen.add(o.url);rows.push({...o,kind:scope.kind,material:scope.material,quantity,unit:scope.kind==='basic-tee'?'장':'개',quantityEvidence:count[0],basis:'item_only'});
   if(rows.length===4)break;
 }return rows;
}
