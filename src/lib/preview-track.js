// References are captured from the same frame as segmentation, not the later network response.
export function trackPreview(video, selection, onPosition, initialFrame=video){
  const c=document.createElement('canvas'),w=c.width=96,h=c.height=Math.max(12,Math.min(160,Math.round(w*video.videoHeight/video.videoWidth)));
  const ctx=c.getContext('2d',{willReadFrequently:true}),read=source=>{ctx.drawImage(source,0,0,w,h);return ctx.getImageData(0,0,w,h).data};
  const poly=selection.polygon, samples=[], initial=read(initialFrame);
  for(let j=0;j<10;j++)for(let i=0;i<10;i++){
    const x=selection.x+(i+.5)*selection.width/10,y=selection.y+(j+.5)*selection.height/10;
    const inside=(selection.contours?.length?selection.contours:[poly]).reduce((val,ring)=>ring.reduce((a,p,k)=>{const q=ring[(k+1)%ring.length];return (p.y>y)!==(q.y>y)&&x<(q.x-p.x)*(y-p.y)/(q.y-p.y)+p.x?!a:a},val),false);
    if(inside){const u=Math.min(w-1,Math.floor(x*w)),v=Math.min(h-1,Math.floor(y*h)),n=4*(v*w+u);samples.push([u,v,initial[n],initial[n+1],initial[n+2]]);}
  }
  let dx=0,dy=0,miss=0;
  function tick(){if(video.readyState<2||!samples.length)return;const data=read(video);
    const cost=(x,y,limit)=>{let sum=0;for(const [u,v,r,g,b] of samples){if(u+x<0||u+x>=w||v+y<0||v+y>=h)return Infinity;
      const n=4*((v+y)*w+u+x);sum+=Math.abs(data[n]-r)+Math.abs(data[n+1]-g)+Math.abs(data[n+2]-b);if(sum>limit)return Infinity;}return sum;};
    let best=cost(dx,dy,Infinity),bx=dx,by=dy,other=Infinity;const wide=miss>=2,rad=wide?Math.max(w,h):6,step=wide?3:1;
    if(best!==0||wide)for(let y=Math.max(-h,dy-rad);y<=Math.min(h,dy+rad);y+=step)for(let x=Math.max(-w,dx-rad);x<=Math.min(w,dx+rad);x+=step){
      const n=cost(x,y,best+samples.length*3);if(n<best){if(Math.hypot(x-bx,y-by)>5)other=Math.min(other,best);best=n;bx=x;by=y;}else if(Math.hypot(x-bx,y-by)>5)other=Math.min(other,n);
    }
    if(best>samples.length*3*25||(wide&&other<=best+samples.length*2)){if(++miss===2)onPosition(null);return;}
    if(dx===bx&&dy===by&&!miss)return;miss=0;dx=bx;dy=by;onPosition({...selection,x:selection.x+dx/w,y:selection.y+dy/h,polygon:poly.map(p=>({x:p.x+dx/w,y:p.y+dy/h})),contours:selection.contours?.map(r=>r.map(p=>({x:p.x+dx/w,y:p.y+dy/h})))});
  }
  const timer=setInterval(tick,160);return ()=>clearInterval(timer);
}