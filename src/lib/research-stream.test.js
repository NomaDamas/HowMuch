import test from 'node:test';
import assert from 'node:assert/strict';
import {readResearch} from './research-stream.js';
test('price phase arrives before the result, across split Korean UTF-8 chunks',async()=>{
 let controller;const stream=new ReadableStream({start(c){controller=c}});
 const result={status:'complete'};let phase;const first=new Promise(r=>phase=r);
 const response=new Response(stream,{headers:{'content-type':'application/x-ndjson'}});
 const read=readResearch(response,e=>phase(e));
 const bytes=new TextEncoder().encode('{"phase":"researching","candidate":{"name":"안경"}}\n');
 for(const b of bytes)controller.enqueue(Uint8Array.of(b));
 assert.equal((await first).candidate.name,'안경');
 controller.enqueue(new TextEncoder().encode(JSON.stringify({result})+'\n'));controller.close();
 assert.deepEqual(await read,result);
});
