(function () {
  'use strict';
  const byId = (id) => document.getElementById(id);
  const bridge = () => window.BananzaAppBridge;
  const tx = (key) => bridge()?.tx?.(key) || key;
  const modalId = 'botImageHistoryModal';
  let initialized = false;
  let botId = null;
  let before = null;
  let requestId = 0;
  let controller;

  function reset() {
    controller?.abort();
    requestId += 1;
    botId = null;
    before = null;
    byId('botImageHistoryGrid').replaceChildren();
    byId('botImageHistoryBots').replaceChildren();
    byId('botImageHistoryMore').classList.add('hidden');
    byId('botImageHistoryMore').disabled = false;
    byId('botImageHistoryTitle').textContent = tx('Image history');
    byId('botImageHistoryStatus').textContent = tx('Loading...');
  }
  function show() {
    bridge().openManagedModal(modalId, { replaceStack: false });
  }
  function card(item) {
    const figure = document.createElement('figure');
    figure.className = 'bot-image-history-card';
    const link = document.createElement('a');
    link.href = `${item.file_url}/preview`;
    link.target = '_blank';
    link.rel = 'noopener';
    link.title = tx('Open image');
    const img = document.createElement('img');
    img.src = `${item.file_url}/preview`;
    img.alt = item.prompt || tx('Generated image');
    img.loading = 'lazy';
    link.append(img);
    const caption = document.createElement('figcaption');
    const requester = document.createElement('div');
    requester.className = 'bot-image-history-requester';
    const name = item.requested_by?.display_name || item.requested_by?.username || tx('Unknown user');
    const username = item.requested_by?.username;
    requester.textContent = `${tx('Requested by')}: ${name}${username && username !== name ? ` (@${username})` : ''}`;
    const time = document.createElement('time');
    time.dateTime = item.created_at.replace(' ', 'T') + 'Z';
    time.textContent = new Date(time.dateTime).toLocaleString(bridge().getCurrentLanguage?.() || undefined);
    const prompt = document.createElement('p');
    prompt.textContent = item.prompt;
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'weather-action-btn';
    open.dataset.i18n = 'Open in chat';
    open.textContent = tx('Open in chat');
    open.addEventListener('click', () => {
      bridge().closeAllModals();
      bridge().openChat(item.chat_id, { anchorMessageId: item.id });
    });
    caption.append(requester, time, prompt, open);
    figure.append(link, caption);
    return figure;
  }
  async function loadMore() {
    if (!botId) return;
    controller?.abort();
    controller = new AbortController();
    const current = ++requestId;
    const more = byId('botImageHistoryMore');
    more.disabled = true;
    byId('botImageHistoryStatus').textContent = tx('Loading...');
    try {
      const data = await bridge().api(`/api/ai-bots/${botId}/images?limit=24${before ? '&before=' + before : ''}`, { signal: controller.signal });
      if (current !== requestId) return;
      byId('botImageHistoryTitle').textContent = `${tx('Image history')} · ${data.bot.name}`;
      byId('botImageHistoryGrid').append(...data.images.map(card));
      before = data.next_before;
      more.classList.toggle('hidden', !before);
      byId('botImageHistoryStatus').textContent = byId('botImageHistoryGrid').children.length ? '' : tx('No images yet');
    } catch (error) {
      if (current !== requestId || error.name === 'AbortError') return;
      byId('botImageHistoryStatus').textContent = tx('Could not load image history');
      more.classList.remove('hidden');
    } finally {
      if (current === requestId) more.disabled = false;
    }
  }
  async function open(id) {
    reset();
    botId = Number(id);
    show();
    await loadMore();
  }
  async function openForChat() {
    reset();
    const chatId = bridge().getCurrentChatId();
    if (!chatId) return;
    bridge().closeChatHeaderActions?.();
    show();
    const current = requestId;
    controller = new AbortController();
    try {
      const members = await bridge().api(`/api/chats/${chatId}/members`, { signal: controller.signal });
      if (current !== requestId) return;
      const bots = members.filter((member) => member.is_ai_bot && member.ai_bot_id);
      if (bots.length === 1) {
        botId = bots[0].ai_bot_id;
        await loadMore();
        return;
      }
      byId('botImageHistoryStatus').textContent = tx(bots.length ? 'Choose a bot' : 'No bots in this chat');
      for (const bot of bots) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'weather-action-btn';
        button.textContent = bot.display_name;
        button.addEventListener('click', () => open(bot.ai_bot_id));
        byId('botImageHistoryBots').append(button);
      }
    } catch (error) {
      if (current === requestId && error.name !== 'AbortError') byId('botImageHistoryStatus').textContent = tx('Could not load image history');
    }
  }
  function init() {
    if (initialized || !bridge()?.getCurrentUser?.()) return;
    initialized = true;
    bridge().registerManagedModal(modalId);
    byId('botImageHistoryClose').addEventListener('click', () => bridge().closeManagedModal(modalId));
    byId('botImageHistoryMore').addEventListener('click', loadMore);
    byId('botImageHistoryChat').addEventListener('click', openForChat);
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-bot-history-id]');
      if (button) { event.preventDefault(); open(button.dataset.botHistoryId); }
    });
    new MutationObserver(() => {
      if (byId(modalId).classList.contains('hidden')) { controller?.abort(); requestId += 1; }
    }).observe(byId(modalId), { attributes: true, attributeFilter: ['class'] });
  }
  window.BananzaBotImages = { open, openForChat };
  window.addEventListener('bananza:ready', init);
  init();
})();
