import test from 'node:test';
import assert from 'node:assert/strict';
import { visibilityAfterMisses, shouldReacquire, privacyDefaults } from './lifecycle.js';

test('hides after loss threshold and reacquires a changed target', () => {
  assert.equal(visibilityAfterMisses(true, 1), true);
  assert.equal(visibilityAfterMisses(true, 2), false);
  assert.equal(shouldReacquire('a', 'a'), false);
  assert.equal(shouldReacquire('a', 'b'), true);
});

test('privacy defaults do not retain frames or enable people mode', () => {
  assert.deepEqual(privacyDefaults(), { retainFrames: false, personMode: false, anonymousTelemetry: true });
});
