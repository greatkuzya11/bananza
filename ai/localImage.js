const { setTimeout: delay } = require('node:timers/promises');

const DEFAULT_BASE_URL = 'http://127.0.0.1:1234';
const DEFAULT_MODEL = 'Qwen-Image-2.1-Turbo-Q8_0.gguf';
const SIZES = ['512x512', '768x768', '1024x1024', '768x1024', '1024x768'];
const TURBO_SIGMAS = [1, 0.978453, 0.95418, 0.926626, 0.89508, 0.845148, 0.704534, 0.414568, 0];

function cleanBaseUrl(value = DEFAULT_BASE_URL) {
  const url = new URL(String(value || DEFAULT_BASE_URL).trim());
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('Invalid local image server URL');
  }
  return url.href.replace(/\/+$/, '');
}

function cleanSize(value, fallback = '1024x1024') {
  return SIZES.includes(value) ? value : (SIZES.includes(fallback) ? fallback : '1024x1024');
}

async function request(baseUrl, path, { body, signal } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    redirect: 'error',
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error?.message || (typeof payload.error === 'string' && payload.error) || `Image server HTTP ${response.status}`);
  }
  return payload;
}

async function testConnection({ baseUrl = DEFAULT_BASE_URL, signal } = {}) {
  const capabilities = await request(cleanBaseUrl(baseUrl), '/sdcpp/v1/capabilities', {
    signal: signal || AbortSignal.timeout(10000),
  });
  if (!capabilities.supported_modes?.includes('img_gen')) throw new Error('Server does not support image generation');
  return { model: capabilities.model?.name || DEFAULT_MODEL, sizes: [...SIZES] };
}

async function runImageJob({ refImages, baseUrl = DEFAULT_BASE_URL, model = DEFAULT_MODEL, prompt, size, timeoutMs = 600000, signal, pollIntervalMs = 1000 } = {}) {
  const text = String(prompt || '').trim();
  if (!text || text.length > 8000) throw new Error('Image prompt must contain 1–8000 characters');
  const server = cleanBaseUrl(baseUrl);
  const budget = Math.max(1, Math.min(1800000, Number(timeoutMs) || 600000));
  const deadline = AbortSignal.timeout(budget);
  const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
  const [width, height] = cleanSize(size).split('x').map(Number);
  let jobPath;
  try {
    const queued = await request(server, '/sdcpp/v1/img_gen', {
      signal: combined,
      body: {
        prompt: text, width, height, batch_count: 1, seed: -1, output_format: 'png',
        ...(refImages ? { ref_images: refImages } : {}),
        sample_params: { sample_steps: 8, sample_method: 'euler', custom_sigmas: TURBO_SIGMAS, guidance: { txt_cfg: 1 } },
      },
    });
    if (typeof queued.id !== 'string' || !queued.id) throw new Error('Image server returned no job ID');
    jobPath = `/sdcpp/v1/jobs/${encodeURIComponent(queued.id)}`;
    while (true) {
      const job = await request(server, jobPath, { signal: combined });
      if (job.status === 'completed') {
        const b64Json = job.result?.images?.[0]?.b64_json;
        if (typeof b64Json !== 'string' || b64Json.length > 48 * 1024 * 1024) throw new Error('Invalid image server result');
        const bytes = Buffer.from(b64Json, 'base64');
        if (bytes.length < 24 || !bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
          throw new Error('Image server returned no valid PNG');
        }
        return { model, revisedPrompt: '', b64Json, url: '' };
      }
      if (!['queued', 'generating'].includes(job.status)) {
        throw new Error(job.error?.message || `Image generation ${job.status || 'failed'}`);
      }
      await delay(pollIntervalMs, undefined, { signal: combined });
    }
  } catch (error) {
    if (jobPath) {
      try {
        await request(server, `${jobPath}/cancel`, { body: {}, signal: AbortSignal.timeout(3000) });
      } catch {}
    }
    if (deadline.aborted) throw new Error('Local image generation timed out');
    if (signal?.aborted) throw new Error('Local image generation cancelled');
    throw error;
  }
}

function generateImage(options) {
  return runImageJob(options);
}

async function editImage({ imageBuffer, imageMimeType, ...options } = {}) {
  if (!Buffer.isBuffer(imageBuffer) || !imageBuffer.length) throw new Error('An image is required for editing');
  if (imageBuffer.length > 16 * 1024 * 1024) throw new Error('Image for editing must be at most 16 MB');
  const mime = String(imageMimeType || '').split(';')[0].trim().toLowerCase();
  const valid = (mime === 'image/png' && imageBuffer.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')))
    || (mime === 'image/jpeg' && imageBuffer.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')))
    || (mime === 'image/webp' && imageBuffer.toString('ascii', 0, 4) === 'RIFF' && imageBuffer.toString('ascii', 8, 12) === 'WEBP');
  if (!valid) throw new Error('Image editing supports PNG, JPEG and WebP');
  return runImageJob({ ...options, refImages: [`data:${mime};base64,${imageBuffer.toString('base64')}`] });
}

module.exports = { DEFAULT_BASE_URL, DEFAULT_MODEL, SIZES, TURBO_SIGMAS, cleanBaseUrl, cleanSize, testConnection, generateImage, editImage };
