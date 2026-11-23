import test from 'node:test';
import assert from 'node:assert/strict';
import { shopUrl } from './url-guard.mjs';
test('accepts public https shop pages and rejects unsafe or junk links', () => {
  assert.ok(shopUrl('https://any-shop.co.kr/p/123'));
  assert.ok(shopUrl('https://www.enuri.com/search.jsp?keyword=x'));
  for (const bad of ['http://a.com/p/1', 'https://user:pw@a.com/p', 'https://a.com:8443/p', 'https://10.0.0.1/p', 'https://localhost/p', 'https://example.test/item', 'https://www.google.com/search?q=x', 'https://a.com/cart', 'https://a.com/']) assert.equal(shopUrl(bad), null, bad);
});
