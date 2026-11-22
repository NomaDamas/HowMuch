import test from 'node:test';
import assert from 'node:assert/strict';
import {finalizeMarket} from './market.mjs';
const row=(price,i,extra={})=>({url:'https://shop.example/'+i,condition:'new',availability:'in_stock',currency:'KRW',price,shipping:0,...extra});
test('normalized price agrees with HUD, deduplicates same offer and filters extreme outliers', async()=>{
 const rows=[row(20,0,{currency:'USD',shipping:2}),row(22000,1),row(21980,1),row(100,2),row(22500,3)];
 const r=await finalizeMarket(rows,'KRW',async()=>({date:'2025-01-01',rates:{USD:1.1,KRW:1100}}));
 assert.equal(r.representative.min,21980);assert.equal(r.representative.sampleCount,3);
 assert.equal(r.offers[0].comparePrice,22000);assert.equal(r.offers.find(o=>o.id===r.lowest).comparePrice,r.representative.min);
});
test('FX outage or unknown stock cannot create a KRW minimum',async()=>{
 const r=await finalizeMarket([row(3,0,{currency:'USD'}),row(8,1,{availability:'unknown'})],'KRW',()=>Promise.reject());
 assert.equal(r.lowest,undefined);assert.equal(r.offers.length,2);
});
