# HowMuch AR for Android

On an ARCore-supported Android device the web app hands a selected product and the displayed price label to the companion. The camera, appearance matching, depth sampling and world anchors run locally. The HUD is a translucent 18 cm × 7.5 cm GLES textured quad in world space (not a clamped screen TextView), billboarded from the camera pose. The companion has no Internet permission and does not independently verify the price.

**Automatic mode** is available when the user opens a result with a usable masked appearance signature. Point the camera at the same item and hold briefly. Two consecutive, unambiguous matches are required, followed by consistent metric depth from samples inside the selected mask, or at least four distinct ARCore feature points reprojected across the mask with consistent depth. A plane behind the product is not accepted as automatic depth. The card follows a newly estimated location as the item moves; camera matrices and distance determine perspective position and physical size. The last world anchor is retained while validation is temporarily unavailable, but the card remains hidden until a fresh appearance/depth/feature cohort confirms the same target. If tracking disappears, the label is hidden. This is local appearance confirmation, not proof of serial-number identity. Similar items, a large rotation, reflection, fast motion, poor light or a new view can prevent matching. Absence of depth or feature support leaves the automatic card hidden.

**Manual mode** is explicit: use the “수동 표면 배치” button, or open a legacy handoff without a usable signature and tap a tracked horizontal or vertical surface beside the item. This attaches the card to the surface, not to a moving product. In either mode, turn away from the anchor to hide the card.

Build with JDK 17, Gradle 8.9 and Android platform 35:

```sh
gradle -p native/android :app:assembleDebug
adb install -r native/android/app/build/outputs/apk/debug/app-debug.apk
```

The user-initiated URI is `howmuch-ar://place?name=...&label=...&sig=...`. Text fields are URL-encoded and limited to 120 plain-text code points each. The optional `sig` is base64url JSON (version 1, at most 4,096 bytes decoded) with aspect, normalized height and 8–121 masked RGB sample tuples `[dx,dy,r,g,b]`; it contains no full scene. Do not log handoff URIs. Invalid signatures fall back to manual mode; no anchor is placed until a surface is tapped.

Plain JVM regression, from the repository root:

```sh
mkdir -p native/android/app/build/target-test
javac -d native/android/app/build/target-test native/android/app/src/main/java/org/nomadamas/howmuch/MaskedTarget.java native/android/app/src/main/java/org/nomadamas/howmuch/DepthCohort.java native/android/tests/MaskedTargetTest.java
java -cp native/android/app/build/target-test org.nomadamas.howmuch.MaskedTargetTest
```

Physical-device acceptance still required: confirm alignment in portrait and landscape, move a textured item, present two identical items, cover/restore the camera, deny permission, and test with/without ARCore Depth support. The JVM test and debug build do not certify real-device camera accuracy.
