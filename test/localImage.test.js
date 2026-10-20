const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { generateImage, editImage, testConnection, cleanBaseUrl, cleanSize, TURBO_SIGMAS } = require('../ai/localImage');

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6VZ0AAAAASUVORK5CYII=';

async function serve(t, handler) {
  const server = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    res.setHeader('Content-Type', 'application/json');
    try { res.end(JSON.stringify(await handler(req.url, raw ? JSON.parse(raw) : null, req))); }
    catch (error) { res.statusCode = 500; res.end(JSON.stringify({ error: { message: error.message } })); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.closeAllConnections(); server.close(resolve); }));
  return `http://127.0.0.1:${server.address().port}`;
}

test('local image generation polls queued jobs and sends the Turbo schedule', async (t) => {
  let polls = 0;
  let submitted;
  const baseUrl = await serve(t, (url, body) => {
    if (url === '/sdcpp/v1/img_gen') { submitted = body; return { id: 'test-job' }; }
    if (++polls === 1) return { status: 'queued' };
    return { status: 'completed', result: { images: [{ b64_json: PNG }] } };
  });
  const result = await generateImage({ baseUrl, prompt: 'a banana', size: '768x1024', pollIntervalMs: 1 });
  assert.equal(result.b64Json, PNG);
  assert.equal(submitted.width, 768);
  assert.equal(submitted.height, 1024);
  assert.equal(submitted.batch_count, 1);
  assert.equal(submitted.ref_images, undefined);
  assert.deepEqual(submitted.sample_params.custom_sigmas, TURBO_SIGMAS);
  assert.equal(submitted.sample_params.sample_steps, 8);
  assert.equal(submitted.sample_params.guidance.txt_cfg, 1);
  assert.equal(polls, 2);
});

test('local image timeout cancels the job on the image server', async (t) => {
  let cancelled = false;
  const baseUrl = await serve(t, (url) => {
    if (url.endsWith('/cancel')) { cancelled = true; return {}; }
    if (url.endsWith('/img_gen')) return { id: 'timeout-job' };
    return { status: 'generating' };
  });
  await assert.rejects(generateImage({ baseUrl, prompt: 'a banana', timeoutMs: 150, pollIntervalMs: 10 }), /timed out/);
  assert.equal(cancelled, true);
});

test('local image caller cancellation propagates to the server', async (t) => {
  const controller = new AbortController();
  let cancelled = false;
  const baseUrl = await serve(t, (url) => {
    if (url.endsWith('/cancel')) { cancelled = true; return {}; }
    if (url.endsWith('/img_gen')) return { id: 'cancel-job' };
    controller.abort();
    return { status: 'queued' };
  });
  await assert.rejects(generateImage({ baseUrl, prompt: 'a banana', signal: controller.signal, pollIntervalMs: 1 }), /cancelled/);
  assert.equal(cancelled, true);
});

test('local image errors and missing PNGs do not become successful results', async (t) => {
  for (const state of [
    { status: 'failed', error: { message: 'Out of memory' } },
    { status: 'completed', result: { images: [{ b64_json: Buffer.from('not a PNG').toString('base64') }] } },
    { status: 'completed', result: { images: [] } },
  ]) {
    const baseUrl = await serve(t, (url) => url.endsWith('/img_gen') ? { id: 'bad-job' } : (url.endsWith('/cancel') ? {} : state));
    await assert.rejects(generateImage({ baseUrl, prompt: 'a banana', pollIntervalMs: 1 }), /Out of memory|valid PNG|Invalid image/);
  }
});

test('connection probing requires an image generation endpoint', async (t) => {
  const baseUrl = await serve(t, () => ({ supported_modes: ['img_gen'], model: { name: 'Qwen Image' } }));
  assert.equal((await testConnection({ baseUrl })).model, 'Qwen Image');
  const wrongServer = await serve(t, () => ({ supported_modes: ['vid_gen'] }));
  await assert.rejects(testConnection({ baseUrl: wrongServer }), /does not support/);
});

test('local image URL and size validation reject unsafe input', () => {
  assert.equal(cleanBaseUrl('http://127.0.0.1:1234/'), 'http://127.0.0.1:1234');
  for (const url of ['file:///etc/passwd', 'https://user:password@localhost', 'http://localhost/?token=abc']) {
    assert.throws(() => cleanBaseUrl(url));
  }
  assert.equal(cleanSize('100000x100000'), '1024x1024');
});


test('local image editing supplies the original image as a native reference', async (t) => {
  let submitted;
  const baseUrl = await serve(t, (url, body) => {
    if (url.endsWith('/img_gen')) { submitted = body; return { id: 'edit-job' }; }
    return { status: 'completed', result: { images: [{ b64_json: PNG }] } };
  });
  const result = await editImage({ baseUrl, prompt: 'Make the cup green', imageBuffer: Buffer.from(PNG, 'base64'), imageMimeType: 'image/png', size: '1024x768' });
  assert.equal(result.b64Json, PNG);
  assert.deepEqual(submitted.ref_images, [`data:image/png;base64,${PNG}`]);
  assert.equal(submitted.prompt, 'Make the cup green');
  assert.equal(submitted.width, 1024);
  assert.equal(submitted.height, 768);
  assert.equal(submitted.init_image, undefined);
});

test('local image editing rejects missing, oversized and unsupported inputs before contacting the server', async () => {
  const options = { baseUrl: 'http://127.0.0.1:1', prompt: 'Edit this' };
  await assert.rejects(editImage(options), /image is required/);
  await assert.rejects(editImage({ ...options, imageBuffer: Buffer.alloc(16 * 1024 * 1024 + 1), imageMimeType: 'image/png' }), /at most 16 MB/);
  await assert.rejects(editImage({ ...options, imageBuffer: Buffer.from('<svg/>'), imageMimeType: 'image/svg+xml' }), /PNG, JPEG and WebP/);
  await assert.rejects(editImage({ ...options, imageBuffer: Buffer.from('fake PNG'), imageMimeType: 'image/png' }), /PNG, JPEG and WebP/);
});
