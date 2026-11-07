import UIKit
import UserNotifications

@MainActor final class PushCoordinator: NSObject, UNUserNotificationCenterDelegate {
    let store: SessionStore
    var pushToken: String?
    var voipToken: String?
    var currentChatID = 0
    var pageVisible = false
    var language = "ru"
    var openChat: ((Int) -> Void)?
    var lastError = ""
    private var registration = ""
    private var synchronizing = false
    private var needsSync = false
    var enabled: Bool {
        get { UserDefaults.standard.bool(forKey: "notificationsEnabled") }
        set { UserDefaults.standard.set(newValue, forKey: "notificationsEnabled") }
    }
    init(store: SessionStore) { self.store = store; super.init() }
    func status() async -> [String: Any] {
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        let permission = settings.authorizationStatus == .denied ? "denied" :
            ([.authorized, .provisional, .ephemeral].contains(settings.authorizationStatus) ? "granted" : "default")
        return ["permission": permission, "subscribed": enabled && !registration.isEmpty && permission == "granted", "error": lastError]
    }
    func enable() async throws -> [String: Any] {
        let center = UNUserNotificationCenter.current()
        if await center.notificationSettings().authorizationStatus == .denied {
            if let url = URL(string: UIApplication.openSettingsURLString) { await UIApplication.shared.open(url) }
            return await status()
        }
        enabled = try await center.requestAuthorization(options: [.alert, .sound, .badge])
        if enabled {
            if let account = store.session {
                _ = try await APIClient.request(account, "/api/notification-settings", method: "PUT", body: ["push_enabled": true])
            }
            UIApplication.shared.registerForRemoteNotifications(); try await synchronize()
        }
        return await status()
    }
    func disable() async throws {
        enabled = false; registration = ""
        if let account = store.session { try store.queueRevocation(account) }
        try await flushRevocations()
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
    }
    func sessionWillChange() throws {
        registration = ""
        if let account = store.session { try store.queueRevocation(account) }
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
    }
    func flushRevocations() async throws {
        for item in store.pending {
            do {
                _ = try await APIClient.request(item.session, "/api/push/ios/devices", method: "DELETE", body: ["deviceId": item.deviceID])
                try store.removeRevocation(item)
            } catch let error as APIClient.HTTPError where [401, 403].contains(error.status) {
                // Expired sessions cannot receive native pushes on the server.
                try store.removeRevocation(item)
            }
        }
    }
    func synchronize() async throws {
        if synchronizing { needsSync = true; return }
        synchronizing = true
        defer {
            synchronizing = false
            if needsSync { needsSync = false; Task { try? await synchronize() } }
        }
        try await flushRevocations()
        guard enabled, let account = store.session, let token = pushToken else { return }
        let environment = (Bundle.main.object(forInfoDictionaryKey: "APNSEnvironment") as? String) == "development" ? "sandbox" : "production"
        let key = "\(account.server)|\(account.userID)|\(account.token)|\(token)|\(voipToken ?? "")|\(language)"
        guard key != registration else { return }
        let body: [String: Any] = ["deviceId": store.deviceID, "bundleId": Bundle.main.bundleIdentifier ?? "",
                                  "environment": environment, "pushToken": token, "voipToken": voipToken ?? "", "language": language]
        _ = try await APIClient.request(account, "/api/push/ios/devices", method: "POST", body: body)
        guard enabled, store.session == account else { needsSync = true; return }
        registration = key; lastError = ""
    }
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completion: @escaping (UNNotificationPresentationOptions) -> Void) {
        let data = notification.request.content.userInfo
        let accountID = data["accountId"] as? Int
        let chatID = data["chatId"] as? Int
        let forceShow = data["forceShow"] as? Bool == true
        Task { @MainActor in
            guard enabled, accountID == store.session?.userID else { completion([]); return }
            let visible = UIApplication.shared.applicationState == .active && pageVisible
            let suppress = visible && chatID == currentChatID && !forceShow
            // The visible web client already plays incoming sounds; avoid a second APNs sound.
            completion(suppress ? [] : (visible ? [.banner, .list] : [.banner, .list, .sound]))
        }
    }
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                withCompletionHandler completion: @escaping () -> Void) {
        let data = response.notification.request.content.userInfo
        let accountID = data["accountId"] as? Int
        let chatID = data["chatId"] as? Int
        Task { @MainActor in
            if accountID == store.session?.userID, let id = chatID, id > 0 { openChat?(id) }
            completion()
        }
    }
}
