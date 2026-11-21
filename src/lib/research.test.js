import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeResearchOffers, validateResearchContext } from './research.ts';

test('research requires image context and normalized selection', () => {
  assert.equal(validateResearchContext({ imageDataUrl: 'data:image/png;base64,AA', cutoutDataUrl: 'data:image/png;base64,AA', selection: { x: 0, y: 0, width: 1, height: 1 }, locale: 'ko-KR' }), true);
  assert.equal(validateResearchContext({ imageDataUrl: 'https://example.test/image', selection: { x: 0, y: 0, width: 1, height: 1 }, locale: 'ko-KR' }), false);
});

test('research summary only uses evidence-backed offers', () => {
  const base = { title: 'item', url: 'https://shop.test/item', merchant: 'shop', currency: 'KRW', condition: 'new', checkedAt: new Date().toISOString(), evidence: ['price text'], confidence: .8 };
  const summary = summarizeResearchOffers([{ ...base, price: 120000 }, { ...base, url: 'https://shop.test/item2', price: 90000 }, { ...base, url: 'https://shop.test/no-evidence', price: 1, evidence: [] }]);
  assert.equal(summary.lowest.price, 90000);
  assert.equal(summary.highest.price, 120000);
  assert.equal(summary.representative.median, 120000);
});
