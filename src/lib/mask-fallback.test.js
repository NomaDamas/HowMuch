import test from 'node:test';
import assert from 'node:assert/strict';
import { needsLocalMask } from './search.ts';

test('raw provider output is replaced by local alpha-mask fallback', () => {
  assert.equal(needsLocalMask('data:image/png;base64,raw', 'data:image/png;base64,raw'), true);
  assert.equal(needsLocalMask('data:image/png;base64,mask', 'data:image/png;base64,raw'), false);
});
