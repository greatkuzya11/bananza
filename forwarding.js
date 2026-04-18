const { createMessageCopyService } = require('./messageCopy');

function createForwardingFeature({
  app,
  db,
  auth,
  msgLimiter,
  uploadsDir,
  broadcastToChatAll,
  voiceFeature,
  hydrateMessageById,
  extractUrls,
  fetchPreview,
  notifyMessageCreated,
  onMessageCreated,
  saveMessageMentions,
  messageCopyService,
}) {
  const copyService = messageCopyService || createMessageCopyService({
    db,
    uploadsDir,
    voiceFeature,
    extractUrls,
    fetchPreview,
    broadcastToChatAll,
    saveMessageMentions,
  });

  app.post('/api/messages/:id/forward', auth, msgLimiter, (req, res) => {
    const sourceMessageId = Number(req.params.id);
    const targetChatId = Number(req.body?.targetChatId);

    if (!Number.isInteger(sourceMessageId) || sourceMessageId <= 0) {
      return res.status(400).json({ error: 'Invalid source message id' });
    }
    if (!Number.isInteger(targetChatId) || targetChatId <= 0) {
      return res.status(400).json({ error: 'Target chat is required' });
    }

    const source = copyService.getSourceMessage(sourceMessageId);
    if (!source) return res.status(404).json({ error: 'Message not found' });

    const isSourceMember = db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?')
      .get(source.chat_id, req.user.id);
    if (!isSourceMember) return res.status(403).json({ error: 'Not a member of source chat' });

    const targetChat = db.prepare('SELECT id FROM chats WHERE id=?').get(targetChatId);
    if (!targetChat) return res.status(404).json({ error: 'Target chat not found' });

    const isTargetMember = db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?')
      .get(targetChatId, req.user.id);
    if (!isTargetMember) return res.status(403).json({ error: 'Not a member of target chat' });

    if (!source.text && !source.file_id && !source.voice_message_id) {
      return res.status(400).json({ error: 'Nothing to forward' });
    }
    if (source.voice_message_id && !source.file_id) {
      return res.status(409).json({ error: 'Voice source file is missing' });
    }

    const forwardMeta = {
      messageId: source.forwarded_from_message_id || source.id,
      userId: source.forwarded_from_user_id || source.user_id,
      displayName: (source.forwarded_from_display_name || source.display_name || '').trim() || 'Unknown',
    };
    const sourcePreviews = copyService.getSourcePreviews(source.id);
    const voiceSettings = voiceFeature.getPublicSettings ? voiceFeature.getPublicSettings() : {};
    const shouldAutoTranscribe = Boolean(
      source.voice_message_id &&
      voiceSettings.voice_notes_enabled &&
      voiceSettings.auto_transcribe_on_send &&
      source.voice_transcription_status !== 'completed'
    );

    let forwardedMessageId = null;

    try {
      forwardedMessageId = copyService.copyMessageToChat({
        source,
        sourcePreviews,
        targetChatId,
        actorUserId: req.user.id,
        forwardedFrom: forwardMeta,
        shouldAutoTranscribe,
      }).messageId;
    } catch (error) {
      return res.status(500).json({ error: error.message || 'Forward failed' });
    }

    const message = hydrateMessageById(forwardedMessageId);
    if (!message) {
      return res.status(500).json({ error: 'Forwarded message could not be loaded' });
    }

    broadcastToChatAll(targetChatId, { type: 'message', message });
    if (typeof notifyMessageCreated === 'function') notifyMessageCreated(message);
    if (typeof onMessageCreated === 'function') {
      Promise.resolve(onMessageCreated(message, { skipBotTrigger: true })).catch((error) => {
        console.warn('[forwarding] message hook failed:', error.message);
      });
    }

    if (shouldAutoTranscribe && typeof voiceFeature.scheduleTranscription === 'function') {
      voiceFeature.scheduleTranscription({
        messageId: forwardedMessageId,
        chatId: targetChatId,
        requestedBy: req.user.id,
        autoRequested: true,
      });
    }

    if (sourcePreviews.length === 0 && source.text) {
      copyService.schedulePreviewFetch(forwardedMessageId, targetChatId, source.text);
    }

    return res.json(message);
  });
}

module.exports = { createForwardingFeature };
