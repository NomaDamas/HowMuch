import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePolygon, overlayPlacement, coverTransform, screenToMediaSelection } from './geometry.js';

test('normalizes a freeform selection to a bounded polygon', () => {
  const selection = normalizePolygon([{ x: .8, y: .7 }, { x: .2, y: .1 }, { x: 1.2, y: -.2 }]);
  assert.deepEqual(selection.x, .2);
  assert.deepEqual(selection.y, 0);
  assert.equal(selection.width, .8);
  assert.equal(selection.height, .7);
  assert.equal(selection.polygon.length, 3);
});

test('flips overlay side when anchor is near the right edge', () => {
  assert.equal(overlayPlacement({ x: .8, y: .4 }).side, 'left');
  assert.equal(overlayPlacement({ x: .3, y: .4 }).side, 'right');
});

test('maps screen selection through object-fit cover', () => {
  const transform = coverTransform({ width: 390, height: 844 }, { width: 1920, height: 1080 });
  assert.ok(transform.offsetX > 0);
  const selection = screenToMediaSelection({ x: .25, y: .25, width: .5, height: .5 }, { width: 390, height: 844 }, { width: 1920, height: 1080 });
  assert.ok(selection.x >= 0 && selection.x <= 1);
  assert.ok(selection.width > 0 && selection.width <= 1);
});
