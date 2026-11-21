import http from 'node:http';
import { assertResearchEnvelope, isValidResearchInput } from './research-contract.mjs';
const port = Number(process.env.PORT || 8787);
const fallbackPolygon = () => Array.from({ length: 16 }, (_, index) => { const angle = Math.PI * 2 * index / 16; return { x: .5 + Math.cos(angle) * .5, y: .5 + Math.sin(angle) * .5 }; });
const requestBuckets = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_LIMIT = 30;
const TRUST_PROXY = process.env.TRUST_PROXY === '1';
const MAX_BUCKETS = 10_000;
const json = (response, status, body, extraHeaders = {}) => { response.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', ...extraHeaders }); response.end(JSON.stringify(body)); };
const readBody = (request) => new Promise((resolve, reject) => { let data = ''; request.on('data', (chunk) => { data += chunk; if (data.length > 12_000_000) reject(new Error('payload too large')); }); request.on('end', () => resolve(JSON.parse(data || '{}'))); request.on('error', reject); });
const call = async (endpoint, payload) => { if (!endpoint) return {}; const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15_000); try { const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal }); if (!response.ok) throw new Error(`${endpoint} returned ${response.status}`); return response.json(); } finally { clearTimeout(timer); } };
const callCommercialVlm = async (payload) => {
  if (!process.env.OPENAI_API_KEY) return {};
  const response = await fetch(process.env.OPENAI_VLM_ENDPOINT || 'https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model: process.env.OPENAI_VLM_MODEL || 'gpt-4o-mini', temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: [{ type: 'text', text: 'Identify the selected object for shopping. Do not use OCR. Return JSON with candidates: [{name, brand?, model?, category?, attributes?, queries?, confidence}].' }, { type: 'image_url', image_url: { url: payload.image } }] }] }) });
  if (!response.ok) throw new Error(`commercial VLM returned ${response.status}`);
  const body = await response.json(); let parsed = {}; try { parsed = JSON.parse(body.choices?.[0]?.message?.content || '{}'); } catch {}
  return { candidates: Array.isArray(parsed.candidates) ? parsed.candidates.filter((candidate) => typeof candidate?.name === 'string' && Number.isFinite(candidate?.confidence) && candidate.confidence >= 0 && candidate.confidence <= 1 && (candidate.attributes === undefined || typeof candidate.attributes === 'object') && (candidate.queries === undefined || Array.isArray(candidate.queries))) : [] };
};
const callResearchAgent = async (payload) => {
  if (!process.env.RESEARCH_AGENT_ENDPOINT) return null;
  const startedAt = new Date().toISOString();
  const response = await call(process.env.RESEARCH_AGENT_ENDPOINT, { runtime: 'howmuch-research-v1', task: 'multimodal-research-agent', image: payload.image, cutout: payload.cutout, selection: payload.selection, locale: payload.locale, tools: ['visual_search_agent', 'text_search_agent', 'open_page', 'extract_offer', 'compare_offers'], contract: { status: 'completed', result: 'ResearchResult', evidenceRequired: true, noGuesses: true }, startedAt });
  return assertResearchEnvelope(response);
};
const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return json(response, 204, {});
  if (request.method !== 'POST' || request.url !== '/api/research') return json(response, 404, { error: 'not_found' });
  try {
    const clientKey = (TRUST_PROXY ? request.headers['x-forwarded-for']?.split(',')[0]?.trim() : undefined) || request.socket.remoteAddress || 'anonymous';
    const now = Date.now(); const bucket = requestBuckets.get(clientKey) || { startedAt: now, count: 0 };
    if (now - bucket.startedAt >= RATE_WINDOW_MS) { bucket.startedAt = now; bucket.count = 0; }
    bucket.count += 1; requestBuckets.set(clientKey, bucket);
    if (bucket.count > RATE_LIMIT) return json(response, 429, { error: 'rate_limited', retryAfterSeconds: Math.ceil((RATE_WINDOW_MS - (now - bucket.startedAt)) / 1000) }, { 'retry-after': String(Math.ceil((RATE_WINDOW_MS - (now - bucket.startedAt)) / 1000)) });
    if (requestBuckets.size > MAX_BUCKETS) { for (const [key, value] of requestBuckets) if (now - value.startedAt >= RATE_WINDOW_MS) requestBuckets.delete(key); if (requestBuckets.size > MAX_BUCKETS) { const oldest = [...requestBuckets.entries()].sort((a, b) => a[1].startedAt - b[1].startedAt).slice(0, requestBuckets.size - MAX_BUCKETS); oldest.forEach(([key]) => requestBuckets.delete(key)); } }
    const body = await readBody(request);
    if (!isValidResearchInput(body)) return json(response, 400, { error: 'image_and_selection_required' });
    const payload = { image: body.image || body.imageDataUrl, cutout: body.cutout || body.cutoutDataUrl, selection: body.selection, locale: body.locale || 'ko-KR' };
    const research = await callResearchAgent(payload);
    if (!research) return json(response, 503, { error: 'agent_unavailable', message: 'Configure RESEARCH_AGENT_ENDPOINT. /api/research never falls back to direct search APIs.' });
    return json(response, 200, research);
  } catch (error) { return json(response, 502, { error: error instanceof Error ? error.message : 'provider_error' }); }
});
server.listen(port, () => console.log(`HowMuch analyze API listening on http://localhost:${port}`));
