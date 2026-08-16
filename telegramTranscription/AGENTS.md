# AGENTS.md for Telegram integration

## Purpose
- This subtree owns the shared Telegram long-polling integration for audio transcription and text-to-image generation.
- Read the repository root `AGENTS.md` before this file.

## Boundaries
- Telegram updates never create BananZa chats, users, messages, or upload records. Generated image bytes are temporary SQLite job payloads and are cleared after terminal delivery.
- Bot tokens are encrypted at rest and must never be returned or logged.
- Incoming audio is temporary runtime data and must be removed after each job.
- Audio and image generation have independent enable switches but share one token, allowlist, update cursor, and global/per-user queue limits.
- Transcription transport is reused from `voice/providers.js`; Telegram owns only its independent provider profile and delivery flow.

## Runtime contract
- Polling offsets and accepted work are persisted before Telegram updates are acknowledged.
- Only private chats and explicitly allowed numeric Telegram user IDs may enqueue transcription or image-generation work.
- Long polling is the only supported v1 transport. Existing webhooks may only be removed by the explicit claim action.
- Keep Telegram API errors sanitized: URLs may contain the bot token.

## Verify
- Cover settings encryption, polling deduplication, media validation, download limits, text chunking, restart recovery, and token-safe errors.
- Verify backup/restore keeps both the SQLite settings and the `.secret` required to decrypt the token.
