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
  assert.match(p, /visually AND textually/); assert.match(p, /untrusted/);
});

test('parses agent priced offers and drops malformed ones', () => {
  const r = parseAgentJson('{"offers":[{"url":"https://a.co.kr/p/1","title":"X","price":446310,"currency":"krw","quote":"446,310원"},{"url":"x","title":"bad","price":-1}],"notes":""}');
  assert.equal(r.offers.length, 1); assert.equal(r.offers[0].currency, 'KRW'); assert.equal(r.offers[0].price, 446310);
});

import { responsesResearch, cliKinds } from './cli-agent.mjs';
test('responses harness sends images plus the hosted web_search tool and parses offers', async () => {
  let sent;
  const fetchImpl = async (url, init) => { sent = { url, body: JSON.parse(init.body) };
    return { ok: true, json: async () => ({ output: [{ type: 'web_search_call' }, { type: 'message', content: [{ type: 'output_text', text: '{"identity":{"brand":"Nintendo","model":"Switch OLED"},"offers":[{"url":"https://a.co.kr/p/1","title":"스위치 OLED","price":446310,"currency":"KRW","quote":"446,310원"}]}' }] }] }) }; };
  const r = await responsesResearch({ name: 'x' }, 'data:image/png;base64,AA', 'data:image/png;base64,BB', { env: { VLM_API_KEY: 'k', VLM_BASE_URL: 'https://p.example/v1', VLM_MODEL: 'm' }, fetchImpl });
  assert.equal(sent.url, 'https://p.example/v1/responses');
  assert.deepEqual(sent.body.tools, [{ type: 'web_search' }]);
  assert.equal(sent.body.input[0].content.filter(c => c.type === 'input_image').length, 2);
  assert.equal(r.offers[0].price, 446310); assert.equal(r.identity.model, 'Switch OLED');
  assert.deepEqual(cliKinds({ HOWMUCH_AGENT_CLI: 'responses,claude' }), ['responses', 'claude']);
});
