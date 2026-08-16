const path = require('path');
const { spawnSync } = require('child_process');

const SUPPORTED_MODELS = new Set(['tiny', 'tiny-q5', 'base', 'base-q5', 'all']);

function normalizeModel(value = 'all') {
  const model = String(value || 'all').trim().toLowerCase();
  if (!SUPPORTED_MODELS.has(model)) {
    throw new Error(`Unsupported Whisper model selection: ${model}`);
  }
  return model;
}

function resolveWhisperCommand(action, options = {}) {
  const platform = options.platform || process.platform;
  const arch = options.arch || process.arch;
  const scriptDir = options.scriptDir || __dirname;
  const model = normalizeModel(options.model);
  if (!['install', 'start'].includes(action)) {
    throw new Error(`Unsupported Whisper action: ${action}`);
  }

  if (platform === 'win32') {
    if (arch !== 'x64') {
      throw new Error(`Windows Whisper installer currently supports x64 only (detected ${arch})`);
    }
    const scriptName = action === 'install' ? 'install_whisper.ps1' : 'start_whisper_helper.ps1';
    const args = [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      path.join(scriptDir, scriptName),
    ];
    if (action === 'install') args.push('-Model', model);
    return { command: 'powershell.exe', args };
  }

  if (platform === 'linux' || platform === 'darwin') {
    const scriptName = action === 'install' ? 'install_whisper.sh' : 'start_whisper_helper.sh';
    const args = [path.join(scriptDir, scriptName)];
    if (action === 'install') args.push(model);
    return { command: 'bash', args };
  }

  throw new Error(`Whisper helper is not supported on platform ${platform}`);
}

function runWhisperCli(argv = process.argv.slice(2)) {
  const action = String(argv[0] || '').trim().toLowerCase();
  const model = argv[1] || 'all';
  const resolved = resolveWhisperCommand(action, { model });
  const result = spawnSync(resolved.command, resolved.args, {
    cwd: path.resolve(__dirname, '..'),
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  return Number(result.status || 0);
}

if (require.main === module) {
  try {
    process.exitCode = runWhisperCli();
  } catch (error) {
    console.error(error.message || error);
    process.exitCode = 1;
  }
}

module.exports = {
  normalizeModel,
  resolveWhisperCommand,
  runWhisperCli,
};
