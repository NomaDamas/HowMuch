const CURRENCIES = new Set(['KRW', 'USD', 'JPY', 'EUR']);
const CONDITIONS = new Set(['new', 'used', 'unknown']);
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isHttpUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value);

export function isValidResearchInput(body) {
  if (!body || typeof body !== 'object') return false;
  const image = body.image || body.imageDataUrl;
  if (typeof image !== 'string' || !/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(image) || image.length > 12_000_000) return false;
  const s = body.selection;
  if (!s || !['x', 'y', 'width', 'height'].every((key) => isFiniteNumber(s[key]) && s[key] >= 0 && s[key] <= 1)) return false;
  if (s.width <= 0 || s.height <= 0 || s.x + s.width > 1 || s.y + s.height > 1) return false;
  if (s.polygon !== undefined && (!Array.isArray(s.polygon) || s.polygon.length < 3 || s.polygon.length > 256 || s.polygon.some((p) => !p || !isFiniteNumber(p.x) || !isFiniteNumber(p.y) || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1))) return false;
  const cutout = body.cutout ?? body.cutoutDataUrl;
  if (cutout !== undefined && (typeof cutout !== 'string' || !/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(cutout) || cutout.length > 12_000_000)) return false;
  return true;
}

export function isValidResearchResult(result) {
  if (!result || typeof result !== 'object' || !Array.isArray(result.candidates) || !Array.isArray(result.offers) || !Array.isArray(result.tools)) return false;
  if (typeof result.startedAt !== 'string' || Number.isNaN(Date.parse(result.startedAt)) || typeof result.completedAt !== 'string' || Number.isNaN(Date.parse(result.completedAt))) return false;
  if (result.tools.length === 0 || result.tools.some((tool) => typeof tool !== 'string' || tool.length === 0)) return false;
  if (result.candidates.some((candidate) => !candidate || typeof candidate.name !== 'string' || candidate.name.length === 0 || !isFiniteNumber(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 1)) return false;
  if (result.offers.some((offer) => !offer || typeof offer.title !== 'string' || !isHttpUrl(offer.url) || typeof offer.merchant !== 'string' || !isFiniteNumber(offer.price) || offer.price <= 0 || !CURRENCIES.has(offer.currency) || !CONDITIONS.has(offer.condition) || typeof offer.checkedAt !== 'string' || Number.isNaN(Date.parse(offer.checkedAt)) || !Array.isArray(offer.evidence) || offer.evidence.length === 0 || offer.evidence.some((e) => typeof e !== 'string' || e.length === 0) || !isFiniteNumber(offer.confidence) || offer.confidence < 0 || offer.confidence > 1)) return false;
  const offerMatches = (selected) => selected === undefined || (typeof selected === 'string' ? result.offers.some((offer) => offer.url === selected || offer.title === selected) : result.offers.some((offer) => offer.url === selected.url && offer.price === selected.price && offer.currency === selected.currency));
  if (!offerMatches(result.lowest) || !offerMatches(result.highest)) return false;
  if (result.representative !== undefined && (!isFiniteNumber(result.representative.min) || !isFiniteNumber(result.representative.max) || !isFiniteNumber(result.representative.median) || !CURRENCIES.has(result.representative.currency))) return false;
  return true;
}

export function assertResearchEnvelope(body) {
  if (!body || !['completed', 'complete', 'partial', 'no_result', 'error'].includes(body.status) || !isValidResearchResult(body.result)) throw new Error('research_agent_invalid_contract');
  return { ...body.result, status: body.status, ...(Array.isArray(body.queries) ? { queries: body.queries } : {}) };
}
