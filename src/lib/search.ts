import type { NormalizedSelection, PriceOffer, ProductCandidate, ProductInsight } from './types';

export interface VlmProvider {
  identify(input: { imageDataUrl: string; selection: NormalizedSelection }): Promise<ProductCandidate[]>;
}

export interface SearchProvider {
  search(query: string, opts?: { locale?: string; imageDataUrl?: string }): Promise<PriceOffer[]>;
}
export interface MaskProvider { segment(input:{imageDataUrl:string;selection:NormalizedSelection}):Promise<{maskDataUrl?:string;bounds:NormalizedSelection}>; }
export class DemoMaskProvider implements MaskProvider { async segment(input:{imageDataUrl:string;selection:NormalizedSelection}){ const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 70"><path d="M4 46 Q18 16 48 24 Q72 27 96 44 L88 58 L12 59Z" fill="rgba(217,255,98,.22)" stroke="#d9ff62" stroke-width="2"/></svg>`; return {bounds:input.selection,maskDataUrl:`data:image/svg+xml,${encodeURIComponent(svg)}`}; } }

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
  const offers = await search.search([candidate.brand, candidate.name].filter(Boolean).join(' '), { locale: input.locale ?? 'ko-KR', imageDataUrl: input.imageDataUrl });
  const deduped = normalizeOffers(offers);
  const newPrices = deduped.filter((o) => o.condition === 'new' && o.availability !== 'out_of_stock').map((o) => o.price);
  const usedPrices = deduped.filter((o) => o.condition === 'used').map((o) => o.price);
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`, candidate, offers:deduped,
    cutoutDataUrl: segmentation.maskDataUrl,
    cutoutBounds: input.displaySelection ? { x: input.displaySelection.x + segmentation.bounds.x * input.displaySelection.width, y: input.displaySelection.y + segmentation.bounds.y * input.displaySelection.height, width: segmentation.bounds.width * input.displaySelection.width, height: segmentation.bounds.height * input.displaySelection.height } : segmentation.bounds,
    lowestNew: newPrices.length ? Math.min(...newPrices) : undefined,
    usedRange: usedPrices.length ? { min: Math.min(...usedPrices), max: Math.max(...usedPrices) } : undefined,
    confidence: candidate.confidence, checkedAt: new Date().toISOString(),
    anchor: { x: Math.min(0.96, (input.displaySelection ?? input.selection).x + (input.displaySelection ?? input.selection).width + 0.02), y: (input.displaySelection ?? input.selection).y + (input.displaySelection ?? input.selection).height / 2 },
    displaySelection: input.displaySelection ?? input.selection,
    currency: deduped[0]?.currency
  };
}

export function normalizeOffers(offers: PriceOffer[]): PriceOffer[] {
  const valid = offers.filter((offer) => Boolean(offer.url && offer.source && offer.checkedAt && offer.currency && offer.condition && Number.isFinite(offer.price) && offer.price > 0 && Number.isFinite(offer.confidence) && offer.confidence >= 0 && offer.confidence <= 1));
  const byUrl = Array.from(new Map(valid.map((offer) => [offer.url, offer])).values());
  if (byUrl.length < 4) return byUrl;
  const prices = byUrl.map((offer) => offer.price).sort((a, b) => a - b);
  const median = prices[Math.floor(prices.length / 2)];
  return byUrl.filter((offer) => offer.price <= median * 5 && offer.price >= median / 5);
}
