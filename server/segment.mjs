import { spawn } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const python = process.env.HOWMUCH_SAM_PYTHON || root + '.howmuch/sam/venv/bin/python';
const failure = (msg, status) => Object.assign(new Error(msg), {status});
const unit = n => Number.isFinite(n) && n >= 0 && n <= 1;
const isPoint = p => p && unit(p.x) && unit(p.y);
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
          PATH: process.env.PATH, HOME: process.env.HOME, PYTORCH_ENABLE_MPS_FALLBACK: '1',
          ...(process.env.HOWMUCH_SAM_DEVICE && { HOWMUCH_SAM_DEVICE: process.env.HOWMUCH_SAM_DEVICE }),
          ...(process.env.HOWMUCH_DETECTOR === 'off' && { HOWMUCH_DETECTOR: 'off' })
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
    }, 45000);
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
export function segment(body = {}) {
  const image = body.imageDataUrl || body.image;
  if (typeof image !== 'string' || image.length > 8_000_000 ||
      !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/i.test(image))
    throw failure('Invalid segmentation image', 400);
  const {point, selection} = body;
  if (point != null && !isPoint(point)) throw failure('Invalid selection point', 400);
  if (selection != null && (!isPoint(selection) || !unit(selection.width) || !unit(selection.height) ||
      selection.width <= 0 || selection.height <= 0 || selection.x+selection.width > 1.000001 ||
      selection.y+selection.height > 1.000001 ||
      (selection.polygon && (!Array.isArray(selection.polygon) || selection.polygon.length > 4096 ||
      !selection.polygon.every(isPoint))))) throw failure('Invalid selection bounds', 400);
  if (queue.length >= 4) throw failure('Segmentation is busy', 429);
  return new Promise((resolve, reject) => { queue.push({body:{image, point, selection}, resolve, reject}); pump(); });
}
