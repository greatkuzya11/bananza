import UIKit
import WebKit
import AVFoundation
import SafariServices

@MainActor final class BrowserController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandlerWithReply, WKDownloadDelegate {
    let store: SessionStore
    let push: PushCoordinator
    let calls: CallCoordinator
    private(set) var webView: WKWebView!
    private var sessionRevision = 0
    private var pendingChatID: Int?
    private var restoredSession = false
    private var errorLabel = UILabel()
    private var downloadFiles: [ObjectIdentifier: URL] = [:]

    init(store: SessionStore, push: PushCoordinator, calls: CallCoordinator) {
        self.store = store; self.push = push; self.calls = calls
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
    override func viewDidLoad() {
        super.viewDidLoad(); title = "BananZa"; view.backgroundColor = .systemBackground
        navigationItem.leftBarButtonItem = UIBarButtonItem(image: UIImage(systemName: "chevron.left"), style: .plain, target: self, action: #selector(back))
        navigationItem.leftBarButtonItem?.accessibilityLabel = L("back")
        navigationItem.rightBarButtonItem = UIBarButtonItem(image: UIImage(systemName: "ellipsis.circle"), style: .plain, target: self, action: #selector(menu))
        navigationItem.rightBarButtonItem?.accessibilityLabel = L("settings")
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default(); config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.userContentController.addScriptMessageHandler(self, contentWorld: .page, name: "bananza")
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self; webView.uiDelegate = self; webView.allowsBackForwardNavigationGestures = true
        webView.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(webView)
        NSLayoutConstraint.activate([webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor), webView.leadingAnchor.constraint(equalTo: view.leadingAnchor), webView.trailingAnchor.constraint(equalTo: view.trailingAnchor)])
        errorLabel.numberOfLines = 0; errorLabel.textAlignment = .center; errorLabel.isHidden = true
        errorLabel.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(errorLabel)
        NSLayoutConstraint.activate([errorLabel.centerYAnchor.constraint(equalTo: view.centerYAnchor), errorLabel.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24), errorLabel.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24)])
        if store.server != nil { loadServer() }
    }
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        if store.server == nil && presentedViewController == nil { chooseServer() }
    }
    private func installScripts(restore: Bool) {
        let content = webView.configuration.userContentController
        content.removeAllUserScripts()
        guard let server = store.server,
              let url = Bundle.main.url(forResource: "native-bootstrap", withExtension: "js"),
              let bootstrap = try? String(contentsOf: url, encoding: .utf8) else { return }
        let origin = Self.json(server.absoluteString)
        var source = "window.__bananzaTrustedOrigin = \(origin);\n"
        if restore, let account = store.session, account.server == server {
            source += "if(location.origin === \(origin) && !localStorage.getItem('token')) localStorage.setItem('token', \(Self.json(account.token)));\n"
        }
        content.addUserScript(WKUserScript(source: source + bootstrap, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }
    func loadServer() {
        guard let server = store.server else { return }
        errorLabel.isHidden = true
        installScripts(restore: !restoredSession); restoredSession = true
        webView.load(URLRequest(url: server))
    }
    @objc private func back() { if webView.canGoBack { webView.goBack() } }
    @objc private func menu() {
        let alert = UIAlertController(title: "BananZa", message: nil, preferredStyle: .actionSheet)
        alert.addAction(UIAlertAction(title: L("reload"), style: .default) { [weak self] _ in self?.loadServer() })
        alert.addAction(UIAlertAction(title: L("server"), style: .default) { [weak self] _ in self?.chooseServer() })
        alert.addAction(UIAlertAction(title: L("notifications"), style: .default) { [weak self] _ in
            Task { do { _ = try await self?.push.enable() } catch { self?.showError(error) } }
        })
        if calls.callID != nil { alert.addAction(UIAlertAction(title: L("return_call"), style: .default) { [weak self] _ in self?.calls.show() }) }
        alert.addAction(UIAlertAction(title: L("logout"), style: .destructive) { [weak self] _ in
            Task { do { try await self?.clearAccount(); self?.loadServer() } catch { self?.showError(error) } }
        })
        alert.addAction(UIAlertAction(title: L("cancel"), style: .cancel))
        alert.popoverPresentationController?.barButtonItem = navigationItem.rightBarButtonItem
        present(alert, animated: true)
    }
    private func chooseServer() {
        let alert = UIAlertController(title: L("server"), message: L("server_help"), preferredStyle: .alert)
        alert.addTextField { field in
            field.text = self.store.server?.absoluteString; field.placeholder = "https://chat.example.com"
            field.keyboardType = .URL; field.autocapitalizationType = .none; field.autocorrectionType = .no
        }
        alert.addAction(UIAlertAction(title: L("connect"), style: .default) { [weak self, weak alert] _ in
            guard let self else { return }
            guard let url = ServerAddress.normalize(alert?.textFields?.first?.text ?? "") else { self.showError(AppError.message(L("invalid_server"))); return }
            Task {
                do {
                    if self.store.server != url { try await self.clearAccount(); self.store.server = url }
                    self.loadServer()
                } catch { self.showError(error) }
            }
        })
        if store.server != nil { alert.addAction(UIAlertAction(title: L("cancel"), style: .cancel)) }
        present(alert, animated: true)
    }
    private func clearAccount() async throws {
        sessionRevision += 1
        await calls.finish(sendLeave: true)
        try push.sessionWillChange(); try store.set(nil)
        pendingChatID = nil
        webView.stopLoading()
        await webView.configuration.websiteDataStore.removeData(ofTypes: WKWebsiteDataStore.allWebsiteDataTypes(), modifiedSince: .distantPast)
        installScripts(restore: false)
        Task { try? await push.synchronize() }
    }
    func openChat(_ id: Int) {
        pendingChatID = id
        if webView != nil { deliverPendingChat() }
    }
    private func deliverPendingChat() {
        guard let id = pendingChatID else { return }
        webView.evaluateJavaScript("Boolean(window.BananzaAppBridge?.getCurrentUser?.())") { [weak self] ready, _ in
            guard let self, ready as? Bool == true, self.pendingChatID == id else { return }
            self.pendingChatID = nil; self.emit("bananza:ios-open-chat", ["chatId": id])
        }
    }
    func emit(_ name: String, _ payload: [String: Any]) {
        guard webView != nil, ServerAddress.matches(webView.url, store.server) else { return }
        webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent(\(Self.json(name)), {detail: \(Self.json(payload))}));", completionHandler: nil)
    }
    static func json(_ value: Any) -> String {
        guard let data = try? JSONSerialization.data(withJSONObject: value, options: [.fragmentsAllowed, .sortedKeys]), let string = String(data: data, encoding: .utf8) else { return "null" }
        return string
    }
    func showError(_ error: Error) {
        let alert = UIAlertController(title: L("error"), message: error.localizedDescription, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: L("ok"), style: .default))
        (presentedViewController ?? self).present(alert, animated: true)
    }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard message.frameInfo.isMainFrame, ServerAddress.matches(message.frameInfo.request.url, store.server),
              ServerAddress.matches(webView.url, store.server), let body = message.body as? [String: Any],
              body["version"] as? Int == 1, let type = body["type"] as? String else {
            replyHandler(nil, L("untrusted_request")); return
        }
        let payload = body["payload"] as? [String: Any] ?? [:]
        Task {
            do { replyHandler(try await handle(type, payload), nil) }
            catch { replyHandler(nil, error.localizedDescription) }
        }
    }
    private func handle(_ type: String, _ payload: [String: Any]) async throws -> Any {
        switch type {
        case "session":
            let token = payload["token"] as? String ?? ""
            push.currentChatID = payload["chatId"] as? Int ?? 0; push.pageVisible = payload["visible"] as? Bool ?? false
            push.language = payload["language"] as? String == "en" ? "en" : "ru"
            if token != (store.session?.token ?? "") {
                sessionRevision += 1; let revision = sessionRevision
                if token.isEmpty {
                    pendingChatID = nil
                    await calls.finish(sendLeave: true); try push.sessionWillChange(); try store.set(nil)
                } else if let server = store.server {
                    var candidate = AccountSession(server: server, token: token, userID: 0)
                    let data = try await APIClient.request(candidate, "/api/auth/me")
                    guard revision == sessionRevision, server == store.server else { return [:] }
                    guard let user = data["user"] as? [String: Any], let id = user["id"] as? Int, id > 0 else { throw AppError.message(L("session_expired")) }
                    candidate.userID = id
                    if let previous = store.session, previous.userID != id { pendingChatID = nil; await calls.finish(sendLeave: true); try push.sessionWillChange() }
                    try store.set(candidate)
                }
                installScripts(restore: false)
            }
            deliverPendingChat()
            try await push.synchronize()
            return [:]
        case "notification_status": return await push.status()
        case "notifications_enable": return try await push.enable()
        case "notifications_disable": try await push.disable(); return [:]
        case "screen_rotation_preference":
            UserDefaults.standard.set(payload["allowed"] as? Bool ?? true, forKey: "rotationAllowed")
            navigationController?.setNeedsUpdateOfSupportedInterfaceOrientations(); setNeedsUpdateOfSupportedInterfaceOrientations()
            return [:]
        case "mobile_font_size":
            // The shared web UI owns the font scale; avoid double-scaling it in WKWebView.
            return [:]
        case "media_action":
            guard let account = store.session else { throw AppError.message(L("session_expired")) }
            try await MediaActions.perform(payload, account: account, presenter: self); return [:]
        case "call_join": try await calls.start(payload); return [:]
        case "call_event": await calls.handleEvent(payload); return [:]
        case "call_show": calls.show(); return [:]
        case "call_leave": await calls.finish(sendLeave: true, endForEveryone: payload["endForEveryone"] as? Bool ?? false); return [:]
        case "call_microphone_track": return ["trackId": calls.microphoneTrackID]
        default: throw AppError.message(L("untrusted_request"))
        }
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if navigationAction.shouldPerformDownload || url.scheme == "blob" {
            if ServerAddress.matches(navigationAction.sourceFrame.request.url, store.server),
               (ServerAddress.matches(url, store.server) || url.absoluteString.hasPrefix("blob:\(store.server?.absoluteString ?? "__invalid__")/")) {
                decisionHandler(.download)
            } else { decisionHandler(.cancel) }
            return
        }
        if ServerAddress.matches(url, store.server) { decisionHandler(.allow); return }
        if url.scheme == "blob" && navigationAction.targetFrame?.isMainFrame != true { decisionHandler(.allow); return }
        decisionHandler(.cancel)
        if navigationAction.navigationType == .linkActivated, ["https", "http", "mailto", "tel"].contains(url.scheme ?? "") { UIApplication.shared.open(url) }
    }
    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        if !response.canShowMIMEType, let url = response.response.url, let account = store.session {
            decisionHandler(.cancel)
            Task { do { try await MediaActions.perform(["url": url.absoluteString, "action": "share-media", "filename": response.response.suggestedFilename ?? "attachment"], account: account, presenter: self) } catch { showError(error) } }
        } else { decisionHandler(.allow) }
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { errorLabel.isHidden = true; installScripts(restore: false); deliverPendingChat() }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let name = URL(fileURLWithPath: suggestedFilename).lastPathComponent
            let file = directory.appendingPathComponent(name.isEmpty || name == "." || name == ".." ? "attachment" : String(name.prefix(180)))
            downloadFiles[ObjectIdentifier(download)] = file; completionHandler(file)
        } catch { completionHandler(nil); showError(error) }
    }
    func downloadDidFinish(_ download: WKDownload) {
        guard let file = downloadFiles.removeValue(forKey: ObjectIdentifier(download)) else { return }
        let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
        sheet.popoverPresentationController?.sourceView = view
        sheet.completionWithItemsHandler = { _, _, _, _ in try? FileManager.default.removeItem(at: file.deletingLastPathComponent()) }
        present(sheet, animated: true)
    }
    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        if let file = downloadFiles.removeValue(forKey: ObjectIdentifier(download)) { try? FileManager.default.removeItem(at: file.deletingLastPathComponent()) }
        showError(error)
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code == NSURLErrorCancelled { return }
        errorLabel.text = L("connection_failed"); errorLabel.isHidden = false
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { loadServer() }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            if ServerAddress.matches(url, store.server) { webView.load(navigationAction.request) }
            else if ["https", "http"].contains(url.scheme ?? "") { UIApplication.shared.open(url) }
        }
        return nil
    }
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        guard ServerAddress.matches(frame.request.url, store.server), frame.isMainFrame else { decisionHandler(.deny); return }
        Task {
            let audio = type == .camera ? true : await AVCaptureDevice.requestAccess(for: .audio)
            let video = type == .microphone ? true : await AVCaptureDevice.requestAccess(for: .video)
            decisionHandler(audio && video ? .grant : .deny)
        }
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = UIAlertController(title: "BananZa", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: L("ok"), style: .default) { _ in completionHandler() }); present(alert, animated: true)
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = UIAlertController(title: "BananZa", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: L("cancel"), style: .cancel) { _ in completionHandler(false) })
        alert.addAction(UIAlertAction(title: L("ok"), style: .default) { _ in completionHandler(true) }); present(alert, animated: true)
    }
    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let alert = UIAlertController(title: "BananZa", message: prompt, preferredStyle: .alert)
        alert.addTextField { $0.text = defaultText }
        alert.addAction(UIAlertAction(title: L("cancel"), style: .cancel) { _ in completionHandler(nil) })
        alert.addAction(UIAlertAction(title: L("ok"), style: .default) { [weak alert] _ in completionHandler(alert?.textFields?.first?.text) }); present(alert, animated: true)
    }
}
