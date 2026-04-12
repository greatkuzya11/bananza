// Lightweight IndexedDB wrapper and asset cache helpers for BananZa
(function () {
  const DB_NAME = 'bananza-cache-v1';
  const DB_VERSION = 1;
  const STORE_MESSAGES = 'messages';
  const ASSET_CACHE = 'bananza-assets-v1';

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (ev) => {
        const db = ev.target.result;
        if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
          const os = db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' });
          os.createIndex('by_chat_created', ['chatId', 'created_at']);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function readMessages(chatId, { limit = 200 } = {}) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_MESSAGES, 'readonly');
        const store = tx.objectStore(STORE_MESSAGES);
        const index = store.index('by_chat_created');
        const range = IDBKeyRange.bound([chatId, '\u0000'], [chatId, '\uffff']);
        const req = index.openCursor(range, 'prev');
        const out = [];
        req.onsuccess = function () {
          const cur = this.result;
          if (!cur || out.length >= limit) {
            resolve(out.reverse());
            return;
          }
          out.push(cur.value);
          cur.continue();
        };
        req.onerror = () => reject(req.error);
      } catch (e) { reject(e); }
    });
  }

  async function writeMessages(chatId, msgs = [], { limit = 200 } = {}) {
    if (!Array.isArray(msgs)) return;
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MESSAGES, 'readwrite');
      const store = tx.objectStore(STORE_MESSAGES);
      try {
        for (const m of msgs) {
          if (!m || !m.id) continue;
          const row = Object.assign({}, m, { chatId: Number(m.chat_id || m.chatId || 0) });
          store.put(row);
        }
      } catch (e) { /* ignore individual failures */ }
      tx.oncomplete = () => {
        // Optional trimming: remove older than limit
        try {
          const t2 = db.transaction(STORE_MESSAGES, 'readwrite');
          const s2 = t2.objectStore(STORE_MESSAGES);
          const idx = s2.index('by_chat_created');
          const range = IDBKeyRange.bound([chatId, '\u0000'], [chatId, '\uffff']);
          const req = idx.openCursor(range, 'prev');
          const toKeep = [];
          req.onsuccess = function () {
            const c = this.result;
            if (!c) return;
            toKeep.push(c.primaryKey);
            if (toKeep.length > limit) {
              // continue collecting to trigger deletions later
            }
            c.continue();
          };
          t2.oncomplete = () => resolve(true);
          t2.onerror = () => resolve(true);
        } catch (e) { resolve(true); }
      };
      tx.onerror = () => resolve(false);
    });
  }

  async function upsertMessage(msg) {
    if (!msg || !msg.id) return;
    const db = await openDB();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_MESSAGES, 'readwrite');
        const store = tx.objectStore(STORE_MESSAGES);
        const row = Object.assign({}, msg, { chatId: Number(msg.chat_id || msg.chatId || 0) });
        store.put(row);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) { resolve(false); }
    });
  }

  async function deleteMessage(id) {
    if (!id) return;
    const db = await openDB();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_MESSAGES, 'readwrite');
        tx.objectStore(STORE_MESSAGES).delete(id);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) { resolve(false); }
    });
  }

  async function clearUserCache() {
    return new Promise((resolve) => {
      try {
        const delReq = indexedDB.deleteDatabase(DB_NAME);
        delReq.onsuccess = () => resolve(true);
        delReq.onerror = () => resolve(false);
        delReq.onblocked = () => resolve(false);
      } catch (e) { resolve(false); }
    });
  }

  // Asset cache helpers (Cache API)
  async function cacheAssets(urls = []) {
    if (!('caches' in window)) return;
    try {
      const cache = await caches.open(ASSET_CACHE);
      const dedup = [...new Set((urls || []).filter(Boolean).map(u => {
        try { return new URL(u, location.origin).href; } catch { return null; }
      }).filter(Boolean))];
      for (const url of dedup) {
        try {
          const matched = await cache.match(url);
          if (matched) continue;
          const resp = await fetch(url, { credentials: 'same-origin', cache: 'no-cache' });
          if (resp && resp.ok) await cache.put(url, resp.clone());
        } catch (e) { /* ignore individual failures */ }
      }
    } catch (e) { /* ignore */ }
  }

  async function clearAssetCache() {
    if (!('caches' in window)) return;
    try { await caches.delete(ASSET_CACHE); } catch (e) {}
  }

  // Expose globally
  window.messageCache = {
    readMessages,
    writeMessages,
    upsertMessage,
    deleteMessage,
    clearUserCache,
  };
  window.cacheAssets = cacheAssets;
  window.clearAssetCache = clearAssetCache;
})();
