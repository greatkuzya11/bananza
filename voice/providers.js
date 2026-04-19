const fs = require('fs');
const path = require('path');

async function parseJsonResponse(res) {
  const text = await res.text();
  try {
    return JSON.parse(text || '{}');
  } catch {
    return { raw: text };
  }
}

async function transcribeWithVosk({ filePath, settings }) {
  const helperUrl = String(settings.vosk_helper_url || '').replace(/\/+$/, '');
  if (!helperUrl) throw new Error('Vosk helper URL is not configured');

  let res;
  try {
    res = await fetch(`${helperUrl}/transcribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_path: filePath,
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
    provider: 'vosk',
    model: data.model || settings.vosk_model,
  };
}

async function transcribeWithOpenAI({ filePath, settings, apiKey }) {
  if (!apiKey) throw new Error('OpenAI API key is not configured');
  const fileBuffer = await fs.promises.readFile(filePath);
  const formData = new FormData();
  formData.append('model', settings.openai_model);
  formData.append('language', settings.openai_language || 'ru');
  formData.append('file', new Blob([fileBuffer], { type: 'audio/wav' }), path.basename(filePath));

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
    provider: 'openai',
    model: settings.openai_model,
  };
}

async function transcribeWithGrok({ filePath, settings, grokApiKey }) {
  if (!grokApiKey) throw new Error('Grok API key is not configured');
  const fileBuffer = await fs.promises.readFile(filePath);
  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer], { type: 'audio/wav' }), path.basename(filePath));
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
  testProviderModel,
};
