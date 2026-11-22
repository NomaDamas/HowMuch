// Uses a public merchant's own product photo (never a personal camera frame).
// Set VLM_BASE_URL, VLM_API_KEY and VLM_MODEL before running.
import { research } from './agent-runtime.mjs';
const image=await fetch('https://cdn-shop.adafruit.com/970x728/3333-00.jpg',{signal:AbortSignal.timeout(12000)});
if(!image.ok || !image.headers.get('content-type')?.includes('image/jpeg')) throw Error('Public sample photo unavailable');
const data='data:image/jpeg;base64,'+Buffer.from(await image.arrayBuffer()).toString('base64');
const r=await research({imageContext:{cutoutDataUrl:data,fullFrameDataUrl:data},locale:'en-US'});
console.log(JSON.stringify({status:r.status,names:r.candidates.map(x=>x.name),queries:r.queries,discovery:r.discovery,lowest:r.lowest,offers:r.offers.map(({title,url,price,currency,condition,availability,shipping,checkedAt})=>({title,url,price,currency,condition,availability,shipping:shipping??null,checkedAt}))},null,2));
if(!r.lowest) process.exitCode=1;
