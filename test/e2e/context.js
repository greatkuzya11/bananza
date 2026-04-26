const fs = require('fs');
const path = require('path');
const { runtimeRoot } = require('../support/paths');

const contextFile = path.join(runtimeRoot, 'playwright-context.json');

function writeContext(data) {
  fs.mkdirSync(runtimeRoot, { recursive: true });
  fs.writeFileSync(contextFile, JSON.stringify(data, null, 2));
}

function readContext() {
  return JSON.parse(fs.readFileSync(contextFile, 'utf8'));
}

function clearContext() {
  fs.rmSync(contextFile, { force: true });
}

module.exports = {
  clearContext,
  contextFile,
  readContext,
  writeContext,
};
