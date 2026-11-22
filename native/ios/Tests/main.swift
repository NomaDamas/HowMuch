import Foundation
func encode(_ points:[[Double]],version:Int=1)->String{
    let obj:[String:Any]=["v":version,"aspect":1.0,"height":0.4,"pts":points]
    return (try! JSONSerialization.data(withJSONObject:obj)).base64EncodedString().replacingOccurrences(of:"+",with:"-").replacingOccurrences(of:"/",with:"_").replacingOccurrences(of:"=",with:"")
}
let taps:[[Double]]=([0,1,2,3,4].flatMap { j in (0..<5).map{i in
    let v=Double((i*43+j*59)%236+10)
    return [(Double(i)-2)*0.16,(Double(j)-2)*0.16,v,255-v,Double((i*29+j*31)%255)]
} })
precondition(TargetSignature("bad%token")==nil)
precondition(TargetSignature(encode(taps,version:2))==nil)
precondition(TargetSignature(encode(Array(repeating:[0,0,128,128,128],count:30)))==nil)
let sig=TargetSignature(encode(taps))!
var rgb=[SIMD3<UInt8>](repeating:SIMD3(20,20,20),count:10000)
func stamp(_ centerX:Double){
  for t in taps{
    let cx=Int((centerX+t[0]*0.4)*100),cy=Int((0.5+t[1]*0.4)*100)
    for y in cy-2...cy+2 {for x in cx-2...cx+2 {rgb[y*100+x]=SIMD3(UInt8(t[2]),UInt8(t[3]),UInt8(t[4]))}}
  }
}
precondition(sig.match(rgb,width:100,height:100)==nil)
stamp(0.24)
let match=sig.match(rgb,width:100,height:100)!
precondition(abs(match.x-0.24)<0.04 && abs(match.y-0.5)<0.04)
stamp(0.73)
precondition(sig.match(rgb,width:100,height:100)==nil)
print("PASS: bounded handoff parser, low texture rejection, translated target match, duplicate-target abstention")
