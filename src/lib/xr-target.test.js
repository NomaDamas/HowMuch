import test from 'node:test';
import assert from 'node:assert/strict';
import {templateFrom,matchTarget,targetWorld} from './xr-target.js';

test('coarse-to-fine refinement locates a tightly patterned object between grid points',()=>{
 const width=96,height=72,data=new Uint8ClampedArray(width*height*4);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=4*(y*width+x);data[i]=18;data[i+1]=18;data[i+2]=18;data[i+3]=255;}
 for(let y=18;y<43;y++)for(let x=27;x<52;x++){const i=4*(y*width+x);data[i]=100+(x%5)*20;data[i+1]=50+(y%7)*14;data[i+2]=210-(x%4)*18;}
 const s={x:.28125,y:.25,width:.2604,height:.3472,polygon:[{x:.28125,y:.25},{x:.5417,y:.25},{x:.5417,y:.5972},{x:.28125,y:.5972}]};
 const t=templateFrom({data,width,height},s);assert(t&&t.pts.length>=8);
 const match=matchTarget(t,{data,width,height});assert(match);assert(Math.abs(match.x-.411)<.08);assert(Math.abs(match.y-.424)<.08);
});
test('narrowing the search to a prior must not let a duplicate inherit a price',()=>{
 const width=128,height=96;
 function scene(boxes){const data=new Uint8ClampedArray(width*height*4).fill(25);
  for(const [x0,y0,size] of boxes)for(let i=0;i<size;i++)for(let j=0;j<size;j++){
   const x=i/size,y=j/size,k=4*((y0+j)*width+x0+i);
   data[k]=40+x*160;data[k+1]=30+y*210;data[k+2]=y>x*.8?215:65;
  }return {data,width,height};
 }
 const x=.125,y=.25,w=.1875,h=.25;
 const s={x,y,width:w,height:h,polygon:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}]};
 const t=templateFrom(scene([[16,24,24]]),s);
 const changed=matchTarget(t,scene([[76,47,33]]));assert.ok(changed);
 assert.ok(Math.abs(changed.x*width-92.5)<3 && Math.abs(changed.y*height-63.5)<3);
 assert.ok(Math.abs(changed.w*width-33)<4);
 assert.equal(matchTarget(t,scene([]),changed),null);
 assert.equal(matchTarget(t,scene([[12,12,33],[76,47,33]]),changed),null);
});
test('measured object depth projects through an asymmetric frustum and rotated, translated eye pose',()=>{
 const P=new Float32Array([2,0,0,0,0,4,0,0,.25,-.5,-1,-1,0,0,-.1,0]);
 const T=new Float32Array([0,0,-1,0,0,1,0,0,1,0,0,0,4,3,2,1]);
 const t={pts:[[-.4,-.3],[-.2,.2],[.1,.2],[.2,-.1],[.1,-.3],[.3,.2],[0,0]]};
 const box={x:.625,y:.25,w:.2,h:.3},view={projectionMatrix:P,transform:{matrix:T}};
 const depth={getDepthInMeters(x,y){assert.ok(x>=.525&&x<=.725&&y>=.1&&y<=.4);return x>.68?5:2}};
 assert.deepEqual(targetWorld(t,box,depth,view),{x:2,y:3,z:1.5});
 assert.equal(targetWorld(t,box,{getDepthInMeters:()=>0},view),null);
 assert.equal(targetWorld(t,box,{getDepthInMeters:x=>x>.63?5:2},view),null);
});
