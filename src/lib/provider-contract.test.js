import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidCandidate, isValidOffer } from './search.ts';

test('candidate contract accepts rich VLM output and rejects invalid confidence', () => {
  assert.equal(isValidCandidate({ name: 'item', model: 'x', attributes: { color: 'black' }, queries: ['item price'], confidence: .8 }), true);
  assert.equal(isValidCandidate({ name: 'item', confidence: 1.2 }), false);
});

test('offer contract requires evidence fields and bounded confidence', () => {
  const base = { source: 'shop', title: 'item', price: 1000, currency: 'KRW', condition: 'new', url: 'https://example.test/item', checkedAt: new Date().toISOString(), confidence: .8 };
  assert.equal(isValidOffer(base), true);
  assert.equal(isValidOffer({ ...base, url: '', confidence: .8 }), false);
  assert.equal(isValidOffer({ ...base, confidence: -1 }), false);
});
