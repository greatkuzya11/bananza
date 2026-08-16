const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CHECK_TTL_MS = 30_000;
let cachedCheck = null;

function bundledFfmpegPath(loader = () => require('ffmpeg-static')) {
  try {
    return String(loader() || '').trim();
  } catch {
    return '';
  }
}

function resolveFfmpegCommand(options = {}) {
  const configured = String(
    options.configuredPath === undefined
      ? process.env.BANANZA_FFMPEG_PATH || ''
      : options.configuredPath || ''
  ).trim();
  if (configured) return configured;

  const bundled = options.bundledPath === undefined
    ? bundledFfmpegPath(options.bundledLoader)
    : String(options.bundledPath || '').trim();
  return bundled || 'ffmpeg';
}

function isPathCommand(command) {
  return path.isAbsolute(command) || command.includes('/') || command.includes('\\');
}

function checkFfmpeg(options = {}) {
  const command = resolveFfmpegCommand(options);
  const now = Date.now();
  const useCache = !options.spawnSyncImpl && options.cache !== false;
  if (useCache && cachedCheck?.command === command && now - cachedCheck.checkedAt < CHECK_TTL_MS) {
    return cachedCheck.result;
  }

  let result;
  if (isPathCommand(command) && (!fs.existsSync(command) || !fs.statSync(command).isFile())) {
    result = { available: false, command };
  } else {
    const probe = (options.spawnSyncImpl || spawnSync)(command, ['-version'], {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 5000,
    });
    result = {
      available: !probe.error && probe.status === 0,
      command,
    };
  }

  if (useCache) cachedCheck = { command, checkedAt: now, result };
  return result;
}

function isFfmpegAvailable(options = {}) {
  return checkFfmpeg(options).available;
}

module.exports = {
  bundledFfmpegPath,
  resolveFfmpegCommand,
  checkFfmpeg,
  isFfmpegAvailable,
};
