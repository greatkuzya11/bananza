import UIKit
import Photos

@MainActor enum MediaActions {
    static func perform(_ payload: [String: Any], account: AccountSession, presenter: UIViewController) async throws {
        guard let text = payload["url"] as? String, let url = URL(string: text), ServerAddress.matches(url, account.server),
              let action = payload["action"] as? String, ["copy-image", "save-media", "share-media"].contains(action) else {
            throw AppError.message(L("untrusted_request"))
        }
        var request = URLRequest(url: url); request.timeoutInterval = 120
        request.setValue("Bearer \(account.token)", forHTTPHeaderField: "Authorization")
        let (temporary, response) = try await APIClient.session.download(for: request)
        defer { try? FileManager.default.removeItem(at: temporary) }
        guard let response = response as? HTTPURLResponse, (200..<300).contains(response.statusCode) else { throw AppError.message(L("download_failed")) }
        let name = URL(fileURLWithPath: (payload["filename"] as? String) ?? response.suggestedFilename ?? "attachment").lastPathComponent
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let file = directory.appendingPathComponent(name.isEmpty || name == "." || name == ".." ? "attachment" : String(name.prefix(180)))
        try FileManager.default.moveItem(at: temporary, to: file)
        let mime = response.mimeType ?? "application/octet-stream"
        if action == "copy-image" {
            defer { try? FileManager.default.removeItem(at: directory) }
            guard mime.hasPrefix("image/"), let image = UIImage(contentsOfFile: file.path) else { throw AppError.message(L("image_unavailable")) }
            UIPasteboard.general.image = image
        } else if action == "save-media" && (mime.hasPrefix("image/") || mime.hasPrefix("video/")) {
            defer { try? FileManager.default.removeItem(at: directory) }
            guard await PHPhotoLibrary.requestAuthorization(for: .addOnly) == .authorized else { throw AppError.message(L("photos_denied")) }
            try await PHPhotoLibrary.shared().performChanges {
                if mime.hasPrefix("image/") { PHAssetChangeRequest.creationRequestForAssetFromImage(atFileURL: file) }
                else { PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: file) }
            }
        } else {
            // Save to Files is also available in the system share sheet.
            let controller = UIActivityViewController(activityItems: [file], applicationActivities: nil)
            controller.popoverPresentationController?.sourceView = presenter.view
            controller.completionWithItemsHandler = { _, _, _, _ in try? FileManager.default.removeItem(at: directory) }
            presenter.present(controller, animated: true)
        }
    }
}
