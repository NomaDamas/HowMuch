// Sample a UA-owned, view-aligned XRCamera texture during its XRFrame only.
// Render into our own small framebuffer, flipping vertically for top-left CPU image coordinates.
export function cameraReader(gl){
 const program=gl.createProgram(),shaders=[],fb=gl.createFramebuffer(),buf=gl.createBuffer(),tex=gl.createTexture();
 let w=0,h=0,data;
 function close(){gl.deleteFramebuffer(fb);gl.deleteBuffer(buf);gl.deleteTexture(tex);gl.deleteProgram(program);shaders.forEach(s=>gl.deleteShader(s))}
 try {
 for(const [type,source] of [[gl.VERTEX_SHADER,'attribute vec2 p;varying vec2 uv;void main(){uv=vec2(.5+.5*p.x,.5-.5*p.y);gl_Position=vec4(p,0.,1.);}'],[gl.FRAGMENT_SHADER,'precision mediump float;uniform sampler2D image;varying vec2 uv;void main(){gl_FragColor=texture2D(image,uv);}']]){
  const sh=gl.createShader(type);shaders.push(sh);gl.shaderSource(sh,source);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error('xr_camera_shader');gl.attachShader(program,sh);
 }
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('xr_camera_shader');
 gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
 const p=gl.getAttribLocation(program,'p');
 return {close,read(binding,camera){
  const image=binding.getCameraImage(camera);if(!image)return null;
  const framebuffer=gl.getParameter(gl.FRAMEBUFFER_BINDING);
  try{
   gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.activeTexture(gl.TEXTURE0);
   const width=Math.max(1,Math.round(144*camera.width/Math.max(camera.width,camera.height))),height=Math.max(1,Math.round(144*camera.height/Math.max(camera.width,camera.height)));
   if(w!==width||h!==height){w=width;h=height;data=new Uint8Array(w*h*4);gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    for(const wrap of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,wrap,gl.CLAMP_TO_EDGE);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('xr_camera_framebuffer');}
   gl.viewport(0,0,w,h);gl.disable(gl.BLEND);gl.useProgram(program);gl.bindTexture(gl.TEXTURE_2D,image);gl.bindBuffer(gl.ARRAY_BUFFER,buf);
   gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,data);return {data,width:w,height:h};
  }finally{gl.bindTexture(gl.TEXTURE_2D,null);gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer)}
 }};
 }catch(e){close();throw e}
}
