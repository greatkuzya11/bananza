const { test, expect } = require('./fixtures');
const { createApiSession, getContext } = require('./helpers');

// Both tests use the same account and sandbox. Each must get its own quota,
// while browser requests and API helpers within one test must share that quota.
for (const client of ['first', 'second']) {
  test(`${client} test client has an isolated, enforced upload limit`, async ({ page }) => {
    const session = createApiSession();
    await session.login(getContext().bobUser);
    const clone = session.clone();
    for (let index = 0; index < 20; index++) {
      if (index % 2 === 0) {
        const response = await page.request.post(`${getContext().baseUrl}/api/upload`, {
          headers: { Authorization: `Bearer ${session.token}` },
        });
        // Missing files still pass through the real upload limiter, without
        // creating 20 unnecessary files just to exercise its quota.
        expect(response.status()).toBe(400);
        expect(await response.json()).toEqual({ error: 'No file' });
      } else {
        const response = await clone.request('/api/upload', { method: 'POST', expectedStatus: 400 });
        expect(response.data).toEqual({ error: 'No file' });
      }
    }
    const blocked = await session.request('/api/upload', { method: 'POST', expectedStatus: 429 });
    expect(blocked.data).toEqual({ error: 'Too many uploads' });
  });
}
