"""Replay public RGBA catalog objects on controlled scenes; measure SAM mask IoU and misses."""
import argparse, base64, io, itertools, json, sys, time
from pathlib import Path
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'server'))
import sam_worker as sam
from detector import NanoDet

CATALOG={'apple':'groceries/apple','earbuds':'mobile-accessories/apple-airpods','shirt':'mens-shirts/blue-&-black-check-shirt'}
SCENES={
    'shelf_pair':[('earbuds',20,45,250),('apple',355,45,240)],
    'drawer_small':[('earbuds',20,50,145),('shirt',200,80,205),('apple',487,170,100)],
    'crowded_four':[('apple',8,20,150),('shirt',145,90,220),('earbuds',336,55,188),('apple',522,224,82)],
}

def scene(layout,directory):
    im=Image.new('RGB',(640,360),'#e6e4de'); labels=[]
    for item,x,y,size in layout:
        pic=Image.open(directory/(item+'.webp')).convert('RGBA'); pic.thumbnail((size,size))
        alpha=pic.getchannel('A'); im.paste(pic,(x,y),alpha)
        mask=Image.new('L',im.size);mask.paste(alpha,(x,y));mask=np.asarray(mask)>127
        for old in labels: old &= ~mask
        labels.append(mask.copy())
    b=io.BytesIO(); im.save(b,'PNG')
    return {'image':'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()},labels

def match(selections,labels):
    H,W=labels[0].shape; masks=[]
    for s in selections:
        crop=Image.open(io.BytesIO(base64.b64decode(s['cutoutDataUrl'].split(',')[1])))
        alpha=np.asarray(crop.getchannel('A'))>127
        x,y=round(s['x']*W),round(s['y']*H)
        m=np.zeros((H,W),bool);m[y:y+alpha.shape[0],x:x+alpha.shape[1]]=alpha;masks.append(m)
    matrix=[[float((m&g).sum()/max(1,(m|g).sum())) for g in labels] for m in masks]
    k=min(len(masks),len(labels)); scores=[]
    for ids in itertools.permutations(range(len(labels)),k):
        for pred in itertools.permutations(range(len(masks)),k):
            vals=[matrix[p][g] for p,g in zip(pred,ids)]
            scores.append((sum(v>=.5 for v in vals),sum(vals)))
    hits,total=max(scores,default=(0,0))
    return {'hits':hits,'misses':len(labels)-hits,'unmatched_masks':len(masks)-hits,'mean_iou':round(total/len(labels),3)}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--fixtures',type=Path,default=ROOT/'.howmuch/checks');ap.add_argument('--repeats',type=int,default=2)
    opts=ap.parse_args(); detector=NanoDet(); model=sam.load_model(); rows=[]
    with sam.torch.inference_mode():
        for name,layout in SCENES.items():
            req,truth=scene(layout,opts.fixtures)
            for repeat in range(opts.repeats):
                for method in (['grid','rescue'] if repeat%2==0 else ['rescue','grid']):
                    t=time.perf_counter();s=sam.segment(model,req,detector if method=='rescue' else None)
                    row={'scene':name,'method':method,'run':repeat+1,'seconds':round(time.perf_counter()-t,3),**match(s,truth)}
                    rows.append(row);print(json.dumps(row),flush=True)
    return rows
if __name__=='__main__': main()
