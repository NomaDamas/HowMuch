import test from 'node:test';import assert from 'node:assert/strict';
import {identity,makeLandmarks,updatePose,transformSelection} from './similarity-track.js';
test('landmark consensus keeps the silhouette through simultaneous rotation, zoom, translation and occlusion',()=>{
 const w=96,h=128,cx=46,cy=62,src=new Uint8ClampedArray(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){let i=4*(y*w+x);let k=(Math.floor(x/3)*7919+Math.floor(y/3)*9283);const v=((k^(k>>>6)^(k>>>11))%199)+20;src.set([v,v,v,255],i);}
 const polygon=[{x:.18,y:.25},{x:.8,y:.25},{x:.8,y:.8},{x:.18,y:.8}],s={x:.18,y:.25,width:.62,height:.55,polygon};
 const f=makeLandmarks(src,w,h,s);assert(f.length>=12);let pose=identity();
 for(let j=1;j<=4;j++){
  const a=(1+j*.025)*Math.cos(j*.045),b=(1+j*.025)*Math.sin(j*.045),tx=cx+j*.8-a*cx+b*cy,ty=cy+j*.4-b*cx-a*cy,d=a*a+b*b,buf=new Uint8ClampedArray(src.length);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const u=Math.round((a*(x-tx)+b*(y-ty))/d),v=Math.round((-b*(x-tx)+a*(y-ty))/d);if(u>=0&&u<w&&v>=0&&v<h&&x>24)buf.set(src.subarray(4*(v*w+u),4*(v*w+u)+4),4*(y*w+x));}
  pose=updatePose(f,buf,w,h,pose);assert(pose,'track step '+j);const got=transformSelection(s,pose,w,h),expected=transformSelection(s,{a,b,tx,ty},w,h);
  got.polygon.forEach((p,i)=>assert(Math.hypot((p.x-expected.polygon[i].x)*w,(p.y-expected.polygon[i].y)*h)<2));
 }
 assert.equal(updatePose(f,new Uint8ClampedArray(src.length),w,h,pose),null);
});