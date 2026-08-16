const fs = require('fs');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const { createTelegramClient, TelegramApiError } = require('./client');
const { extractTelegramAudio, safeAudioExtension, splitUnicodeText } = require('./helpers');
const { telegramText } = require('./messages');
const {
  DEFAULT_SETTINGS,
  readSettings,
  writeSettings,
  buildDraftSettings,
  getBotToken,
  clearBotToken,
  sanitizeSettings,
  buildProviderSettings,
  providerReadiness,
} = require('./settings');
const {
  VOICE_SETTINGS_OPTIONS,
  getVoiceSettings,
  getOpenAIKey,
  getGrokKey,
  getProviderModel,
} = require('../voice/settings');
const { transcribeAudio, testProviderModel } = require('../voice/providers');
const { isFfmpegAvailable } = require('../voice/ffmpeg');
const { TEST_AUDIO_PATH } = require('../voice');

const ACTIVE_STATUSES = "('queued','processing','delivering')";
const MAX_GLOBAL_ACTIVE = 20;
const MAX_USER_ACTIVE = 3;

function positiveInteger(value) {
  const parsed = Number(value || 0);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

function safeErrorMessage(error, fallback = 'Telegram transcription failed') {
  const message = String(error?.message || fallback)
    .replace(/https:\/\/api\.telegram\.org\/(?:file\/)?bot[^\s/]+/gi, 'Telegram API')
    .slice(0, 1000);
  return message || fallback;
}

function delay(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
      return;
    }
    const timer = setTimeout(resolve, Math.max(0, ms));
    timer.unref?.();
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
    }, { once: true });
  });
}

function createTelegramTranscriptionFeature({
  app,
  db,
  auth,
  adminOnly,
  secret,
  server,
  getAiBotFeature,
  fetchImpl = global.fetch,
} = {}) {
  const runtime = {
    state: 'stopped',
    running: false,
    webhook_conflict: false,
    last_error: '',
    last_poll_at: '',
    last_update_at: '',
    retry_in_ms: 0,
  };
  let pollController = null;
  let pollGeneration = 0;
  let workerRunning = false;
  let stopped = false;

  const stateStmt = db.prepare('SELECT * FROM telegram_transcription_state WHERE id=1');
  const updateCursorStmt = db.prepare(`
    UPDATE telegram_transcription_state
    SET next_update_id=MAX(next_update_id, ?), last_update_at=datetime('now'), updated_at=datetime('now')
    WHERE id=1
  `);
  const updatePollStateStmt = db.prepare(`
    UPDATE telegram_transcription_state
    SET last_poll_at=datetime('now'), last_error=?, updated_at=datetime('now')
    WHERE id=1
  `);
  const resetCursorStmt = db.prepare(`
    UPDATE telegram_transcription_state
    SET next_update_id=0, last_error=NULL, updated_at=datetime('now')
    WHERE id=1
  `);
  const activeCountStmt = db.prepare(`SELECT COUNT(*) AS count FROM telegram_transcription_jobs WHERE status IN ${ACTIVE_STATUSES}`);
  const userActiveCountStmt = db.prepare(`
    SELECT COUNT(*) AS count FROM telegram_transcription_jobs
    WHERE telegram_user_id=? AND status IN ${ACTIVE_STATUSES}
  `);
  const nextJobStmt = db.prepare(`
    SELECT * FROM telegram_transcription_jobs
    WHERE status='queued'
    ORDER BY id ASC
    LIMIT 1
  `);
  const insertJobStmt = db.prepare(`
    INSERT OR IGNORE INTO telegram_transcription_jobs(
      update_id, telegram_chat_id, telegram_user_id, telegram_message_id, language_code,
      file_id, file_unique_id, file_name, mime_type, file_size, duration_seconds,
      profile_json, status, transcription_provider, transcription_model
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?, 'queued', ?, ?)
  `);
  const acceptJobTx = db.transaction((updateId, message, media, profile, provider, model) => {
    const result = insertJobStmt.run(
      updateId,
      String(message.chat.id),
      String(message.from.id),
      message.message_id,
      message.from.language_code || '',
      media.file_id,
      media.file_unique_id || '',
      media.file_name || '',
      media.mime_type || '',
      media.file_size,
      media.duration_seconds || 0,
      JSON.stringify(profile),
      provider,
      model
    );
    updateCursorStmt.run(updateId + 1);
    return result.changes > 0;
  });

  db.prepare(`
    UPDATE telegram_transcription_jobs
    SET status='queued', updated_at=datetime('now')
    WHERE status IN ('processing','delivering')
  `).run();
  db.prepare(`
    DELETE FROM telegram_transcription_jobs
    WHERE status IN ('completed','error') AND datetime(updated_at) < datetime('now','-30 days')
  `).run();

  function currentToken() {
    return getBotToken(db, secret);
  }

  function createClient(token = currentToken()) {
    return createTelegramClient(token, { fetchImpl });
  }

  function listContextBots() {
    try {
      return getAiBotFeature?.()?.listVoiceContextConvertBots?.() || [];
    } catch {
      return [];
    }
  }

  function selectableContextBot(botId) {
    const id = positiveInteger(botId);
    return listContextBots().find((bot) => (
      positiveInteger(bot?.id) === id && bot.enabled !== false && bot.provider_enabled !== false
    )) || null;
  }

  function readiness(settings = readSettings(db)) {
    return providerReadiness(settings, getVoiceSettings(db), {
      hasOpenAIKey: Boolean(getOpenAIKey(db, secret)),
      hasGrokKey: Boolean(getGrokKey(db, secret)),
      hasFfmpeg: isFfmpegAvailable(),
    });
  }

  function validateConfiguration(settings) {
    const availability = readiness(settings);
    if (!availability[settings.active_provider]) {
      const error = new Error(`Provider ${settings.active_provider} is not configured in voice settings`);
      error.status = 400;
      throw error;
    }
    if (!availability.fallback_openai) {
      const error = new Error('OpenAI fallback requires an API key in voice settings');
      error.status = 400;
      throw error;
    }
    if (settings.context_bot_enabled && !selectableContextBot(settings.context_bot_id)) {
      const error = new Error('Select an enabled context convert bot');
      error.status = 400;
      throw error;
    }
  }

  function jobProfile(settings) {
    return {
      active_provider: settings.active_provider,
      fallback_to_openai: settings.fallback_to_openai,
      context_bot_enabled: settings.context_bot_enabled,
      context_bot_id: settings.context_bot_id,
      transcription_timeout_ms: settings.transcription_timeout_ms,
      max_file_size_bytes: settings.max_file_size_bytes,
      vosk_model: settings.vosk_model,
      vosk_model_path: settings.vosk_model_path,
      whisper_model: settings.whisper_model,
      whisper_language: settings.whisper_language,
      openai_model: settings.openai_model,
      openai_language: settings.openai_language,
      grok_language: settings.grok_language,
    };
  }

  function queueStats() {
    const total = Number(activeCountStmt.get()?.count || 0);
    const byStatus = Object.fromEntries(db.prepare(`
      SELECT status, COUNT(*) AS count
      FROM telegram_transcription_jobs
      WHERE status IN ${ACTIVE_STATUSES}
      GROUP BY status
    `).all().map((row) => [row.status, Number(row.count || 0)]));
    return { total, queued: byStatus.queued || 0, processing: byStatus.processing || 0, delivering: byStatus.delivering || 0 };
  }

  function serializedState() {
    const stored = stateStmt.get() || {};
    return {
      ...runtime,
      last_poll_at: runtime.last_poll_at || stored.last_poll_at || '',
      last_update_at: runtime.last_update_at || stored.last_update_at || '',
      last_error: runtime.last_error || stored.last_error || '',
      next_update_id: Number(stored.next_update_id || 0),
      queue: queueStats(),
    };
  }

  function adminPayload(settings = readSettings(db)) {
    return {
      settings: sanitizeSettings(settings),
      options: VOICE_SETTINGS_OPTIONS,
      contextConvertBots: listContextBots(),
      providerReadiness: readiness(settings),
      runtime: serializedState(),
    };
  }

  function rememberPoll(error = '') {
    const now = new Date().toISOString();
    runtime.last_poll_at = now;
    runtime.last_error = String(error || '');
    updatePollStateStmt.run(runtime.last_error || null);
  }

  async function sendReply(client, message, text) {
    try {
      return await retryTelegram(() => client.sendMessage(String(message.chat.id), text, message.message_id));
    } catch (error) {
      if (error instanceof TelegramApiError && error.errorCode === 400) {
        return retryTelegram(() => client.sendMessage(String(message.chat.id), text, null));
      }
      throw error;
    }
  }

  async function retryTelegram(operation, attempts = 3) {
    let lastError = null;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const retryAfter = Number(error?.parameters?.retry_after || 0);
        const transient = retryAfter > 0
          || Number(error?.status || 0) >= 500
          || (!error?.status && error instanceof TelegramApiError);
        if (!transient || attempt === attempts - 1) throw error;
        await delay(retryAfter > 0 ? retryAfter * 1000 : 500 * (2 ** attempt));
      }
    }
    throw lastError;
  }

  function recordCursor(updateId) {
    updateCursorStmt.run(Number(updateId || 0) + 1);
    runtime.last_update_at = new Date().toISOString();
  }

  async function handleUpdate(update, client) {
    const updateId = Number(update?.update_id || 0);
    const message = update?.message;
    if (!updateId) return;
    if (!message?.chat || !message?.from || !message?.message_id) {
      recordCursor(updateId);
      return;
    }

    const language = message.from.language_code || '';
    const userId = String(message.from.id || '');
    const text = String(message.text || '').trim();
    const isCommand = /^\/(?:start|help)(?:@\w+)?(?:\s|$)/i.test(text);

    if (message.chat.type !== 'private') {
      recordCursor(updateId);
      if (isCommand || extractTelegramAudio(message)) {
        await sendReply(client, message, telegramText(language, 'privateOnly')).catch(() => {});
      }
      return;
    }

    if (isCommand) {
      recordCursor(updateId);
      const key = /^\/start/i.test(text) ? 'start' : 'help';
      await sendReply(client, message, telegramText(language, key, userId));
      return;
    }

    const settings = readSettings(db);
    const media = extractTelegramAudio(message);
    if (!settings.allowed_user_ids.includes(userId)) {
      recordCursor(updateId);
      if (media || text) await sendReply(client, message, telegramText(language, 'denied', userId));
      return;
    }
    if (!media) {
      recordCursor(updateId);
      await sendReply(client, message, telegramText(language, 'unsupported'));
      return;
    }
    if (media.file_size && media.file_size > settings.max_file_size_bytes) {
      recordCursor(updateId);
      await sendReply(client, message, telegramText(language, 'tooLarge'));
      return;
    }
    if (Number(activeCountStmt.get()?.count || 0) >= MAX_GLOBAL_ACTIVE
      || Number(userActiveCountStmt.get(userId)?.count || 0) >= MAX_USER_ACTIVE) {
      recordCursor(updateId);
      await sendReply(client, message, telegramText(language, 'busy'));
      return;
    }

    const profile = jobProfile(settings);
    const providerSettings = buildProviderSettings(profile, getVoiceSettings(db));
    const inserted = acceptJobTx(
      updateId,
      message,
      media,
      profile,
      providerSettings.active_provider,
      getProviderModel(providerSettings)
    );
    runtime.last_update_at = new Date().toISOString();
    if (inserted) pumpWorker();
  }

  async function applyContextBot(rawText, profile) {
    if (!profile.context_bot_enabled || !profile.context_bot_id) return { text: rawText, warning: false };
    const chunks = splitUnicodeText(rawText, 4500);
    const transformed = [];
    try {
      const feature = getAiBotFeature?.();
      if (!feature?.transformTextWithContextBot) throw new Error('Context bot runtime is unavailable');
      for (const chunk of chunks) {
        const result = await feature.transformTextWithContextBot({
          botId: profile.context_bot_id,
          text: chunk,
        });
        const value = String(result?.text || '').trim();
        if (!value) throw new Error('Context bot returned empty text');
        transformed.push(value);
      }
      return { text: transformed.join('\n\n'), warning: false };
    } catch (error) {
      console.warn('[telegram-transcription] context transform failed:', safeErrorMessage(error));
      return { text: rawText, warning: true };
    }
  }

  async function updateStatusMessage(client, job, text) {
    if (job.status_message_id) {
      try {
        await retryTelegram(() => client.editMessageText(job.telegram_chat_id, job.status_message_id, text));
        return Number(job.status_message_id);
      } catch {}
    }
    const sent = await retryTelegram(() => client.sendMessage(job.telegram_chat_id, text, job.telegram_message_id));
    const messageId = Number(sent?.message_id || 0) || null;
    if (messageId) {
      db.prepare(`
        UPDATE telegram_transcription_jobs
        SET status_message_id=?, updated_at=datetime('now')
        WHERE id=?
      `).run(messageId, job.id);
      job.status_message_id = messageId;
    }
    return messageId;
  }

  async function deliverTranscript(client, job, finalText, contextWarning = false) {
    const parts = splitUnicodeText(finalText, 4000);
    if (!parts.length) throw new Error('Transcription returned empty text');
    await updateStatusMessage(client, job, parts[0]);
    for (let index = 1; index < parts.length; index += 1) {
      await retryTelegram(() => client.sendMessage(job.telegram_chat_id, parts[index], job.telegram_message_id));
    }
    if (contextWarning) {
      await retryTelegram(() => client.sendMessage(
        job.telegram_chat_id,
        telegramText(job.language_code, 'contextWarning'),
        job.telegram_message_id
      ));
    }
    db.prepare(`
      UPDATE telegram_transcription_jobs
      SET status='completed', transcript_text=NULL, error=NULL,
        completed_at=datetime('now'), updated_at=datetime('now')
      WHERE id=?
    `).run(job.id);
  }

  async function processJob(job) {
    const token = currentToken();
    if (!token) throw new Error('Telegram bot token is not configured');
    const client = createClient(token);
    const profile = { ...DEFAULT_SETTINGS, ...JSON.parse(job.profile_json || '{}') };
    const language = job.language_code || '';
    await updateStatusMessage(client, job, telegramText(language, 'accepted'));

    if (String(job.transcript_text || '').trim()) {
      await deliverTranscript(client, job, String(job.transcript_text).trim());
      return;
    }

    const file = await retryTelegram(() => client.getFile(job.file_id));
    const remoteSize = Number(file?.file_size || job.file_size || 0);
    if (remoteSize && remoteSize > profile.max_file_size_bytes) {
      const error = new Error('Telegram file exceeds the configured limit');
      error.userMessageKey = 'tooLarge';
      throw error;
    }
    if (!file?.file_path) throw new Error('Telegram did not return a file path');

    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'bananza-telegram-stt-'));
    const extension = safeAudioExtension(
      job.file_name,
      job.mime_type,
      safeAudioExtension(file.file_path, '', '.ogg')
    );
    const filePath = path.join(tempDir, `${uuidv4()}${extension.toLowerCase()}`);
    try {
      await retryTelegram(() => client.downloadFile(file.file_path, filePath, profile.max_file_size_bytes));
      const providerSettings = buildProviderSettings(profile, getVoiceSettings(db));
      const result = await transcribeAudio({
        filePath,
        settings: providerSettings,
        apiKey: getOpenAIKey(db, secret),
        grokApiKey: getGrokKey(db, secret),
      });
      const converted = await applyContextBot(String(result.text || '').trim(), profile);
      const finalText = String(converted.text || '').trim();
      if (!finalText) throw new Error('Transcription returned empty text');

      db.prepare(`
        UPDATE telegram_transcription_jobs
        SET status='delivering', transcript_text=?, transcription_provider=?, transcription_model=?,
          error=NULL, updated_at=datetime('now')
        WHERE id=?
      `).run(finalText, result.provider || profile.active_provider, result.model || '', job.id);

      await deliverTranscript(client, job, finalText, converted.warning);
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  async function failJob(job, error) {
    const message = safeErrorMessage(error);
    db.prepare(`
      UPDATE telegram_transcription_jobs
      SET status='error', transcript_text=NULL, error=?, completed_at=datetime('now'), updated_at=datetime('now')
      WHERE id=?
    `).run(message, job.id);
    try {
      const client = createClient();
      await updateStatusMessage(client, job, telegramText(job.language_code, error?.userMessageKey || 'failed'));
    } catch {}
    console.warn('[telegram-transcription] job failed:', message);
  }

  function pumpWorker() {
    if (workerRunning || stopped) return;
    workerRunning = true;
    Promise.resolve().then(async () => {
      while (!stopped) {
        const job = nextJobStmt.get();
        if (!job) break;
        const claimed = db.prepare(`
          UPDATE telegram_transcription_jobs
          SET status='processing', error=NULL, updated_at=datetime('now')
          WHERE id=? AND status='queued'
        `).run(job.id);
        if (!claimed.changes) continue;
        job.status = 'processing';
        try {
          await processJob(job);
        } catch (error) {
          await failJob(job, error);
        }
      }
    }).finally(() => {
      workerRunning = false;
      if (!stopped && nextJobStmt.get()) pumpWorker();
    });
  }

  async function runPollLoop(generation, controller) {
    let retryMs = 1000;
    while (!stopped && generation === pollGeneration && !controller.signal.aborted) {
      const settings = readSettings(db);
      const token = currentToken();
      if (!settings.enabled || !token) break;
      const client = createClient(token);
      try {
        const offset = Number(stateStmt.get()?.next_update_id || 0);
        const updates = await client.getUpdates({ offset, timeout: 25, signal: controller.signal });
        rememberPoll('');
        runtime.state = 'polling';
        runtime.retry_in_ms = 0;
        retryMs = 1000;
        for (const update of Array.isArray(updates) ? updates : []) {
          await handleUpdate(update, client);
        }
      } catch (error) {
        if (error?.name === 'AbortError' || controller.signal.aborted) break;
        const code = Number(error?.errorCode || error?.status || 0);
        const message = safeErrorMessage(error, 'Telegram polling failed');
        rememberPoll(message);
        if (code === 401) {
          runtime.state = 'auth_error';
          break;
        }
        if (code === 409) {
          runtime.state = 'conflict';
          runtime.webhook_conflict = true;
          break;
        }
        const retryAfter = Number(error?.parameters?.retry_after || 0);
        const waitMs = retryAfter > 0 ? retryAfter * 1000 : retryMs;
        runtime.state = 'backoff';
        runtime.retry_in_ms = waitMs;
        try {
          await delay(waitMs, controller.signal);
        } catch {
          break;
        }
        retryMs = Math.min(30000, Math.max(1000, retryMs * 2));
      }
    }
    if (generation === pollGeneration) {
      runtime.running = false;
      if (runtime.state === 'polling' || runtime.state === 'starting') runtime.state = 'stopped';
    }
  }

  async function startPolling() {
    const settings = readSettings(db);
    const token = currentToken();
    pumpWorker();
    if (stopped || runtime.running || !settings.enabled || !token) return;
    runtime.state = 'starting';
    runtime.webhook_conflict = false;
    runtime.last_error = '';
    try {
      const webhook = await createClient(token).getWebhookInfo();
      if (String(webhook?.url || '').trim()) {
        runtime.state = 'conflict';
        runtime.webhook_conflict = true;
        runtime.last_error = 'Telegram bot has an active webhook';
        rememberPoll(runtime.last_error);
        return;
      }
    } catch (error) {
      const code = Number(error?.errorCode || error?.status || 0);
      runtime.last_error = safeErrorMessage(error);
      rememberPoll(runtime.last_error);
      if (code === 401) {
        runtime.state = 'auth_error';
        return;
      }
    }
    pollController = new AbortController();
    const generation = ++pollGeneration;
    runtime.running = true;
    runtime.state = 'polling';
    runPollLoop(generation, pollController).catch((error) => {
      runtime.running = false;
      runtime.state = 'error';
      runtime.last_error = safeErrorMessage(error);
    });
  }

  function stopPolling() {
    pollGeneration += 1;
    pollController?.abort();
    pollController = null;
    runtime.running = false;
    runtime.retry_in_ms = 0;
    if (!['auth_error', 'conflict', 'error'].includes(runtime.state)) runtime.state = 'stopped';
  }

  async function resyncRuntime() {
    stopPolling();
    runtime.webhook_conflict = false;
    runtime.last_error = '';
    await startPolling();
  }

  app.get('/api/admin/telegram-transcription', auth, adminOnly, (_req, res) => {
    res.json(adminPayload());
  });

  app.put('/api/admin/telegram-transcription', auth, adminOnly, async (req, res) => {
    const incoming = req.body || {};
    const current = readSettings(db);
    const oldToken = currentToken();
    const submittedToken = String(incoming.bot_token || '').trim();
    if (submittedToken && oldToken && submittedToken !== oldToken && activeCountStmt.get().count > 0) {
      return res.status(409).json({ error: 'Wait for active Telegram transcription jobs before replacing the token' });
    }
    const draft = buildDraftSettings(db, incoming, secret);
    const effectiveToken = submittedToken || oldToken;
    try {
      validateConfiguration(draft);
      if (draft.enabled && !effectiveToken) {
        const error = new Error('Telegram bot token is required');
        error.status = 400;
        throw error;
      }
      if (submittedToken || draft.enabled) {
        const me = await createClient(effectiveToken).getMe();
        draft.bot_id = String(me?.id || '');
        draft.bot_name = [me?.first_name, me?.last_name].filter(Boolean).join(' ').trim();
        draft.bot_username = String(me?.username || '');
      }
      const tokenChanged = Boolean(submittedToken && submittedToken !== oldToken);
      const saved = writeSettings(db, draft);
      if (tokenChanged) resetCursorStmt.run();
      await resyncRuntime();
      return res.json(adminPayload(saved));
    } catch (error) {
      return res.status(error.status || error.errorCode || 400).json({ error: safeErrorMessage(error, 'Could not save Telegram settings') });
    }
  });

  app.delete('/api/admin/telegram-transcription/token', auth, adminOnly, async (_req, res) => {
    if (Number(activeCountStmt.get()?.count || 0) > 0) {
      return res.status(409).json({ error: 'Wait for active Telegram transcription jobs before deleting the token' });
    }
    stopPolling();
    const saved = clearBotToken(db);
    resetCursorStmt.run();
    return res.json(adminPayload(saved));
  });

  app.post('/api/admin/telegram-transcription/test-bot', auth, adminOnly, async (req, res) => {
    const token = String(req.body?.bot_token || '').trim() || currentToken();
    if (!token) return res.status(400).json({ error: 'Telegram bot token is required' });
    try {
      const client = createClient(token);
      const [bot, webhook] = await Promise.all([client.getMe(), client.getWebhookInfo()]);
      return res.json({
        ok: true,
        bot: {
          id: String(bot?.id || ''),
          name: [bot?.first_name, bot?.last_name].filter(Boolean).join(' ').trim(),
          username: String(bot?.username || ''),
        },
        webhook: {
          active: Boolean(String(webhook?.url || '').trim()),
          pending_update_count: Number(webhook?.pending_update_count || 0),
          last_error_message: String(webhook?.last_error_message || ''),
        },
      });
    } catch (error) {
      return res.status(error.errorCode || 400).json({ error: safeErrorMessage(error, 'Telegram bot test failed') });
    }
  });

  app.post('/api/admin/telegram-transcription/test-model', auth, adminOnly, async (req, res) => {
    const draft = buildDraftSettings(db, req.body || {}, secret);
    try {
      validateConfiguration(draft);
      if (!fs.existsSync(TEST_AUDIO_PATH)) throw new Error('Model test audio is missing');
      const providerSettings = buildProviderSettings(draft, getVoiceSettings(db));
      const startedAt = Date.now();
      const result = await testProviderModel({
        filePath: TEST_AUDIO_PATH,
        settings: providerSettings,
        apiKey: getOpenAIKey(db, secret),
        grokApiKey: getGrokKey(db, secret),
      });
      return res.json({
        ok: true,
        provider: result.provider,
        model: result.model,
        latency_ms: Date.now() - startedAt,
        excerpt: String(result.text || '').slice(0, 240),
      });
    } catch (error) {
      return res.status(error.status || 400).json({ error: safeErrorMessage(error, 'Telegram transcription model test failed') });
    }
  });

  app.post('/api/admin/telegram-transcription/claim', auth, adminOnly, async (_req, res) => {
    const token = currentToken();
    if (!token) return res.status(400).json({ error: 'Telegram bot token is required' });
    try {
      await createClient(token).deleteWebhook(true);
      resetCursorStmt.run();
      await resyncRuntime();
      return res.json(adminPayload());
    } catch (error) {
      return res.status(error.errorCode || 400).json({ error: safeErrorMessage(error, 'Could not remove Telegram webhook') });
    }
  });

  const startup = setImmediate(() => {
    if (!stopped) {
      pumpWorker();
      startPolling().catch(() => {});
    }
  });
  startup.unref?.();

  function stop() {
    stopped = true;
    stopPolling();
  }
  server?.once?.('close', stop);

  return {
    stop,
    start: startPolling,
    getRuntimeState: serializedState,
    handleUpdate,
    pumpWorker,
  };
}

module.exports = {
  createTelegramTranscriptionFeature,
  safeErrorMessage,
  MAX_GLOBAL_ACTIVE,
  MAX_USER_ACTIVE,
};
