import UIKit
import ARKit
import SceneKit

// Local renderer: optional sparse samples are used only for matching, never for research.
@main final class HowMuchApp: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    private let controller = PriceScene()
    func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let w = UIWindow(frame: UIScreen.main.bounds); w.rootViewController = controller
        window = w; w.makeKeyAndVisible()
        if let url = options?[.url] as? URL { _ = controller.accept(url) }
        return true
    }
    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool { controller.accept(url) }
    func applicationWillResignActive(_ application: UIApplication) { controller.suspend(); controller.scene.session.pause() }
    func applicationDidBecomeActive(_ application: UIApplication) { controller.resume() }
}

final class PriceScene: UIViewController, ARSCNViewDelegate {
    let scene = ARSCNView()
    private let guide = UILabel()
    private var card: (String, String)?
    private var pinned: ARAnchor?
    private var hasTracking = false
    private var sessionRunning=false,interrupted=false
    private var signature: TargetSignature?
    private let modeButton = UIButton(type:.system)
    private var autoMode=false, detected=false, working=false
    private var revision=0
    private var measured:TargetLocation?, placed:TargetLocation?
    private var streak=0
    private var lastFrame:TimeInterval=0
    private let matching=DispatchQueue(label:"howmuch.object-match",qos:.userInitiated)
    private var timer:Timer?
    private let placeHint = "상품 옆의 바닥이나 테이블을 탭하세요."
    override func viewDidLoad() {
        super.viewDidLoad(); view.backgroundColor = .black; view.addSubview(scene); scene.frame = view.bounds
        scene.autoresizingMask = [.flexibleWidth, .flexibleHeight]; scene.delegate = self
        scene.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(place(_:))))
        guide.text = "HowMuch 웹에서 상품을 조회한 후 공간 가격표를 여세요."
        guide.numberOfLines = 0; guide.textColor = .white; guide.backgroundColor = UIColor.black.withAlphaComponent(0.72)
        guide.textAlignment = .center; guide.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(guide)
        let credit = UIButton(type: .system); credit.setTitle("HowMuch by NomaDamas MinXing · Source", for: .normal)
        modeButton.setTitle("이 상품 자동 추적",for:.normal);modeButton.backgroundColor = .black
        modeButton.addTarget(self, action:#selector(changeMode),for:.touchUpInside)
        modeButton.translatesAutoresizingMaskIntoConstraints=false;modeButton.isHidden=true;view.addSubview(modeButton)
        modeButton.centerXAnchor.constraint(equalTo:view.centerXAnchor).isActive=true
        modeButton.topAnchor.constraint(equalTo:guide.bottomAnchor,constant:4).isActive=true
        credit.backgroundColor = .black; credit.addTarget(self, action: #selector(source), for: .touchUpInside)
        credit.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(credit)
        NSLayoutConstraint.activate([guide.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),guide.leadingAnchor.constraint(equalTo:view.leadingAnchor), guide.trailingAnchor.constraint(equalTo:view.trailingAnchor),credit.centerXAnchor.constraint(equalTo:view.centerXAnchor),credit.bottomAnchor.constraint(equalTo:view.safeAreaLayoutGuide.bottomAnchor)])
    }
    @objc private func source(){UIApplication.shared.open(URL(string:"https://github.com/NomaDamas/HowMuch")!)}
    func accept(_ url: URL) -> Bool {
        guard url.absoluteString.utf8.count<=12000,let c = URLComponents(url:url,resolvingAgainstBaseURL:false), c.scheme=="howmuch-ar", c.host=="place",
              let q=c.queryItems, let name=q.first(where:{$0.name=="name"})?.value, let price=q.first(where:{$0.name=="label"})?.value,
              !name.isEmpty, !price.isEmpty, name.count<=120, price.count<=120 else {return false}
        loadViewIfNeeded();disableAuto();clear();card=(name,price)
        signature=q.first(where:{$0.name=="sig"})?.value.flatMap(TargetSignature.init)
        modeButton.isHidden=signature==nil
        if signature != nil { beginAutomatic() } else { guide.text=placeHint }
        return true
    }
    func resume(){
        guard !interrupted,!sessionRunning,UIApplication.shared.applicationState == .active else{return}
        guard ARWorldTrackingConfiguration.isSupported else {guide.text="이 기기는 공간 추적을 지원하지 않습니다."; return}
        sessionRunning=true;hasTracking=false;revision+=1;lastFrame=scene.session.currentFrame?.timestamp ?? 0
        let config=ARWorldTrackingConfiguration(); config.planeDetection=[.horizontal,.vertical]
        if ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth){config.frameSemantics.insert(.sceneDepth)}
        scene.session.run(config)
        if timer==nil{timer=Timer.scheduledTimer(withTimeInterval:0.24,repeats:true){[weak self] _ in self?.inspectFrame()}}
    }
    func suspend(){
        sessionRunning=false;hasTracking=false;revision+=1;timer?.invalidate();timer=nil
        detected=false;measured=nil;placed=nil;streak=0;clear()
    }
    deinit{timer?.invalidate()}
    private func disableAuto(){revision+=1;autoMode=false;detected=false;streak=0;placed=nil;measured=nil;modeButton.setTitle("이 상품 자동 추적",for:.normal)}
    @objc private func changeMode(){
        guard signature != nil else{return}
        if autoMode{disableAuto();clear();guide.text=placeHint;return}
        beginAutomatic()
    }
    private func beginAutomatic(){
        clear();autoMode=true;revision+=1;guide.text="상품을 비춰 주세요. 영상과 공간 깊이를 함께 확인합니다."
        modeButton.setTitle("수동 표면 배치로 전환",for:.normal)
    }
    private func inspectFrame(){
        guard sessionRunning,autoMode,!working,UIApplication.shared.applicationState == .active,
              let signature,let orientation=view.window?.windowScene?.interfaceOrientation,orientation != .unknown,
              let f=scene.session.currentFrame,f.timestamp>lastFrame,case .normal=f.camera.trackingState else{return}
        hasTracking=true
        lastFrame=f.timestamp;working=true;let job=revision
        matching.async{
            let found=TargetWorld.locate(f,signature,orientation)
            DispatchQueue.main.async{[weak self] in
                guard let self else{return};self.working=false
                guard self.revision==job,self.sessionRunning,self.hasTracking,self.autoMode, UIApplication.shared.applicationState == .active,
                      self.view.window?.windowScene?.interfaceOrientation==orientation,
                      let current=self.scene.session.currentFrame, case .normal=current.camera.trackingState else{return}
                self.updateTarget(found)
            }
        }
    }
    private func updateTarget(_ target:TargetLocation?){
        guard let t=target else{
            detected=false;streak=0;measured=nil
            if let pinned{scene.node(for:pinned)?.isHidden=true}
            guide.text="상품 또는 신뢰할 깊이를 찾는 중 · 수동 배치 가능";return
        }
        let stable=measured.map{simd_distance($0.center,t.center)<0.065} ?? false
        streak=stable ? streak+1:1;measured=t
        if !stable{detected=false;if let pinned{scene.node(for:pinned)?.isHidden=true}}
        guard streak>=2 else{return}
        detected=true
        if let p=placed,let pinned,simd_distance(p.center,t.center)<0.055 {
            if let node=scene.node(for:pinned){
                node.childNode(withName:"priceLabel",recursively:false)?.simdWorldPosition=node.simdWorldPosition+labelOffset(t)
                node.isHidden=false
            }
            guide.text="상품 위치 확인 · 자동 추적";return
        }
        clear();var m=matrix_identity_float4x4;m.columns.3=SIMD4(t.center,1)
        let a=ARAnchor(name:"HowMuchProduct",transform:m);pinned=a;placed=t;scene.session.add(anchor:a)
        guide.text="확인된 상품 옆에 고정했습니다."
    }
    private func clear(){if let old=pinned {scene.session.remove(anchor:old)}; pinned=nil}
    private func labelOffset(_ target:TargetLocation?)->SIMD3<Float>{
        let alongside=target.map{$0.card-$0.center} ?? .zero
        return alongside+SIMD3<Float>(0,0.065,0)
    }
    @objc private func place(_ gesture:UITapGestureRecognizer) {
        guard !autoMode,sessionRunning else{return}
        guard card != nil, hasTracking,
              let query=scene.raycastQuery(from:gesture.location(in:scene), allowing:.existingPlaneGeometry, alignment:.any),
              let hit=scene.session.raycast(query).first else { guide.text="기기를 천천히 움직여 실제 표면을 확인하세요.";return}
        disableAuto();clear(); let a=ARAnchor(name:"HowMuch",transform:hit.worldTransform);pinned=a;scene.session.add(anchor:a);guide.text="이 위치에 고정했습니다. 다시 탭하면 옮깁니다."
    }
    func renderer(_ renderer:SCNSceneRenderer, didAdd node:SCNNode, for anchor:ARAnchor) {
        DispatchQueue.main.async { [weak self] in
            guard let self=self, self.pinned?.identifier==anchor.identifier, let (title,price)=self.card else{return}
            let texture=UIGraphicsImageRenderer(size:CGSize(width:720,height:270)).image { _ in
                UIColor(red:0.05,green:0.10,blue:0.12,alpha:0.82).setFill();UIBezierPath(roundedRect:CGRect(x:0,y:0,width:720,height:270),cornerRadius:32).fill()
                let p=NSMutableParagraphStyle();p.lineBreakMode = .byTruncatingTail
                (title as NSString).draw(in:CGRect(x:34,y:28,width:652,height:84),withAttributes:[.font:UIFont.boldSystemFont(ofSize:46),.foregroundColor:UIColor.white,.paragraphStyle:p])
                (price as NSString).draw(in:CGRect(x:34,y:126,width:652,height:118),withAttributes:[.font:UIFont.systemFont(ofSize:42),.foregroundColor:UIColor.systemGreen,.paragraphStyle:p])
            }
            let plane=SCNPlane(width:0.19,height:0.071);plane.firstMaterial?.diffuse.contents=texture;plane.firstMaterial?.lightingModel = .constant;plane.firstMaterial?.isDoubleSided=true
            let label=SCNNode(geometry:plane);label.name="priceLabel";node.addChildNode(label)
            label.simdWorldPosition=node.simdWorldPosition+self.labelOffset(self.autoMode ? self.measured:nil);label.constraints=[SCNBillboardConstraint()]
            node.isHidden = !self.hasTracking || (self.autoMode && !self.detected)
        }
    }
    func session(_ session:ARSession, cameraDidChangeTrackingState camera:ARCamera) {
        let ok:Bool; if case .normal=camera.trackingState {ok=true}else{ok=false}
        DispatchQueue.main.async { guard self.sessionRunning else{return};self.hasTracking=ok;if !ok{self.revision+=1;self.detected=false;self.measured=nil;self.streak=0}; if let a=self.pinned { self.scene.node(for:a)?.isHidden = !ok || (self.autoMode && !self.detected) } }
    }
    func sessionWasInterrupted(_ session:ARSession) {DispatchQueue.main.async{self.interrupted=true;self.suspend();self.guide.text="공간 추적이 중단되었습니다."}}
    func sessionInterruptionEnded(_ session:ARSession) {DispatchQueue.main.async{self.interrupted=false;self.resume()}}
    func session(_ session: ARSession, didFailWithError error: Error){DispatchQueue.main.async{self.suspend();self.guide.text=error.localizedDescription}}
}
