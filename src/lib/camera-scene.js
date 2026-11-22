import {coverTransform} from './geometry.js';

export const full = {x:0,y:0,width:1,height:1};
export const clamp = (x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export function snapshot(video) {
  const ratio=Math.min(1,960/Math.max(video.videoWidth,video.videoHeight)), c=document.createElement('canvas');
  c.width=Math.max(1,Math.round(video.videoWidth*ratio)); c.height=Math.max(1,Math.round(video.videoHeight*ratio));
  c.getContext('2d').drawImage(video,0,0,c.width,c.height); return c;
}
export function cutout(source,s){
  const c=document.createElement('canvas');c.width=Math.max(1,Math.round(s.width*source.width));c.height=Math.max(1,Math.round(s.height*source.height));
  const ctx=c.getContext('2d');ctx.beginPath();
  for(const ring of s.contours?.length?s.contours:[s.polygon]){ring.forEach((p,i)=>ctx[i?'lineTo':'moveTo']((p.x-s.x)*source.width,(p.y-s.y)*source.height));ctx.closePath();}
  ctx.clip('evenodd');ctx.drawImage(source,-s.x*source.width,-s.y*source.height);return c.toDataURL('image/png');
}
export function toScreen(s,viewport,video){
  const t=coverTransform(viewport,{width:video.videoWidth,height:video.videoHeight});
  const map=p=>({x:(p.x*video.videoWidth*t.scale-t.offsetX)/viewport.width,y:(p.y*video.videoHeight*t.scale-t.offsetY)/viewport.height});const pts=s.polygon.map(map),contours=s.contours?.map(r=>r.map(map));
  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);return {polygon:pts,contours,x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};
}
export function overlap(a,b){
  if(!a||!b)return 0; const w=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x)),h=Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));return w*h/(a.width*a.height+b.width*b.height-w*h||1);
}
export function sampleFrame(video,buffer){
  const ctx=buffer.getContext('2d',{willReadFrequently:true});ctx.drawImage(video,0,0,buffer.width,buffer.height);return ctx.getImageData(0,0,buffer.width,buffer.height).data;
}
export function distance(a,b){if(!a||!b||a.length!==b.length)return Infinity;let d=0;for(let i=0;i<a.length;i+=4){for(let k=0;k<3;k++)d+=Math.abs(a[i+k]-b[i+k]);}return d/(a.length*.75);}
export function boxForHud(s,stage,size,used=[]){
 const w=size.width,h=size.height,cx=(s.x+s.width/2)*stage.width,cy=(s.y+s.height/2)*stage.height;
 const left=s.x*stage.width-w-12,right=(s.x+s.width)*stage.width+12,top=cy-h/2;
 const candidates=[[right,top],[left,top],[cx-w/2,s.y*stage.height-h-8],[cx-w/2,(s.y+s.height)*stage.height+8],[right,top-h-8],[left,top+h+8]];
 let best,score=Infinity;for(const [x,y] of candidates){const nx=clamp(x,6,Math.max(6,stage.width-w-6)),ny=clamp(y,62,Math.max(62,stage.height-h-90));
 const box={x:nx,y:ny,width:w,height:h};const body={x:s.x*stage.width,y:s.y*stage.height,width:s.width*stage.width,height:s.height*stage.height};const penalty=used.reduce((n,b)=>n+overlap(b,box)*1500,0)+overlap(body,box)*180+Math.hypot(x-nx,y-ny);if(penalty<score){best=box;score=penalty;}}return best;
}