const REACTION_KEY_TO_EMOJI = Object.freeze({
  like: '👍',
  heart: '❤️',
  fire: '🔥',
  laugh: '😂',
  wow: '😮',
  sad: '😢',
  celebrate: '🎉',
  dislike: '👎',
  clown: '🤡',
  poop: '💩',
});

const REACTION_KEYS = new Set([...Object.keys(REACTION_KEY_TO_EMOJI), 'custom']);
const REACTION_MODES = new Set(['add', 'replace', 'remove']);
const REACTION_MEME_KEYS = new Set(['clown', 'poop']);

const REACTION_KEY_ALIASES = new Map([
  ['👍', 'like'],
  ['like', 'like'],
  ['thumbsup', 'like'],
  ['thumbs_up', 'like'],
  ['thumbsups', 'like'],
  ['\u043b\u0430\u0439\u043a', 'like'],
  ['❤️', 'heart'],
  ['❤', 'heart'],
  ['heart', 'heart'],
  ['love', 'heart'],
  ['\u0441\u0435\u0440\u0434\u0446\u0435', 'heart'],
  ['\u0441\u0435\u0440\u0434\u0435\u0447\u043a\u043e', 'heart'],
  ['\u043b\u044e\u0431\u043e\u0432\u044c', 'heart'],
  ['🔥', 'fire'],
  ['fire', 'fire'],
  ['\u043e\u0433\u043e\u043d\u044c', 'fire'],
  ['\u0436\u0430\u0440\u0430', 'fire'],
  ['hot', 'fire'],
  ['😂', 'laugh'],
  ['laugh', 'laugh'],
  ['funny', 'laugh'],
  ['lol', 'laugh'],
  ['\u0441\u043c\u0435\u0448\u043d\u043e', 'laugh'],
  ['\u0441\u043c\u0435\u0445', 'laugh'],
  ['\u0445\u0430\u0445\u0430', 'laugh'],
  ['😮', 'wow'],
  ['wow', 'wow'],
  ['\u0443\u0434\u0438\u0432\u043b\u0435\u043d\u0438\u0435', 'wow'],
  ['\u0432\u0430\u0443', 'wow'],
  ['\u0443\u0434\u0438\u0432\u0438', 'wow'],
  ['😢', 'sad'],
  ['sad', 'sad'],
  ['support', 'sad'],
  ['\u0441\u043e\u0447\u0443\u0432\u0441\u0442\u0432\u0438\u0435', 'sad'],
  ['\u0433\u0440\u0443\u0441\u0442\u044c', 'sad'],
  ['\u0433\u0440\u0443\u0441\u0442\u043d\u043e', 'sad'],
  ['\u043f\u0435\u0447\u0430\u043b\u044c', 'sad'],
  ['🎉', 'celebrate'],
  ['celebrate', 'celebrate'],
  ['party', 'celebrate'],
  ['congrats', 'celebrate'],
  ['\u043f\u0440\u0430\u0437\u0434\u043d\u0438\u043a', 'celebrate'],
  ['\u043f\u043e\u0437\u0434\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435', 'celebrate'],
  ['\u043f\u043e\u0437\u0434\u0440\u0430\u0432\u044c', 'celebrate'],
  ['👎', 'dislike'],
  ['dislike', 'dislike'],
  ['thumbsdown', 'dislike'],
  ['thumbs_down', 'dislike'],
  ['\u0434\u0438\u0437\u043b\u0430\u0439\u043a', 'dislike'],
  ['\u043d\u0435 \u043d\u0440\u0430\u0432\u0438\u0442\u0441\u044f', 'dislike'],
  ['🤡', 'clown'],
  ['clown', 'clown'],
  ['\u043a\u043b\u043e\u0443\u043d', 'clown'],
  ['\u043f\u043e\u0434\u043a\u043e\u043b', 'clown'],
  ['tease', 'clown'],
  ['mock', 'clown'],
  ['💩', 'poop'],
  ['poop', 'poop'],
  ['shit', 'poop'],
  ['\u0433\u043e\u0432\u043d\u043e', 'poop'],
  ['\u0442\u0440\u044d\u0448', 'poop'],
  ['trash', 'poop'],
  ['custom', 'custom'],
]);

function normalizeReactionKey(value = '') {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return '';
  if (REACTION_KEYS.has(text)) return text;
  if (REACTION_KEY_ALIASES.has(text)) return REACTION_KEY_ALIASES.get(text) || '';
  const compact = text.replace(/[\s_-]+/g, '');
  if (REACTION_KEY_ALIASES.has(compact)) return REACTION_KEY_ALIASES.get(compact) || '';
  return '';
}

function resolveReactionEmoji({ reactionKey = '', emoji = '' } = {}) {
  const key = normalizeReactionKey(reactionKey);
  if (key && key !== 'custom') return REACTION_KEY_TO_EMOJI[key] || '';
  if (key === 'custom') return String(emoji || '').trim();
  const inferredKey = normalizeReactionKey(emoji);
  if (inferredKey && inferredKey !== 'custom') return REACTION_KEY_TO_EMOJI[inferredKey] || '';
  return String(emoji || '').trim();
}

module.exports = {
  REACTION_KEY_TO_EMOJI,
  REACTION_KEYS,
  REACTION_MODES,
  REACTION_MEME_KEYS,
  normalizeReactionKey,
  resolveReactionEmoji,
};
