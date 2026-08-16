const path = require('path');
const { spawn } = require('child_process');

const DEFAULT_HELPER_PATH = path.join(__dirname, 'vosk_helper.py');
const DEFAULT_MODELS_DIR = path.join(__dirname, 'models');
const DEFAULT_STARTUP_TIMEOUT_MS = 15_000;

let managedChild = null;
let managedHelperUrl = '';
let startupPromise = null;
let exitCleanupRegistered = false;

function localVoskHelperConfig(helperUrl) {
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

function isLocalVoskHelperUrl(helperUrl) {
  return Boolean(localVoskHelperConfig(helperUrl));
}

function interpreterCandidates() {
  if (process.platform === 'win32') {
    return [
      { command: 'python', prefixArgs: [] },
      { command: 'py', prefixArgs: ['-3'] },
    ];
  }
  return [
    { command: 'python3', prefixArgs: [] },
    { command: 'python', prefixArgs: [] },
  ];
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function helperIsHealthy(helperUrl, fetchImpl = globalThis.fetch) {
  try {
    const response = await fetchImpl(`${helperUrl}/health`, {
      signal: AbortSignal.timeout(750),
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data?.ok === true;
  } catch {
    return false;
  }
}

function appendDiagnostic(current, chunk) {
  const next = `${current}${String(chunk || '')}`;
  return next.length > 4000 ? next.slice(-4000) : next;
}

async function launchCandidate({
  candidate,
  config,
  helperPath,
  modelsDir,
  timeoutMs,
  fetchImpl,
}) {
  let stdout = '';
  let stderr = '';
  let spawnError = null;
  let exitCode = null;
  const args = [
    ...(candidate.prefixArgs || []),
    helperPath,
    '--host',
    config.hostname,
    '--port',
    String(config.port),
  ];
  const child = spawn(candidate.command, args, {
    cwd: path.dirname(path.dirname(helperPath)),
    env: {
      ...process.env,
      BANANZA_VOSK_MODELS_DIR: process.env.BANANZA_VOSK_MODELS_DIR || modelsDir,
    },
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
  child.once('exit', (code) => {
    exitCode = code;
  });

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await helperIsHealthy(config.helperUrl, fetchImpl)) {
      return { child, stdout, stderr };
    }
    if (spawnError || exitCode !== null) break;
    await delay(200);
  }

  if (!child.killed && exitCode === null) child.kill();
  const diagnostic = String(stderr || stdout || spawnError?.message || '').trim();
  const reason = spawnError
    ? spawnError.message
    : (exitCode !== null ? `exited with code ${exitCode}` : 'startup timed out');
  throw new Error(`${candidate.command}: ${reason}${diagnostic ? `; ${diagnostic}` : ''}`);
}

function rememberManagedChild(child, helperUrl) {
  managedChild = child;
  managedHelperUrl = helperUrl;
  child.once('exit', (code, signal) => {
    if (managedChild !== child) return;
    managedChild = null;
    managedHelperUrl = '';
    if (code !== 0 && code !== null) {
      console.warn('[voice] managed Vosk helper stopped:', { code, signal });
    }
  });
  child.unref();
  child.stdout?.unref?.();
  child.stderr?.unref?.();

  if (!exitCleanupRegistered) {
    exitCleanupRegistered = true;
    process.once('exit', () => {
      if (managedChild && !managedChild.killed) managedChild.kill();
    });
  }
}

async function ensureLocalVoskHelper(helperUrl, options = {}) {
  const config = localVoskHelperConfig(helperUrl);
  if (!config) return { managed: false, started: false };
  if (managedChild && managedHelperUrl === config.helperUrl && managedChild.exitCode === null) {
    return { managed: true, started: false };
  }
  if (await helperIsHealthy(config.helperUrl, options.fetchImpl)) {
    return { managed: false, started: false };
  }
  if (startupPromise) return startupPromise;

  startupPromise = (async () => {
    const helperPath = options.helperPath || DEFAULT_HELPER_PATH;
    const modelsDir = options.modelsDir || DEFAULT_MODELS_DIR;
    const candidates = options.candidates || interpreterCandidates();
    const timeoutMs = Math.max(1000, Number(options.timeoutMs || DEFAULT_STARTUP_TIMEOUT_MS));
    const failures = [];

    for (const candidate of candidates) {
      try {
        const launched = await launchCandidate({
          candidate,
          config,
          helperPath,
          modelsDir,
          timeoutMs,
          fetchImpl: options.fetchImpl,
        });
        rememberManagedChild(launched.child, config.helperUrl);
        console.info(`[voice] Vosk helper started on ${config.helperUrl}`);
        return { managed: true, started: true };
      } catch (error) {
        failures.push(error.message);
      }
    }

    throw new Error(
      `Could not start the bundled Vosk helper. `
      + `Install its Python dependency with "npm run vosk:install". ${failures.join(' | ')}`
    );
  })();

  try {
    return await startupPromise;
  } finally {
    startupPromise = null;
  }
}

async function stopManagedVoskHelper() {
  const child = managedChild;
  managedChild = null;
  managedHelperUrl = '';
  if (!child || child.exitCode !== null || child.killed) return;
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill();
  await Promise.race([exited, delay(1000)]);
  if (child.exitCode === null && !child.killed) child.kill('SIGKILL');
}

module.exports = {
  ensureLocalVoskHelper,
  isLocalVoskHelperUrl,
  localVoskHelperConfig,
  stopManagedVoskHelper,
};
