(function () {
  'use strict';
  const byId = (id) => document.getElementById(id);
  const bridge = () => window.BananzaAppBridge;
  const tx = (key, params) => bridge()?.tx?.(key, params) || key;
  const isAdmin = () => Boolean(bridge()?.getCurrentUser?.()?.is_admin);
  const supportsHistory = (kind) => ['image', 'universal', 'chatshot'].includes(kind);
  const modalId = 'botImageHistoryModal';
  let initialized = false;
  let botId = null;
  let page = 1;
  let userId = '';
  let data = null;
  let requestId = 0;
  let controller;
  const unavailable = new Set();

  function syncChatButton(chat = bridge()?.getCurrentChat?.()) {
    const visible = isAdmin() && Boolean(chat) && !chat.is_notes && !chat.is_document && chat.type !== 'document'
      && (chat.type !== 'private' || supportsHistory(chat.private_user?.ai_bot_kind));
    byId('botImageHistoryChat')?.classList.toggle('hidden', !visible);
    bridge()?.syncChatHeaderActions?.();
  }
  function reset() {
    controller?.abort();
    requestId += 1;
    botId = null;
    page = 1;
    userId = '';
    data = null;
    unavailable.clear();
    byId('botImageHistoryGrid').replaceChildren();
    byId('botImageHistoryBots').replaceChildren();
    byId('botImageHistoryUser').replaceChildren();
    for (const id of ['botImageHistoryFilter', 'botImageHistoryPager', 'botImageHistoryRetry']) byId(id).classList.add('hidden');
    byId('botImageHistoryTitle').textContent = tx('Image history');
    byId('botImageHistoryStatus').textContent = tx('Loading...');
  }
  function show() {
    bridge().openManagedModal(modalId, { replaceStack: false });
  }
  function userLabel(user) {
    const name = user?.display_name || user?.username || tx('Unknown user');
    return name + (user?.username && user.username !== name ? ' (@' + user.username + ')' : '');
  }
  function openImage(id) {
    if (!isAdmin()) return;
    const items = (data?.images || []).filter((item) => !unavailable.has(item.id)).map((item) => ({
      id: String(item.id), src: item.file_url + '/preview', type: 'image', fileName: 'bot-image-' + item.id,
    }));
    const initialIndex = items.findIndex((item) => item.id === String(id));
    if (initialIndex < 0) return;
    bridge().openMediaViewer(items[initialIndex].src, 'image', { items, initialIndex });
  }
  function card(item) {
    const figure = document.createElement('figure');
    figure.className = 'bot-image-history-card';
    const preview = document.createElement('button');
    preview.type = 'button';
    preview.className = 'bot-image-history-preview';
    preview.setAttribute('aria-label', tx('Open image fullscreen'));
    preview.addEventListener('click', () => openImage(item.id));
    const img = document.createElement('img');
    img.alt = item.prompt || tx('Generated image');
    img.loading = 'lazy';
    img.addEventListener('error', () => {
      if (!preview.isConnected) return;
      unavailable.add(item.id);
      preview.disabled = true;
      preview.textContent = tx('Image file is unavailable');
    });
    img.src = item.file_url + '/preview';
    preview.append(img);
    const caption = document.createElement('figcaption');
    const requester = document.createElement('div');
    requester.className = 'bot-image-history-requester';
    requester.textContent = tx('Requested by') + ': ' + userLabel(item.requested_by);
    const time = document.createElement('time');
    time.dateTime = item.created_at.replace(' ', 'T') + 'Z';
    time.textContent = new Date(time.dateTime).toLocaleString(bridge().getCurrentLanguage?.() || undefined);
    const prompt = document.createElement('p');
    prompt.textContent = item.prompt;
    caption.append(requester, time, prompt);
    if (item.can_open_chat && item.chat_id) {
      const open = document.createElement('button');
      open.type = 'button';
      open.className = 'weather-action-btn';
      open.textContent = tx('Open in chat');
      open.addEventListener('click', () => {
        if (!isAdmin()) return;
        bridge().closeAllModals();
        bridge().openChat(item.chat_id, { anchorMessageId: item.id });
      });
      caption.append(open);
    }
    figure.append(preview, caption);
    return figure;
  }
  function render() {
    if (!data) return;
    byId('botImageHistoryTitle').textContent = tx('Image history') + ' · ' + data.bot.name;
    const select = byId('botImageHistoryUser');
    select.replaceChildren(new Option(tx('All users'), ''));
    for (const user of data.users) select.add(new Option(userLabel(user), String(user.id)));
    select.value = userId;
    unavailable.clear();
    byId('botImageHistoryGrid').replaceChildren(...data.images.map(card));
    byId('botImageHistoryFilter').classList.remove('hidden');
    byId('botImageHistoryPager').classList.remove('hidden');
    byId('botImageHistoryPage').textContent = tx('Page {page} of {pages}', { page: data.page, pages: data.total_pages });
    byId('botImageHistoryPrevious').disabled = data.page <= 1;
    byId('botImageHistoryNext').disabled = data.page >= data.total_pages;
    byId('botImageHistoryStatus').textContent = data.images.length ? '' : tx('No images yet');
  }
  async function loadPage(targetPage = page) {
    if (!isAdmin() || !botId) return;
    controller?.abort();
    controller = new AbortController();
    const current = ++requestId;
    page = targetPage;
    data = null;
    byId('botImageHistoryGrid').replaceChildren();
    byId('botImageHistoryPrevious').disabled = true;
    byId('botImageHistoryNext').disabled = true;
    byId('botImageHistoryRetry').classList.add('hidden');
    byId('botImageHistoryStatus').textContent = tx('Loading...');
    try {
      const query = new URLSearchParams({ page: String(page), limit: '25' });
      if (userId) query.set('user_id', userId);
      const result = await bridge().api('/api/ai-bots/' + botId + '/images?' + query, { signal: controller.signal });
      if (current !== requestId || !isAdmin()) return;
      data = result;
      page = data.page;
      render();
      byId(modalId).querySelector('.modal-body').scrollTop = 0;
    } catch (error) {
      if (current !== requestId || error.name === 'AbortError') return;
      byId('botImageHistoryStatus').textContent = tx('Could not load image history');
      byId('botImageHistoryRetry').classList.remove('hidden');
    }
  }
  async function open(id) {
    if (!isAdmin() || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) return;
    reset();
    botId = Number(id);
    show();
    await loadPage();
  }
  async function openForChat() {
    if (!isAdmin()) return;
    reset();
    const chatId = bridge().getCurrentChatId();
    if (!chatId) return;
    bridge().closeChatHeaderActions?.();
    show();
    const current = requestId;
    controller = new AbortController();
    try {
      const members = await bridge().api('/api/chats/' + chatId + '/members', { signal: controller.signal });
      if (current !== requestId || !isAdmin()) return;
      const bots = members.filter((member) => member.is_ai_bot && member.ai_bot_id && supportsHistory(member.ai_bot_kind));
      if (bots.length === 1) {
        botId = bots[0].ai_bot_id;
        await loadPage();
        return;
      }
      byId('botImageHistoryStatus').textContent = tx(bots.length ? 'Choose a bot' : 'No image-capable bots in this chat');
      for (const bot of bots) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'weather-action-btn';
        button.textContent = bot.display_name;
        button.addEventListener('click', () => open(bot.ai_bot_id));
        byId('botImageHistoryBots').append(button);
      }
    } catch (error) {
      if (current !== requestId || error.name === 'AbortError') return;
      byId('botImageHistoryStatus').textContent = tx('Could not load image history');
      byId('botImageHistoryRetry').classList.remove('hidden');
    }
  }
  function init() {
    if (initialized || !bridge()?.getCurrentUser?.()) return;
    initialized = true;
    syncChatButton();
    bridge().registerManagedModal(modalId);
    byId('botImageHistoryClose').addEventListener('click', () => bridge().closeManagedModal(modalId));
    byId('botImageHistoryPrevious').addEventListener('click', () => loadPage(page - 1));
    byId('botImageHistoryNext').addEventListener('click', () => loadPage(page + 1));
    byId('botImageHistoryRetry').addEventListener('click', () => botId ? loadPage() : openForChat());
    byId('botImageHistoryUser').addEventListener('change', () => {
      userId = byId('botImageHistoryUser').value;
      loadPage(1);
    });
    byId('botImageHistoryChat').addEventListener('click', openForChat);
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-bot-history-id]');
      if (button && isAdmin()) { event.preventDefault(); open(button.dataset.botHistoryId); }
    });
    bridge().onLanguageChange?.(() => { if (!byId(modalId).classList.contains('hidden')) render(); });
    new MutationObserver(() => {
      if (byId(modalId).classList.contains('hidden')) { controller?.abort(); requestId += 1; }
    }).observe(byId(modalId), { attributes: true, attributeFilter: ['class'] });
  }
  window.BananzaBotImages = { open, openForChat, syncChatButton };
  window.addEventListener('bananza:ready', init);
  init();
})();
