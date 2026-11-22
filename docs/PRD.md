# HowMuch Web MVP PRD

## Product promise

HowMuch is an AGPL multimodal agent product. A user points a phone camera at a specific product or object for 3–5 seconds, long-presses it, or draws around it. HowMuch segments that selection, sends the cutout and surrounding scene to a commercial VLM-led research agent, and renders evidence-backed market prices in a translucent HUD beside the object.

## Interaction contract

- **Automatic mode:** the client waits 3–5 seconds for stable foreground masks, segments up to four subjects, and starts one independently bounded research job per stable mask. The user does not need to tap each automatic subject. Each subject receives its own card; budgets and concurrency limits prevent overload.
- **Touch/draw mode:** the user taps a nearby candidate or draws a freeform polygon. The polygon is the selection contract; a persistent rectangular bounding box is not the primary UI.
- **Overlay:** the cutout and card use normalized camera coordinates. A dashed segmentation contour appears before identity/price; no persistent rectangle or full-screen panel is allowed. The card flips sides at an edge, follows the target while visible, hides after a loss grace period, and returns when reacquired.
- **Multi-object:** automatic tracks have stable IDs and hysteresis, with up to four independent auto-research cards. In Touch/draw mode only the manually selected subject is researched. Cards hide and return with their own visibility lifecycle.
- **Toggle:** Automatic and Touch/draw are visible controls and persist for the session.

## Identification and search

OCR is excluded. A commercial VLM returns structured category, brand, model, attributes, candidates, visual context, search queries, and confidence. One multimodal research run receives both the cutout image and surrounding scene, then calls visual search and VLM-generated text search concurrently through agentic web tools. Search APIs are not a fallback product path. Agent browser tools may use permitted visual-search UIs, open pages, inspect screenshots/DOM, and collect evidence. A price is shown with source URL, merchant, condition, currency, checked time, availability, and confidence.

Prices are normalized to the selected locale currency, include shipping when it is explicitly separate, deduplicate by URL, remove extreme outliers, and expose lowest verified price plus median/range when enough evidence exists. A missing result is shown as missing; the system never invents a price. Research providers are fail-closed: failure returns `research_unavailable` and never silently switches to an unapproved search API.

## Privacy and people

Frames are ephemeral by default. Anonymous telemetry contains mode, latency, outcome, category, and source clicks, never raw frames by default. Person mode is opt-in and playful: style metadata or a fictional game score only. It does not infer attractiveness, body value, body measurements, age, health, race, or other sensitive traits.

## Agent and integration contract

The core exposes `visual_search(imageContext)`, `text_search(queries, imageContext)`, `open_page(url)`, `extract_offer(page)`, and `compare_offers(offers)` as agent tools. REST/OpenAPI, MCP, SSE/WebSocket jobs, TypeScript/Python SDKs, and QR pairing use the same contracts. Browser Use or an equivalent agent runtime is a tool implementation, not a separate user flow.

Every distributed UI shows `HowMuch by NomaDamas MinXing`.

The same versioned contracts are exposed through REST/OpenAPI, MCP, SSE/WebSocket jobs, TypeScript/Python SDKs, and short-lived QR/deep-link pairing. QR tokens never contain provider secrets.

## Delivery gates

1. Local web demo with camera fallback, both selection modes, cutout, anchored card, and deterministic mock providers.
2. One commercial VLM-led agent run that concurrently performs visual and text web research with evidence-backed prices; no search API fallback.
3. Produce, apparel, electronics, and an unbranded-object pilot.
4. Hardening: tracking lifecycle, retries, timeouts, rate limits, privacy, accessibility, and mobile Safari/Chrome smoke tests.
5. Native ARKit/ARCore work begins only after the web gate passes.

## Definition of done

The selected object is visibly cut out and tracked; the card is beside it and disappears/reappears with visibility; automatic and touch/draw modes work; every displayed lowest price has timestamped evidence; provider failures and no-result states are explicit; tests cover schemas, normalization, transforms, lifecycle, and privacy defaults; provider adapters and lifecycle helpers are unit-tested before native expansion; isolated GPT-6.2 Astra High review returns `PASS` before merge.
