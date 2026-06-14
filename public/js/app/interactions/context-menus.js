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

function createContextMenus(options = {}) {
  const opts = objectOrDefault(options);
  const win = opts.window || window;
  const doc = opts.document || document;
  const dom = objectOrDefault(opts.dom);
  const state = objectOrDefault(opts.state);
  const actions = objectOrDefault(opts.actions);
  const config = objectOrDefault(opts.config || root.config);
  const getFloating = () => objectOrDefault(typeof opts.getFloatingActions === 'function' ? opts.getFloatingActions() : opts.floatingActions);
  const getReactions = () => objectOrDefault(typeof opts.getReactions === 'function' ? opts.getReactions() : opts.reactions);
  const getForwarding = () => objectOrDefault(typeof opts.getForwarding === 'function' ? opts.getForwarding() : opts.forwarding);
  const deps = {
    window: win, document: doc, navigator: win.navigator, location: win.location, Element: win.Element, HTMLElement: win.HTMLElement, File: win.File, Blob: win.Blob, Image: win.Image, ClipboardItem: getter(() => win.ClipboardItem), URL: win.URL,
    chatList: dom.chatList, messagesEl: dom.messagesEl, chatContextMenuBackdrop: dom.chatContextMenuBackdrop, chatContextMenu: dom.chatContextMenu, mediaContextMenuBackdrop: dom.mediaContextMenuBackdrop, mediaContextMenu: dom.mediaContextMenu, currentChatId: getter(() => state.getCurrentChatId?.() || null), chatSearch: dom.chatSearch,
    MEDIA_CONTEXT_TARGET_SELECTOR: config.MEDIA_CONTEXT_TARGET_SELECTOR || '.msg-image, .msg-video video, .msg-audio audio, .msg-file, .video-note-stage', MEDIA_CONTEXT_LONG_PRESS_MS: config.MEDIA_CONTEXT_LONG_PRESS_MS ?? 500, CHAT_CONTEXT_LONG_PRESS_MS: config.CHAT_CONTEXT_LONG_PRESS_MS ?? 500,
    api: opts.api || actions.api || (() => Promise.resolve({})), esc: opts.esc || ((value) => String(value == null ? '' : value)), t: opts.t || ((key) => String(key || '')), tx: opts.tx || ((text) => String(text == null ? '' : text)), confirm: opts.confirm || win.confirm?.bind(win) || (() => false),
    getChatById: actions.getChatById || (() => null), getActiveChatFolder: actions.getActiveChatFolder || (() => null), getPinnedChatMoveState: actions.getPinnedChatMoveState || (() => ({ canMoveUp: false, canMoveDown: false })), getFolderPinnedChatMoveState: actions.getFolderPinnedChatMoveState || (() => ({ canMoveUp: false, canMoveDown: false })), isChatPinned: actions.isChatPinned || (() => false), isChatPinnedInFolder: actions.isChatPinnedInFolder || (() => false), localChatPreferenceEnabled: actions.localChatPreferenceEnabled || ((value) => value !== false), canHideChat: actions.canHideChat || (() => false), canLeaveChat: actions.canLeaveChat || (() => false), canManageDestructiveChat: actions.canManageDestructiveChat || (() => false), setChatSidebarPin: actions.setChatSidebarPin || (() => Promise.resolve(false)), moveChatSidebarPin: actions.moveChatSidebarPin || (() => Promise.resolve(false)), setFolderChatPin: actions.setFolderChatPin || (() => Promise.resolve(false)), moveFolderChatPin: actions.moveFolderChatPin || (() => Promise.resolve(false)), removeChatFromFolder: actions.removeChatFromFolder || (() => Promise.resolve(false)), openChatFolderManageModal: actions.openChatFolderManageModal || (() => Promise.resolve(false)), hideChatFromList: actions.hideChatFromList || (() => Promise.resolve(false)), leaveChat: actions.leaveChat || (() => Promise.resolve(false)), deleteChatCompletely: actions.deleteChatCompletely || (() => Promise.resolve(false)), loadChats: actions.loadChats || (() => Promise.resolve([])), renderChatList: actions.renderChatList || function noop() {}, renderChatPreferencesForm: actions.renderChatPreferencesForm || function noop() {},
    getAttachmentPreviewUrl: actions.getAttachmentPreviewUrl || (() => ''), getAttachmentDownloadUrl: actions.getAttachmentDownloadUrl || (() => ''), getMediaNoteFallbackLabel: actions.getMediaNoteFallbackLabel || (() => ''), normalizeMimeType: actions.normalizeMimeType || ((value) => String(value || '')), filenameFromContentDisposition: actions.filenameFromContentDisposition || ((_header, fallback) => fallback), getMessageCopyTextData: actions.getMessageCopyTextData || (() => ({ text: '', hasMeaningfulContent: false })), canForwardMessage: actions.canForwardMessage || (() => false), canSaveMessageToNotes: actions.canSaveMessageToNotes || (() => false), canEditMessage: actions.canEditMessage || (() => false), getPinActionState: actions.getPinActionState || (() => ({ show: false, isPinned: false, disabled: false })), copyTextToClipboard: actions.copyTextToClipboard || (() => Promise.resolve(false)), showCenterToast: actions.showCenterToast || function noop() {}, setReplyFromRow: actions.setReplyFromRow || function noop() {}, setEditFromRow: actions.setEditFromRow || function noop() {}, togglePinFromRow: actions.togglePinFromRow || (() => Promise.resolve(false)), hasAndroidNativeBridge: actions.hasAndroidNativeBridge || (() => false), safeVibrate: actions.safeVibrate || function noop() {}, isMobileLayoutViewport: actions.isMobileLayoutViewport || (() => false), isMobileComposerKeyboardOpen: actions.isMobileComposerKeyboardOpen || (() => false), focusComposerKeepKeyboard: actions.focusComposerKeepKeyboard || function noop() {},
    isFloatingSurfaceVisible: (...args) => getFloating().isFloatingSurfaceVisible?.(...args), getFloatingViewportRect: (...args) => getFloating().getFloatingViewportRect?.(...args), clamp: (...args) => getFloating().clamp?.(...args), measureFloatingSurface: (...args) => getFloating().measureFloatingSurface?.(...args), positionFloatingElement: (...args) => getFloating().positionFloatingElement?.(...args), openFloatingSurface: (...args) => getFloating().openFloatingSurface?.(...args), closeFloatingSurface: (...args) => getFloating().closeFloatingSurface?.(...args), hideFloatingMessageActions: (...args) => getFloating().hideFloatingMessageActions?.(...args), suppressNextMessageActionTap: (...args) => getFloating().suppressNextMessageActionTap?.(...args), hideReactionUi: (...args) => getReactions().hideReactionUi?.(...args), showReactionPicker: (...args) => getReactions().showReactionPicker?.(...args), reactionPickerKeepKeyboard: getter(() => Boolean(getReactions().getReactionPickerKeepKeyboard?.())), openForwardMessageModal: (...args) => getForwarding().openForwardMessageModal?.(...args), saveMessageToNotes: (...args) => getForwarding().saveMessageToNotes?.(...args),
  };
  const scope = createLegacyScope(deps, win);
  with (scope) {
let chatContextMenuState = null;
let chatContextLongPressTimer = null;
let chatContextLongPressStart = null;
let chatContextLongPressRow = null;
let mediaContextMenuState = null;
let mediaContextLongPressTimer = null;
let mediaContextLongPressStart = null;
let mediaContextLongPressRow = null;
let mediaContextLongPressTarget = null;
let suppressChatContextDismissUntil = 0;
function clearChatContextLongPress() {
  clearTimeout(chatContextLongPressTimer);
  chatContextLongPressTimer = null;
  chatContextLongPressStart = null;
  chatContextLongPressRow = null;
}

function canReplyToMessageRow(row) {
  return Boolean(
    row?.__replyPayload
    && row.dataset.outbox !== '1'
    && !row.querySelector('.msg-deleted')
  );
}

function clearMediaContextLongPress() {
  clearTimeout(mediaContextLongPressTimer);
  mediaContextLongPressTimer = null;
  mediaContextLongPressStart = null;
  mediaContextLongPressRow = null;
  mediaContextLongPressTarget = null;
}

function getMessageMediaContextTarget(target) {
  return target?.closest?.(MEDIA_CONTEXT_TARGET_SELECTOR) || null;
}

function getMessageMediaKindLabel(kind) {
  switch (kind) {
    case 'image': return 'Image';
    case 'video': return 'Video';
    case 'audio': return 'Audio';
    case 'video-note': return 'Video note';
    default: return 'File';
  }
}

function getDefaultMessageMediaMime(kind) {
  switch (kind) {
    case 'image': return 'image/png';
    case 'video':
    case 'video-note': return 'video/mp4';
    case 'audio': return 'audio/mpeg';
    default: return 'application/octet-stream';
  }
}

function getAbsoluteMessageMediaUrl(url) {
  if (!url) return '';
  try {
    return new URL(url, location.href).href;
  } catch {
    return '';
  }
}

function getMessageMediaContext(row, target) {
  const msg = row?.__messageData || {};
  const mediaTarget = getMessageMediaContextTarget(target);
  if (!row || !mediaTarget || row.dataset.outbox === '1' || row.querySelector('.msg-deleted')) return null;
  let mediaKind = 'file';
  if (mediaTarget.closest('.video-note-stage') || msg.is_video_note) mediaKind = 'video-note';
  else if (mediaTarget.closest('.msg-image') || msg.file_type === 'image') mediaKind = 'image';
  else if (mediaTarget.closest('.msg-video video') || msg.file_type === 'video') mediaKind = 'video';
  else if (mediaTarget.closest('.msg-audio audio') || msg.file_type === 'audio' || (msg.is_voice_note && !msg.is_video_note)) mediaKind = 'audio';
  const previewUrl = getAttachmentPreviewUrl(msg);
  const downloadUrl = getAttachmentDownloadUrl(msg) || previewUrl;
  const absoluteUrl = getAbsoluteMessageMediaUrl(downloadUrl || previewUrl);
  if (!absoluteUrl) return null;
  const fallbackName = getMediaNoteFallbackLabel(msg, {
    voiceLabel: 'voice-message',
    videoLabel: 'video-note',
  }) || 'attachment';
  const filename = String(msg.file_name || fallbackName || 'attachment').trim() || 'attachment';
  const mime = normalizeMimeType(msg.file_mime || getDefaultMessageMediaMime(mediaKind));
  const copyData = getMessageCopyTextData(row);
  return {
    row,
    msg,
    mediaTarget,
    mediaKind,
    mediaKindLabel: getMessageMediaKindLabel(mediaKind),
    previewUrl,
    downloadUrl,
    absoluteUrl,
    filename,
    mime,
    copyText: copyData.text,
    canCopyText: copyData.hasMeaningfulContent,
    canReply: canReplyToMessageRow(row),
    canForward: canForwardMessage(msg),
    canSaveNote: canSaveMessageToNotes(msg),
    canEdit: canEditMessage(msg),
    pinState: getPinActionState(msg),
  };
}

function canCopyImageBinary() {
  if (hasAndroidNativeBridge()) return true;
  if (!window.isSecureContext || !navigator.clipboard?.write || typeof ClipboardItem === 'undefined') return false;
  try {
    if (typeof ClipboardItem.supports === 'function') {
      return ClipboardItem.supports('image/png');
    }
  } catch {}
  return true;
}

function canShareMediaFileContext(context) {
  if (!context?.absoluteUrl) return false;
  if (hasAndroidNativeBridge()) return true;
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function' || typeof File === 'undefined') return false;
  try {
    const probeFile = new File(['bananza'], context.filename || 'attachment', {
      type: context.mime || 'application/octet-stream',
    });
    return navigator.canShare({ files: [probeFile] });
  } catch {
    return false;
  }
}

async function fetchMessageMediaBlob(context) {
  const response = await fetch(context.absoluteUrl, {
    credentials: 'same-origin',
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const dispositionName = filenameFromContentDisposition(
    response.headers.get('content-disposition'),
    context.filename || 'attachment'
  );
  const blob = await response.blob();
  const mime = normalizeMimeType(blob.type || context.mime || 'application/octet-stream') || 'application/octet-stream';
  const normalizedBlob = normalizeMimeType(blob.type) === mime ? blob : new Blob([blob], { type: mime });
  return {
    blob: normalizedBlob,
    mime,
    filename: dispositionName || context.filename || 'attachment',
  };
}

function downloadBlobFile(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename || 'attachment';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

function triggerBrowserMediaDownload(context) {
  const link = document.createElement('a');
  link.href = context.absoluteUrl;
  link.download = context.filename || 'attachment';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function loadImageFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not decode image'));
    };
    img.src = objectUrl;
  });
}

async function rasterizeImageBlobToPng(blob) {
  if (normalizeMimeType(blob.type) === 'image/png') return blob;
  const img = await loadImageFromBlob(blob);
  const width = Math.max(1, img.naturalWidth || img.width || 1);
  const height = Math.max(1, img.naturalHeight || img.height || 1);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('Canvas is not available');
  ctx.drawImage(img, 0, 0, width, height);
  const pngBlob = await new Promise((resolve, reject) => {
    canvas.toBlob((nextBlob) => {
      if (nextBlob) resolve(nextBlob);
      else reject(new Error('Could not prepare clipboard image'));
    }, 'image/png');
  });
  return pngBlob;
}

function notifyAndroidMediaAction(context, action) {
  if (!hasAndroidNativeBridge()) return false;
  try {
    window.BananzaAndroid.postMessage(JSON.stringify({
      type: 'media_action',
      payload: {
        action,
        url: context.absoluteUrl,
        filename: context.filename || 'attachment',
        mime: context.mime || 'application/octet-stream',
        mediaKind: context.mediaKind || 'file',
        messageId: Number(context.msg?.id || 0),
      },
    }));
    return true;
  } catch {
    return false;
  }
}

async function copyImageFromMediaContext(context) {
  if (notifyAndroidMediaAction(context, 'copy-image')) {
    return true;
  }
  if (!canCopyImageBinary()) throw new Error('Copy image is not available');
  const item = new ClipboardItem({
    'image/png': fetchMessageMediaBlob(context).then(({ blob }) => rasterizeImageBlobToPng(blob)),
  });
  await navigator.clipboard.write([item]);
  showCenterToast('Image copied');
  return true;
}

async function shareMediaFromContext(context) {
  if (notifyAndroidMediaAction(context, 'share-media')) {
    return true;
  }
  if (!canShareMediaFileContext(context)) throw new Error('Share is not available');
  const { blob, filename, mime } = await fetchMessageMediaBlob(context);
  const file = new File([blob], filename || context.filename || 'attachment', {
    type: mime || blob.type || 'application/octet-stream',
  });
  if (!navigator.canShare({ files: [file] })) throw new Error('Share is not available');
  await navigator.share({
    files: [file],
    title: filename || context.filename || 'attachment',
  });
  return true;
}

function renderMediaContextMenu(context) {
  if (!mediaContextMenu || !context) return;
  const canCopyImage = context.mediaKind === 'image' && canCopyImageBinary();
  const canShareMedia = canShareMediaFileContext(context);
  const pinState = context.pinState || { show: false, isPinned: false, disabled: false };
  const actions = [
    {
      action: 'copy-text',
      icon: '&#10697;',
      label: t('Copy text'),
      hidden: !context.canCopyText,
    },
    {
      action: 'copy-image',
      icon: '&#128247;',
      label: t('Copy image'),
      hidden: !canCopyImage,
      primary: true,
    },
    {
      action: 'copy-link',
      icon: '&#128279;',
      label: t('Copy link'),
      hidden: !context.absoluteUrl,
    },
    {
      action: 'save-media',
      icon: '&#128190;',
      label: t('Save'),
      hidden: !context.absoluteUrl,
      primary: true,
    },
    {
      action: 'share-media',
      icon: '&#128257;',
      label: t('Share'),
      hidden: !canShareMedia,
      primary: true,
    },
    {
      action: 'reply',
      icon: '&#8617;',
      label: t('Reply'),
      hidden: !context.canReply,
    },
    {
      action: 'forward',
      icon: '&#128228;',
      label: t('Forward'),
      hidden: !context.canForward,
    },
    {
      action: 'save-note',
      icon: '&#128221;',
      label: t('Save to notes'),
      hidden: !context.canSaveNote,
    },
    {
      action: 'edit',
      icon: '&#9998;',
      label: t('Edit'),
      hidden: !context.canEdit,
    },
    {
      action: 'toggle-pin',
      icon: '&#128204;',
      label: t(pinState.isPinned ? 'Unpin' : 'Pin'),
      hidden: !pinState.show,
      disabled: Boolean(pinState.disabled),
    },
    {
      action: 'react',
      icon: '&#128578;',
      label: t('React'),
      hidden: context.canReact === false,
    },
  ];
  mediaContextMenu.innerHTML = `
    <div class="chat-context-menu-sheet">
      <div class="chat-context-menu-header">
        ${esc(context.filename || t('Attachment'))}
        <span class="media-context-menu-header-meta">${esc(tx(context.mediaKindLabel || 'Attachment'))}</span>
      </div>
      ${actions
        .filter((item) => !item.hidden)
        .map((item) => `
          <button
            type="button"
            class="chat-context-menu-button media-context-menu-button${item.primary ? ' is-primary' : ''}"
            data-media-action="${esc(item.action)}"
            ${item.disabled ? 'disabled' : ''}
          >
            <span class="chat-context-menu-icon" aria-hidden="true">${item.icon}</span>
            <span class="chat-context-menu-label">${esc(item.label)}</span>
          </button>
        `).join('')}
    </div>
  `;
  mediaContextMenu.setAttribute('aria-hidden', 'false');
  mediaContextMenu.setAttribute('role', 'menu');
  mediaContextMenu.dataset.messageId = String(context.msg?.id || '');
}

function showMediaContextMenuForContext(context, { row = null, target = null, x = null, y = null, source = 'contextmenu' } = {}) {
  if (!context || !mediaContextMenu || !mediaContextMenuBackdrop) return;
  const messageId = Number(context.msg?.id || row?.dataset?.msgId || 0);
  const contextKey = String(context.mediaContextKey || `${messageId}:${context.absoluteUrl || ''}`);
  if (isFloatingSurfaceVisible(mediaContextMenu) && mediaContextMenuState?.contextKey === contextKey) {
    return;
  }
  hideMediaContextMenu({ immediate: true });
  hideChatContextMenu({ immediate: true });
  hideFloatingMessageActions({ immediate: true });
  hideReactionUi({ immediate: true, keepComposerState: reactionPickerKeepKeyboard });
  const keyboardAttached = isMobileComposerKeyboardOpen();
  const resolvedContext = {
    ...context,
    row: row || context.row || null,
    mediaTarget: target || context.mediaTarget || null,
  };
  mediaContextMenuState = {
    messageId,
    contextKey,
    row: row || context.row || null,
    context: resolvedContext,
    pointerX: typeof x === 'number' && Number.isFinite(x) ? x : null,
    pointerY: typeof y === 'number' && Number.isFinite(y) ? y : null,
    source,
    mode: source === 'long-press' && isMobileLayoutViewport() ? 'sheet' : 'popup',
    keyboardAttached,
  };
  renderMediaContextMenu(resolvedContext);
  mediaContextMenu.classList.toggle('is-sheet', mediaContextMenuState.mode === 'sheet');
  positionMediaContextMenu();
  openFloatingSurface(mediaContextMenuBackdrop);
  openFloatingSurface(mediaContextMenu);
  requestAnimationFrame(() => {
    positionMediaContextMenu();
    if (!keyboardAttached) mediaContextMenu.querySelector('.media-context-menu-button:not(:disabled)')?.focus({ preventScroll: true });
    else focusComposerKeepKeyboard(true);
  });
}

function positionMediaContextMenu() {
  if (!mediaContextMenuState || !mediaContextMenu || mediaContextMenu.classList.contains('hidden')) return;
  const viewport = getFloatingViewportRect();
  const size = measureFloatingSurface(mediaContextMenu, mediaContextMenuState.mode === 'sheet' ? 240 : 220, 300);
  if (mediaContextMenuState.mode === 'sheet') {
    const left = clamp((viewport.left + viewport.right - size.width) / 2, viewport.left + 10, viewport.right - size.width - 10);
    const top = clamp(viewport.bottom - size.height - 10, viewport.top + 10, viewport.bottom - size.height - 10);
    mediaContextMenu.style.right = 'auto';
    mediaContextMenu.style.bottom = 'auto';
    positionFloatingElement(mediaContextMenu, left, top);
    return;
  }
  const pointerX = Number.isFinite(mediaContextMenuState.pointerX) ? mediaContextMenuState.pointerX : viewport.left + 12;
  const pointerY = Number.isFinite(mediaContextMenuState.pointerY) ? mediaContextMenuState.pointerY : viewport.top + 12;
  const left = clamp(pointerX - 10, viewport.left + 8, viewport.right - size.width - 8);
  const top = clamp(pointerY + 8, viewport.top + 8, viewport.bottom - size.height - 8);
  mediaContextMenu.style.right = 'auto';
  mediaContextMenu.style.bottom = 'auto';
  positionFloatingElement(mediaContextMenu, left, top);
}

function hideMediaContextMenu({ immediate = false } = {}) {
  clearMediaContextLongPress();
  closeFloatingSurface(mediaContextMenuBackdrop, { immediate });
  closeFloatingSurface(mediaContextMenu, {
    immediate,
    onAfterClose: () => {
      if (mediaContextMenu) {
        mediaContextMenu.innerHTML = '';
        mediaContextMenu.setAttribute('aria-hidden', 'true');
        mediaContextMenu.classList.remove('is-sheet');
        mediaContextMenu.style.left = '';
        mediaContextMenu.style.top = '';
        mediaContextMenu.style.right = '';
        mediaContextMenu.style.bottom = '';
      }
      mediaContextMenuState = null;
    },
  });
}

function showMediaContextMenuForRow(row, target, { x = null, y = null, source = 'contextmenu' } = {}) {
  const context = getMessageMediaContext(row, target);
  if (!context) return;
  showMediaContextMenuForContext(context, { row, target, x, y, source });
}

async function handleMediaContextMenuAction(action, context) {
  if (!context || !action) return;
  const keepComposerFocus = Boolean(reactionPickerKeepKeyboard || mediaContextMenuState?.keyboardAttached || isMobileComposerKeyboardOpen());
  if (action === 'react') {
    hideMediaContextMenu();
    showReactionPicker(context.row, null, {
      source: 'media-context',
      keepComposerFocus,
    });
    return;
  }
  hideMediaContextMenu();
  try {
    switch (action) {
      case 'copy-text': {
        const copied = await copyTextToClipboard(context.copyText);
        showCenterToast(copied ? 'Text copied' : 'Could not copy text');
        break;
      }
      case 'copy-link': {
        const copied = await copyTextToClipboard(context.absoluteUrl);
        showCenterToast(copied ? 'Link copied' : 'Could not copy link');
        break;
      }
      case 'copy-image':
        await copyImageFromMediaContext(context);
        break;
      case 'save-media':
        if (notifyAndroidMediaAction(context, 'save-media')) {
          showCenterToast('Saving...');
          break;
        }
        triggerBrowserMediaDownload(context);
        showCenterToast('Download started');
        break;
      case 'share-media':
        await shareMediaFromContext(context);
        break;
      case 'reply':
        setReplyFromRow(context.row);
        break;
      case 'forward':
        openForwardMessageModal(context.msg);
        break;
      case 'save-note':
        saveMessageToNotes(context.msg);
        break;
      case 'edit':
        setEditFromRow(context.row);
        break;
      case 'toggle-pin':
        await togglePinFromRow(context.row);
        break;
      default:
        break;
    }
  } catch (error) {
    if (action === 'share-media' && error?.name === 'AbortError') return;
    showCenterToast(error?.message || 'Action failed');
  }
}


function renderChatContextMenu(chat) {
  if (!chatContextMenu || !chat) return;
  const activeFolder = getActiveChatFolder();
  const folderId = Number(activeFolder?.id || 0);
  const pinned = isChatPinned(chat);
  const moveState = getPinnedChatMoveState(chat.id);
  const folderPinned = activeFolder ? isChatPinnedInFolder(folderId, chat) : false;
  const folderMoveState = activeFolder
    ? getFolderPinnedChatMoveState(folderId, chat.id)
    : { canMoveUp: false, canMoveDown: false };
  const notificationsEnabled = localChatPreferenceEnabled(chat.notify_enabled);
  const soundsEnabled = localChatPreferenceEnabled(chat.sounds_enabled);
  const actions = [
    {
      action: 'manage-folders',
      icon: '&#128193;',
      label: 'Manage folders',
      hidden: false,
      disabled: false,
    },
    {
      action: 'toggle-folder-pin',
      icon: '&#128204;',
      label: folderPinned ? 'Unpin in this folder' : 'Pin in this folder',
      hidden: !activeFolder,
      disabled: false,
    },
    {
      action: 'move-folder-up',
      icon: '&#8593;',
      label: 'Move up in this folder',
      hidden: !activeFolder || !folderPinned,
      disabled: !folderMoveState.canMoveUp,
    },
    {
      action: 'move-folder-down',
      icon: '&#8595;',
      label: 'Move down in this folder',
      hidden: !activeFolder || !folderPinned,
      disabled: !folderMoveState.canMoveDown,
    },
    {
      action: 'remove-from-folder',
      icon: '&#10134;',
      label: 'Remove from this folder',
      hidden: !activeFolder || activeFolder.kind !== 'custom',
      disabled: false,
      danger: true,
    },
    {
      action: 'toggle-pin',
      icon: '&#128204;',
      label: activeFolder
        ? (pinned ? 'Unpin in All chats' : 'Pin in All chats')
        : (pinned ? 'Unpin' : 'Pin'),
      hidden: false,
      disabled: false,
    },
    {
      action: 'move-up',
      icon: '&#8593;',
      label: activeFolder ? 'Move up in All chats' : 'Move up',
      hidden: !pinned,
      disabled: !moveState.canMoveUp,
    },
    {
      action: 'move-down',
      icon: '&#8595;',
      label: activeFolder ? 'Move down in All chats' : 'Move down',
      hidden: !pinned,
      disabled: !moveState.canMoveDown,
    },
    {
      action: 'toggle-notifications',
      icon: '&#128276;',
      label: notificationsEnabled ? 'Disable notifications' : 'Enable notifications',
      hidden: false,
      disabled: false,
    },
    {
      action: 'toggle-sound',
      icon: '&#128266;',
      label: soundsEnabled ? 'Disable sound' : 'Enable sound',
      hidden: false,
      disabled: false,
    },
    {
      action: 'hide-chat',
      icon: '&#128065;',
      label: '\u0421\u043A\u0440\u044B\u0442\u044C',
      hidden: !canHideChat(chat),
      disabled: false,
    },
    {
      action: 'leave-chat',
      icon: '&#8617;',
      label: '\u0412\u044B\u0439\u0442\u0438 \u0438\u0437 \u0447\u0430\u0442\u0430',
      hidden: !canLeaveChat(chat),
      disabled: false,
      danger: true,
    },
    {
      action: 'delete-chat',
      icon: '&#128465;',
      label: '\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0447\u0430\u0442',
      hidden: !canManageDestructiveChat(chat),
      disabled: false,
      danger: true,
    },
  ];
  chatContextMenu.innerHTML = `
    <div class="chat-context-menu-sheet">
      <div class="chat-context-menu-header">${esc(chat.name || 'Chat')}</div>
      ${actions
        .filter((item) => !item.hidden)
        .map((item) => `
          <button
            type="button"
            class="chat-context-menu-button${item.danger ? ' is-danger' : ''}"
            data-chat-action="${esc(item.action)}"
            ${item.disabled ? 'disabled' : ''}
          >
            <span class="chat-context-menu-icon" aria-hidden="true">${item.icon}</span>
            <span class="chat-context-menu-label">${esc(item.label)}</span>
          </button>
        `).join('')}
    </div>
  `;
  chatContextMenu.setAttribute('aria-hidden', 'false');
  chatContextMenu.setAttribute('role', 'menu');
  chatContextMenu.dataset.chatId = String(chat.id);
}

function positionChatContextMenu() {
  if (!chatContextMenuState || !chatContextMenu || chatContextMenu.classList.contains('hidden')) return;
  const row = chatList.querySelector(`.chat-item[data-chat-id="${chatContextMenuState.chatId}"]`) || chatContextMenuState.row;
  if (!(row instanceof HTMLElement)) {
    hideChatContextMenu({ immediate: true });
    return;
  }
  chatContextMenuState.row = row;
  const rowRect = row.getBoundingClientRect();
  const viewport = getFloatingViewportRect();
  const size = measureFloatingSurface(chatContextMenu, 236, 260);
  const gap = 6;
  const horizontalPadding = 8;
  const preferredLeft = Math.min(rowRect.left + 10, rowRect.right - size.width);
  const left = clamp(preferredLeft, viewport.left + horizontalPadding, viewport.right - size.width - horizontalPadding);
  const belowTop = rowRect.bottom + gap;
  const aboveTop = rowRect.top - size.height - gap;
  const fitsBelow = belowTop + size.height <= viewport.bottom - horizontalPadding;
  const preferredTop = fitsBelow || aboveTop < viewport.top + horizontalPadding
    ? belowTop
    : aboveTop;
  const top = clamp(preferredTop, viewport.top + horizontalPadding, viewport.bottom - size.height - horizontalPadding);
  chatContextMenu.style.right = 'auto';
  chatContextMenu.style.bottom = 'auto';
  positionFloatingElement(chatContextMenu, left, top);
}

function hideChatContextMenu({ immediate = false } = {}) {
  clearChatContextLongPress();
  closeFloatingSurface(chatContextMenuBackdrop, { immediate });
  closeFloatingSurface(chatContextMenu, {
    immediate,
    onAfterClose: () => {
      if (chatContextMenu) {
        chatContextMenu.innerHTML = '';
        chatContextMenu.setAttribute('aria-hidden', 'true');
        chatContextMenu.style.left = '';
        chatContextMenu.style.top = '';
        chatContextMenu.style.right = '';
        chatContextMenu.style.bottom = '';
      }
      chatContextMenuState = null;
    },
  });
}

function showChatContextMenuForRow(row, { x = null, y = null, source = 'contextmenu' } = {}) {
  const chatId = Number(row?.dataset?.chatId || 0);
  if (!chatId) return;
  const chat = getChatById(chatId);
  if (!chat || !chatContextMenu || !chatContextMenuBackdrop) return;
  const isSameChatOpen = isFloatingSurfaceVisible(chatContextMenu) && Number(chatContextMenuState?.chatId || 0) === chatId;
  if (isSameChatOpen) {
    hideChatContextMenu();
    return;
  }
  hideMediaContextMenu({ immediate: true });
  hideChatContextMenu({ immediate: true });
  chatContextMenuState = {
    chatId,
    row,
    source,
    pointerX: typeof x === 'number' && Number.isFinite(x) ? x : null,
    pointerY: typeof y === 'number' && Number.isFinite(y) ? y : null,
  };
  renderChatContextMenu(chat);
  positionChatContextMenu();
  openFloatingSurface(chatContextMenuBackdrop);
  openFloatingSurface(chatContextMenu);
  requestAnimationFrame(() => {
    positionChatContextMenu();
    chatContextMenu.querySelector('.chat-context-menu-button:not(:disabled)')?.focus({ preventScroll: true });
  });
}


async function updateChatContextPreference(chatId, changes) {
  const chat = getChatById(chatId);
  if (!chat) return;
  const next = {
    notify_enabled: Object.prototype.hasOwnProperty.call(changes, 'notify_enabled')
      ? !!changes.notify_enabled
      : localChatPreferenceEnabled(chat.notify_enabled),
    sounds_enabled: Object.prototype.hasOwnProperty.call(changes, 'sounds_enabled')
      ? !!changes.sounds_enabled
      : localChatPreferenceEnabled(chat.sounds_enabled),
  };
  try {
    const data = await api(`/api/chats/${chatId}/preferences`, { method: 'PUT', body: next });
    Object.assign(chat, data.preferences || next);
    renderChatList(chatSearch.value);
    if (Number(currentChatId || 0) === Number(chatId)) {
      renderChatPreferencesForm(chat);
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'notify_enabled')) {
      showCenterToast(next.notify_enabled ? 'Notifications enabled' : 'Notifications disabled');
    } else if (Object.prototype.hasOwnProperty.call(changes, 'sounds_enabled')) {
      showCenterToast(next.sounds_enabled ? 'Sound enabled' : 'Sound disabled');
    }
  } catch (e) {
    showCenterToast(e.message || 'Could not update chat preferences');
  }
}


async function handleChatContextMenuAction(action, chatId) {
  const chat = getChatById(chatId);
  if (!chat) return;
  if (action === 'manage-folders') {
    const row = chatList?.querySelector(`.chat-item[data-chat-id="${Number(chatId || 0)}"]`) || null;
    await openChatFolderManageModal(chatId, row);
    return;
  }
  if (action === 'toggle-folder-pin') {
    const activeFolder = getActiveChatFolder();
    if (!activeFolder) return;
    await setFolderChatPin(activeFolder.id, chatId, !isChatPinnedInFolder(activeFolder.id, chat));
    return;
  }
  if (action === 'move-folder-up') {
    const activeFolder = getActiveChatFolder();
    if (!activeFolder) return;
    await moveFolderChatPin(activeFolder.id, chatId, 'up');
    return;
  }
  if (action === 'move-folder-down') {
    const activeFolder = getActiveChatFolder();
    if (!activeFolder) return;
    await moveFolderChatPin(activeFolder.id, chatId, 'down');
    return;
  }
  if (action === 'remove-from-folder') {
    const activeFolder = getActiveChatFolder();
    if (!activeFolder || activeFolder.kind !== 'custom') return;
    await removeChatFromFolder(activeFolder.id, chatId);
    showCenterToast('Chat removed from folder');
    return;
  }
  if (action === 'toggle-pin') {
    await setChatSidebarPin(chatId, !isChatPinned(chat));
    return;
  }
  if (action === 'move-up') {
    await moveChatSidebarPin(chatId, 'up');
    return;
  }
  if (action === 'move-down') {
    await moveChatSidebarPin(chatId, 'down');
    return;
  }
  if (action === 'toggle-notifications') {
    await updateChatContextPreference(chatId, {
      notify_enabled: !localChatPreferenceEnabled(chat.notify_enabled),
    });
    return;
  }
  if (action === 'toggle-sound') {
    await updateChatContextPreference(chatId, {
      sounds_enabled: !localChatPreferenceEnabled(chat.sounds_enabled),
    });
    return;
  }
  if (action === 'hide-chat') {
    await hideChatFromList(chatId);
    return;
  }
  if (action === 'leave-chat') {
    await leaveChat(chatId);
    return;
  }
  if (action === 'delete-chat') {
    await deleteChatCompletely(chatId);
  }
}


function bindEvents() {
  if (bindEvents.__bound) return;
  bindEvents.__bound = true;
    // Long press/right-click on media opens the app-controlled media menu.  
    (() => {  
      messagesEl.addEventListener('touchstart', (e) => {  
        if (e.touches.length !== 1) return;  
        const mediaTarget = getMessageMediaContextTarget(e.target);  
        const row = mediaTarget?.closest('.msg-row');  
        if (!mediaTarget || !row) return;  
        const touch = e.touches && e.touches[0] ? e.touches[0] : null;  
        mediaContextLongPressStart = { x: touch?.clientX || 0, y: touch?.clientY || 0 };  
        mediaContextLongPressRow = row;  
        mediaContextLongPressTarget = mediaTarget;  
        clearTimeout(mediaContextLongPressTimer);  
        mediaContextLongPressTimer = setTimeout(() => {  
          mediaContextLongPressTimer = null;  
          row.__suppressMediaClickUntil = Date.now() + 900;  
          suppressNextMessageActionTap();  
          safeVibrate(30);  
          showMediaContextMenuForRow(row, mediaTarget, {  
            x: mediaContextLongPressStart?.x,  
            y: mediaContextLongPressStart?.y,  
            source: 'long-press',  
          });  
        }, MEDIA_CONTEXT_LONG_PRESS_MS);  
      }, { passive: true });  
      messagesEl.addEventListener('touchend', clearMediaContextLongPress, { passive: true });  
      messagesEl.addEventListener('touchcancel', clearMediaContextLongPress, { passive: true });  
      messagesEl.addEventListener('touchmove', (e) => {  
        if (!mediaContextLongPressStart || e.touches.length !== 1) return;  
        const touch = e.touches[0];  
        if (Math.hypot(touch.clientX - mediaContextLongPressStart.x, touch.clientY - mediaContextLongPressStart.y) > 10) {  
          clearMediaContextLongPress();  
        }  
      }, { passive: true });  
      messagesEl.addEventListener('contextmenu', (e) => {  
        const mediaTarget = getMessageMediaContextTarget(e.target);  
        const row = mediaTarget?.closest('.msg-row');  
        if (!mediaTarget || !row) return;  
        e.preventDefault();  
        row.__suppressMediaClickUntil = Date.now() + 900;  
        showMediaContextMenuForRow(row, mediaTarget, {  
          x: e.clientX,  
          y: e.clientY,  
          source: 'contextmenu',  
        });  
      });  
    })();  
    
  
    (() => {  
      chatContextMenu?.addEventListener('pointerdown', (e) => {  
        e.stopPropagation();  
      });  
      chatContextMenu?.addEventListener('mousedown', (e) => {  
        e.stopPropagation();  
      });  
      chatContextMenu?.addEventListener('touchstart', (e) => {  
        e.stopPropagation();  
      }, { passive: true });  
      chatContextMenu?.addEventListener('click', async (e) => {  
        e.stopPropagation();  
        const btn = e.target.closest('.chat-context-menu-button[data-chat-action]');  
        if (!btn || btn.disabled || !chatContextMenuState?.chatId) return;  
        const chatId = Number(chatContextMenuState.chatId || 0);  
        const action = btn.dataset.chatAction || '';  
        hideChatContextMenu();  
        await handleChatContextMenuAction(action, chatId);  
      });  
      chatContextMenuBackdrop?.addEventListener('click', () => {  
        if (Date.now() < suppressChatContextDismissUntil) return;  
        hideChatContextMenu();  
      });  
      chatContextMenuBackdrop?.addEventListener('contextmenu', (e) => {  
        e.preventDefault();  
        if (Date.now() < suppressChatContextDismissUntil) return;  
        hideChatContextMenu();  
      });  
      chatList.addEventListener('scroll', () => {  
        if (isFloatingSurfaceVisible(chatContextMenu)) hideChatContextMenu({ immediate: true });  
      }, { passive: true });  
      const syncChatContextMenuLayout = () => {  
        if (!isFloatingSurfaceVisible(chatContextMenu)) return;  
        positionChatContextMenu();  
      };  
      window.addEventListener('resize', syncChatContextMenuLayout, { passive: true });  
      window.visualViewport?.addEventListener('resize', syncChatContextMenuLayout);  
      window.visualViewport?.addEventListener('scroll', syncChatContextMenuLayout);  
      let startPoint = null;  
      let startPointerId = null;  
      const clearChatContextPointerPress = () => {  
        clearChatContextLongPress();  
        startPoint = null;  
        startPointerId = null;  
      };  
      chatList.addEventListener('pointerdown', (e) => {  
        if (e.button && e.button !== 0) return;  
        if (startPointerId != null) return;  
        const row = e.target.closest('.chat-item[data-chat-id]');  
        if (!row || !chatList.contains(row) || e.target.closest('button, a, input, textarea, select, label')) return;  
        startPointerId = e.pointerId;  
        startPoint = { x: e.clientX, y: e.clientY };  
        chatContextLongPressStart = startPoint;  
        chatContextLongPressRow = row;  
        clearTimeout(chatContextLongPressTimer);  
        chatContextLongPressTimer = setTimeout(() => {  
          chatContextLongPressTimer = null;  
          suppressNextChatItemTap({ pointerType: e.pointerType === 'mouse' ? 'mouse' : 'touch' });
          suppressChatContextDismissUntil = Date.now() + 550;  
          safeVibrate(30);  
          showChatContextMenuForRow(row, {  
            x: startPoint?.x,  
            y: startPoint?.y,  
            source: 'long-press',  
          });  
        }, CHAT_CONTEXT_LONG_PRESS_MS);  
      }, { passive: true });  
      chatList.addEventListener('pointermove', (e) => {  
        if (!startPoint || e.pointerId !== startPointerId) return;  
        if (Math.hypot(e.clientX - startPoint.x, e.clientY - startPoint.y) > 10) {  
          clearChatContextPointerPress();  
        }  
      }, { passive: true });  
      ['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => {  
        chatList.addEventListener(type, (e) => {  
          if (startPointerId != null && e.pointerId !== startPointerId) return;  
          clearChatContextPointerPress();  
        }, { passive: true });  
      });  
      chatList.addEventListener('contextmenu', (e) => {  
        const row = e.target.closest('.chat-item[data-chat-id]');  
        if (!row || !chatList.contains(row) || e.target.closest('button, a, input, textarea, select, label')) return;  
        e.preventDefault();  
        showChatContextMenuForRow(row, {  
          x: e.clientX,  
          y: e.clientY,  
          source: 'contextmenu',  
        });  
      });  
    })();  
    
  
    (() => {  
      mediaContextMenu?.addEventListener('pointerdown', (e) => {  
        e.stopPropagation();  
      });  
      mediaContextMenu?.addEventListener('mousedown', (e) => {  
        e.stopPropagation();  
      });  
      mediaContextMenu?.addEventListener('touchstart', (e) => {  
        e.stopPropagation();  
      }, { passive: true });  
      mediaContextMenu?.addEventListener('click', async (e) => {  
        e.stopPropagation();  
        const btn = e.target.closest('.media-context-menu-button[data-media-action]');  
        if (!btn || btn.disabled || !mediaContextMenuState?.context) return;  
        await handleMediaContextMenuAction(btn.dataset.mediaAction || '', mediaContextMenuState.context);  
      });  
      mediaContextMenuBackdrop?.addEventListener('click', () => {  
        hideMediaContextMenu();  
      });  
      mediaContextMenuBackdrop?.addEventListener('contextmenu', (e) => {  
        e.preventDefault();  
        hideMediaContextMenu();  
      });  
      messagesEl.addEventListener('scroll', () => {  
        if (isFloatingSurfaceVisible(mediaContextMenu)) hideMediaContextMenu({ immediate: true });  
      }, { passive: true });  
      const syncMediaContextMenuLayout = () => {  
        if (!isFloatingSurfaceVisible(mediaContextMenu)) return;  
        positionMediaContextMenu();  
      };  
      window.addEventListener('resize', syncMediaContextMenuLayout, { passive: true });  
      window.visualViewport?.addEventListener('resize', syncMediaContextMenuLayout);  
      window.visualViewport?.addEventListener('scroll', syncMediaContextMenuLayout);  
    })();  
    
  
}
function getChatContextMenuState() { return chatContextMenuState; }
function getMediaContextMenuState() { return mediaContextMenuState; }
__exports = { clearChatContextLongPress, clearMediaContextLongPress, getMessageMediaContextTarget, getMessageMediaKindLabel, getDefaultMessageMediaMime, getAbsoluteMessageMediaUrl, getMessageMediaContext, canShareMediaFileContext, fetchMessageMediaBlob, copyImageFromMediaContext, shareMediaFromContext, renderMediaContextMenu, positionMediaContextMenu, hideMediaContextMenu, showMediaContextMenuForRow, showMediaContextMenuForContext, handleMediaContextMenuAction, renderChatContextMenu, positionChatContextMenu, hideChatContextMenu, showChatContextMenuForRow, updateChatContextPreference, handleChatContextMenuAction, bindEvents, getChatContextMenuState, getMediaContextMenuState };
  }
  return scope.__exports;
}
interactionsRoot.contextMenus = { createContextMenus };
})();
