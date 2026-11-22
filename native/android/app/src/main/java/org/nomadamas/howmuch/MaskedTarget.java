package org.nomadamas.howmuch;

/** Local appearance test only. Reject weak, ambiguous or missing evidence. No identity inference. */
final class MaskedTarget {
    final float aspect, height;
    final float[][] pts;
    MaskedTarget(float aspect, float height, float[][] pts) {
        if (!(aspect >= .05f && aspect <= 20 && height > 0 && height <= 1 && pts.length >= 8 && pts.length <= 121)) throw new IllegalArgumentException();
        float[] mean=new float[3]; double xx=0,xy=0,yy=0,mx=0,my=0;
        for(float[] p:pts){if(p.length!=5||!(Math.abs(p[0])<=.5f&&Math.abs(p[1])<=.5f))throw new IllegalArgumentException();
            mx+=p[0];my+=p[1];for(int c=0;c<3;c++){if(!(p[c+2]>=0&&p[c+2]<=255&&p[c+2]==Math.floor(p[c+2])))throw new IllegalArgumentException();mean[c]+=p[c+2]/pts.length;}}
        mx/=pts.length;my/=pts.length;float tex=0;
        for(float[] p:pts){double x=p[0]-mx,y=p[1]-my;xx+=x*x;xy+=x*y;yy+=y*y;for(int c=0;c<3;c++)tex+=Math.abs(p[c+2]-mean[c])/(3*pts.length);}
        if(tex<11||xx*yy-xy*xy<.001)throw new IllegalArgumentException();
        this.aspect=aspect;this.height=height;this.pts=pts;
    }
    static final class Match {float x,y,w,h,error; Match(float x,float y,float w,float h,float e){this.x=x;this.y=y;this.w=w;this.h=h;error=e;}}
    Match match(int[] rgb,int W,int H,Match prior){
        Match best=null; float[] scales={.4f,.56f,.72f,.87f,1f,1.2f,1.45f,1.75f,2.1f}; java.util.ArrayList<Match> hits=new java.util.ArrayList<>();
        for(float scale:scales){float h=height*scale,w=h*aspect*H/W;if(h>1||w>1||h*H<5||w*W<5)continue;
            float sx=Math.max(1f/W,w/10),sy=Math.max(1f/H,h/10);
            for(float y=h/2;y<=1-h/2+.00001f;y+=sy)for(float x=w/2;x<=1-w/2+.00001f;x+=sx){
                float error=score(rgb,W,H,x,y,w,h);if(error>26)continue;
                Match p=new Match(x,y,w,h,error);hits.add(p);if(best==null||error<best.error)best=p;
                if(hits.size()>2000)return null;
            }}
        if(best==null)return null;
        for(Match p:hits)if((Math.abs(p.x-best.x)>.48f*best.w||Math.abs(p.y-best.y)>.48f*best.h)&&p.error<best.error+4)return null;
        return best;
    }
    private float score(int[] pixels,int W,int H,float x,float y,float w,float h){
        float total=0;for(float[] p:pts){int u=Math.min(W-1,Math.max(0,(int)((x+p[0]*w)*W))),v=Math.min(H-1,Math.max(0,(int)((y+p[1]*h)*H)));int n=pixels[v*W+u];
            total+=Math.abs(((n>>>16)&255)-p[2])+Math.abs(((n>>>8)&255)-p[3])+Math.abs((n&255)-p[4]);if(total>78*pts.length)return 99;}
        return total/(3*pts.length);
    }
}
