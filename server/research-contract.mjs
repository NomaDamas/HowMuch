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
  if (cutout === undefined) return false;
  if (cutout !== undefined && (typeof cutout !== 'string' || !/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(cutout) || cutout.length > 12_000_000)) return false;
  return true;
}

export function isValidResearchResult(result) {
  if (!result || typeof result !== 'object' || !Array.isArray(result.candidates) || !Array.isArray(result.offers) || !Array.isArray(result.tools)) return false;
  if (typeof result.startedAt !== 'string' || Number.isNaN(Date.parse(result.startedAt)) || typeof result.completedAt !== 'string' || Number.isNaN(Date.parse(result.completedAt))) return false;
  if (result.tools.length === 0 || result.tools.some((tool) => typeof tool !== 'string' || tool.length === 0)) return false;
  if (result.candidates.some((candidate) => !candidate || typeof candidate.name !== 'string' || candidate.name.length === 0 || !isFiniteNumber(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 1)) return false;
  if (result.comparables !== undefined && (!Array.isArray(result.comparables) || result.comparables.some(o =>
      !o || o.matchKind !== 'comparable' || typeof o.comparisonBasis !== 'string' ||
      (!o.quantity ? false : typeof o.quantity !== 'string')))) return false;
  const evidenceRows=[...result.offers,...(result.comparables||[])];
  if (evidenceRows.some((offer) => !offer || (offer.id !== undefined && typeof offer.id !== 'string') || typeof offer.title !== 'string' || !isHttpUrl(offer.url) || typeof offer.merchant !== 'string' || !isFiniteNumber(offer.price) || offer.price <= 0 || !CURRENCIES.has(offer.currency) || !CONDITIONS.has(offer.condition) || typeof offer.checkedAt !== 'string' || Number.isNaN(Date.parse(offer.checkedAt)) || !Array.isArray(offer.evidence) || offer.evidence.length === 0 || offer.evidence.some((e) => typeof e !== 'string' || e.length === 0) || !isFiniteNumber(offer.confidence) || offer.confidence < 0 || offer.confidence > 1)) return false;
  const fresh = (offer) => {
    const checked = Date.parse(offer.checkedAt);
    return Number.isFinite(checked) && checked <= Date.now() + 300000 && checked >= Date.now() - 7 * 86400000;
  };
  if (evidenceRows.some((offer) => !fresh(offer))) return false;
  if (evidenceRows.some(o => {
    try { const url=new URL(o.url); return url.protocol!=='https:' || !!url.username || !!url.password ||
      url.hostname.toLowerCase()!==o.merchant.toLowerCase() || (o.comparePrice !== undefined &&
        (!(o.comparePrice>0) || !isFiniteNumber(o.comparePrice) || !CURRENCIES.has(o.compareCurrency))); } catch { return true; }
  })) return false;
  const resolveOffer = selected => result.offers.find(o => typeof selected === 'string'
    ? o.id === selected || o.url === selected
    : o.url === selected?.url && o.price === selected?.price && o.currency === selected?.currency &&
      o.checkedAt === selected?.checkedAt && o.availability === selected?.availability &&
      o.comparePrice === selected?.comparePrice && o.compareCurrency === selected?.compareCurrency);
  const eligible = o => o && o.availability === 'in_stock' && o.condition !== 'unknown';
  const lo = resolveOffer(result.lowest), hi = resolveOffer(result.highest);
  if ((result.lowest !== undefined && !eligible(lo)) || (result.highest !== undefined && !eligible(hi))) return false;
  const r=result.representative;
  if (r !== undefined && (!lo || !hi || ![r.min,r.max,r.median].every(isFiniteNumber) ||
      !(r.min > 0 && r.min <= r.median && r.median <= r.max) || !CURRENCIES.has(r.currency))) return false;
  if (r) {
    const matches = (o,n) => (o.compareCurrency ?? o.currency) === r.currency &&
      Math.abs((o.comparePrice ?? (o.price+(r.basis==='delivered' ? o.shipping ?? 0 : 0)))-n) < .01;
    if (!matches(lo,r.min) || !matches(hi,r.max)) return false;
  }
  return true;
}

export function assertResearchEnvelope(body) {
  if (!body || !['completed', 'complete', 'partial', 'no_result', 'research_unavailable', 'error'].includes(body.status)) throw new Error('research_agent_invalid_contract');
  const result = body.result || body;
  if (!isValidResearchResult(result)) throw new Error('research_agent_invalid_contract');
  return { ...result, status: body.status, ...(Array.isArray(body.queries) ? { queries: body.queries } : {}) };
}
