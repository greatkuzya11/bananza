const fs = require('fs');
const os = require('os');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const { createTelegramClient, TelegramApiError } = require('./client');
const { extractTelegramAudio, safeAudioExtension, splitUnicodeText } = require('./helpers');
const { telegramText } = require('./messages');
const {
  DEFAULT_SETTINGS,
  listBots,
  readBot,
  buildDraftBot,
  createBot,
  updateBot,
  deleteBot,
  getBotToken,
  clearBotToken,
  sanitizeBot,
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
const MAX_BOT_ACTIVE = 20;
const MAX_USER_ACTIVE = 3;
const MAX_TELEGRAM_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_TELEGRAM_DOCUMENT_BYTES = 50 * 1024 * 1024;

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
  const runtimes = new Map();
  const pollControllers = new Map();
  const pollGenerations = new Map();
  const transcriptionWorkers = new Set();
  const imageWorkers = new Set();
  let stopped = false;

  function runtimeFor(botId) {
    const id = positiveInteger(botId);
    if (!runtimes.has(id)) {
      runtimes.set(id, {
        state: 'stopped',
        running: false,
        webhook_conflict: false,
        last_error: '',
        last_poll_at: '',
        last_update_at: '',
        retry_in_ms: 0,
      });
    }
    return runtimes.get(id);
  }

  const stateStmt = db.prepare('SELECT * FROM telegram_bot_state WHERE telegram_bot_id=?');
  const updateCursorStmt = db.prepare(`
    UPDATE telegram_bot_state
    SET next_update_id=MAX(next_update_id, ?), last_update_at=datetime('now'), updated_at=datetime('now')
    WHERE telegram_bot_id=?
  `);
  const updatePollStateStmt = db.prepare(`
    UPDATE telegram_bot_state
    SET last_poll_at=datetime('now'), last_error=?, updated_at=datetime('now')
    WHERE telegram_bot_id=?
  `);
  const resetCursorStmt = db.prepare(`
    UPDATE telegram_bot_state
    SET next_update_id=0, last_error=NULL, updated_at=datetime('now')
    WHERE telegram_bot_id=?
  `);
  const activeCountStmt = db.prepare(`SELECT COUNT(*) AS count FROM telegram_transcription_jobs WHERE telegram_bot_id=? AND status IN ${ACTIVE_STATUSES}`);
  const userActiveCountStmt = db.prepare(`
    SELECT COUNT(*) AS count FROM telegram_transcription_jobs
    WHERE telegram_bot_id=? AND telegram_user_id=? AND status IN ${ACTIVE_STATUSES}
  `);
  const nextJobStmt = db.prepare(`
    SELECT * FROM telegram_transcription_jobs
    WHERE telegram_bot_id=? AND status='queued'
    ORDER BY id ASC
    LIMIT 1
  `);
  const imageActiveCountStmt = db.prepare(`SELECT COUNT(*) AS count FROM telegram_image_generation_jobs WHERE telegram_bot_id=? AND status IN ${ACTIVE_STATUSES}`);
  const imageUserActiveCountStmt = db.prepare(`
    SELECT COUNT(*) AS count FROM telegram_image_generation_jobs
    WHERE telegram_bot_id=? AND telegram_user_id=? AND status IN ${ACTIVE_STATUSES}
  `);
  const nextImageJobStmt = db.prepare(`
    SELECT * FROM telegram_image_generation_jobs
    WHERE telegram_bot_id=? AND status='queued'
    ORDER BY id ASC
    LIMIT 1
  `);
  const insertJobStmt = db.prepare(`
    INSERT OR IGNORE INTO telegram_transcription_jobs(
      telegram_bot_id, update_id, telegram_chat_id, telegram_user_id, telegram_message_id, language_code,
      file_id, file_unique_id, file_name, mime_type, file_size, duration_seconds,
      profile_json, status, transcription_provider, transcription_model
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?, 'queued', ?, ?)
  `);
  const acceptJobTx = db.transaction((botId, updateId, message, media, profile, provider, model) => {
    const result = insertJobStmt.run(
      botId,
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
    updateCursorStmt.run(updateId + 1, botId);
    return result.changes > 0;
  });
  const insertImageJobStmt = db.prepare(`
    INSERT OR IGNORE INTO telegram_image_generation_jobs(
      telegram_bot_id, update_id, telegram_chat_id, telegram_user_id, telegram_message_id,
      language_code, prompt_text, image_bot_id, image_bot_name, image_bot_profile_json, status
    ) VALUES(?,?,?,?,?,?,?,?,?,?, 'queued')
  `);
  const acceptImageJobTx = db.transaction((telegramBotId, updateId, message, prompt, bot) => {
    const result = insertImageJobStmt.run(
      telegramBotId,
      updateId,
      String(message.chat.id),
      String(message.from.id),
      message.message_id,
      message.from.language_code || '',
      prompt,
      Number(bot.id),
      String(bot.name || ''),
      JSON.stringify(imageBotSnapshot(bot)),
    );
    updateCursorStmt.run(updateId + 1, telegramBotId);
    return result.changes > 0;
  });
  const handoffTranscriptionToImageTx = db.transaction((job, transcript, provider, model, contextWarning, profile) => {
    const existing = db.prepare(`
      SELECT id FROM telegram_image_generation_jobs
      WHERE source_transcription_job_id=?
    `).get(job.id);
    let imageJobId = Number(existing?.id || 0);
    if (!imageJobId) {
      const result = db.prepare(`
        INSERT INTO telegram_image_generation_jobs(
          telegram_bot_id, update_id, telegram_chat_id, telegram_user_id, telegram_message_id,
          language_code, prompt_text, image_bot_id, image_bot_name, image_bot_profile_json,
          source_transcription_job_id, context_warning, status, status_message_id
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?, 'queued', ?)
      `).run(
        job.telegram_bot_id,
        job.update_id,
        job.telegram_chat_id,
        job.telegram_user_id,
        job.telegram_message_id,
        job.language_code,
        transcript,
        profile.image_bot_id,
        profile.image_bot_name,
        JSON.stringify(profile.image_bot_profile || {}),
        job.id,
        contextWarning ? 1 : 0,
        job.status_message_id || null,
      );
      imageJobId = Number(result.lastInsertRowid || 0);
    }
    db.prepare(`
      UPDATE telegram_transcription_jobs
      SET status='completed', transcript_text=NULL, transcription_provider=?, transcription_model=?,
        error=NULL, completed_at=datetime('now'), updated_at=datetime('now')
      WHERE id=?
    `).run(provider || '', model || '', job.id);
    return imageJobId;
  });

  db.prepare(`
    UPDATE telegram_transcription_jobs
    SET status='queued', updated_at=datetime('now')
    WHERE status IN ('processing','delivering')
  `).run();
  db.prepare(`
    UPDATE telegram_image_generation_jobs
    SET status='queued', updated_at=datetime('now')
    WHERE status IN ('processing','delivering')
  `).run();
  db.prepare(`
    DELETE FROM telegram_transcription_jobs
    WHERE status IN ('completed','error') AND datetime(updated_at) < datetime('now','-30 days')
  `).run();
  db.prepare(`
    DELETE FROM telegram_image_generation_jobs
    WHERE status IN ('completed','error') AND datetime(updated_at) < datetime('now','-30 days')
  `).run();

  function currentToken(botId) {
    return getBotToken(db, botId, secret);
  }

  function createClient(token) {
    return createTelegramClient(token, { fetchImpl });
  }

  function listContextBots() {
    try {
      return getAiBotFeature?.()?.listVoiceContextConvertBots?.() || [];
    } catch {
      return [];
    }
  }

  function listImageBots() {
    try {
      return getAiBotFeature?.()?.listTelegramImageBots?.() || [];
    } catch {
      return [];
    }
  }

  function selectableImageBot(botId) {
    const id = positiveInteger(botId);
    return listImageBots().find((bot) => (
      positiveInteger(bot?.id) === id
      && bot.enabled !== false
      && bot.provider_enabled !== false
      && bot.allow_image_generate !== false
    )) || null;
  }

  function imageBotSnapshot(bot) {
    try {
      return getAiBotFeature?.()?.getTelegramImageBotSnapshot?.(bot?.id) || { ...bot };
    } catch {
      return { ...bot };
    }
  }

  function totalActiveCount(botId) {
    return Number(activeCountStmt.get(botId)?.count || 0) + Number(imageActiveCountStmt.get(botId)?.count || 0);
  }

  function userTotalActiveCount(botId, userId) {
    return Number(userActiveCountStmt.get(botId, userId)?.count || 0)
      + Number(imageUserActiveCountStmt.get(botId, userId)?.count || 0);
  }

  function selectableContextBot(botId) {
    const id = positiveInteger(botId);
    return listContextBots().find((bot) => (
      positiveInteger(bot?.id) === id && bot.enabled !== false && bot.provider_enabled !== false
    )) || null;
  }

  function readiness(settings) {
    return providerReadiness(settings, getVoiceSettings(db), {
      hasOpenAIKey: Boolean(getOpenAIKey(db, secret)),
      hasGrokKey: Boolean(getGrokKey(db, secret)),
      hasFfmpeg: isFfmpegAvailable(),
    });
  }

  function validateConfiguration(settings) {
    if (!settings.transcription_enabled) return;
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

  function validateImageConfiguration(settings) {
    if (settings.image_generation_enabled && !selectableImageBot(settings.image_bot_id)) {
      const error = new Error('Select an enabled image bot with image generation permission');
      error.status = 400;
      throw error;
    }
  }

  function jobProfile(settings, imageBot = null) {
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
      generate_image_from_transcription: Boolean(settings.generate_image_from_transcription),
      image_bot_id: imageBot ? Number(imageBot.id) : null,
      image_bot_name: imageBot ? String(imageBot.name || '') : '',
      image_bot_profile: imageBot ? imageBotSnapshot(imageBot) : null,
    };
  }

  function queueStats(botId) {
    const transcriptionByStatus = Object.fromEntries(db.prepare(`
      SELECT status, COUNT(*) AS count
      FROM telegram_transcription_jobs
      WHERE telegram_bot_id=? AND status IN ${ACTIVE_STATUSES}
      GROUP BY status
    `).all(botId).map((row) => [row.status, Number(row.count || 0)]));
    const imageByStatus = Object.fromEntries(db.prepare(`
      SELECT status, COUNT(*) AS count
      FROM telegram_image_generation_jobs
      WHERE telegram_bot_id=? AND status IN ${ACTIVE_STATUSES}
      GROUP BY status
    `).all(botId).map((row) => [row.status, Number(row.count || 0)]));
    const transcription = Number(activeCountStmt.get(botId)?.count || 0);
    const images = Number(imageActiveCountStmt.get(botId)?.count || 0);
    return {
      total: transcription + images,
      transcription,
      images,
      queued: (transcriptionByStatus.queued || 0) + (imageByStatus.queued || 0),
      processing: (transcriptionByStatus.processing || 0) + (imageByStatus.processing || 0),
      delivering: (transcriptionByStatus.delivering || 0) + (imageByStatus.delivering || 0),
      image: {
        total: images,
        queued: imageByStatus.queued || 0,
        processing: imageByStatus.processing || 0,
        delivering: imageByStatus.delivering || 0,
      },
    };
  }

  function serializedState(botId) {
    const runtime = runtimeFor(botId);
    const stored = stateStmt.get(botId) || {};
    return {
      ...runtime,
      last_poll_at: runtime.last_poll_at || stored.last_poll_at || '',
      last_update_at: runtime.last_update_at || stored.last_update_at || '',
      last_error: runtime.last_error || stored.last_error || '',
      next_update_id: Number(stored.next_update_id || 0),
      queue: queueStats(botId),
    };
  }

  function adminPayload() {
    return {
      bots: listBots(db).map((bot) => ({
        ...sanitizeBot(bot),
        runtime: serializedState(bot.id),
        providerReadiness: readiness(bot),
      })),
      options: VOICE_SETTINGS_OPTIONS,
      contextConvertBots: listContextBots(),
      imageBots: listImageBots(),
    };
  }

  function capabilityMessageKey(settings, base) {
    if (settings.transcription_enabled && settings.image_generation_enabled) return `${base}Combined`;
    if (settings.image_generation_enabled) return `${base}Image`;
    return base;
  }

  function rememberPoll(botId, error = '') {
    const runtime = runtimeFor(botId);
    const now = new Date().toISOString();
    runtime.last_poll_at = now;
    runtime.last_error = String(error || '');
    updatePollStateStmt.run(runtime.last_error || null, botId);
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

  function recordCursor(botId, updateId) {
    updateCursorStmt.run(Number(updateId || 0) + 1, botId);
    const runtime = runtimeFor(botId);
    runtime.last_update_at = new Date().toISOString();
  }

  async function handleUpdate(update, client, botOrId) {
    const settings = typeof botOrId === 'object' && botOrId ? botOrId : readBot(db, botOrId);
    if (!settings) return;
    const botId = settings.id;
    const updateId = Number(update?.update_id || 0);
    const message = update?.message;
    if (!updateId) return;
    if (!message?.chat || !message?.from || !message?.message_id) {
      recordCursor(botId, updateId);
      return;
    }

    const language = message.from.language_code || '';
    const userId = String(message.from.id || '');
    const text = String(message.text || '').trim();
    const isKnownCommand = /^\/(?:start|help)(?:@\w+)?(?:\s|$)/i.test(text);
    const isAnyCommand = /^\/\S+/u.test(text);
    const media = extractTelegramAudio(message);

    if (message.chat.type !== 'private') {
      recordCursor(botId, updateId);
      if (isKnownCommand || media || text) {
        await sendReply(client, message, telegramText(language, 'privateOnly')).catch(() => {});
      }
      return;
    }

    if (isKnownCommand) {
      recordCursor(botId, updateId);
      const base = /^\/start/i.test(text) ? 'start' : 'help';
      const key = capabilityMessageKey(settings, base);
      await sendReply(client, message, telegramText(language, key, userId));
      return;
    }

    if (!settings.allowed_user_ids.includes(userId)) {
      recordCursor(botId, updateId);
      if (media || text) await sendReply(client, message, telegramText(language, 'denied', userId));
      return;
    }

    if (media) {
      if (!settings.transcription_enabled) {
        recordCursor(botId, updateId);
        await sendReply(client, message, telegramText(language, 'transcriptionDisabled'));
        return;
      }
      if (media.file_size && media.file_size > settings.max_file_size_bytes) {
        recordCursor(botId, updateId);
        await sendReply(client, message, telegramText(language, 'tooLarge'));
        return;
      }
      if (totalActiveCount(botId) >= MAX_BOT_ACTIVE || userTotalActiveCount(botId, userId) >= MAX_USER_ACTIVE) {
        recordCursor(botId, updateId);
        await sendReply(client, message, telegramText(language, 'busy'));
        return;
      }

      const imageBot = settings.generate_image_from_transcription ? selectableImageBot(settings.image_bot_id) : null;
      if (settings.generate_image_from_transcription && !imageBot) {
        recordCursor(botId, updateId);
        await sendReply(client, message, telegramText(language, 'imageBotUnavailable'));
        return;
      }
      const profile = jobProfile(settings, imageBot);
      const providerSettings = buildProviderSettings(profile, getVoiceSettings(db));
      const inserted = acceptJobTx(
        botId,
        updateId,
        message,
        media,
        profile,
        providerSettings.active_provider,
        getProviderModel(providerSettings)
      );
      runtimeFor(botId).last_update_at = new Date().toISOString();
      if (inserted) pumpWorker(botId);
      return;
    }

    if (text) {
      if (isAnyCommand) {
        recordCursor(botId, updateId);
        await sendReply(client, message, telegramText(language, capabilityMessageKey(settings, 'help'), userId));
        return;
      }
      if (!settings.image_generation_enabled) {
        recordCursor(botId, updateId);
        await sendReply(client, message, telegramText(language, 'imageGenerationDisabled'));
        return;
      }
      if (Array.from(text).length > 4000) {
        recordCursor(botId, updateId);
        await sendReply(client, message, telegramText(language, 'promptTooLong'));
        return;
      }
      const imageBot = selectableImageBot(settings.image_bot_id);
      if (!imageBot) {
        recordCursor(botId, updateId);
        await sendReply(client, message, telegramText(language, 'imageBotUnavailable'));
        return;
      }
      if (totalActiveCount(botId) >= MAX_BOT_ACTIVE || userTotalActiveCount(botId, userId) >= MAX_USER_ACTIVE) {
        recordCursor(botId, updateId);
        await sendReply(client, message, telegramText(language, 'busy'));
        return;
      }
      const inserted = acceptImageJobTx(botId, updateId, message, text, imageBot);
      runtimeFor(botId).last_update_at = new Date().toISOString();
      if (inserted) pumpImageWorker(botId);
      return;
    }

    recordCursor(botId, updateId);
    await sendReply(client, message, telegramText(language, capabilityMessageKey(settings, 'unsupported')));
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

  function shouldGenerateImageFromTranscript(profile) {
    return Boolean(
      profile?.generate_image_from_transcription
      && positiveInteger(profile?.image_bot_id)
      && profile?.image_bot_profile
    );
  }

  function handoffTranscriptToImage(job, finalText, provider, model, contextWarning, profile) {
    const imageJobId = handoffTranscriptionToImageTx(
      job,
      finalText,
      provider,
      model,
      contextWarning,
      profile,
    );
    if (!imageJobId) throw new Error('Could not queue image generation from transcription');
    pumpImageWorker(job.telegram_bot_id);
  }

  async function processJob(job) {
    const token = currentToken(job.telegram_bot_id);
    if (!token) throw new Error('Telegram bot token is not configured');
    const client = createClient(token);
    const profile = { ...DEFAULT_SETTINGS, ...JSON.parse(job.profile_json || '{}') };
    const language = job.language_code || '';
    await updateStatusMessage(client, job, telegramText(language, 'accepted'));

    if (String(job.transcript_text || '').trim()) {
      const transcript = String(job.transcript_text).trim();
      if (shouldGenerateImageFromTranscript(profile)) {
        handoffTranscriptToImage(job, transcript, job.transcription_provider, job.transcription_model, false, profile);
      } else {
        await deliverTranscript(client, job, transcript);
      }
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

      if (shouldGenerateImageFromTranscript(profile)) {
        handoffTranscriptToImage(
          job,
          finalText,
          result.provider || profile.active_provider,
          result.model || '',
          converted.warning,
          profile,
        );
      } else {
        await deliverTranscript(client, job, finalText, converted.warning);
      }
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
      const client = createClient(currentToken(job.telegram_bot_id));
      await updateStatusMessage(client, job, telegramText(job.language_code, error?.userMessageKey || 'failed'));
    } catch {}
    console.warn('[telegram-transcription] job failed:', message);
  }

  function pumpWorker(botId) {
    const id = positiveInteger(botId);
    if (!id || transcriptionWorkers.has(id) || stopped) return;
    transcriptionWorkers.add(id);
    Promise.resolve().then(async () => {
      while (!stopped) {
        const job = nextJobStmt.get(id);
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
      transcriptionWorkers.delete(id);
      if (!stopped && nextJobStmt.get(id)) pumpWorker(id);
    });
  }

  async function updateImageStatusMessage(client, job, text) {
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
        UPDATE telegram_image_generation_jobs
        SET status_message_id=?, updated_at=datetime('now')
        WHERE id=?
      `).run(messageId, job.id);
      job.status_message_id = messageId;
    }
    return messageId;
  }

  async function sendGeneratedImage(client, job) {
    const buffer = Buffer.isBuffer(job.image_data) ? job.image_data : Buffer.from(job.image_data || []);
    if (!buffer.length) throw new Error('Generated image is empty');
    if (buffer.length > MAX_TELEGRAM_DOCUMENT_BYTES) {
      const error = new Error('Generated image exceeds Telegram file size limit');
      error.userMessageKey = 'imageTooLarge';
      throw error;
    }
    const transcript = Number(job.source_transcription_job_id || 0) > 0
      ? String(job.prompt_text || '').trim() : '';
    const transcriptParts = transcript ? splitUnicodeText(transcript, 1024) : [];
    const options = {
      fileName: job.image_file_name || 'bananza-image.png',
      mimeType: job.image_mime_type || 'image/png',
      replyToMessageId: job.telegram_message_id,
      caption: transcriptParts[0] || '',
    };
    const photoMime = ['image/png', 'image/jpeg', 'image/jpg'].includes(String(options.mimeType).toLowerCase());
    if (photoMime && buffer.length <= MAX_TELEGRAM_PHOTO_BYTES) {
      try {
        await retryTelegram(() => client.sendPhoto(job.telegram_chat_id, buffer, options));
      } catch (error) {
        if (!(error instanceof TelegramApiError) || Number(error.errorCode || error.status || 0) !== 400) throw error;
        await retryTelegram(() => client.sendDocument(job.telegram_chat_id, buffer, options));
      }
    } else {
      await retryTelegram(() => client.sendDocument(job.telegram_chat_id, buffer, options));
    }

    for (let index = 1; index < transcriptParts.length; index += 1) {
      await retryTelegram(() => client.sendMessage(job.telegram_chat_id, transcriptParts[index], job.telegram_message_id));
    }
    if (Number(job.source_transcription_job_id || 0) > 0 && job.context_warning) {
      await retryTelegram(() => client.sendMessage(
        job.telegram_chat_id,
        telegramText(job.language_code, 'contextWarning'),
        job.telegram_message_id,
      ));
    }

    if (job.status_message_id && typeof client.deleteMessage === 'function') {
      try {
        await retryTelegram(() => client.deleteMessage(job.telegram_chat_id, job.status_message_id));
      } catch {
        await updateImageStatusMessage(client, job, telegramText(job.language_code, 'imageReady')).catch(() => {});
      }
    } else {
      await updateImageStatusMessage(client, job, telegramText(job.language_code, 'imageReady')).catch(() => {});
    }

    db.prepare(`
      UPDATE telegram_image_generation_jobs
      SET status='completed', prompt_text=NULL, image_data=NULL, error=NULL,
        completed_at=datetime('now'), updated_at=datetime('now')
      WHERE id=?
    `).run(job.id);
  }

  async function deliverTranscriptFromImageJob(client, job) {
    const parts = splitUnicodeText(String(job.prompt_text || '').trim(), 4000);
    if (!parts.length) throw new Error('Transcription returned empty text');
    await updateImageStatusMessage(client, job, parts[0]);
    for (let index = 1; index < parts.length; index += 1) {
      await retryTelegram(() => client.sendMessage(job.telegram_chat_id, parts[index], job.telegram_message_id));
    }
    if (job.context_warning) {
      await retryTelegram(() => client.sendMessage(
        job.telegram_chat_id,
        telegramText(job.language_code, 'contextWarning'),
        job.telegram_message_id,
      ));
    }
  }

  async function processImageJob(job) {
    const token = currentToken(job.telegram_bot_id);
    if (!token) throw new Error('Telegram bot token is not configured');
    const client = createClient(token);
    await updateImageStatusMessage(client, job, telegramText(
      job.language_code,
      Number(job.source_transcription_job_id || 0) > 0 ? 'imageFromTranscriptAccepted' : 'imageAccepted',
    ));

    if (job.image_data) {
      await sendGeneratedImage(client, job);
      return;
    }

    const feature = getAiBotFeature?.();
    if (!feature?.generateTelegramImage) throw new Error('Image generation runtime is unavailable');
    const result = await feature.generateTelegramImage({
      botId: job.image_bot_id,
      botSnapshot: JSON.parse(job.image_bot_profile_json || '{}'),
      prompt: String(job.prompt_text || '').trim(),
      allowLongPrompt: Number(job.source_transcription_job_id || 0) > 0,
    });
    const buffer = Buffer.isBuffer(result?.buffer) ? result.buffer : Buffer.from(result?.buffer || []);
    if (!buffer.length) throw new Error('Image generation returned empty data');
    if (buffer.length > MAX_TELEGRAM_DOCUMENT_BYTES) {
      const error = new Error('Generated image exceeds Telegram file size limit');
      error.userMessageKey = 'imageTooLarge';
      throw error;
    }
    db.prepare(`
      UPDATE telegram_image_generation_jobs
      SET status='delivering', image_data=?, image_mime_type=?, image_file_name=?,
        generation_provider=?, generation_model=?, error=NULL, updated_at=datetime('now')
      WHERE id=?
    `).run(
      buffer,
      String(result.mimeType || 'image/png'),
      String(result.filename || 'bananza-image.png'),
      String(result.provider || ''),
      String(result.model || ''),
      job.id,
    );
    job.status = 'delivering';
    job.image_data = buffer;
    job.image_mime_type = String(result.mimeType || 'image/png');
    job.image_file_name = String(result.filename || 'bananza-image.png');
    await sendGeneratedImage(client, job);
  }

  async function failImageJob(job, error) {
    const message = safeErrorMessage(error, 'Telegram image generation failed');
    const fromTranscription = Number(job.source_transcription_job_id || 0) > 0;
    db.prepare(`
      UPDATE telegram_image_generation_jobs
      SET status='error', prompt_text=NULL, image_data=NULL, error=?,
        completed_at=datetime('now'), updated_at=datetime('now')
      WHERE id=?
    `).run(message, job.id);
    try {
      const client = createClient(currentToken(job.telegram_bot_id));
      if (fromTranscription) {
        await deliverTranscriptFromImageJob(client, job);
        await retryTelegram(() => client.sendMessage(
          job.telegram_chat_id,
          telegramText(job.language_code, error?.userMessageKey || 'imageFailed'),
          job.telegram_message_id,
        ));
      } else {
        await updateImageStatusMessage(client, job, telegramText(job.language_code, error?.userMessageKey || 'imageFailed'));
      }
    } catch {}
    console.warn('[telegram-image-generation] job failed:', message);
  }

  function pumpImageWorker(botId) {
    const id = positiveInteger(botId);
    if (!id || imageWorkers.has(id) || stopped) return;
    imageWorkers.add(id);
    Promise.resolve().then(async () => {
      while (!stopped) {
        const job = nextImageJobStmt.get(id);
        if (!job) break;
        const claimed = db.prepare(`
          UPDATE telegram_image_generation_jobs
          SET status='processing', error=NULL, updated_at=datetime('now')
          WHERE id=? AND status='queued'
        `).run(job.id);
        if (!claimed.changes) continue;
        job.status = 'processing';
        try {
          await processImageJob(job);
        } catch (error) {
          await failImageJob(job, error);
        }
      }
    }).finally(() => {
      imageWorkers.delete(id);
      if (!stopped && nextImageJobStmt.get(id)) pumpImageWorker(id);
    });
  }

  async function runPollLoop(botId, generation, controller) {
    const runtime = runtimeFor(botId);
    let retryMs = 1000;
    while (!stopped && generation === pollGenerations.get(botId) && !controller.signal.aborted) {
      const settings = readBot(db, botId);
      const token = currentToken(botId);
      if (!settings || (!settings.transcription_enabled && !settings.image_generation_enabled) || !token) break;
      const client = createClient(token);
      try {
        const offset = Number(stateStmt.get(botId)?.next_update_id || 0);
        const updates = await client.getUpdates({ offset, timeout: 25, signal: controller.signal });
        rememberPoll(botId, '');
        runtime.state = 'polling';
        runtime.retry_in_ms = 0;
        retryMs = 1000;
        for (const update of Array.isArray(updates) ? updates : []) {
          await handleUpdate(update, client, settings);
        }
      } catch (error) {
        if (error?.name === 'AbortError' || controller.signal.aborted) break;
        const code = Number(error?.errorCode || error?.status || 0);
        rememberPoll(botId, safeErrorMessage(error, 'Telegram polling failed'));
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
        try { await delay(waitMs, controller.signal); } catch { break; }
        retryMs = Math.min(30000, Math.max(1000, retryMs * 2));
      }
    }
    if (generation === pollGenerations.get(botId)) {
      runtime.running = false;
      if (runtime.state === 'polling' || runtime.state === 'starting') runtime.state = 'stopped';
    }
  }

  async function startPolling(botId) {
    const id = positiveInteger(botId);
    const settings = readBot(db, id);
    const runtime = runtimeFor(id);
    const token = currentToken(id);
    pumpWorker(id);
    pumpImageWorker(id);
    if (stopped || !settings || runtime.running
      || (!settings.transcription_enabled && !settings.image_generation_enabled) || !token) return;
    runtime.state = 'starting';
    runtime.webhook_conflict = false;
    runtime.last_error = '';
    try {
      const webhook = await createClient(token).getWebhookInfo();
      if (String(webhook?.url || '').trim()) {
        runtime.state = 'conflict';
        runtime.webhook_conflict = true;
        runtime.last_error = 'Telegram bot has an active webhook';
        rememberPoll(id, runtime.last_error);
        return;
      }
    } catch (error) {
      const code = Number(error?.errorCode || error?.status || 0);
      runtime.last_error = safeErrorMessage(error);
      rememberPoll(id, runtime.last_error);
      if (code === 401) {
        runtime.state = 'auth_error';
        return;
      }
    }
    const controller = new AbortController();
    pollControllers.set(id, controller);
    const generation = Number(pollGenerations.get(id) || 0) + 1;
    pollGenerations.set(id, generation);
    runtime.running = true;
    runtime.state = 'polling';
    runPollLoop(id, generation, controller).catch((error) => {
      runtime.running = false;
      runtime.state = 'error';
      runtime.last_error = safeErrorMessage(error);
    });
  }

  function stopPolling(botId) {
    const id = positiveInteger(botId);
    pollGenerations.set(id, Number(pollGenerations.get(id) || 0) + 1);
    pollControllers.get(id)?.abort();
    pollControllers.delete(id);
    const runtime = runtimeFor(id);
    runtime.running = false;
    runtime.retry_in_ms = 0;
    if (!['auth_error', 'conflict', 'error'].includes(runtime.state)) runtime.state = 'stopped';
  }

  async function resyncRuntime(botId) {
    const id = positiveInteger(botId);
    stopPolling(id);
    const runtime = runtimeFor(id);
    runtime.webhook_conflict = false;
    runtime.last_error = '';
    await startPolling(id);
  }

  function requireName(draft) {
    if (!draft.name) {
      const error = new Error('Telegram bot name is required');
      error.status = 400;
      throw error;
    }
  }

  function ensureUniqueTelegramIdentity(telegramApiBotId, exceptId = 0) {
    if (!telegramApiBotId) return;
    const duplicate = db.prepare('SELECT id FROM telegram_bots WHERE telegram_api_bot_id=? AND id!=?')
      .get(String(telegramApiBotId), Number(exceptId || 0));
    if (duplicate) {
      const error = new Error('This Telegram bot is already connected');
      error.status = 409;
      throw error;
    }
  }

  async function inspectToken(token) {
    const client = createClient(token);
    const [bot, webhook] = await Promise.all([client.getMe(), client.getWebhookInfo()]);
    return {
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
    };
  }

  function applyIdentity(draft, identity) {
    draft.telegram_api_bot_id = identity.bot.id;
    draft.telegram_bot_name = identity.bot.name;
    draft.telegram_bot_username = identity.bot.username;
  }

  function validateDraft(draft, token) {
    requireName(draft);
    validateConfiguration(draft);
    validateImageConfiguration(draft);
    if ((draft.transcription_enabled || draft.image_generation_enabled) && !token) {
      const error = new Error('Telegram bot token is required');
      error.status = 400;
      throw error;
    }
  }

  app.get('/api/admin/telegram-bots', auth, adminOnly, (_req, res) => res.json(adminPayload()));

  app.post('/api/admin/telegram-bots', auth, adminOnly, async (req, res) => {
    const incoming = req.body || {};
    const submittedToken = String(incoming.bot_token || '').trim();
    if (!submittedToken) return res.status(400).json({ error: 'Telegram bot token is required' });
    try {
      const draft = buildDraftBot({}, incoming, secret);
      validateDraft(draft, submittedToken);
      const identity = await inspectToken(submittedToken);
      applyIdentity(draft, identity);
      ensureUniqueTelegramIdentity(draft.telegram_api_bot_id);
      const saved = createBot(db, draft, secret);
      await startPolling(saved.id);
      return res.status(201).json({ ...adminPayload(), selected_bot_id: saved.id });
    } catch (error) {
      return res.status(error.status || error.errorCode || 400).json({ error: safeErrorMessage(error, 'Could not create Telegram bot') });
    }
  });

  app.put('/api/admin/telegram-bots/:id(\\d+)', auth, adminOnly, async (req, res) => {
    const id = Number(req.params.id);
    const current = readBot(db, id);
    if (!current) return res.status(404).json({ error: 'Telegram bot not found' });
    const incoming = req.body || {};
    const oldToken = currentToken(id);
    const submittedToken = String(incoming.bot_token || '').trim();
    if (submittedToken && current.bot_token_encrypted
      && (!oldToken || submittedToken !== oldToken) && totalActiveCount(id) > 0) {
      return res.status(409).json({ error: 'Wait for active Telegram jobs before replacing the token' });
    }
    try {
      const draft = buildDraftBot(current, incoming, secret);
      const effectiveToken = submittedToken || oldToken;
      validateDraft(draft, effectiveToken);
      if (submittedToken) {
        const identity = await inspectToken(submittedToken);
        applyIdentity(draft, identity);
        ensureUniqueTelegramIdentity(draft.telegram_api_bot_id, id);
      }
      const tokenChanged = Boolean(submittedToken && submittedToken !== oldToken);
      updateBot(db, id, draft, secret);
      if (tokenChanged) resetCursorStmt.run(id);
      await resyncRuntime(id);
      return res.json({ ...adminPayload(), selected_bot_id: id });
    } catch (error) {
      return res.status(error.status || error.errorCode || 400).json({ error: safeErrorMessage(error, 'Could not save Telegram bot') });
    }
  });

  app.delete('/api/admin/telegram-bots/:id(\\d+)', auth, adminOnly, (req, res) => {
    const id = Number(req.params.id);
    if (!readBot(db, id)) return res.status(404).json({ error: 'Telegram bot not found' });
    if (totalActiveCount(id) > 0) {
      return res.status(409).json({ error: 'Wait for active Telegram jobs before deleting the bot' });
    }
    stopPolling(id);
    deleteBot(db, id);
    runtimes.delete(id);
    return res.json(adminPayload());
  });

  app.delete('/api/admin/telegram-bots/:id(\\d+)/token', auth, adminOnly, (req, res) => {
    const id = Number(req.params.id);
    if (!readBot(db, id)) return res.status(404).json({ error: 'Telegram bot not found' });
    if (totalActiveCount(id) > 0) {
      return res.status(409).json({ error: 'Wait for active Telegram jobs before deleting the token' });
    }
    stopPolling(id);
    clearBotToken(db, id);
    resetCursorStmt.run(id);
    return res.json({ ...adminPayload(), selected_bot_id: id });
  });

  app.post('/api/admin/telegram-bots/test-token', auth, adminOnly, async (req, res) => {
    const id = Number(req.body?.telegram_bot_id || 0);
    const token = String(req.body?.bot_token || '').trim() || currentToken(id);
    if (!token) return res.status(400).json({ error: 'Telegram bot token is required' });
    try {
      const identity = await inspectToken(token);
      ensureUniqueTelegramIdentity(identity.bot.id, id);
      return res.json({ ok: true, ...identity });
    } catch (error) {
      return res.status(error.status || error.errorCode || 400).json({ error: safeErrorMessage(error, 'Telegram bot test failed') });
    }
  });

  app.post('/api/admin/telegram-bots/test-transcription', auth, adminOnly, async (req, res) => {
    const current = readBot(db, req.body?.telegram_bot_id) || {};
    const draft = buildDraftBot(current, { ...req.body, transcription_enabled: true }, secret);
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

  app.post('/api/admin/telegram-bots/test-image', auth, adminOnly, async (req, res) => {
    const bot = selectableImageBot(req.body?.image_bot_id);
    if (!bot) return res.status(400).json({ error: 'Select an enabled image bot with image generation permission' });
    try {
      const feature = getAiBotFeature?.();
      if (!feature?.generateTelegramImage) throw new Error('Image generation runtime is unavailable');
      const startedAt = Date.now();
      const result = await feature.generateTelegramImage({
        botId: bot.id,
        prompt: 'A cheerful yellow banana on a clean blue background, friendly modern digital illustration, no text.',
      });
      return res.json({
        ok: true,
        provider: result.provider || bot.provider || '',
        model: result.model || bot.image_model || '',
        latency_ms: Date.now() - startedAt,
        mime_type: result.mimeType || 'image/png',
        bytes: Number(result.buffer?.length || 0),
      });
    } catch (error) {
      return res.status(error.status || 400).json({ error: safeErrorMessage(error, 'Telegram image bot test failed') });
    }
  });

  app.post('/api/admin/telegram-bots/:id(\\d+)/claim', auth, adminOnly, async (req, res) => {
    const id = Number(req.params.id);
    const token = currentToken(id);
    if (!readBot(db, id)) return res.status(404).json({ error: 'Telegram bot not found' });
    if (!token) return res.status(400).json({ error: 'Telegram bot token is required' });
    try {
      await createClient(token).deleteWebhook(true);
      resetCursorStmt.run(id);
      await resyncRuntime(id);
      return res.json({ ...adminPayload(), selected_bot_id: id });
    } catch (error) {
      return res.status(error.errorCode || 400).json({ error: safeErrorMessage(error, 'Could not remove Telegram webhook') });
    }
  });

  const startup = setImmediate(() => {
    if (!stopped) {
      for (const bot of listBots(db)) startPolling(bot.id).catch(() => {});
    }
  });
  startup.unref?.();

  function stop() {
    stopped = true;
    for (const botId of [...pollControllers.keys()]) stopPolling(botId);
  }
  server?.once?.('close', stop);

  return {
    stop,
    start(botId) {
      if (botId) return startPolling(botId);
      return Promise.all(listBots(db).map((bot) => startPolling(bot.id)));
    },
    getRuntimeState: serializedState,
    handleUpdate: (update, client, botOrId) => handleUpdate(update, client, botOrId || listBots(db)[0]),
    pumpWorker,
    pumpImageWorker,
    processJob,
    processImageJob,
    failImageJob,
  };
}

module.exports = {
  createTelegramTranscriptionFeature,
  safeErrorMessage,
  MAX_GLOBAL_ACTIVE: MAX_BOT_ACTIVE,
  MAX_USER_ACTIVE,
};
