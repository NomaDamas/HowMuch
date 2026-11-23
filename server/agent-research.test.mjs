import test from 'node:test';
import assert from 'node:assert/strict';
import { agentResearch, consensusIdentity, parseAgentOutput, runAgent, buildAgentPrompt, summarizeListings } from './agent-research.mjs';
import { assertResearchEnvelope } from './research-contract.mjs';

const img = 'data:image/png;base64,AAAA';
const body = { imageContext: { cutoutDataUrl: img, fullFrameDataUrl: img } };
const ident = (o = {}) => ({ brand: 'Nintendo', model: 'Switch OLED', brandAliases: ['닌텐도'], modelAliases: ['스위치 OLED'], category: 'game console', confidence: .95, evidence: [], ...o });
const out = (o = {}) => ({ kind: 'product', level: 'exact', identity: ident(), type: { name: '게임기', attributes: [] }, commodity: { name: '', unit: '', region: '' }, offers: [], notes: '', ...o });
const agent = (o = {}) => async () => out(o);
const offer = (url, price, title = '닌텐도 스위치 OLED 화이트') => ({ url, title, price, currency: 'KRW', condition: 'new', quote: price + '원' });
const run = (fns, extra = {}) => { let n = 0; return agentResearch(body, { agents: fns.length, graceMs: 30, runAgent: () => fns[n++](), ...extra }); };

test('parses the three levels and drops malformed offers', () => {
  const r = parseAgentOutput('x {"kind":"product","level":"commodity","commodity":{"name":"대파","unit":"단","region":"서울"},"offers":[{"url":"https://a.kr/p/1","title":"t","price":3000},{"url":"u","title":"bad","price":-1}]} y');
  assert.equal(r.level, 'commodity'); assert.equal(r.commodity.unit, '단'); assert.equal(r.offers.length, 1);
  assert.equal(parseAgentOutput('{"level":"zzz","commodity":{"unit":"lightyear"}}').commodity.unit, '');
});
test('prompt describes all tiers, forbids site: operators, treats pages as untrusted, and carries the typed model', () => {
  const p = buildAgentPrompt('focus', 'AirPods Pro 2');
  for (const re of [/"exact"/, /"type"/, /"commodity"/, /never site: operators/, /untrusted/, /AirPods Pro 2/, /Do NOT look for a model/]) assert.match(p, re);
});
test('differently worded identities for one product cluster and merge aliases', () => {
  const id = consensusIdentity([{ identity: ident({ model: 'Nintendo Switch (OLED model) White' }) }, { identity: ident({ model: 'Nintendo Switch – OLED Model White set', modelAliases: ['닌텐도 스위치 OLED 화이트'] }) }, { identity: ident({ model: 'Switch Lite' }) }]);
  assert.equal(id.votes, 2); assert.ok(id.modelAliases.includes('닌텐도 스위치 OLED 화이트')); assert.ok(!id.modelAliases.some(a => /lite/i.test(a)));
});

test('tier 1: agents that agree on a known model give a contract-valid exact price, outliers dropped', async () => {
  const r = await run([agent({ offers: [offer('https://a.co.kr/p/1', 446310)] }), agent({ offers: [offer('https://www.b.co.kr/p/2', 452000)] }), agent({ offers: [offer('https://c.co.kr/p/3', 312000)] })]);
  assert.equal(r.status, 'complete'); assert.equal(r.pricingMode, 'exact_model');
  assertResearchEnvelope(r); assert.equal(r.offers.find(o => o.id === r.lowest).price, 446310); assert.ok(r.offers.every(o => o.price > 400000));
});
test('tier 1 falls back to a rough estimate instead of claiming an uncorroborated model price', async () => {
  const r = await run([agent({ offers: [offer('https://a.co.kr/p/1', 446310), offer('https://b.co.kr/p/2', 300000), offer('https://c.co.kr/p/3', 520000)] }), agent({ offers: [] }), agent({ offers: [] })]);
  assert.equal(r.pricingMode, 'type_estimate'); assert.equal(r.status, 'partial'); assertResearchEnvelope(r);
});
test('tier 2: unknown model -> average of comparable listings, range, and a request for the model name', async () => {
  const L = (n, p) => offer(`https://shop${n}.co.kr/p/${n}`, p, '무선 이어버드 ' + n);
  const unknown = o => agent({ level: 'type', identity: ident({ brand: '', model: '', confidence: .3 }), type: { name: '무선 이어버드', attributes: [] }, offers: o });
  const r = await run([unknown([L(1, 100000), L(2, 120000), L(3, 140000)]), unknown([L(4, 160000), L(5, 99000)]), unknown([L(6, 900000)])]);
  assert.equal(r.pricingMode, 'type_estimate'); assert.equal(r.status, 'partial'); assertResearchEnvelope(r);
  assert.equal(r.candidates[0].name, '무선 이어버드'); assert.equal(r.followup.reason, 'exact_model_not_visible');
  assert.equal(r.estimate.sampleCount, r.offers.length); assert.ok(r.offers.every(o => o.price < 500000), 'outlier 900000 trimmed');
  assert.equal(r.estimate.mean, Math.round(r.offers.reduce((a, o) => a + o.price, 0) / r.offers.length));
  assert.ok(r.estimate.min <= r.estimate.median && r.estimate.median <= r.estimate.max);
});
test('tier 2 with too few listings asks for the model instead of guessing', async () => {
  const unknown = agent({ level: 'type', identity: ident({ brand: '', model: '', confidence: .3 }), type: { name: '무선 이어버드', attributes: [] }, offers: [offer('https://a.co.kr/p/1', 100000, '이어버드')] });
  const r = await run([unknown, unknown]);
  assert.equal(r.status, 'followup_required'); assert.deepEqual(r.offers, []); assertResearchEnvelope(r);
});
test('tier 3: food gets a unit market price directly, no model needed', async () => {
  const food = o => agent({ level: 'commodity', identity: ident({ brand: '', model: '', confidence: .2 }), type: { name: '대파', attributes: [] }, commodity: { name: '대파', unit: 'kg', region: '전국' }, offers: o });
  const L = (n, p) => offer(`https://mart${n}.co.kr/p/${n}`, p, '대파 1kg');
  const r = await run([food([L(1, 4500), L(2, 5200)]), food([L(3, 4800), L(4, 5000)]), food([L(5, 15000)])]);
  assert.equal(r.pricingMode, 'market_unit'); assert.equal(r.status, 'complete'); assertResearchEnvelope(r);
  assert.equal(r.estimate.unit, 'kg'); assert.equal(r.estimate.region, '전국'); assert.equal(r.candidates[0].name, '대파');
  assert.match(r.estimate.observedAt, /^\d{4}-\d{2}-\d{2}$/); assert.ok(r.offers.every(o => o.unit === 'kg' && o.price < 10000));
});
test('uncited-looking junk links are dropped (cart/login/search pages, http, private hosts)', async () => {
  const bad = ['http://a.co.kr/p/1', 'https://10.0.0.1/p/1', 'https://www.google.com/search?q=x', 'https://a.co.kr/cart', 'https://b.co.kr/'];
  const r = await run([agent({ level: 'type', offers: bad.map((u, i) => offer(u, 100000 + i, '이어버드')) })]);
  assert.equal(r.offers.length, 0);
});
test('a person returns no search; all agents failing is research_unavailable', async () => {
  const p = await run([agent({ kind: 'person' }), agent({ kind: 'person' })]);
  assert.equal(p.candidates[0].category, 'person');
  const f = await run([async () => { throw Error('x'); }, async () => { throw Error('y'); }]);
  assert.equal(f.status, 'research_unavailable'); assertResearchEnvelope(f);
});
test('two agreeing agents settle early and the slow third is cancelled', async () => {
  let cancelled = false; const t = Date.now(); let n = 0;
  const fns = [agent({ offers: [offer('https://a.co.kr/p/1', 446310)] }), agent({ offers: [offer('https://b.co.kr/p/2', 450000)] }),
    () => new Promise((_, rej) => { /* signal passed below */ })];
  const r = await agentResearch(body, { agents: 3, graceMs: 60000, runAgent: (f, i, o) => { const k = n++; return k < 2 ? fns[k]() : new Promise((_, rej) => o.signal.addEventListener('abort', () => { cancelled = true; rej(Error('aborted')); }, { once: true })); } });
  assert.equal(r.status, 'complete'); assert.ok(Date.now() - t < 2000); assert.equal(cancelled, true);
});
test('the typed model name reaches the agents', async () => {
  let hint; await run([async () => out()], { runAgent: (f, i, o) => { hint = o.modelHint; return Promise.resolve(out()); } }).catch(() => {});
  const r = await agentResearch({ ...body, modelHint: 'AirPods Pro 2' }, { agents: 1, graceMs: 5, runAgent: (f, i, o) => { hint = o.modelHint; return Promise.resolve(out()); } });
  assert.equal(hint, 'AirPods Pro 2'); assert.ok(r);
});
test('summarizeListings trims outliers and needs enough samples', async () => {
  const rows = [100, 110, 120, 130, 5000].map((p, i) => ({ title: 't', url: 'https://a.kr/' + i, merchant: 'a.kr', price: p, currency: 'KRW', evidence: ['e'] }));
  const s = await summarizeListings(rows); assert.equal(s.rows.length, 4); assert.equal(s.mean, 115);
  assert.equal(await summarizeListings(rows.slice(0, 2)), null);
});
test('runAgent sends both images with the hosted web_search tool', async () => {
  let sent;
  const fetchImpl = async (url, init) => { sent = { url, body: JSON.parse(init.body) };
    return { ok: true, json: async () => ({ output: [{ type: 'message', content: [{ type: 'output_text', text: '{"kind":"product","level":"exact","identity":{"brand":"B","model":"M"},"offers":[]}' }] }] }) }; };
  const r = await runAgent('f', [img, img], { env: { VLM_API_KEY: 'k', VLM_BASE_URL: 'https://p.example/v1', VLM_MODEL: 'm' }, fetchImpl });
  assert.equal(sent.url, 'https://p.example/v1/responses'); assert.deepEqual(sent.body.tools, [{ type: 'web_search' }]);
  assert.equal(sent.body.input[0].content.filter(c => c.type === 'input_image').length, 2); assert.equal(r.identity.brand, 'B');
});
