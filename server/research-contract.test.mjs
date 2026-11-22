import test from 'node:test';
import assert from 'node:assert/strict';
import { assertResearchEnvelope, isValidResearchInput, isValidResearchResult } from './research-contract.mjs';

const input = { cutout: 'data:image/png;base64,AA', image: 'data:image/png;base64,AA', selection: { x: 0, y: 0, width: 0.5, height: 0.5 }, locale: 'ko-KR' };
const offer = { title: 'Item', url: 'https://shop.example/item', merchant: 'shop.example', availability: 'in_stock', price: 1000, currency: 'KRW', condition: 'new', checkedAt: new Date().toISOString(), evidence: ['price shown'], confidence: 0.9 };
const result = { candidates: [{ name: 'Item', confidence: 0.9 }], offers: [offer], lowest: offer, highest: offer, representative: { min: 1000, max: 1000, median: 1000, currency: 'KRW' }, startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), tools: ['visual_search_agent', 'open_page'] };

test('research input rejects out-of-frame selections', () => {
  assert.equal(isValidResearchInput(input), true);
  assert.equal(isValidResearchInput({ ...input, selection: { x: 0.8, y: 0, width: 0.5, height: 0.5 } }), false);
});

test('research result requires evidence-backed offers', () => {
  assert.equal(isValidResearchResult(result), true);
  assert.equal(isValidResearchResult({ ...result, offers: [{ ...offer, evidence: [] }] }), false);
  assert.throws(() => assertResearchEnvelope({ status: 'completed', result: { ...result, offers: [] } }), /invalid_contract/);
  assert.deepEqual(assertResearchEnvelope({ status: 'completed', result }).offers, [offer]);
});

test('an unavailable or stale page cannot supply the headline price',()=>{
  for(const change of [{availability:'unknown'},{availability:'out_of_stock'},{checkedAt:'2000-01-01'}]){
    const bad={...offer,...change,id:'o'};
    assert.equal(isValidResearchResult({...result,offers:[bad],lowest:'o',highest:'o'}),false);
  }
});
