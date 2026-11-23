// Rotation-only world anchoring for phones without WebXR (iPhone Safari, most Android browsers).
// A screen point is turned into a world direction using the device orientation sensors. Turning the
// phone away and back re-projects the same direction, so cards behave like Pokémon GO objects.
// Limits: it tracks rotation, not walking; yaw drifts slowly. Native ARKit/ARCore remains the
// precise path (see docs/WORLD_ANCHORS.md).
const rad = d => d * Math.PI / 180;

// W3C DeviceOrientation Z-X'-Y'' angles -> rotation matrix R (device frame -> world frame), row-major 3x3.
export function rotationFromEuler(alpha, beta, gamma) {
  const a = rad(alpha || 0), b = rad(beta || 0), g = rad(gamma || 0);
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cg = Math.cos(g), sg = Math.sin(g);
  return [
    ca * cg - sa * sb * sg, -cb * sa, cg * sa * sb + ca * sg,
    cg * sa + ca * sb * sg, ca * cb, sa * sg - ca * cg * sb,
    -cb * sg, sb, cb * cg
  ];
}
const mulVec = (R, v) => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]];
const mulVecT = (R, v) => [R[0] * v[0] + R[3] * v[1] + R[6] * v[2], R[1] * v[0] + R[4] * v[1] + R[7] * v[2], R[2] * v[0] + R[5] * v[1] + R[8] * v[2]];
const norm = v => { const n = Math.hypot(...v) || 1; return v.map(x => x / n); };

// Back camera looks along device -Z in portrait. fovY is the vertical field of view in degrees.
export function intrinsics(fovY = 60, aspect = 9 / 16) {
  const ty = Math.tan(rad(fovY) / 2);
  return { tx: ty * aspect, ty };
}

/** Normalized screen point (0..1, y down) -> unit world direction. */
export function worldDirection(R, point, cam) {
  const ray = norm([(point.x - .5) * 2 * cam.tx, -(point.y - .5) * 2 * cam.ty, -1]);
  return mulVec(R, ray);
}

/** World direction -> normalized screen point. `inView` is false when off-screen; `behind` when opposite the lens. */
export function projectDirection(R, dir, cam) {
  const r = mulVecT(R, dir);
  if (r[2] >= -1e-3) {
    const n = Math.hypot(r[0], r[1]) || 1;
    return { x: .5 + r[0] / n * 4, y: .5 - r[1] / n * 4, inView: false, behind: true, edge: edgeAngle(r[0], r[1]) };
  }
  const x = .5 + (r[0] / -r[2]) / (2 * cam.tx), y = .5 - (r[1] / -r[2]) / (2 * cam.ty);
  return { x, y, inView: x >= 0 && x <= 1 && y >= 0 && y <= 1, behind: false, edge: edgeAngle(x - .5, .5 - y) };
}
// Angle (radians, 0 = right, counter-clockwise positive on screen with y up) from screen centre toward the anchor.
const edgeAngle = (dx, dyUp) => Math.atan2(dyUp, dx);

/** Point on the screen border (with margin) in the direction of an off-screen anchor. */
export function edgePoint(p, margin = .08) {
  const dx = p.x - .5, dy = p.y - .5, k = Math.max(Math.abs(dx) / (.5 - margin), Math.abs(dy) / (.5 - margin), 1e-6);
  return { x: .5 + dx / k, y: .5 + dy / k };
}

export const gyroSupported = () => typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;
export const needsGyroPermission = () => typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';
export async function requestGyro() {
  if (!gyroSupported()) return false;
  if (needsGyroPermission()) { try { return (await DeviceOrientationEvent.requestPermission()) === 'granted'; } catch { return false; } }
  return true;
}
/** Subscribe to orientation; callback gets the rotation matrix. Returns unsubscribe. */
export function watchOrientation(callback, target = window) {
  const handler = e => { if (e.beta == null && e.alpha == null) return; callback(rotationFromEuler(e.alpha, e.beta, e.gamma)); };
  target.addEventListener('deviceorientation', handler);
  return () => target.removeEventListener('deviceorientation', handler);
}

// Rotation-only anchors drift when the user walks, so confidence decays with time since the object was last seen:
// the ring grows (position uncertainty), fades, then collapses to a plain "last seen here" tag.
export function uncertainty(age) {
  if (age < 6) return { scale: 1, opacity: 1, ring: true, note: '' };
  if (age < 25) return { scale: 1 + (age - 6) / 19 * .9, opacity: 1 - (age - 6) / 19 * .45, ring: true, note: '위치 추정' };
  return { scale: 1.9, opacity: .5, ring: false, note: '마지막으로 본 위치' };
}
