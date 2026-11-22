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
    private final String name,label; private int program,texture,coord,mat,center,right,up;
    private final FloatBuffer quad=ByteBuffer.allocateDirect(32).order(ByteOrder.nativeOrder()).asFloatBuffer();
    WorldCard(String n,String l){name=n;label=l;quad.put(new float[]{0,0,1,0,0,1,1,1}).position(0);}
    private static int shader(int type,String src){int id=GLES20.glCreateShader(type);GLES20.glShaderSource(id,src);GLES20.glCompileShader(id);int[] ok={0};GLES20.glGetShaderiv(id,GLES20.GL_COMPILE_STATUS,ok,0);if(ok[0]!=1)throw new IllegalStateException(GLES20.glGetShaderInfoLog(id));return id;}
    void create(){
        String vs="attribute vec2 q;uniform mat4 vp;uniform vec3 origin,rightVec,upVec;varying vec2 uv;void main(){uv=vec2(q.x,1.-q.y);gl_Position=vp*vec4(origin+rightVec*(q.x*.18)+upVec*((q.y-.5)*.075),1.);}";
        String fs="precision mediump float;varying vec2 uv;uniform sampler2D tex;void main(){gl_FragColor=texture2D(tex,uv);}";
        program=GLES20.glCreateProgram();GLES20.glAttachShader(program,shader(GLES20.GL_VERTEX_SHADER,vs));GLES20.glAttachShader(program,shader(GLES20.GL_FRAGMENT_SHADER,fs));GLES20.glLinkProgram(program);
        int[] ok={0};GLES20.glGetProgramiv(program,GLES20.GL_LINK_STATUS,ok,0);if(ok[0]!=1)throw new IllegalStateException(GLES20.glGetProgramInfoLog(program));
        coord=GLES20.glGetAttribLocation(program,"q");mat=GLES20.glGetUniformLocation(program,"vp");center=GLES20.glGetUniformLocation(program,"origin");right=GLES20.glGetUniformLocation(program,"rightVec");up=GLES20.glGetUniformLocation(program,"upVec");
        Bitmap bmp=Bitmap.createBitmap(480,200,Bitmap.Config.ARGB_8888);Canvas cv=new Canvas(bmp);TextPaint p=new TextPaint(Paint.ANTI_ALIAS_FLAG);p.setColor(0xd0192d32);cv.drawRoundRect(1,1,479,199,32,32,p);
        p.setColor(0xffdfff89);p.setTextSize(20);cv.drawText("HOWMUCH   /   FIELD LENS",26,39,p);p.setColor(Color.WHITE);p.setTextSize(36);cv.drawText(TextUtils.ellipsize(name,p,428,TextUtils.TruncateAt.END).toString(),26,98,p);p.setTextSize(42);cv.drawText(TextUtils.ellipsize(label,p,428,TextUtils.TruncateAt.END).toString(),26,161,p);
        int[] id={0};GLES20.glGenTextures(1,id,0);texture=id[0];GLES20.glBindTexture(GLES20.GL_TEXTURE_2D,texture);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D,GLES20.GL_TEXTURE_MIN_FILTER,GLES20.GL_LINEAR);GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D,GLES20.GL_TEXTURE_MAG_FILTER,GLES20.GL_LINEAR);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D,GLES20.GL_TEXTURE_WRAP_S,GLES20.GL_CLAMP_TO_EDGE);GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D,GLES20.GL_TEXTURE_WRAP_T,GLES20.GL_CLAMP_TO_EDGE);GLUtils.texImage2D(GLES20.GL_TEXTURE_2D,0,bmp,0);bmp.recycle();
    }
    void render(float[] vp,float[] origin,float[] r,float[] u,float offset){
        GLES20.glUseProgram(program);GLES20.glActiveTexture(GLES20.GL_TEXTURE0);GLES20.glBindTexture(GLES20.GL_TEXTURE_2D,texture);
        GLES20.glUniformMatrix4fv(mat,1,false,vp,0);GLES20.glUniform3f(center,origin[0]+offset*r[0],origin[1]+offset*r[1],origin[2]+offset*r[2]);GLES20.glUniform3fv(right,1,r,0);GLES20.glUniform3fv(up,1,u,0);
        GLES20.glEnable(GLES20.GL_BLEND);GLES20.glBlendFunc(GLES20.GL_ONE,GLES20.GL_ONE_MINUS_SRC_ALPHA);
        quad.position(0);GLES20.glEnableVertexAttribArray(coord);GLES20.glVertexAttribPointer(coord,2,GLES20.GL_FLOAT,false,0,quad);GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP,0,4);GLES20.glDisableVertexAttribArray(coord);GLES20.glDisable(GLES20.GL_BLEND);
    }
}