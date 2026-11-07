# BananZa iOS

- iOS 17+, Swift 5 language mode, UIKit/WKWebView and the pinned LiveKit Swift SDK.
- `project.yml` is the XcodeGen source of truth. Generate the Xcode project with the pinned CI tool; do not hand-edit generated pbxproj files.
- Only the configured HTTPS origin and its main frame may call the native bridge. Never forward credentials across redirects or to external links.
- Keep native session tokens and pending deregistrations in Keychain. No signing material or Apple private keys in Git.
- The native CallCoordinator owns the only LiveKit room on iOS. Never join a second browser room.
- Keep strings in en/ru Localizable.strings and permission descriptions in en/ru InfoPlist.strings. Shared web strings remain in public/js/i18n.js.
- Validate with the simulator CI build/tests, then the physical-device acceptance matrix. A successful simulator build is not proof of APNs/CallKit delivery.
