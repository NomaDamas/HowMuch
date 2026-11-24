import test from 'node:test';
import assert from 'node:assert/strict';
import { safeStep } from './analyze.mjs';

test('progress steps are whitelisted, trimmed and stripped of control characters before they reach a client', () => {
  assert.deepEqual(safeStep({ kind: 'search', text: '  switch\u0007 oled\nprice  ', agent: 1 }), { kind: 'search', text: 'switch  oled price', agent: 1 });
  assert.deepEqual(safeStep({ kind: 'agentDone', n: 7 }), { kind: 'agentDone', n: 7 });
  assert.equal(safeStep({ kind: 'search', text: 'x'.repeat(500) }).text.length, 80);
  assert.equal(safeStep({ kind: 'exec', text: 'rm -rf /' }), null); assert.equal(safeStep(null), null); assert.equal(safeStep('open'), null);
  assert.deepEqual(safeStep({ kind: 'compare', n: 1e9, agent: 99, extra: 'ignored' }), { kind: 'compare', n: 999 });
  assert.deepEqual(safeStep({ kind: 'image', text: 'nintendo switch' }), { kind: 'image', text: 'nintendo switch' });
});
