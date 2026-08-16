const test = require('node:test');
const assert = require('node:assert/strict');

const { createAppDom, installAppBridge, loadBrowserScript } = require('../support/domHarness');

function waitTick() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

test('AI initiative modal renders admin state and saves a rule', async () => {
  const dom = createAppDom();
  const calls = [];
  installAppBridge(dom, {
    t: (key) => key,
    applyLocalizedDom() {},
    getCurrentChatId: () => 1,
    async api(url, options = {}) {
      calls.push({ url, options });
      if (url === '/api/user/timezone') return { ok: true };
      if (url === '/api/admin/ai-bot-initiatives' && !options.method) {
        return {
          chats: [{
            id: 1,
            name: 'Idea chat',
            type: 'private',
            members: [
              { id: 10, display_name: 'Alice', username: 'alice', is_ai_bot: 0 },
              { id: 20, display_name: 'DeepSeek AI', username: 'deepseek_bot', is_ai_bot: 1, ai_bot_provider: 'deepseek', ai_bot_mention: 'deepseek' },
            ],
          }],
          bots: [{ id: 2, name: 'Bananza AI', mention: 'bananza', provider: 'openai' }],
          news_sources: [{ id: 3, name: 'Lenta.ru top7', url: 'https://lenta.ru/rss/top7', enabled: true, cache_ttl_minutes: 30 }],
          rules: [],
        };
      }
      if (url === '/api/admin/ai-bot-initiatives/news-sources') {
        return {
          news_sources: [{ id: 3, name: 'Lenta.ru top7', url: 'https://lenta.ru/rss/top7', enabled: true, cache_ttl_minutes: 30 }],
        };
      }
      if (url === '/api/admin/ai-bot-initiatives/rules') {
        return {
          rule: { id: 7, ...options.body },
          state: {
            chats: [{
              id: 1,
              name: 'Idea chat',
              type: 'private',
              members: [
                { id: 10, display_name: 'Alice', username: 'alice', is_ai_bot: 0 },
                { id: 20, display_name: 'DeepSeek AI', username: 'deepseek_bot', is_ai_bot: 1, ai_bot_provider: 'deepseek', ai_bot_mention: 'deepseek' },
              ],
            }],
            bots: [{ id: 2, name: 'Bananza AI', mention: 'bananza', provider: 'openai' }],
            news_sources: [{ id: 3, name: 'Lenta.ru top7', url: 'https://lenta.ru/rss/top7', enabled: true, cache_ttl_minutes: 30 }],
            rules: [{ id: 7, ...options.body }],
          },
        };
      }
      return {};
    },
  });
  loadBrowserScript(dom, 'public/js/ai-initiative.js');
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

  dom.window.document.getElementById('settingsAiInitiativesPanel').click();
  await waitTick();
  await waitTick();

  assert.equal(dom.window.document.getElementById('aiInitiativeModal').classList.contains('hidden'), false);
  const enabledToggle = dom.window.document.getElementById('aiInitiativeEnabled')?.closest('.ai-initiative-enabled-toggle');
  const chatField = dom.window.document.getElementById('aiInitiativeChatSelect')?.closest('label');
  assert.ok(enabledToggle);
  assert.ok(chatField);
  assert.ok(enabledToggle.compareDocumentPosition(chatField) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.equal(dom.window.document.getElementById('aiInitiativeChatSelect').value, '1');
  assert.equal(dom.window.document.getElementById('aiInitiativeBotSelect').value, '2');
  assert.equal(dom.window.document.getElementById('aiInitiativeRuleName').maxLength, 240);
  assert.equal(dom.window.document.getElementById('aiInitiativeTimezone').tagName, 'SELECT');
  assert.ok(dom.window.document.getElementById('aiInitiativeTimezone').querySelector('option[value="UTC"]'));
  assert.match(dom.window.document.getElementById('aiInitiativeTimezone').textContent, /UTC[+-]\d\d:\d\d/);
  assert.equal(dom.window.document.getElementById('aiInitiativeFixedTimeField').classList.contains('hidden'), false);
  assert.equal(dom.window.document.getElementById('aiInitiativeWindowStartField').classList.contains('hidden'), true);
  assert.equal(dom.window.document.getElementById('aiInitiativeWindowEndField').classList.contains('hidden'), true);
  dom.window.document.getElementById('aiInitiativeScheduleType').value = 'random_window';
  dom.window.document.getElementById('aiInitiativeScheduleType').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.equal(dom.window.document.getElementById('aiInitiativeFixedTimeField').classList.contains('hidden'), true);
  assert.equal(dom.window.document.getElementById('aiInitiativeWindowStartField').classList.contains('hidden'), false);
  assert.equal(dom.window.document.getElementById('aiInitiativeWindowEndField').classList.contains('hidden'), false);
  dom.window.document.getElementById('aiInitiativeScheduleType').value = 'fixed';
  dom.window.document.getElementById('aiInitiativeScheduleType').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  assert.equal(dom.window.document.getElementById('aiInitiativeIdleMinutes').min, '0');
  dom.window.document.getElementById('aiInitiativeIdleMinutes').value = '0';
  const timezoneSearch = dom.window.document.getElementById('aiInitiativeTimezoneSearch');
  timezoneSearch.value = 'Kaliningrad';
  timezoneSearch.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.match(dom.window.document.getElementById('aiInitiativeTimezone').textContent, /UTC[+-]\d\d:\d\d Europe\/Kaliningrad/);
  assert.match(dom.window.document.getElementById('aiInitiativeChatSelect').textContent, /Idea chat - Private chat #1: Alice \(@alice\) <-> DeepSeek AI \(AI bot, deepseek, @deepseek\)/);
  assert.match(dom.window.document.getElementById('aiInitiativePromptPreview').textContent, /Prompt sent to bot/);
  assert.equal(dom.window.document.getElementById('aiInitiativePromptMode').textContent.includes('Date and holidays'), false);
  assert.match(dom.window.document.getElementById('aiInitiativeNewsSource').textContent, /Lenta\.ru top7/);

  dom.window.document.getElementById('aiInitiativeRuleName').value = 'Morning headlines';
  dom.window.document.getElementById('aiInitiativeEnabled').checked = true;
  dom.window.document.getElementById('aiInitiativeSameContextMaxRuns').value = '3';
  dom.window.document.getElementById('aiInitiativePromptMode').value = 'news_hook';
  dom.window.document.getElementById('aiInitiativePromptMode').dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  dom.window.document.getElementById('aiInitiativeNewsItemCount').value = '4';
  dom.window.document.getElementById('aiInitiativeNewsPrompt').value = 'Make it sharp.';
  dom.window.document.getElementById('aiInitiativeSaveRule').click();
  await waitTick();
  await waitTick();

  const saveCall = calls.find((call) => call.url === '/api/admin/ai-bot-initiatives/rules');
  assert.equal(saveCall.options.method, 'POST');
  assert.equal(saveCall.options.body.name, 'Morning headlines');
  assert.equal(saveCall.options.body.chat_id, 1);
  assert.equal(saveCall.options.body.bot_id, 2);
  assert.equal(saveCall.options.body.enabled, true);
  assert.equal(saveCall.options.body.idle_threshold_minutes, 0);
  assert.equal(saveCall.options.body.same_context_limit_enabled, true);
  assert.equal(saveCall.options.body.same_context_max_runs, 3);
  assert.equal(saveCall.options.body.prompt_mode, 'news_hook');
  assert.equal(saveCall.options.body.news_source_id, 3);
  assert.equal(saveCall.options.body.news_item_count, 4);
  assert.equal(saveCall.options.body.news_prompt, 'Make it sharp.');
  assert.match(dom.window.document.getElementById('aiInitiativeRuleList').textContent, /Morning headlines/);
  assert.match(dom.window.document.getElementById('aiInitiativeRuleList').textContent, /Bananza AI/);
  assert.match(dom.window.document.getElementById('aiInitiativeRuleList').textContent, /Idea chat - Private chat #1/);
  assert.doesNotMatch(dom.window.document.getElementById('aiInitiativeRuleList').textContent, /Alice/);
});

test('AI initiative news source modal saves and tests RSS source', async () => {
  const dom = createAppDom();
  const calls = [];
  installAppBridge(dom, {
    t: (key) => key,
    applyLocalizedDom() {},
    getCurrentChatId: () => 1,
    async api(url, options = {}) {
      calls.push({ url, options });
      if (url === '/api/user/timezone') return { ok: true };
      if (url === '/api/admin/ai-bot-initiatives' && !options.method) {
        return {
          chats: [],
          bots: [],
          rules: [],
          news_sources: [],
        };
      }
      if (url === '/api/admin/ai-bot-initiatives/news-sources') {
        return {
          source: { id: 9, ...options.body },
          state: {
            chats: [],
            bots: [],
            rules: [],
            news_sources: [{ id: 9, ...options.body }],
          },
        };
      }
      if (url === '/api/admin/ai-bot-initiatives/news-sources/9/test') {
        return {
          ok: true,
          items: [{
            id: 1,
            title: 'Fresh headline',
            url: 'https://example.com/news',
            published_at: '2026-05-27T09:50:00Z',
          }],
        };
      }
      return {};
    },
  });
  loadBrowserScript(dom, 'public/js/ai-initiative.js');
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

  dom.window.document.getElementById('settingsAiInitiativesPanel').click();
  await waitTick();
  await waitTick();
  dom.window.document.getElementById('aiInitiativeManageNewsSources').click();
  await waitTick();

  assert.equal(dom.window.document.getElementById('aiInitiativeNewsSourcesModal').classList.contains('hidden'), false);
  dom.window.document.getElementById('aiInitiativeNewsSourceName').value = 'Example RSS';
  dom.window.document.getElementById('aiInitiativeNewsSourceUrl').value = 'https://example.com/rss';
  dom.window.document.getElementById('aiInitiativeSaveNewsSource').click();
  await waitTick();
  await waitTick();

  const saveCall = calls.find((call) => call.url === '/api/admin/ai-bot-initiatives/news-sources');
  assert.equal(saveCall.options.method, 'POST');
  assert.equal(saveCall.options.body.name, 'Example RSS');
  assert.equal(saveCall.options.body.url, 'https://example.com/rss');

  dom.window.document.getElementById('aiInitiativeTestNewsSource').click();
  await waitTick();
  await waitTick();

  assert.match(dom.window.document.getElementById('aiInitiativeNewsSourceTestResult').textContent, /Fresh headline/);
});

test('AI initiative reminder list renders and cancels reminders', async () => {
  const dom = createAppDom();
  const calls = [];
  installAppBridge(dom, {
    t: (key) => key,
    applyLocalizedDom() {},
    getCurrentChatId: () => 11,
    showToast() {},
    async api(url, options = {}) {
      calls.push({ url, options });
      if (url === '/api/user/timezone') return { ok: true };
      if (url === '/api/chats/11/reminders') {
        return {
          reminders: [{
            id: 5,
            reminder_text: 'Check tea',
            due_at: '2026-05-27T12:00:00Z',
            requester_timezone: 'UTC',
          }],
        };
      }
      if (url === '/api/reminders/5') return { ok: true };
      return {};
    },
  });
  loadBrowserScript(dom, 'public/js/ai-initiative.js');
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));

  dom.window.dispatchEvent(new dom.window.CustomEvent('bananza:chatinfoopen', { detail: { chatId: 11 } }));
  await waitTick();
  await waitTick();

  assert.match(dom.window.document.getElementById('chatRemindersList').textContent, /Check tea/);
  dom.window.document.querySelector('[data-cancel-reminder="5"]').click();
  await waitTick();
  await waitTick();

  const cancelCall = calls.find((call) => call.url === '/api/reminders/5');
  assert.equal(cancelCall.options.method, 'DELETE');
});
