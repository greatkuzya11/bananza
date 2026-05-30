const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const Database = require('better-sqlite3');
const { before, after } = require('node:test');

const { createSandbox } = require('../support/runtimeSandbox');
const { createBasicChatScenario, waitFor } = require('../support/scenario');

let sandbox;
let scenario;
const POSTER_JPEG_BYTES = Buffer.from('ffd8ffe000104a46494600010100000100010000ffdb000100ffd9', 'hex');

before(async () => {
  sandbox = await createSandbox({ name: 'messages-actions' });
  scenario = await createBasicChatScenario(sandbox.baseUrl);
});

after(async () => {
  await sandbox?.stop?.();
});

function makePosterForm(filename = 'poster.jpg') {
  const form = new FormData();
  form.append('poster', new Blob([POSTER_JPEG_BYTES], { type: 'image/jpeg' }), filename);
  return form;
}

async function enableContextTransformForChat(admin, chatId) {
  await admin.request('/api/admin/ai-bots/settings', {
    method: 'PUT',
    json: {
      enabled: true,
      openai_api_key: 'sk-ai-test',
      default_response_model: 'gpt-4o-mini',
    },
  });
  await admin.request('/api/admin/deepseek-ai-bots/settings', {
    method: 'PUT',
    json: {
      deepseek_enabled: true,
      deepseek_api_key: 'sk-deepseek-test',
      deepseek_default_response_model: 'deepseek-chat',
    },
  });
  await admin.request(`/api/chats/${chatId}/context-transform-settings`, {
    method: 'PUT',
    json: { context_transform_enabled: true },
  });
}

async function createContextConvertBot(admin, provider = 'openai') {
  const route = provider === 'deepseek'
    ? '/api/admin/deepseek-convert-bots'
    : '/api/admin/openai-convert-bots';
  const response = await admin.request(route, {
    method: 'POST',
    json: {
      name: `${provider} restore ${Date.now().toString(36)}`.slice(0, 30),
      enabled: true,
      available_in_all_chats: true,
      response_model: provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 1000,
      transform_prompt: 'Rewrite the source text and return only the rewritten text.',
    },
  });
  return response.data.bot;
}

test('message creation, file upload, edit, search, read and delete work end-to-end', async () => {
  const { admin, bob, groupChat } = scenario;
  const uploaded = await admin.uploadTextFile('draft.txt', 'Attachment content');

  const created = await admin.request(`/api/chats/${groupChat.id}/messages`, {
    method: 'POST',
    json: {
      text: 'Hello integration world',
      fileId: uploaded.id,
    },
  });
  assert.equal(created.data.text, 'Hello integration world');
  assert.equal(created.data.file_id, uploaded.id);

  const edited = await admin.request(`/api/messages/${created.data.id}`, {
    method: 'PATCH',
    json: { text: 'Hello edited world' },
  });
  assert.equal(edited.data.text, 'Hello edited world');

  const jumpTarget = await bob.request(`/api/messages/${created.data.id}/jump-target`);
  assert.deepEqual(jumpTarget.data, {
    chatId: groupChat.id,
    messageId: created.data.id,
  });

  const search = await bob.request('/api/messages/search', {
    searchParams: { q: 'edited', chatId: groupChat.id },
  });
  assert.ok(search.data.some((message) => message.id === created.data.id));

  const read = await bob.request(`/api/chats/${groupChat.id}/read`, {
    method: 'POST',
    json: { lastReadId: created.data.id },
  });
  assert.equal(read.data.ok, true);

  const deleted = await admin.request(`/api/messages/${created.data.id}`, {
    method: 'DELETE',
  });
  assert.equal(deleted.data.ok, true);
});

test('context transform preserves the first sent text and restores it on demand', async () => {
  const { admin, bob, groupChat } = scenario;
  await enableContextTransformForChat(admin, groupChat.id);
  const openAiBot = await createContextConvertBot(admin, 'openai');
  const deepSeekBot = await createContextConvertBot(admin, 'deepseek');
  const originalText = `Restore original ${Date.now()}`;

  const created = await admin.request(`/api/chats/${groupChat.id}/messages`, {
    method: 'POST',
    json: { text: originalText },
  });
  assert.equal(created.data.context_transform_original_available, 0);
  assert.equal(Object.prototype.hasOwnProperty.call(created.data, 'original_text'), false);

  const firstTransform = await admin.request(`/api/messages/${created.data.id}/context-convert`, {
    method: 'POST',
    json: { botId: openAiBot.id },
  });
  assert.equal(firstTransform.data.message.text, 'Mock OpenAI response');
  assert.equal(firstTransform.data.message.context_transform_original_available, 1);
  assert.equal(Object.prototype.hasOwnProperty.call(firstTransform.data.message, 'original_text'), false);

  const secondTransform = await admin.request(`/api/messages/${created.data.id}/context-convert`, {
    method: 'POST',
    json: { botId: deepSeekBot.id },
  });
  assert.equal(secondTransform.data.message.text, 'Mock DeepSeek response');
  assert.equal(secondTransform.data.message.context_transform_original_available, 1);

  const denied = await bob.request(`/api/messages/${created.data.id}/context-convert/restore-original`, {
    method: 'POST',
    expectedStatus: 403,
  });
  assert.match(denied.data.error, /Not allowed/i);

  const restored = await admin.request(`/api/messages/${created.data.id}/context-convert/restore-original`, {
    method: 'POST',
  });
  assert.equal(restored.data.message.text, originalText);
  assert.equal(restored.data.message.context_transform_original_available, 0);
  assert.equal(Object.prototype.hasOwnProperty.call(restored.data.message, 'original_text'), false);

  const listed = await admin.request(`/api/chats/${groupChat.id}/messages`, {
    searchParams: { anchor: created.data.id, meta: 1 },
  });
  const listedMessage = listed.data.messages.find((message) => message.id === created.data.id);
  assert.ok(listedMessage);
  assert.equal(listedMessage.text, originalText);
  assert.equal(listedMessage.context_transform_original_available, 0);
  assert.equal(Object.prototype.hasOwnProperty.call(listedMessage, 'original_text'), false);

  const inspectionDb = new Database(path.join(sandbox.appDir, 'bananza.db'), { readonly: true });
  try {
    const row = inspectionDb.prepare(`
      SELECT original_text, transform_count, restored_by
      FROM message_context_transform_originals
      WHERE message_id=?
    `).get(created.data.id);
    assert.equal(row.original_text, originalText);
    assert.equal(row.transform_count, 2);
    assert.equal(row.restored_by, admin.user.id);
  } finally {
    inspectionDb.close();
  }
});

test('context transform original restore works for voice transcription text', async () => {
  const { admin, groupChat } = scenario;
  await enableContextTransformForChat(admin, groupChat.id);
  const openAiBot = await createContextConvertBot(admin, 'openai');
  const originalText = `Voice restore original ${Date.now()}`;

  try {
    await admin.request('/api/admin/voice-settings', {
      method: 'PUT',
      json: {
        voice_notes_enabled: true,
        auto_transcribe_on_send: false,
        active_provider: 'openai',
        openai_api_key: 'sk-test-openai',
      },
    });

    const voiceForm = new FormData();
    voiceForm.append('file', new Blob(['wave'], { type: 'audio/wav' }), 'restore-voice.wav');
    voiceForm.append('durationMs', '900');
    voiceForm.append('sampleRate', '16000');
    const voiceMessage = await admin.request(`/api/chats/${groupChat.id}/voice-message`, {
      method: 'POST',
      formData: voiceForm,
    });
    assert.equal(voiceMessage.data.is_voice_note, true);

    const manualTranscript = await admin.request(`/api/messages/${voiceMessage.data.id}`, {
      method: 'PATCH',
      json: { text: originalText },
    });
    assert.equal(manualTranscript.data.transcription_text, originalText);

    const transformed = await admin.request(`/api/messages/${voiceMessage.data.id}/context-convert`, {
      method: 'POST',
      json: { botId: openAiBot.id },
    });
    assert.equal(transformed.data.message.transcription_text, 'Mock OpenAI response');
    assert.equal(transformed.data.message.context_transform_original_available, 1);

    const restored = await admin.request(`/api/messages/${voiceMessage.data.id}/context-convert/restore-original`, {
      method: 'POST',
    });
    assert.equal(restored.data.message.transcription_text, originalText);
    assert.equal(restored.data.message.context_transform_original_available, 0);
  } finally {
    await admin.request('/api/admin/voice-settings', {
      method: 'PUT',
      json: {
        voice_notes_enabled: false,
        auto_transcribe_on_send: false,
      },
    });
  }
});

test('universal uploads keep trusted media previewable and unsafe files download-only', async () => {
  const { admin, privateChat, groupChat } = scenario;

  const binaryUpload = await admin.uploadFile({
    filename: 'cover.psd',
    mimeType: 'application/octet-stream',
    body: 'layered-binary',
  });
  assert.equal(binaryUpload.type, 'document');

  const binaryMessage = await admin.request(`/api/chats/${groupChat.id}/messages`, {
    method: 'POST',
    json: {
      text: 'Binary attachment',
      fileId: binaryUpload.id,
    },
  });
  assert.equal(binaryMessage.data.file_type, 'document');
  assert.equal(binaryMessage.data.file_name, 'cover.psd');

  const binaryPreview = await admin.request(`/uploads/${binaryUpload.stored_name}/preview`, {
    expectedStatus: 404,
  });
  assert.equal(binaryPreview.data.error, 'Preview not available');

  const binaryDownload = await admin.request(`/uploads/${binaryUpload.stored_name}`);
  assert.match(binaryDownload.headers['content-disposition'] || '', /^attachment;/);
  assert.equal(binaryDownload.headers['x-content-type-options'], 'nosniff');

  const htmlUpload = await admin.uploadFile({
    filename: 'page.html',
    mimeType: 'text/html',
    body: '<!doctype html><html><body><script>alert(1)</script></body></html>',
  });
  assert.equal(htmlUpload.type, 'document');

  const htmlDownload = await admin.request(`/uploads/${htmlUpload.stored_name}`);
  assert.match(htmlDownload.headers['content-disposition'] || '', /^attachment;/);
  assert.equal(htmlDownload.headers['content-type'], 'text/html');

  const svgUpload = await admin.uploadFile({
    filename: 'diagram.svg',
    mimeType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="gold"/></svg>',
  });
  assert.equal(svgUpload.type, 'image');

  const svgMessage = await admin.request(`/api/chats/${groupChat.id}/messages`, {
    method: 'POST',
    json: {
      text: 'Vector attachment',
      fileId: svgUpload.id,
    },
  });
  assert.equal(svgMessage.data.file_type, 'image');
  assert.equal(svgMessage.data.file_name, 'diagram.svg');

  const svgPreview = await admin.request(`/uploads/${svgUpload.stored_name}/preview`);
  assert.equal(svgPreview.headers['content-type'], 'image/svg+xml');
  assert.match(svgPreview.headers['content-disposition'] || '', /^inline;/);
  assert.equal(svgPreview.headers['x-content-type-options'], 'nosniff');
  assert.match(svgPreview.headers['content-security-policy'] || '', /sandbox/);

  const forwardedBinary = await admin.request(`/api/messages/${binaryMessage.data.id}/forward`, {
    method: 'POST',
    json: { targetChatId: privateChat.id },
  });
  assert.equal(forwardedBinary.data.forwarded_from_message_id, binaryMessage.data.id);
  assert.equal(forwardedBinary.data.file_type, 'document');
  assert.equal(forwardedBinary.data.file_name, 'cover.psd');
});

test('video posters are uploaded, copied, deleted and backfilled through public APIs', async () => {
  const { admin, bob, carol, groupChat, privateChat } = scenario;

  const uploadWithPoster = await admin.uploadFile({
    filename: 'poster-video.mp4',
    mimeType: 'video/mp4',
    body: 'video-with-poster',
    poster: {
      filename: 'poster-video.jpg',
      mimeType: 'image/jpeg',
      body: POSTER_JPEG_BYTES,
    },
  });
  assert.equal(uploadWithPoster.type, 'video');
  assert.equal(uploadWithPoster.poster_available, true);

  const uploadedPoster = await admin.request(`/uploads/${uploadWithPoster.stored_name}/poster`);
  assert.equal(uploadedPoster.headers['content-type'], 'image/jpeg');

  const created = await admin.request(`/api/chats/${groupChat.id}/messages`, {
    method: 'POST',
    json: {
      text: 'Video with poster',
      fileId: uploadWithPoster.id,
    },
  });
  assert.equal(created.data.file_type, 'video');
  assert.equal(created.data.file_poster_available, true);

  const hydrated = await admin.request(`/api/chats/${groupChat.id}/messages`, {
    searchParams: { meta: 1 },
  });
  const hydratedMessage = hydrated.data.messages.find((message) => message.id === created.data.id);
  assert.ok(hydratedMessage);
  assert.equal(hydratedMessage.file_poster_available, true);

  const forwarded = await admin.request(`/api/messages/${created.data.id}/forward`, {
    method: 'POST',
    json: { targetChatId: privateChat.id },
  });
  assert.equal(forwarded.data.file_poster_available, true);
  const forwardedPoster = await admin.request(`/uploads/${forwarded.data.file_stored}/poster`);
  assert.equal(forwardedPoster.headers['content-type'], 'image/jpeg');

  const savedToNotes = await admin.request(`/api/messages/${created.data.id}/save-to-notes`, {
    method: 'POST',
    json: {},
  });
  assert.equal(savedToNotes.data.file_poster_available, true);
  const savedPoster = await admin.request(`/uploads/${savedToNotes.data.file_stored}/poster`);
  assert.equal(savedPoster.headers['content-type'], 'image/jpeg');

  const legacyUpload = await admin.uploadFile({
    filename: 'legacy-video.mp4',
    mimeType: 'video/mp4',
    body: 'legacy-video',
  });
  const legacyMessage = await admin.request(`/api/chats/${privateChat.id}/messages`, {
    method: 'POST',
    json: {
      text: 'Legacy video',
      fileId: legacyUpload.id,
    },
  });
  assert.equal(legacyMessage.data.file_poster_available, false);

  const backfilled = await bob.request(`/api/messages/${legacyMessage.data.id}/poster`, {
    method: 'POST',
    formData: makePosterForm('backfill.jpg'),
  });
  assert.equal(backfilled.data.ok, true);
  assert.equal(backfilled.data.message.file_poster_available, true);

  const backfilledPoster = await admin.request(`/uploads/${legacyUpload.stored_name}/poster`);
  assert.equal(backfilledPoster.headers['content-type'], 'image/jpeg');

  const forbidden = await carol.request(`/api/messages/${legacyMessage.data.id}/poster`, {
    method: 'POST',
    formData: makePosterForm('forbidden.jpg'),
    expectedStatus: 403,
  });
  assert.equal(forbidden.data.error, 'Not a member');

  const textMessage = await admin.request(`/api/chats/${groupChat.id}/messages`, {
    method: 'POST',
    json: { text: 'Not a video message' },
  });
  const nonVideo = await admin.request(`/api/messages/${textMessage.data.id}/poster`, {
    method: 'POST',
    formData: makePosterForm('non-video.jpg'),
    expectedStatus: 400,
  });
  assert.match(nonVideo.data.error, /Video poster can only be attached to a video message/i);

  const deleted = await admin.request(`/api/messages/${created.data.id}`, {
    method: 'DELETE',
  });
  assert.equal(deleted.data.ok, true);

  await admin.request(`/uploads/${uploadWithPoster.stored_name}/poster`, {
    expectedStatus: 404,
  });
  const forwardedPosterAfterDelete = await admin.request(`/uploads/${forwarded.data.file_stored}/poster`);
  assert.equal(forwardedPosterAfterDelete.headers['content-type'], 'image/jpeg');
  const savedPosterAfterDelete = await admin.request(`/uploads/${savedToNotes.data.file_stored}/poster`);
  assert.equal(savedPosterAfterDelete.headers['content-type'], 'image/jpeg');
});

test('link previews, reactions, pins, polls, notes and forwarding work through public APIs', async () => {
  const { admin, bob, privateChat, groupChat } = scenario;

  const previewMessage = await admin.request(`/api/chats/${groupChat.id}/messages`, {
    method: 'POST',
    json: { text: 'Look at this https://preview.test/article' },
  });

  const hydrated = await waitFor(async () => {
    const response = await admin.request(`/api/chats/${groupChat.id}/messages`, {
      searchParams: { meta: 1 },
    });
    const message = response.data.messages.find((item) => item.id === previewMessage.data.id);
    assert.ok(message);
    assert.equal(Array.isArray(message.previews), true);
    assert.equal(message.previews.length, 1);
    return message;
  });
  assert.equal(hydrated.previews[0].hostname, 'preview.test');

  const reacted = await bob.request(`/api/messages/${previewMessage.data.id}/reactions`, {
    method: 'POST',
    json: { emoji: '👍' },
  });
  assert.equal(reacted.data.ok, true);
  assert.equal(reacted.data.reactions.length, 1);

  const pinned = await bob.request(`/api/messages/${previewMessage.data.id}/pin`, {
    method: 'POST',
    json: {},
  });
  assert.equal(pinned.data.changed, true);
  assert.equal(pinned.data.action, 'pinned');
  assert.equal(pinned.data.messageId, previewMessage.data.id);
  assert.equal(pinned.data.pins.length, 1);

  const secondPinnedMessage = await admin.request(`/api/chats/${groupChat.id}/messages`, {
    method: 'POST',
    json: { text: 'Second pin target' },
  });
  const secondPinned = await bob.request(`/api/messages/${secondPinnedMessage.data.id}/pin`, {
    method: 'POST',
    json: {},
  });
  assert.equal(secondPinned.data.changed, true);
  assert.equal(secondPinned.data.action, 'pinned');
  assert.equal(secondPinned.data.messageId, secondPinnedMessage.data.id);
  assert.deepEqual(
    secondPinned.data.pins.map((pin) => pin.message_id),
    [previewMessage.data.id, secondPinnedMessage.data.id]
  );

  const chatPins = await bob.request(`/api/chats/${groupChat.id}/pins`);
  assert.deepEqual(
    chatPins.data.pins.map((pin) => pin.message_id),
    [previewMessage.data.id, secondPinnedMessage.data.id]
  );

  const pollMessage = await admin.request(`/api/chats/${groupChat.id}/messages`, {
    method: 'POST',
    json: {
      text: 'Best fruit?',
      poll: {
        style: 'pulse',
        options: ['Banana', 'Apple'],
        show_voters: true,
        allows_multiple: false,
      },
    },
  });
  assert.equal(pollMessage.data.poll.options.length, 2);

  const bananaOption = pollMessage.data.poll.options.find((option) => option.text === 'Banana');
  await bob.request(`/api/messages/${pollMessage.data.id}/poll-vote`, {
    method: 'POST',
    json: { optionIds: [bananaOption.id] },
  });

  const voters = await admin.request(`/api/messages/${pollMessage.data.id}/poll-voters`, {
    searchParams: { optionId: bananaOption.id },
  });
  assert.ok(voters.data.voters.some((voter) => voter.id === bob.user.id));

  const closed = await admin.request(`/api/messages/${pollMessage.data.id}/poll-close`, {
    method: 'POST',
    json: {},
  });
  assert.equal(closed.data.ok, true);
  assert.equal(closed.data.poll.is_closed, true);

  const savedToNotes = await admin.request(`/api/messages/${previewMessage.data.id}/save-to-notes`, {
    method: 'POST',
    json: {},
  });
  assert.equal(savedToNotes.data.saved_from_message_id, previewMessage.data.id);

  const forwarded = await admin.request(`/api/messages/${previewMessage.data.id}/forward`, {
    method: 'POST',
    json: { targetChatId: privateChat.id },
  });
  assert.equal(forwarded.data.forwarded_from_message_id, previewMessage.data.id);

  const unpinned = await bob.request(`/api/messages/${previewMessage.data.id}/pin`, {
    method: 'DELETE',
  });
  assert.equal(unpinned.data.ok, true);
  assert.equal(unpinned.data.action, 'unpinned');
  assert.equal(unpinned.data.messageId, previewMessage.data.id);
});

test('voice and video note endpoints work in isolated sandbox with mocked providers', async () => {
  const { admin, groupChat } = scenario;

  const disabledDictationForm = new FormData();
  disabledDictationForm.append('file', new Blob(['wave'], { type: 'audio/wav' }), 'dictation-disabled.wav');
  const disabledDictation = await admin.request('/api/voice/dictation', {
    method: 'POST',
    formData: disabledDictationForm,
    expectedStatus: 403,
  });
  assert.match(disabledDictation.data.error, /Voice notes are disabled/i);

  const voiceSettings = await admin.request('/api/admin/voice-settings', {
    method: 'PUT',
    json: {
      voice_notes_enabled: true,
      auto_transcribe_on_send: true,
      active_provider: 'openai',
      openai_api_key: 'sk-test-openai',
    },
  });
  assert.equal(voiceSettings.data.publicSettings.voice_notes_enabled, true);

  await admin.request('/api/admin/ai-bots/settings', {
    method: 'PUT',
    json: {
      enabled: true,
      openai_api_key: 'sk-ai-test',
      default_response_model: 'gpt-4o-mini',
    },
  });
  const convertBot = await admin.request('/api/admin/openai-convert-bots', {
    method: 'POST',
    json: {
      name: 'Voice transcript polish',
      enabled: true,
      available_in_all_chats: true,
      response_model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 1000,
      transform_prompt: 'Fix grammar and return only the cleaned transcript.',
    },
  });
  const contextVoiceSettings = await admin.request('/api/admin/voice-settings', {
    method: 'PUT',
    json: {
      voice_notes_enabled: true,
      auto_transcribe_on_send: true,
      active_provider: 'openai',
      context_bot_enabled: true,
      context_bot_id: convertBot.data.bot.id,
    },
  });
  assert.equal(contextVoiceSettings.data.settings.context_bot_enabled, true);
  assert.equal(contextVoiceSettings.data.settings.context_bot_id, convertBot.data.bot.id);
  assert.ok(contextVoiceSettings.data.contextConvertBots.some((bot) => bot.id === convertBot.data.bot.id));

  const beforeDictation = await admin.request(`/api/chats/${groupChat.id}/messages`, {
    searchParams: { meta: 1 },
  });
  const dictationForm = new FormData();
  dictationForm.append('file', new Blob(['wave'], { type: 'audio/wav' }), 'dictation.wav');
  const dictation = await admin.request('/api/voice/dictation', {
    method: 'POST',
    formData: dictationForm,
  });
  assert.equal(dictation.data.ok, true);
  assert.equal(dictation.data.text, 'Mock OpenAI response');
  assert.equal(dictation.data.provider, 'openai');

  const afterDictation = await admin.request(`/api/chats/${groupChat.id}/messages`, {
    searchParams: { meta: 1 },
  });
  assert.equal(afterDictation.data.messages.length, beforeDictation.data.messages.length);

  const voiceForm = new FormData();
  voiceForm.append('file', new Blob(['wave'], { type: 'audio/wav' }), 'voice.wav');
  voiceForm.append('durationMs', '1200');
  voiceForm.append('sampleRate', '16000');
  const voiceMessage = await admin.request(`/api/chats/${groupChat.id}/voice-message`, {
    method: 'POST',
    formData: voiceForm,
  });
  assert.equal(voiceMessage.data.is_voice_note, true);

  await waitFor(async () => {
    const response = await admin.request(`/api/chats/${groupChat.id}/messages`, {
      searchParams: { meta: 1 },
    });
    const message = response.data.messages.find((item) => item.id === voiceMessage.data.id);
    assert.ok(message);
    assert.equal(message.transcription_status, 'completed');
    assert.equal(message.transcription_text, 'Mock OpenAI response');
    return message;
  }, { timeoutMs: 15_000 });

  await admin.request(`/api/admin/openai-convert-bots/${convertBot.data.bot.id}`, {
    method: 'DELETE',
  });
  const fallbackDictationForm = new FormData();
  fallbackDictationForm.append('file', new Blob(['wave'], { type: 'audio/wav' }), 'dictation-fallback.wav');
  const fallbackDictation = await admin.request('/api/voice/dictation', {
    method: 'POST',
    formData: fallbackDictationForm,
  });
  assert.equal(fallbackDictation.data.ok, true);
  assert.equal(fallbackDictation.data.text, 'Mock OpenAI transcript');

  const defaultVideoSettings = await admin.request('/api/admin/video-note-settings');
  assert.equal(defaultVideoSettings.data.settings.video_notes_enabled, true);
  assert.equal(defaultVideoSettings.data.settings.video_note_default_shape_id, 'banana-fat');

  const disabledVideoSettings = await admin.request('/api/admin/video-note-settings', {
    method: 'PUT',
    json: {
      video_notes_enabled: false,
      video_note_default_shape_id: 'banana-fat',
      video_note_transcription_mode: 'manual',
      video_note_transcription_provider: 'voice',
      video_note_max_duration_ms: 30000,
    },
  });
  assert.equal(disabledVideoSettings.data.publicSettings.video_notes_enabled, false);

  const disabledFeatures = await admin.request('/api/features');
  assert.equal(disabledFeatures.data.video_notes_enabled, false);

  const disabledVideoForm = new FormData();
  disabledVideoForm.append('video', new Blob(['video-note'], { type: 'video/webm' }), 'disabled-note.webm');
  disabledVideoForm.append('audio', new Blob(['audio-track'], { type: 'audio/wav' }), 'disabled-note.wav');
  disabledVideoForm.append('durationMs', '2200');
  disabledVideoForm.append('sampleRate', '16000');
  disabledVideoForm.append('videoMime', 'video/webm');
  const disabledVideo = await admin.request(`/api/chats/${groupChat.id}/video-note`, {
    method: 'POST',
    formData: disabledVideoForm,
    expectedStatus: 403,
  });
  assert.match(disabledVideo.data.error, /Video notes are disabled/i);

  const enabledVideoSettings = await admin.request('/api/admin/video-note-settings', {
    method: 'PUT',
    json: {
      video_notes_enabled: true,
      video_note_default_shape_id: 'circle',
      video_note_transcription_mode: 'auto',
      video_note_transcription_provider: 'openai',
      video_note_max_duration_ms: 45000,
    },
  });
  assert.equal(enabledVideoSettings.data.publicSettings.video_note_default_shape_id, 'circle');
  assert.equal(enabledVideoSettings.data.publicSettings.video_note_transcription_mode, 'auto');

  const enabledFeatures = await admin.request('/api/features');
  assert.equal(enabledFeatures.data.video_notes_enabled, true);
  assert.equal(enabledFeatures.data.video_note_default_shape_id, 'circle');
  assert.equal(enabledFeatures.data.video_note_max_duration_ms, 45000);

  const videoForm = new FormData();
  videoForm.append('video', new Blob(['video-note'], { type: 'video/webm' }), 'note.webm');
  videoForm.append('audio', new Blob(['audio-track'], { type: 'audio/wav' }), 'note.wav');
  videoForm.append('poster', new Blob([POSTER_JPEG_BYTES], { type: 'image/jpeg' }), 'note-poster.jpg');
  videoForm.append('durationMs', '2200');
  videoForm.append('sampleRate', '16000');
  videoForm.append('videoMime', 'video/webm');
  const videoMessage = await admin.request(`/api/chats/${groupChat.id}/video-note`, {
    method: 'POST',
    formData: videoForm,
  });

  assert.equal(videoMessage.data.is_video_note, true);
  assert.equal(videoMessage.data.video_note_shape_id, 'circle');
  assert.equal(videoMessage.data.transcription_status, 'pending');
  assert.equal(videoMessage.data.file_poster_available, true);
  const videoPoster = await admin.request(`/uploads/${videoMessage.data.file_stored}/poster`);
  assert.equal(videoPoster.headers['content-type'], 'image/jpeg');

  await waitFor(async () => {
    const response = await admin.request(`/api/chats/${groupChat.id}/messages`, {
      searchParams: { meta: 1 },
    });
    const message = response.data.messages.find((item) => item.id === videoMessage.data.id);
    assert.ok(message);
    assert.equal(message.transcription_status, 'completed');
    assert.equal(message.transcription_provider, 'openai');
    assert.equal(message.transcription_text, 'Mock OpenAI transcript');
    return message;
  }, { timeoutMs: 15_000 });
});
