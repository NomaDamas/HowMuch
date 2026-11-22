// Only the demo launcher preloads model weights. No camera or network input.
import { existsSync } from 'node:fs';
import { segment } from '../server/segment.mjs';
if (existsSync(new URL('../.howmuch/sam/sam2.1_hiera_tiny.pt',import.meta.url))) {
  const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAfklEQVR4nNXOQREAIADDsFL/jmYOETy4RkHONsokTuIkTuIkTuIkTuIkTuIkTuIkTuIkTuIkTuIkTuIkTuIkTuIkTuIkTuIkTuIkTuIkTuIkTuIkTuIkTuIkTuIkTuIkTuIkTuIkTuIkTuIkTuIkTuIkTuIkTuIkTuL8HXh1Af75ArFVjpTTAAAAAElFTkSuQmCC';
  segment({image,point:{x:.5,y:.5}}).then(()=>console.log('HowMuch segmentation model ready'),()=>console.warn('Model warmup incomplete; check local setup.'));
}
