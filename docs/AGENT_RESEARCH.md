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
  "candidateHints": ["optional VLM candidate"],
  "limits": {"maxPages": 12, "deadlineMs": 8000}
}
```

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

`status` is `complete`, `partial`, `no_result`, or `error`. A partial response can render a candidate or one branch's offers, but the UI must label it. `no_result` must not fabricate a price. A lowest price is selected only after currency normalization, duplicate URL removal, outlier filtering, and an availability check; show a range/median when multiple trustworthy offers exist.

## Failure and cancellation

The client assigns a monotonically increasing job id. When the camera target changes, it aborts the old request and ignores late events. Each branch has its own timeout; the reducer returns the branch that finished before the deadline and records the timeout in `tools`/diagnostics. Raw frames are ephemeral and are not logged by the agent.

