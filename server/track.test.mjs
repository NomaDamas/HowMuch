import test from 'node:test';
import assert from 'node:assert/strict';
import { track } from './segment.mjs';

const img = 'data:image/jpeg;base64,AAAA';
const ring = [{ x: .1, y: .1 }, { x: .4, y: .1 }, { x: .4, y: .4 }];
const status = fn => { try { fn(); } catch (e) { return e.status; } return null; };

test('track requests are validated before anything reaches the model', () => {
  assert.equal(status(() => track({ op: 'jump', sid: 'abcdefgh' })), 400, 'unknown operation');
  assert.equal(status(() => track({ op: 'step', sid: 'x' })), 400, 'session id too short');
  assert.equal(status(() => track({ op: 'step', sid: '../../etc/passwd' })), 400, 'session id with path characters');
  assert.equal(status(() => track({ op: 'step', sid: 'abcdefgh', imageDataUrl: 'http://example.com/a.jpg' })), 400, 'image must be a data URL');
  assert.equal(status(() => track({ op: 'start', sid: 'abcdefgh', imageDataUrl: img })), 400, 'start needs the outline');
  assert.equal(status(() => track({ op: 'start', sid: 'abcdefgh', imageDataUrl: img, contours: [[{ x: 2, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 }]] })), 400, 'outline points must be 0..1');
  assert.equal(status(() => track({ op: 'start', sid: 'abcdefgh', imageDataUrl: img, contours: Array(17).fill(ring) })), 400, 'too many rings');
  assert.equal(status(() => track({ op: 'start', sid: 'abcdefgh', imageDataUrl: img, contours: [ring.slice(0, 2)] })), 400, 'a ring needs three points');
});

test('an aborted request is rejected immediately', () => {
  const ac = new AbortController(); ac.abort();
  assert.throws(() => track({ op: 'end', sid: 'abcdefgh' }, { signal: ac.signal }));
});
