import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,readFileSync,statSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {pairingStore} from './pairing.mjs';
test('invite expiry is separate from client expiry and tokens are immediately revoked',()=>{
 let clock=100;const p=pairingStore(()=>clock,{clientMs:600000}), x=p.create();clock+=299999;const c=p.exchange(x.sessionId,x.token);assert.ok(c);
 assert.equal(p.exchange(x.sessionId,x.token),null);clock+=599999;assert.ok(p.valid(x.sessionId,c.clientToken));clock+=600001;assert.equal(p.valid(x.sessionId,c.clientToken),false);
 const y=p.create();clock+=300000;assert.equal(p.exchange(y.sessionId,y.token),null);
 const z=p.create(),zClient=p.exchange(z.sessionId,z.token);p.revoke(z.sessionId);assert.equal(p.valid(z.sessionId,zClient.clientToken),false);
});
test('a paired phone stays paired for days of use and across a server restart; only token hashes reach the disk',()=>{
 const file=join(mkdtempSync(join(tmpdir(),'pair-')),'pairing.json');let clock=1e12;const day=24*3600e3;
 const a=pairingStore(()=>clock,{file}),i=a.create(),c=a.exchange(i.sessionId,i.token);
 clock+=3*day;assert.ok(a.valid(i.sessionId,c.clientToken),'valid after 3 days');
 const b=pairingStore(()=>clock,{file});assert.ok(b.valid(i.sessionId,c.clientToken),'valid after restart');assert.equal(b.valid(i.sessionId,'wrong'),false);
 const raw=readFileSync(file,'utf8');assert.ok(!raw.includes(c.clientToken)&&!raw.includes(i.token),'no plain tokens on disk');assert.equal(statSync(file).mode&0o077,0,'file is private');
 clock+=8*day;assert.equal(pairingStore(()=>clock,{file}).valid(i.sessionId,c.clientToken),false,'expires 7 days after last use');
 b.revoke(i.sessionId);assert.equal(pairingStore(()=>clock-8*day,{file}).valid(i.sessionId,c.clientToken),false,'revoke persists');
});
test('an unused invite is never written to disk',()=>{const file=join(mkdtempSync(join(tmpdir(),'pair-')),'p.json');const p=pairingStore(Date.now,{file});p.create();assert.throws(()=>readFileSync(file));});
