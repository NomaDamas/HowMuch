// Sparse patch correspondences in the original mask; robust similarity fit rejects
// moving background, partial occlusion and ambiguous repeated texture.
export const identity=()=>({a:1,b:0,tx:0,ty:0});
const at=(p,t)=>({x:t.a*p.x-t.b*p.y+t.tx,y:t.b*p.x+t.a*p.y+t.ty});
const lum=(d,w,x,y)=>{const i=4*(Math.round(y)*w+Math.round(x));return (2*d[i]+5*d[i+1]+d[i+2])/8};
const inside=(x,y,rings)=>rings.reduce((v,ring)=>ring.reduce((q,p,i)=>{const n=ring[(i+1)%ring.length];return (p.y>y)!==(n.y>y)&&x<(n.x-p.x)*(y-p.y)/(n.y-p.y)+p.x?!q:q},v),false);
export function makeLandmarks(data,w,h,s){
 const rings=s.contours?.length?s.contours:[s.polygon],pool=[];
 for(let y=Math.max(4,Math.ceil(s.y*h));y<Math.min(h-4,(s.y+s.height)*h);y+=2)for(let x=Math.max(4,Math.ceil(s.x*w));x<Math.min(w-4,(s.x+s.width)*w);x+=2){
  if(![[0,0],[-2,-2],[2,-2],[-2,2],[2,2]].every(([i,j])=>inside((x+i)/w,(y+j)/h,rings)))continue;
  let xx=0,xy=0,yy=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){
   const dx=lum(data,w,x+i+1,y+j)-lum(data,w,x+i-1,y+j),dy=lum(data,w,x+i,y+j+1)-lum(data,w,x+i,y+j-1);
   xx+=dx*dx;xy+=dx*dy;yy+=dy*dy;}
  const quality=(xx+yy-Math.hypot(xx-yy,2*xy))/2;if(quality>400)pool.push({x,y,quality});
 }
 const features=[];for(const p of pool.sort((a,b)=>b.quality-a.quality)){
  if(features.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<3.8))continue;
  p.values=[];for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++)p.values.push(lum(data,w,p.x+i,p.y+j));
  features.push(p);if(features.length===24)break;
 }return features;
}
const posePair=(p,q)=>{const x=q.x-p.x,y=q.y-p.y,u=q.u-p.u,v=q.v-p.v,d=x*x+y*y;if(d<20)return null;
 const a=(u*x+v*y)/d,b=(v*x-u*y)/d;return {a,b,tx:p.u-a*p.x+b*p.y,ty:p.v-b*p.x-a*p.y}};
export function updatePose(features,data,w,h,prior){
 if(features.length<4)return null;const matches=[],offsets=[];
 for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++)offsets.push([Math.round(prior.a*i-prior.b*j),Math.round(prior.b*i+prior.a*j)]);
 for(const p of features){
  const pred=at(p,prior),x0=Math.round(pred.x),y0=Math.round(pred.y);let best=Infinity,second=Infinity,bu=0,bv=0;
  for(let j=-6;j<=6;j++)for(let i=-6;i<=6;i++){const u=x0+i,v=y0+j;if(u<5||v<5||u>=w-5||v>=h-5)continue;
   let err=0;for(let k=0;k<25;k++){const [ox,oy]=offsets[k];err+=Math.abs(lum(data,w,u+ox,v+oy)-p.values[k]);if(err>second)break;}
   if(err<best){second=best;best=err;bu=u;bv=v}else if(err<second)second=err;
  }
  if(best<25*30&&best+12<.96*second)matches.push({...p,u:bu,v:bv});
 }
 if(matches.length<4)return null;
 let supporters=[],residual=Infinity;
 for(let i=0;i<matches.length;i++)for(let j=0;j<i;j++){
  const t=posePair(matches[i],matches[j]);if(!t||Math.hypot(t.a,t.b)<.55||Math.hypot(t.a,t.b)>1.9)continue;
  let err=0;const inliers=matches.filter(p=>{const n=at(p,t),d=Math.hypot(n.x-p.u,n.y-p.v);if(d<=1.75){err+=d;return true}return false});
  if(inliers.length>supporters.length||(inliers.length===supporters.length&&err<residual)){supporters=inliers;residual=err}
 }
 if(supporters.length<Math.max(4,Math.ceil(features.length*.32),Math.ceil(matches.length*.58)))return null;
 const n=supporters.length,m=supporters.reduce((s,p)=>s.map((v,i)=>v+p[['x','y','u','v'][i]]/n),[0,0,0,0]);
 let dot=0,cross=0,d=0;for(const p of supporters){const x=p.x-m[0],y=p.y-m[1],u=p.u-m[2],v=p.v-m[3];dot+=x*u+y*v;cross+=x*v-y*u;d+=x*x+y*y}if(d<30)return null;
 const a=dot/d,b=cross/d;return {a,b,tx:m[2]-a*m[0]+b*m[1],ty:m[3]-b*m[0]-a*m[1]};
}
export function transformSelection(s,t,w,h){
 const map=p=>{const q=at({x:p.x*w,y:p.y*h},t);return{x:q.x/w,y:q.y/h}};
 const polygon=s.polygon.map(map),contours=s.contours?.map(r=>r.map(map)),all=contours?.flat()||polygon;
 const xs=all.map(p=>p.x),ys=all.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);
 return {...s,x,y,width:Math.max(...xs)-x,height:Math.max(...ys)-y,polygon,contours};
}