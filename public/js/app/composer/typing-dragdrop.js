(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const composerRoot = root.composer = root.composer || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function createTypingDragDropController(options = {}) {
    const opts = objectOrDefault(options);
    const dom = objectOrDefault(opts.dom);
    const state = objectOrDefault(opts.state);
    const actions = objectOrDefault(opts.actions);
    const files = objectOrDefault(opts.files);
    const getCurrentChatId = typeof opts.getCurrentChatId === 'function'
      ? opts.getCurrentChatId
      : (typeof actions.getCurrentChatId === 'function' ? actions.getCurrentChatId : () => null);
    let dragCounter = 0;

    function sendTyping() {
      const chatId = getCurrentChatId();
      if (!chatId) return;
      (actions.sendWs || (() => false))({ type: 'typing', chatId });
    }

    function renderTypingBar() {
      const typingBar = dom.typingBar;
      if (!typingBar) return;
      const entries = Object.entries(state.typingDisplayTimeouts || {}).map(([name, item]) => ({
        name,
        activity: item?.activity || 'typing',
      }));
      if (entries.length === 0) {
        typingBar.classList.add('hidden');
        typingBar.replaceChildren();
        return;
      }

      const label = typingBar.ownerDocument.createElement('span');
      label.className = 'typing-bar-label';
      const chatShotEntry = entries.find((entry) => entry.activity === 'chatshot_generating');
      const names = entries.map((entry) => entry.name);
      label.textContent = chatShotEntry
        ? 'chatShot \u0433\u0435\u043d\u0435\u0440\u0438\u0440\u0443\u0435\u0442\u0441\u044f'
        : (names.length === 1 ? `${names[0]} \u043f\u0435\u0447\u0430\u0442\u0430\u0435\u0442` : `${names.join(', ')} \u043f\u0435\u0447\u0430\u0442\u0430\u044e\u0442`);

      const dots = typingBar.ownerDocument.createElement('span');
      dots.className = 'typing-bar-dots';
      dots.setAttribute('aria-hidden', 'true');

      for (let index = 0; index < 3; index += 1) {
        const dot = typingBar.ownerDocument.createElement('span');
        dot.className = 'typing-bar-dot';
        dot.textContent = '.';
        dots.appendChild(dot);
      }

      typingBar.classList.remove('hidden');
      typingBar.replaceChildren(label, dots);
    }

    function showTyping(username, options = {}) {
      const name = username || 'Someone';
      clearTimeout(state.typingDisplayTimeouts[name]?.timer || state.typingDisplayTimeouts[name]);
      state.typingDisplayTimeouts[name] = {
        activity: options.activity || 'typing',
        timer: setTimeout(() => {
          delete state.typingDisplayTimeouts[name];
          renderTypingBar();
        }, 3000),
      };
      renderTypingBar();
    }

    function hideTyping(username) {
      const name = username || 'Someone';
      clearTimeout(state.typingDisplayTimeouts[name]?.timer || state.typingDisplayTimeouts[name]);
      delete state.typingDisplayTimeouts[name];
      renderTypingBar();
    }

    function handleDragEnter(event) {
      event.preventDefault();
      dragCounter += 1;
      if (getCurrentChatId()) dom.dragOverlay?.classList.remove('hidden');
    }

    function handleDragOver(event) {
      event.preventDefault();
    }

    function handleDragLeave(event) {
      event.preventDefault();
      dragCounter -= 1;
      if (dragCounter <= 0) {
        dom.dragOverlay?.classList.add('hidden');
        dragCounter = 0;
      }
    }

    function handleDrop(event) {
      event.preventDefault();
      dragCounter = 0;
      dom.dragOverlay?.classList.add('hidden');
      if (!getCurrentChatId()) return;
      const droppedFiles = event.dataTransfer?.files;
      if (droppedFiles?.length > 0) (files.uploadFiles || actions.uploadFiles)?.(droppedFiles);
    }

    function bindDragDropEvents(target = dom.chatArea || dom.chatView || document) {
      if (!target || target.__composerDragDropBound) return;
      target.__composerDragDropBound = true;
      target.addEventListener('dragenter', handleDragEnter);
      target.addEventListener('dragover', handleDragOver);
      target.addEventListener('dragleave', handleDragLeave);
      target.addEventListener('drop', handleDrop);
    }

    return {
      sendTyping,
      renderTypingBar,
      showTyping,
      hideTyping,
      handleDragEnter,
      handleDragOver,
      handleDragLeave,
      handleDrop,
      bindDragDropEvents,
    };
  }

  composerRoot.typingDragDrop = {
    createTypingDragDropController,
  };
})();
