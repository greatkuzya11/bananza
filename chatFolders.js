function intId(value) {
  const next = Number(value || 0);
  return Number.isInteger(next) && next > 0 ? next : 0;
}

function normalizeFolderName(value, maxLength = 50) {
  const text = String(value || '').trim().replace(/\s+/g, ' ');
  if (!text || text.length > maxLength) {
    const error = new Error('Invalid folder name');
    error.status = 400;
    throw error;
  }
  return text;
}

function boolValue(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  if (value === 0 || value === '0') return false;
  return !!fallback;
}

function uniquePositiveIds(values = []) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map((value) => intId(value))
      .filter(Boolean)
  )];
}

function createChatFoldersFeature({
  app,
  db,
  auth,
  sendToUser,
}) {
  const folderRowsForUserStmt = db.prepare(`
    SELECT *
    FROM chat_folders
    WHERE user_id=?
    ORDER BY sort_order ASC, id ASC
  `);
  const folderRowForUserStmt = db.prepare(`
    SELECT *
    FROM chat_folders
    WHERE id=? AND user_id=?
  `);
  const customFolderRowForUserStmt = db.prepare(`
    SELECT *
    FROM chat_folders
    WHERE id=? AND user_id=? AND kind='custom'
  `);
  const maxFolderOrderStmt = db.prepare(`
    SELECT COALESCE(MAX(sort_order), 0) as max_order
    FROM chat_folders
    WHERE user_id=?
  `);
  const insertFolderStmt = db.prepare(`
    INSERT INTO chat_folders(user_id, name, kind, bot_id, sort_order, updated_at)
    VALUES(?,?,?,?,?,datetime('now'))
  `);
  const updateFolderNameStmt = db.prepare(`
    UPDATE chat_folders
    SET name=?, updated_at=datetime('now')
    WHERE id=? AND user_id=? AND kind='custom'
  `);
  const updateFolderSortOrderStmt = db.prepare(`
    UPDATE chat_folders
    SET sort_order=?, updated_at=datetime('now')
    WHERE id=?
  `);
  const shiftFolderSortOrdersDownStmt = db.prepare(`
    UPDATE chat_folders
    SET sort_order=COALESCE(sort_order, 0) + 1, updated_at=datetime('now')
    WHERE user_id=?
  `);
  const updateBotAutoFolderNameStmt = db.prepare(`
    UPDATE chat_folders
    SET name=?, updated_at=datetime('now')
    WHERE id=?
  `);
  const deleteFolderStmt = db.prepare(`
    DELETE FROM chat_folders
    WHERE id=? AND user_id=? AND kind='custom'
  `);
  const botAutoFolderRowsForUserStmt = db.prepare(`
    SELECT *
    FROM chat_folders
    WHERE user_id=? AND kind='bot_auto'
    ORDER BY sort_order ASC, id ASC
  `);
  const insertMembershipStmt = db.prepare(`
    INSERT OR IGNORE INTO chat_folder_memberships(folder_id, chat_id, created_at)
    VALUES(?,?,datetime('now'))
  `);
  const deleteMembershipStmt = db.prepare(`
    DELETE FROM chat_folder_memberships
    WHERE folder_id=? AND chat_id=?
  `);
  const validMembershipRowsForUserStmt = db.prepare(`
    SELECT m.folder_id, m.chat_id
    FROM chat_folder_memberships m
    JOIN chat_folders f ON f.id=m.folder_id
    JOIN chat_members cm ON cm.chat_id=m.chat_id AND cm.user_id=f.user_id
    WHERE f.user_id=?
    ORDER BY m.folder_id ASC, m.chat_id ASC
  `);
  const validPinRowsForUserStmt = db.prepare(`
    SELECT p.folder_id, p.chat_id, p.pin_order
    FROM chat_folder_pins p
    JOIN chat_folders f ON f.id=p.folder_id
    JOIN chat_members cm ON cm.chat_id=p.chat_id AND cm.user_id=f.user_id
    WHERE f.user_id=?
    ORDER BY p.folder_id ASC, p.pin_order ASC, p.chat_id ASC
  `);
  const chatMemberExistsForUserStmt = db.prepare(`
    SELECT 1
    FROM chat_members
    WHERE chat_id=? AND user_id=?
    LIMIT 1
  `);
  const userChatIdsStmt = db.prepare(`
    SELECT chat_id
    FROM chat_members
    WHERE user_id=?
    ORDER BY chat_id ASC
  `);
  const folderPinnedRowStmt = db.prepare(`
    SELECT pin_order
    FROM chat_folder_pins
    WHERE folder_id=? AND chat_id=?
  `);
  const folderPinnedMaxOrderStmt = db.prepare(`
    SELECT COALESCE(MAX(pin_order), 0) as max_order
    FROM chat_folder_pins
    WHERE folder_id=?
  `);
  const insertFolderPinStmt = db.prepare(`
    INSERT INTO chat_folder_pins(folder_id, chat_id, pin_order, created_at)
    VALUES(?,?,?,datetime('now'))
  `);
  const updateFolderPinOrderStmt = db.prepare(`
    UPDATE chat_folder_pins
    SET pin_order=?
    WHERE folder_id=? AND chat_id=?
  `);
  const deleteFolderPinStmt = db.prepare(`
    DELETE FROM chat_folder_pins
    WHERE folder_id=? AND chat_id=?
  `);
  const shiftFolderPinsDownAfterStmt = db.prepare(`
    UPDATE chat_folder_pins
    SET pin_order=pin_order-1
    WHERE folder_id=? AND pin_order>?
  `);
  const folderPinAdjacentUpStmt = db.prepare(`
    SELECT chat_id, pin_order
    FROM chat_folder_pins
    WHERE folder_id=? AND pin_order<?
    ORDER BY pin_order DESC
    LIMIT 1
  `);
  const folderPinAdjacentDownStmt = db.prepare(`
    SELECT chat_id, pin_order
    FROM chat_folder_pins
    WHERE folder_id=? AND pin_order>?
    ORDER BY pin_order ASC
    LIMIT 1
  `);
  const folderPinsForUserChatStmt = db.prepare(`
    SELECT p.folder_id, p.chat_id, p.pin_order
    FROM chat_folder_pins p
    JOIN chat_folders f ON f.id=p.folder_id
    WHERE f.user_id=? AND p.chat_id=?
    ORDER BY p.folder_id ASC, p.pin_order ASC
  `);
  const customMembershipFolderIdsForUserChatStmt = db.prepare(`
    SELECT m.folder_id
    FROM chat_folder_memberships m
    JOIN chat_folders f ON f.id=m.folder_id
    WHERE f.user_id=? AND f.kind='custom' AND m.chat_id=?
    ORDER BY m.folder_id ASC
  `);
  const chatMemberUserIdsStmt = db.prepare(`
    SELECT user_id
    FROM chat_members
    WHERE chat_id=?
  `);
  const botAutoChatRowsStmt = db.prepare(`
    WITH bot_sources AS (
      SELECT cb.chat_id, cb.bot_id
      FROM ai_chat_bots cb
      JOIN ai_bots b ON b.id=cb.bot_id
      WHERE cb.enabled=1 AND b.enabled=1
      UNION
      SELECT a.chat_id, a.bot_id
      FROM bot_chat_add_audit a
      WHERE a.bot_id IS NOT NULL
      UNION
      SELECT m.chat_id, m.ai_bot_id as bot_id
      FROM messages m
      WHERE m.ai_bot_id IS NOT NULL
    )
    SELECT DISTINCT
      bs.bot_id,
      bs.chat_id,
      COALESCE(NULLIF(TRIM(b.name), ''), 'AI bot') as bot_name
    FROM bot_sources bs
    JOIN chat_members cm ON cm.chat_id=bs.chat_id AND cm.user_id=?
    JOIN ai_bots b ON b.id=bs.bot_id
    ORDER BY lower(bot_name) ASC, bs.bot_id ASC, bs.chat_id ASC
  `);

  function folderPinPayload(order) {
    const normalized = Number.isFinite(Number(order)) && Number(order) > 0 ? Math.floor(Number(order)) : null;
    return {
      is_pinned: normalized != null,
      pin_order: normalized,
    };
  }

  function sendChatFoldersUpdated(userId, data = {}) {
    const id = intId(userId);
    if (!id) return;
    sendToUser(id, {
      type: 'chat_folders_updated',
      ...data,
    });
  }

  function notifyUsersChatFoldersUpdated(userIds = [], data = {}) {
    uniquePositiveIds(userIds).forEach((userId) => sendChatFoldersUpdated(userId, data));
  }

  function notifyChatMembersChatFoldersUpdated(chatId, data = {}) {
    const id = intId(chatId);
    if (!id) return;
    notifyUsersChatFoldersUpdated(
      chatMemberUserIdsStmt.all(id).map((row) => intId(row.user_id)).filter(Boolean),
      { chatId: id, ...data }
    );
  }

  function currentUserChatIds(userId) {
    return uniquePositiveIds(userChatIdsStmt.all(intId(userId)).map((row) => row.chat_id));
  }

  function folderIdsForUser(userId) {
    return folderRowsForUserStmt.all(intId(userId)).map((row) => intId(row.id)).filter(Boolean);
  }

  function normalizeFolderSortOrderTx(userId) {
    folderRowsForUserStmt.all(userId).forEach((row, index) => {
      updateFolderSortOrderStmt.run(index + 1, row.id);
    });
  }

  function deleteFolderPinsNotInChatIdsTx(folderId, chatIds = []) {
    const id = intId(folderId);
    if (!id) return;
    const ids = uniquePositiveIds(chatIds);
    if (!ids.length) {
      db.prepare('DELETE FROM chat_folder_pins WHERE folder_id=?').run(id);
      return;
    }
    const stmt = db.prepare(`
      DELETE FROM chat_folder_pins
      WHERE folder_id=?
        AND chat_id NOT IN (${ids.map(() => '?').join(',')})
    `);
    stmt.run(id, ...ids);
    db.prepare(`
      UPDATE chat_folder_pins
      SET pin_order=sub.next_order
      FROM (
        SELECT chat_id, ROW_NUMBER() OVER (ORDER BY pin_order ASC, chat_id ASC) as next_order
        FROM chat_folder_pins
        WHERE folder_id=?
      ) sub
      WHERE chat_folder_pins.folder_id=? AND chat_folder_pins.chat_id=sub.chat_id
    `).run(id, id);
  }

  function botAutoSnapshot(userId) {
    const byBotId = new Map();
    botAutoChatRowsStmt.all(intId(userId)).forEach((row) => {
      const botId = intId(row.bot_id);
      const chatId = intId(row.chat_id);
      if (!botId || !chatId) return;
      if (!byBotId.has(botId)) {
        byBotId.set(botId, {
          bot_id: botId,
          name: `${String(row.bot_name || 'AI bot').trim() || 'AI bot'} чаты`,
          chat_ids: [],
        });
      }
      byBotId.get(botId).chat_ids.push(chatId);
    });
    byBotId.forEach((entry) => {
      entry.chat_ids = uniquePositiveIds(entry.chat_ids);
    });
    return byBotId;
  }

  const syncBotAutoFoldersTx = db.transaction((userId) => {
    const normalizedUserId = intId(userId);
    if (!normalizedUserId) return new Map();
    const snapshot = botAutoSnapshot(normalizedUserId);
    const existingRows = botAutoFolderRowsForUserStmt.all(normalizedUserId);
    const existingByBotId = new Map(existingRows.map((row) => [intId(row.bot_id), row]));
    let nextOrder = Number(maxFolderOrderStmt.get(normalizedUserId)?.max_order || 0);

    snapshot.forEach((entry, botId) => {
      const existing = existingByBotId.get(botId);
      if (existing) {
        if (String(existing.name || '') !== String(entry.name || '')) {
          updateBotAutoFolderNameStmt.run(entry.name, existing.id);
        }
        deleteFolderPinsNotInChatIdsTx(existing.id, entry.chat_ids);
        return;
      }
      nextOrder += 1;
      const info = insertFolderStmt.run(
        normalizedUserId,
        entry.name,
        'bot_auto',
        botId,
        nextOrder
      );
      deleteFolderPinsNotInChatIdsTx(info.lastInsertRowid, entry.chat_ids);
    });

    existingRows.forEach((row) => {
      if (snapshot.has(intId(row.bot_id))) return;
      db.prepare('DELETE FROM chat_folders WHERE id=? AND user_id=? AND kind=\'bot_auto\'').run(row.id, normalizedUserId);
    });

    normalizeFolderSortOrderTx(normalizedUserId);
    return snapshot;
  });

  function ensureFolderRowForUser(userId, folderId, { customOnly = false } = {}) {
    const normalizedUserId = intId(userId);
    const normalizedFolderId = intId(folderId);
    const row = customOnly
      ? customFolderRowForUserStmt.get(normalizedFolderId, normalizedUserId)
      : folderRowForUserStmt.get(normalizedFolderId, normalizedUserId);
    if (!row) {
      const error = new Error(customOnly ? 'Folder not found or not editable' : 'Folder not found');
      error.status = 404;
      throw error;
    }
    return row;
  }

  function getFolderChatIdsForUser(userId, folderRow, botSnapshot = null) {
    if (!folderRow) return [];
    if (String(folderRow.kind || '') === 'bot_auto') {
      const snapshot = botSnapshot || botAutoSnapshot(userId);
      return uniquePositiveIds(snapshot.get(intId(folderRow.bot_id))?.chat_ids || []);
    }
    return uniquePositiveIds(db.prepare(`
      SELECT m.chat_id
      FROM chat_folder_memberships m
      JOIN chat_members cm ON cm.chat_id=m.chat_id AND cm.user_id=?
      WHERE m.folder_id=?
      ORDER BY m.chat_id ASC
    `).all(intId(userId), intId(folderRow.id)).map((row) => row.chat_id));
  }

  function listFolders(userId) {
    const normalizedUserId = intId(userId);
    if (!normalizedUserId) return [];
    const botSnapshot = syncBotAutoFoldersTx(normalizedUserId);
    const rows = folderRowsForUserStmt.all(normalizedUserId);
    const membershipRows = validMembershipRowsForUserStmt.all(normalizedUserId);
    const pinRows = validPinRowsForUserStmt.all(normalizedUserId);
    const membershipsByFolderId = new Map();
    const pinsByFolderId = new Map();

    membershipRows.forEach((row) => {
      const folderId = intId(row.folder_id);
      if (!folderId) return;
      if (!membershipsByFolderId.has(folderId)) membershipsByFolderId.set(folderId, []);
      membershipsByFolderId.get(folderId).push(intId(row.chat_id));
    });

    pinRows.forEach((row) => {
      const folderId = intId(row.folder_id);
      if (!folderId) return;
      if (!pinsByFolderId.has(folderId)) pinsByFolderId.set(folderId, []);
      pinsByFolderId.get(folderId).push({
        chat_id: intId(row.chat_id),
        pin_order: Number(row.pin_order || 0),
      });
    });

    return rows.map((row) => {
      const folderId = intId(row.id);
      const kind = String(row.kind || 'custom');
      const chatIds = kind === 'bot_auto'
        ? uniquePositiveIds(botSnapshot.get(intId(row.bot_id))?.chat_ids || [])
        : uniquePositiveIds(membershipsByFolderId.get(folderId) || []);
      const allowedChatIds = new Set(chatIds);
      const pins = (pinsByFolderId.get(folderId) || [])
        .filter((pin) => allowedChatIds.has(intId(pin.chat_id)))
        .sort((a, b) => Number(a.pin_order || 0) - Number(b.pin_order || 0))
        .map((pin) => ({
          chat_id: intId(pin.chat_id),
          pin_order: Math.floor(Number(pin.pin_order || 0)),
        }));
      return {
        id: folderId,
        name: String(row.name || '').trim(),
        kind,
        system: kind === 'bot_auto',
        bot_id: intId(row.bot_id) || null,
        sort_order: Math.floor(Number(row.sort_order || 0)) || 0,
        chat_ids: chatIds,
        pins,
      };
    });
  }

  function listFolderById(userId, folderId) {
    const normalizedFolderId = intId(folderId);
    return listFolders(userId).find((folder) => intId(folder.id) === normalizedFolderId) || null;
  }

  const createCustomFolderTx = db.transaction((userId, { name, chatIds = [] } = {}) => {
    const normalizedUserId = intId(userId);
    const normalizedName = normalizeFolderName(name);
    const validChatIds = currentUserChatIds(normalizedUserId);
    const validChatIdSet = new Set(validChatIds);
    const selectedChatIds = uniquePositiveIds(chatIds).filter((chatId) => validChatIdSet.has(chatId));
    shiftFolderSortOrdersDownStmt.run(normalizedUserId);
    const info = insertFolderStmt.run(
      normalizedUserId,
      normalizedName,
      'custom',
      null,
      1
    );
    const folderId = intId(info.lastInsertRowid);
    selectedChatIds.forEach((chatId) => {
      insertMembershipStmt.run(folderId, chatId);
    });
    return folderId;
  });

  const renameCustomFolderTx = db.transaction((userId, folderId, name) => {
    const row = ensureFolderRowForUser(userId, folderId, { customOnly: true });
    const normalizedName = normalizeFolderName(name);
    updateFolderNameStmt.run(normalizedName, row.id, intId(userId));
    return row.id;
  });

  const deleteCustomFolderTx = db.transaction((userId, folderId) => {
    const row = ensureFolderRowForUser(userId, folderId, { customOnly: true });
    deleteFolderStmt.run(row.id, intId(userId));
    normalizeFolderSortOrderTx(intId(userId));
    return row.id;
  });

  const setFolderOrderTx = db.transaction((userId, folderIds = []) => {
    const normalizedUserId = intId(userId);
    syncBotAutoFoldersTx(normalizedUserId);
    const currentIds = folderIdsForUser(normalizedUserId);
    const nextIds = uniquePositiveIds(folderIds);
    const currentKey = JSON.stringify([...currentIds].sort((a, b) => a - b));
    const nextKey = JSON.stringify([...nextIds].sort((a, b) => a - b));
    if (!nextIds.length || currentKey !== nextKey) {
      const error = new Error('Folder order must include every folder exactly once');
      error.status = 400;
      throw error;
    }
    nextIds.forEach((folderId, index) => {
      updateFolderSortOrderStmt.run(index + 1, folderId);
    });
    return nextIds;
  });

  const addChatsToFolderTx = db.transaction((userId, folderId, chatIds = []) => {
    const row = ensureFolderRowForUser(userId, folderId, { customOnly: true });
    const validChatIdSet = new Set(currentUserChatIds(userId));
    const addedChatIds = uniquePositiveIds(chatIds).filter((chatId) => validChatIdSet.has(chatId));
    addedChatIds.forEach((chatId) => insertMembershipStmt.run(row.id, chatId));
    return row.id;
  });

  const removeChatFromFolderTx = db.transaction((userId, folderId, chatId) => {
    const row = ensureFolderRowForUser(userId, folderId, { customOnly: true });
    const normalizedChatId = intId(chatId);
    const pinned = folderPinnedRowStmt.get(row.id, normalizedChatId);
    if (pinned?.pin_order) {
      deleteFolderPinStmt.run(row.id, normalizedChatId);
      shiftFolderPinsDownAfterStmt.run(row.id, Number(pinned.pin_order || 0));
    }
    deleteMembershipStmt.run(row.id, normalizedChatId);
    return row.id;
  });

  const setFolderChatPinTx = db.transaction((userId, folderId, chatId, pinned) => {
    const row = ensureFolderRowForUser(userId, folderId);
    const normalizedUserId = intId(userId);
    const normalizedChatId = intId(chatId);
    const folderChatIds = new Set(getFolderChatIdsForUser(normalizedUserId, row));
    if (!folderChatIds.has(normalizedChatId)) {
      const error = new Error('Chat is not part of this folder');
      error.status = 400;
      throw error;
    }
    const existing = folderPinnedRowStmt.get(row.id, normalizedChatId);
    const nextPinned = boolValue(pinned, existing?.pin_order != null);
    if (nextPinned) {
      if (existing?.pin_order) {
        return {
          folderId: row.id,
          chatId: normalizedChatId,
          folder_pin: folderPinPayload(existing.pin_order),
        };
      }
      const nextOrder = Number(folderPinnedMaxOrderStmt.get(row.id)?.max_order || 0) + 1;
      insertFolderPinStmt.run(row.id, normalizedChatId, nextOrder);
      return {
        folderId: row.id,
        chatId: normalizedChatId,
        folder_pin: folderPinPayload(nextOrder),
      };
    }
    if (existing?.pin_order) {
      deleteFolderPinStmt.run(row.id, normalizedChatId);
      shiftFolderPinsDownAfterStmt.run(row.id, Number(existing.pin_order || 0));
    }
    return {
      folderId: row.id,
      chatId: normalizedChatId,
      folder_pin: folderPinPayload(null),
    };
  });

  const moveFolderChatPinTx = db.transaction((userId, folderId, chatId, direction) => {
    const row = ensureFolderRowForUser(userId, folderId);
    const normalizedChatId = intId(chatId);
    const current = folderPinnedRowStmt.get(row.id, normalizedChatId);
    if (!current?.pin_order) {
      const error = new Error('Chat is not pinned in this folder');
      error.status = 400;
      throw error;
    }
    const currentOrder = Number(current.pin_order || 0);
    const adjacent = String(direction || '').toLowerCase() === 'up'
      ? folderPinAdjacentUpStmt.get(row.id, currentOrder)
      : folderPinAdjacentDownStmt.get(row.id, currentOrder);
    if (!adjacent?.chat_id || !adjacent?.pin_order) {
      return {
        folderId: row.id,
        chatId: normalizedChatId,
        moved: false,
        folder_pin: folderPinPayload(currentOrder),
      };
    }
    // Swap through a temporary order so the unique (folder_id, pin_order) index
    // is never violated mid-transaction.
    updateFolderPinOrderStmt.run(0, row.id, normalizedChatId);
    updateFolderPinOrderStmt.run(currentOrder, row.id, intId(adjacent.chat_id));
    updateFolderPinOrderStmt.run(Number(adjacent.pin_order), row.id, normalizedChatId);
    return {
      folderId: row.id,
      chatId: normalizedChatId,
      moved: true,
      folder_pin: folderPinPayload(Number(adjacent.pin_order)),
    };
  });

  const removeChatFromUserFoldersTx = db.transaction((userId, chatId) => {
    const normalizedUserId = intId(userId);
    const normalizedChatId = intId(chatId);
    if (!normalizedUserId || !normalizedChatId) return false;
    const pinnedRows = folderPinsForUserChatStmt.all(normalizedUserId, normalizedChatId);
    pinnedRows.forEach((row) => {
      deleteFolderPinStmt.run(intId(row.folder_id), normalizedChatId);
      shiftFolderPinsDownAfterStmt.run(intId(row.folder_id), Number(row.pin_order || 0));
    });
    customMembershipFolderIdsForUserChatStmt.all(normalizedUserId, normalizedChatId).forEach((row) => {
      deleteMembershipStmt.run(intId(row.folder_id), normalizedChatId);
    });
    return pinnedRows.length > 0;
  });

  app.get('/api/chat-folders', auth, (req, res) => {
    return res.json({ folders: listFolders(req.user.id) });
  });

  app.post('/api/chat-folders', auth, (req, res) => {
    try {
      const folderId = createCustomFolderTx(req.user.id, {
        name: req.body?.name,
        chatIds: req.body?.chatIds || req.body?.chat_ids || [],
      });
      const folder = listFolderById(req.user.id, folderId);
      sendChatFoldersUpdated(req.user.id, { folderId, reason: 'folder_created' });
      return res.json({ folder });
    } catch (error) {
      return res.status(error.status || 400).json({ error: error.message || 'Could not create folder' });
    }
  });

  app.put('/api/chat-folders/order', auth, (req, res) => {
    try {
      setFolderOrderTx(req.user.id, req.body?.folderIds || req.body?.folder_ids || []);
      const folders = listFolders(req.user.id);
      sendChatFoldersUpdated(req.user.id, { reason: 'folder_order' });
      return res.json({ folders });
    } catch (error) {
      return res.status(error.status || 400).json({ error: error.message || 'Could not reorder folders' });
    }
  });

  app.put('/api/chat-folders/:folderId', auth, (req, res) => {
    try {
      const folderId = renameCustomFolderTx(req.user.id, req.params.folderId, req.body?.name);
      const folder = listFolderById(req.user.id, folderId);
      sendChatFoldersUpdated(req.user.id, { folderId, reason: 'folder_renamed' });
      return res.json({ folder });
    } catch (error) {
      return res.status(error.status || 400).json({ error: error.message || 'Could not rename folder' });
    }
  });

  app.delete('/api/chat-folders/:folderId', auth, (req, res) => {
    try {
      const folderId = deleteCustomFolderTx(req.user.id, req.params.folderId);
      sendChatFoldersUpdated(req.user.id, { folderId, reason: 'folder_deleted' });
      return res.json({ ok: true, folderId });
    } catch (error) {
      return res.status(error.status || 400).json({ error: error.message || 'Could not delete folder' });
    }
  });

  app.post('/api/chat-folders/:folderId/chats', auth, (req, res) => {
    try {
      const requestedIds = [
        ...uniquePositiveIds(req.body?.chatIds || req.body?.chat_ids || []),
        intId(req.body?.chatId),
      ].filter(Boolean);
      const folderId = addChatsToFolderTx(req.user.id, req.params.folderId, requestedIds);
      const folder = listFolderById(req.user.id, folderId);
      sendChatFoldersUpdated(req.user.id, { folderId, reason: 'folder_membership_add' });
      return res.json({ folder });
    } catch (error) {
      return res.status(error.status || 400).json({ error: error.message || 'Could not add chats to folder' });
    }
  });

  app.delete('/api/chat-folders/:folderId/chats/:chatId', auth, (req, res) => {
    try {
      const folderId = removeChatFromFolderTx(req.user.id, req.params.folderId, req.params.chatId);
      const folder = listFolderById(req.user.id, folderId);
      sendChatFoldersUpdated(req.user.id, { folderId, chatId: intId(req.params.chatId), reason: 'folder_membership_remove' });
      return res.json({ folder });
    } catch (error) {
      return res.status(error.status || 400).json({ error: error.message || 'Could not remove chat from folder' });
    }
  });

  app.put('/api/chat-folders/:folderId/chats/:chatId/pin', auth, (req, res) => {
    try {
      const result = setFolderChatPinTx(req.user.id, req.params.folderId, req.params.chatId, req.body?.pinned);
      sendChatFoldersUpdated(req.user.id, {
        folderId: result.folderId,
        chatId: result.chatId,
        reason: result.folder_pin.is_pinned ? 'folder_pin' : 'folder_unpin',
      });
      return res.json(result);
    } catch (error) {
      return res.status(error.status || 400).json({ error: error.message || 'Could not update folder pin' });
    }
  });

  app.post('/api/chat-folders/:folderId/chats/:chatId/pin/move', auth, (req, res) => {
    try {
      const direction = String(req.body?.direction || '').trim().toLowerCase();
      if (direction !== 'up' && direction !== 'down') {
        return res.status(400).json({ error: 'Direction must be up or down' });
      }
      const result = moveFolderChatPinTx(req.user.id, req.params.folderId, req.params.chatId, direction);
      sendChatFoldersUpdated(req.user.id, {
        folderId: result.folderId,
        chatId: result.chatId,
        reason: 'folder_pin_move',
      });
      return res.json(result);
    } catch (error) {
      return res.status(error.status || 400).json({ error: error.message || 'Could not move folder pin' });
    }
  });

  return {
    listFolders,
    listFolderById,
    sendChatFoldersUpdated,
    notifyUsersChatFoldersUpdated,
    notifyChatMembersChatFoldersUpdated,
    removeChatFromUserFolders(userId, chatId) {
      const removed = removeChatFromUserFoldersTx(userId, chatId);
      sendChatFoldersUpdated(userId, { chatId: intId(chatId), reason: 'chat_removed' });
      return removed;
    },
  };
}

module.exports = {
  createChatFoldersFeature,
};
