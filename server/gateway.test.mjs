import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {spawn} from 'node:child_process';
import {gateway,researchAgent} from './analyze.mjs';
import {HowMuchClient} from '../sdk/howmuch-client.mjs';

const image='data:image/png;base64,AA';
const input={imageDataUrl:image,cutoutDataUrl:'data:image/png;base64,AQ',selection:{x:.1,y:.1,width:.4,height:.4},locale:'ko-KR'};
const json=(url,payload,headers={})=>fetch(url,{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify(payload)});
async function server(t){
 const app=http.createServer();app.listen(0,'127.0.0.1');await once(app,'listening');
 t.after(()=>{app.closeAllConnections();return new Promise(r=>app.close(r))});
 return {app,url:'http://127.0.0.1:'+app.address().port};
}
async function fixture(t,opts={}){
 const desktop=await server(t),phone=await server(t); const httpsOrigin=phone.url.replace('http:','https:');
 const routes=gateway({phoneOrigin:httpsOrigin,research:async()=>({status:'no_result',offers:[]}),...opts});
 desktop.app.on('request',routes.host);phone.app.on('request',routes.phone);
 async function issue(){
  const issued=await json(desktop.url+'/v1/pairing/sessions',{});assert.equal(issued.status,201);
  const url=new URL((await issued.json()).url);assert.equal(url.origin,httpsOrigin);assert.equal(url.search,'');
  const [sessionId,token]=url.hash.slice('#pair='.length).split('.');
  return {sessionId,exchange:()=>json(phone.url+'/v1/pairing/exchange',{sessionId,token},{origin:httpsOrigin})};
 }
 async function client(){const invite=await issue();const r=await invite.exchange();assert.equal(r.status,200);const raw=r.headers.get('set-cookie');assert.match(raw,/Secure; HttpOnly; SameSite=Strict/);return {...invite,headers:{cookie:raw.split(';')[0]}}}
 return {desktop,phone,issue,client};
}
test('phone TLS auth boundary, one-time link, job replay/isolation and revoke',async t=>{
 let seen;const f=await fixture(t,{research:async input=>(seen=input,{status:'no_result',offers:[]})});
 const a=await f.client(), b=await f.client();assert.equal((await a.exchange()).status,401);
 assert.equal((await json(f.phone.url+'/v1/pairing/sessions',{},a.headers)).status,404);
 assert.equal((await json(f.desktop.url+'/v1/pairing/sessions',{}, {origin:'https://foreign.example'})).status,403);
 assert.equal((await json(f.phone.url+'/api/research',input)).status,401);
 const accepted=await json(f.phone.url+'/api/jobs',input,a.headers);assert.equal(accepted.status,202);const job=await accepted.json();
 const events=await fetch(f.phone.url+job.events,{headers:a.headers});assert.equal(events.status,200);
 const stream=await events.text();assert.deepEqual([...stream.matchAll(/"status":"(queued|running|completed)"/g)].map(m=>m[1]),['queued','running','completed']);assert.ok(!stream.includes('base64'));assert.deepEqual(seen,input);
 assert.equal((await fetch(f.phone.url+job.status,{headers:b.headers})).status,404);
 const resume=await (await fetch(f.phone.url+job.events,{headers:{...a.headers,'last-event-id':'2'}})).text();assert.match(resume,/completed/);assert.doesNotMatch(resume,/queued|running/);
 assert.equal((await fetch(f.phone.url+'/v1/pairing/sessions/'+a.sessionId,{method:'DELETE',headers:b.headers})).status,403);
 assert.equal((await fetch(f.desktop.url+'/v1/pairing/sessions/'+a.sessionId,{method:'DELETE'})).status,200);
 assert.equal((await fetch(f.phone.url+job.status,{headers:a.headers})).status,401);
});
test('segmentation forwards point, polygon and every mask; upstream status is preserved',async t=>{
 const upstream=await server(t);let error=false;let seen;
 upstream.app.on('request',async(req,res)=>{let s='';for await(const c of req)s+=c;seen=JSON.parse(s);res.writeHead(error?422:200,{'content-type':'application/json'});res.end(JSON.stringify(error?{error:'sensitive image detail'}:{selections:[1,2],maskDataUrl:image}))});
 const f=await fixture(t,{agentOrigin:upstream.url});const selection={...input.selection,polygon:[{x:.1,y:.1},{x:.2,y:.3},{x:.3,y:.1}]},payload={imageDataUrl:image,selection,point:{x:.12,y:.12}};
 let r=await json(f.desktop.url+'/agent/segment',payload);assert.deepEqual(await r.json(),{selections:[1,2],maskDataUrl:image});assert.deepEqual(seen,payload);
 const phone=await f.client(), propagated={imageDataUrl:image,propagation:{previousImageDataUrl:'data:image/png;base64,AQ==',selection:{...selection,contours:[selection.polygon]}}};
 assert.equal((await json(f.phone.url+'/agent/segment',propagated)).status,401);
 assert.equal((await json(f.phone.url+'/agent/segment',propagated,phone.headers)).status,200);assert.deepEqual(seen,propagated);
 error=true;r=await json(f.desktop.url+'/agent/segment',payload);assert.equal(r.status,422);assert.equal((await r.json()).error,'upstream_unavailable');
});
test('JS SDK follows jobs and SSE; Python SDK and MCP call the same running gateway',async t=>{
 const f=await fixture(t);const sdk=new HowMuchClient(f.desktop.url),job=await sdk.startJob(input), events=[];
 for await(const e of sdk.events(job.jobId))events.push(e);assert.equal(events.at(-1).result.status,'no_result');
 async function child(cmd,args,stdin,env={}){const proc=spawn(cmd,args,{env:{...process.env,...env},stdio:['pipe','pipe','pipe']});let out='',err='';proc.stdout.on('data',c=>out+=c);proc.stderr.on('data',c=>err+=c);const done=once(proc,'close');proc.stdin.end(stdin);const [code]=await done;assert.equal(code,0,err);return out.trim()}
 const py=await child('python3',['-c','import sys,json; from sdk.howmuch_client import HowMuchClient; c=HowMuchClient(sys.argv[1]); j=c.start_job(json.load(sys.stdin)); print(list(c.events(j["jobId"]))[-1]["result"]["status"])',f.desktop.url],JSON.stringify(input));assert.equal(py,'no_result');
 const rpc=(id,method,params)=>JSON.stringify({jsonrpc:'2.0',id,method,params});
 const replies=(await child(process.execPath,['server/mcp.mjs'],[rpc(1,'initialize',{protocolVersion:'2025-06-18'}),rpc(2,'tools/list',{}),rpc(3,'tools/call',{name:'research_object',arguments:input})].join('\n')+'\n',{HOWMUCH_API_URL:f.desktop.url})).split('\n').map(s=>JSON.parse(s));
 assert.equal(replies[0].result.protocolVersion,'2025-06-18');assert.equal(replies[1].result.tools[0].name,'research_object');assert.equal(JSON.parse(replies[2].result.content[0].text).status,'no_result');
});
test('research NDJSON exposes identification and market phases without leaking images',async t=>{
 const f=await fixture(t,{research:async(input,signal,onPhase)=>{ onPhase?.({phase:'researching',candidate:{name:'cup',confidence:.91}}); return {status:'complete',candidates:[{name:'cup',confidence:.91}],offers:[],tools:['visual_search'],startedAt:new Date().toISOString(),completedAt:new Date().toISOString()}; }});
 const r=await json(f.desktop.url+'/api/research',input,{accept:'application/x-ndjson'});assert.equal(r.headers.get('content-type'),'application/x-ndjson');const lines=(await r.text()).trim().split('\n').map(JSON.parse);assert.deepEqual(lines.map(x=>x.phase||'result'),['identifying','researching','result']);assert.equal(lines[1].candidate.name,'cup');assert.equal(lines[2].result.status,'complete');assert.ok(!JSON.stringify(lines).includes('base64'));
});
test('paired phone receives live phases before completion; plain JSON agent and disconnect are supported',{timeout:5000},async t=>{
 const upstream=await server(t),before=process.env.RESEARCH_AGENT_ENDPOINT;
 process.env.RESEARCH_AGENT_ENDPOINT=upstream.url;
 t.after(()=>{if(before===undefined)delete process.env.RESEARCH_AGENT_ENDPOINT;else process.env.RESEARCH_AGENT_ENDPOINT=before});
 const final={status:'no_result',candidates:[],offers:[],tools:['visual_search'],startedAt:new Date().toISOString(),completedAt:new Date().toISOString()};
 let mode='stream',finish,aborted;const disconnected=new Promise(r=>aborted=r);
 upstream.app.on('request',async(req,res)=>{
   let payload=''; for await(const chunk of req)payload+=chunk;
   if(mode==='legacy'){const forwarded=JSON.parse(payload);assert.equal(forwarded.labelDataUrl,image);assert.equal(forwarded.region,'서울');}
   if(mode==='legacy'){res.setHeader('content-type','application/json');res.end(JSON.stringify(final));return}
   res.writeHead(200,{'content-type':'application/x-ndjson'});
   if(mode==='abort'){res.on('close',aborted);res.flushHeaders();return}
   const bytes=Buffer.from(JSON.stringify({phase:'researching',candidate:{name:'한글',image:input.imageDataUrl}})+'\n');
   const split=bytes.indexOf(Buffer.from('한글'))+1;res.write(bytes.subarray(0,split));setImmediate(()=>res.write(bytes.subarray(split)));
   finish=()=>res.end(JSON.stringify({result:final}));
 });
 const f=await fixture(t,{research:researchAgent}),c=await f.client(),headers={...c.headers,accept:'application/x-ndjson'};
 const r=await json(f.phone.url+'/api/research',input,headers),reader=r.body.pipeThrough(new TextDecoderStream()).getReader();
 let text='';while(!text.includes('researching')){const part=await reader.read();assert.ok(!part.done);text+=part.value}
 assert.deepEqual(text.trim().split('\n').map(JSON.parse),[{phase:'identifying'},{phase:'researching',candidate:{name:'한글'}}]);
 finish();while(true){const part=await reader.read();if(part.done)break;text+=part.value}
 assert.equal(JSON.parse(text.trim().split('\n').at(-1)).result.status,'no_result');
 mode='legacy';const legacy=await json(f.phone.url+'/api/research',{...input,labelDataUrl:image,region:'서울'},headers);
 assert.deepEqual((await legacy.text()).trim().split('\n').map(s=>{const e=JSON.parse(s);return e.phase||e.result.status}),['identifying','no_result']);
 mode='abort';const abort=new AbortController(),second=await fetch(f.phone.url+'/api/research',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify(input),signal:abort.signal});
 await second.body.getReader().read();abort.abort();await disconnected;
});
