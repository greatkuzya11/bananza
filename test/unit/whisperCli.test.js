const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const {
  normalizeModel,
  resolveWhisperCommand,
} = require('../../voice/whisperCli');

test('Whisper CLI normalizes supported model selections', () => {
  assert.equal(normalizeModel(), 'all');
  assert.equal(normalizeModel('TINY-Q5'), 'tiny-q5');
  assert.equal(normalizeModel('base-q5'), 'base-q5');
  assert.throws(() => normalizeModel('../../bad'), /Unsupported Whisper model selection/);
});

test('Whisper CLI dispatches install and start commands per platform', () => {
  const scriptDir = path.join('repo', 'voice');
  const windowsInstall = resolveWhisperCommand('install', {
    platform: 'win32',
    arch: 'x64',
    scriptDir,
    model: 'tiny-q5',
  });
  assert.equal(windowsInstall.command, 'powershell.exe');
  assert.ok(windowsInstall.args.some((arg) => String(arg).endsWith('install_whisper.ps1')));
  assert.deepEqual(windowsInstall.args.slice(-2), ['-Model', 'tiny-q5']);

  const linuxInstall = resolveWhisperCommand('install', {
    platform: 'linux',
    arch: 'x64',
    scriptDir,
    model: 'tiny',
  });
  assert.equal(linuxInstall.command, 'bash');
  assert.ok(String(linuxInstall.args[0]).endsWith('install_whisper.sh'));
  assert.equal(linuxInstall.args[1], 'tiny');

  const macStart = resolveWhisperCommand('start', {
    platform: 'darwin',
    arch: 'arm64',
    scriptDir,
  });
  assert.equal(macStart.command, 'bash');
  assert.ok(String(macStart.args[0]).endsWith('start_whisper_helper.sh'));
  assert.equal(macStart.args.length, 1);
});

test('Whisper CLI rejects unsupported platforms and Windows ARM', () => {
  assert.throws(() => resolveWhisperCommand('install', {
    platform: 'win32',
    arch: 'arm64',
  }), /supports x64 only/);
  assert.throws(() => resolveWhisperCommand('install', {
    platform: 'freebsd',
    arch: 'x64',
  }), /not supported/);
});
