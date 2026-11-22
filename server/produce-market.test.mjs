import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProduce, commodityFor } from './produce-market.mjs';
test('KAMIS fixture yields region/unit-aware produce market', async()=>{
 const data={heads:['(소매가격 - 품목별)','과일류','/ 사과 / 후지,','등급 : 상품,','단위 : 10개'],header:['구분','3일전 11/20','4일전 11/19'],ref:'2026-11-23',currency:'(단위 : 원)',records:[{city:'서울',shop:'경동',values:['15,400','18,100']},{city:'서울',shop:'복조리',values:['16,600','16,200']},{city:'제주',shop:'동문',values:['23,300','22,500']}]};
 const c=commodityFor({kind:'product',marketKind:'produce',commodity:'사과'}),now=new Date('2026-11-23');
 const market=parseProduce(data,c,'서울',now);
 assert.equal(market.unit,'개');assert.equal(market.quantity,10);assert.equal(market.currency,'KRW');assert.equal(market.samples.length,2);assert.equal(market.samples[0].region,'서울');assert.equal(market.median,16000);assert.equal(market.samples[0].observedAt,'2026-11-20');
 assert.equal(parseProduce(data,c,'부산',now),null);assert.equal(parseProduce(data,c,'서울',new Date('2026-12-15')),null);assert.equal(parseProduce({...data,heads:['/ 사과 / 후지,','단위 : 미상']},c,'서울',now),null);
});
