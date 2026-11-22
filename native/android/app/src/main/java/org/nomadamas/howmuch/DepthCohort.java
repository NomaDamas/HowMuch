package org.nomadamas.howmuch;
import java.util.Arrays;
/** Independent samples must span the mask in two axes and agree on axial depth. */
final class DepthCohort {
    static float resolve(float[] z,float[] x,float[] y,int n,int minimum){
        if(n<minimum)return Float.NaN;float[] sorted=Arrays.copyOf(z,n);Arrays.sort(sorted);
        float median=sorted[n/2],minX=1,maxX=-1,minY=1,maxY=-1;int count=0;
        for(int i=0;i<n;i++)if(Math.abs(z[i]-median)<=Math.max(.035f,.06f*median)){
            minX=Math.min(minX,x[i]);maxX=Math.max(maxX,x[i]);minY=Math.min(minY,y[i]);maxY=Math.max(maxY,y[i]);count++;}
        return count>=Math.max(minimum,Math.ceil(n*.75))&&maxX-minX>=.22&&maxY-minY>=.22?median:Float.NaN;
    }
}
