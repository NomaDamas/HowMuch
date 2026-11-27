import test from 'node:test';
import assert from 'node:assert/strict';
import { privateAddress } from './analyze.mjs';
import { pairingStore } from './pairing.mjs';

test('only private-network and local addresses may reach the phone server', () => {
  for (const ok of ['192.168.0.4', '10.1.2.3', '172.16.0.9', '172.31.255.1', '127.0.0.1', '::1', '::ffff:192.168.1.20', 'fe80::1', 'fd12::5', '169.254.3.4']) assert.equal(privateAddress(ok), true, ok);
  for (const bad of ['8.8.8.8', '172.32.0.1', '172.15.0.1', '193.168.0.1', '2001:db8::1', '', undefined, 'not-an-ip', '::ffff:1.2.3.4']) assert.equal(privateAddress(bad), false, String(bad));
});
test('pairing never refuses a new invite: at capacity the oldest unclaimed invite is dropped first', () => {
  const store = pairingStore(() => 1000);
  const first = store.create();
  for (let i = 0; i < 40; i++) store.create();
  assert.equal(store.exchange(first.sessionId, first.token), null);   // evicted
  const last = store.create(); assert.ok(store.exchange(last.sessionId, last.token));
});
