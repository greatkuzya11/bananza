const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { ensureLocalVoskHelper, isLocalVoskHelperUrl } = require('./voskRuntime');
const { ensureLocalWhisperHelper, isLocalWhisperHelperUrl } = require('./whisperRuntime');
const { resolveFfmpegCommand } = require('./ffmpeg');

const whisperOperationChains = new Map();

function mimeForAudioFile(filePath) {
  const ext = path.extname(String(filePath || '')).toLowerCase();
  if (ext === '.mp3') return 'audio/mpeg';
  if (ext === '.m4a' || ext === '.mp4') return 'audio/mp4';
  if (ext === '.ogg' || ext === '.oga' || ext === '.opus') return 'audio/ogg';
  if (ext === '.webm') return 'audio/webm';
  return 'audio/wav';
}

async function parseJsonResponse(res) {
  const text = await res.text();
  try {
    return JSON.parse(text || '{}');
  } catch {
    return { raw: text };
  }
}

function normalizeProviderSegments(data = {}) {
  const rawSegments = Array.isArray(data.segments)
    ? data.segments
    : (Array.isArray(data.words) ? data.words : []);
  return rawSegments.map((segment) => {
    const text = String(segment?.text || segment?.word || '').trim();
    const start = segment?.start_ms ?? segment?.start ?? segment?.startTime ?? 0;
    const end = segment?.end_ms ?? segment?.end ?? segment?.endTime ?? start;
    const multiplier = Number(start) > 10000 || Number(end) > 10000 ? 1 : 1000;
    return {
      text,
      start_ms: Math.max(0, Math.round(Number(start || 0) * multiplier)),
      end_ms: Math.max(0, Math.round(Number(end || 0) * multiplier)),
    };
  }).filter((segment) => segment.text);
}

function normalizeWhisperTranscriptText(value) {
  const lines = String(value || '').replace(/\r\n?/g, '\n').split('\n');
  let text = '';

  for (const line of lines) {
    // whisper.cpp separates decoded segments with newlines. A leading space is
    // part of the tokenizer output and means that this segment starts a word;
    // without it the segment can be a continuation of the previous word.
    const startsNewWord = /^\s/.test(line);
    const fragment = line.replace(/\s+/g, ' ').trim();
    if (!fragment) continue;
    if (!text) {
      text = fragment;
    } else {
      text += startsNewWord ? ` ${fragment}` : fragment;
    }
  }

  return text.trim();
}

function normalizeDiarizedSegments(data = {}) {
  return (Array.isArray(data.segments) ? data.segments : []).map((segment) => {
    const text = String(segment?.text || '').trim();
    const start = segment?.start_ms ?? segment?.start ?? 0;
    const end = segment?.end_ms ?? segment?.end ?? start;
    const multiplier = Number(start) > 10000 || Number(end) > 10000 ? 1 : 1000;
    return {
      text,
      speaker: String(segment?.speaker || '').trim(),
      start_ms: Math.max(0, Math.round(Number(start || 0) * multiplier)),
      end_ms: Math.max(0, Math.round(Number(end || 0) * multiplier)),
    };
  }).filter((segment) => segment.text);
}

async function transcribeWithVosk({ filePath, settings }) {
  const helperUrl = String(settings.vosk_helper_url || '').replace(/\/+$/, '');
  if (!helperUrl) throw new Error('Vosk helper URL is not configured');
  const wavPath = await preparePcmWav(filePath, 'Vosk');

  let res;
  try {
    res = isLocalVoskHelper(helperUrl)
      ? await requestVoskByPath({ helperUrl, wavPath, settings })
      : await requestVoskByUpload({ helperUrl, wavPath, settings });
  } catch (error) {
    if (isLocalVoskHelper(helperUrl) && isVoskConnectionFailure(error)) {
      try {
        await ensureLocalVoskHelper(helperUrl);
        res = await requestVoskByPath({ helperUrl, wavPath, settings });
      } catch (startupError) {
        throw new Error(`Vosk helper is unavailable at ${helperUrl}: ${startupError.message}`);
      }
    }
    if (!res) {
      if (error?.name === 'TimeoutError') {
        throw new Error(`Vosk helper did not respond in time: ${helperUrl}`);
      }
      const detail = String(error?.cause?.message || error?.message || '').trim();
      throw new Error(`Vosk helper is unavailable at ${helperUrl}${detail ? `: ${detail}` : ''}`);
    }
  } finally {
    if (wavPath !== filePath) {
      fs.promises.rm(path.dirname(wavPath), { recursive: true, force: true }).catch(() => {});
    }
  }

  const data = await parseJsonResponse(res);
  if (!res.ok) {
    throw new Error(data.error || data.raw || 'Vosk helper request failed');
  }

  if (!data.text || !String(data.text).trim()) {
    throw new Error('Vosk returned empty transcription');
  }

  return {
    text: String(data.text).trim(),
    segments: normalizeProviderSegments(data),
    provider: 'vosk',
    model: data.model || settings.vosk_model,
  };
}

function isLocalVoskHelper(helperUrl) {
  return isLocalVoskHelperUrl(helperUrl);
}

function isVoskConnectionFailure(error) {
  const code = String(error?.cause?.code || error?.code || '').toUpperCase();
  if (['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'ENOTFOUND'].includes(code)) return true;
  return error?.name === 'TypeError' && /fetch failed/i.test(String(error?.message || ''));
}

function voskPayload(settings) {
  return {
    model_name: settings.vosk_model,
    model_path: settings.vosk_model_path || '',
    language_hint: settings.openai_language || 'ru',
  };
}

async function requestVoskByPath({ helperUrl, wavPath, settings }) {
  return fetch(`${helperUrl}/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      file_path: wavPath,
      ...voskPayload(settings),
    }),
    signal: AbortSignal.timeout(settings.transcription_timeout_ms),
  });
}

async function requestVoskByUpload({ helperUrl, wavPath, settings }) {
  const fileBuffer = await fs.promises.readFile(wavPath);
  const uploadTo = (endpoint) => fetch(`${helperUrl}${endpoint}`, {
    method: 'POST',
    body: buildVoskUploadForm(fileBuffer, wavPath, settings),
    signal: AbortSignal.timeout(settings.transcription_timeout_ms),
  });
  const res = await uploadTo('/transcribe-file');
  if (res.status === 404 || res.status === 405) {
    return uploadTo('/transcribe');
  }
  return res;
}

function buildVoskUploadForm(fileBuffer, wavPath, settings) {
  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer], { type: 'audio/wav' }), path.basename(wavPath) || 'audio.wav');
  for (const [key, value] of Object.entries(voskPayload(settings))) {
    formData.append(key, String(value || ''));
  }
  return formData;
}

async function preparePcmWav(filePath, providerName = 'Local transcription') {
  const ext = path.extname(String(filePath || '')).toLowerCase();
  if (ext === '.wav') return filePath;
  const prefix = String(providerName || 'local').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'local';
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), `bananza-${prefix}-`));
  const wavPath = path.join(dir, 'audio.wav');
  const ffmpegCommand = resolveFfmpegCommand();
  const result = spawnSync(ffmpegCommand, [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    filePath,
    '-ac',
    '1',
    '-ar',
    '16000',
    '-acodec',
    'pcm_s16le',
    wavPath,
  ], { encoding: 'utf8' });
  if (result.error) {
    await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
    throw new Error(
      `ffmpeg is required for ${providerName} transcription. Run "npm install" or set BANANZA_FFMPEG_PATH: ${result.error.message}`
    );
  }
  if (result.status !== 0) {
    await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
    throw new Error(`ffmpeg audio conversion failed: ${result.stderr || result.stdout || 'unknown error'}`);
  }
  return wavPath;
}

function whisperModelPath(settings) {
  const model = String(settings.whisper_model || 'ggml-tiny.bin').trim();
  if (!/^[a-zA-Z0-9._-]+\.bin$/.test(model)) {
    throw new Error('Whisper model name is invalid');
  }
  const modelsDir = String(settings.whisper_models_dir || '').trim().replace(/[\\/]+$/, '');
  if (!modelsDir) return model;
  const separator = modelsDir.includes('\\') && !modelsDir.includes('/') ? '\\' : '/';
  return `${modelsDir}${separator}${model}`;
}

function queueWhisperOperation(helperUrl, operation) {
  const previous = whisperOperationChains.get(helperUrl) || Promise.resolve();
  const current = previous.catch(() => {}).then(operation);
  whisperOperationChains.set(helperUrl, current);
  current.then(
    () => {
      if (whisperOperationChains.get(helperUrl) === current) whisperOperationChains.delete(helperUrl);
    },
    () => {
      if (whisperOperationChains.get(helperUrl) === current) whisperOperationChains.delete(helperUrl);
    }
  );
  return current;
}

async function requestWhisper(helperUrl, endpoint, options, timeoutMs) {
  try {
    return await fetch(`${helperUrl}${endpoint}`, {
      ...options,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError') {
      throw new Error(`Whisper helper did not respond in time: ${helperUrl}`);
    }
    throw new Error(`Whisper helper is unavailable at ${helperUrl}`);
  }
}

async function loadWhisperModel({ helperUrl, settings }) {
  const formData = new FormData();
  const modelPath = whisperModelPath(settings);
  formData.append('model', modelPath);
  const res = await requestWhisper(helperUrl, '/load', {
    method: 'POST',
    body: formData,
  }, settings.transcription_timeout_ms);
  const responseText = await res.text();
  let responseData = {};
  try {
    responseData = JSON.parse(responseText || '{}');
  } catch {
    responseData = { raw: responseText };
  }
  const explicitlySuccessful = /load was successful/i.test(responseText)
    || responseData.success === true
    || responseData.status === 'ok';
  if (!res.ok || !explicitlySuccessful) {
    const detail = String(responseData.error || responseData.raw || '').trim();
    if (/model not found/i.test(detail)) {
      throw new Error(`Whisper model not found: ${modelPath}. Run "npm run whisper:install -- all".`);
    }
    throw new Error(detail || `Whisper could not load model: ${modelPath}`);
  }
  return modelPath;
}

async function transcribeWithWhisper({ filePath, settings }) {
  const helperUrl = String(settings.whisper_helper_url || '').replace(/\/+$/, '');
  if (!helperUrl) throw new Error('Whisper helper URL is not configured');
  const wavPath = await preparePcmWav(filePath, 'Whisper');

  try {
    return await queueWhisperOperation(helperUrl, async () => {
      let helperState = null;
      if (isLocalWhisperHelperUrl(helperUrl)) {
        try {
          helperState = await ensureLocalWhisperHelper(helperUrl, settings);
        } catch (error) {
          throw new Error(`Whisper helper is unavailable at ${helperUrl}: ${error.message}`);
        }
      }
      if (!helperState?.started) {
        await loadWhisperModel({ helperUrl, settings });
      }
      const fileBuffer = await fs.promises.readFile(wavPath);
      const formData = new FormData();
      formData.append('file', new Blob([fileBuffer], { type: 'audio/wav' }), path.basename(wavPath) || 'audio.wav');
      formData.append('language', String(settings.whisper_language || 'ru'));
      formData.append('translate', 'false');
      formData.append('temperature', '0.0');
      formData.append('temperature_inc', '0.2');
      formData.append('no_speech_thold', '0.6');
      formData.append('suppress_nst', 'true');
      formData.append('response_format', 'verbose_json');

      const res = await requestWhisper(helperUrl, '/inference', {
        method: 'POST',
        body: formData,
      }, settings.transcription_timeout_ms);
      const data = await parseJsonResponse(res);
      if (!res.ok) {
        throw new Error(data.error || data.raw || 'Whisper helper request failed');
      }
      const text = normalizeWhisperTranscriptText(data.text);
      if (!text) {
        throw new Error('Whisper returned empty transcription');
      }
      return {
        text,
        segments: normalizeProviderSegments(data),
        provider: 'whisper',
        model: settings.whisper_model || 'ggml-tiny.bin',
      };
    });
  } finally {
    if (wavPath !== filePath) {
      fs.promises.rm(path.dirname(wavPath), { recursive: true, force: true }).catch(() => {});
    }
  }
}

async function transcribeWithOpenAI({ filePath, settings, apiKey }) {
  if (!apiKey) throw new Error('OpenAI API key is not configured');
  const fileBuffer = await fs.promises.readFile(filePath);
  const formData = new FormData();
  formData.append('model', settings.openai_model);
  formData.append('language', settings.openai_language || 'ru');
  formData.append('file', new Blob([fileBuffer], { type: mimeForAudioFile(filePath) }), path.basename(filePath));

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
    signal: AbortSignal.timeout(settings.transcription_timeout_ms),
  });

  const data = await parseJsonResponse(res);
  if (!res.ok) {
    throw new Error(data.error?.message || data.error || data.raw || 'OpenAI transcription request failed');
  }

  if (!data.text || !String(data.text).trim()) {
    throw new Error('OpenAI returned empty transcription');
  }

  return {
    text: String(data.text).trim(),
    segments: normalizeProviderSegments(data),
    provider: 'openai',
    model: settings.openai_model,
  };
}

async function transcribeWithOpenAIDiarization({ filePath, settings, apiKey }) {
  if (!apiKey) throw new Error('OpenAI API key is not configured');
  const fileBuffer = await fs.promises.readFile(filePath);
  const formData = new FormData();
  formData.append('model', 'gpt-4o-transcribe-diarize');
  formData.append('response_format', 'diarized_json');
  formData.append('chunking_strategy', 'auto');
  if (settings.openai_language) formData.append('language', settings.openai_language || 'ru');
  formData.append('file', new Blob([fileBuffer], { type: mimeForAudioFile(filePath) }), path.basename(filePath));

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
    signal: AbortSignal.timeout(settings.transcription_timeout_ms),
  });

  const data = await parseJsonResponse(res);
  if (!res.ok) {
    throw new Error(data.error?.message || data.error || data.raw || 'OpenAI diarization request failed');
  }
  const text = String(data.text || '').trim();
  const segments = normalizeDiarizedSegments(data);
  if (!text && !segments.length) throw new Error('OpenAI diarization returned empty transcription');
  return {
    text: text || segments.map((segment) => segment.text).join(' ').trim(),
    segments,
    provider: 'openai',
    model: 'gpt-4o-transcribe-diarize',
  };
}

async function transcribeWithGrok({ filePath, settings, grokApiKey }) {
  if (!grokApiKey) throw new Error('Grok API key is not configured');
  const fileBuffer = await fs.promises.readFile(filePath);
  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer], { type: mimeForAudioFile(filePath) }), path.basename(filePath));
  if (settings.grok_language) {
    formData.append('language', settings.grok_language);
  }

  const res = await fetch('https://api.x.ai/v1/stt', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${grokApiKey}`,
    },
    body: formData,
    signal: AbortSignal.timeout(settings.transcription_timeout_ms),
  });

  const data = await parseJsonResponse(res);
  if (!res.ok) {
    throw new Error(data.error?.message || data.error || data.raw || 'Grok transcription request failed');
  }

  if (!data.text || !String(data.text).trim()) {
    throw new Error('Grok returned empty transcription');
  }

  return {
    text: String(data.text).trim(),
    segments: normalizeProviderSegments(data),
    provider: 'grok',
    model: data.model || 'speech-to-text',
  };
}

async function runProvider(provider, ctx) {
  if (provider === 'openai') return transcribeWithOpenAI(ctx);
  if (provider === 'grok') return transcribeWithGrok(ctx);
  if (provider === 'vosk') return transcribeWithVosk(ctx);
  if (provider === 'whisper') return transcribeWithWhisper(ctx);
  throw new Error(`Unsupported provider: ${provider}`);
}

async function transcribeAudio({ filePath, settings, apiKey, grokApiKey }) {
  const primary = settings.active_provider;
  try {
    return await runProvider(primary, { filePath, settings, apiKey, grokApiKey });
  } catch (error) {
    if (primary !== 'openai' && settings.fallback_to_openai) {
      try {
        return await runProvider('openai', { filePath, settings, apiKey, grokApiKey });
      } catch (fallbackError) {
        fallbackError.message = `${error.message}; fallback failed: ${fallbackError.message}`;
        throw fallbackError;
      }
    }
    throw error;
  }
}

async function testProviderModel({ filePath, settings, apiKey, grokApiKey }) {
  return runProvider(settings.active_provider, { filePath, settings, apiKey, grokApiKey });
}

module.exports = {
  transcribeAudio,
  transcribeWithOpenAIDiarization,
  testProviderModel,
};
