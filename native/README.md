# HowMuch apps (install and test on a phone)

Two installable app shells host the same HowMuch camera app as the web build (cut-out outlines, price tags, gyro world anchors, parallel research). They contain no keys: they load the URL of a HowMuch server.

1. On the Mac: `npm run demo:phone` (HTTPS on your Wi-Fi, private certificate; prints the address, e.g. `https://192.168.0.12:8443`).
2. **iPhone**: open `native/ios/HowMuchAR.xcodeproj`, choose the **HowMuch** scheme, select your signing team and the phone, Run. First launch asks for camera and motion permission. Shake the phone to change the server address. Simulator: `xcodebuild -project native/ios/HowMuchAR.xcodeproj -scheme HowMuch -sdk iphonesimulator ...` (default address `http://127.0.0.1:5173`, the Vite dev server).
3. **Android**: `cd native/android && ANDROID_HOME=<sdk> gradle assembleDebug`, then `adb install app/build/outputs/apk/debug/app-debug.apk`. The default address is `http://10.0.2.2:5173` (emulator -> host); press Volume Up or fail to connect to enter your Mac address.

The ARKit/ARCore companions below remain the precise depth-anchor path; the shells use the web app's gyro anchors. Status: iOS shell built and launched on the iPhone 17 Pro simulator (camera test pattern, UI renders). Android debug APK builds; it has not been run (no emulator or device here). Real-device behaviour is tracked in #31.

---

# Product-relative price cards on a phone

The web agent researches the selected product. In its price details, **HowMuch AR에서 열기** opens the installed companion with one display name, one price label and an optional sparse signature sampled inside the mask. No full scene, model credential or provider endpoint is included. Both companions operate locally. With usable visual and metric evidence they place a 3D label beside the product without a surface tap. Manual placement is a separate choice when the signature or depth is unavailable.

- [iPhone / ARKit](ios/README.md): open the Xcode project, select your signing team and ARKit device, build and run. Then use the link in the web result.
- [Android / ARCore](android/README.md): build or install the debug APK on a compatible device, then open the result from the paired web page.
- [WebXR](../docs/WORLD_ANCHORS.md): on eligible browsers, enter directly from the live camera. This path can show multiple jobs and refresh pending prices in one session. A native handoff displays one price snapshot.

Hardware validation is tracked in [#31](https://github.com/NomaDamas/HowMuch/issues/31).
