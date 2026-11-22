import UIKit
import ARKit
import SceneKit

// A companion renderer, not another research provider. The handoff contains only display text.
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
    func applicationWillResignActive(_ application: UIApplication) { controller.scene.session.pause() }
    func applicationDidBecomeActive(_ application: UIApplication) { controller.resume() }
}

final class PriceScene: UIViewController, ARSCNViewDelegate {
    let scene = ARSCNView()
    private let guide = UILabel()
    private var card: (String, String)?
    private var pinned: ARAnchor?
    private var hasTracking = false
    private let placeHint = "상품 옆의 바닥이나 테이블을 탭하세요."
    override func viewDidLoad() {
        super.viewDidLoad(); view.backgroundColor = .black; view.addSubview(scene); scene.frame = view.bounds
        scene.autoresizingMask = [.flexibleWidth, .flexibleHeight]; scene.delegate = self
        scene.addGestureRecognizer(UITapGestureRecognizer(target: self, action: #selector(place(_:))))
        guide.text = "HowMuch 웹에서 상품을 조회한 후 공간 가격표를 여세요."
        guide.numberOfLines = 0; guide.textColor = .white; guide.backgroundColor = UIColor.black.withAlphaComponent(0.72)
        guide.textAlignment = .center; guide.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(guide)
        let credit = UIButton(type: .system); credit.setTitle("HowMuch by NomaDamas MinXing · Source", for: .normal)
        credit.backgroundColor = .black; credit.addTarget(self, action: #selector(source), for: .touchUpInside)
        credit.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(credit)
        NSLayoutConstraint.activate([guide.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),guide.leadingAnchor.constraint(equalTo:view.leadingAnchor), guide.trailingAnchor.constraint(equalTo:view.trailingAnchor),credit.centerXAnchor.constraint(equalTo:view.centerXAnchor),credit.bottomAnchor.constraint(equalTo:view.safeAreaLayoutGuide.bottomAnchor)])
    }
    @objc private func source(){UIApplication.shared.open(URL(string:"https://github.com/NomaDamas/HowMuch")!)}
    func accept(_ url: URL) -> Bool {
        guard let c = URLComponents(url:url,resolvingAgainstBaseURL:false), c.scheme=="howmuch-ar", c.host=="place",
              let q=c.queryItems, let name=q.first(where:{$0.name=="name"})?.value, let price=q.first(where:{$0.name=="label"})?.value,
              !name.isEmpty, !price.isEmpty, name.count<=120, price.count<=120 else {return false}
        loadViewIfNeeded(); clear(); card=(name,price); guide.text=placeHint; return true
    }
    func resume(){
        guard ARWorldTrackingConfiguration.isSupported else {guide.text="이 기기는 공간 추적을 지원하지 않습니다."; return}
        let config=ARWorldTrackingConfiguration(); config.planeDetection=[.horizontal,.vertical]
        scene.session.run(config)
    }
    private func clear(){if let old=pinned {scene.session.remove(anchor:old)}; pinned=nil}
    @objc private func place(_ gesture:UITapGestureRecognizer) {
        guard card != nil, hasTracking,
              let query=scene.raycastQuery(from:gesture.location(in:scene), allowing:.existingPlaneGeometry, alignment:.any),
              let hit=scene.session.raycast(query).first else { guide.text="기기를 천천히 움직여 실제 표면을 확인하세요.";return}
        clear(); let a=ARAnchor(name:"HowMuch",transform:hit.worldTransform);pinned=a;scene.session.add(anchor:a);guide.text="이 위치에 고정했습니다. 다시 탭하면 옮깁니다."
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
            let label=SCNNode(geometry:plane);node.addChildNode(label)
            label.simdWorldPosition=node.simdWorldPosition+SIMD3<Float>(0,0.065,0);label.constraints=[SCNBillboardConstraint()]
            node.isHidden = !self.hasTracking
        }
    }
    func session(_ session:ARSession, cameraDidChangeTrackingState camera:ARCamera) {
        let ok:Bool; if case .normal=camera.trackingState {ok=true}else{ok=false}
        DispatchQueue.main.async { self.hasTracking=ok; if let a=self.pinned { self.scene.node(for:a)?.isHidden = !ok } }
    }
    func sessionWasInterrupted(_ session:ARSession) {DispatchQueue.main.async{self.hasTracking=false; self.clear();self.guide.text="공간 추적이 중단되었습니다. 재개 후 다시 배치하세요."}}
    func sessionInterruptionEnded(_ session:ARSession) {DispatchQueue.main.async{self.resume()}}
    func session(_ session: ARSession, didFailWithError error: Error){DispatchQueue.main.async{self.clear();self.guide.text=error.localizedDescription}}
}
