# Stationary price card companions

The web camera does the selection, identification and research. After a price is found, open its details and choose the installed HowMuch AR app. The handoff sends a display name and a price label, never photos, credentials or an endpoint. Both apps place the card on a real surface selected by the user. They do not plug into the vendor's default Camera app or follow a moving item in 3D.

- **iPhone:** Open `ios/HowMuchAR.xcodeproj` in Xcode, choose your team for signing, select an ARKit-compatible iPhone and run. Return to the price details in Safari and tap the app link. Allow camera access, scan a textured surface and tap beside the product. The unsigned device build can be checked with `xcodebuild -project native/ios/HowMuchAR.xcodeproj -scheme HowMuchAR -sdk iphoneos -configuration Debug -derivedDataPath .howmuch/ios-build CODE_SIGNING_ALLOWED=NO build`.
- **Android:** See [ARCore setup and installation](android/README.md).
- **WebXR:** On browsers that expose immersive AR, the details also offer direct placement without a companion app. See [browser support and test procedure](../docs/WORLD_ANCHORS.md).

Release acceptance on physical hardware is tracked in [#31](https://github.com/NomaDamas/HowMuch/issues/31).
