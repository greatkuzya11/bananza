const DIRECT_CREATE_POLL_PATTERNS = [
  /(?:^|[\s,.:;!?()\-])(?:please\s+)?(?:create|make|set\s+up|start|post|publish|organize)\b.{0,40}(?:\bpoll\b|\bvot(?:e|ing)\b)/i,
  /(?:\bpoll\b|\bvot(?:e|ing)\b).{0,20}\b(?:please\s+)?(?:create|make|set\s+up|start|post|publish|organize)\b/i,
  /(?:\bcan\s+you\b|\bcould\s+you\b|\blet'?s\b|\bplease\b|\bneed(?:\s+to)?\b).{0,24}(?:create|make|set\s+up|start|post|publish|organize).{0,40}(?:\bpoll\b|\bvot(?:e|ing)\b)/i,
  /(?:\bcan\s+you\b|\bcould\s+you\b|\blet'?s\b|\bplease\b|\bneed(?:\s+to)?\b).{0,24}(?:\bpoll\b|\bvot(?:e|ing)\b).{0,24}(?:create|make|set\s+up|start|post|publish|organize)\b/i,
  /(?:^|[\s,.:;!?()\-])(?:\u0441\u0434\u0435\u043b\u0430\u0439|\u0441\u043e\u0437\u0434\u0430\u0439|\u0437\u0430\u043f\u0438\u043b\u0438|\u0437\u0430\u043f\u0443\u0441\u0442\u0438|\u043e\u0440\u0433\u0430\u043d\u0438\u0437\u0443\u0439|\u043e\u0444\u043e\u0440\u043c\u0438|\u0443\u0441\u0442\u0440\u043e\u0439).{0,40}(?:\u043e\u043f\u0440\u043e\u0441|\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043d|\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043b\u043a)/i,
  /(?:\u043e\u043f\u0440\u043e\u0441|\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043d|\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043b\u043a).{0,20}(?:\u0441\u0434\u0435\u043b\u0430\u0439|\u0441\u043e\u0437\u0434\u0430\u0439|\u0437\u0430\u043f\u0438\u043b\u0438|\u0437\u0430\u043f\u0443\u0441\u0442\u0438|\u043e\u0440\u0433\u0430\u043d\u0438\u0437\u0443\u0439|\u043e\u0444\u043e\u0440\u043c\u0438|\u0443\u0441\u0442\u0440\u043e\u0439)/i,
  /(?:\u043c\u043e\u0436\u0435\u0448\u044c|\u0441\u043c\u043e\u0436\u0435\u0448\u044c|\u0434\u0430\u0432\u0430\u0439).{0,20}(?:\u0441\u043e\u0437\u0434\u0430\u0442\u044c|\u0441\u0434\u0435\u043b\u0430\u0442\u044c|\u0437\u0430\u043f\u0438\u043b\u0438\u0442\u044c|\u043e\u0440\u0433\u0430\u043d\u0438\u0437\u043e\u0432\u0430\u0442\u044c|\u0437\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u044c).{0,40}(?:\u043e\u043f\u0440\u043e\u0441|\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043d|\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043b\u043a)/i,
  /(?:\u0434\u0430\u0432\u0430\u0439|\u043c\u043e\u0436\u0435\u0448\u044c|\u0441\u043c\u043e\u0436\u0435\u0448\u044c|\u043d\u0430\u0434\u043e|\u043d\u0443\u0436\u043d\u043e|\u043f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430).{0,30}(?:\u0441\u0434\u0435\u043b\u0430\u0435\u043c|\u0441\u043e\u0437\u0434\u0430\u0434\u0438\u043c|\u0437\u0430\u043f\u0438\u043b\u0438\u043c|\u0437\u0430\u043f\u0443\u0441\u0442\u0438\u043c|\u043e\u0440\u0433\u0430\u043d\u0438\u0437\u0443\u0435\u043c|\u043e\u0444\u043e\u0440\u043c\u0438\u043c|\u0443\u0441\u0442\u0440\u043e\u0438\u043c).{0,40}(?:\u043e\u043f\u0440\u043e\u0441|\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043d|\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043b\u043a)/i,
  /(?:\u0434\u0430\u0432\u0430\u0439|\u043c\u043e\u0436\u0435\u0448\u044c|\u0441\u043c\u043e\u0436\u0435\u0448\u044c|\u043d\u0430\u0434\u043e|\u043d\u0443\u0436\u043d\u043e|\u043f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430).{0,30}(?:\u043e\u043f\u0440\u043e\u0441|\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043d|\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043b\u043a).{0,24}(?:\u0441\u0434\u0435\u043b\u0430\u0435\u043c|\u0441\u043e\u0437\u0434\u0430\u0434\u0438\u043c|\u0437\u0430\u043f\u0438\u043b\u0438\u043c|\u0437\u0430\u043f\u0443\u0441\u0442\u0438\u043c|\u043e\u0440\u0433\u0430\u043d\u0438\u0437\u0443\u0435\u043c|\u043e\u0444\u043e\u0440\u043c\u0438\u043c|\u0443\u0441\u0442\u0440\u043e\u0438\u043c)/i,
];

const DIRECT_VOTE_PATTERNS = [
  /(?:^|[\s,.:;!?()\-])(?:please\s+)?(?:vote(?:\s+for)?|choose|pick|select)\b/i,
  /(?:\bcan\s+you\b|\bcould\s+you\b|\blet'?s\b|\bplease\b).{0,16}(?:vote(?:\s+for)?|choose|pick|select)\b/i,
  /(?:^|[\s,.:;!?()\-])(?:\u043f\u0440\u043e\u0433\u043e\u043b\u043e\u0441\u0443\u0439|\u0433\u043e\u043b\u043e\u0441\u0443\u0439|\u0432\u044b\u0431\u0435\u0440\u0438|\u0432\u044b\u0431\u0438\u0440\u0430\u0439|\u043e\u0442\u0434\u0430\u0439\s+\u0433\u043e\u043b\u043e\u0441|\u0441\u0442\u0430\u0432\u044c|\u0436\u043c\u0438|\u043d\u0430\u0436\u043c\u0438|\u0442\u044b\u043a\u043d\u0438)/i,
  /(?:\u043c\u043e\u0436\u0435\u0448\u044c|\u0441\u043c\u043e\u0436\u0435\u0448\u044c|\u0434\u0430\u0432\u0430\u0439).{0,12}(?:\u043f\u0440\u043e\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u0442\u044c|\u0432\u044b\u0431\u0440\u0430\u0442\u044c|\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u0442\u044c)/i,
  /(?:\u0434\u0430\u0432\u0430\u0439|\u043c\u043e\u0436\u0435\u0448\u044c|\u0441\u043c\u043e\u0436\u0435\u0448\u044c|\u043f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430).{0,16}(?:\u043f\u0440\u043e\u0433\u043e\u043b\u043e\u0441\u0443\u0435\u043c|\u0432\u044b\u0431\u0435\u0440\u0435\u043c|\u0433\u043e\u043b\u043e\u0441\u043d\u0435\u043c)/i,
];

const DIRECT_REACT_PATTERNS = [
  /(?:^|[\s,.:;!?()\-])(?:please\s+)?(?:react|add\s+reaction|drop\s+reaction)\b/i,
  /(?:^|[\s,.:;!?()\-])(?:\u043e\u0442\u0440\u0435\u0430\u0433\u0438\u0440\u0443\u0439|\u043f\u043e\u0441\u0442\u0430\u0432\u044c\s+\u0440\u0435\u0430\u043a\u0446\u0438\u044e|\u043a\u0438\u043d\u044c\s+\u0440\u0435\u0430\u043a\u0446\u0438\u044e|\u043b\u0430\u0439\u043a\u043d\u0438)/i,
];

const DIRECT_PIN_PATTERNS = [
  /(?:^|[\s,.:;!?()\-])(?:please\s+)?(?:pin|unpin)\b/i,
  /(?:^|[\s,.:;!?()\-])(?:\u0437\u0430\u043a\u0440\u0435\u043f\u0438|\u0437\u0430\u043f\u0438\u043d\u044c|\u043f\u0440\u0438\u043a\u0440\u0435\u043f\u0438)/i,
];

function matchesAnyPattern(value, patterns) {
  const text = String(value || '').trim();
  if (!text) return false;
  return patterns.some((pattern) => pattern.test(text));
}

function textLooksLikeCreatePollRequest(value = '') {
  return matchesAnyPattern(value, DIRECT_CREATE_POLL_PATTERNS);
}

function textLooksLikeVoteRequest(value = '') {
  return matchesAnyPattern(value, DIRECT_VOTE_PATTERNS);
}

function textLooksLikeReactRequest(value = '') {
  return matchesAnyPattern(value, DIRECT_REACT_PATTERNS);
}

function textLooksLikePinRequest(value = '') {
  return matchesAnyPattern(value, DIRECT_PIN_PATTERNS);
}

function textLooksLikeChatActionRequest(value = '') {
  return textLooksLikeCreatePollRequest(value)
    || textLooksLikeVoteRequest(value)
    || textLooksLikeReactRequest(value)
    || textLooksLikePinRequest(value);
}

function shouldAttemptBotActionPlan({
  hasMessageActions,
  botKind,
  requestedMode,
  text,
} = {}) {
  if (!hasMessageActions) return false;
  if (botKind === 'image') return false;
  if (botKind === 'universal' && requestedMode && requestedMode !== 'text') return false;
  return textLooksLikeChatActionRequest(text);
}

module.exports = {
  textLooksLikeCreatePollRequest,
  textLooksLikeVoteRequest,
  textLooksLikeReactRequest,
  textLooksLikePinRequest,
  textLooksLikeChatActionRequest,
  shouldAttemptBotActionPlan,
};
