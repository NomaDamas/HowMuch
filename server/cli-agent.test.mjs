import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAgentJson, cliKind, buildPrompt } from './cli-agent.mjs';
test('parses agent JSON wrapped in prose', () => {
  const r = parseAgentJson('Here:\n{"productUrls":["https://a.com/p/1",5],"queries":["x"],"notes":"ok"}\nbye');
  assert.deepEqual(r.productUrls, ['https://a.com/p/1']); assert.deepEqual(r.queries, ['x']);
});
test('rejects non-JSON and unknown kinds', () => {
  assert.equal(parseAgentJson('no json'), null);
  assert.equal(cliKind({ HOWMUCH_AGENT_CLI: 'curl' }), null);
  assert.equal(cliKind({ HOWMUCH_AGENT_CLI: 'codex' }), 'codex');
});
test('prompt demands parallel visual and text search and untrusted pages', () => {
  const p = buildPrompt({ name: 'AirPods' }, ['/t/a.png']);
  assert.match(p, /visual-style and text queries together|AND text queries/); assert.match(p, /untrusted/);
});
