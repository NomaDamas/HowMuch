import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOffers } from './search.ts';

test('normalizes currency and separate shipping into KRW', () => {
  const now = new Date().toISOString();
  const offers = normalizeOffers([
    { source: 'US', title: 'shoe', price: 100, currency: 'USD', condition: 'new', url: 'https://example.test/us', checkedAt: now, confidence: .9, shipping: 10, shippingIncluded: false },
    { source: 'KR', title: 'shoe', price: 140000, currency: 'KRW', condition: 'new', url: 'https://example.test/kr', checkedAt: now, confidence: .8 }
  ]);
  assert.equal(offers[0].normalizedPrice, 151800);
  assert.equal(offers[1].normalizedPrice, 140000);
});

test('rejects malformed and implausible offers', () => {
  const offers = normalizeOffers([{ source: '', title: 'bad', price: -1, currency: 'KRW', condition: 'new', url: '', checkedAt: '', confidence: 2 }]);
  assert.deepEqual(offers, []);
});
