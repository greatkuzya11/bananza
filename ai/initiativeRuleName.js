const INITIATIVE_RULE_NAME_MAX_LENGTH = 240;

function cleanInitiativeRuleName(value) {
  return String(value == null ? '' : value).trim().slice(0, INITIATIVE_RULE_NAME_MAX_LENGTH);
}

function cleanNamePart(value, fallback) {
  return String(value == null ? '' : value).trim() || fallback;
}

function buildInitiativeRuleName({
  promptMode,
  sourceName,
  sourceId,
  chatName,
  chatId,
  botName,
  botId,
} = {}) {
  const parts = [];
  if (promptMode === 'news_hook') {
    parts.push(cleanNamePart(sourceName, sourceId ? `News source #${sourceId}` : 'News source'));
  }
  parts.push(cleanNamePart(chatName, chatId ? `Chat #${chatId}` : 'Chat'));
  parts.push(cleanNamePart(botName, botId ? `Bot #${botId}` : 'Bot'));
  return cleanInitiativeRuleName(parts.join(' — '));
}

module.exports = {
  INITIATIVE_RULE_NAME_MAX_LENGTH,
  cleanInitiativeRuleName,
  buildInitiativeRuleName,
};
