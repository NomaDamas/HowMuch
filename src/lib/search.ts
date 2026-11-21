import type { NormalizedSelection, PriceOffer, ProductCandidate, ProductInsight } from './types';

export interface VlmProvider {
  identify(input: { imageDataUrl: string; selection: NormalizedSelection }): Promise<ProductCandidate[]>;
}

export interface SearchProvider {
  search(query: string, opts?: { locale?: string }): Promise<PriceOffer[]>;
}

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
      { source: '네이버 쇼핑', title: `${query} 새상품`, price: 129000, currency: 'KRW', condition: 'new', url: `https://search.shopping.naver.com/search/all?query=${encoded}`, checkedAt: now },
      { source: '다나와', title: `${query} 가격비교`, price: 139000, currency: 'KRW', condition: 'new', url: `https://search.danawa.com/dsearch.php?query=${encoded}`, checkedAt: now },
      { source: '중고마켓', title: `${query} 중고`, price: 89000, currency: 'KRW', condition: 'used', url: `https://search.naver.com/search.naver?query=${encoded}+중고`, checkedAt: now }
    ];
  }
}

export interface AnalyzeInput {
  imageDataUrl: string;
  selection: NormalizedSelection;
  locale?: string;
  vlm?: VlmProvider;
  search?: SearchProvider;
}

export async function analyzeObject(input: AnalyzeInput): Promise<ProductInsight> {
  const vlm = input.vlm ?? new DemoVlmProvider();
  const search = input.search ?? new DemoSearchProvider();
  const candidates = await vlm.identify({ imageDataUrl: input.imageDataUrl, selection: input.selection });
  const candidate = candidates[0] ?? { name: '알 수 없는 물체', confidence: 0.2 };
  const offers = await search.search([candidate.brand, candidate.name].filter(Boolean).join(' '), { locale: input.locale ?? 'ko-KR' });
  const newPrices = offers.filter((o) => o.condition === 'new').map((o) => o.price);
  const usedPrices = offers.filter((o) => o.condition === 'used').map((o) => o.price);
  return {
    id: crypto.randomUUID(), candidate, offers,
    lowestNew: newPrices.length ? Math.min(...newPrices) : undefined,
    usedRange: usedPrices.length ? { min: Math.min(...usedPrices), max: Math.max(...usedPrices) } : undefined,
    confidence: candidate.confidence, checkedAt: new Date().toISOString(),
    anchor: { x: Math.min(0.96, input.selection.x + input.selection.width + 0.02), y: input.selection.y + input.selection.height / 2 }
  };
}
