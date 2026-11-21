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
