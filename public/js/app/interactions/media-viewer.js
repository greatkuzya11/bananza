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

function createMediaViewer(options = {}) {
  const opts = objectOrDefault(options);
  const win = opts.window || window;
  const doc = opts.document || document;
  const dom = objectOrDefault(opts.dom);
  const state = objectOrDefault(opts.state);
  const actions = objectOrDefault(opts.actions);
  const config = objectOrDefault(opts.config || root.config);
  const deps = { window: win, document: doc, history: win.history, location: win.location, Image: win.Image, Element: win.Element, HTMLElement: win.HTMLElement, imageViewer: dom.imageViewer, ivStrip: dom.ivStrip, messagesEl: dom.messagesEl, currentChatId: getter(() => state.getCurrentChatId?.() || null), MESSAGE_CACHE_LIMIT: config.MESSAGE_CACHE_LIMIT ?? 800, api: opts.api || actions.api || (() => Promise.resolve({})), esc: opts.esc || ((value) => String(value == null ? '' : value)), getAttachmentPreviewUrl: actions.getAttachmentPreviewUrl || (() => ''), getAttachmentPosterUrl: actions.getAttachmentPosterUrl || (() => ''), ensureAttachmentPoster: actions.ensureAttachmentPoster || (() => Promise.resolve('')), markAttachmentPosterAvailable: actions.markAttachmentPosterAvailable || function noop() {}, applyPosterToVideoElement: actions.applyPosterToVideoElement || function noop() {}, closeMobileComposerTransientUi: actions.closeMobileComposerTransientUi || function noop() {}, dismissMobileComposer: actions.dismissMobileComposer || function noop() {}, isMobileLayoutViewport: actions.isMobileLayoutViewport || (() => false), scheduleMobileViewportRecovery: actions.scheduleMobileViewportRecovery || function noop() {}, isGroupLikeCurrentChat: actions.isGroupLikeCurrentChat || (() => false), openAvatarUserMenu: actions.openAvatarUserMenu || function noop() {} };
  const scope = createLegacyScope(deps, win);
  with (scope) {
// MEDIA VIEWER
// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
const GALLERY_PREFETCH_COUNT = 3;
const GALLERY_VIDEO_PRELOAD_LIMIT = 3;
const GALLERY_IMAGE_PRELOAD_LIMIT = 12;
const GALLERY_LOADING_TEXT = '\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043c \u0435\u0449\u0451 \u043c\u0435\u0434\u0438\u0430...';
const GALLERY_FIRST_TEXT = '\u042d\u0442\u043e \u043f\u0435\u0440\u0432\u043e\u0435 \u043c\u0435\u0434\u0438\u0430';
const GALLERY_LAST_TEXT = '\u042d\u0442\u043e \u043f\u043e\u0441\u043b\u0435\u0434\u043d\u0435\u0435 \u043c\u0435\u0434\u0438\u0430';
const GALLERY_LOAD_ERROR_TEXT = '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437';
let galleryItems = []; // { id, chatId, src, type, fileName, fileMime, fileSize, posterSrc, message }
let galleryIndex = 0;
let gallerySourceChatId = 0;
let galleryHasMoreBefore = false;
let galleryHasMoreAfter = false;
let galleryLoadingBefore = false;
let galleryLoadingAfter = false;
let galleryLoadPromises = { before: null, after: null };
let galleryLoadErrors = { before: false, after: false };
let gallerySessionId = 0;
let galleryImagePreloads = new Map();
let galleryVideoPreloads = new Map();
let galleryEdgeToastTimer = null;
let galleryEdgeBounceTimer = null;
let ivScale = 1, ivPanX = 0, ivPanY = 0;
let mediaViewerSuppressClickUntil = 0;
let mediaViewerFollowupClickSuppressUntil = 0;
const IMAGE_VIEWER_DOUBLE_TAP_DELAY_MS = 300;
const IMAGE_VIEWER_TAP_MAX_DRIFT_PX = 14;
const IMAGE_VIEWER_DOUBLE_TAP_DISTANCE_PX = 40;
const IMAGE_VIEWER_SWIPE_START_PX = 6;
const IMAGE_VIEWER_SWIPE_COMMIT_PX = 50;
const IMAGE_VIEWER_MAX_SCALE = 5;
const IMAGE_VIEWER_CLOSE_AUTO_HIDE_MS = 3000;
const ivTouchState = {
  activeTouchId: null,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
  dx: 0,
  dragging: false,
  tapCandidate: false,
  canTapZoom: false,
  panBaseX: 0,
  panBaseY: 0,
  pinching: false,
  pinchDist0: 0,
  pinchMidpoint0X: 0,
  pinchMidpoint0Y: 0,
  pinchBasePanX: 0,
  pinchBasePanY: 0,
  pinchAnchorX: 0,
  pinchAnchorY: 0,
  scaleBase: 1,
  lastTapTime: 0,
  lastTapX: 0,
  lastTapY: 0,
};
let ivZoomAnimationTimer = null;
let ivZoomAnimationImg = null;
let imageViewerCloseHideTimer = null;
let ivHistoryPushed = false;    // true when we pushed { view: 'mediaviewer' } to history
let ivSkipNextPopstate = false; // skip chat-nav after closeMediaViewer calls history.back()

// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

function normalizeGallerySrc(src) {
  const value = String(src || '').trim();
  if (!value) return '';
  try { return new URL(value, location.origin).href; } catch { return value; }
}

function galleryItemKey(item) {
  const id = Number(item?.id || 0);
  if (id) return `${Number(item.chatId || gallerySourceChatId || currentChatId || 0)}:${id}:${item.type}`;
  return `${item?.type || ''}:${normalizeGallerySrc(item?.src || '')}`;
}

function galleryItemFromMessage(msg, fallbackSrc = '', fallbackPoster = '') {
  if (msg?.is_video_note) return null;
  const type = msg?.file_type === 'video' ? 'video' : (msg?.file_type === 'image' ? 'image' : '');
  const src = normalizeGallerySrc(fallbackSrc || getAttachmentPreviewUrl(msg));
  const posterSrc = type === 'video'
    ? normalizeGallerySrc(fallbackPoster || getAttachmentPosterUrl(msg))
    : '';
  if (!type || !src) return null;
  return {
    id: Number(msg.id || 0),
    chatId: Number(msg.chat_id || msg.chatId || currentChatId || 0),
    src,
    type,
    posterSrc,
    fileName: msg.file_name || '',
    fileMime: msg.file_mime || '',
    fileSize: Number(msg.file_size || 0),
    message: msg && typeof msg === 'object' ? msg : null,
  };
}

function collectGalleryItems() {
  const items = [];
  const seen = new Set();
  messagesEl.querySelectorAll('.msg-image, .msg-video video').forEach(el => {
    const row = el.closest('.msg-row');
    const isImage = el.tagName === 'IMG';
    const source = isImage
      ? (el.currentSrc || el.src || el.getAttribute('src') || '')
      : (el.querySelector('source')?.getAttribute('src') || el.currentSrc || el.src || '');
    const poster = isImage ? '' : (el.getAttribute('poster') || el.poster || '');
    const fallback = {
      ...(row?.__messageData || {}),
      id: Number(row?.dataset.msgId || row?.__messageData?.id || 0),
      chat_id: row?.__messageData?.chat_id || row?.__messageData?.chatId || currentChatId,
      file_type: row?.__messageData?.file_type || (isImage ? 'image' : 'video'),
      file_name: row?.__messageData?.file_name || el.getAttribute('alt') || '',
      file_mime: row?.__messageData?.file_mime || el.querySelector?.('source')?.getAttribute('type') || '',
    };
    const item = galleryItemFromMessage(fallback, source, poster);
    const key = galleryItemKey(item);
    if (!item || seen.has(key)) return;
    seen.add(key);
    items.push(item);
  });
  galleryItems = items;
}

function ivCurrentImg() {
  if (galleryItems[galleryIndex]?.type === 'video') return null;
  return ivStrip.querySelectorAll('.iv-slide')[galleryIndex]?.querySelector('img') || null;
}
function ivClearZoomTransition() {
  clearTimeout(ivZoomAnimationTimer);
  ivZoomAnimationTimer = null;
  if (ivZoomAnimationImg) ivZoomAnimationImg.style.transition = '';
  ivZoomAnimationImg = null;
}
function clearImageViewerLastTap() {
  ivTouchState.lastTapTime = 0;
  ivTouchState.lastTapX = 0;
  ivTouchState.lastTapY = 0;
}
function rememberImageViewerTap(x, y, time = Date.now()) {
  ivTouchState.lastTapTime = time;
  ivTouchState.lastTapX = x;
  ivTouchState.lastTapY = y;
}
function clearImageViewerActiveTouch() {
  ivTouchState.activeTouchId = null;
  ivTouchState.startX = 0;
  ivTouchState.startY = 0;
  ivTouchState.currentX = 0;
  ivTouchState.currentY = 0;
  ivTouchState.dx = 0;
  ivTouchState.dragging = false;
  ivTouchState.tapCandidate = false;
  ivTouchState.canTapZoom = false;
  ivTouchState.panBaseX = 0;
  ivTouchState.panBaseY = 0;
}
function resetImageViewerTouchState({ preserveLastTap = false } = {}) {
  clearImageViewerActiveTouch();
  ivTouchState.pinching = false;
  ivTouchState.pinchDist0 = 0;
  ivTouchState.pinchMidpoint0X = 0;
  ivTouchState.pinchMidpoint0Y = 0;
  ivTouchState.pinchBasePanX = 0;
  ivTouchState.pinchBasePanY = 0;
  ivTouchState.pinchAnchorX = 0;
  ivTouchState.pinchAnchorY = 0;
  ivTouchState.scaleBase = ivScale;
  if (!preserveLastTap) clearImageViewerLastTap();
}
function getTrackedImageViewerTouch(touchList) {
  if (!touchList?.length) return null;
  if (ivTouchState.activeTouchId == null) return touchList[0] || null;
  return Array.from(touchList).find((touch) => touch.identifier === ivTouchState.activeTouchId) || null;
}
function getImageViewerTouchMidpoint(touchList) {
  if (!touchList?.length || touchList.length < 2) return null;
  const firstTouch = touchList[0];
  const secondTouch = touchList[1];
  return {
    x: (firstTouch.clientX + secondTouch.clientX) / 2,
    y: (firstTouch.clientY + secondTouch.clientY) / 2,
  };
}
function getImageViewerViewportCenter() {
  return {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  };
}
function ivGetImagePointForClient(clientX, clientY, scale = ivScale, panX = ivPanX, panY = ivPanY) {
  const { x: centerX, y: centerY } = getImageViewerViewportCenter();
  const safeScale = Math.max(Number(scale) || 1, 0.0001);
  return {
    x: centerX + (clientX - centerX - panX) / safeScale,
    y: centerY + (clientY - centerY - panY) / safeScale,
  };
}
function ivResolvePanForAnchor(anchorX, anchorY, clientX, clientY, scale = ivScale) {
  const { x: centerX, y: centerY } = getImageViewerViewportCenter();
  const nextScale = Math.max(Number(scale) || 1, 1);
  return {
    x: clientX - centerX - (anchorX - centerX) * nextScale,
    y: clientY - centerY - (anchorY - centerY) * nextScale,
  };
}
function isImageViewerDoubleTap(x, y, time = Date.now()) {
  if (!ivTouchState.lastTapTime) return false;
  if (time - ivTouchState.lastTapTime > IMAGE_VIEWER_DOUBLE_TAP_DELAY_MS) return false;
  return Math.hypot(x - ivTouchState.lastTapX, y - ivTouchState.lastTapY) <= IMAGE_VIEWER_DOUBLE_TAP_DISTANCE_PX;
}
function ivPrepareZoomTransition(img) {
  ivClearZoomTransition();
  if (!img || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  ivZoomAnimationImg = img;
  img.style.transition = 'transform 220ms cubic-bezier(.2, .8, .2, 1)';
  // Force the browser to commit the current transform before changing it.
  void img.offsetWidth;
  ivZoomAnimationTimer = setTimeout(ivClearZoomTransition, 280);
}
function ivApplyTransform() {
  const img = ivCurrentImg();
  if (!img) return;
  if (ivScale === 1 && ivPanX === 0 && ivPanY === 0) {
    img.style.transform = '';
    return;
  }
  img.style.transform = `translate3d(${ivPanX}px, ${ivPanY}px, 0) scale(${ivScale})`;
}
function ivSetZoomState(scale, panX = ivPanX, panY = ivPanY) {
  const nextScale = Math.min(IMAGE_VIEWER_MAX_SCALE, Math.max(1, Number(scale) || 1));
  ivScale = nextScale;
  if (nextScale === 1) {
    ivPanX = 0;
    ivPanY = 0;
  } else {
    ivPanX = Number.isFinite(panX) ? panX : 0;
    ivPanY = Number.isFinite(panY) ? panY : 0;
  }
  ivApplyTransform();
}
function ivZoomAroundClient(clientX, clientY, scale) {
  const nextScale = Math.min(IMAGE_VIEWER_MAX_SCALE, Math.max(1, Number(scale) || 1));
  if (nextScale === 1) {
    ivSetZoomState(1);
    return;
  }
  const anchor = ivGetImagePointForClient(clientX, clientY);
  const nextPan = ivResolvePanForAnchor(anchor.x, anchor.y, clientX, clientY, nextScale);
  ivSetZoomState(nextScale, nextPan.x, nextPan.y);
}
function ivResetZoom(animated = false) {
  const img = ivCurrentImg();
  if (animated) ivPrepareZoomTransition(img);
  else ivClearZoomTransition();
  ivSetZoomState(1);
}
function ivToggleZoomAt(clientX = window.innerWidth / 2, clientY = window.innerHeight / 2) {
  if (galleryItems[galleryIndex]?.type === 'video') return false;
  const img = ivCurrentImg();
  if (ivScale > 1) {
    ivResetZoom(true);
    return true;
  }
  ivPrepareZoomTransition(img);
  const ZOOM = 2.5;
  ivZoomAroundClient(clientX, clientY, ZOOM);
  return true;
}

function getGallerySlideElement(itemOrIndex = galleryIndex) {
  if (!ivStrip) return null;
  if (typeof itemOrIndex === 'number') {
    return ivStrip.querySelectorAll('.iv-slide')[itemOrIndex] || null;
  }
  const key = galleryItemKey(itemOrIndex);
  if (!key) return null;
  return [...ivStrip.querySelectorAll('.iv-slide')].find((slide) => slide.dataset.galleryKey === key) || null;
}

function getGalleryVideoElement(itemOrIndex = galleryIndex) {
  return getGallerySlideElement(itemOrIndex)?.querySelector('video') || null;
}

function updateGalleryItemPoster(item, posterUrl) {
  if (!item || item.type !== 'video' || !posterUrl) return '';
  item.posterSrc = posterUrl;
  if (item.message && typeof item.message === 'object') {
    markAttachmentPosterAvailable(item.message);
  }
  applyPosterToVideoElement(getGalleryVideoElement(item), posterUrl);
  return posterUrl;
}

async function ensureGalleryItemPoster(item, { slideEl = null } = {}) {
  if (!item || item.type !== 'video') return '';
  const existingPosterUrl = item.posterSrc || getAttachmentPosterUrl(item.message);
  const videoEl = slideEl?.querySelector('video') || getGalleryVideoElement(item);
  if (existingPosterUrl) {
    return updateGalleryItemPoster(item, existingPosterUrl);
  }
  if (!item.message || typeof item.message !== 'object') return '';
  const posterUrl = await ensureAttachmentPoster(item.message, {
    videoEl,
    onReady: (readyPosterUrl) => {
      if (readyPosterUrl) updateGalleryItemPoster(item, readyPosterUrl);
    },
  }).catch(() => '');
  if (posterUrl) updateGalleryItemPoster(item, posterUrl);
  return posterUrl;
}

function gallerySlideHtml(item) {
  const key = esc(galleryItemKey(item));
  if (item.type === 'video') {
    const mime = item.fileMime ? ` type="${esc(item.fileMime)}"` : '';
    const posterAttr = item.posterSrc ? ` poster="${esc(item.posterSrc)}"` : '';
    return `<div class="iv-slide iv-slide-video" data-gallery-key="${key}"><video controls playsinline preload="metadata"${posterAttr}><source src="${esc(item.src)}"${mime}></video></div>`;
  }
  return `<div class="iv-slide" data-gallery-key="${key}"><img src="${esc(item.src)}" alt="${esc(item.fileName || '')}"></div>`;
}

function renderGalleryStrip() {
  ivStrip.innerHTML = galleryItems.map(gallerySlideHtml).join('');
}

function setGalleryStripPosition(animated = false) {
  ivStrip.style.transition = animated ? 'transform 0.3s ease' : 'none';
  ivStrip.style.transform = `translateX(${-galleryIndex * window.innerWidth}px)`;
}

function galleryEdgeCursor(direction) {
  const list = direction === 'before' ? galleryItems : [...galleryItems].reverse();
  const item = list.find(entry => Number(entry.id || 0) > 0);
  return Number(item?.id || 0);
}

function normalizeMediaPage(data) {
  return {
    media: Array.isArray(data?.media) ? data.media : [],
    hasMoreBefore: typeof data?.has_more_before === 'boolean' ? data.has_more_before : null,
    hasMoreAfter: typeof data?.has_more_after === 'boolean' ? data.has_more_after : null,
  };
}

async function readCachedGalleryMediaPage(chatId, direction, cursor) {
  try {
    const page = await window.messageCache?.readMediaPage?.(chatId, direction, cursor);
    if (page?.complete) return page;
  } catch (e) {}
  return null;
}

function cacheGalleryMediaPage(chatId, direction, cursor, page) {
  try {
    window.messageCache?.writeMediaPage?.(chatId, {
      direction,
      cursor,
      media: page.media || [],
      hasMoreBefore: page.hasMoreBefore,
      hasMoreAfter: page.hasMoreAfter,
      limit: MESSAGE_CACHE_LIMIT,
    }).catch(() => {});
  } catch (e) {}
}

function ensureGalleryLoadingEl() {
  let el = imageViewer.querySelector('.iv-loading');
  if (!el) {
    el = document.createElement('div');
    el.className = 'iv-loading';
    el.innerHTML = '<span class="iv-loading-dot"></span><span class="iv-loading-text"></span>';
    imageViewer.appendChild(el);
  }
  const textEl = el.querySelector('.iv-loading-text');
  if (textEl) textEl.textContent = GALLERY_LOADING_TEXT;
  return el;
}

function ensureGalleryEdgeHintEl() {
  let el = imageViewer.querySelector('.iv-edge-hint');
  if (!el) {
    el = document.createElement('div');
    el.className = 'iv-edge-hint';
    imageViewer.appendChild(el);
  }
  return el;
}

function showGalleryEdgeHint(text, tone = '') {
  const el = ensureGalleryEdgeHintEl();
  clearTimeout(galleryEdgeToastTimer);
  el.className = `iv-edge-hint ${tone || ''}`.trim();
  el.textContent = text;
  requestAnimationFrame(() => el.classList.add('visible'));
  galleryEdgeToastTimer = setTimeout(() => {
    el.classList.remove('visible');
  }, tone === 'error' ? 1900 : 1450);
}

function bounceGalleryEdge(dir) {
  if (imageViewer.classList.contains('hidden')) return;
  clearTimeout(galleryEdgeBounceTimer);
  const base = -galleryIndex * window.innerWidth;
  const offset = dir < 0 ? 42 : -42;
  ivStrip.style.transition = 'transform 0.16s ease-out';
  ivStrip.style.transform = `translateX(${base + offset}px)`;
  galleryEdgeBounceTimer = setTimeout(() => {
    setGalleryStripPosition(true);
  }, 130);
}

function setGalleryLoading(direction, value) {
  if (direction === 'before') galleryLoadingBefore = Boolean(value);
  else galleryLoadingAfter = Boolean(value);
  const loading = galleryLoadingBefore || galleryLoadingAfter;
  if (loading) ensureGalleryLoadingEl();
  imageViewer.classList.toggle('iv-is-loading', loading);
  updateGalleryArrows();
}

function appendGalleryMedia(direction, media = []) {
  const existing = new Set(galleryItems.map(galleryItemKey));
  const nextItems = [];
  for (const msg of media) {
    const item = galleryItemFromMessage(msg);
    const key = galleryItemKey(item);
    if (!item || existing.has(key)) continue;
    existing.add(key);
    nextItems.push(item);
  }
  if (!nextItems.length) return 0;

  if (direction === 'before') {
    galleryItems = [...nextItems, ...galleryItems];
    galleryIndex += nextItems.length;
    if (!imageViewer.classList.contains('hidden')) {
      ivStrip.insertAdjacentHTML('afterbegin', nextItems.map(gallerySlideHtml).join(''));
      setGalleryStripPosition(false);
    }
    return nextItems.length;
  }

  galleryItems = [...galleryItems, ...nextItems];
  if (!imageViewer.classList.contains('hidden')) {
    ivStrip.insertAdjacentHTML('beforeend', nextItems.map(gallerySlideHtml).join(''));
  }
  return nextItems.length;
}

async function loadGalleryDirection(direction, sessionId) {
  const chatId = gallerySourceChatId || currentChatId;
  const cursor = galleryEdgeCursor(direction);
  if (!chatId || !cursor) return false;
  if (direction === 'before' && !galleryHasMoreBefore) return false;
  if (direction === 'after' && !galleryHasMoreAfter) return false;

  setGalleryLoading(direction, true);
  galleryLoadErrors[direction] = false;
  try {
    let page = await readCachedGalleryMediaPage(chatId, direction, cursor);
    if (!page) {
      const params = new URLSearchParams({ limit: String(GALLERY_PREFETCH_COUNT) });
      params.set(direction, String(cursor));
      const raw = await api(`/api/chats/${chatId}/media?${params}`);
      page = normalizeMediaPage(raw);
      cacheGalleryMediaPage(chatId, direction, cursor, page);
    }
    if (sessionId !== gallerySessionId || imageViewer.classList.contains('hidden')) return false;
    if (direction === 'before' && typeof page.hasMoreBefore === 'boolean') galleryHasMoreBefore = page.hasMoreBefore;
    if (direction === 'after' && typeof page.hasMoreAfter === 'boolean') galleryHasMoreAfter = page.hasMoreAfter;
    const added = appendGalleryMedia(direction, page.media || []);
    updateGalleryArrows();
    preloadGalleryAssets();
    return added > 0;
  } catch (e) {
    galleryLoadErrors[direction] = true;
    return false;
  } finally {
    if (sessionId === gallerySessionId) setGalleryLoading(direction, false);
  }
}

function ensureGalleryBuffered(direction) {
  if (galleryLoadPromises[direction]) return galleryLoadPromises[direction];
  const sessionId = gallerySessionId;
  galleryLoadPromises[direction] = loadGalleryDirection(direction, sessionId)
    .finally(() => {
      if (gallerySessionId === sessionId) galleryLoadPromises[direction] = null;
    });
  return galleryLoadPromises[direction];
}

function cleanupGalleryPreloads() {
  galleryImagePreloads.clear();
  galleryVideoPreloads.forEach(video => {
    try {
      video.pause();
      video.removeAttribute('src');
      video.remove();
    } catch (e) {}
  });
  galleryVideoPreloads.clear();
}

function preloadGalleryAssets() {
  if (!galleryItems.length) return;
  const start = Math.max(0, galleryIndex - GALLERY_PREFETCH_COUNT);
  const end = Math.min(galleryItems.length, galleryIndex + GALLERY_PREFETCH_COUNT + 1);
  const nearby = galleryItems.slice(start, end);
  const imageUrls = [...new Set([
    ...nearby.filter(item => item.type === 'image').map(item => item.src),
    ...nearby.filter(item => item.type === 'video' && item.posterSrc).map(item => item.posterSrc),
  ])];
  if (imageUrls.length) {
    try { window.cacheAssets?.(imageUrls).catch(() => {}); } catch (e) {}
    const wantedImages = new Set(imageUrls);
    imageUrls.forEach(url => {
      if (galleryImagePreloads.has(url)) return;
      const img = new Image();
      img.decoding = 'async';
      img.src = url;
      galleryImagePreloads.set(url, img);
    });
    for (const key of [...galleryImagePreloads.keys()]) {
      if (galleryImagePreloads.size <= GALLERY_IMAGE_PRELOAD_LIMIT && wantedImages.has(key)) continue;
      galleryImagePreloads.delete(key);
    }
  }

  const videos = nearby
    .filter(item => item.type === 'video')
    .sort((a, b) => Math.abs(galleryItems.indexOf(a) - galleryIndex) - Math.abs(galleryItems.indexOf(b) - galleryIndex))
    .slice(0, GALLERY_VIDEO_PRELOAD_LIMIT);
  const wantedVideos = new Set(videos.map(item => item.src));
  videos.forEach(item => {
    if (galleryVideoPreloads.has(item.src)) return;
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = item.src;
    video.style.display = 'none';
    video.setAttribute('aria-hidden', 'true');
    document.body.appendChild(video);
    galleryVideoPreloads.set(item.src, video);
  });
  for (const [src, video] of [...galleryVideoPreloads.entries()]) {
    if (wantedVideos.has(src)) continue;
    try {
      video.pause();
      video.removeAttribute('src');
      video.remove();
    } catch (e) {}
    galleryVideoPreloads.delete(src);
  }
}

function queueGalleryBuffering() {
  if (imageViewer.classList.contains('hidden')) return;
  if (galleryIndex <= 1 && galleryHasMoreBefore) ensureGalleryBuffered('before');
  if (galleryItems.length - galleryIndex <= 2 && galleryHasMoreAfter) ensureGalleryBuffered('after');
}

function suppressMediaViewerFollowupClick(ms = 550) {
  mediaViewerFollowupClickSuppressUntil = Math.max(
    mediaViewerFollowupClickSuppressUntil,
    Date.now() + Math.max(0, Number(ms) || 0)
  );
}

function clearImageViewerCloseAutoHide() {
  clearTimeout(imageViewerCloseHideTimer);
  imageViewerCloseHideTimer = null;
}

function scheduleImageViewerCloseAutoHide() {
  clearImageViewerCloseAutoHide();
  imageViewerCloseHideTimer = setTimeout(() => {
    imageViewerCloseHideTimer = null;
    if (imageViewer.classList.contains('hidden')) return;
    imageViewer.classList.add('iv-close-hidden');
  }, IMAGE_VIEWER_CLOSE_AUTO_HIDE_MS);
}

function showImageViewerClose() {
  if (imageViewer.classList.contains('hidden')) return;
  imageViewer.classList.remove('iv-close-hidden');
  scheduleImageViewerCloseAutoHide();
}

function resetImageViewerCloseVisibility() {
  clearImageViewerCloseAutoHide();
  imageViewer.classList.remove('iv-close-hidden');
}

function moveGalleryToIndex(newIdx) {
  if (newIdx < 0 || newIdx >= galleryItems.length) return false;
  resetImageViewerTouchState();
  ivStrip.querySelectorAll('.iv-slide')[galleryIndex]?.querySelector('video')?.pause();
  ivResetZoom();
  galleryIndex = newIdx;
  setGalleryStripPosition(true);
  updateGalleryArrows();
  ensureGalleryItemPoster(galleryItems[galleryIndex]).catch(() => {});
  preloadGalleryAssets();
  queueGalleryBuffering();
  return true;
}

function customGalleryItems(items = []) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  return items.reduce((result, item, index) => {
    const source = normalizeGallerySrc(item?.src || '');
    const mediaType = item?.type === 'video' ? 'video' : 'image';
    if (!source || seen.has(`${mediaType}:${source}`)) return result;
    seen.add(`${mediaType}:${source}`);
    result.push({
      id: 0,
      chatId: 0,
      src: source,
      type: mediaType,
      posterSrc: normalizeGallerySrc(item?.posterSrc || ''),
      fileName: String(item?.fileName || item?.name || `media-${index + 1}`),
      fileMime: String(item?.fileMime || ''),
      fileSize: 0,
      message: null,
    });
    return result;
  }, []);
}

function openMediaViewer(src, type = 'image', options = {}) {
  gallerySessionId += 1;
  closeMobileComposerTransientUi({ immediate: true });
  dismissMobileComposer({ forceRecovery: true, reason: 'media-viewer-open', recoveryDelayMs: 280 });
  ivClearZoomTransition();
  mediaViewerSuppressClickUntil = 0;
  mediaViewerFollowupClickSuppressUntil = 0;
  resetImageViewerTouchState();
  const suppliedItems = customGalleryItems(options?.items);
  const usesCustomGallery = suppliedItems.length > 0;
  gallerySourceChatId = usesCustomGallery ? 0 : currentChatId;
  galleryLoadPromises = { before: null, after: null };
  galleryLoadErrors = { before: false, after: false };
  galleryLoadingBefore = false;
  galleryLoadingAfter = false;
  clearTimeout(galleryEdgeToastTimer);
  clearTimeout(galleryEdgeBounceTimer);
  imageViewer.querySelector('.iv-edge-hint')?.classList.remove('visible');
  cleanupGalleryPreloads();
  if (usesCustomGallery) galleryItems = suppliedItems;
  else collectGalleryItems();
  const targetSrc = normalizeGallerySrc(src);
  const requestedIndex = Number(options?.initialIndex);
  galleryIndex = Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < galleryItems.length
    ? requestedIndex
    : galleryItems.findIndex(item => normalizeGallerySrc(item.src) === targetSrc && item.type === type);
  if (galleryIndex < 0 && targetSrc) {
    galleryItems.push({ id: 0, chatId: currentChatId || 0, src: targetSrc, type, fileName: '', fileMime: '', fileSize: 0 });
    galleryIndex = galleryItems.length - 1;
  }
  if (galleryIndex < 0) galleryIndex = 0;
  galleryHasMoreBefore = !usesCustomGallery && Boolean(galleryEdgeCursor('before'));
  galleryHasMoreAfter = !usesCustomGallery && Boolean(galleryEdgeCursor('after'));
  renderGalleryStrip();
  ivScale = 1; ivPanX = 0; ivPanY = 0;
  setGalleryStripPosition(false);
  updateGalleryArrows();
  if (isMobileLayoutViewport()) {
    history.pushState({ view: 'mediaviewer' }, '');
    ivHistoryPushed = true;
  }
  // Pause any playing videos in the chat view (user opened fullscreen viewer)
  try {
    messagesEl.querySelectorAll('.msg-video video').forEach(v => {
      try { if (!v.paused) v.pause(); } catch (e) {}
    });
  } catch (e) {}

  imageViewer.classList.remove('hidden');
  showImageViewerClose();
  ensureGalleryItemPoster(galleryItems[galleryIndex]).catch(() => {});
  preloadGalleryAssets();
  ensureGalleryBuffered('before');
  ensureGalleryBuffered('after');
}
// Backward-compat alias used by existing image click handlers
function openImageViewer(src, options = {}) { openMediaViewer(src, 'image', options); }

function closeMediaViewer() {
  if (imageViewer.classList.contains('hidden')) return;
  gallerySessionId += 1;
  ivClearZoomTransition();
  mediaViewerSuppressClickUntil = 0;
  resetImageViewerCloseVisibility();
  resetImageViewerTouchState();
  ivStrip.querySelectorAll('video').forEach(v => v.pause());
  ivResetZoom();
  imageViewer.classList.add('hidden');
  imageViewer.classList.remove('iv-is-loading');
  galleryLoadPromises = { before: null, after: null };
  galleryLoadErrors = { before: false, after: false };
  galleryLoadingBefore = false;
  galleryLoadingAfter = false;
  clearTimeout(galleryEdgeToastTimer);
  clearTimeout(galleryEdgeBounceTimer);
  imageViewer.querySelector('.iv-edge-hint')?.classList.remove('visible');
  cleanupGalleryPreloads();
  if (ivHistoryPushed) {
    ivHistoryPushed = false;
    ivSkipNextPopstate = true;
    history.back();
  }
  scheduleMobileViewportRecovery(280);
}

function handleMediaViewerControlActivation(e) {
  if (imageViewer.classList.contains('hidden')) return false;
  if (e.type === 'pointerup' && e.pointerType === 'mouse' && e.button !== 0) return false;
  const closeBtn = e.target.closest('.iv-close');
  if (!closeBtn || !imageViewer.contains(closeBtn)) return false;
  e.preventDefault();
  e.stopPropagation();
  if (
    e.type === 'touchend'
    || (e.type === 'pointerup' && String(e.pointerType || '').toLowerCase() !== 'mouse')
  ) {
    suppressMediaViewerFollowupClick();
  }
  closeMediaViewer();
  return true;
}

function updateGalleryArrows() {
  const prev = imageViewer.querySelector('.iv-prev');
  const next = imageViewer.querySelector('.iv-next');
  prev.style.display = (galleryIndex > 0 || galleryHasMoreBefore || galleryLoadingBefore) ? '' : 'none';
  next.style.display = (galleryIndex < galleryItems.length - 1 || galleryHasMoreAfter || galleryLoadingAfter) ? '' : 'none';
}

async function galleryNav(dir) {
  resetImageViewerTouchState();
  const newIdx = galleryIndex + dir;
  if (newIdx < 0 || newIdx >= galleryItems.length) {
    const direction = dir < 0 ? 'before' : 'after';
    const canLoad = direction === 'before' ? galleryHasMoreBefore : galleryHasMoreAfter;
    if (!canLoad && !galleryLoadPromises[direction]) {
      updateGalleryArrows();
      bounceGalleryEdge(dir);
      showGalleryEdgeHint(dir < 0 ? GALLERY_FIRST_TEXT : GALLERY_LAST_TEXT, direction);
      return;
    }
    setGalleryStripPosition(true);
    const added = await ensureGalleryBuffered(direction);
    if (!added) {
      updateGalleryArrows();
      bounceGalleryEdge(dir);
      showGalleryEdgeHint(
        galleryLoadErrors[direction] ? GALLERY_LOAD_ERROR_TEXT : (dir < 0 ? GALLERY_FIRST_TEXT : GALLERY_LAST_TEXT),
        galleryLoadErrors[direction] ? 'error' : direction
      );
      return;
    }
    const retryIdx = galleryIndex + dir;
    if (retryIdx < 0 || retryIdx >= galleryItems.length) return;
    moveGalleryToIndex(retryIdx);
    return;
  }
  moveGalleryToIndex(newIdx);
}

// \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

function bindEvents() {
  if (bindEvents.__bound) return;
  bindEvents.__bound = true;
    // Media viewer close  
    imageViewer.addEventListener('pointerup', (e) => {  
      handleMediaViewerControlActivation(e);  
    }, { passive: false });  
    imageViewer.addEventListener('touchend', (e) => {  
      handleMediaViewerControlActivation(e);  
    }, { passive: false });  
    imageViewer.addEventListener('click', (e) => {  
      if (handleMediaViewerControlActivation(e)) return;  
      if (Date.now() < mediaViewerSuppressClickUntil && e.target.closest('.iv-slide')) {  
        e.preventDefault();  
        e.stopPropagation();  
        return;  
      }  
      if (e.target.closest('.iv-prev')) { galleryNav(-1); return; }  
      if (e.target.closest('.iv-next')) { galleryNav(1); return; }  
      if (e.target.closest('.iv-close')) closeMediaViewer();

      if (e.target.closest('.iv-slide')) showImageViewerClose();
    });  
    imageViewer.addEventListener('dblclick', (e) => {  
      if (imageViewer.classList.contains('hidden')) return;  
      if (e.target.closest('.iv-prev, .iv-next, .iv-close, video')) return;  
      const slide = e.target.closest('.iv-slide');  
      if (!slide || slide.classList.contains('iv-slide-video')) return;  
      e.preventDefault();  
      e.stopPropagation();  
      ivToggleZoomAt(e.clientX, e.clientY);  
    });  
    document.addEventListener('keydown', (e) => {  
      if (imageViewer.classList.contains('hidden')) return;  
      if (e.key === 'ArrowLeft') galleryNav(-1);  
      else if (e.key === 'ArrowRight') galleryNav(1);  
      else if (e.key === 'Escape') closeMediaViewer();  
    });  
    
    messagesEl.addEventListener('pointerdown', (e) => {  
      const avatar = e.target.closest('.msg-group-avatar');  
      if (!avatar || !messagesEl.contains(avatar) || !isGroupLikeCurrentChat()) return;  
      e.preventDefault();  
      e.stopPropagation();  
      openAvatarUserMenu(avatar);  
    }, { passive: false });  
    messagesEl.addEventListener('keydown', (e) => {  
      const avatar = e.target.closest('.msg-group-avatar');  
      if (!avatar || !isGroupLikeCurrentChat() || (e.key !== 'Enter' && e.key !== ' ')) return;  
      e.preventDefault();  
      openAvatarUserMenu(avatar);  
    });  
    
    // Strip swipe + pinch-zoom + double-tap for media viewer  
    (() => {  
      imageViewer.addEventListener('touchstart', (e) => {  
        if (e.target.closest('.iv-prev, .iv-next, .iv-close')) return;  
        const touchedSlide = e.target.closest('.iv-slide');  
        if (!touchedSlide) return;  
        const isImageSlideTouch = Boolean(touchedSlide && !touchedSlide.classList.contains('iv-slide-video'));  
        const canImageZoomTouch = isImageSlideTouch && galleryItems[galleryIndex]?.type !== 'video';  
        if (e.touches.length === 2) {  
          clearImageViewerActiveTouch();  
          clearImageViewerLastTap();  
          if (canImageZoomTouch) {  
            ivClearZoomTransition();  
            ivTouchState.pinching = true;  
            const t = e.touches;  
            ivTouchState.pinchDist0 = Math.hypot(t[1].clientX - t[0].clientX, t[1].clientY - t[0].clientY);  
            const midpoint = getImageViewerTouchMidpoint(t);  
            ivTouchState.pinchMidpoint0X = midpoint?.x || 0;  
            ivTouchState.pinchMidpoint0Y = midpoint?.y || 0;  
            ivTouchState.pinchBasePanX = ivPanX;  
            ivTouchState.pinchBasePanY = ivPanY;  
            const anchor = midpoint  
              ? ivGetImagePointForClient(midpoint.x, midpoint.y, ivScale, ivPanX, ivPanY)  
              : { x: 0, y: 0 };  
            ivTouchState.pinchAnchorX = anchor.x;  
            ivTouchState.pinchAnchorY = anchor.y;  
            ivTouchState.scaleBase = ivScale;  
            e.preventDefault();  
          }  
          return;  
        }  
        if (e.touches.length !== 1) {  
          resetImageViewerTouchState();  
          return;  
        }  
        const touch = e.touches[0];  
        const tx = touch.clientX;  
        const ty = touch.clientY;  
        ivTouchState.activeTouchId = touch.identifier;  
        ivTouchState.startX = tx;  
        ivTouchState.startY = ty;  
        ivTouchState.currentX = tx;  
        ivTouchState.currentY = ty;  
        ivTouchState.dx = 0;  
        ivTouchState.dragging = false;  
        ivTouchState.tapCandidate = true;  
        ivTouchState.canTapZoom = canImageZoomTouch;  
        ivTouchState.panBaseX = ivPanX;  
        ivTouchState.panBaseY = ivPanY;  
        ivTouchState.pinching = false;  
        ivTouchState.pinchDist0 = 0;  
        ivTouchState.scaleBase = ivScale;  
        if (!canImageZoomTouch) clearImageViewerLastTap();  
        if (ivScale === 1) ivStrip.style.transition = 'none';  
      }, { passive: false });  
    
      imageViewer.addEventListener('touchmove', (e) => {  
        if (e.touches.length === 2) {  
          if (!ivTouchState.pinching || galleryItems[galleryIndex]?.type === 'video') return;  
          const t = e.touches;  
          const baseDist = Math.max(ivTouchState.pinchDist0 || 0, 1);  
          const dist = Math.hypot(t[1].clientX - t[0].clientX, t[1].clientY - t[0].clientY);  
          const midpoint = getImageViewerTouchMidpoint(t);  
          if (!midpoint) return;  
          const nextScale = Math.min(IMAGE_VIEWER_MAX_SCALE, Math.max(1, ivTouchState.scaleBase * dist / baseDist));  
          const nextPan = ivResolvePanForAnchor(  
            ivTouchState.pinchAnchorX,  
            ivTouchState.pinchAnchorY,  
            midpoint.x,  
            midpoint.y,  
            nextScale  
          );  
          ivSetZoomState(nextScale, nextPan.x, nextPan.y);  
          e.preventDefault();  
          return;  
        }  
        if (ivTouchState.pinching || e.touches.length !== 1) return;  
        const touch = getTrackedImageViewerTouch(e.touches);  
        if (!touch) return;  
        const cx = touch.clientX;  
        const cy = touch.clientY;  
        ivTouchState.currentX = cx;  
        ivTouchState.currentY = cy;  
        const moveX = cx - ivTouchState.startX;  
        const moveY = cy - ivTouchState.startY;  
        if (ivTouchState.tapCandidate && Math.hypot(moveX, moveY) > IMAGE_VIEWER_TAP_MAX_DRIFT_PX) {  
          ivTouchState.tapCandidate = false;  
        }  
        if (ivScale > 1) {  
          ivClearZoomTransition();  
          ivSetZoomState(ivScale, ivTouchState.panBaseX + moveX, ivTouchState.panBaseY + moveY);  
          e.preventDefault();  
          return;  
        }  
        ivTouchState.dx = moveX;  
        if (!ivTouchState.dragging && Math.abs(moveX) > Math.abs(moveY) && Math.abs(moveX) > IMAGE_VIEWER_SWIPE_START_PX) {  
          ivTouchState.dragging = true;  
        }  
        if (!ivTouchState.dragging) return;  
        ivTouchState.tapCandidate = false;  
        ivStrip.style.transform = `translateX(${-galleryIndex * window.innerWidth + ivTouchState.dx}px)`;  
        e.preventDefault();  
      }, { passive: false });  
    
      imageViewer.addEventListener('touchend', (e) => {  
        if (ivTouchState.pinching) {  
          if (e.touches.length < 2) {  
            ivTouchState.pinching = false;  
            ivTouchState.pinchDist0 = 0;  
            ivTouchState.pinchMidpoint0X = 0;  
            ivTouchState.pinchMidpoint0Y = 0;  
            ivTouchState.pinchBasePanX = ivPanX;  
            ivTouchState.pinchBasePanY = ivPanY;  
            ivTouchState.pinchAnchorX = 0;  
            ivTouchState.pinchAnchorY = 0;  
            ivTouchState.scaleBase = ivScale;  
            if (e.touches.length === 1) {  
              const remainingTouch = e.touches[0];  
              ivTouchState.activeTouchId = remainingTouch.identifier;  
              ivTouchState.startX = remainingTouch.clientX;  
              ivTouchState.startY = remainingTouch.clientY;  
              ivTouchState.currentX = remainingTouch.clientX;  
              ivTouchState.currentY = remainingTouch.clientY;  
              ivTouchState.dx = 0;  
              ivTouchState.dragging = false;  
              ivTouchState.tapCandidate = false;  
              ivTouchState.canTapZoom = false;  
              ivTouchState.panBaseX = ivPanX;  
              ivTouchState.panBaseY = ivPanY;  
              clearImageViewerLastTap();  
              return;  
            }  
          }  
          clearImageViewerActiveTouch();  
          clearImageViewerLastTap();  
          return;  
        }  
        const touch = getTrackedImageViewerTouch(e.changedTouches);  
        if (!touch) {  
          if (!e.touches.length) clearImageViewerActiveTouch();  
          return;  
        }  
        const endX = touch.clientX;  
        const endY = touch.clientY;  
        const wasDragging = ivTouchState.dragging;  
        const wasTapCandidate = ivTouchState.tapCandidate;  
        const canTapZoom = ivTouchState.canTapZoom;  
        const travelX = endX - ivTouchState.startX;  
        const travelY = endY - ivTouchState.startY;  
        const dragDistance = Math.hypot(travelX, travelY);  
        const dragDx = ivTouchState.dx;  
        clearImageViewerActiveTouch();  
    
        if (wasTapCandidate && dragDistance <= IMAGE_VIEWER_TAP_MAX_DRIFT_PX) {
          showImageViewerClose();
          if (canTapZoom) {
            const now = Date.now();  
            if (isImageViewerDoubleTap(endX, endY, now)) {  
              e.preventDefault();  
              clearImageViewerLastTap();  
              mediaViewerSuppressClickUntil = Math.max(mediaViewerSuppressClickUntil, Date.now() + 450);  
              ivToggleZoomAt(endX, endY);  
              return;  
            }  
            rememberImageViewerTap(endX, endY, now);  
          } else {  
            clearImageViewerLastTap();  
          }  
        } else {  
          clearImageViewerLastTap();  
        }  
    
        if (ivScale > 1) {  
          if (!wasTapCandidate) e.preventDefault();  
          return;  
        }  
        if (wasDragging && Math.abs(dragDx) > IMAGE_VIEWER_SWIPE_COMMIT_PX) {  
          e.preventDefault();  
          galleryNav(dragDx < 0 ? 1 : -1);  
        } else {  
          ivStrip.style.transition = 'transform 0.3s ease';  
          ivStrip.style.transform = `translateX(${-galleryIndex * window.innerWidth}px)`;  
          updateGalleryArrows();  
        }  
      }, { passive: false });  
    
      imageViewer.addEventListener('touchcancel', () => {  
        resetImageViewerTouchState();  
        if (imageViewer.classList.contains('hidden') || ivScale > 1) return;  
        ivStrip.style.transition = 'transform 0.3s ease';  
        ivStrip.style.transform = `translateX(${-galleryIndex * window.innerWidth}px)`;  
        updateGalleryArrows();  
      }, { passive: false });  
    
      window.addEventListener('resize', () => {  
        resetImageViewerTouchState();  
        if (!imageViewer.classList.contains('hidden')) {  
          ivStrip.style.transition = 'none';  
          ivStrip.style.transform = `translateX(${-galleryIndex * window.innerWidth}px)`;  
          ivApplyTransform();  
        }  
      });  
    })();  
    
  
}
function handlePopStateSkip() { if (!ivSkipNextPopstate) return false; ivSkipNextPopstate = false; return true; }
function resetPopStateSkip() { ivSkipNextPopstate = false; }
function closeMediaViewerFromHistory() { if (imageViewer.classList.contains('hidden')) return false; ivHistoryPushed = false; closeMediaViewer(); ivSkipNextPopstate = false; return true; }
function isFollowupClickSuppressed() { return Date.now() < mediaViewerFollowupClickSuppressUntil; }
function getMediaViewerState() { return { scale: ivScale, panX: ivPanX, panY: ivPanY, transform: ivCurrentImg()?.style?.transform || '', galleryIndex, galleryItems: galleryItems.slice() }; }
__exports = { normalizeGallerySrc, galleryItemKey, galleryItemFromMessage, collectGalleryItems, ivCurrentImg, ivApplyTransform, ivSetZoomState, ivZoomAroundClient, ivResetZoom, ivToggleZoomAt, getGallerySlideElement, getGalleryVideoElement, updateGalleryItemPoster, ensureGalleryItemPoster, gallerySlideHtml, renderGalleryStrip, setGalleryStripPosition, galleryEdgeCursor, normalizeMediaPage, readCachedGalleryMediaPage, cacheGalleryMediaPage, ensureGalleryLoadingEl, ensureGalleryEdgeHintEl, showGalleryEdgeHint, bounceGalleryEdge, setGalleryLoading, appendGalleryMedia, loadGalleryDirection, ensureGalleryBuffered, cleanupGalleryPreloads, preloadGalleryAssets, queueGalleryBuffering, moveGalleryToIndex, openMediaViewer, openImageViewer, closeMediaViewer, handleMediaViewerControlActivation, updateGalleryArrows, galleryNav, suppressMediaViewerFollowupClick, bindEvents, handlePopStateSkip, resetPopStateSkip, closeMediaViewerFromHistory, isFollowupClickSuppressed, getMediaViewerState };
  }
  return scope.__exports;
}
interactionsRoot.mediaViewer = { createMediaViewer };
})();
