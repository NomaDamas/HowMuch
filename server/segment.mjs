import { spawn } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const python = process.env.HOWMUCH_SAM_PYTHON || root + '.howmuch/sam/venv/bin/python';
const failure = (msg, status) => Object.assign(new Error(msg), {status});
const unit = n => Number.isFinite(n) && n >= 0 && n <= 1;
const isPoint = p => p && unit(p.x) && unit(p.y);
const imageOK = s => typeof s === 'string' && s.length <= 8_000_000 && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/i.test(s);
const ringOK = r => Array.isArray(r) && r.length >= 3 && r.length <= 4096 && r.every(isPoint);
// One Python process per role: 'segment' (cuts outlines, can take seconds on CPU) and 'track' (follows objects, ~0.1 s per frame).
// Separate processes mean a slow outline never stalls live following.
function makeChannel(role) {
let worker, pending;
const queue = [];

function pump() {
  if (pending || !queue.length) return;
  pending = queue.shift();
  try {
    if (!worker) {
      accessSync(python, constants.X_OK);
      accessSync(root + '.howmuch/sam/sam2.1_hiera_tiny.pt');
      const child = spawn(python, ['-u', root + 'server/sam_worker.py'], {
        cwd: root, stdio: ['pipe', 'pipe', 'inherit'], env: {
          PATH: process.env.PATH, HOME: process.env.HOME, PYTORCH_ENABLE_MPS_FALLBACK: '1', HOWMUCH_WORKER_ROLE: role,
          ...(process.env.HOWMUCH_SAM_DEVICE && { HOWMUCH_SAM_DEVICE: process.env.HOWMUCH_SAM_DEVICE }),
          ...(process.env.HOWMUCH_DETECTOR === 'off' && { HOWMUCH_DETECTOR: 'off' }),
          ...(process.env.HOWMUCH_TRACK_DEVICE && { HOWMUCH_TRACK_DEVICE: process.env.HOWMUCH_TRACK_DEVICE }),
          ...(process.env.HOWMUCH_TRACK_SIZE && { HOWMUCH_TRACK_SIZE: process.env.HOWMUCH_TRACK_SIZE })
        }
      });
      worker = child;
      const stopped = () => {
        if (worker !== child) return;
        worker = null;
        child.kill();
        const message = failure('Segmentation worker stopped; check model setup', 503);
        if (pending) finish(message, null, false);
        for (const req of queue.splice(0)) req.reject(message);
      };
      child.once('error', stopped);
      child.once('exit', stopped);
      child.stdin.on('error', stopped);
      createInterface({input: child.stdout}).on('line', line => {
        if (worker !== child || !pending) return;
        try {
          const data = JSON.parse(line);
          if (pending.track) return finish(null, data);
          if (!Array.isArray(data.selections)) throw failure('Model could not segment this frame', 422);
          finish(null, {...data, selection: data.selections[0] ?? null});
        } catch (err) { finish(err); }
      });
    }
    const thisWorker = worker;
    pending.timer = setTimeout(() => {
      if (worker !== thisWorker) return;
      worker = null;
      thisWorker.kill();
      finish(failure('Segmentation timed out', 504));
    }, pending.track ? 12000 : 45000);
    worker.stdin.write(JSON.stringify(pending.body) + '\n');
  } catch {
    finish(failure('SAM 2.1 unavailable: run scripts/setup-segmentation.sh', 503));
  }
}
function finish(error, result, again = true) {
  const request = pending;
  pending = null;
  clearTimeout(request.timer);
  if (error) request.reject(error); else request.resolve(result);
  if (again) queueMicrotask(pump);
}
return { queue, pump };
}
const seg = makeChannel('segment'), trk = makeChannel('track');
/** Start the tracking worker and load its model now, so the first selection does not wait for it. */
export function warmTracker() { return track({ op: 'end', sid: 'warmup-000' }).catch(() => {}); }

export function segment(body = {}, {signal} = {}) {
  signal?.throwIfAborted();
  const image = body.imageDataUrl || body.image;
  if (!imageOK(image))
    throw failure('Invalid segmentation image', 400);
  const {point, selection} = body;
  let propagation;
  if (body.propagation != null) {
    const {previousImageDataUrl,selection:seed} = body.propagation;
    const rings = seed?.contours;
    if (point != null || selection != null || !imageOK(previousImageDataUrl) || !ringOK(seed?.polygon) ||
        (rings != null && (!Array.isArray(rings) || !rings.length || rings.length>16 ||
        !rings.every(r=>ringOK(r)) || rings.reduce((total,r)=>total+r.length,0)>4096)))
      throw failure('Invalid video propagation seed',400);
    const clean = r => r.map(({x,y})=>({x,y}));
    propagation = { previousImageDataUrl, selection: {polygon:clean(seed.polygon), ...(rings&&{contours:rings.map(clean)})} };
  }
  if (point != null && !isPoint(point)) throw failure('Invalid selection point', 400);
  if (selection != null && (!isPoint(selection) || !unit(selection.width) || !unit(selection.height) ||
      selection.width <= 0 || selection.height <= 0 || selection.x+selection.width > 1.000001 ||
      selection.y+selection.height > 1.000001 ||
      (selection.polygon && (!Array.isArray(selection.polygon) || selection.polygon.length > 4096 ||
      !selection.polygon.every(isPoint))))) throw failure('Invalid selection bounds', 400);
  if (seg.queue.length >= 4) throw failure('Segmentation is busy', 429);
  return new Promise((resolve,reject)=>{
    const cleanup=()=>signal?.removeEventListener('abort',onAbort);
    const request={body:{image,point,selection,propagation},resolve:value=>{cleanup();resolve(value)},reject:err=>{cleanup();reject(err)}};
    function onAbort(){
      const i=seg.queue.indexOf(request);if(i>=0)seg.queue.splice(i,1);
      // A shared worker must finish an in-flight inference before reading the next reply.
      // Drop its reply, but never stop the worker or consume the next subject's mask.
      request.reject(signal.reason);
    }
    signal?.addEventListener('abort',onAbort,{once:true});
    seg.queue.push(request);seg.pump();
  });
}

const sidOK = s => typeof s === 'string' && /^[\w-]{8,64}$/.test(s);
/** Live object tracking (video object segmentation). op start: first frame + the chosen outline; step: next frame -> outline;
 *  end: forget. Frames are dropped (429) when the worker is behind, so a slow server never builds a backlog of stale frames. */
export function track(body = {}, {signal} = {}) {
  signal?.throwIfAborted();
  const {op, sid} = body;
  if (!['start', 'step', 'end'].includes(op) || !sidOK(sid)) throw failure('Invalid track request', 400);
  const msg = {op, sid};
  if (op !== 'end') {
    const image = body.imageDataUrl || body.image;
    if (!imageOK(image)) throw failure('Invalid tracking image', 400);
    msg.image = image;
  }
  if (op === 'start') {
    const rings = body.contours;
    if (!Array.isArray(rings) || !rings.length || rings.length > 16 || !rings.every(ringOK) || rings.reduce((n, r) => n + r.length, 0) > 4096)
      throw failure('Invalid tracking outline', 400);
    msg.contours = rings.map(r => r.map(({x, y}) => ({x, y})));
  }
  if (op === 'step' && trk.queue.length >= 2) throw failure('Segmentation is busy', 429);
  if (trk.queue.length >= 6) throw failure('Segmentation is busy', 429);
  return new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener('abort', onAbort);
    const request = {track: true, body: {track: msg}, resolve: v => { cleanup(); resolve(v); }, reject: e => { cleanup(); reject(e); }};
    function onAbort() { const i = trk.queue.indexOf(request); if (i >= 0) trk.queue.splice(i, 1); request.reject(signal.reason); }
    signal?.addEventListener('abort', onAbort, {once: true});
    trk.queue.push(request); trk.pump();
  });
}
