# Research architecture (current): agent-only, server-side, phone-safe

**Default path = `server/agent-research.mjs`.** No page crawling, no search-engine scraping, no browser, no CLI subprocess.

```
phone / app / desktop --POST /api/jobs--> server (202 + jobId at once)        <- phone may go to background
                                           |- research agent 1: domestic shops
                                           |- research agent 2: price-comparison sites     (parallel)
                                           '- research agent 3: official / overseas stores
                                          each = commercial multimodal model + provider-hosted `web_search` tool,
                                          cut-out and scene images attached (the Codex / Aside harness mechanism:
                                          an objective plus several varied keyword queries, no site: operators)
                                           |
                                    merge: identity clustering and vote (aliases merged), model-title match,
                                    price agreement (>= 2 independent agents within 20%), early return when two agree
                                           v
phone <--GET /api/jobs/:id (poll; resumable after background)-- result with evidence, or a follow-up request
```

* **Why no crawling:** sites ban scrapers. Search runs through the model provider's hosted search, the same way Claude Code, Codex and Aside search.
* **Citations:** the proxy used in development returns none, so a price is shown only when independent agents agree; one agent alone is never trusted.
* **Guards kept:** a lone price without a visible label is held back (`followup_required`), apparel/eyewear need a label, and wrong-model titles are dropped.
* **Phones:** the app only submits a job and polls (`HttpResearchProvider.pollJob`); the server keeps working while the app is suspended. Android, iOS and desktop use the same API. App shells identify with `HowMuchApp` in the user agent to select this transport.
* **Legacy:** `HOWMUCH_RESEARCH=legacy` keeps the previous Playwright pipeline (it also holds the KAMIS produce market). It is deprecated and only exists for fixtures and produce.
* **Aside analysis (static):** the `websearch` tool calls a hosted backend `/search` with `objective` + `search_queries[]`; `webfetch` reads pages directly (5 MB cap); answers cite `source_id`s. The CAPTCHA-solver skill is deliberately not copied.

Measured on the 14-case Danawa-sourced set (catalogue photos, price band 60-160 %, one run, noisy): 0/14 -> 7/14 (50 %). Known failures: sibling-generation products (Watch, AirPods), poorly recognisable products, and parallel-import vs retail price differences.

---

# Earlier design notes (superseded)

# Multimodal research-agent contract

The browser MVP treats research as one agent run with two concurrent branches. The image branch finds visually similar products and the text branch searches the VLM-generated product queries. Both branches return evidence; the reducer only displays prices that have a source URL, checked timestamp, merchant, condition, and extracted price.

## Request

```json
{
  "jobId": "uuid",
  "locale": "ko-KR",
  "imageContext": {
    "fullFrameDataUrl": "data:image/jpeg;base64,...",
    "cutoutDataUrl": "data:image/png;base64,...",
    "selection": {"x": 0.2, "y": 0.3, "width": 0.4, "height": 0.3,
      "polygon": [{"x": 0.2, "y": 0.3}]}
  },
  "labelDataUrl": "data:image/jpeg;base64,...",
  "region": "서울"
}
```

The public REST/MCP input takes top-level `imageDataUrl`, `cutoutDataUrl`, `selection`, and `locale`. The gateway supplies the internal image context. The optional label image supplements the original object; the optional region selects a produce market.

## Concurrent tool calls

The agent may implement these tools with Browser Use, Playwright, an MCP browser, or another permitted browser runtime:

```ts
visual_search({ imageDataUrl, locale, maxResults })
text_search({ queries, locale, maxResults })
open_page({ url })
extract_offer({ page, sourceUrl })
```

`visual_search` and `text_search` start concurrently after the VLM has produced candidate names and queries. The visual branch must keep the original image/cutout context. The text branch must preserve every query used. Browser tools should inspect rendered page text or screenshots and return evidence snippets; they must not bypass authentication, paywalls, robots controls, or a marketplace's terms. HowMuch does not call a product search API or switch to one if browser research fails.

## Response

```json
{
  "jobId": "uuid",
  "status": "complete",
  "candidates": [{"name": "...", "brand": "...", "confidence": 0.84}],
  "offers": [{
    "id": "offer-id", "title": "...", "url": "https://...", "merchant": "...",
    "price": 129000, "currency": "KRW", "condition": "new",
    "shipping": 0, "availability": "in_stock",
    "checkedAt": "2026-11-22T00:00:00.000Z",
    "evidence": ["price text copied from rendered page"],
    "branch": "visual|text", "confidence": 0.86
  }],
  "lowest": "offer-id",
  "representative": {"min": 89000, "max": 139000, "median": 129000, "currency": "KRW"},
  "tools": ["visual_search", "text_search", "open_page", "extract_offer"],
  "queries": ["the exact text queries used"],
  "startedAt": "...", "completedAt": "..."
}
```

If brand or model evidence is missing for eyewear or clothing, `followup_required` asks for a label close-up. For a supported commodity, `produceMarket` carries comparable observations (same source table and unit), separately from buyable offers. See [OpenAPI](../contracts/openapi.yaml) for result types. A partial response can render a candidate or one branch's offers, but the UI must label it. `no_result` must not fabricate a price. A lowest price is selected only after currency normalization, duplicate URL removal, outlier filtering, and an availability check; show a range/median when multiple trustworthy offers exist.

## Failure and cancellation

The client assigns a monotonically increasing job id. When the camera target changes, it aborts the old request and ignores late events. Each branch has its own timeout; the reducer returns the branch that finished before the deadline and records the timeout in `tools`/diagnostics. Raw frames are ephemeral and are not logged by the agent.


A recognized product with no successfully reached search/catalog or merchant page returns `research_unavailable`. A successful search that lacks a matching confirmed offer returns `no_result`. Clients can retry outages without presenting them as an empty market.

## Agent deep-research backend (Claude Code / Codex)

Set `HOWMUCH_AGENT_CLI=claude` or `codex` and the research run additionally launches that CLI headless (`server/cli-agent.mjs`) with its own web search/page tools, the cutout and the scene image. It runs in parallel with the Google Lens image upload and VLM text queries, searches visually and textually together, and returns only proposed product URLs and queries. Proposals are never trusted: every URL is opened by the guarded browser, structured offers are extracted and the VLM must verify identity against the cutout before any price is shown. There is no search-API fallback; if the CLI is missing or fails, the existing Playwright agent path continues and failure is explicit. API keys of other providers are stripped from the Codex child environment. Page reads are no longer limited to a curated shop list: any public `https` host is allowed (no IPs, localhost/internal TLDs, search/social hosts, cart/login paths); curated merchants only rank first. Aside/`rea` binary analysis was not performed in this change; the design follows the documented behaviour of Claude Code's WebSearch/WebFetch and Codex live web search.
