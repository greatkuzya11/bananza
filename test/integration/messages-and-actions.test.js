const test = require('node:test');
const assert = require('node:assert/strict');
const { before, after } = require('node:test');

const { createSandbox } = require('../support/runtimeSandbox');
const { createBasicChatScenario, waitFor } = require('../support/scenario');

let sandbox;
let scenario;

before(async () => {
  sandbox = await createSandbox({ name: 'messages-actions' });
  scenario = await createBasicChatScenario(sandbox.baseUrl);
});

after(async () => {
  await sandbox?.stop?.();
});

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
  assert.equal(pinned.data.pins.length, 1);

  const unpinned = await bob.request(`/api/messages/${previewMessage.data.id}/pin`, {
    method: 'DELETE',
  });
  assert.equal(unpinned.data.ok, true);

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
});
