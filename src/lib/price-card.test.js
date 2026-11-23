import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeCard } from './price-card.js';

test('market unit price shows a per-unit price with region and sample count, no model', () => {
  const c = summarizeCard({ status: 'complete', pricingMode: 'market_unit', estimate: { median: 3655, mean: 4183, min: 2490, max: 7900, currency: 'KRW', sampleCount: 10, unit: 'kg', region: '전국', observedAt: '2026-11-23' } });
  assert.match(c.price, /3,655.*\/ kg/); assert.match(c.basis, /전국/); assert.match(c.basis, /10곳/); assert.equal(c.type, '시장 시세');
});
test('rough estimate is labelled approximate and says the model is unconfirmed, with the range', () => {
  const c = summarizeCard({ status: 'partial', pricingMode: 'type_estimate', estimate: { mean: 120000, median: 115000, min: 80000, max: 180000, currency: 'KRW', sampleCount: 7 } });
  assert.match(c.price, /^약 /); assert.match(c.price, /120,000/); assert.match(c.basis, /7개/); assert.match(c.type, /모델 미확인/);
});
test('a held-back result asks for the model name; an exact price keeps the lowest offer', () => {
  assert.match(summarizeCard({ status: 'followup_required', offers: [] }).price, /모델명/);
  const exact = summarizeCard({ status: 'complete', pricingMode: 'exact_model', lowest: 'offer-0', offers: [{ id: 'offer-0', price: 446310, currency: 'KRW' }], representative: { sampleCount: 2, basis: 'item_only' } });
  assert.match(exact.price, /446,310/); assert.equal(exact.type, '확인한 판매가');
});
