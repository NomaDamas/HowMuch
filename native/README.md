# Native adapter contract

iOS (AVFoundation/SwiftUI/ARKit) and Android (CameraX/Compose/ARCore) clients consume `contracts/openapi.yaml` and `sdk/types.ts`. The native camera layer provides a full frame, transparent cutout, normalized selection, and locale; the shared API returns evidence-backed offers; the web/native camera layer computes local HUD placement from the normalized selection and tracking state. Native clients must preserve `HowMuch by NomaDamas`, hide the HUD on tracking loss, and never embed provider secrets.
