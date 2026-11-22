package org.nomadamas.howmuch;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.opengl.GLES11Ext;
import android.opengl.GLES20;
import android.opengl.GLSurfaceView;
import android.opengl.Matrix;
import android.os.Bundle;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.TextView;
import com.google.ar.core.*;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.util.concurrent.atomic.AtomicReference;
import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

// The overlay position is projected every frame from an ARCore world anchor.
// There is deliberately no fixed-on-screen fallback when spatial tracking is lost.
public final class PlaceActivity extends Activity implements GLSurfaceView.Renderer {
    private GLSurfaceView surface;
    private TextView card, hint;
    private Session session;
    private Anchor anchor;
    private boolean installAsked, resumed;
    private final AtomicReference<float[]> tap = new AtomicReference<>();
    private final FloatBuffer screen = buffer(-1,-1,1,-1,-1,1,1,1);
    private final FloatBuffer uv = buffer(0,0,1,0,0,1,1,1);
    private final float[] view=new float[16], projection=new float[16], vp=new float[16], clip=new float[4], world={0,0,0,1};
    private int program, texture, posAttr, uvAttr, width=1,height=1;
    private volatile int layoutRotation;
    private String currentHint="";
    private static FloatBuffer buffer(float... values){FloatBuffer f=ByteBuffer.allocateDirect(values.length*4).order(ByteOrder.nativeOrder()).asFloatBuffer();f.put(values);f.position(0);return f;}
    private static String field(Uri uri,String key){
        String s=uri.getQueryParameter(key);
        if(s==null||s.trim().isEmpty()||s.codePointCount(0,s.length())>120)return null;for(int i=0;i<s.length();){int c=s.codePointAt(i);if(Character.isISOControl(c)||Character.getType(c)==Character.FORMAT)return null;i+=Character.charCount(c);}return s.trim();
    }
    @Override public void onCreate(Bundle saved){super.onCreate(saved);
        Uri uri=getIntent().getData();
        String name=null,label=null;
        if(uri!=null && uri.isHierarchical() && "howmuch-ar".equals(uri.getScheme()) && "place".equals(uri.getHost()) && uri.getUserInfo()==null && uri.getPort()==-1 && uri.getEncodedFragment()==null && (uri.getPath()==null||uri.getPath().isEmpty()) && uri.toString().length()<=4096){name=field(uri,"name");label=field(uri,"label");}
        if(name==null||label==null){TextView msg=new TextView(this);msg.setText("웹에서 상품의 공간 배치 버튼으로 열어 주세요.");setContentView(msg);return;}
        FrameLayout root=new FrameLayout(this);surface=new GLSurfaceView(this);surface.setEGLContextClientVersion(2);surface.setPreserveEGLContextOnPause(true);surface.setRenderer(this);root.addView(surface);
        card=badge(name+"\n"+label);card.setVisibility(View.INVISIBLE);root.addView(card,new FrameLayout.LayoutParams(-2,-2));
        hint=badge("카메라 연결 중");FrameLayout.LayoutParams hp=new FrameLayout.LayoutParams(-2,-2,Gravity.BOTTOM|Gravity.CENTER_HORIZONTAL);hp.bottomMargin=dp(46);root.addView(hint,hp);setContentView(root);
        surface.setOnTouchListener((v,event)->{if(event.getAction()==MotionEvent.ACTION_UP)tap.set(new float[]{event.getX(),event.getY()});return true;});
    }
    private int dp(int n){return Math.round(getResources().getDisplayMetrics().density*n);}
    private TextView badge(String s){TextView t=new TextView(this);t.setText(s);t.setTextSize(16);t.setTextColor(Color.WHITE);t.setMaxWidth(dp(235));t.setPadding(dp(14),dp(9),dp(14),dp(9));GradientDrawable bg=new GradientDrawable();bg.setCornerRadius(dp(14));bg.setColor(0xc2253838);bg.setStroke(dp(1),0x88dfff89);t.setBackground(bg);return t;}
    @Override public void onResume(){super.onResume();resumed=true;if(surface!=null)start();}
    private void start(){try{
        if(checkSelfPermission(Manifest.permission.CAMERA)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.CAMERA},72);return;}
        if(session==null){if(ArCoreApk.getInstance().requestInstall(this,!installAsked)==ArCoreApk.InstallStatus.INSTALL_REQUESTED){installAsked=true;return;}
            session=new Session(this);Config cfg=new Config(session);cfg.setPlaneFindingMode(Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL);session.configure(cfg);}
        session.resume();surface.onResume();
    }catch(Exception e){hint.setText("공간 추적을 시작할 수 없습니다: "+e.getClass().getSimpleName());}}
    @Override public void onRequestPermissionsResult(int n,String[] p,int[] r){super.onRequestPermissionsResult(n,p,r);if(n==72 && resumed){if(r.length>0&&r[0]==PackageManager.PERMISSION_GRANTED)start();else hint.setText("설정에서 카메라 권한을 허용한 뒤 다시 여세요.");}}
    @Override public void onPause(){resumed=false;if(surface!=null){surface.onPause();if(session!=null)session.pause();card.setVisibility(View.INVISIBLE);}super.onPause();}
    @Override public void onDestroy(){if(anchor!=null)anchor.detach();if(session!=null)session.close();super.onDestroy();}
    private static int shader(int kind,String code){int shader=GLES20.glCreateShader(kind);GLES20.glShaderSource(shader,code);GLES20.glCompileShader(shader);return shader;}
    @Override public void onSurfaceCreated(GL10 gl,EGLConfig ignored){int[] id=new int[1];GLES20.glGenTextures(1,id,0);texture=id[0];int target=GLES11Ext.GL_TEXTURE_EXTERNAL_OES;GLES20.glBindTexture(target,texture);GLES20.glTexParameteri(target,GLES20.GL_TEXTURE_MIN_FILTER,GLES20.GL_LINEAR);GLES20.glTexParameteri(target,GLES20.GL_TEXTURE_MAG_FILTER,GLES20.GL_LINEAR);GLES20.glTexParameteri(target,GLES20.GL_TEXTURE_WRAP_S,GLES20.GL_CLAMP_TO_EDGE);GLES20.glTexParameteri(target,GLES20.GL_TEXTURE_WRAP_T,GLES20.GL_CLAMP_TO_EDGE);
        program=GLES20.glCreateProgram();GLES20.glAttachShader(program,shader(GLES20.GL_VERTEX_SHADER,"attribute vec2 p;attribute vec2 u;varying vec2 v;void main(){gl_Position=vec4(p,0.,1.);v=u;}"));GLES20.glAttachShader(program,shader(GLES20.GL_FRAGMENT_SHADER,"#extension GL_OES_EGL_image_external : require\nprecision mediump float;uniform samplerExternalOES tex;varying vec2 v;void main(){gl_FragColor=texture2D(tex,v);}"));GLES20.glLinkProgram(program);posAttr=GLES20.glGetAttribLocation(program,"p");uvAttr=GLES20.glGetAttribLocation(program,"u");}
    @Override public void onSurfaceChanged(GL10 gl,int w,int h){width=w;height=h;GLES20.glViewport(0,0,w,h);}
    private void background(Frame f){screen.position(0);uv.position(0);f.transformCoordinates2d(Coordinates2d.OPENGL_NORMALIZED_DEVICE_COORDINATES,screen,Coordinates2d.TEXTURE_NORMALIZED,uv);screen.position(0);uv.position(0);GLES20.glUseProgram(program);GLES20.glActiveTexture(GLES20.GL_TEXTURE0);GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES,texture);GLES20.glVertexAttribPointer(posAttr,2,GLES20.GL_FLOAT,false,0,screen);GLES20.glVertexAttribPointer(uvAttr,2,GLES20.GL_FLOAT,false,0,uv);GLES20.glEnableVertexAttribArray(posAttr);GLES20.glEnableVertexAttribArray(uvAttr);GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP,0,4);}
    private void status(String msg){if(!msg.equals(currentHint)){currentHint=msg;runOnUiThread(()->hint.setText(msg));}}
    private void hide(){runOnUiThread(()->card.setVisibility(View.INVISIBLE));}
    @Override public void onDrawFrame(GL10 gl){GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT);if(session==null)return;
        try{session.setDisplayGeometry(getWindowManager().getDefaultDisplay().getRotation(),width,height);session.setCameraTextureName(texture);Frame f=session.update();if(f.getTimestamp()==0)return;background(f);Camera camera=f.getCamera();
            if(camera.getTrackingState()!=TrackingState.TRACKING){tap.set(null);hide();status("카메라를 천천히 움직여 표면을 찾으세요.");return;}
            float[] target=tap.getAndSet(null);if(target!=null)for(HitResult hit:f.hitTest(target[0],target[1])){Trackable track=hit.getTrackable();if(track instanceof Plane && track.getTrackingState()==TrackingState.TRACKING && ((Plane)track).isPoseInPolygon(hit.getHitPose())){Anchor next=hit.createAnchor();if(anchor!=null)anchor.detach();anchor=next;break;}}
            if(anchor==null||anchor.getTrackingState()!=TrackingState.TRACKING){hide();status("물체 옆 바닥이나 테이블을 탭하세요.");return;}
            Pose p=anchor.getPose();world[0]=p.tx();world[1]=p.ty()+.055f;world[2]=p.tz();camera.getViewMatrix(view,0);camera.getProjectionMatrix(projection,0,.1f,100f);Matrix.multiplyMM(vp,0,projection,0,view,0);Matrix.multiplyMV(clip,0,vp,0,world,0);
            if(clip[3]<=0||Math.abs(clip[0])>=clip[3]||Math.abs(clip[1])>=clip[3]||Math.abs(clip[2])>=clip[3]){hide();status("고정한 표면을 다시 비추세요.");return;}
            float x=(clip[0]/clip[3]+1)*width/2,y=(1-clip[1]/clip[3])*height/2;status("공간에 고정됨 · 다시 탭해 이동");runOnUiThread(()->{if(!resumed)return;card.setX(Math.max(0,Math.min(surface.getWidth()-card.getWidth(),x+dp(6))));card.setY(Math.max(0,Math.min(surface.getHeight()-card.getHeight(),y-card.getHeight())));card.setVisibility(View.VISIBLE);});
        }catch(Exception e){hide();status("카메라 추적 중단: "+e.getClass().getSimpleName());}}
}
