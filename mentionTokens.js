const MENTION_RE = /@([a-zA-Z0-9_][a-zA-Z0-9_-]{0,31})/g;
const MENTION_TOKEN_RE = /^[a-zA-Z0-9_][a-zA-Z0-9_-]{0,31}$/;
const MENTION_PREV_RE = /[A-Za-z0-9_.-]/;

function normalizeMentionToken(value) {
  const token = String(value || '').trim().replace(/^@+/, '');
  if (!MENTION_TOKEN_RE.test(token)) return '';
  return token.toLowerCase();
}

function extractMentionTokens(text) {
  const source = String(text || '');
  const tokens = [];
  let match;
  while ((match = MENTION_RE.exec(source))) {
    const prev = match.index > 0 ? source[match.index - 1] : '';
    if (prev && MENTION_PREV_RE.test(prev)) continue;
    tokens.push(match[1].toLowerCase());
  }
  return [...new Set(tokens)];
}

function hasMentionToken(text, token) {
  const normalized = normalizeMentionToken(token);
  if (!normalized) return false;
  return extractMentionTokens(text).includes(normalized);
}

function removeMentionTokens(text, tokens = []) {
  const source = String(text || '');
  const wanted = new Set((Array.isArray(tokens) ? tokens : [tokens])
    .map(normalizeMentionToken)
    .filter(Boolean));
  if (wanted.size === 0) return source;
  return source.replace(MENTION_RE, (full, token, offset) => {
    const prev = offset > 0 ? source[offset - 1] : '';
    if (prev && MENTION_PREV_RE.test(prev)) return full;
    return wanted.has(String(token || '').toLowerCase()) ? ' ' : full;
  });
}

module.exports = {
  extractMentionTokens,
  hasMentionToken,
  normalizeMentionToken,
  removeMentionTokens,
};
