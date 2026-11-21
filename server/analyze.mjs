import http from 'node:http';
const port = Number(process.env.PORT || 8787);
const fallbackPolygon = () => Array.from({ length: 16 }, (_, index) => { const angle = Math.PI * 2 * index / 16; return { x: .5 + Math.cos(angle) * .5, y: .5 + Math.sin(angle) * .5 }; });
const json = (response, status, body) => { response.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); response.end(JSON.stringify(body)); };
const readBody = (request) => new Promise((resolve, reject) => { let data = ''; request.on('data', (chunk) => { data += chunk; if (data.length > 12_000_000) reject(new Error('payload too large')); }); request.on('end', () => resolve(JSON.parse(data || '{}'))); request.on('error', reject); });
const call = async (endpoint, payload) => { if (!endpoint) return {}; const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15_000); try { const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal }); if (!response.ok) throw new Error(`${endpoint} returned ${response.status}`); return response.json(); } finally { clearTimeout(timer); } };
const callCommercialVlm = async (payload) => {
  if (!process.env.OPENAI_API_KEY) return {};
  const response = await fetch(process.env.OPENAI_VLM_ENDPOINT || 'https://api.openai.com/v1/chat/completions', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, body: JSON.stringify({ model: process.env.OPENAI_VLM_MODEL || 'gpt-4o-mini', temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: [{ type: 'text', text: 'Identify the selected object for shopping. Do not use OCR. Return JSON with candidates: [{name, brand?, category?, confidence}].' }, { type: 'image_url', image_url: { url: payload.image } }] }] }) });
  if (!response.ok) throw new Error(`commercial VLM returned ${response.status}`);
  const body = await response.json(); let parsed = {}; try { parsed = JSON.parse(body.choices?.[0]?.message?.content || '{}'); } catch {}
  return { candidates: Array.isArray(parsed.candidates) ? parsed.candidates.filter((candidate) => typeof candidate?.name === 'string' && Number.isFinite(candidate?.confidence) && candidate.confidence >= 0 && candidate.confidence <= 1) : [] };
};
const server = http.createServer(async (request, response) => {
  if (request.method === 'OPTIONS') return json(response, 204, {});
  if (request.method !== 'POST' || request.url !== '/api/analyze') return json(response, 404, { error: 'not_found' });
  try {
    const body = await readBody(request);
    if (typeof body.image !== 'string' || !/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(body.image) || body.image.length > 12_000_000 || !body.selection || typeof body.selection.x !== 'number' || [body.selection.x,body.selection.y,body.selection.width,body.selection.height].some((value) => typeof value !== 'number' || value < 0 || value > 1)) return json(response, 400, { error: 'image_and_selection_required' });
    const payload = { image: body.image, selection: body.selection, locale: body.locale || 'ko-KR' };
    const [vision, offers, mask] = await Promise.all([(process.env.VLM_ENDPOINT ? call(process.env.VLM_ENDPOINT, { ...payload, task: 'identify-product-no-ocr' }) : callCommercialVlm(payload)), call(process.env.SEARCH_ENDPOINT, { ...payload, query: body.query || '' }), call(process.env.MASK_ENDPOINT, { ...payload, task: 'segment-object-cutout' })]);
    const demoNow = new Date().toISOString();
    if (!process.env.VLM_ENDPOINT && !process.env.OPENAI_API_KEY && !process.env.SEARCH_ENDPOINT && !process.env.MASK_ENDPOINT) {
      return json(response, 200, { candidates: [{ name: 'Nike Air Max 97', brand: 'Nike', category: '운동화', confidence: .82 }], offers: [{ source: '네이버 쇼핑', title: 'Nike Air Max 97 새상품', price: 129000, currency: 'KRW', condition: 'new', availability: 'in_stock', confidence: .88, url: 'https://search.shopping.naver.com/search/all?query=Nike%20Air%20Max%2097', checkedAt: demoNow }, { source: '중고마켓', title: 'Nike Air Max 97 중고', price: 89000, currency: 'KRW', condition: 'used', availability: 'unknown', confidence: .72, url: 'https://search.naver.com/search.naver?query=Nike%20Air%20Max%2097%20중고', checkedAt: demoNow }], maskDataUrl: body.image, bounds: { ...body.selection, polygon: Array.isArray(body.selection.polygon) && body.selection.polygon.length > 2 ? body.selection.polygon : fallbackPolygon() }, checkedAt: demoNow });
    }
    const candidates = Array.isArray(vision.candidates) ? vision.candidates : [];
    const validOffers = Array.isArray(offers.offers) ? offers.offers.filter((offer) => offer?.url && offer?.source && Number.isFinite(offer?.price) && offer?.currency && offer?.condition && offer?.checkedAt && Number.isFinite(offer?.confidence)) : [];
    return json(response, 200, { candidates, offers: validOffers, maskDataUrl: mask?.maskDataUrl, bounds: mask?.bounds || { ...body.selection, polygon: Array.isArray(body.selection.polygon) && body.selection.polygon.length > 2 ? body.selection.polygon : fallbackPolygon() }, checkedAt: new Date().toISOString() });
  } catch (error) { return json(response, 502, { error: error instanceof Error ? error.message : 'provider_error' }); }
});
server.listen(port, () => console.log(`HowMuch analyze API listening on http://localhost:${port}`));
