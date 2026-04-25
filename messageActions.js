function intId(value) {
  const id = Number(value || 0);
  return Number.isInteger(id) && id > 0 ? id : 0;
}

function cleanMessageText(value, maxLength = 5000) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function normalizeOptionText(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function uniqueIds(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map(intId).filter(Boolean))];
}

function createActionError(message, status = 400, code = 'invalid') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function createMessageActionsService({
  db,
  pollFeature,
  hydrateMessageById,
  saveMessageMentions,
  broadcastToChatAll,
  notifyMessageCreated,
  notifyReaction,
  notifyPinCreated,
  onMessagePublished,
  recordPinEvent,
  broadcastPinsUpdated,
  getChatPinPayload,
  isChatMember,
  isNotesChatRow,
  normalizePollPayload,
  isValidReactionEmoji,
}) {
  if (!db) throw new Error('db is required');
  if (!pollFeature) throw new Error('pollFeature is required');
  if (typeof hydrateMessageById !== 'function') throw new Error('hydrateMessageById is required');
  if (typeof broadcastToChatAll !== 'function') throw new Error('broadcastToChatAll is required');
  if (typeof isChatMember !== 'function') throw new Error('isChatMember is required');
  if (typeof normalizePollPayload !== 'function') throw new Error('normalizePollPayload is required');
  if (typeof isValidReactionEmoji !== 'function') throw new Error('isValidReactionEmoji is required');

  const chatByIdStmt = db.prepare('SELECT id, is_notes FROM chats WHERE id=?');
  const messageByIdStmt = db.prepare('SELECT id, chat_id, user_id FROM messages WHERE id=? AND is_deleted=0');
  const replyInChatStmt = db.prepare('SELECT id FROM messages WHERE id=? AND chat_id=? AND is_deleted=0');
  const insertMessageStmt = db.prepare(`
    INSERT INTO messages(
      chat_id,
      user_id,
      text,
      file_id,
      reply_to_id,
      client_id,
      ai_generated,
      ai_bot_id,
      ai_image_risk_confirmed,
      ai_response_mode_hint,
      ai_document_format_hint
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?)
  `);
  const pollOptionRowsStmt = db.prepare(`
    SELECT id, text
    FROM poll_options
    WHERE message_id=?
    ORDER BY position ASC, id ASC
  `);
  const reactionByActorStmt = db.prepare(`
    SELECT emoji
    FROM reactions
    WHERE message_id=? AND user_id=?
    ORDER BY created_at ASC, emoji ASC
  `);
  const sameReactionStmt = db.prepare('SELECT 1 FROM reactions WHERE message_id=? AND user_id=? AND emoji=?');
  const deleteSameReactionStmt = db.prepare('DELETE FROM reactions WHERE message_id=? AND user_id=? AND emoji=?');
  const deleteOtherActorReactionsStmt = db.prepare('DELETE FROM reactions WHERE message_id=? AND user_id=? AND emoji<>?');
  const deleteActorReactionsStmt = db.prepare('DELETE FROM reactions WHERE message_id=? AND user_id=?');
  const insertReactionStmt = db.prepare('INSERT INTO reactions(message_id, user_id, emoji) VALUES(?,?,?)');
  const listReactionsStmt = db.prepare('SELECT user_id, emoji FROM reactions WHERE message_id=?');
  const insertPinStmt = db.prepare('INSERT OR IGNORE INTO message_pins(chat_id, message_id, pinned_by) VALUES(?,?,?)');
  const pinCreatedAtStmt = db.prepare('SELECT created_at FROM message_pins WHERE chat_id=? AND message_id=?');

  function actorPayload(actor) {
    const id = intId(actor?.id || actor?.user_id);
    if (!id) throw createActionError('Invalid actor', 400, 'invalid_actor');
    return {
      id,
      is_admin: actor?.is_admin === true || actor?.isAdmin === true || actor?.is_admin === 1,
      display_name: String(actor?.display_name || actor?.displayName || actor?.name || actor?.username || '').trim(),
      username: String(actor?.username || actor?.mention || '').trim(),
    };
  }

  function requireChatMembership(chatId, actor) {
    if (actor.is_admin) return;
    if (!isChatMember(chatId, actor.id)) {
      throw createActionError('Not a member', 403, 'not_member');
    }
  }

  function publishCreatedMessage(message, chatId) {
    if (!message) return null;
    if (typeof onMessagePublished === 'function') onMessagePublished(message);
    broadcastToChatAll(chatId, { type: 'message', message });
    if (typeof notifyMessageCreated === 'function') notifyMessageCreated(message);
    return message;
  }

  function resolvePollOptionIds(messageId, actorId, optionIds = [], optionTexts = []) {
    const normalizedIds = uniqueIds(optionIds);
    if (normalizedIds.length) return normalizedIds;

    const wantedTexts = (Array.isArray(optionTexts) ? optionTexts : [])
      .map(normalizeOptionText)
      .filter(Boolean);
    if (!wantedTexts.length) return [];

    const options = pollOptionRowsStmt.all(messageId);
    const optionByKey = new Map();
    options.forEach((row) => {
      const key = normalizeOptionText(row.text).toLowerCase();
      if (key && !optionByKey.has(key)) optionByKey.set(key, Number(row.id) || 0);
    });

    const resolved = [];
    const missing = [];
    wantedTexts.forEach((text) => {
      const id = optionByKey.get(text.toLowerCase());
      if (id) resolved.push(id);
      else missing.push(text);
    });
    if (missing.length) {
      const error = createActionError(`Poll option not found: ${missing.join(', ')}`, 400, 'bad_option_text');
      error.missing_options = missing;
      throw error;
    }
    return uniqueIds(resolved);
  }

  function createPollMessage({
    actor,
    chatId,
    text,
    replyToId = null,
    clientId = null,
    poll,
    aiGenerated = false,
    aiBotId = null,
  }) {
    const author = actorPayload(actor);
    const resolvedChatId = intId(chatId);
    if (!resolvedChatId) throw createActionError('Invalid chat', 400, 'invalid_chat');
    const chat = chatByIdStmt.get(resolvedChatId);
    if (!chat) throw createActionError('Chat not found', 404, 'chat_not_found');
    requireChatMembership(resolvedChatId, author);

    const cleanText = cleanMessageText(text);
    if (!cleanText) throw createActionError('Poll question is required', 400, 'missing_text');

    const normalizedPoll = normalizePollPayload(poll || {});
    if (isNotesChatRow(chat)) throw createActionError('Polls are not available in notes chat', 400, 'notes_chat');

    const validReplyId = intId(replyToId)
      ? (replyInChatStmt.get(intId(replyToId), resolvedChatId)?.id || null)
      : null;

    const messageId = db.transaction(() => {
      const inserted = insertMessageStmt.run(
        resolvedChatId,
        author.id,
        cleanText,
        null,
        validReplyId,
        clientId || null,
        aiGenerated ? 1 : 0,
        intId(aiBotId) || null,
        0,
        null,
        null
      );
      const createdMessageId = Number(inserted.lastInsertRowid || 0);
      pollFeature.createPollData({
        messageId: createdMessageId,
        createdBy: author.id,
        style: normalizedPoll.style,
        allowsMultiple: normalizedPoll.allows_multiple,
        showVoters: normalizedPoll.show_voters,
        closesAt: normalizedPoll.closes_at,
        options: normalizedPoll.options,
      });
      return createdMessageId;
    })();

    if (cleanText && typeof saveMessageMentions === 'function') {
      saveMessageMentions(messageId, resolvedChatId, cleanText);
    }

    const message = hydrateMessageById(messageId, author.id);
    if (!message) throw createActionError('Message could not be hydrated', 500, 'hydrate_failed');
    if (clientId) message.client_id = clientId;
    publishCreatedMessage(message, resolvedChatId);
    return { message, poll: message.poll };
  }

  function votePoll({
    actor,
    messageId,
    optionIds = [],
    optionTexts = [],
  }) {
    const voter = actorPayload(actor);
    const pollMessageId = intId(messageId);
    if (!pollMessageId) throw createActionError('Invalid message id', 400, 'invalid_message');

    const state = pollFeature.pollStateForMessage(pollMessageId);
    if (!state) throw createActionError('Poll not found', 404, 'not_found');
    requireChatMembership(Number(state.chat_id) || 0, voter);

    const resolvedOptionIds = resolvePollOptionIds(pollMessageId, voter.id, optionIds, optionTexts);
    const result = pollFeature.replaceVotes(pollMessageId, voter.id, resolvedOptionIds);
    pollFeature.broadcastPollUpdated(result.chatId, pollMessageId);
    return {
      ok: true,
      chatId: result.chatId,
      poll: result.poll,
      optionIds: resolvedOptionIds,
    };
  }

  function toggleReaction({
    actor,
    messageId,
    emoji,
    behavior = 'toggle',
    replaceExistingFromActor = false,
    removeAllFromActor = false,
  }) {
    const reactor = actorPayload(actor);
    const mid = intId(messageId);
    const normalizedEmoji = String(emoji || '').trim();
    if (!mid) throw createActionError('Invalid message', 400, 'invalid_message');
    if ((behavior !== 'remove' || !removeAllFromActor) && !isValidReactionEmoji(normalizedEmoji)) {
      throw createActionError('Invalid emoji', 400, 'invalid_emoji');
    }

    const message = messageByIdStmt.get(mid);
    if (!message) throw createActionError('Not found', 404, 'not_found');
    requireChatMembership(Number(message.chat_id) || 0, reactor);

    let reactionAdded = false;
    let changed = false;
    const existingSame = !!sameReactionStmt.get(mid, reactor.id, normalizedEmoji);

    if (behavior === 'remove') {
      if (removeAllFromActor) {
        const removed = deleteActorReactionsStmt.run(mid, reactor.id);
        changed = removed.changes > 0;
      } else if (existingSame) {
        deleteSameReactionStmt.run(mid, reactor.id, normalizedEmoji);
        changed = true;
      }
    } else if (behavior === 'toggle' && existingSame) {
      deleteSameReactionStmt.run(mid, reactor.id, normalizedEmoji);
      changed = true;
    } else {
      if (replaceExistingFromActor) {
        const removed = deleteOtherActorReactionsStmt.run(mid, reactor.id, normalizedEmoji);
        if (removed.changes > 0) changed = true;
      }
      if (!existingSame) {
        insertReactionStmt.run(mid, reactor.id, normalizedEmoji);
        reactionAdded = true;
        changed = true;
      }
    }

    const reactions = listReactionsStmt.all(mid);
    if (changed) {
      broadcastToChatAll(message.chat_id, {
        type: 'reaction',
        messageId: mid,
        reactions,
        actorId: reactor.id,
        actorName: reactor.display_name || reactor.username,
        emoji: normalizedEmoji,
        action: reactionAdded ? 'added' : 'removed',
        chatId: message.chat_id,
        targetUserId: message.user_id,
      });
      if (reactionAdded && typeof notifyReaction === 'function') {
        notifyReaction({ messageId: mid, emoji: normalizedEmoji, actor: reactor });
      }
    }

    return {
      ok: true,
      changed,
      reactionAdded,
      reactions,
      existing_reactions: reactionByActorStmt.all(mid, reactor.id).map((row) => row.emoji),
    };
  }

  function pinMessage({ actor, messageId }) {
    const pinner = actorPayload(actor);
    const mid = intId(messageId);
    if (!mid) throw createActionError('Invalid message', 400, 'invalid_message');

    const message = messageByIdStmt.get(mid);
    if (!message) throw createActionError('Message not found', 404, 'not_found');
    requireChatMembership(Number(message.chat_id) || 0, pinner);

    const inserted = insertPinStmt.run(message.chat_id, mid, pinner.id);
    let pinEvent = null;
    let payload;
    if (inserted.changes > 0) {
      const pin = pinCreatedAtStmt.get(message.chat_id, mid);
      pinEvent = typeof recordPinEvent === 'function'
        ? recordPinEvent({
            chatId: message.chat_id,
            messageId: mid,
            action: 'pinned',
            actor: pinner,
            createdAt: pin?.created_at || null,
          })
        : null;
      payload = typeof broadcastPinsUpdated === 'function'
        ? broadcastPinsUpdated(message.chat_id, { action: 'pinned', actorId: pinner.id, messageId: mid, pinEvent })
        : { ...(typeof getChatPinPayload === 'function' ? getChatPinPayload(message.chat_id) : {}), pin_event: pinEvent };
      if (typeof notifyPinCreated === 'function') {
        notifyPinCreated({ chatId: message.chat_id, messageId: mid, actor: pinner });
      }
    } else {
      payload = typeof getChatPinPayload === 'function'
        ? getChatPinPayload(message.chat_id)
        : { pins: [], allow_unpin_any_pin: false };
    }

    return {
      ok: true,
      changed: inserted.changes > 0,
      ...payload,
    };
  }

  return {
    createPollMessage,
    pinMessage,
    toggleReaction,
    votePoll,
  };
}

module.exports = {
  createActionError,
  createMessageActionsService,
  normalizeOptionText,
};
