const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Database = require('better-sqlite3');
const { before, after } = require('node:test');

const { createSandbox } = require('../support/runtimeSandbox');
const { createBasicChatScenario } = require('../support/scenario');

let sandbox;
let scenario;

before(async () => {
  sandbox = await createSandbox({ name: 'maps-api' });
  scenario = await createBasicChatScenario(sandbox.baseUrl);
});

after(async () => {
  await sandbox?.stop?.();
});

function locationFixture(overrides = {}) {
  return {
    latitude: 54.7104,
    longitude: 20.4522,
    zoom: 16,
    title: 'Victory Square',
    address: 'Victory Square, Kaliningrad',
    provider: 'osm',
    ...overrides,
  };
}

test('maps are disabled by default and admin settings enable OSM proxy routes', async () => {
  const { admin, bob, groupChat } = scenario;

  const publicConfig = await bob.request('/api/maps/config');
  assert.equal(publicConfig.data.settings.enabled, false);
  assert.equal(publicConfig.data.settings.provider, 'osm');

  const rejectedMessage = await bob.request(`/api/chats/${groupChat.id}/messages`, {
    method: 'POST',
    json: { text: '', location: locationFixture() },
    expectedStatus: 403,
  });
  assert.match(rejectedMessage.data.error, /Maps are disabled/i);

  const rejectedSearch = await bob.request('/api/maps/search', {
    searchParams: { q: 'Kaliningrad' },
    expectedStatus: 403,
  });
  assert.match(rejectedSearch.data.error, /Maps are disabled/i);

  const userDenied = await bob.request('/api/admin/maps/settings', {
    expectedStatus: 403,
  });
  assert.ok(userDenied.data.error);

  const saved = await admin.request('/api/admin/maps/settings', {
    method: 'PUT',
    json: {
      enabled: true,
      provider: 'osm',
      tile_url_template: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      tile_attribution: '© OpenStreetMap contributors',
      search_url: 'https://nominatim.openstreetmap.org/search',
      reverse_url: 'https://nominatim.openstreetmap.org/reverse',
      max_zoom: 18,
    },
  });
  assert.equal(saved.data.settings.enabled, true);
  assert.equal(saved.data.settings.max_zoom, 18);
  assert.match(saved.data.user_agent, /Bananza self-hosted chat/);

  const enabledConfig = await bob.request('/api/maps/config');
  assert.equal(enabledConfig.data.settings.enabled, true);
  assert.equal(enabledConfig.data.settings.search_url, undefined);
  assert.equal(enabledConfig.data.settings.reverse_url, undefined);

  const search = await bob.request('/api/maps/search', {
    searchParams: { q: 'Kaliningrad' },
  });
  assert.equal(search.data.results.length, 1);
  assert.equal(search.data.results[0].provider, 'osm');
  assert.equal(search.data.results[0].latitude, 54.7104);
  assert.match(search.data.results[0].address, /Kaliningrad/);

  const reverse = await bob.request('/api/maps/reverse', {
    searchParams: { lat: 54.7104, lon: 20.4522 },
  });
  assert.equal(reverse.data.result.provider, 'osm');
  assert.equal(reverse.data.result.longitude, 20.4522);
  assert.match(reverse.data.result.address, /Mock reverse place/);
});

test('location messages create, hydrate, copy, preview and delete cleanly', async () => {
  const { admin, bob, groupChat, privateChat } = scenario;

  const invalid = await bob.request(`/api/chats/${groupChat.id}/messages`, {
    method: 'POST',
    json: { location: locationFixture({ latitude: 123 }) },
    expectedStatus: 400,
  });
  assert.match(invalid.data.error, /Invalid location coordinates/i);

  const created = await bob.request(`/api/chats/${groupChat.id}/messages`, {
    method: 'POST',
    json: {
      text: '',
      client_id: `maps-${Date.now()}`,
      location: locationFixture(),
    },
  });
  assert.equal(created.data.text ?? '', '');
  assert.equal(created.data.location.latitude, 54.7104);
  assert.equal(created.data.location.longitude, 20.4522);
  assert.equal(created.data.location.title, 'Victory Square');

  const messages = await admin.request(`/api/chats/${groupChat.id}/messages`, {
    searchParams: { anchor: created.data.id, limit: 5 },
  });
  const hydrated = messages.data.messages.find((message) => message.id === created.data.id);
  assert.equal(hydrated.location.address, 'Victory Square, Kaliningrad');

  const chatList = await admin.request('/api/chats');
  const chatPreview = chatList.data.find((chat) => chat.id === groupChat.id);
  assert.equal(Boolean(chatPreview.last_location), true);
  assert.match(chatPreview.last_text, /Геометка|Location/i);

  const forwarded = await bob.request(`/api/messages/${created.data.id}/forward`, {
    method: 'POST',
    json: { targetChatId: privateChat.id },
  });
  assert.equal(forwarded.data.forwarded_from_message_id, created.data.id);
  assert.equal(forwarded.data.location.latitude, 54.7104);

  const savedToNotes = await bob.request(`/api/messages/${created.data.id}/save-to-notes`, {
    method: 'POST',
    json: {},
  });
  assert.equal(savedToNotes.data.saved_from_message_id, created.data.id);
  assert.equal(savedToNotes.data.location.longitude, 20.4522);

  const deleted = await bob.request(`/api/messages/${created.data.id}`, {
    method: 'DELETE',
  });
  assert.equal(deleted.data.ok, true);

  const db = new Database(path.join(sandbox.appDir, 'bananza.db'), { readonly: true });
  try {
    const originalLocation = db.prepare('SELECT 1 FROM message_locations WHERE message_id=?').get(created.data.id);
    const copiedLocations = db.prepare(`
      SELECT message_id FROM message_locations
      WHERE message_id IN (?, ?)
      ORDER BY message_id
    `).all(forwarded.data.id, savedToNotes.data.id);
    assert.equal(originalLocation, undefined);
    assert.deepEqual(copiedLocations.map((row) => row.message_id), [forwarded.data.id, savedToNotes.data.id].sort((a, b) => a - b));
  } finally {
    db.close();
  }
});
