package org.nomadamas.howmuch;

import android.media.Image;
import android.util.Base64;
import com.google.ar.core.*;
import com.google.ar.core.exceptions.NotYetAvailableException;
import org.json.*;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

final class TargetFrame {
    static MaskedTarget decode(String sig) {
        if(sig==null||sig.length()>5462||!sig.matches("[A-Za-z0-9_-]+"))return null;
        try{byte[] bytes=Base64.decode(sig,Base64.URL_SAFE|Base64.NO_PADDING|Base64.NO_WRAP);if(bytes.length>4096)return null;
            JSONObject obj=new JSONObject(new String(bytes,StandardCharsets.UTF_8));if(obj.getInt("v")!=1)return null;
            JSONArray ps=obj.getJSONArray("pts");if(ps.length()<8||ps.length()>121)return null;
            float[][] pts=new float[ps.length()][5];for(int i=0;i<pts.length;i++){JSONArray p=ps.getJSONArray(i);if(p.length()!=5)return null;for(int j=0;j<5;j++)pts[i][j]=(float)p.getDouble(j);}
            return new MaskedTarget((float)obj.getDouble("aspect"),(float)obj.getDouble("height"),pts);
        }catch(IllegalArgumentException|JSONException e){return null;}
    }
    private static int channel(int x){return Math.max(0,Math.min(255,x));}
    static MaskedTarget.Match match(Frame frame,MaskedTarget target,int width,int height,MaskedTarget.Match prior)throws NotYetAvailableException{
        int w=width>=height?100:Math.max(20,100*width/height),h=height>=width?100:Math.max(20,100*height/width);
        int[] rgb=new int[w*h];float[] corners=new float[6];frame.transformCoordinates2d(Coordinates2d.VIEW_NORMALIZED,new float[]{0,0,1,0,0,1},Coordinates2d.IMAGE_PIXELS,corners);
        try(Image img=frame.acquireCameraImage()){
            Image.Plane[] planes=img.getPlanes();ByteBuffer yb=planes[0].getBuffer(),ub=planes[1].getBuffer(),vb=planes[2].getBuffer();
            int ys=planes[0].getRowStride(),us=planes[1].getRowStride(),vs=planes[2].getRowStride(),yp=planes[0].getPixelStride(),up=planes[1].getPixelStride(),vp=planes[2].getPixelStride();
            for(int j=0;j<h;j++)for(int i=0;i<w;i++){float a=(i+.5f)/w,b=(j+.5f)/h;
                int x=Math.max(0,Math.min(img.getWidth()-1,(int)(corners[0]+(corners[2]-corners[0])*a+(corners[4]-corners[0])*b)));
                int y=Math.max(0,Math.min(img.getHeight()-1,(int)(corners[1]+(corners[3]-corners[1])*a+(corners[5]-corners[1])*b)));
                int l=Math.max(0,(yb.get(y*ys+x*yp)&255)-16),u=(ub.get((y/2)*us+(x/2)*up)&255)-128,v=(vb.get((y/2)*vs+(x/2)*vp)&255)-128;
                rgb[j*w+i]=(channel((298*l+409*v+128)>>8)<<16)|(channel((298*l-100*u-208*v+128)>>8)<<8)|channel((298*l+516*u+128)>>8);
            }
        }return target.match(rgb,w,h,prior);
    }
    static Pose support(Frame f,Camera camera,MaskedTarget t,MaskedTarget.Match m,int width,int height,boolean depthEnabled){
        if(depthEnabled)try(Image depth=f.acquireDepthImage16Bits()){
            float[] view=new float[2*t.pts.length],image=new float[view.length];int i=0;
            for(float[] p:t.pts){view[i++]=m.x+p[0]*m.w;view[i++]=m.y+p[1]*m.h;}
            f.transformCoordinates2d(Coordinates2d.VIEW_NORMALIZED,view,Coordinates2d.IMAGE_NORMALIZED,image);
            Image.Plane plane=depth.getPlanes()[0];ByteBuffer buf=plane.getBuffer().order(ByteOrder.LITTLE_ENDIAN);float[] zs=new float[t.pts.length],xs=zs.clone(),ys=zs.clone();int n=0;java.util.HashSet<Integer> distinct=new java.util.HashSet<>();
            for(i=0;i<image.length;i+=2){int x=(int)(image[i]*depth.getWidth()),y=(int)(image[i+1]*depth.getHeight());if(x<0||x>=depth.getWidth()||y<0||y>=depth.getHeight())continue;
                float z=(buf.getShort(y*plane.getRowStride()+x*plane.getPixelStride())&0xffff)*.001f;if(z>=.12f&&z<=6&&distinct.add(y*depth.getWidth()+x)){zs[n]=z;xs[n]=t.pts[i/2][0];ys[n++]=t.pts[i/2][1];}}
            {float z=DepthCohort.resolve(zs,xs,ys,n,(int)Math.ceil(Math.max(5,t.pts.length*.45)));
                if(Float.isFinite(z)){float[] P=new float[16];camera.getProjectionMatrix(P,0,.1f,100f);
                    float x=(2*m.x-1+P[8])*z/P[0],y=(1-2*m.y+P[9])*z/P[5];float[] pos=camera.getDisplayOrientedPose().transformPoint(new float[]{x,y,-z});return Pose.makeTranslation(pos);}}
        }catch(NotYetAvailableException ignored){}
        // Do not substitute one background point, a plane, or repeated hits on
        // the same feature for a supported 3D target.
        float[] V=new float[16],P=new float[16],vp=new float[16],clip=new float[4];
        camera.getViewMatrix(V,0);camera.getProjectionMatrix(P,0,.1f,100f);android.opengl.Matrix.multiplyMM(vp,0,P,0,V,0);
        java.util.HashSet<Trackable> used=new java.util.HashSet<>();int k=Math.min(12,t.pts.length),n=0;float[] zs=new float[k],xs=zs.clone(),ys=zs.clone();
        for(int i=0;i<k;i++){float[] p=t.pts[i*(t.pts.length-1)/(k-1)];float targetX=m.x+p[0]*m.w,targetY=m.y+p[1]*m.h;
            for(HitResult hit:f.hitTest(targetX*width,targetY*height)){Trackable tr=hit.getTrackable();
                if(!(tr instanceof Point)||tr.getTrackingState()!=TrackingState.TRACKING||used.contains(tr))continue;
                float[] a=hit.getHitPose().getTranslation();android.opengl.Matrix.multiplyMV(clip,0,vp,0,new float[]{a[0],a[1],a[2],1},0);
                if(clip[3]<.12||clip[3]>6)continue;float x=(clip[0]/clip[3]+1)*.5f,y=(1-clip[1]/clip[3])*.5f;
                if(Math.abs(x-targetX)>m.w*.09||Math.abs(y-targetY)>m.h*.09)continue;
                used.add(tr);xs[n]=(x-m.x)/m.w;ys[n]=(y-m.y)/m.h;zs[n++]=clip[3];break;}}
        float z=DepthCohort.resolve(zs,xs,ys,n,4);if(!Float.isFinite(z))return null;
        float[] center=camera.getDisplayOrientedPose().transformPoint(new float[]{(2*m.x-1+P[8])*z/P[0],(1-2*m.y+P[9])*z/P[5],-z});
        return Pose.makeTranslation(center);
    }
}
