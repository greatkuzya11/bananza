# TestFlight review preparation

## Draft description

RU: BananZa — клиент собственного сервера для личных и групповых чатов, обмена файлами, голосовых и видеосообщений, документов и звонков. Приложение подключается к серверу по HTTPS. Набор AI-функций определяется настройками сервера.

EN: BananZa connects to your HTTPS server for private and group chats, file sharing, voice and video messages, collaborative documents and calls. Available AI features depend on the server configuration.

## Reviewer access

Before external testing, enter the real reachable server URL, a non-admin demo account, review contact, privacy-policy URL and instructions for calling a second test user in App Store Connect. Supply credentials in Apple's review fields, never this repository. The demo server must remain reachable during review. Do not provide access to production users' conversations.

Show native functionality: incoming CallKit call, APNs notification opening a chat, system file/photo sharing, background call audio. Include real iPhone screenshots of chats and the native call screen; the CI launch screenshot alone is insufficient.

## Privacy and distribution declarations

The application contains no advertising or analytics SDK. The operator's server handles account identifiers, messages, uploaded media/documents, optional precise location, push-device identifiers and call metadata; enabled AI/transcription providers may process user content. Verify retention, disclosure to third parties, consent, account deletion and moderation/reporting against the deployed configuration and Apple's current review rules before declaring data usage. Do not claim that no data is collected merely because the server is self-hosted.

The bundled privacy manifest declares required-reason API access for app-local UserDefaults. Review LiveKit's bundled manifest and the App Store Connect data declarations for the final archive. Answer export/encryption questions for the actual build; no blanket encryption-exemption declaration is hardcoded.

## Delivery record

- Apple developer team / agreements: requires owner setup.
- App Store Connect app record: requires authorized Apple access.
- Distribution certificate / provisioning profile / API key: requires owner setup in GitHub Secrets.
- APNs key: requires server configuration.
- Physical iPhone acceptance: pending the matrix in ACCEPTANCE.md.
- Beta App Review and external invitations: pending signed upload and Apple's approval.

Do not replace these entries with success claims without checking App Store Connect and the target device.
