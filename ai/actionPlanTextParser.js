const ACTION_NAMES = new Set(['create_poll', 'vote_poll', 'react_message', 'pin_message']);

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
  return text;
}

function parseActionCall(name, args = {}) {
  const type = String(name || '').trim().toLowerCase();
  if (type === 'create_poll') {
    return {
      type,
      question: String(args.question || args.text || '').trim(),
      options: Array.isArray(args.options) ? args.options.map((item) => String(item || '').trim()).filter(Boolean) : [],
      allows_multiple: Boolean(args.allows_multiple),
      show_voters: Boolean(args.show_voters),
      close_preset: normalizeClosePreset(args.close_preset),
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
    return {
      type,
      target: String(args.target || 'reply_to').trim(),
      emoji: String(args.emoji || '').trim(),
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
  const typeText = String(typeMatch?.[1] || '').trim().toLowerCase();
  const visibilityText = String(visibilityMatch?.[1] || '').trim().toLowerCase();
  const deadlineText = String(deadlineMatch?.[1] || '').trim().toLowerCase();

  return {
    type: 'create_poll',
    question,
    options: uniqueOptions,
    allows_multiple: typeText.includes('multiple'),
    show_voters: visibilityText.includes('public'),
    close_preset: normalizeClosePreset(deadlineText),
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
  if (/(?:open-ended|open ended|без\s+дедлайна|без\s+срока|без\s+сроков|no\s+deadline|no\s+due\s+date|no\s+closing)/i.test(source)) {
    return null;
  }
  const presetMatch = source.match(/\b(1h|4h|24h|3d|7d)\b/i);
  return normalizeClosePreset(presetMatch?.[1] || null);
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
    allows_multiple: /(?:multiple|multi[- ]?choice|нескольк|мульти)/i.test(source),
    show_voters: /(?:public\s+voters|public\s+votes|visible\s+voters|публичн(?:ые|ых)?\s+голос|видн(?:ы|ые)\s+голос)/i.test(source),
    close_preset: detectClosePresetFromText(source),
    pin_after_create: /(?:pin|закреп)/i.test(source),
  };
}

function cleanLooseOption(value = '') {
  return String(value || '')
    .replace(/^[\s,;:.\-–—]+/, '')
    .replace(/[\s,;:.\-–—]+$/, '')
    .replace(/^(?:варианты?|options?|choices?)\s*[:\-–—]?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitLooseOptions(value = '') {
  const source = cleanLooseOption(value);
  if (!source) return [];
  let parts = [];
  if (/[;,]/.test(source)) {
    parts = source.split(/\s*[,;]\s*/);
  } else if (/\s+(?:или|or)\s+/i.test(source)) {
    parts = source.split(/\s+(?:или|or)\s+/i);
  } else if (/\s+(?:и|and)\s+/i.test(source)) {
    parts = source.split(/\s+(?:и|and)\s+/i);
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
  const optionsMatch = normalized.match(/(?:\u0432\u0430\u0440\u0438\u0430\u043d\u0442[\u0430-\u044f\u0451]*|options?|choices?)\s*[:\-–—]?\s*([^\n]{3,220})/i);
  if (!optionsMatch?.[1]) return null;
  const optionText = String(optionsMatch[1] || '');
  const questionText = cleanQuestionText(normalized.slice(0, optionsMatch.index));
  const options = splitLooseOptions(optionText);
  if (!questionText || options.length < 2) return null;
  return {
    reply_mode: 'none',
    reply_text: '',
    actions: [{
      type: 'create_poll',
      question: questionText,
      options,
      allows_multiple: /(?:multiple|multi[- ]?choice|\u043d\u0435\u0441\u043a\u043e\u043b\u044c\u043a|\u043c\u0443\u043b\u044c\u0442\u0438)/i.test(source),
      show_voters: /(?:public\s+voters|public\s+votes|visible\s+voters|\u043f\u0443\u0431\u043b\u0438\u0447\u043d(?:\u044b\u0435|\u044b\u0445)?\s+\u0433\u043e\u043b\u043e\u0441|\u0432\u0438\u0434\u043d(?:\u044b|\u044b\u0435)\s+\u0433\u043e\u043b\u043e\u0441)/i.test(source),
      close_preset: detectClosePresetFromText(source),
      pin_after_create: /(?:\bpin\b|\u0437\u0430\u043a\u0440\u0435\u043f)/i.test(source),
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

function parseQuotedQuestionWithTrailingOptions(text = '') {
  const source = String(text || '');
  if (!containsCreatePollIntent(source)) return null;
  const match = source.match(/(?:\u00ab([^\u00bb]{1,500})\u00bb|"([^"\n]{1,500})"|\u201c([^\u201d]{1,500})\u201d)([\s\S]{0,240})/);
  if (!match) return null;
  const question = String(match[1] || match[2] || match[3] || '').replace(/\s+/g, ' ').trim();
  if (!question) return null;
  const tail = String(match[4] || '');
  let optionText = '';
  const labeledMatch = tail.match(/(?:варианты?|options?|choices?)\s*[:\-–—]?\s*([^\n.!?]{3,180})/i);
  if (labeledMatch?.[1]) {
    optionText = labeledMatch[1];
  } else {
    const dashMatch = tail.match(/[\-–—]\s*([^\n.!?]{3,180})/);
    if (dashMatch?.[1]) optionText = dashMatch[1];
  }
  const options = splitLooseOptions(optionText);
  if (options.length < 2) return null;
  return {
    type: 'create_poll',
    question,
    options,
    allows_multiple: /(?:multiple|multi[- ]?choice|РЅРµСЃРєРѕР»СЊРє|РјСѓР»СЊС‚Рё)/i.test(source),
    show_voters: /(?:public\s+voters|public\s+votes|visible\s+voters|РїСѓР±Р»РёС‡РЅ(?:С‹Рµ|С‹С…)?\s+РіРѕР»РѕСЃ|РІРёРґРЅ(?:С‹|С‹Рµ)\s+РіРѕР»РѕСЃ)/i.test(source),
    close_preset: detectClosePresetFromText(source),
    pin_after_create: /(?:pin|Р·Р°РєСЂРµРї)/i.test(source),
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
};
