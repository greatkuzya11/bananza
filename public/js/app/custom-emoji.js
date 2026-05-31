(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};

  const CUSTOM_EMOJI_TOKEN_PATTERN = Object.freeze(/^:(?:qip-infium-\d{3}|qip-hd-[a-z0-9][a-z0-9-]{0,63}):$/);
  const COMPOSER_CUSTOM_EMOJI_MARKER_BASE = 0xE000;
  const COMPOSER_CUSTOM_EMOJI_PAD_CHAR = ' ';
  const COMPOSER_CUSTOM_EMOJI_MAX_PAD = 32;
  const QIP_HD_EMOJI_MESSAGE_SCALE = 0.5;

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.getOwnPropertyNames(value).forEach((key) => deepFreeze(value[key]));
    return Object.freeze(value);
  }

  function readOnlyMap(entries) {
    const map = new Map(entries);
    const wrapper = {
      get size() {
        return map.size;
      },
      get(key) {
        return map.get(key);
      },
      has(key) {
        return map.has(key);
      },
      keys() {
        return map.keys();
      },
      values() {
        return map.values();
      },
      entries() {
        return map.entries();
      },
      forEach(callback, thisArg) {
        map.forEach((value, key) => callback.call(thisArg, value, key, wrapper));
      },
      [Symbol.iterator]() {
        return map[Symbol.iterator]();
      },
    };
    return Object.freeze(wrapper);
  }

  function esc(value) {
    const formatters = root.formatters || {};
    if (typeof formatters.esc === 'function') return formatters.esc(value);
    if (typeof document !== 'undefined' && document.createElement) {
      const d = document.createElement('div');
      d.textContent = value;
      return d.innerHTML;
    }
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function normalizeCustomEmojiCatalog(catalog) {
    const raw = catalog && typeof catalog === 'object' ? catalog : {};
    const id = String(raw.id || '').trim();
    if (!id) return Object.freeze({ id: '', label: '', items: Object.freeze([]) });
    const label = String(raw.label || id).trim() || id;
    const items = (Array.isArray(raw.items) ? raw.items : [])
      .map((item, index) => {
        const token = String(item?.token || '').trim();
        if (!CUSTOM_EMOJI_TOKEN_PATTERN.test(token)) return null;
        const src = String(item?.src || '').trim();
        if (!src) return null;
        return Object.freeze({
          id: Number(item.id) || index + 1,
          category: id,
          categoryLabel: label,
          token,
          src,
          width: Math.max(1, Number(item.width) || 20),
          height: Math.max(1, Number(item.height) || 20),
          label: String(item.label || `${label} ${index + 1}`).trim(),
        });
      })
      .filter(Boolean);
    return Object.freeze({ id, label, items: Object.freeze(items) });
  }

  const CUSTOM_EMOJI_CATALOGS = Object.freeze([
    window.BananzaQipInfiumOriginal,
    window.BananzaQipHdEmojis,
  ]
    .map(normalizeCustomEmojiCatalog)
    .filter((catalog) => catalog.items.length));
  const customEmojiByCategory = new Map(CUSTOM_EMOJI_CATALOGS.map((catalog) => [catalog.id, catalog]));
  const CUSTOM_EMOJI_BY_CATEGORY = readOnlyMap(customEmojiByCategory);
  const CUSTOM_EMOJI_ITEMS = Object.freeze(CUSTOM_EMOJI_CATALOGS.flatMap((catalog) => catalog.items));
  const customEmojiByToken = new Map(CUSTOM_EMOJI_ITEMS.map((item) => [item.token, item]));
  const CUSTOM_EMOJI_BY_TOKEN = readOnlyMap(customEmojiByToken);
  const customEmojiMarkerByToken = new Map(CUSTOM_EMOJI_ITEMS.map((item, index) => [
    item.token,
    String.fromCharCode(COMPOSER_CUSTOM_EMOJI_MARKER_BASE + index),
  ]));
  const CUSTOM_EMOJI_MARKER_BY_TOKEN = readOnlyMap(customEmojiMarkerByToken);
  const customEmojiTokenByMarker = new Map(Array.from(customEmojiMarkerByToken, ([token, marker]) => [marker, token]));
  const CUSTOM_EMOJI_TOKEN_BY_MARKER = readOnlyMap(customEmojiTokenByMarker);

  function getCustomEmoji(token) {
    return customEmojiByToken.get(String(token || '').trim()) || null;
  }

  function getCustomEmojiCatalog(category) {
    return customEmojiByCategory.get(String(category || '')) || null;
  }

  function isCustomEmojiToken(value) {
    return Boolean(getCustomEmoji(value));
  }

  function isSingleCustomEmojiMessage(text) {
    return isCustomEmojiToken(String(text || '').trim());
  }

  function getCustomEmojiRenderScale(item, { large = false, picker = false } = {}) {
    const baseScale = large ? 2.65 : 1;
    const qipHdScale = item?.category === 'qip-hd' && !picker ? QIP_HD_EMOJI_MESSAGE_SCALE : 1;
    return baseScale * qipHdScale;
  }

  function getCustomEmojiRenderedSize(item, options = {}) {
    const scale = getCustomEmojiRenderScale(item, options);
    return {
      width: Math.max(1, Math.round((Number(item?.width) || 20) * scale)),
      height: Math.max(1, Math.round((Number(item?.height) || 20) * scale)),
    };
  }

  function renderCustomEmojiHtml(token, { large = false, className = '', picker = false } = {}) {
    const item = getCustomEmoji(token);
    if (!item) return esc(token);
    const { width, height } = getCustomEmojiRenderedSize(item, { large, picker });
    const classes = [
      'custom-emoji-img',
      `${item.category}-emoji`,
      item.category === 'qip-infium-original' ? 'qip-infium-emoji' : '',
      item.category === 'qip-hd' ? 'qip-hd-emoji' : '',
      large ? 'custom-emoji-img--large qip-infium-emoji--large' : '',
      className
    ]
      .filter(Boolean)
      .join(' ');
    return `<img class="${esc(classes)}" src="${esc(item.src)}" width="${width}" height="${height}" alt="${esc(item.label)}" title="${esc(item.label)}" loading="lazy" decoding="async">`;
  }

  function getComposerCustomEmojiPadLength(item) {
    const width = getCustomEmojiRenderedSize(item).width;
    return Math.max(1, Math.min(COMPOSER_CUSTOM_EMOJI_MAX_PAD, Math.round((width - 8) / 4)));
  }

  function getComposerCustomEmojiCluster(item) {
    const marker = customEmojiMarkerByToken.get(item?.token);
    if (!marker) return String(item?.token || '');
    return marker + COMPOSER_CUSTOM_EMOJI_PAD_CHAR.repeat(getComposerCustomEmojiPadLength(item));
  }

  function getComposerCustomEmojiItemFromMarker(marker) {
    const token = customEmojiTokenByMarker.get(marker);
    return token ? getCustomEmoji(token) : null;
  }

  function getComposerCustomEmojiClusterEnd(value, start) {
    const source = String(value || '');
    const item = getComposerCustomEmojiItemFromMarker(source[start]);
    if (!item) return start + 1;
    const maxEnd = Math.min(source.length, start + 1 + getComposerCustomEmojiPadLength(item));
    let end = start + 1;
    while (end < maxEnd && source[end] === COMPOSER_CUSTOM_EMOJI_PAD_CHAR) end += 1;
    return end;
  }

  function findComposerCustomEmojiClusterAt(value, offset) {
    const source = String(value || '');
    const cursor = Math.max(0, Math.min(source.length, Number(offset) || 0));
    const backwardLimit = Math.max(0, cursor - COMPOSER_CUSTOM_EMOJI_MAX_PAD - 2);
    for (let index = cursor; index >= backwardLimit; index -= 1) {
      const item = getComposerCustomEmojiItemFromMarker(source[index]);
      if (!item) continue;
      const end = getComposerCustomEmojiClusterEnd(source, index);
      if (cursor >= index && cursor <= end) return { start: index, end, item };
    }
    return null;
  }

  function findComposerCustomEmojiClusterBefore(value, offset) {
    const source = String(value || '');
    const cursor = Math.max(0, Math.min(source.length, Number(offset) || 0));
    const inside = findComposerCustomEmojiClusterAt(source, cursor);
    if (inside && cursor > inside.start) return inside;
    const backwardLimit = Math.max(0, cursor - COMPOSER_CUSTOM_EMOJI_MAX_PAD - 2);
    for (let index = cursor - 1; index >= backwardLimit; index -= 1) {
      const item = getComposerCustomEmojiItemFromMarker(source[index]);
      if (!item) continue;
      const end = getComposerCustomEmojiClusterEnd(source, index);
      if (end === cursor) return { start: index, end, item };
    }
    return null;
  }

  function findComposerCustomEmojiClusterAfter(value, offset) {
    const source = String(value || '');
    const cursor = Math.max(0, Math.min(source.length, Number(offset) || 0));
    const inside = findComposerCustomEmojiClusterAt(source, cursor);
    if (inside && cursor < inside.end) return inside;
    const item = getComposerCustomEmojiItemFromMarker(source[cursor]);
    if (!item) return null;
    return { start: cursor, end: getComposerCustomEmojiClusterEnd(source, cursor), item };
  }

  function composerCustomEmojiClusterBoundary(cluster, cursor) {
    if (!cluster) return cursor;
    const midpoint = cluster.start + ((cluster.end - cluster.start) / 2);
    return cursor <= midpoint ? cluster.start : cluster.end;
  }

  function normalizeComposerTextToInternal(value) {
    const source = String(value || '');
    const tokenRe = /^:qip-infium-\d{3}:|^:qip-hd-[a-z0-9][a-z0-9-]{0,63}:/i;
    let result = '';
    for (let index = 0; index < source.length;) {
      const markerItem = getComposerCustomEmojiItemFromMarker(source[index]);
      if (markerItem) {
        result += getComposerCustomEmojiCluster(markerItem);
        index = getComposerCustomEmojiClusterEnd(source, index);
        continue;
      }
      const tokenMatch = source.slice(index).match(tokenRe);
      if (tokenMatch) {
        const token = tokenMatch[0];
        const item = getCustomEmoji(token);
        if (item) {
          result += getComposerCustomEmojiCluster(item);
          index += token.length;
          continue;
        }
      }
      result += source[index];
      index += 1;
    }
    return result;
  }

  function serializeComposerTextValue(value, { trim = false } = {}) {
    const source = String(value || '');
    let result = '';
    for (let index = 0; index < source.length;) {
      const item = getComposerCustomEmojiItemFromMarker(source[index]);
      if (item) {
        result += item.token;
        index = getComposerCustomEmojiClusterEnd(source, index);
        continue;
      }
      result += source[index];
      index += 1;
    }
    return trim ? result.trim() : result;
  }

  root.customEmoji = deepFreeze({
    CUSTOM_EMOJI_TOKEN_PATTERN,
    CUSTOM_EMOJI_CATALOGS,
    CUSTOM_EMOJI_BY_CATEGORY,
    CUSTOM_EMOJI_ITEMS,
    CUSTOM_EMOJI_BY_TOKEN,
    COMPOSER_CUSTOM_EMOJI_MARKER_BASE,
    COMPOSER_CUSTOM_EMOJI_PAD_CHAR,
    COMPOSER_CUSTOM_EMOJI_MAX_PAD,
    QIP_HD_EMOJI_MESSAGE_SCALE,
    CUSTOM_EMOJI_MARKER_BY_TOKEN,
    CUSTOM_EMOJI_TOKEN_BY_MARKER,
    normalizeCustomEmojiCatalog,
    getCustomEmoji,
    getCustomEmojiCatalog,
    isCustomEmojiToken,
    isSingleCustomEmojiMessage,
    getCustomEmojiRenderScale,
    getCustomEmojiRenderedSize,
    renderCustomEmojiHtml,
    getComposerCustomEmojiPadLength,
    getComposerCustomEmojiCluster,
    getComposerCustomEmojiItemFromMarker,
    getComposerCustomEmojiClusterEnd,
    findComposerCustomEmojiClusterAt,
    findComposerCustomEmojiClusterBefore,
    findComposerCustomEmojiClusterAfter,
    composerCustomEmojiClusterBoundary,
    normalizeComposerTextToInternal,
    serializeComposerTextValue,
  });
})();
