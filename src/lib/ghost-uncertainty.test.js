import test from 'node:test';
import assert from 'node:assert/strict';
import { uncertainty } from './gyro-world.js';
test('ghost anchor confidence decays with time since last seen', () => {
  assert.deepEqual(uncertainty(0), { scale: 1, opacity: 1, ring: true, note: '' });
  const mid = uncertainty(15); assert.ok(mid.scale > 1 && mid.opacity < 1 && mid.opacity > .5 && mid.note === '위치 추정');
  const old = uncertainty(60); assert.equal(old.ring, false); assert.equal(old.note, '마지막으로 본 위치');
});
