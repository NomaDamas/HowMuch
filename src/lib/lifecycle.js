export function visibilityAfterMisses(previous, misses, threshold = 2) {
  return misses >= threshold ? false : previous;
}

export function shouldReacquire(previousKey, nextKey) {
  return previousKey !== nextKey;
}

export function privacyDefaults() {
  return { retainFrames: false, personMode: false, anonymousTelemetry: true };
}
