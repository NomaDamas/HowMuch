
# HowMuch delivery roadmap

## Product outcome

HowMuch opens a camera-first web experience. A user points at a product, food, clothing, or other object; the system identifies the selected object, creates a cutout, finds current market prices, and anchors a translucent information card beside the object in the live camera view. The card follows the object while tracked and disappears when the object leaves view. Automatic and touch/draw selection are toggles. The web MVP is the validation gate before native iOS/Android work.

## Guardrails

- Every price has a source URL, timestamp, currency, condition, and confidence.
- VLM identifies and proposes queries; it never invents a price. Prices require retrieval evidence.
- Search providers are adapters. Use official/permitted APIs or providers; do not bypass anti-bot controls.
- Camera frames are ephemeral by default. Do not retain faces/raw frames without opt-in.
- Person mode is playful style metadata only; never infer attractiveness, body value, age, health, race, or other sensitive traits.
- OCR is intentionally excluded from the product pipeline. Visible text may be returned as an optional field by the commercial VLM, but no OCR engine is deployed.

## Approved open-source search building blocks

The MVP uses proven, maintained projects as adapters rather than inventing a crawler. Repository popularity is a screening signal (checked before implementation); licenses and each provider's terms still govern production use.

- **Browser Use** (`browser-use/browser-use`, 50k+ GitHub stars): browser-agent control for a permitted, user-visible fallback flow. It is never used to bypass bot protection.
- **Crawl4AI** (`unclecode/crawl4ai`, 50k+): structured extraction for pages that permit crawling; output is evidence, not an authority.
- **Firecrawl** (`mendableai/firecrawl`, 20k+): hosted/self-hosted search and page extraction adapter when its endpoint and target terms permit use.
- **SearXNG** (`searxng/searxng`, 10k+): self-hosted metasearch adapter, including image/shopping-capable engines configured by deployment.
- **Playwright** (`microsoft/playwright`, 70k+): deterministic browser automation for screenshot evidence in approved flows and local end-to-end tests.

The search orchestration order is: official/affiliate API → SearXNG or Firecrawl structured result → Crawl4AI extraction → Browser Use/Playwright screenshot evidence with the VLM. Every adapter returns source URL, timestamp, merchant, condition and price; no result is shown as a verified lowest price without evidence.

## Architecture

```text
Camera (Web/PWA) -> local tracker -> automatic or touch/draw selection
                   -> overlay renderer (cutout + anchored 3D-like card)
                         |
Analyze API -> segmentation adapter + VLM adapter + search orchestrator
           -> price normalizer/evidence + cache + anonymous analytics
```

## Epics and sub-issues

### E1 Camera and selection UX

- **1.1 Camera permission/preview:** loading, denial, orientation, low-light states; recover after permission changes.
- **1.2 Mode toggle:** Auto and Touch/draw are visible, accessible, and session-persistent.
- **1.3 Touch selection:** tap nearest detected object; short-lived focus ring only, never a persistent rectangle.
- **1.4 Draw selection:** freeform finger/stylus loop, path simplification, clear/retry on narrow screens.
- **1.5 Stable capture:** debounce motion and choose a sharp representative frame; suppress duplicates and show latency.

### E2 Segmentation and tracking

- **2.1 Segmentation adapter:** provider interface returning mask PNG, polygon, and normalized bounds.
- **2.2 Cutout renderer:** feathered transparent mask; irregular edges must not show a hard rectangle.
- **2.3 Local tracking:** follow center/mask between server responses at device-friendly frame rate.
- **2.4 Visibility lifecycle:** hide after occlusion/loss timeout; restore when the same object reappears.
- **2.5 Spatial card:** depth scale, perspective tilt, shadow, leader line; card stays beside the cutout.

### E3 VLM identification

- **3.1 Strict VLM schema:** category, brand, candidates, visible text, condition cues, and queries; reject malformed output.
- **3.2 Candidate reconciliation:** merge VLM and image-search candidates; say “possible match” when uncertain.
- **3.3 Generic coverage:** specialist prompts for produce, apparel, electronics, collectibles plus generic fallback.
- **3.4 Provider configuration:** env-based credentials/model selection and a no-credential mock provider.

### E4 Search and market prices

- **4.1 Search adapter contract:** normalized title, URL, merchant, price, currency, condition, availability, fetched time.
- **4.2 Query planner:** 3–5 localized queries including model, size/color, and new/used intent.
- **4.3 Evidence extraction:** structured results first; browser/screenshot + VLM only where permitted; preserve evidence.
- **4.4 Normalization:** currency conversion, shipping handling, new/used separation, duplicate/outlier removal.
- **4.5 Price result:** lowest verified price, representative range/median, result count, confidence, and explicit no-result state.
- **4.6 Provider routing:** configurable Google/Naver/Amazon/Coupang/Danawa or permitted alternatives by locale/category.
- **4.7 Cache/freshness:** TTL cache, checked-at display, and request coalescing.

### E5 Overlay product UX

- **5.1 Progressive states:** identifying, checking prices, final evidence-backed card.
- **5.2 Placement:** beside object, edge-aware side flipping, and no default occlusion.
- **5.3 Detail sheet:** sources, breakdown, confidence, retry, and better-view action.
- **5.4 Multi-object:** one active card in MVP; queue detections and allow tap-to-switch.
- **5.5 Person mode:** explicit opt-in, style/card output only, safety copy, and data minimization.

### E6 API, observability, privacy

- **6.1 Analyze endpoint:** validate image type/size, selection geometry, locale/mode, typed errors.
- **6.2 Anonymous telemetry:** mode, latency, success, category, confidence, source clicks; never raw frames by default.
- **6.3 Cost controls:** rate limits, model fallback, timeouts, and per-session budgets.
- **6.4 Privacy:** consent, delete-session action, retention settings, and provider disclosure.
- **6.5 Accessibility:** reduced motion, contrast, screen-reader labels, and touch targets.

### E7 Native transition after web gate

- **7.1 iOS:** SwiftUI + AVFoundation + Vision/Core ML; preserve API/overlay contracts.
- **7.2 Android:** Kotlin/Compose + CameraX + ML Kit/MediaPipe; preserve contracts.
- **7.3 Native AR:** ARKit/ARCore anchors and offline segmentation fallback.
- **7.4 Store readiness:** permission copy, privacy labels, crash reporting, and performance budgets.

## Delivery gates

1. Local web demo: camera, both modes, mock VLM/search, cutout, anchored card, hide/restore tracking.
2. Real provider pilot: one commercial VLM and one permitted shopping/web adapter with evidence-backed prices.
3. Category pilot: produce, apparel, electronics, and one unbranded fixture pass.
4. Hardening: latency, rate limits, accessibility, privacy, Safari/Chrome mobile smoke tests.
5. Native build only after web acceptance.

## Definition of done

The selected object is tracked in the camera view; its cutout and card disappear when it leaves view and return when it reappears; every shown lowest price has a timestamped source. Tests cover schemas, normalization, provider failures, placement, and privacy defaults. Manual smoke tests cover mobile Safari and Chrome.
