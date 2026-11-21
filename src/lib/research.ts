export interface ResearchContext {
  imageDataUrl: string;
  cutoutDataUrl?: string;
  selection: { x: number; y: number; width: number; height: number; polygon?: Array<{ x: number; y: number }> };
  locale: string;
}

export interface ResearchOffer {
  title: string;
  url: string;
  merchant: string;
  price: number;
  currency: string;
  condition: 'new' | 'used' | 'unknown';
  shipping?: number;
  availability?: string;
  checkedAt: string;
  evidence: string[];
  confidence: number;
}

export interface ResearchResult {
  candidates: Array<{ name: string; brand?: string; model?: string; category?: string; confidence: number }>;
  offers: ResearchOffer[];
  lowest?: ResearchOffer;
  highest?: ResearchOffer;
  representative?: { min: number; max: number; median: number; currency: string };
  startedAt: string;
  completedAt: string;
  tools: string[];
}

export interface ResearchAgentProvider {
  research(input: ResearchContext): Promise<ResearchResult>;
}

export function validateResearchContext(input: Partial<ResearchContext>): input is ResearchContext {
  return typeof input.imageDataUrl === 'string' && input.imageDataUrl.startsWith('data:image/') && typeof input.selection === 'object' && input.selection !== null && [input.selection.x, input.selection.y, input.selection.width, input.selection.height].every((value) => typeof value === 'number' && value >= 0 && value <= 1) && typeof input.locale === 'string' && input.locale.length > 0;
}

export function summarizeResearchOffers(offers: ResearchOffer[]) {
  const valid = offers.filter((offer) => Number.isFinite(offer.price) && offer.price > 0 && offer.url && offer.evidence?.length);
  if (!valid.length) return {};
  const sorted = [...valid].sort((a, b) => a.price - b.price);
  return { lowest: sorted[0], highest: sorted[sorted.length - 1], representative: { min: sorted[0].price, max: sorted[sorted.length - 1].price, median: sorted[Math.floor(sorted.length / 2)].price, currency: sorted[Math.floor(sorted.length / 2)].currency } };
}
