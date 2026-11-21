export function clamp01(value) { return Math.max(0, Math.min(1, value)); }
export function normalizePolygon(points) {
  if (!points.length) return { x: 0, y: 0, width: 0, height: 0, polygon: [] };
  const xs = points.map((point) => clamp01(point.x));
  const ys = points.map((point) => clamp01(point.y));
  return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys), polygon: points.map((point) => ({ x: clamp01(point.x), y: clamp01(point.y) })) };
}
export function overlayPlacement(anchor, cardSize = { width: 190, height: 150 }) {
  const side = anchor.x > 0.62 ? 'left' : 'right';
  return { side, x: side === 'right' ? clamp01(anchor.x + 0.08) : clamp01(anchor.x - 0.08), y: clamp01(anchor.y), cardSize };
}
export function cropDataUrl(video, selection) {
  const canvas = document.createElement('canvas');
  const width = video.videoWidth || 480;
  const height = video.videoHeight || 900;
  const sx = Math.max(0, Math.floor(selection.x * width));
  const sy = Math.max(0, Math.floor(selection.y * height));
  const sw = Math.max(1, Math.floor(selection.width * width));
  const sh = Math.max(1, Math.floor(selection.height * height));
  canvas.width = sw; canvas.height = sh;
  canvas.getContext('2d')?.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas.toDataURL('image/jpeg', .78);
}
export function coverTransform(viewport, media) {
  const scale = Math.max(viewport.width / media.width, viewport.height / media.height);
  const rendered = { width: media.width * scale, height: media.height * scale };
  return { scale, offsetX: (rendered.width - viewport.width) / 2, offsetY: (rendered.height - viewport.height) / 2 };
}
export function screenToMediaSelection(selection, viewport, media) {
  const transform = coverTransform(viewport, media);
  const sx = selection.x * viewport.width + transform.offsetX;
  const sy = selection.y * viewport.height + transform.offsetY;
  const sw = selection.width * viewport.width;
  const sh = selection.height * viewport.height;
  return { x: clamp01(sx / renderedWidth(media, transform.scale)), y: clamp01(sy / renderedHeight(media, transform.scale)), width: clamp01(sw / renderedWidth(media, transform.scale)), height: clamp01(sh / renderedHeight(media, transform.scale)), polygon: selection.polygon };
}
function renderedWidth(media, scale) { return media.width * scale; }
function renderedHeight(media, scale) { return media.height * scale; }
