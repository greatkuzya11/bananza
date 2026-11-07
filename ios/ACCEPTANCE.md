# iPhone acceptance matrix

Record device model, iOS version, build number, server revision and tester for each run. A checkbox is evidence only after it has been performed on a real device. No hardware checks have been claimed by generating this file.

| Area | Required scenario | Result |
| --- | --- | --- |
| Install | Install through TestFlight; cold launch; correct icon and RU/EN UI | Pending device |
| Upgrade | Install a later TestFlight build; preserve account, chat state and settings | Pending device |
| Account | Login, registration, logout, account switch, server switch, expired session | Pending device |
| Bridge | External links open outside the trusted WebView; foreign origin/frame cannot invoke native APIs | Automated + device |
| Chat | Private/group chats, folders, unread, search, pagination, editing, deletion, forwarding, replies | Pending device |
| Actions | Mentions, reactions, pins, polls, invites and notification category settings | Pending device |
| Documents | Open/edit collaborative document; export/download a blob; save through Files | Pending device |
| AI/admin | Existing bot actions, AI settings, admin screens, call transcripts and artifacts | Pending device |
| Attachments | Files/iCloud picker, photo picker, camera, multiple files, HEIC/JPEG, PDF, MP4/WebM playback | Pending device |
| Media notes | Record/play/send voice and video notes, shape previews, cancel/re-record, cross-platform playback | Pending device |
| Native media | Share file, save photo/video, save to Files, copy image; deny permission and retry | Pending device |
| Location | Grant/deny location, send a location message, weather lookup | Pending device |
| Layout | Keyboard, safe areas, portrait/landscape, font sizes, navigation back, relaunch | Pending device |
| Network | Airplane mode during send, existing outbox replay, WebSocket reconnect, Wi-Fi ↔ cellular | Pending device |
| APNs | Message, mention, reaction, pin, invite, test alert; foreground/background/locked screen | Pending device |
| APNs isolation | Own message, open chat, muted chat, sound off, categories off; multiple devices/accounts | Pending device |
| APNs lifecycle | Denied OS permission, settings change, token renewal, reinstall, stale token, expired JWT | Pending device |
| Calls | iPhone ↔ Android/browser voice/video; group room; receive remote screen share | Pending device |
| Incoming call | Cold/foreground/background/locked screen, duplicate push, canceled/expired call, answered elsewhere | Pending device |
| Audio | Microphone mute/unmute, earpiece/speaker/Bluetooth, system-call interruption, background voice | Pending device |
| Video | Toggle/switch camera, permission denial, background suspension/foreground resume | Pending device |
| Call state | Minimize/reopen, leave/end for everyone, reconnect, disabled calls, unavailable LiveKit | Pending device |
| AI notes | Start/stop recording, microphone SID registration, transcript and generated artifacts | Pending device |
| Platform limits | Focus, silent mode, force-quit, reboot/unlock, low-power mode and denied permissions | Pending device |
| Restore | Restore server backup; integrity check, migrations, registrations and separately restored APNs key | Automated + device |

Screen sharing **from** the phone is outside Android parity: the existing Android mobile client does not expose it. Viewing another participant's shared screen is included.

Acceptance is complete only when required rows pass or an explicit product decision records a platform limitation. Do not present a simulator archive as an installable iPhone release.
