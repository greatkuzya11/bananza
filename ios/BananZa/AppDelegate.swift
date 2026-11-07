import UIKit
import UserNotifications

@main @MainActor final class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    let store = SessionStore()
    lazy var push = PushCoordinator(store: store)
    lazy var calls = CallCoordinator(store: store)
    lazy var browser = BrowserController(store: store, push: push, calls: calls)

    func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        let window = UIWindow(frame: UIScreen.main.bounds)
        window.rootViewController = UINavigationController(rootViewController: browser)
        self.window = window; window.makeKeyAndVisible()
        push.openChat = { [weak self] id in self?.browser.openChat(id) }
        calls.browser = browser
        calls.startPushRegistry { [weak self] token in
            self?.push.voipToken = token
            Task { try? await self?.push.synchronize() }
        }
        UNUserNotificationCenter.current().delegate = push
        if push.enabled { application.registerForRemoteNotifications() }
        return true
    }
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        push.pushToken = deviceToken.map { String(format: "%02x", $0) }.joined()
        Task { do { try await push.synchronize() } catch { push.lastError = error.localizedDescription } }
    }
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        push.lastError = error.localizedDescription
    }
    func applicationDidBecomeActive(_ application: UIApplication) {
        Task { try? await push.synchronize(); await calls.reconcile() }
        browser.emit("bananza:ios-resume", [:])
    }
    func application(_ application: UIApplication, supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
        UserDefaults.standard.object(forKey: "rotationAllowed") as? Bool == false ? .portrait : .allButUpsideDown
    }
}
