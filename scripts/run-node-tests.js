const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const testRoot = path.join(repoRoot, 'test');
const excludedSegments = new Set(['.runtime', 'e2e', 'fixtures', 'support']);

function collectTests(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (excludedSegments.has(entry.name)) continue;
      files.push(...collectTests(absolutePath));
      continue;
    }

    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.test.js')) continue;
    files.push(absolutePath);
  }

  return files;
}

const testFiles = collectTests(testRoot)
  .sort((left, right) => left.localeCompare(right));

if (testFiles.length === 0) {
  console.error('No node:test files were found.');
  process.exit(1);
}

const child = spawn(process.execPath, ['--test', ...testFiles], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
