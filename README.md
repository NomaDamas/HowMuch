# HowMuch by NomaDamas MinXing MinXing

HowMuch is an AGPL multimodal camera experience. Hold a product in view for about 3–5 seconds, or switch to touch/draw mode and select it. The selected object is segmented, sent with its surrounding scene to a commercial VLM-led research agent, and shown with an evidence-backed market range in a translucent HUD beside the object. The HUD hides on tracking loss and returns after reacquisition.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
npm run api
```

Set `RESEARCH_AGENT_ENDPOINT` on the server and `VITE_RESEARCH_ENDPOINT` in the client. `/api/research` is the only product research route. The agent must operate visual and VLM-generated text research concurrently through permitted browser/MCP tools and return source URLs, evidence, condition, currency, timestamp, and confidence. There is no direct search API or deterministic price fallback.

## Validation

```bash
npm test
npm run build
node --check server/analyze.mjs
```

See [`docs/AGENT_RESEARCH.md`](docs/AGENT_RESEARCH.md), [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/ISSUES.md`](docs/ISSUES.md), and [`docs/COMMERCIAL_READINESS.md`](docs/COMMERCIAL_READINESS.md).
