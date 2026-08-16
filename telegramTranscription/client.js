const fs = require('fs');

class TelegramApiError extends Error {
  constructor(message, { status = 0, errorCode = 0, parameters = null } = {}) {
    super(message || 'Telegram API request failed');
    this.name = 'TelegramApiError';
    this.status = Number(status || 0);
    this.errorCode = Number(errorCode || 0);
    this.parameters = parameters || null;
  }
}

async function parseTelegramResponse(response) {
  const raw = await response.text();
  let data = null;
  try {
    data = JSON.parse(raw || '{}');
  } catch {
    data = null;
  }
  if (!response.ok || !data?.ok) {
    throw new TelegramApiError(
      String(data?.description || `Telegram API request failed (${response.status || 0})`),
      {
        status: response.status,
        errorCode: data?.error_code,
        parameters: data?.parameters,
      }
    );
  }
  return data.result;
}

function createTelegramClient(token, { fetchImpl = global.fetch } = {}) {
  const safeToken = String(token || '').trim();
  if (!safeToken) throw new Error('Telegram bot token is not configured');
  const apiBase = `https://api.telegram.org/bot${safeToken}`;
  const fileBase = `https://api.telegram.org/file/bot${safeToken}`;

  async function request(method, payload = {}, options = {}) {
    let response;
    try {
      response = await fetchImpl(`${apiBase}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {}),
        signal: options.signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      throw new TelegramApiError('Telegram API is unavailable');
    }
    return parseTelegramResponse(response);
  }

  async function downloadFile(filePath, destination, maxBytes, options = {}) {
    let response;
    try {
      response = await fetchImpl(`${fileBase}/${String(filePath || '').replace(/^\/+/, '')}`, {
        signal: options.signal,
      });
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      throw new TelegramApiError('Telegram file download failed');
    }
    if (!response.ok) throw new TelegramApiError(`Telegram file download failed (${response.status})`, { status: response.status });
    const declaredSize = Number(response.headers.get('content-length') || 0);
    if (declaredSize && declaredSize > maxBytes) throw new TelegramApiError('Telegram file exceeds the configured limit');

    const handle = await fs.promises.open(destination, 'wx');
    let written = 0;
    try {
      const reader = response.body?.getReader?.();
      if (!reader) throw new TelegramApiError('Telegram file response is not readable');
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        written += value.byteLength;
        if (written > maxBytes) throw new TelegramApiError('Telegram file exceeds the configured limit');
        await handle.write(Buffer.from(value));
      }
    } catch (error) {
      await handle.close().catch(() => {});
      await fs.promises.rm(destination, { force: true }).catch(() => {});
      throw error;
    }
    await handle.close();
    return written;
  }

  return {
    request,
    getMe: (options) => request('getMe', {}, options),
    getWebhookInfo: (options) => request('getWebhookInfo', {}, options),
    deleteWebhook: (dropPendingUpdates, options) => request('deleteWebhook', {
      drop_pending_updates: Boolean(dropPendingUpdates),
    }, options),
    getUpdates: ({ offset, timeout = 25, signal } = {}) => request('getUpdates', {
      ...(offset ? { offset } : {}),
      timeout,
      limit: 100,
      allowed_updates: ['message'],
    }, { signal }),
    getFile: (fileId, options) => request('getFile', { file_id: fileId }, options),
    sendMessage: (chatId, text, replyToMessageId, options) => request('sendMessage', {
      chat_id: chatId,
      text,
      ...(replyToMessageId ? { reply_parameters: { message_id: replyToMessageId } } : {}),
    }, options),
    editMessageText: (chatId, messageId, text, options) => request('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
    }, options),
    downloadFile,
  };
}

module.exports = { TelegramApiError, createTelegramClient, parseTelegramResponse };
