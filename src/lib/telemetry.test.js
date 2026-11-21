import test from 'node:test';
import assert from 'node:assert/strict';
import { recordAnonymousEvent } from './telemetry.js';

test('telemetry strips frames, urls, and person data', () => {
  const event = recordAnonymousEvent({ mode: 'auto', outcome: 'success', confidence: .8, imageDataUrl: 'data:image/png;base64,secret', sourceUrl: 'https://example.test', personScore: 99 });
  assert.deepEqual(event, { mode: 'auto', outcome: 'success', confidence: .8 });
});
