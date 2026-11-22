import {test} from 'node:test';
import assert from 'node:assert/strict';
import {research} from './agent-runtime.mjs';
import {assertResearchEnvelope} from './research-contract.mjs';

for (const reachable of [false,true]) test('research distinguishes '+(reachable?'empty search':'provider outage'),async()=>{
 const locator={isVisible:async()=>false,count:async()=>0,evaluateAll:async()=>[],first(){return this},click:async()=>{throw Error('image UI unavailable')}};
 const page={on(){},goto:async()=>({ok:()=>reachable}),locator:()=>locator,close:async()=>{}};
 const ctx={routeWebSocket:async()=>{},route:async()=>{},newPage:async()=>page};
 const image='data:image/png;base64,AAAA';
 const result=await research({imageDataUrl:image,cutoutDataUrl:image},{launch:async()=>({newContext:async()=>ctx,close:async()=>{}}),
   ask:async messages=>messages[0].role==='system'?{indices:[]}:{kind:'product',name:'mug',confidence:1,queries:['mug']}});
 assert.equal(assertResearchEnvelope(result).status,reachable?'no_result':'research_unavailable');assert.deepEqual(result.offers,[]);
});
