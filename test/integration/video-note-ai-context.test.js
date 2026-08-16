const test = require('node:test');
const assert = require('node:assert/strict');
const { before, after } = require('node:test');

const { createSandbox } = require('../support/runtimeSandbox');
const { createBasicChatScenario, sleep, waitFor } = require('../support/scenario');

let sandbox;
let scenario;

before(async () => {
  sandbox = await createSandbox({
    name: 'video-note-ai-context',
    env: {
      BANANZA_TEST_OPENAI_TRANSCRIPTION_DELAY_MS: '700',
      BANANZA_TEST_OPENAI_ECHO_TRANSCRIPT_CONTEXT: '1',
    },
  });
  scenario = await createBasicChatScenario(sandbox.baseUrl);
});

after(async () => {
  await sandbox?.stop?.();
});

async function createPrivateBotChat() {
  const { admin, bob } = scenario;
  await admin.request('/api/admin/ai-bots/settings', {
    method: 'PUT',
    json: {
      enabled: true,
      openai_api_key: 'sk-ai-test',
      default_response_model: 'gpt-4o-mini',
    },
  });
  const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const created = await admin.request('/api/admin/ai-bots', {
    method: 'POST',
    json: {
      name: `Video context ${suffix}`.slice(0, 30),
      mention: `video_${suffix}`.slice(0, 24),
      enabled: true,
      visible_to_users: true,
      response_model: 'gpt-4o-mini',
      summary_model: 'gpt-4o-mini',
    },
  });
  const bot = created.data.bot;
  await admin.request(`/api/admin/users/${bob.user.id}/bot-access`, {
    method: 'PUT',
    json: { can_add_bots_to_chats: true },
  });
  const privateChat = await bob.request('/api/chats/private', {
    method: 'POST',
    json: { targetUserId: Number(bot.user_id) },
  });
  return { bot, chatId: Number(privateChat.data.id) };
}

async function setVideoTranscriptionMode(mode) {
  const { admin } = scenario;
  await admin.request('/api/admin/voice-settings', {
    method: 'PUT',
    json: {
      voice_notes_enabled: true,
      active_provider: 'openai',
      openai_api_key: 'sk-transcription-test',
    },
  });
  await admin.request('/api/admin/video-note-settings', {
    method: 'PUT',
    json: {
      video_notes_enabled: true,
      video_note_default_shape_id: 'circle',
      video_note_transcription_mode: mode,
      video_note_transcription_provider: 'openai',
      video_note_max_duration_ms: 45000,
    },
  });
}

async function sendVideoNote(chatId, { replyToId = null } = {}) {
  const form = new FormData();
  form.append('video', new Blob(['video-note'], { type: 'video/webm' }), 'context-note.webm');
  form.append('audio', new Blob(['audio-track'], { type: 'audio/wav' }), 'context-note.wav');
  form.append('durationMs', '2200');
  form.append('sampleRate', '16000');
  form.append('videoMime', 'video/webm');
  if (replyToId) form.append('replyToId', String(replyToId));
  return scenario.bob.request(`/api/chats/${chatId}/video-note`, {
    method: 'POST',
    formData: form,
  });
}

async function chatMessages(chatId) {
  const response = await scenario.bob.request(`/api/chats/${chatId}/messages`, {
    searchParams: { meta: 1 },
  });
  return response.data.messages;
}

function repliesTo(messages, messageId) {
  return messages.filter((message) => (
    Number(message.ai_generated || 0) === 1
    && Number(message.reply_to_id || 0) === Number(messageId)
  ));
}

async function waitForTranscriptReply(chatId, messageId) {
  return waitFor(async () => {
    const messages = await chatMessages(chatId);
    const source = messages.find((message) => Number(message.id) === Number(messageId));
    assert.equal(source?.transcription_status, 'completed');
    assert.equal(source?.transcription_text, 'Mock OpenAI transcript');
    const replies = repliesTo(messages, messageId);
    assert.equal(replies.length, 1);
    assert.equal(replies[0].text, 'Mock OpenAI transcript-aware response');
    return { messages, source, reply: replies[0] };
  }, { timeoutMs: 15_000 });
}

test('automatic video transcription delays the bot and supplies transcript context once', async () => {
  const { chatId } = await createPrivateBotChat();
  await setVideoTranscriptionMode('auto');

  const created = await sendVideoNote(chatId);
  assert.equal(created.data.transcription_status, 'pending');

  await sleep(250);
  const pendingMessages = await chatMessages(chatId);
  assert.equal(repliesTo(pendingMessages, created.data.id).length, 0);

  await waitForTranscriptReply(chatId, created.data.id);

  const followup = await scenario.bob.request(`/api/chats/${chatId}/messages`, {
    method: 'POST',
    json: { text: 'Что было в предыдущем сообщении?' },
  });
  const followupResult = await waitFor(async () => {
    const messages = await chatMessages(chatId);
    const replies = repliesTo(messages, followup.data.id);
    assert.equal(replies.length, 1);
    assert.equal(replies[0].text, 'Mock OpenAI transcript-aware response');
    return replies[0];
  }, { timeoutMs: 10_000 });
  assert.ok(followupResult);
});

test('manual video transcription triggers the bot only after transcription completes', async () => {
  const { chatId } = await createPrivateBotChat();
  await setVideoTranscriptionMode('manual');

  const created = await sendVideoNote(chatId);
  assert.equal(created.data.transcription_status, 'idle');

  await sleep(250);
  const idleMessages = await chatMessages(chatId);
  assert.equal(repliesTo(idleMessages, created.data.id).length, 0);

  const requested = await scenario.bob.request(`/api/messages/${created.data.id}/transcribe`, {
    method: 'POST',
  });
  assert.equal(requested.data.status, 'pending');

  await waitForTranscriptReply(chatId, created.data.id);
});

test('group video reply follows normal bot reply rules after transcription', async () => {
  const { admin, bob, groupChat } = scenario;
  const { bot } = await createPrivateBotChat();
  const chatId = Number(groupChat.id);
  await setVideoTranscriptionMode('auto');
  await admin.request(`/api/chats/${chatId}/members`, {
    method: 'POST',
    json: { userId: Number(bot.user_id) },
  });

  const prompt = await bob.request(`/api/chats/${chatId}/messages`, {
    method: 'POST',
    json: { text: `@${bot.mention} ответь для проверки video reply` },
  });
  const botMessage = await waitFor(async () => {
    const messages = await chatMessages(chatId);
    const replies = repliesTo(messages, prompt.data.id);
    assert.equal(replies.length, 1);
    return replies[0];
  }, { timeoutMs: 10_000 });

  const created = await sendVideoNote(chatId, { replyToId: botMessage.id });
  assert.equal(created.data.transcription_status, 'pending');

  await sleep(250);
  const pendingMessages = await chatMessages(chatId);
  assert.equal(repliesTo(pendingMessages, created.data.id).length, 0);

  await waitForTranscriptReply(chatId, created.data.id);
});
