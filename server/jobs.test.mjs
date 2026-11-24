import test from 'node:test'; import assert from 'node:assert/strict'; import { jobStore } from './jobs.mjs';
test('job store emits queued running completed',async()=>{const p=jobStore();const id=p.start('desktop',async()=>({ok:true}));await new Promise(r=>setTimeout(r,10));const j=p.get(id,'desktop');assert.deepEqual(j.events.map(x=>x.status),['queued','running','completed'])});

test('a running job can publish progress (the early object name) before it completes', async () => {
  const { jobStore } = await import('./jobs.mjs');
  const store = jobStore(); let release;
  const id = store.start('me', progress => new Promise(res => { progress({ candidate: { name: 'Switch' } }); release = () => res({ status: 'complete' }); }));
  await new Promise(r => setTimeout(r, 10));
  const mid = store.get(id, 'me').events.at(-1); assert.equal(mid.status, 'running'); assert.equal(mid.candidate.name, 'Switch');
  release(); await new Promise(r => setTimeout(r, 10));
  assert.equal(store.get(id, 'me').events.at(-1).status, 'completed');
});
