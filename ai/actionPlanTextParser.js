const ACTION_NAMES = new Set(['create_poll', 'vote_poll', 'react_message', 'pin_message']);
const {
  REACTION_MODES,
  normalizeReactionKey,
} = require('./reactionKeys');

const POLL_STYLES = new Set(['pulse', 'stack', 'orbit']);
const POLL_CLOSE_PRESET_MINUTES = [
  ['1h', 60],
  ['4h', 4 * 60],
  ['24h', 24 * 60],
  ['3d', 3 * 24 * 60],
  ['7d', 7 * 24 * 60],
];

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function boolArg(args, key, fallback = false) {
  return hasOwn(args, key) ? Boolean(args[key]) : fallback;
}

function normalizePollStyle(value) {
  const style = String(value || '').trim().toLowerCase();
  return POLL_STYLES.has(style) ? style : 'pulse';
}

function stylePatchFromText(text = '') {
  const source = String(text || '');
  const match = source.match(/(?:\bstyle\b|\bdesign\b|\bview\b|\u0441\u0442\u0438\u043b\u044c?|\u0434\u0438\u0437\u0430\u0439\u043d|\u0432\u0438\u0434)\s*[:=\-\u2013\u2014]?\s*(pulse|stack|orbit)\b/i);
  const style = normalizePollStyle(match?.[1] || '');
  return style === 'pulse' ? {} : { style };
}

function textHasNonAnonymousVisibility(text = '') {
  const source = String(text || '');
  return /(?:\bnot\s+anonymous\b|\bnon[-\s]?anonymous\b|\u043d\u0435\s+\u0430\u043d\u043e\u043d\u0438\u043c|\u043d\u0435\u0430\u043d\u043e\u043d\u0438\u043c)/i.test(source);
}

function textHasAnonymousVisibility(text = '') {
  const source = String(text || '');
  return [
    /\b(?:anonymous|anonymously|private\s+voters?|private\s+votes?|hidden\s+voters?)\b/i,
    /\b(?:hide|hidden|do\s+not\s+show|don't\s+show|dont\s+show)\s+(?:who\s+voted|voters?|votes?)\b/i,
    /(?:\u0430\u043d\u043e\u043d\u0438\u043c|\u0430\u043d\u043e\u043d\u0438\u043c\u043d)/i,
    /(?:\u043d\u0435\s+\u043f\u043e\u043a\u0430\u0437[\u0430-\u044f\u0451]*|\u0441\u043a\u0440\u044b[\u0430-\u044f\u0451]*)\s+(?:\u043a\u0442\u043e\s+\u0433\u043e\u043b\u043e\u0441[\u0430-\u044f\u0451]*|\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u0432[\u0430-\u044f\u0451]*|\u0433\u043e\u043b\u043e\u0441\u0430)/i,
  ].some((pattern) => pattern.test(source));
}

function detectShowVotersFromText(text = '') {
  if (textHasNonAnonymousVisibility(text)) return true;
  if (textHasAnonymousVisibility(text)) return false;
  return true;
}

function detectAllowsMultipleFromText(text = '') {
  return /(?:multiple|multi[- ]?choice|multi|\u043d\u0435\u0441\u043a\u043e\u043b\u044c\u043a|\u043c\u043d\u043e\u0436\u0435\u0441\u0442\u0432|\u043c\u0443\u043b\u044c\u0442\u0438|\u0431\u043e\u043b\u044c\u0448\u0435\s+\u043e\u0434\u043d\u043e\u0433\u043e)/i.test(String(text || ''));
}

function detectPinAfterCreateFromText(text = '') {
  return /(?:\bpin\b|\u0437\u0430\u043a\u0440\u0435\u043f|\u0437\u0430\u043f\u0438\u043d)/i.test(String(text || ''));
}

function stripPollOptionParameterTail(value = '') {
  return String(value || '')
    .replace(/\s*(?:[.;]|\s)(?:\u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440[\u0430-\u044f\u0451]*|anonymous|anonymously|\u0430\u043d\u043e\u043d\u0438\u043c[\u0430-\u044f\u0451]*|public\s+voters?|visible\s+voters?|\u043f\u043e\u043a\u0430\u0437[\u0430-\u044f\u0451]*\s+\u043a\u0442\u043e|\u043d\u0435\s+\u043f\u043e\u043a\u0430\u0437[\u0430-\u044f\u0451]*|timer|\u0442\u0430\u0439\u043c\u0435\u0440|\u0437\u0430\u043a\u0440\u044b[\u0430-\u044f\u0451]*\s+\u0447\u0435\u0440\u0435\u0437|auto[- ]?close|\u0430\u0432\u0442\u043e\u0437\u0430\u043a\u0440[\u0430-\u044f\u0451]*|style|\u0441\u0442\u0438\u043b\u044c?|design|\u0434\u0438\u0437\u0430\u0439\u043d)(?=$|\s|[:=,\-\u2013\u2014])[\s\S]*$/i, '')
    .trim();
}

function tryParseJsonObject(text, fallback = null) {
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text).match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {}
    }
    return fallback;
  }
}

function findMatchingParen(text, openIndex) {
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote) {
      if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        quote = '';
      }
      continue;
    }
    if (ch === '"' || ch === '\'') {
      quote = ch;
      continue;
    }
    if (ch === '(') {
      depth += 1;
      continue;
    }
    if (ch === ')') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitTopLevel(value = '') {
  const text = String(value || '');
  const parts = [];
  let quote = '';
  let escaped = false;
  let depthParen = 0;
  let depthBracket = 0;
  let depthBrace = 0;
  let start = 0;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quote) {
      if (ch === '\\') {
        escaped = true;
      } else if (ch === quote) {
        quote = '';
      }
      continue;
    }
    if (ch === '"' || ch === '\'') {
      quote = ch;
      continue;
    }
    if (ch === '(') depthParen += 1;
    else if (ch === ')') depthParen = Math.max(0, depthParen - 1);
    else if (ch === '[') depthBracket += 1;
    else if (ch === ']') depthBracket = Math.max(0, depthBracket - 1);
    else if (ch === '{') depthBrace += 1;
    else if (ch === '}') depthBrace = Math.max(0, depthBrace - 1);
    else if (ch === ',' && !depthParen && !depthBracket && !depthBrace) {
      parts.push(text.slice(start, i).trim());
      start = i + 1;
    }
  }

  const tail = text.slice(start).trim();
  if (tail) parts.push(tail);
  return parts.filter(Boolean);
}

function unquote(value = '') {
  const text = String(value || '').trim();
  if (text.length < 2) return text;
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith('\'') && text.endsWith('\''))) {
    const inner = text.slice(1, -1);
    return inner
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\"/g, '"')
      .replace(/\\'/g, '\'')
      .replace(/\\\\/g, '\\');
  }
  return text;
}

function parseLooseValue(value = '') {
  const text = String(value || '').trim();
  if (!text) return '';
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith('\'') && text.endsWith('\''))) {
    return unquote(text);
  }
  if (text.startsWith('[') && text.endsWith(']')) {
    const inner = text.slice(1, -1).trim();
    if (!inner) return [];
    return splitTopLevel(inner).map(parseLooseValue);
  }
  if (/^(?:true|false)$/i.test(text)) return /^true$/i.test(text);
  if (/^(?:null|none)$/i.test(text)) return null;
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return Number(text);
  return text;
}

function parseNamedArgs(argText = '') {
  const entries = splitTopLevel(argText);
  const args = {};
  entries.forEach((entry) => {
    const match = entry.match(/^([a-z_][a-z0-9_]*)\s*=\s*([\s\S]+)$/i);
    if (!match) return;
    args[String(match[1]).toLowerCase()] = parseLooseValue(match[2]);
  });
  return args;
}

function normalizeClosePreset(value) {
  const text = String(value || '').trim().toLowerCase();
  if (!text || text === 'null' || text === 'none' || text === 'open-ended' || text === 'open_ended' || text === 'openended' || text === 'open') {
    return null;
  }
  const presetMatch = text.match(/^(1h|4h|24h|3d|7d)$/i);
  if (presetMatch) return presetMatch[1].toLowerCase();
  return text;
}

function closePresetForMinutes(minutes) {
  const total = Number(minutes);
  if (!Number.isFinite(total) || total <= 0) return null;
  const preset = POLL_CLOSE_PRESET_MINUTES.find((entry) => total <= entry[1]);
  return preset ? preset[0] : '7d';
}

function durationMinutesFromMatch(match) {
  const amount = Number(String(match?.[1] || '').replace(',', '.'));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const unit = String(match?.[2] || '').toLowerCase();
  if (/^(?:m|min|mins|minute|minutes|\u043c|\u043c\u0438\u043d|\u043c\u0438\u043d\u0443\u0442)/i.test(unit)) return amount;
  if (/^(?:h|hr|hrs|hour|hours|\u0447|\u0447\u0430\u0441)/i.test(unit)) return amount * 60;
  if (/^(?:d|day|days|\u0434|\u0434\u043d|\u0434\u0435\u043d\u044c)/i.test(unit)) return amount * 24 * 60;
  return null;
}

function parseActionCall(name, args = {}) {
  const type = String(name || '').trim().toLowerCase();
  if (type === 'create_poll') {
    return {
      type,
      question: String(args.question || args.text || '').trim(),
      options: Array.isArray(args.options) ? args.options.map((item) => String(item || '').trim()).filter(Boolean) : [],
      allows_multiple: boolArg(args, 'allows_multiple', false),
      show_voters: boolArg(args, 'show_voters', true),
      close_preset: normalizeClosePreset(args.close_preset),
      ...(hasOwn(args, 'style') ? { style: normalizePollStyle(args.style) } : {}),
      pin_after_create: Boolean(args.pin_after_create),
    };
  }
  if (type === 'vote_poll') {
    return {
      type,
      target: String(args.target || 'reply_to').trim(),
      option_texts: (Array.isArray(args.option_texts) ? args.option_texts : (Array.isArray(args.options) ? args.options : []))
        .map((item) => String(item || '').trim())
        .filter(Boolean),
    };
  }
  if (type === 'react_message') {
    const reactionKey = normalizeReactionKey(args.reaction_key || args.key || args.reaction || args.intent || args.emoji || '');
    const mode = REACTION_MODES.has(String(args.mode || '').trim())
      ? String(args.mode).trim()
      : 'replace';
    return {
      type,
      target: String(args.target || 'reply_to').trim(),
      reaction_key: reactionKey || (mode === 'remove' ? null : 'custom'),
      emoji: String(args.emoji || '').trim(),
      mode,
    };
  }
  if (type === 'pin_message') {
    return {
      type,
      target: String(args.target || 'reply_to').trim(),
    };
  }
  return null;
}

function parsePollSummaryAction(text = '') {
  const source = String(text || '');
  const questionMatch = source.match(/Poll\s*#\d+\s*:\s*([\s\S]*?)(?=\s+Poll metadata:|\s+Poll options\/results:|$)/i);
  if (!questionMatch) return null;
  const question = String(questionMatch[1] || '').replace(/\s+/g, ' ').trim();
  if (!question) return null;

  const optionsBlockMatch = source.match(/Poll options\/results:\s*([\s\S]*)$/i);
  const optionsBlock = optionsBlockMatch ? String(optionsBlockMatch[1] || '') : '';
  const options = [];
  const optionPattern = /\b\d+\.\s*([\s\S]*?)(?=\s*-\s*\d+\s+votes\b)/ig;
  let optionMatch = optionPattern.exec(optionsBlock);
  while (optionMatch) {
    const option = String(optionMatch[1] || '').replace(/\s+/g, ' ').trim();
    if (option) options.push(option);
    optionMatch = optionPattern.exec(optionsBlock);
  }
  const uniqueOptions = [...new Set(options.map((item) => item.toLowerCase()))]
    .map((key) => options.find((item) => item.toLowerCase() === key))
    .filter(Boolean);
  if (uniqueOptions.length < 2) return null;

  const metadataMatch = source.match(/Poll metadata:\s*([\s\S]*?)(?=\s+Poll options\/results:|$)/i);
  const metadata = metadataMatch ? String(metadataMatch[1] || '') : '';
  const typeMatch = metadata.match(/\btype\s*=\s*([^;]+)/i);
  const visibilityMatch = metadata.match(/\bvisibility\s*=\s*([^;]+)/i);
  const deadlineMatch = metadata.match(/\bdeadline\s*=\s*([^;]+)/i);
  const styleMatch = metadata.match(/\bstyle\s*=\s*([^;]+)/i);
  const typeText = String(typeMatch?.[1] || '').trim().toLowerCase();
  const visibilityText = String(visibilityMatch?.[1] || '').trim().toLowerCase();
  const deadlineText = String(deadlineMatch?.[1] || '').trim().toLowerCase();
  const styleText = String(styleMatch?.[1] || '').trim().toLowerCase();

  return {
    type: 'create_poll',
    question,
    options: uniqueOptions,
    allows_multiple: typeText.includes('multiple'),
    show_voters: detectShowVotersFromText(visibilityText),
    close_preset: normalizeClosePreset(deadlineText),
    ...(normalizePollStyle(styleText) === 'pulse' ? {} : { style: normalizePollStyle(styleText) }),
    pin_after_create: false,
  };
}

function extractQuotedSegments(text = '') {
  const source = String(text || '');
  const patterns = [
    /\u00ab([^\u00bb]{1,500})\u00bb/g,
    /"([^"\n]{1,500})"/g,
    /\u201c([^\u201d]{1,500})\u201d/g,
  ];
  const segments = [];
  patterns.forEach((pattern) => {
    let match = pattern.exec(source);
    while (match) {
      const value = String(match[1] || '').replace(/\s+/g, ' ').trim();
      if (value) segments.push(value);
      match = pattern.exec(source);
    }
  });
  return segments;
}

function containsCreatePollIntent(text = '') {
  const source = String(text || '');
  return [
    /(?:\bcreate\b|\bmake\b|\bstart\b|\bset\s+up\b|\bpost\b|\bpublish\b).{0,40}(?:\bpoll\b|\bvot(?:e|ing)\b)/i,
    /(?:\bpoll\b|\bvot(?:e|ing)\b).{0,24}(?:\bcreate\b|\bmake\b|\bstart\b|\bset\s+up\b|\bpost\b|\bpublish\b)/i,
    /(?:\u0441\u043e\u0437\u0434\u0430(?:\u0439|\u043b)|\u0441\u0434\u0435\u043b\u0430(?:\u0439|\u043b)|\u0437\u0430\u043f\u0443\u0441\u0442\u0438(?:\u043b)?|\u0437\u0430\u043f\u0438\u043b\u0438(?:\u043b)?|\u043e\u0440\u0433\u0430\u043d\u0438\u0437(?:\u0443\u0439|\u043e\u0432\u0430\u043b)|\u043e\u0444\u043e\u0440\u043c(?:\u0438|\u0438\u043b)|\u0443\u0441\u0442\u0440\u043e(?:\u0439|\u0438\u043b)|\u043e\u043f\u0443\u0431\u043b\u0438\u043a\u0443\u0439).{0,40}(?:\u043e\u043f\u0440\u043e\u0441|\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043d)/i,
    /(?:\u043e\u043f\u0440\u043e\u0441|\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043d|\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043b\u043a).{0,24}(?:\u0441\u043e\u0437\u0434\u0430(?:\u0439|\u043b|\u0434\u0438\u043c)|\u0441\u0434\u0435\u043b\u0430(?:\u0439|\u043b|\u0435\u043c)|\u0437\u0430\u043f\u0443\u0441\u0442\u0438(?:|\u043b|\u043c)|\u0437\u0430\u043f\u0438\u043b\u0438(?:|\u043b|\u043c)|\u043e\u0440\u0433\u0430\u043d\u0438\u0437(?:\u0443\u0439|\u043e\u0432\u0430\u043b|\u0443\u0435\u043c)|\u043e\u0444\u043e\u0440\u043c(?:\u0438|\u0438\u043b|\u0438\u043c)|\u0443\u0441\u0442\u0440\u043e(?:\u0439|\u0438\u043b|\u0438\u043c))/i,
  ].some((pattern) => pattern.test(source));
}

function containsVoteIntent(text = '') {
  const source = String(text || '');
  return [
    /(?:\bvote\b|\bvoted\b|\bvote\s+for\b|\bchoose\b|\bchose\b|\bpick(?:ed)?\b|\bselect(?:ed)?\b)/i,
    /(?:\u043f\u0440\u043e\u0433\u043e\u043b\u043e\u0441|\u0433\u043e\u043b\u043e\u0441\u0443\u0439|\u0433\u043e\u043b\u043e\u0441\u0443\u044e|\u0432\u044b\u0431\u0435\u0440\u0438|\u0432\u044b\u0431\u0440\u0430\u043b|\u0432\u044b\u0431\u0438\u0440\u0430\u044e|\u0441\u0442\u0430\u0432\u044c)/i,
  ].some((pattern) => pattern.test(source));
}

function detectClosePresetFromText(text = '') {
  const source = String(text || '').toLowerCase();
  if (!source) return null;
  if (/(?:open-ended|open ended|no\s+deadline|no\s+due\s+date|no\s+closing|\u0431\u0435\u0437\s+\u0434\u0435\u0434\u043b\u0430\u0439\u043d\u0430|\u0431\u0435\u0437\s+\u0441\u0440\u043e\u043a\u0430|\u0431\u0435\u0437\s+\u0441\u0440\u043e\u043a\u043e\u0432|\u0431\u0435\u0437\s+\u0442\u0430\u0439\u043c\u0435\u0440\u0430)/i.test(source)) {
    return null;
  }
  const presetMatch = source.match(/\b(1h|4h|24h|3d|7d)\b/i);
  if (presetMatch?.[1]) return normalizeClosePreset(presetMatch[1]);
  const hasTimerCue = /(?:close|closing|deadline|timer|auto[- ]?close|\u0447\u0435\u0440\u0435\u0437|\u0442\u0430\u0439\u043c\u0435\u0440|\u0437\u0430\u043a\u0440\u044b|\u0430\u0432\u0442\u043e\u0437\u0430\u043a\u0440)/i.test(source);
  if (!hasTimerCue) return null;
  const durationMatch = source.match(/(\d+(?:[.,]\d+)?)\s*(minutes?|mins?|min|m|hours?|hrs?|hr|h|days?|d|\u043c\u0438\u043d\u0443\u0442[\u0430-\u044f\u0451]*|\u043c\u0438\u043d|\u043c|\u0447\u0430\u0441[\u0430-\u044f\u0451]*|\u0447|\u0434\u043d[\u0430-\u044f\u0451]*|\u0434\u0435\u043d\u044c|\u0434\u043d\u0435\u0439|\u0434)/i);
  return closePresetForMinutes(durationMinutesFromMatch(durationMatch));
}

function parseQuotedVoteAction(text = '') {
  const source = String(text || '');
  if (!containsVoteIntent(source) || containsCreatePollIntent(source)) return null;
  const voteCuePatterns = [
    /(?:vote\s+for|voted\s+for|choose|chose|picked?|selected?)\s+\u00ab([^\u00bb]{1,500})\u00bb/i,
    /(?:vote\s+for|voted\s+for|choose|chose|picked?|selected?)\s+"([^"\n]{1,500})"/i,
    /(?:\u043f\u0440\u043e\u0433\u043e\u043b\u043e\u0441(?:\u0443\u0439|\u043e\u0432\u0430\u043b|\u0443\u044e)?\s+\u0437\u0430|\u0433\u043e\u043b\u043e\u0441\u0443\u044e\s+\u0437\u0430|\u0432\u044b\u0431\u0440\u0430\u043b(?:\u0430)?|\u0432\u044b\u0431\u0438\u0440\u0430\u044e)\s+\u00ab([^\u00bb]{1,500})\u00bb/i,
    /(?:\u043f\u0440\u043e\u0433\u043e\u043b\u043e\u0441(?:\u0443\u0439|\u043e\u0432\u0430\u043b|\u0443\u044e)?\s+\u0437\u0430|\u0433\u043e\u043b\u043e\u0441\u0443\u044e\s+\u0437\u0430|\u0432\u044b\u0431\u0440\u0430\u043b(?:\u0430)?|\u0432\u044b\u0431\u0438\u0440\u0430\u044e)\s+"([^"\n]{1,500})"/i,
  ];
  let optionText = '';
  for (const pattern of voteCuePatterns) {
    const match = source.match(pattern);
    if (match?.[1]) {
      optionText = String(match[1]).replace(/\s+/g, ' ').trim();
      break;
    }
  }
  if (!optionText) {
    const quoted = extractQuotedSegments(source);
    if (quoted.length === 2) optionText = quoted[1];
  }
  if (!optionText) return null;
  return {
    type: 'vote_poll',
    target: 'reply_to',
    option_texts: [optionText],
  };
}

function parseQuotedPollAction(text = '') {
  const source = String(text || '');
  if (!containsCreatePollIntent(source)) return null;
  const quoted = extractQuotedSegments(source);
  if (quoted.length < 3) return null;
  const question = quoted[0];
  const options = quoted.slice(1).filter(Boolean);
  if (!question || options.length < 2) return null;
  return {
    type: 'create_poll',
    question,
    options,
    allows_multiple: detectAllowsMultipleFromText(source),
    show_voters: detectShowVotersFromText(source),
    close_preset: detectClosePresetFromText(source),
    ...stylePatchFromText(source),
    pin_after_create: detectPinAfterCreateFromText(source),
  };
}

function cleanLooseOption(value = '') {
  return stripPollOptionParameterTail(value)
    .replace(/^[\s,;:.\-\u2013\u2014/]+/, '')
    .replace(/[\s,;:.\-\u2013\u2014/]+$/, '')
    .replace(/^(?:\u0432\u0430\u0440\u0438\u0430\u043d\u0442[\u0430-\u044f\u0451]*|options?|choices?)\s*[:\-\u2013\u2014]?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitLooseOptions(value = '') {
  const source = stripPollOptionParameterTail(value).trim();
  if (!source) return [];
  let parts = [];
  if (/[;,/\n]/.test(source)) {
    parts = source.split(/\s*[,;/\n]\s*/);
  } else if (/\s+(?:\u0438\u043b\u0438|or)\s+/i.test(source)) {
    parts = source.split(/\s+(?:\u0438\u043b\u0438|or)\s+/i);
  } else if (/\s+(?:\u0438|and)\s+/i.test(source)) {
    parts = source.split(/\s+(?:\u0438|and)\s+/i);
  } else {
    parts = [source];
  }
  const unique = [];
  for (const part of parts) {
    const cleaned = cleanLooseOption(part);
    if (!cleaned) continue;
    if (unique.some((item) => item.toLowerCase() === cleaned.toLowerCase())) continue;
    unique.push(cleaned);
  }
  return unique;
}

function containsLooseVoteCue(text = '') {
  const source = String(text || '');
  return [
    /(?:\bvote\b|\bvoted\b|\bvote\s+for\b|\bchoose\b|\bchose\b|\bpick(?:ed)?\b|\bselect(?:ed)?\b|\bchoice\b)/i,
    /(?:\u043f\u0440\u043e\u0433\u043e\u043b\u043e\u0441|\u0433\u043e\u043b\u043e\u0441\u0443\u0439|\u0433\u043e\u043b\u043e\u0441\u0443\u044e|\u0432\u044b\u0431\u0435\u0440\u0438|\u0432\u044b\u0431\u0440\u0430\u043b|\u0432\u044b\u0431\u0438\u0440\u0430\u044e|\u0441\u0442\u0430\u0432\u044c|\u0436\u043c\u0438|\u043d\u0430\u0436\u043c\u0438|\u0442\u044b\u043a\u043d\u0438|\u0432\u044b\u0431\u043e\u0440)/i,
  ].some((pattern) => pattern.test(source));
}

function stemSingleVoteWord(value = '') {
  const source = String(value || '').trim().toLowerCase();
  if (!/^[\u0430-\u044f\u0451a-z0-9_-]+$/i.test(source)) return source;
  const endings = ['иями', 'ями', 'ами', 'ого', 'ему', 'ому', 'ими', 'ыми', 'его', 'ов', 'ев', 'ом', 'ем', 'ой', 'ей', 'ам', 'ям', 'ах', 'ях', 'ую', 'юю', 'ия', 'иям', 'а', 'я', 'у', 'ю', 'е', 'ы', 'и'];
  for (const ending of endings) {
    if (source.length - ending.length < 3) continue;
    if (source.endsWith(ending)) return source.slice(0, -ending.length);
  }
  return source;
}

function cleanVoteOptionCandidate(value = '') {
  let text = String(value || '')
    .replace(/^[\s"'`«»“”]+/, '')
    .replace(/[\s"'`«»“”]+$/, '')
    .replace(/^(?:\u0437\u0430|for)\s+/i, '')
    .replace(/\s+(?:\u0441\u0430\u043c|\u0441\u0430\u043c\u0430|\u0441\u0440\u0430\u0437\u0443|\u043f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430|please|now|then)$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  if (!/\s/.test(text)) text = stemSingleVoteWord(text);
  return text;
}

function extractLooseVoteOptionText(text = '') {
  const source = String(text || '');
  const patterns = [
    /(?:vote\s+for|voted\s+for|choose|chose|picked?|selected?|choice\s*[:\-–—]|my\s+choice\s*(?:is|:|[-–—])?)\s+\u00ab([^\u00bb]{1,120})\u00bb/i,
    /(?:vote\s+for|voted\s+for|choose|chose|picked?|selected?|choice\s*[:\-–—]|my\s+choice\s*(?:is|:|[-–—])?)\s+"([^"\n]{1,120})"/i,
    /(?:vote\s+for|voted\s+for|choose|chose|picked?|selected?|choice\s*[:\-–—]|my\s+choice\s*(?:is|:|[-–—])?)\s+([^\n.!?;,:"«»“”]{1,120})/i,
    /(?:\u043f\u0440\u043e\u0433\u043e\u043b\u043e\u0441(?:\u0443\u0439|\u043e\u0432\u0430\u043b|\u0443\u044e)?\s+\u0437\u0430|\u0433\u043e\u043b\u043e\u0441\u0443\u044e\s+\u0437\u0430|\u0432\u044b\u0431\u0435\u0440\u0438|\u0432\u044b\u0431\u0440\u0430\u043b(?:\u0430)?|\u0432\u044b\u0431\u0438\u0440\u0430\u044e|\u0436\u043c\u0438\s+\u0437\u0430|\u043d\u0430\u0436\u043c\u0438\s+\u0437\u0430|\u0442\u044b\u043a\u043d\u0438\s+\u0437\u0430|\u0432\u044b\u0431\u043e\u0440\s*[:\-–—]|\u043c\u043e\u0439\s+\u0432\u044b\u0431\u043e\u0440\s*(?::|[-–—])?)\s+\u00ab([^\u00bb]{1,120})\u00bb/i,
    /(?:\u043f\u0440\u043e\u0433\u043e\u043b\u043e\u0441(?:\u0443\u0439|\u043e\u0432\u0430\u043b|\u0443\u044e)?\s+\u0437\u0430|\u0433\u043e\u043b\u043e\u0441\u0443\u044e\s+\u0437\u0430|\u0432\u044b\u0431\u0435\u0440\u0438|\u0432\u044b\u0431\u0440\u0430\u043b(?:\u0430)?|\u0432\u044b\u0431\u0438\u0440\u0430\u044e|\u0436\u043c\u0438\s+\u0437\u0430|\u043d\u0430\u0436\u043c\u0438\s+\u0437\u0430|\u0442\u044b\u043a\u043d\u0438\s+\u0437\u0430|\u0432\u044b\u0431\u043e\u0440\s*[:\-–—]|\u043c\u043e\u0439\s+\u0432\u044b\u0431\u043e\u0440\s*(?::|[-–—])?)\s+"([^"\n]{1,120})"/i,
    /(?:\u043f\u0440\u043e\u0433\u043e\u043b\u043e\u0441(?:\u0443\u0439|\u043e\u0432\u0430\u043b|\u0443\u044e)?\s+\u0437\u0430|\u0433\u043e\u043b\u043e\u0441\u0443\u044e\s+\u0437\u0430|\u0432\u044b\u0431\u0435\u0440\u0438|\u0432\u044b\u0431\u0440\u0430\u043b(?:\u0430)?|\u0432\u044b\u0431\u0438\u0440\u0430\u044e|\u0436\u043c\u0438\s+\u0437\u0430|\u043d\u0430\u0436\u043c\u0438\s+\u0437\u0430|\u0442\u044b\u043a\u043d\u0438\s+\u0437\u0430|\u0432\u044b\u0431\u043e\u0440\s*[:\-–—]|\u043c\u043e\u0439\s+\u0432\u044b\u0431\u043e\u0440\s*(?::|[-–—])?)\s+([^\n.!?;,:"«»“”]{1,120})/i,
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    const candidate = cleanVoteOptionCandidate(match?.[1] || '');
    if (candidate) return candidate;
  }
  return '';
}

const DIRECT_CREATE_POLL_LEAD_PATTERNS = [
  /^(?:\u043d\u0443\s+)?(?:\u0441\u0434\u0435\u043b\u0430\u0439|\u0441\u043e\u0437\u0434\u0430\u0439|\u0437\u0430\u043f\u0438\u043b\u0438|\u0437\u0430\u043f\u0443\u0441\u0442\u0438|\u043e\u0440\u0433\u0430\u043d\u0438\u0437\u0443\u0439|\u043e\u0444\u043e\u0440\u043c\u0438|\u0443\u0441\u0442\u0440\u043e\u0439)\s+(?:(?:\u0435\u0449(?:\u0451|\u0435)\s+\u043e\u0434\u043d\u043e)\s+)?(?:\u043e\u043f\u0440\u043e\u0441[\u0430-\u044f\u0451]*|\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043d[\u0430-\u044f\u0451]*|\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043b\u043a[\u0430-\u044f\u0451]*)\s*[:\-–—]?\s*/i,
  /^(?:\u043d\u0443\s+)?(?:\u0434\u0430\u0432\u0430\u0439|\u043c\u043e\u0436\u0435\u0448\u044c|\u0441\u043c\u043e\u0436\u0435\u0448\u044c|\u043d\u0430\u0434\u043e|\u043d\u0443\u0436\u043d\u043e|\u043f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430)\s+(?:(?:\u0435\u0449(?:\u0451|\u0435)\s+\u043e\u0434\u043d\u043e)\s+)?(?:\u043e\u043f\u0440\u043e\u0441[\u0430-\u044f\u0451]*|\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043d[\u0430-\u044f\u0451]*|\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043b\u043a[\u0430-\u044f\u0451]*)\s+(?:\u0441\u0434\u0435\u043b\u0430\u0435\u043c|\u0441\u043e\u0437\u0434\u0430\u0434\u0438\u043c|\u0437\u0430\u043f\u0438\u043b\u0438\u043c|\u0437\u0430\u043f\u0443\u0441\u0442\u0438\u043c|\u043e\u0440\u0433\u0430\u043d\u0438\u0437\u0443\u0435\u043c|\u043e\u0444\u043e\u0440\u043c\u0438\u043c|\u0443\u0441\u0442\u0440\u043e\u0438\u043c)\s*[:\-–—]?\s*/i,
  /^(?:\u043d\u0443\s+)?(?:\u0434\u0430\u0432\u0430\u0439|\u043c\u043e\u0436\u0435\u0448\u044c|\u0441\u043c\u043e\u0436\u0435\u0448\u044c|\u043d\u0430\u0434\u043e|\u043d\u0443\u0436\u043d\u043e|\u043f\u043e\u0436\u0430\u043b\u0443\u0439\u0441\u0442\u0430)\s+(?:(?:\u0435\u0449(?:\u0451|\u0435)\s+\u043e\u0434\u043d\u043e)\s+)?(?:\u0441\u0434\u0435\u043b\u0430\u0435\u043c|\u0441\u043e\u0437\u0434\u0430\u0434\u0438\u043c|\u0437\u0430\u043f\u0438\u043b\u0438\u043c|\u0437\u0430\u043f\u0443\u0441\u0442\u0438\u043c|\u043e\u0440\u0433\u0430\u043d\u0438\u0437\u0443\u0435\u043c|\u043e\u0444\u043e\u0440\u043c\u0438\u043c|\u0443\u0441\u0442\u0440\u043e\u0438\u043c)\s+(?:\u043e\u043f\u0440\u043e\u0441[\u0430-\u044f\u0451]*|\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043d[\u0430-\u044f\u0451]*|\u0433\u043e\u043b\u043e\u0441\u043e\u0432\u0430\u043b\u043a[\u0430-\u044f\u0451]*)\s*[:\-–—]?\s*/i,
];

function cleanQuestionText(value = '') {
  let text = String(value || '').trim();
  for (const pattern of DIRECT_CREATE_POLL_LEAD_PATTERNS) {
    text = text.replace(pattern, '');
  }
  text = text
    .replace(/^[\s,;:.\-–—]+/, '')
    .replace(/[\s,;:.\-–—]+$/, '')
    .replace(/^(?:\u0442\u0438\u043f\u0430|about)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

function parseDirectCreatePollRequest(text = '') {
  const source = String(text || '').trim();
  if (!source || !containsCreatePollIntent(source)) return null;
  const normalized = source.replace(/\s+/g, ' ').trim();
  let optionText = '';
  let questionText = '';
  const optionsMatch = source.match(/(?:\u0432\u0430\u0440\u0438\u0430\u043d\u0442[\u0430-\u044f\u0451]*|options?|choices?)\s*[:\-\u2013\u2014]?\s*([\s\S]{3,220})/i);
  if (optionsMatch?.[1]) {
    optionText = optionsMatch[1];
    questionText = cleanQuestionText(source.slice(0, optionsMatch.index).replace(/\s+/g, ' '));
  } else {
    const questionMatch = normalized.match(/^([\s\S]*?\?)[\s:,\-\u2013\u2014]*([\s\S]{3,220})$/);
    if (questionMatch?.[1] && questionMatch?.[2]) {
      questionText = cleanQuestionText(questionMatch[1]);
      optionText = questionMatch[2];
    }
  }
  const options = splitLooseOptions(optionText);
  if (!questionText || options.length < 2) return null;
  return {
    reply_mode: 'none',
    reply_text: '',
    actions: [{
      type: 'create_poll',
      question: questionText,
      options,
      allows_multiple: detectAllowsMultipleFromText(source),
      show_voters: detectShowVotersFromText(source),
      close_preset: detectClosePresetFromText(source),
      ...stylePatchFromText(source),
      pin_after_create: detectPinAfterCreateFromText(source),
    }],
  };
}

function parseDirectVoteRequest(text = '') {
  const source = String(text || '').trim();
  if (!source || !containsLooseVoteCue(source) || containsCreatePollIntent(source)) return null;
  const optionText = extractLooseVoteOptionText(source);
  if (!optionText) return null;
  return {
    reply_mode: 'none',
    reply_text: '',
    actions: [{
      type: 'vote_poll',
      target: 'latest_open_poll',
      option_texts: [optionText],
    }],
  };
}

function containsDirectReactionIntent(text = '') {
  const source = String(text || '');
  return [
    /(?:^|[\s,.:;!?()\-])(?:please\s+)?(?:react|add\s+(?:an?\s+)?reaction|drop\s+reaction|remove\s+reaction|unreact)\b/i,
    /(?:^|[\s,.:;!?()\-])(?:please\s+)?(?:like|dislike)\s+(?:this|that|it|message|post)\b/i,
    /(?:^|[\s,.:;!?()\-])(?:\u043b\u0430\u0439\u043a\u043d\u0438|\u0434\u0438\u0437\u043b\u0430\u0439\u043a\u043d\u0438)(?=$|[\s,.:;!?()\-])/i,
    /(?:^|[\s,.:;!?()\-])(?:\u043b\u0430\u0439\u043a|\u0441\u0435\u0440\u0434\u0435\u0447|\u0441\u0435\u0440\u0434\u0446|\u043e\u0433\u043e\u043d|\u0441\u043c\u0435\u0448|\u0432\u0430\u0443|\u0433\u0440\u0443\u0441\u0442|\u043f\u0435\u0447\u0430\u043b|\u043f\u043e\u0437\u0434\u0440\u0430\u0432|\u0434\u0438\u0437\u043b\u0430\u0439\u043a|\u043a\u043b\u043e\u0443\u043d|\u0433\u043e\u0432\u043d).{0,24}(?:\u043f\u043e\u0441\u0442\u0430\u0432\u044c|\u043a\u0438\u043d\u044c|\u0434\u043e\u0431\u0430\u0432\u044c|\u0432\u043b\u0435\u043f\u0438|\u0437\u0430\u043a\u0438\u043d\u044c)/i,
    /(?:^|[\s,.:;!?()\-])(?:\u043f\u043e\u0441\u0442\u0430\u0432\u044c|\u043a\u0438\u043d\u044c|\u0434\u043e\u0431\u0430\u0432\u044c|\u0432\u043b\u0435\u043f\u0438|\u0437\u0430\u043a\u0438\u043d\u044c)(?=$|[\s,.:;!?()\-]).{0,32}(?:\u0440\u0435\u0430\u043a\u0446|\u043b\u0430\u0439\u043a|\u0441\u0435\u0440\u0434\u0435\u0447|\u0441\u0435\u0440\u0434\u0446|\u043e\u0433\u043e\u043d|\u0441\u043c\u0435\u0448|\u0432\u0430\u0443|\u0433\u0440\u0443\u0441\u0442|\u043f\u0435\u0447\u0430\u043b|\u043f\u043e\u0437\u0434\u0440\u0430\u0432|\u0434\u0438\u0437\u043b\u0430\u0439\u043a|\u043a\u043b\u043e\u0443\u043d|\u0433\u043e\u0432\u043d|\u044d\u043c\u043e\u0434\u0437\u0438|\u044d\u043c\u043e\u0434\u0436\u0438|emoji)/i,
    /(?:^|[\s,.:;!?()\-])(?:\u0441\u043d\u0438\u043c\u0438|\u0443\u0431\u0435\u0440\u0438|\u0443\u0434\u0430\u043b\u0438|\u0443\u0431\u0440\u0430\u0442\u044c|\u0441\u043d\u044f\u0442\u044c)(?=$|[\s,.:;!?()\-]).{0,24}(?:\u0440\u0435\u0430\u043a\u0446|\u043b\u0430\u0439\u043a|\u044d\u043c\u043e\u0434\u0437\u0438|\u044d\u043c\u043e\u0434\u0436\u0438|emoji)/i,
    /(?:^|[\s,.:;!?()\-])(?:\u043e\u0442\u0440\u0435\u0430\u0433\u0438\u0440\u0443\u0439|\u0440\u0435\u0430\u043a\u0442\u043d\u0438)(?=$|[\s,.:;!?()\-]).{0,20}(?:\u0440\u0435\u0430\u043a\u0446|\u043b\u0430\u0439\u043a|\u0441\u0435\u0440\u0434\u0435\u0447|\u0441\u0435\u0440\u0434\u0446|\u043e\u0433\u043e\u043d|\u0441\u043c\u0435\u0448|\u0432\u0430\u0443|\u0433\u0440\u0443\u0441\u0442|\u043f\u0435\u0447\u0430\u043b|\u043f\u043e\u0437\u0434\u0440\u0430\u0432|\u0434\u0438\u0437\u043b\u0430\u0439\u043a|\u043a\u043b\u043e\u0443\u043d|\u0433\u043e\u0432\u043d|\u044d\u043c\u043e\u0434\u0437\u0438|\u044d\u043c\u043e\u0434\u0436\u0438|emoji)/i,
    /(?:^|[\s,.:;!?()\-])(?:\u043e\u0442\u0440\u0435\u0430\u0433\u0438\u0440\u0443\u0439|\u0440\u0435\u0430\u043a\u0442\u043d\u0438)(?=$|[\s,.:;!?()\-]).{0,20}(?:\u0441\u0430\u043c|\u0441\u0430\u043c\u0430|\u0441\u0430\u043c\u043e\u0441\u0442\u043e\u044f\u0442\u0435\u043b\u044c\u043d\u043e|as\s+you\s+like|yourself|however\s+you\s+want)/i,
  ].some((pattern) => pattern.test(source));
}

function detectReactionMode(text = '') {
  const source = String(text || '');
  return [
    /(?:^|[\s,.:;!?()\-])(?:remove\s+reaction|unreact|clear\s+reaction|take\s+off\s+reaction)\b/i,
    /(?:^|[\s,.:;!?()\-])(?:\u0441\u043d\u0438\u043c\u0438|\u0443\u0431\u0435\u0440\u0438|\u0443\u0434\u0430\u043b\u0438|\u0443\u0431\u0440\u0430\u0442\u044c|\u0441\u043d\u044f\u0442\u044c)(?=$|[\s,.:;!?()\-]).{0,24}(?:\u0440\u0435\u0430\u043a\u0446|\u043b\u0430\u0439\u043a|\u044d\u043c\u043e\u0434\u0437\u0438|\u044d\u043c\u043e\u0434\u0436\u0438|emoji)/i,
  ].some((pattern) => pattern.test(source))
    ? 'remove'
    : 'replace';
}

function textMentionsSelfTarget(text = '') {
  const source = String(text || '');
  return /(?:^|[\s,.:;!?()\-])(?:себя|себе|сво[её]\s+сообщени[ея]|свой\s+пост|yourself|your\s+own\s+(?:message|post)|your\s+post)(?=$|[\s,.:;!?()\-])/i.test(source);
}

function detectReactionTarget(text = '') {
  const source = String(text || '');
  if (textMentionsSelfTarget(source)) return 'self_latest_message';
  return /(?:^|[\s,.:;!?()\-])(?:\u0441\u044e\u0434\u0430|\u043f\u0440\u044f\u043c\u043e\s+\u0441\u044e\u0434\u0430|right\s+here|here\s+itself)(?=$|[\s,.:;!?()\-])/i.test(source)
    ? 'source_message'
    : 'reply_to';
}

function detectReactionKeyFromText(text = '') {
  const source = String(text || '');
  const matchers = [
    ['like', /(?:^|[\s,.:;!?()\-])(?:\u043b\u0430\u0439\u043a|\u043b\u0430\u0439\u043a\u043d\u0438|thumbs?\s*up|like)/i],
    ['heart', /(?:\u0441\u0435\u0440\u0434\u0435\u0447|\u0441\u0435\u0440\u0434\u0446|love|heart)/i],
    ['fire', /(?:\u043e\u0433\u043e\u043d|fire|hot)/i],
    ['laugh', /(?:\u0441\u043c\u0435\u0448|laugh|funny|lol|haha)/i],
    ['wow', /(?:\u0432\u0430\u0443|wow|surpris|\u0443\u0434\u0438\u0432)/i],
    ['sad', /(?:\u0433\u0440\u0443\u0441\u0442|\u043f\u0435\u0447\u0430\u043b|sad|support|\u0441\u043e\u0447\u0443\u0432)/i],
    ['celebrate', /(?:\u043f\u043e\u0437\u0434\u0440\u0430\u0432|celebrat|congrats|party)/i],
    ['dislike', /(?:\u0434\u0438\u0437\u043b\u0430\u0439\u043a|thumbs?\s*down|dislike|\u043d\u0435\s+\u043d\u0440\u0430\u0432)/i],
    ['clown', /(?:\u043a\u043b\u043e\u0443\u043d|clown|mock|tease|\u043f\u043e\u0434\u043a\u043e\u043b)/i],
    ['poop', /(?:\u0433\u043e\u0432\u043d|poop|shit|trash|\u0442\u0440\u044d\u0448)/i],
  ];
  for (const [reactionKey, pattern] of matchers) {
    if (pattern.test(source)) return reactionKey;
  }
  return '';
}

function parseDirectReactionRequest(text = '') {
  const source = String(text || '').trim();
  if (!source || !containsDirectReactionIntent(source) || containsCreatePollIntent(source)) return null;
  const mode = detectReactionMode(source);
  const target = detectReactionTarget(source);
  const reactionKey = detectReactionKeyFromText(source);
  if (!reactionKey && mode !== 'remove') return null;
  return {
    reply_mode: 'none',
    reply_text: '',
    actions: [{
      type: 'react_message',
      target,
      reaction_key: reactionKey || null,
      emoji: '',
      mode,
    }],
  };
}

function containsDirectPinIntent(text = '') {
  const source = String(text || '');
  return [
    /(?:^|[\s,.:;!?()\-])(?:please\s+)?(?:pin|unpin)\b/i,
    /(?:^|[\s,.:;!?()\-])(?:\u0437\u0430\u043a\u0440\u0435\u043f\u0438|\u0437\u0430\u043f\u0438\u043d\u044c|\u043f\u0440\u0438\u043a\u0440\u0435\u043f\u0438)(?=$|[\s,.:;!?()\-])/i,
  ].some((pattern) => pattern.test(source));
}

function detectPinTarget(text = '') {
  const source = String(text || '');
  if (textMentionsSelfTarget(source)) return 'self_latest_message';
  return 'reply_to';
}

function parseDirectPinRequest(text = '') {
  const source = String(text || '').trim();
  if (!source || !containsDirectPinIntent(source) || containsCreatePollIntent(source)) return null;
  return {
    reply_mode: 'none',
    reply_text: '',
    actions: [{
      type: 'pin_message',
      target: detectPinTarget(source),
    }],
  };
}

function parseQuotedQuestionWithTrailingOptions(text = '') {
  const source = String(text || '');
  if (!containsCreatePollIntent(source)) return null;
  const match = source.match(/(?:\u00ab([^\u00bb]{1,500})\u00bb|"([^"\n]{1,500})"|\u201c([^\u201d]{1,500})\u201d)([\s\S]{0,240})/);
  if (!match) return null;
  const question = String(match[1] || match[2] || match[3] || '').replace(/\s+/g, ' ').trim();
  if (!question) return null;
  const tail = String(match[4] || '');
  let optionText = '';
  const labeledMatch = tail.match(/(?:\u0432\u0430\u0440\u0438\u0430\u043d\u0442[\u0430-\u044f\u0451]*|options?|choices?)\s*[:\-\u2013\u2014]?\s*([^\n.!?]{3,180})/i);
  if (labeledMatch?.[1]) {
    optionText = labeledMatch[1];
  } else {
    const dashMatch = tail.match(/[\-\u2013\u2014]\s*([^\n.!?]{3,180})/);
    if (dashMatch?.[1]) optionText = dashMatch[1];
  }
  const options = splitLooseOptions(optionText);
  if (options.length < 2) return null;
  return {
    type: 'create_poll',
    question,
    options,
    allows_multiple: detectAllowsMultipleFromText(source),
    show_voters: detectShowVotersFromText(source),
    close_preset: detectClosePresetFromText(source),
    ...stylePatchFromText(source),
    pin_after_create: detectPinAfterCreateFromText(source),
  };
}

function extractActionCalls(text = '') {
  const source = String(text || '');
  const calls = [];
  const pattern = /\b(create_poll|vote_poll|react_message|pin_message)\s*\(/ig;
  let match = pattern.exec(source);
  while (match) {
    const name = String(match[1] || '').toLowerCase();
    if (!ACTION_NAMES.has(name)) {
      match = pattern.exec(source);
      continue;
    }
    const openIndex = source.indexOf('(', match.index);
    const closeIndex = findMatchingParen(source, openIndex);
    if (openIndex === -1 || closeIndex === -1) break;
    calls.push({
      name,
      args: parseNamedArgs(source.slice(openIndex + 1, closeIndex)),
    });
    pattern.lastIndex = closeIndex + 1;
    match = pattern.exec(source);
  }
  return calls;
}

function parseLooseActionPlanText(text = '') {
  const actions = extractActionCalls(text)
    .map((item) => parseActionCall(item.name, item.args))
    .filter(Boolean);
  if (!actions.length) {
    const quotedVoteAction = parseQuotedVoteAction(text);
    if (quotedVoteAction) actions.push(quotedVoteAction);
  }
  if (!actions.length) {
    const pollSummaryAction = parsePollSummaryAction(text);
    if (pollSummaryAction) actions.push(pollSummaryAction);
  }
  if (!actions.length) {
    const quotedPollAction = parseQuotedPollAction(text);
    if (quotedPollAction) actions.push(quotedPollAction);
  }
  if (!actions.length) {
    const trailingPollAction = parseQuotedQuestionWithTrailingOptions(text);
    if (trailingPollAction) actions.push(trailingPollAction);
  }
  if (!actions.length && containsLooseVoteCue(text) && !containsCreatePollIntent(text)) {
    const directVotePlan = parseDirectVoteRequest(text);
    if (directVotePlan?.actions?.length) actions.push(...directVotePlan.actions);
  }
  if (!actions.length && containsDirectReactionIntent(text) && !containsCreatePollIntent(text)) {
    const directReactionPlan = parseDirectReactionRequest(text);
    if (directReactionPlan?.actions?.length) actions.push(...directReactionPlan.actions);
  }
  if (!actions.length && containsDirectPinIntent(text) && !containsCreatePollIntent(text)) {
    const directPinPlan = parseDirectPinRequest(text);
    if (directPinPlan?.actions?.length) actions.push(...directPinPlan.actions);
  }
  if (!actions.length) return null;
  return {
    reply_mode: 'none',
    reply_text: '',
    actions,
  };
}

module.exports = {
  tryParseJsonObject,
  parseLooseActionPlanText,
  parseDirectCreatePollRequest,
  parseDirectVoteRequest,
  parseDirectReactionRequest,
  parseDirectPinRequest,
};
