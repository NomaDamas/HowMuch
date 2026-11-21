export function clamp01(value) { return Math.max(0, Math.min(1, value)); }
export function normalizePolygon(points) {
  if (!points.length) return { x: 0, y: 0, width: 0, height: 0, polygon: [] };
  const xs = points.map((point) => clamp01(point.x));
  const ys = points.map((point) => clamp01(point.y));
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), polygon: points.map((point) => ({ x: clamp01(point.x), y: clamp01(point.y) })) };
}
export function overlayPlacement(anchor, cardSize = { width: 190, height: 150 }) {
  const side = anchor.x > 0.62 ? 'left' : 'right';
  return { side, x: side === 'right' ? clamp01(anchor.x + 0.08) : clamp01(anchor.x - 0.08), y: clamp01(anchor.y), cardSize };
}
