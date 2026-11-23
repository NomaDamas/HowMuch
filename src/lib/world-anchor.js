// Column-major WebGL matrices, all physical dimensions are in meters.
export function multiply4(a,b){
 const r=new Float32Array(16);
 for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let i=0;i<4;i++)r[col*4+row]+=a[i*4+row]*b[col*4+i];
 return r;
}
export function lateralOffset(head){
 const h=Math.hypot(head[0],head[2]);
 return h>.001?{x:.12*head[0]/h,z:.12*head[2]/h}:{x:.12,z:0};
}
export function cardTransform(position, head, offset){
 // Billboard faces the viewer; the price label stays 12 cm beside the hit and
 // 8 cm above it. Do not move the anchor as the camera moves.
 const m=new Float32Array(head); m[12]=position.x+offset.x; m[13]=position.y+(offset.y??0)+.08; m[14]=position.z+offset.z;
 return m;
}
export function worldRenderer(gl,title,price,outline){
 const program=gl.createProgram(), shaders=[];
  for(const [type,code] of [[gl.VERTEX_SHADER,'attribute vec2 p;uniform mat4 m;uniform vec2 size;varying vec2 uv;void main(){uv=vec2(p.x+.5,.5-p.y);gl_Position=m*vec4(p*size,0.,1.);}'],[gl.FRAGMENT_SHADER,'precision mediump float;uniform sampler2D tex;uniform float marker;varying vec2 uv;void main(){gl_FragColor=texture2D(tex,uv);if(marker>.5&&gl_FragColor.a<.08)discard;}']]){
  const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('shader unavailable');gl.attachShader(program,s);shaders.push(s);
 }
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('program unavailable');
 const vertices=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vertices);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-.5,-.5,.5,-.5,-.5,.5,.5,.5]),gl.STATIC_DRAW);
 const image=document.createElement('canvas');image.width=640;image.height=240;const ctx=image.getContext('2d');
 const tex=gl.createTexture(),markerImage=document.createElement('canvas');markerImage.width=640;markerImage.height=240;const markerCtx=markerImage.getContext('2d');
 function renderOutline(shape){markerCtx.clearRect(0,0,640,240);const rings=Array.isArray(shape?.[0])?shape:shape?.length?[shape]:[[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]];const points=rings.flat(),xs=points.map(p=>p.x),ys=points.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),w=Math.max(1,maxX-minX),h=Math.max(1,maxY-minY);markerCtx.strokeStyle='rgba(220,255,113,.96)';markerCtx.lineWidth=7;markerCtx.setLineDash([14,10]);markerCtx.lineJoin='round';for(const ring of rings){markerCtx.beginPath();ring.forEach((p,i)=>{const x=18+(p.x-minX)/w*604,y=18+(p.y-minY)/h*204;i?markerCtx.lineTo(x,y):markerCtx.moveTo(x,y)});markerCtx.closePath();markerCtx.stroke();}}
 renderOutline(outline);
 const markerTex=gl.createTexture();
 gl.bindTexture(gl.TEXTURE_2D,markerTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,markerImage);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);for(const wrap of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,wrap,gl.CLAMP_TO_EDGE);
 const bind=(image,texture)=>{gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image)};
 const update= (title,price)=>{ctx.clearRect(0,0,640,240);
 ctx.fillStyle='rgba(11,28,27,.84)';ctx.beginPath();ctx.roundRect(2,2,636,236,36);ctx.fill();
 ctx.fillStyle='#d8f887';ctx.font='bold 23px sans-serif';ctx.fillText('HOWMUCH   /   조회 가격',34,55);
 ctx.fillStyle='#ffffff';ctx.font='bold 35px sans-serif';ctx.fillText(title,32,119,570);ctx.font='bold 46px sans-serif';ctx.fillText(price||'확인된 가격 없음',32,193,570);
 bind(image,tex);}
 update(title,price);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 for(const wrap of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,wrap,gl.CLAMP_TO_EDGE);
 const p=gl.getAttribLocation(program,'p'),m=gl.getUniformLocation(program,'m'),sz=gl.getUniformLocation(program,'size'),mark=gl.getUniformLocation(program,'marker');
 return {
 update,
 draw(view,viewport,model,card){gl.viewport(viewport.x,viewport.y,viewport.width,viewport.height);gl.useProgram(program);gl.enable(gl.BLEND);gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  gl.bindTexture(gl.TEXTURE_2D,card?tex:markerTex);gl.bindBuffer(gl.ARRAY_BUFFER,vertices);gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);gl.uniform2f(sz,card?.22:.22,card?.0825:.0825);gl.uniform1f(mark,card?0:1);
  gl.uniformMatrix4fv(m,false,multiply4(view.projectionMatrix,multiply4(view.transform.inverse.matrix,model)));gl.drawArrays(gl.TRIANGLE_STRIP,0,4);},
 close(){gl.deleteTexture(tex);gl.deleteTexture(markerTex);gl.deleteBuffer(vertices);gl.deleteProgram(program);for(const s of shaders)gl.deleteShader(s)}
 };
}
