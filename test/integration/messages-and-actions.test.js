const test = require('node:test');
const assert = require('node:assert/strict');
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
    assert.equal(message.transcription_text, 'Mock OpenAI transcript');
    return message;
  }, { timeoutMs: 15_000 });

  const videoForm = new FormData();
  videoForm.append('video', new Blob(['video-note'], { type: 'video/webm' }), 'note.webm');
  videoForm.append('audio', new Blob(['audio-track'], { type: 'audio/wav' }), 'note.wav');
  videoForm.append('poster', new Blob([POSTER_JPEG_BYTES], { type: 'image/jpeg' }), 'note-poster.jpg');
  videoForm.append('durationMs', '2200');
  videoForm.append('sampleRate', '16000');
  videoForm.append('shapeId', 'circle');
  videoForm.append('shapeSnapshot', JSON.stringify({
    id: 'circle',
    label: 'Circle',
    viewBox: '0 0 320 220',
    path: 'M0 0 L10 10 Z',
  }));
  const videoMessage = await admin.request(`/api/chats/${groupChat.id}/video-note`, {
    method: 'POST',
    formData: videoForm,
  });

  assert.equal(videoMessage.data.is_video_note, true);
  assert.equal(videoMessage.data.video_note_shape_id, 'circle');
  assert.equal(videoMessage.data.file_poster_available, true);
  const videoPoster = await admin.request(`/uploads/${videoMessage.data.file_stored}/poster`);
  assert.equal(videoPoster.headers['content-type'], 'image/jpeg');
});
