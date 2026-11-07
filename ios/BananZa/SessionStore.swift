import Foundation
import Security

func L(_ key: String) -> String { NSLocalizedString(key, comment: "") }

enum AppError: LocalizedError {
    case message(String)
    var errorDescription: String? { if case .message(let text) = self { return text }; return nil }
}

enum ServerAddress {
    static func normalize(_ text: String) -> URL? {
        guard var parts = URLComponents(string: text.trimmingCharacters(in: .whitespacesAndNewlines)),
              parts.scheme?.lowercased() == "https", parts.host?.isEmpty == false,
              parts.user == nil, parts.password == nil, parts.query == nil, parts.fragment == nil,
              parts.path.isEmpty || parts.path == "/" else { return nil }
        parts.path = ""; parts.scheme = "https"; parts.host = parts.host?.lowercased()
        if parts.port == 443 { parts.port = nil }
        return parts.url
    }
    static func matches(_ candidate: URL?, _ server: URL?) -> Bool {
        guard let candidate, let server else { return false }
        return candidate.scheme == "https" && candidate.host?.lowercased() == server.host?.lowercased()
            && (candidate.port ?? 443) == (server.port ?? 443) && candidate.user == nil && candidate.password == nil
    }
}

struct AccountSession: Codable, Equatable {
    var server: URL
    var token: String
    var userID: Int
}
struct PendingRevocation: Codable, Equatable {
    var session: AccountSession
    var deviceID: String
}

@MainActor final class SessionStore {
    private let service = "app.bananza.session"
    private(set) var session: AccountSession?
    private(set) var pending: [PendingRevocation] = []
    var server: URL? {
        get { UserDefaults.standard.string(forKey: "server").flatMap(ServerAddress.normalize) }
        set { UserDefaults.standard.set(newValue?.absoluteString, forKey: "server") }
    }
    var deviceID: String {
        if let id = UserDefaults.standard.string(forKey: "deviceID") { return id }
        let id = UUID().uuidString.lowercased(); UserDefaults.standard.set(id, forKey: "deviceID"); return id
    }
    init() {
        if let data = read("session") { session = try? JSONDecoder().decode(AccountSession.self, from: data) }
        if let data = read("revocations") { pending = (try? JSONDecoder().decode([PendingRevocation].self, from: data)) ?? [] }
    }
    func set(_ value: AccountSession?) throws {
        try write("session", value.flatMap { try? JSONEncoder().encode($0) })
        session = value
    }
    func queueRevocation(_ value: AccountSession) throws {
        let item = PendingRevocation(session: value, deviceID: deviceID)
        if !pending.contains(item) { pending.append(item) }
        try write("revocations", try JSONEncoder().encode(pending))
    }
    func removeRevocation(_ value: PendingRevocation) throws {
        pending.removeAll { $0 == value }
        try write("revocations", try JSONEncoder().encode(pending))
    }
    private func query(_ key: String) -> [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: key]
    }
    private func read(_ key: String) -> Data? {
        var q = query(key); q[kSecReturnData as String] = true; q[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?; guard SecItemCopyMatching(q as CFDictionary, &result) == errSecSuccess else { return nil }
        return result as? Data
    }
    private func write(_ key: String, _ value: Data?) throws {
        let q = query(key)
        guard let value else { SecItemDelete(q as CFDictionary); return }
        let attributes: [String: Any] = [kSecValueData as String: value, kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        var status = SecItemUpdate(q as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound { status = SecItemAdd(q.merging(attributes) { _, new in new } as CFDictionary, nil) }
        guard status == errSecSuccess else { throw AppError.message(L("secure_storage_error")) }
    }
}
