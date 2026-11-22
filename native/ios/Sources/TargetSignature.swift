import Foundation

struct ColorTap { let x,y,r,g,b: Double }
struct TargetBox {
    let x,y,w,h: Double
    func point(_ tap: ColorTap) -> CGPoint { CGPoint(x:x+w*tap.x,y:y+h*tap.y) }
}
struct TargetSignature {
    let aspect,height: Double
    let points: [ColorTap]
    init?(_ encoded: String) {
        struct Wire: Decodable { let v: Int; let aspect,height:Double; let pts:[[Double]] }
        guard !encoded.isEmpty, encoded.utf8.count<=11000, encoded.utf8.allSatisfy({ (65...90).contains($0) || (97...122).contains($0) || (48...57).contains($0) || $0==45 || $0==95 }) else {return nil}
        var base=encoded.replacingOccurrences(of:"-",with:"+").replacingOccurrences(of:"_",with:"/")
        base+=String(repeating:"=",count:(4-base.count%4)%4)
        guard let data=Data(base64Encoded:base),let wire=try? JSONDecoder().decode(Wire.self,from:data),
            wire.v==1,(0.03...35).contains(wire.aspect),(0.015...1).contains(wire.height),
            (8...121).contains(wire.pts.count),wire.pts.allSatisfy({p in p.count==5 && p[0...1].allSatisfy{abs($0)<=0.5} && p[2...4].allSatisfy{(0...255).contains($0)}}) else{return nil}
        let taps=wire.pts.map{ ColorTap(x:$0[0],y:$0[1],r:$0[2],g:$0[3],b:$0[4]) }
        let n=Double(taps.count),r=taps.map(\.r).reduce(0,+)/n,g=taps.map(\.g).reduce(0,+)/n,b=taps.map(\.b).reduce(0,+)/n
        var deviation:Double=0
        for t in taps{deviation+=abs(t.r-r);deviation+=abs(t.g-g);deviation+=abs(t.b-b)}
        guard deviation>=33*n else{return nil}
        points=taps;aspect=wire.aspect;height=wire.height
    }
    // Sparse RGB grid in oriented full-frame space. Avoid accepting a family of
    // equally good matches at visibly different positions, even with a prior.
    func match(_ rgb:[SIMD3<UInt8>],width:Int,height rows:Int)->TargetBox?{
        guard rgb.count==width*rows,width>=1,rows>=1 else{return nil}
        var matches:[(Double,TargetBox)]=[]
        for scale in [0.5,0.72,1,1.4,2] {
            let h=height*scale,w=h*aspect*Double(rows)/Double(width)
            guard h<=1,w<=1,w*Double(width)>=5,h*Double(rows)>=5 else{continue}
            let stepX=max(0.022,w/9),stepY=max(0.022,h/9)
            for y in stride(from:h/2,through:1-h/2,by:stepY) {
                for x in stride(from:w/2,through:1-w/2,by:stepX) {
                    var sum=0.0
                    for t in points {
                        let col=min(width-1,max(0,Int((x+w*t.x)*Double(width))))
                        let row=min(rows-1,max(0,Int((y+h*t.y)*Double(rows))))
                        let c=rgb[row*width+col]
                        sum+=abs(Double(c.x)-t.r)+abs(Double(c.y)-t.g)+abs(Double(c.z)-t.b)
                        if sum>Double(points.count*3)*26{break}
                    }
                    let score=sum/Double(points.count*3)
                    if score<=26 {matches.append((score,TargetBox(x:x,y:y,w:w,h:h)))}
                }
            }
        }
        guard let best=matches.min(by:{$0.0<$1.0}) else{return nil}
        guard !matches.contains(where:{ $0.0-best.0<4 && (abs($0.1.x-best.1.x)>best.1.w*0.48 || abs($0.1.y-best.1.y)>best.1.h*0.48) })else{return nil}
        return best.1
    }
}
