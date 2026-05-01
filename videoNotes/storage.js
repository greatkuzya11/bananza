const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { deleteVideoPoster, duplicateVideoPoster } = require('../videoPosters');

function createVideoNoteStorage({ db, uploadsDir }) {
  const fileByIdStmt = db.prepare(`
    SELECT id, original_name, stored_name, mime_type, size, type
    FROM files
    WHERE id=?
  `);
  const insertFileStmt = db.prepare(`
    INSERT INTO files(original_name, stored_name, mime_type, size, type, uploaded_by)
    VALUES(?,?,?,?,?,?)
  `);
  const noteAssetsStmt = db.prepare(`
    SELECT m.file_id, vm.transcription_file_id
    FROM messages m
    LEFT JOIN voice_messages vm ON vm.message_id=m.id
    WHERE m.id=?
  `);
  const clearTranscriptionFileRefStmt = db.prepare(`
    UPDATE voice_messages
    SET transcription_file_id=NULL
    WHERE message_id=?
  `);

  function getFilePath(storedName) {
    return path.join(uploadsDir, path.basename(storedName || ''));
  }

  function deleteFileById(fileId) {
    const id = Number(fileId || 0);
    if (!id) return false;
    const file = fileByIdStmt.get(id);
    if (!file) return false;
    const filePath = getFilePath(file.stored_name);
    if (fs.existsSync(filePath)) fs.unlink(filePath, () => {});
    deleteVideoPoster(uploadsDir, file.stored_name);
    db.prepare('DELETE FROM files WHERE id=?').run(id);
    return true;
  }

  function duplicateFileById(fileId, uploadedBy) {
    const id = Number(fileId || 0);
    const actorId = Number(uploadedBy || 0);
    if (!id || !actorId) return null;
    const source = fileByIdStmt.get(id);
    if (!source?.stored_name) return null;

    const sourcePath = getFilePath(source.stored_name);
    if (!fs.existsSync(sourcePath)) {
      throw new Error('Source auxiliary file not found');
    }

    const ext = path.extname(source.stored_name || source.original_name || '').toLowerCase();
    const duplicatedStoredName = `${uuidv4()}${ext}`;
    const duplicatedPath = getFilePath(duplicatedStoredName);
    fs.copyFileSync(sourcePath, duplicatedPath);

    try {
      const duplicatedFileId = insertFileStmt.run(
        source.original_name,
        duplicatedStoredName,
        source.mime_type,
        source.size,
        source.type,
        actorId
      ).lastInsertRowid;
      if (source.type === 'video') {
        try {
          duplicateVideoPoster({
            uploadsDir,
            sourceStoredName: source.stored_name,
            targetStoredName: duplicatedStoredName,
          });
        } catch (error) {}
      }
      return duplicatedFileId;
    } catch (error) {
      fs.unlink(duplicatedPath, () => {});
      deleteVideoPoster(uploadsDir, duplicatedStoredName);
      throw error;
    }
  }

  function deleteMessageAssets(messageId) {
    const mid = Number(messageId || 0);
    if (!mid) return false;
    const row = noteAssetsStmt.get(mid);
    const transcriptionFileId = Number(row?.transcription_file_id || 0);
    if (!transcriptionFileId) return false;
    clearTranscriptionFileRefStmt.run(mid);
    return deleteFileById(transcriptionFileId);
  }

  return {
    deleteFileById,
    duplicateFileById,
    deleteMessageAssets,
  };
}

module.exports = { createVideoNoteStorage };
