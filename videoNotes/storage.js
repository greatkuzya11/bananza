const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

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
      return insertFileStmt.run(
        source.original_name,
        duplicatedStoredName,
        source.mime_type,
        source.size,
        source.type,
        actorId
      ).lastInsertRowid;
    } catch (error) {
      fs.unlink(duplicatedPath, () => {});
      throw error;
    }
  }

  function deleteMessageAssets(messageId) {
    const row = noteAssetsStmt.get(messageId);
    const transcriptionFileId = Number(row?.transcription_file_id || 0);
    const visibleFileId = Number(row?.file_id || 0);
    if (!transcriptionFileId || transcriptionFileId === visibleFileId) return false;
    return deleteFileById(transcriptionFileId);
  }

  return {
    deleteFileById,
    duplicateFileById,
    deleteMessageAssets,
  };
}

module.exports = { createVideoNoteStorage };
