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

// Cache-first handler for uploads (avatars, backgrounds, media)
self.addEventListener('fetch', (event) => {
  try {
    const reqUrl = new URL(event.request.url);
    if (reqUrl.origin === self.location.origin && reqUrl.pathname.startsWith('/uploads/')) {
      event.respondWith(
        caches.open('bananza-assets-v1').then(cache =>
          cache.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(resp => {
              try { if (resp && resp.ok) cache.put(event.request, resp.clone()); } catch (e) {}
              return resp;
            }).catch(() => cached || fetch(event.request));
          })
        )
      );
    }
  } catch (e) {}
});
