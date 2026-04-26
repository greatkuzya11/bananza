const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { extractUrls, fetchPreview } = require('../../linkPreview');
const { fixturesRoot } = require('../support/paths');

const fixtureHtml = fs.readFileSync(path.join(fixturesRoot, 'sample-link-preview.html'), 'utf8');

test('extractUrls returns unique http and https URLs', () => {
  const urls = extractUrls('See https://preview.test/a and http://preview.test/b plus https://preview.test/a');
  assert.deepEqual(urls, ['https://preview.test/a', 'http://preview.test/b']);
});

test('fetchPreview extracts title, description and absolute image URL from html', async (t) => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response(fixtureHtml, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
  t.after(() => {
    global.fetch = originalFetch;
  });

  const preview = await fetchPreview('https://preview.test/article');

  assert.deepEqual(preview, {
    url: 'https://preview.test/article',
    title: 'Fixture Preview Title',
    description: 'Fixture preview description',
    image: 'https://preview.test/assets/fixture.png',
    hostname: 'preview.test',
  });
});

test('fetchPreview returns null for non-html responses', async (t) => {
  const originalFetch = global.fetch;
  global.fetch = async () => new Response('plain text', {
    status: 200,
    headers: { 'content-type': 'text/plain' },
  });
  t.after(() => {
    global.fetch = originalFetch;
  });

  const preview = await fetchPreview('https://preview.test/plain.txt');
  assert.equal(preview, null);
});
