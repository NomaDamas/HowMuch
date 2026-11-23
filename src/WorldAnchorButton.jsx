import { t } from './lib/i18n.js';
import React,{useEffect,useRef,useState} from 'react';
import {cardTransform,lateralOffset,worldRenderer} from './lib/world-anchor.js';
import {cameraReader} from './lib/xr-camera.js';
import {createXrCards,selectedCards} from './lib/xr-cards.js';
const noop=()=>{};
export default function WorldAnchorButton({title,price,target,objects,compact=false,onSessionStart=noop,onSessionEnd=noop}){
 const [available,setAvailable]=useState(false),[active,setActive]=useState(false),[message,setMessage]=useState('');
 const sessionRef=useRef(),overlay=useRef(),mounted=useRef(true),busy=useRef(false),release=useRef(onSessionEnd);
 release.current=onSessionEnd;
 const latest=useRef();latest.current=objects||[{id:'selected',title,price,target}];const count=selectedCards(latest.current).size;
 useEffect(()=>{mounted.current=true;let cancelled=false;const check=()=>navigator.xr?.isSessionSupported('immersive-ar').then(v=>{if(!cancelled)setAvailable(v)}).catch(noop);check();navigator.xr?.addEventListener('devicechange',check);
  return()=>{cancelled=true;mounted.current=false;navigator.xr?.removeEventListener('devicechange',check);sessionRef.current?.end().catch(noop)}},[]);
 async function start(auto){
  if(busy.current)return;busy.current=true;let session,anchor,source,renderer,reader,cards,gl,disposed=false,revision=0;
  const announce=text=>{if(mounted.current)setMessage(text)};
  function cleanup(){if(disposed)return;disposed=true;revision++;source?.cancel();anchor?.delete();cards?.clear();reader?.close();renderer?.close();gl?.getExtension('WEBGL_lose_context')?.loseContext();sessionRef.current=null;busy.current=false;if(mounted.current)setActive(false);release.current();}
  try{
   onSessionStart();
   session=await navigator.xr.requestSession('immersive-ar',{requiredFeatures:auto?['camera-access','depth-sensing']:['hit-test'],optionalFeatures:['anchors','dom-overlay'],...(auto&&{depthSensing:{usagePreference:['cpu-optimized'],dataFormatPreference:['luminance-alpha','float32'],matchDepthView:true}}),domOverlay:{root:overlay.current}});
   sessionRef.current=session;session.addEventListener('end',cleanup,{once:true});
   if(!mounted.current){await session.end();return}
   setActive(true);announce(auto?t('xr.autoReady'):t('xr.aim'));
   gl=document.createElement('canvas').getContext('webgl',{alpha:true,xrCompatible:true});if(!gl)throw Error();
   await gl.makeXRCompatible();if(disposed)return;
   const layer=new XRWebGLLayer(session,gl,{alpha:true});session.updateRenderState({baseLayer:layer});
   const ref=await session.requestReferenceSpace('local');if(disposed)return;
   let binding;if(auto){binding=new XRWebGLBinding(session,gl);reader=cameraReader(gl)}
   else{const viewer=await session.requestReferenceSpace('viewer');source=await session.requestHitTestSource({space:viewer});if(disposed){source.cancel();return}}
   if(auto)cards=createXrCards(gl,ref);else renderer=worldRenderer(gl,title,price,target?.outline);
   let lock=null,offset=null,selected=false,pending=false,lastStatus='';
   const status=s=>{if(lastStatus!==s){lastStatus=s;announce(s)}};
   function reset(){cards?.reset();revision++;selected=false;pending=false;anchor?.delete();anchor=null;lock=null;offset=null}
   ref.addEventListener('reset',reset);session.addEventListener('select',()=>{if(!auto)selected=true});
   session.addEventListener('end',()=>ref.removeEventListener('reset',reset),{once:true});
   function place(pos,makeAnchor,head,side=null){
    const ticket=++revision;anchor?.delete();anchor=null;lock={x:pos.x,y:pos.y,z:pos.z};if(side)offset=side;else offset??=lateralOffset(head);
    if(makeAnchor){pending=true;let promise;
     try{promise=makeAnchor()}catch{pending=false;return}
     promise.then(a=>{if(disposed||ticket!==revision)a.delete();else anchor=a}).catch(noop).finally(()=>{if(ticket===revision)pending=false});}
   }
   function frame(time,f){
    if(disposed)return;session.requestAnimationFrame(frame);
    try{
     gl.bindFramebuffer(gl.FRAMEBUFFER,layer.framebuffer);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
     const head=f.getViewerPose(ref);if(auto){const count=cards.frame({objects:latest.current,time,f,head,layer,reader,binding});status(count?t('xr.showing',{n:count}):t('xr.checking'));return}if(!head)return;
     let surface=null;
     const hit=f.getHitTestResults(source)[0];surface=hit?.getPose(ref);
     if(selected){selected=false;if(hit&&surface&&!pending){place(surface.transform.position,typeof hit.createAnchor==='function'?()=>hit.createAnchor():null,head.transform.matrix);status(t('xr.placed'));}}
     const pos=anchor?f.getPose(anchor.anchorSpace,ref)?.transform.position:lock;if(!pos&&(anchor||!surface))return;
     const model=pos?cardTransform(pos,head.transform.matrix,offset):new Float32Array(head.transform.matrix);
     if(!pos){const p=surface.transform.position;model[12]=p.x;model[13]=p.y;model[14]=p.z}
     for(const eye of head.views){const viewport=layer.getViewport(eye);if(viewport)renderer.draw(eye,viewport,model,Boolean(pos))}
    }catch{announce(t('xr.ended'));void session.end().catch(cleanup)}
   }
   session.requestAnimationFrame(frame);
  }catch{try{await session?.end()}catch{}cleanup();announce(auto?t('xr.nodepth'):t('xr.fail'))}
 }
 if(!available||(compact&&!count&&!active))return null;
 return <div>{count>0&&<button className={compact?'':'primary'} disabled={active} onClick={()=>start(true)}>{compact?t('xr.open'):t('xr.auto')}</button>}{!compact&&<button className="option" disabled={active} onClick={()=>start(false)}>{t('xr.manual')}</button>}{!active&&message&&<p role="status">{message}</p>}
 <div ref={overlay} style={active?{position:'fixed',inset:0,pointerEvents:'none',display:'flex',alignItems:'flex-end',justifyContent:'center'}:{}}>
 {active&&<div style={{marginBottom:32,background:'#102022ce',color:'white',padding:12,borderRadius:12,pointerEvents:'auto'}} ref={node=>{if(node)node.onbeforexrselect=e=>e.preventDefault()}}>{message} <button onClick={()=>sessionRef.current?.end()}>{t('xr.close')}</button></div>}</div></div>
}
