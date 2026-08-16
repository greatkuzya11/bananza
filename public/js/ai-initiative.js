(function () {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const state = {
    loaded: false,
    rules: [],
    chats: [],
    bots: [],
    newsSources: [],
    selectedRuleId: null,
    selectedNewsSourceId: null,
  };

  function bridge() {
    return window.BananzaAppBridge || {};
  }

  function t(key, params) {
    return bridge().t ? bridge().t(key, params) : String(key || '');
  }

  function api(url, options) {
    return bridge().api(url, options);
  }

  function status(message = '', type = '') {
    const el = $('#aiInitiativeStatus');
    if (!el) return;
    el.textContent = message ? t(message) : '';
    el.classList.toggle('is-success', type === 'success');
    el.classList.toggle('is-error', type === 'error');
    el.classList.toggle('is-pending', type === 'pending');
  }

  function reminderStatus(message = '', type = '') {
    const el = $('#chatRemindersStatus');
    if (!el) return;
    el.textContent = message ? t(message) : '';
    el.classList.toggle('is-success', type === 'success');
    el.classList.toggle('is-error', type === 'error');
    el.classList.toggle('is-pending', type === 'pending');
  }

  function newsSourceStatus(message = '', type = '') {
    const el = $('#aiInitiativeNewsSourceStatus');
    if (!el) return;
    el.textContent = message ? t(message) : '';
    el.classList.toggle('is-success', type === 'success');
    el.classList.toggle('is-error', type === 'error');
    el.classList.toggle('is-pending', type === 'pending');
  }

  function currentRule() {
    return state.rules.find((rule) => Number(rule.id) === Number(state.selectedRuleId)) || null;
  }

  function currentNewsSource() {
    return state.newsSources.find((source) => Number(source.id) === Number(state.selectedNewsSourceId)) || null;
  }

  function currentTimezone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  }

  function availableTimezones() {
    const fallback = [
      'UTC',
      'Europe/Kaliningrad',
      'Europe/Moscow',
      'Europe/Berlin',
      'Europe/London',
      'America/New_York',
      'America/Los_Angeles',
      'Asia/Tokyo',
      'Asia/Dubai',
    ];
    try {
      const supported = Intl.supportedValuesOf?.('timeZone');
      if (Array.isArray(supported) && supported.length) {
        return Array.from(new Set(['UTC', currentTimezone(), ...supported])).filter(Boolean);
      }
    } catch {}
    return Array.from(new Set([currentTimezone(), ...fallback])).filter(Boolean);
  }

  function timezoneOffsetMinutes(timezone, date = new Date()) {
    if (!timezone || timezone === 'UTC') return 0;
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).formatToParts(date).reduce((acc, part) => {
        if (part.type !== 'literal') acc[part.type] = part.value;
        return acc;
      }, {});
      const hour = Number(parts.hour || 0) % 24;
      const asUtc = Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        hour,
        Number(parts.minute || 0)
      );
      const utc = Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes()
      );
      return Math.round((asUtc - utc) / 60000);
    } catch {
      return 0;
    }
  }

  function timezoneOffsetLabel(timezone) {
    const minutes = timezoneOffsetMinutes(timezone);
    const sign = minutes >= 0 ? '+' : '-';
    const abs = Math.abs(minutes);
    const hours = String(Math.floor(abs / 60)).padStart(2, '0');
    const mins = String(abs % 60).padStart(2, '0');
    return `UTC${sign}${hours}:${mins}`;
  }

  function timezoneOptionLabel(timezone) {
    return `${timezoneOffsetLabel(timezone)} ${timezone}`;
  }

  function timezoneSearchText(timezone) {
    const offset = timezoneOffsetLabel(timezone);
    return [
      timezone,
      timezone.replace(/_/g, ' '),
      offset,
      offset.replace(':', ''),
      offset.replace('UTC', ''),
    ].join(' ').toLowerCase();
  }

  function setTimezoneOptions(selectedTimezone, query = null) {
    const select = $('#aiInitiativeTimezone');
    if (!select) return;
    const selected = cleanLabel(selectedTimezone || currentTimezone()) || 'UTC';
    const search = $('#aiInitiativeTimezoneSearch');
    const filter = query == null ? cleanLabel(search?.value || '') : cleanLabel(query);
    const zones = availableTimezones();
    if (!zones.includes(selected)) zones.unshift(selected);
    const normalizedFilter = filter.toLowerCase();
    const visibleZones = normalizedFilter
      ? zones.filter((zone) => timezoneSearchText(zone).includes(normalizedFilter))
      : zones;
    if (!visibleZones.includes(selected)) visibleZones.unshift(selected);
    select.innerHTML = visibleZones
      .map((zone) => `<option value="${escapeHtml(zone)}">${escapeHtml(timezoneOptionLabel(zone))}</option>`)
      .join('');
    select.value = selected;
  }

  async function saveDetectedTimezone() {
    const user = bridge().getCurrentUser?.();
    if (!user?.id || !api) return;
    const timezone = currentTimezone();
    try {
      await api('/api/user/timezone', { method: 'PUT', body: { timezone } });
    } catch {}
  }

  function setOptions(select, rows, labelFn) {
    if (!select) return;
    select.innerHTML = rows.map((row) => `<option value="${Number(row.id || 0)}">${escapeHtml(labelFn(row))}</option>`).join('');
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function cleanLabel(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function memberLabel(member = {}) {
    const name = cleanLabel(member.display_name || member.username || `#${member.id}`);
    const username = cleanLabel(member.username);
    const mention = cleanLabel(member.ai_bot_mention);
    const details = [];
    if (Number(member.is_ai_bot || 0)) details.push(t('AI bot'));
    if (member.ai_bot_provider) details.push(member.ai_bot_provider);
    if (mention) details.push(`@${mention}`);
    else if (username && username !== name) details.push(`@${username}`);
    return details.length ? `${name} (${details.join(', ')})` : name;
  }

  function chatTypeLabel(chat = {}) {
    if (Number(chat.is_notes || 0)) return t('Notes');
    if (chat.type === 'private') return t('Private chat');
    if (chat.type === 'general') return t('General chat');
    if (chat.type === 'group') return t('Group chat');
    return cleanLabel(chat.type || 'Chat');
  }

  function chatLabel(chat = {}) {
    const id = Number(chat.id || 0);
    const name = cleanLabel(chat.name);
    const genericPrivate = chat.type === 'private' && /^(private|личный)$/i.test(name);
    const title = name && !genericPrivate ? `${name} - ` : '';
    const members = chat.type === 'private' && Array.isArray(chat.members) ? chat.members.map(memberLabel).filter(Boolean) : [];
    const participants = members.length ? `: ${members.join(' <-> ')}` : '';
    return `${title}${chatTypeLabel(chat)} #${id}${participants}`;
  }

  function compactChatLabel(chat = {}) {
    const id = Number(chat.id || 0);
    const name = cleanLabel(chat.name);
    const genericPrivate = chat.type === 'private' && /^(private|личный)$/i.test(name);
    const title = name && !genericPrivate ? `${name} - ` : '';
    return `${title}${chatTypeLabel(chat)} #${id}`;
  }

  function promptPreviewLine(mode, newsCount = 1) {
    if (mode === 'news_hook') {
      return t('Use up to {count} random recent news items from the selected RSS source and let the bot play them through its persona.', {
        count: newsCount,
      });
    }
    if (mode === 'idle_ping') return t('Write a short check-in because the chat has been idle.');
    if (mode === 'custom') return t('Use the custom admin instruction below with recent chat context.');
    return t('Ask one relevant follow-up question based on recent chat context.');
  }

  function updateExplanations() {
    const mode = $('#aiInitiativePromptMode')?.value || 'context_question';
    const scheduleType = $('#aiInitiativeScheduleType')?.value || 'fixed';
    const newsCount = Number($('#aiInitiativeNewsItemCount')?.value || 1);
    const sameContextEnabled = !!$('#aiInitiativeSameContextLimitEnabled')?.checked;
    const maxRuns = $('#aiInitiativeSameContextMaxRuns');
    if (maxRuns) maxRuns.disabled = !sameContextEnabled;
    const isRandomWindow = scheduleType === 'random_window';
    $('#aiInitiativeFixedTimeField')?.classList.toggle('hidden', isRandomWindow);
    $('#aiInitiativeWindowStartField')?.classList.toggle('hidden', !isRandomWindow);
    $('#aiInitiativeWindowEndField')?.classList.toggle('hidden', !isRandomWindow);
    const isNews = mode === 'news_hook';
    [
      'aiInitiativeNewsSourceField',
      'aiInitiativeNewsMaxAgeField',
      'aiInitiativeNewsItemCountField',
      'aiInitiativeNewsContextField',
      'aiInitiativeNewsPromptField',
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', !isNews);
    });
    const hint = $('#aiInitiativeNewsSourceHint');
    if (hint) {
      const source = state.newsSources.find((item) => Number(item.id) === Number($('#aiInitiativeNewsSource')?.value || 0));
      hint.textContent = isNews
        ? [
          t('News source: {source}', { source: source ? `${source.name} - ${source.url}` : t('not selected') }),
          t('RSS source is fetched on the server and cached. If no recent item is available, the bot does not invent news.'),
        ].join(' ')
        : '';
    }
    const preview = $('#aiInitiativePromptPreview');
    if (preview) {
      preview.textContent = [
        t('Prompt sent to bot: {prompt}', { prompt: promptPreviewLine(mode, newsCount) }),
        t('Hidden scheduler mechanics are never shown to the user.'),
      ].join(' ');
    }
  }

  function renderRuleList() {
    const list = $('#aiInitiativeRuleList');
    if (!list) return;
    if (!state.rules.length) {
      list.innerHTML = `<div class="ai-bot-empty">${escapeHtml(t('No initiative rules yet. Create the first one.'))}</div>`;
      return;
    }
    list.innerHTML = state.rules.map((rule) => {
      const chat = state.chats.find((item) => Number(item.id) === Number(rule.chat_id));
      const bot = state.bots.find((item) => Number(item.id) === Number(rule.bot_id));
      const active = Number(rule.id) === Number(state.selectedRuleId);
      const schedule = rule.schedule_type === 'random_window'
        ? `${rule.window_start || '09:00'}-${rule.window_end || '18:00'}`
        : (rule.fixed_time || '09:00');
      return `
        <button type="button" class="ai-bot-list-item${active ? ' active' : ''}" data-ai-initiative-rule-id="${Number(rule.id)}">
          <div class="ai-bot-list-main">
            <strong>${escapeHtml(rule.name || bot?.name || `#${rule.id}`)}</strong>
            <small>${escapeHtml([bot?.name || `#${rule.bot_id}`, chat ? compactChatLabel(chat) : `#${rule.chat_id}`, t(rule.prompt_mode || 'context_question'), schedule, rule.enabled ? t('Enabled') : t('Disabled')].filter(Boolean).join(' / '))}</small>
          </div>
        </button>
      `;
    }).join('');
  }

  function fillForm(rule = null) {
    const chatSelect = $('#aiInitiativeChatSelect');
    const botSelect = $('#aiInitiativeBotSelect');
    const newsSourceSelect = $('#aiInitiativeNewsSource');
    setOptions(chatSelect, state.chats, chatLabel);
    setOptions(botSelect, state.bots, (bot) => `${bot.name || `#${bot.id}`} @${bot.mention || ''} (${bot.provider || 'ai'})`);
    setOptions(newsSourceSelect, state.newsSources, (source) => `${source.name || `#${source.id}`} (${source.url || 'RSS'})`);

    if (chatSelect) chatSelect.value = String(rule?.chat_id || bridge().getCurrentChatId?.() || state.chats[0]?.id || '');
    if (botSelect) botSelect.value = String(rule?.bot_id || state.bots[0]?.id || '');
    if (newsSourceSelect) newsSourceSelect.value = String(rule?.news_source_id || state.newsSources[0]?.id || '');
    const timezoneSearch = $('#aiInitiativeTimezoneSearch');
    if (timezoneSearch) timezoneSearch.value = '';
    setTimezoneOptions(rule?.timezone || currentTimezone());
    const promptMode = rule?.prompt_mode === 'date_holiday' ? 'news_hook' : (rule?.prompt_mode || 'context_question');
    const fields = {
      aiInitiativeRuleName: rule?.name || '',
      aiInitiativeScheduleType: rule?.schedule_type || 'fixed',
      aiInitiativeFixedTime: rule?.fixed_time || '09:00',
      aiInitiativeWindowStart: rule?.window_start || '09:00',
      aiInitiativeWindowEnd: rule?.window_end || '18:00',
      aiInitiativeIdleMinutes: rule?.idle_threshold_minutes ?? 1440,
      aiInitiativeGapMinutes: rule?.min_gap_minutes || 1440,
      aiInitiativeSameContextMaxRuns: rule?.same_context_max_runs || 1,
      aiInitiativePromptMode: promptMode,
      aiInitiativeNewsMaxAge: rule?.news_max_age_hours || 24,
      aiInitiativeNewsItemCount: rule?.news_item_count || 1,
      aiInitiativeNewsPrompt: rule?.news_prompt || '',
      aiInitiativeCustomPrompt: rule?.custom_prompt || '',
    };
    Object.entries(fields).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    });
    const enabled = $('#aiInitiativeEnabled');
    if (enabled) enabled.checked = !!rule?.enabled;
    const sameContextLimit = $('#aiInitiativeSameContextLimitEnabled');
    if (sameContextLimit) sameContextLimit.checked = rule?.same_context_limit_enabled !== false;
    const newsUseContext = $('#aiInitiativeNewsUseContext');
    if (newsUseContext) newsUseContext.checked = rule?.news_use_chat_context !== false;
    updateExplanations();
    renderRuleList();
  }

  function render() {
    renderRuleList();
    fillForm(currentRule());
    bridge().applyLocalizedDom?.($('#aiInitiativeModal'));
  }

  async function loadState() {
    const data = await api('/api/admin/ai-bot-initiatives');
    state.rules = Array.isArray(data.rules) ? data.rules : [];
    state.chats = Array.isArray(data.chats) ? data.chats : [];
    state.bots = Array.isArray(data.bots) ? data.bots : [];
    state.newsSources = Array.isArray(data.news_sources) ? data.news_sources : [];
    if (state.selectedRuleId && !state.rules.some((rule) => Number(rule.id) === Number(state.selectedRuleId))) {
      state.selectedRuleId = null;
    }
    if (!state.selectedRuleId && state.rules[0]) state.selectedRuleId = Number(state.rules[0].id);
    if (state.selectedNewsSourceId && !state.newsSources.some((source) => Number(source.id) === Number(state.selectedNewsSourceId))) {
      state.selectedNewsSourceId = null;
    }
    if (!state.selectedNewsSourceId && state.newsSources[0]) state.selectedNewsSourceId = Number(state.newsSources[0].id);
    state.loaded = true;
    render();
  }

  async function openModal() {
    bridge().openManagedModal?.('aiInitiativeModal', {
      replaceStack: false,
      opener: $('#settingsAiInitiativesPanel') || $('#openAiOpenBotInitiatives'),
    });
    status('Loading...', 'pending');
    try {
      if (state.loaded) render();
      await loadState();
      status('');
    } catch (error) {
      status(error.message || 'Could not load bot initiatives', 'error');
    }
  }

  function collectPayload() {
    return {
      name: $('#aiInitiativeRuleName')?.value || '',
      chat_id: Number($('#aiInitiativeChatSelect')?.value || 0),
      bot_id: Number($('#aiInitiativeBotSelect')?.value || 0),
      enabled: !!$('#aiInitiativeEnabled')?.checked,
      schedule_type: $('#aiInitiativeScheduleType')?.value || 'fixed',
      fixed_time: $('#aiInitiativeFixedTime')?.value || '09:00',
      window_start: $('#aiInitiativeWindowStart')?.value || '09:00',
      window_end: $('#aiInitiativeWindowEnd')?.value || '18:00',
      timezone: $('#aiInitiativeTimezone')?.value || currentTimezone(),
      idle_threshold_minutes: Number($('#aiInitiativeIdleMinutes')?.value || 1440),
      min_gap_minutes: Number($('#aiInitiativeGapMinutes')?.value || 1440),
      same_context_limit_enabled: !!$('#aiInitiativeSameContextLimitEnabled')?.checked,
      same_context_max_runs: Number($('#aiInitiativeSameContextMaxRuns')?.value || 1),
      prompt_mode: $('#aiInitiativePromptMode')?.value || 'context_question',
      news_source_id: Number($('#aiInitiativeNewsSource')?.value || 0) || null,
      news_max_age_hours: Number($('#aiInitiativeNewsMaxAge')?.value || 24),
      news_item_count: Number($('#aiInitiativeNewsItemCount')?.value || 1),
      news_use_chat_context: !!$('#aiInitiativeNewsUseContext')?.checked,
      news_prompt: $('#aiInitiativeNewsPrompt')?.value || '',
      custom_prompt: $('#aiInitiativeCustomPrompt')?.value || '',
    };
  }

  function mergeState(data) {
    if (data?.state) {
      state.rules = Array.isArray(data.state.rules) ? data.state.rules : state.rules;
      state.chats = Array.isArray(data.state.chats) ? data.state.chats : state.chats;
      state.bots = Array.isArray(data.state.bots) ? data.state.bots : state.bots;
      state.newsSources = Array.isArray(data.state.news_sources) ? data.state.news_sources : state.newsSources;
    }
  }

  async function saveRule() {
    const payload = collectPayload();
    if (!payload.chat_id || !payload.bot_id) {
      status('Select chat and bot', 'error');
      return;
    }
    const id = Number(state.selectedRuleId || 0);
    const exists = id && state.rules.some((rule) => Number(rule.id) === id);
    status('Saving...', 'pending');
    try {
      const data = await api(exists ? `/api/admin/ai-bot-initiatives/rules/${id}` : '/api/admin/ai-bot-initiatives/rules', {
        method: exists ? 'PUT' : 'POST',
        body: payload,
      });
      mergeState(data);
      state.selectedRuleId = Number(data.rule?.id || id || 0) || null;
      render();
      status('Initiative rule saved', 'success');
    } catch (error) {
      status(error.message || 'Could not save initiative rule', 'error');
    }
  }

  async function deleteRule() {
    const id = Number(state.selectedRuleId || 0);
    if (!id) return;
    status('Deleting...', 'pending');
    try {
      const data = await api(`/api/admin/ai-bot-initiatives/rules/${id}`, { method: 'DELETE' });
      mergeState(data);
      state.selectedRuleId = state.rules[0]?.id || null;
      render();
      status('Initiative rule deleted', 'success');
    } catch (error) {
      status(error.message || 'Could not delete initiative rule', 'error');
    }
  }

  async function testRule() {
    const id = Number(state.selectedRuleId || 0);
    const out = $('#aiInitiativeTestResult');
    if (!id) {
      status('Save rule before testing', 'error');
      return;
    }
    if (out) out.textContent = t('Testing...');
    try {
      const data = await api(`/api/admin/ai-bot-initiatives/rules/${id}/test`, { method: 'POST', body: {} });
      if (out) out.textContent = data.result?.text || t('No test text returned');
    } catch (error) {
      if (out) out.textContent = error.message || t('Initiative test failed');
    }
  }

  function newRule() {
    state.selectedRuleId = null;
    fillForm(null);
    status('');
    const out = $('#aiInitiativeTestResult');
    if (out) out.textContent = '';
  }

  function renderNewsSourceList() {
    const list = $('#aiInitiativeNewsSourceList');
    if (!list) return;
    if (!state.newsSources.length) {
      list.innerHTML = `<div class="ai-bot-empty">${escapeHtml(t('No news sources yet. Create the first one.'))}</div>`;
      return;
    }
    list.innerHTML = state.newsSources.map((source) => {
      const active = Number(source.id) === Number(state.selectedNewsSourceId);
      return `
        <button type="button" class="ai-bot-list-item${active ? ' active' : ''}" data-ai-news-source-id="${Number(source.id || 0)}">
          <div class="ai-bot-list-main">
            <strong>${escapeHtml(source.name || `#${source.id}`)}</strong>
            <small>${escapeHtml([source.url || 'RSS', source.enabled ? t('Enabled') : t('Disabled')].filter(Boolean).join(' / '))}</small>
          </div>
        </button>
      `;
    }).join('');
  }

  function fillNewsSourceForm(source = null) {
    const fields = {
      aiInitiativeNewsSourceName: source?.name || 'Lenta.ru top7',
      aiInitiativeNewsSourceUrl: source?.url || 'https://lenta.ru/rss/top7',
      aiInitiativeNewsSourceTtl: source?.cache_ttl_minutes || 30,
    };
    Object.entries(fields).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    });
    const enabled = $('#aiInitiativeNewsSourceEnabled');
    if (enabled) enabled.checked = source?.enabled !== false;
    renderNewsSourceList();
    bridge().applyLocalizedDom?.($('#aiInitiativeNewsSourcesModal'));
  }

  async function openNewsSourcesModal() {
    bridge().openManagedModal?.('aiInitiativeNewsSourcesModal', {
      replaceStack: false,
      opener: $('#aiInitiativeManageNewsSources'),
    });
    if (!state.loaded) {
      try { await loadState(); } catch {}
    }
    if (!state.selectedNewsSourceId && state.newsSources[0]) state.selectedNewsSourceId = Number(state.newsSources[0].id);
    fillNewsSourceForm(currentNewsSource());
    newsSourceStatus('');
  }

  function collectNewsSourcePayload() {
    return {
      name: $('#aiInitiativeNewsSourceName')?.value || '',
      type: 'rss',
      url: $('#aiInitiativeNewsSourceUrl')?.value || '',
      enabled: !!$('#aiInitiativeNewsSourceEnabled')?.checked,
      cache_ttl_minutes: Number($('#aiInitiativeNewsSourceTtl')?.value || 30),
    };
  }

  function newNewsSource() {
    state.selectedNewsSourceId = null;
    fillNewsSourceForm(null);
    newsSourceStatus('');
    const out = $('#aiInitiativeNewsSourceTestResult');
    if (out) out.textContent = '';
  }

  async function saveNewsSource() {
    const payload = collectNewsSourcePayload();
    const id = Number(state.selectedNewsSourceId || 0);
    const exists = id && state.newsSources.some((source) => Number(source.id) === id);
    newsSourceStatus('Saving...', 'pending');
    try {
      const data = await api(exists ? `/api/admin/ai-bot-initiatives/news-sources/${id}` : '/api/admin/ai-bot-initiatives/news-sources', {
        method: exists ? 'PUT' : 'POST',
        body: payload,
      });
      mergeState(data);
      state.selectedNewsSourceId = Number(data.source?.id || id || 0) || null;
      render();
      fillNewsSourceForm(currentNewsSource());
      newsSourceStatus('News source saved', 'success');
    } catch (error) {
      newsSourceStatus(error.message || 'Could not save news source', 'error');
    }
  }

  async function deleteNewsSource() {
    const id = Number(state.selectedNewsSourceId || 0);
    if (!id) return;
    newsSourceStatus('Deleting...', 'pending');
    try {
      const data = await api(`/api/admin/ai-bot-initiatives/news-sources/${id}`, { method: 'DELETE' });
      mergeState(data);
      state.selectedNewsSourceId = state.newsSources[0]?.id || null;
      render();
      fillNewsSourceForm(currentNewsSource());
      newsSourceStatus('News source deleted', 'success');
    } catch (error) {
      newsSourceStatus(error.message || 'Could not delete news source', 'error');
    }
  }

  async function testNewsSource() {
    const id = Number(state.selectedNewsSourceId || 0);
    const out = $('#aiInitiativeNewsSourceTestResult');
    if (!id) {
      newsSourceStatus('Save source before testing', 'error');
      return;
    }
    if (out) out.textContent = t('Testing...');
    try {
      const data = await api(`/api/admin/ai-bot-initiatives/news-sources/${id}/test`, { method: 'POST', body: {} });
      const items = Array.isArray(data.items) ? data.items : [];
      if (!out) return;
      out.innerHTML = items.length
        ? items.map((item) => `
          <div class="ai-initiative-news-test-item">
            <strong>${escapeHtml(item.title || t('News item'))}</strong>
            <small>${escapeHtml([item.published_at || '', item.url || ''].filter(Boolean).join(' / '))}</small>
          </div>
        `).join('')
        : escapeHtml(t('No recent news returned'));
    } catch (error) {
      if (out) out.textContent = error.message || t('News source test failed');
    }
  }

  async function loadReminders() {
    const chatId = Number(bridge().getCurrentChatId?.() || 0);
    const list = $('#chatRemindersList');
    if (!chatId || !list || !api) return;
    reminderStatus('Loading...', 'pending');
    try {
      const data = await api(`/api/chats/${chatId}/reminders`);
      const reminders = Array.isArray(data.reminders) ? data.reminders : [];
      if (!reminders.length) {
        list.innerHTML = `<div class="ai-bot-empty">${escapeHtml(t('No active reminders'))}</div>`;
      } else {
        list.innerHTML = reminders.map((reminder) => `
          <div class="ai-initiative-reminder-row" data-reminder-id="${Number(reminder.id || 0)}">
            <div>
              <strong>${escapeHtml(reminder.reminder_text || t('Reminder'))}</strong>
              <small>${escapeHtml(formatReminderTime(reminder.due_at, reminder.requester_timezone))}</small>
            </div>
            <button type="button" class="weather-action-btn" data-cancel-reminder="${Number(reminder.id || 0)}">${escapeHtml(t('Cancel'))}</button>
          </div>
        `).join('');
      }
      reminderStatus('');
      bridge().applyLocalizedDom?.($('#chatRemindersSection'));
    } catch (error) {
      reminderStatus(error.message || 'Could not load reminders', 'error');
    }
  }

  function formatReminderTime(value, timezone) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value || '';
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: timezone || currentTimezone(),
      }).format(date);
    } catch {
      return date.toLocaleString();
    }
  }

  async function cancelReminder(id) {
    if (!id) return;
    reminderStatus('Canceling...', 'pending');
    try {
      await api(`/api/reminders/${id}`, { method: 'DELETE' });
      await loadReminders();
      bridge().showToast?.(t('Reminder canceled'));
    } catch (error) {
      reminderStatus(error.message || 'Could not cancel reminder', 'error');
    }
  }

  function bind() {
    bridge().registerManagedModal?.('aiInitiativeModal');
    bridge().registerManagedModal?.('aiInitiativeNewsSourcesModal');
    $('#settingsAiInitiativesPanel')?.addEventListener('click', openModal);
    $('#openAiOpenBotInitiatives')?.addEventListener('click', openModal);
    $('#aiInitiativeNewRule')?.addEventListener('click', newRule);
    $('#aiInitiativeSaveRule')?.addEventListener('click', saveRule);
    $('#aiInitiativeDeleteRule')?.addEventListener('click', deleteRule);
    $('#aiInitiativeTestRule')?.addEventListener('click', testRule);
    $('#aiInitiativeManageNewsSources')?.addEventListener('click', openNewsSourcesModal);
    $('#aiInitiativeNewNewsSource')?.addEventListener('click', newNewsSource);
    $('#aiInitiativeSaveNewsSource')?.addEventListener('click', saveNewsSource);
    $('#aiInitiativeDeleteNewsSource')?.addEventListener('click', deleteNewsSource);
    $('#aiInitiativeTestNewsSource')?.addEventListener('click', testNewsSource);
    [
      'aiInitiativeScheduleType',
      'aiInitiativePromptMode',
      'aiInitiativeNewsSource',
      'aiInitiativeNewsMaxAge',
      'aiInitiativeNewsItemCount',
      'aiInitiativeNewsUseContext',
      'aiInitiativeSameContextLimitEnabled',
      'aiInitiativeSameContextMaxRuns',
    ].forEach((id) => {
      const el = document.getElementById(id);
      el?.addEventListener('change', updateExplanations);
      el?.addEventListener('input', updateExplanations);
    });
    $('#aiInitiativeTimezone')?.addEventListener('change', updateExplanations);
    $('#aiInitiativeTimezoneSearch')?.addEventListener('input', () => {
      setTimezoneOptions($('#aiInitiativeTimezone')?.value || currentTimezone(), $('#aiInitiativeTimezoneSearch')?.value || '');
      updateExplanations();
    });
    $('#aiInitiativeRuleList')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-ai-initiative-rule-id]');
      if (!button) return;
      state.selectedRuleId = Number(button.dataset.aiInitiativeRuleId || 0) || null;
      fillForm(currentRule());
      status('');
    });
    $('#aiInitiativeNewsSourceList')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-ai-news-source-id]');
      if (!button) return;
      state.selectedNewsSourceId = Number(button.dataset.aiNewsSourceId || 0) || null;
      fillNewsSourceForm(currentNewsSource());
      newsSourceStatus('');
    });
    $('#chatRemindersList')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-cancel-reminder]');
      if (button) cancelReminder(Number(button.dataset.cancelReminder || 0));
    });
    window.addEventListener('bananza:chatinfoopen', loadReminders);
    window.addEventListener('bananza:languagechange', () => {
      render();
      if (!$('#chatInfoModal')?.classList.contains('hidden')) loadReminders();
    });
    saveDetectedTimezone();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }
  window.addEventListener('bananza:ready', () => {
    saveDetectedTimezone();
    if (!$('#chatInfoModal')?.classList.contains('hidden')) loadReminders();
  });
})();
