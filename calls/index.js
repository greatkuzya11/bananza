const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { randomUUID } = require('crypto');
const express = require('express');
const { AccessToken, EgressClient, RoomServiceClient, WebhookReceiver } = require('livekit-server-sdk');
const { DirectFileOutput, TrackSource } = require('@livekit/protocol');
const { AsyncJobQueue } = require('../voice/queue');
const { transcribeAudio } = require('../voice/providers');
const { getVoiceSettings, getOpenAIKey: getVoiceOpenAIKey, getGrokKey: getVoiceGrokKey } = require('../voice/settings');
const {
  getCallSettings,
  setCallSettings,
  getLiveKitConfig,
  getAdminLiveKitConfig,
  setLiveKitConfig,
  getPublicCallSettings,
  liveKitHttpUrl,
} = require('./settings');

const CALL_TOKEN_TTL_SECONDS = 60 * 30;
const TEST_ROOM_TIMEOUT_MS = 4000;
const AI_NOTES_PARTICIPANT_LOOKUP_TIMEOUT_MS = 12_000;
const AI_NOTES_START_RETRIES = 3;
const AI_NOTES_START_RETRY_MS = 2500;
const CALL_RING_WORKER_MS = 10_000;
const CALL_RECONCILE_WORKER_MS = 30_000;
const CALL_RECONCILE_MIN_AGE_MS = 90_000;
const CALL_TRANSCRIPT_MERGE_GAP_MS = 2500;

function boolError(res, status, message, code = '') {
  return res.status(status).json({ error: message, code: code || message });
}

function normalizeId(value) {
  const id = Number(value || 0);
  return Number.isInteger(id) && id > 0 ? id : 0;
}

function createCallFeature({
  app,
  db,
  auth,
  adminOnly,
  rateLimit,
  sendToUser,
  broadcastToChatAll,
  clients,
  notifyCallInvite,
  hydrateMessageById,
  onMessageCreated,
  secret = '',
  roomServiceClientFactory = null,
}) {
  const callLimiter = rateLimit
    ? rateLimit({ windowMs: 60_000, max: 60, message: { error: 'Too many call requests' } })
    : (_req, _res, next) => next();

  const chatStmt = db.prepare(`
    SELECT id, name, type, is_notes
    FROM chats
    WHERE id=?
  `);
  const memberStmt = db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?');
  const membersStmt = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar_color, u.avatar_url, COALESCE(u.is_ai_bot,0) as is_ai_bot
    FROM chat_members cm
    JOIN users u ON u.id=cm.user_id
    WHERE cm.chat_id=?
    ORDER BY u.display_name COLLATE NOCASE
  `);
  const callByIdStmt = db.prepare(`
    SELECT cs.*, c.name as chat_name, c.type as chat_type, c.is_notes as chat_is_notes,
      u.display_name as started_by_name, u.username as started_by_username
    FROM call_sessions cs
    JOIN chats c ON c.id=cs.chat_id
    JOIN users u ON u.id=cs.started_by
    WHERE cs.id=?
  `);
  const activeCallByChatStmt = db.prepare(`
    SELECT cs.*, c.name as chat_name, c.type as chat_type, c.is_notes as chat_is_notes,
      u.display_name as started_by_name, u.username as started_by_username
    FROM call_sessions cs
    JOIN chats c ON c.id=cs.chat_id
    JOIN users u ON u.id=cs.started_by
    WHERE cs.chat_id=? AND cs.status='active'
    ORDER BY cs.id DESC
    LIMIT 1
  `);
  const activeCallsForUserStmt = db.prepare(`
    SELECT cs.*, c.name as chat_name, c.type as chat_type, c.is_notes as chat_is_notes,
      u.display_name as started_by_name, u.username as started_by_username
    FROM call_sessions cs
    JOIN call_participants cp ON cp.call_id=cs.id
    JOIN chats c ON c.id=cs.chat_id
    JOIN users u ON u.id=cs.started_by
    WHERE cp.user_id=? AND cs.status='active'
    ORDER BY cs.started_at DESC, cs.id DESC
  `);
  const participantsStmt = db.prepare(`
    SELECT cp.call_id, cp.user_id, cp.state, cp.joined_at, cp.left_at, cp.updated_at,
      u.display_name, u.username, u.avatar_color, u.avatar_url, COALESCE(u.is_ai_bot,0) as is_ai_bot
    FROM call_participants cp
    JOIN users u ON u.id=cp.user_id
    WHERE cp.call_id=?
    ORDER BY u.display_name COLLATE NOCASE
  `);
  const participantStmt = db.prepare(`
    SELECT cp.call_id, cp.user_id, cp.state, cp.joined_at, cp.left_at, cp.updated_at,
      u.display_name, u.username, u.avatar_color, u.avatar_url, COALESCE(u.is_ai_bot,0) as is_ai_bot
    FROM call_participants cp
    JOIN users u ON u.id=cp.user_id
    WHERE cp.call_id=? AND cp.user_id=?
  `);
  const callByRoomStmt = db.prepare(`
    SELECT cs.*, c.name as chat_name, c.type as chat_type, c.is_notes as chat_is_notes,
      u.display_name as started_by_name, u.username as started_by_username
    FROM call_sessions cs
    JOIN chats c ON c.id=cs.chat_id
    JOIN users u ON u.id=cs.started_by
    WHERE cs.livekit_room_name=?
  `);
  const joinedHumanCountStmt = db.prepare(`
    SELECT COUNT(*) as total
    FROM call_participants cp
    JOIN users u ON u.id=cp.user_id
    WHERE cp.call_id=? AND cp.state='joined' AND COALESCE(u.is_ai_bot,0)=0
  `);
  const activeCallsStmt = db.prepare(`
    SELECT cs.*, c.name as chat_name, c.type as chat_type, c.is_notes as chat_is_notes,
      u.display_name as started_by_name, u.username as started_by_username
    FROM call_sessions cs
    JOIN chats c ON c.id=cs.chat_id
    JOIN users u ON u.id=cs.started_by
    WHERE cs.status='active'
  `);
  const humanMembersStmt = db.prepare(`
    SELECT u.id, u.display_name, u.username
    FROM chat_members cm
    JOIN users u ON u.id=cm.user_id
    WHERE cm.chat_id=? AND COALESCE(u.is_ai_bot,0)=0
  `);
  const userStmt = db.prepare('SELECT id, username, display_name FROM users WHERE id=?');
  const insertMessageStmt = db.prepare(`
    INSERT INTO messages(chat_id, user_id, text)
    VALUES(?, ?, ?)
  `);
  const insertCallMessageStmt = db.prepare(`
    INSERT INTO call_messages(
      message_id,
      call_id,
      status,
      started_by,
      started_at,
      updated_at
    )
    VALUES(?, ?, 'active', ?, datetime('now'), datetime('now'))
  `);
  const updateCallMessageStmt = db.prepare(`
    UPDATE call_messages
    SET status=?,
      ended_by=?,
      ended_at=?,
      ended_reason=?,
      duration_ms=?,
      updated_at=datetime('now')
    WHERE call_id=?
  `);
  const callByMessageIdStmt = db.prepare(`
    SELECT cs.*, c.name as chat_name, c.type as chat_type, c.is_notes as chat_is_notes,
      u.display_name as started_by_name, u.username as started_by_username
    FROM call_sessions cs
    JOIN chats c ON c.id=cs.chat_id
    JOIN users u ON u.id=cs.started_by
    WHERE cs.message_id=?
  `);
  const aiNotesByCallStmt = db.prepare('SELECT * FROM call_ai_notes WHERE call_id=?');
  const insertAiNotesStmt = db.prepare(`
    INSERT INTO call_ai_notes(call_id, status, requested_by, started_at, transcript_status, created_at, updated_at)
    VALUES(?, 'recording', ?, datetime('now'), 'recording', datetime('now'), datetime('now'))
    ON CONFLICT(call_id) DO UPDATE SET
      status='recording',
      requested_by=COALESCE(call_ai_notes.requested_by, excluded.requested_by),
      started_at=COALESCE(call_ai_notes.started_at, excluded.started_at),
      transcript_status='recording',
      transcript_error='',
      updated_at=datetime('now')
  `);
  const updateAiNotesStatusStmt = db.prepare(`
    UPDATE call_ai_notes
    SET status=?,
      transcript_status=?,
      ended_at=COALESCE(?, ended_at),
      transcript_error=COALESCE(?, transcript_error),
      updated_at=datetime('now')
    WHERE call_id=?
  `);
  const updateAiNotesTranscriptStmt = db.prepare(`
    UPDATE call_ai_notes
    SET status=?,
      transcript_status=?,
      transcript_text=?,
      transcript_error=?,
      timing_approximate=?,
      updated_at=datetime('now')
    WHERE call_id=?
  `);
  const activeAiNotesStmt = db.prepare(`
    SELECT an.*, cs.livekit_room_name, cs.chat_id
    FROM call_ai_notes an
    JOIN call_sessions cs ON cs.id=an.call_id
    WHERE an.call_id=? AND an.status='recording' AND cs.status='active'
  `);
  const insertRecordingStmt = db.prepare(`
    INSERT INTO call_recordings(call_id, user_id, livekit_identity, track_id, egress_id, file_path, status, started_at, created_at, updated_at)
    VALUES(?, ?, ?, ?, ?, ?, 'recording', ?, datetime('now'), datetime('now'))
  `);
  const recordingByEgressStmt = db.prepare('SELECT * FROM call_recordings WHERE egress_id=?');
  const recordingByTrackStmt = db.prepare(`
    SELECT * FROM call_recordings
    WHERE call_id=? AND track_id=? AND status IN ('recording','processing')
    ORDER BY id DESC LIMIT 1
  `);
  const activeRecordingsForCallStmt = db.prepare(`
    SELECT * FROM call_recordings WHERE call_id=? AND status='recording'
  `);
  const activeRecordingsForUserStmt = db.prepare(`
    SELECT * FROM call_recordings WHERE call_id=? AND user_id=? AND status='recording'
  `);
  const updateRecordingStartedStmt = db.prepare(`
    UPDATE call_recordings
    SET egress_id=?, started_at=COALESCE(started_at, ?), updated_at=datetime('now')
    WHERE id=?
  `);
  const updateRecordingEndedStmt = db.prepare(`
    UPDATE call_recordings
    SET status=?,
      ended_at=COALESCE(?, ended_at),
      duration_ms=COALESCE(?, duration_ms),
      size_bytes=COALESCE(?, size_bytes),
      file_path=COALESCE(NULLIF(?, ''), file_path),
      transcription_error=COALESCE(?, transcription_error),
      updated_at=datetime('now')
    WHERE id=?
  `);
  const updateRecordingTranscriptStmt = db.prepare(`
    UPDATE call_recordings
    SET status=?,
      transcription_text=?,
      transcription_provider=?,
      transcription_model=?,
      transcription_error=?,
      updated_at=datetime('now')
    WHERE id=?
  `);
  const deleteSegmentsForRecordingStmt = db.prepare('DELETE FROM call_transcript_segments WHERE recording_id=?');
  const insertTranscriptSegmentStmt = db.prepare(`
    INSERT INTO call_transcript_segments(call_id, recording_id, user_id, speaker_name, start_ms, end_ms, text, timing_approximate)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const transcriptSegmentsStmt = db.prepare(`
    SELECT cts.*, u.display_name, u.username
    FROM call_transcript_segments cts
    JOIN users u ON u.id=cts.user_id
    WHERE cts.call_id=?
    ORDER BY cts.start_ms ASC, cts.user_id ASC, cts.id ASC
  `);
  const recordingCountsStmt = db.prepare(`
    SELECT
      SUM(CASE WHEN status='recording' THEN 1 ELSE 0 END) as recording,
      SUM(CASE WHEN status='processing' THEN 1 ELSE 0 END) as processing,
      SUM(CASE WHEN status='error' THEN 1 ELSE 0 END) as errors,
      COUNT(*) as total
    FROM call_recordings
    WHERE call_id=?
  `);
  const retryableRecordingsStmt = db.prepare(`
    SELECT * FROM call_recordings
    WHERE call_id=? AND status='error' AND file_path!=''
  `);
  const transcriptQueue = new AsyncJobQueue({
    handler: processRecordingTranscript,
    getConcurrency: () => Math.max(1, Math.min(2, Number(getVoiceSettings(db).queue_concurrency || 1))),
  });

  function livekitConfig() {
    return getLiveKitConfig(db, secret, process.env);
  }

  function livekitRoomClient() {
    const config = livekitConfig();
    if (typeof roomServiceClientFactory === 'function') return roomServiceClientFactory(config);
    if (!config.ready) return null;
    return new RoomServiceClient(liveKitHttpUrl(config.wsUrl), config.apiKey, config.apiSecret);
  }

  function livekitEgressClient() {
    const config = livekitConfig();
    if (!config.ready) return null;
    return new EgressClient(liveKitHttpUrl(config.wsUrl), config.apiKey, config.apiSecret);
  }

  function publicSettings() {
    return getPublicCallSettings(db, secret, process.env);
  }

  function bigintNsToIso(value) {
    const raw = value == null ? 0 : Number(value);
    if (!Number.isFinite(raw) || raw <= 0) return null;
    const ms = raw > 10_000_000_000_000 ? Math.round(raw / 1_000_000) : raw;
    return new Date(ms).toISOString();
  }

  function bigintNsDurationToMs(value) {
    const raw = value == null ? 0 : Number(value);
    if (!Number.isFinite(raw) || raw <= 0) return null;
    return Math.round(raw / 1_000_000);
  }

  function recordingRoot() {
    const settings = getCallSettings(db);
    return path.resolve(String(settings.call_recording_path || './call-recordings').trim() || './call-recordings');
  }

  function ensureRecordingRoot() {
    const root = recordingRoot();
    fs.mkdirSync(root, { recursive: true });
    return root;
  }

  function checkRecordingPath() {
    const root = ensureRecordingRoot();
    const probe = path.join(root, `.bananza-write-test-${process.pid}-${Date.now()}`);
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return root;
  }

  function safePathPart(value, fallback = 'item') {
    const text = String(value || '').trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
    return text || fallback;
  }

  function callRecordingPath(callId, userId, trackId) {
    const root = ensureRecordingRoot();
    const dir = path.join(root, `call-${Number(callId) || 0}`);
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `user-${Number(userId) || 0}-${safePathPart(trackId, randomUUID())}.ogg`);
  }

  function fileInfoFromEgress(egressInfo = {}) {
    const file = Array.isArray(egressInfo.fileResults) ? egressInfo.fileResults[0] : null;
    return {
      path: file?.location || file?.filename || '',
      startedAt: bigintNsToIso(file?.startedAt || egressInfo.startedAt),
      endedAt: bigintNsToIso(file?.endedAt || egressInfo.endedAt),
      durationMs: bigintNsDurationToMs(file?.duration) || bigintNsDurationToMs(
        (egressInfo.endedAt && egressInfo.startedAt)
          ? BigInt(egressInfo.endedAt) - BigInt(egressInfo.startedAt)
          : 0
      ),
      sizeBytes: file?.size == null ? null : Number(file.size),
    };
  }

  function serializeAiNotes(row) {
    if (!row) return null;
    let decisions = [];
    let actionItems = [];
    let openQuestions = [];
    let suggestedPolls = [];
    try { decisions = JSON.parse(row.decisions_json || '[]'); } catch {}
    try { actionItems = JSON.parse(row.action_items_json || '[]'); } catch {}
    try { openQuestions = JSON.parse(row.open_questions_json || '[]'); } catch {}
    try { suggestedPolls = JSON.parse(row.suggested_polls_json || '[]'); } catch {}
    return {
      status: row.status || 'idle',
      requested_by: row.requested_by ? Number(row.requested_by) : null,
      started_at: row.started_at || null,
      ended_at: row.ended_at || null,
      transcript_status: row.transcript_status || row.status || 'idle',
      transcript_ready: row.transcript_status === 'completed' && Boolean(String(row.transcript_text || '').trim()),
      transcript_error: row.transcript_error || '',
      timing_approximate: Number(row.timing_approximate) !== 0,
      summary_status: row.summary_status || 'idle',
      short_summary: row.short_summary || '',
      decisions,
      action_items: actionItems,
      open_questions: openQuestions,
      suggested_polls: suggestedPolls,
      summary_model: row.summary_model || '',
      summary_error: row.summary_error || '',
    };
  }

  function formatTranscriptTime(ms) {
    const total = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const head = h > 0 ? `${String(h).padStart(2, '0')}:` : '';
    return `${head}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function transcriptTextForCall(callId) {
    const rows = transcriptSegmentsStmt.all(callId);
    const merged = [];
    rows.forEach((row) => {
      const text = String(row.text || '').trim();
      if (!text) return;
      const speaker = row.speaker_name || row.display_name || row.username || 'User';
      const prev = merged[merged.length - 1];
      const start = Number(row.start_ms || 0);
      const end = Number(row.end_ms || start);
      if (
        prev
        && Number(prev.user_id) === Number(row.user_id)
        && start - Number(prev.end_ms || 0) <= CALL_TRANSCRIPT_MERGE_GAP_MS
      ) {
        prev.text = `${prev.text} ${text}`.trim();
        prev.end_ms = Math.max(Number(prev.end_ms || 0), end);
        prev.timing_approximate = prev.timing_approximate || Number(row.timing_approximate) !== 0;
        return;
      }
      merged.push({
        user_id: Number(row.user_id),
        speaker,
        start_ms: start,
        end_ms: end,
        text,
        timing_approximate: Number(row.timing_approximate) !== 0,
      });
    });
    return merged.map((row) => `[${formatTranscriptTime(row.start_ms)}] ${row.speaker}: ${row.text}`).join('\n');
  }

  function assertCallsAvailable(res) {
    const settings = getCallSettings(db);
    if (!settings.calls_enabled) {
      boolError(res, 403, 'Calls are disabled', 'calls_disabled');
      return false;
    }
    if (!livekitConfig().ready) {
      boolError(res, 503, 'LiveKit is not configured', 'livekit_not_configured');
      return false;
    }
    return true;
  }

  function isMember(chatId, userId) {
    return Boolean(memberStmt.get(chatId, userId));
  }

  function serializeParticipant(row) {
    return {
      user_id: Number(row.user_id),
      id: Number(row.user_id),
      state: row.state,
      joined_at: row.joined_at || null,
      left_at: row.left_at || null,
      updated_at: row.updated_at || null,
      display_name: row.display_name || row.username || 'User',
      username: row.username || '',
      avatar_color: row.avatar_color || '',
      avatar_url: row.avatar_url || null,
      is_ai_bot: Number(row.is_ai_bot) || 0,
    };
  }

  function parseTimeMs(value) {
    if (!value) return 0;
    const text = String(value);
    const normalized = text.includes('T') ? text : `${text.replace(' ', 'T')}Z`;
    const parsed = Date.parse(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function callDurationMs(row, endedAt = row?.ended_at) {
    const started = parseTimeMs(row?.started_at);
    const ended = parseTimeMs(endedAt);
    if (!started || !ended || ended < started) return null;
    return Math.max(0, ended - started);
  }

  function terminalStatusForReason(reason = 'ended') {
    if (reason === 'missed' || reason === 'timeout') return 'missed';
    if (reason === 'declined') return 'declined';
    if (reason === 'failed') return 'failed';
    return 'ended';
  }

  function serializeCall(row) {
    if (!row) return null;
    const participants = participantsStmt.all(row.id).map(serializeParticipant);
    const settings = getCallSettings(db);
    const isActive = row.status === 'active';
    const duration = row.duration_ms == null ? callDurationMs(row) : Number(row.duration_ms);
    return {
      id: Number(row.id),
      chat_id: Number(row.chat_id),
      chatId: Number(row.chat_id),
      chat_name: row.chat_name || '',
      chat_type: row.chat_type || '',
      livekit_room_name: row.livekit_room_name,
      status: row.status,
      message_id: row.message_id ? Number(row.message_id) : null,
      started_by: Number(row.started_by),
      started_by_name: row.started_by_name || row.started_by_username || 'User',
      started_at: row.started_at,
      ended_at: row.ended_at || null,
      ended_by: row.ended_by ? Number(row.ended_by) : null,
      ended_reason: row.ended_reason || null,
      duration_ms: Number.isFinite(duration) ? duration : null,
      ring_expires_at: row.ring_expires_at || null,
      participants,
      ai_notes: serializeAiNotes(aiNotesByCallStmt.get(row.id)),
      participant_count: participants.filter((item) => item.state === 'joined').length,
      can_join: isActive,
      can_screen_share: Boolean(isActive && settings.screen_share_enabled),
    };
  }

  function getCall(callId) {
    return serializeCall(callByIdStmt.get(callId));
  }

  function hasParticipant(callId, userId) {
    return Boolean(participantStmt.get(callId, userId));
  }

  function userIdFromLiveKitIdentity(identity) {
    const match = String(identity || '').trim().match(/^user:(\d+)(?::|$)/);
    return match ? normalizeId(match[1]) : 0;
  }

  function userIdFromLiveKitParticipant(participant = {}) {
    try {
      const metadata = participant.metadata ? JSON.parse(participant.metadata) : null;
      const metadataUserId = normalizeId(metadata?.userId);
      if (metadataUserId) return metadataUserId;
    } catch {}
    return userIdFromLiveKitIdentity(participant.identity || participant.participantIdentity || '');
  }

  function broadcastAll(payload) {
    const json = JSON.stringify(payload);
    clients.forEach((connections) => {
      connections.forEach((ws) => {
        if (ws.readyState === 1) ws.send(json);
      });
    });
  }

  function broadcastCall(chatId, payload) {
    broadcastToChatAll(chatId, payload);
  }

  function attachCallMetadata(messages = []) {
    if (!Array.isArray(messages) || messages.length === 0) return messages;
    return messages.map((message) => {
      if (!message?.id) return message;
      const row = callByMessageIdStmt.get(message.id);
      if (!row) return message;
      const call = serializeCall(row);
      message.call = call;
      message.is_call_message = true;
      message.call_message = {
        call_id: call.id,
        status: call.status,
        duration_ms: call.duration_ms,
        ended_reason: call.ended_reason,
        ai_notes: call.ai_notes || null,
      };
      return message;
    });
  }

  function hydrateCallMessage(messageId) {
    if (!messageId || typeof hydrateMessageById !== 'function') return null;
    return hydrateMessageById(messageId);
  }

  function broadcastCallMessageCreated(messageId) {
    const message = hydrateCallMessage(messageId);
    if (!message?.chat_id) return null;
    onMessageCreated?.(message);
    broadcastCall(message.chat_id, { type: 'message', message });
    return message;
  }

  function broadcastCallMessageUpdated(callOrRow) {
    const messageId = Number(callOrRow?.message_id || 0);
    if (!messageId) return null;
    const message = hydrateCallMessage(messageId);
    if (!message?.chat_id) return null;
    broadcastCall(message.chat_id, { type: 'message_updated', message });
    return message;
  }

  function syncCallMessage(row) {
    if (!row?.message_id) return;
    updateCallMessageStmt.run(
      row.status,
      row.ended_by || null,
      row.ended_at || null,
      row.ended_reason || null,
      row.duration_ms == null ? null : Number(row.duration_ms),
      row.id
    );
  }

  function deleteLiveKitRoomForCall(row) {
    if (!row?.livekit_room_name) return;
    const client = livekitRoomClient();
    if (!client || typeof client.deleteRoom !== 'function') return;
    client.deleteRoom(row.livekit_room_name).catch((error) => {
      const message = String(error?.message || '');
      if (!/not found|does not exist|room.*missing/i.test(message)) {
        console.warn('[calls] LiveKit room cleanup failed:', message || error);
      }
    });
  }

  function endCall(callId, endedBy = null, reason = 'ended') {
    const row = callByIdStmt.get(callId);
    if (!row || row.status !== 'active') return serializeCall(row);
    const endedAt = new Date().toISOString();
    const status = terminalStatusForReason(reason);
    const durationMs = callDurationMs(row, endedAt);
    db.prepare(`
      UPDATE call_sessions
      SET status=?,
        ended_by=?,
        ended_at=?,
        ended_reason=?,
        duration_ms=?,
        updated_at=datetime('now')
      WHERE id=? AND status='active'
    `).run(status, endedBy || null, endedAt, reason || status, durationMs, callId);
    db.prepare(`
      UPDATE call_participants
      SET state=CASE WHEN state='joined' THEN 'left' WHEN state='invited' THEN 'missed' ELSE state END,
        left_at=CASE WHEN state='joined' AND left_at IS NULL THEN datetime('now') ELSE left_at END,
        updated_at=datetime('now')
      WHERE call_id=?
    `).run(callId);
    if (aiNotesByCallStmt.get(callId)?.status === 'recording') {
      updateAiNotesStatusStmt.run('processing', 'processing', endedAt, '', callId);
      stopActiveRecordingsForCall(callId);
      maybeCompleteTranscript(callId);
    }
    const call = getCall(callId);
    if (call) {
      syncCallMessage(callByIdStmt.get(callId));
      broadcastCall(call.chat_id, { type: 'call_ended', call, reason });
      broadcastCallMessageUpdated(call);
      deleteLiveKitRoomForCall(row);
    }
    return call;
  }

  function endAllActiveCalls(reason = 'disabled') {
    const rows = activeCallsStmt.all();
    rows.forEach((row) => endCall(row.id, null, reason));
    return rows.length;
  }

  function maybeEndWhenEmpty(callId) {
    const total = Number(joinedHumanCountStmt.get(callId)?.total || 0);
    if (total <= 0) return endCall(callId, null, 'empty');
    return getCall(callId);
  }

  function participantState(callId, userId, state) {
    if (!hasParticipant(callId, userId)) return getCall(callId);
    const joinedAt = state === 'joined' ? 'datetime(\'now\')' : 'joined_at';
    const leftAt = state === 'left' ? 'datetime(\'now\')' : 'left_at';
    db.prepare(`
      UPDATE call_participants
      SET state=?, joined_at=${joinedAt}, left_at=${leftAt}, updated_at=datetime('now')
      WHERE call_id=? AND user_id=?
    `).run(state, callId, userId);
    const row = callByIdStmt.get(callId);
    const call = serializeCall(row);
    if (call) {
      broadcastCall(call.chat_id, {
        type: 'call_participant_updated',
        call,
        participant: call.participants.find((item) => Number(item.user_id) === Number(userId)) || null,
      });
      broadcastCallMessageUpdated(call);
    }
    return call;
  }

  function participantJoined(callId, userId) {
    return participantState(callId, userId, 'joined');
  }

  function participantLeft(callId, userId) {
    activeRecordingsForUserStmt.all(callId, userId).forEach((recording) => {
      stopRecording(recording).catch((error) => {
        console.warn('[calls] participant recording stop failed:', error.message);
      });
    });
    participantState(callId, userId, 'left');
    return maybeEndWhenEmpty(callId);
  }

  function broadcastAiNotesUpdated(callId) {
    const row = callByIdStmt.get(callId);
    const call = serializeCall(row);
    if (!call) return null;
    broadcastCall(call.chat_id, { type: 'call_ai_notes_updated', call, ai_notes: call.ai_notes || null });
    broadcastCallMessageUpdated(call);
    return call;
  }

  function isMicrophoneTrack(track = {}) {
    const source = track.source ?? track.trackSource;
    const type = track.type ?? track.trackType;
    const sourceText = String(source || '').toLowerCase();
    const typeText = String(type || '').toLowerCase();
    return source === TrackSource.MICROPHONE
      || sourceText.includes('microphone')
      || (type === 0 && !sourceText.includes('screen'))
      || (typeText === 'audio' && !sourceText.includes('screen'));
  }

  async function startRecordingForTrack(callId, participant = {}, track = {}) {
    const notes = activeAiNotesStmt.get(callId);
    if (!notes || !isMicrophoneTrack(track)) return null;
    const trackId = String(track.sid || track.id || track.trackSid || '').trim();
    if (!trackId || recordingByTrackStmt.get(callId, trackId)) return null;
    const userId = userIdFromLiveKitParticipant(participant);
    if (!userId || !hasParticipant(callId, userId)) return null;

    let recordingId = 0;
    try {
      const filepath = callRecordingPath(callId, userId, trackId);
      const startedAt = new Date().toISOString();
      const inserted = insertRecordingStmt.run(
        callId,
        userId,
        String(participant.identity || participant.participantIdentity || ''),
        trackId,
        '',
        filepath,
        startedAt
      );
      recordingId = Number(inserted.lastInsertRowid);
      const client = livekitEgressClient();
      if (!client) throw new Error('LiveKit Egress is not configured');
      const info = await client.startTrackEgress(
        notes.livekit_room_name,
        new DirectFileOutput({ filepath, disableManifest: true }),
        trackId
      );
      updateRecordingStartedStmt.run(String(info?.egressId || ''), bigintNsToIso(info?.startedAt) || startedAt, recordingId);
      console.info('[calls] AI notes recording started:', {
        callId,
        userId,
        trackId,
        egressId: String(info?.egressId || ''),
        filepath,
      });
      return info;
    } catch (error) {
      const message = error.message || 'Could not start recording';
      console.warn('[calls] AI notes recording start failed:', {
        callId,
        userId,
        trackId,
        room: notes.livekit_room_name,
        error: message,
      });
      if (recordingId) {
        updateRecordingEndedStmt.run('error', new Date().toISOString(), null, null, '', message, recordingId);
      }
      updateAiNotesStatusStmt.run('error', 'error', new Date().toISOString(), message, callId);
      broadcastAiNotesUpdated(callId);
      return null;
    }
  }

  async function startExistingMicrophoneRecordingsForCall(callId, roomName, attempt = 1) {
    const notes = activeAiNotesStmt.get(callId);
    if (!notes) return;
    try {
      const client = livekitRoomClient();
      const participants = await Promise.race([
        client.listParticipants(roomName),
        new Promise((_, reject) => setTimeout(() => reject(new Error('LiveKit participants lookup timed out')), AI_NOTES_PARTICIPANT_LOOKUP_TIMEOUT_MS)),
      ]);
      const recordings = await Promise.all((participants || []).flatMap((participant) => {
        const tracks = participant.tracks || participant.trackPublications || [];
        return tracks.filter(isMicrophoneTrack).map((track) => startRecordingForTrack(callId, participant, track));
      }));
      const failedNotes = aiNotesByCallStmt.get(callId);
      if (failedNotes?.status === 'error') {
        console.warn('[calls] AI notes recording start failed:', failedNotes.error || 'unknown error');
        return;
      }
      if (!recordings.some(Boolean)) {
        console.warn('[calls] AI notes started without active microphone tracks', { callId, room: roomName, attempt });
      }
    } catch (error) {
      const message = error.message || 'Could not start AI notes';
      if (attempt < AI_NOTES_START_RETRIES) {
        console.warn('[calls] AI notes participant lookup failed, retrying:', message);
        setTimeout(() => {
          startExistingMicrophoneRecordingsForCall(callId, roomName, attempt + 1).catch((retryError) => {
            console.warn('[calls] AI notes retry failed:', retryError.message || retryError);
          });
        }, AI_NOTES_START_RETRY_MS).unref?.();
        return;
      }
      console.warn('[calls] AI notes participant lookup failed:', message);
      updateAiNotesStatusStmt.run('error', 'error', new Date().toISOString(), message, callId);
      broadcastAiNotesUpdated(callId);
    }
  }

  async function stopRecording(recording) {
    if (!recording || recording.status !== 'recording') return;
    const egressId = String(recording.egress_id || '');
    if (!egressId) {
      updateRecordingEndedStmt.run('error', new Date().toISOString(), null, null, '', 'Recording did not receive an egress id', recording.id);
      return;
    }
    try {
      const client = livekitEgressClient();
      if (!client) throw new Error('LiveKit Egress is not configured');
      await client.stopEgress(egressId);
    } catch (error) {
      const message = String(error?.message || '');
      if (!/not found|does not exist|already.*ended|egress.*ended/i.test(message)) {
        console.warn('[calls] LiveKit egress stop failed:', message || error);
      }
    }
  }

  function stopActiveRecordingsForCall(callId) {
    activeRecordingsForCallStmt.all(callId).forEach((recording) => {
      stopRecording(recording).catch((error) => {
        console.warn('[calls] recording stop failed:', error.message);
      });
    });
  }

  function maybeCompleteTranscript(callId) {
    const notes = aiNotesByCallStmt.get(callId);
    if (!notes || !['processing', 'recording'].includes(notes.status)) return;
    const counts = recordingCountsStmt.get(callId) || {};
    if (Number(counts.recording || 0) > 0 || Number(counts.processing || 0) > 0) return;
    const transcript = transcriptTextForCall(callId);
    if (transcript.trim()) {
      const timingApproximate = transcriptSegmentsStmt.all(callId).some((row) => Number(row.timing_approximate) !== 0) ? 1 : 0;
      updateAiNotesTranscriptStmt.run('completed', 'completed', transcript, '', timingApproximate, callId);
    } else if (Number(counts.total || 0) <= 0) {
      updateAiNotesTranscriptStmt.run('error', 'error', '', 'No microphone tracks were recorded', 1, callId);
    } else if (Number(counts.errors || 0) > 0) {
      updateAiNotesTranscriptStmt.run('error', 'error', '', 'Transcription failed for every recording', 1, callId);
    } else {
      updateAiNotesTranscriptStmt.run('completed', 'completed', '', '', 1, callId);
    }
    broadcastAiNotesUpdated(callId);
  }

  async function processRecordingTranscript({ recordingId }) {
    const recording = db.prepare('SELECT * FROM call_recordings WHERE id=?').get(recordingId);
    if (!recording || recording.status === 'completed') return;
    const filepath = path.resolve(recording.file_path || '');
    if (!filepath || !fs.existsSync(filepath)) {
      console.warn('[calls] transcript failed: recording file not found', {
        recordingId,
        callId: recording?.call_id,
        filePath: recording?.file_path || '',
      });
      updateRecordingTranscriptStmt.run('error', '', '', '', 'Recording file not found', recording.id);
      maybeCompleteTranscript(recording.call_id);
      return;
    }
    updateRecordingEndedStmt.run('processing', recording.ended_at || new Date().toISOString(), recording.duration_ms || null, recording.size_bytes || null, '', '', recording.id);
    const callSettings = getCallSettings(db);
    const voiceSettings = getVoiceSettings(db);
    const settings = {
      ...voiceSettings,
      active_provider: callSettings.call_transcription_provider === 'voice'
        ? voiceSettings.active_provider
        : callSettings.call_transcription_provider,
    };
    console.info('[calls] transcript started:', {
      recordingId: recording.id,
      callId: recording.call_id,
      userId: recording.user_id,
      provider: settings.active_provider,
      filePath: filepath,
    });
    try {
      deleteSegmentsForRecordingStmt.run(recording.id);
      const chunks = splitRecordingIntoChunks(filepath, recording.id);
      const participant = participantStmt.get(recording.call_id, recording.user_id) || userStmt.get(recording.user_id);
      const speaker = participant?.display_name || participant?.username || `User ${recording.user_id}`;
      const callRow = callByIdStmt.get(recording.call_id);
      const callStart = parseTimeMs(callRow?.started_at);
      const recordingStart = parseTimeMs(recording.started_at) || callStart;
      const baseStartMs = callStart && recordingStart ? Math.max(0, recordingStart - callStart) : 0;
      const texts = [];
      let provider = settings.active_provider;
      let model = '';
      for (const chunk of chunks) {
        console.info('[calls] transcript chunk:', {
          recordingId: recording.id,
          provider,
          filePath: chunk.filePath,
          offsetMs: chunk.offsetMs || 0,
        });
        const result = await transcribeAudio({
          filePath: chunk.filePath,
          settings,
          apiKey: getVoiceOpenAIKey(db, secret),
          grokApiKey: getVoiceGrokKey(db, secret),
        });
        const text = String(result.text || '').trim();
        provider = result.provider || provider;
        model = result.model || model;
        if (!text) continue;
        texts.push(text);
        const startMs = baseStartMs + Number(chunk.offsetMs || 0);
        const chunkDuration = Math.min(
          Math.max(0, Number(getCallSettings(db).call_transcription_chunk_minutes || 12) * 60 * 1000),
          Math.max(0, Number(recording.duration_ms || 0) - Number(chunk.offsetMs || 0))
        );
        insertTranscriptSegmentStmt.run(
          recording.call_id,
          recording.id,
          recording.user_id,
          speaker,
          startMs,
          chunkDuration > 0 ? startMs + chunkDuration : startMs,
          text,
          1
        );
      }
      updateRecordingTranscriptStmt.run('completed', texts.join('\n').trim(), provider, model, '', recording.id);
      console.info('[calls] transcript completed:', {
        recordingId: recording.id,
        callId: recording.call_id,
        provider,
        model,
        textLength: texts.join('\n').trim().length,
      });
    } catch (error) {
      console.warn('[calls] transcript failed:', {
        recordingId: recording.id,
        callId: recording.call_id,
        provider: settings.active_provider,
        error: error.message || String(error || ''),
      });
      updateRecordingTranscriptStmt.run(
        'error',
        '',
        settings.active_provider,
        settings.active_provider === 'openai' ? settings.openai_model : (settings.active_provider === 'grok' ? 'speech-to-text' : settings.vosk_model),
        error.message || 'Transcription failed',
        recording.id
      );
    }
    maybeCompleteTranscript(recording.call_id);
  }

  function enqueueRecordingTranscription(recordingId) {
    const queued = transcriptQueue.enqueue(`call-recording:${recordingId}`, { recordingId });
    console.info('[calls] transcript queued:', { recordingId, queued });
  }

  function handleEgressEnded(egressInfo = {}) {
    const egressId = String(egressInfo.egressId || egressInfo.egress_id || '');
    if (!egressId) {
      console.warn('[calls] egress ended without egress id');
      return;
    }
    const recording = recordingByEgressStmt.get(egressId);
    if (!recording) {
      console.warn('[calls] egress ended for unknown recording:', egressId);
      return;
    }
    const file = fileInfoFromEgress(egressInfo);
    const resolvedFilePath = file.path && (path.isAbsolute(file.path) || fs.existsSync(file.path))
      ? file.path
      : recording.file_path;
    console.info('[calls] egress ended:', {
      egressId,
      recordingId: recording.id,
      callId: recording.call_id,
      filePath: resolvedFilePath,
      error: egressInfo.error || '',
    });
    updateRecordingEndedStmt.run(
      egressInfo.error ? 'error' : 'processing',
      file.endedAt || new Date().toISOString(),
      file.durationMs,
      file.sizeBytes,
      resolvedFilePath,
      egressInfo.error || '',
      recording.id
    );
    if (egressInfo.error) {
      maybeCompleteTranscript(recording.call_id);
      return;
    }
    updateAiNotesStatusStmt.run('processing', 'processing', file.endedAt || new Date().toISOString(), '', recording.call_id);
    broadcastAiNotesUpdated(recording.call_id);
    enqueueRecordingTranscription(recording.id);
  }

  function splitRecordingIntoChunks(filePath, recordingId) {
    const settings = getCallSettings(db);
    const maxBytes = Math.max(1, Number(settings.call_transcription_max_chunk_mb || 24)) * 1024 * 1024;
    const stat = fs.statSync(filePath);
    if (stat.size <= maxBytes) return [{ filePath, offsetMs: 0, temp: false }];

    const chunkSeconds = Math.max(60, Number(settings.call_transcription_chunk_minutes || 12) * 60);
    const ext = path.extname(filePath) || '.ogg';
    const dir = path.join(path.dirname(filePath), `chunks-${recordingId}`);
    fs.mkdirSync(dir, { recursive: true });
    const pattern = path.join(dir, `chunk-%03d${ext}`);
    const result = spawnSync('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-i',
      filePath,
      '-f',
      'segment',
      '-segment_time',
      String(chunkSeconds),
      '-c',
      'copy',
      pattern,
    ], { encoding: 'utf8' });
    if (result.error) throw new Error(`ffmpeg is required for large call recordings: ${result.error.message}`);
    if (result.status !== 0) throw new Error(`ffmpeg split failed: ${result.stderr || result.stdout || 'unknown error'}`);
    const files = fs.readdirSync(dir)
      .filter((name) => name.startsWith('chunk-'))
      .sort()
      .map((name, index) => ({ filePath: path.join(dir, name), offsetMs: index * chunkSeconds * 1000, temp: true }));
    if (!files.length) throw new Error('ffmpeg did not create transcription chunks');
    return files;
  }

  async function createTokenForCall(call, user) {
    const config = livekitConfig();
    const settings = getCallSettings(db);
    const canPublishSources = [TrackSource.CAMERA, TrackSource.MICROPHONE];
    if (settings.screen_share_enabled) {
      canPublishSources.push(TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO);
    }
    const token = new AccessToken(config.apiKey, config.apiSecret, {
      identity: `user:${user.id}:${randomUUID()}`,
      name: user.display_name || user.username || `User ${user.id}`,
      ttl: CALL_TOKEN_TTL_SECONDS,
      metadata: JSON.stringify({ callId: call.id, chatId: call.chat_id, userId: user.id }),
    });
    token.addGrant({
      roomJoin: true,
      room: call.livekit_room_name,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
      canUpdateOwnMetadata: false,
      canPublishSources,
    });
    return token.toJwt();
  }

  function validateChatForCall(chat, members, userId, res) {
    const settings = getCallSettings(db);
    if (!chat) return boolError(res, 404, 'Chat not found', 'chat_not_found');
    if (!isMember(chat.id, userId)) return boolError(res, 403, 'Forbidden', 'forbidden');
    if (Number(chat.is_notes) !== 0) return boolError(res, 403, 'Calls are unavailable in notes chats', 'notes_chat');
    if (chat.type === 'private' && !settings.allow_private_calls) {
      return boolError(res, 403, 'Private calls are disabled', 'private_calls_disabled');
    }
    if (chat.type === 'group' && !settings.allow_group_calls) {
      return boolError(res, 403, 'Group calls are disabled', 'group_calls_disabled');
    }
    if (!['private', 'group'].includes(chat.type)) {
      return boolError(res, 403, 'Calls are unavailable in this chat', 'unsupported_chat');
    }
    const humanMembers = members.filter((member) => Number(member.is_ai_bot) === 0);
    if (chat.type === 'private' && humanMembers.length < 2) {
      return boolError(res, 403, 'Calls are unavailable in AI chats', 'ai_private_chat');
    }
    if (humanMembers.length < 2) {
      return boolError(res, 403, 'Calls need at least two human members', 'not_enough_members');
    }
    if (humanMembers.length > settings.max_call_participants) {
      return boolError(res, 403, 'Too many participants for a call', 'too_many_call_participants');
    }
    return null;
  }

  const createCallTx = db.transaction(({ chat, members, user, roomName, ringExpiresAt, settings }) => {
    const inserted = db.prepare(`
      INSERT INTO call_sessions(chat_id, livekit_room_name, status, started_by, ring_expires_at)
      VALUES(?, ?, 'active', ?, ?)
    `).run(chat.id, roomName, user.id, ringExpiresAt);
    const callId = Number(inserted.lastInsertRowid);
    const finalRoomName = `bananza-call-${callId}`;
    db.prepare('UPDATE call_sessions SET livekit_room_name=?, updated_at=datetime(\'now\') WHERE id=?')
      .run(finalRoomName, callId);
    const insertParticipant = db.prepare(`
      INSERT INTO call_participants(call_id, user_id, state, joined_at, updated_at)
      VALUES(?, ?, ?, CASE WHEN ?='joined' THEN datetime('now') ELSE NULL END, datetime('now'))
    `);
    members
      .filter((member) => Number(member.is_ai_bot) === 0)
      .forEach((member) => {
        const state = 'invited';
        insertParticipant.run(callId, member.id, state, state);
      });
    let messageId = null;
    if (settings.call_messages_enabled) {
      const message = insertMessageStmt.run(chat.id, user.id, 'Video call');
      messageId = Number(message.lastInsertRowid);
      insertCallMessageStmt.run(messageId, callId, user.id);
      db.prepare('UPDATE call_sessions SET message_id=?, updated_at=datetime(\'now\') WHERE id=?')
        .run(messageId, callId);
    }
    return { callId, messageId };
  });

  function expireRingingCalls() {
    let changed = 0;
    const now = Date.now();
    const markMissed = db.prepare(`
      UPDATE call_participants
      SET state='missed', updated_at=datetime('now')
      WHERE call_id=? AND state='invited'
    `);
    const clearRing = db.prepare(`
      UPDATE call_sessions
      SET ring_expires_at=NULL, updated_at=datetime('now')
      WHERE id=? AND status='active'
    `);

    activeCallsStmt.all().forEach((row) => {
      const expiresAt = parseTimeMs(row.ring_expires_at);
      if (!expiresAt || expiresAt > now) return;
      markMissed.run(row.id);
      const joinedTotal = Number(joinedHumanCountStmt.get(row.id)?.total || 0);
      if ((row.chat_type === 'private' && joinedTotal < 2) || joinedTotal <= 0) {
        endCall(row.id, null, 'missed');
        changed += 1;
        return;
      }
      clearRing.run(row.id);
      const call = getCall(row.id);
      if (call) {
        broadcastCall(row.chat_id, { type: 'call_updated', call });
        broadcastCallMessageUpdated(call);
      }
      changed += 1;
    });
    return changed;
  }

  async function reconcileLiveKitRooms() {
    const config = livekitConfig();
    if (!config.ready) return 0;
    const rows = activeCallsStmt.all();
    if (!rows.length) return 0;
    const minAgeMs = Math.max(CALL_RECONCILE_MIN_AGE_MS, getCallSettings(db).ring_timeout_ms + 30_000);
    const client = livekitRoomClient();
    if (typeof client.listParticipants !== 'function') return 0;
    let ended = 0;
    for (const row of rows) {
      const startedAt = parseTimeMs(row.started_at);
      if (startedAt && Date.now() - startedAt < minAgeMs) continue;
      try {
        const participants = await Promise.race([
          client.listParticipants(row.livekit_room_name),
          new Promise((_, reject) => setTimeout(() => reject(new Error('LiveKit reconcile timed out')), TEST_ROOM_TIMEOUT_MS)),
        ]);
        if (Array.isArray(participants) && participants.length === 0) {
          endCall(row.id, null, 'stale_empty');
          ended += 1;
          continue;
        }
        if (Array.isArray(participants)) {
          const liveUserIds = new Set(participants.map(userIdFromLiveKitParticipant).filter(Boolean));
          participantsStmt.all(row.id)
            .filter((participant) => participant.state === 'joined' && !liveUserIds.has(Number(participant.user_id)))
            .forEach((participant) => participantState(row.id, participant.user_id, 'left'));
        }
      } catch (error) {
        const message = String(error?.message || '');
        if (/not found|does not exist|room.*missing/i.test(message)) {
          endCall(row.id, null, 'stale_empty');
          ended += 1;
        }
      }
    }
    return ended;
  }

  const ringTimer = setInterval(() => {
    try {
      expireRingingCalls();
    } catch (error) {
      console.warn('[calls] ring timeout worker failed:', error.message);
    }
  }, CALL_RING_WORKER_MS);
  ringTimer.unref?.();

  const reconcileTimer = setInterval(() => {
    reconcileLiveKitRooms().catch((error) => {
      console.warn('[calls] LiveKit reconciliation failed:', error.message);
    });
  }, CALL_RECONCILE_WORKER_MS);
  reconcileTimer.unref?.();

  app.get('/api/calls/active', auth, (req, res) => {
    res.json({
      settings: publicSettings(),
      calls: activeCallsForUserStmt.all(req.user.id).map(serializeCall),
    });
  });

  app.get('/api/chats/:chatId/calls/active', auth, (req, res) => {
    const chatId = normalizeId(req.params.chatId);
    if (!chatId || !isMember(chatId, req.user.id)) return boolError(res, 403, 'Forbidden', 'forbidden');
    res.json({
      settings: publicSettings(),
      call: serializeCall(activeCallByChatStmt.get(chatId)),
    });
  });

  app.post('/api/chats/:chatId/calls', auth, callLimiter, (req, res) => {
    if (!assertCallsAvailable(res)) return;
    const chatId = normalizeId(req.params.chatId);
    const chat = chatStmt.get(chatId);
    const members = membersStmt.all(chatId);
    const validationError = validateChatForCall(chat, members, req.user.id, res);
    if (validationError) return;
    const existing = activeCallByChatStmt.get(chatId);
    if (existing) return boolError(res, 409, 'Call already active', 'call_already_active');

    const settings = getCallSettings(db);
    const ringExpiresAt = new Date(Date.now() + settings.ring_timeout_ms).toISOString();
    let callId;
    let messageId;
    try {
      const created = createCallTx({
        chat,
        members,
        user: req.user,
        roomName: `bananza-call-pending-${randomUUID()}`,
        ringExpiresAt,
        settings,
      });
      callId = created.callId;
      messageId = created.messageId;
    } catch (error) {
      if (String(error?.message || '').includes('idx_call_sessions_active_chat')) {
        return boolError(res, 409, 'Call already active', 'call_already_active');
      }
      throw error;
    }

    const call = getCall(callId);
    if (messageId) broadcastCallMessageCreated(messageId);
    broadcastCall(chatId, { type: 'call_updated', call });
    const actorName = req.user.display_name || req.user.username || 'User';
    call.participants
      .filter((participant) => participant.state === 'invited')
      .forEach((participant) => {
        sendToUser(participant.user_id, { type: 'call_invite', call, actor: { id: req.user.id, name: actorName } });
        notifyCallInvite?.(participant.user_id, { call, chat, actorName });
      });
    res.status(201).json({ call });
  });

  app.post('/api/calls/:callId/token', auth, callLimiter, async (req, res) => {
    if (!assertCallsAvailable(res)) return;
    const callId = normalizeId(req.params.callId);
    const call = callByIdStmt.get(callId);
    if (!call || call.status !== 'active') return boolError(res, 404, 'Call not found', 'call_not_found');
    if (!isMember(call.chat_id, req.user.id)) return boolError(res, 403, 'Forbidden', 'forbidden');
    if (!hasParticipant(callId, req.user.id)) return boolError(res, 403, 'Not invited to this call', 'not_call_participant');
    const updatedCall = getCall(callId);
    const token = await createTokenForCall(updatedCall, req.user);
    res.json({
      call: updatedCall,
      livekit: {
        url: livekitConfig().wsUrl,
        token,
      },
    });
  });

  app.post('/api/calls/:callId/joined', auth, callLimiter, (req, res) => {
    const callId = normalizeId(req.params.callId);
    const row = callByIdStmt.get(callId);
    if (!row || row.status !== 'active') return boolError(res, 404, 'Call not found', 'call_not_found');
    if (!isMember(row.chat_id, req.user.id)) return boolError(res, 403, 'Forbidden', 'forbidden');
    if (!hasParticipant(callId, req.user.id)) return boolError(res, 403, 'Not invited to this call', 'not_call_participant');
    res.json({ call: participantJoined(callId, req.user.id) });
  });

  app.post('/api/calls/:callId/decline', auth, callLimiter, (req, res) => {
    const callId = normalizeId(req.params.callId);
    const row = callByIdStmt.get(callId);
    if (!row || row.status !== 'active') return boolError(res, 404, 'Call not found', 'call_not_found');
    if (!isMember(row.chat_id, req.user.id)) return boolError(res, 403, 'Forbidden', 'forbidden');
    let call = participantState(callId, req.user.id, 'declined');
    if (row.chat_type === 'private') call = endCall(callId, req.user.id, 'declined');
    else broadcastCall(row.chat_id, { type: 'call_updated', call });
    res.json({ call });
  });

  app.post('/api/calls/:callId/leave', auth, callLimiter, (req, res) => {
    const callId = normalizeId(req.params.callId);
    const row = callByIdStmt.get(callId);
    if (!row) return boolError(res, 404, 'Call not found', 'call_not_found');
    if (!isMember(row.chat_id, req.user.id)) return boolError(res, 403, 'Forbidden', 'forbidden');
    if (row.status !== 'active') return res.json({ call: serializeCall(row) });
    const call = participantLeft(callId, req.user.id);
    if (call?.status === 'active') broadcastCall(row.chat_id, { type: 'call_updated', call });
    res.json({ call });
  });

  app.post('/api/calls/:callId/end', auth, callLimiter, (req, res) => {
    const callId = normalizeId(req.params.callId);
    const row = callByIdStmt.get(callId);
    if (!row || row.status !== 'active') return boolError(res, 404, 'Call not found', 'call_not_found');
    if (!isMember(row.chat_id, req.user.id)) return boolError(res, 403, 'Forbidden', 'forbidden');
    const call = endCall(callId, req.user.id, 'ended');
    res.json({ call });
  });

  app.post('/api/calls/:callId/ai-notes/start', auth, callLimiter, async (req, res) => {
    if (!assertCallsAvailable(res)) return;
    const settings = getCallSettings(db);
    if (!settings.call_ai_notes_enabled) return boolError(res, 403, 'AI notes are disabled', 'ai_notes_disabled');
    const callId = normalizeId(req.params.callId);
    const row = callByIdStmt.get(callId);
    if (!row || row.status !== 'active') return boolError(res, 404, 'Call not found', 'call_not_found');
    if (!isMember(row.chat_id, req.user.id)) return boolError(res, 403, 'Forbidden', 'forbidden');
    if (!hasParticipant(callId, req.user.id)) return boolError(res, 403, 'Not invited to this call', 'not_call_participant');
    if (aiNotesByCallStmt.get(callId)?.status === 'recording') return res.json({ call: getCall(callId) });

    insertAiNotesStmt.run(callId, req.user.id);
    const call = broadcastAiNotesUpdated(callId) || getCall(callId);
    startExistingMicrophoneRecordingsForCall(callId, row.livekit_room_name).catch((error) => {
      console.warn('[calls] AI notes start failed:', error.message || error);
      updateAiNotesStatusStmt.run('error', 'error', new Date().toISOString(), error.message || 'Could not start AI notes', callId);
      broadcastAiNotesUpdated(callId);
    });
    res.json({ call });
  });

  app.post('/api/calls/:callId/ai-notes/local-track', auth, callLimiter, async (req, res) => {
    const callId = normalizeId(req.params.callId);
    const row = callByIdStmt.get(callId);
    if (!row || row.status !== 'active') return boolError(res, 404, 'Call not found', 'call_not_found');
    if (!isMember(row.chat_id, req.user.id)) return boolError(res, 403, 'Forbidden', 'forbidden');
    if (!hasParticipant(callId, req.user.id)) return boolError(res, 403, 'Not invited to this call', 'not_call_participant');
    const notes = activeAiNotesStmt.get(callId);
    if (!notes) return res.json({ call: getCall(callId), recording: null });
    const trackId = String(req.body?.track_id || req.body?.trackId || '').trim();
    if (!/^TR_[a-zA-Z0-9_-]+$/.test(trackId)) return boolError(res, 400, 'Invalid microphone track id', 'invalid_track_id');
    const info = await startRecordingForTrack(
      callId,
      {
        identity: `user:${req.user.id}`,
        participantIdentity: `user:${req.user.id}`,
        metadata: JSON.stringify({ userId: req.user.id, callId, chatId: row.chat_id }),
      },
      {
        sid: trackId,
        id: trackId,
        source: TrackSource.MICROPHONE,
        type: 0,
        kind: 'audio',
      }
    );
    res.json({ call: getCall(callId), recording: info ? { egress_id: String(info.egressId || '') } : null });
  });

  app.post('/api/calls/:callId/ai-notes/cancel', auth, callLimiter, (req, res) => {
    const callId = normalizeId(req.params.callId);
    const row = callByIdStmt.get(callId);
    if (!row) return boolError(res, 404, 'Call not found', 'call_not_found');
    if (!isMember(row.chat_id, req.user.id)) return boolError(res, 403, 'Forbidden', 'forbidden');
    stopActiveRecordingsForCall(callId);
    updateAiNotesStatusStmt.run('canceled', 'canceled', new Date().toISOString(), '', callId);
    res.json({ call: broadcastAiNotesUpdated(callId) || getCall(callId) });
  });

  app.post('/api/calls/:callId/ai-notes/retry', auth, callLimiter, (req, res) => {
    const callId = normalizeId(req.params.callId);
    const row = callByIdStmt.get(callId);
    if (!row) return boolError(res, 404, 'Call not found', 'call_not_found');
    if (!isMember(row.chat_id, req.user.id)) return boolError(res, 403, 'Forbidden', 'forbidden');
    updateAiNotesStatusStmt.run('processing', 'processing', null, '', callId);
    retryableRecordingsStmt.all(callId).forEach((recording) => enqueueRecordingTranscription(recording.id));
    maybeCompleteTranscript(callId);
    res.json({ call: broadcastAiNotesUpdated(callId) || getCall(callId) });
  });

  app.get('/api/calls/:callId/transcript', auth, (req, res) => {
    const callId = normalizeId(req.params.callId);
    const row = callByIdStmt.get(callId);
    if (!row) return boolError(res, 404, 'Call not found', 'call_not_found');
    if (!isMember(row.chat_id, req.user.id)) return boolError(res, 403, 'Forbidden', 'forbidden');
    const notes = aiNotesByCallStmt.get(callId);
    const segments = transcriptSegmentsStmt.all(callId).map((segment) => ({
      id: Number(segment.id),
      user_id: Number(segment.user_id),
      speaker_name: segment.speaker_name || segment.display_name || segment.username || 'User',
      start_ms: Number(segment.start_ms || 0),
      end_ms: Number(segment.end_ms || 0),
      text: segment.text || '',
      timing_approximate: Number(segment.timing_approximate) !== 0,
    }));
    res.json({
      call: serializeCall(row),
      ai_notes: serializeAiNotes(notes),
      transcript_text: notes?.transcript_text || transcriptTextForCall(callId),
      segments,
    });
  });

  app.get('/api/admin/call-settings', auth, adminOnly, (_req, res) => {
    const config = livekitConfig();
    res.json({
      settings: getCallSettings(db),
      livekit_ready: config.ready,
      livekit_ws_url_present: config.wsUrlPresent,
      livekit_ws_url: config.wsUrl ? config.wsUrl.replace(/\/\/.*@/, '//') : '',
      livekit_config: getAdminLiveKitConfig(db, secret, process.env),
    });
  });

  app.put('/api/admin/call-settings', auth, adminOnly, (req, res) => {
    const before = getCallSettings(db);
    const beforeConfig = livekitConfig();
    const settings = setCallSettings(db, req.body || {});
    setLiveKitConfig(db, req.body || {}, secret);
    let ended = 0;
    const config = livekitConfig();
    if (before.calls_enabled && !settings.calls_enabled) {
      ended = endAllActiveCalls('disabled');
    } else if (settings.calls_enabled && beforeConfig.ready && !config.ready) {
      ended = endAllActiveCalls('livekit_unconfigured');
    }
    const publicPayload = publicSettings();
    broadcastAll({ type: 'call_settings_updated', settings: publicPayload });
    res.json({
      settings,
      publicSettings: publicPayload,
      livekit_ready: config.ready,
      livekit_ws_url_present: config.wsUrlPresent,
      livekit_config: getAdminLiveKitConfig(db, secret, process.env),
      ended_calls: ended,
    });
  });

  app.post('/api/livekit/webhook', express.raw({ type: 'application/webhook+json', limit: '1mb' }), async (req, res) => {
    const config = livekitConfig();
    if (!config.ready) return boolError(res, 503, 'LiveKit is not configured', 'livekit_not_configured');
    try {
      const rawBody = req.rawBody || req.body;
      const body = Buffer.isBuffer(rawBody)
        ? rawBody.toString('utf8')
        : (typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody || {}));
      const receiver = new WebhookReceiver(config.apiKey, config.apiSecret);
      const event = await receiver.receive(body, req.get('Authorization') || req.get('Authorize'));
      if (getCallSettings(db).call_ai_notes_enabled) {
        console.info('[calls] LiveKit webhook received:', event.event || 'unknown');
      }
      handleLiveKitWebhook(event);
      res.json({ ok: true });
    } catch (error) {
      console.warn('[calls] Invalid LiveKit webhook:', error.message || error);
      res.status(401).json({ error: 'Invalid LiveKit webhook', code: 'invalid_livekit_webhook' });
    }
  });

  function handleLiveKitWebhook(event = {}) {
    if (event.event === 'egress_ended' || event.event === 'egress_updated') {
      const info = event.egressInfo || event.egress_info || {};
      if (event.event === 'egress_ended') handleEgressEnded(info);
      return null;
    }
    const roomName = event.room?.name || event.roomName || '';
    const row = roomName ? callByRoomStmt.get(roomName) : null;
    if (!row || row.status !== 'active') return null;
    const userId = userIdFromLiveKitParticipant(event.participant || { participantIdentity: event.participantIdentity });
    if (event.event === 'participant_joined' && userId) return participantJoined(row.id, userId);
    if (event.event === 'track_published') {
      startRecordingForTrack(row.id, event.participant || {}, event.track || {}).catch((error) => {
        console.warn('[calls] AI notes track recording failed:', error.message);
      });
      return getCall(row.id);
    }
    if (event.event === 'track_unpublished') {
      const trackId = String(event.track?.sid || event.track?.id || event.track?.trackSid || '').trim();
      const recording = trackId ? recordingByTrackStmt.get(row.id, trackId) : null;
      if (recording) stopRecording(recording).catch((error) => {
        console.warn('[calls] AI notes track stop failed:', error.message);
      });
      return getCall(row.id);
    }
    if ((event.event === 'participant_left' || event.event === 'participant_connection_aborted') && userId) {
      return participantLeft(row.id, userId);
    }
    if (event.event === 'room_finished') return endCall(row.id, null, 'livekit_room_finished');
    return getCall(row.id);
  }

  app.post('/api/admin/call-settings/test', auth, adminOnly, callLimiter, async (_req, res) => {
    const config = livekitConfig();
    if (!config.ready) return boolError(res, 503, 'LiveKit is not configured', 'livekit_not_configured');
    const roomName = `bananza-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const token = new AccessToken(config.apiKey, config.apiSecret, {
      identity: `admin-test:${Date.now()}`,
      name: 'BananZa admin test',
      ttl: 60,
    });
    token.addGrant({ roomCreate: true, roomJoin: true, room: roomName });
    const jwt = await token.toJwt();
    const client = new RoomServiceClient(liveKitHttpUrl(config.wsUrl), config.apiKey, config.apiSecret);
    try {
      let recordingPathReady = false;
      let recordingPath = '';
      let recordingPathError = '';
      try {
        recordingPath = checkRecordingPath();
        recordingPathReady = true;
      } catch (error) {
        recordingPath = recordingRoot();
        recordingPathError = error.message || 'Recording path is not writable';
      }
      await Promise.race([
        client.createRoom({ name: roomName, emptyTimeout: 30, departureTimeout: 10 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('LiveKit test timed out')), TEST_ROOM_TIMEOUT_MS)),
      ]);
      let egressReady = false;
      let egressError = '';
      try {
        const egressClient = livekitEgressClient();
        await Promise.race([
          egressClient.listEgress({ roomName, active: true }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('LiveKit Egress test timed out')), TEST_ROOM_TIMEOUT_MS)),
        ]);
        egressReady = true;
      } catch (error) {
        egressError = error.message || 'LiveKit Egress test failed';
      }
      client.deleteRoom(roomName).catch(() => {});
      res.json({
        ok: true,
        token_generated: Boolean(jwt),
        room_created: true,
        egress_ready: egressReady,
        egress_error: egressError,
        recording_path_ready: recordingPathReady,
        recording_path: recordingPath,
        recording_path_error: recordingPathError,
      });
    } catch (error) {
      res.status(502).json({
        ok: false,
        token_generated: Boolean(jwt),
        room_created: false,
        error: error.message || 'LiveKit test failed',
      });
    }
  });

  return {
    getPublicSettings: publicSettings,
    getSettings: () => getCallSettings(db),
    endAllActiveCalls,
    attachCallMetadata,
    serializeCall,
    getCall,
    stopWorkers: () => {
      clearInterval(ringTimer);
      clearInterval(reconcileTimer);
    },
    _private: {
      createTokenForCall,
      livekitConfig,
      livekitRoomClient,
      validateChatForCall,
      expireRingingCalls,
      reconcileLiveKitRooms,
      handleLiveKitWebhook,
      participantJoined,
      participantLeft,
      endCall,
      attachCallMetadata,
    },
  };
}

module.exports = {
  createCallFeature,
};
