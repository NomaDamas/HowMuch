"""Real two-frame SAM memory smoke; no external photos, network or shared session."""
from pathlib import Path
import base64, io, json, subprocess, sys, time
import cv2
import numpy as np
from PIL import Image, ImageDraw

def scene(x=None):
    im = Image.new("RGB",(400,260),"#deded1")
    m = Image.new("L",im.size)
    if x is not None:
        d,md=ImageDraw.Draw(im),ImageDraw.Draw(m)
        for draw,c in [(d,"#294883"),(md,255)]:
            draw.rounded_rectangle((x,84,x+86,166),18,fill=c)
            draw.arc((x+62,91,x+109,148),260,102,fill=c,width=9)
        d.line((x+9,116,x+67,118),fill="#e7ac6d",width=6)
    b=io.BytesIO();im.save(b,"PNG")
    return "data:image/png;base64,"+base64.b64encode(b.getvalue()).decode(),np.array(m)>0

def main():
    im,seed=scene(70);moved,truth=scene(126);lost,_=scene()
    contours,_=cv2.findContours(seed.astype("uint8"),cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
    rings=[[{"x":float(x)/400,"y":float(y)/260} for x,y in c[:,0,:]] for c in sorted(contours,key=cv2.contourArea,reverse=True)]
    prop={"previousImageDataUrl":im,"selection":{"polygon":rings[0],"contours":rings}}
    with subprocess.Popen([sys.executable,'server/sam_worker.py'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True) as proc:
        try:
            for label,image,visible in [("translated",moved,True),("absent",lost,False),("independent repeat",moved,True)]:
                start=time.perf_counter();proc.stdin.write(json.dumps({"image":image,"propagation":prop})+"\n");proc.stdin.flush()
                r=json.loads(proc.stdout.readline());assert r.get("mode")=="video_propagation",r.keys()
                sels=r["selections"];assert bool(sels)==visible,(label,len(sels))
                if visible:
                    s=sels[0]; yy,xx=round(s["y"]*260),round(s["x"]*400)
                    rgba=Image.open(io.BytesIO(base64.b64decode(s["cutoutDataUrl"].split(",")[1])))
                    alpha=np.array(rgba.getchannel("A"))>0;out=np.zeros_like(seed);out[yy:yy+alpha.shape[0],xx:xx+alpha.shape[1]]=alpha
                    iou=(out&truth).sum()/(out|truth).sum()
                    assert iou>.65,(label,iou)
                print(label,"IoU",round(iou,3) if visible else "empty","seconds",round(time.perf_counter()-start,2),flush=True)
        finally:
            proc.stdin.close()
if __name__=="__main__": main()
