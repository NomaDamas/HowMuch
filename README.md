# HowMuch

Camera-first product and market-price lookup prototype. The web MVP supports automatic mode and touch/draw selection, captures a representative frame, sends a normalized selection to the VLM/search provider contract, and renders evidence-backed offers beside the selected object.

## Run locally

```bash
npm install
npm run dev
npm run api # optional provider proxy on :8787
```

Open the printed localhost URL on a phone or desktop browser. Camera access is optional in demo mode; the deterministic provider keeps the interaction testable without credentials.

## Provider wiring

Copy `.env.example` to `.env.local`; for the working local proxy set `VITE_ANALYZE_ENDPOINT=http://localhost:8787/api/analyze`. For separate providers, set `VITE_VLM_ENDPOINT`, `VITE_SEARCH_ENDPOINT`, and `VITE_MASK_ENDPOINT` to your own server-side proxies. Keep provider secrets on the proxy, never in this browser bundle. The proxy must return the typed contracts in `src/lib/types.ts`, including source URL, checked time, condition, availability, currency and confidence for every offer. OCR is not part of the pipeline.

## Validation

```bash
npm run test
npm run build
```

Roadmap and issue-level delivery gates are in [`docs/ROADMAP.md`](docs/ROADMAP.md).
