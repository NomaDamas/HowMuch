// Run with node scripts/camera-browser.mjs. A real Chromium tab uses a deterministic
// MediaStream. External providers are stubbed; this tests UI, not market coverage.
import assert from 'node:assert/strict';
import {chromium} from 'playwright';import {createServer} from 'vite';
const server=await createServer({server:{host:'127.0.0.1',port:0,hmr:false,watch:null},logLevel:'error'});let browser;
try{await server.listen();browser=await chromium.launch();const page=await browser.newPage({viewport:{width:375,height:720}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{const c=document.createElement('canvas');c.width=480;c.height=720;const ctx=c.getContext('2d');let lost=false;
 const draw=()=>{if(window.reviewScene){const k=window.reviewScene;ctx.fillStyle='#384858';ctx.fillRect(0,0,480,720);if(k!=='missing'){const moved=k==='moved',x=(moved?.68:.38)*480,y=(moved?.50:.35)*720,w=(moved?.25:.18)*480,h=(moved?.25:.18)*720;for(let i=0;i<4;i++)for(let j=0;j<4;j++){ctx.fillStyle=`rgb(${45+i*50},${25+j*62},${45+(i+j)%3*65})`;ctx.fillRect(x+i*w/4,y+j*h/4,w/4+1,h/4+1)}}return;}ctx.fillStyle=lost?'#e4fbf8':'#102430';ctx.fillRect(0,0,480,720);if(!lost){for(let j=0;j<720;j+=7)for(let i=0;i<480;i+=7){ctx.fillStyle='rgb('+[(i*j+3*i+j)%255,(j*9+i)%255,(i*2+j*3)%255]+')';ctx.fillRect(i,j,7,7)}}};
 window.setLost=x=>{lost=x;window.fixtureLost=x;draw()};draw();setInterval(draw,100);Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>c.captureStream(10)});
});
const segmentRequests=[],researchRequests=[],pending=[];let trial=false,trialEmpty=0,trialSuccess=0,holdPrice=false,releasePrice,holdManual=false,releaseManual,manualKind='product',sampleCutout,reshape=false,requireLabel=false;
const shape=(x,y,kind='product')=>({x,y,width:.18,height:.18,kind,polygon:[{x,y},{x:x+.18,y:y+.02},{x:x+.15,y:y+.18},{x,y:y+.14}]});
await page.route('**/agent/segment',async route=>{const p=route.request().postDataJSON();segmentRequests.push(p);if(trial&&p.propagation){const moved=await page.evaluate(()=>window.reviewScene==='moved');let selections=[];if(moved){const s=p.propagation.selection,map=v=>({x:.68+(v.x-.38)*.25/.18,y:.5+(v.y-.35)*.25/.18});selections=[{...s,x:.68,y:.5,width:.25,height:.25,polygon:s.polygon.map(map),contours:s.contours?.map(r=>r.map(map))}];trialSuccess++}else{trialEmpty++}await route.fulfill({json:{selections,selection:selections[0]??null,mode:'video_propagation'}});return;}if((p.point||p.selection)&&holdManual){holdManual=false;await new Promise(resolve=>releaseManual=resolve)}const list=p.propagation?(await page.evaluate(()=>window.fixtureLost)?[]:[structuredClone(p.propagation.selection)]):p.point||p.selection?[shape(.38,.35,manualKind)]:[shape(.2,.28),shape(.59,.52)];
 list.forEach(s=>{if(reshape){s.polygon[2].x-=.035;s.polygon[2].y-=.018;}s.contours=[s.polygon,s.polygon.map(p=>({x:s.x+s.width*.35+(p.x-s.x)*.25,y:s.y+s.height*.35+(p.y-s.y)*.25}))];if(sampleCutout)s.cutoutDataUrl=sampleCutout;});await route.fulfill({json:{selections:list,selection:list[0],model:'test'}}).catch(()=>{})});
await page.route('**/api/research',async route=>{const n=researchRequests.length;researchRequests.push(route.request().postDataJSON());if(holdPrice){holdPrice=false;await new Promise(r=>releasePrice=r)}if(n===0)await new Promise(r=>pending.push(r));const t=new Date().toISOString();
 if(requireLabel && !researchRequests[n].labelDataUrl)return route.fulfill({json:{candidates:[{name:'안경',confidence:1}],offers:[],pricingMode:'exact_model',status:'followup_required',followup:{reason:'exact_model_not_visible',prompt:'라벨을 비춰 주세요.'},startedAt:t,completedAt:t,tools:['identify_object']}});
 const a={id:'ref',title:'Kettle 1L',merchant:'fixture shop',condition:'new',price:30,currency:'USD',url:'https://example.org/item',confidence:.9,evidence:['Listed new · 30 USD'],checkedAt:t};
 await route.fulfill({json:{candidates:[{name:'Kettle',confidence:.9}],offers:[a],lowest:a,startedAt:t,completedAt:t,tools:['fixture'],status:'complete'}}).catch(()=>{})});
await page.goto(server.resolvedUrls.local[0]);await page.waitForFunction(()=>document.querySelector('video')?.readyState>=2);sampleCutout=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=24;c.height=24;const ctx=c.getContext('2d');ctx.fillRect(5,5,12,12);return c.toDataURL()});await page.waitForTimeout(1600);assert.equal(segmentRequests.length,0);
await page.waitForFunction(()=>document.querySelectorAll('.card').length===2,{},{timeout:15000});await page.locator('.card[data-phase="complete"]').waitFor();assert.equal(await page.locator('.card[data-phase="identifying"]').count(),1);
assert(researchRequests.length>=2);assert.equal(researchRequests[0].cutoutDataUrl,sampleCutout);assert(researchRequests[0].imageDataUrl.startsWith('data:image/jpeg;'));assert.equal(researchRequests[0].selection.x,.2);const original=await page.locator('.contours path').first().getAttribute('d');assert.equal(original.split('Z').length,3);await page.waitForTimeout(600);assert.equal(await page.locator('.contours path').first().getAttribute('d'),original);
await page.evaluate(()=>window.setLost(true));await page.waitForFunction(()=>document.querySelectorAll('.card').length===0);pending.shift()();await page.waitForTimeout(1700);assert(segmentRequests.some(p=>p.propagation?.previousImageDataUrl),'auto SAM refresh after losing lock');assert.equal(await page.locator('.card').count(),0);
await page.evaluate(()=>window.setLost(false));await page.waitForFunction(()=>document.querySelectorAll('.card').length===2);
const identity=await page.locator('.card').first().getAttribute('data-object-id'),contour=await page.locator('.contours path').first().getAttribute('d');reshape=true;const existingScans=segmentRequests.length;await page.waitForFunction(()=>!!document.querySelector('.card[data-phase="complete"]'));const deadline=Date.now()+12500;while(segmentRequests.length===existingScans&&Date.now()<deadline)await page.waitForTimeout(150);assert(segmentRequests.length>existingScans,'auto discover repeats on a steady view');await page.waitForFunction(d=>document.querySelector('.contours path')?.getAttribute('d')!==d,contour);assert.equal(await page.locator('.card').first().getAttribute('data-object-id'),identity);assert.equal(researchRequests.length,2,'same tracked objects reuse prices');assert.match(await page.locator('.card').first().innerText(),/단일 판매가 · 상품가 기준/);await page.setViewportSize({width:320,height:620});await page.waitForTimeout(250);for(const card of await page.locator('.card').all()){const b=await card.boundingBox();assert(b.x>=0&&b.x+b.width<=321&&b.y>=0&&b.y+b.height<=621)}
await page.locator('.card').first().click();await page.getByRole('dialog',{name:'가격 근거'}).waitFor();assert.match(await page.locator('.sheet').innerText(),/Listed new · 30 USD/);await page.getByRole('button',{name:'카메라로 돌아가기'}).click();
const mode=m=>page.getByRole('button',{name:m,exact:true}).click(), list=page.getByRole('dialog',{name:'조사 목록'}), closeList=()=>list.getByRole('button',{name:'카메라로 돌아가기'}).click();
const openList=()=>page.getByRole('button',{name:/^조사 목록/}).click();
const cancelInList=async id=>{await openList();await list.getByRole('button',{name:'목록에서 물체 '+id+' 조사 취소',exact:true}).click();await closeList()};
const tap=()=>page.mouse.click(38,425); const waitN=(n)=>page.waitForFunction(n=>document.querySelectorAll('.card').length===n,n);
await mode('터치·그리기');await waitN(2); // finished automatic jobs survive mode transitions
const invalidBefore=segmentRequests.length;
await page.evaluate(()=>{document.querySelector('video').srcObject.getVideoTracks()[0].enabled=false;});
await waitN(0);await tap();await page.waitForTimeout(200);assert.equal(segmentRequests.length,invalidBefore,'disabled camera does not submit');
await page.evaluate(()=>{document.querySelector('video').srcObject.getVideoTracks()[0].enabled=true;});await waitN(2);
await page.evaluate(()=>{const v=document.querySelector('video');Object.defineProperty(v,'videoHeight',{value:0,configurable:true});});
const zeroManual=segmentRequests.filter(p=>p.point||p.selection).length;await waitN(0);await tap();await page.waitForTimeout(200);assert.equal(segmentRequests.filter(p=>p.point||p.selection).length,zeroManual,'zero-dimension camera does not submit manual selection');
await page.evaluate(()=>{delete document.querySelector('video').videoHeight;});await waitN(2);
const autoIds=await page.locator('.card').evaluateAll(ns=>ns.map(n=>n.dataset.objectId));
holdManual=true;await tap();await page.waitForTimeout(120);assert(releaseManual,'manual segmentation pending');
await mode('자동');const idBefore=new Set(autoIds);releaseManual();await waitN(3);
const manualId=(await page.locator('.card').evaluateAll(ns=>ns.map(n=>n.dataset.objectId))).find(id=>!idBefore.has(id));
assert(manualId,'pending manual subject finishes after mode change');
await mode('터치·그리기'); await tap(); await waitN(4);
const four=await page.locator('.card').evaluateAll(ns=>ns.map(n=>n.dataset.objectId));const nBeforeCap=segmentRequests.length;
await tap();await page.waitForTimeout(180);assert.equal(segmentRequests.length,nBeforeCap,'fifth selection does not issue request');await waitN(4);
await cancelInList(manualId);await waitN(3);assert.deepEqual(await page.locator('.card').evaluateAll(ns=>ns.map(n=>n.dataset.objectId)),four.filter(id=>id!==manualId),'cancel one overlapping manual track only');
await page.evaluate(()=>window.setLost(true));await waitN(0);const beforeLossRefresh=segmentRequests.filter(p=>p.propagation).length;await page.waitForTimeout(1700);assert(segmentRequests.filter(p=>p.propagation).length>beforeLossRefresh,'manual-mode SAM refresh after losing lock');await cancelInList(autoIds[0]);await page.evaluate(()=>window.setLost(false));await waitN(2);
for(const id of four.filter(id=>id!==manualId&&id!==autoIds[0]))await cancelInList(id);await waitN(0);
// Two same-pixel manual gestures may be pending at once. Resolve the newer seed
// first; cancel its pending price, then the older pending seed. Neither late result may resurrect.
holdManual=true;await tap();await page.waitForTimeout(140);const releaseOlder=releaseManual;
holdManual=true;await tap();await page.waitForTimeout(140);const releaseNewer=releaseManual;assert.notEqual(releaseOlder,releaseNewer);
await openList();const heldIds=await list.getByRole('button',{name:/조사 취소/}).evaluateAll(ns=>ns.map(n=>n.getAttribute('aria-label').match(/물체 (\d+)/)[1]));assert.equal(heldIds.length,2);await closeList();
holdPrice=true;releaseNewer();await waitN(1);await page.locator('.card[data-phase="identifying"]').waitFor();assert(releasePrice);
await cancelInList(heldIds[1]);await cancelInList(heldIds[0]);releaseOlder();releasePrice();await page.waitForTimeout(250);await waitN(0);await openList();assert.equal(await list.locator('.job-row').count(),0);await closeList();
// Two freehand selections, not just point prompts. The first price is still
// pending when the second finishes. Removing the second leaves the first live.
const draw=async(dx)=>{await page.mouse.move(25+dx,365);await page.mouse.down();await page.mouse.move(60+dx,375,{steps:4});await page.mouse.move(45+dx,410,{steps:4});await page.mouse.move(25+dx,365,{steps:4});await page.mouse.up();};
holdPrice=true;releasePrice=null;await draw(0);await page.locator('.card[data-phase="identifying"]').waitFor();
const firstDrawing=await page.locator('.card').getAttribute('data-object-id');
await draw(16);await waitN(2);await page.locator('.card[data-phase="complete"]').waitFor();
assert.equal(await page.locator('.card[data-phase="identifying"]').getAttribute('data-object-id'),firstDrawing);
await cancelInList(await page.locator('.card[data-phase="complete"]').getAttribute('data-object-id'));
releasePrice();await waitN(1);await page.locator('.card[data-phase="complete"]').waitFor();
assert.equal(await page.locator('.card').getAttribute('data-object-id'),firstDrawing);await cancelInList(firstDrawing);
// Manual-only regression: first SAM propagation cannot recover the object; the
// details sheet interrupts retries. Its return at a new scale/position must update
// the old mask without sending another price request or adopting a new track ID.
trial=true;await page.evaluate(()=>{window.reviewScene='original'});await page.waitForTimeout(350);await tap();await page.locator('.card[data-phase="complete"]').waitFor();
const trialId=await page.locator('.card').getAttribute('data-object-id'),trialPrices=researchRequests.length,oldPath=await page.locator('.contours path').getAttribute('d');
await page.evaluate(()=>{window.reviewScene='missing'});await waitN(0);
for(let n=0;n<35&&!trialEmpty;n++)await page.waitForTimeout(200);assert(trialEmpty,'first video propagation returned no mask');
await openList();await list.locator('.job-row button').first().click();const sheet=page.getByRole('dialog',{name:'가격 근거'});await sheet.waitFor();
await page.evaluate(()=>{window.reviewScene='moved'});await page.waitForTimeout(5000);assert.equal(trialSuccess,0,'no propagation while details sheet is open');
await sheet.getByRole('button',{name:'카메라로 돌아가기'}).click();await waitN(1);assert(trialSuccess,'SAM recovered shifted scaled manual object');
assert.equal(await page.locator('.card').getAttribute('data-object-id'),trialId);assert.notEqual(await page.locator('.contours path').getAttribute('d'),oldPath);
assert.equal(researchRequests.length,trialPrices,'recovered original item reuses its price');await cancelInList(trialId);
trial=false;await page.evaluate(()=>{window.reviewScene=null});await page.waitForTimeout(300);
const before=segmentRequests.length;await page.mouse.move(55,260);await page.mouse.down();await page.mouse.move(90,250,{steps:8});await page.waitForTimeout(800);assert.equal(segmentRequests.length,before,'long press must not fire during drag');await page.mouse.move(150,285,{steps:8});await page.mouse.move(90,340,{steps:8});await page.mouse.move(55,260,{steps:8});await page.mouse.up();await waitN(1);assert(segmentRequests.at(-1).selection.polygon.length>=4);assert.equal(segmentRequests.length,before+1);
await cancelInList(await page.locator('.card').getAttribute('data-object-id'));await page.mouse.move(95,320);await page.mouse.down();await page.waitForTimeout(740);await page.mouse.up();await waitN(1);assert.equal(segmentRequests.length,before+2);assert(segmentRequests.at(-1).point?.x>0);await cancelInList(await page.locator('.card').getAttribute('data-object-id'));
requireLabel=true;
await page.mouse.click(100,320);const needsLabel=page.locator('.card[data-phase="followup_required"]');await needsLabel.waitFor();await needsLabel.click();
await page.getByRole('button',{name:'같은 상품의 라벨 추가 촬영'}).click();const originalInput=researchRequests.at(-1);
await page.getByRole('button',{name:'라벨 촬영 · 다시 식별'}).click();await page.getByRole('dialog',{name:'가격 근거'}).getByText('Listed new · 30 USD').waitFor();
const {labelDataUrl,...retried}=researchRequests.at(-1);assert.match(labelDataUrl,/^data:image\/jpeg;base64,/);assert.deepEqual(retried,originalInput,'close-up keeps original mask and scene');
await page.getByRole('button',{name:'카메라로 돌아가기'}).click();await cancelInList(await page.locator('.card').getAttribute('data-object-id'));
const previous=researchRequests.length;manualKind='person';await page.mouse.click(100,320);await page.locator('.card[data-phase="person"]').waitFor();assert.equal(researchRequests.length,previous);await page.getByRole('button',{name:'설정'}).click();await page.getByRole('checkbox').check();await page.getByRole('button',{name:'카메라로 돌아가기'}).click();assert.match(await page.locator('.card').innerText(),/놀이 코인/);await page.evaluate(async()=>{const {trackPreview}=await import('/src/lib/preview-track.js');const c=document.createElement('canvas');c.width=160;c.height=120;const ctx=c.getContext('2d');ctx.fillStyle='#566';ctx.fillRect(0,0,160,120);const v=document.createElement('video');v.muted=true;const stream=c.captureStream(10);v.srcObject=stream;const redraw=setInterval(()=>ctx.fillRect(0,0,160,120),90);await v.play();const s={x:.35,y:.35,width:.3,height:.3,polygon:[{x:.35,y:.35},{x:.65,y:.35},{x:.65,y:.65},{x:.35,y:.65}]};const updates=[];const stop=trackPreview(v,s,p=>updates.push(p));try{await new Promise(r=>setTimeout(r,800));if(updates.some(p=>!p||p.x!==s.x||p.y!==s.y))throw Error('uniform frame drift');const {cutout}=await import('/src/lib/camera-scene.js');const ring=[{x:.42,y:.42},{x:.58,y:.42},{x:.58,y:.58},{x:.42,y:.58}];const img=new Image();img.src=cutout(c,{...s,contours:[s.polygon,ring]});await img.decode();const probe=document.createElement('canvas');probe.width=img.width;probe.height=img.height;const px=probe.getContext('2d');px.drawImage(img,0,0);if(px.getImageData(img.width/2,img.height/2,1,1).data[3]!==0||px.getImageData(4,4,1,1).data[3]!==255)throw Error('cutout hole not preserved')}finally{stop();clearInterval(redraw);stream.getTracks().forEach(t=>t.stop());}});assert.deepEqual(errors,[]);console.log('PASS: independent auto/manual SAM refresh; overlapping manual requests with reverse cancellation; preserved pending requests on mode switch; four-slot cap; offscreen cancellation; disabled/zero-size media; mask holes, pricing and label evidence, long press, person mode.');
}finally{await browser?.close();await server.close();}
