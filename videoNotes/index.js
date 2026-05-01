const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const { normalizeShapeSnapshot } = require('./meta');
const {
  isSupportedVideoPosterMime,
  saveVideoPosterFromPath,
} = require('../videoPosters');

const MAX_VIDEO_NOTE_VIDEO_SIZE = 18 * 1024 * 1024;
const MAX_VIDEO_NOTE_AUDIO_SIZE = 12 * 1024 * 1024;
const MAX_VIDEO_NOTE_DURATION_MS = 30_000;
const ALLOWED_VIDEO_MIME = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const ALLOWED_AUDIO_MIME = new Set(['audio/wav', 'audio/x-wav', 'audio/wave']);
const DEFAULT_SHAPE_ID = 'banana-fat';
const DEFAULT_SHAPE_SNAPSHOT = JSON.stringify({
  id: DEFAULT_SHAPE_ID,
  version: '1',
  label: 'Banana Fat',
  viewBox: '0 0 320 220',
  path: 'M23 124C33 73 76 36 138 27C214 17 281 53 301 109C311 137 305 166 285 188C257 214 205 221 144 213C95 207 59 186 35 150C28 140 24 132 23 124Z',
  clipPadding: 12,
});

function normalizeMimeType(value) {
  return String(value || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
}

function normalizeClientId(value) {
  if (typeof value !== 'string') return null;
  const id = value.trim();
  if (!id || id.length > 128) return null;
  return id;
}

function cleanupUploadedFiles(reqFiles = {}) {
  Object.values(reqFiles).flat().forEach((file) => {
    if (file?.path) fs.unlink(file.path, () => {});
  });
}

function createVideoNoteFeature({
  app,
  db,
  auth,
  msgLimiter,
  upLimiter,
  uploadsDir,
  hydrateMessageById,
  broadcastToChatAll,
  notifyMessageCreated,
  onMessageCreated,
  voiceFeature,
}) {
  const insertFileStmt = db.prepare(`
    INSERT INTO files(original_name, stored_name, mime_type, size, type, uploaded_by)
    VALUES(?,?,?,?,?,?)
  `);
  const insertMessageStmt = db.prepare(`
    INSERT INTO messages(chat_id, user_id, text, file_id, reply_to_id, client_id)
    VALUES(?,?,?,?,?,?)
  `);
  const getExistingClientMessageStmt = db.prepare(`
    SELECT id
    FROM messages
    WHERE chat_id=? AND user_id=? AND client_id=?
  `);
  const insertVoiceStmt = db.prepare(`
    INSERT INTO voice_messages(
      message_id,
      duration_ms,
      sample_rate,
      transcription_status,
      requested_by,
      auto_requested,
      note_kind,
      transcription_file_id,
      shape_id,
      shape_snapshot
    )
    VALUES(?,?,?,?,?,?,?,?,?,?)
  `);

  const upload = multer({
    storage: multer.diskStorage({
      destination: uploadsDir,
      filename: (_req, file, cb) => {
        const prefix = file.fieldname === 'audio'
          ? 'video-note-audio'
          : (file.fieldname === 'poster' ? 'video-note-poster' : 'video-note');
        cb(null, `${prefix}-${uuidv4()}${path.extname(file.originalname).toLowerCase()}`);
      },
    }),
    limits: {
      fileSize: MAX_VIDEO_NOTE_VIDEO_SIZE + MAX_VIDEO_NOTE_AUDIO_SIZE,
      files: 3,
    },
    fileFilter: (_req, file, cb) => {
      const mimeType = normalizeMimeType(file.mimetype);
      if (file.fieldname === 'video' && ALLOWED_VIDEO_MIME.has(mimeType)) return cb(null, true);
      if (file.fieldname === 'audio' && ALLOWED_AUDIO_MIME.has(mimeType)) return cb(null, true);
      if (file.fieldname === 'poster' && isSupportedVideoPosterMime(mimeType)) return cb(null, true);
      cb(new Error('Invalid video note media type'));
    },
  });

  app.post('/api/chats/:chatId/video-note', auth, msgLimiter, upLimiter, (req, res) => {
    upload.fields([
      { name: 'video', maxCount: 1 },
      { name: 'audio', maxCount: 1 },
      { name: 'poster', maxCount: 1 },
    ])(req, res, (err) => {
      if (err) {
        cleanupUploadedFiles(req.files || {});
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'Video note is too large' });
        }
        return res.status(400).json({ error: err.message || 'Video note upload failed' });
      }

      try {
        const chatId = Number(req.params.chatId);
        const durationMs = Math.max(0, Math.min(MAX_VIDEO_NOTE_DURATION_MS, Math.round(Number(req.body.durationMs || 0))));
        const sampleRate = Math.max(8_000, Math.round(Number(req.body.sampleRate || 16_000)));
        const replyToId = req.body.replyToId ? Number(req.body.replyToId) : null;
        const clientId = normalizeClientId(req.body.client_id);
        const videoMime = normalizeMimeType(req.body.videoMime || '');
        const shapeId = String(req.body.shapeId || '').trim() || DEFAULT_SHAPE_ID;
        const shapeSnapshot = normalizeShapeSnapshot(req.body.shapeSnapshot)
          || (shapeId === DEFAULT_SHAPE_ID ? DEFAULT_SHAPE_SNAPSHOT : null);
        const videoFile = Array.isArray(req.files?.video) ? req.files.video[0] : null;
        const audioFile = Array.isArray(req.files?.audio) ? req.files.audio[0] : null;
        const posterFile = Array.isArray(req.files?.poster) ? req.files.poster[0] : null;
        const normalizedVideoFileMime = normalizeMimeType(videoFile?.mimetype);

        if (!db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?').get(chatId, req.user.id)) {
          cleanupUploadedFiles(req.files || {});
          return res.status(403).json({ error: 'Not a member' });
        }

        if (!videoFile || !audioFile) {
          cleanupUploadedFiles(req.files || {});
          return res.status(400).json({ error: 'Video and audio are required' });
        }

        if (!ALLOWED_VIDEO_MIME.has(videoMime || normalizedVideoFileMime)) {
          cleanupUploadedFiles(req.files || {});
          return res.status(400).json({ error: 'Unsupported video note format' });
        }

        if (clientId) {
          const existing = getExistingClientMessageStmt.get(chatId, req.user.id, clientId);
          if (existing) {
            cleanupUploadedFiles(req.files || {});
            return res.json(hydrateMessageById(existing.id, req.user.id));
          }
        }

        let validReplyId = null;
        if (replyToId) {
          const replyMsg = db.prepare('SELECT id FROM messages WHERE id=? AND chat_id=?').get(replyToId, chatId);
          if (replyMsg) validReplyId = replyMsg.id;
        }

        const transcriptionStatus = 'idle';

        const messageId = db.transaction(() => {
          const insertedVideo = insertFileStmt.run(
            `video-note-${Date.now()}${path.extname(videoFile.originalname || '.webm').toLowerCase() || '.webm'}`,
            videoFile.filename,
            videoMime || normalizedVideoFileMime || 'video/webm',
            videoFile.size,
            'video',
            req.user.id
          );
          const insertedAudio = insertFileStmt.run(
            `video-note-audio-${Date.now()}.wav`,
            audioFile.filename,
            'audio/wav',
            audioFile.size,
            'audio',
            req.user.id
          );
          const insertedMessage = insertMessageStmt.run(
            chatId,
            req.user.id,
            null,
            insertedVideo.lastInsertRowid,
            validReplyId,
            clientId
          );

          insertVoiceStmt.run(
            insertedMessage.lastInsertRowid,
            durationMs,
            sampleRate,
            transcriptionStatus,
            null,
            0,
            'video_note',
            insertedAudio.lastInsertRowid,
            shapeId,
            shapeSnapshot
          );
          return insertedMessage.lastInsertRowid;
        })();

        if (posterFile?.path) {
          try {
            saveVideoPosterFromPath({
              uploadsDir,
              storedName: videoFile.filename,
              sourcePath: posterFile.path,
            });
          } catch (error) {}
          fs.unlink(posterFile.path, () => {});
        }

        const message = hydrateMessageById(messageId, req.user.id);
        broadcastToChatAll(chatId, { type: 'message', message });
        if (typeof notifyMessageCreated === 'function') notifyMessageCreated(message);
        if (typeof onMessageCreated === 'function') {
          Promise.resolve(onMessageCreated(message)).catch((featureError) => {
            console.warn('[video-note] message hook failed:', featureError.message);
          });
        }

        return res.json(message);
      } catch (error) {
        cleanupUploadedFiles(req.files || {});
        return res.status(500).json({ error: error.message || 'Video note upload failed' });
      }
    });
  });

  return {
    getDefaultShapeId() {
      return DEFAULT_SHAPE_ID;
    },
  };
}

module.exports = { createVideoNoteFeature };
