import type { NormalizedSelection, PriceOffer, ProductCandidate } from './types';
import type { SearchProvider, VlmProvider } from './search';

/** Server-side adapters. Keep API keys out of the browser; proxy these from /api/analyze. */
export class HttpVlmProvider implements VlmProvider {
  constructor(private readonly endpoint: string, private readonly apiKey?: string) {}
  async identify(input: { imageDataUrl: string; selection: NormalizedSelection }): Promise<ProductCandidate[]> {
    const response = await fetch(this.endpoint, { method: 'POST', headers: { 'content-type': 'application/json', ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}) }, body: JSON.stringify({ image: input.imageDataUrl, selection: input.selection, task: 'identify-product-no-ocr' }) });
    if (!response.ok) throw new Error(`VLM provider failed: ${response.status}`);
    const body = await response.json() as { candidates?: ProductCandidate[] };
    return Array.isArray(body.candidates) ? body.candidates.filter((candidate) => typeof candidate?.name === 'string' && candidate.name.length > 0 && typeof candidate?.confidence === 'number' && candidate.confidence >= 0 && candidate.confidence <= 1) : [];
  }
}

export class HttpSearchProvider implements SearchProvider {
  constructor(private readonly endpoint: string, private readonly apiKey?: string) {}
  async search(query: string, opts?: { locale?: string }): Promise<PriceOffer[]> {
    const response = await fetch(this.endpoint, { method: 'POST', headers: { 'content-type': 'application/json', ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}) }, body: JSON.stringify({ query, locale: opts?.locale ?? 'ko-KR', include: ['image', 'shopping', 'used'] }) });
    if (!response.ok) throw new Error(`Search provider failed: ${response.status}`);
    const body = await response.json() as { offers?: PriceOffer[] };
    return Array.isArray(body.offers) ? body.offers.filter((offer) => Boolean(offer?.url && offer?.source && Number.isFinite(offer?.price) && offer.price > 0 && ['KRW','USD','JPY','EUR'].includes(offer.currency) && ['new','used','unknown'].includes(offer.condition) && typeof offer.checkedAt === 'string' && Number.isFinite(offer.confidence) && offer.confidence >= 0 && offer.confidence <= 1)) : [];
  }
}

export class HttpMaskProvider {
  constructor(private readonly endpoint: string, private readonly apiKey?: string) {}
  async segment(input: { imageDataUrl: string; selection: { x:number; y:number; width:number; height:number; polygon?: Array<{x:number;y:number}> } }) {
    const response = await fetch(this.endpoint, { method: 'POST', headers: { 'content-type': 'application/json', ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}) }, body: JSON.stringify({ image: input.imageDataUrl, selection: input.selection, task: 'segment-object-cutout' }) });
    if (!response.ok) throw new Error(`Mask provider failed: ${response.status}`);
    return await response.json() as { maskDataUrl?: string; bounds: typeof input.selection };
  }
}

export function providerConfig() {
  return { vlmEndpoint: import.meta.env.VITE_VLM_ENDPOINT as string | undefined, searchEndpoint: import.meta.env.VITE_SEARCH_ENDPOINT as string | undefined, maskEndpoint: import.meta.env.VITE_MASK_ENDPOINT as string | undefined };
}
