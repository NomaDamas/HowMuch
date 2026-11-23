import test from 'node:test';
import assert from 'node:assert/strict';
import { identityProof, modelMatches, needsModel } from './identity-market.mjs';
test('fashion requires visible brand and model proof',()=>{
 const p={category:'jacket',brand:'Acme',model:'J-204',brandEvidence:['ACME logo'],visibleModelEvidence:['J-204 tag']};
 assert.equal(needsModel(p),true);assert.deepEqual(identityProof(p).model,'J-204');
 assert.equal(modelMatches({title:'Acme J-204 jacket',brand:'Acme'},identityProof(p)),true);
 assert.equal(modelMatches({title:'Acme J-2045 jacket',brand:'Acme'},identityProof(p)),false);
 assert.equal(identityProof({...p,visibleModelEvidence:['black jacket']}),null);
});
import { inferredProof } from './identity-market.mjs';
test('inferred identity needs a specific brand+model with high confidence and excludes apparel', () => {
  assert.equal(inferredProof({ brand: 'Nintendo', model: 'Switch OLED', confidence: .9, category: 'game console', name: 'Switch' }).inferred, true);
  assert.equal(inferredProof({ brand: 'Nike', model: 'Air Force 1', confidence: .6 }), null);
  assert.equal(inferredProof({ brand: 'Ray-Ban', model: 'Wayfarer RB2140', confidence: .9, category: 'sunglasses' }), null);
  assert.equal(inferredProof({ brand: 'unknown', model: 'x100', confidence: .9 }), null);
});

test('model alias matching tolerates generic descriptors like Low/Model/로우', () => {
  const id = { brand: 'Nike', model: 'Air Force 1 Low', brandAliases: ['나이키'], modelAliases: ['에어포스 1 로우', 'AF1 Low'] };
  assert.equal(modelMatches({ title: '나이키 에어포스 1 07 CW2288-111 (병행)' }, id), true);
  assert.equal(modelMatches({ title: '나이키 덩크 로우 DD1391' }, id), false);
  assert.equal(modelMatches({ title: '아디다스 에어포스 1' }, id), false);
});

test('trailing set/세트 and trademark signs do not block a model match', () => {
  const id = { brand: 'Nintendo', model: 'Nintendo Switch – OLED Model White set', brandAliases: ['닌텐도'], modelAliases: [] };
  assert.equal(modelMatches({ title: 'Nintendo Switch™ - OLED Model White' }, id), true);
  assert.equal(modelMatches({ title: 'Nintendo Switch Lite Turquoise' }, id), false);
});

test('low-top sneakers are footwear, not apparel "tops"; real apparel still needs a label', () => {
  assert.ok(inferredProof({ brand: 'Nike', model: "Air Force 1 '07", confidence: .95, category: 'low-top sneakers', name: 'Nike Air Force 1 07 Low' }));
  assert.equal(inferredProof({ brand: 'Uniqlo', model: 'Supima tee', confidence: .95, category: 't-shirt', name: 'Uniqlo Supima tee' }), null);
});
