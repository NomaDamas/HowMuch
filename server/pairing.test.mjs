import test from 'node:test';import assert from 'node:assert/strict';import {pairingStore} from './pairing.mjs';
test('invite expiry is separate from client expiry and tokens are immediately revoked',()=>{
 let clock=100;const p=pairingStore(()=>clock), x=p.create();clock+=299999;const c=p.exchange(x.sessionId,x.token);assert.ok(c);
 assert.equal(p.exchange(x.sessionId,x.token),null);clock+=599999;assert.ok(p.valid(x.sessionId,c.clientToken));clock++;assert.equal(p.valid(x.sessionId,c.clientToken),false);
 const y=p.create();clock+=300000;assert.equal(p.exchange(y.sessionId,y.token),null);
 const z=p.create(),zClient=p.exchange(z.sessionId,z.token);p.revoke(z.sessionId);assert.equal(p.valid(z.sessionId,zClient.clientToken),false);
});