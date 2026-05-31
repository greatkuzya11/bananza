(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const composerRoot = root.composer = root.composer || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function noop() {}

  function createPollComposerController(options = {}) {
    const opts = objectOrDefault(options);
    const win = opts.window || window;
    const doc = opts.document || document;
    const dom = objectOrDefault(opts.dom);
    const state = objectOrDefault(opts.state);
    const text = objectOrDefault(opts.text);
    const replyEdit = objectOrDefault(opts.replyEdit);
    const actions = objectOrDefault(opts.actions);
    const api = typeof opts.api === 'function' ? opts.api : (() => Promise.resolve({}));
    const config = objectOrDefault(opts.config);
    const formatters = objectOrDefault(opts.formatters || root.formatters);
    const esc = typeof opts.esc === 'function'
      ? opts.esc
      : (typeof formatters.esc === 'function' ? formatters.esc : (value) => String(value == null ? '' : value));
    const POLL_MIN_OPTIONS = Number(config.POLL_MIN_OPTIONS || opts.POLL_MIN_OPTIONS || 2) || 2;
    const POLL_MAX_OPTIONS = Number(config.POLL_MAX_OPTIONS || opts.POLL_MAX_OPTIONS || 10) || 10;
    const POLL_CLOSE_PRESET_MS = objectOrDefault(config.POLL_CLOSE_PRESET_MS || opts.POLL_CLOSE_PRESET_MS);
    const getCurrentChatId = typeof opts.getCurrentChatId === 'function'
      ? opts.getCurrentChatId
      : (typeof actions.getCurrentChatId === 'function' ? actions.getCurrentChatId : () => null);
    const getCurrentUser = typeof opts.getCurrentUser === 'function'
      ? opts.getCurrentUser
      : (typeof actions.getCurrentUser === 'function' ? actions.getCurrentUser : () => null);

    function setPollComposerStatus(message, type = '') {
      if (!dom.pollComposerStatus) return;
      dom.pollComposerStatus.textContent = message || '';
      dom.pollComposerStatus.classList.toggle('is-error', type === 'error');
      dom.pollComposerStatus.classList.toggle('is-success', type === 'success');
    }

    function readPollComposerForm() {
      const optionInputs = Array.from(dom.pollOptionsList?.querySelectorAll('input[data-poll-option-index]') || []);
      const optionsList = optionInputs.map((input) => input.value.trim()).filter(Boolean);
      return {
        question: String(dom.pollQuestionInput?.value || '').trim(),
        options: optionsList,
        style: (actions.normalizePollStyle || ((style) => style || 'pulse'))((actions.getPollComposerStyle || (() => 'pulse'))()),
        allows_multiple: !!doc.getElementById('pollAllowMultiple')?.checked,
        show_voters: !!doc.getElementById('pollShowVoters')?.checked,
        close_preset: String(doc.getElementById('pollClosePreset')?.value || '').trim() || null,
      };
    }

    function renderPollComposerOptionInputs() {
      if (!dom.pollOptionsList) return;
      let pollComposerOptions = state.pollComposerOptions.slice(0, POLL_MAX_OPTIONS);
      while (pollComposerOptions.length < POLL_MIN_OPTIONS) pollComposerOptions.push('');
      state.pollComposerOptions = pollComposerOptions;
      dom.pollOptionsList.innerHTML = pollComposerOptions.map((value, index) => `
        <div class="poll-option-editor" data-poll-option-row="${index}">
          <span class="poll-option-index">${index + 1}</span>
          <input
            type="text"
            class="modal-input"
            maxlength="160"
            data-poll-option-index="${index}"
            placeholder="Option ${index + 1}"
            value="${esc(value)}"
          >
          <button
            type="button"
            class="poll-option-remove"
            data-poll-option-remove="${index}"
            ${pollComposerOptions.length <= POLL_MIN_OPTIONS ? 'disabled' : ''}
            title="Remove option"
          >\u2715</button>
        </div>
      `).join('');
    }

    function refreshPollComposerActionState() {
      const currentChatId = getCurrentChatId();
      const enabled = Boolean(currentChatId && !(actions.isCurrentNotesChat || (() => false))() && !state.editTo && state.pendingFiles.length === 0);
      if (dom.pollBtn) {
        dom.pollBtn.disabled = !enabled;
        dom.pollBtn.classList.toggle('disabled', !enabled);
      }
      const mobilePollBtn = doc.getElementById('attachMenuPoll');
      if (mobilePollBtn) {
        mobilePollBtn.disabled = !enabled;
        mobilePollBtn.classList.toggle('disabled', !enabled);
      }
    }

    function buildPollComposerPreviewMessage() {
      const form = readPollComposerForm();
      const currentUser = getCurrentUser() || {};
      const fallbackOptions = ['Friday night', 'Saturday brunch', 'Sunday reset', 'Next week'];
      const optionTexts = [...form.options];
      while (optionTexts.length < 3) optionTexts.push(fallbackOptions[optionTexts.length] || `Option ${optionTexts.length + 1}`);
      const previewTexts = optionTexts.slice(0, Math.min(Math.max(optionTexts.length, 3), 5));
      const previewVotes = previewTexts.map((_, index) => Math.max(2, previewTexts.length * 4 - index * 2));
      const myOptionIds = form.allows_multiple
        ? previewTexts.slice(0, Math.min(2, previewTexts.length)).map((_, index) => index + 1)
        : [1];
      const totalVotes = previewVotes.reduce((sum, count) => sum + count, 0);
      const closesAt = form.close_preset && POLL_CLOSE_PRESET_MS[form.close_preset]
        ? new Date(Date.now() + POLL_CLOSE_PRESET_MS[form.close_preset]).toISOString()
        : null;
      return {
        id: -1,
        chat_id: getCurrentChatId() || 0,
        user_id: currentUser.id || 0,
        text: form.question || 'Where should we go this weekend?',
        poll: {
          created_by: currentUser.id || 0,
          closed_by: null,
          style: form.style,
          allows_multiple: form.allows_multiple,
          show_voters: form.show_voters,
          closes_at: closesAt,
          closed_at: null,
          created_at: new Date().toISOString(),
          is_closed: false,
          total_votes: totalVotes,
          total_voters: form.allows_multiple ? Math.max(6, Math.round(totalVotes * 0.72)) : totalVotes,
          my_option_ids: myOptionIds,
          options: previewTexts.map((optionText, index) => ({
            id: index + 1,
            text: optionText,
            position: index,
            vote_count: previewVotes[index] || 0,
            voted_by_me: myOptionIds.includes(index + 1),
          })),
        },
      };
    }

    function refreshPollComposerPreview() {
      if (!dom.pollComposerPreview) return;
      const previewMessage = buildPollComposerPreviewMessage();
      const styleMeta = (actions.pollStyleMeta || (() => ({ name: previewMessage.poll?.style || 'Pulse', note: '' })))(previewMessage.poll?.style);
      const questionClass = (actions.isPulsePoll || (() => false))(previewMessage.poll)
        ? 'poll-composer-preview-question poll-question-block'
        : 'poll-composer-preview-question';
      dom.pollComposerPreview.innerHTML = `
        <div class="poll-composer-preview-shell">
          <div class="poll-composer-preview-meta">
            <span class="poll-composer-preview-style">${esc(styleMeta.name)} style</span>
            <span class="poll-composer-preview-note">${esc(styleMeta.note)}</span>
          </div>
          <div class="poll-composer-preview-message">
            <div class="${questionClass}">${esc(previewMessage.text || '')}</div>
            ${(actions.renderPollCard || (() => ''))(previewMessage, { preview: true })}
          </div>
        </div>
      `;
    }

    function resetPollComposer() {
      state.pollComposerOptions = ['', ''];
      (actions.setPollComposerStyle || noop)('pulse');
      if (dom.pollQuestionInput) dom.pollQuestionInput.value = '';
      const allowMultiple = doc.getElementById('pollAllowMultiple');
      const showVoters = doc.getElementById('pollShowVoters');
      const closePreset = doc.getElementById('pollClosePreset');
      if (allowMultiple) allowMultiple.checked = false;
      if (showVoters) showVoters.checked = false;
      if (closePreset) closePreset.value = '';
      renderPollComposerOptionInputs();
      (actions.syncPollComposerStyleUi || noop)();
      setPollComposerStatus('');
      refreshPollComposerPreview();
    }

    function openPollComposer() {
      if (!getCurrentChatId()) return;
      if ((actions.isCurrentNotesChat || (() => false))()) {
        (actions.alert || alert)('Polls are not available in notes chat.');
        return;
      }
      if (state.editTo) {
        (actions.alert || alert)('Finish editing before creating a poll.');
        return;
      }
      if (state.pendingFiles.length > 0) {
        (actions.alert || alert)('Remove pending attachments before creating a poll.');
        return;
      }
      resetPollComposer();
      if (dom.pollQuestionInput) dom.pollQuestionInput.value = text.getComposerTextValue?.({ trim: true }) || '';
      refreshPollComposerPreview();
      (actions.syncChatAreaMetrics || noop)();
      (actions.openModal || noop)('pollComposerModal', { opener: dom.pollBtn || dom.attachBtn });
      win.requestAnimationFrame(() => dom.pollQuestionInput?.focus());
    }

    async function submitPollComposer() {
      const currentChatId = getCurrentChatId();
      if (!currentChatId) return;
      const payload = readPollComposerForm();
      if (!payload.question) {
        setPollComposerStatus('Question is required', 'error');
        return;
      }
      if (payload.options.length < POLL_MIN_OPTIONS || payload.options.length > POLL_MAX_OPTIONS) {
        setPollComposerStatus(`Use ${POLL_MIN_OPTIONS}-${POLL_MAX_OPTIONS} filled options`, 'error');
        return;
      }
      const uniqueOptions = payload.options.map((option) => option.toLowerCase());
      if (new Set(uniqueOptions).size !== uniqueOptions.length) {
        setPollComposerStatus('Options must be unique', 'error');
        return;
      }

      setPollComposerStatus('Sending...');
      try {
        const replySnapshot = replyEdit.getReplySnapshot?.() || null;
        const message = await api(`/api/chats/${currentChatId}/messages`, {
          method: 'POST',
          body: {
            text: payload.question,
            replyToId: replySnapshot?.id || null,
            poll: {
              style: payload.style,
              options: payload.options,
              allows_multiple: payload.allows_multiple,
              show_voters: payload.show_voters,
              close_preset: payload.close_preset,
            },
          },
        });
        (actions.closeModal || noop)('pollComposerModal');
        if (dom.msgInput) dom.msgInput.value = '';
        (actions.clearComposerDraft || noop)(currentChatId);
        text.autoResize?.();
        (actions.syncMentionOpenButton || noop)();
        replyEdit.clearReply?.();
        (actions.refreshVoiceComposerState || noop)();
        if (message?.chat_id) {
          (actions.updateChatListLastMessage || noop)(message);
          (actions.cacheMessage || noop)(message);
          if (Number(message.chat_id) === Number(getCurrentChatId()) && !(actions.isMessageDisplayed || (() => false))(message.id)) {
            (actions.appendMessage || noop)(message);
            (actions.scrollToBottom || noop)(false, true);
          }
        }
        (actions.playAppSound || noop)('send');
      } catch (error) {
        setPollComposerStatus(error.message || 'Could not send poll', 'error');
      }
    }

    function bindPollComposerEvents() {
      if (dom.pollComposerModal?.__composerPollBound) return;
      if (dom.pollComposerModal) dom.pollComposerModal.__composerPollBound = true;
      dom.pollBtn?.addEventListener('click', openPollComposer);
      doc.getElementById('pollAddOptionBtn')?.addEventListener('click', () => {
        if (state.pollComposerOptions.length >= POLL_MAX_OPTIONS) return;
        state.pollComposerOptions.push('');
        renderPollComposerOptionInputs();
        refreshPollComposerPreview();
        const nextInput = dom.pollOptionsList?.querySelector(`input[data-poll-option-index="${state.pollComposerOptions.length - 1}"]`);
        nextInput?.focus();
      });
      dom.pollOptionsList?.addEventListener('input', (event) => {
        const input = event.target.closest('input[data-poll-option-index]');
        if (!input) return;
        const index = Number(input.dataset.pollOptionIndex || -1);
        if (index < 0) return;
        state.pollComposerOptions[index] = input.value;
        setPollComposerStatus('');
        refreshPollComposerPreview();
      });
      dom.pollOptionsList?.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-poll-option-remove]');
        if (!btn) return;
        const index = Number(btn.dataset.pollOptionRemove || -1);
        if (index < 0 || state.pollComposerOptions.length <= POLL_MIN_OPTIONS) return;
        state.pollComposerOptions.splice(index, 1);
        renderPollComposerOptionInputs();
        refreshPollComposerPreview();
      });
      dom.pollQuestionInput?.addEventListener('input', () => {
        setPollComposerStatus('');
        refreshPollComposerPreview();
      });
      doc.getElementById('pollAllowMultiple')?.addEventListener('change', refreshPollComposerPreview);
      doc.getElementById('pollShowVoters')?.addEventListener('change', refreshPollComposerPreview);
      doc.getElementById('pollClosePreset')?.addEventListener('change', refreshPollComposerPreview);
      doc.getElementById('pollComposerStyleBtn')?.addEventListener('click', () => (actions.openPollStyleSettingsModal || noop)());
      doc.getElementById('pollSubmitBtn')?.addEventListener('click', submitPollComposer);
    }

    return {
      setPollComposerStatus,
      readPollComposerForm,
      renderPollComposerOptionInputs,
      refreshPollComposerActionState,
      buildPollComposerPreviewMessage,
      refreshPollComposerPreview,
      resetPollComposer,
      openPollComposer,
      submitPollComposer,
      bindPollComposerEvents,
    };
  }

  composerRoot.pollComposer = {
    createPollComposerController,
  };
})();
