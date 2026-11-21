const ALLOWED_KEYS = new Set(['mode', 'latencyMs', 'outcome', 'category', 'confidence', 'sourceCount']);

export function recordAnonymousEvent(event, sink = () => {}) {
  const safe = Object.fromEntries(Object.entries(event || {}).filter(([key, value]) => ALLOWED_KEYS.has(key) && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')));
  sink(safe);
  return safe;
}
