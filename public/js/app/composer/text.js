(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const composerRoot = root.composer = root.composer || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function noop() {}

  function createComposerTextController(options = {}) {
    const opts = objectOrDefault(options);
    const doc = opts.document || document;
    const win = opts.window || window;
    const dom = objectOrDefault(opts.dom);
    const state = objectOrDefault(opts.state);
    const actions = objectOrDefault(opts.actions);
    const customEmoji = objectOrDefault(opts.customEmoji || root.customEmoji);
    const formatters = objectOrDefault(opts.formatters || root.formatters);

    const esc = typeof opts.esc === 'function'
      ? opts.esc
      : (typeof formatters.esc === 'function' ? formatters.esc : (value) => String(value == null ? '' : value));
    const normalizeComposerTextToInternal = typeof customEmoji.normalizeComposerTextToInternal === 'function'
      ? customEmoji.normalizeComposerTextToInternal
      : (value) => String(value || '');
    const serializeComposerTextValue = typeof customEmoji.serializeComposerTextValue === 'function'
      ? customEmoji.serializeComposerTextValue
      : (value, { trim = false } = {}) => (trim ? String(value || '').trim() : String(value || ''));
    const findComposerCustomEmojiClusterAt = customEmoji.findComposerCustomEmojiClusterAt || (() => null);
    const findComposerCustomEmojiClusterBefore = customEmoji.findComposerCustomEmojiClusterBefore || (() => null);
    const findComposerCustomEmojiClusterAfter = customEmoji.findComposerCustomEmojiClusterAfter || (() => null);
    const composerCustomEmojiClusterBoundary = customEmoji.composerCustomEmojiClusterBoundary || ((cluster, cursor) => cursor);
    const getComposerCustomEmojiCluster = customEmoji.getComposerCustomEmojiCluster || ((item) => String(item?.token || ''));
    const getComposerCustomEmojiItemFromMarker = customEmoji.getComposerCustomEmojiItemFromMarker || (() => null);
    const getComposerCustomEmojiClusterEnd = customEmoji.getComposerCustomEmojiClusterEnd || ((_source, index) => index + 1);
    const getCustomEmoji = customEmoji.getCustomEmoji || (() => null);
    const getCustomEmojiRenderedSize = customEmoji.getCustomEmojiRenderedSize || (() => ({ width: 20, height: 20 }));
    const renderCustomEmojiHtml = customEmoji.renderCustomEmojiHtml || ((token) => esc(token));

    let msgInputMeasureMirror = null;

    function getMsgInput() {
      return dom.msgInput || doc.getElementById('msgInput');
    }

    function getComposerTextValue({ trim = false } = {}) {
      const msgInput = getMsgInput();
      return serializeComposerTextValue(msgInput?.value || '', { trim });
    }

    function setComposerTextValue(value, { cursor = 'end' } = {}) {
      const msgInput = getMsgInput();
      if (!msgInput) return;
      const nextValue = normalizeComposerTextToInternal(value);
      msgInput.value = nextValue;
      if (cursor === 'end') {
        const end = nextValue.length;
        msgInput.setSelectionRange?.(end, end);
      }
    }

    function normalizeComposerInputValue() {
      const msgInput = getMsgInput();
      if (!msgInput) return false;
      const value = msgInput.value || '';
      const start = msgInput.selectionStart ?? value.length;
      const end = msgInput.selectionEnd ?? start;
      const nextValue = normalizeComposerTextToInternal(value);
      const nextStart = normalizeComposerTextToInternal(value.slice(0, start)).length;
      const nextEnd = normalizeComposerTextToInternal(value.slice(0, end)).length;
      if (nextValue === value) return false;
      msgInput.value = nextValue;
      msgInput.setSelectionRange?.(nextStart, nextEnd);
      return true;
    }

    function snapComposerSelectionToCustomEmojiBoundary() {
      const msgInput = getMsgInput();
      if (!msgInput) return false;
      const value = msgInput.value || '';
      const start = msgInput.selectionStart ?? value.length;
      const end = msgInput.selectionEnd ?? start;
      if (start !== end) return false;
      const cluster = findComposerCustomEmojiClusterAt(value, start);
      if (!cluster || start === cluster.start || start === cluster.end) return false;
      const nextCursor = composerCustomEmojiClusterBoundary(cluster, start);
      msgInput.setSelectionRange?.(nextCursor, nextCursor);
      return true;
    }

    function insertComposerTextAtSelection(text) {
      const msgInput = getMsgInput();
      if (!msgInput) return;
      snapComposerSelectionToCustomEmojiBoundary();
      const value = msgInput.value || '';
      const start = Math.max(0, msgInput.selectionStart ?? value.length);
      const end = Math.max(start, msgInput.selectionEnd ?? start);
      const insertion = normalizeComposerTextToInternal(text);
      msgInput.value = value.slice(0, start) + insertion + value.slice(end);
      const cursor = start + insertion.length;
      msgInput.setSelectionRange?.(cursor, cursor);
    }

    function insertDictatedText(text) {
      const msgInput = getMsgInput();
      const insertion = String(text || '').trim();
      if (!msgInput || !insertion) return getComposerTextValue();
      insertComposerTextAtSelection(insertion);
      msgInput.dispatchEvent(new win.Event('input', { bubbles: true }));
      msgInput.focus?.();
      return getComposerTextValue();
    }

    function getEmojiPickerInsertionValue(value) {
      const item = getCustomEmoji(value);
      return item ? getComposerCustomEmojiCluster(item) : String(value || '');
    }

    function deleteComposerCustomEmojiCluster(cluster) {
      const msgInput = getMsgInput();
      if (!msgInput || !cluster) return false;
      const value = msgInput.value || '';
      msgInput.value = value.slice(0, cluster.start) + value.slice(cluster.end);
      msgInput.setSelectionRange?.(cluster.start, cluster.start);
      msgInput.dispatchEvent(new win.Event('input', { bubbles: true }));
      return true;
    }

    function handleComposerCustomEmojiKeydown(e) {
      const msgInput = getMsgInput();
      if (!msgInput) return false;
      const value = msgInput.value || '';
      const start = msgInput.selectionStart ?? value.length;
      const end = msgInput.selectionEnd ?? start;
      if (start !== end) return false;

      if (e.key === 'Backspace') {
        const cluster = findComposerCustomEmojiClusterBefore(value, start);
        if (!cluster) return false;
        e.preventDefault();
        return deleteComposerCustomEmojiCluster(cluster);
      }

      if (e.key === 'Delete') {
        const cluster = findComposerCustomEmojiClusterAfter(value, start);
        if (!cluster) return false;
        e.preventDefault();
        return deleteComposerCustomEmojiCluster(cluster);
      }

      if (e.key === 'ArrowLeft') {
        const cluster = findComposerCustomEmojiClusterBefore(value, start);
        if (!cluster || cluster.end !== start) return false;
        e.preventDefault();
        msgInput.setSelectionRange?.(cluster.start, cluster.start);
        return true;
      }

      if (e.key === 'ArrowRight') {
        const cluster = findComposerCustomEmojiClusterAfter(value, start);
        if (!cluster || cluster.start !== start) return false;
        e.preventDefault();
        msgInput.setSelectionRange?.(cluster.end, cluster.end);
        return true;
      }

      return false;
    }

    function handleComposerCustomEmojiBeforeInput(e) {
      const msgInput = getMsgInput();
      if (!msgInput) return false;
      if (e.inputType === 'deleteContentBackward') {
        const value = msgInput.value || '';
        const start = msgInput.selectionStart ?? value.length;
        const end = msgInput.selectionEnd ?? start;
        if (start === end) {
          const cluster = findComposerCustomEmojiClusterBefore(value, start);
          if (cluster) {
            e.preventDefault();
            return deleteComposerCustomEmojiCluster(cluster);
          }
        }
      }
      if (e.inputType === 'deleteContentForward') {
        const value = msgInput.value || '';
        const start = msgInput.selectionStart ?? value.length;
        const end = msgInput.selectionEnd ?? start;
        if (start === end) {
          const cluster = findComposerCustomEmojiClusterAfter(value, start);
          if (cluster) {
            e.preventDefault();
            return deleteComposerCustomEmojiCluster(cluster);
          }
        }
      }
      snapComposerSelectionToCustomEmojiBoundary();
      return false;
    }

    function getVisibleComposerToolCount() {
      return [dom.attachBtn, dom.pollBtn, dom.emojiBtn].filter((button) => {
        if (!(button instanceof win.HTMLElement)) return false;
        const styles = win.getComputedStyle(button);
        return styles.display !== 'none' && styles.visibility !== 'hidden';
      }).length || 1;
    }

    function getComposerInputWidthForMode(multiline = Boolean(dom.inputRow?.classList.contains('is-multiline'))) {
      const msgInput = getMsgInput();
      if (!dom.inputRow || !msgInput) return msgInput?.clientWidth || 1;
      const rowStyles = win.getComputedStyle(dom.inputRow);
      const toolSize = parseFloat(rowStyles.getPropertyValue('--composer-tool-size')) || 36;
      const toolGap = parseFloat(rowStyles.getPropertyValue('--composer-tool-gap')) || 4;
      const rowGap = parseFloat(rowStyles.columnGap || rowStyles.gap) || 4;
      const toolCount = getVisibleComposerToolCount();
      const toolWidth = multiline
        ? toolSize
        : (toolCount * toolSize) + (Math.max(0, toolCount - 1) * toolGap);
      const sendWidth = dom.sendBtn?.getBoundingClientRect?.().width || 44;
      const rowWidth = dom.inputRow.getBoundingClientRect().width || msgInput.clientWidth || 1;
      return Math.max(1, rowWidth - toolWidth - sendWidth - (rowGap * 2));
    }

    function getNormalComposerInputWidth() {
      return getComposerInputWidthForMode(false);
    }

    function measureMsgInputScrollHeight(width) {
      const msgInput = getMsgInput();
      if (!msgInput) return 0;
      if (!msgInputMeasureMirror) {
        msgInputMeasureMirror = doc.createElement('textarea');
        msgInputMeasureMirror.setAttribute('aria-hidden', 'true');
        msgInputMeasureMirror.tabIndex = -1;
        msgInputMeasureMirror.rows = 1;
        Object.assign(msgInputMeasureMirror.style, {
          position: 'fixed',
          left: '-9999px',
          top: '0',
          visibility: 'hidden',
          pointerEvents: 'none',
          overflow: 'hidden',
          resize: 'none',
        });
        doc.body.appendChild(msgInputMeasureMirror);
      }

      const sourceStyles = win.getComputedStyle(msgInput);
      [
        'boxSizing', 'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'letterSpacing',
        'lineHeight', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
        'whiteSpace', 'wordBreak', 'overflowWrap', 'textTransform', 'textIndent'
      ].forEach((property) => {
        msgInputMeasureMirror.style[property] = sourceStyles[property];
      });
      msgInputMeasureMirror.style.width = `${Math.max(1, Math.round(width))}px`;
      msgInputMeasureMirror.value = msgInput.value || '';
      msgInputMeasureMirror.style.height = 'auto';
      return msgInputMeasureMirror.scrollHeight;
    }

    function getComposerInputTextMetrics() {
      const msgInput = getMsgInput();
      if (!msgInput) return { lineHeight: 20, paddingY: 0, borderY: 0, singleLineHeight: 20, twoLineHeight: 40 };
      const styles = win.getComputedStyle(msgInput);
      const fontSize = parseFloat(styles.fontSize) || 15;
      const lineHeight = parseFloat(styles.lineHeight) || (fontSize * 1.35);
      const paddingY = (parseFloat(styles.paddingTop) || 0) + (parseFloat(styles.paddingBottom) || 0);
      const borderY = (parseFloat(styles.borderTopWidth) || 0) + (parseFloat(styles.borderBottomWidth) || 0);
      return {
        lineHeight,
        paddingY,
        borderY,
        singleLineHeight: lineHeight + paddingY + borderY,
        twoLineHeight: (lineHeight * 2) + paddingY + borderY,
      };
    }

    function renderComposerRichPreviewContent(value) {
      const source = String(value || '');
      const tokenRe = /^:qip-infium-\d{3}:|^:qip-hd-[a-z0-9][a-z0-9-]{0,63}:/i;
      let html = '';
      let text = '';
      let hasEmoji = false;
      let maxEmojiHeight = 0;
      for (let index = 0; index < source.length;) {
        let item = getComposerCustomEmojiItemFromMarker(source[index]);
        let token = item?.token || '';
        let nextIndex = item ? getComposerCustomEmojiClusterEnd(source, index) : index + 1;
        if (!item) {
          const tokenMatch = source.slice(index).match(tokenRe);
          if (tokenMatch) {
            token = tokenMatch[0];
            item = getCustomEmoji(token);
            if (item) nextIndex = index + token.length;
          }
        }
        if (!item) {
          text += source[index];
          index += 1;
          continue;
        }
        html += esc(text);
        text = '';
        html += renderCustomEmojiHtml(token, { className: 'composer-rich-emoji' });
        hasEmoji = true;
        maxEmojiHeight = Math.max(maxEmojiHeight, getCustomEmojiRenderedSize(item).height);
        index = nextIndex;
      }
      html += esc(text);
      return { html, hasEmoji, maxEmojiHeight };
    }

    function syncComposerRichPreview(metrics = getComposerInputTextMetrics()) {
      const msgInput = getMsgInput();
      const composerRichPreview = dom.composerRichPreview;
      if (!composerRichPreview || !msgInput) return 0;
      const rendered = renderComposerRichPreviewContent(msgInput.value || '');
      const wrap = msgInput.closest?.('.composer-input-wrap');
      composerRichPreview.classList.toggle('hidden', !rendered.hasEmoji);
      composerRichPreview.innerHTML = rendered.hasEmoji ? rendered.html : '';
      wrap?.classList?.toggle('has-rich-preview', rendered.hasEmoji);
      dom.inputRow?.classList?.toggle('has-rich-emoji-preview', rendered.hasEmoji);
      if (!rendered.hasEmoji) {
        wrap?.classList?.remove('rich-preview-two-line');
        dom.inputRow?.classList?.remove('is-rich-emoji-multiline');
        return 0;
      }

      const needsTwoLines = rendered.maxEmojiHeight > metrics.lineHeight + 2;
      wrap?.classList?.toggle('rich-preview-two-line', needsTwoLines);
      dom.inputRow?.classList?.toggle('is-rich-emoji-multiline', needsTwoLines);
      if (!needsTwoLines) return metrics.singleLineHeight;
      return Math.max(metrics.twoLineHeight, rendered.maxEmojiHeight + metrics.paddingY + metrics.borderY + 2);
    }

    function autoResize() {
      const msgInput = getMsgInput();
      if (!msgInput) return;
      const wasMultiline = Boolean(dom.inputRow?.classList.contains('is-multiline'));
      const previousHeight = parseFloat(msgInput.style.height) || 0;
      const previousInputAreaHeight = Math.max(0, dom.inputArea?.getBoundingClientRect?.().height || 0);
      const metrics = getComposerInputTextMetrics();
      const richPreviewHeight = syncComposerRichPreview(metrics);
      const normalInputWidth = getNormalComposerInputWidth();
      const normalScrollHeight = measureMsgInputScrollHeight(normalInputWidth);
      const normalHeight = Math.min(Math.max(normalScrollHeight, richPreviewHeight), 150);
      const isMultiline = normalHeight > metrics.singleLineHeight + 2;
      dom.inputRow?.classList.toggle('is-multiline', isMultiline);
      const finalInputWidth = getComposerInputWidthForMode(isMultiline);
      const finalScrollHeight = measureMsgInputScrollHeight(finalInputWidth);
      const nextHeight = Math.min(Math.max(finalScrollHeight, richPreviewHeight), 150);
      msgInput.style.height = nextHeight + 'px';
      if (dom.inputRow) {
        const changed = wasMultiline !== isMultiline;
        const heightChanged = Math.abs(nextHeight - previousHeight) > 0.5;
        const nextInputAreaHeight = Math.max(0, dom.inputArea?.getBoundingClientRect?.().height || 0);
        const inputAreaDelta = nextInputAreaHeight - previousInputAreaHeight;
        const inputHeightDelta = previousHeight > 0 ? nextHeight - previousHeight : 0;
        const effectiveInputDelta = Math.abs(inputAreaDelta) >= Math.abs(inputHeightDelta)
          ? inputAreaDelta
          : inputHeightDelta;
        if ((previousInputAreaHeight > 0 || previousHeight > 0) && Math.abs(effectiveInputDelta) > 0.5) {
          (actions.noteMobileKeyboardInputDelta || noop)(effectiveInputDelta);
        }
        if ((changed || heightChanged) && state.emojiPickerOpen && (actions.isFloatingSurfaceVisible || (() => false))(dom.emojiPicker)) {
          win.requestAnimationFrame(() => (actions.positionEmojiPicker || noop)(dom.emojiBtn));
        }
        if ((changed || heightChanged) && (actions.isMobileLayoutViewport || (() => false))()) {
          (actions.forceMobileViewportLayoutSync || noop)();
          (actions.scheduleMobileViewportRecovery || noop)(90);
        }
      }
      (actions.queueIosViewportLayoutSync || noop)();
    }

    function animateSendButton() {
      const sendBtn = dom.sendBtn;
      if (!sendBtn) return;
      sendBtn.classList.remove('send-fly');
      void sendBtn.offsetWidth;
      sendBtn.classList.add('send-fly');
      clearTimeout(sendBtn.__sendFlyTimer);
      sendBtn.__sendFlyTimer = win.setTimeout(() => {
        sendBtn.classList.remove('send-fly');
        (actions.refreshVoiceComposerState || noop)();
      }, 320);
    }

    return {
      getComposerTextValue,
      setComposerTextValue,
      normalizeComposerInputValue,
      insertComposerTextAtSelection,
      insertDictatedText,
      deleteComposerCustomEmojiCluster,
      handleComposerCustomEmojiKeydown,
      handleComposerCustomEmojiBeforeInput,
      snapComposerSelectionToCustomEmojiBoundary,
      getEmojiPickerInsertionValue,
      getVisibleComposerToolCount,
      getComposerInputWidthForMode,
      getNormalComposerInputWidth,
      measureMsgInputScrollHeight,
      getComposerInputTextMetrics,
      renderComposerRichPreviewContent,
      syncComposerRichPreview,
      autoResize,
      animateSendButton,
    };
  }

  composerRoot.text = {
    createComposerTextController,
  };
})();
