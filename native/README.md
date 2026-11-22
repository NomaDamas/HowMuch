# Product-relative price cards on a phone

The web agent researches the selected product. In its price details, **HowMuch AR에서 열기** opens the installed companion with one display name, one price label and an optional sparse signature sampled inside the mask. No full scene, model credential or provider endpoint is included. Both companions operate locally. With usable visual and metric evidence they place a 3D label beside the product without a surface tap. Manual placement is a separate choice when the signature or depth is unavailable.

- [iPhone / ARKit](ios/README.md): open the Xcode project, select your signing team and ARKit device, build and run. Then use the link in the web result.
- [Android / ARCore](android/README.md): build or install the debug APK on a compatible device, then open the result from the paired web page.
- [WebXR](../docs/WORLD_ANCHORS.md): on eligible browsers, enter directly from the live camera. This path can show multiple jobs and refresh pending prices in one session. A native handoff displays one price snapshot.

Hardware validation is tracked in [#31](https://github.com/NomaDamas/HowMuch/issues/31).
