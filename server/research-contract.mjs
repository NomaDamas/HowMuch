// Result and input contract for the agent-only research service. Three pricing modes:
//   exact_model   - lowest/highest/representative of one agreed model (identity required for model-sensitive goods)
//   type_estimate - rough average of >= 3 comparable listings; model unknown; carries a follow-up asking for the model
//   market_unit   - unit market price (per kg / piece) for goods where the shop does not matter
import { identityProof, modelMatches, needsModel } from './identity-market.mjs';

const CURRENCIES = new Set(['KRW', 'USD', 'JPY', 'EUR']);
const CONDITIONS = new Set(['new', 'used', 'unknown']);
const MODES = new Set(['exact_model', 'type_estimate', 'market_unit']);
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
  if(body.labelDataUrl!==undefined && (typeof body.labelDataUrl!=='string'||body.labelDataUrl.length>12_000_000||!/^data:image\/(png|jpeg|webp);base64,[a-z\d+/]+=*$/i.test(body.labelDataUrl)))return false;
  if(body.modelHint!==undefined && (typeof body.modelHint!=='string'||!body.modelHint.trim()||body.modelHint.length>80))return false;
  if(body.region!==undefined && (typeof body.region!=='string'||!body.region.trim()||body.region.length>30))return false;
  return true;
}

export function isValidResearchResult(result) {
  if (!result || typeof result !== 'object' || !Array.isArray(result.candidates) || !Array.isArray(result.offers) || !Array.isArray(result.tools)) return false;
  if (typeof result.startedAt !== 'string' || Number.isNaN(Date.parse(result.startedAt)) || typeof result.completedAt !== 'string' || Number.isNaN(Date.parse(result.completedAt))) return false;
  if (result.tools.length === 0 || result.tools.some((tool) => typeof tool !== 'string' || tool.length === 0)) return false;
  if (result.candidates.some((c) => !c || typeof c.name !== 'string' || c.name.length === 0 || !isFiniteNumber(c.confidence) || c.confidence < 0 || c.confidence > 1)) return false;
  if (result.pricingMode !== undefined && !MODES.has(result.pricingMode)) return false;
  if (result.followup !== undefined && (typeof result.followup?.prompt !== 'string' || !result.followup.prompt.trim() || result.followup.reason !== 'exact_model_not_visible')) return false;
  if (result.status === 'followup_required' && (result.offers.length || result.lowest || result.estimate)) return false;

  // every listing shown must be a real https page with evidence and a fresh timestamp
  const bad = (o) => {
    if (!o || (o.id !== undefined && typeof o.id !== 'string') || typeof o.title !== 'string' || !o.title || !isHttpUrl(o.url) || typeof o.merchant !== 'string' || !isFiniteNumber(o.price) || o.price <= 0 || !CURRENCIES.has(o.currency) || !CONDITIONS.has(o.condition)) return true;
    if (typeof o.checkedAt !== 'string' || !Number.isFinite(Date.parse(o.checkedAt)) || Date.parse(o.checkedAt) > Date.now() + 300000 || Date.parse(o.checkedAt) < Date.now() - 7 * 86400000) return true;
    if (!Array.isArray(o.evidence) || !o.evidence.length || o.evidence.some((e) => typeof e !== 'string' || !e.trim()) || !isFiniteNumber(o.confidence) || o.confidence < 0 || o.confidence > 1) return true;
    try { const u = new URL(o.url); return u.protocol !== 'https:' || !!u.username || !!u.password || u.hostname.toLowerCase() !== o.merchant.toLowerCase(); } catch { return true; }
  };
  if (result.offers.some(bad)) return false;

  const mode = result.pricingMode;
  if (mode === 'type_estimate' || mode === 'market_unit') {
    const e = result.estimate;
    if (!e || result.lowest !== undefined || result.highest !== undefined || result.representative !== undefined || result.identity !== undefined) return false;
    if (![e.mean, e.median, e.min, e.max].every((n) => isFiniteNumber(n) && n > 0) || !(e.min <= e.median && e.median <= e.max) || !CURRENCIES.has(e.currency)) return false;
    if (e.sampleCount !== result.offers.length || result.offers.length < 3 || result.offers.some((o) => o.currency !== e.currency)) return false;
    if (mode === 'market_unit' && (typeof e.unit !== 'string' || !e.unit || typeof e.region !== 'string' || !e.region || result.status !== 'complete')) return false;
    if (mode === 'type_estimate' && (result.status !== 'partial' || !result.followup)) return false;
    return true;
  }
  if (result.estimate !== undefined) return false;

  if (result.offers.length && (mode === 'exact_model' || needsModel(result.candidates[0]))) {
    const i = result.identity || {};
    const proof = identityProof({ ...i, visibleModelEvidence: i.modelEvidence });
    const selected = result.candidates[0], canon = (v) => typeof v === 'string' ? v.trim().normalize('NFKC').toLowerCase() : '';
    if (!proof || !selected || canon(selected.brand) !== canon(proof.brand) || canon(selected.model) !== canon(proof.model) || !result.offers.every((o) => modelMatches(o, proof))) return false;
  }
  const resolve = (selected) => result.offers.find((o) => typeof selected === 'string' ? o.id === selected || o.url === selected : o.url === selected?.url && o.price === selected?.price && o.currency === selected?.currency);
  const eligible = (o) => o && o.availability === 'in_stock' && o.condition !== 'unknown';
  const lo = resolve(result.lowest), hi = resolve(result.highest);
  if ((result.lowest !== undefined && !eligible(lo)) || (result.highest !== undefined && !eligible(hi))) return false;
  const r = result.representative;
  if (r !== undefined) {
    if (!lo || !hi || ![r.min, r.max, r.median].every(isFiniteNumber) || !(r.min > 0 && r.min <= r.median && r.median <= r.max) || !CURRENCIES.has(r.currency)) return false;
    const matches = (o, n) => (o.compareCurrency ?? o.currency) === r.currency && Math.abs((o.comparePrice ?? (o.price + (r.basis === 'delivered' ? o.shipping ?? 0 : 0))) - n) < .01;
    if (!matches(lo, r.min) || !matches(hi, r.max)) return false;
  }
  if (result.status === 'complete' && (mode !== 'exact_model' || !lo)) return false;
  return true;
}

export function assertResearchEnvelope(body) {
  if (!body || !['completed', 'complete', 'partial', 'no_result', 'followup_required', 'research_unavailable', 'error'].includes(body.status)) throw new Error('research_agent_invalid_contract');
  const result = { ...(body.result || body), status: body.status };
  if (!isValidResearchResult(result)) throw new Error('research_agent_invalid_contract');
  return { ...result, status: body.status, ...(Array.isArray(body.queries) ? { queries: body.queries } : {}) };
}
