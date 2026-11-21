# HowMuch technical architecture

HowMuch is a camera-first product and price lookup experience. The browser MVP deliberately uses a screen-space overlay that behaves like AR: a selected object is cut out, and its card is anchored beside the object while the camera is moving. Native ARKit/ARCore world anchors are a later adapter, not a prerequisite for validating the experience.

## Runtime pipeline

```text
Camera stream -> local selection/tracking -> representative frame
             -> identify provider (VLM + image search)
             -> price provider fan-out -> normalized offers
             -> mask/cutout provider -> overlay compositor
```

The UI has two modes:

- **Auto:** a lightweight local detector proposes a target. The client waits for a stable target (several frames with a similar centroid/size), then submits one frame. The tracker keeps the card moving locally; it does not call the network every frame.
- **Draw:** the user taps or draws around a target. The crop and normalized polygon are sent once. This is the precision path for scenes with several objects.

The overlay uses normalized coordinates (`0..1`) from the camera image. The client maps them to the preview's `object-fit: cover` transform, clamps the card to safe insets, and flips the card to the opposite side when it would cover the target. A tracking loss hides the card after a short grace period; reacquisition shows it again without a new search when the object fingerprint is cached.

## Provider boundaries

Provider interfaces keep credentials and vendor-specific behavior out of the UI:

- `VisionProvider.identify(image, selection)` returns candidate names, attributes, confidence, and search queries.
- `MaskProvider.segment(image, selection)` returns a transparent PNG/mask and the refined normalized bounds.
- `ResearchAgentProvider.research(context)` starts visual and VLM-generated text research concurrently through permitted browser tools and returns evidence-backed offers. A search provider is an internal adapter, not a user-visible fallback path.
- `PriceAggregator.normalize(offers)` deduplicates listings, converts currency, rejects implausible values, and produces `lowest`, `range`, and a timestamp.

The default development provider is deterministic mock data so localhost works without API keys. Production agents can use Browser Use, Playwright, MCP browser tools, or an approved search provider selected by environment variables. Do not bypass authentication, paywalls, robots controls, or marketplace terms. Preserve rendered evidence, source URLs, merchant, availability, and checked-at timestamps.

## Latency and caching

The first response is staged: target acknowledgement immediately, identity result next, then price aggregation and mask refinement. Requests are keyed by a perceptual image fingerprint plus locale/category. Cache identity for minutes and prices for a shorter TTL. Abort stale requests when the target changes.

## Privacy and safety

Camera frames are processed in memory by default. Persist only anonymous event metadata unless the user explicitly opts into diagnostics. Person mode is a playful, non-sensitive character card; do not infer attractiveness, body measurements, age, health, or economic value.

## Native migration

When web validation is complete, preserve the provider API and replace only the camera/tracking layer:

- iOS: AVFoundation + Vision/Core ML; ARKit for world anchors when needed.
- Android: CameraX + ML Kit/MediaPipe; ARCore for world anchors.

The shared response contract (`bbox`, optional polygon/mask, identity, offers, confidence, timestamp) lets the native clients use the same backend and price logic.

