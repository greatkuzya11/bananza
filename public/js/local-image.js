(function () {
  'use strict';
  const byId = (id) => document.getElementById(id);
  const bridge = () => window.BananzaAppBridge;
  const tx = (key, params) => bridge()?.tx?.(key, params) || key;
  const shared = () => window.BananzaApp.aiAdmin.shared;
  const endpoint = '/api/admin/local-image-bots';
  let state = { bots: [], chats: [], chatSettings: [], settings: {} };
  let selectedId = null;
  let controller = null;
  let initialized = false;

  function status(text) { byId('localImageStatus').textContent = tx(text); }
  function options(id, rows, label, value) {
    const select = byId(id);
    const previous = select.value;
    select.replaceChildren(...rows.map((row) => new Option(label(row), value(row))));
    if ([...select.options].some((option) => option.value === previous)) select.value = previous;
  }
  function editBot(bot) {
    selectedId = bot?.id || null;
    byId('localImageBotName').value = bot?.name || 'Qwen Image';
    byId('localImageBotMention').value = bot?.mention || 'qwenimage';
    byId('localImageBotSize').value = bot?.image_resolution || state.settings.local_image_default_size || '1024x1024';
    byId('localImageBotEnabled').checked = bot?.enabled !== false;
    byId('localImageBotGenerate').checked = bot?.allow_image_generate !== false;
    byId('localImageBotEdit').checked = bot?.allow_image_edit !== false;
    byId('localImageBotVisible').checked = bot?.visible_to_users !== false;
    byId('localImageTest').disabled = !selectedId;
    byId('localImageChatSave').disabled = !selectedId;
    byId('localImageBotDisable').disabled = !selectedId;
    byId('localImageBotHistory').disabled = !selectedId;
    renderBotList();
    renderAvatar(bot);
    syncChat();
  }
  function render(next) {
    state = next;
    const settings = state.settings;
    byId('localImageEnabled').checked = !!settings.local_image_enabled;
    byId('localImageBaseUrl').value = settings.local_image_base_url;
    byId('localImageModel').value = settings.local_image_default_model;
    byId('localImageTimeout').value = settings.local_image_timeout_ms / 1000;
    options('localImageSize', state.models.size, (size) => size, (size) => size);
    options('localImageBotSize', state.models.size, (size) => size, (size) => size);
    byId('localImageSize').value = settings.local_image_default_size;
    options('localImageChat', state.chats, (chat) => chat.option_label || chat.name, (chat) => chat.id);
    editBot(state.bots.find((bot) => Number(bot.id) === Number(selectedId)) || state.bots[0]);
  }
  function renderAvatar(bot = state.bots.find((item) => item.id === selectedId)) {
    if (!shared()) return;
    shared().renderBotAvatar({ bot, avatarId: 'localImageBotAvatar', nameInputId: 'localImageBotName',
      inputId: 'localImageBotAvatarInput', labelId: 'localImageBotAvatarLabel', removeButtonId: 'localImageBotAvatarRemove' });
    byId('localImageBotAvatarLabel').dataset.i18nTitle = selectedId ? 'Change avatar' : 'Save the bot first';
    byId('localImageBotAvatarLabel').title = tx(selectedId ? 'Change avatar' : 'Save the bot first');
  }
  function renderBotList() {
    if (!shared()) return;
    const esc = shared().esc;
    byId('localImageBotList').innerHTML = state.bots.length ? state.bots.map((bot) => `
      <div class="ai-bot-list-row">
        <button type="button" class="ai-bot-list-item${bot.id === selectedId ? ' active' : ''}" data-bot-id="${bot.id}">
          <span class="ai-bot-list-main">
            <span class="ai-bot-list-avatar" style="background:${esc(bot.avatar_color || '#65aadd')}">
              ${bot.avatar_url ? `<img class="avatar-img" src="${esc(bot.avatar_url)}" alt="" loading="lazy">` : esc(shared().initials(bot.name))}
            </span>
            <span class="ai-bot-list-copy"><strong>${esc(bot.name)}</strong><small>@${esc(bot.mention)} · ${esc(tx(bot.enabled ? 'Enabled' : 'Disabled'))}</small></span>
          </span>
          <span class="ai-bot-list-model">${esc(bot.image_resolution)}</span>
        </button>
        ${shared().renderBotHistoryButton(bot)}
      </div>`).join('') : `<div class="ai-bot-empty">${esc(tx('No image bots yet. Create the first one.'))}</div>`;
  }
  function syncChat() {
    const setting = state.chatSettings.find((row) => Number(row.bot_id) === Number(selectedId) && Number(row.chat_id) === Number(byId('localImageChat').value));
    byId('localImageChatEnabled').checked = setting?.enabled === true;
  }
  async function action(button, task, pending = 'Saving...') {
    const oldDisabled = button.disabled;
    button.disabled = true;
    status(pending);
    try { await task(); } catch (error) { status(error.name === 'AbortError' ? 'Local image generation cancelled' : (error.message || 'Local image request failed')); }
    finally { button.disabled = oldDisabled; }
  }
  function init() {
    if (initialized || !bridge()?.getCurrentUser?.()?.is_admin) return;
    initialized = true;
    byId('localImagePreview').alt = tx('Generated image');
    bridge().registerManagedModal('localImageModal');
    byId('qwenAiOpenImageBots').addEventListener('click', () => {
      bridge().openManagedModal('localImageModal', { replaceStack: false });
      status('Loading...');
      bridge().api(endpoint).then((data) => { render(data); status(''); }).catch((error) => status(error.message));
    });
    byId('localImageClose').addEventListener('click', () => bridge().closeManagedModal('localImageModal'));
    byId('localImageSaveSettings').addEventListener('click', (event) => action(event.currentTarget, async () => {
      const data = await bridge().api(`${endpoint}/settings`, { method: 'PUT', body: {
        local_image_enabled: byId('localImageEnabled').checked,
        local_image_base_url: byId('localImageBaseUrl').value,
        local_image_default_model: byId('localImageModel').value,
        local_image_default_size: byId('localImageSize').value,
        local_image_timeout_ms: Number(byId('localImageTimeout').value) * 1000,
      } });
      render(data.state); status('Settings saved');
    }));
    byId('localImageConnection').addEventListener('click', (event) => action(event.currentTarget, async () => {
      const data = await bridge().api(`${endpoint}/test-connection`, { method: 'POST', body: { local_image_base_url: byId('localImageBaseUrl').value } });
      byId('localImageModel').value = data.result.model;
      status('Local image server is ready');
    }, 'Testing...'));
    byId('localImageBotList').addEventListener('click', (event) => {
      const button = event.target.closest('.ai-bot-list-item');
      if (button) editBot(state.bots.find((bot) => bot.id === Number(button.dataset.botId)));
    });
    byId('localImageBotName').addEventListener('input', () => renderAvatar());
    byId('localImageBotHistory').addEventListener('click', () => window.BananzaBotImages.open(selectedId));
    byId('localImageBotDisable').addEventListener('click', (event) => action(event.currentTarget, async () => {
      const data = await bridge().api(`${endpoint}/${selectedId}`, { method: 'PUT', body: { enabled: false } });
      render(data.state); status('Bot saved');
    }));
    byId('localImageBotAvatarInput').addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (!file || !selectedId) return;
      const form = new FormData(); form.append('avatar', file);
      action(byId('localImageBotSave'), async () => {
        const data = await bridge().api(`${endpoint}/${selectedId}/avatar`, { method: 'POST', body: form });
        render(data.state); status('Avatar saved');
      }, 'Uploading avatar...');
    });
    byId('localImageBotAvatarRemove').addEventListener('click', (event) => action(event.currentTarget, async () => {
      const data = await bridge().api(`${endpoint}/${selectedId}/avatar`, { method: 'DELETE' });
      render(data.state); status('Avatar removed');
    }));
    byId('localImageNewBot').addEventListener('click', () => editBot(null));
    byId('localImageBotSave').addEventListener('click', (event) => action(event.currentTarget, async () => {
      const data = await bridge().api(`${endpoint}${selectedId ? '/' + selectedId : ''}`, { method: selectedId ? 'PUT' : 'POST', body: {
        name: byId('localImageBotName').value, mention: byId('localImageBotMention').value,
        image_resolution: byId('localImageBotSize').value,
        enabled: byId('localImageBotEnabled').checked, visible_to_users: byId('localImageBotVisible').checked,
        image_model: state.settings.local_image_default_model, allow_image_generate: byId('localImageBotGenerate').checked,
        allow_image_edit: byId('localImageBotEdit').checked,
      } });
      selectedId = data.bot.id; render(data.state); status('Bot saved');
    }));
    byId('localImageChat').addEventListener('change', syncChat);
    byId('localImageChatSave').addEventListener('click', (event) => action(event.currentTarget, async () => {
      const data = await bridge().api(`${endpoint}/chat-settings`, { method: 'PUT', body: {
        botId: selectedId, chatId: Number(byId('localImageChat').value), enabled: byId('localImageChatEnabled').checked,
      } });
      render(data.state); status('Chat settings saved');
    }));
    byId('localImageTest').addEventListener('click', (event) => action(event.currentTarget, async () => {
      controller = new AbortController();
      byId('localImageCancel').classList.remove('hidden');
      try {
        const data = await bridge().api(`${endpoint}/${selectedId}/test`, { method: 'POST', body: { prompt: byId('localImagePrompt').value }, signal: controller.signal });
        byId('localImagePreview').src = `data:image/png;base64,${data.image.b64Json}`;
        byId('localImagePreview').classList.remove('hidden'); status('Image generated successfully');
      } finally {
        controller = null; byId('localImageCancel').classList.add('hidden');
      }
    }, 'Generating locally. This may take a few minutes.'));
    byId('localImageCancel').addEventListener('click', () => { controller?.abort(); status('Local image generation cancelled'); });
    bridge().onLanguageChange?.(() => { bridge().applyLocalizedDom?.(byId('localImageModal')); byId('localImagePreview').alt = tx('Generated image'); renderBotList(); renderAvatar(); });
  }
  window.addEventListener('bananza:ready', init);
  init();
})();
