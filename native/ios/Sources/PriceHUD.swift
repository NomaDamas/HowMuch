import UIKit
import SceneKit

// Spatial price HUD for ARKit: an upright glass slab with real thickness, price text floating in front of it,
// a thin stem down to the product and a pulsing ring on the surface. The slab only yaws toward the viewer,
// so walking around it shows genuine parallax. Anchored in world space: walking and looking away keep it in place.
enum PriceHUD {
    static let size = CGSize(width: 0.19, height: 0.08)

    static func faceTexture(title: String, price: String) -> UIImage {
        let w: CGFloat = 760, h: CGFloat = 320
        return UIGraphicsImageRenderer(size: CGSize(width: w, height: h)).image { ctx in
            let rect = CGRect(x: 0, y: 0, width: w, height: h), path = UIBezierPath(roundedRect: rect, cornerRadius: 44)
            path.addClip()
            let colors = [UIColor(red: 0.16, green: 0.25, blue: 0.23, alpha: 0.92).cgColor, UIColor(red: 0.03, green: 0.07, blue: 0.06, alpha: 0.9).cgColor] as CFArray
            let g = CGGradient(colorsSpace: CGColorSpaceCreateDeviceRGB(), colors: colors, locations: [0, 1])!
            ctx.cgContext.drawLinearGradient(g, start: .zero, end: CGPoint(x: w, y: h), options: [])
            UIColor(red: 0.78, green: 1.0, blue: 0.35, alpha: 1).setFill(); UIBezierPath(rect: CGRect(x: 0, y: 0, width: 190, height: 8)).fill()
            let p = NSMutableParagraphStyle(); p.lineBreakMode = .byTruncatingTail
            ("HOWMUCH · 최저가" as NSString).draw(in: CGRect(x: 40, y: 30, width: 680, height: 40), withAttributes: [.font: UIFont.systemFont(ofSize: 28, weight: .semibold), .foregroundColor: UIColor(red: 0.78, green: 1, blue: 0.35, alpha: 1)])
            (title as NSString).draw(in: CGRect(x: 40, y: 78, width: 680, height: 70), withAttributes: [.font: UIFont.systemFont(ofSize: 44, weight: .semibold), .foregroundColor: UIColor(white: 0.93, alpha: 1), .paragraphStyle: p])
            (price as NSString).draw(in: CGRect(x: 40, y: 160, width: 680, height: 130), withAttributes: [.font: UIFont.systemFont(ofSize: 92, weight: .heavy), .foregroundColor: UIColor.white, .paragraphStyle: p])
            UIColor(white: 1, alpha: 0.28).setStroke(); path.lineWidth = 3; path.stroke()
        }
    }

    /// Builds the whole HUD. `to` is the card centre relative to the anchor (product centre) in metres.
    static func make(title: String, price: String, to: simd_float3) -> SCNNode {
        let root = SCNNode(); root.name = "hud"

        let slab = SCNBox(width: size.width, height: size.height, length: 0.012, chamferRadius: 0.006)
        let face = SCNMaterial(); face.diffuse.contents = faceTexture(title: title, price: price); face.lightingModel = .constant
        let edge = SCNMaterial(); edge.diffuse.contents = UIColor(red: 0.78, green: 1, blue: 0.35, alpha: 1); edge.lightingModel = .constant
        let back = SCNMaterial(); back.diffuse.contents = UIColor(red: 0.05, green: 0.1, blue: 0.09, alpha: 0.95); back.lightingModel = .constant
        slab.materials = [face, edge, back, edge, edge, edge]
        let card = SCNNode(geometry: slab); card.name = "priceLabel"
        card.position = SCNVector3(to.x, to.y, to.z)
        let look = SCNBillboardConstraint(); look.freeAxes = .Y   // upright: yaw only, so walking around reveals depth
        card.constraints = [look]
        card.runAction(.repeatForever(.sequence([.moveBy(x: 0, y: 0.006, z: 0, duration: 1.5), .moveBy(x: 0, y: -0.006, z: 0, duration: 1.5)])))
        root.addChildNode(card)

        // stem from the product centre to the slab
        let len = CGFloat(simd_length(to))
        if len > 0.01 {
            let cyl = SCNCylinder(radius: 0.0007, height: len)
            let m = SCNMaterial(); m.diffuse.contents = UIColor(red: 0.78, green: 1, blue: 0.35, alpha: 0.85); m.lightingModel = .constant; cyl.materials = [m]
            let stem = SCNNode(geometry: cyl)
            stem.position = SCNVector3(to.x / 2, to.y / 2, to.z / 2)
            stem.look(at: SCNVector3(to.x, to.y, to.z), up: SCNVector3(0, 1, 0), localFront: SCNVector3(0, 1, 0))
            root.addChildNode(stem)
        }

        // pulsing catch-ring on the surface at the anchor
        let ring = SCNTorus(ringRadius: 0.03, pipeRadius: 0.0011)
        let rm = SCNMaterial(); rm.diffuse.contents = UIColor(red: 0.78, green: 1, blue: 0.35, alpha: 1); rm.lightingModel = .constant; ring.materials = [rm]
        let ringNode = SCNNode(geometry: ring); ringNode.name = "ring"
        ringNode.runAction(.repeatForever(.group([
            .sequence([.scale(to: 0.7, duration: 0), .scale(to: 1.9, duration: 1.8)]),
            .sequence([.fadeOpacity(to: 1, duration: 0), .fadeOpacity(to: 0, duration: 1.8)])])))
        root.addChildNode(ringNode)
        let dot = SCNNode(geometry: SCNSphere(radius: 0.004)); dot.geometry?.materials = [rm]
        root.addChildNode(dot)
        return root
    }

    /// Keep the slab legible at any distance: scale with camera distance, clamped.
    static func rescale(_ hud: SCNNode, cameraPosition: SCNVector3) {
        guard let card = hud.childNode(withName: "priceLabel", recursively: false) else { return }
        let a = hud.worldPosition, d = hypot(hypot(cameraPosition.x - a.x, cameraPosition.y - a.y), cameraPosition.z - a.z)
        let s = Float(max(0.8, min(2.4, d / 0.7)))
        card.scale = SCNVector3(s, s, s)
    }
}
