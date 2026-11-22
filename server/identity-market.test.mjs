import test from 'node:test';
import assert from 'node:assert/strict';
import { identityProof, modelMatches, needsModel } from './identity-market.mjs';
import { research } from './agent-runtime.mjs';
import { assertResearchEnvelope } from './research-contract.mjs';
test('fashion requires visible brand and model proof',()=>{
 const p={category:'jacket',brand:'Acme',model:'J-204',brandEvidence:['ACME logo'],visibleModelEvidence:['J-204 tag']};
 assert.equal(needsModel(p),true);assert.deepEqual(identityProof(p).model,'J-204');
 assert.equal(modelMatches({title:'Acme J-204 jacket',brand:'Acme'},identityProof(p)),true);
 assert.equal(modelMatches({title:'Acme J-2045 jacket',brand:'Acme'},identityProof(p)),false);
 assert.equal(identityProof({...p,visibleModelEvidence:['black jacket']}),null);
});
test('a Korean category and explicit label image cannot manufacture an exact price',async()=>{
 const im='data:image/png;base64,AAAA',label='data:image/png;base64,BBBB';let seen;
 const result=await research({imageDataUrl:im,cutoutDataUrl:im,labelDataUrl:label},{ask:async messages=>{seen=messages[0].content;return {kind:'product',category:'안경테',name:'검은 안경',confidence:.94,brand:'Acme',model:'',brandEvidence:['Acme']};},launch:()=>{throw Error('no shopping permitted');}});
 assert.equal(seen.filter(i=>i.type==='image_url')[2].image_url.url,label);
 assert.equal(assertResearchEnvelope(result).status,'followup_required');assert.equal(result.lowest,undefined);
 assert.throws(()=>assertResearchEnvelope({...result,comparables:[{}]}));
});
