# HowMuch by NomaDamas MinXing

Point the mobile camera at a product, or tap/draw around it. Each tap, long press or drawing adds a separate investigation (up to four). A translucent card follows its object; × cancels only that job. Results remain in 조사 목록 when an object leaves the screen. Prices come from evidence found by a commercial VLM and agent-operated browser research. Search failures and unavailable prices are displayed explicitly. The browser desktop and phone use the same research engine.

## Run localhost

Requires Node 22+, npm, a configured commercial VLM credential (with the provider's hosted web search), and the segmentation model. Use the shell environment or a private, untracked environment file (never prefix secrets with `VITE_`).

```sh
npm ci
npx playwright install chromium
bash scripts/setup-segmentation.sh
# Optional: add hidden proposals for objects the SAM grid misses (3.8 MB).
bash scripts/setup-segmentation.sh --detector-only
# Set VLM_API_KEY, VLM_BASE_URL, and VLM_MODEL in your shell or source the existing local credential.
npm run demo
```

Open **http://localhost:5173**. The launcher starts the loopback research API (:8787), browser agent (:8791), and Vite. Press Ctrl+C to stop. For separate processes run `npm run demo:agent`, `npm run demo:api`, and `npm run dev`. `RESEARCH_TIMEOUT_MS` defaults to 180000; API accepts 1–600 seconds. No public tunnel is used.

HowMuch never stars repositories silently during `git clone`. After `npm install`, if you are in an interactive terminal with an authenticated GitHub CLI, it asks once `[y/N]` and stars only on an explicit `y` (`HOWMUCH_NO_STAR_PROMPT=1` or CI disables the prompt). You can also use the in-app **GitHub에서 HowMuch Star 누르기** link or `HOWMUCH_CONFIRM_STAR=1 npm run star`. No credential is stored by this project.

## Phone on the same Wi-Fi

1. Stop the desktop launcher. Run `npm run demo:phone` (requires OpenSSL with `-addext`; set `HOWMUCH_LAN_IP` if your machine has multiple adapters). It builds the frontend, generates a private local CA and a seven-day server certificate under ignored `.howmuch/tls`, and serves **only the built app** over HTTPS on the Wi-Fi address, port 8443. The desktop developer server and agent remain loopback-only.
2. Transfer **only** `.howmuch/tls/ca.crt` to your test phone using AirDrop or USB. Compare its SHA-256 fingerprint with the launch output. Never share any `.key`. On iOS install the downloaded profile under Settings → General → VPN & Device Management, then enable the root under General → About → Certificate Trust Settings. On Android use Security → Encryption & credentials → Install a certificate → CA certificate (manufacturer labels vary). Use a test device that permits user CAs; do not bypass TLS warnings. Remove the test CA from the phone after the demo.
3. On the desktop open **http://localhost:5173 → 설정 → 휴대폰 연결 QR**. Scan with the phone camera, verify the displayed HTTPS origin, and tap **이 서버에 연결**. Allow camera access. The code expires after five minutes and works once; the resulting HttpOnly session lasts ten minutes. Generate a new code or choose **연결 해제** on the desktop to revoke. A direct LAN URL cannot access paid research or segmentation without pairing.
4. If Safari/Chrome cannot open the link, verify both devices are on the same Wi-Fi, client isolation is disabled, the host firewall allows the private Wi-Fi connection on 8443, and the certificate SAN matches the current LAN IP. Restart the launcher after changing Wi-Fi.

For camera permission, local HTTP works on the desktop only; use trusted HTTPS on the phone. The ordinary overlay follows an image-space track. Choose **공간 보기** on an eligible WebXR device for automatic 3D price cards beside the selected objects. A single-product native AR handoff and manual surface placement are also available; see [world anchor behavior](docs/WORLD_ANCHORS.md).

## Integrate

- REST: `POST /api/research` returns the final result. `POST /api/jobs` with the same request returns a job ID, SSE URL and polling URL. `GET /api/jobs/{id}/events` replays queued/running and terminal status; `Last-Event-ID` resumes the stream. Finished jobs/results are available for up to five minutes; frames are not retained in the job store. SDKs are intended for trusted localhost clients.
- MCP: Configure a **stdio** server with `command: "node"` and `args: ["/absolute/path/to/HowMuch/server/mcp.mjs"]`. Run the desktop API first. `tools/list` exposes `research_object`; visual search and browser actions are private tools inside that research run. Set `HOWMUCH_API_URL` to use a different trusted loopback port. For direct CLI use `npm run --silent mcp` so stdout stays JSON-RPC only.
- TypeScript: `import { HowMuchClient } from './sdk/howmuch-client.mjs'; const client = new HowMuchClient(); const job = await client.startJob(input); for await (const e of client.events(job.jobId)) console.log(e.status);`
- Python (standard library): `from sdk.howmuch_client import HowMuchClient; client = HowMuchClient(); job = client.start_job(payload); print([e["status"] for e in client.events(job["jobId"])])`. Both clients also provide synchronous-request-style `research` (async in JS).

`npm test` runs unit and integration tests; `npm run build` produces the static phone frontend. See [API](contracts/openapi.yaml), [research architecture](docs/ARCHITECTURE.md), [research evidence](docs/AGENT_RESEARCH.md), and [release gates](docs/COMMERCIAL_READINESS.md). A successful test with fixtures is not a physical-device or live-price validation.

To validate phone pairing without a physical phone, build the project and run `npm run smoke:pairing`. The smoke test validates the TLS certificate, decodes the rendered QR, confirms in a mobile-size Chromium viewport, and checks revocation.

The segmentation installer downloads [SAM 2.1 Hiera Tiny](https://huggingface.co/facebook/sam2.1-hiera-tiny) and verifies its SHA-256. Both upstream project and weights are Apache-2.0. Tiny trades mask quality for latency; it is not a claim of benchmark leadership. This demo uses CUDA if available and CPU on Mac; see [setup](scripts/setup-segmentation.sh). Use Python 3.10+ compatible with PyTorch. A point or freehand outline prompts one mask; automatic mode samples several foreground prompts per frame and keeps at most four non-overlapping candidates. Crops have an alpha channel; webcam RGB outside a mask is cleared in that crop. The VLM separately receives the surrounding frame for context. Merchant image-search UIs receive only the selected crop.
