package org.nomadamas.howmuch;
import java.util.Arrays;
public class MaskedTargetTest {
    static final int W=80,H=100;static float[][] p=new float[25][5];
    static void paint(int[] rgb,int cx,int cy){for(float[] pt:p){int x=(int)(cx+pt[0]*20),y=(int)(cy+pt[1]*20),color=((int)pt[2]<<16)|((int)pt[3]<<8)|(int)pt[4];
        for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++)rgb[(y+j)*W+x+i]=color;}}
    public static void main(String[] args){int k=0;for(int j=0;j<5;j++)for(int i=0;i<5;i++,k++)p[k]=new float[]{(i-2)*.18f,(j-2)*.18f,(k*83+45)%221,(k*127+74)%231,(k*57+107)%243};
        MaskedTarget t=new MaskedTarget(1,.2f,p);int[] frame=new int[W*H];Arrays.fill(frame,0x131313);paint(frame,20,40);
        MaskedTarget.Match m=t.match(frame,W,H,null);if(m==null||Math.abs(m.x-.25f)>.04f)throw new AssertionError("first");
        Arrays.fill(frame,0x131313);if(t.match(frame,W,H,m)!=null)throw new AssertionError("lost");paint(frame,54,62);
        m=t.match(frame,W,H,null);if(m==null||Math.abs(m.x-54f/W)>.04f)throw new AssertionError("re-acquire");
        paint(frame,20,40);if(t.match(frame,W,H,null)!=null)throw new AssertionError("duplicate");
        try{new MaskedTarget(1,.2f,new float[12][5]);throw new AssertionError("flat");}catch(IllegalArgumentException ok){}
        float[] xy={-.3f,-.2f,.12f,.3f},y={-.3f,.3f,-.2f,.2f},z={1,1.01f,1,1.02f};
        if(!Float.isFinite(DepthCohort.resolve(z,xy,y,4,4))||Float.isFinite(DepthCohort.resolve(z,xy,y,1,4))||Float.isFinite(DepthCohort.resolve(z,xy,new float[4],4,4)))throw new AssertionError("cohort spread");
        z[1]=2;z[2]=2;if(Float.isFinite(DepthCohort.resolve(z,xy,y,4,4)))throw new AssertionError("mixed depth");
        System.out.println("PASS: masked match, move, loss, duplicate, low texture");}
}