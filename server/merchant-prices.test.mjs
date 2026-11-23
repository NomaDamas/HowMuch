import test from 'node:test';
import assert from 'node:assert/strict';
import { merchantUrl, productObservations, publicHost } from './merchant-prices.mjs';

test('only curated public merchant product pages are accepted', () => {
  assert.equal(merchantUrl('https://www.adafruit.com/product/5812')?.includes('adafruit.com'), true);
  assert.equal(merchantUrl('https://example.test/item'), null);
  assert.equal(merchantUrl('https://10.0.0.1/p/1'), null);
  assert.equal(merchantUrl('https://localhost/p'), null);
  assert.ok(merchantUrl('https://any-shop.co.kr/p/123'));
  assert.equal(merchantUrl('https://www.google.com/search?q=x'), null);
  assert.equal(merchantUrl('https://www.adafruit.com/cart'), null);
});

test('extracts exact JSON-LD offer and does not invent shipping', () => {
  const rows = productObservations([{ '@type':'Product', name:'Raspberry Pi 5', offers:{ '@type':'Offer', price:130, priceCurrency:'USD', availability:'https://schema.org/InStock', itemCondition:'https://schema.org/NewCondition' } }], 'https://www.adafruit.com/product/5812');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].price, 130);
  assert.equal(rows[0].availability, 'in_stock');
  assert.equal(rows[0].shipping, undefined);
  assert.match(rows[0].evidence.at(-1), /not confirmed/i);
});

test('rejects hostnames that resolve to private addresses', async () => {
  assert.equal(await publicHost('evil.example.com', async () => [{ address: '127.0.0.1' }]), false);
  assert.equal(await publicHost('a.com', async () => [{ address: '93.184.216.34' }, { address: '10.0.0.5' }]), false);
  assert.equal(await publicHost('a.com', async () => [{ address: '93.184.216.34' }]), true);
  assert.equal(await publicHost('a.com', async () => { throw Error('x'); }), false);
});

test('reads per-product AggregateOffer nested in a comparison-site ItemList', () => {
  const docs = [{ '@type': 'ItemList', itemListElement: [{ '@type': 'ListItem', item: { '@type': 'Product', name: 'Nintendo 스위치 OLED', url: 'https://price.enuri.com/catalog/74775910', offers: { '@type': 'AggregateOffer', priceCurrency: 'KRW', lowPrice: 446310, offerCount: 155 } } }] }];
  const rows = productObservations(docs, 'https://www.enuri.com/search.jsp?keyword=x');
  assert.equal(rows.length, 1); assert.equal(rows[0].price, 446310); assert.equal(rows[0].aggregate, true); assert.equal(rows[0].sellerCount, 155);
  assert.equal(productObservations(docs, 'https://www.enuri.com/search.jsp?keyword=x').every(r => r.merchant === 'price.enuri.com'), true);
});
test('aggregate offers from a non comparison site are ignored', () => {
  const docs = [{ '@type': 'Product', name: 'X', offers: { '@type': 'AggregateOffer', priceCurrency: 'KRW', lowPrice: 1000, offerCount: 5 } }];
  assert.equal(productObservations(docs, 'https://some-shop.co.kr/p/1').length, 0);
});
