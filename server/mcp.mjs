// MCP stdio transport: one JSON-RPC 2.0 message per line; stdout is protocol only.
import {createInterface} from 'node:readline';
import {isValidResearchInput} from './research-contract.mjs';
const name='research_object';
const schema={type:'object',properties:{imageDataUrl:{type:'string'},cutoutDataUrl:{type:'string'},labelDataUrl:{type:'string',description:'Optional close-up of a marking on the same selected object'},region:{type:'string',description:'Optional Korean retail market region'},selection:{type:'object',properties:Object.fromEntries(['x','y','width','height'].map(k=>[k,{type:'number'}])),required:['x','y','width','height']},locale:{type:'string'}},required:['imageDataUrl','cutoutDataUrl','selection','locale']};
const dest=new URL(process.env.HOWMUCH_API_URL||'http://127.0.0.1:8787');
if(dest.protocol!=='http:'||!['localhost','127.0.0.1','[::1]'].includes(dest.hostname))throw Error('MCP requires a loopback API');
async function rpc(req){
  if(!req||req.jsonrpc!=='2.0'||typeof req.method!=='string')return {jsonrpc:'2.0',id:req?.id??null,error:{code:-32600,message:'Invalid Request'}};
  if(req.id===undefined)return;
  const base={jsonrpc:'2.0',id:req.id}, ok=result=>({...base,result}), err=(code,message)=>({...base,error:{code,message}});
  if(req.method==='initialize')return ok({protocolVersion:['2024-11-05','2025-03-26','2025-06-18','2025-11-25'].includes(req.params?.protocolVersion)?req.params.protocolVersion:'2025-06-18',capabilities:{tools:{}},serverInfo:{name:'howmuch',version:'1.0.0'}});
  if(req.method==='ping')return ok({});
  if(req.method==='tools/list')return ok({tools:[{name,description:'Research a camera selection and return evidence-backed offers.',inputSchema:schema}]});
  if(req.method!=='tools/call')return err(-32601,'Method not found');
  if(req.params?.name!==name||!isValidResearchInput(req.params?.arguments))return err(-32602,'Invalid tool name or arguments');
  try{const r=await fetch(new URL('/api/research',dest),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(req.params.arguments),signal:AbortSignal.timeout((Number(process.env.RESEARCH_TIMEOUT_MS)||180000)+5000)});
    if(!r.ok)throw Error(); return ok({content:[{type:'text',text:JSON.stringify(await r.json())}]});
  }catch{return ok({isError:true,content:[{type:'text',text:'Research unavailable'}]});}
}
for await(const line of createInterface({input:process.stdin})){
  let reply;try{reply=await rpc(JSON.parse(line))}catch{reply={jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}}}
  if(reply)process.stdout.write(JSON.stringify(reply)+'\n');
}
