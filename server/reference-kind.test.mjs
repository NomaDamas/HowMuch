import test from 'node:test';
import assert from 'node:assert/strict';
import {research} from './agent-runtime.mjs';
import {assertResearchEnvelope} from './research-contract.mjs';
import {summarizeCard} from '../src/lib/price-card.js';
const image='data:image/png;base64,AAAA',url='https://www.ikea.com/us/en/p/sample-plate-set';
const mug={kind:'product',name:'Ceramic mug',category:'kitchenware',confidence:.88,reference:{kind:'mug',material:'ceramic',visualEvidence:'Glazed ceramic mug with a visible ceramic foot.'},productUrls:[url]};
const tee={...mug,name:'Basic T-shirt',category:'apparel',brand:'unbranded',reference:{kind:'basic-tee',material:'cotton',visualEvidence:'Cotton on the printed label',labelEvidence:'UNBRANDED 100% COTTON'}};
async function run(plan,title,label){
 const doc={'@type':'Product',name:title,offers:{'@type':'Offer',price:8.5,priceCurrency:'USD',itemCondition:'NewCondition',availability:'InStock'}};
 const ctx={routeWebSocket:async()=>{},route:async()=>{},newPage:async()=>{let current;return {
   on(){},url:()=>current,goto:async u=>{current=u;return {ok:()=>u===url};},close:async()=>{},
   locator:()=>({evaluateAll:async()=>[doc]})};}};
 let calls=0;
 return research({imageDataUrl:image,cutoutDataUrl:image,...(label&&{labelDataUrl:image})},{launch:async()=>({newContext:async()=>ctx,close:async()=>{}}),
   ask:async m=>++calls===1?plan:m[0].role==='system'?{indices:[0]}:{matchingIndices:[],referenceIndices:[0]}});
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
