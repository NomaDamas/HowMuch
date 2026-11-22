// Deterministic XR runtime + real Chromium WebGL. Checks frame submission, not hardware accuracy.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});let browser;
try{
 await server.listen();browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.httpServer.address().port);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.evaluate(async()=>{
  const React=(await import('/node_modules/.vite/deps/react.js')).default, {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default,Button=(await import('/src/WorldAnchorButton.jsx')).default;
  const ident=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]),transform=()=>({matrix:ident(),inverse:{matrix:ident()},position:{x:0,y:0,z:-1}});
  const reference=new EventTarget(),space={},anchorSpace={},state={draws:[],hidden:false,hit:true,anchors:0,deletes:0,stops:0,starts:0};
  const orig=WebGLRenderingContext.prototype.drawArrays;WebGLRenderingContext.prototype.drawArrays=function(...args){state.draws.push(args);return orig.apply(this,args)};
  WebGLRenderingContext.prototype.makeXRCompatible=async()=>{};
  Object.defineProperty(window,'XRWebGLLayer',{configurable:true,value:class{get framebuffer(){return null}getViewport(){return {x:0,y:0,width:256,height:128}}}});
  const session=new EventTarget();Object.assign(session,{end:async()=>session.dispatchEvent(new Event('end')),requestReferenceSpace:async kind=>kind==='local'?reference:space,requestHitTestSource:async()=>({cancel(){state.cancelled=true}}),updateRenderState:()=>{},requestAnimationFrame:cb=>state.next=cb});
  const xr=new EventTarget();Object.assign(xr,{isSessionSupported:async()=>true,requestSession:async()=>session});Object.defineProperty(navigator,'xr',{value:xr,configurable:true});
  const hit={getPose:()=>({transform:transform()}),createAnchor:async()=>{state.anchors++;return {anchorSpace,delete(){state.deletes++}}}};
  const frame={getHitTestResults:()=>state.hit?[hit]:[],getViewerPose:()=>({transform:transform(),views:[{transform:transform(),projectionMatrix:ident()}]}),getPose:(space,ref)=>space===anchorSpace&&ref===reference&&!state.hidden?{transform:transform()}:null};
  const root=document.createElement('div');document.body.replaceChildren(root);
  createRoot(root).render(React.createElement(Button,{title:'동전',price:'₩1,000',onSessionStart:()=>state.starts++,onSessionEnd:()=>state.stops++}));
  window.xrTest={step:()=>state.next?.(0,frame),select:()=>session.dispatchEvent(new Event('select')),state};
 });
 await page.getByRole('button',{name:'고정된 상품 옆에 AR로 배치'}).click();
 await page.waitForFunction(()=>!!window.xrTest.state.next);
 await page.evaluate(()=>{window.xrTest.step();window.xrTest.select();window.xrTest.step()});
 await page.waitForFunction(()=>window.xrTest.state.anchors===1);
 const got=await page.evaluate(()=>{const {state,step}=window.xrTest;state.hit=false;step();const n=state.draws.length;state.hidden=true;step();const missing=state.draws.length;state.hidden=false;step();return [n,missing,state.draws.length]});
 assert.ok(got[0]>=3);assert.equal(got[1],got[0]);assert.equal(got[2],got[1]+1);
 await page.getByRole('button',{name:'AR 닫기'}).click();
 assert.deepEqual(await page.evaluate(()=>{const {state}=window.xrTest;return [state.starts,state.stops,state.deletes,state.cancelled]}),[1,1,1,true]);assert.deepEqual(errors,[]);
 console.log('PASS: real WebGL reticle and anchored price billboard, lost/reacquired anchor, session cleanup (simulated XR poses).');
} finally {await browser?.close();await server.close()}
