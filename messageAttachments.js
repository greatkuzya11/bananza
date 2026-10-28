const { hasVideoPoster } = require('./videoPosters');

function initMessageAttachmentsSchema(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS message_attachments (
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    file_id INTEGER NOT NULL REFERENCES files(id),
    position INTEGER NOT NULL CHECK(position >= 0),
    PRIMARY KEY(message_id, position),
    UNIQUE(message_id, file_id)
  );
  CREATE INDEX IF NOT EXISTS idx_message_attachments_file ON message_attachments(file_id);`);
}

function createMessageAttachments(db, uploadsDir) {
  const list = db.prepare(`SELECT f.id AS file_id, f.original_name AS file_name,
    f.stored_name AS file_stored, f.mime_type AS file_mime, f.size AS file_size,
    f.type AS file_type FROM message_attachments a JOIN files f ON f.id=a.file_id
    WHERE a.message_id=? ORDER BY a.position`);
  const legacy = db.prepare(`SELECT f.id AS file_id, f.original_name AS file_name,
    f.stored_name AS file_stored, f.mime_type AS file_mime, f.size AS file_size,
    f.type AS file_type FROM messages m JOIN files f ON f.id=m.file_id WHERE m.id=?`);
  const insert = db.prepare('INSERT INTO message_attachments(message_id,file_id,position) VALUES(?,?,?)');
  function get(messageId) {
    const rows = list.all(messageId);
    if (!rows.length) {
      const first = legacy.get(messageId);
      if (first) rows.push(first);
    }
    return rows.map(row => ({ ...row, file_poster_available: Boolean(
      uploadsDir && row.file_type === 'video' && hasVideoPoster(uploadsDir, row.file_stored)
    ) }));
  }
  function attach(row) {
    if (row) {
      row.attachments = row.is_deleted ? [] : get(row.id);
      const reply = row.reply_to_id && db.prepare('SELECT id, chat_id, is_deleted FROM messages WHERE id=?').get(row.reply_to_id);
      row.reply_attachments = reply && !reply.is_deleted && !row.is_deleted
        && (!row.chat_id || reply.chat_id === row.chat_id) ? get(reply.id) : [];
    }
    return row;
  }
  function save(messageId, fileIds) {
    fileIds.forEach((id, position) => insert.run(messageId, id, position));
  }
  function validate(body, userId, { existingIds = [] } = {}) {
    if (Object.hasOwn(body, 'fileIds') && Object.hasOwn(body, 'fileId')) throw new Error('Use fileIds or fileId, not both');
    const ids = Object.hasOwn(body, 'fileIds') ? body.fileIds : (body.fileId ? [body.fileId] : []);
    if (!Array.isArray(ids) || ids.length > 10 || ids.some(id => !Number.isSafeInteger(id) || id <= 0)
      || new Set(ids).size !== ids.length) throw new Error('Invalid attachments (maximum 10 unique files)');
    for (const id of ids) {
      if (existingIds.includes(id)) continue;
      if (!db.prepare('SELECT 1 FROM files WHERE id=? AND uploaded_by=?').get(id, userId)) {
        throw new Error('File not found or not available');
      }
    }
    return ids;
  }
  function isReferenced(id) {
    return Boolean(db.prepare(`SELECT 1 FROM messages WHERE file_id=? UNION ALL
      SELECT 1 FROM message_attachments WHERE file_id=? UNION ALL
      SELECT 1 FROM document_assets WHERE file_id=? UNION ALL
      SELECT 1 FROM voice_messages WHERE transcription_file_id=? LIMIT 1`).get(id, id, id, id));
  }
  return { get, attach, save, validate, isReferenced };
}

module.exports = { initMessageAttachmentsSchema, createMessageAttachments };
