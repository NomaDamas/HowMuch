"""JSONL SAM 2 worker. Incoming points and returned contours are full-image relative."""
import base64
import contextlib
import io
import json
import os
from pathlib import Path
import sys

import cv2
import numpy as np
import torch
from PIL import Image, ImageOps
from sam2.build_sam import build_sam2_video_predictor
from sam2.sam2_image_predictor import SAM2ImagePredictor

ROOT = Path(__file__).resolve().parents[1]
PIXELS = 12_000_000
Image.MAX_IMAGE_PIXELS = PIXELS
torch.set_num_threads(min(4, os.cpu_count() or 1))
cv2.setNumThreads(1)


def load_model():
    weights = ROOT / ".howmuch/sam/sam2.1_hiera_tiny.pt"
    device = os.environ.get("HOWMUCH_SAM_DEVICE",
                            "cuda" if torch.cuda.is_available() else
                            "cpu")
    model = build_sam2_video_predictor("configs/sam2.1/sam2.1_hiera_t.yaml", str(weights),
                       device=device, apply_postprocessing=False)
    return SAM2ImagePredictor(model, max_hole_area=0, max_sprinkle_area=0)


def read_image(data):
    encoded = data.split(",", 1)[1]
    if len(encoded) > 8_000_000:
        raise ValueError("image_too_large")
    with Image.open(io.BytesIO(base64.b64decode(encoded, validate=True))) as original:
        if original.format not in {"PNG", "JPEG", "WEBP"} or original.width * original.height > PIXELS:
            raise ValueError("invalid_image")
        image = ImageOps.exif_transpose(original).convert("RGB")
        image.thumbnail((800, 800), Image.Resampling.LANCZOS)
        return np.array(image)


def encode(mask, rgb):
    h, w = mask.shape
    contours, hierarchy = cv2.findContours(mask.astype("uint8"), cv2.RETR_CCOMP,
                                           cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return None
    ranked = sorted(range(len(contours)), key=lambda i: cv2.contourArea(contours[i]), reverse=True)
    rings = []
    for i in ranked[:16]:
        c = contours[i]
        if cv2.contourArea(c) < 6:
            continue
        p = cv2.approxPolyDP(c, max(0.7, 0.003 * cv2.arcLength(c, True)), True)
        if len(p) >= 3:
            rings.append([{"x": round(float(x) / w, 6), "y": round(float(y) / h, 6)}
                          for x, y in p.reshape(-1, 2)])
    if not rings:
        return None
    x, y, bw, bh = cv2.boundingRect(mask.astype("uint8"))
    crop_mask = mask[y:y+bh, x:x+bw]
    rgba = np.dstack((rgb[y:y+bh, x:x+bw], crop_mask.astype("uint8") * 255))
    rgba[~crop_mask] = 0  # Do not send RGB data for non-selected pixels.
    out = io.BytesIO()
    Image.fromarray(rgba).save(out, format="PNG", compress_level=3)
    return {"x": x/w, "y": y/h, "width": bw/w, "height": bh/h,
            "polygon": rings[0], "contours": rings,
            "cutoutDataUrl": "data:image/png;base64," + base64.b64encode(out.getvalue()).decode()}


def segment(predictor, request, detector=None):
    rgb = read_image(request["image"])
    h, w = rgb.shape[:2]
    predictor.set_image(rgb)
    point, hint = request.get("point"), request.get("selection")
    auto = point is None and hint is None
    region = None
    box = None
    if point:
        pts = np.array([[point["x"], point["y"]]])
    elif hint:
        box = np.array([hint["x"], hint["y"], hint["x"] + hint["width"], hint["y"] + hint["height"]]) * [w, h, w, h]
        region = np.zeros((h, w), dtype="uint8")
        points = hint.get("polygon", [])
        if len(points) >= 3:
            polygon = np.int32([[p["x"] * (w-1), p["y"] * (h-1)] for p in points])
            cv2.fillPoly(region, [polygon], 1)
        else:
            x, y, x2, y2 = box.astype(int)
            region[y:y2+1, x:x2+1] = 1
        region = region.astype(bool)
        pts = None
    else:
        pos = np.arange(0.1, 1.0, 0.2)
        pts = np.array([(x, y) for y in pos for x in pos])
    coords = None if pts is None else np.rint(pts * [w-1, h-1]).astype("float32")
    candidates = []
    batches = [None] if coords is None else [coords[i:i+5, None, :] for i in range(0, len(coords), 5)]
    for batch in batches:
        masks, scores, _ = predictor.predict(point_coords=batch,
            point_labels=None if batch is None else np.ones(batch.shape[:2], dtype="int32"),
            box=box, multimask_output=True)
        if masks.ndim == 3:
            masks, scores = masks[None, ...], scores[None, ...]
        for index, (group, quality) in enumerate(zip(masks, scores)):
            options = []
            for mask, score in zip(group, quality):
                mask = mask.astype(bool)
                area = np.count_nonzero(mask)
                fraction = area / (w*h)
                ys, xs = np.where(mask)
                bbox_fraction = ((xs.max()-xs.min()+1)*(ys.max()-ys.min()+1)/(w*h)) if len(xs) else 1.0
                if area < max(16, .001*w*h) or (auto and (fraction < 0.006 or fraction > 0.45 or bbox_fraction > 0.70 or score < 0.7)):
                    continue
                if batch is not None:
                    px, py = batch[index, 0].astype(int)
                    if not mask[py, px]:
                        continue
                edges = [mask[0, :], mask[-1, :], mask[:, 0], mask[:, -1]]
                if auto and (sum(e.mean() > 0.12 for e in edges) >= 2 or bbox_fraction > 0.70):
                    continue
                rank = float(score)
                if region is not None:
                    inside = np.count_nonzero(region & mask)
                    if inside / area < .65:
                        continue
                    rank += 1.5 * inside / max(1, np.count_nonzero(region | mask)) + inside / area
                if auto:
                    rank += 0.16 * min(fraction, .20) / .20
                elif region is None and fraction < .008:
                    rank -= .65
                elif region is None and fraction > .8:
                    rank -= .4
                options.append((rank, area, mask))
            if options:
                candidates.append(max(options, key=lambda item: item[0]))
    chosen = []
    for score, area, mask in sorted(candidates, key=lambda c: c[0], reverse=True):
        if any(np.count_nonzero(mask & old) / min(area, old_area) > .66 for _, old_area, old in chosen):
            continue
        chosen.append((score, area, mask))
        if len(chosen) == (4 if auto else 1):
            break
    # Coverage rescue only: keep accepted grid masks; the detector is never a
    # gate for an unknown product and never runs on point or drawing requests.
    if auto and detector is not None and len(chosen) < 4:
        for box in detector.boxes(rgb):
            x1, y1, x2, y2 = np.rint(box).astype(int)
            box_area = max(1, (x2-x1)*(y2-y1))
            if any(mask[y1:y2,x1:x2].sum() / min(box_area, area) > .58
                   for _,area,mask in chosen):
                continue
            masks, scores, _ = predictor.predict(box=box,multimask_output=True)
            for i in np.argsort(scores)[::-1]:
                mask = masks[i].astype(bool); area = int(mask.sum())
                if scores[i] < .72 or not .001*w*h < area < .55*w*h:
                    continue
                if mask[y1:y2,x1:x2].sum() < .7 * area or area < .13 * box_area:
                    continue
                if any((mask & old).sum() / min(area, old_area) > .66 for _, old_area, old in chosen):
                    continue
                chosen.append((float(scores[i]), area, mask))
                break
            if len(chosen) == 4:
                break
    return [selection for _, _, mask in chosen if (selection := encode(mask, rgb))]


def propagate(model, request):
    """Two-frame SAM memory; no filenames, video handles or reused session state."""
    p = request["propagation"]
    prev, current = read_image(p["previousImageDataUrl"]), read_image(request["image"])
    if current.shape != prev.shape:
        return []
    h, w = current.shape[:2]
    seed = np.zeros((h, w), dtype="uint8")
    rings = p["selection"].get("contours") or [p["selection"]["polygon"]]
    paths = [np.int32([[round(pt["x"]*(w-1)), round(pt["y"]*(h-1))] for pt in ring]) for ring in rings]
    cv2.fillPoly(seed, paths, 1)  # even-odd fill preserves holes
    count = int(seed.sum())
    if count < 16 or count >= .9*h*w:
        return []
    size = model.image_size
    rgb = np.stack([cv2.resize(frame, (size,size), interpolation=cv2.INTER_LINEAR) for frame in (prev,current)])
    images = torch.from_numpy(rgb).permute(0,3,1,2).float().div_(255)
    images.sub_(torch.tensor([.485,.456,.406])[None,:,None,None]).div_(torch.tensor([.229,.224,.225])[None,:,None,None])
    # Same fields as the pinned upstream init_state, which normally loads a
    # video path from disk. The only replaced step is its frame loader.
    state = dict(images=images,num_frames=2,video_height=h,video_width=w,device=model.device,
                 storage_device=model.device,offload_video_to_cpu=True,offload_state_to_cpu=False,
                 obj_ids=[], **{k:{} for k in ("point_inputs_per_obj","mask_inputs_per_obj","cached_features",
                 "constants","obj_id_to_idx","obj_idx_to_id","output_dict_per_obj","temp_output_dict_per_obj",
                 "frames_tracked_per_obj")})
    try:
        model.add_new_mask(state, frame_idx=0, obj_id=1, mask=seed)
        for idx, _, logits in model.propagate_in_video(state,start_frame_idx=1,max_frame_num_to_track=1):
            if idx != 1:
                continue
            scores = logits[0,0].float().cpu().numpy()
            mask = scores>0
            area = int(mask.sum())
            if not max(16,count*.14) <= area <= min(count*5,.92*h*w) or np.mean(scores[mask]>2)<.65:
                return []
            result = encode(mask,current)
            return [result] if result else []
        return []
    finally:
        state.clear()


def main():
    with contextlib.redirect_stdout(sys.stderr):
        predictor = load_model()
        detector = None
        if os.environ.get("HOWMUCH_DETECTOR", "auto") != "off" and (ROOT / ".howmuch/sam/nanodet.onnx").is_file():
            from detector import NanoDet
            try:
                detector = NanoDet()
            except (OSError, ValueError, cv2.error) as err:
                print("NanoDet not loaded; using SAM grid:", type(err).__name__, file=sys.stderr, flush=True)
    for line in sys.stdin:
        try:
            body = json.loads(line)
            with contextlib.redirect_stdout(sys.stderr), torch.inference_mode():
                selections = propagate(predictor.model,body) if body.get("propagation") else segment(predictor, body, detector)
            result = {"selections": selections, "model": "SAM 2.1 Hiera Tiny",
                      "mode": "video_propagation" if body.get("propagation") else "image_segmentation"}
        except Exception as exc:
            print("Segment failed:", type(exc).__name__, str(exc)[:180], file=sys.stderr, flush=True)
            result = {"error": "segment_failed"}
        print(json.dumps(result, separators=(",", ":")), flush=True)
        predictor.reset_predictor()
        line = body = selections = result = None


if __name__ == "__main__":
    main()
