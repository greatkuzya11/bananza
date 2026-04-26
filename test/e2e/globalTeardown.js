const { stopSandbox } = require('../support/runtimeSandbox');
const { clearContext, readContext } = require('./context');

module.exports = async function globalTeardown() {
  try {
    const sandbox = readContext();
    await stopSandbox(sandbox);
  } finally {
    clearContext();
  }
};
