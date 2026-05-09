# AGENTS.md for calls

## Purpose
- Server-side realtime call subsystem for BananZa.
- Calls are optional and must fail closed: when disabled or LiveKit is not configured, the rest of the chat must keep working.

## What lives here
- `schema.js` creates call session, participant, and call-message metadata tables.
- `settings.js` stores admin-controlled call settings in `app_settings`.
- `index.js` registers call routes, LiveKit token generation, WebSocket fan-out, and call lifecycle behavior.

## How to add features
- Keep media transport delegated to LiveKit. Do not send audio/video over the app WebSocket.
- Keep chat permissions authoritative in BananZa: every call action must verify chat membership.
- Keep call cards backed by ordinary `messages`; update the existing call message instead of creating a new history entry per state change.
- Keep user-visible text mirrored in `public/js/i18n.js`.

## Gotchas
- `calls_enabled` defaults to false. Do not change that default casually.
- If settings disable calls, active calls must be ended and clients notified.
- Ring timeout and LiveKit reconciliation workers must be idempotent and safe to run repeatedly.
- LiveKit API secrets must never be sent to the browser; only short-lived participant tokens may leave the server.

## Verify
- Run `npm test`.
- For UI work, verify disabled state, enabled-but-unconfigured state, incoming call overlay, active call banner, and leave/end flows.
