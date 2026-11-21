export type SelectionMode = 'auto' | 'draw';

export interface NormalizedSelection {
  x: number;
  y: number;
  width: number;
  height: number;
  polygon?: Array<{ x: number; y: number }>;
}

export interface ProductCandidate {
  name: string;
  brand?: string;
  category?: string;
  confidence: number;
  imageUrl?: string;
}

export interface PriceOffer {
  source: string;
  title: string;
  price: number;
  currency: 'KRW' | 'USD' | 'JPY' | 'EUR';
  condition: 'new' | 'used' | 'unknown';
  url: string;
  checkedAt: string;
  confidence: number;
  availability?: 'in_stock' | 'out_of_stock' | 'unknown';
}

export interface ProductInsight {
  id: string;
  candidate: ProductCandidate;
  cutoutDataUrl?: string;
  cutoutBounds?: NormalizedSelection;
  anchor: { x: number; y: number };
  offers: PriceOffer[];
  lowestNew?: number;
  usedRange?: { min: number; max: number };
  confidence: number;
  checkedAt: string;
  note?: string;
}
