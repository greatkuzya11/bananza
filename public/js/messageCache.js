// User-scoped IndexedDB message cache and safe image asset cache helpers.
(function () {
  const DB_NAME = 'bananza-cache-v2';
  const DB_VERSION = 5;
  const STORE_MESSAGES = 'messages';
  const STORE_PAGES = 'message_pages';
  const STORE_MEDIA_PAGES = 'media_pages';
  const STORE_OUTBOX = 'outbox';
  const STORE_CHAT_META = 'chat_meta';
  const INDEX_USER_CHAT_ID = 'by_user_chat_id';
  const INDEX_OUTBOX_USER_CHAT_CREATED = 'by_user_chat_created';
  const ASSET_CACHE = 'bananza-assets-v2';
  const OLD_ASSET_CACHES = ['bananza-assets-v1'];
  const OLD_DB_NAMES = ['bananza-cache-v1'];
  const DEFAULT_MESSAGE_LIMIT = 800;
  const MAX_PREFETCH_ASSETS = 24;

  let currentUserId = null;
  let db = null;
  let dbPromise = null;
  let oldDbCleanupStarted = false;

  function normalizeId(value) {
    const id = Number(value || 0);
    return Number.isFinite(id) && id > 0 ? id : 0;
  }

  function clampLimit(limit, fallback = DEFAULT_MESSAGE_LIMIT) {
    const n = Number(limit || fallback);
    return Math.min(2000, Math.max(1, Number.isFinite(n) ? n : fallback));
  }

  function openDB() {
    if (!('indexedDB' in window)) return Promise.resolve(null);
    if (db) return Promise.resolve(db);
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (event) => {
        const nextDb = event.target.result;
        if (!nextDb.objectStoreNames.contains(STORE_MESSAGES)) {
          const store = nextDb.createObjectStore(STORE_MESSAGES, { keyPath: ['userId', 'chatId', 'id'] });
          store.createIndex(INDEX_USER_CHAT_ID, ['userId', 'chatId', 'id']);
        }
        if (!nextDb.objectStoreNames.contains(STORE_PAGES)) {
          nextDb.createObjectStore(STORE_PAGES, { keyPath: ['userId', 'chatId', 'direction', 'cursor'] });
        }
        if (!nextDb.objectStoreNames.contains(STORE_MEDIA_PAGES)) {
          nextDb.createObjectStore(STORE_MEDIA_PAGES, { keyPath: ['userId', 'chatId', 'direction', 'cursor'] });
        }
        if (!nextDb.objectStoreNames.contains(STORE_OUTBOX)) {
          const outbox = nextDb.createObjectStore(STORE_OUTBOX, { keyPath: ['userId', 'chatId', 'clientId'] });
          outbox.createIndex(INDEX_OUTBOX_USER_CHAT_CREATED, ['userId', 'chatId', 'createdAt']);
        }
        if (!nextDb.objectStoreNames.contains(STORE_CHAT_META)) {
          nextDb.createObjectStore(STORE_CHAT_META, { keyPath: ['userId', 'chatId'] });
        }
      };
      req.onsuccess = () => {
        db = req.result;
        db.onversionchange = () => {
          try { db.close(); } catch (e) {}
          db = null;
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => {
        dbPromise = null;
        reject(req.error);
      };
      req.onblocked = () => reject(req.error || new Error('IndexedDB open blocked'));
    });

    return dbPromise;
  }

  async function withObjectStore(storeName, mode, fn) {
    const database = await openDB();
    if (!database || !currentUserId) return null;
    return new Promise((resolve) => {
      try {
        const tx = database.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const result = fn(store, tx);
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => resolve(null);
        tx.onabort = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  function withStore(mode, fn) {
    return withObjectStore(STORE_MESSAGES, mode, fn);
  }

  function normalizeMessage(chatId, msg) {
    const id = normalizeId(msg?.id);
    const cid = normalizeId(chatId || msg?.chat_id || msg?.chatId);
    if (!id || !cid || !currentUserId) return null;
    return { ...msg, userId: currentUserId, chatId: cid };
  }

  function normalizeClientId(value) {
    const id = String(value || '').trim();
    return id ? id : '';
  }

  function normalizePageDirection(value) {
    return value === 'after' ? 'after' : 'before';
  }

  function normalizePageCursor(value) {
    const cursor = Number(value || 0);
    return Number.isFinite(cursor) && cursor > 0 ? Math.floor(cursor) : 0;
  }

  function normalizeOutboxItem(item) {
    const cid = normalizeId(item?.chatId || item?.chat_id);
    const clientId = normalizeClientId(item?.clientId || item?.client_id);
    if (!currentUserId || !cid || !clientId) return null;
    return {
      ...item,
      userId: currentUserId,
      chatId: cid,
      clientId,
      status: item.status || 'failed',
      createdAt: item.createdAt || new Date().toISOString(),
    };
  }

  function rangeForChat(chatId, minId = 0, maxId = Number.MAX_SAFE_INTEGER) {
    return IDBKeyRange.bound([currentUserId, normalizeId(chatId), minId], [currentUserId, normalizeId(chatId), maxId]);
  }

  function rangeFromMessages(messages = []) {
    let minId = Number.MAX_SAFE_INTEGER;
    let maxId = 0;
    let count = 0;
    for (const msg of Array.isArray(messages) ? messages : []) {
      const id = normalizeId(msg?.id);
      if (!id) continue;
      minId = Math.min(minId, id);
      maxId = Math.max(maxId, id);
      count += 1;
    }
    return { minId: count ? minId : 0, maxId, count };
  }

  function booleanOrNull(value) {
    return typeof value === 'boolean' ? value : null;
  }

  function readCursor(index, range, direction, limit) {
    return new Promise((resolve) => {
      const out = [];
      const req = index.openCursor(range, direction);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor || out.length >= limit) return resolve(out);
        out.push(cursor.value);
        cursor.continue();
      };
      req.onerror = () => resolve(out);
    });
  }

  async function init(userId) {
    currentUserId = normalizeId(userId);
    if (!currentUserId) return false;
    try {
      const database = await openDB();
      if (!database) return false;
      if (!oldDbCleanupStarted && 'indexedDB' in window) {
        oldDbCleanupStarted = true;
        OLD_DB_NAMES.forEach((name) => {
          try { indexedDB.deleteDatabase(name); } catch (e) {}
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  async function readLatest(chatId, { limit = DEFAULT_MESSAGE_LIMIT } = {}) {
    const cid = normalizeId(chatId);
    const max = clampLimit(limit);
    if (!currentUserId || !cid) return [];
    const database = await openDB().catch(() => null);
    if (!database) return [];
    try {
      const tx = database.transaction(STORE_MESSAGES, 'readonly');
      const index = tx.objectStore(STORE_MESSAGES).index(INDEX_USER_CHAT_ID);
      const rows = await readCursor(index, rangeForChat(cid), 'prev', max);
      return rows.reverse();
    } catch {
      return [];
    }
  }

  async function readChatMeta(chatId) {
    const cid = normalizeId(chatId);
    if (!currentUserId || !cid) return null;
    const database = await openDB().catch(() => null);
    if (!database || !database.objectStoreNames.contains(STORE_CHAT_META)) return null;
    try {
      return await new Promise((resolve) => {
        const tx = database.transaction(STORE_CHAT_META, 'readonly');
        const req = tx.objectStore(STORE_CHAT_META).get([currentUserId, cid]);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  async function writeChatMeta(chatId, patch = {}) {
    const cid = normalizeId(chatId);
    if (!currentUserId || !cid || !patch || typeof patch !== 'object') return null;
    const database = await openDB().catch(() => null);
    if (!database || !database.objectStoreNames.contains(STORE_CHAT_META)) return null;
    return await new Promise((resolve) => {
      let next = null;
      try {
        const tx = database.transaction(STORE_CHAT_META, 'readwrite');
        const store = tx.objectStore(STORE_CHAT_META);
        const req = store.get([currentUserId, cid]);
        req.onsuccess = () => {
          const previous = patch.replaceRange ? null : req.result;
          const patchMin = normalizeId(patch.minId);
          const patchMax = normalizeId(patch.maxId);
          const prevMin = normalizeId(previous?.minId);
          const prevMax = normalizeId(previous?.maxId);
          const prevKnown = normalizeId(previous?.lastKnownServerId);
          const patchKnown = normalizeId(patch.lastKnownServerId);
          next = {
            userId: currentUserId,
            chatId: cid,
            minId: patch.replaceRange
              ? patchMin
              : (patchMin && prevMin ? Math.min(patchMin, prevMin) : (patchMin || prevMin || 0)),
            maxId: patch.replaceRange ? patchMax : Math.max(patchMax, prevMax),
            hasMoreBefore: booleanOrNull(patch.hasMoreBefore) ?? booleanOrNull(previous?.hasMoreBefore),
            hasMoreAfter: booleanOrNull(patch.hasMoreAfter) ?? booleanOrNull(previous?.hasMoreAfter),
            lastKnownServerId: Math.max(patchKnown, prevKnown, patchMax, prevMax),
            savedAt: Date.now(),
          };
          store.put(next);
        };
        tx.oncomplete = () => resolve(next);
        tx.onerror = () => resolve(null);
        tx.onabort = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async function getCachedRange(chatId) {
    const cid = normalizeId(chatId);
    if (!currentUserId || !cid) return null;
    const database = await openDB().catch(() => null);
    if (!database) return null;
    try {
      const tx = database.transaction(STORE_MESSAGES, 'readonly');
      const index = tx.objectStore(STORE_MESSAGES).index(INDEX_USER_CHAT_ID);
      const range = rangeForChat(cid);
      const readEdge = (direction) => new Promise((resolve) => {
        const req = index.openCursor(range, direction);
        req.onsuccess = () => resolve(req.result?.value || null);
        req.onerror = () => resolve(null);
      });
      const [first, last, meta] = await Promise.all([
        readEdge('next'),
        readEdge('prev'),
        readChatMeta(cid),
      ]);
      const minId = normalizeId(first?.id);
      const maxId = normalizeId(last?.id);
      return {
        ...(meta || {}),
        userId: currentUserId,
        chatId: cid,
        minId,
        maxId,
        hasMessages: Boolean(minId && maxId),
        lastKnownServerId: Math.max(normalizeId(meta?.lastKnownServerId), maxId),
      };
    } catch {
      return readChatMeta(cid);
    }
  }

  async function readAround(chatId, anchorId, { limit = DEFAULT_MESSAGE_LIMIT } = {}) {
    const cid = normalizeId(chatId);
    const anchor = normalizeId(anchorId);
    const max = clampLimit(limit);
    if (!anchor) return readLatest(cid, { limit: max });
    if (!currentUserId || !cid) return [];
    const database = await openDB().catch(() => null);
    if (!database) return [];
    try {
      const tx = database.transaction(STORE_MESSAGES, 'readonly');
      const index = tx.objectStore(STORE_MESSAGES).index(INDEX_USER_CHAT_ID);
      const olderLimit = Math.floor((max - 1) / 2) + 1;
      const newerLimit = Math.max(0, max - olderLimit);
      const olderRange = rangeForChat(cid, 0, anchor);
      const newerRange = rangeForChat(cid, anchor + 1, Number.MAX_SAFE_INTEGER);
      const [older, newer] = await Promise.all([
        readCursor(index, olderRange, 'prev', olderLimit),
        readCursor(index, newerRange, 'next', newerLimit),
      ]);
      const rows = [...older.reverse(), ...newer];
      const seen = new Set();
      return rows.filter((row) => {
        const key = row.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
    } catch {
      return [];
    }
  }

  async function readMessagesByIds(chatId, ids = []) {
    const cid = normalizeId(chatId);
    const messageIds = [...new Set((ids || []).map(normalizeId).filter(Boolean))];
    if (!currentUserId || !cid || !messageIds.length) return [];
    const database = await openDB().catch(() => null);
    if (!database) return [];
    try {
      const tx = database.transaction(STORE_MESSAGES, 'readonly');
      const store = tx.objectStore(STORE_MESSAGES);
      const rows = await Promise.all(messageIds.map((id) => new Promise((resolve) => {
        const req = store.get([currentUserId, cid, id]);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      })));
      return rows.filter(Boolean).sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
    } catch {
      return [];
    }
  }

  async function trimChat(chatId, limit = DEFAULT_MESSAGE_LIMIT) {
    const cid = normalizeId(chatId);
    const max = clampLimit(limit);
    if (!currentUserId || !cid) return false;
    return !!(await withStore('readwrite', (store) => {
      const index = store.index(INDEX_USER_CHAT_ID);
      const req = index.openCursor(rangeForChat(cid), 'prev');
      let seen = 0;
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        seen += 1;
        if (seen > max) store.delete(cursor.primaryKey);
        cursor.continue();
      };
      return true;
    }));
  }

  async function writeWindow(chatId, messages = [], { limit = DEFAULT_MESSAGE_LIMIT, hasMoreBefore = null, hasMoreAfter = null, lastKnownServerId = 0, replaceRange = false } = {}) {
    const cid = normalizeId(chatId);
    if (!Array.isArray(messages) || !cid || !currentUserId) return false;
    const messageRange = rangeFromMessages(messages);
    const ok = await withStore('readwrite', (store) => {
      for (const msg of messages) {
        const row = normalizeMessage(cid, msg);
        if (row) store.put(row);
      }
      return true;
    });
    if (ok) await trimChat(cid, limit);
    if (ok) {
      await writeChatMeta(cid, {
        ...messageRange,
        hasMoreBefore,
        hasMoreAfter,
        lastKnownServerId,
        replaceRange,
      });
    }
    return !!ok;
  }

  async function writePage(chatId, { direction = 'before', cursor = 0, messages = [], hasMoreBefore = null, hasMoreAfter = null, limit = DEFAULT_MESSAGE_LIMIT } = {}) {
    const cid = normalizeId(chatId);
    const pageCursor = normalizePageCursor(cursor);
    const pageDirection = normalizePageDirection(direction);
    if (!Array.isArray(messages) || !messages.length || !cid || !pageCursor || !currentUserId) return false;
    const messageIds = [...new Set(messages.map((msg) => normalizeId(msg?.id)).filter(Boolean))].sort((a, b) => a - b);
    if (!messageIds.length) return false;
    const wroteMessages = await writeWindow(cid, messages, {
      limit,
      hasMoreBefore,
      hasMoreAfter,
    });
    const wrotePage = await withObjectStore(STORE_PAGES, 'readwrite', (store) => {
      store.put({
        userId: currentUserId,
        chatId: cid,
        direction: pageDirection,
        cursor: pageCursor,
        messageIds,
        hasMoreBefore: typeof hasMoreBefore === 'boolean' ? hasMoreBefore : null,
        hasMoreAfter: typeof hasMoreAfter === 'boolean' ? hasMoreAfter : null,
        savedAt: Date.now(),
      });
      return true;
    });
    return !!(wroteMessages && wrotePage);
  }

  async function readPage(chatId, direction = 'before', cursor = 0) {
    const cid = normalizeId(chatId);
    const pageCursor = normalizePageCursor(cursor);
    const pageDirection = normalizePageDirection(direction);
    if (!currentUserId || !cid || !pageCursor) return null;
    const database = await openDB().catch(() => null);
    if (!database) return null;
    try {
      const page = await new Promise((resolve) => {
        const tx = database.transaction(STORE_PAGES, 'readonly');
        const req = tx.objectStore(STORE_PAGES).get([currentUserId, cid, pageDirection, pageCursor]);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
      const messageIds = page && Array.isArray(page.messageIds) ? page.messageIds.map(normalizeId).filter(Boolean) : [];
      if (!messageIds.length) return null;
      const messages = await readMessagesByIds(cid, messageIds);
      const complete = messages.length === messageIds.length;
      return {
        messages,
        complete,
        hasMoreBefore: typeof page.hasMoreBefore === 'boolean' ? page.hasMoreBefore : null,
        hasMoreAfter: typeof page.hasMoreAfter === 'boolean' ? page.hasMoreAfter : null,
        savedAt: page.savedAt || 0,
      };
    } catch {
      return null;
    }
  }

  async function writeMediaPage(chatId, { direction = 'after', cursor = 0, media = [], hasMoreBefore = null, hasMoreAfter = null, limit = DEFAULT_MESSAGE_LIMIT } = {}) {
    const cid = normalizeId(chatId);
    const pageCursor = normalizePageCursor(cursor);
    const pageDirection = normalizePageDirection(direction);
    if (!Array.isArray(media) || !cid || !pageCursor || !currentUserId) return false;
    const rows = media
      .map((msg) => normalizeMessage(cid, msg))
      .filter((msg) => msg && (msg.file_type === 'image' || msg.file_type === 'video'))
      .sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
    const wroteMessages = rows.length ? await writeWindow(cid, rows, {
      limit,
      hasMoreBefore,
      hasMoreAfter,
    }) : true;
    const wrotePage = await withObjectStore(STORE_MEDIA_PAGES, 'readwrite', (store) => {
      store.put({
        userId: currentUserId,
        chatId: cid,
        direction: pageDirection,
        cursor: pageCursor,
        messageIds: rows.map((msg) => normalizeId(msg.id)).filter(Boolean),
        media: rows,
        hasMoreBefore: typeof hasMoreBefore === 'boolean' ? hasMoreBefore : null,
        hasMoreAfter: typeof hasMoreAfter === 'boolean' ? hasMoreAfter : null,
        savedAt: Date.now(),
      });
      return true;
    });
    return !!(wroteMessages && wrotePage);
  }

  async function readMediaPage(chatId, direction = 'after', cursor = 0) {
    const cid = normalizeId(chatId);
    const pageCursor = normalizePageCursor(cursor);
    const pageDirection = normalizePageDirection(direction);
    if (!currentUserId || !cid || !pageCursor) return null;
    const database = await openDB().catch(() => null);
    if (!database) return null;
    try {
      const page = await new Promise((resolve) => {
        const tx = database.transaction(STORE_MEDIA_PAGES, 'readonly');
        const req = tx.objectStore(STORE_MEDIA_PAGES).get([currentUserId, cid, pageDirection, pageCursor]);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
      if (!page) return null;
      let media = Array.isArray(page.media) ? page.media : [];
      if (!media.length && Array.isArray(page.messageIds) && page.messageIds.length) {
        media = await readMessagesByIds(cid, page.messageIds);
      }
      media = media
        .filter((msg) => msg && (msg.file_type === 'image' || msg.file_type === 'video'))
        .sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
      return {
        media,
        complete: true,
        hasMoreBefore: typeof page.hasMoreBefore === 'boolean' ? page.hasMoreBefore : null,
        hasMoreAfter: typeof page.hasMoreAfter === 'boolean' ? page.hasMoreAfter : null,
        savedAt: page.savedAt || 0,
      };
    } catch {
      return null;
    }
  }

  async function upsertMessage(msg) {
    const cid = normalizeId(msg?.chat_id || msg?.chatId);
    if (!cid || !currentUserId) return false;
    const ok = await withStore('readwrite', (store) => {
      const row = normalizeMessage(cid, msg);
      if (!row) return false;
      store.put(row);
      return true;
    });
    if (ok) await trimChat(cid);
    if (ok) {
      const id = normalizeId(msg?.id);
      await writeChatMeta(cid, {
        minId: id,
        maxId: id,
        lastKnownServerId: id,
      });
    }
    return !!ok;
  }

  async function patchMessage(chatId, id, patch = {}) {
    const cid = normalizeId(chatId);
    const mid = normalizeId(id);
    if (!cid || !mid || !currentUserId || !patch || typeof patch !== 'object') return false;
    return !!(await withStore('readwrite', (store) => {
      const req = store.get([currentUserId, cid, mid]);
      req.onsuccess = () => {
        const row = req.result;
        if (!row) return;
        store.put({ ...row, ...patch, userId: currentUserId, chatId: cid, id: mid });
      };
      return true;
    }));
  }

  async function deleteMessage(chatId, id) {
    const cid = normalizeId(chatId);
    const mid = normalizeId(id);
    if (!cid || !mid || !currentUserId) return false;
    const ok = !!(await withStore('readwrite', (store) => {
      store.delete([currentUserId, cid, mid]);
      return true;
    }));
    if (ok) {
      const range = await getCachedRange(cid);
      await writeChatMeta(cid, {
        minId: range?.minId || 0,
        maxId: range?.maxId || 0,
        lastKnownServerId: range?.maxId || 0,
        hasMoreBefore: range?.hasMoreBefore,
        hasMoreAfter: range?.hasMoreAfter,
        replaceRange: true,
      });
    }
    return ok;
  }

  async function upsertOutboxItem(item) {
    const row = normalizeOutboxItem(item);
    if (!row) return false;
    return !!(await withObjectStore(STORE_OUTBOX, 'readwrite', (store) => {
      store.put(row);
      return true;
    }));
  }

  async function getOutboxItem(chatId, clientId) {
    const cid = normalizeId(chatId);
    const key = normalizeClientId(clientId);
    if (!cid || !key || !currentUserId) return null;
    const database = await openDB().catch(() => null);
    if (!database) return null;
    try {
      return await new Promise((resolve) => {
        const tx = database.transaction(STORE_OUTBOX, 'readonly');
        const req = tx.objectStore(STORE_OUTBOX).get([currentUserId, cid, key]);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  async function readOutbox(chatId) {
    const cid = normalizeId(chatId);
    if (!cid || !currentUserId) return [];
    const database = await openDB().catch(() => null);
    if (!database) return [];
    try {
      return await new Promise((resolve) => {
        const rows = [];
        const tx = database.transaction(STORE_OUTBOX, 'readonly');
        const index = tx.objectStore(STORE_OUTBOX).index(INDEX_OUTBOX_USER_CHAT_CREATED);
        const range = IDBKeyRange.bound([currentUserId, cid, ''], [currentUserId, cid, '\uffff']);
        const req = index.openCursor(range, 'next');
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) return resolve(rows);
          rows.push(cursor.value);
          cursor.continue();
        };
        req.onerror = () => resolve(rows);
      });
    } catch {
      return [];
    }
  }

  async function deleteOutboxItem(chatId, clientId) {
    const cid = normalizeId(chatId);
    const key = normalizeClientId(clientId);
    if (!cid || !key || !currentUserId) return false;
    return !!(await withObjectStore(STORE_OUTBOX, 'readwrite', (store) => {
      store.delete([currentUserId, cid, key]);
      return true;
    }));
  }

  async function clearUserCache() {
    if (!currentUserId) return false;
    const uid = currentUserId;
    const clearMessages = await withStore('readwrite', (store) => {
      const index = store.index(INDEX_USER_CHAT_ID);
      const range = IDBKeyRange.bound([uid, 0, 0], [uid, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]);
      const req = index.openCursor(range);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        store.delete(cursor.primaryKey);
        cursor.continue();
      };
      return true;
    });
    const clearOutbox = await withObjectStore(STORE_OUTBOX, 'readwrite', (store) => {
      const index = store.index(INDEX_OUTBOX_USER_CHAT_CREATED);
      const range = IDBKeyRange.bound([uid, 0, ''], [uid, Number.MAX_SAFE_INTEGER, '\uffff']);
      const req = index.openCursor(range);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        store.delete(cursor.primaryKey);
        cursor.continue();
      };
      return true;
    });
    const clearPages = await withObjectStore(STORE_PAGES, 'readwrite', (store) => {
      const range = IDBKeyRange.bound([uid, 0, '', 0], [uid, Number.MAX_SAFE_INTEGER, '\uffff', Number.MAX_SAFE_INTEGER]);
      const req = store.openCursor(range);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        store.delete(cursor.primaryKey);
        cursor.continue();
      };
      return true;
    });
    const clearMediaPages = await withObjectStore(STORE_MEDIA_PAGES, 'readwrite', (store) => {
      const range = IDBKeyRange.bound([uid, 0, '', 0], [uid, Number.MAX_SAFE_INTEGER, '\uffff', Number.MAX_SAFE_INTEGER]);
      const req = store.openCursor(range);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        store.delete(cursor.primaryKey);
        cursor.continue();
      };
      return true;
    });
    const clearChatMeta = await withObjectStore(STORE_CHAT_META, 'readwrite', (store) => {
      const range = IDBKeyRange.bound([uid, 0], [uid, Number.MAX_SAFE_INTEGER]);
      const req = store.openCursor(range);
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor) return;
        store.delete(cursor.primaryKey);
        cursor.continue();
      };
      return true;
    });
    return !!(clearMessages || clearOutbox || clearPages || clearMediaPages || clearChatMeta);
  }

  function isCacheableAsset(url) {
    let parsed;
    try { parsed = new URL(url, location.origin); } catch { return null; }
    if (parsed.origin !== location.origin) return null;
    const path = parsed.pathname.toLowerCase();
    const isUploadImage = path.startsWith('/uploads/avatars/')
      || path.startsWith('/uploads/backgrounds/')
      || /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(path);
    return isUploadImage ? parsed.href : null;
  }

  async function cacheAssets(urls = []) {
    if (!('caches' in window)) return;
    try {
      const cache = await caches.open(ASSET_CACHE);
      const dedup = [...new Set((urls || []).map(isCacheableAsset).filter(Boolean))].slice(0, MAX_PREFETCH_ASSETS);
      for (const url of dedup) {
        try {
          if (await cache.match(url)) continue;
          const response = await fetch(url, { credentials: 'same-origin', cache: 'no-cache' });
          const type = response.headers.get('content-type') || '';
          if (response.ok && type.startsWith('image/')) await cache.put(url, response.clone());
        } catch (e) {}
      }
    } catch (e) {}
  }

  async function clearAssetCache() {
    if (!('caches' in window)) return;
    try {
      await caches.delete(ASSET_CACHE);
      await Promise.all(OLD_ASSET_CACHES.map((name) => caches.delete(name)));
    } catch (e) {}
  }

  // Sync read state for the current user's own cached messages in a chat.
  // Own messages with id <= lastReadId become read, later own messages become unread.
  async function syncOwnMessageReadState(chatId, lastReadId) {
    const cid = normalizeId(chatId);
    const lid = Number.isFinite(Number(lastReadId)) ? Math.max(0, Math.floor(Number(lastReadId))) : 0;
    if (!currentUserId || !cid) return 0;
    const database = await openDB().catch(() => null);
    if (!database) return 0;
    try {
      return await new Promise((resolve) => {
        let updated = 0;
        let settled = false;
        function finish(value) {
          if (settled) return;
          settled = true;
          resolve(value);
        }
        const tx = database.transaction(STORE_MESSAGES, 'readwrite');
        const store = tx.objectStore(STORE_MESSAGES);
        const index = store.index(INDEX_USER_CHAT_ID);
        const range = rangeForChat(cid);
        const req = index.openCursor(range, 'next');
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) return;
          const row = cursor.value || {};
          const msgAuthor = Number(row.user_id || row.userId || 0);
          const mid = Number(row.id || 0);
          if (msgAuthor === currentUserId && mid) {
            const nextReadValue = mid <= lid ? 1 : 0;
            const prevReadValue = Number(row.is_read) ? 1 : 0;
            if (prevReadValue !== nextReadValue) {
              row.is_read = nextReadValue;
              try { cursor.update(row); updated += 1; } catch (e) {}
            }
          }
          cursor.continue();
        };
        req.onerror = () => finish(0);
        tx.oncomplete = () => finish(updated);
        tx.onerror = () => finish(0);
        tx.onabort = () => finish(0);
      });
    } catch (e) {
      return 0;
    }
  }

  async function updateMessagesByUser(user) {
    const targetId = normalizeId(user?.id || user?.user_id);
    if (!currentUserId || !targetId) return 0;
    const database = await openDB().catch(() => null);
    if (!database) return 0;
    try {
      return await new Promise((resolve) => {
        let updated = 0;
        let settled = false;
        function finish(value) {
          if (settled) return;
          settled = true;
          resolve(value);
        }
        const tx = database.transaction(STORE_MESSAGES, 'readwrite');
        const store = tx.objectStore(STORE_MESSAGES);
        const index = store.index(INDEX_USER_CHAT_ID);
        const range = IDBKeyRange.bound(
          [currentUserId, 0, 0],
          [currentUserId, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]
        );
        const req = index.openCursor(range, 'next');
        req.onsuccess = () => {
          const cursor = req.result;
          if (!cursor) return;
          const row = cursor.value || {};
          if (normalizeId(row.user_id || row.userId) === targetId) {
            let changed = false;
            if (typeof user.display_name === 'string' && row.display_name !== user.display_name) {
              row.display_name = user.display_name;
              changed = true;
            }
            if (typeof user.avatar_color === 'string' && row.avatar_color !== user.avatar_color) {
              row.avatar_color = user.avatar_color;
              changed = true;
            }
            if ((user.avatar_url || null) !== (row.avatar_url || null)) {
              row.avatar_url = user.avatar_url || null;
              changed = true;
            }
            if (typeof user.username === 'string' && row.username !== user.username) {
              row.username = user.username;
              changed = true;
            }
            if (changed) {
              try { cursor.update(row); updated += 1; } catch (e) {}
            }
          }
          cursor.continue();
        };
        req.onerror = () => finish(0);
        tx.oncomplete = () => finish(updated);
        tx.onerror = () => finish(0);
        tx.onabort = () => finish(0);
      });
    } catch (e) {
      return 0;
    }
  }

  window.messageCache = {
    init,
    readLatest,
    readAround,
    readChatMeta,
    writeChatMeta,
    getCachedRange,
    writeWindow,
    writePage,
    readPage,
    writeMediaPage,
    readMediaPage,
    upsertMessage,
    patchMessage,
    deleteMessage,
    upsertOutboxItem,
    getOutboxItem,
    readOutbox,
    deleteOutboxItem,
    clearUserCache,
    syncOwnMessageReadState,
    updateMessagesByUser,
  };
  window.cacheAssets = cacheAssets;
  window.clearAssetCache = clearAssetCache;
})();
