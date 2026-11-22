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
