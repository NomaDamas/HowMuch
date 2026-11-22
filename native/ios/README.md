# iOS product-relative price label

The app opens the HowMuch price handoff locally. A manual tap places a stationary price label on a detected surface. If the handoff includes a sparse cutout signature, automatic placement starts immediately with no surface tap. A tap cannot invoke a surface raycast in automatic mode. To return to manual placement, choose the mode button again. No provider keys or HTTP research credentials enter this app.

The URL is limited to 12,000 UTF-8 bytes. Signature v1 is base64url JSON containing aspect (bounding-box pixel width divided by height), height (fraction of full camera frame), and 8–121 RGB taps, each [dx,dy,r,g,b] with dx and dy relative to box center and dimensions. Invalid, missing, uniform, or ambiguous signatures cannot activate a visual anchor. The sparse samples describe appearance; do not treat them as secret or globally unique identifiers.

The app uses ARFrame.displayTransform for the current interface orientation, samples the live camera buffer, and matches scale and translation. It requires two consistent visual and metric confirmations. LiDAR devices must yield coherent medium/high-confidence depth on the sampled cutout. If a depth map is supplied but unreliable, no price card is placed. Devices without a depth map need coherent tracked feature points in at least three distinct sampled cells. Failure to match hides the product card; explicit manual placement is still available. No guessed depth or unrelated surface plane is used by automatic placement.

Build using the existing Xcode project: xcodebuild -quiet -project native/ios/HowMuchAR.xcodeproj -scheme HowMuchAR -configuration Release -sdk iphoneos -destination generic/platform=iOS -derivedDataPath .howmuch/ios-build CODE_SIGNING_ALLOWED=NO build

An unsigned arm64 device Release build verifies the SDK integration. On-device depth accuracy, robustness to rotations/lighting changes, and tracking/relocalization around moving products remain physical iPhone QA gates.
