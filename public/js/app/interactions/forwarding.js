(function () {

function objectOrDefault(value) {
  return value && typeof value === 'object' ? value : {};
}

function getter(fn) {
  fn.__bananzaInteractionGetter = true;
  return fn;
}

function createLegacyScope(deps, win) {
  const target = Object.create(null);
  return new Proxy(target, {
    has(_target, prop) {
      return prop !== Symbol.unscopables;
    },
    get(_target, prop) {
      if (prop === Symbol.unscopables) return undefined;
      if (Object.prototype.hasOwnProperty.call(target, prop)) return target[prop];
      if (Object.prototype.hasOwnProperty.call(deps, prop)) {
        const value = deps[prop];
        return value && value.__bananzaInteractionGetter ? value() : value;
      }
      const value = win[prop];
      if (
        typeof value === 'function'
        && (prop === 'setTimeout'
          || prop === 'clearTimeout'
          || prop === 'requestAnimationFrame'
          || prop === 'cancelAnimationFrame')
      ) {
        return value.bind(win);
      }
      return value;
    },
    set(_target, prop, value) {
      target[prop] = value;
      return true;
    },
  });
}


const root = window.BananzaApp = window.BananzaApp || {};
const interactionsRoot = root.interactions = root.interactions || {};

function createForwardingController(options = {}) {
  const opts = objectOrDefault(options);
  const win = opts.window || window;
  const doc = opts.document || document;
  const dom = objectOrDefault(opts.dom);
  const state = objectOrDefault(opts.state);
  const actions = objectOrDefault(opts.actions);
  const deps = { window: win, document: doc, HTMLElement: win.HTMLElement, forwardMessageModal: dom.forwardMessageModal, forwardChatSearch: dom.forwardChatSearch, forwardChatList: dom.forwardChatList, forwardMessageStatus: dom.forwardMessageStatus, chats: getter(() => state.getChats?.() || []), onlineUsers: getter(() => state.getOnlineUsers?.() || new Set()), currentChatId: getter(() => state.getCurrentChatId?.() || null), currentModalAnimation: getter(() => state.getCurrentModalAnimation?.() || 'soft'), MODAL_TRANSITION_BUFFER_MS: objectOrDefault(opts.config || root.config).MODAL_TRANSITION_BUFFER_MS ?? 80, api: opts.api || actions.api || (() => Promise.resolve({})), esc: opts.esc || ((value) => String(value == null ? '' : value)), isNotesChat: actions.isNotesChat || (() => false), getChatSearchHaystack: actions.getChatSearchHaystack || (() => ''), formatChatListTimestamp: actions.formatChatListTimestamp || (() => ''), chatItemAvatarHtml: actions.chatItemAvatarHtml || (() => ''), renderChatLastPreviewHtml: actions.renderChatLastPreviewHtml || (() => ''), closeModal: actions.closeModal || (() => false), openModal: actions.openModal || (() => null), closeAllModals: actions.closeAllModals || function noop() {}, showCenterToast: actions.showCenterToast || function noop() {}, playAppSound: actions.playAppSound || function noop() {}, scrollToBottom: actions.scrollToBottom || function noop() {}, updateChatListLastMessage: actions.updateChatListLastMessage || function noop() {}, hideFloatingMessageActions: actions.hideFloatingMessageActions || function noop() {}, isMobileLayoutViewport: actions.isMobileLayoutViewport || (() => false), prefersReducedMotion: actions.prefersReducedMotion || (() => false), getElementTransitionTotalMs: actions.getElementTransitionTotalMs || (() => 0) };
  const scope = createLegacyScope(deps, win);
  with (scope) {
let forwardMessageState = null;
let forwardMessageBusy = false;
let savingToNotesMessageIds = new Set();
function setForwardMessageStatus(message = '', type = '') {
  if (!forwardMessageStatus) return;
  forwardMessageStatus.textContent = message;
  forwardMessageStatus.classList.toggle('hidden', !message);
  forwardMessageStatus.classList.toggle('is-error', type === 'error');
  forwardMessageStatus.classList.toggle('is-success', type === 'success');
}

function resetForwardMessageModal() {
  forwardMessageState = null;
  forwardMessageBusy = false;
  if (forwardChatSearch) forwardChatSearch.value = '';
  if (forwardChatList) forwardChatList.innerHTML = '';
  setForwardMessageStatus('');
}


function closeForwardMessageModal(options = {}) {
  if (!forwardMessageModal) {
    resetForwardMessageModal();
    return false;
  }
  return closeModal(forwardMessageModal, options);
}

function renderForwardChatList(filter = '') {
  if (!forwardChatList) return;
  const query = String(filter || '').trim().toLowerCase();
  const forwardableChats = chats.filter(chat => !isNotesChat(chat));
  const filtered = query
    ? forwardableChats.filter(chat => getChatSearchHaystack(chat).includes(query))
    : forwardableChats;

  if (filtered.length === 0) {
    forwardChatList.innerHTML = '<div class="forward-empty-state">\u041F\u043E\u0434\u0445\u043E\u0434\u044F\u0449\u0438\u0445 \u0447\u0430\u0442\u043E\u0432 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E</div>';
    return;
  }

  forwardChatList.innerHTML = filtered.map((chat) => {
    const isOnline = chat.type === 'private' && chat.private_user && onlineUsers.has(chat.private_user.id);
    const lastTime = chat.last_time ? formatChatListTimestamp(chat.last_time) : '';
    return `
      <button type="button" class="chat-item forward-chat-item${chat.id === currentChatId ? ' is-current' : ''}" data-chat-id="${chat.id}">
        ${chatItemAvatarHtml(chat)}
          ${isOnline ? '<div class="online-dot"></div>' : ''}
        </div>
        <div class="chat-item-body">
          <div class="chat-item-top">
            <span class="chat-item-name">${esc(chat.name)}</span>
            <span class="chat-item-time">${lastTime}</span>
          </div>
          <div class="chat-item-last"><span>${renderChatLastPreviewHtml(chat, { emptyText: '\u0411\u0435\u0437 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0439' })}</span></div>
        </div>
      </button>
    `;
  }).join('');
}

function focusForwardChatSearchAfterOpen(entry) {
  if (!forwardChatSearch) return;
  const focus = () => {
    if (!entry?.el || entry.el.classList.contains('hidden') || entry.isClosing) return;
    try {
      forwardChatSearch.focus({ preventScroll: true });
    } catch {
      forwardChatSearch.focus();
    }
  };
  if (!isMobileLayoutViewport() || prefersReducedMotion() || currentModalAnimation === 'none') {
    requestAnimationFrame(focus);
    return;
  }
  const contentEl = entry?.el?.querySelector('.modal-content');
  if (!(contentEl instanceof HTMLElement)) {
    setTimeout(focus, MODAL_TRANSITION_BUFFER_MS);
    return;
  }
  let done = false;
  let timer = null;
  const finish = () => {
    if (done) return;
    done = true;
    clearTimeout(timer);
    contentEl.removeEventListener('transitionend', onTransitionEnd);
    requestAnimationFrame(focus);
  };
  const onTransitionEnd = (event) => {
    if (event.target !== contentEl || !['opacity', 'transform'].includes(event.propertyName)) return;
    finish();
  };
  contentEl.addEventListener('transitionend', onTransitionEnd);
  const fallbackMs = Math.max(
    MODAL_TRANSITION_BUFFER_MS,
    Math.ceil(Math.max(getElementTransitionTotalMs(entry.el), getElementTransitionTotalMs(contentEl)) + MODAL_TRANSITION_BUFFER_MS)
  );
  timer = setTimeout(finish, fallbackMs);
}

function openForwardMessageModal(message) {
  if (!message?.id) return;
  hideFloatingMessageActions();
  const entry = openModal('forwardMessageModal', { replaceStack: true });
  forwardMessageState = { id: message.id };
  renderForwardChatList();
  focusForwardChatSearchAfterOpen(entry);
}

async function forwardMessageToChat(targetChatId) {
  if (!forwardMessageState?.id || !targetChatId || forwardMessageBusy) return;
  forwardMessageBusy = true;
  setForwardMessageStatus('\u041F\u0435\u0440\u0435\u0441\u044B\u043B\u0430\u044E...');
  try {
    await api(`/api/messages/${forwardMessageState.id}/forward`, {
      method: 'POST',
      body: { targetChatId },
    });
    closeAllModals();
    showCenterToast('\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u043F\u0435\u0440\u0435\u0441\u043B\u0430\u043D\u043E');
    playAppSound('send');
    if (targetChatId === currentChatId) scrollToBottom();
  } catch (e) {
    setForwardMessageStatus(e.message || '\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u0435\u0440\u0435\u0441\u043B\u0430\u0442\u044C \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435', 'error');
  } finally {
    forwardMessageBusy = false;
  }
}

async function saveMessageToNotes(message, button = null) {
  const messageId = Number(message?.id || 0);
  if (!messageId || savingToNotesMessageIds.has(messageId)) return;
  savingToNotesMessageIds.add(messageId);
  if (button) button.disabled = true;
  try {
    const saved = await api(`/api/messages/${messageId}/save-to-notes`, { method: 'POST' });
    if (saved?.chat_id) updateChatListLastMessage(saved);
    showCenterToast('\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E \u0432 \u0437\u0430\u043C\u0435\u0442\u043A\u0438');
    playAppSound('send');
  } catch (e) {
    showCenterToast(e.message || '\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0432 \u0437\u0430\u043C\u0435\u0442\u043A\u0438');
  } finally {
    savingToNotesMessageIds.delete(messageId);
    if (button) button.disabled = false;
    hideFloatingMessageActions();
  }
}


function bindEvents() {
  if (bindEvents.__bound) return;
  bindEvents.__bound = true;
  forwardChatSearch?.addEventListener('input', () => { renderForwardChatList(forwardChatSearch.value); setForwardMessageStatus(''); });
  forwardChatList?.addEventListener('click', (event) => { const btn = event.target.closest('.forward-chat-item'); if (!btn) return; forwardMessageToChat(+btn.dataset.chatId); });
}
function getState() { return { message: forwardMessageState ? { ...forwardMessageState } : null, busy: forwardMessageBusy, savingIds: Array.from(savingToNotesMessageIds) }; }
__exports = { setForwardMessageStatus, resetForwardMessageModal, closeForwardMessageModal, renderForwardChatList, openForwardMessageModal, forwardMessageToChat, saveMessageToNotes, bindEvents, getState };
  }
  return scope.__exports;
}
interactionsRoot.forwarding = { createForwardingController };
})();
