import {test} from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createAgentServer,research} from './agent-runtime.mjs';
import {needsModel} from './identity-market.mjs';
const im='data:image/png;base64,AAAA';
const body={imageDataUrl:im,cutoutDataUrl:im};
test('close gateway transport cancels only its own model call',async t=>{
 const started=new Map(),stopped=new Set();
 const srv=createAgentServer(async(input,{signal,onPhase})=>{
   started.set(input.id,signal);onPhase?.({phase:'researching'});
   if(input.id==='sibling')return {status:'complete'};
   await once(signal,'abort');stopped.add(input.id);throw Error('research_cancelled');
 });
 srv.listen(0,'127.0.0.1');await once(srv,'listening');
 t.after(()=>{srv.closeAllConnections();srv.close();});
 const call=(id,signal)=>fetch('http://127.0.0.1:'+srv.address().port+'/agent/research',{method:'POST',headers:{accept:'application/x-ndjson'},body:JSON.stringify({id}),signal});
 const a=new AbortController();const target=await call('target',a.signal);
 assert.equal(started.get('target').aborted,false);
 const sibling=await call('sibling');assert.match(await sibling.text(),/complete/);
 a.abort();await target.text().catch(()=>{});
 await new Promise((resolve,reject)=>{const stop=Date.now()+1500;function next(){if(stopped.has('target'))return resolve();if(Date.now()>stop)return reject(Error('agent did not cancel'));setTimeout(next,10);}next();});
 assert.equal(started.get('sibling').aborted,false);
});
test('cancel during browser launch closes the acquired browser without starting a context',async()=>{
 const ctl=new AbortController();let closed=0;
 await assert.rejects(research(body,{signal:ctl.signal,ask:async()=>({kind:'product',name:'mug',confidence:.9}),launch:async()=>{ctl.abort();return {close:async()=>{closed++;},newContext:()=>assert.fail('cancelled context creation')};}}),{name:'AbortError'});
 assert.ok(closed>=1);
});
test('active model receives the same request-scoped abort signal',async()=>{
 const ctl=new AbortController();
 await assert.rejects(research(body,{signal:ctl.signal,ask:async(_,signal)=>{assert.equal(signal,ctl.signal);ctl.abort();signal.throwIfAborted();}}),{name:'AbortError'});
});
test('variant-sensitive retail categories always require a model',()=>{
 for(const category of ['운동화','가방','손목시계','카메라 렌즈','전동공구','jumper','sneakers','backpack','watch','lens','cordless drill','unbranded T-shirt'])assert.ok(needsModel({category}),category);
});
