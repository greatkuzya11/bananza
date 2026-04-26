const { createSandbox } = require('../support/runtimeSandbox');
const { createSession, makeUser } = require('../support/api');
const { writeContext } = require('./context');

module.exports = async function globalSetup() {
  const sandbox = await createSandbox({ name: 'playwright' });
  const adminUser = makeUser('pwadmin');
  const bobUser = makeUser('pwbob');
  const adminSession = createSession(sandbox.baseUrl);
  const bobSession = createSession(sandbox.baseUrl);
  await adminSession.register(adminUser);
  await bobSession.register(bobUser);
  writeContext({
    ...sandbox,
    adminUser,
    adminUserId: adminSession.user.id,
    bobUser,
    bobUserId: bobSession.user.id,
  });
};
