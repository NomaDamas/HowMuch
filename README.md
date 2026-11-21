# HowMuch by NomaDamas MinXing

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

## Real phone demo with Myproxy

Run the agent and API in two terminals. The Myproxy key is read only from the shell and is never committed.

```bash
export MYPROXY_API_KEY='your-local-key'
export MYPROXY_BASE_URL='https://proxy.nomadamas.org/v1'
export MYPROXY_VLM_MODEL='gpt-6.1-terra'
npm run demo:agent
# first-time only: npx playwright install chromium
``

In a second terminal:

```bash
export RESEARCH_AGENT_ENDPOINT=http://127.0.0.1:8791/agent/research
npm run demo:api
```

In a third terminal, start Vite with the LAN host enabled:

```bash
npm run dev -- --host 0.0.0.0
```

Open the printed LAN URL on the phone. Camera permission requires HTTPS on most phones; use an HTTPS tunnel such as Cloudflare Tunnel for a remote phone. The local agent uses Playwright Chromium, calls Myproxy GPT-6.1 Terra for object identity and segmentation selection, and runs visual/text browser branches concurrently. Marketplace pages may block automation or show no prices; the HUD must then show `결과 없음` rather than invent a price.
