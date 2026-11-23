import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ScanLine,Settings,Hand,Crosshair,ChevronRight,Camera,ExternalLink} from 'lucide-react';
import Pairing from './Pairing.jsx';
import {previewTemplate,captureMaskedSignature} from './lib/xr-target.js';
import WorldAnchorButton from './WorldAnchorButton.jsx';
import {summarizeCard,spatialHandoff} from './lib/price-card.js';
import {discoveryLabel} from './lib/market-display.js';
import {HttpResearchProvider,HttpSegmentationProvider,providerConfig} from './lib/providers';
import {normalizePolygon,screenToMediaSelection} from './lib/geometry.js';
import {snapshot,cutout,toScreen,overlap,sampleFrame,distance,boxForHud,clamp} from './lib/camera-scene.js';
import {recordAnonymousEvent} from './lib/telemetry.js';
import {trackPreview} from './lib/preview-track.js';
import './styles.css';

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
const money=(n,c)=>Number.isFinite(n)&&c?new Intl.NumberFormat('ko-KR',{style:'currency',currency:c}).format(n):'가격 미확인';
const clock=t=>t?new Date(t).toLocaleString('ko-KR'):'';
const person=s=>/^(person|human|사람)$/i.test(String(s.kind||s.category||s.label||s.type||'').trim())||s.isPerson===true;
function preferred(){try{return localStorage.getItem('howmuch-mode')==='draw'?'draw':'auto'}catch{return 'auto'}}
function note(event){recordAnonymousEvent(event);try{
 const key='howmuch-usage-v1', day=new Date().toLocaleDateString('sv-SE'), prev=JSON.parse(localStorage.getItem(key)||'{}'), days=prev.days||{};
 days[day]=(days[day]||0)+1;localStorage.setItem(key,JSON.stringify({days:Object.fromEntries(Object.entries(days).slice(-31)),scans:(prev.scans||0)+(event.outcome==='success'?1:0)}));
 }catch{}}
function App(){
 const v=useRef(null),stage=useRef(null),pen=useRef(null),stream=useRef(null),alive=useRef(true),cameraJob=useRef(0);
 const segmentController=useRef(null),ignored=useRef([]);
 const [list,setList]=useState(false);
 const jobs=useRef(new Map()),epoch=useRef(0),sequence=useRef(0),gesture=useRef(null),fade=useRef(),hold=useRef(),since=useRef(0);
 const [items,redraw]=useState([]),[size,setSize]=useState({width:1,height:1}),[measured,setMeasured]=useState({}),[ready,setReady]=useState(false);
 const [mode,setMode]=useState(preferred),[cameraError,setCameraError]=useState(''),[hint,setHint]=useState(''),[settings,setSettings]=useState(false),[pair,setPair]=useState(false),[fun,setFun]=useState(false),[detail,setDetail]=useState(null);

 const spatial=useRef(false),captureRef=useRef(null),sheetRef=useRef(null);sheetRef.current=detail;
 const [captureId,setCaptureId]=useState(null);
 const funRef=useRef(false);
 const mint=()=>100+Math.floor(Math.random()*901);
 function enableFun(value){funRef.current=value;setFun(value);for(const o of jobs.current.values()){if(o.phase==='person')o.coins=value?(o.coins??mint()):null;}sync()}
 const sync=()=>{if(alive.current)redraw(Array.from(jobs.current.values(),o=>({...o})))};
 useEffect(()=>{if(!ready)return;let last=canCapture(v.current);
   const timer=setInterval(()=>{const next=canCapture(v.current);if(next!==last){last=next;sync()}},150);
   return()=>clearInterval(timer)},[ready]);
 function wipe(){clearTimeout(hold.current);clearTimeout(fade.current);gesture.current=null;const c=pen.current;if(c){c.getContext('2d').clearRect(0,0,c.width,c.height);c.classList.remove('fade')}}
 function cancelJob(id){const o=jobs.current.get(id);if(!o)return;if(o.position)ignored.current=[...ignored.current.slice(-7),o.position];o.stop?.();o.controller?.abort();jobs.current.delete(id);if(detail===id)setDetail(null);sync();setHint('선택한 물체의 조사를 취소했습니다.');}
 const startCamera=async()=>{const id=++cameraJob.current;setCameraError('');try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('휴대폰에서는 HTTPS 카메라 주소로 열어 주세요.');
  const s=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
  if(id!==cameraJob.current||!alive.current){s.getTracks().forEach(t=>t.stop());return}
  stream.current?.getTracks().forEach(t=>t.stop());stream.current=s;v.current.srcObject=s;await v.current.play();if(alive.current)setReady(true);
 }catch(e){if(alive.current&&id===cameraJob.current)setCameraError(e.name==='NotAllowedError'?'브라우저 설정에서 카메라 권한을 허용해 주세요.':e.message||'카메라를 열 수 없습니다.')}};
 useEffect(()=>{alive.current=true;startCamera();note({mode,outcome:'session'});return()=>{alive.current=false;++epoch.current;++cameraJob.current;wipe();stream.current?.getTracks().forEach(t=>t.stop());segmentController.current?.abort();for(const o of jobs.current.values()){o.stop?.();o.controller?.abort()}}},[]);
 useLayoutEffect(()=>{const ro=new ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:entry.contentRect.height}));ro.observe(stage.current);return()=>ro.disconnect()},[]);
 const research=async(o,source,labelDataUrl)=>{
   const live=()=>jobs.current.get(o.id)===o&&alive.current;
   const start=performance.now(); o.phase='identifying'; o.error=null; o.result=null; sync();
   const onPhase=e=>{if(live()&&e.phase==='researching'){o.phase='loading';o.candidate=e.candidate;sync()}};
   try{
    const request=o.original ?? {imageDataUrl:source.toDataURL('image/jpeg',.85),cutoutDataUrl:o.selection.cutoutDataUrl||cutout(source,o.selection),selection:{x:o.selection.x,y:o.selection.y,width:o.selection.width,height:o.selection.height,polygon:o.selection.polygon},locale:'ko-KR'};
    const r=await new HttpResearchProvider(providerConfig().researchEndpoint).research({...request,...(labelDataUrl&&{labelDataUrl})},o.controller.signal,onPhase);
    o.original=r.status==='followup_required'?request:null;
    if(!live())return;
    const candidate=r.candidates?.[0];if(candidate&&person(candidate)){o.phase='person';o.result=null;o.coins=funRef.current?mint():null}else{o.result=r;o.phase=r.status||'complete'}
    note({mode,outcome:o.phase==='complete'||o.phase==='completed'?'success':o.phase,sourceCount:r.offers.length,latencyMs:Math.round(performance.now()-start)});sync();
   }catch(e){if(live()){o.phase='error';o.error=e.message;sync()}}
 };
 function beginLabel(o){if(!o?.original)return;segmentController.current?.abort();captureRef.current=o.id;setCaptureId(o.id);setDetail(null);setHint('같은 상품의 라벨이나 모델 각인을 가까이 비춰 주세요.');}
 function endLabel(send){
   const o=jobs.current.get(captureRef.current);captureRef.current=null;setCaptureId(null);setHint('');
   if(!o)return;setDetail(o.id);
   if(send && canCapture(v.current))void research(o,null,snapshot(v.current).toDataURL('image/jpeg',.90));
 }
 function pauseForSpatial(){spatial.current=true;++cameraJob.current;segmentController.current?.abort();setReady(false);stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(v.current)v.current.srcObject=null}
 function resumeFromSpatial(){spatial.current=false;if(alive.current)void startCamera()}
 function bindTrack(o,s,source){o.reference={frame:source,selection:s};o.lostAt=0;if(!o.template)o.template=previewTemplate(source,s);
  if(!o.signaturePending&&!o.signature&&!person(s)){
   o.signaturePending=true;
   void captureMaskedSignature(s.cutoutDataUrl||cutout(source,s),s,s.width*source.width/(s.height*source.height))
    .then(t=>{if(t&&jobs.current.get(o.id)===o){o.signature=t;sync()}}).catch(()=>{}).finally(()=>{o.signaturePending=false});
  }o.stop?.();o.selection=s;o.position=s;o.refineNeeded=false;
  o.stop=trackPreview(v.current,s,next=>{if(jobs.current.get(o.id)!==o)return;
   if(!next){o.lostAt ||= performance.now();o.refineNeeded=true;o.position=null;o.visibility='lost';sync();return;
   }
   o.lostAt=0;o.visibility='tracking';if(overlap(o.reference.selection,next)<.74)o.refineNeeded=true;
   o.position=next;sync();
  },source);}
 async function discover(input={},refresh=null){
   if(spatial.current||captureRef.current!=null||sheetRef.current!=null||!canCapture(v.current)||!ready)return;
   const current=epoch.current,manual=!!(input.point||input.selection),isPick=manual&&!refresh;
   if(isPick&&jobs.current.size>=MAX_JOBS){setHint('최대 4개까지 함께 조사합니다. 조사 목록에서 ×로 하나를 닫아 주세요.');return}
   const controller=new AbortController(),source=snapshot(v.current);
   const reserved=isPick?{id:++sequence.current,controller,phase:'segmenting',position:null}:null;
   if(reserved){jobs.current.set(reserved.id,reserved);sync()}
   else{segmentController.current?.abort();segmentController.current=controller}
   const previous=new Map([...jobs.current.values()].filter(o=>o.position).map(o=>[o.id,o.position]));if(!refresh)setHint('물체 윤곽을 찾는 중…');
   try{
    const r=await new HttpSegmentationProvider(providerConfig().segmentationEndpoint).segment({imageDataUrl:source.toDataURL('image/jpeg',.85),...input,signal:controller.signal});
    if(controller.signal.aborted||current!==epoch.current||!alive.current)return;
    const found=(r.selections??(r.selection?[r.selection]:[])).filter(s=>s.polygon?.length>=3).slice(0,manual?1:4);
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
       if((stillTracked ? !refresh.template||cost<32 : cost<16) &&
          !Array.from(jobs.current.values()).some(other=>other!==refresh&&other.position&&overlap(other.position,s)>.45&&appearanceCost(other.template,source,s)<=cost+4)){
          bindTrack(refresh,s,source);sync();
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
       .map(o=>({o,cost:appearanceCost(o.template,source,s)})).filter(x=>x.cost<16).sort((a,b)=>a.cost-b.cost);
       if(lost.length){if(!lost[1]||lost[1].cost-lost[0].cost>5){claimed.add(lost[0].o.id);bindTrack(lost[0].o,s,source);sync()}continue;}}
     if(!reserved && jobs.current.size>=MAX_JOBS)continue;
     const o=reserved||{id:++sequence.current,controller:new AbortController()};Object.assign(o,{selection:s,position:s,phase:person(s)?'person':'loading',coins:person(s)&&funRef.current?mint():null});
     jobs.current.set(o.id,o);claimed.add(o.id);bindTrack(o,s,source);
     sync();if(o.phase!=='person')void research(o,source);
    }
    if(reserved&&!found.length){reserved.phase='error';reserved.error='선택 범위에서 물체를 찾지 못했습니다.';sync()}
    if(!refresh)setHint(found.length?'':'물체를 찾지 못했어요. 가까이 비추거나 직접 선택하세요.');
   }catch(e){if(!controller.signal.aborted&&current===epoch.current){setHint(e.message||'물체 인식에 실패했습니다.');if(reserved){reserved.phase='error';reserved.error=e.message;sync()}}}finally{if(segmentController.current===controller)segmentController.current=null}
 }
 useEffect(()=>{try{localStorage.setItem('howmuch-mode',mode)}catch{}wipe();segmentController.current?.abort();},[mode]);
 useEffect(()=>{if(!ready)return;
    let cursor=0;
    const timer=setInterval(()=>{if(gesture.current||document.hidden||segmentController.current||spatial.current||!canCapture(v.current))return;
     const now=performance.now();
     const candidates=Array.from(jobs.current.values()).filter(o=>o.reference&&(o.refineNeeded||(!o.position&&now-(o.refinedAt||0)>4000)));
     if(!candidates.length)return;
     const o=candidates[cursor++%candidates.length],s=o.reference.selection;
     const previousImageDataUrl=o.reference.frame.toDataURL('image/jpeg',.72);
     o.refineNeeded=false;o.refinedAt=now;
     void discover({propagation:{previousImageDataUrl,selection:{x:s.x,y:s.y,width:s.width,height:s.height,polygon:s.polygon,contours:s.contours}}},o);
    },1200);return()=>clearInterval(timer);
 },[mode,ready]);
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
  const d=summarizeCard(o.result), identity=o.result?.identity, name=identity?[identity.brand,identity.model].join(' '):o.result?.candidates?.[0]?.name||o.candidate?.name;
  return {id:o.id,target:o.signature,title:name||'선택한 물체',price:o.phase==='identifying'?'물체 식별 중':o.phase==='loading'?'시세 조사 중':d.label||d.price};
 });
 const selected=items.find(o=>o.id===detail);
 const isCapturing=captureId!=null;
 return <main className="app"><section className="camera" ref={stage} aria-label="라이브 가격 카메라">
  <video ref={v} playsInline muted autoPlay/><div className="shade"/>
  <canvas ref={pen} className={'draw-layer '+(mode==='draw'?'enabled':'')} aria-label="물체 그리기" onPointerDown={begin} onPointerMove={move} onPointerUp={e=>end(e)} onPointerCancel={e=>end(e,true)} onLostPointerCapture={e=>end(e,true)}/>
  <header><b><i><ScanLine size={17}/></i> howmuch<span className="brand-sep">/</span><small>FIELD LENS</small></b><div className="header-actions"><button aria-label="설정" onClick={()=>setSettings(true)}><Settings size={18}/></button><button onClick={()=>setList(true)}>조사 목록 {items.length}</button>{xrCards.length>0&&<WorldAnchorButton compact objects={xrCards} onSessionStart={pauseForSpatial} onSessionEnd={resumeFromSpatial}/>}</div></header>
  <div className="hint" role="status"><em/>{cameraError||hint||(ready?(mode==='auto'?'물체를 3.5초 동안 비춰 주세요':'물체를 탭하거나 둘러 그려 주세요'):'카메라 연결 중…')}</div>
  {cameraError&&<button className="retry" onClick={startCamera}><Camera size={15}/> 카메라 다시 허용</button>}
  <svg className="contours cutout-outline" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">{visible.map(({o,s})=><path key={o.id} fillRule="evenodd" d={(s.contours?.length?s.contours:[s.polygon]).map(r=>r.map((p,i)=>(i?'L':'M')+p.x+' '+p.y).join(' ')+'Z').join(' ')}/>)}</svg>
  {!isCapturing&&visible.map(({o,box})=><React.Fragment key={o.id}><Hud o={o} box={box} fun={fun} measure={(id,n)=>setMeasured(m=>m[id]?.width===n.width&&m[id]?.height===n.height?m:{...m,[id]:n})} open={()=>setDetail(o.id)}/><button className="card-dismiss" style={{left:box.x+box.width-25,top:box.y+5}} aria-label={'물체 '+o.id+' 조사 취소'} onClick={e=>{e.stopPropagation();cancelJob(o.id)}}>X</button></React.Fragment>)}
  {items.length>0&&<div className="job-tray" aria-label="진행 중인 조사">
   <div className="job-tray-head"><strong>조사 중인 물체</strong><button onClick={()=>setList(true)}>전체 보기</button></div>
   <div className="job-tray-list">{items.map(o=><button className="job-chip" key={o.id} onClick={()=>setDetail(o.id)}>
    <span className={'job-dot '+(o.position?'':'muted')}/><span className="job-chip-name">{o.result?.identity?.model||o.result?.candidates?.[0]?.name||o.candidate?.name||'선택한 물체'}</span><span className="job-chip-state">{jobState(o)}</span><span className="job-chip-x" onClick={e=>{e.stopPropagation();cancelJob(o.id)}}>×</span>
   </button>)}</div>
  </div>}
  {isCapturing?<nav aria-label="라벨 촬영"><button onClick={()=>endLabel(false)}>취소</button><button className="on" onClick={()=>endLabel(true)}>라벨 촬영 · 다시 식별</button></nav>:<nav aria-label="선택 모드">{[['auto','자동',Crosshair],['draw','터치·그리기',Hand]].map(([m,t,I])=><button key={m} aria-pressed={mode===m} className={mode===m?'on':''} onClick={()=>setMode(m)}><I size={16}/>{t}</button>)}</nav>}
  <aside><a href="https://github.com/NomaDamas/HowMuch" target="_blank" rel="noreferrer">HowMuch by NomaDamas MinXing</a> · 조회한 판매처 기준</aside>
 </section>
 {list&&<div className="back"><section className="sheet" role="dialog" aria-label="조사 목록"><h2>조사 목록</h2>{items.length===0&&<p>조사 중인 물체가 없습니다.</p>}{items.map(o=><div key={o.id} className="job-row"><button onClick={()=>{setList(false);setDetail(o.id)}}>#{o.id} {o.result?.candidates?.[0]?.name||o.candidate?.name||'선택한 물체'} · {o.phase==='segmenting'?'윤곽 찾는 중':o.phase==='identifying'?'식별 중':o.phase==='loading'?'시세 조사 중':o.error||summarizeCard(o.result).price}</button><button aria-label={'목록에서 물체 '+o.id+' 조사 취소'} onClick={()=>cancelJob(o.id)}>×</button></div>)}<button className="primary" onClick={()=>setList(false)}>카메라로 돌아가기</button></section></div>}
  {settings&&<div className="back"><section className="sheet" role="dialog" aria-label="설정"><small>FIELD LENS</small><h2>카메라 설정</h2><label className="option"><input type="checkbox" checked={fun} onChange={e=>enableFun(e.target.checked)}/> 사람 캐릭터 카드 · 무작위 놀이 코인</label><p>외모나 체형과 무관하며 실제 가격이 아닙니다.</p><p>화면 윤곽은 잠깐 시야를 잃어도 유지되고, 지원 기기의 공간 보기에서는 누끼 윤곽과 HUD가 같은 월드 앵커를 따라갑니다.</p><a href="https://github.com/NomaDamas/HowMuch" target="_blank" rel="noreferrer" className="option">프로젝트 소스 ↗</a><a href="https://github.com/NomaDamas/HowMuch" target="_blank" rel="noreferrer" className="option star-cta">GitHub에서 HowMuch Star 누르기 ↗</a><p className="muted-copy">Star는 사용자가 GitHub에서 직접 누를 때만 등록됩니다. 인증 토큰은 저장하지 않습니다.</p><button className="option" onClick={()=>{setSettings(false);setPair(true)}}>휴대폰 연결 QR</button><button className="primary" onClick={()=>setSettings(false)}>카메라로 돌아가기</button></section></div>}
 <Pairing open={pair} onClose={()=>setPair(false)}/>
 {selected&&<Evidence o={selected} fun={fun} beginLabel={()=>beginLabel(jobs.current.get(selected.id))} pause={pauseForSpatial} resume={resumeFromSpatial} close={()=>setDetail(null)} click={()=>note({mode,outcome:'source_click',sourceClicks:1})}/>}
 </main>
}
function jobState(o){if(o.error)return '검색 실패';if(o.phase==='segmenting')return '누끼 찾는 중';if(o.phase==='identifying')return '물체 확인 중';if(o.phase==='loading')return '시세 조사 중';if(o.phase==='research_unavailable')return '판매처 연결 불가';if(o.phase==='followup_required'||o.result?.status==='followup_required')return '품번 필요';if(o.visibility==='reacquiring')return '누끼 재획득 중';if(o.visibility==='lost')return '시야 밖 · 앵커 유지';return o.phase==='person'?'놀이 카드':summarizeCard(o.result).price||'가격 확인';}
function Hud({o,box,measure,open,fun}){const node=useRef(null),ref=useRef(measure);ref.current=measure;
 useLayoutEffect(()=>{const read=()=>{const r=node.current.getBoundingClientRect();ref.current(o.id,{width:r.width,height:r.height})};read();const ro=new ResizeObserver(read);ro.observe(node.current);return()=>ro.disconnect()},[o.id]);
 const r=o.result,c=r?.candidates[0]||o.candidate,display=summarizeCard(r),isPerson=o.phase==='person',needsLabel=o.phase==='followup_required'||r?.status==='followup_required';
return <button className="card" ref={node} style={{left:box.x,top:box.y}} onClick={open} data-object-id={o.id} data-phase={o.phase}><small><i/>{needsLabel?'모델 번호 필요':o.phase==='identifying'?'물체 확인 중':o.phase==='loading'?'판매 가격 검색 중':isPerson?'캐릭터':o.phase==='research_unavailable'?'판매처 연결 불가':o.phase==='error'?'검색 실패':o.phase==='partial'&&!r?.produceMarket&&!r?.referenceMarket?'부분 결과':display.type}</small><strong>{isPerson?'사람':(r?.identity?[r.identity.brand,r.identity.model].join(' '):c?.name)|| (needsLabel?'품번·라벨을 가까이 비춰 주세요':o.phase==='identifying'?'누끼 확인 중':o.phase==='loading'?'판매처 대조 중':'확인된 상품 없음')}</strong>
 {['loading','identifying'].includes(o.phase)?<span className="skeleton"/>:<b>{isPerson?(fun?o.coins+' 놀이 코인':'놀이 모드 꺼짐'):display.price}</b>}
 <footer>{isPerson?'실제 가격 아님':needsLabel?'브랜드·모델 근거 필요':o.phase==='identifying'?'선택한 물체 식별 중':o.phase==='loading'?'판매처 대조 중':o.visibility==='reacquiring'?'누끼 재획득 중':display.basis} <ChevronRight size={13}/></footer></button>}
function Evidence({o,close,click,fun,beginLabel,pause,resume}){
 const r=o.result,display=summarizeCard(r),c=r?.candidates?.[0]??o.candidate;
 const title=r?.identity?.model?[r.identity.brand,r.identity.model].filter(Boolean).join(' '):c?.name;
 const market=r?.produceMarket,repr=r?.representative,proof=r?.identity?.modelEvidence;
 const nativeURL=spatialHandoff(title,display.label,o.signature);
 const mobile=/(iPhone|iPad|Android)/i.test(navigator.userAgent)||navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1;
 return <div className="back" onClick={close}><section className="sheet" role="dialog" aria-label="가격 근거" onClick={e=>e.stopPropagation()}>
 <small>FIELD NOTES / 조회 근거</small><h2>{title||(o.phase==='person'?'사람 캐릭터':'상품 확인 중')}</h2>
 {o.phase==='person'?<p>{fun?o.coins+' 무작위 놀이 코인 · 실제 가치와 무관합니다.':'설정에서 놀이 모드를 켤 수 있습니다.'}</p>:<>
 <p>{o.error||(o.phase==='research_unavailable'?'검색 사이트에 연결하지 못했습니다. 잠시 후 다시 선택해 주세요.':o.phase==='loading'?'판매처에서 가격 근거를 확인 중입니다.':o.phase==='identifying'?'선택한 물체를 식별 중입니다.':clock(r?.completedAt))}</p>
 {!['identifying','loading'].includes(o.phase)&&(r?.followup?<><p>{r.followup.prompt}</p><button className="primary" onClick={beginLabel}>같은 상품의 라벨 추가 촬영</button></>:<div className="best">{display.basis} <b>{display.price}</b></div>)}
 {Array.isArray(proof)&&proof.length>0&&<p>모델 식별 근거: {proof.join(' · ')}</p>}
 {r?.referenceMarket&&<><p>같은 종류와 소재의 다른 상품입니다. 아래 가격은 촬영한 물건의 감정가나 최저가가 아닙니다.</p>{r.referenceMarket.listings.map(a=><a className="source" key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" onClick={click}><strong>{a.title}</strong><span>{money(a.price,a.currency)} / {a.quantity}{a.unit} · 새 상품</span><small>{a.merchant} · {clock(a.checkedAt)} · 배송비 {a.shipping==null?'미확인':money(a.shipping,a.currency)}</small></a>)}</>}
 {repr&&repr.sampleCount>1&&<p>조회 범위 {money(repr.min,repr.currency)} ~ {money(repr.max,repr.currency)} · 중앙값 {money(repr.median,repr.currency)}</p>}
 {market&&<><p>상품 한 개의 가격이 아닌 {market.region} 시장의 {market.quantity}{market.unit} 기준 참고가입니다.</p>
 <p>관측 범위 {money(market.min,market.currency)} ~ {money(market.max,market.currency)} · {market.samples.length}개 관측값의 중앙값</p>
 {market.samples.map((a,i)=><a className="source" key={i} href={a.url} rel="noreferrer" target="_blank" onClick={click}><strong>{a.title}</strong><span>{a.source} · {a.region} · {money(a.price,a.currency)} / {a.quantity}{a.unit}</span><small>조사일 {a.observedAt}</small></a>)}</>}
 {repr?.exchange&&<p>환산 기준: <a href={repr.exchange.url} rel="noreferrer" target="_blank">ECB {repr.exchange.date}</a></p>}
 {r?.offers.map((a,i)=><a key={i} className="source" href={a.url} target="_blank" rel="noopener noreferrer" onClick={click}><strong>{a.title}</strong><span>{a.merchant} · {money(a.price,a.currency)} <ExternalLink size={13}/></span><small>{a.condition==='new'?'새 상품':a.condition==='used'?'중고':'상태 미확인'} · {a.availability==='in_stock'?'재고 있음':a.availability==='out_of_stock'?'품절':'재고 미확인'} · {a.shipping==null?'배송비 미확인':'배송비 '+money(a.shipping,a.currency)} · {clock(a.checkedAt)}</small>{a.evidence?.map((e,j)=><small key={j}>{e}</small>)}</a>)}
 {discoveryLabel(r?.discovery)&&<p>{discoveryLabel(r.discovery)}</p>}
 {nativeURL&&<><WorldAnchorButton title={title} price={display.label} target={o.signature} onSessionStart={pause} onSessionEnd={resume}/>{mobile&&<a className="option" href={nativeURL} title="같은 상품 확인을 위해 누끼 내부의 색상 표본을 설치한 앱에 전달합니다">HowMuch AR에서 열기</a>}</>}
 </>}<button className="primary" onClick={close}>카메라로 돌아가기</button></section></div>}
createRoot(document.getElementById('root')).render(<App/>);
