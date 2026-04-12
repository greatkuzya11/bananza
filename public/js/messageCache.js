// User-scoped IndexedDB message cache and safe image asset cache helpers.
(function () {
  const DB_NAME = 'bananza-cache-v2';
  const DB_VERSION = 1;
  const STORE_MESSAGES = 'messages';
  const INDEX_USER_CHAT_ID = 'by_user_chat_id';
  const ASSET_CACHE = 'bananza-assets-v2';
  const OLD_ASSET_CACHES = ['bananza-assets-v1'];
  const OLD_DB_NAMES = ['bananza-cache-v1'];
  const DEFAULT_MESSAGE_LIMIT = 200;
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
    return Math.min(500, Math.max(1, Number.isFinite(n) ? n : fallback));
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

  async function withStore(mode, fn) {
    const database = await openDB();
    if (!database || !currentUserId) return null;
    return new Promise((resolve) => {
      try {
        const tx = database.transaction(STORE_MESSAGES, mode);
        const store = tx.objectStore(STORE_MESSAGES);
        const result = fn(store, tx);
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => resolve(null);
        tx.onabort = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    });
  }

  function normalizeMessage(chatId, msg) {
    const id = normalizeId(msg?.id);
    const cid = normalizeId(chatId || msg?.chat_id || msg?.chatId);
    if (!id || !cid || !currentUserId) return null;
    return { ...msg, userId: currentUserId, chatId: cid };
  }

  function rangeForChat(chatId, minId = 0, maxId = Number.MAX_SAFE_INTEGER) {
    return IDBKeyRange.bound([currentUserId, normalizeId(chatId), minId], [currentUserId, normalizeId(chatId), maxId]);
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

  async function writeWindow(chatId, messages = [], { limit = DEFAULT_MESSAGE_LIMIT } = {}) {
    const cid = normalizeId(chatId);
    if (!Array.isArray(messages) || !cid || !currentUserId) return false;
    const ok = await withStore('readwrite', (store) => {
      for (const msg of messages) {
        const row = normalizeMessage(cid, msg);
        if (row) store.put(row);
      }
      return true;
    });
    if (ok) await trimChat(cid, limit);
    return !!ok;
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
    return !!ok;
  }

  async function deleteMessage(chatId, id) {
    const cid = normalizeId(chatId);
    const mid = normalizeId(id);
    if (!cid || !mid || !currentUserId) return false;
    return !!(await withStore('readwrite', (store) => {
      store.delete([currentUserId, cid, mid]);
      return true;
    }));
  }

  async function clearUserCache() {
    if (!currentUserId) return false;
    const uid = currentUserId;
    const ok = await withStore('readwrite', (store) => {
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
    return !!ok;
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

  window.messageCache = {
    init,
    readLatest,
    readAround,
    writeWindow,
    upsertMessage,
    deleteMessage,
    clearUserCache,
  };
  window.cacheAssets = cacheAssets;
  window.clearAssetCache = clearAssetCache;
})();
