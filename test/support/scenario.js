const { createSession, makeUser } = require('./api');

async function createBasicChatScenario(baseUrl) {
  const admin = createSession(baseUrl);
  const bob = createSession(baseUrl);
  const carol = createSession(baseUrl);

  const adminUser = makeUser('admin');
  const bobUser = makeUser('bob');
  const carolUser = makeUser('carol');

  await admin.register(adminUser);
  await bob.register(bobUser);
  await carol.register(carolUser);

  const { data: groupChat } = await admin.request('/api/chats', {
    method: 'POST',
    json: {
      name: `Group ${Date.now()}`,
      type: 'group',
      memberIds: [bob.user.id, carol.user.id],
    },
  });

  const { data: privateChat } = await admin.request('/api/chats/private', {
    method: 'POST',
    json: {
      targetUserId: bob.user.id,
    },
  });

  return {
    admin,
    bob,
    carol,
    groupChat,
    privateChat,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(assertion, { timeoutMs = 10_000, intervalMs = 100 } = {}) {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < timeoutMs) {
    try {
      return await assertion();
    } catch (error) {
      lastError = error;
      await sleep(intervalMs);
    }
  }
  throw lastError || new Error('waitFor timed out');
}

module.exports = {
  createBasicChatScenario,
  sleep,
  waitFor,
};
