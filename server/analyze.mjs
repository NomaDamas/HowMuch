import http from 'node:http';
const port = Number(process.env.PORT || 8787);
const json = (response, status, body) => { response.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); response.end(JSON.stringify(body)); };
const readBody = (request) => new Promise((resolve, reject) => { let data = ''; request.on('data', (chunk) => { data += chunk; if (data.length > 12_000_000) reject(new Error('payload too large')); }); request.on('end', () => resolve(JSON.parse(data || '{}'))); request.on('error', reject); });
const call = async (endpoint, payload) => { if (!endpoint) return {}; const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }); if (!response.ok) throw new Error(`${endpoint} returned ${response.status}`); return response.json(); };
const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return json(response, 204, {});
  if (request.method !== 'POST' || request.url !== '/api/analyze') return json(response, 404, { error: 'not_found' });
  try {
    const body = await readBody(request);
    if (typeof body.image !== 'string' || !body.selection || typeof body.selection.x !== 'number') return json(response, 400, { error: 'image_and_selection_required' });
    const payload = { image: body.image, selection: body.selection, locale: body.locale || 'ko-KR' };
    const [vision, offers, mask] = await Promise.all([call(process.env.VLM_ENDPOINT, { ...payload, task: 'identify-product-no-ocr' }), call(process.env.SEARCH_ENDPOINT, { ...payload, query: body.query || '' }), call(process.env.MASK_ENDPOINT, { ...payload, task: 'segment-object-cutout' })]);
    const candidates = Array.isArray(vision.candidates) ? vision.candidates : [];
    const validOffers = Array.isArray(offers.offers) ? offers.offers.filter((offer) => offer?.url && offer?.source && Number.isFinite(offer?.price) && offer?.currency && offer?.condition && offer?.checkedAt && Number.isFinite(offer?.confidence)) : [];
    return json(response, 200, { candidates, offers: validOffers, mask: mask?.maskDataUrl ? mask : undefined, checkedAt: new Date().toISOString() });
  } catch (error) { return json(response, 502, { error: error instanceof Error ? error.message : 'provider_error' }); }
});
server.listen(port, () => console.log(`HowMuch analyze API listening on http://localhost:${port}`));
