const test = require('node:test');
const assert = require('node:assert/strict');

const {
  helperIsHealthy,
  isLocalWhisperHelperUrl,
  localWhisperHelperConfig,
} = require('../../voice/whisperRuntime');

test('Whisper runtime only manages loopback HTTP helper URLs', () => {
  assert.equal(isLocalWhisperHelperUrl('http://127.0.0.1:2701'), true);
  assert.equal(isLocalWhisperHelperUrl('http://localhost:2701/'), true);
  assert.equal(isLocalWhisperHelperUrl('http://[::1]:2701'), true);
  assert.equal(isLocalWhisperHelperUrl('https://127.0.0.1:2701'), false);
  assert.equal(isLocalWhisperHelperUrl('http://whisper.example.test:2701'), false);
  assert.equal(isLocalWhisperHelperUrl('http://127.0.0.1:2701/inference'), false);
  assert.deepEqual(localWhisperHelperConfig('http://127.0.0.1:2701'), {
    helperUrl: 'http://127.0.0.1:2701',
    hostname: '127.0.0.1',
    port: 2701,
  });
});

test('Whisper runtime health check accepts only ready whisper-server response', async () => {
  assert.equal(await helperIsHealthy('http://127.0.0.1:2701', async () => new Response(
    JSON.stringify({ status: 'ok' }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  )), true);
  assert.equal(await helperIsHealthy('http://127.0.0.1:2701', async () => new Response(
    JSON.stringify({ status: 'loading model' }),
    { status: 503, headers: { 'content-type': 'application/json' } }
  )), false);
});
