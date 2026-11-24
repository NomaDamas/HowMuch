package org.nomadamas.howmuch;

import android.graphics.*;
import android.opengl.GLES20;
import android.opengl.GLUtils;
import android.text.TextUtils;
import android.text.TextPaint;
import java.nio.*;

// A camera-facing 18 x 7.5 cm translucent rectangle. Vertex coordinates are in
// meters; GPU projection, near-plane clipping and perspective are shared with ARCore.
final class WorldCard {
    private final String name,label; private int program,shadowTex,plateTex,textTex,coord,mat,center,right,up;
    private final FloatBuffer quad=ByteBuffer.allocateDirect(32).order(ByteOrder.nativeOrder()).asFloatBuffer();
    WorldCard(String n,String l){name=n;label=l;quad.put(new float[]{0,0,1,0,0,1,1,1}).position(0);}
    private static int shader(int type,String src){int id=GLES20.glCreateShader(type);GLES20.glShaderSource(id,src);GLES20.glCompileShader(id);int[] ok={0};GLES20.glGetShaderiv(id,GLES20.GL_COMPILE_STATUS,ok,0);if(ok[0]!=1)throw new IllegalStateException(GLES20.glGetShaderInfoLog(id));return id;}
    void create(){
        String vs="attribute vec2 q;uniform mat4 vp;uniform vec3 origin,rightVec,upVec;varying vec2 uv;void main(){uv=vec2(q.x,1.-q.y);gl_Position=vp*vec4(origin+rightVec*(q.x*.18)+upVec*((q.y-.5)*.075),1.);}";
        String fs="precision mediump float;varying vec2 uv;uniform sampler2D tex;void main(){gl_FragColor=texture2D(tex,uv);}";
        program=GLES20.glCreateProgram();GLES20.glAttachShader(program,shader(GLES20.GL_VERTEX_SHADER,vs));GLES20.glAttachShader(program,shader(GLES20.GL_FRAGMENT_SHADER,fs));GLES20.glLinkProgram(program);
        int[] ok={0};GLES20.glGetProgramiv(program,GLES20.GL_LINK_STATUS,ok,0);if(ok[0]!=1)throw new IllegalStateException(GLES20.glGetProgramInfoLog(program));
        coord=GLES20.glGetAttribLocation(program,"q");mat=GLES20.glGetUniformLocation(program,"vp");center=GLES20.glGetUniformLocation(program,"origin");right=GLES20.glGetUniformLocation(program,"rightVec");up=GLES20.glGetUniformLocation(program,"upVec");
        // Three layers give real parallax when the phone moves: a soft shadow behind, a glass plate, and the price floating in front.
        Bitmap shadow=Bitmap.createBitmap(480,200,Bitmap.Config.ARGB_8888);Canvas sc=new Canvas(shadow);Paint sp=new Paint(Paint.ANTI_ALIAS_FLAG);sp.setColor(0x66000000);sp.setMaskFilter(new BlurMaskFilter(18,BlurMaskFilter.Blur.NORMAL));sc.drawRoundRect(30,30,450,170,34,34,sp);
        Bitmap plate=Bitmap.createBitmap(480,200,Bitmap.Config.ARGB_8888);Canvas pc=new Canvas(plate);Paint pp=new Paint(Paint.ANTI_ALIAS_FLAG);
        pp.setShader(new LinearGradient(0,0,480,200,0xd8486058,0xd8142220,Shader.TileMode.CLAMP));pc.drawRoundRect(1,1,479,199,36,36,pp);pp.setShader(null);
        pp.setStyle(Paint.Style.STROKE);pp.setStrokeWidth(2.5f);pp.setColor(0x66ffffff);pc.drawRoundRect(2,2,478,198,35,35,pp);
        pp.setStyle(Paint.Style.FILL);pp.setColor(0xffc8ff5a);pc.drawRoundRect(0,0,110,6,3,3,pp);
        TextPaint tp=new TextPaint(Paint.ANTI_ALIAS_FLAG);tp.setColor(0xf0ffffff);tp.setTextSize(34);tp.setFakeBoldText(true);
        pc.drawText(TextUtils.ellipsize(name,tp,428,TextUtils.TruncateAt.END).toString(),26,64,tp);
        Bitmap text=Bitmap.createBitmap(480,200,Bitmap.Config.ARGB_8888);Canvas tc=new Canvas(text);TextPaint pr=new TextPaint(Paint.ANTI_ALIAS_FLAG);pr.setColor(Color.WHITE);pr.setFakeBoldText(true);pr.setTextSize(78);pr.setShadowLayer(8,0,3,0x88000000);
        tc.drawText(TextUtils.ellipsize(label,pr,428,TextUtils.TruncateAt.END).toString(),26,160,pr);
        shadowTex=upload(shadow);plateTex=upload(plate);textTex=upload(text);
    }
    private static int upload(Bitmap bmp){
        int[] id={0};GLES20.glGenTextures(1,id,0);GLES20.glBindTexture(GLES20.GL_TEXTURE_2D,id[0]);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D,GLES20.GL_TEXTURE_MIN_FILTER,GLES20.GL_LINEAR);GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D,GLES20.GL_TEXTURE_MAG_FILTER,GLES20.GL_LINEAR);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D,GLES20.GL_TEXTURE_WRAP_S,GLES20.GL_CLAMP_TO_EDGE);GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D,GLES20.GL_TEXTURE_WRAP_T,GLES20.GL_CLAMP_TO_EDGE);
        GLUtils.texImage2D(GLES20.GL_TEXTURE_2D,0,bmp,0);bmp.recycle();return id[0];
    }
    void render(float[] vp,float[] origin,float[] r,float[] u,float offset){
        float[] n={r[1]*u[2]-r[2]*u[1],r[2]*u[0]-r[0]*u[2],r[0]*u[1]-r[1]*u[0]};
        float bob=.004f*(float)Math.sin(System.nanoTime()/4.5e8);
        GLES20.glUseProgram(program);GLES20.glActiveTexture(GLES20.GL_TEXTURE0);
        GLES20.glUniformMatrix4fv(mat,1,false,vp,0);GLES20.glUniform3fv(right,1,r,0);GLES20.glUniform3fv(up,1,u,0);
        GLES20.glEnable(GLES20.GL_BLEND);GLES20.glBlendFunc(GLES20.GL_ONE,GLES20.GL_ONE_MINUS_SRC_ALPHA);
        quad.position(0);GLES20.glEnableVertexAttribArray(coord);GLES20.glVertexAttribPointer(coord,2,GLES20.GL_FLOAT,false,0,quad);
        layer(shadowTex,origin,r,u,n,offset,bob-.012f,-.014f);   // behind and below
        layer(plateTex,origin,r,u,n,offset,bob,0f);
        layer(textTex,origin,r,u,n,offset,bob,.016f);             // floats 1.6 cm in front of the plate
        GLES20.glDisableVertexAttribArray(coord);GLES20.glDisable(GLES20.GL_BLEND);
    }
    private void layer(int tex,float[] o,float[] r,float[] u,float[] n,float dx,float dy,float dz){
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D,tex);
        GLES20.glUniform3f(center,o[0]+dx*r[0]+dy*u[0]+dz*n[0],o[1]+dx*r[1]+dy*u[1]+dz*n[1],o[2]+dx*r[2]+dy*u[2]+dz*n[2]);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP,0,4);
    }
}
