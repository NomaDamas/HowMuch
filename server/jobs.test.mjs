import test from 'node:test'; import assert from 'node:assert/strict'; import { jobStore } from './jobs.mjs';
test('job store emits queued running completed',async()=>{const p=jobStore();const id=p.start('desktop',async()=>({ok:true}));await new Promise(r=>setTimeout(r,10));const j=p.get(id,'desktop');assert.deepEqual(j.events.map(x=>x.status),['queued','running','completed'])});
