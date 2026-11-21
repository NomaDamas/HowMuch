const ALLOWED_KEYS = new Set(['mode', 'latencyMs', 'outcome', 'category', 'confidence', 'sourceCount', 'sourceClicks']);
export const telemetryEvents = [];

export function recordAnonymousEvent(event, sink = (safe) => telemetryEvents.push(safe)) {
  const safe = Object.fromEntries(Object.entries(event || {}).filter(([key, value]) => ALLOWED_KEYS.has(key) && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')));
  sink(safe);
  return safe;
}
