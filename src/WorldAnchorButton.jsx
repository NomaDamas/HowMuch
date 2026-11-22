import React,{useEffect,useRef,useState} from 'react';
import {cardTransform,lateralOffset,worldRenderer} from './lib/world-anchor.js';
const noop=()=>{};
export default function WorldAnchorButton({title,price,onSessionStart=noop,onSessionEnd=noop}){
 const [available,setAvailable]=useState(false),[active,setActive]=useState(false),[message,setMessage]=useState('');
 const sessionRef=useRef(),overlay=useRef(),mounted=useRef(true),busy=useRef(false),release=useRef(onSessionEnd);
 release.current=onSessionEnd;
 useEffect(()=>{mounted.current=true;let cancelled=false;const check=()=>navigator.xr?.isSessionSupported('immersive-ar').then(v=>{if(!cancelled)setAvailable(v)}).catch(noop);check();navigator.xr?.addEventListener('devicechange',check);
  return()=>{cancelled=true;mounted.current=false;navigator.xr?.removeEventListener('devicechange',check);sessionRef.current?.end().catch(noop)}},[]);
 async function start(){
  if(busy.current)return;busy.current=true;let session,anchor,source,renderer,gl;
  const announce=text=>{if(mounted.current)setMessage(text)};
  let cleaned=false;function cleanup(){if(cleaned)return;cleaned=true;source?.cancel();anchor?.delete();renderer?.close();gl?.getExtension('WEBGL_lose_context')?.loseContext();sessionRef.current=null;busy.current=false;if(mounted.current)setActive(false);release.current();}
  try{
   onSessionStart();
   session=await navigator.xr.requestSession('immersive-ar',{requiredFeatures:['hit-test'],optionalFeatures:['anchors','dom-overlay'],domOverlay:{root:overlay.current}});
   sessionRef.current=session;session.addEventListener('end',cleanup,{once:true});
   if(!mounted.current){await session.end();return}
   setActive(true);announce('고정된 상품 옆의 바닥이나 선반에 조준한 뒤 탭하세요.');
   gl=document.createElement('canvas').getContext('webgl',{alpha:true,xrCompatible:true});if(!gl)throw Error();
   await gl.makeXRCompatible();if(cleaned)return;const layer=new XRWebGLLayer(session,gl,{alpha:true});session.updateRenderState({baseLayer:layer});
   const reference=await session.requestReferenceSpace('local'),viewer=await session.requestReferenceSpace('viewer');
   if(cleaned)return;
   source=await session.requestHitTestSource({space:viewer});if(cleaned){source.cancel();return}renderer=worldRenderer(gl,title,price);
   let lock=null,offset=null,selected=false,pending=false,revision=0;
   function reset(){revision++;selected=false;pending=false;anchor?.delete();anchor=null;lock=null;announce('표면을 다시 조준하고 탭하세요.')}
   reference.addEventListener('reset',reset);
   session.addEventListener('select',()=>{if(!pending)selected=true});
   session.addEventListener('end',()=>reference.removeEventListener('reset',reset),{once:true});
   function frame(_time,f){
    if(cleaned)return;session.requestAnimationFrame(frame);
    gl.bindFramebuffer(gl.FRAMEBUFFER,layer.framebuffer);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    const view=f.getViewerPose(reference);if(!view)return;
    const hit=f.getHitTestResults(source)[0],surface=hit?.getPose(reference);
    if(selected){selected=false;
     if(hit && surface && !pending){
      const ticket=++revision;anchor?.delete();anchor=null;lock=surface.transform.position;offset=lateralOffset(view.transform.matrix);
      if(typeof hit.createAnchor==='function'){pending=true;
       hit.createAnchor().then(next=>{if(cleaned||ticket!==revision){next.delete();return}anchor=next;announce('가격 카드를 고정했습니다. 다른 표면을 탭하면 다시 배치합니다.')})
        .catch(()=>{if(!cleaned&&ticket===revision)announce('공간 위치에 배치했습니다. 추적 재설정 시 다시 탭하세요.')}).finally(()=>{if(ticket===revision)pending=false});
      }else announce('공간 위치에 배치했습니다. 추적 재설정 시 다시 탭하세요.');
     }
    }
    const position=anchor?f.getPose(anchor.anchorSpace,reference)?.transform.position:lock;
    if(!position&&!surface)return;
    // When an existing anchor is lost, hide its card; never show a stale pose.
    if(anchor&&!position)return;
    const model=position?cardTransform(position,view.transform.matrix,offset):new Float32Array(view.transform.matrix);
    if(!position){const p=surface.transform.position;model[12]=p.x;model[13]=p.y;model[14]=p.z}
    for(const eye of view.views){const viewport=layer.getViewport(eye);if(viewport)renderer.draw(eye,viewport,model,Boolean(position))}
   }
   session.requestAnimationFrame(frame);
  }catch{try{await session?.end()}catch{}cleanup();announce('이 기기에서 공간 고정을 시작하지 못했습니다. 일반 카메라로 돌아갑니다.')}
 }
 if(!available)return null;
 return <div><button type="button" className="option" disabled={active} onClick={start}>고정된 상품 옆에 AR로 배치</button>{!active&&message&&<p role="status">{message}</p>}
 <div ref={overlay} style={active?{position:'fixed',inset:0,pointerEvents:'none',display:'flex',alignItems:'flex-end',justifyContent:'center'}:{}}>
 {active&&<div style={{marginBottom:32,background:'#102022ce',color:'white',padding:12,borderRadius:12,pointerEvents:'auto'}} ref={node=>{if(node)node.onbeforexrselect=e=>e.preventDefault()}}>{message} <button type="button" onClick={()=>sessionRef.current?.end()}>AR 닫기</button></div>}
 </div></div>
}
