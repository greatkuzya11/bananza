# BananZa for iPhone

Swift / WKWebView client for iOS 17+. The existing HTTPS BananZa server supplies the web UI; native code supplies APNs, CallKit/PushKit, LiveKit media, Keychain session storage and system media actions.

## Build from Windows

The `iOS build and TestFlight` GitHub Actions workflow runs on `macos-15` with Xcode 26.3, XcodeGen 2.46.0 and LiveKit 2.19.0. It builds on pushes to `ios/**` and relevant PRs. No Mac or Apple membership is required to run the unsigned simulator checks. A simulator `.app` **cannot be installed on an iPhone**.

For a local Mac:

```sh
cd ios
swift Tools/generate-icon.swift BananZa/Assets.xcassets/AppIcon.appiconset/AppIcon.png
xcodegen generate
mkdir -p BananZa.xcodeproj/project.xcworkspace/xcshareddata/swiftpm
cp Package.resolved BananZa.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved
open BananZa.xcodeproj
```

Select the BananZa scheme and an iPhone simulator. The generated Xcode project and build output are ignored; `project.yml` is authoritative. The workflow uploads the test results, simulator app, launch screenshot, icon and resolved dependency list for inspection. The tracked `Package.resolved` pins transitive dependencies as well as the SDK; CI refuses unrecorded dependency versions.

## One-time Apple setup

The owner must enroll in Apple Developer Program and accept Apple's agreements. Neither repository access nor a generated IPA replaces Apple signing credentials.

1. Register the explicit App ID **app.bananza.ios**, enable Push Notifications, and create its BananZa app record in App Store Connect. If this identifier is unavailable, replace it consistently in `project.yml`, `release.sh`, this guide, the server APNs configuration, and the Apple profile before the first release.
2. Create an Apple Distribution certificate and its private key, export a password-protected `.p12`, and create an **App Store Connect distribution** provisioning profile for this App ID with production push entitlement. The build workflow checks the team, identifier and entitlement.
3. Create an App Store Connect API key with the permissions needed to upload builds. Record its key ID and issuer ID and download its `.p8` once.
4. In the repository's **Settings → Secrets and variables → Actions**, add:

| Secret | Value |
| --- | --- |
| `IOS_TEAM_ID` | Apple developer team ID |
| `IOS_CERTIFICATE_P12_BASE64` | Base64 of the distribution `.p12` |
| `IOS_CERTIFICATE_PASSWORD` | Password protecting the `.p12` |
| `IOS_PROVISION_PROFILE_BASE64` | Base64 of the distribution `.mobileprovision` |
| `ASC_KEY_ID` | App Store Connect API key ID |
| `ASC_ISSUER_ID` | App Store Connect issuer ID |
| `ASC_PRIVATE_KEY_BASE64` | Base64 of the App Store Connect `.p8` |

Encode files on Windows with `[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\path\file'))`. Paste values directly into GitHub Secrets; do not put them in a commit, chat, issue or build log. The APNs key below is a separate credential from the App Store Connect API key.

## Server configuration

Deploy the server/web changes before installing this client. The database migration creates `ios_push_devices` automatically. Existing Android and browser notification transports keep working. Calls still require the existing LiveKit configuration and administrator enablement; this change does not enable calls globally.

Create an Apple APNs token-authentication key for this App ID/team and set the server environment:

```dotenv
APNS_TEAM_ID=YOUR_TEAM_ID
APNS_KEY_ID=YOUR_APNS_KEY_ID
APNS_BUNDLE_ID=app.bananza.ios
APNS_PRIVATE_KEY_BASE64=BASE64_OF_THE_APNS_P8_FILE
```

Use a key authorized for both environments if testing development builds as well as TestFlight. Debug builds register sandbox tokens; TestFlight builds register production tokens. The server sends HTTP/2 notifications to the matching Apple endpoint. The BananZa server requires outbound access to APNs; iPhones require HTTPS/WSS access to BananZa and the configured LiveKit/TURN services, including over cellular networks.

No server private keys are shipped in the iOS app. The client reads only the session bearer token and short-lived LiveKit participant tokens. Registration routes derive the user from authentication, expire with its JWT and exclude blocked accounts. A device/account change rebinds APNs tokens; invalid tokens are cleared per transport. Ordinary events use alert push; only incoming calls use VoIP push.

Backups include device rows in SQLite. APNs environment/key material and CI signing secrets are external dependencies recorded in `backup-manifest.json`; restore them separately. Keep the existing `.secret` for restored JWT/encrypted settings. Native Keychain, WebKit storage and temporary downloads live on the device and are not included in server backups.

## Release and installation

Deploy the matching server revision before testing: the native client loads its bridge, notification settings and call handoff from that server's web assets. Configure the APNs variables on the server and restart it. A simulator build does not deploy the server automatically.

1. Run the workflow on the intended branch with `release=false`; require a successful simulator build/test result.
2. Complete the physical-device acceptance matrix in `ACCEPTANCE.md` using a development or TestFlight build. APNs, locked-screen calls, Bluetooth and real camera/microphone behavior cannot be established by simulator tests.
3. Run **Actions → iOS build and TestFlight → Run workflow → release=true**. The workflow imports signing material into a temporary keychain, archives, exports the IPA, uploads to App Store Connect, then removes the credentials. Build numbers use the workflow run number and attempt.
4. Wait for processing in App Store Connect. Fill the beta description, review contact, test credentials, privacy-policy URL and encryption questions based on the deployed service. Use `REVIEW.md` as a preparation checklist, not as automatically verified declarations.
5. Enable internal testing for the account owner first. Create the external test group and submit for Beta App Review. Invite the small group after approval; Apple controls review timing and acceptance.
6. On the iPhone, install TestFlight, accept the invitation, install BananZa, enter the HTTPS server, sign in, and enable notifications. Allow microphone/camera when using media. Run the locked-screen incoming-call checks after microphone permission has been granted.

A TestFlight build expires after 90 days. Publish replacement builds before expiry and before certificate/profile expiry. Updates preserve the bundle identifier, Keychain session and WebKit storage. Signing/upload failures should be resolved from the workflow logs; do not regenerate the application identifier to fix a routine signing problem.

## Runtime behavior and troubleshooting

- The native menu provides Reload, Server, Notifications, Sign out and Return to call. Shared web settings control notification categories, font size and rotation.
- Sign-out clears the native session and delivered notifications. Failed deregistrations are retained in Keychain and retried before registration. While the device is offline, the server cannot learn about a logout immediately; queued remote alerts are subject to Apple delivery behavior.
- Notification status distinguishes OS permission from server registration. A 503 during registration means APNs credentials are missing/invalid. Review `ios_push_devices.last_error` for delivery failure categories without printing device tokens or secrets.
- Calls have exactly one native LiveKit room. CallKit owns audio activation; voice continues in background, camera resumes when foregrounded. PushKit is never used as a general background synchronization channel.
- The browser supplies microphone track IDs to the same server recording/AI notes flows used by the native client. AI processing and external guest links remain server features.
- Shared attachments, recordings, media-note shapes, documents and AI screens use the existing web application. Offline behavior remains its existing cache/outbox behavior; a fresh offline launch is not a promised full offline client.
- Silent mode, Focus, revoked permissions, network loss, low-power restrictions and force-quit behavior must be tested as platform limitations, not treated as guaranteed push delivery.

## Tests

From the repository root: `npm test`. Focused tests: `node --test test/unit/iosPush.test.js test/dom/ios-bridge.dom.test.js test/unit/pushI18n.test.js test/integration/backup-restore.test.js`. The iOS workflow runs XCTest origin-boundary checks and builds the entire Swift app against its pinned SDK. See `ACCEPTANCE.md` for the hardware-only checks.
