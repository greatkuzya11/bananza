self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key === 'bananza-assets-v1')
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('push', (event) => {
  event.waitUntil(handlePush(event));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  event.waitUntil(openNotificationTarget(data));
});

async function handlePush(event) {
  const payload = readPushPayload(event);
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  windows.forEach(client => client.postMessage({ type: 'push_received', payload }));

  const hasFocusedClient = windows.some(client => client.focused);
  if (hasFocusedClient && !payload.forceShow) return;

  const title = payload.title || 'BananZa';
  const options = {
    body: payload.body || '',
    tag: payload.tag || `bananza:${Date.now()}`,
    silent: !!payload.silent,
    data: {
      url: payload.url || (payload.chatId ? `/?chatId=${payload.chatId}` : '/'),
      chatId: payload.chatId || null,
      messageId: payload.messageId || null,
      type: payload.type || 'notification',
    },
  };
  await self.registration.showNotification(title, options);
}

function readPushPayload(event) {
  if (!event.data) return {};
  try {
    return event.data.json() || {};
  } catch {
    return { title: 'BananZa', body: event.data.text() };
  }
}

async function openNotificationTarget(data) {
  const targetUrl = new URL(data.url || '/', self.location.origin);
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of windows) {
    const clientUrl = new URL(client.url);
    if (clientUrl.origin === targetUrl.origin) {
      await client.focus();
      client.postMessage({ type: 'open_chat', chatId: data.chatId || targetUrl.searchParams.get('chatId') });
      return;
    }
  }
  await self.clients.openWindow(targetUrl.href);
}

const ASSET_CACHE = 'bananza-assets-v2';

function isCacheableImageRequest(request, url) {
  if (request.method !== 'GET') return false;
  if (request.headers.has('range')) return false;
  if (url.origin !== self.location.origin) return false;
  const path = url.pathname.toLowerCase();
  return path.startsWith('/uploads/avatars/')
    || path.startsWith('/uploads/backgrounds/')
    || /^\/uploads\/[^/]+\/poster$/i.test(path)
    || /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(path);
}

// Cache-first only for safe image assets. Audio/video/documents keep native network behavior.
self.addEventListener('fetch', (event) => {
  try {
    const reqUrl = new URL(event.request.url);
    if (isCacheableImageRequest(event.request, reqUrl)) {
      event.respondWith(
        caches.open(ASSET_CACHE).then(cache =>
          cache.match(event.request).then(async (cached) => {
            if (cached) return cached;
            const response = await fetch(event.request);
            const type = response.headers.get('content-type') || '';
            try { if (response.ok && type.startsWith('image/')) cache.put(event.request, response.clone()); } catch (e) {}
            return response;
          })
        )
      );
    }
  } catch (e) {}
});
