// Sensor-free camera motion: how far did the scene slide between two frames? A 64x48 grayscale copy of the video is
// block-matched against the previous one (whole-frame translation, +-8 px). The summed shift lets a lost object's outline
// travel with the scene, so it leaves the screen when the camera pans away instead of staying glued to the glass.
const W = 64, H = 48, R = 8;
export function createFrameMotion() {
  const canvas = typeof document === 'undefined' ? null : Object.assign(document.createElement('canvas'), { width: W, height: H });
  const g = canvas?.getContext('2d', { willReadFrequently: true });
  let prev = null, x = 0, y = 0;
  const gray = video => { g.drawImage(video, 0, 0, W, H); const d = g.getImageData(0, 0, W, H).data, a = new Float32Array(W * H); for (let i = 0; i < a.length; i++) a[i] = d[i * 4] * .3 + d[i * 4 + 1] * .59 + d[i * 4 + 2] * .11; return a; };
  return {
    /** Call a few times per second with the live <video>; returns the accumulated scene shift in frame-normalized units. */
    update(video) {
      if (!g || !video?.videoWidth) return { x, y };
      let cur; try { cur = gray(video); } catch { return { x, y }; }
      if (prev) { const s = bestShift(prev, cur); x += s.dx / W; y += s.dy / H; }
      prev = cur; return { x, y };
    },
    get: () => ({ x, y }),
  };
}
/** Shift (dx,dy) such that cur(p) ~ prev(p - shift): the scene moved by +shift between the frames. */
export function bestShift(prev, cur) {
  let best = Infinity, bx = 0, by = 0;
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    let sum = 0, n = 0;
    for (let j = Math.max(0, dy); j < Math.min(H, H + dy); j += 2) for (let i = Math.max(0, dx); i < Math.min(W, W + dx); i += 2) { sum += Math.abs(cur[j * W + i] - prev[(j - dy) * W + (i - dx)]); n++; }
    sum /= Math.max(n, 1); if (sum < best - 1e-6 || (Math.abs(sum - best) <= 1e-6 && Math.hypot(dx, dy) < Math.hypot(bx, by))) { best = sum; bx = dx; by = dy; }
  }
  return { dx: bx, dy: by };
}
