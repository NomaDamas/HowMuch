// HowMuch research/segmentation service. Research is agent-only (see agent-research.mjs); there is no crawler,
// browser, or search-engine scraping here. Segmentation (SAM) is separate and lives in segment.mjs.
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { agentResearch } from './agent-research.mjs';

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  createAgentServer().listen(Number(process.env.AGENT_PORT||8791),'127.0.0.1',()=>console.log('HowMuch local research agent ready'));
}
export function createAgentServer(runResearch=agentResearch){
  const jobs={'/agent/research':0,'/agent/segment':0};
  return http.createServer(async(req,res)=>{
    const disconnect=new AbortController();
    res.once('close',()=>{if(!res.writableEnded)disconnect.abort();});
    const send=(n,body)=>{if(res.destroyed)return;res.writeHead(n,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));};
    if(req.method!=='POST'||!['/agent/research','/agent/segment'].includes(req.url)) return send(404,{error:'not_found'});
    if(req.headers.origin || jobs[req.url]>=4) return send(req.headers.origin?403:429,{error:'agent_unavailable'});
    jobs[req.url]++;
    try {
      let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>25e6)return send(413,{error:'payload_too_large'});chunks.push(chunk);}
      let body;try{body=JSON.parse(Buffer.concat(chunks).toString());}catch{return send(400,{error:'invalid_json'});}
      if(req.url==='/agent/research' && req.headers.accept?.includes('application/x-ndjson')){
        res.writeHead(200,{'content-type':'application/x-ndjson','cache-control':'no-store','x-accel-buffering':'no'});
        const emit=event=>{if(!res.destroyed && !res.writableEnded)res.write(JSON.stringify(event)+'\n');};
        try{emit({result:await runResearch(body,{onPhase:emit,signal:disconnect.signal})});}catch{emit({error:'research_unavailable'});}
        return res.end();
      }
      const run=req.url==='/agent/segment'?(await import('./segment.mjs')).segment:runResearch;
      return send(200,await run(body,{signal:disconnect.signal}));
    } catch(e){return send([400,413,422,429,503,504].includes(e?.status)?e.status:502,{error:e?.status?String(e.message).slice(0,150):/^[a-z0-9_]{1,50}$/.test(e?.message)?e.message:'agent_failed'});} finally {jobs[req.url]--;}
  });
}
