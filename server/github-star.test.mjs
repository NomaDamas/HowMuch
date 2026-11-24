import test from 'node:test';
import assert from 'node:assert/strict';
import { githubStar } from './github-star.mjs';

const res = (status, body) => ({ ok: status < 300, status, json: async () => body });
const device = { device_code: 'DC', user_code: 'ABCD-1234', verification_uri: 'https://github.com/login/device', expires_in: 900, interval: 5 };

test('without a configured OAuth app the endpoints answer 501', async () => {
  const s = githubStar({ clientId: '' });
  assert.equal((await s.start()).status, 501); assert.equal(s.configured(), false);
});
test('start returns a code and a poll id but never the device code', async () => {
  const s = githubStar({ clientId: 'cid', fetchImpl: async () => res(200, device) });
  const o = await s.start();
  assert.equal(o.status, 200); assert.equal(o.body.userCode, 'ABCD-1234'); assert.ok(o.body.pollId); assert.ok(!JSON.stringify(o.body).includes('DC'));
});
test('a non-github verification link is refused', async () => {
  const s = githubStar({ clientId: 'cid', fetchImpl: async () => res(200, { ...device, verification_uri: 'https://evil.example/login' }) });
  assert.equal((await s.start()).status, 502);
});
test('polling stays pending until approved, then stars with the token and returns only starred:true', async () => {
  const calls = []; let phase = 0;
  const fetchImpl = async (url, init) => { calls.push({ url, method: init.method, auth: init.headers?.authorization });
    if (url.includes('/device/code')) return res(200, device);
    if (url.includes('/access_token')) return phase++ === 0 ? res(200, { error: 'authorization_pending' }) : res(200, { access_token: 'SECRET_TOKEN' });
    return res(204, {}); };
  const s = githubStar({ clientId: 'cid', fetchImpl });
  const { body: { pollId } } = await s.start();
  assert.equal((await s.poll(pollId)).body.pending, true);
  const done = await s.poll(pollId);
  assert.deepEqual(done.body, { starred: true });
  assert.ok(!JSON.stringify(done).includes('SECRET_TOKEN'));
  const star = calls.find(c => c.url.includes('/user/starred/NomaDamas/HowMuch'));
  assert.equal(star.method, 'PUT'); assert.equal(star.auth, 'Bearer SECRET_TOKEN');
  assert.equal((await s.poll(pollId)).status, 410, 'poll id is single use');
});
test('denied, expired and unknown poll ids fail cleanly', async () => {
  let t = 0; const fetchImpl = async url => url.includes('/device/code') ? res(200, device) : res(200, { error: 'access_denied' });
  const s = githubStar({ clientId: 'cid', fetchImpl, now: () => t });
  const { body: { pollId } } = await s.start();
  assert.equal((await s.poll(pollId)).status, 400);
  assert.equal((await s.poll('nope')).status, 410);
  const { body: second } = await s.start(); t = 1e9;
  assert.equal((await s.poll(second.pollId)).status, 410);
});
