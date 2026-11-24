# Research architecture: agent-only, three tiers, server-side

There is exactly one way prices are found: **research agents**. No page crawling, no search-engine scraping, no browser,
no CLI subprocess, no merchant allow-list, no local produce database. (`server/agent-research.mjs`)

```
phone / app / desktop --POST /api/jobs--> server (202 + jobId at once)        <- the phone may go to the background
                                           |- agent 1: Korean domestic market
                                           |- agent 2: price-comparison sites                 (parallel)
                                           '- agent 3: official / overseas stores
                          each agent = commercial multimodal model + the provider-hosted `web_search` tool,
                          cut-out and scene attached; objective + several varied keyword queries (Aside / Codex / Claude Code style)
                                           |
                       merge: identity clustering and vote, price agreement, outlier trimming, early return when two agree
                                           v
phone <--GET /api/jobs/:id (poll; resumable after background)-- result with evidence
```

## Three tiers (the agent chooses how specific the pictures allow; the merge never claims more than the evidence)

| Tier | When | Result | Shown as |
|---|---|---|---|
| `exact_model` | brand and model known (confidence >= 0.85) and two independent agents' prices agree within 20% | lowest / highest / median of that model, with evidence | `₩446,310` · "확인한 판매가" |
| `type_estimate` | the model is unknown, or could not be corroborated | mean (and median, min, max) of 3-10 comparable listings, outliers trimmed; carries a follow-up | `약 ₩120,000` · "N개 비슷한 상품 평균" · asks for the model name |
| `market_unit` | food and other goods where the shop does not matter (leek, potato, beef, eggs) | median unit price per kg / piece / bunch from 3-10 sources, region and observation date | `₩3,655 / kg` · "시장 시세" |

* **Getting from the rough tier to an exact price:** the user types the model name (`modelHint`, 80 characters, verified
  against the picture by the agents) or points the camera at the label (a third image). The request is then re-run.
* **No model needed for food:** the `commodity` level skips model identification entirely.
* **Guards:** apparel and eyewear never get an exact price without a visible label (they fall to the rough tier); listings
  must be public `https` shop pages (no credentials, ports, private hosts, search/social pages, cart/login paths); a model price
  needs two independent agents; one agent alone is never trusted. The proxy used in development returns no citations, so agreement is the check.
* **Not crawled:** link sanity (`server/url-guard.mjs`) never fetches anything. The prices come from what the hosted
  search tool read, so no scraper is exposed to bans.
* **Currency:** non-KRW listings are converted with ECB rates, and say so in their evidence.

## Image search (optional)

Settings > Advanced > "Image search (Google)". Off by default; the switch is disabled when the server has no `GOOGLE_VISION_API_KEY`. When on, the cut-out photo (only that, not the scene) is sent to Google Cloud Vision Web Detection before the agents start (5 s limit). Its best guess, related names and pages with similar pictures go into every agent's prompt as untrusted leads; the agents still verify names and prices with their own searches. If the lookup fails or is empty, research runs as before. Server-side off switch: `HOWMUCH_IMAGE_SEARCH=off`. To compare accuracy: `EVAL_IMAGE_SEARCH=1 npm run eval:prices` against the same run without it.

## Speed

Measured on real runs (hosted web search, 3 parallel agents): one agent takes 50-100 s, a full result 65-90 s. What helped:
* **Early name** (about 7-10 s): a search-free vision call names the object while prices are researched; it travels through the job events, so phones polling a job see it too.
* **Smaller pictures** (scene 768 px, cut-out 512 px): about 18 % faster per call.
* **Search budget 3 and `search_context_size: low`** (both overridable with `HOWMUCH_AGENT_BUDGET`, `HOWMUCH_AGENT_CONTEXT`): about 10-15 % faster with no visible accuracy loss in a small test. `max_tool_calls` is rejected by the proxy used in development.
* Early return when two agents agree, stragglers cancelled.
What did **not** help: a 10 s straggler wait instead of 25 s (fewer agreeing answers), and `reasoning.effort=low` (about 22 % faster but cheaper, less accurate prices). The result quality of identical runs varies a lot (1 to 4 exact results out of 4), so single timings are noisy. Lower latency needs a faster model or endpoint, caching, or showing the first agent's answer as a preliminary result.

## Phones and background

The app only submits a job and polls it (`HttpResearchProvider.pollJob`); the server keeps researching while the app is
suspended, and the same API serves Android, iOS and desktop. The app shells identify with `HowMuchApp` in the user agent to
select this transport. Segmentation (SAM) is a separate endpoint and is unchanged.

## Measured (14 catalogue photos from Danawa, band 60-160 %, one run, noisy)

0/14 with the first design, 7/14 (50 %) for exact-model research. The rough and market tiers were added afterwards and
checked on a potato photo (10 sources, median ₩3,655/kg) and a hard-to-identify earbud photo (rough average + model request).

## Aside (static analysis)

The `websearch` tool calls a hosted backend `/search` with `objective` + `search_queries[]`; `webfetch` reads pages directly
(5 MB cap); answers cite `source_id`s. Its CAPTCHA-solver skill is deliberately not copied.
