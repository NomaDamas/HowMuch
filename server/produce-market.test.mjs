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
test('commodity market requires cut and preserves grade in strict evidence',()=>{
 const data={heads:['(소매가격 - 품목별)','축산물','/ 쇠고기 / 등심,','등급 : 1++,','단위 : 100g'],header:['구분','3일전 11/20'],ref:'2026-11-23',currency:'(단위 : 원)',records:[{city:'서울',shop:'축산점',values:['12,000']}]};
 const c=commodityFor({kind:'product',marketKind:'commodity',commodity:'쇠고기'});
 const m=parseProduce(data,c,'서울',new Date('2026-11-23'),{cut:'등심',grade:'1++',unitHint:'100g'});
 assert.equal(m.cut,'등심'); assert.equal(m.grade,'1++'); assert.equal(m.quantity,100); assert.equal(m.unit,'g');
 assert.equal(parseProduce(data,c,'서울',new Date('2026-11-23'),{}),null);
 assert.equal(commodityFor({kind:'product',marketKind:'commodity',commodity:'연어'}),null);
});
test('commodity evidence rejects cut or grade absent from the market heading',()=>{
 const data={heads:['축산물','/ 쇠고기 / 국거리,','등급 : 3등급,','단위 : 1kg'],header:['구분','11/22'],ref:'2026-11-23',currency:'(단위 : 원)',records:[{city:'서울',shop:'가락',values:['12,000']}]};
 const c=commodityFor({kind:'product',marketKind:'commodity',commodity:'쇠고기'});
 assert.equal(parseProduce(data,c,'서울',new Date('2026-11-23'),{cut:'등심',grade:'1++',unitHint:'kg'}),null);
 assert.ok(parseProduce(data,c,'서울',new Date('2026-11-23'),{cut:'국거리',grade:'3등급',unitHint:'kg'}));
});
