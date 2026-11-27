import test from 'node:test';
import assert from 'node:assert/strict';
import { bestShift } from './frame-motion.js';
const W = 64, H = 48;
const scene = (ox, oy) => { const a = new Float32Array(W * H); for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const x = i - ox, y = j - oy; a[j * W + i] = 120 + 60 * Math.sin(x / 5) * Math.cos(y / 4) + (x > 20 && x < 30 && y > 10 && y < 25 ? 70 : 0); } return a; };
test('scene sliding right/down is measured as a positive shift', () => {
  assert.deepEqual(bestShift(scene(0, 0), scene(3, 2)), { dx: 3, dy: 2 });
  assert.deepEqual(bestShift(scene(5, 0), scene(1, -1)), { dx: -4, dy: -1 });
});
test('a still camera measures no shift', () => { assert.deepEqual(bestShift(scene(2, 2), scene(2, 2)), { dx: 0, dy: 0 }); });
