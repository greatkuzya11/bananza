const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const testRoot = path.join(repoRoot, 'test');
const runtimeRoot = path.join(testRoot, '.runtime');
const fixturesRoot = path.join(testRoot, 'fixtures');

module.exports = {
  repoRoot,
  testRoot,
  runtimeRoot,
  fixturesRoot,
};
