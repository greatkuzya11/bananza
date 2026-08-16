const test = require('node:test');
const assert = require('node:assert/strict');

const {
  bundledFfmpegPath,
  resolveFfmpegCommand,
  checkFfmpeg,
} = require('../../voice/ffmpeg');

test('FFmpeg resolver prefers explicit configuration, then bundled binary, then PATH', () => {
  assert.equal(resolveFfmpegCommand({
    configuredPath: 'C:\\tools\\ffmpeg.exe',
    bundledPath: 'C:\\project\\ffmpeg.exe',
  }), 'C:\\tools\\ffmpeg.exe');
  assert.equal(resolveFfmpegCommand({ configuredPath: '', bundledPath: '/project/ffmpeg' }), '/project/ffmpeg');
  assert.equal(resolveFfmpegCommand({ configuredPath: '', bundledPath: '' }), 'ffmpeg');
  assert.equal(bundledFfmpegPath(() => '/node_modules/ffmpeg-static/ffmpeg'), '/node_modules/ffmpeg-static/ffmpeg');
  assert.equal(bundledFfmpegPath(() => { throw new Error('optional dependency missing'); }), '');
});

test('FFmpeg readiness probes the resolved executable', () => {
  const calls = [];
  const ready = checkFfmpeg({
    configuredPath: '',
    bundledPath: '',
    cache: false,
    spawnSyncImpl(command, args, options) {
      calls.push({ command, args, options });
      return { status: 0, error: null };
    },
  });
  assert.equal(ready.available, true);
  assert.equal(ready.command, 'ffmpeg');
  assert.deepEqual(calls[0].args, ['-version']);

  const missing = checkFfmpeg({
    configuredPath: '',
    bundledPath: '',
    cache: false,
    spawnSyncImpl: () => ({ status: null, error: Object.assign(new Error('missing'), { code: 'ENOENT' }) }),
  });
  assert.equal(missing.available, false);
});
