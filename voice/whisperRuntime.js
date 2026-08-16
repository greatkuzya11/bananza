const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const DEFAULT_MODELS_DIR = path.join(__dirname, 'models');
const DEFAULT_STARTUP_TIMEOUT_MS = 120_000;

let managedChild = null;
let managedHelperUrl = '';
let startupPromise = null;
let exitCleanupRegistered = false;

function localWhisperHelperConfig(helperUrl) {
  try {
    const url = new URL(String(helperUrl || ''));
    const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
    if (url.protocol !== 'http:') return null;
    if (!['127.0.0.1', 'localhost', '::1'].includes(hostname)) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.pathname && url.pathname !== '/') return null;
    return {
      helperUrl: `${url.protocol}//${url.host}`,
      hostname,
      port: Number(url.port || 80),
    };
  } catch {
    return null;
  }
}

function isLocalWhisperHelperUrl(helperUrl) {
  return Boolean(localWhisperHelperConfig(helperUrl));
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function childIsRunning(child) {
  return Boolean(child && child.exitCode === null && child.signalCode === null);
}

async function terminateChild(child, timeoutMs = 1000) {
  if (!childIsRunning(child)) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill();
  await Promise.race([exited, delay(timeoutMs)]);
  if (!childIsRunning(child)) return;
  child.kill('SIGKILL');
  await Promise.race([exited, delay(timeoutMs)]);
}

async function helperIsHealthy(helperUrl, fetchImpl = globalThis.fetch) {
  try {
    const response = await fetchImpl(`${helperUrl}/health`, {
      signal: AbortSignal.timeout(1000),
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data?.status === 'ok';
  } catch {
    return false;
  }
}

function serverCandidates(options = {}) {
  const configured = String(options.serverBin || process.env.BANANZA_WHISPER_SERVER_BIN || '').trim();
  const candidates = [];
  if (configured) candidates.push(configured);
  const platformRuntimeDir = path.join(__dirname, 'whisper-runtime', `${process.platform}-${process.arch}`);
  candidates.push(
    path.join(platformRuntimeDir, 'Release', 'whisper-server.exe'),
    path.join(platformRuntimeDir, 'build', 'bin', 'whisper-server'),
    path.join(__dirname, 'whisper.cpp', 'build', 'bin', 'Release', 'whisper-server.exe'),
    path.join(__dirname, 'whisper.cpp', 'build', 'bin', 'whisper-server.exe'),
    path.join(__dirname, 'whisper.cpp', 'build', 'bin', 'whisper-server')
  );
  candidates.push(process.platform === 'win32' ? 'whisper-server.exe' : 'whisper-server');
  return [...new Set(candidates.filter(Boolean))];
}

function isPathCandidate(command) {
  return path.isAbsolute(command) || command.includes('/') || command.includes('\\');
}

function appendDiagnostic(current, chunk) {
  const next = `${current}${String(chunk || '')}`;
  return next.length > 4000 ? next.slice(-4000) : next;
}

async function launchCandidate({ command, config, settings, timeoutMs, fetchImpl }) {
  if (isPathCandidate(command) && !fs.existsSync(command)) {
    throw new Error(`${command}: file not found`);
  }
  const modelsDir = String(settings.whisper_models_dir || process.env.BANANZA_WHISPER_MODELS_DIR || DEFAULT_MODELS_DIR).trim();
  const modelName = String(settings.whisper_model || 'ggml-tiny.bin').trim();
  const modelPath = path.join(modelsDir, modelName);
  if (!fs.existsSync(modelPath) || !fs.statSync(modelPath).isFile()) {
    throw new Error(`Whisper model not found: ${modelPath}`);
  }

  let stdout = '';
  let stderr = '';
  let spawnError = null;
  let exitCode = null;
  let exitSignal = null;
  let hasExited = false;
  const child = spawn(command, [
    '--host', config.hostname,
    '--port', String(config.port),
    '--threads', String(Math.max(1, Number(process.env.BANANZA_WHISPER_THREADS || 1))),
    '--processors', '1',
    '--language', String(settings.whisper_language || 'ru'),
    '--model', modelName,
    '--no-gpu',
    '--no-language-probabilities',
  ], {
    cwd: modelsDir,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  child.stdout.on('data', (chunk) => {
    stdout = appendDiagnostic(stdout, chunk);
  });
  child.stderr.on('data', (chunk) => {
    stderr = appendDiagnostic(stderr, chunk);
  });
  child.once('error', (error) => {
    spawnError = error;
  });
  child.once('exit', (code, signal) => {
    exitCode = code;
    exitSignal = signal;
    hasExited = true;
  });

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await helperIsHealthy(config.helperUrl, fetchImpl)) return child;
    if (spawnError || hasExited) break;
    await delay(250);
  }

  const exitedBeforeTermination = hasExited;
  await terminateChild(child);
  const diagnostic = String(stderr || stdout || spawnError?.message || '').trim();
  const reason = spawnError
    ? spawnError.message
    : (exitedBeforeTermination ? `exited with ${exitSignal || `code ${exitCode}`}` : 'startup timed out');
  throw new Error(`${command}: ${reason}${diagnostic ? `; ${diagnostic}` : ''}`);
}

function rememberManagedChild(child, helperUrl) {
  managedChild = child;
  managedHelperUrl = helperUrl;
  child.once('exit', (code, signal) => {
    if (managedChild !== child) return;
    managedChild = null;
    managedHelperUrl = '';
    if (code !== 0 && code !== null) {
      console.warn('[voice] managed Whisper helper stopped:', { code, signal });
    }
  });
  child.unref();
  child.stdout?.unref?.();
  child.stderr?.unref?.();

  if (!exitCleanupRegistered) {
    exitCleanupRegistered = true;
    process.once('exit', () => {
      if (childIsRunning(managedChild)) managedChild.kill('SIGKILL');
    });
  }
}

async function ensureLocalWhisperHelper(helperUrl, settings = {}, options = {}) {
  const config = localWhisperHelperConfig(helperUrl);
  if (!config) return { managed: false, started: false };
  if (managedChild && managedHelperUrl === config.helperUrl && childIsRunning(managedChild)) {
    return { managed: true, started: false };
  }
  if (await helperIsHealthy(config.helperUrl, options.fetchImpl)) {
    return { managed: false, started: false };
  }
  if (startupPromise) return startupPromise;

  startupPromise = (async () => {
    const failures = [];
    for (const command of serverCandidates(options)) {
      try {
        const child = await launchCandidate({
          command,
          config,
          settings,
          timeoutMs: Math.max(1000, Number(options.timeoutMs || DEFAULT_STARTUP_TIMEOUT_MS)),
          fetchImpl: options.fetchImpl,
        });
        rememberManagedChild(child, config.helperUrl);
        console.info(`[voice] Whisper helper started on ${config.helperUrl}`);
        return { managed: true, started: true };
      } catch (error) {
        failures.push(error.message);
      }
    }
    throw new Error(
      `Could not start whisper-server. Build whisper.cpp and set BANANZA_WHISPER_SERVER_BIN. ${failures.join(' | ')}`
    );
  })();

  try {
    return await startupPromise;
  } finally {
    startupPromise = null;
  }
}

async function stopManagedWhisperHelper() {
  const child = managedChild;
  managedChild = null;
  managedHelperUrl = '';
  await terminateChild(child);
}

module.exports = {
  ensureLocalWhisperHelper,
  helperIsHealthy,
  isLocalWhisperHelperUrl,
  localWhisperHelperConfig,
  stopManagedWhisperHelper,
};
