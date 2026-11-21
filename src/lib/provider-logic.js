export function parseSearxngOffer(item, checkedAt) {
  if (!item?.url || !item?.title) return null;
  const text = `${item.title} ${item.content || ''}`;
  const match = text.match(/(?:₩|KRW|원)\s*([\d,]+)|([\d,]+)\s*(?:원|KRW)/i);
  const price = Number((match?.[1] || match?.[2] || '').replace(/,/g, ''));
  if (!Number.isFinite(price) || price <= 0) return null;
  return { source: new URL(item.url).hostname, title: item.title, price, currency: 'KRW', condition: /중고|used|second[- ]hand/i.test(text) ? 'used' : 'new', availability: 'unknown', url: item.url, checkedAt, confidence: .55 };
}
