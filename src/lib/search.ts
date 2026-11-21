import type { NormalizedSelection, PriceOffer, ProductCandidate, ProductInsight } from './types';

export interface VlmProvider {
  identify(input: { imageDataUrl: string; selection: NormalizedSelection }): Promise<ProductCandidate[]>;
}

export interface SearchProvider {
  search(query: string, opts?: { locale?: string; imageDataUrl?: string }): Promise<PriceOffer[]>;
}
export interface MaskProvider { segment(input:{imageDataUrl:string;selection:NormalizedSelection}):Promise<{maskDataUrl?:string;bounds:NormalizedSelection}>; }
export interface DetectorProvider { detect(input:{imageDataUrl:string}):Promise<NormalizedSelection[]>; }
export class DemoDetectorProvider implements DetectorProvider { async detect(){ const x=.41,y=.43,w=.18,h=.14; const points=[]; for(let i=0;i<16;i++){const a=(Math.PI*2*i)/16; points.push({x:x+w/2+Math.cos(a)*w/2,y:y+h/2+Math.sin(a)*h/2});} return [{x,y,width:w,height:h,polygon:points}]; } }
export class DemoMaskProvider implements MaskProvider { async segment(input:{imageDataUrl:string;selection:NormalizedSelection}){ // The local fallback preserves real camera pixels; the polygon clip in the UI supplies the visible cutout boundary.
  return {bounds:input.selection,maskDataUrl:input.imageDataUrl};
} }

/** Deterministic fallback keeps the local demo usable without API keys. */
export class DemoVlmProvider implements VlmProvider {
  async identify(): Promise<ProductCandidate[]> {
    return [{ name: 'Nike Air Max 97', brand: 'Nike', category: '운동화', confidence: 0.82,
      imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&q=80' }];
  }
}

export class DemoSearchProvider implements SearchProvider {
  async search(query: string): Promise<PriceOffer[]> {
    const now = new Date().toISOString();
    const encoded = encodeURIComponent(query);
    return [
      { source: '네이버 쇼핑', title: `${query} 새상품`, price: 129000, currency: 'KRW', condition: 'new', availability:'in_stock', confidence:.88, url: `https://search.shopping.naver.com/search/all?query=${encoded}`, checkedAt: now },
      { source: '다나와', title: `${query} 가격비교`, price: 139000, currency: 'KRW', condition: 'new', availability:'in_stock', confidence:.84, url: `https://search.danawa.com/dsearch.php?query=${encoded}`, checkedAt: now },
      { source: '중고마켓', title: `${query} 중고`, price: 89000, currency: 'KRW', condition: 'used', availability:'unknown', confidence:.72, url: `https://search.naver.com/search.naver?query=${encoded}+중고`, checkedAt: now }
    ];
  }
}

export interface AnalyzeInput {
  imageDataUrl: string;
  selection: NormalizedSelection;
  locale?: string;
  vlm?: VlmProvider;
  search?: SearchProvider;
  mask?: MaskProvider;
  displaySelection?: NormalizedSelection;
}

export async function analyzeObject(input: AnalyzeInput): Promise<ProductInsight> {
  const vlm = input.vlm ?? new DemoVlmProvider();
  const search = input.search ?? new DemoSearchProvider();
  const mask = input.mask ?? new DemoMaskProvider();
  const candidates = await vlm.identify({ imageDataUrl: input.imageDataUrl, selection: input.selection });
  const segmentation = await mask.segment({ imageDataUrl: input.imageDataUrl, selection: input.selection });
  const candidate = candidates[0] ?? { name: '알 수 없는 물체', confidence: 0.2 };
  const query = (candidate.queries?.[0] || [candidate.brand, candidate.model, candidate.name].filter(Boolean).join(' '));
  const offers = await search.search(query, { locale: input.locale ?? 'ko-KR', imageDataUrl: input.imageDataUrl });
  const deduped = normalizeOffers(offers, input.locale ?? 'ko-KR');
  const newPrices = deduped.filter((o) => o.condition === 'new' && o.availability !== 'out_of_stock').map((o) => o.normalizedPrice ?? o.price);
  const usedPrices = deduped.filter((o) => o.condition === 'used').map((o) => o.normalizedPrice ?? o.price);
  const priceSummary = summarizePrices(newPrices, deduped.filter((o) => o.condition === 'new').map((o) => o.confidence));
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`, candidate, offers:deduped,
    cutoutDataUrl: segmentation.maskDataUrl,
    cutoutBounds: input.displaySelection ? { x: input.displaySelection.x + segmentation.bounds.x * input.displaySelection.width, y: input.displaySelection.y + segmentation.bounds.y * input.displaySelection.height, width: segmentation.bounds.width * input.displaySelection.width, height: segmentation.bounds.height * input.displaySelection.height } : segmentation.bounds,
    cutoutPolygon: input.selection.polygon,
    lowestNew: newPrices.length ? Math.min(...newPrices) : undefined,
    usedRange: usedPrices.length ? { min: Math.min(...usedPrices), max: Math.max(...usedPrices) } : undefined,
    priceSummary,
    confidence: candidate.confidence, checkedAt: new Date().toISOString(),
    anchor: { x: Math.min(0.96, (input.displaySelection ?? input.selection).x + (input.displaySelection ?? input.selection).width + 0.02), y: (input.displaySelection ?? input.selection).y + (input.displaySelection ?? input.selection).height / 2 },
    displaySelection: input.displaySelection ?? input.selection,
    currency: deduped[0]?.currency
  };
}

const FX_TO_KRW: Record<string, number> = { KRW: 1, USD: 1380, JPY: 9.2, EUR: 1490 };

export function normalizeOffers(offers: PriceOffer[], _locale = 'ko-KR'): PriceOffer[] {
  const valid = offers.filter((offer) => Boolean(offer.url && offer.source && offer.checkedAt && offer.currency && offer.condition && Number.isFinite(offer.price) && offer.price > 0 && Number.isFinite(offer.confidence) && offer.confidence >= 0 && offer.confidence <= 1 && FX_TO_KRW[offer.currency]))
    .map((offer) => ({ ...offer, normalizedPrice: Math.round((offer.price + (offer.shippingIncluded === false ? (offer.shipping ?? 0) : 0)) * FX_TO_KRW[offer.currency]) }));
  const byUrl = Array.from(new Map(valid.map((offer) => [offer.url, offer])).values());
  if (byUrl.length < 4) return byUrl;
  const prices = byUrl.map((offer) => offer.normalizedPrice ?? offer.price).sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)];
  return byUrl.filter((offer) => (offer.normalizedPrice ?? offer.price) <= median * 5 && (offer.normalizedPrice ?? offer.price) >= median / 5);
}

function summarizePrices(prices: number[], confidences: number[]) {
  if (!prices.length) return undefined;
  const sorted = [...prices].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return { lowest: sorted[0], median, range: { min: sorted[0], max: sorted[sorted.length - 1] }, currency: 'KRW' as const, confidence: confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0 };
}
