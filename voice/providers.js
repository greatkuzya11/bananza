const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

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
  const wavPath = await prepareVoskWav(filePath);

  let res;
  try {
    res = await fetch(`${helperUrl}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_path: wavPath,
        model_name: settings.vosk_model,
        model_path: settings.vosk_model_path || '',
        language_hint: settings.openai_language || 'ru',
      }),
      signal: AbortSignal.timeout(settings.transcription_timeout_ms),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError') {
      throw new Error(`Vosk helper did not respond in time: ${helperUrl}`);
    }
    throw new Error(`Vosk helper is unavailable at ${helperUrl}`);
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

async function prepareVoskWav(filePath) {
  const ext = path.extname(String(filePath || '')).toLowerCase();
  if (ext === '.wav') return filePath;
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'bananza-vosk-'));
  const wavPath = path.join(dir, 'audio.wav');
  const result = spawnSync('ffmpeg', [
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
    throw new Error(`ffmpeg is required for Vosk transcription: ${result.error.message}`);
  }
  if (result.status !== 0) {
    await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
    throw new Error(`ffmpeg audio conversion failed: ${result.stderr || result.stdout || 'unknown error'}`);
  }
  return wavPath;
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
