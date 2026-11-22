// Deterministic XR runtime + real Chromium WebGL. Checks frame submission, not hardware accuracy.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
const server=await createServer({server:{host:'127.0.0.1',port:0},logLevel:'error'});let browser;
try{
 await server.listen();browser=await chromium.launch({args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.httpServer.address().port);
 const privacy=await page.evaluate(async()=>{
  const {captureMaskedSignature}=await import('/src/lib/xr-target.js'),{cutout}=await import('/src/lib/camera-scene.js');
  const x=300/960,y=200/720,w=13/960,h=250/720;
  const s={x,y,width:w,height:h,polygon:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}]};
  async function signature(bg){
   const c=document.createElement('canvas');c.width=960;c.height=720;const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,960,720);
   for(let j=0;j<250;j++){ctx.fillStyle=j%37<18?'white':'black';ctx.fillRect(300,200+j,13,1)}
   return await captureMaskedSignature(cutout(c,s),s,13/250);
  }
  const a=await signature('red'),b=await signature('lime');return [a,b];
 });
 assert.ok(privacy[0]?.pts.length>=8);assert.deepEqual(privacy[0],privacy[1],'background must not change a single native or WebXR signature sample');
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
  const {templateFrom}=await import('/src/lib/xr-target.js');
  const W=144,H=108,side=36,left=36,top=30;
  Object.assign(state,{objectX:left,away:false,depth:.8,time:0,cardDraws:0,autoAnchors:[],autoDeletes:0,features:[],cameraReads:0});
  function pixels(flip=false){
   const data=new Uint8Array(W*H*4);
   for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const i=4*(x+(flip?H-1-y:y)*W),dx=(x-state.objectX)/side,dy=(y-top)/side;
    const inObject=!state.away && dx>=0 && dx<1 && dy>=0 && dy<1;
    const bx=(x-96)/side,b2=bx>=0&&bx<1&&dy>=0&&dy<1;
    data.set(inObject?[60+160*dx,210-135*dy,30+150*(dx>.46&&dy>.28),255]:b2?[210-135*dy,35+160*bx,215-140*(dy>.34),255]:[18,21,25,255],i);
   }return data;
  }
  const target=templateFrom({data:pixels(),width:W,height:H},{x:left/W,y:top/H,width:side/W,height:side/H,polygon:[
    {x:left/W,y:top/H},{x:(left+side)/W,y:top/H},{x:(left+side)/W,y:(top+side)/H},{x:left/W,y:(top+side)/H}]});
  if(!target)throw Error('fixture has no texture');
  const target2=templateFrom({data:pixels(),width:W,height:H},{x:96/W,y:top/H,width:side/W,height:side/H,polygon:[[96,top],[132,top],[132,top+side],[96,top+side]].map(([x,y])=>({x:x/W,y:y/H}))});
  state.depthReads=0;state.labels=[];
  const fill=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(text,...rest){state.labels.push(text);return fill.call(this,text,...rest)};
  const baseDraw=WebGLRenderingContext.prototype.drawArrays;
  const uniform=WebGLRenderingContext.prototype.uniformMatrix4fv;
  WebGLRenderingContext.prototype.uniformMatrix4fv=function(loc,t,m){state.cardScreenX=m[12]/m[15];return uniform.call(this,loc,t,m)};
  WebGLRenderingContext.prototype.drawArrays=function(...args){if(!this.getParameter(this.FRAMEBUFFER_BINDING))state.cardDraws++;return baseDraw.apply(this,args);};
  Object.defineProperty(window,'XRWebGLBinding',{configurable:true,value:class{
   constructor(_session,gl){this.gl=gl;this.tex=gl.createTexture();}
   getCameraImage(){state.cameraReads++;const gl=this.gl;gl.bindTexture(gl.TEXTURE_2D,this.tex);
    for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);
    for(const p of [gl.TEXTURE_MIN_FILTER,gl.TEXTURE_MAG_FILTER])gl.texParameteri(gl.TEXTURE_2D,p,gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,W,H,0,gl.RGBA,gl.UNSIGNED_BYTE,pixels(true));return this.tex;}
  }});
  Object.defineProperty(window,'XRRigidTransform',{configurable:true,value:class{constructor(position){this.position={...position}}}});
  let activeSession=session;const spacePos=new Map();
  xr.requestSession=async(_,opts)=>{state.features.push(opts.requiredFeatures);if(opts.requiredFeatures.includes('camera-access')){
   activeSession=Object.assign(new EventTarget(),{requestReferenceSpace:async()=>reference,updateRenderState(){},requestAnimationFrame:cb=>state.next=cb,end:async()=>activeSession.dispatchEvent(new Event('end'))});
  }else activeSession=session;return activeSession;};
  const projection=ident();projection[10]=-1.02;projection[11]=-1;projection[14]=-.2;projection[15]=0;
  const pose=()=>{const m=ident(),inv=ident();if(state.orbit){
   // Quarter-turn around the established target: fixed center, identical on-screen silhouette.
   const p=state.autoAnchors[0];m[0]=m[10]=inv[0]=inv[10]=0;m[2]=inv[8]=-1;m[8]=inv[2]=1;
   m[12]=p.x-p.z;m[14]=p.z+p.x;inv[12]=m[14];inv[14]=-m[12];
  }else if(state.away){m[0]=m[10]=inv[0]=inv[10]=-1;}return {matrix:m,inverse:{matrix:inv}}};
  const autoFrame={getViewerPose:()=>({transform:pose(),views:[{camera:{width:W,height:H},transform:pose(),projectionMatrix:projection}]}),
   getDepthInformation:()=>{state.depthReads++;return {getDepthInMeters:(x,y)=>(x>=state.objectX/W && x<=(state.objectX+side)/W || x>=96/W && x<=132/W) && y>=top/H && y<=(top+side)/H?state.depth:NaN}},
   createAnchor:async({position})=>{const s={};spacePos.set(s,position);state.autoAnchors.push({...position});return {anchorSpace:s,delete(){spacePos.delete(s);state.autoDeletes++}};},
   getPose:(s,ref)=>spacePos.has(s)&&ref===reference?{transform:{position:spacePos.get(s)}}:null};
  const root=document.createElement('div');document.body.replaceChildren(root);
  const app=createRoot(root),props={onSessionStart:()=>state.starts++,onSessionEnd:()=>state.stops++};
  app.render(React.createElement(Button,{title:'동전',price:'₩1,000',target,...props}));
  window.multi=(price='조사 중',keep=true)=>app.render(React.createElement(Button,{objects:[...(keep?[{id:'a',title:'동전',price,target}]:[]),{id:'b',title:'컵',price:'₩500',target:target2}],compact:true,...props}));
  window.xrTest={step:()=>state.next?.(0,frame),autoStep:async(n,update={})=>{Object.assign(state,update);for(let i=0;i<n;i++){state.next?.(state.time+=160,autoFrame);await Promise.resolve();await Promise.resolve();}},reset:()=>reference.dispatchEvent(new Event('reset')),select:()=>session.dispatchEvent(new Event('select')),state};
 });
 await page.getByRole('button',{name:'표면 직접 배치'}).click();
 await page.waitForFunction(()=>!!window.xrTest.state.next);
 await page.evaluate(()=>{window.xrTest.step();window.xrTest.select();window.xrTest.step()});
 await page.waitForFunction(()=>window.xrTest.state.anchors===1);
 const got=await page.evaluate(()=>{const {state,step}=window.xrTest;state.hit=false;step();const n=state.draws.length;state.hidden=true;step();const missing=state.draws.length;state.hidden=false;step();return [n,missing,state.draws.length]});
 assert.ok(got[0]>=3);assert.equal(got[1],got[0]);assert.equal(got[2],got[1]+1);
 await page.getByRole('button',{name:'AR 닫기'}).click();
 assert.deepEqual(await page.evaluate(()=>{const {state}=window.xrTest;return [state.starts,state.stops,state.deletes,state.cancelled]}),[1,1,1,true]);assert.deepEqual(errors,[]);
 console.log('PASS: real WebGL reticle and anchored price billboard, lost/reacquired anchor, session cleanup (simulated XR poses).');
 await page.getByRole('button',{name:'상품 옆에 자동 3D 표시'}).click();
 await page.waitForFunction(()=>window.xrTest.state.features.at(-1)?.includes('depth-sensing'));
 const step=async(n,update)=>page.evaluate(async([n,u])=>{const t=window.xrTest;await t.autoStep(n,u);const s=t.state;return {a:s.autoAnchors,d:s.cardDraws,reads:s.cameraReads,deleted:s.autoDeletes};},[n,update]);
 const initial=await step(4,{});
 assert.ok(initial.reads>=3,'camera texture should be consumed');assert.ok(initial.a.length,'auto should place without a tap');assert.equal(initial.a[0].z,-.8);
 const originalX=await page.evaluate(()=>window.xrTest.state.cardScreenX);
 const orbit=await step(3,{orbit:true});assert.equal(orbit.a.length,initial.a.length,'orbit must not replace a stationary center anchor');
 const newX=await page.evaluate(()=>window.xrTest.state.cardScreenX);assert.ok(Math.abs(newX-originalX)<.002,'billboard should remain beside the silhouette in the current eye');
 await step(2,{orbit:false});
 const moved=await step(5,{objectX:46});assert.ok(moved.a.length>initial.a.length && moved.a.at(-1).x>initial.a[0].x+.05,'moving object should move the anchor in meters');
 const away=await step(4,{away:true});assert.equal(away.d,moved.d,'no billboard on turned-away view');
 const back=await step(4,{away:false});assert.ok(back.d>away.d,'same object visible again');
 await page.evaluate(()=>window.xrTest.reset());const reset=await step(3,{depth:NaN});assert.equal(reset.d,back.d,'reset plus absent depth must hide');
 const relock=await step(4,{depth:1.1});assert.equal(relock.a.at(-1)?.z,-1.1);
 await page.getByRole('button',{name:'AR 닫기'}).click();assert.deepEqual(await page.evaluate(()=>{const s=window.xrTest.state;return [s.starts,s.stops,s.autoDeletes,s.autoAnchors.length]}),[2,2,relock.a.length,relock.a.length]);
 assert.deepEqual(errors,[]);console.log('PASS: real camera texture → measured depth → automatic XR anchor, movement, occlusion and turn/reacquire, reference reset and session cleanup (simulated runtime).');
 await page.evaluate(()=>window.multi());await page.getByRole('button',{name:'공간 보기'}).click();
 await page.waitForFunction(()=>window.xrTest.state.starts===3);await page.waitForTimeout(50);
 const before=await page.evaluate(()=>{const s=window.xrTest.state;return {reads:s.cameraReads,depth:s.depthReads,d:s.cardDraws,a:s.autoAnchors.length}});
 const multi=await step(4,{objectX:36,away:false,depth:.8});
 assert.equal(multi.reads-before.reads,4);assert.equal(await page.evaluate(()=>window.xrTest.state.depthReads)-before.depth,4);assert.equal(multi.a.length-before.a,2);
 assert.equal(multi.d-before.d,6,'two cards rendered after two consistent frames');
 await page.evaluate(()=>window.multi('₩3,200'));await page.waitForTimeout(50);
 const updated=await step(1,{});assert.equal(updated.a.length,multi.a.length);assert.ok(await page.evaluate(()=>window.xrTest.state.labels.includes('₩3,200')));
 await page.evaluate(()=>window.multi('₩3,200',false));await page.waitForTimeout(50);
 const removed=await step(1,{});assert.equal(removed.deleted,updated.deleted+1);assert.equal(removed.d,updated.d+1);
 await page.getByRole('button',{name:'AR 닫기'}).click();assert.deepEqual(errors,[]);console.log('PASS: one XR session, shared camera/depth samples, two independent cards, live price texture update and removed job cleanup.');
} finally {await browser?.close();await server.close()}
