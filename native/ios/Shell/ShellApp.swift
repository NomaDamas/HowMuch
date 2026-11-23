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

final class ShellController: UIViewController, WKNavigationDelegate, WKUIDelegate {
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
        c.allowsInlineMediaPlayback = true
        c.mediaTypesRequiringUserActionForPlayback = []
        web = WKWebView(frame: view.bounds, configuration: c)
        web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        web.navigationDelegate = self; web.uiDelegate = self
        web.isOpaque = false; web.backgroundColor = .black; web.scrollView.backgroundColor = .black
        web.scrollView.contentInsetAdjustmentBehavior = .never; web.scrollView.bounces = false
        if #available(iOS 16.4, *) { web.isInspectable = true }
        view.addSubview(web); load()
    }
    override func viewDidAppear(_ animated: Bool) { super.viewDidAppear(animated); becomeFirstResponder() }
    private func load() { web.load(URLRequest(url: serverURL, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 15)) }

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
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { askServer(error: error.localizedDescription) }
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
