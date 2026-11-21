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

**Acceptance:** build, tests, smoke test, provider checklist, and isolated review pass before merge.

## HM-8 Native app after web acceptance

- HM-8.1 iOS AVFoundation/SwiftUI shell
- HM-8.2 Android CameraX/Compose shell
- HM-8.3 ARKit/ARCore anchors and offline fallback
- HM-8.4 Store privacy, permissions, crash and performance readiness

**Acceptance:** native clients consume the same API contracts and preserve the web overlay behavior.
