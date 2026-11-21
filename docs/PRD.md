# HowMuch Web MVP PRD

## Product promise

HowMuch is a mobile-first camera web experience that identifies a selected object, produces a cutout, finds evidence-backed market prices, and places a translucent card beside the object in the live camera view. The web MVP is the acceptance gate for native iOS and Android clients.

## Interaction contract

- **Automatic mode:** a local or configured detector proposes an object. The client waits for a stable target, submits one representative frame, and suppresses duplicate requests.
- **Touch/draw mode:** the user taps a nearby candidate or draws a freeform polygon. The polygon is the selection contract; a persistent rectangular bounding box is not the primary UI.
- **Overlay:** the cutout and card use normalized camera coordinates. The card flips sides at an edge, follows the target while visible, hides after a loss grace period, and returns when the target is reacquired.
- **Toggle:** Automatic and Touch/draw are visible controls and persist for the session.

## Identification and search

OCR is excluded. A commercial VLM returns structured category, brand, model, attributes, candidates, search queries, and confidence. Image and shopping search are separate provider adapters. The approved adapter stack is official or affiliate APIs first, then SearXNG, Firecrawl, Crawl4AI, Playwright, and Browser Use only where the target permits access. A price is shown with source URL, merchant, condition, currency, checked time, availability, and confidence.

Prices are normalized to the selected locale currency, include shipping when it is explicitly separate, deduplicate by URL, remove extreme outliers, and expose lowest verified price plus median/range when enough evidence exists. A missing result is shown as missing; the system never invents a price.

## Privacy and people

Frames are ephemeral by default. Anonymous telemetry contains mode, latency, outcome, category, and source clicks, never raw frames by default. Person mode is opt-in and playful: style metadata or a fictional game score only. It does not infer attractiveness, body value, body measurements, age, health, race, or other sensitive traits.

## Delivery gates

1. Local web demo with camera fallback, both selection modes, cutout, anchored card, and deterministic mock providers.
2. One commercial VLM and one permitted shopping/search adapter with evidence-backed prices.
3. Produce, apparel, electronics, and an unbranded-object pilot.
4. Hardening: tracking lifecycle, retries, timeouts, rate limits, privacy, accessibility, and mobile Safari/Chrome smoke tests.
5. Native ARKit/ARCore work begins only after the web gate passes.

## Definition of done

The selected object is visibly cut out and tracked; the card is beside it and disappears/reappears with visibility; automatic and touch/draw modes work; every displayed lowest price has timestamped evidence; provider failures and no-result states are explicit; tests cover schemas, normalization, transforms, lifecycle, and privacy defaults; isolated GPT-6.2 Astra High review returns `PASS` before merge.
