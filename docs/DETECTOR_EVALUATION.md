# When hidden proposals help

Automatic mode keeps the existing SAM 2.1 grid masks. If fewer than four survive, the optional NanoDet-Plus proposes additional internal prompts. SAM alone produces the transparent silhouettes. The backend does not send detector labels or boxes to the product, research agent, or browser. Manual point/lasso requests skip the detector. With no checkpoint, or with HOWMUCH_DETECTOR=off, the worker uses only SAM. Restart the worker after changing weights/configuration.

## Repeat the measurement

From the repository root, after the normal SAM installation:

```bash
bash scripts/setup-segmentation.sh --detector-only
mkdir -p .howmuch/checks
base=https://cdn.dummyjson.com/product-images
curl -fL "$base/groceries/apple/1.webp" -o .howmuch/checks/apple.webp
curl -fL "$base/mobile-accessories/apple-airpods/1.webp" -o .howmuch/checks/earbuds.webp
curl -fL "$base/mens-shirts/blue-&-black-check-shirt/1.webp" -o .howmuch/checks/shirt.webp
.howmuch/sam/venv/bin/python scripts/benchmark-detector.py --repeats 2
```

The installer pins OpenCV Zoo revision 48b10fa505aeb51fbd127fc60a5c660040e823b7 and verifies the 3,800,954-byte ONNX against its SHA-256, 4b82da9944b88577175ee23a459dce2e26e6e4be573def65b1055dc2d9720186. Only OpenCV and NumPy, already in the SAM environment, are needed. See the [license inventory](COMMERCIAL_READINESS.md). The script composes, but does not redistribute, catalog photos. Fixture SHA-256 values:

```text
efa134ef08447edd76e66f6b330a091dc0e1990fe5a03095cc83391f84b01ba2  apple.webp
60001ba208a6e259af2437623715b22adb43f1e51204320349325b11cf53afeb  earbuds.webp
c6c356d6b07ba4c777c28cf74be8170594733ea88ef9de133fc2b9c0f1771a4f  shirt.webp
```

## Measured 2026-11-23, arm64 Mac, CPU

We matched output masks one-to-one to the visible source alpha silhouettes at IoU ≥ 0.5. Both runs had identical match counts. Times include preprocessing, model inference, and PNG encoding; exclude model load and network.

| Scene | Grid matches | With rescue | Unmatched masks grid/rescue | Seconds grid | Seconds rescue |
| --- | ---: | ---: | --- | --- | --- |
| Shelf (2 objects) | 1/2 | 1/2 | 0/0 | 2.50, 1.37 | 1.60, 1.43 |
| Drawer (3 objects) | 1/3 | 3/3 | 0/0 | 1.70, 2.53 | 1.75, 1.90 |
| Crowded (4 objects) | 1/4 | 3/4 | 1/1 | 2.55, 1.96 | 1.90, 1.95 |

Rescue recovered four more instances (7/9 vs 3/9). One shelf item remained unmatched and both methods returned a spurious crowded-scene mask. Three controlled composites and two repeats do not establish real-camera accuracy or a speed improvement; time fluctuated and repeated products are not independent samples. Compare handheld clutter, glare, eyeglasses and unseen objects before widening the claim. Category labels from this detector cannot identify an exact model.

## Field acceptance

[Parent #27](https://github.com/NomaDamas/HowMuch/issues/27) links the per-feature gates: [#28 detector](https://github.com/NomaDamas/HowMuch/issues/28), [#29 pricing](https://github.com/NomaDamas/HowMuch/issues/29), [#30 motion](https://github.com/NomaDamas/HowMuch/issues/30), and [#31 AR hardware](https://github.com/NomaDamas/HowMuch/issues/31). The figures above are offline image-processing measurements, not iPhone or Android camera tests. Synthetic camera/XR poses and native compilation can validate software paths, but cannot establish physical relocalization, thermal performance, or alignment. Record real device model, OS, scene, permission behavior and loss/return outcomes on #31 before closing it.
