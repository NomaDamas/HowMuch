const CURRENCIES = new Set(['KRW', 'USD', 'JPY', 'EUR']);
const CONDITIONS = new Set(['new', 'used', 'unknown']);
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const isHttpUrl = (value) => typeof value === 'string' && /^https?:\/\//i.test(value);
import { commodityFor, produceSource } from './produce-market.mjs';
import { identityProof, modelMatches, needsModel } from './identity-market.mjs';
import { referenceScope,referenceRows } from './reference-kind.mjs';

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
  if(body.region!==undefined && (typeof body.region!=='string'||!body.region.trim()||body.region.length>30))return false;
  return true;
}

export function isValidResearchResult(result) {
  if (!result || typeof result !== 'object' || !Array.isArray(result.candidates) || !Array.isArray(result.offers) || !Array.isArray(result.tools)) return false;
  if (typeof result.startedAt !== 'string' || Number.isNaN(Date.parse(result.startedAt)) || typeof result.completedAt !== 'string' || Number.isNaN(Date.parse(result.completedAt))) return false;
  if (result.tools.length === 0 || result.tools.some((tool) => typeof tool !== 'string' || tool.length === 0)) return false;
  if (result.candidates.some((candidate) => !candidate || typeof candidate.name !== 'string' || candidate.name.length === 0 || !isFiniteNumber(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 1)) return false;
  if(result.comparables?.length || result.comparableMarket!==undefined)return false;
  const reference=result.referenceMarket;
  if(result.pricingMode==='category_reference'||reference!==undefined){
    if(!reference||result.pricingMode!=='category_reference'||!result.candidates[0]||result.offers.length||result.lowest!==undefined||result.highest!==undefined||result.representative!==undefined||result.identity!==undefined||result.produceMarket!==undefined)return false;
    const scope=referenceScope({...result.candidates[0],kind:'product',reference:reference.scope});
    if(!scope||!Array.isArray(reference.listings)||reference.listings.length<1||reference.listings.length>4)return false;
    if(scope.kind==='basic-tee'?result.status!=='followup_required':result.status!=='partial')return false;
    if(reference.listings.some(o=>!o||typeof o.title!=='string'||!Array.isArray(o.evidence)||!o.evidence.length))return false;
    const derived=referenceRows(scope,reference.listings,reference.listings.map((_,i)=>i));
    if(derived.length!==reference.listings.length||derived.some((o,i)=>['kind','material','quantity','unit','quantityEvidence','basis'].some(k=>o[k]!==reference.listings[i][k])))return false;
  }
  if(result.status==='followup_required'&&(typeof result.followup?.prompt!=='string'||!result.followup.prompt.trim() || result.followup.reason!=='exact_model_not_visible'||result.offers.length||result.lowest||result.produceMarket))return false;
  if(result.offers.length&&(result.pricingMode==='exact_model'||needsModel(result.candidates[0]))){
    const i=result.identity || {};
    const proof=identityProof({...i,visibleModelEvidence:i.modelEvidence});
    const selected=result.candidates[0], canon=v=>typeof v==='string'?v.trim().normalize('NFKC').toLowerCase():'';
    if(!proof||!selected||canon(selected.brand)!==canon(proof.brand)||canon(selected.model)!==canon(proof.model)||!result.offers.every(o=>modelMatches(o,proof)))return false;
  }
  if(result.produceMarket!==undefined){
    const m=result.produceMarket;
    const commodityMode=!!m&&commodityFor({kind:'product',marketKind:'commodity',commodity:m.commodity})?.[5]==='commodity';
    if(!m||result.pricingMode!=='produce_market'||result.offers.length||result.lowest||result.representative||typeof m.commodity!=='string'||!m.commodity.trim()||!m.region||m.currency!=='KRW'||!isFiniteNumber(m.quantity)||m.quantity<=0||!['kg','g','개','포기','단','송이','묶음','통','박스','마리','근','판','팩'].includes(m.unit)||!Array.isArray(m.samples)||!m.samples.length||m.samples.length>500||commodityMode&&(!m.cut||typeof m.cut!=='string'||!m.grade||typeof m.grade!=='string'))return false;
    const commodity=commodityFor({kind:'product',marketKind:'produce',commodity:m.commodity});
    if(!commodity)return false;
    const canonical=raw=>{const u=new URL(raw);u.searchParams.sort();return u.href};
    const expected=canonical(produceSource(commodity));
    if(m.samples.some(s=>{
      if(!s||s.quantity!==m.quantity||s.unit!==m.unit||s.currency!==m.currency||!(s.price>0)||!isFiniteNumber(s.price)||!s.title?.includes(m.commodity)||typeof s.source!=='string'||!s.source.startsWith('aT KAMIS · ')||!s.region || m.region!=='전국'&&s.region!==m.region||commodityMode&&(s.cut!==m.cut||s.grade!==m.grade||s.observedAt===undefined))return true;
      try{const u=new URL(s.url);if(canonical(u.href)!==expected)return true;}catch{return true;}
      const age=Date.now()-Date.parse(s.observedAt+'T00:00:00+09:00'),checked=Date.now()-Date.parse(s.checkedAt);
      return !Number.isFinite(age)||age< -300000||age>8*86400000||!Number.isFinite(checked)||checked< -300000||checked>86400000;
    }))return false;
    const prices=m.samples.map(s=>s.price).sort((a,b)=>a-b), i=prices.length>>1;
    if(m.min!==prices[0]||m.max!==prices.at(-1)||m.median!==(prices.length%2?prices[i]:(prices[i-1]+prices[i])/2))return false;
  }
  if (result.comparables !== undefined && (!Array.isArray(result.comparables) || result.comparables.some(o =>
      !o || o.matchKind !== 'comparable' || typeof o.comparisonBasis !== 'string' ||
      (!o.quantity ? false : typeof o.quantity !== 'string')))) return false;
  const evidenceRows=[...result.offers,...(result.comparables||[]),...(reference?.listings||[])];
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
  if (!body || !['completed', 'complete', 'partial', 'no_result', 'followup_required','research_unavailable', 'error'].includes(body.status)) throw new Error('research_agent_invalid_contract');
  const result = { ...(body.result || body), status: body.status };
  if (!isValidResearchResult(result)) throw new Error('research_agent_invalid_contract');
  return { ...result, status: body.status, ...(Array.isArray(body.queries) ? { queries: body.queries } : {}) };
}
