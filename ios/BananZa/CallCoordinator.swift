import UIKit
import CallKit
import PushKit
import AVFoundation
import LiveKit

// Both system delegates are explicitly registered on the main queue below.
@MainActor final class CallCoordinator: NSObject, @preconcurrency CXProviderDelegate, @preconcurrency PKPushRegistryDelegate, RoomDelegate {
    let store: SessionStore
    weak var browser: BrowserController?
    let room = Room(roomOptions: RoomOptions(adaptiveStream: true, dynacast: true))
    private let controller = CXCallController()
    private let provider: CXProvider
    private var registry: PKPushRegistry?
    private var onToken: ((String?) -> Void)?
    private var uuid: UUID?
    private(set) var call: [String: Any] = [:]
    private var account: AccountSession?
    private(set) var connected = false
    private var joining = false
    private var finishing = false
    private var outgoing = false
    private var desiredCamera = false
    private var desiredMicrophone = true
    private var socket: URLSessionWebSocketTask?
    private var socketTask: Task<Void, Never>?
    private var ringTimeout: Task<Void, Never>?
    private var screen: CallViewController?
    private var aiTrackNotified = ""
    var callID: Int? { call["id"] as? Int }
    var microphoneTrackID: String { room.localParticipant.audioTracks.first(where: { $0.source == .microphone })?.sid.stringValue ?? "" }

    init(store: SessionStore) {
        self.store = store
        let config = CXProviderConfiguration()
        config.supportsVideo = true; config.maximumCallGroups = 1; config.maximumCallsPerCallGroup = 1
        config.supportedHandleTypes = [.generic]; config.includesCallsInRecents = true
        provider = CXProvider(configuration: config)
        super.init(); provider.setDelegate(self, queue: .main); room.add(delegate: self)
        AudioManager.shared.audioSession.isAutomaticConfigurationEnabled = false
        try? AudioManager.shared.setEngineAvailability(.none)
    }
    func startPushRegistry(_ onToken: @escaping (String?) -> Void) {
        self.onToken = onToken
        let registry = PKPushRegistry(queue: .main); registry.delegate = self; registry.desiredPushTypes = [.voIP]
        self.registry = registry
    }
    func pushRegistry(_ registry: PKPushRegistry, didUpdate pushCredentials: PKPushCredentials, for type: PKPushType) {
        onToken?(pushCredentials.token.map { String(format: "%02x", $0) }.joined())
    }
    func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) { onToken?(nil) }
    func pushRegistry(_ registry: PKPushRegistry, didReceiveIncomingPushWith payload: PKPushPayload, for type: PKPushType, completion: @escaping () -> Void) {
        let data = payload.dictionaryPayload
        let incomingUUID = (data["callUUID"] as? String).flatMap(UUID.init(uuidString:)) ?? UUID()
        let update = CXCallUpdate(); update.remoteHandle = CXHandle(type: .generic, value: data["title"] as? String ?? "BananZa")
        update.localizedCallerName = data["title"] as? String ?? "BananZa"; update.hasVideo = data["video"] as? Bool ?? false
        let id = data["callId"] as? Int ?? 0
        let valid = id > 0 && store.session != nil && (data["accountId"] as? Int) == store.session?.userID
            && UserDefaults.standard.bool(forKey: "notificationsEnabled")
        let busy = finishing || (uuid != nil && uuid != incomingUUID)
        let chatID = data["chatId"] as? Int ?? 0
        let title = data["title"] as? String ?? "BananZa"
        let hasVideo = update.hasVideo
        let incomingAccount = store.session
        // Always report promptly, even stale/duplicate/account-mismatched pushes. Finish invalid calls afterward.
        provider.reportNewIncomingCall(with: incomingUUID, update: update) { [weak self] error in
            completion()
            Task { @MainActor in
                guard let self else { return }
                if !valid || busy || self.finishing || self.store.session != incomingAccount || (self.uuid != nil && self.uuid != incomingUUID) {
                    if error == nil { self.provider.reportCall(with: incomingUUID, endedAt: Date(), reason: .failed) }
                    return
                }
                if self.uuid == incomingUUID { return }
                guard error == nil else { return }
                self.uuid = incomingUUID; self.account = self.store.session; self.outgoing = false
                self.call = ["id": id, "chat_id": chatID, "chat_name": title, "media_kind": hasVideo ? "video" : "voice"]
                self.desiredCamera = hasVideo; self.desiredMicrophone = true; self.beginSocket()
                self.ringTimeout = Task {
                    try? await Task.sleep(nanoseconds: 60_000_000_000)
                    guard !Task.isCancelled, self.uuid == incomingUUID, !self.connected, !self.joining else { return }
                    await self.finish(sendLeave: false, reason: .unanswered)
                }
                await self.reconcile()
            }
        }
    }
    func start(_ payload: [String: Any]) async throws {
        guard let next = payload["call"] as? [String: Any], let id = next["id"] as? Int, id > 0, let account = store.session else { throw AppError.message(L("session_expired")) }
        if callID == id, let uuid {
            if !connected && !joining { try await controller.request(CXTransaction(action: CXAnswerCallAction(call: uuid))) }
            show(); return
        }
        guard callID == nil, !joining, !finishing else { throw AppError.message(L("call_busy")) }
        guard await AVCaptureDevice.requestAccess(for: .audio) else { throw AppError.message(L("microphone_denied")) }
        desiredCamera = next["media_kind"] as? String != "voice" && payload["cameraEnabled"] as? Bool != false
        desiredMicrophone = payload["micEnabled"] as? Bool != false
        if desiredCamera { desiredCamera = await AVCaptureDevice.requestAccess(for: .video) }
        // Permission sheets suspend this task: an incoming call or logout may happen meanwhile.
        guard callID == nil, !joining, !finishing, store.session == account else { throw AppError.message(L("call_busy")) }
        self.account = account; call = next; uuid = UUID(); outgoing = true
        let action = CXStartCallAction(call: uuid!, handle: CXHandle(type: .generic, value: next["chat_name"] as? String ?? "BananZa"))
        action.isVideo = desiredCamera
        do { try await controller.request(CXTransaction(action: action)); show() }
        catch { await finish(sendLeave: false); throw error }
    }
    private func configureAudio() throws {
        try AVAudioSession.sharedInstance().setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetooth, .allowBluetoothA2DP])
    }
    private func connect() async throws {
        guard let id = callID, let expectedUUID = uuid, let account, !joining else { return }
        joining = true; defer { joining = false }
        try configureAudio()
        let data = try await APIClient.request(account, "/api/calls/\(id)/token", method: "POST", body: [:])
        guard uuid == expectedUUID, self.account == account else { return }
        guard let livekit = data["livekit"] as? [String: Any], let url = livekit["url"] as? String, URL(string: url)?.scheme == "wss",
              let token = livekit["token"] as? String else { throw AppError.message(L("call_unavailable")) }
        if let updated = data["call"] as? [String: Any] { call = updated }
        try await room.connect(url: url, token: token)
        guard uuid == expectedUUID else { await room.disconnect(); return }
        _ = try await room.localParticipant.setMicrophone(enabled: desiredMicrophone)
        guard uuid == expectedUUID else { await room.disconnect(); return }
        // A locked phone cannot show a camera prompt. Video starts when the app becomes active.
        if desiredCamera && UIApplication.shared.applicationState == .active { _ = try await room.localParticipant.setCamera(enabled: true) }
        let joined = try await APIClient.request(account, "/api/calls/\(id)/joined", method: "POST", body: [:])
        guard uuid == expectedUUID else { await room.disconnect(); return }
        if let updated = joined["call"] as? [String: Any] { call = updated }
        connected = true; ringTimeout?.cancel()
        if outgoing { provider.reportOutgoingCall(with: expectedUUID, connectedAt: Date()) }
        beginSocket(); await notifyAiTrack(); publishState(); show()
    }
    func show() {
        guard callID != nil, UIApplication.shared.applicationState == .active, let browser else { return }
        if let screen, screen.presentingViewController != nil { screen.render(); return }
        guard browser.presentedViewController == nil else { return }
        let screen = CallViewController(coordinator: self); self.screen = screen
        screen.modalPresentationStyle = .fullScreen; browser.present(screen, animated: true)
    }
    func minimize() { screen?.dismiss(animated: true) }
    func requestEnd(endForEveryone: Bool = false) async {
        if endForEveryone { await finish(sendLeave: true, endForEveryone: true); return }
        guard let uuid else { return }
        do { try await controller.request(CXTransaction(action: CXEndCallAction(call: uuid))) }
        catch { await finish(sendLeave: true) }
    }
    func finish(sendLeave: Bool, endForEveryone: Bool = false, reason: CXCallEndedReason = .remoteEnded) async {
        guard let oldUUID = uuid else { return }
        finishing = true; defer { finishing = false }
        let id = callID; let oldAccount = account; let wasConnected = connected
        uuid = nil; connected = false; call = [:]; account = nil; aiTrackNotified = ""
        ringTimeout?.cancel(); socketTask?.cancel(); socketTask = nil; socket?.cancel(with: .normalClosure, reason: nil); socket = nil
        provider.reportCall(with: oldUUID, endedAt: Date(), reason: reason)
        screen?.dismiss(animated: true); screen = nil; publishState()
        await room.disconnect(); try? AudioManager.shared.setEngineAvailability(.none)
        if sendLeave, let id, let oldAccount {
            let action = endForEveryone ? "end" : (wasConnected ? "leave" : "decline")
            _ = try? await APIClient.request(oldAccount, "/api/calls/\(id)/\(action)", method: "POST", body: [:])
        }
    }
    private func publishState() { browser?.emit("bananza:ios-call-state", ["call": call, "connected": connected, "trackId": microphoneTrackID]) }
    func handleEvent(_ event: [String: Any]) async {
        if event["type"] as? String == "call_settings_updated", let settings = event["settings"] as? [String: Any], settings["calls_enabled"] as? Bool == false {
            await finish(sendLeave: false); return
        }
        guard let next = event["call"] as? [String: Any], next["id"] as? Int == callID, callID != nil else { return }
        if event["type"] as? String == "call_ended" || next["status"] as? String != "active" { await finish(sendLeave: false); return }
        call.merge(next) { _, new in new }
        if !connected && !joining, let people = call["participants"] as? [[String: Any]],
           let own = people.first(where: { $0["user_id"] as? Int == account?.userID }), own["state"] as? String == "joined" {
            await finish(sendLeave: false, reason: .answeredElsewhere); return
        }
        await notifyAiTrack(); publishState(); screen?.render()
    }
    func reconcile() async {
        guard let account, let id = callID else { return }
        do {
            let data = try await APIClient.request(account, "/api/calls/active")
            guard callID == id else { return }
            if let active = (data["calls"] as? [[String: Any]])?.first(where: { $0["id"] as? Int == id }) {
                await handleEvent(["type": "call_updated", "call": active])
                if connected && desiredCamera && UIApplication.shared.applicationState == .active && !room.localParticipant.isCameraEnabled() {
                    _ = try? await room.localParticipant.setCamera(enabled: true)
                }
            } else { await finish(sendLeave: false) }
        } catch let error as APIClient.HTTPError where [401, 403, 404].contains(error.status) { await finish(sendLeave: false) }
        catch { /* Reconnect may recover; a transient network error is not a remote hangup. */ }
    }
    private func beginSocket() {
        guard socketTask == nil, let account else { return }
        socketTask = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled, self.account == account, self.callID != nil {
                var components = URLComponents(url: account.server, resolvingAgainstBaseURL: false)!
                components.scheme = "wss"; components.path = "/ws"; components.queryItems = [URLQueryItem(name: "token", value: account.token)]
                let task = APIClient.session.webSocketTask(with: components.url!); self.socket = task; task.resume()
                do {
                    while !Task.isCancelled {
                        let message = try await task.receive()
                        let data: Data
                        switch message { case .data(let bytes): data = bytes; case .string(let text): data = Data(text.utf8); @unknown default: continue }
                        if let event = try JSONSerialization.jsonObject(with: data) as? [String: Any] { await self.handleEvent(event) }
                    }
                } catch {}
                task.cancel(with: .goingAway, reason: nil)
                if self.socket === task { self.socket = nil }
                if Task.isCancelled { return }
                try? await Task.sleep(nanoseconds: 2_000_000_000); await self.reconcile()
            }
        }
    }
    func notifyAiTrack() async {
        guard connected, let id = callID, let account, (call["ai_notes"] as? [String: Any])?["status"] as? String == "recording" else { return }
        let track = microphoneTrackID
        guard !track.isEmpty, track != aiTrackNotified else { return }
        do {
            _ = try await APIClient.request(account, "/api/calls/\(id)/ai-notes/local-track", method: "POST", body: ["track_id": track])
            aiTrackNotified = track
        } catch { /* Retry on the next event or reconciliation. */ }
    }
    func toggleAiNotes() async throws {
        guard let id = callID, let account else { return }
        let recording = (call["ai_notes"] as? [String: Any])?["status"] as? String == "recording"
        let data = try await APIClient.request(account, "/api/calls/\(id)/ai-notes/\(recording ? "cancel" : "start")", method: "POST", body: [:])
        if let next = data["call"] as? [String: Any] { call = next }; aiTrackNotified = ""; await notifyAiTrack(); publishState()
    }
    func toggleMicrophone() async throws {
        guard let uuid else { return }
        try await controller.request(CXTransaction(action: CXSetMutedCallAction(call: uuid, muted: room.localParticipant.isMicrophoneEnabled())))
    }
    func toggleCamera() async throws {
        desiredCamera = !room.localParticipant.isCameraEnabled()
        _ = try await room.localParticipant.setCamera(enabled: desiredCamera)
    }
    func switchCamera() async throws {
        if let track = room.localParticipant.videoTracks.first(where: { $0.source == .camera })?.track as? LocalVideoTrack,
           let capturer = track.capturer as? CameraCapturer { _ = try await capturer.switchCameraPosition() }
    }
    func providerDidReset(_ provider: CXProvider) { Task { await finish(sendLeave: true) } }
    func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
        guard action.callUUID == uuid else { action.fail(); return }
        do { try configureAudio(); action.fulfill() } catch { action.fail(); return }
        provider.reportOutgoingCall(with: action.callUUID, startedConnectingAt: Date())
        Task { do { try await connect() } catch { browser?.showError(error); await finish(sendLeave: true, reason: .failed) } }
    }
    func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        guard action.callUUID == uuid else { action.fail(); return }
        do { try configureAudio(); action.fulfill() } catch { action.fail(); return }
        Task { do { try await connect() } catch { await finish(sendLeave: true, reason: .failed) } }
    }
    func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        guard action.callUUID == uuid else { action.fulfill(); return }
        action.fulfill(); Task { await finish(sendLeave: true) }
    }
    func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        guard action.callUUID == uuid else { action.fail(); return }
        Task { do { _ = try await room.localParticipant.setMicrophone(enabled: !action.isMuted); desiredMicrophone = !action.isMuted; action.fulfill() } catch { action.fail() } }
    }
    func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) { try? AudioManager.shared.setEngineAvailability(.default) }
    func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) { try? AudioManager.shared.setEngineAvailability(.none) }
    nonisolated func room(_ room: Room, didDisconnectWithError error: LiveKitError?) {
        Task { @MainActor [weak self] in if self?.connected == true { await self?.finish(sendLeave: true, reason: .failed) } }
    }
}
