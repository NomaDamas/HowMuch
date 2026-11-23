# HowMuch Web MVP PRD

## Product promise

HowMuch is an AGPL multimodal agent product. A user points a phone camera at a specific product or object for 3–5 seconds, long-presses it, or draws around it. HowMuch segments that selection, sends the cutout and surrounding scene to a commercial VLM-led research agent, and renders evidence-backed market prices in a translucent HUD beside the object.

## Interaction contract

- **Automatic mode:** the client waits 3–5 seconds for stable foreground masks, segments up to four subjects, and starts one independently bounded research job per stable mask. The user does not need to tap each automatic subject. Each subject receives its own card; budgets and concurrency limits prevent overload.
- **Touch/draw mode:** the user taps a nearby candidate or draws a freeform polygon. The polygon is the selection contract; a persistent rectangular bounding box is not the primary UI.
- **Overlay:** the cutout and card use normalized camera coordinates. A dashed segmentation contour appears before identity/price; no persistent rectangle or full-screen panel is allowed. The card flips sides at an edge, follows the target while visible, hides after a loss grace period, and returns when reacquired.
- **Multi-object:** automatic tracks have stable IDs and hysteresis, with up to four independent auto-research cards. Each new gesture reserves a new job before segmentation. Up to four jobs, including pending investigations, survive later drawings, mode switches and leaving the view; × cancels one. Cards hide and return with their own visibility lifecycle.
- **Toggle:** Automatic and Touch/draw are visible controls and persist for the session.

## Identification and search

OCR is excluded. A commercial VLM returns structured category, brand, model, attributes, candidates, visual context, search queries, and confidence. One multimodal research run receives both the cutout image and surrounding scene, then calls visual search and VLM-generated text search concurrently through agentic web tools. Search APIs are not a fallback product path. Agent browser tools may use permitted visual-search UIs, open pages, inspect screenshots/DOM, and collect evidence. A price is shown with source URL, merchant, condition, currency, checked time, availability, and confidence.

Prices are normalized to the selected locale currency, include shipping when it is explicitly separate, deduplicate by URL, remove extreme outliers, and expose lowest verified price plus median/range when enough evidence exists. A missing result is shown as missing; the system never invents a price. Research providers are fail-closed: failure returns `research_unavailable` and never silently switches to an unapproved search API.

## Privacy and people

Frames are ephemeral by default. Anonymous telemetry contains mode, latency, outcome, category, and source clicks, never raw frames by default. Person mode is playful, on by default and switchable off: a fictional mood-based price only. It does not infer attractiveness, body value, body measurements, age, health, race, or other sensitive traits.

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

## Product identity and commodity behavior

HowMuch removes the manual search step for the user. A visible logo, label or barcode is useful evidence, but it is not a mandatory interaction: the VLM and visual-search agent may identify an exact model from the cutout and surrounding scene when the evidence is strong enough. If the evidence supports only “glasses”, “jacket” or another broad class, the product deliberately asks for a close-up of the label/model and shows that reason in the HUD instead of presenting a misleading exact price. This is the convenience boundary: the user points first and only supplies a label when the agent cannot establish the model.

Unpackaged fruit, vegetables, meat, fish and eggs use commodity logic rather than SKU logic. The VLM proposes only the visible commodity, cut/species, grade, region and unit. The agent searches current market pages and returns a reference quote with quantity/unit, region, observed date and source. Missing grade, weight or region produces a clearly qualified reference or `no_result`; it never becomes a fabricated per-item price. The HUD labels these as `시장 참고가` and the detail sheet explains the unit before the user compares an on-site purchase.

The camera always keeps a compact investigation tray on screen. Each job remains visible after the object leaves the frame and reports `누끼 찾는 중`, `물체 확인 중`, `시세 조사 중`, `품번 필요`, `누끼 재획득 중` or the evidence-backed price. A separate `×` cancels only that job. In supported WebXR, the same target outline and price billboard are drawn from one world anchor; a short loss of visual evidence keeps the dashed world cutout outline while hiding the price billboard, preserving the anchor so a later match restores the full HUD in the same 3D position.

## Approved refinement: tracking and evidence

> 그리고 Ocr같은건 어차피 Vlm 선에서 모두 정리되니깐 Vlm이 Generalize되어서 더 잘할것들은 하지말고.

> 오히려 농산물이나 이런것들은 오히려 시세를 인터넷 시세를 알거니깐 오히려 좋은데 그냥 안경 같은경우는 그냥 안경 혹은 그냥 점퍼 가격 검색으로 하는건 무의미해. 그 모델에 대한 가격조회까지 되어야 유의미하니깐.

The automatic multi-object proposal model is a measured aid to segmentation only. SAM supplies the actual cutout and outlines. The commercial VLM uses the cutout, scene and optional same-item label to interpret identity; no generic eyewear/apparel price is used. Document produce reference units, region and observation dates explicitly. Distinguish ordinary screen-space contours, automatic object-relative 3D labels, and explicit stationary placement. The parent issue [#27](https://github.com/NomaDamas/HowMuch/issues/27) links the implementation gates and real-device follow-up.

## Verbatim requirements and gap closure

All approved user messages are preserved unmodified in [APPROVED_REQUIREMENTS.md](APPROVED_REQUIREMENTS.md). Person mode is a playful, mood-based fictional price (₩ 놀이 가격) shown by default and switchable off; it never evaluates looks or body. Real-device ARKit/ARCore validation remains deferred ([#31](https://github.com/NomaDamas/HowMuch/issues/31)).
