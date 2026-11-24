import {readResearch} from './research-stream.js';
import type { NormalizedSelection } from './types';
import type { ResearchAgentProvider, ResearchContext, ResearchResult } from './research';

type Point = { x: number; y: number };
type Segment = NormalizedSelection & { polygon: Point[]; contours?: Point[][]; cutoutDataUrl?: string };
const unit = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1;
const point = (p: Point) => p && unit(p.x) && unit(p.y);
const valid = (s: Segment) => s && point(s) && unit(s.width) && unit(s.height) && s.width > 0 && s.height > 0 &&
  s.x+s.width <= 1.000001 && s.y+s.height <= 1.000001 && Array.isArray(s.polygon) && s.polygon.length >= 3 &&
  s.polygon.every(point) && (!s.cutoutDataUrl || s.cutoutDataUrl.startsWith('data:image/png;base64,'));
async function failure(response: Response, label: string) {
  let reason = ''; try { const data = await response.json(); reason = String(data.error ?? '').slice(0, 180); } catch {}
  return label + ' 실패 (' + response.status + ')' + (reason ? ': ' + reason : '');
}

export class HttpSegmentationProvider {
  constructor(private readonly endpoint: string) {}
  async segment(input: { imageDataUrl: string; point?: Point; selection?: NormalizedSelection; propagation?: {previousImageDataUrl:string;selection:NormalizedSelection}; signal?: AbortSignal }) {
    const response = await fetch(this.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({image:input.imageDataUrl, point:input.point, selection:input.selection,propagation:input.propagation}), signal:input.signal });
    if (!response.ok) throw new Error(await failure(response, '물체 윤곽 인식'));
    const data = await response.json();
    const list = data.selections ?? (data.selection ? [data.selection] : null);
    if (!Array.isArray(list) || list.length > 4 || !list.every(valid)) throw new Error('올바른 물체 윤곽을 받지 못했습니다.');
    return { selection: list[0] ?? null, selections: list as Segment[], model: data.model };
  }
}

export class HttpResearchProvider implements ResearchAgentProvider {
  constructor(private readonly endpoint: string, private readonly jobsEndpoint?: string) {}
  private async stream(input: ResearchContext, signal?: AbortSignal, onPhase?: (event: {phase: string; candidate?: {name: string}; step?: unknown; activity?: unknown[]}) => void) {
    const response = await fetch(this.endpoint, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/x-ndjson, application/json' }, body: JSON.stringify(input), signal });
    if (!response.ok) throw new Error(await failure(response, '가격 조사'));
    return readResearch(response, onPhase);
  }
  // Background-safe transport for phones: submit a job, then poll it. The server keeps researching while the app is
  // suspended; when the app resumes, the same job id is read again. No long-lived connection has to survive.
  private async pollJob(input: ResearchContext, signal?: AbortSignal, onPhase?: (event: {phase: string; candidate?: {name: string}; step?: unknown; activity?: unknown[]}) => void) {
    const start = await fetch(this.jobsEndpoint as string, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input), signal });
    if (!start.ok) throw new Error(await failure(start, '가격 조사'));
    const { jobId, status } = await start.json() as { jobId: string; status: string };
    try { sessionStorage.setItem('howmuch-job-' + jobId, String(Date.now())); } catch { /* storage may be unavailable */ }
    onPhase?.({ phase: 'researching' });
    const deadline = Date.now() + 300000;
    let delay = 1200, lastName = '', lastActivity = '';
    while (Date.now() < deadline) {
      await new Promise<void>((resolve, reject) => { const t = setTimeout(resolve, delay); signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('aborted', 'AbortError')); }, { once: true }); });
      const r = await fetch(status, { signal });
      if (r.status === 404) throw new Error('가격 조사 작업을 찾을 수 없습니다.');
      if (!r.ok) { delay = Math.min(4000, delay * 1.5); continue; } // transient network loss while backgrounded: keep polling
      const event = await r.json() as { status: string; result?: unknown; candidate?: { name: string }; activity?: unknown[] };
      if (event.status === 'running' && event.activity?.length) { const sig = JSON.stringify(event.activity); if (sig !== lastActivity) { lastActivity = sig; onPhase?.({ phase: 'progress', activity: event.activity }); } }
      if (event.status === 'running' && event.candidate && event.candidate.name !== lastName) { lastName = event.candidate.name; onPhase?.({ phase: 'researching', candidate: event.candidate }); }
      if (event.status === 'completed' && event.result) return event.result;
      if (event.status === 'failed') throw new Error('가격 조사에 실패했습니다.');
      delay = Math.min(2500, delay + 250);
    }
    throw new Error('가격 조사 시간이 초과됐습니다.');
  }
  async research(input: ResearchContext, signal?: AbortSignal, onPhase?: (event: {phase: string; candidate?: {name: string}; step?: unknown; activity?: unknown[]}) => void): Promise<ResearchResult> {
    const envelope = (this.jobsEndpoint ? await this.pollJob(input, signal, onPhase) : await this.stream(input, signal, onPhase)) as { candidates?: ResearchResult['candidates']; offers?: ResearchResult['offers']; lowest?: ResearchResult['lowest']; highest?: ResearchResult['highest']; status?: ResearchResult['status']; queries?: string[]; representative?: ResearchResult['representative']; startedAt?: string; completedAt?: string; tools?: string[] };
    if (!Array.isArray(envelope.candidates) || !Array.isArray(envelope.offers) || typeof envelope.startedAt !== 'string' || Number.isNaN(Date.parse(envelope.startedAt)) || typeof envelope.completedAt !== 'string' || Number.isNaN(Date.parse(envelope.completedAt)) || !Array.isArray(envelope.tools) || envelope.tools.length === 0 || envelope.tools.some((tool) => typeof tool !== 'string' || !tool.trim())) throw new Error('Research agent returned an invalid contract');
    if (envelope.candidates.some((candidate) => !candidate?.name || typeof candidate.name !== 'string' || !Number.isFinite(candidate.confidence) || candidate.confidence < 0 || candidate.confidence > 1)) throw new Error('Research agent returned invalid candidates');
    if (envelope.offers.some((offer) => !offer?.title || typeof offer.title !== 'string' || !/^https?:\/\//i.test(offer.url) || !offer.merchant || typeof offer.merchant !== 'string' || !Number.isFinite(offer.price) || offer.price <= 0 || !['KRW', 'USD', 'JPY', 'EUR'].includes(offer.currency) || !['new', 'used', 'unknown'].includes(offer.condition) || typeof offer.checkedAt !== 'string' || Number.isNaN(Date.parse(offer.checkedAt)) || !Array.isArray(offer.evidence) || offer.evidence.length === 0 || offer.evidence.some((e) => typeof e !== 'string' || !e.trim()) || !Number.isFinite(offer.confidence) || offer.confidence < 0 || offer.confidence > 1)) throw new Error('Research agent returned invalid offers');
    return envelope as ResearchResult;
  }
}

export function providerConfig() {
  // Keep the browser client runnable out of the box. The Vite proxy routes
  // these relative paths to the local API and agent; secrets stay server-side.
  return {
    researchEndpoint: (import.meta.env.VITE_RESEARCH_ENDPOINT as string | undefined) || '/api/research',
    // Native app shells (UA contains HowMuchApp) and VITE_USE_JOBS=1 use the background-safe job transport.
    jobsEndpoint: (typeof navigator !== 'undefined' && /HowMuchApp/.test(navigator.userAgent)) || import.meta.env.VITE_USE_JOBS === '1' ? '/api/jobs' : undefined,
    segmentationEndpoint: (import.meta.env.VITE_SEGMENTATION_ENDPOINT as string | undefined) || '/agent/segment',
  };
}
