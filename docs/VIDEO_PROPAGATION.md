# Refresh a selected silhouette with two-frame SAM memory

POST the current image to the existing local segment endpoint, with an explicit previous image and the **full-frame normalized** contour for one subject:

```json
{
  "imageDataUrl": "data:image/jpeg;base64,...",
  "propagation": {
    "previousImageDataUrl": "data:image/jpeg;base64,...",
    "selection": {
      "polygon": [{"x":0.2,"y":0.3},{"x":0.35,"y":0.3},{"x":0.3,"y":0.55}]
    }
  }
}
```

The previous image and seed must correspond to one another, not to a cropped preview. Both images must use the same orientation and dimensions after decoding. Send the optional `selection.contours` (all rings, including the outer polygon) to preserve holes; otherwise the polygon alone is the seed. Do not combine a propagation request with an independent top-level tap/draw selection. Each image is limited to 8 million data-URL characters and 12 million decoded pixels before shrinking to a maximum dimension of 800. The contour budget is 16 rings, 4,096 total points, in [0,1].

The pinned SAM 2.1 Hiera Tiny video predictor takes that seed as a mask on frame 0 and propagates it to frame 1 using its learned memory. It shares checkpoint weights with normal image segmentation, but **not inference state**: each request holds just two frames and a fresh state. Frames and masks are not written to disk. A rejected/absent result (model predicts no mask, geometry/foreground confidence outside acceptance limits, or image dimensions differ) yields a successful response with `mode: "video_propagation"`, `selections: []` and `selection: null`. A visible object uses the usual output with current-frame normalized contours and an RGBA cutout. Malformed seeds fail before admission to the worker queue. This is an intermittent mask refinement, not real-time video streaming, SKU re-identification or a spatial world anchor.

Reproduce without a camera, credentials or network: after the standard SAM installation, run `.howmuch/sam/venv/bin/python scripts/smoke-video.py`. On an arm64 Mac CPU the generated 400×260 cup moved 56 pixels: IoU 0.995 with the expected alpha silhouette (3.95 s including startup). A blank next frame returned no masks (1.63 s). A separate subsequent request using the original seed recovered IoU 0.995 (1.63 s). These three checks verify the model path and lost/reacquired behavior for this fixture, not general tracking accuracy on shelves or phones. A separate camera-motion and physical-device test is still needed.

## Live following (streaming video object segmentation)

Once an outline is chosen (tap, drawing, or Auto), the app follows the object through the live camera with SAM 2 and its memory instead of a color template, so rotation, tilt, approach and short occlusions no longer lose it.

`POST /agent/track` (same pairing rules as `/agent/segment`):

| op | body | answer |
|---|---|---|
| `start` | `sid`, `imageDataUrl` (first frame, 480 px wide is enough), `contours` (the chosen outline, full-frame normalized) | `{track:{ok}}` |
| `step` | `sid`, `imageDataUrl` (next frame, same size) | `{track:{ok, tracked, score, selection:{x,y,width,height,polygon,contours}}}`; `tracked:false` means lost |
| `end` | `sid` | `{track:{ok}}` |

* A separate Python process (`HOWMUCH_WORKER_ROLE=track`) runs the tracker so a slow outline cut never stalls following. It is started and loaded when the agent server starts (`HOWMUCH_TRACK_WARM=off` to disable).
* The tracker uses a 512 px model input (`HOWMUCH_TRACK_SIZE`) on the Apple GPU when present (`HOWMUCH_TRACK_DEVICE`, default `mps`, else `cpu`). Measured on an M2 Pro with synthetic motion (up to 25 degrees of rotation and 25 % zoom over 24 frames): 512 px about 70 ms per frame and IoU 0.89, 768 px about 240 ms and 0.91, 1024 px about 390 ms and 0.92. On CPU a frame took about 1.5 s at 1024 px. These are synthetic transforms of still photos, not real camera video.
* `server/sam_track.py` feeds frames one by one into the upstream predictor and keeps only the newest 9 frames of memory, so memory stays bounded.
* The browser sends about 6 frames per second per object (one object at a time takes its turn); when the server is behind it answers 429 and the frame is skipped. When the server loses the object the earlier template tracker and the SAM refresh take over. Removing an object ends its session; idle sessions expire after 60 s; at most 6 sessions.

## Cut-out quality (segmentation model)

One-shot cut-outs (tap, draw, auto) use SAM 2.1 **large** when a GPU is present (Apple MPS or CUDA) and fall back to tiny on a plain CPU. Override with `HOWMUCH_SAM_MODEL=tiny|small|base|large`. Live following keeps using tiny at 512 px for speed; its seed is the large model's mask, so it starts from a better outline.

Measured on this Mac (31 objects from `eval/images`, box prompts, large as the reference):

| model | s/object (MPS) | IoU vs large | boundary F (2 px) |
|---|---|---|---|
| tiny | 0.10 | 0.78 | 0.55 |
| small | 0.19 | 0.75 | 0.62 |
| base+ | 0.35 | 0.86 | 0.69 |
| large | 0.80 | 1.00 (reference) | 1.00 |

There is no ground-truth mask set, so these numbers measure agreement with the large model, not absolute accuracy. Side-by-side overlays showed tiny leaving speckle and holes and cutting off handles, while large kept whole objects.

Also changed: input up to 1024 px (was 800), speckle/pinhole cleanup on the mask, finer contour simplification (0.13% of the perimeter, was 0.3%), and a 1 px anti-aliased cut-out edge.
