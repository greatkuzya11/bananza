const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const {
  getVoiceSettings,
  getAdminVoiceSettings,
  getPublicVoiceSettings,
  getOpenAIKey,
  getGrokKey,
  setVoiceSettings,
  deleteOpenAIKey,
  deleteGrokKey,
  updateLastModelTest,
  buildDraftSettings,
  VOICE_SETTINGS_OPTIONS,
} = require('./settings');
const { attachVoiceMetadata } = require('./messageMeta');
const { AsyncJobQueue } = require('./queue');
const { transcribeAudio, testProviderModel } = require('./providers');

const MAX_VOICE_FILE_SIZE = 12 * 1024 * 1024;
const ALLOWED_VOICE_MIME = new Set(['audio/wav', 'audio/x-wav', 'audio/wave']);
const TEST_AUDIO_PATH = path.join(__dirname, 'test-assets', 'model-test-ru.wav');

function normalizeClientId(value) {
  if (typeof value !== 'string') return null;
  const id = value.trim();
  if (!id || id.length > 128) return null;
  return id;
}

function createVoiceFeature({ app, db, auth, adminOnly, msgLimiter, upLimiter, uploadsDir, broadcastToChatAll, clients, secret, notifyMessageCreated, onMessageCreated, onMessageTextAvailable }) {
  const replyFallbackLabelSql = `
    CASE
      WHEN rvm.message_id IS NOT NULL THEN
        CASE
          WHEN COALESCE(rvm.note_kind, 'voice')='video_note' THEN 'Видео-заметка'
          ELSE 'Голосовое сообщение'
        END
    END
  `;
  const previewStmt = db.prepare('SELECT * FROM link_previews WHERE message_id=?');
  const reactionStmt = db.prepare('SELECT user_id, emoji FROM reactions WHERE message_id=?');

  const getMessageByIdStmt = db.prepare(`
    SELECT m.*, u.username, u.display_name, u.avatar_color, u.avatar_url,
      f.original_name as file_name, f.stored_name as file_stored,
      f.mime_type as file_mime, f.size as file_size, f.type as file_type,
      COALESCE(NULLIF(rm.text, ''), NULLIF(rvm.transcription_text, ''), ${replyFallbackLabelSql}) as reply_text,
      CASE WHEN rvm.message_id IS NOT NULL THEN 1 ELSE 0 END as reply_is_voice_note,
      ru.display_name as reply_display_name, rm.id as reply_msg_id
    FROM messages m
    JOIN users u ON u.id=m.user_id
    LEFT JOIN files f ON f.id=m.file_id
    LEFT JOIN messages rm ON rm.id=m.reply_to_id
    LEFT JOIN voice_messages rvm ON rvm.message_id=rm.id
    LEFT JOIN users ru ON ru.id=rm.user_id
    WHERE m.id=?
  `);

  const getVoiceJobStmt = db.prepare(`
    SELECT vm.*, m.chat_id, m.file_id, m.is_deleted,
      f.stored_name,
      tf.stored_name as transcription_stored_name
    FROM voice_messages vm
    JOIN messages m ON m.id=vm.message_id
    LEFT JOIN files f ON f.id=m.file_id
    LEFT JOIN files tf ON tf.id=vm.transcription_file_id
    WHERE vm.message_id=?
  `);

  const insertFileStmt = db.prepare(`
    INSERT INTO files(original_name, stored_name, mime_type, size, type, uploaded_by)
    VALUES(?,?,?,?,?,?)
  `);
  const insertMessageStmt = db.prepare(`
    INSERT INTO messages(chat_id, user_id, text, file_id, reply_to_id, client_id)
    VALUES(?,?,?,?,?,?)
  `);
  const getExistingClientMessageStmt = db.prepare('SELECT id FROM messages WHERE chat_id=? AND user_id=? AND client_id=?');
  const insertVoiceStmt = db.prepare(`
    INSERT INTO voice_messages(message_id, duration_ms, sample_rate, transcription_status, requested_by, auto_requested)
    VALUES(?,?,?,?,?,?)
  `);
  const updateVoiceStatusStmt = db.prepare(`
    UPDATE voice_messages
    SET transcription_status=?,
        transcription_text=?,
        transcription_provider=?,
        transcription_model=?,
        transcription_error=?,
        transcribed_at=?,
        requested_by=?,
        auto_requested=?
    WHERE message_id=?
  `);
  const deleteVoiceStmt = db.prepare('DELETE FROM voice_messages WHERE message_id=?');

  const voiceUpload = multer({
    storage: multer.diskStorage({
      destination: uploadsDir,
      filename: (_req, _file, cb) => cb(null, `voice-${uuidv4()}.wav`),
    }),
    limits: { fileSize: MAX_VOICE_FILE_SIZE },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_VOICE_MIME.has(file.mimetype)) {
        cb(new Error('Only WAV voice notes are allowed'));
        return;
      }
      cb(null, true);
    },
  });

  const queue = new AsyncJobQueue({
    getConcurrency: () => getVoiceSettings(db).queue_concurrency,
    handler: async ({ messageId }) => {
      await processQueuedTranscription(messageId);
    },
  });

  function broadcastAll(data) {
    const json = JSON.stringify(data);
    clients.forEach((connections) => {
      connections.forEach((ws) => {
        if (ws.readyState === 1) ws.send(json);
      });
    });
  }

  function getHydratedMessageById(messageId) {
    const row = getMessageByIdStmt.get(messageId);
    if (!row) return null;
    row.previews = previewStmt.all(row.id);
    row.reactions = reactionStmt.all(row.id);
    row.is_read = false;
    return attachVoiceMetadata(db, [row])[0];
  }

  function getTranscriptionPayload(messageId) {
    const voiceRow = db.prepare(`
      SELECT message_id, transcription_status, transcription_text,
        transcription_provider, transcription_model, transcription_error
      FROM voice_messages
      WHERE message_id=?
    `).get(messageId);
    if (!voiceRow) return null;
    return {
      messageId,
      status: voiceRow.transcription_status,
      text: voiceRow.transcription_text,
      provider: voiceRow.transcription_provider,
      model: voiceRow.transcription_model,
      error: voiceRow.transcription_error,
    };
  }

  function broadcastTranscription(chatId, messageId) {
    const payload = getTranscriptionPayload(messageId);
    if (!payload) return;
    broadcastToChatAll(chatId, {
      type: 'message_transcription',
      chatId,
      ...payload,
    });
  }

  async function processQueuedTranscription(messageId) {
    const voiceJob = getVoiceJobStmt.get(messageId);
    const transcriptionStoredName = voiceJob?.transcription_stored_name || voiceJob?.stored_name || '';
    if (!voiceJob || voiceJob.is_deleted || !transcriptionStoredName) return;

    const filePath = path.join(uploadsDir, transcriptionStoredName);
    if (!fs.existsSync(filePath)) {
      updateVoiceStatusStmt.run(
        'error',
        null,
        null,
        null,
        'Transcription source file not found',
        null,
        voiceJob.requested_by || null,
        voiceJob.auto_requested || 0,
        messageId
      );
      broadcastTranscription(voiceJob.chat_id, messageId);
      return;
    }

    const settings = getVoiceSettings(db);
    const apiKey = getOpenAIKey(db, secret);
    const grokApiKey = getGrokKey(db, secret);

    try {
      const result = await transcribeAudio({
        filePath,
        settings,
        apiKey,
        grokApiKey,
      });
      updateVoiceStatusStmt.run(
        'completed',
        result.text,
        result.provider,
        result.model,
        null,
        new Date().toISOString(),
        voiceJob.requested_by || null,
        voiceJob.auto_requested || 0,
        messageId
      );
    } catch (error) {
      updateVoiceStatusStmt.run(
        'error',
        null,
        settings.active_provider,
        settings.active_provider === 'openai'
          ? settings.openai_model
          : (settings.active_provider === 'grok' ? 'speech-to-text' : settings.vosk_model),
        error.message || 'Transcription failed',
        null,
        voiceJob.requested_by || null,
        voiceJob.auto_requested || 0,
        messageId
      );
    }

    broadcastTranscription(voiceJob.chat_id, messageId);
    const payload = getTranscriptionPayload(messageId);
    if (payload?.status === 'completed' && typeof onMessageTextAvailable === 'function') {
      const message = getHydratedMessageById(messageId);
      Promise.resolve(onMessageTextAvailable(message)).catch((error) => {
        console.warn('[voice] text hook failed:', error.message);
      });
    }
  }

  function scheduleTranscription({ messageId, chatId, requestedBy, autoRequested }) {
    updateVoiceStatusStmt.run(
      'pending',
      null,
      null,
      null,
      null,
      null,
      requestedBy || null,
      autoRequested ? 1 : 0,
      messageId
    );
    broadcastTranscription(chatId, messageId);
    queue.enqueue(`voice:${messageId}`, { messageId });
  }

  function serializeAdminResponse() {
    return {
      settings: getAdminVoiceSettings(db),
      options: VOICE_SETTINGS_OPTIONS,
    };
  }

  app.get('/api/features', auth, (_req, res) => {
    res.json(getPublicVoiceSettings(db));
  });

  app.get('/api/admin/voice-settings', auth, adminOnly, (_req, res) => {
    res.json(serializeAdminResponse());
  });

  app.put('/api/admin/voice-settings', auth, adminOnly, (req, res) => {
    const settings = setVoiceSettings(db, req.body || {}, secret);
    broadcastAll({ type: 'voice_settings_updated', settings: getPublicVoiceSettings(db) });
    res.json({
      settings,
      options: VOICE_SETTINGS_OPTIONS,
      publicSettings: getPublicVoiceSettings(db),
    });
  });

  app.delete('/api/admin/voice-settings/openai-key', auth, adminOnly, (_req, res) => {
    const settings = deleteOpenAIKey(db);
    res.json({ settings, options: VOICE_SETTINGS_OPTIONS });
  });

  app.delete('/api/admin/voice-settings/grok-key', auth, adminOnly, (_req, res) => {
    const settings = deleteGrokKey(db);
    res.json({ settings, options: VOICE_SETTINGS_OPTIONS });
  });

  app.post('/api/admin/voice-settings/test-model', auth, adminOnly, async (req, res) => {
    const draftSettings = buildDraftSettings(db, req.body || {}, secret);
    const apiKey = Object.prototype.hasOwnProperty.call(req.body || {}, 'openai_api_key')
      ? String(req.body.openai_api_key || '').trim() || getOpenAIKey(db, secret)
      : getOpenAIKey(db, secret);
    const grokApiKey = Object.prototype.hasOwnProperty.call(req.body || {}, 'grok_api_key')
      ? String(req.body.grok_api_key || '').trim() || getGrokKey(db, secret)
      : getGrokKey(db, secret);

    if (!fs.existsSync(TEST_AUDIO_PATH)) {
      return res.status(500).json({ error: 'Model test audio is missing' });
    }

    const startedAt = Date.now();
    try {
      const result = await testProviderModel({
        filePath: TEST_AUDIO_PATH,
        settings: draftSettings,
        apiKey,
        grokApiKey,
      });
      const latencyMs = Date.now() - startedAt;
      const updated = updateLastModelTest(db, {
        last_model_test_status: 'success',
        last_model_test_at: new Date().toISOString(),
        last_model_test_provider: result.provider,
        last_model_test_model: result.model,
        last_model_test_latency_ms: latencyMs,
        last_model_test_excerpt: result.text.slice(0, 160),
        last_model_test_error: '',
      });
      res.json({
        ok: true,
        result: {
          status: 'success',
          text: result.text,
          provider: result.provider,
          model: result.model,
          latencyMs,
          testedAt: updated.last_model_test_at,
        },
        settings: updated,
      });
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      const updated = updateLastModelTest(db, {
        last_model_test_status: 'error',
        last_model_test_at: new Date().toISOString(),
        last_model_test_provider: draftSettings.active_provider,
        last_model_test_model: draftSettings.active_provider === 'openai'
          ? draftSettings.openai_model
          : (draftSettings.active_provider === 'grok' ? 'speech-to-text' : draftSettings.vosk_model),
        last_model_test_latency_ms: latencyMs,
        last_model_test_excerpt: '',
        last_model_test_error: error.message || 'Model test failed',
      });
      res.json({
        ok: false,
        error: error.message || 'Model test failed',
        result: {
          status: 'error',
          provider: updated.last_model_test_provider,
          model: updated.last_model_test_model,
          latencyMs,
          testedAt: updated.last_model_test_at,
        },
        settings: updated,
      });
    }
  });

  app.post('/api/chats/:chatId/voice-message', auth, msgLimiter, upLimiter, (req, res) => {
    const settings = getVoiceSettings(db);
    if (!settings.voice_notes_enabled) {
      res.status(403).json({ error: 'Voice notes are disabled by administrator' });
      return;
    }

    voiceUpload.single('file')(req, res, (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({ error: 'Voice note is too large' });
          return;
        }
        res.status(400).json({ error: err.message || 'Voice upload failed' });
        return;
      }

      try {
        const chatId = Number(req.params.chatId);
        const durationMs = Math.max(0, Math.round(Number(req.body.durationMs || 0)));
        const sampleRate = Math.max(8_000, Math.round(Number(req.body.sampleRate || 16_000)));
        const replyToId = req.body.replyToId ? Number(req.body.replyToId) : null;
        const clientId = normalizeClientId(req.body.client_id);

        if (!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(chatId, req.user.id)) {
          if (req.file?.path) fs.unlink(req.file.path, () => {});
          res.status(403).json({ error: 'Not a member' });
          return;
        }

        if (!req.file) {
          res.status(400).json({ error: 'Voice file is required' });
          return;
        }

        if (clientId) {
          const existing = getExistingClientMessageStmt.get(chatId, req.user.id, clientId);
          if (existing) {
            if (req.file?.path) fs.unlink(req.file.path, () => {});
            res.json(getHydratedMessageById(existing.id));
            return;
          }
        }

        let validReplyId = null;
        if (replyToId) {
          const replyMsg = db.prepare('SELECT id FROM messages WHERE id=? AND chat_id=?').get(replyToId, chatId);
          if (replyMsg) validReplyId = replyMsg.id;
        }

        const originalName = `voice-note-${Date.now()}.wav`;
        const fileResult = insertFileStmt.run(
          originalName,
          req.file.filename,
          'audio/wav',
          req.file.size,
          'audio',
          req.user.id
        );
        const messageResult = insertMessageStmt.run(chatId, req.user.id, null, fileResult.lastInsertRowid, validReplyId, clientId);
        const transcriptionStatus = settings.auto_transcribe_on_send ? 'pending' : 'idle';
        insertVoiceStmt.run(
          messageResult.lastInsertRowid,
          durationMs,
          sampleRate,
          transcriptionStatus,
          settings.auto_transcribe_on_send ? req.user.id : null,
          settings.auto_transcribe_on_send ? 1 : 0
        );

        const message = getHydratedMessageById(messageResult.lastInsertRowid);
        broadcastToChatAll(chatId, { type: 'message', message });
        if (typeof notifyMessageCreated === 'function') notifyMessageCreated(message);
        if (typeof onMessageCreated === 'function') {
          Promise.resolve(onMessageCreated(message)).catch((featureError) => {
            console.warn('[voice] message hook failed:', featureError.message);
          });
        }

        if (settings.auto_transcribe_on_send) {
          scheduleTranscription({
            messageId: messageResult.lastInsertRowid,
            chatId,
            requestedBy: req.user.id,
            autoRequested: true,
          });
        }

        res.json(message);
      } catch (error) {
        if (req.file?.path) fs.unlink(req.file.path, () => {});
        res.status(500).json({ error: error.message || 'Voice upload failed' });
      }
    });
  });

  app.post('/api/messages/:id/transcribe', auth, async (req, res) => {
    const settings = getVoiceSettings(db);
    if (!settings.voice_notes_enabled) {
      return res.status(403).json({ error: 'Voice transcription is disabled by administrator' });
    }

    const messageId = Number(req.params.id);
    const message = db.prepare(`
      SELECT m.id, m.chat_id, vm.transcription_status, vm.transcription_text,
        vm.transcription_provider, vm.transcription_model, vm.transcription_error
      FROM messages m
      JOIN voice_messages vm ON vm.message_id=m.id
      WHERE m.id=? AND m.is_deleted=0
    `).get(messageId);

    if (!message) return res.status(404).json({ error: 'Voice message not found' });
    if (!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(message.chat_id, req.user.id)) {
      return res.status(403).json({ error: 'Not a member' });
    }

    const savedText = String(message.transcription_text || '').trim();
    if (message.transcription_status === 'completed' && savedText) {
      return res.json({
        ok: true,
        chatId: message.chat_id,
        status: 'completed',
        text: savedText,
        provider: message.transcription_provider || '',
        model: message.transcription_model || '',
        error: message.transcription_error || '',
      });
    }

    if (message.transcription_status === 'pending' && queue.has(`voice:${messageId}`)) {
      return res.json({ ok: true, chatId: message.chat_id, status: 'pending' });
    }

    scheduleTranscription({
      messageId,
      chatId: message.chat_id,
      requestedBy: req.user.id,
      autoRequested: false,
    });
    return res.json({ ok: true, chatId: message.chat_id, status: 'pending' });
  });

  return {
    attachVoiceMetadata(messages) {
      return attachVoiceMetadata(db, messages);
    },
    deleteVoiceMetadata(messageId) {
      deleteVoiceStmt.run(messageId);
    },
    getPublicSettings() {
      return getPublicVoiceSettings(db);
    },
    scheduleTranscription(payload) {
      scheduleTranscription(payload);
    },
  };
}

module.exports = { createVoiceFeature, TEST_AUDIO_PATH };
