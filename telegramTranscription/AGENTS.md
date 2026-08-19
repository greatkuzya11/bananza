# AGENTS.md for Telegram integrations

## Purpose
- This subtree owns independent Telegram long-polling integrations for audio transcription and text-to-image generation.
- Read the repository root `AGENTS.md` before this file.

## Boundaries
- Telegram updates never create BananZa chats, users, messages, or upload records. Generated image bytes are temporary SQLite job payloads and are cleared after terminal delivery.
- Bot tokens are encrypted at rest and must never be returned or logged.
- Incoming audio is temporary runtime data and must be removed after each job.
- Every saved Telegram bot owns its encrypted token, allowlist, capability switches, provider selections, update cursor, runtime state, and per-user queue limits.
- Telegram update IDs and chat/message IDs are only unique inside a bot; all deduplication keys and jobs must include `telegram_bot_id`.
- Polling, webhook conflicts, authentication errors, queues, workers, token changes, and deletion guards are isolated by bot ID.
- Transcription transport is reused from `voice/providers.js`; Telegram owns only its independent provider profile and delivery flow.

## Runtime contract
- Each bot's polling offset and accepted work are persisted before Telegram updates are acknowledged.
- Only private chats and explicitly allowed numeric Telegram user IDs may enqueue transcription or image-generation work.
- Long polling is the only supported v1 transport. Existing webhooks may only be removed by the explicit claim action.
- Keep Telegram API errors sanitized: URLs may contain the bot token.

## Verify
- Cover settings encryption, polling deduplication, media validation, download limits, text chunking, restart recovery, and token-safe errors.
- Verify legacy singleton settings migrate exactly once into the first saved bot.
- Verify backup/restore keeps all bot rows and the `.secret` required to decrypt every token.
