import http from 'node:http';
import https from 'node:https';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { assertResearchEnvelope, isValidResearchInput } from './research-contract.mjs';
import { pairingStore } from './pairing.mjs';
import { jobStore } from './jobs.mjs';
import { githubStar } from './github-star.mjs';
import { ghLocal, localHost } from './gh-local.mjs';

const timeout = () => Math.max(1000,Math.min(600000, Number(process.env.RESEARCH_TIMEOUT_MS)||180000));
const json = (res,status,body,extra={}) => {
  res.writeHead(status, {'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff',...extra});
  res.end(JSON.stringify(body));
};
async function readBody(req,limit=16000000) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type']||'')) throw Object.assign(Error(),{status:415});
  let n=0; const chunks=[];
  for await (const chunk of req) { n+=chunk.length; if (n>limit) throw Object.assign(Error(),{status:413}); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString()); } catch { throw Object.assign(Error(),{status:400}); }
}
export async function researchAgent(input, signal, onPhase) {
  if (!process.env.RESEARCH_AGENT_ENDPOINT) throw Object.assign(Error(), {status:503});
  const image=input.imageDataUrl||input.image, cutout=input.cutoutDataUrl||input.cutout;
  const validated=raw=>{
    const result=assertResearchEnvelope(raw);
    return result;
  };
  const streamed=typeof onPhase==='function';
  const response=await fetch(process.env.RESEARCH_AGENT_ENDPOINT,{method:'POST',signal,
    headers:{'content-type':'application/json',accept:streamed?'application/x-ndjson':'application/json'},body:JSON.stringify({
      runtime:'howmuch-research-v1',task:'multimodal-research-agent',jobId:randomUUID(),
      imageContext:{fullFrameDataUrl:image,cutoutDataUrl:cutout,selection:input.selection},
      ...(input.labelDataUrl && {labelDataUrl:input.labelDataUrl}), ...(input.modelHint && {modelHint:input.modelHint}), ...(input.region && {region:input.region}),
      imageDataUrl:image,cutoutDataUrl:cutout,selection:input.selection,locale:input.locale||'en-US',
      tools:['agent_web_search']
    })});
  if (!response.ok) throw Object.assign(Error('research_agent_unavailable'),{status:response.status});
  if (!streamed || !response.headers.get('content-type')?.includes('application/x-ndjson')) return validated(await response.json());
  let buffer='',result,researching=false;
  function parseLine(line){
    const event=JSON.parse(line);
    if(event.error)throw Error('research_failed');
    if(event.result){result=validated(event.result);return}
    if(event.phase==='researching'&&!researching&&!result){
      researching=true;
      const candidate=event.candidate;
      const safe=candidate && typeof candidate.name==='string' && !candidate.name.startsWith('data:') ? {name:candidate.name.slice(0,240),...(Number.isFinite(candidate.confidence)?{confidence:candidate.confidence}:{})}:undefined;
      onPhase({phase:'researching',...(safe?{candidate:safe}:{})});
    }
  }
  for await (const chunk of response.body.pipeThrough(new TextDecoderStream())) {
    buffer += chunk;
    if(buffer.length>2_000_000)throw Error('research_event_too_large');
    const lines = buffer.split('\n'); buffer = lines.pop() || '';
    for (const line of lines) {
      if (!line.trim()) continue;
      parseLine(line);
    }
  }
  if (buffer.trim()) parseLine(buffer);
  if (!result) throw Object.assign(Error('research_agent_missing_result'),{status:502});
  return result;
}
const imageValid = v=> typeof v==='string' && /^data:image\/(jpeg|jpg|png|webp);base64,/i.test(v) && v.length<=12000000;
export function gateway({phoneOrigin, research=researchAgent, agentOrigin='http://127.0.0.1:8791'}={}) {
  const pairing=pairingStore(), jobs=jobStore(), star=githubStar(), gh=ghLocal(), budget=new Map(); let active=0;
  function rate(owner) {
    const t=Date.now(); for(const [id,v] of budget) if(v.until<=t) budget.delete(id);
    const v=budget.get(owner)||{until:t+60000,n:0}; budget.set(owner,v); return ++v.n<=30;
  }
  async function run(input, disconnect, onPhase) {
    if(active>=4) throw Object.assign(Error(),{status:429}); active++;
    try { const limit=AbortSignal.timeout(timeout()); return await research(input,disconnect?AbortSignal.any([limit,disconnect]):limit,onPhase); } finally { active--; }
  }
  const api = isPhone => async (req,res) => {
    const disconnect=new AbortController();
    res.once('close',()=>{if(!res.writableEnded)disconnect.abort()});
    try {
      const route=new URL(req.url,'http://localhost').pathname;
      const host=req.headers.host||'', origin=req.headers.origin;
      if (isPhone ? host!==new URL(phoneOrigin).host : !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host)) return json(res,403,{error:'invalid_host'});
      if ((origin && origin !== (isPhone ? phoneOrigin : 'http://'+host)) || req.headers['sec-fetch-site']==='cross-site') return json(res,403,{error:'cross_origin'});
      if (route==='/v1/pairing/sessions' && req.method==='POST' && !isPhone) {
        if(!phoneOrigin) return json(res,503,{error:'phone_https_not_configured'});
        await readBody(req,1024); const {sessionId,token,expiresAt}=pairing.create();
        return json(res,201,{sessionId,expiresAt,url:phoneOrigin+'/#pair='+sessionId+'.'+token});
      }
      if (route==='/v1/pairing/exchange' && req.method==='POST' && isPhone) {
        const body=await readBody(req,2048), c=pairing.exchange(body?.sessionId,body?.token);
        if(!c) return json(res,401,{error:'invalid_or_expired'});
        return json(res,200,{expiresAt:c.expiresAt},{'set-cookie':'__Host-howmuch='+c.id+'.'+c.clientToken+'; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=600'});
      }
      const [sid,token]=(req.headers.cookie?.match(/(?:^|;\s*)__Host-howmuch=([^;]+)/)?.[1]||'').split('.');
      const owner=isPhone?sid:'desktop';
      if(isPhone && !pairing.valid(sid,token)) return json(res,401,{error:'pairing_required'});
      if (req.method==='DELETE' && /^\/v1\/pairing\/sessions\/[\w-]+$/.test(route)) {
        const target=route.split('/').at(-1); if(isPhone && target!==sid) return json(res,403,{error:'forbidden'}); pairing.revoke(target);return json(res,200,{revoked:true});
      }
      if (req.method==='GET' && /^\/api\/jobs\/[\w-]+(?:\/events)?$/.test(route)) {
        const job=jobs.get(route.split('/')[3],owner); if(!job)return json(res,404,{error:'job_not_found'});
        if(!route.endsWith('/events'))return json(res,200,job.events.at(-1));
        const after=Number(req.headers['last-event-id'])||0;
        res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-store','x-accel-buffering':'no'});
        const send=e=>{ if(e.sequence>after)res.write('id: '+e.sequence+'\ndata: '+JSON.stringify(e)+'\n\n'); if(['failed','completed'].includes(e.status))res.end(); };
        for(const e of job.events)send(e); if(res.writableEnded)return;
        job.listeners.add(send); const timer=setInterval(()=>res.write(': keepalive\n\n'),15000);
        res.on('close',()=>{clearInterval(timer);job.listeners.delete(send)}); return;
      }
      // Star with the GitHub CLI signed in on this machine: local servers only, fixed repo, and only after the user's approval.
      if(['/api/github/star/status','/api/github/star/local','/api/github/star/login'].includes(route)){
        if(!localHost(host)) return json(res,404,{error:'not_found'});
        if(!rate(owner)) return json(res,429,{error:'rate_limited'},{'retry-after':'60'});
        if(req.method==='GET' && route.endsWith('/status')) return json(res,200,{...gh.status(),oauth:star.configured()});
        if(req.method==='POST' && route.endsWith('/local')){ if((await readBody(req,1024))?.confirm!==true) return json(res,400,{error:'confirmation_required'}); const o=gh.star(); return json(res,o.status,o.body); }
        if(req.method==='POST' && route.endsWith('/login')){ const o=await gh.startLogin(); return json(res,o.status,o.body); }
        return json(res,405,{error:'method_not_allowed'});
      }
      if(req.method==='POST' && route.startsWith('/api/github/star/')){
        if(!rate(owner)) return json(res,429,{error:'rate_limited'},{'retry-after':'60'});
        const out=route==='/api/github/star/start'?await star.start():route==='/api/github/star/poll'?await star.poll((await readBody(req,1024))?.pollId):null;
        if(!out) return json(res,404,{error:'not_found'});
        return json(res,out.status,out.body);
      }
      if(req.method!=='POST' || !['/api/research','/api/jobs','/agent/segment'].includes(route))return json(res,404,{error:'not_found'});
      if(!rate(owner)) return json(res,429,{error:'rate_limited'},{'retry-after':'60'});
      const input=await readBody(req);
      if(route==='/agent/segment') {
        if(!imageValid(input?.imageDataUrl||input?.image))return json(res,400,{error:'invalid_image'});
        const r=await fetch(agentOrigin+'/agent/segment',{method:'POST',headers:{'content-type':'application/json'},signal:AbortSignal.any([disconnect.signal,AbortSignal.timeout(timeout())]),body:JSON.stringify(input)});
        if(!r.ok)return json(res,r.status>=400&&r.status<600?r.status:502,{error:'upstream_unavailable'});
        return json(res,200,await r.json());
      }
      if(!isValidResearchInput(input))return json(res,400,{error:'image_and_selection_required'});
      if(route==='/api/jobs') {
        const id=jobs.start(owner,()=>run(input)); if(!id)return json(res,429,{error:'job_capacity'});
        return json(res,202,{jobId:id,events:'/api/jobs/'+id+'/events',status:'/api/jobs/'+id});
      }
      const streamed = req.headers.accept?.includes('application/x-ndjson');
      if (streamed) {
        res.writeHead(200, {'content-type':'application/x-ndjson','cache-control':'no-store','x-content-type-options':'nosniff','x-accel-buffering':'no'});
        const emit = event => { if (!res.writableEnded && !res.destroyed) res.write(JSON.stringify(event)+'\n'); };
        emit({phase:'identifying'});
        try { const result=await run(input,disconnect.signal,emit); emit({result}); } catch { emit({error:'research_failed'}); } finally { if(!res.destroyed)res.end(); }
        return;
      }
      return json(res,200,await run(input,disconnect.signal));
    } catch(e){return json(res,e?.status||502,{error:({400:'malformed_json',413:'payload_too_large',415:'json_required',503:'agent_unavailable',429:'busy'})[e?.status]||'upstream_unavailable'});}
  };
  return {host:api(false),phone:api(true)};
}
export async function start() {
  const port=Number(process.env.PORT||8787), origin=process.env.HOWMUCH_PHONE_ORIGIN;
  const api=gateway({phoneOrigin:origin,agentOrigin:'http://127.0.0.1:'+(process.env.AGENT_PORT||8791)});
  const local=http.createServer(api.host);local.listen(port,'127.0.0.1',()=>console.log('HowMuch API: http://127.0.0.1:'+port));
  if(!origin)return;
  const url=new URL(origin);
  const server=https.createServer({cert:await readFile(process.env.HOWMUCH_TLS_CERT),key:await readFile(process.env.HOWMUCH_TLS_KEY)},async(req,res)=>{
    const path=req.url.split('?')[0]; if(path.startsWith('/api/')||path.startsWith('/v1/')||path.startsWith('/agent/'))return api.phone(req,res);
    const asset=path==='/'?'index.html':/^\/assets\/[\w.-]+\.(js|css|svg|png|woff2)$/.test(path)?path.slice(1):null;
    if(!asset || req.method!=='GET')return json(res,404,{error:'not_found'});
    try { const bytes=await readFile(resolve('dist',asset)); res.writeHead(200,{'content-type':({html:'text/html',js:'text/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png',woff2:'font/woff2'})[asset.split('.').at(-1)],'referrer-policy':'no-referrer','x-content-type-options':'nosniff','cache-control':'no-store'});res.end(bytes); }catch{return json(res,404,{error:'build_required'});}
  });server.listen(Number(url.port)||443,url.hostname,()=>console.log('HowMuch phone: '+origin));
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await start();
