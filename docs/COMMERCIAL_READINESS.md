# Commercial readiness and provider terms

HowMuch is distributed under AGPL-3.0-or-later. AGPL governs the HowMuch source code and modifications to it. It does not grant rights to commercial VLMs, shopping sites, browser agents, images, product catalogs, trademarks, or price data. Each deployment must review provider terms before enabling an adapter.

## Separation of concerns

| Layer | License/terms owner | Required action |
| --- | --- | --- |
| HowMuch UI, API, adapters | This repository, AGPL-3.0-or-later | Preserve notices, provide corresponding source for network use, publish modifications under AGPL terms |
| Commercial VLM | Model provider | Keep keys server-side; comply with retention, regional processing, output and branding terms |
| Browser agent (Browser Use/Playwright) | Upstream project plus target site terms | Pin/version dependencies; automate only permitted flows; do not defeat CAPTCHA, rate limits, login controls, or robots/terms restrictions |
| Crawl/extraction (Crawl4AI/Firecrawl/SearXNG) | Upstream project plus each target site | Use only pages and endpoints whose terms permit access; retain provenance and timestamps |
| Search/merchant data | Merchant/search provider | Follow API quotas, attribution, affiliate requirements, price display rules, and caching limits |
| Images and screenshots | Copyright holder/provider | Store only when permitted; link to original; avoid redistributing protected media |

## Provider adapter checklist

### Components actually used (2026-11-23)

The npm package versions and SPDX identifiers below come from the installed manifests and can be checked against `package-lock.json`. Retain each package's full license and any NOTICE files when redistributing its code.

- Browser worker: [Playwright](https://github.com/microsoft/playwright) 1.65.1 (Apache-2.0). Chromium's bundled notices are separate.
- Camera UI: React and React DOM 19.3.1 (MIT), lucide-react 1.77.0 (ISC; also retain upstream icon notices), qrcode 1.5.4 (MIT).
- Build: Vite 8.3.8 and @vitejs/plugin-react 6.3.0 (MIT).
- Segmentation: [SAM 2 pinned source](https://github.com/facebookresearch/sam2/tree/2b90b9f5ceec907a1c18123530e92e794ad901a4) and the [SAM 2.1 tiny checkpoint/model card](https://huggingface.co/facebook/sam2.1-hiera-tiny/tree/de431c4043854a71d8101e17995dfe596bf101a5) (Apache-2.0). The setup script verifies the checkpoint SHA-256; additional Python/library notices are required when shipping that environment.
- Alternatives considered only: Browser Use, Crawl4AI, Firecrawl and SearXNG are not bundled search backends. No upstream project licenses a third party's retailer data.
- Optional OpenCV Zoo NanoDet-Plus 1.5x/416 code and ONNX weights: the pinned [model directory](https://github.com/opencv/opencv_zoo/tree/48b10fa505aeb51fbd127fc60a5c660040e823b7/models/object_detection_nanodet) says all files there use [Apache-2.0](https://github.com/opencv/opencv_zoo/blob/48b10fa505aeb51fbd127fc60a5c660040e823b7/models/object_detection_nanodet/LICENSE). Attribution: NanoDet by RangiLyu; OpenCV Zoo port contributed by Sri Siddarth Chakaravarthy (GSoC 2022). Preserve upstream notices and license if redistributing the model. HowMuch fetches the weights separately and verifies the pinned LFS digest. This permission concerns the detector code/weights, not merchant photos or training images.
- Commercial VLM: a deployment chooses the endpoint, model and account. Operator permission, retention, subprocessor and region reviews remain open until the particular deployment is recorded. This inventory does not certify permission to upload images or republish prices from any merchant.

Before enabling a provider in production, record:

1. Provider name, endpoint, account owner, and data region.
2. Terms URL and last reviewed date.
3. Authentication method and secret storage location.
4. Allowed automation, caching, attribution, and rate limits.
5. Whether screenshots, page text, and prices may be stored or displayed.
6. Deletion, retention, and user opt-out behavior.
7. Fallback behavior when permission, quota, or evidence checks fail.

## Price evidence rules

- A lowest price is shown only when the result has a URL, merchant, currency, condition, availability, and checked timestamp.
- Search snippets are leads, not final evidence, unless the provider explicitly authorizes snippet use.
- Never label an inferred, stale, unavailable, or seller-mismatched result as verified.
- Separate new, used, refurbished, rental, bundle, and shipping-inclusive prices.
- Keep the raw provider response only for the configured retention period; otherwise retain normalized evidence metadata.

## AGPL network-service obligations

The UI must expose a visible `HowMuch by NomaDamas MinXing` identity and a `Source` link to the corresponding source repository or source bundle. Any hosted modified version must provide the corresponding source to users interacting with it over a network, as required by AGPL Section 13. Keep third-party dependencies and notices discoverable.

This document is an engineering checklist, not legal advice. Obtain a legal review before selling access, redistributing provider data, or enabling a new commercial source.


## Native placement and produce observations

The optional Android companion depends on Google Play Services for AR and the Google ARCore SDK; the iOS companion uses the Apple ARKit and SceneKit system frameworks. The companion sources are part of HowMuch, while device services and platform SDK terms remain separate. Unsigned developer builds are not store releases. KAMIS retail data is attributed per observation with source and survey date. Confirm [KAMIS](https://www.kamis.or.kr/) redistribution and commercial display terms before publicly offering that adapter; public access is not a redistribution grant.
