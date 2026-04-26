const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn, spawnSync } = require('child_process');
const { repoRoot, runtimeRoot } = require('./paths');

const ROOT_FILES = [
  'package.json',
  'package-lock.json',
  'server.js',
  'db.js',
  'forwarding.js',
  'linkPreview.js',
  'messageActions.js',
  'messageCopy.js',
  'polls.js',
  'push.js',
  'soundSettings.js',
  'weather.js',
  'websocket.js',
];

const ROOT_DIRS = [
  'ai',
  'public',
  'videoNotes',
  'voice',
  'uploads',
];

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function runId(prefix = 'sandbox') {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function shouldSkipRelative(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/');
  return (
    normalized.startsWith('voice/models/')
    || normalized.startsWith('test/')
    || normalized.startsWith('.git/')
    || normalized.startsWith('node_modules/')
    || normalized.startsWith('uploads/')
    || normalized === 'bananza.db'
    || normalized === 'bananza.db-shm'
    || normalized === 'bananza.db-wal'
    || normalized === '.secret'
    || normalized === '.vapid.json'
  );
}

function copyIntoSandbox(sourcePath, destinationPath) {
  const relativePath = path.relative(repoRoot, sourcePath);
  if (shouldSkipRelative(relativePath)) return;

  const stats = fs.statSync(sourcePath);
  if (stats.isDirectory()) {
    ensureDir(destinationPath);
    const entries = fs.readdirSync(sourcePath);
    entries.forEach((entry) => {
      copyIntoSandbox(path.join(sourcePath, entry), path.join(destinationPath, entry));
    });
    return;
  }

  ensureDir(path.dirname(destinationPath));
  fs.copyFileSync(sourcePath, destinationPath);
}

function mirrorApplication(appDir) {
  ensureDir(appDir);
  ROOT_FILES.forEach((relativePath) => {
    copyIntoSandbox(path.join(repoRoot, relativePath), path.join(appDir, relativePath));
  });
  ROOT_DIRS.forEach((relativePath) => {
    copyIntoSandbox(path.join(repoRoot, relativePath), path.join(appDir, relativePath));
  });
  ensureDir(path.join(appDir, 'uploads'));
  const gitkeepPath = path.join(appDir, 'uploads', '.gitkeep');
  if (!fs.existsSync(gitkeepPath)) {
    fs.writeFileSync(gitkeepPath, '');
  }
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForServer(baseUrl, timeoutMs = 20_000) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/login.html`);
      if (response.ok) return;
      lastError = new Error(`Unexpected HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw lastError || new Error(`Sandbox server did not start for ${baseUrl}`);
}

function buildNodeOptions(requirePath) {
  const existing = String(process.env.NODE_OPTIONS || '').trim();
  const normalizedRequirePath = requirePath.replace(/\\/g, '/');
  const required = `--require=${normalizedRequirePath}`;
  return existing ? `${existing} ${required}` : required;
}

async function stopSandbox({ pid, rootDir } = {}) {
  const processId = Number(pid || 0);
  if (processId > 0) {
    try {
      process.kill(processId);
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
    try {
      process.kill(processId, 0);
      spawnSync('taskkill', ['/pid', String(processId), '/t', '/f'], { stdio: 'ignore' });
    } catch {}
  }

  if (process.env.BANANZA_KEEP_TEST_RUNTIME === '1') return;
  if (rootDir) {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
}

async function createSandbox({ name = 'sandbox', enableMocks = true } = {}) {
  ensureDir(runtimeRoot);
  const id = runId(name);
  const rootDir = path.join(runtimeRoot, id);
  const appDir = path.join(rootDir, 'app');
  ensureDir(rootDir);
  mirrorApplication(appDir);

  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const preloadPath = path.join(repoRoot, 'test', 'support', 'preload-mocks.js');
  const stdoutPath = path.join(rootDir, 'server.stdout.log');
  const stderrPath = path.join(rootDir, 'server.stderr.log');
  const stdoutFd = fs.openSync(stdoutPath, 'w');
  const stderrFd = fs.openSync(stderrPath, 'w');

  const child = spawn(process.execPath, ['server.js'], {
    cwd: appDir,
    env: {
      ...process.env,
      PORT: String(port),
      BANANZA_TEST_MOCKS: enableMocks ? '1' : '0',
      NODE_OPTIONS: enableMocks ? buildNodeOptions(preloadPath) : process.env.NODE_OPTIONS,
    },
    stdio: ['ignore', stdoutFd, stderrFd],
  });

  child.once('exit', (code) => {
    fs.appendFileSync(stderrPath, `\n[process-exit] code=${code}\n`);
  });

  try {
    await waitForServer(baseUrl);
  } catch (error) {
    try {
      child.kill();
    } catch {}
    throw error;
  } finally {
    fs.closeSync(stdoutFd);
    fs.closeSync(stderrFd);
  }

  const sandboxInfo = {
    id,
    rootDir,
    appDir,
    baseUrl,
    port,
    pid: child.pid,
    stdoutPath,
    stderrPath,
  };

  async function stop() {
    await stopSandbox(sandboxInfo);
  }

  return {
    ...sandboxInfo,
    stop,
  };
}

module.exports = {
  createSandbox,
  stopSandbox,
};
