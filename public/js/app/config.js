(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const loc = window.location || { protocol: 'http:', host: '' };

  function deepFreeze(value) {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.getOwnPropertyNames(value).forEach((key) => deepFreeze(value[key]));
    return Object.freeze(value);
  }

  function readOnlySet(values) {
    const set = new Set(values);
    const wrapper = {
      get size() {
        return set.size;
      },
      has(value) {
        return set.has(value);
      },
      keys() {
        return set.keys();
      },
      values() {
        return set.values();
      },
      entries() {
        return set.entries();
      },
      forEach(callback, thisArg) {
        set.forEach((value, key) => callback.call(thisArg, value, key, wrapper));
      },
      [Symbol.iterator]() {
        return set[Symbol.iterator]();
      },
    };
    return Object.freeze(wrapper);
  }

  const UI_THEMES = deepFreeze([
    { id: 'bananza', name: 'BananZa', note: 'Classic blue', colors: ['#17212b', '#5eb5f7'], own: '#2b5278', other: '#182533' },
    { id: 'banan-hero', name: 'Banan Hero', note: 'Grass + signal', colors: ['#15171a', '#ffd33f'], own: '#496436', other: '#202228' },
    { id: 'midnight-ocean', name: 'Midnight Ocean', note: 'Navy + teal', colors: ['#071823', '#2dd4bf'], own: '#14506a', other: '#102434' },
    { id: 'nord-aurora', name: 'Nord Aurora', note: 'Graphite + aurora', colors: ['#2e3440', '#88c0d0'], own: '#3b5f75', other: '#293340' },
    { id: 'rose-pine', name: 'Rose Pine', note: 'Plum + rose', colors: ['#191724', '#eb6f92'], own: '#3a2a4a', other: '#221f33' },
    { id: 'dracula-neon', name: 'Dracula Neon', note: 'Violet + pink', colors: ['#282a36', '#ff79c6'], own: '#4b3a69', other: '#242636' },
    { id: 'tokyo-night', name: 'Tokyo Night', note: 'Ink + electric blue', colors: ['#1a1b26', '#7aa2f7'], own: '#2b4d7d', other: '#202437' },
  ]);

  const UI_VISUAL_MODES = deepFreeze([
    { id: 'classic', name: 'Off', note: 'Classic flat theme surfaces.' },
    { id: 'rich', name: 'On', note: 'Layered gradients, glass cards and theme-colored glow.' },
  ]);

  const POLL_STYLES = deepFreeze([
    { id: 'pulse', name: 'Pulse', note: 'Hero gradients and bold result cards', accent: ['var(--accent)', 'var(--link)'] },
    { id: 'stack', name: 'Stack', note: 'Compact rows with dense readable stats', accent: ['var(--border-light)', 'var(--accent)'] },
    { id: 'orbit', name: 'Orbit', note: 'Mini chart with colorful legend blocks', accent: ['var(--link)', 'var(--success)'] },
  ]);

  const MODAL_ANIMATION_STYLES = deepFreeze([
    { id: 'soft', name: 'Soft', note: 'Stronger lift with a smooth modal feel.' },
    { id: 'lift', name: 'Lift', note: 'More vertical travel and a clearer close motion.' },
    { id: 'zoom', name: 'Zoom', note: 'Content pops from scale with a dense backdrop.' },
    { id: 'slide', name: 'Slide', note: 'More obvious upward slide, closer to a sheet feel.' },
    { id: 'fade', name: 'Fade', note: 'Pure fade, but slower and more noticeable than before.' },
    { id: 'none', name: 'None', note: 'Instant open/close with no animation.' },
  ]);

  const config = deepFreeze({
    WS_URL: `${loc.protocol === 'https:' ? 'wss:' : 'ws:'}//${loc.host}/ws`,
    PAGE_SIZE: 50,
    MESSAGE_CACHE_LIMIT: 800,
    MESSAGE_BACKGROUND_SYNC_CONCURRENCY: 2,
    MESSAGE_BACKGROUND_SYNC_MAX_CHATS: 6,
    MESSAGE_BACKGROUND_SYNC_MAX_PAGES: 3,
    MENTION_PICKER_TAP_DEAD_ZONE: 10,
    MAX_MSG: 5000,
    MAX_ATTACHMENTS: 10,
    MAX_FILE_SIZE: 1024 * 1024 * 1024,
    MAX_FILE_SIZE_LABEL: '1 GB',
    VIDEO_POSTER_MIME: 'image/jpeg',
    VIDEO_POSTER_MAX_DIMENSION: 960,
    VIDEO_POSTER_QUALITY: 0.82,
    VIDEO_POSTER_CAPTURE_TIMEOUT_MS: 8000,
    VIDEO_POSTER_CAPTURE_SEEKS: deepFreeze([0, 0.05, 0.12, 0.25]),
    POLL_MIN_OPTIONS: 2,
    POLL_MAX_OPTIONS: 10,
    POLL_CLOSE_PRESET_MS: deepFreeze({
      '1h': 60 * 60 * 1000,
      '4h': 4 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '3d': 3 * 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
    }),
    IMAGE_MIME_TYPES: readOnlySet([
      'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/avif', 'image/bmp',
    ]),
    AUDIO_MIME_TYPES: readOnlySet([
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/ogg',
      'audio/webm', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/flac', 'audio/x-flac',
    ]),
    VIDEO_MIME_TYPES: readOnlySet([
      'video/mp4', 'video/webm', 'video/quicktime', 'video/ogg', 'video/x-m4v',
    ]),
    IMAGE_EXTENSIONS: readOnlySet([
      '.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.avif', '.bmp',
    ]),
    AUDIO_EXTENSIONS: readOnlySet([
      '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.weba',
    ]),
    VIDEO_EXTENSIONS: readOnlySet([
      '.mp4', '.webm', '.mov', '.ogv', '.m4v',
    ]),
    UI_THEMES,
    UI_THEME_IDS: readOnlySet(UI_THEMES.map((theme) => theme.id)),
    UI_VISUAL_MODES,
    UI_VISUAL_MODE_IDS: readOnlySet(UI_VISUAL_MODES.map((mode) => mode.id)),
    POLL_STYLES,
    POLL_STYLE_IDS: readOnlySet(POLL_STYLES.map((style) => style.id)),
    MODAL_ANIMATION_STYLES,
    MODAL_ANIMATION_STYLE_IDS: readOnlySet(MODAL_ANIMATION_STYLES.map((style) => style.id)),
    MODAL_ANIMATION_SPEED_DEFAULT: 8,
    MODAL_ANIMATION_SPEED_FACTORS: deepFreeze({
      1: 4.5,
      2: 4.0,
      3: 3.5,
      4: 3.0,
      5: 2.3,
      6: 1.8,
      7: 1.5,
      8: 1.0,
      9: 0.8,
      10: 0.5,
    }),
    MOBILE_FONT_SIZE_DEFAULT: 5,
    MOBILE_FONT_SIZE_MIN: 1,
    MOBILE_FONT_SIZE_MAX: 10,
    MOBILE_FONT_SIZE_PERCENTS: deepFreeze({
      1: 84,
      2: 88,
      3: 92,
      4: 96,
      5: 100,
      6: 104,
      7: 108,
      8: 112,
      9: 116,
      10: 120,
    }),
    MODAL_TRANSITION_BUFFER_MS: 80,
    CHAT_LIST_CACHE_VERSION: 3,
    CHAT_LIST_CACHE_SYNC_DEBOUNCE_MS: 250,
    CHAT_LIST_REQUEST_TIMEOUT_MS: 9000,
    RECOVERY_SYNC_MIN_INTERVAL_MS: 1200,
    RECOVERY_CATCHUP_MAX_PAGES: 5,
    PAGINATION_FETCH_MAX_PAGES: 6,
    PAGINATION_TOP_THRESHOLD: 120,
    PAGINATION_BOTTOM_THRESHOLD: 120,
    SCROLL_DATE_HIDE_DELAY_MS: 900,
    CHAT_LIST_PULL_TRIGGER_PX: 10,
    CHAT_LIST_PULL_THRESHOLD: 64,
    CHAT_LIST_PULL_MAX_OFFSET: 96,
    CHAT_LIST_PULL_REFRESH_OFFSET: 56,
    CHAT_FOLDER_SWIPE_START_PX: 10,
    CHAT_FOLDER_SWIPE_COMMIT_MIN_PX: 64,
    CHAT_FOLDER_SWIPE_COMMIT_RATIO: 0.22,
    CHAT_FOLDER_SWIPE_EDGE_DAMPING: 0.34,
    CHAT_FOLDER_SWIPE_EDGE_MAX_PX: 52,
    HORIZONTAL_PAGER_SWIPE_START_PX: 10,
    HORIZONTAL_PAGER_SWIPE_COMMIT_MIN_PX: 64,
    HORIZONTAL_PAGER_SWIPE_COMMIT_RATIO: 0.22,
    HORIZONTAL_PAGER_SWIPE_EDGE_DAMPING: 0.34,
    HORIZONTAL_PAGER_SWIPE_EDGE_MAX_PX: 52,
    RESUME_WS_REFRESH_AFTER_MS: 25000,
    NOTES_CHAT_EMOJI: '\uD83D\uDCDD',
    CHAT_CONTEXT_LONG_PRESS_MS: 500,
    MEDIA_CONTEXT_LONG_PRESS_MS: 500,
    MEDIA_CONTEXT_TARGET_SELECTOR: '.msg-image, .msg-video video, .msg-audio audio, .msg-file, .video-note-stage',
    ALL_CHATS_FOLDER_ID: 0,
    CHAT_FOLDER_ICON_EMOJI: deepFreeze({
      all: '\uD83D\uDCAC',
      custom: '\uD83D\uDCC1',
      bot_auto: '\uD83E\uDD16',
    }),
  });

  root.config = config;
})();
