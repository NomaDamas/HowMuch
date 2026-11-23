import UIKit
import WebKit

// HowMuch app shell: hosts the HowMuch web camera app (same code as the browser build) in a WKWebView so it can be
// installed, granted camera/motion permission once, and tested on a device. No keys live in the app; it only loads
// the URL of a HowMuch server (your Mac running `npm run demo:phone`, or a deployed instance).
@main final class ShellApp: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let w = UIWindow(frame: UIScreen.main.bounds); w.rootViewController = ShellController()
        window = w; w.makeKeyAndVisible(); return true
    }
}

final class ShellController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private var web: WKWebView!
    private let key = "howmuch.appURL"
    private var serverURL: URL {
        if let s = UserDefaults.standard.string(forKey: key), let u = URL(string: s) { return u }
        let d = Bundle.main.object(forInfoDictionaryKey: "HowMuchDefaultURL") as? String ?? "http://127.0.0.1:5173"
        return URL(string: d)!
    }
    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var canBecomeFirstResponder: Bool { true }

    override func viewDidLoad() {
        super.viewDidLoad(); view.backgroundColor = .black
        let c = WKWebViewConfiguration()
        c.applicationNameForUserAgent = "HowMuchApp"
        c.allowsInlineMediaPlayback = true
        c.mediaTypesRequiringUserActionForPlayback = []
        // Diagnostics: forward page errors and camera outcomes to the device log (visible with `devicectl --console`).
        let probe = """
(function(){var send=function(l,m){try{webkit.messageHandlers.log.postMessage(l+': '+String(m).slice(0,400))}catch(e){}};
['error','warn'].forEach(function(k){var o=console[k];console[k]=function(){send('console.'+k,[].slice.call(arguments).join(' '));o.apply(console,arguments)}});
addEventListener('error',function(e){send('error',e.message+' @'+e.filename+':'+e.lineno)});
addEventListener('unhandledrejection',function(e){send('rejection',e.reason&&e.reason.message||e.reason)});
var md=navigator.mediaDevices;if(md&&md.getUserMedia){var g=md.getUserMedia.bind(md);md.getUserMedia=function(c){send('camera','requesting');return g(c).then(function(s){send('camera','granted '+s.getVideoTracks().map(function(t){return t.label}).join(','));return s},function(e){send('camera','DENIED '+e.name+' '+e.message);throw e})}}
})();
"""
        c.userContentController.addUserScript(WKUserScript(source: probe, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        c.userContentController.add(self, name: "log")
        web = WKWebView(frame: view.bounds, configuration: c)
        web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        web.navigationDelegate = self; web.uiDelegate = self
        web.isOpaque = false; web.backgroundColor = .black; web.scrollView.backgroundColor = .black
        web.scrollView.contentInsetAdjustmentBehavior = .never; web.scrollView.bounces = false
        if #available(iOS 16.4, *) { web.isInspectable = true }
        view.addSubview(web); load()
    }
    override func viewDidAppear(_ animated: Bool) { super.viewDidAppear(animated); becomeFirstResponder() }
    private func load() { NSLog("HowMuch loading %@", serverURL.absoluteString); web.load(URLRequest(url: serverURL, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)) }

    // Shake the phone to change the server address.
    override func motionEnded(_ motion: UIEvent.EventSubtype, with event: UIEvent?) { if motion == .motionShake { askServer(error: nil) } }
    private func askServer(error: String?) {
        let a = UIAlertController(title: "HowMuch 서버 주소", message: (error.map { "연결 실패: \($0)\n\n" } ?? "") + "예: https://192.168.0.12:8443 (Mac에서 npm run demo:phone)", preferredStyle: .alert)
        a.addTextField { $0.text = self.serverURL.absoluteString; $0.keyboardType = .URL; $0.autocapitalizationType = .none; $0.autocorrectionType = .no }
        a.addAction(UIAlertAction(title: "저장 후 열기", style: .default) { _ in
            if let t = a.textFields?.first?.text?.trimmingCharacters(in: .whitespaces), let u = URL(string: t), ["http", "https"].contains(u.scheme ?? "") {
                UserDefaults.standard.set(t, forKey: self.key)
            }
            self.load()
        })
        a.addAction(UIAlertAction(title: "다시 시도", style: .default) { _ in self.load() })
        present(a, animated: true)
    }

    // Camera / microphone requests from the page: allow (the OS camera prompt still applies once).
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(origin.host == serverURL.host ? .grant : .deny)
    }
    // Local HowMuch servers use a private self-signed certificate: trust it for the configured host only.
    func webView(_ webView: WKWebView, didReceive challenge: URLAuthenticationChallenge, completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust, challenge.protectionSpace.host == serverURL.host, let trust = challenge.protectionSpace.serverTrust {
            completionHandler(.useCredential, URLCredential(trust: trust))
        } else { completionHandler(.performDefaultHandling, nil) }
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { NSLog("HowMuch load failed: %@", error.localizedDescription); askServer(error: error.localizedDescription) }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) { NSLog("HowMuch page %@", String(describing: message.body)) }
    private var autotested = false
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        NSLog("HowMuch loaded %@", webView.url?.absoluteString ?? "")
        // `-howmuch.autotest 1`: skip the star prompt once and report what the page shows (for remote verification).
        guard UserDefaults.standard.bool(forKey: "howmuch.autotest"), !autotested else { return }
        autotested = true
        webView.evaluateJavaScript("localStorage.setItem('howmuch-starred','1');location.reload();") { _, _ in }
        DispatchQueue.main.asyncAfter(deadline: .now() + 6) {
            webView.evaluateJavaScript("JSON.stringify({lang:document.documentElement.lang,brand:(document.querySelector('.brand')||{}).innerText,mode:[].map.call(document.querySelectorAll('nav button'),function(b){return b.innerText}),gate:!!document.querySelector('.stargate'),video:!!(document.querySelector('video')||{}).srcObject,w:innerWidth,h:innerHeight,secure:isSecureContext,gyro:typeof DeviceOrientationEvent,cam:!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia)})") { r, e in NSLog("HowMuch autotest %@ %@", String(describing: r), String(describing: e)) }
        }
    }
    // Source links open in the system browser.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let u = action.request.url { UIApplication.shared.open(u) }
        return nil
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let u = action.request.url, u.scheme == "howmuch-ar" { UIApplication.shared.open(u); decisionHandler(.cancel); return }
        decisionHandler(.allow)
    }
}
