import React,{useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ScanLine,Settings,Hand,Crosshair,Camera,List,Compass} from 'lucide-react';
import Pairing from './Pairing.jsx';
import {previewTemplate,captureMaskedSignature} from './lib/xr-target.js';
import WorldAnchorButton from './WorldAnchorButton.jsx';
import {summarizeCard,spatialHandoff} from './lib/price-card.js';
import {discoveryLabel} from './lib/market-display.js';
import {HttpResearchProvider,HttpTrackProvider,HttpSegmentationProvider,providerConfig} from './lib/providers';
import {normalizePolygon,screenToMediaSelection} from './lib/geometry.js';
import {snapshot,cutout,toScreen,overlap,sampleFrame,distance,boxForHud,clamp} from './lib/camera-scene.js';
import {recordAnonymousEvent} from './lib/telemetry.js';
import {trackPreview} from './lib/preview-track.js';
import GhostLayer from './GhostLayer.jsx';
import {gyroSupported,needsGyroPermission,requestGyro} from './lib/gyro-world.js';
import './app.css';
import {t,useLang,locale} from './lib/i18n.js';
import {ItemBar,Hud,Leader,Detail,ItemsSheet,SettingsSheet,StarGate,StarSheet,shouldAskStar,imageSearchOn,nameOf,stateText,priceOf} from './ui.jsx';

// The research agents read the pictures at a few hundred pixels anyway; sending camera-sized images only adds upload and vision time.
const shrinkCanvas=(c,max)=>{const k=Math.min(1,max/Math.max(c.width,c.height));if(k>=1)return c;const o=document.createElement('canvas');o.width=Math.round(c.width*k);o.height=Math.round(c.height*k);o.getContext('2d').drawImage(c,0,0,o.width,o.height);return o};
const shrinkDataUrl=(url,max)=>new Promise(res=>{const i=new Image();i.onload=()=>{try{const c=document.createElement('canvas');c.width=i.naturalWidth;c.height=i.naturalHeight;c.getContext('2d').drawImage(i,0,0);const out=shrinkCanvas(c,max);res(out===c?url:out.toDataURL('image/png'))}catch{res(url)}};i.onerror=()=>res(url);i.src=url});
const MIN_AREA=.003; // below ~0.3% of the frame a selection is a sliver (a cable, an edge), not an object
const MAX_JOBS=4;
// Compare the captured scene to the original mask's interior samples, not its
// bounding rectangle. A look-alike or textureless lost target cannot regain a price by IoU alone.
function appearanceCost(ref,frame,s){
 if(!ref?.pts?.length)return Infinity;
 const c=document.createElement('canvas');c.width=160;c.height=Math.max(1,Math.round(frame.height*160/frame.width));
 const ctx=c.getContext('2d');ctx.drawImage(frame,0,0,c.width,c.height);const d=ctx.getImageData(0,0,c.width,c.height).data;
 const e=ref.pts.map(([u,v,r,g,b])=>{const x=Math.min(c.width-1,Math.max(0,Math.floor((s.x+(u+.5)*s.width)*c.width))),y=Math.min(c.height-1,Math.max(0,Math.floor((s.y+(v+.5)*s.height)*c.height))),k=4*(y*c.width+x);return(Math.abs(d[k]-r)+Math.abs(d[k+1]-g)+Math.abs(d[k+2]-b))/3}).sort((a,b)=>a-b);
 return e[Math.floor(e.length*.65)];
}
const canCapture=video=>!!(video?.videoWidth&&video.videoHeight&&video.readyState>=2&&video.srcObject?.getVideoTracks().some(t=>t.readyState==='live'&&t.enabled&&!t.muted));
const person=s=>/^(person|human|사람)$/i.test(String(s.kind||s.category||s.label||s.type||'').trim())||s.isPerson===true;
function funPref(){try{return localStorage.getItem('howmuch-fun')!=='off'}catch{return true}}
function preferred(){try{return localStorage.getItem('howmuch-mode')==='draw'?'draw':'auto'}catch{return 'auto'}}
function note(event){recordAnonymousEvent(event);try{
 const key='howmuch-usage-v1', day=new Date().toLocaleDateString('sv-SE'), prev=JSON.parse(localStorage.getItem(key)||'{}'), days=prev.days||{};
 days[day]=(days[day]||0)+1;localStorage.setItem(key,JSON.stringify({days:Object.fromEntries(Object.entries(days).slice(-31)),scans:(prev.scans||0)+(event.outcome==='success'?1:0)}));
 }catch{}}
function App(){
 const v=useRef(null),stage=useRef(null),pen=useRef(null),stream=useRef(null),alive=useRef(true),cameraJob=useRef(0);
 const segmentController=useRef(null),ignored=useRef([]);
 useLang();
 const [list,setList]=useState(false),[gyro,setGyro]=useState(false),[filter,setFilter]=useState(null),[gate,setGate]=useState(shouldAskStar),[starSheet,setStarSheet]=useState(false);
 useEffect(()=>{if(gyroSupported()&&!needsGyroPermission())setGyro(true)},[]);
 const motionAsked=useRef(false);
 // iOS only grants motion access from a tap: ask on the first tap anywhere, so spatial memory is on without hunting for a button.
 function askMotion(){if(motionAsked.current||gyro||!needsGyroPermission())return;motionAsked.current=true;requestGyro().then(ok=>{if(ok)setGyro(true)})}
 async function toggleGyro(){if(gyro){setGyro(false);return}setGyro(await requestGyro());}
 const jobs=useRef(new Map()),epoch=useRef(0),sequence=useRef(0),gesture=useRef(null),fade=useRef(),hold=useRef(),since=useRef(0);
 const [items,redraw]=useState([]),[size,setSize]=useState({width:1,height:1}),[measured,setMeasured]=useState({}),[ready,setReady]=useState(false);
 const [mode,setMode]=useState(preferred),[cameraError,setCameraError]=useState(''),[hint,setHint]=useState(''),[settings,setSettings]=useState(false),[pair,setPair]=useState(false),[fun,setFun]=useState(funPref),[detail,setDetail]=useState(null);

 const spatial=useRef(false),captureRef=useRef(null),sheetRef=useRef(null);sheetRef.current=detail;
 const [captureId,setCaptureId]=useState(null);
 const funRef=useRef(funPref());
 const mint=()=>({price:(1+Math.floor(Math.random()*9999))*1000,vibe:'person.vibe'+Math.floor(Math.random()*6)});
 function enableFun(value){try{localStorage.setItem('howmuch-fun',value?'on':'off')}catch{}funRef.current=value;setFun(value);for(const o of jobs.current.values()){if(o.phase==='person')o.coins=value?(o.coins??mint()):null;}sync()}
 const sync=()=>{if(alive.current)redraw(Array.from(jobs.current.values(),o=>({...o})))};
 useEffect(()=>{if(!ready)return;let last=canCapture(v.current);
   const timer=setInterval(()=>{const next=canCapture(v.current);if(next!==last){last=next;sync()}},150);
   return()=>clearInterval(timer)},[ready]);
 function wipe(){clearTimeout(hold.current);clearTimeout(fade.current);gesture.current=null;const c=pen.current;if(c){c.getContext('2d').clearRect(0,0,c.width,c.height);c.classList.remove('fade')}}
 function cancelJob(id){const o=jobs.current.get(id);if(!o)return;if(o.position)ignored.current=[...ignored.current.slice(-7),o.position];stopTrack(o);o.controller?.abort();jobs.current.delete(id);if(detail===id)setDetail(null);sync();setHint(t('hint.cancelled'));}
 const startCamera=async()=>{const id=++cameraJob.current;setCameraError('');try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error(t('cam.https'));
  const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
  if(id!==cameraJob.current||!alive.current){s.getTracks().forEach(t=>t.stop());return}
  stream.current?.getTracks().forEach(t=>t.stop());stream.current=s;v.current.srcObject=s;await v.current.play();if(alive.current)setReady(true);
 }catch(e){if(alive.current&&id===cameraJob.current)setCameraError(e.name==='NotAllowedError'?t('cam.denied'):e.message||t('cam.error'))}};
 useEffect(()=>{alive.current=true;note({mode,outcome:'session'});return()=>{alive.current=false;++epoch.current;++cameraJob.current;wipe();stream.current?.getTracks().forEach(t=>t.stop());segmentController.current?.abort();for(const o of jobs.current.values()){stopTrack(o);o.controller?.abort()}}},[]);
 useEffect(()=>{if(!gate&&alive.current&&!stream.current)void startCamera()},[gate]);
 useLayoutEffect(()=>{const ro=new ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:entry.contentRect.height}));ro.observe(stage.current);return()=>ro.disconnect()},[]);
 const research=async(o,source,labelDataUrl,modelHint)=>{
   const live=()=>jobs.current.get(o.id)===o&&alive.current;
   const start=performance.now(); o.phase='identifying'; o.error=null; o.result=null; o.activity=[]; sync();
   const onPhase=e=>{if(!live())return;
     if(e.phase==='researching'){o.phase='loading';o.candidate=e.candidate||o.candidate;sync()}
     else if(e.phase==='preliminary'){o.preliminary={price:e.price,count:e.count};sync()}
     else if(e.phase==='progress'){o.activity=Array.isArray(e.activity)?e.activity.slice(-8):[...(o.activity||[]),e.step].filter(Boolean).slice(-8);if(o.phase==='identifying')o.phase='loading';sync()}};
   try{
    const request=o.original ?? {imageDataUrl:shrinkCanvas(source,768).toDataURL('image/jpeg',.8),cutoutDataUrl:await shrinkDataUrl(o.selection.cutoutDataUrl||cutout(source,o.selection),512),selection:{x:o.selection.x,y:o.selection.y,width:o.selection.width,height:o.selection.height,polygon:o.selection.polygon},locale:locale()};
    const r=await new HttpResearchProvider(providerConfig().researchEndpoint,providerConfig().jobsEndpoint).research({...request,...(labelDataUrl&&{labelDataUrl}),...(modelHint&&{modelHint}),...(imageSearchOn()&&{imageSearch:true})},o.controller.signal,onPhase);
    o.original=(r.status==='followup_required'||r.pricingMode==='type_estimate')?request:null;
    if(!live())return;
    const candidate=r.candidates?.[0];if(candidate&&person(candidate)){o.phase='person';o.result=null;o.coins=funRef.current?mint():null}else{o.result=r;o.phase=r.status||'complete'}
    note({mode,outcome:o.phase==='complete'||o.phase==='completed'?'success':o.phase,sourceCount:r.offers.length,latencyMs:Math.round(performance.now()-start)});sync();
   }catch(e){if(live()){o.phase='error';o.error=e.message;sync()}}
 };
 function refineModel(id,text){const o=jobs.current.get(id);const hint=String(text||'').trim().slice(0,80);if(!o?.original||!hint)return;void research(o,null,undefined,hint)}
 function beginLabel(o){if(!o?.original)return;segmentController.current?.abort();captureRef.current=o.id;setCaptureId(o.id);setDetail(null);setHint(t('hint.label'));}
 function endLabel(send){
   const o=jobs.current.get(captureRef.current);captureRef.current=null;setCaptureId(null);setHint('');
   if(!o)return;setDetail(o.id);
   if(send && canCapture(v.current))void research(o,null,snapshot(v.current).toDataURL('image/jpeg',.90));
 }
 function pauseForSpatial(){spatial.current=true;++cameraJob.current;segmentController.current?.abort();setReady(false);stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(v.current)v.current.srcObject=null}
 function resumeFromSpatial(){spatial.current=false;if(alive.current)void startCamera()}
 const trackApi=useMemo(()=>new HttpTrackProvider(providerConfig().trackEndpoint),[]);
 function stopTrack(o){o.stop?.();if(o.trackSid){const sid=o.trackSid;o.trackSid=null;o.trackReady=false;void trackApi.end(sid)}}
 function startServerTrack(o,s,source){
  if(o.trackSid){const old=o.trackSid;void trackApi.end(old)}
  const sid=o.trackSid=(crypto.randomUUID?.()||String(Date.now())+Math.random().toString(16).slice(2)),k=Math.min(1,480/Math.max(source.width,source.height));
  const c=document.createElement('canvas');c.width=Math.round(source.width*k);c.height=Math.round(source.height*k);c.getContext('2d').drawImage(source,0,0,c.width,c.height);
  o.trackReady=false;o.trackLive=0;
  void trackApi.start(sid,c.toDataURL('image/jpeg',.7),s.contours?.length?s.contours:[s.polygon]).then(r=>{if(jobs.current.get(o.id)===o&&o.trackSid===sid)o.trackReady=!!r?.ok&&!r.busy}).catch(()=>{});
 }
 function localTrack(o,s,frame){return trackPreview(v.current,s,next=>{if(jobs.current.get(o.id)!==o)return;
   if(!next){if(o.trackReady&&performance.now()-o.trackLive<900)return;o.lostAt ||= performance.now();o.refineNeeded=true;o.position=null;o.visibility='lost';sync();return;}
   o.lostAt=0;o.visibility='tracking';if(!o.trackReady&&overlap(o.reference.selection,next)<.74)o.refineNeeded=true;
   o.position=next;sync();},frame)}
 function bindTrack(o,s,source){o.reference={frame:source,selection:s};o.lostAt=0;if(!o.template)o.template=previewTemplate(source,s);
  if(!o.signaturePending&&!o.signature&&!person(s)){
   o.signaturePending=true;
   void captureMaskedSignature(s.cutoutDataUrl||cutout(source,s),s,s.width*source.width/(s.height*source.height))
    .then(t=>{if(t&&jobs.current.get(o.id)===o){o.signature=t;sync()}}).catch(()=>{}).finally(()=>{o.signaturePending=false});
  }o.stop?.();o.selection=s;o.position=s;o.refineNeeded=false;
  o.stop=localTrack(o,s,source);startServerTrack(o,s,source);
 }
 async function discover(input={},refresh=null){
   if(spatial.current||captureRef.current!=null||sheetRef.current!=null||!canCapture(v.current)||!ready)return;
   const current=epoch.current,manual=!!(input.point||input.selection),isPick=manual&&!refresh;
   if(isPick&&jobs.current.size>=MAX_JOBS){setHint(t('hint.max'));return}
   const controller=new AbortController(),source=snapshot(v.current);
   const reserved=isPick?{id:++sequence.current,controller,phase:'segmenting',position:null}:null;
   if(reserved){jobs.current.set(reserved.id,reserved);sync()}
   else{segmentController.current?.abort();segmentController.current=controller}
   const previous=new Map([...jobs.current.values()].filter(o=>o.position).map(o=>[o.id,o.position]));if(!refresh)setHint(t('hint.finding'));
   try{
    const r=await new HttpSegmentationProvider(providerConfig().segmentationEndpoint).segment({imageDataUrl:source.toDataURL('image/jpeg',.85),...input,signal:controller.signal});
    if(controller.signal.aborted||current!==epoch.current||!alive.current)return;
    const raw=(r.selections??(r.selection?[r.selection]:[])).filter(s=>s.polygon?.length>=3),found=raw.filter(s=>s.width*s.height>=MIN_AREA).slice(0,manual?1:4);
    const claimed=new Set();
    for(const s of found){
     // A dismissed location suppresses new automatic jobs, never a refresh
     // of another live job, even when their selections overlap completely.
     if(!manual&&!refresh&&ignored.current.some(p=>overlap(p,s)>.55))continue;
     if(refresh){
       if(jobs.current.get(refresh.id)!==refresh)continue;
       const orig=previous.get(refresh.id),now=refresh.position;
       const stillTracked=orig&&now&&overlap(orig,s)>.38&&overlap(now,s)>.38;
       const cost=appearanceCost(refresh.template,source,s);
       if((stillTracked ? !refresh.template||cost<32 : cost<(refresh.reseed?30:16)) &&
          !Array.from(jobs.current.values()).some(other=>other!==refresh&&other.position&&overlap(other.position,s)>.45&&appearanceCost(other.template,source,s)<=cost+4)){
          bindTrack(refresh,s,source);refresh.reseed=false;sync();
       }continue;
     }
     const matches=isPick?[]:Array.from(jobs.current.values()).filter(o=>!claimed.has(o.id)&&o.position&&previous.has(o.id)&&(!refresh||o===refresh)&&person(o.selection)===person(s))
       .map(o=>({o,score:overlap(previous.get(o.id),s)})).filter(m=>m.score>.55).sort((a,b)=>b.score-a.score);
     if(matches.length&&(!matches[1]||matches[0].score-matches[1].score>.12)){
       const {o}=matches[0];claimed.add(o.id);if(overlap(o.position,s)>.50&&(!o.template||appearanceCost(o.template,source,s)<32)){bindTrack(o,s,source);sync()}continue;
     }
     if(refresh||matches.length)continue;
     // An automatic refresh may finish while a visible track briefly loses
     // lock. Reuse a lost track only with positive, unambiguous appearance.
     if(!isPick){const lost=[...jobs.current.values()].filter(o=>!o.position&&o.template&&!claimed.has(o.id))
       .map(o=>({o,cost:appearanceCost(o.template,source,s)})).filter(x=>x.cost<22).sort((a,b)=>a.cost-b.cost);   // looser after a turn: lighting and angle change the look
       if(lost.length){if(!lost[1]||lost[1].cost-lost[0].cost>5){claimed.add(lost[0].o.id);bindTrack(lost[0].o,s,source);sync()}continue;}}
     if(!reserved && jobs.current.size>=MAX_JOBS)continue;
     const o=reserved||{id:++sequence.current,controller:new AbortController()};Object.assign(o,{selection:s,position:s,phase:person(s)?'person':'loading',coins:person(s)&&funRef.current?mint():null});
     jobs.current.set(o.id,o);claimed.add(o.id);bindTrack(o,s,source);
     sync();if(o.phase!=='person')void research(o,source);
    }
    if(reserved&&!found.length){reserved.phase='error';reserved.error=t('seg.none');sync()}
    if(!refresh)setHint(found.length?'':raw.length?t('hint.tooSmall'):t('hint.notFound'));
   }catch(e){if(!controller.signal.aborted&&current===epoch.current){setHint(e.message||t('seg.fail'));if(reserved){reserved.phase='error';reserved.error=e.message;sync()}}}finally{if(segmentController.current===controller)segmentController.current=null}
 }
 useEffect(()=>{try{localStorage.setItem('howmuch-mode',mode)}catch{}wipe();segmentController.current?.abort();},[mode]);
 useEffect(()=>{if(!ready)return;
    let cursor=0;
    const timer=setInterval(()=>{if(gesture.current||document.hidden||segmentController.current||spatial.current||!canCapture(v.current))return;
     const now=performance.now();
     const candidates=Array.from(jobs.current.values()).filter(o=>o.reference&&(o.refineNeeded||(!o.position&&now-(o.refinedAt||0)>(o.ghostCenter?1500:4000))));
     if(!candidates.length)return;
     const o=candidates[cursor++%candidates.length],s=o.reference.selection;
     const previousImageDataUrl=o.reference.frame.toDataURL('image/jpeg',.72);
     o.refineNeeded=false;o.refinedAt=now;
     if(!o.position&&o.ghostCenter){   // turned, rolled, flipped: the gyro says where the object is, so segment right there
      const m=inMedia({x:o.ghostCenter.x,y:o.ghostCenter.y,width:0,height:0});o.reseed=true;void discover({point:{x:m.x,y:m.y}},o);return}
     void discover({propagation:{previousImageDataUrl,selection:{x:s.x,y:s.y,width:s.width,height:s.height,polygon:s.polygon,contours:s.contours}}},o);
    },1200);return()=>clearInterval(timer);
 },[mode,ready]);
 // Live following: while an object is selected, its picture goes to the server's video object segmentation (SAM 2 with
 // memory) a few times per second and the answer replaces the local template tracker's guess. Frames are skipped when
 // the server is busy; when the server loses the object the local tracker and the SAM refresh take over as before.
 useEffect(()=>{if(!ready)return;
  const c=document.createElement('canvas');let alive2=true;
  const apply=(o,sel)=>{
   if(jobs.current.get(o.id)!==o)return;
   const next={...(o.position||o.selection),x:sel.x,y:sel.y,width:sel.width,height:sel.height,polygon:sel.polygon,contours:sel.contours};
   if(next.width*next.height<MIN_AREA)return;
   o.trackLive=performance.now();o.lostAt=0;o.visibility='tracking';o.refineNeeded=false;o.position=next;
   o.stop?.();o.stop=localTrack(o,next);sync();
  };
  const tick=()=>{
   if(!alive2||document.hidden||!canCapture(v.current)||spatial.current)return;
   const vid=v.current,k=Math.min(1,480/Math.max(vid.videoWidth,vid.videoHeight));
   const w=Math.round(vid.videoWidth*k),h=Math.round(vid.videoHeight*k);
   for(const o of jobs.current.values()){
    if(!o.trackSid||!o.trackReady||o.trackBusy)continue;
    if(c.width!==w||c.height!==h){c.width=w;c.height=h}
    c.getContext('2d').drawImage(vid,0,0,w,h);
    const sid=o.trackSid;o.trackBusy=true;
    void trackApi.step(sid,c.toDataURL('image/jpeg',.7)).then(r=>{
     if(jobs.current.get(o.id)!==o||o.trackSid!==sid)return;
     if(r.busy)return;
     if(r.tracked&&r.selection)apply(o,r.selection);
     else{o.trackReady=false;o.trackLive=0;o.refineNeeded=true}   // lost on the server: local tracker + SAM refresh take over
    }).catch(()=>{o.trackReady=false}).finally(()=>{o.trackBusy=false});
    break;   // one frame per tick; objects take turns, so the server never gets a burst
   }
  };
  const timer=setInterval(tick,70);return()=>{alive2=false;clearInterval(timer)};
 },[ready]);
 useEffect(()=>{if(!ready||mode!=='auto')return;
  const buffer=document.createElement('canvas');buffer.width=32;buffer.height=24;let base=null,last=null,busy=false,ended=false,nextAt=0;since.current=performance.now();
  const timer=setInterval(async()=>{if(ended||document.hidden||!canCapture(v.current))return;const now=performance.now(),sig=sampleFrame(v.current,buffer);
   if(!base||distance(sig,base)>12||distance(sig,last)>8){if(base)ignored.current=[];base=sig;since.current=now;nextAt=0;}last=sig;
   if(!busy&&!segmentController.current&&now-since.current>=3500&&now>=nextAt){busy=true;try{await discover()}finally{busy=false;nextAt=performance.now()+7000}}
  },250);return()=>{ended=true;clearInterval(timer)}},[mode,ready]);
 const point=e=>{const b=stage.current.getBoundingClientRect();return{x:clamp((e.clientX-b.left)/b.width),y:clamp((e.clientY-b.top)/b.height)}};
 const inMedia=s=>screenToMediaSelection(s,size,{width:v.current.videoWidth,height:v.current.videoHeight});
 function pick(p){const m=inMedia({...p,width:0,height:0});discover({point:{x:m.x,y:m.y}})}
 function showStroke(g){const c=pen.current,ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);ctx.lineWidth=14;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='rgba(220,255,113,.32)';
   ctx.beginPath();g.path.forEach((p,i)=>ctx[i?'lineTo':'moveTo'](p.x*c.width,p.y*c.height));ctx.stroke();}
 function begin(e){if(captureRef.current!=null||mode!=='draw'||!ready||!canCapture(v.current)||gesture.current||e.button!==0)return;wipe();const c=pen.current;c.width=Math.round(size.width);c.height=Math.round(size.height);const p=point(e);
   const g={id:e.pointerId,origin:p,path:[p],moved:false,held:false};gesture.current=g;c.setPointerCapture(e.pointerId);
   hold.current=setTimeout(()=>{if(gesture.current===g&&!g.moved){g.held=true;pick(p)}},650);}
 function move(e){const g=gesture.current;if(!g||g.id!==e.pointerId||g.held)return;const p=point(e);if(Math.hypot((p.x-g.origin.x)*size.width,(p.y-g.origin.y)*size.height)>5){g.moved=true;clearTimeout(hold.current)}
  if(g.moved){g.path.push(p);showStroke(g);}}
 function end(e,cancel=false){const g=gesture.current;if(!g||g.id!==e.pointerId)return;clearTimeout(hold.current);gesture.current=null;const c=pen.current;if(c.hasPointerCapture(e.pointerId))c.releasePointerCapture(e.pointerId);
  if(!cancel&&!g.held&&canCapture(v.current)){if(g.moved){const s=normalizePolygon([...g.path,point(e)]);if(s.polygon.length>=3&&s.width>.01&&s.height>.01)discover({selection:inMedia(s)});else pick(point(e));}else pick(point(e))}
  c.classList.add('fade');fade.current=setTimeout(()=>{if(!gesture.current)wipe()},800);}
 const visible=[];if(canCapture(v.current))for(const o of items){if(!o.position)continue;const s=toScreen(o.position,size,v.current);if(s.x+s.width<=0||s.x>=1||s.y+s.height<=0||s.y>=1)continue;
  const box=boxForHud(s,size,measured[o.id]||{width:Math.min(164,size.width*.44),height:88},visible.map(x=>x.box));visible.push({o,s,box});}
 const xrCards=items.filter(o=>o.signature&&o.phase!=='person').map(o=>{
  const d=summarizeCard(o.result);
  return {id:o.id,target:o.signature,title:nameOf(o),price:stateText(o)||d.label||d.price};
 });
 const selected=items.find(o=>o.id===detail);
 const isCapturing=captureId!=null;
 const shown=filter==null?visible:visible.filter(x=>x.o.id===filter);
  const modeHint=mode==='auto'?t('hint.auto'):t('hint.draw');
  const pill=cameraError||hint||(ready&&items.length===0?modeHint:'');
  return <main className="app"><section className="camera" ref={stage} aria-label={t('cam.label')} onClickCapture={askMotion}>
   <video ref={v} playsInline muted autoPlay/><div className="shade"/>
   <canvas ref={pen} className={'draw-layer '+(mode==='draw'?'enabled':'')} aria-label={t('cam.draw')} onPointerDown={begin} onPointerMove={move} onPointerUp={e=>end(e)} onPointerCancel={e=>end(e,true)} onLostPointerCapture={e=>end(e,true)}/>
   <div className="topbar"><b className="brand"><i><ScanLine size={18}/></i>HowMuch</b><div className="actions">
    {gyroSupported()&&<button className={'icon-btn '+(gyro?'on':'')} aria-label="Spatial memory" aria-pressed={gyro} onClick={toggleGyro}><Compass size={20}/></button>}
    {xrCards.length>0&&<WorldAnchorButton compact objects={xrCards} onSessionStart={pauseForSpatial} onSessionEnd={resumeFromSpatial}/>}
    <button className="icon-btn" aria-label={t('sheet.items')} onClick={()=>setList(true)}><List size={20}/>{items.length>0&&<b>{items.length}</b>}</button>
    <button className="icon-btn" aria-label={t('sheet.settings')} onClick={()=>setSettings(true)}><Settings size={20}/></button>
   </div></div>
   <ItemBar items={items} filter={filter} setFilter={setFilter} cancel={cancelJob} fun={fun}/>
   {cameraError&&<button className="retry" onClick={startCamera}><Camera size={16}/>{t('cam.retry')}</button>}
   <svg className="contours cutout-outline" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">{shown.map(({o,s})=><path key={o.id} fillRule="evenodd" d={(s.contours?.length?s.contours:[s.polygon]).map(r=>r.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ')+'Z').join(' ')}/>)}</svg>
   <GhostLayer enabled={gyro} jobs={jobs} video={v} size={size} filter={filter} label={o=>nameOf(o)}/>
   {!isCapturing&&shown.map(({o,s,box})=>{const ax=(s.x+s.width/2)*size.width,ay=(s.y+s.height/2)*size.height,tilt={ry:Math.max(-18,Math.min(18,(ax/size.width-.5)*-36)),rx:Math.max(-8,Math.min(8,(ay/size.height-.5)*10)),k:Math.max(.86,Math.min(1.22,.78+Math.sqrt(s.width*s.height)*1.5))};return <React.Fragment key={o.id}><Leader box={box} ax={ax} ay={ay} phase={o.phase}/><Hud o={o} box={box} tilt={tilt} fun={fun} measure={(id,n)=>setMeasured(m=>m[id]?.width===n.width&&m[id]?.height===n.height?m:{...m,[id]:n})} open={()=>setDetail(o.id)}/><button className="card-dismiss" style={{left:box.x+box.width-25,top:box.y+5}} aria-label={t('sheet.cancelItem',{n:o.id})} onClick={e=>{e.stopPropagation();cancelJob(o.id)}}>X</button></React.Fragment>})}
   {pill&&!isCapturing&&<div className="hint" role="status">{pill}</div>}
   {isCapturing?<nav aria-label={t('label.aria')}><button onClick={()=>endLabel(false)}>{t('label.cancel')}</button><button className="on" onClick={()=>endLabel(true)}>{t('label.send')}</button></nav>:<nav aria-label={t('mode.aria')}>{[['auto',t('mode.auto'),Crosshair],['draw',t('mode.draw'),Hand]].map(([m,label,I])=><button key={m} aria-pressed={mode===m} className={mode===m?'on':''} onClick={()=>setMode(m)}><I size={17}/>{label}</button>)}</nav>}
   {gate&&<StarGate onDone={()=>setGate(false)}/>}
  </section>
  {list&&<ItemsSheet items={items} fun={fun} close={()=>setList(false)} open={id=>{setList(false);setDetail(id)}} cancel={cancelJob}/>}
  {settings&&<SettingsSheet close={()=>setSettings(false)} fun={fun} setFun={enableFun} pair={()=>{setSettings(false);setPair(true)}} star={()=>{setSettings(false);setStarSheet(true)}}/>}
  {starSheet&&<StarSheet close={()=>setStarSheet(false)}/>}
  <Pairing open={pair} onClose={()=>setPair(false)}/>
  {selected&&<Detail o={selected} fun={fun} beginLabel={()=>beginLabel(jobs.current.get(selected.id))} refine={text=>refineModel(selected.id,text)} pause={pauseForSpatial} resume={resumeFromSpatial} close={()=>setDetail(null)} click={()=>note({mode,outcome:'source_click',sourceClicks:1})}/>}
  </main>
}
createRoot(document.getElementById('root')).render(<App/>);
