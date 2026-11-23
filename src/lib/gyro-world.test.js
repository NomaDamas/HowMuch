import test from 'node:test';
import assert from 'node:assert/strict';
import { rotationFromEuler, intrinsics, worldDirection, projectDirection, edgePoint } from './gyro-world.js';
const cam = intrinsics(60, 9 / 16), near = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} vs ${b}`);

test('anchor re-projects to the same screen point with the same pose', () => {
  const R = rotationFromEuler(40, 85, 3), p = { x: .62, y: .35 };
  const q = projectDirection(R, worldDirection(R, p, cam), cam);
  near(q.x, p.x); near(q.y, p.y); assert.equal(q.inView, true);
});
test('turning the phone away hides the anchor and turning back restores it', () => {
  const home = rotationFromEuler(0, 90, 0), p = { x: .5, y: .5 }, dir = worldDirection(home, p, cam);
  const away = rotationFromEuler(90, 90, 0);
  const gone = projectDirection(away, dir, cam);
  assert.equal(gone.inView, false);
  const back = projectDirection(rotationFromEuler(0, 90, 0), dir, cam);
  assert.equal(back.inView, true); near(back.x, .5); near(back.y, .5);
});
test('small yaw turn shifts the anchor sideways on screen in the right direction', () => {
  const home = rotationFromEuler(0, 90, 0), dir = worldDirection(home, { x: .5, y: .5 }, cam);
  const left = projectDirection(rotationFromEuler(10, 90, 0), dir, cam), right = projectDirection(rotationFromEuler(-10, 90, 0), dir, cam);
  assert.ok(left.x !== right.x); assert.ok(Math.sign(left.x - .5) === -Math.sign(right.x - .5));
  assert.equal(left.inView, true);
});
test('behind-the-lens anchors report behind and an edge angle', () => {
  const R = rotationFromEuler(0, 90, 0), dir = worldDirection(R, { x: .5, y: .5 }, cam).map(v => -v);
  const p = projectDirection(R, dir, cam); assert.equal(p.behind, true); assert.equal(p.inView, false);
});
test('edgePoint clamps to the screen border', () => {
  const e = edgePoint({ x: 3, y: .5 }); near(e.x, .92); near(e.y, .5);
  const c = edgePoint({ x: -2, y: -2 }); assert.ok(c.x >= .08 - 1e-9 && c.y >= .08 - 1e-9);
});
