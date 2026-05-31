(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const aiAdmin = root.aiAdmin = root.aiAdmin || {};
  const formatters = root.formatters || {};
  const esc = typeof formatters.esc === 'function'
    ? formatters.esc
    : (value) => String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  const initials = typeof formatters.initials === 'function'
    ? formatters.initials
    : (value) => String(value || '?').trim().slice(0, 2).toUpperCase() || '?';

  function toArray(value) {
    return Array.isArray(value) ? value : [value];
  }

  function createDomAccess(dom = {}) {
    const query = typeof dom.$ === 'function'
      ? (selector, base = document) => dom.$(selector, base)
      : (selector, base = document) => base?.querySelector?.(selector) || null;
    const queryAll = typeof dom.$$ === 'function'
      ? (selector, base = document) => dom.$$(selector, base)
      : (selector, base = document) => Array.from(base?.querySelectorAll?.(selector) || []);
    const byId = (id) => {
      if (!id) return null;
      if (typeof id !== 'string') return id;
      return document.getElementById(id.replace(/^#/, '')) || query(id);
    };
    return { $: query, $$: queryAll, byId };
  }

  function setInlineStatus(targetIds, message, type = '', options = {}) {
    const dom = createDomAccess(options.dom || {});
    toArray(targetIds).forEach((targetId) => {
      const el = dom.byId(targetId);
      if (!el) return;
      el.textContent = String(message == null ? '' : message);
      el.classList.toggle('is-error', type === 'error');
      el.classList.toggle('is-success', type === 'success');
      el.classList.toggle('is-pending', type === 'pending');
      el.classList.toggle('is-warning', type === 'warning');
    });
  }

  function resolveButtons(targetIds, dom = {}) {
    const access = createDomAccess(dom);
    return toArray(targetIds).map((targetId) => access.byId(targetId)).filter(Boolean);
  }

  function setActionButtonsPending(targetIds, pending = false, pendingLabel = '', options = {}) {
    const buttons = resolveButtons(targetIds, options.dom || {});
    buttons.forEach((button) => {
      if (pending) {
        button.dataset.pendingRestoreLabel = button.textContent || '';
        button.dataset.pendingRestoreDisabled = button.disabled ? '1' : '0';
        button.dataset.adminBusy = '1';
        button.disabled = true;
        button.classList.add('is-pending');
        button.setAttribute('aria-busy', 'true');
        if (pendingLabel) button.textContent = pendingLabel;
        return;
      }
      const restoreDisabled = button.dataset.pendingRestoreDisabled === '1';
      if (Object.prototype.hasOwnProperty.call(button.dataset, 'pendingRestoreLabel')) {
        button.textContent = button.dataset.pendingRestoreLabel;
      }
      button.disabled = restoreDisabled;
      button.classList.remove('is-pending');
      button.removeAttribute('aria-busy');
      delete button.dataset.adminBusy;
      delete button.dataset.pendingRestoreLabel;
      delete button.dataset.pendingRestoreDisabled;
    });
    return buttons;
  }

  async function withActionButtons(targetIds, pendingLabel, task, options = {}) {
    const buttons = resolveButtons(targetIds, options.dom || {});
    if (buttons.some((button) => button.dataset.adminBusy === '1')) return undefined;
    setActionButtonsPending(buttons, true, pendingLabel, options);
    try {
      return await task();
    } finally {
      setActionButtonsPending(buttons, false, '', options);
    }
  }

  function bindAsyncActionButtons(triggerIds, targetIds, pendingLabel, task, options = {}) {
    resolveButtons(triggerIds, options.dom || {}).forEach((button) => {
      button.addEventListener('click', () => {
        withActionButtons(targetIds == null ? triggerIds : targetIds, pendingLabel, task, options).catch((error) => {
          options.onError?.(error);
        });
      });
    });
  }

  function valueOf(id, dom = {}, fallback = '') {
    const el = createDomAccess(dom).byId(id);
    return el ? String(el.value || '').trim() : fallback;
  }

  function checkedOf(id, dom = {}, fallback = false) {
    const el = createDomAccess(dom).byId(id);
    return el ? Boolean(el.checked) : Boolean(fallback);
  }

  function numberOf(id, dom = {}, fallback = 0) {
    const value = Number(valueOf(id, dom, fallback));
    return Number.isFinite(value) ? value : fallback;
  }

  function setValue(id, value, dom = {}) {
    const el = createDomAccess(dom).byId(id);
    if (el) el.value = value == null ? '' : String(value);
  }

  function setChecked(id, value, dom = {}) {
    const el = createDomAccess(dom).byId(id);
    if (el) el.checked = Boolean(value);
  }

  function uniqueAiModelValues(values = []) {
    const seen = new Set();
    const result = [];
    values.forEach((value) => {
      const text = String(value || '').trim();
      if (!text) return;
      const key = text.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      result.push(text);
    });
    return result;
  }

  function setSelectOptions(id, values = [], currentValue = '', options = {}) {
    const select = createDomAccess(options.dom || {}).byId(id);
    if (!select) return [];
    const current = String(currentValue || '').trim();
    const nextValues = uniqueAiModelValues([current, ...values]);
    select.innerHTML = nextValues.map((value) => `<option value="${esc(value)}">${esc(value)}</option>`).join('');
    if (current) select.value = current;
    return nextValues;
  }

  function renderBotAvatar(config = {}) {
    const dom = createDomAccess(config.dom || {});
    const bot = config.bot || null;
    const avatarEl = dom.byId(config.avatarId || config.avatarEl);
    if (!avatarEl) return;
    const name = bot?.name || valueOf(config.nameInputId, config.dom, config.defaultName || 'AI');
    const color = bot?.avatar_color || config.defaultColor || '#65aadd';
    avatarEl.style.background = color;
    if (bot?.avatar_url) {
      avatarEl.innerHTML = `<img class="avatar-img" src="${esc(bot.avatar_url)}" alt="">`;
    } else {
      avatarEl.textContent = initials(name);
    }
    const hasSavedBot = Boolean(bot?.id);
    const input = dom.byId(config.inputId);
    const label = dom.byId(config.labelId);
    const removeButton = dom.byId(config.removeButtonId);
    if (input) {
      input.disabled = !hasSavedBot;
      input.value = '';
    }
    if (label) {
      label.classList.toggle('ai-bot-avatar-label-disabled', !hasSavedBot);
      label.title = hasSavedBot ? 'Change avatar' : 'Save the bot first';
    }
    removeButton?.classList?.toggle('hidden', !hasSavedBot || !bot?.avatar_url);
  }

  async function uploadBotAvatar({ api, url, file, fieldName = 'avatar' } = {}) {
    if (!file || typeof api !== 'function' || !url) return null;
    const body = new FormData();
    body.append(fieldName, file);
    return api(url, { method: 'POST', body });
  }

  async function removeBotAvatar({ api, url } = {}) {
    if (typeof api !== 'function' || !url) return null;
    return api(url, { method: 'DELETE' });
  }

  function filenameFromContentDisposition(header, fallback) {
    const match = String(header || '').match(/filename="?([^";]+)"?/i);
    return match ? match[1] : fallback;
  }

  async function exportJson({ fetchImpl = fetch, url, token = '', fallbackName = 'bananza-bot.json' } = {}) {
    if (!url) throw new Error('Export URL is required');
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetchImpl(url, { headers });
    if (!response.ok) {
      let data = {};
      try { data = await response.json(); } catch (e) {}
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const filename = filenameFromContentDisposition(response.headers.get('content-disposition'), fallbackName);
    if (typeof URL !== 'undefined' && URL.createObjectURL && document?.body) {
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    }
    return { blob, filename };
  }

  async function importJsonFile({ api, file, url } = {}) {
    if (!file || typeof api !== 'function' || !url) return null;
    const payload = JSON.parse(await file.text());
    return api(url, { method: 'POST', body: payload });
  }

  const botSaveBooleanFields = new Set([
    'enabled',
    'visible_to_users',
    'allow_text',
    'allow_image_generate',
    'allow_image_edit',
    'allow_document',
    'allow_poll_create',
    'allow_poll_vote',
    'allow_react',
    'allow_pin',
    'image_risk_filter_enabled',
  ]);
  const botSaveNumericFields = new Set(['temperature', 'max_tokens']);

  function normalizeBotSaveComparisonValue(key, value) {
    if (botSaveBooleanFields.has(key) || typeof value === 'boolean') return value ? 1 : 0;
    if (botSaveNumericFields.has(key) || typeof value === 'number') {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : null;
    }
    return String(value ?? '').trim();
  }

  function verifyBotSaveResponse(bot, payload = {}) {
    if (!bot || !payload || typeof payload !== 'object') {
      return { ok: false, mismatches: ['server_response'] };
    }
    const mismatches = Object.keys(payload).filter((key) => (
      normalizeBotSaveComparisonValue(key, bot[key]) !== normalizeBotSaveComparisonValue(key, payload[key])
    ));
    return { ok: mismatches.length === 0, mismatches };
  }

  function buildVerifiedBotSaveStatus(savedLabel, bot, payload = {}, detailLine = '') {
    const verification = verifyBotSaveResponse(bot, payload);
    if (verification.ok) {
      return {
        type: 'success',
        message: [savedLabel, 'Values were saved on the server.', detailLine].filter(Boolean).join('\n'),
      };
    }
    return {
      type: 'error',
      message: [
        savedLabel,
        'Server returned different values. The form was refreshed from saved state.',
        verification.mismatches.length ? `Fields: ${verification.mismatches.join(', ')}` : '',
        detailLine,
      ].filter(Boolean).join('\n'),
    };
  }

  function formatBotAuditSource(source) {
    const value = String(source || '').toLowerCase();
    if (value === 'chat_add') return 'Chat add';
    if (value === 'auto_join') return 'Auto join';
    if (value === 'restore') return 'Restore';
    return source ? String(source) : 'Unknown';
  }

  async function openAdminBotAuditModal(options = {}) {
    const { api, dom = {}, services = {}, userId, displayName = 'User' } = options;
    if (!userId || typeof api !== 'function') return null;
    const access = createDomAccess(dom);
    const title = access.byId('adminBotAuditTitle');
    const status = access.byId('adminBotAuditStatus');
    const list = access.byId('adminBotAuditList');
    if (title) title.textContent = `Bot audit: ${displayName}`;
    if (status) status.textContent = 'Loading...';
    if (list) list.innerHTML = '';
    services.modals?.open?.('adminBotAuditModal', { replaceStack: false });
    const data = await api(`/api/admin/users/${userId}/bot-additions`);
    const additions = Array.isArray(data?.additions) ? data.additions : [];
    if (status) status.textContent = additions.length ? '' : 'No bot additions recorded yet.';
    if (list) {
      list.innerHTML = additions.map((entry) => `
        <div class="admin-user-row">
          <div class="audit-entry-copy">
            <div class="name">${esc(entry.bot_name || 'Bot')}</div>
            <div class="audit-entry-meta">${esc(formatBotAuditSource(entry.source))}</div>
          </div>
        </div>
      `).join('');
    }
    return data;
  }

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value == null ? null : value));
  }

  function mergeProviderState(current, data = {}) {
    const incoming = data.state || data || {};
    return {
      settings: incoming.settings || current.settings || {},
      bots: Array.isArray(incoming.bots) ? incoming.bots : (current.bots || []),
      imageBots: Array.isArray(incoming.imageBots) ? incoming.imageBots : (current.imageBots || []),
      universalBots: Array.isArray(incoming.universalBots) ? incoming.universalBots : (current.universalBots || []),
      chats: Array.isArray(incoming.chats) ? incoming.chats : (current.chats || []),
      chatSettings: Array.isArray(incoming.chatSettings) ? incoming.chatSettings : (current.chatSettings || []),
      models: incoming.models || current.models || {},
    };
  }

  function createProviderController(config = {}, options = {}) {
    const api = options.api || config.api;
    if (typeof api !== 'function') throw new Error(`${config.name || 'AI'} admin api is required`);
    const dom = options.dom || {};
    const services = options.services || {};
    const fetchImpl = options.fetch || window.fetch?.bind(window);
    const getToken = options.getToken || (() => options.token || window.BananzaAppBridge?.getToken?.() || '');
    const defaults = cloneJson(config.defaults || {});
    let state = mergeProviderState(defaults, defaults);
    const selectedIds = {
      text: null,
      image: null,
      universal: null,
    };

    function endpoint(kind = 'text') {
      const routes = config.routes || {};
      return routes[kind] || routes.text || routes.base;
    }

    function kindListName(kind = 'text') {
      if (kind === 'image') return 'imageBots';
      if (kind === 'universal') return 'universalBots';
      return 'bots';
    }

    function listForKind(kind = 'text') {
      return state[kindListName(kind)] || [];
    }

    function selectedId(kind = 'text') {
      return Number(selectedIds[kind] || 0);
    }

    function setSelectedId(kind = 'text', id = 0) {
      selectedIds[kind] = Number(id || 0) || null;
      return selectedIds[kind];
    }

    function currentBot(kind = 'text') {
      const id = selectedId(kind);
      return listForKind(kind).find((bot) => Number(bot.id) === id) || listForKind(kind)[0] || null;
    }

    function mergeState(data = {}) {
      state = mergeProviderState(state, data);
      ['text', 'image', 'universal'].forEach((kind) => {
        const list = listForKind(kind);
        if (selectedIds[kind] && !list.some((bot) => Number(bot.id) === Number(selectedIds[kind]))) {
          selectedIds[kind] = null;
        }
        if (!selectedIds[kind] && list[0]) selectedIds[kind] = Number(list[0].id) || null;
      });
      options.onStateChange?.(state, data);
      return state;
    }

    function renderSettings() {
      const rootId = config.rootId;
      const rootEl = rootId ? createDomAccess(dom).byId(rootId) : null;
      if (rootEl) rootEl.dataset.aiAdminRendered = config.name || 'provider';
      options.renderSettings?.(state);
      return state;
    }

    function openSettingsModal() {
      if (config.modalId) services.modals?.open?.(config.modalId, { replaceStack: false });
      return renderSettings();
    }

    async function loadState(kind = 'text', extra = '') {
      const url = extra || endpoint(kind);
      const data = await api(url);
      mergeState(data);
      renderSettings();
      return data;
    }

    async function saveSettings(payload = options.getSettingsPayload?.() || {}) {
      const data = await api(config.routes?.settings || `${endpoint('text')}/settings`, {
        method: 'PUT',
        body: payload,
      });
      mergeState(data);
      renderSettings();
      return data;
    }

    async function saveBot(payload = {}, kind = payload.kind || 'text') {
      const list = listForKind(kind);
      const id = selectedId(kind);
      const shouldUpdate = Boolean(id && list.some((bot) => Number(bot.id) === id));
      const base = endpoint(kind);
      const data = await api(shouldUpdate ? `${base}/${id}` : base, {
        method: shouldUpdate ? 'PUT' : 'POST',
        body: payload,
      });
      mergeState(data);
      setSelectedId(kind, data.bot?.id || id);
      renderSettings();
      return data;
    }

    async function disableBot(kind = 'text') {
      const id = selectedId(kind);
      if (!id) return null;
      const data = await api(`${endpoint(kind)}/${id}`, { method: 'DELETE' });
      mergeState(data);
      renderSettings();
      return data;
    }

    async function testBot(kind = 'text', payload = {}) {
      const id = selectedId(kind);
      if (!id) throw new Error('Save the bot first');
      return api(`${endpoint(kind)}/${id}/test`, { method: 'POST', body: payload });
    }

    async function uploadBotAvatar(file, kind = 'text') {
      const id = selectedId(kind);
      if (!id) throw new Error('Save the bot first');
      const data = await uploadBotAvatarHelper({ api, url: `${endpoint(kind)}/${id}/avatar`, file });
      mergeState(data || {});
      renderSettings();
      return data;
    }

    async function removeBotAvatar(kind = 'text') {
      const id = selectedId(kind);
      if (!id) return null;
      const data = await removeBotAvatarHelper({ api, url: `${endpoint(kind)}/${id}/avatar` });
      mergeState(data || {});
      renderSettings();
      return data;
    }

    async function exportBotJson(kind = 'text') {
      const id = selectedId(kind);
      if (!id) throw new Error('Choose a saved bot first');
      const bot = currentBot(kind);
      return exportJson({
        fetchImpl,
        token: getToken(),
        url: `${endpoint(kind)}/${id}/export`,
        fallbackName: `bananza-${config.slug || 'ai'}-${kind}-${bot?.mention || id}.json`,
      });
    }

    async function importBotJsonFile(file, kind = 'text') {
      const data = await importJsonFile({ api, file, url: `${endpoint(kind)}/import` });
      mergeState(data || {});
      setSelectedId(kind, data?.bot?.id || selectedId(kind));
      renderSettings();
      return data;
    }

    async function saveChatBotSettings(payload = {}, kind = 'text') {
      const data = await api(`${endpoint(kind)}/chat-settings`, { method: 'PUT', body: payload });
      mergeState(data || {});
      renderSettings();
      return data;
    }

    async function callExtra(name, payload = {}, method = 'POST') {
      const url = config.routes?.[name];
      if (!url) throw new Error(`Unknown ${config.name || 'provider'} action: ${name}`);
      const data = await api(url, { method, body: payload });
      mergeState(data || {});
      renderSettings();
      return data;
    }

    const controller = {
      callExtra,
      currentBot,
      disableBot,
      exportBotJson,
      getSelectedId: selectedId,
      getState: () => state,
      importBotJsonFile,
      loadState,
      mergeState,
      openSettingsModal,
      removeBotAvatar,
      renderSettings,
      saveBot,
      saveChatBotSettings,
      saveSettings,
      setSelectedId,
      testBot,
      uploadBotAvatar,
    };
    return Object.assign(controller, options.extraMethods?.(controller, { api, config, dom, services }) || {});
  }

  const uploadBotAvatarHelper = uploadBotAvatar;
  const removeBotAvatarHelper = removeBotAvatar;

  aiAdmin.shared = {
    bindAsyncActionButtons,
    buildVerifiedBotSaveStatus,
    checkedOf,
    createDomAccess,
    createProviderController,
    esc,
    exportJson,
    filenameFromContentDisposition,
    formatBotAuditSource,
    importJsonFile,
    initials,
    normalizeBotSaveComparisonValue,
    numberOf,
    openAdminBotAuditModal,
    removeBotAvatar,
    renderBotAvatar,
    setActionButtonsPending,
    setChecked,
    setInlineStatus,
    setModelSelectOptions: setSelectOptions,
    setSelectOptions,
    setStaticSelectOptions: setSelectOptions,
    setValue,
    uniqueAiModelValues,
    uploadBotAvatar,
    valueOf,
    verifyBotSaveResponse,
    withActionButtons,
  };
})();
