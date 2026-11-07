import Foundation

// Refuse redirects instead of leaking bearer tokens or silently changing the server.
final class NoRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}

enum APIClient {
    static let session = URLSession(configuration: .ephemeral, delegate: NoRedirects(), delegateQueue: nil)
    static func request(_ account: AccountSession, _ path: String, method: String = "GET", body: [String: Any]? = nil) async throws -> [String: Any] {
        guard path.hasPrefix("/api/"), let url = URL(string: path, relativeTo: account.server)?.absoluteURL,
              ServerAddress.matches(url, account.server) else { throw AppError.message(L("invalid_server")) }
        var request = URLRequest(url: url); request.httpMethod = method; request.timeoutInterval = 20
        request.setValue("Bearer \(account.token)", forHTTPHeaderField: "Authorization")
        if let body { request.httpBody = try JSONSerialization.data(withJSONObject: body); request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        let (data, response) = try await session.data(for: request)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else { throw HTTPError(status: status) }
        return (try JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? [:]
    }
    struct HTTPError: LocalizedError {
        let status: Int
        var errorDescription: String? { String(format: L("http_error"), status) }
    }
}
