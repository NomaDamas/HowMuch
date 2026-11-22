// A small, ephemeral RGB template sampled strictly inside the SAM contour (including holes).
// This runs locally. It is not a product identifier and is never used for price search.
function inside(x,y,rings){
 let ok=false;
 for(const r of rings)for(let i=0,j=r.length-1;i<r.length;j=i++){
  const a=r[i],b=r[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)ok=!ok;
 }return ok;
}
const pixel=(im,x,y)=>4*(Math.min(im.height-1,Math.max(0,Math.floor(y*im.height)))*im.width+Math.min(im.width-1,Math.max(0,Math.floor(x*im.width))));
export function templateFrom(im,s,opaqueInterior=false){
 const pts=[],cx=s.x+s.width/2,cy=s.y+s.height/2;
 for(let j=0;j<11;j++)for(let i=0;i<11;i++){
  const dx=(i+.5)/11-.5,dy=(j+.5)/11-.5,x=cx+dx*s.width,y=cy+dy*s.height;
  if(!inside(x,y,s.contours?.length?s.contours:[s.polygon]))continue;
  const k=pixel(im,x,y);
  if(opaqueInterior){ // Exclude boundaries, transparent holes and antialiasing. No texture resizing before this gate.
   const u=Math.floor(x*im.width),v=Math.floor(y*im.height);
   if(u<1||v<1||u+1>=im.width||v+1>=im.height)continue;
   if([-1,0,1].some(j=>[-1,0,1].some(i=>im.data[k+4*(i+j*im.width)+3]!==255)))continue;
  }
  pts.push([dx,dy,...im.data.slice(k,k+3)]);
 }
 if(pts.length<8)return null;
 const mean=[0,1,2].map(i=>pts.reduce((a,p)=>a+p[i+2],0)/pts.length);
 const texture=pts.reduce((a,p)=>a+p.slice(2).reduce((b,v,i)=>b+Math.abs(v-mean[i]),0)/3,0)/pts.length;
 if(texture<11)return null; // Solid colors alone cannot distinguish the target.
 return {pts,aspect:s.width*im.width/(s.height*im.height),height:s.height,texture};
}
export function matchTarget(t,im,prior=null){
 if(!t)return null;
 // Compare every region even when a prior exists: an identical neighbour must not inherit a price.
 const candidates=[], {width:W,height:H,data}=im, points=t.pts;
 function score(x,y,w,h,stride,limit){
  let sum=0,n=Math.ceil(points.length/stride),max=limit*3*n;
  for(let i=0;i<points.length;i+=stride){const [dx,dy,r,g,b]=points[i];
   const k=4*(Math.min(H-1,Math.floor((y+dy*h)*H))*W+Math.min(W-1,Math.floor((x+dx*w)*W)));
   sum+=Math.abs(data[k]-r)+Math.abs(data[k+1]-g)+Math.abs(data[k+2]-b);if(sum>max)return Infinity;
  }return sum/(3*n);
 }
 const scales=new Set([.5,.72,1,1.4,2,...(prior?[prior.h/t.height]:[])]);
 for(const scale of scales){
  const h=t.height*scale,w=h*t.aspect*H/W;
  if(w>1||h>1||w*W<5||h*H<5)continue;
  const sx=Math.max(1/W,w/8),sy=Math.max(1/H,h/8),seeds=new Map();
  for(let y=h/2;y<=1-h/2;y+=sy)for(let x=w/2;x<=1-w/2;x+=sx){
   const cost=score(x,y,w,h,4,45);if(!Number.isFinite(cost))continue;
   const key=Math.floor(2*x/w)+','+Math.floor(2*y/h),old=seeds.get(key);
   if(!old||cost<old.cost)seeds.set(key,{x,y,cost});
  }
  // A highly repetitive scene cannot establish identity; avoid unbounded refinement.
  if(seeds.size>150)return null;
  for(const seed of seeds.values()){
   let best=null;
   for(const factor of [.93,1,1.07]){const ww=w*factor,hh=h*factor;
    for(let iy=-2;iy<=2;iy++)for(let ix=-2;ix<=2;ix++){
     const x=seed.x+ix*sx/3,y=seed.y+iy*sy/3;
     if(x<ww/2||x>1-ww/2||y<hh/2||y>1-hh/2)continue;
     const cost=score(x,y,ww,hh,1,best?.score??27);
     if(Number.isFinite(cost)&&(!best||cost<best.score))best={x,y,w:ww,h:hh,score:cost};
    }
   }if(best)candidates.push(best);
  }
 }
 candidates.sort((a,b)=>a.score-b.score);
 const best=candidates[0];if(!best||best.score>23)return null;
 return candidates.some(p=>p.score<best.score+4&&(Math.abs(p.x-best.x)>best.w*.48||Math.abs(p.y-best.y)>best.h*.48))?null:best;
}
// getDepthInMeters takes normalized *view* coordinates (origin top-left).
// Depth is axial distance, not ray length. Use the XR eye's asymmetric frustum.
export function targetWorld(t,match,depth,view){
 if(!match||!depth)return null;
 const valid=[];
 for(const [dx,dy] of t.pts){const x=match.x+dx*match.w,y=match.y+dy*match.h;
  const z=depth.getDepthInMeters(x,y);if(Number.isFinite(z)&&z>=.12&&z<=6)valid.push({x,y,z});}
 if(valid.length<Math.max(5,t.pts.length*.45))return null;
 valid.sort((a,b)=>a.z-b.z);
 const mid=valid[valid.length>>1].z,cohort=valid.filter(p=>Math.abs(p.z-mid)<Math.max(.045,.08*mid));
 if(cohort.length<valid.length*.7)return null;
 const P=view.projectionMatrix,T=view.transform.matrix,z=mid,x=((2*match.x-1+P[8])/P[0])*z,y=((1-2*match.y+P[9])/P[5])*z;
 return {x:T[0]*x+T[4]*y-T[8]*z+T[12],y:T[1]*x+T[5]*y-T[9]*z+T[13],z:T[2]*x+T[6]*y-T[10]*z+T[14]};
}
// In-process preview matching only. Never serialize samples from the unmasked preview.
export function previewTemplate(canvas,s){
 const c=document.createElement('canvas');c.width=160;c.height=Math.max(1,Math.round(canvas.height*160/canvas.width));const ctx=c.getContext('2d');ctx.drawImage(canvas,0,0,c.width,c.height);return templateFrom(ctx.getImageData(0,0,c.width,c.height),s);
}

// Source must be the selected object's RGBA cutout. Never resample the full scene for handoff.
export async function captureMaskedSignature(png,s,aspect){
 if(!png?.startsWith('data:image/png;base64,'))return null;
 const img=new Image();img.src=png;await img.decode();
 if(img.width*img.height>12_000_000)return null;
 const c=document.createElement('canvas');c.width=img.width;c.height=img.height;
 const ctx=c.getContext('2d');ctx.drawImage(img,0,0);
 const mask={x:0,y:0,width:1,height:1,polygon:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]};
 const t=templateFrom(ctx.getImageData(0,0,c.width,c.height),mask,true);
 return t&&{...t,height:s.height,aspect};
}
