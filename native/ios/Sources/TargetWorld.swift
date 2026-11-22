import ARKit
import UIKit
import simd

struct TargetLocation { let center,card:SIMD3<Float> }

enum TargetWorld {
    static func locate(_ frame:ARFrame,_ signature:TargetSignature,_ orientation:UIInterfaceOrientation)->TargetLocation? {
        guard case .normal=frame.camera.trackingState else{return nil}
        let buffer=frame.capturedImage
        guard CVPixelBufferGetPlaneCount(buffer)==2 else{return nil}
        let w=CVPixelBufferGetWidthOfPlane(buffer,0),h=CVPixelBufferGetHeightOfPlane(buffer,0)
        guard w>0,h>0 else{return nil}
        let vertical=orientation.isPortrait
        let size=CGSize(width:vertical ? h:w,height:vertical ? w:h)
        // No aspect-fill crop here: signature offsets and size refer to the full web camera frame.
        let transform=frame.displayTransform(for:orientation,viewportSize:size)
        let inverse=transform.inverted()
        let cols=96,rows=max(1,Int((96*size.height/size.width).rounded()))
        var pixels=[SIMD3<UInt8>](repeating:.zero,count:rows*cols)
        CVPixelBufferLockBaseAddress(buffer,.readOnly)
        guard let lum=CVPixelBufferGetBaseAddressOfPlane(buffer,0)?.assumingMemoryBound(to:UInt8.self),
              let chroma=CVPixelBufferGetBaseAddressOfPlane(buffer,1)?.assumingMemoryBound(to:UInt8.self)
        else{CVPixelBufferUnlockBaseAddress(buffer,.readOnly);return nil}
        let ys=CVPixelBufferGetBytesPerRowOfPlane(buffer,0),cs=CVPixelBufferGetBytesPerRowOfPlane(buffer,1)
        let video=CVPixelBufferGetPixelFormatType(buffer)==kCVPixelFormatType_420YpCbCr8BiPlanarVideoRange
        for row in 0..<rows { for col in 0..<cols {
            let p=CGPoint(x:(Double(col)+0.5)/Double(cols),y:(Double(row)+0.5)/Double(rows)).applying(inverse)
            let x=min(w-1,max(0,Int(p.x*Double(w)))),y=min(h-1,max(0,Int(p.y*Double(h))))
            let i=(y/2)*cs+(x/2)*2, base=Double(lum[y*ys+x])
            let l=video ? (base-16)*255/219:base,u=(Double(chroma[i])-128)*(video ? 255/224:1),v=(Double(chroma[i+1])-128)*(video ? 255/224:1)
            pixels[row*cols+col]=SIMD3(UInt8(clamping:Int(l+1.402*v)),UInt8(clamping:Int(l-0.344136*u-0.714136*v)),UInt8(clamping:Int(l+1.772*u)))
        }}
        CVPixelBufferUnlockBaseAddress(buffer,.readOnly)
        guard let box=signature.match(pixels,width:cols,height:rows) else{return nil}
        let taps=signature.points.map{box.point($0)}
        // Do not override conflicting/low-confidence LiDAR samples with background features.
        let measured=frame.sceneDepth != nil ? depth(frame,taps.map{$0.applying(inverse)}) : featureDepth(frame,taps,box,orientation,size)
        guard let z=measured else{return nil}
        let k=frame.camera.intrinsics, image=frame.camera.imageResolution
        func world(_ p:CGPoint)->SIMD3<Float>{
            let q=p.applying(inverse)
            let x=(Float(q.x*image.width)-k.columns.2.x)*z/k.columns.0.x
            let y=(Float(q.y*image.height)-k.columns.2.y)*z/k.columns.1.y
            let pos=frame.camera.transform*SIMD4<Float>(x,-y,-z,1)
            return SIMD3(pos.x,pos.y,pos.z)
        }
        let center=world(CGPoint(x:box.x,y:box.y))
        let side=box.x<0.58 ? 1.0:-1.0
        let edge=world(CGPoint(x:box.x+side*box.w/2,y:box.y))
        guard simd_distance(edge,center)>0.001 else{return nil}
        // Half of the 19 cm billboard plus a gap beyond the matched silhouette.
        return TargetLocation(center:center,card:edge+simd_normalize(edge-center)*0.105)
    }

    private static func medianDepth(_ values:[Float],minimum:Int)->Float?{
        guard values.count>=minimum else{return nil}
        let s=values.sorted(),m=s[s.count/2]
        let cluster=s.filter{abs($0-m)<max(0.045,0.08*m)}
        guard cluster.count>=minimum,Double(cluster.count)>=0.7*Double(values.count) else{return nil}
        return cluster[cluster.count/2]
    }

    private static func depth(_ f:ARFrame,_ points:[CGPoint])->Float?{
        guard let depth=f.sceneDepth,let confidence=depth.confidenceMap else{return nil}
        let map=depth.depthMap,w=CVPixelBufferGetWidth(map),h=CVPixelBufferGetHeight(map)
        guard w==CVPixelBufferGetWidth(confidence),h==CVPixelBufferGetHeight(confidence) else{return nil}
        CVPixelBufferLockBaseAddress(map,.readOnly);CVPixelBufferLockBaseAddress(confidence,.readOnly)
        defer{CVPixelBufferUnlockBaseAddress(map,.readOnly);CVPixelBufferUnlockBaseAddress(confidence,.readOnly)}
        guard let z=CVPixelBufferGetBaseAddress(map)?.assumingMemoryBound(to:Float32.self),let c=CVPixelBufferGetBaseAddress(confidence)?.assumingMemoryBound(to:UInt8.self) else{return nil}
        let pitch=CVPixelBufferGetBytesPerRow(map)/4,cPitch=CVPixelBufferGetBytesPerRow(confidence)
        let values=points.compactMap{p -> Float? in
            guard p.x>=0,p.y>=0,p.x<1,p.y<1 else{return nil}
            let x=Int(p.x*Double(w)),y=Int(p.y*Double(h)),v=z[y*pitch+x]
            guard c[y*cPitch+x]>=ARConfidenceLevel.medium.rawValue,v.isFinite,v>=0.12,v<=6 else{return nil}
            return v
        }
        return medianDepth(values,minimum:max(5,Int(ceil(Double(points.count)*0.45))))
    }

    private static func featureDepth(_ f:ARFrame,_ taps:[CGPoint],_ b:TargetBox,_ orientation:UIInterfaceOrientation,_ viewport:CGSize)->Float?{
        guard let cloud=f.rawFeaturePoints else{return nil}
        let inv=f.camera.transform.inverse
        var zs:[Float]=[],cells=Set<Int>()
        for q in cloud.points{
            let point=f.camera.projectPoint(q,orientation:orientation,viewportSize:viewport)
            let x=point.x/viewport.width,y=point.y/viewport.height
            guard abs(x-b.x)<b.w/2,abs(y-b.y)<b.h/2 else{continue}
            let depth = -(inv*SIMD4<Float>(q,1)).z
            guard depth>=0.12,depth<=6 else{continue}
            if let index=taps.firstIndex(where:{let dx=($0.x-x)/b.w,dy=($0.y-y)/b.h;return dx*dx+dy*dy<0.0020}),cells.insert(index).inserted {zs.append(depth)}
        }
        return medianDepth(zs,minimum:3)
    }
}
