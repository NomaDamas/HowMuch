# HowMuch AR for Android

On an ARCore-supported Android device, this optional companion places the product label supplied by the web result on a **real tracked surface**. Camera frames stay in ARCore; the companion does not contact shopping providers or request internet access. Return to the web app to scan another product. This is plane placement, not recognition of a moving product.

Build with JDK 17, Gradle 8.9, and Android SDK platform 35:

```sh
gradle -p native/android :app:assembleDebug
adb install -r native/android/app/build/outputs/apk/debug/app-debug.apk
```

Open a completed product in the web app and select the native AR action. The URI is `howmuch-ar://place?name=...&label=...`, with each field URL-encoded and limited to 120 plain-text code points. Allow camera access, move the device slowly, then tap a detected table, floor or wall beside the product. The app projects an ARCore anchor into the preview using the current camera view and projection matrices. It hides the label when tracking is lost or the anchor is outside the frustum. Tap another surface to reposition. The URL conveys the web-provided label; do not interpret it as an independently verified price.

Physical-device acceptance: test install/permission denial; rotate and pan away and back; cover the camera; background and resume; run with Google Play Services for AR unavailable. A successful compilation does not validate these hardware behaviors.
