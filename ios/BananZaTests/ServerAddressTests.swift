import XCTest
@testable import BananZa

final class ServerAddressTests: XCTestCase {
    func testRejectsOldServerPushEvenWhenUserIDsCoincide() {
        let account = AccountSession(server: URL(string: "https://new.example.com")!, token: "test", userID: 1)
        XCTAssertTrue(account.acceptsPush(accountID: 1, deviceID: "new-registration", currentDeviceID: "new-registration"))
        XCTAssertFalse(account.acceptsPush(accountID: 1, deviceID: "old-registration", currentDeviceID: "new-registration"))
        XCTAssertFalse(account.acceptsPush(accountID: 2, deviceID: "new-registration", currentDeviceID: "new-registration"))
        XCTAssertFalse(account.acceptsPush(accountID: 1, deviceID: nil, currentDeviceID: "new-registration"))
    }
    func testNormalizesHTTPSOrigin() {
        XCTAssertEqual(ServerAddress.normalize(" https://CHAT.example.com:443/ ")?.absoluteString, "https://chat.example.com")
        XCTAssertNotNil(ServerAddress.normalize("https://chat.example.com:8443"))
    }
    func testRejectsUnsafeOrAmbiguousServers() {
        for address in ["http://chat.example.com", "https://user:pass@chat.example.com", "https://chat.example.com/path", "https://chat.example.com?token=x", "https://chat.example.com#login", "javascript:alert(1)"] {
            XCTAssertNil(ServerAddress.normalize(address), address)
        }
    }
    func testOriginBoundaryDoesNotTrustSubdomainsOrOtherPorts() {
        let server = ServerAddress.normalize("https://chat.example.com")
        XCTAssertTrue(ServerAddress.matches(URL(string: "https://chat.example.com/api/files/1"), server))
        for address in ["https://chat.example.com.evil.test", "https://evil.chat.example.com", "https://chat.example.com:8443", "http://chat.example.com", "https://user@chat.example.com"] {
            XCTAssertFalse(ServerAddress.matches(URL(string: address), server))
        }
    }
}
