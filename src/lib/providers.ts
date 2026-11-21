import type { NormalizedSelection, PriceOffer, ProductCandidate } from './types';
import type { DetectorProvider } from './search';
import type { SearchProvider, VlmProvider } from './search';
import { parseSearxngOffer } from './provider-logic.js';
import type { ResearchAgentProvider, ResearchContext, ResearchResult } from './research';
import { summarizeResearchOffers } from './research';

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
    const response = await fetch(this.endpoint, { method: 'POST', headers: { 'content-type': 'application/json', ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}) }, body: JSON.stringify({ query, image: opts?.imageDataUrl, locale: opts?.locale ?? 'ko-KR', include: ['image', 'shopping', 'used'] }) });
    if (!response.ok) throw new Error(`Search provider failed: ${response.status}`);
    const body = await response.json() as { offers?: PriceOffer[] };
    return Array.isArray(body.offers) ? body.offers.filter((offer) => Boolean(offer?.url && offer?.source && Number.isFinite(offer?.price) && offer.price > 0 && ['KRW','USD','JPY','EUR'].includes(offer.currency) && ['new','used','unknown'].includes(offer.condition) && typeof offer.checkedAt === 'string' && Number.isFinite(offer.confidence) && offer.confidence >= 0 && offer.confidence <= 1)) : [];
  }
}

/** OpenAI-compatible commercial VLM adapter. The server proxy should hold the key. */
export class OpenAICompatibleVlmProvider implements VlmProvider {
  constructor(private readonly endpoint: string, private readonly apiKey: string, private readonly model = 'gpt-4o-mini') {}
  async identify(input: { imageDataUrl: string; selection: NormalizedSelection }): Promise<ProductCandidate[]> {
    const response = await fetch(this.endpoint, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` }, body: JSON.stringify({ model: this.model, temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: [{ type: 'text', text: 'Identify the selected object for shopping. Do not use OCR. Return JSON with candidates: [{name, brand?, model?, category?, attributes?, queries?, confidence}].' }, { type: 'image_url', image_url: { url: input.imageDataUrl } }] }] }) });
    if (!response.ok) throw new Error(`Commercial VLM failed: ${response.status}`);
    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    try { const parsed = JSON.parse(body.choices?.[0]?.message?.content || '{}'); return Array.isArray(parsed.candidates) ? parsed.candidates.filter((candidate: ProductCandidate) => typeof candidate?.name === 'string' && Number.isFinite(candidate?.confidence) && candidate.confidence >= 0 && candidate.confidence <= 1 && (candidate.attributes === undefined || typeof candidate.attributes === 'object') && (candidate.queries === undefined || Array.isArray(candidate.queries))) : []; } catch { return []; }
  }
}

/** SearXNG JSON adapter for permitted metasearch deployments. */
export class SearxngSearchProvider implements SearchProvider {
  constructor(private readonly endpoint: string) {}
  async search(query: string, opts?: { locale?: string }): Promise<PriceOffer[]> {
    const url = new URL(this.endpoint); url.searchParams.set('q', query); url.searchParams.set('format', 'json'); url.searchParams.set('language', opts?.locale || 'ko-KR');
    const response = await fetch(url); if (!response.ok) throw new Error(`SearXNG failed: ${response.status}`);
    const body = await response.json() as { results?: Array<{ title?: string; url?: string; content?: string }> }; const checkedAt = new Date().toISOString();
    return (body.results || []).slice(0, 10).map((item) => parseSearxngOffer(item, checkedAt)).filter(Boolean) as PriceOffer[];
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
export class HttpDetectorProvider implements DetectorProvider {
  constructor(private readonly endpoint: string) {}
  async detect(input: { imageDataUrl: string }): Promise<NormalizedSelection[]> { const response = await fetch(this.endpoint, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ image:input.imageDataUrl, task:'detect-objects' }) }); if (!response.ok) throw new Error(`Detector provider failed: ${response.status}`); const body=await response.json() as { selections?: NormalizedSelection[] }; return Array.isArray(body.selections)?body.selections.filter((selection)=>selection.width>0&&selection.height>0):[]; }
}
export class HttpAnalyzeProvider implements VlmProvider, SearchProvider, MaskProvider {
  private cache = new Map<string, { value: any; expires: number }>();
  private inflight = new Map<string, Promise<any>>();
  private lastBody: any; private lastImage = '';
  constructor(private readonly endpoint: string) {}
  private async analyze(input: { imageDataUrl: string; selection: any; query?: string }) { const fingerprint = Array.from(input.imageDataUrl).reduce((hash, char) => ((hash * 31 + char.charCodeAt(0)) >>> 0), 7); const key = `${fingerprint}:${JSON.stringify(input.selection)}:${input.query||''}`; const cached = this.cache.get(key); if (cached && cached.expires > Date.now()) return cached.value; if (cached) this.cache.delete(key); const running = this.inflight.get(key); if (running) return running; const runningRequest = (async () => { const response = await fetch(this.endpoint, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ image:input.imageDataUrl, selection:input.selection, query:input.query }) }); if (!response.ok) throw new Error(`Analyze provider failed: ${response.status}`); const body = await response.json(); this.cache.set(key, { value: body, expires: Date.now() + 30_000 }); this.lastBody = body; this.lastImage = input.imageDataUrl; return body; })(); this.inflight.set(key, runningRequest); try { return await runningRequest; } finally { this.inflight.delete(key); } }
  async identify(input: { imageDataUrl: string; selection: any }) { return (await this.analyze(input)).candidates || []; }
  async search(query: string, opts?: { locale?: string; imageDataUrl?: string }) { const body = await this.analyze({ imageDataUrl: opts?.imageDataUrl || '', selection:{x:0,y:0,width:1,height:1}, query }); return body.offers || []; }
  async segment(input: { imageDataUrl: string; selection: any }) { const body = await this.analyze(input); return { maskDataUrl: body.maskDataUrl, bounds: body.bounds || input.selection }; }
}

export class HttpSegmentationProvider {
  constructor(private readonly endpoint: string) {}
  async segment(input: { imageDataUrl: string; selection?: any }) {
    const response = await fetch(this.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ image: input.imageDataUrl, selection: input.selection, task: 'segment-selected-object', model: 'sam2-or-equivalent' }) });
    if (!response.ok) throw new Error(`Segmentation provider failed: ${response.status}`);
    const body = await response.json() as { selection?: any; maskDataUrl?: string };
    const next = body.selection;
    if (!next || !Number.isFinite(next.x) || !Number.isFinite(next.y) || !Number.isFinite(next.width) || !Number.isFinite(next.height) || next.width <= 0 || next.height <= 0 || next.x < 0 || next.y < 0 || next.x + next.width > 1 || next.y + next.height > 1) throw new Error('Segmentation provider returned invalid selection');
    return { selection: next, maskDataUrl: body.maskDataUrl };
  }
}

export class HttpResearchProvider implements ResearchAgentProvider {
  constructor(private readonly endpoint: string) {}
  async research(input: ResearchContext): Promise<ResearchResult> {
    const response = await fetch(this.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
    if (!response.ok) throw new Error(`Research agent failed: ${response.status}`);
    const envelope = await response.json() as { candidates?: ResearchResult['candidates']; offers?: ResearchResult['offers']; lowest?: ResearchResult['lowest']; highest?: ResearchResult['highest']; representative?: ResearchResult['representative']; startedAt?: string; completedAt?: string; tools?: string[] };
    if (!Array.isArray(envelope.candidates) || !Array.isArray(envelope.offers) || typeof envelope.startedAt !== 'string' || Number.isNaN(Date.parse(envelope.startedAt)) || typeof envelope.completedAt !== 'string' || Number.isNaN(Date.parse(envelope.completedAt)) || !Array.isArray(envelope.tools) || envelope.tools.length === 0 || envelope.tools.some((tool) => typeof tool !== 'string' || !tool.trim())) throw new Error('Research agent returned an invalid contract');
    if (envelope.candidates.some((candidate) => !candidate?.name || typeof candidate.name !== 'string' || !Number.isFinite(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 1)) throw new Error('Research agent returned invalid candidates');
    if (envelope.offers.some((offer) => !offer?.title || typeof offer.title !== 'string' || !/^https?:\/\//i.test(offer.url) || !offer.merchant || typeof offer.merchant !== 'string' || !Number.isFinite(offer.price) || offer.price <= 0 || !['KRW', 'USD', 'JPY', 'EUR'].includes(offer.currency) || !['new', 'used', 'unknown'].includes(offer.condition) || typeof offer.checkedAt !== 'string' || Number.isNaN(Date.parse(offer.checkedAt)) || !Array.isArray(offer.evidence) || offer.evidence.length === 0 || offer.evidence.some((e) => typeof e !== 'string' || !e.trim()) || !Number.isFinite(offer.confidence) || offer.confidence < 0 || offer.confidence > 1)) throw new Error('Research agent returned invalid offers');
    return envelope as ResearchResult;
  }
}

export function providerConfig() {
  return { researchEndpoint: import.meta.env.VITE_RESEARCH_ENDPOINT as string | undefined, segmentationEndpoint: import.meta.env.VITE_SEGMENTATION_ENDPOINT as string | undefined };
}
