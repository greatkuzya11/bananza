const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

function createMessageCopyService({
  db,
  uploadsDir,
  voiceFeature,
  extractUrls,
  fetchPreview,
  broadcastToChatAll,
  saveMessageMentions,
}) {
  const sourceMessageStmt = db.prepare(`
    SELECT
      m.*,
      u.display_name,
      f.original_name as file_name,
      f.stored_name as file_stored,
      f.mime_type as file_mime,
      f.size as file_size,
      f.type as file_type,
      vm.message_id as voice_message_id,
      vm.duration_ms as voice_duration_ms,
      vm.sample_rate as voice_sample_rate,
      vm.transcription_status as voice_transcription_status,
      vm.transcription_text as voice_transcription_text,
      vm.transcription_provider as voice_transcription_provider,
      vm.transcription_model as voice_transcription_model,
      vm.transcription_error as voice_transcription_error,
      vm.transcribed_at as voice_transcribed_at,
      vm.requested_by as voice_requested_by,
      vm.auto_requested as voice_auto_requested
    FROM messages m
    JOIN users u ON u.id = m.user_id
    LEFT JOIN files f ON f.id = m.file_id
    LEFT JOIN voice_messages vm ON vm.message_id = m.id
    WHERE m.id = ? AND m.is_deleted = 0
  `);
  const sourcePreviewsStmt = db.prepare(`
    SELECT url, title, description, image, hostname
    FROM link_previews
    WHERE message_id = ?
    ORDER BY id ASC
  `);
  const insertFileStmt = db.prepare(`
    INSERT INTO files(original_name, stored_name, mime_type, size, type, uploaded_by)
    VALUES(?,?,?,?,?,?)
  `);
  const insertMessageStmt = db.prepare(`
    INSERT INTO messages(
      chat_id,
      user_id,
      text,
      file_id,
      reply_to_id,
      forwarded_from_message_id,
      forwarded_from_user_id,
      forwarded_from_display_name,
      saved_from_message_id,
      saved_from_chat_id,
      saved_from_user_id,
      saved_from_display_name,
      saved_from_created_at
    )
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const insertPreviewStmt = db.prepare(`
    INSERT INTO link_previews(message_id, url, title, description, image, hostname)
    VALUES(?,?,?,?,?,?)
  `);
  const insertVoiceStmt = db.prepare(`
    INSERT INTO voice_messages(
      message_id,
      duration_ms,
      sample_rate,
      transcription_status,
      transcription_text,
      transcription_provider,
      transcription_model,
      transcription_error,
      transcribed_at,
      requested_by,
      auto_requested
    )
    VALUES(?,?,?,?,?,?,?,?,?,?,?)
  `);

  function getSourceMessage(messageId) {
    return sourceMessageStmt.get(messageId);
  }

  function getSourcePreviews(messageId) {
    return sourcePreviewsStmt.all(messageId);
  }

  function duplicateMessageFile(source, uploadedBy) {
    if (!source.file_id) return null;
    if (!source.file_stored) {
      throw new Error('Source file metadata is incomplete');
    }

    const sourceStoredName = path.basename(source.file_stored);
    const sourcePath = path.join(uploadsDir, sourceStoredName);
    if (!fs.existsSync(sourcePath)) {
      throw new Error('Source file not found');
    }

    const ext = (path.extname(sourceStoredName) || path.extname(source.file_name || '')).toLowerCase();
    const duplicatedStoredName = `${uuidv4()}${ext}`;
    const duplicatedPath = path.join(uploadsDir, duplicatedStoredName);
    fs.copyFileSync(sourcePath, duplicatedPath);

    return {
      insertedBy: uploadedBy,
      original_name: source.file_name,
      stored_name: duplicatedStoredName,
      mime_type: source.file_mime,
      size: source.file_size,
      type: source.file_type,
      path: duplicatedPath,
    };
  }

  function schedulePreviewFetch(messageId, chatId, text) {
    const cleanText = typeof text === 'string' ? text.trim() : '';
    if (!cleanText) return;
    const urls = extractUrls(cleanText);
    if (urls.length === 0) return;

    fetchPreview(urls[0]).then((preview) => {
      if (!preview) return;
      insertPreviewStmt.run(
        messageId,
        preview.url,
        preview.title,
        preview.description,
        preview.image,
        preview.hostname
      );
      broadcastToChatAll(chatId, { type: 'link_preview', messageId, preview });
    }).catch(() => {});
  }

  function copyMessageToChat({
    source,
    sourcePreviews = [],
    targetChatId,
    actorUserId,
    replyToId = null,
    forwardedFrom = null,
    savedFrom = null,
    shouldAutoTranscribe = false,
  }) {
    let duplicatedFile = null;
    try {
      duplicatedFile = duplicateMessageFile(source, actorUserId);

      const messageId = db.transaction(() => {
        const duplicatedFileId = duplicatedFile
          ? insertFileStmt.run(
              duplicatedFile.original_name,
              duplicatedFile.stored_name,
              duplicatedFile.mime_type,
              duplicatedFile.size,
              duplicatedFile.type,
              duplicatedFile.insertedBy
            ).lastInsertRowid
          : null;

        const insertedMessage = insertMessageStmt.run(
          targetChatId,
          actorUserId,
          source.text ?? null,
          duplicatedFileId,
          replyToId,
          forwardedFrom?.messageId || null,
          forwardedFrom?.userId || null,
          forwardedFrom?.displayName || null,
          savedFrom?.messageId || null,
          savedFrom?.chatId || null,
          savedFrom?.userId || null,
          savedFrom?.displayName || null,
          savedFrom?.createdAt || null
        );
        const newMessageId = insertedMessage.lastInsertRowid;

        if (source.text && typeof saveMessageMentions === 'function') {
          saveMessageMentions(newMessageId, targetChatId, source.text);
        }

        if (source.voice_message_id) {
          const copyCompletedTranscript = source.voice_transcription_status === 'completed';
          insertVoiceStmt.run(
            newMessageId,
            Number(source.voice_duration_ms) || 0,
            Number(source.voice_sample_rate) || 16000,
            copyCompletedTranscript ? 'completed' : (shouldAutoTranscribe ? 'pending' : 'idle'),
            copyCompletedTranscript ? (source.voice_transcription_text ?? null) : null,
            copyCompletedTranscript ? (source.voice_transcription_provider ?? null) : null,
            copyCompletedTranscript ? (source.voice_transcription_model ?? null) : null,
            null,
            copyCompletedTranscript ? (source.voice_transcribed_at ?? null) : null,
            copyCompletedTranscript ? (source.voice_requested_by ?? null) : (shouldAutoTranscribe ? actorUserId : null),
            copyCompletedTranscript ? (Number(source.voice_auto_requested) || 0) : (shouldAutoTranscribe ? 1 : 0)
          );
        }

        if (sourcePreviews.length > 0) {
          sourcePreviews.forEach((preview) => {
            insertPreviewStmt.run(
              newMessageId,
              preview.url,
              preview.title,
              preview.description,
              preview.image,
              preview.hostname
            );
          });
        }

        return newMessageId;
      })();

      return { messageId, duplicatedFile };
    } catch (error) {
      if (duplicatedFile?.path) {
        fs.unlink(duplicatedFile.path, () => {});
      }
      throw error;
    }
  }

  return {
    getSourceMessage,
    getSourcePreviews,
    copyMessageToChat,
    schedulePreviewFetch,
  };
}

module.exports = { createMessageCopyService };
