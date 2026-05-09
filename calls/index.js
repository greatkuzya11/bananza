const { randomUUID } = require('crypto');
const { AccessToken, RoomServiceClient } = require('livekit-server-sdk');
const { TrackSource } = require('@livekit/protocol');
const {
  getCallSettings,
  setCallSettings,
  getLiveKitConfig,
  getAdminLiveKitConfig,
  setLiveKitConfig,
  getPublicCallSettings,
  liveKitHttpUrl,
} = require('./settings');

const CALL_TOKEN_TTL_SECONDS = 60 * 60 * 2;
const TEST_ROOM_TIMEOUT_MS = 4000;

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
  secret = '',
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

  function livekitConfig() {
    return getLiveKitConfig(db, secret, process.env);
  }

  function publicSettings() {
    return getPublicCallSettings(db, secret, process.env);
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

  function serializeCall(row) {
    if (!row) return null;
    const participants = participantsStmt.all(row.id).map(serializeParticipant);
    return {
      id: Number(row.id),
      chat_id: Number(row.chat_id),
      chatId: Number(row.chat_id),
      chat_name: row.chat_name || '',
      chat_type: row.chat_type || '',
      livekit_room_name: row.livekit_room_name,
      status: row.status,
      started_by: Number(row.started_by),
      started_by_name: row.started_by_name || row.started_by_username || 'User',
      started_at: row.started_at,
      ended_at: row.ended_at || null,
      ended_by: row.ended_by ? Number(row.ended_by) : null,
      ring_expires_at: row.ring_expires_at || null,
      participants,
      participant_count: participants.filter((item) => item.state === 'joined').length,
    };
  }

  function getCall(callId) {
    return serializeCall(callByIdStmt.get(callId));
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

  function endCall(callId, endedBy = null, reason = 'ended') {
    const row = callByIdStmt.get(callId);
    if (!row || row.status !== 'active') return serializeCall(row);
    db.prepare(`
      UPDATE call_sessions
      SET status='ended', ended_by=?, ended_at=datetime('now'), updated_at=datetime('now')
      WHERE id=? AND status='active'
    `).run(endedBy || null, callId);
    db.prepare(`
      UPDATE call_participants
      SET state=CASE WHEN state='joined' THEN 'left' WHEN state='invited' THEN 'missed' ELSE state END,
        left_at=CASE WHEN state='joined' AND left_at IS NULL THEN datetime('now') ELSE left_at END,
        updated_at=datetime('now')
      WHERE call_id=?
    `).run(callId);
    const call = getCall(callId);
    if (call) broadcastCall(call.chat_id, { type: 'call_ended', call, reason });
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
    }
    return call;
  }

  async function createTokenForCall(call, user) {
    const config = livekitConfig();
    const token = new AccessToken(config.apiKey, config.apiSecret, {
      identity: `user:${user.id}`,
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
      canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE],
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
    return null;
  }

  const createCallTx = db.transaction(({ chat, members, user, roomName, ringExpiresAt }) => {
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
        const state = Number(member.id) === Number(user.id) ? 'joined' : 'invited';
        insertParticipant.run(callId, member.id, state, state);
      });
    return callId;
  });

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

    const ringExpiresAt = new Date(Date.now() + getCallSettings(db).ring_timeout_ms).toISOString();
    let callId;
    try {
      callId = createCallTx({
        chat,
        members,
        user: req.user,
        roomName: `bananza-call-pending-${randomUUID()}`,
        ringExpiresAt,
      });
    } catch (error) {
      if (String(error?.message || '').includes('idx_call_sessions_active_chat')) {
        return boolError(res, 409, 'Call already active', 'call_already_active');
      }
      throw error;
    }

    const call = getCall(callId);
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
    participantState(callId, req.user.id, 'joined');
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
    if (!row || row.status !== 'active') return boolError(res, 404, 'Call not found', 'call_not_found');
    if (!isMember(row.chat_id, req.user.id)) return boolError(res, 403, 'Forbidden', 'forbidden');
    participantState(callId, req.user.id, 'left');
    const call = maybeEndWhenEmpty(callId);
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
    const settings = setCallSettings(db, req.body || {});
    setLiveKitConfig(db, req.body || {}, secret);
    let ended = 0;
    if (before.calls_enabled && !settings.calls_enabled) {
      ended = endAllActiveCalls('disabled');
    }
    const config = livekitConfig();
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
      await Promise.race([
        client.createRoom({ name: roomName, emptyTimeout: 30, departureTimeout: 10 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('LiveKit test timed out')), TEST_ROOM_TIMEOUT_MS)),
      ]);
      client.deleteRoom(roomName).catch(() => {});
      res.json({ ok: true, token_generated: Boolean(jwt), room_created: true });
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
    serializeCall,
    getCall,
    _private: {
      createTokenForCall,
      livekitConfig,
      validateChatForCall,
    },
  };
}

module.exports = {
  createCallFeature,
};
