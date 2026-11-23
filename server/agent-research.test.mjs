import test from 'node:test';
import assert from 'node:assert/strict';
import { agentResearch, consensusIdentity, parseAgentOutput, runAgent, buildAgentPrompt } from './agent-research.mjs';
import { assertResearchEnvelope } from './research-contract.mjs';

const img = 'data:image/png;base64,AAAA';
const body = { imageContext: { cutoutDataUrl: img, fullFrameDataUrl: img } };
const ident = (over = {}) => ({ brand: 'Nintendo', model: 'Switch OLED', brandAliases: ['닌텐도'], modelAliases: ['스위치 OLED'], category: 'game console', confidence: .95, evidence: [], ...over });
const agent = (offers, over = {}) => async () => ({ kind: 'product', identity: ident(), offers, notes: '', cited: new Set(offers.map(o => o.url)), hadCitations: true, ...over });
const offer = (url, price, title = '닌텐도 스위치 OLED 화이트') => ({ url, title, price, currency: 'KRW', condition: 'new', quote: price + '원' });

test('parses agent JSON and drops malformed offers', () => {
  const r = parseAgentOutput('x {"kind":"product","identity":{"brand":"A","model":"B"},"offers":[{"url":"https://a.kr/p/1","title":"t","price":1000},{"url":"u","title":"bad","price":-1}]} y');
  assert.equal(r.offers.length, 1); assert.equal(r.identity.brand, 'A');
});
test('prompt is objective + varied keyword queries, no site: operators, untrusted pages', () => {
  const p = buildAgentPrompt('focus text'); assert.match(p, /varied queries/); assert.match(p, /never site: operators/); assert.match(p, /untrusted/);
});
test('identity consensus picks the most voted model', () => {
  const id = consensusIdentity([{ identity: ident() }, { identity: ident() }, { identity: ident({ model: 'Switch Lite', confidence: .99 }) }]);
  assert.equal(id.model, 'Switch OLED'); assert.equal(id.votes, 2);
});
test('three parallel agents are merged into a contract-valid corroborated price', async () => {
  const calls = [];
  const runs = [agent([offer('https://shop-a.co.kr/p/1', 446310)]), agent([offer('https://shop-b.co.kr/p/2', 452000)]), agent([offer('https://shop-a.co.kr/p/1', 446310)])];
  const r = await agentResearch(body, { agents: 3, graceMs: 50, runAgent: (f, i, o) => { calls.push(f); return runs[calls.length - 1](); } });
  assert.equal(calls.length, 3);
  assert.equal(r.status, 'complete'); assert.equal(r.offers.find(o => o.id === r.lowest).price, 446310);
  assert.equal(r.identity.inferred, true);
  assertResearchEnvelope(r);
});
test('an uncited (invented) URL is dropped', async () => {
  const bad = async () => ({ kind: 'product', identity: ident(), offers: [offer('https://invented.co.kr/p/9', 1000)], cited: new Set(['https://real.co.kr/x']), hadCitations: true });
  const r = await agentResearch(body, { agents: 1, graceMs: 10, runAgent: bad });
  assert.equal(r.offers.length, 0);
});
test('a lone agent price, or prices the agents disagree on, is held back; agreement is required', async () => {
  const disagree = [agent([offer('https://a.co.kr/p/1', 446310)]), agent([offer('https://b.co.kr/p/2', 312000)]), agent([offer('https://c.co.kr/p/3', 600000)])];
  let n = 0;
  const r = await agentResearch(body, { agents: 3, graceMs: 20, runAgent: () => disagree[n++]() });
  assert.equal(r.status, 'followup_required');
});
test('an outlier from one agent is dropped when two others agree', async () => {
  const runs = [agent([offer('https://a.co.kr/p/1', 446310)]), agent([offer('https://b.co.kr/p/2', 452000)]), agent([offer('https://c.co.kr/p/3', 312000)])];
  let n = 0;
  const r = await agentResearch(body, { agents: 3, graceMs: 20, runAgent: () => runs[n++]() });
  assert.equal(r.status, 'complete'); assert.equal(r.offers.find(o => o.id === r.lowest).price, 446310);
  assert.ok(r.offers.every(o => o.price > 400000));
});
test('merchant equals the URL hostname exactly (contract) even with www', async () => {
  const runs = [agent([offer('https://www.shop-a.co.kr/p/1', 446310)]), agent([offer('https://www.shop-b.co.kr/p/2', 450000)])];
  let n = 0;
  const r = await agentResearch(body, { agents: 2, graceMs: 20, runAgent: () => runs[n++]() });
  assertResearchEnvelope(r); assert.ok(r.offers.every(o => new URL(o.url).hostname === o.merchant));
});
test('wrong model titles are filtered and a lone uncorroborated price is held back', async () => {
  const r = await agentResearch(body, { agents: 1, graceMs: 10, runAgent: agent([offer('https://shop-a.co.kr/p/1', 300000, '닌텐도 스위치 라이트')]) });
  assert.notEqual(r.status, 'complete'); assert.equal(r.offers.length, 0);
  const lone = await agentResearch(body, { agents: 1, graceMs: 10, runAgent: agent([offer('https://shop-a.co.kr/p/1', 446310)]) });
  assert.equal(lone.status, 'followup_required');
});
test('a person returns no search; all agents failing is research_unavailable', async () => {
  const p = await agentResearch(body, { agents: 2, graceMs: 10, runAgent: async () => ({ kind: 'person', identity: ident({ brand: '', model: '' }), offers: [], cited: new Set(), hadCitations: false }) });
  assert.equal(p.candidates[0].category, 'person');
  const f = await agentResearch(body, { agents: 2, graceMs: 10, runAgent: async () => { throw Error('x'); } });
  assert.equal(f.status, 'research_unavailable');
});
test('runAgent sends both images with the hosted web_search tool and collects citations', async () => {
  let sent;
  const fetchImpl = async (url, init) => { sent = { url, body: JSON.parse(init.body) };
    return { ok: true, json: async () => ({ output: [{ type: 'web_search_call', action: { sources: [{ url: 'https://s.kr/a' }] } }, { type: 'message', content: [{ type: 'output_text', text: '{"kind":"product","identity":{"brand":"B","model":"M"},"offers":[]}', annotations: [{ type: 'url_citation', url: 'https://c.kr/b' }] }] }] }) }; };
  const r = await runAgent('f', [img, img], { env: { VLM_API_KEY: 'k', VLM_BASE_URL: 'https://p.example/v1', VLM_MODEL: 'm' }, fetchImpl });
  assert.equal(sent.url, 'https://p.example/v1/responses'); assert.deepEqual(sent.body.tools, [{ type: 'web_search' }]);
  assert.equal(sent.body.input[0].content.filter(c => c.type === 'input_image').length, 2);
  assert.equal(r.cited.size, 2);
});
