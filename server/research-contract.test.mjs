import test from 'node:test';
import assert from 'node:assert/strict';
import { assertResearchEnvelope, isValidResearchInput } from './research-contract.mjs';

const now = new Date().toISOString();
const listing = (i, price = 1000) => ({ id: 'offer-' + i, title: 'item ' + i, url: `https://shop${i}.co.kr/p/${i}`, merchant: `shop${i}.co.kr`, price, currency: 'KRW', condition: 'new', availability: 'in_stock', checkedAt: now, evidence: ['seen'], confidence: .6 });
const base = { candidates: [{ name: '대파', confidence: .8 }], tools: ['agent_web_search'], startedAt: now, completedAt: now };
const est = (n, extra = {}) => ({ ...base, status: 'partial', pricingMode: 'type_estimate', offers: Array.from({ length: n }, (_, i) => listing(i, 1000 + i * 100)),
  estimate: { mean: 1100, median: 1100, min: 1000, max: 1200, currency: 'KRW', sampleCount: n }, followup: { reason: 'exact_model_not_visible', prompt: '모델명을 입력해 주세요' }, ...extra });
const market = (extra = {}) => ({ ...est(3), status: 'complete', pricingMode: 'market_unit', followup: undefined, estimate: { mean: 1100, median: 1100, min: 1000, max: 1200, currency: 'KRW', sampleCount: 3, unit: 'kg', region: '전국' }, ...extra });

test('a rough estimate needs >= 3 listings, matching sample count, and a follow-up', () => {
  assert.ok(assertResearchEnvelope(est(3)));
  assert.throws(() => assertResearchEnvelope(est(2)), /invalid_contract/);
  assert.throws(() => assertResearchEnvelope(est(3, { estimate: { mean: 1100, median: 1100, min: 1000, max: 1200, currency: 'KRW', sampleCount: 5 } })), /invalid_contract/);
  assert.throws(() => assertResearchEnvelope(est(3, { followup: undefined })), /invalid_contract/);
});
test('an estimate never claims a lowest price or an identity', () => {
  assert.throws(() => assertResearchEnvelope(est(3, { lowest: 'offer-0' })), /invalid_contract/);
  assert.throws(() => assertResearchEnvelope(est(3, { identity: { brand: 'A', model: 'B' } })), /invalid_contract/);
});
test('a market unit price needs a unit and a region', () => {
  assert.ok(assertResearchEnvelope(market()));
  assert.throws(() => assertResearchEnvelope(market({ estimate: { mean: 1, median: 1, min: 1, max: 1, currency: 'KRW', sampleCount: 3, region: '전국' } })), /invalid_contract/);
});
test('listings must be https pages whose merchant is the exact hostname, fresh and evidenced', () => {
  for (const patch of [{ url: 'http://shop0.co.kr/p' }, { merchant: 'other.co.kr' }, { evidence: [] }, { checkedAt: '2020-01-01T00:00:00Z' }, { price: -1 }]) {
    const r = est(3); r.offers[0] = { ...r.offers[0], ...patch };
    assert.throws(() => assertResearchEnvelope(r), /invalid_contract/, JSON.stringify(patch));
  }
});
test('"complete" is only for an exact price or a market unit price; follow-up means nothing was priced', () => {
  assert.throws(() => assertResearchEnvelope({ ...est(3), status: 'complete' }), /invalid_contract/);
  assert.throws(() => assertResearchEnvelope({ ...base, status: 'followup_required', offers: [listing(0)], pricingMode: 'exact_model' }), /invalid_contract/);
  assert.ok(assertResearchEnvelope({ ...base, status: 'followup_required', offers: [], followup: { reason: 'exact_model_not_visible', prompt: 'x' } }));
  assert.ok(assertResearchEnvelope({ ...base, status: 'no_result', offers: [] }));
  assert.throws(() => assertResearchEnvelope({ status: 'weird' }), /invalid_contract/);
});
test('input validation accepts an optional typed model name only when sane', () => {
  const input = { imageDataUrl: 'data:image/png;base64,AAAA', cutoutDataUrl: 'data:image/png;base64,AAAA', selection: { x: .1, y: .1, width: .5, height: .5 } };
  assert.equal(isValidResearchInput(input), true);
  assert.equal(isValidResearchInput({ ...input, modelHint: 'AirPods Pro 2' }), true);
  assert.equal(isValidResearchInput({ ...input, modelHint: '' }), false);
  assert.equal(isValidResearchInput({ ...input, modelHint: 'x'.repeat(81) }), false);
});
