import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSearxngOffer } from './provider-logic.js';

test('parses permitted search evidence and condition', () => {
  const offer = parseSearxngOffer({ title: 'used camera', content: '₩120,000 second-hand', url: 'https://shop.example/item' }, new Date().toISOString());
  assert.equal(offer.price, 120000);
  assert.equal(offer.condition, 'used');
  assert.equal(offer.availability, 'unknown');
});
