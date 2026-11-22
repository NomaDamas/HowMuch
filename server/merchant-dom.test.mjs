import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {renderedProduct} from './merchant-dom.mjs';
import {productObservations} from './merchant-prices.mjs';
test('rendered SRP offer expiry survives DOM extraction to the evidence filter',async()=>{
 const browser=await chromium.launch();
 try {
  const p=await browser.newPage();
  for(const date of ['2000-01-01','2099-12-31']){
   await p.setContent('<div itemscope itemtype="https://schema.org/Product"><b itemprop="name">Red apple</b><div itemscope itemtype="https://schema.org/Offer"><time itemprop="priceValidUntil" datetime="'+date+'"></time><meta itemprop="price" content="2.50"><meta itemprop="priceCurrency" content="USD"></div></div>');
   let rows=await p.evaluate(renderedProduct);
   assert.equal(rows[0].offers.priceValidUntil,date);
   assert.equal(productObservations(rows,'https://www.walmart.com/ip/1').length,date.startsWith('2000')?0:1);
   await p.setContent('<meta property="og:type" content="product"><meta property="og:title" content="Red apple"><meta property="product:price:amount" content="2.50"><meta property="product:price:currency" content="USD"><meta property="product:expiration_time" content="'+date+'">');
   rows=await p.evaluate(renderedProduct);assert.equal(rows[0].offers.validThrough,date);
   assert.equal(productObservations(rows,'https://www.walmart.com/ip/1').length,date.startsWith('2000')?0:1);
  }
 }finally{await browser.close()}
});
