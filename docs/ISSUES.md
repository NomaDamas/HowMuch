# Issue and sub-issue register

Use these issue keys in GitHub. Each parent issue must link its sub-issues and may merge only after every acceptance check passes.

## HM-1 Camera and selection

- HM-1.1 Camera permission, orientation, and denial recovery
- HM-1.2 Auto / Touch-draw toggle and session persistence
- HM-1.3 Tap-to-select without persistent bounding-box chrome
- HM-1.4 Freeform draw path, simplify, clear, and retry
- HM-1.5 Stable-frame capture and duplicate suppression

**Acceptance:** mobile Safari and Chrome can open the camera; the user can switch modes, select one object, retry, and see a clear in-progress state.

## HM-2 Segmentation and spatial tracking

- HM-2.1 Segmentation provider interface and mock mask
- HM-2.2 Feathered transparent cutout renderer
- HM-2.3 Device-side object tracking between responses
- HM-2.4 Occlusion/loss timeout and reacquisition
- HM-2.5 Edge-aware 3D-like HUD placement and perspective
- HM-2.6 Segmentation-first dashed preview before identity; never a full-screen panel.
- HM-2.7 Multi-object registry with stable track IDs, up to four independent automatic research jobs/cards, tap-to-switch, and an active-card/cost cap. Manual mode researches only the drawn subject.
- HM-2.8 Acquire/lost hysteresis to prevent flicker during brief occlusion.
- HM-2.9 Camera transform tests for cover, rotation, mirror, and safe areas.

**Acceptance:** the card follows the object, never relies on a persistent rectangle, disappears when the object leaves view, and returns when reacquired.

## HM-3 Commercial VLM identification

- HM-3.1 Strict schema and malformed-response retry
- HM-3.2 Cutout plus surrounding-scene prompt
- HM-3.3 Candidate reconciliation and uncertainty copy
- HM-3.4 Generic, produce, apparel, electronics prompt fixtures

**Acceptance:** no OCR dependency; VLM returns candidate identity and search queries with confidence and explicit unknown states.

## HM-4 Agentic visual and text research

- HM-4.1 `visual_search` tool contract
- HM-4.2 `text_search` tool contract
- HM-4.3 Concurrent visual/text research run
- HM-4.4 Browser Use/Playwright evidence adapter
- HM-4.5 Crawl4AI/Firecrawl/SearXNG permitted extraction adapter
- HM-4.6 Evidence schema and source timestamp
- HM-4.7 Research state machine with concurrent visual/text branches and stale-run cancellation.
- HM-4.8 AI evidence reviewer binding each offer to URL/page evidence, merchant, condition, availability, currency, and timestamp.
- HM-4.9 Reject unsupported, login-only, snippet-only, stale, or title-mismatched offers.
- HM-4.10 Provider fallback prohibition: failures return typed `research_unavailable`; no silent search API substitution.
- HM-4.11 Visual-search provenance without storing raw frames by default.

**Acceptance:** every shown offer has source evidence; tool failure yields a visible no-result state; no search API fallback is silently introduced.

## HM-5 Price normalization

- HM-5.1 Currency, shipping, and condition normalization
- HM-5.2 Duplicate URL and outlier removal
- HM-5.3 Lowest verified price plus median/range
- HM-5.4 TTL cache, rate limits, and request coalescing

**Acceptance:** output distinguishes new/used/refurbished and exposes checked time, confidence, source count, and no-result states.

## HM-6 Privacy and playful person mode

- HM-6.1 Ephemeral frame processing and retention config
- HM-6.2 Anonymous event schema and delete-session action
- HM-6.3 Explicit opt-in person mode
- HM-6.4 Style/game card with sensitive-inference blocks

**Acceptance:** raw frames are not stored by default; person mode never emits attractiveness, body value, age, health, race, or body measurement claims.

## HM-7 Web release gate

- HM-7.1 Local demo script and fixture dataset
- HM-7.2 Provider terms checklist and attribution UI
- HM-7.3 Mobile Safari/Chrome smoke test
- HM-7.4 Accessibility and reduced-motion pass
- HM-7.5 Isolated GPT-6.2 Astra High review and merge gate
- HM-7.6 Multi-object enter/leave/occlusion fixture.
- HM-7.7 Segmentation-first dashed-preview visual fixture.
- HM-7.8 Missing URL/stale/mismatch/unavailable/provider-error evidence fixtures.
- HM-7.9 Short-lived QR/deep-link pairing to the same research job.
- HM-7.10 Versioned TypeScript/Python SDK and OpenAPI/MCP contract fixtures.

**Acceptance:** build, tests, smoke test, provider checklist, and isolated review pass before merge.

**PR checklist:** no persistent bounding box; multi-object lifecycle tests; dashed preview before identity; evidence for every price; no silent fallback; AGPL source link and provider terms; QR/REST/MCP/SDK compatibility; tests, build, mobile smoke, and isolated GPT-6.2 Astra High review pass.

## HM-8 Native app after web acceptance

- HM-8.1 iOS AVFoundation/SwiftUI shell
- HM-8.2 Android CameraX/Compose shell
- HM-8.3 ARKit/ARCore anchors and offline fallback
- HM-8.4 Store privacy, permissions, crash and performance readiness
- HM-8.5 Native multi-object tracking parity
- HM-8.6 QR handoff from native camera to research job
- HM-8.7 Public TypeScript/Python SDK release and migration notes

**Acceptance:** native clients consume the same API contracts and preserve the web overlay behavior.
