import {worldRenderer,cardTransform} from './world-anchor.js';
import {matchTarget,targetWorld} from './xr-target.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
export function selectedCards(objects){
 const found=new Map();for(const o of objects||[]){if(o?.id!=null&&o.target&&!found.has(o.id))found.set(o.id,o);if(found.size===4)break}return found;
}
export function createXrCards(gl,ref){
 const slots=new Map();let last=-Infinity;
 function resetSlot(s){s.ticket++;s.anchor?.delete();Object.assign(s,{anchor:null,pending:false,position:null,offset:null,prior:null,visible:false,streak:0,lastPoint:null});}
 function clear(){for(const s of slots.values()){resetSlot(s);s.renderer.close()}slots.clear();}
 function sync(objects){
  const wanted=selectedCards(objects);
  for(const [id,s] of slots)if(!wanted.has(id)){resetSlot(s);s.renderer.close();slots.delete(id)}
  for(const [id,o] of wanted){
   let s=slots.get(id);
   if(!s){s={ticket:0,renderer:worldRenderer(gl,o.title,o.price),title:o.title,price:o.price,target:o.target};resetSlot(s);slots.set(id,s)}
   if(s.target!==o.target){resetSlot(s);s.target=o.target;}
   if(s.title!==o.title||s.price!==o.price){s.renderer.update(o.title,o.price);s.title=o.title;s.price=o.price;}
  }
 }
 function sample(f,head,im,depth){
  const eye=head.views[0],matches=[];
  for(const s of slots.values()){
   // Search globally: matching only near the previous anchor can conceal a duplicate.
   const match=im&&matchTarget(s.target,im);matches.push({s,match});
  }
  for(const {s,match} of matches){
   const conflict=match&&matches.some(x=>x.s!==s&&x.match&&Math.abs(x.match.x-match.x)<Math.min(match.w,x.match.w)*.45&&Math.abs(x.match.y-match.y)<Math.min(match.h,x.match.h)*.45);
   const pos=!conflict&&depth&&match&&targetWorld(s.target,match,depth,eye);
   if(!pos){s.visible=false;s.streak=0;s.lastPoint=null;continue}
   s.streak=s.lastPoint&&distance(pos,s.lastPoint)<.10?s.streak+1:1;s.lastPoint=pos;s.visible=s.streak>=2;
   if(!s.visible)continue;
   const m=eye.transform.inverse.matrix,z=-(m[2]*pos.x+m[6]*pos.y+m[10]*pos.z+m[14]);
   s.side=(match.x>.58?-1:1)*(.12+match.w*z/eye.projectionMatrix[0]);
   if(s.pending)continue;
   const current=s.anchor?f.getPose(s.anchor.anchorSpace,ref)?.transform.position:s.position;
   if(current&&distance(pos,current)<=.035)continue;
   s.position={...pos};const ticket=++s.ticket;s.anchor?.delete();s.anchor=null;
   if(typeof f.createAnchor==='function'){s.pending=true;try{f.createAnchor(new XRRigidTransform(pos),ref).then(a=>{if(ticket!==s.ticket)a.delete();else s.anchor=a}).catch(()=>{}).finally(()=>{if(ticket===s.ticket)s.pending=false});}catch{s.pending=false}}
  }
 }
 return {clear,reset(){for(const s of slots.values())resetSlot(s);last=-Infinity},
 frame({objects,time,f,head,layer,reader,binding}){
  sync(objects);if(!head){for(const s of slots.values()){s.visible=false;s.streak=0;s.lastPoint=null}return 0}
  if(time-last>=140&&slots.size){last=time;const eye=head.views[0],camera=eye?.camera,im=camera&&reader.read(binding,camera);const depth=im&&f.getDepthInformation(eye);
   sample(f,head,im,depth);
  }
  let count=0;for(const s of slots.values()){if(!s.visible)continue;const pos=s.anchor?f.getPose(s.anchor.anchorSpace,ref)?.transform.position:s.position;if(!pos)continue;
   const m=head.transform.matrix,side=s.side;
   const model=cardTransform(pos,m,{x:m[0]*side,y:m[1]*side,z:m[2]*side});for(const eye of head.views){const vp=layer.getViewport(eye);if(vp)s.renderer.draw(eye,vp,model,true)}count++;
  }return count;
 }};
}
