import React, { useEffect, useRef, useState } from 'react';
import { toScreen } from './lib/camera-scene.js';
import { intrinsics, worldDirection, projectDirection, edgePoint, watchOrientation } from './lib/gyro-world.js';

// Pokémon-GO-style persistence on any phone: while a target is visually tracked its centre is converted to a
// world direction (refreshed every frame to cancel gyro drift). When tracking is lost or the user turns away,
// the same direction is re-projected: a ghost tag shows where the object is, or an edge arrow points to it.
export default function GhostLayer({ enabled, jobs, video, size, label }) {
  const pose = useRef(null), [tags, setTags] = useState([]);
  useEffect(() => { if (!enabled) { pose.current = null; setTags([]); return; } return watchOrientation(R => { pose.current = R; }); }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    let raf = 0, last = 0;
    const loop = t => {
      raf = requestAnimationFrame(loop);
      if (t - last < 40 || !pose.current || !video.current?.videoWidth) return; last = t;
      const R = pose.current, cam = intrinsics(60, size.width / Math.max(size.height, 1)), out = [];
      for (const o of jobs.current.values()) {
        if (o.position) {
          const s = toScreen(o.position, size, video.current);
          o.worldDir = worldDirection(R, { x: s.x + s.width / 2, y: s.y + s.height / 2 }, cam);
          continue;
        }
        if (!o.worldDir) continue;
        const p = projectDirection(R, o.worldDir, cam);
        out.push({ o, p, inView: p.inView, edge: p.inView ? null : edgePoint(p), angle: p.edge });
      }
      setTags(prev => prev.length === 0 && out.length === 0 ? prev : out);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [enabled, size.width, size.height]);
  if (!enabled || !tags.length) return null;
  return <div className="ghost-layer" aria-label="시야 밖 물체">
    {tags.map(({ o, p, inView, edge, angle }) => inView
      ? <div key={o.id} className="ghost-tag" style={{ left: p.x * size.width, top: p.y * size.height }} data-object-id={o.id}><i className="ghost-ring" /><span>{label(o)}</span></div>
      : <div key={o.id} className="ghost-arrow" style={{ left: edge.x * size.width, top: edge.y * size.height }} data-object-id={o.id}><b style={{ transform: `rotate(${-angle}rad)` }}>➤</b><span>{label(o)}</span></div>)}
  </div>;
}
