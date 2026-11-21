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
    const demoNow = new Date().toISOString();
    if (!process.env.VLM_ENDPOINT && !process.env.SEARCH_ENDPOINT && !process.env.MASK_ENDPOINT) {
      return json(response, 200, { candidates: [{ name: 'Nike Air Max 97', brand: 'Nike', category: '운동화', confidence: .82 }], offers: [{ source: '네이버 쇼핑', title: 'Nike Air Max 97 새상품', price: 129000, currency: 'KRW', condition: 'new', availability: 'in_stock', confidence: .88, url: 'https://search.shopping.naver.com/search/all?query=Nike%20Air%20Max%2097', checkedAt: demoNow }, { source: '중고마켓', title: 'Nike Air Max 97 중고', price: 89000, currency: 'KRW', condition: 'used', availability: 'unknown', confidence: .72, url: 'https://search.naver.com/search.naver?query=Nike%20Air%20Max%2097%20중고', checkedAt: demoNow }], maskDataUrl: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70"><path d="M4 46 Q18 16 48 24 Q72 27 96 44 L88 58 L12 59Z" fill="rgba(217,255,98,.22)"/></svg>')}`, bounds: body.selection, checkedAt: demoNow });
    }
    const candidates = Array.isArray(vision.candidates) ? vision.candidates : [];
    const validOffers = Array.isArray(offers.offers) ? offers.offers.filter((offer) => offer?.url && offer?.source && Number.isFinite(offer?.price) && offer?.currency && offer?.condition && offer?.checkedAt && Number.isFinite(offer?.confidence)) : [];
    return json(response, 200, { candidates, offers: validOffers, maskDataUrl: mask?.maskDataUrl, bounds: mask?.bounds || body.selection, checkedAt: new Date().toISOString() });
  } catch (error) { return json(response, 502, { error: error instanceof Error ? error.message : 'provider_error' }); }
});
server.listen(port, () => console.log(`HowMuch analyze API listening on http://localhost:${port}`));
