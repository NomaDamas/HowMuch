"""Opt-in SAM integration: only public catalog images. Run with the project venv."""
import base64, io, json, subprocess, sys, time
from PIL import Image

scene = Image.new('RGB', (640,340), 'white')
for x, product in [(0,'mobile-accessories/apple-airpods'), (320,'groceries/apple')]:
    data=subprocess.check_output(['curl','--fail','--silent','--show-error','--location','--max-time','20',
                                  'https://cdn.dummyjson.com/product-images/'+product+'/1.webp'])
    item=Image.open(io.BytesIO(data)).convert('RGBA')
    item.thumbnail((315,315)); scene.paste(item,(x,10),item)
buf=io.BytesIO();scene.save(buf,'JPEG')
image='data:image/jpeg;base64,'+base64.b64encode(buf.getvalue()).decode()
scene_prompts=[{}, {'point':{'x':.24,'y':.6}}, {'selection':{'x':.52,'y':.20,'width':.41,'height':.62}}]
with subprocess.Popen([sys.executable,'server/sam_worker.py'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True) as worker:
    try:
        for idx, prompt in enumerate(scene_prompts):
            start=time.monotonic()
            worker.stdin.write(json.dumps({'image':image,**prompt})+'\n'); worker.stdin.flush()
            masks=json.loads(worker.stdout.readline())['selections']
            assert masks and all(len(m['polygon'])>=3 for m in masks)
            centers=[m['x']+m['width']/2 for m in masks]
            if idx==0: assert min(centers)<.4 and max(centers)>.6, centers
            else: assert len(masks)==1 and (centers[0]<.4 if idx==1 else centers[0]>.6)
            for m in masks:
                crop=Image.open(io.BytesIO(base64.b64decode(m['cutoutDataUrl'].split(',')[1])))
                assert crop.mode=='RGBA' and crop.getchannel('A').getextrema()==(0,255)
            print('SAM real masks:',len(masks),'seconds:',round(time.monotonic()-start,2))
    finally:
        worker.stdin.close()
