import React, { useEffect, useRef, useState } from 'react';
import { toScreen } from './lib/camera-scene.js';
import { intrinsics, worldDirection, projectDirection, edgePoint, watchOrientation, uncertainty } from './lib/gyro-world.js';
import { t, useLang } from './lib/i18n.js';

// Persistence on any phone, no WebXR needed. While an object is visually tracked, every point of its cut-out outline is
// turned into a world direction (refreshed each frame, which cancels gyro drift). When tracking is lost, or the user
// turns away, those directions are projected again with the current phone orientation: the dashed outline is drawn
// on the plane where the object is, a small tag names it, and when it is outside the view an arrow points to it.
// Rotation only: walking changes parallax, so confidence decays with time (see uncertainty()).
// Without motion sensors (a laptop, or permission not given) the outline is held where it was last seen for a few seconds,
// so losing the track never makes the cut-out vanish at once; it is re-attached the moment the object is found again.
const HOLD_SECONDS = 8;
const MAX_POINTS = 96;
const thin = ring => ring.length <= MAX_POINTS ? ring : ring.filter((_, i) => i % Math.ceil(ring.length / MAX_POINTS) === 0);

export default function GhostLayer({ enabled, jobs, video, size, label, filter }) {
  useLang();
  const pose = useRef(null), [ghosts, setGhosts] = useState([]);
  useEffect(() => { if (!enabled) { pose.current = null; return; } return watchOrientation(R => { pose.current = R; }); }, [enabled]);
  useEffect(() => {
    let raf = 0, last = 0;
    const loop = now => {
      raf = requestAnimationFrame(loop);
      if (now - last < 40 || !video.current?.videoWidth) return; last = now;
      const R = pose.current, cam = intrinsics(60, size.width / Math.max(size.height, 1)), out = [];
      for (const o of jobs.current.values()) {
        if (o.position) {
          o.ghostCenter = null;
          const s = toScreen(o.position, size, video.current);
          o.screenRings = (s.contours?.length ? s.contours : [s.polygon]).map(thin); o.screenCenter = { x: s.x + s.width / 2, y: s.y + s.height / 2 };
          if (R) { o.worldDir = worldDirection(R, o.screenCenter, cam); o.worldRings = o.screenRings.map(r => r.map(p => worldDirection(R, p, cam))); }
          continue;
        }
        if (filter != null && o.id !== filter) continue;
        if (!R || !o.worldDir) {           // no sensors: hold the last known outline for a few seconds
          const held = o.lostAt ? (performance.now() - o.lostAt) / 1000 : 0;
          if (o.screenRings && held < HOLD_SECONDS) out.push({ o, center: { ...o.screenCenter, inView: true }, age: held, rings: o.screenRings, inView: true, edge: null, angle: 0 });
          continue;
        }
        const center = projectDirection(R, o.worldDir, cam);
        o.ghostCenter = center.inView && !center.behind ? { x: center.x, y: center.y } : null;   // where the lost object should be now: seed for re-segmentation
        const age = o.lostAt ? (performance.now() - o.lostAt) / 1000 : 0;
        // Outline: project each stored direction; points behind the lens are skipped.
        const rings = (o.worldRings || []).map(r => r.map(d => projectDirection(R, d, cam))).filter(r => r.length > 2 && r.every(p => !p.behind));
        out.push({ o, center, age, rings, inView: center.inView || rings.some(r => r.some(p => p.inView)), edge: center.inView ? null : edgePoint(center), angle: center.edge });
      }
      setGhosts(prev => prev.length === 0 && out.length === 0 ? prev : out);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [enabled, size.width, size.height, filter]);
  if (!ghosts.length) return null;
  const path = rings => rings.map(r => r.map((p, i) => (i ? 'L' : 'M') + p.x + ' ' + p.y).join(' ') + 'Z').join(' ');
  return <>
    <svg className="contours ghost cutout-outline" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true">
      {ghosts.filter(g => g.inView && g.rings.length).map(g => <path key={g.o.id} fillRule="evenodd" style={{ opacity: uncertainty(g.age).opacity }} d={path(g.rings)} />)}
    </svg>
    <div className="ghost-layer" aria-label={t('ghost.aria')}>
      {ghosts.map(({ o, center, age, inView, edge, angle }) => inView
        ? <div key={o.id} className="ghost-tag" style={{ left: center.x * size.width, top: center.y * size.height, opacity: uncertainty(age).opacity }} data-object-id={o.id}><span>{label(o)}</span></div>
        : <div key={o.id} className="ghost-arrow" style={{ left: edge.x * size.width, top: edge.y * size.height }} data-object-id={o.id}><b style={{ transform: `rotate(${-angle}rad)` }}>➤</b><span>{label(o)}</span></div>)}
    </div>
  </>;
}
