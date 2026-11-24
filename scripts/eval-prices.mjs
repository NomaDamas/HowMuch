#!/usr/bin/env node
// Field-accuracy harness: node scripts/eval-prices.mjs eval/cases.json [http://127.0.0.1:8791/agent/research]
// Each case sends a real photo as cutout+scene to the research agent and scores the answer against an expected
// price band / model substring. Prints per-case latency and an overall hit rate. Needs VLM_* env on the agent.
import { readFileSync } from 'node:fs';
const [file = 'eval/cases.json', endpoint = process.env.RESEARCH_AGENT_ENDPOINT || 'http://127.0.0.1:8791/agent/research'] = process.argv.slice(2);
const cases = JSON.parse(readFileSync(file, 'utf8'));
const dataUrl = p => `data:image/${/\.png$/i.test(p) ? 'png' : 'jpeg'};base64,${readFileSync(p).toString('base64')}`;
let hits = 0, answered = 0;
const rows = [];
const work = async c => {
  const started = performance.now();
  let verdict = 'error', detail = '';
  try {
    const img = dataUrl(c.image);
    const res = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ imageContext: { cutoutDataUrl: img, fullFrameDataUrl: img }, ...(process.env.EVAL_IMAGE_SEARCH === '1' && { imageSearch: true }) }), signal: AbortSignal.timeout(200000) });
    const r = await res.json();
    const byId = new Map((r.offers || []).map(o => [o.id, o]));
    const lowest = byId.get(r.lowest)?.price ?? r.lowest?.price ?? r.representative?.min ?? r.estimate?.median ?? null;
    const model = [r.identity?.brand, r.identity?.model].filter(Boolean).join(' ') || r.candidates?.[0]?.name || '';
    detail = `${r.status}/${r.pricingMode || '-'} · ${model} · ${lowest ?? '가격없음'}`;
    if (r.status === 'complete' || r.status === 'partial') answered++;
    const e = c.expect || {};
    const any = e.modelAny || (e.modelIncludes ? [e.modelIncludes] : []);
    const modelOk = !any.length || any.some(w => model.toLowerCase().includes(w.toLowerCase()));
    const inBand = lowest != null && (e.minPrice == null || lowest >= e.minPrice) && (e.maxPrice == null || lowest <= e.maxPrice);
    const priceOk = e.commodity ? r.pricingMode === 'market_unit' && inBand : lowest != null && (e.minPrice == null || lowest >= e.minPrice) && (e.maxPrice == null || lowest <= e.maxPrice);
    verdict = modelOk && priceOk ? 'HIT' : 'MISS'; if (verdict === 'HIT') hits++;
  } catch (e) { detail = String(e.message || e); }
  rows.push({ name: c.name, verdict, seconds: ((performance.now() - started) / 1000).toFixed(1), detail });
  const done = rows.length, bar = '█'.repeat(Math.round(20 * done / cases.length)).padEnd(20, '░');
  console.log(`[${bar}] ${done}/${cases.length} ${verdict} ${rows.at(-1).seconds}s ${c.name.slice(0, 30)} · ${detail.slice(0, 70)}`);
};
const limit = Number(process.env.EVAL_CONCURRENCY || 1), queue = [...cases];
await Promise.all(Array.from({ length: Math.min(limit, cases.length) }, async () => { for (let c; (c = queue.shift());) await work(c); }));
console.table(rows);
console.log(`hit rate ${hits}/${cases.length} (${Math.round(100 * hits / Math.max(cases.length, 1))}%), answered ${answered}/${cases.length}`);
