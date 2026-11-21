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
  const valid = offers.filter((offer) => {
    if (!offer || typeof offer.title !== 'string' || !offer.title.trim() || typeof offer.url !== 'string' || !/^https?:\/\//i.test(offer.url)) return false;
    if (typeof offer.merchant !== 'string' || !offer.merchant.trim() || !Number.isFinite(offer.price) || offer.price <= 0) return false;
    if (!['KRW', 'USD', 'JPY', 'EUR'].includes(offer.currency) || !['new', 'used', 'unknown'].includes(offer.condition)) return false;
    if (typeof offer.checkedAt !== 'string' || Number.isNaN(Date.parse(offer.checkedAt))) return false;
    if (!Array.isArray(offer.evidence) || offer.evidence.length === 0 || offer.evidence.some((item) => typeof item !== 'string' || !item.trim())) return false;
    return Number.isFinite(offer.confidence) && offer.confidence >= 0 && offer.confidence <= 1;
  });
  if (!valid.length) return {};
  const currencies = new Set(valid.map((offer) => offer.currency));
  if (currencies.size !== 1) return {};
  const sorted = [...valid].sort((a, b) => a.price - b.price);
  return { lowest: sorted[0], highest: sorted[sorted.length - 1], representative: { min: sorted[0].price, max: sorted[sorted.length - 1].price, median: sorted[Math.floor(sorted.length / 2)].price, currency: sorted[0].currency } };
}
