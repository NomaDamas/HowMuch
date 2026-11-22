import test from 'node:test';
import assert from 'node:assert/strict';
import {research} from './agent-runtime.mjs';
import {assertResearchEnvelope} from './research-contract.mjs';
import {summarizeCard} from '../src/lib/price-card.js';
import {parseReferenceQuantity} from './reference-kind.mjs';
const image='data:image/png;base64,AAAA',url='https://www.ikea.com/us/en/p/sample-plate-set';
const mug={kind:'product',name:'Ceramic mug',category:'kitchenware',confidence:.88,reference:{kind:'mug',material:'ceramic',visualEvidence:'Glazed ceramic mug with a visible ceramic foot.'},productUrls:[url]};
const tee={...mug,name:'Basic T-shirt',category:'apparel',brand:'unbranded',reference:{kind:'basic-tee',material:'cotton',visualEvidence:'Cotton on the printed label',labelEvidence:'UNBRANDED 100% COTTON'}};
test('reference pack parsing is explicit, consistent, and bounded',()=>{
 assert.deepEqual(parseReferenceQuantity('Ceramic mug set of 2'),{quantity:2,quantityEvidence:'set of 2'});
 assert.deepEqual(parseReferenceQuantity('T-shirt 2-pack'),{quantity:2,quantityEvidence:'2-pack'});
 assert.deepEqual(parseReferenceQuantity('single mug'),{quantity:1,quantityEvidence:'single mug'});
 assert.equal(parseReferenceQuantity('set of 2, pack of 3'),null);
 assert.equal(parseReferenceQuantity('1 pack of 50'),null);
 assert.deepEqual(parseReferenceQuantity('Ceramic mugs, 12 oz each, set of 4'),{quantity:4,quantityEvidence:'set of 4'});
 assert.equal(parseReferenceQuantity('Ceramic mugs, 12 oz each'),null);
 assert.equal(parseReferenceQuantity('도자기 머그컵 100개입'),null);
 assert.deepEqual(parseReferenceQuantity('도자기 머그컵 4개입'),{quantity:4,quantityEvidence:'4개입'});
 assert.equal(parseReferenceQuantity('Ceramic mug'),null);
});
async function run(plan,title,label,matchingIndices=[]){
 const doc={'@type':'Product',name:title,offers:{'@type':'Offer',price:8.5,priceCurrency:'USD',itemCondition:'NewCondition',availability:'InStock'}};
 const ctx={routeWebSocket:async()=>{},route:async()=>{},newPage:async()=>{let current;return {
   on(){},url:()=>current,goto:async u=>{current=u;return {ok:()=>u===url};},close:async()=>{},
   locator:()=>({evaluateAll:async()=>[doc]})};}};
 let calls=0;
 return research({imageDataUrl:image,cutoutDataUrl:image,...(label&&{labelDataUrl:image})},{launch:async()=>({newContext:async()=>ctx,close:async()=>{}}),
   ask:async m=>++calls===1?plan:m[0].role==='system'?{indices:[0]}:{matchingIndices,referenceIndices:[0]}});
}
test('household merchant evidence survives result contract and explicit non-exact HUD',async()=>{
 const r=assertResearchEnvelope(await run(mug,'Ceramic coffee mugs, set of 2'));
 assert.equal(r.pricingMode,'category_reference');assert.deepEqual(r.offers,[]);assert.equal(r.lowest,undefined);assert.equal(r.referenceMarket.listings[0].quantity,2);
 assert.equal(r.referenceMarket.listings[0].url,url);assert.match(summarizeCard(r).label,/유사 상품 참고/);
 for(const invalid of [{lowest:'fake'},{status:'complete'},{candidates:[{name:'Eyewear',category:'안경',confidence:.9}]}])assert.throws(()=>assertResearchEnvelope({...r,...invalid}));
 const clone=structuredClone(r);clone.referenceMarket.listings[0].quantity=1;assert.throws(()=>assertResearchEnvelope(clone));
});
test('a tee needs a separately supplied positive unbranded composition label; generic outerwear never qualifies',async()=>{
 const valid=assertResearchEnvelope(await run(tee,'Cotton T-shirt 2 pack',true));assert.equal(valid.status,'followup_required');assert.ok(valid.followup);assert.equal(valid.referenceMarket.listings[0].unit,'장');assert.equal(valid.lowest,undefined);
 for(const p of [tee,{...tee,name:'Jacket',category:'재킷'},{...tee,name:'Sunglasses',category:'안경'}]){
   const r=await run(p,'Cotton T-shirt 2 pack',p!==tee);assert.equal(r.status,'followup_required');assert.equal(r.referenceMarket,undefined);
 }
 assert.equal((await run(mug,'Ceramic mug')).referenceMarket,undefined);
});
test('a positive model verdict cannot turn tee aliases into exact offers',async()=>{
 for(const [name,category] of [['Basic tee','tops'],['Tee','fashion'],['무지 반팔','패션'],['돋보기','생활용품']]){
   const plan={...tee,name,category};
   const r=await run(plan,'Cotton Basic Tee 2 pack',false,[0]);
   assert.equal(r.status,'followup_required');assert.deepEqual(r.offers,[]);assert.equal(r.lowest,undefined);assert.equal(r.referenceMarket,undefined);
   const listing={id:'0',price:8.5,currency:'USD',condition:'new',availability:'in_stock',title:'Cotton Basic Tee 2 pack',url,merchant:'www.ikea.com',checkedAt:new Date().toISOString(),evidence:['Merchant price $8.50'],confidence:.9};
   assert.throws(()=>assertResearchEnvelope({...r,status:'complete',pricingMode:'verified_offer',followup:undefined,offers:[listing],lowest:'0'}),/invalid_contract/);
 }
 const labelOnly=await run({...tee,name:'Basic tee',category:'tops'},'Cotton Basic Tee 2 pack',true,[0]);
 assert.equal(labelOnly.pricingMode,'category_reference');assert.deepEqual(labelOnly.offers,[]);assert.equal(labelOnly.lowest,undefined);
});
