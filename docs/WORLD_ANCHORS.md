# Surface placement on the web

The ordinary camera HUD follows moving objects by image coordinates. Optional immersive AR pins a previously researched product's name and price to a **stationary surface**; it does not identify or track a moving object in 3-D. Research happens once, before entering the immersive session.

On a device reporting immersive-ar support, open the product details and choose “고정된 상품 옆에 AR로 배치.” Point at a shelf or floor beside the product and tap when the ring appears. The textured, translucent card is placed 12 cm to the side and 8 cm above the hit. It turns to face the viewer; its translation stays fixed. Tap again to move it. This is an explicit placement relative to the user-selected surface, not an estimate of the product's center.

The browser must be a secure context, support immersive-ar and hit-test, have working WebGL, and grant the session request. XRAnchor is used when available. Otherwise the hit translation is recorded in local reference space until a reference reset; this fallback is less stable. Tracked anchor pose loss hides the card. Both modes render each eye using its XR projection and view matrix; moving offscreen clips naturally. Depth occlusion behind shelves is not implemented. Devices without immersive AR continue to use the normal camera screen.

Validation: node unit tests cover camera/world transforms and locked placement as the camera moves. The Chromium WebGL smoke test (node scripts/world-anchor-browser.mjs) uses controlled XR poses, including loss/reacquisition, to test reticle placement, frame submission, and cleanup. It does not measure real-device pose accuracy, relocalization or motion-to-photon delay.
