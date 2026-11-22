"""Hidden pretrained NanoDet-Plus proposals for SAM; labels never leave this module."""
from pathlib import Path
import hashlib
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SHA = '4b82da9944b88577175ee23a459dce2e26e6e4be573def65b1055dc2d9720186'


class NanoDet:
    def __init__(self, path=None):
        path = Path(path or ROOT / '.howmuch/sam/nanodet.onnx')
        if path.stat().st_size != 3800954 or hashlib.sha256(path.read_bytes()).hexdigest() != SHA:
            raise ValueError('NanoDet checkpoint mismatch')
        self.net = cv2.dnn.readNetFromONNX(str(path))

    def boxes(self, rgb):
        """xyxy in source pixels, only for SAM prompts, never UI or identity."""
        h, w = rgb.shape[:2]
        scale = min(416/w, 416/h)
        rw, rh = max(1, round(w*scale)), max(1, round(h*scale))
        dx, dy = (416-rw)//2, (416-rh)//2
        canvas = np.zeros((416,416,3), dtype=np.float32)
        canvas[dy:dy+rh,dx:dx+rw] = cv2.resize(rgb,(rw,rh))
        canvas -= np.float32([103.53,116.28,123.675])
        canvas /= np.float32([57.375,57.12,58.395])
        self.net.setInput(cv2.dnn.blobFromImage(canvas))
        outputs = self.net.forward(self.net.getUnconnectedOutLayersNames())
        boxes, scores = [], []
        for stride, cls, pred in zip((8,16,32),outputs[::2],outputs[1::2]):
            conf = cls[0].max(axis=1)
            keep = np.flatnonzero(conf >= .35)
            if keep.size == 0:
                continue
            dist = pred[0,keep].reshape(-1,4,8)
            prob = np.exp(dist-dist.max(axis=2, keepdims=True))
            reg = (prob @ np.arange(8) / prob.sum(axis=2)) * stride
            x = (keep % (416//stride))*stride + (stride-1)*.5
            y = (keep // (416//stride))*stride + (stride-1)*.5
            for j,(left,top,right,bottom) in enumerate(reg):
                x1,y1=np.clip([(x[j]-left-dx)*w/rw,(y[j]-top-dy)*h/rh],[0,0],[w,h])
                x2,y2=np.clip([(x[j]+right-dx)*w/rw,(y[j]+bottom-dy)*h/rh],[0,0],[w,h])
                if x2>x1+2 and y2>y1+2:
                    boxes.append([x1,y1,x2-x1,y2-y1]);scores.append(float(conf[keep[j]]))
        if not boxes:
            return []
        inds=cv2.dnn.NMSBoxes(boxes,scores,.35,.55)
        return [np.float32([x,y,x+bw,y+bh]) for i in np.asarray(inds).flatten()[:4]
                for x,y,bw,bh in [boxes[i]]]
