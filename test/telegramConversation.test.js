const test = require('node:test');
const assert = require('node:assert/strict');
const { runConversation } = require('../ai/telegramConversation');

test('Telegram conversation keeps text roles and lets the model edit an earlier image by ID', async () => {
  const original = Buffer.from('original');
  const edited = Buffer.from('edited');
  let request;
  const result = await runConversation({
    system: 'You are a helpful bot.', prompt: 'Change the first image to blue',
    history: [
      { id: 1, role: 'user', text: 'Remember my name: Sam', image_data: original, image_mime_type: 'image/png' },
      { id: 2, role: 'assistant', text: 'Hello Sam', image_data: edited, image_mime_type: 'image/png' },
    ],
    respond: async (input) => {
      assert.equal(input[1].role, 'user');
      assert.match(input[1].content, /Sam/);
      assert.equal(input[2].role, 'assistant');
      assert.equal(input.at(-1).content.at(-1).image_url, `data:image/png;base64,${edited.toString('base64')}`);
      return JSON.stringify({ action: 'edit', prompt: 'Change the original to blue', image_id: '1' });
    },
    generateImage: async (args) => { request = args; return { buffer: Buffer.from('blue') }; },
  });
  assert.deepEqual(request.sourceImage.buffer, original);
  assert.equal(request.prompt, 'Change the original to blue');
  assert.deepEqual(result.buffer, Buffer.from('blue'));
});

test('Telegram conversation uses the explicit image, supports text and new generation, and rejects unknown sources', async () => {
  const sourceImage = { buffer: Buffer.from('explicit'), mimeType: 'image/png' };
  const execute = (plan, generateImage) => runConversation({
    system: '', prompt: 'request', sourceImage,
    respond: async () => JSON.stringify(plan), generateImage,
  });
  assert.deepEqual(await execute({ action: 'text', text: 'I remember.' }, () => assert.fail()), { text: 'I remember.' });
  await execute({ action: 'edit', prompt: 'edit', image_id: 'current' }, async (args) => {
    assert.equal(args.sourceImage, sourceImage);
    return { buffer: Buffer.from('result') };
  });
  await execute({ action: 'generate', prompt: 'a new picture' }, async (args) => {
    assert.equal(args.sourceImage, null);
    return { buffer: Buffer.from('new') };
  });
  await assert.rejects(execute({ action: 'edit', prompt: 'edit', image_id: 'other-user' }, () => assert.fail()), /unavailable image/);
  await assert.rejects(runConversation({ respond: async () => 'not json', system: '' }), /invalid JSON/);
});

test('Telegram conversation loads only the latest image for vision and the selected image for editing', async () => {
  const loaded = [];
  await runConversation({
    system: '', prompt: 'Edit the first one',
    history: [1, 2, 3].map((id) => ({ id, role: 'user', text: `image ${id}`, has_image: 1 })),
    loadImage: (id) => {
      loaded.push(id);
      return { buffer: Buffer.from(`image ${id}`), mimeType: 'image/png' };
    },
    respond: async () => JSON.stringify({ action: 'edit', prompt: 'make it blue', image_id: '1' }),
    generateImage: async ({ sourceImage }) => {
      assert.equal(sourceImage.buffer.toString(), 'image 1');
      return { buffer: Buffer.from('result') };
    },
  });
  assert.deepEqual(loaded, [3, 1]);
});
