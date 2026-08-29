const { DateTime } = require('luxon');
const {
  cleanInitiativeRuleName,
  buildInitiativeRuleName,
} = require('./initiativeRuleName');
const {
  jsonContentByteLength,
  normalizeProviderText,
  SYNTHETIC_INSTRUCTION_MAX_BYTES,
  takeJsonStart,
} = require('./providerInput');

let XMLParser = null;
try {
  ({ XMLParser } = require('fast-xml-parser'));
} catch {
  XMLParser = null;
}

const DEFAULT_TIMEZONE = 'UTC';
const DEFAULT_FIXED_TIME = '09:00';
const DEFAULT_WINDOW_START = '09:00';
const DEFAULT_WINDOW_END = '18:00';
const DEFAULT_IDLE_MINUTES = 1440;
const DEFAULT_GAP_MINUTES = 1440;
const DEFAULT_NEWS_MAX_AGE_HOURS = 24;
const DEFAULT_NEWS_ITEM_COUNT = 1;
const MAX_NEWS_ITEM_COUNT = 10;
const NEWS_INSTRUCTION_MAX_BYTES = SYNTHETIC_INSTRUCTION_MAX_BYTES;
const NEWS_ADMIN_PROMPT_MAX_BYTES = 1_500;
const NEWS_TITLE_MAX_BYTES = 280;
const NEWS_URL_MAX_BYTES = 220;
const NEWS_PUBLISHED_MAX_BYTES = 80;
const NEWS_SUMMARY_MAX_BYTES = 500;
const NEWS_RECENT_CONTEXT_MAX_CHARS = 3_000;
const INITIATIVE_RECENT_CONTEXT_MAX_CHARS = 6_000;
const DEFAULT_NEWS_CACHE_TTL_MINUTES = 30;
const PROVIDER_MAX_ATTEMPTS = 3;
const PROVIDER_RETRY_DELAYS_MS = [5_000, 30_000];
const MAX_RETRY_DELAY_MS = 60_000;
const SCHEDULE_TYPES = new Set(['fixed', 'random_window']);
const PROMPT_MODES = new Set(['context_question', 'news_hook', 'date_holiday', 'idle_ping', 'custom']);
const REMINDER_STATUSES = new Set(['pending', 'processing', 'sent', 'canceled', 'error']);
const NEWS_SOURCE_TYPES = new Set(['rss']);

function initiativeFailureText(reason) {
  const detail = {
    missed_schedule: 'сервер не успел обработать время запуска',
    no_human_messages: 'в чате ещё нет сообщений от пользователей',
    same_context_limit: 'для текущего контекста уже достигнут лимит инициатив',
    not_idle: 'в чате ещё не истёк заданный период без активности',
    min_gap: 'ещё не истёк минимальный интервал между инициативами',
    bot_unavailable: 'бот сейчас недоступен в этом чате',
    news_source_unavailable: 'источник новостей не найден или отключён',
    no_news_source: 'не выбран источник новостей',
    news_source_disabled: 'источник новостей отключён',
    no_recent_news: 'в источнике нет свежих новостей за заданный период',
    no_new_news: 'в источнике нет новых неиспользованных новостей',
    news_source_failed: 'источник новостей временно недоступен',
    bot_no_message: 'AI-провайдер не вернул текст сообщения',
    provider_failed: 'не удалось получить ответ от AI-провайдера',
  }[reason] || 'не удалось выполнить правило';
  return `Инициатива не отправлена: ${detail}.`;
}

function boolValue(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (value === 0 || value === 1) return !!value;
  if (value === '0' || value === '1' || value === 'true' || value === 'false') {
    return value === '1' || value === 'true';
  }
  return fallback;
}

function intValue(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function cleanText(value, limit = 4000) {
  return String(value || '').trim().slice(0, limit);
}

function errorStatus(error) {
  const value = Number(error?.status ?? error?.statusCode ?? error?.response?.status ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function errorCode(error) {
  return cleanText(error?.code || error?.cause?.code || '', 120).toUpperCase();
}

function errorDetail(error, fallback = 'Unexpected initiative error') {
  const detail = cleanText(error?.message || error?.cause?.message || fallback, 1000)
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/giu, 'Bearer [redacted]')
    .replace(/\bsk-[A-Za-z0-9_-]{8,}/giu, '[redacted-key]')
    .replace(/((?:api[_ -]?key|token)\s*[:=]\s*)[^\s,;]+/giu, '$1[redacted]')
    .replace(/[\r\n\t]+/g, ' ');
  const requestBytes = Number(error?.requestBytes || 0);
  const originalBytes = Number(error?.requestOriginalBytes || 0);
  const requestMeta = requestBytes > 0
    ? ` [request_bytes=${Math.round(requestBytes)}${originalBytes > requestBytes ? `, original_bytes=${Math.round(originalBytes)}, trimmed=true` : ''}]`
    : '';
  return `${detail}${requestMeta}`.slice(0, 500);
}

function retryAfterMs(error) {
  const headers = error?.headers || error?.response?.headers;
  const raw = typeof headers?.get === 'function'
    ? headers.get('retry-after')
    : (headers?.['retry-after'] ?? headers?.['Retry-After']);
  if (raw == null || raw === '') return 0;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1000));
  const dateMs = Date.parse(String(raw));
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : 0;
}

function isRetryableInitiativeError(error) {
  if (typeof error?.retryable === 'boolean') return error.retryable;
  const status = errorStatus(error);
  if ([408, 409, 425, 429].includes(status) || status >= 500) return true;
  if (status >= 400) return false;
  const code = errorCode(error);
  if (['BOT_NO_MESSAGE', 'EMPTY_PROVIDER_RESPONSE', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ENOTFOUND', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_SOCKET'].includes(code)) return true;
  return /(?:timed?\s*out|timeout|network|socket|connection reset|fetch failed|temporarily unavailable)/iu.test(errorDetail(error, ''));
}

function initiativeErrorReason(error) {
  const code = errorCode(error);
  if (code === 'PROVIDER_NOT_CONFIGURED') return 'provider_not_configured';
  if (code === 'EMPTY_PROVIDER_RESPONSE' || code === 'BOT_NO_MESSAGE') return 'empty_provider_response';
  if (code === 'MESSAGE_PERSIST_FAILED' || error?.stage === 'persist') return 'persist_failed';
  if (error?.stage === 'publish') return 'publish_failed';
  if (error?.stage === 'context') return 'context_failed';
  return 'provider_failed';
}

function cleanTimezone(value, fallback = DEFAULT_TIMEZONE) {
  const zone = String(value || '').trim() || fallback;
  return DateTime.now().setZone(zone).isValid ? zone : fallback;
}

function cleanCountryCode(value) {
  const text = String(value || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(text) ? text : '';
}

function normalizePromptMode(value) {
  const mode = String(value || '').trim();
  if (mode === 'date_holiday') return 'news_hook';
  return PROMPT_MODES.has(mode) ? mode : 'context_question';
}

function cleanUrl(value) {
  const text = cleanText(value, 2000);
  try {
    const url = new URL(text);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.toString();
  } catch {
    return '';
  }
}

function cleanNewsSourceType(value) {
  const type = String(value || '').trim().toLowerCase();
  return NEWS_SOURCE_TYPES.has(type) ? type : 'rss';
}

function normalizeNewsSourceInput(input = {}, current = {}) {
  return {
    id: Number(current.id || input.id || 0) || null,
    name: cleanText(input.name ?? current.name, 120) || 'News source',
    type: cleanNewsSourceType(input.type ?? current.type),
    url: cleanUrl(input.url ?? current.url),
    enabled: boolValue(input.enabled ?? current.enabled, true),
    cache_ttl_minutes: intValue(input.cache_ttl_minutes ?? current.cache_ttl_minutes, DEFAULT_NEWS_CACHE_TTL_MINUTES, 1, 24 * 60),
  };
}

function normalizeTime(value, fallback = DEFAULT_FIXED_TIME) {
  const text = String(value || '').trim().replace('.', ':').replace('-', ':');
  const match = text.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) return fallback;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function timeParts(value) {
  const text = normalizeTime(value);
  const [hour, minute] = text.split(':').map(Number);
  return { hour, minute };
}

function isoUtc(dt) {
  if (!dt?.isValid) return null;
  return dt.toUTC().toISO({ suppressMilliseconds: true });
}

function dbDateToUtc(value) {
  if (!value) return null;
  const text = String(value).trim();
  const dt = /Z$|[+-]\d\d:\d\d$/.test(text)
    ? DateTime.fromISO(text, { setZone: true })
    : DateTime.fromSQL(text, { zone: 'UTC' });
  return dt.isValid ? dt.toUTC() : null;
}

function minutesBetween(a, b) {
  if (!a?.isValid || !b?.isValid) return Infinity;
  return Math.floor(Math.abs(a.diff(b, 'minutes').minutes));
}

function minGapElapsed(now, lastRunAt, minGapMinutes) {
  if (!now?.isValid || !lastRunAt?.isValid) return true;
  const minGap = intValue(minGapMinutes, DEFAULT_GAP_MINUTES, 1, 60 * 24 * 30);
  const elapsed = Math.abs(now.diff(lastRunAt, 'minutes').minutes);
  return Math.ceil(elapsed) >= minGap;
}

function normalizeRuleInput(input = {}, current = {}, now = DateTime.utc()) {
  const timezone = cleanTimezone(input.timezone ?? current.timezone ?? DEFAULT_TIMEZONE);
  const rawScheduleType = input.schedule_type ?? current.schedule_type ?? '';
  const scheduleType = SCHEDULE_TYPES.has(String(rawScheduleType).trim())
    ? String(rawScheduleType).trim()
    : 'fixed';
  const rawPromptMode = input.prompt_mode ?? current.prompt_mode ?? '';
  const rule = {
    id: Number(current.id || input.id || 0) || null,
    name: cleanInitiativeRuleName(input.name ?? current.name),
    chat_id: Number(input.chat_id ?? current.chat_id ?? 0),
    bot_id: Number(input.bot_id ?? current.bot_id ?? 0),
    enabled: boolValue(input.enabled ?? current.enabled, false),
    schedule_type: scheduleType,
    fixed_time: normalizeTime(input.fixed_time ?? current.fixed_time, DEFAULT_FIXED_TIME),
    window_start: normalizeTime(input.window_start ?? current.window_start, DEFAULT_WINDOW_START),
    window_end: normalizeTime(input.window_end ?? current.window_end, DEFAULT_WINDOW_END),
    timezone,
    idle_threshold_minutes: intValue(input.idle_threshold_minutes ?? current.idle_threshold_minutes, DEFAULT_IDLE_MINUTES, 0, 60 * 24 * 30),
    min_gap_minutes: intValue(input.min_gap_minutes ?? current.min_gap_minutes, DEFAULT_GAP_MINUTES, 1, 60 * 24 * 30),
    same_context_limit_enabled: boolValue(input.same_context_limit_enabled ?? current.same_context_limit_enabled, true),
    same_context_max_runs: intValue(input.same_context_max_runs ?? current.same_context_max_runs, 1, 1, 20),
    same_context_run_count: intValue(current.same_context_run_count, 0, 0, 20),
    prompt_mode: normalizePromptMode(rawPromptMode),
    custom_prompt: cleanText(input.custom_prompt ?? current.custom_prompt, 8000),
    holiday_country: cleanCountryCode(input.holiday_country ?? current.holiday_country),
    news_source_id: Number(input.news_source_id ?? current.news_source_id ?? 0) || null,
    news_max_age_hours: intValue(input.news_max_age_hours ?? current.news_max_age_hours, DEFAULT_NEWS_MAX_AGE_HOURS, 1, 24 * 14),
    news_item_count: intValue(input.news_item_count ?? current.news_item_count, DEFAULT_NEWS_ITEM_COUNT, 1, MAX_NEWS_ITEM_COUNT),
    news_use_chat_context: boolValue(input.news_use_chat_context ?? current.news_use_chat_context, true),
    news_prompt: cleanText(input.news_prompt ?? current.news_prompt, 8000),
    last_run_at: current.last_run_at || null,
    last_message_id: Number(current.last_message_id || 0) || null,
  };
  rule.next_run_at = input.next_run_at || current.next_run_at || computeNextRunAt(rule, now);
  return rule;
}

function scheduleLocalDate(rule, fromUtc = DateTime.utc()) {
  const zone = cleanTimezone(rule.timezone);
  return fromUtc.setZone(zone).startOf('day');
}

function randomWindowDates(rule, dayLocal) {
  const start = timeParts(rule.window_start || DEFAULT_WINDOW_START);
  const end = timeParts(rule.window_end || DEFAULT_WINDOW_END);
  const day = dayLocal.startOf('day');
  let startDt = day.set(start);
  let endDt = day.set(end);
  if (endDt <= startDt) endDt = endDt.plus({ days: 1 });
  return { startDt, endDt };
}

function randomWindowAround(rule, baseLocal) {
  const todayWindow = randomWindowDates(rule, baseLocal);
  const todayStart = timeParts(rule.window_start || DEFAULT_WINDOW_START);
  const todayEnd = timeParts(rule.window_end || DEFAULT_WINDOW_END);
  const day = baseLocal.startOf('day');
  const isOvernight = day.set(todayEnd) <= day.set(todayStart);
  if (isOvernight && baseLocal < todayWindow.startDt) {
    const previousWindow = randomWindowDates(rule, day.minus({ days: 1 }));
    if (baseLocal < previousWindow.endDt) return previousWindow;
  }
  return todayWindow;
}

function nextRandomWindowAfter(rule, windowDates) {
  return randomWindowDates(rule, windowDates.startDt.plus({ days: 1 }));
}

function computeNextRunAt(rule, fromUtc = DateTime.utc(), rng = Math.random, options = {}) {
  const zone = cleanTimezone(rule.timezone);
  let base = fromUtc.setZone(zone);
  if (!base.isValid) base = fromUtc.setZone(DEFAULT_TIMEZONE);

  if (String(rule.schedule_type || 'fixed') === 'random_window') {
    let { startDt, endDt } = randomWindowAround(rule, base);
    if (options.afterCurrentWindow && base >= startDt) {
      ({ startDt, endDt } = nextRandomWindowAfter(rule, { startDt, endDt }));
    } else if (base >= endDt) {
      ({ startDt, endDt } = nextRandomWindowAfter(rule, { startDt, endDt }));
    }
    const earliest = base < startDt || options.afterCurrentWindow ? startDt : base.plus({ minutes: 1 });
    const spanMs = Math.max(60_000, endDt.toMillis() - earliest.toMillis());
    return isoUtc(earliest.plus({ milliseconds: Math.floor(rng() * spanMs) }));
  }

  const fixed = timeParts(rule.fixed_time || DEFAULT_FIXED_TIME);
  let candidate = base.startOf('day').set(fixed);
  if (candidate <= base) candidate = candidate.plus({ days: 1 });
  return isoUtc(candidate);
}

function computeNextRunAfterDueAttempt(rule, fromUtc = DateTime.utc(), rng = Math.random) {
  return computeNextRunAt(rule, fromUtc, rng, { afterCurrentWindow: true });
}

function isMissedRuleRun(rule, nowUtc = DateTime.utc(), graceMinutes = 5) {
  const dueAt = dbDateToUtc(rule?.next_run_at);
  if (!dueAt?.isValid) return false;
  const now = nowUtc?.isValid ? nowUtc.toUTC() : DateTime.utc();
  const grace = Math.max(1, Number(graceMinutes) || 5);
  return dueAt < now.minus({ minutes: grace });
}

function looksLikeRecurrence(text) {
  return /(?:кажд(?:ый|ую|ое|ые)|ежедневно|по\s+(?:понедельникам|вторникам|средам|четвергам|пятницам|субботам|воскресеньям)|\bevery\b|\bdaily\b|\bweekly\b)/iu.test(String(text || ''));
}

function looksLikeReminderRequest(text) {
  return /(?:напомни(?:ть)?|напоминай|\bremind(?:\s+me)?\b)/iu.test(String(text || ''));
}

function parseDateTimeRule(text, timezone = DEFAULT_TIMEZONE, now = DateTime.utc()) {
  const source = String(text || '').trim();
  if (!looksLikeReminderRequest(source)) return { isReminder: false };
  if (looksLikeRecurrence(source)) {
    return {
      isReminder: true,
      unsupported: true,
      reason: 'recurring_reminders_not_supported',
    };
  }

  const zone = cleanTimezone(timezone);
  const localNow = now.setZone(zone);
  const lower = source.toLowerCase();
  let date = null;
  let time = null;

  const relativeMatch = lower.match(/(?:через|in)\s+(\d{1,4})\s*(минут(?:у|ы)?|мин|minutes?|mins?|час(?:а|ов)?|hours?|hrs?|дн(?:я|ей)?|days?)/iu);
  if (relativeMatch) {
    const amount = Number(relativeMatch[1]);
    const unitText = relativeMatch[2].toLowerCase();
    const unit = /мин|min/.test(unitText) ? 'minutes' : (/час|hour|hr/.test(unitText) ? 'hours' : 'days');
    const due = localNow.plus({ [unit]: amount });
    return {
      isReminder: true,
      dueAtUtc: isoUtc(due),
      reminderText: extractReminderText(source, relativeMatch[0]),
      timezone: zone,
    };
  }

  if (/послезавтра|\bday\s+after\s+tomorrow\b/iu.test(lower)) {
    date = localNow.plus({ days: 2 }).startOf('day');
  } else if (/завтра|\btomorrow\b/iu.test(lower)) {
    date = localNow.plus({ days: 1 }).startOf('day');
  } else if (/сегодня|\btoday\b/iu.test(lower)) {
    date = localNow.startOf('day');
  }

  const isoDate = lower.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/u);
  const ruDate = lower.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](20\d{2}))?\b/u);
  if (!date && isoDate) {
    date = DateTime.fromObject({
      year: Number(isoDate[1]),
      month: Number(isoDate[2]),
      day: Number(isoDate[3]),
    }, { zone }).startOf('day');
  } else if (!date && ruDate) {
    date = DateTime.fromObject({
      year: Number(ruDate[3] || localNow.year),
      month: Number(ruDate[2]),
      day: Number(ruDate[1]),
    }, { zone }).startOf('day');
  }

  const timeMatch = lower.match(/(?:\bв\b|\bat\b|\s)([01]?\d|2[0-3])[:.-]([0-5]\d)\b/u)
    || lower.match(/(?:\bв\b|\bat\b)\s+([01]?\d|2[0-3])\b/u);
  if (timeMatch) {
    time = {
      hour: Number(timeMatch[1]),
      minute: Number(timeMatch[2] || 0),
      raw: timeMatch[0],
    };
  }

  if (!date && time) {
    date = localNow.startOf('day');
    const candidate = date.set({ hour: time.hour, minute: time.minute });
    if (candidate <= localNow) date = date.plus({ days: 1 });
  }

  if (!date || !date.isValid) {
    return { isReminder: true, needsClarification: true, reason: 'missing_date' };
  }
  if (!time) {
    return { isReminder: true, needsClarification: true, reason: 'missing_time' };
  }

  const due = date.set({ hour: time.hour, minute: time.minute });
  if (!due.isValid || due <= localNow.minus({ minutes: 1 })) {
    return { isReminder: true, needsClarification: true, reason: 'past_due' };
  }
  return {
    isReminder: true,
    dueAtUtc: isoUtc(due),
    reminderText: extractReminderText(source, time.raw),
    timezone: zone,
  };
}

function extractReminderText(source, marker = '') {
  let text = String(source || '').trim();
  text = text.replace(/^\s*(?:напомни(?:\s+мне)?|remind(?:\s+me)?)(?:\s+пожалуйста)?\s*/iu, '').trim();
  const markerText = String(marker || '').trim();
  if (markerText) {
    const idx = text.toLowerCase().indexOf(markerText.toLowerCase());
    if (idx >= 0) text = `${text.slice(0, idx)} ${text.slice(idx + markerText.length)}`.trim();
  }
  text = text.replace(/(?:сегодня|завтра|послезавтра|\btoday\b|\btomorrow\b|\bday\s+after\s+tomorrow\b)/giu, ' ');
  text = text.replace(/^\s*(?:в|at)\s+/iu, ' ');
  text = text.replace(/\b(?:что|о том,? что|про|to|about)\b/iu, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return cleanText(text || 'напоминание', 1000);
}

function reminderClarificationText(reason = '') {
  if (reason === 'recurring_reminders_not_supported') {
    return 'Повторяющиеся напоминания пока не поддерживаются. Могу поставить одноразовое напоминание на конкретную дату и время.';
  }
  if (reason === 'missing_time') return 'Уточни время для напоминания.';
  if (reason === 'past_due') return 'Это время уже прошло. Дай будущую дату и время.';
  return 'Уточни дату и время для напоминания.';
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function nodeText(value) {
  if (Array.isArray(value)) return nodeText(value[0]);
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    return nodeText(value['#text'] ?? value.__cdata ?? value._text ?? value.value ?? '');
  }
  return '';
}

function stripHtml(value) {
  return cleanText(String(value || '')
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' '), 4000);
}

function parseNewsDate(value) {
  const text = cleanText(value, 200);
  if (!text) return null;
  const candidates = [
    DateTime.fromRFC2822(text, { zone: 'UTC' }),
    DateTime.fromISO(text, { setZone: true }),
    DateTime.fromSQL(text, { zone: 'UTC' }),
  ];
  for (const candidate of candidates) {
    if (candidate?.isValid) return isoUtc(candidate);
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : isoUtc(DateTime.fromJSDate(parsed));
}

function resolveFeedUrl(value, baseUrl = '') {
  const raw = cleanText(value, 2000);
  if (!raw) return '';
  const absolute = cleanUrl(raw);
  if (absolute) return absolute;
  try {
    return new URL(raw, baseUrl).toString();
  } catch {
    return '';
  }
}

function rssLink(item, feedUrl = '') {
  const link = item?.link;
  if (Array.isArray(link)) {
    for (const entry of link) {
      const resolved = rssLink({ link: entry }, feedUrl);
      if (resolved) return resolved;
    }
    return '';
  }
  if (link && typeof link === 'object') {
    return resolveFeedUrl(link['@_href'] || nodeText(link), feedUrl);
  }
  return resolveFeedUrl(nodeText(link), feedUrl);
}

function normalizeNewsItem(item = {}, feedUrl = '') {
  const title = stripHtml(nodeText(item.title));
  const summary = stripHtml(nodeText(item.description ?? item.summary ?? item.content ?? item['content:encoded']));
  const url = rssLink(item, feedUrl);
  const published_at = parseNewsDate(nodeText(item.pubDate ?? item.published ?? item.updated ?? item['dc:date']));
  const guid = cleanText(nodeText(item.guid ?? item.id), 1000) || url || `${title}|${published_at || ''}`;
  if (!title || !guid) return null;
  return {
    guid,
    title: cleanText(title, 500),
    summary: cleanText(summary, 1000),
    url,
    published_at,
  };
}

function decodeXmlText(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function firstXmlTag(block, tagName) {
  const escaped = String(tagName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(block || '').match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return decodeXmlText(match?.[1] || '');
}

function firstXmlLink(block) {
  const href = String(block || '').match(/<link\b[^>]*\shref=["']([^"']+)["'][^>]*>/i);
  if (href?.[1]) return decodeXmlText(href[1]);
  return firstXmlTag(block, 'link');
}

function parseNewsFeedXmlFallback(xml, feedUrl = '') {
  const text = String(xml || '');
  const blocks = [];
  for (const match of text.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) blocks.push(match[1]);
  for (const match of text.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)) blocks.push(match[1]);
  return blocks
    .map((block) => normalizeNewsItem({
      title: firstXmlTag(block, 'title'),
      description: firstXmlTag(block, 'description') || firstXmlTag(block, 'summary') || firstXmlTag(block, 'content') || firstXmlTag(block, 'content:encoded'),
      link: firstXmlLink(block),
      pubDate: firstXmlTag(block, 'pubDate') || firstXmlTag(block, 'published') || firstXmlTag(block, 'updated') || firstXmlTag(block, 'dc:date'),
      guid: firstXmlTag(block, 'guid') || firstXmlTag(block, 'id'),
    }, feedUrl))
    .filter(Boolean);
}

function parseNewsFeedXml(xml, feedUrl = '') {
  if (!XMLParser) return parseNewsFeedXmlFallback(xml, feedUrl);
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    cdataPropName: '#text',
    trimValues: true,
    parseTagValue: false,
    parseAttributeValue: false,
  });
  const parsed = parser.parse(String(xml || ''));
  const rssItems = asArray(parsed?.rss?.channel?.item);
  const atomEntries = asArray(parsed?.feed?.entry);
  return [...rssItems, ...atomEntries]
    .map((item) => normalizeNewsItem(item, feedUrl))
    .filter(Boolean);
}

function serializeRule(row = {}) {
  return {
    id: Number(row.id || 0),
    name: cleanInitiativeRuleName(row.name),
    chat_id: Number(row.chat_id || 0),
    bot_id: Number(row.bot_id || 0),
    enabled: row.enabled !== 0,
    schedule_type: row.schedule_type || 'fixed',
    fixed_time: row.fixed_time || DEFAULT_FIXED_TIME,
    window_start: row.window_start || DEFAULT_WINDOW_START,
    window_end: row.window_end || DEFAULT_WINDOW_END,
    timezone: row.timezone || DEFAULT_TIMEZONE,
    idle_threshold_minutes: row.idle_threshold_minutes == null ? DEFAULT_IDLE_MINUTES : Number(row.idle_threshold_minutes),
    min_gap_minutes: Number(row.min_gap_minutes || DEFAULT_GAP_MINUTES),
    same_context_limit_enabled: row.same_context_limit_enabled !== 0,
    same_context_max_runs: Number(row.same_context_max_runs || 1),
    same_context_run_count: Number(row.same_context_run_count || 0),
    prompt_mode: normalizePromptMode(row.prompt_mode || 'context_question'),
    custom_prompt: row.custom_prompt || '',
    holiday_country: row.holiday_country || '',
    news_source_id: Number(row.news_source_id || 0) || null,
    news_max_age_hours: Number(row.news_max_age_hours || DEFAULT_NEWS_MAX_AGE_HOURS),
    news_item_count: Number(row.news_item_count || DEFAULT_NEWS_ITEM_COUNT),
    news_use_chat_context: row.news_use_chat_context !== 0,
    news_prompt: row.news_prompt || '',
    next_run_at: row.next_run_at || null,
    last_run_at: row.last_run_at || null,
    last_message_id: Number(row.last_message_id || 0) || null,
    last_attempt_at: row.last_attempt_at || null,
    last_attempt_status: row.last_attempt_status || '',
    last_attempt_reason: row.last_attempt_reason || '',
    last_attempt_stage: row.last_attempt_stage || '',
    last_attempt_detail: row.last_attempt_detail || '',
    last_attempt_tries: Number(row.last_attempt_tries || 0),
  };
}

function serializeReminder(row = {}) {
  return {
    id: Number(row.id || 0),
    requester_user_id: Number(row.requester_user_id || 0),
    chat_id: Number(row.chat_id || 0),
    bot_id: Number(row.bot_id || 0),
    source_message_id: Number(row.source_message_id || 0) || null,
    due_at: row.due_at || '',
    requester_timezone: row.requester_timezone || DEFAULT_TIMEZONE,
    reminder_text: row.reminder_text || '',
    status: REMINDER_STATUSES.has(row.status) ? row.status : 'pending',
    sent_message_id: Number(row.sent_message_id || 0) || null,
    created_at: row.created_at || '',
    updated_at: row.updated_at || '',
  };
}

function serializeNewsSource(row = {}) {
  return {
    id: Number(row.id || 0),
    name: row.name || '',
    type: cleanNewsSourceType(row.type || 'rss'),
    url: row.url || '',
    enabled: row.enabled !== 0,
    cache_ttl_minutes: Number(row.cache_ttl_minutes || DEFAULT_NEWS_CACHE_TTL_MINUTES),
    created_at: row.created_at || '',
    updated_at: row.updated_at || '',
  };
}

function serializeNewsItem(row = {}) {
  return {
    id: Number(row.id || 0),
    source_id: Number(row.source_id || 0),
    guid: row.guid || '',
    title: row.title || '',
    summary: row.summary || '',
    url: row.url || '',
    published_at: row.published_at || null,
    fetched_at: row.fetched_at || '',
  };
}

function createAiInitiativeFeature({
  app,
  db,
  auth,
  adminOnly,
  aiBotFeature,
  hydrateMessageById,
  onMessageCreated,
  schedulerIntervalMs = 60_000,
  startScheduler = true,
  runRulesInBackground = startScheduler,
  maxConcurrentRuleRuns = 3,
  nowProvider = () => DateTime.utc(),
  fetchImpl = globalThis.fetch,
  rng = Math.random,
  sleepImpl = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
} = {}) {
  const isChatMemberStmt = db.prepare('SELECT 1 FROM chat_members WHERE chat_id=? AND user_id=?');
  const chatStmt = db.prepare('SELECT id, name, type FROM chats WHERE id=?');
  const initiativeBotStmt = db.prepare('SELECT id, name, provider FROM ai_bots WHERE id=?');
  const userTimezoneStmt = db.prepare('SELECT timezone FROM users WHERE id=?');
  const userMentionStmt = db.prepare('SELECT username, display_name FROM users WHERE id=?');
  const activeBotsStmt = db.prepare(`
    SELECT b.id, b.user_id, b.name, b.mention, b.provider, b.kind, b.enabled, u.display_name, u.username
    FROM ai_bots b
    LEFT JOIN users u ON u.id=b.user_id
    WHERE b.enabled=1
      AND b.user_id IS NOT NULL
      AND COALESCE(b.kind,'text') NOT IN ('image','convert','chatshot')
    ORDER BY b.provider ASC, b.name COLLATE NOCASE ASC
  `);
  const chatsStmt = db.prepare('SELECT id, name, type, created_by, is_notes FROM chats ORDER BY type ASC, name COLLATE NOCASE ASC, id ASC');
  const chatMembersStmt = db.prepare(`
    SELECT
      cm.chat_id,
      u.id,
      u.username,
      u.display_name,
      COALESCE(u.is_ai_bot, 0) as is_ai_bot,
      COALESCE(ab.id, 0) as ai_bot_id,
      COALESCE(ab.provider, '') as ai_bot_provider,
      COALESCE(ab.kind, '') as ai_bot_kind,
      COALESCE(ab.mention, '') as ai_bot_mention
    FROM chat_members cm
    JOIN users u ON u.id=cm.user_id
    LEFT JOIN ai_bots ab ON ab.user_id=u.id
    ORDER BY cm.chat_id ASC, COALESCE(u.is_ai_bot, 0) ASC, u.display_name COLLATE NOCASE ASC, u.id ASC
  `);
  const rulesStmt = db.prepare('SELECT * FROM ai_bot_initiative_rules ORDER BY id ASC');
  const ruleByIdStmt = db.prepare('SELECT * FROM ai_bot_initiative_rules WHERE id=?');
  const newsSourcesStmt = db.prepare('SELECT * FROM ai_news_sources ORDER BY enabled DESC, name COLLATE NOCASE ASC, id ASC');
  const enabledNewsSourcesStmt = db.prepare('SELECT * FROM ai_news_sources WHERE enabled=1 ORDER BY name COLLATE NOCASE ASC, id ASC');
  const newsSourceByIdStmt = db.prepare('SELECT * FROM ai_news_sources WHERE id=?');
  const dueRulesStmt = db.prepare(`
    SELECT * FROM ai_bot_initiative_rules
    WHERE enabled=1 AND next_run_at IS NOT NULL AND datetime(next_run_at) <= datetime(?)
    ORDER BY datetime(next_run_at) ASC, id ASC
    LIMIT 20
  `);
  const insertRuleStmt = db.prepare(`
    INSERT INTO ai_bot_initiative_rules(
      name, chat_id, bot_id, enabled, schedule_type, fixed_time, window_start, window_end, timezone,
      idle_threshold_minutes, min_gap_minutes, same_context_limit_enabled, same_context_max_runs,
      prompt_mode, custom_prompt, holiday_country, news_source_id, news_max_age_hours,
      news_item_count, news_use_chat_context, news_prompt, next_run_at
    )
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const updateRuleStmt = db.prepare(`
    UPDATE ai_bot_initiative_rules
    SET name=?, chat_id=?, bot_id=?, enabled=?, schedule_type=?, fixed_time=?, window_start=?, window_end=?,
      timezone=?, idle_threshold_minutes=?, min_gap_minutes=?, same_context_limit_enabled=?,
      same_context_max_runs=?, prompt_mode=?, custom_prompt=?,
      holiday_country=?, news_source_id=?, news_max_age_hours=?, news_item_count=?,
      news_use_chat_context=?, news_prompt=?, next_run_at=?, updated_at=datetime('now')
    WHERE id=?
  `);
  const deleteRuleStmt = db.prepare('DELETE FROM ai_bot_initiative_rules WHERE id=?');
  const updateRuleRunStmt = db.prepare(`
    UPDATE ai_bot_initiative_rules
    SET next_run_at=?, last_run_at=?, last_message_id=?, same_context_run_count=?, updated_at=datetime('now')
    WHERE id=?
  `);
  const updateRuleNextStmt = db.prepare('UPDATE ai_bot_initiative_rules SET next_run_at=?, updated_at=datetime(\'now\') WHERE id=?');
  const updateRuleAttemptStmt = db.prepare(`
    UPDATE ai_bot_initiative_rules
    SET last_attempt_at=?, last_attempt_status=?, last_attempt_reason=?, last_attempt_stage=?,
      last_attempt_detail=?, last_attempt_tries=?, updated_at=datetime('now')
    WHERE id=?
  `);
  const resetRuleContextStmt = db.prepare(`
    UPDATE ai_bot_initiative_rules
    SET last_message_id=NULL, same_context_run_count=0, updated_at=datetime('now')
    WHERE id=?
  `);
  const dueRemindersStmt = db.prepare(`
    SELECT * FROM ai_bot_reminders
    WHERE status='pending' AND datetime(due_at) <= datetime(?)
    ORDER BY datetime(due_at) ASC, id ASC
    LIMIT 20
  `);
  const insertReminderStmt = db.prepare(`
    INSERT INTO ai_bot_reminders(requester_user_id, chat_id, bot_id, source_message_id, due_at, requester_timezone, reminder_text)
    VALUES(?,?,?,?,?,?,?)
  `);
  const remindersForUserChatStmt = db.prepare(`
    SELECT r.*, b.name as bot_name, b.mention as bot_mention
    FROM ai_bot_reminders r
    LEFT JOIN ai_bots b ON b.id=r.bot_id
    WHERE r.requester_user_id=? AND r.chat_id=? AND r.status IN ('pending','processing')
    ORDER BY datetime(r.due_at) ASC, r.id ASC
  `);
  const reminderByIdStmt = db.prepare('SELECT * FROM ai_bot_reminders WHERE id=?');
  const updateReminderProcessingStmt = db.prepare("UPDATE ai_bot_reminders SET status='processing', attempts=attempts+1, updated_at=datetime('now') WHERE id=? AND status='pending'");
  const updateReminderSentStmt = db.prepare("UPDATE ai_bot_reminders SET status='sent', sent_message_id=?, error='', updated_at=datetime('now') WHERE id=?");
  const updateReminderFailedStmt = db.prepare("UPDATE ai_bot_reminders SET status=?, error=?, updated_at=datetime('now') WHERE id=?");
  const cancelReminderStmt = db.prepare("UPDATE ai_bot_reminders SET status='canceled', updated_at=datetime('now') WHERE id=?");
  const latestHumanMessageStmt = db.prepare(`
    SELECT m.id, m.created_at
    FROM messages m
    JOIN users u ON u.id=m.user_id
    WHERE m.chat_id=? AND m.is_deleted=0 AND COALESCE(m.ai_generated,0)=0 AND COALESCE(u.is_ai_bot,0)=0
    ORDER BY m.id DESC
    LIMIT 1
  `);
  const insertNewsSourceStmt = db.prepare(`
    INSERT INTO ai_news_sources(name, type, url, enabled, cache_ttl_minutes)
    VALUES(?,?,?,?,?)
  `);
  const updateNewsSourceStmt = db.prepare(`
    UPDATE ai_news_sources
    SET name=?, type=?, url=?, enabled=?, cache_ttl_minutes=?, updated_at=datetime('now')
    WHERE id=?
  `);
  const deleteNewsSourceStmt = db.prepare('DELETE FROM ai_news_sources WHERE id=?');
  const latestNewsFetchStmt = db.prepare('SELECT MAX(fetched_at) as fetched_at FROM ai_news_items WHERE source_id=?');
  const upsertNewsItemStmt = db.prepare(`
    INSERT INTO ai_news_items(source_id, guid, title, summary, url, published_at, fetched_at, raw_json)
    VALUES(?,?,?,?,?,?,datetime('now'),?)
    ON CONFLICT(source_id, guid) DO UPDATE SET
      title=excluded.title,
      summary=excluded.summary,
      url=excluded.url,
      published_at=excluded.published_at,
      fetched_at=datetime('now'),
      raw_json=excluded.raw_json
  `);
  const recentNewsItemsStmt = db.prepare(`
    SELECT *
    FROM ai_news_items
    WHERE source_id=?
      AND (published_at IS NULL OR datetime(published_at) >= datetime(?))
    ORDER BY COALESCE(datetime(published_at), datetime(fetched_at)) DESC, id DESC
    LIMIT 100
  `);
  const historyForRuleSourceStmt = db.prepare(`
    SELECT item_guid FROM ai_news_history
    WHERE rule_id=? AND source_id=?
    ORDER BY id DESC
  `);
  const insertNewsHistoryStmt = db.prepare(`
    INSERT OR IGNORE INTO ai_news_history(rule_id, source_id, item_guid, sent_at)
    VALUES(?,?,?,datetime('now'))
  `);
  const replyBotStmt = db.prepare('SELECT ai_bot_id FROM messages WHERE id=? AND ai_generated=1 AND ai_bot_id IS NOT NULL');
  const botByUserStmt = db.prepare('SELECT id FROM ai_bots WHERE user_id=? AND enabled=1');

  let schedulerTimer = null;
  let tickRunning = false;
  const inFlightRuleIds = new Set();
  const activeRuleProviders = new Set();
  const ruleConcurrency = intValue(maxConcurrentRuleRuns, 3, 1, 20);
  const pendingRuleRuns = [];
  let activeRuleRunCount = 0;

  function currentUtc() {
    const value = nowProvider();
    if (value?.isValid) return value.toUTC();
    const dt = DateTime.fromJSDate(value instanceof Date ? value : new Date(value));
    return dt.isValid ? dt.toUTC() : DateTime.utc();
  }

  function userTimezone(userId) {
    return cleanTimezone(userTimezoneStmt.get(Number(userId || 0))?.timezone || DEFAULT_TIMEZONE);
  }

  function hasMembership(chatId, userId) {
    return !!isChatMemberStmt.get(Number(chatId || 0), Number(userId || 0));
  }

  function serializeAdminMember(row = {}) {
    return {
      id: Number(row.id || 0),
      username: row.username || '',
      display_name: row.display_name || '',
      is_ai_bot: Number(row.is_ai_bot || 0),
      ai_bot_id: Number(row.ai_bot_id || 0),
      ai_bot_provider: row.ai_bot_provider || '',
      ai_bot_kind: row.ai_bot_kind || '',
      ai_bot_mention: row.ai_bot_mention || '',
    };
  }

  function serializeAdminChat(row = {}, members = []) {
    return {
      id: Number(row.id || 0),
      name: row.name || '',
      type: row.type || 'group',
      created_by: Number(row.created_by || 0) || null,
      is_notes: Number(row.is_notes || 0),
      members: members.map(serializeAdminMember),
    };
  }

  function serializeAdminState() {
    const membersByChat = new Map();
    chatMembersStmt.all().forEach((member) => {
      const chatId = Number(member.chat_id || 0);
      if (!membersByChat.has(chatId)) membersByChat.set(chatId, []);
      membersByChat.get(chatId).push(member);
    });
    return {
      chats: chatsStmt.all().map((chat) => serializeAdminChat(chat, membersByChat.get(Number(chat.id || 0)) || [])),
      bots: activeBotsStmt.all().map((bot) => ({
        id: Number(bot.id || 0),
        user_id: Number(bot.user_id || 0),
        name: bot.name || bot.display_name || '',
        mention: bot.mention || bot.username || '',
        provider: bot.provider || 'openai',
        kind: bot.kind || 'text',
      })),
      rules: rulesStmt.all().map(serializeRule),
      news_sources: newsSourcesStmt.all().map(serializeNewsSource),
    };
  }

  function ensureRuntime(chatId, botId) {
    if (!aiBotFeature?.resolveChatBotRuntime?.(chatId, botId)) {
      const error = new Error('Bot is not enabled in this chat');
      error.status = 400;
      throw error;
    }
  }

  function defaultNewsSourceId() {
    return Number(enabledNewsSourcesStmt.get()?.id || newsSourcesStmt.get()?.id || 0) || null;
  }

  function resolveRuleNewsSourceId(rule) {
    if (rule.prompt_mode !== 'news_hook') return Number(rule.news_source_id || 0) || null;
    const requested = Number(rule.news_source_id || 0) || null;
    if (requested && newsSourceByIdStmt.get(requested)) return requested;
    return defaultNewsSourceId();
  }

  function defaultRuleName(rule) {
    const chat = chatStmt.get(rule.chat_id) || {};
    const bot = initiativeBotStmt.get(rule.bot_id) || {};
    const source = rule.prompt_mode === 'news_hook' && rule.news_source_id
      ? (newsSourceByIdStmt.get(rule.news_source_id) || {})
      : {};
    return buildInitiativeRuleName({
      promptMode: rule.prompt_mode,
      sourceName: source.name,
      sourceId: rule.news_source_id,
      chatName: chat.name,
      chatId: rule.chat_id,
      botName: bot.name,
      botId: rule.bot_id,
    });
  }

  function saveRule(input, current = null) {
    const rule = normalizeRuleInput(input, current || {}, currentUtc());
    if (!rule.chat_id || !rule.bot_id) {
      const error = new Error('Chat and bot are required');
      error.status = 400;
      throw error;
    }
    ensureRuntime(rule.chat_id, rule.bot_id);
    rule.news_source_id = resolveRuleNewsSourceId(rule);
    if (!rule.name) rule.name = defaultRuleName(rule);
    rule.next_run_at = computeNextRunAt(rule, currentUtc());
    if (current?.id) {
      const resetContext = Number(current.chat_id || 0) !== rule.chat_id
        || Number(current.bot_id || 0) !== rule.bot_id
        || normalizePromptMode(current.prompt_mode) !== rule.prompt_mode
        || (!boolValue(current.same_context_limit_enabled, true) && rule.same_context_limit_enabled);
      updateRuleStmt.run(
        rule.name,
        rule.chat_id,
        rule.bot_id,
        rule.enabled ? 1 : 0,
        rule.schedule_type,
        rule.fixed_time,
        rule.window_start,
        rule.window_end,
        rule.timezone,
        rule.idle_threshold_minutes,
        rule.min_gap_minutes,
        rule.same_context_limit_enabled ? 1 : 0,
        rule.same_context_max_runs,
        rule.prompt_mode,
        rule.custom_prompt,
        rule.holiday_country,
        rule.news_source_id,
        rule.news_max_age_hours,
        rule.news_item_count,
        rule.news_use_chat_context ? 1 : 0,
        rule.news_prompt,
        rule.next_run_at,
        current.id
      );
      if (resetContext || rule.prompt_mode === 'news_hook') resetRuleContextStmt.run(current.id);
      return serializeRule(ruleByIdStmt.get(current.id));
    }
    const result = insertRuleStmt.run(
      rule.name,
      rule.chat_id,
      rule.bot_id,
      rule.enabled ? 1 : 0,
      rule.schedule_type,
      rule.fixed_time,
      rule.window_start,
      rule.window_end,
      rule.timezone,
      rule.idle_threshold_minutes,
      rule.min_gap_minutes,
      rule.same_context_limit_enabled ? 1 : 0,
      rule.same_context_max_runs,
      rule.prompt_mode,
      rule.custom_prompt,
      rule.holiday_country,
      rule.news_source_id,
      rule.news_max_age_hours,
      rule.news_item_count,
      rule.news_use_chat_context ? 1 : 0,
      rule.news_prompt,
      rule.next_run_at
    );
    return serializeRule(ruleByIdStmt.get(result.lastInsertRowid));
  }

  function saveNewsSource(input, current = null) {
    const source = normalizeNewsSourceInput(input, current || {});
    if (!source.url) {
      const error = new Error('Valid RSS URL is required');
      error.status = 400;
      throw error;
    }
    if (current?.id) {
      updateNewsSourceStmt.run(
        source.name,
        source.type,
        source.url,
        source.enabled ? 1 : 0,
        source.cache_ttl_minutes,
        current.id
      );
      return serializeNewsSource(newsSourceByIdStmt.get(current.id));
    }
    const result = insertNewsSourceStmt.run(
      source.name,
      source.type,
      source.url,
      source.enabled ? 1 : 0,
      source.cache_ttl_minutes
    );
    return serializeNewsSource(newsSourceByIdStmt.get(result.lastInsertRowid));
  }

  async function maybeParseReminderWithAi(botId, chatId, text, timezone) {
    if (!aiBotFeature?.generateJsonForBot) return { isReminder: false };
    const nowLocal = currentUtc().setZone(cleanTimezone(timezone));
    const payload = await aiBotFeature.generateJsonForBot({
      chatId,
      botId,
      system: [
        'You parse reminder requests for a chat app.',
        'Return JSON only with keys: is_reminder, unsupported, needs_clarification, reason, due_at_local, reminder_text.',
        'due_at_local must be ISO local datetime in the provided timezone. Only parse one-shot reminders.',
        'If the user asks for recurring reminders, set unsupported=true and reason="recurring_reminders_not_supported".',
        'If date or time is missing, set needs_clarification=true.',
      ].join('\n'),
      user: [
        `Timezone: ${timezone}`,
        `Current local datetime: ${nowLocal.toISO({ suppressMilliseconds: true })}`,
        `Message: ${text}`,
      ].join('\n'),
      fallback: { is_reminder: false },
      maxOutputTokens: 500,
    });
    if (!payload?.is_reminder) return { isReminder: false };
    if (payload.unsupported) {
      return { isReminder: true, unsupported: true, reason: payload.reason || 'recurring_reminders_not_supported' };
    }
    if (payload.needs_clarification) {
      return { isReminder: true, needsClarification: true, reason: payload.reason || 'missing_date' };
    }
    const local = DateTime.fromISO(String(payload.due_at_local || ''), { zone: cleanTimezone(timezone) });
    if (!local.isValid || local <= nowLocal.minus({ minutes: 1 })) {
      return { isReminder: true, needsClarification: true, reason: 'past_due' };
    }
    return {
      isReminder: true,
      dueAtUtc: isoUtc(local),
      reminderText: cleanText(payload.reminder_text || extractReminderText(text), 1000),
      timezone,
    };
  }

  async function parseReminderRequest({ botId, chatId, text, timezone }) {
    const parsed = parseDateTimeRule(text, timezone, currentUtc());
    if (!parsed.isReminder) {
      return maybeParseReminderWithAi(botId, chatId, text, timezone);
    }
    return parsed;
  }

  function resolveTargetBot(message = {}) {
    const chatId = Number(message.chat_id || message.chatId || 0);
    const userId = Number(message.user_id || message.userId || 0);
    if (!chatId || !userId) return null;
    if (message.reply_to_id) {
      const replied = replyBotStmt.get(Number(message.reply_to_id));
      if (replied?.ai_bot_id && aiBotFeature?.resolveChatBotRuntime?.(chatId, replied.ai_bot_id)) return Number(replied.ai_bot_id);
    }
    if (Array.isArray(message.mentions)) {
      for (const mention of message.mentions) {
        const botId = mention?.is_ai_bot && mention.user_id ? botByUserStmt.get(Number(mention.user_id))?.id : null;
        if (botId && aiBotFeature?.resolveChatBotRuntime?.(chatId, botId)) return Number(botId);
      }
    }
    const text = String(message.text || message.transcription_text || '');
    const activeBots = activeBotsStmt.all();
    for (const bot of activeBots) {
      const mention = String(bot.mention || '').trim().toLowerCase();
      if (mention && new RegExp(`(^|\\s)@${mention.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|\\s|[,.:;!?])`, 'i').test(text)) {
        if (aiBotFeature?.resolveChatBotRuntime?.(chatId, bot.id)) return Number(bot.id);
      }
    }
    const chat = chatStmt.get(chatId);
    if (chat?.type === 'private') {
      const row = db.prepare(`
        SELECT b.id
        FROM chat_members cm
        JOIN users u ON u.id=cm.user_id
        JOIN ai_bots b ON b.user_id=u.id
        WHERE cm.chat_id=? AND COALESCE(u.is_ai_bot,0)=1 AND b.enabled=1
        ORDER BY b.id ASC
        LIMIT 1
      `).get(chatId);
      if (row?.id && aiBotFeature?.resolveChatBotRuntime?.(chatId, row.id)) return Number(row.id);
    }
    return null;
  }

  async function handleMessageCreated(message) {
    if (!message || message.ai_generated || message.is_deleted) return false;
    const text = cleanText(message.text || message.transcription_text || '', 3000);
    if (!text || !looksLikeReminderRequest(text)) return false;
    const botId = resolveTargetBot(message);
    if (!botId) return false;
    const chatId = Number(message.chat_id || message.chatId || 0);
    const requesterId = Number(message.user_id || message.userId || 0);
    const timezone = userTimezone(requesterId);
    const parsed = await parseReminderRequest({ botId, chatId, text, timezone });
    if (!parsed?.isReminder) return false;
    if (parsed.unsupported || parsed.needsClarification || !parsed.dueAtUtc) {
      await aiBotFeature?.runSyntheticBotTurn?.({
        chatId,
        botId,
        instruction: [
          `The user tried to set a reminder with this message: ${text}`,
          `Reply in your normal persona with this meaning: ${reminderClarificationText(parsed.reason)}`,
        ].join('\n'),
        purpose: 'reminder_clarification',
        replyToId: message.id,
      });
      return true;
    }
    const reminderText = cleanText(parsed.reminderText || extractReminderText(text), 1000);
    const result = insertReminderStmt.run(
      requesterId,
      chatId,
      botId,
      Number(message.id || 0) || null,
      parsed.dueAtUtc,
      parsed.timezone || timezone,
      reminderText
    );
    const dueLocal = dbDateToUtc(parsed.dueAtUtc).setZone(parsed.timezone || timezone);
    await aiBotFeature?.runSyntheticBotTurn?.({
      chatId,
      botId,
      instruction: [
        `Confirm that reminder #${result.lastInsertRowid} was created.`,
        `Reminder text: ${reminderText}`,
        `Due time for the user: ${dueLocal.toFormat('yyyy-LL-dd HH:mm ZZZZ')}`,
        'Keep it short and in your persona.',
      ].join('\n'),
      purpose: 'reminder_confirmation',
      replyToId: message.id,
    });
    return true;
  }

  function newsCacheIsFresh(source) {
    const latest = dbDateToUtc(latestNewsFetchStmt.get(source.id)?.fetched_at);
    if (!latest?.isValid) return false;
    const ttl = intValue(source.cache_ttl_minutes, DEFAULT_NEWS_CACHE_TTL_MINUTES, 1, 24 * 60);
    return minutesBetween(currentUtc(), latest) < ttl;
  }

  async function refreshNewsSource(source, { force = false } = {}) {
    const normalized = serializeNewsSource(source);
    if (normalized.type !== 'rss' || !normalized.url) return [];
    if (!force && newsCacheIsFresh(normalized)) {
      return recentNewsItemsStmt.all(normalized.id, isoUtc(currentUtc().minus({ days: 14 }))).map(serializeNewsItem);
    }
    if (typeof fetchImpl !== 'function') return [];
    const response = await fetchImpl(normalized.url, {
      headers: {
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
        'User-Agent': 'BananzaBotInitiative/1.0',
      },
    });
    if (!response?.ok) throw new Error(`News source fetch failed: HTTP ${response?.status || 0}`);
    const xml = await response.text();
    const items = parseNewsFeedXml(xml, normalized.url).slice(0, 100);
    for (const item of items) {
      upsertNewsItemStmt.run(
        normalized.id,
        item.guid,
        item.title,
        item.summary,
        item.url,
        item.published_at,
        JSON.stringify(item)
      );
    }
    return recentNewsItemsStmt.all(normalized.id, isoUtc(currentUtc().minus({ days: 14 }))).map(serializeNewsItem);
  }

  async function testNewsSource(source) {
    const items = await refreshNewsSource(source, { force: true });
    return items.slice(0, 10);
  }

  function pickRandomItems(items, count) {
    const pool = [...items];
    const selected = [];
    const limit = Math.min(count, pool.length);
    while (selected.length < limit && pool.length) {
      const index = Math.floor(rng() * pool.length);
      selected.push(pool.splice(index, 1)[0]);
    }
    return selected;
  }

  async function pickNewsItemsForRule(rule) {
    const sourceId = Number(rule.news_source_id || 0) || defaultNewsSourceId();
    if (!sourceId) return { items: [], source: null, reason: 'no_news_source' };
    const source = newsSourceByIdStmt.get(sourceId);
    if (!source || source.enabled === 0) return { items: [], source: source ? serializeNewsSource(source) : null, reason: 'news_source_disabled' };
    try {
      await refreshNewsSource(source);
    } catch (error) {
      return { items: [], source: serializeNewsSource(source), reason: 'news_source_failed', error };
    }
    const maxAgeHours = intValue(rule.news_max_age_hours, DEFAULT_NEWS_MAX_AGE_HOURS, 1, 24 * 14);
    const requestedCount = intValue(rule.news_item_count, DEFAULT_NEWS_ITEM_COUNT, 1, MAX_NEWS_ITEM_COUNT);
    const since = isoUtc(currentUtc().minus({ hours: maxAgeHours }));
    const items = recentNewsItemsStmt.all(source.id, since).map(serializeNewsItem);
    if (!items.length) return { items: [], source: serializeNewsSource(source), reason: 'no_recent_news' };
    const used = new Set(historyForRuleSourceStmt.all(rule.id, source.id).map((row) => row.item_guid));
    const fresh = items.filter((item) => !used.has(item.guid));
    const selected = pickRandomItems(fresh, requestedCount);
    return { items: selected, source: serializeNewsSource(source), reason: selected.length ? '' : 'no_new_news' };
  }

  function compactNewsPromptText(value, maxBytes) {
    const text = normalizeProviderText(value).replace(/\s+/g, ' ').trim();
    const limit = Math.max(0, Math.floor(Number(maxBytes) || 0));
    if (!text || !limit) return '';
    if (jsonContentByteLength(text) <= limit) return text;
    const marker = '...';
    const contentBudget = Math.max(0, limit - jsonContentByteLength(marker));
    return `${takeJsonStart(text, contentBudget).trimEnd()}${marker}`;
  }

  function newsInstructionLine(item, index, summaryMaxBytes = NEWS_SUMMARY_MAX_BYTES) {
    const title = compactNewsPromptText(item.title, NEWS_TITLE_MAX_BYTES) || 'Untitled';
    const summary = compactNewsPromptText(item.summary, summaryMaxBytes);
    const url = compactNewsPromptText(item.url, NEWS_URL_MAX_BYTES);
    const publishedAt = compactNewsPromptText(item.published_at, NEWS_PUBLISHED_MAX_BYTES);
    return [
      `News item ${index + 1} title: ${title}`,
      summary ? `News item ${index + 1} summary: ${summary}` : `News item ${index + 1} summary: omitted or not provided.`,
      url ? `News item ${index + 1} URL: ${url}` : `News item ${index + 1} URL: not provided.`,
      publishedAt ? `News item ${index + 1} published at: ${publishedAt}` : `News item ${index + 1} published at: not provided.`,
    ].join('\n');
  }

  function newsInstructionBlock(items, source, summaryMaxBytes = NEWS_SUMMARY_MAX_BYTES) {
    const sourceName = compactNewsPromptText(source?.name || 'RSS', 160) || 'RSS';
    const sourceUrl = compactNewsPromptText(source?.url || 'unknown', 320) || 'unknown';
    return [
      `News source: ${sourceName} (${sourceUrl}).`,
      `News items provided: ${items.length}.`,
      ...items.map((item, index) => newsInstructionLine(item, index, summaryMaxBytes)),
    ].join('\n');
  }

  function buildNewsRuleInstruction(base, items, source, rule) {
    const coverageInstruction = [
      `Cover every one of the ${items.length} numbered news items in the visible message; do not silently omit any item.`,
      'Combine them into one concise digest instead of writing unrelated separate messages.',
      'Stay in your bot persona.',
      rule.news_use_chat_context === 0
        ? 'Do not force a connection to recent chat context unless it is obviously relevant.'
        : 'You may connect the news to recent chat context if it is naturally relevant.',
      'Do not invent details beyond the supplied title, summary, URL, source, and published time.',
      'Make each numbered news item recognizable from its title or central fact.',
      'The requirement to cover every selected item takes priority over stylistic admin instructions.',
    ].join('\n');
    const extraPrompt = compactNewsPromptText(rule.news_prompt, NEWS_ADMIN_PROMPT_MAX_BYTES);

    let summaryMaxBytes = NEWS_SUMMARY_MAX_BYTES;
    let instruction = '';
    while (summaryMaxBytes >= 0) {
      instruction = [
        ...base,
        newsInstructionBlock(items, source, summaryMaxBytes),
        extraPrompt ? `Admin news instruction:\n${extraPrompt}` : '',
        coverageInstruction,
      ].filter(Boolean).join('\n\n');
      if (jsonContentByteLength(instruction) <= NEWS_INSTRUCTION_MAX_BYTES) return instruction;
      summaryMaxBytes -= 25;
    }

    const error = new Error(`News instruction cannot fit ${items.length} selected items into the provider budget`);
    error.code = 'NEWS_PROMPT_TOO_LARGE';
    error.stage = 'context';
    error.retryable = false;
    error.instructionBytes = jsonContentByteLength([
      ...base,
      newsInstructionBlock(items, source, 0),
      extraPrompt ? `Admin news instruction:\n${extraPrompt}` : '',
      coverageInstruction,
    ].join('\n\n'));
    throw error;
  }

  async function buildRuleInstruction(rule) {
    const timezone = cleanTimezone(rule.timezone);
    const nowLocal = currentUtc().setZone(timezone);
    const base = [
      `Current local date and time: ${nowLocal.toFormat('yyyy-LL-dd HH:mm ZZZZ')}.`,
      'Use the recent chat context you are given. Do not mention hidden scheduler mechanics.',
    ];
    if (rule.prompt_mode === 'news_hook') {
      const { items, source, reason, error: newsError } = await pickNewsItemsForRule(rule);
      if (!items.length) {
        const error = new Error(newsError?.message || reason || 'No recent news item is available');
        error.code = 'NO_NEWS_ITEM';
        error.stage = 'news';
        if (newsError) error.cause = newsError;
        error.initiativeReason = reason || 'no_recent_news';
        throw error;
      }
      const instruction = buildNewsRuleInstruction(base, items, source, rule);
      return { instruction, newsItems: items, newsItem: items[0] || null, newsSource: source };
    } else if (rule.prompt_mode === 'idle_ping') {
      base.push('The user has been quiet. Write a short warm check-in in your persona.');
    } else if (rule.prompt_mode === 'custom') {
      base.push(`Admin instruction:\n${cleanText(rule.custom_prompt, 8000) || 'Start a useful conversation.'}`);
    } else {
      base.push('Ask one relevant follow-up question based on the latest conversation context.');
    }
    return { instruction: base.join('\n\n'), newsItems: [], newsItem: null, newsSource: null };
  }

  function shouldRunRule(rule) {
    const chatId = Number(rule.chat_id || 0);
    const latestHuman = latestHumanMessageStmt.get(chatId);
    const idleThreshold = intValue(rule.idle_threshold_minutes, DEFAULT_IDLE_MINUTES, 0, 60 * 24 * 30);
    if (!latestHuman && idleThreshold > 0) return { ok: false, reason: 'no_human_messages' };
    const latestHumanId = Number(latestHuman?.id || 0);
    const sameContext = Number(rule.last_message_id || 0) && latestHumanId <= Number(rule.last_message_id || 0);
    if (normalizePromptMode(rule.prompt_mode) !== 'news_hook' && sameContext && boolValue(rule.same_context_limit_enabled, true)) {
      const maxRuns = intValue(rule.same_context_max_runs, 1, 1, 20);
      const currentRuns = intValue(rule.same_context_run_count, 0, 0, 20);
      if (currentRuns >= maxRuns) return { ok: false, reason: 'same_context_limit' };
    }
    const now = currentUtc();
    const lastHumanAt = dbDateToUtc(latestHuman?.created_at);
    if (idleThreshold > 0 && minutesBetween(now, lastHumanAt) < idleThreshold) {
      return { ok: false, reason: 'not_idle' };
    }
    const lastRunAt = dbDateToUtc(rule.last_run_at);
    if (lastRunAt && !minGapElapsed(now, lastRunAt, rule.min_gap_minutes)) {
      return { ok: false, reason: 'min_gap' };
    }
    if (!aiBotFeature?.resolveChatBotRuntime?.(chatId, rule.bot_id)) return { ok: false, reason: 'bot_unavailable' };
    if (normalizePromptMode(rule.prompt_mode) === 'news_hook') {
      const sourceId = Number(rule.news_source_id || 0) || defaultNewsSourceId();
      const source = sourceId ? newsSourceByIdStmt.get(sourceId) : null;
      if (!source || source.enabled === 0) return { ok: false, reason: 'news_source_unavailable' };
    }
    return { ok: true, latestHuman };
  }

  function nextSameContextRunCount(rule, latestHuman = {}) {
    if (normalizePromptMode(rule.prompt_mode) === 'news_hook') return 0;
    const latestHumanId = Number(latestHuman.id || 0);
    if (!latestHumanId) return 0;
    const sameContext = Number(rule.last_message_id || 0) && latestHumanId <= Number(rule.last_message_id || 0);
    return sameContext ? Math.min(20, intValue(rule.same_context_run_count, 0, 0, 20) + 1) : 1;
  }

  function ruleProvider(rule) {
    return cleanText(initiativeBotStmt.get(Number(rule?.bot_id || 0))?.provider || 'unknown', 40).toLowerCase() || 'unknown';
  }

  function logRuleEvent(level, rule, event = {}) {
    const payload = {
      rule_id: Number(rule?.id || 0),
      chat_id: Number(rule?.chat_id || 0),
      bot_id: Number(rule?.bot_id || 0),
      provider: ruleProvider(rule),
      ...event,
    };
    const logger = level === 'error' ? console.warn : console.info;
    logger('[ai-initiative]', JSON.stringify(payload));
  }

  function recordRuleOutcome(rule, {
    status,
    reason = '',
    stage = '',
    detail = '',
    tries = 0,
  } = {}) {
    const safeDetail = detail ? errorDetail({ message: detail }, '') : '';
    updateRuleAttemptStmt.run(
      isoUtc(currentUtc()),
      cleanText(status, 40),
      cleanText(reason, 120),
      cleanText(stage, 80),
      safeDetail,
      intValue(tries, 0, 0, PROVIDER_MAX_ATTEMPTS),
      rule.id
    );
    logRuleEvent(status === 'failed' ? 'error' : 'info', rule, {
      status,
      reason,
      stage,
      tries,
      detail: safeDetail,
    });
  }

  function providerRetryDelay(error, retryIndex) {
    const base = PROVIDER_RETRY_DELAYS_MS[Math.max(0, Math.min(PROVIDER_RETRY_DELAYS_MS.length - 1, retryIndex))];
    const jittered = Math.round(base * (0.8 + (Math.max(0, Math.min(1, Number(rng()) || 0)) * 0.4)));
    return Math.min(MAX_RETRY_DELAY_MS, Math.max(jittered, retryAfterMs(error)));
  }

  function syntheticContextOptionsForRule(rule) {
    const isNews = normalizePromptMode(rule.prompt_mode) === 'news_hook';
    const includeChatContext = !isNews || boolValue(rule.news_use_chat_context, true);
    return {
      includeChatContext,
      recentContextMaxChars: isNews
        ? (includeChatContext ? NEWS_RECENT_CONTEXT_MAX_CHARS : 0)
        : INITIATIVE_RECENT_CONTEXT_MAX_CHARS,
    };
  }

  async function runRuleSyntheticTurn(rule, instruction) {
    let lastError = null;
    for (let attempt = 1; attempt <= PROVIDER_MAX_ATTEMPTS; attempt++) {
      try {
        const result = await aiBotFeature?.runSyntheticBotTurn?.({
          chatId: rule.chat_id,
          botId: rule.bot_id,
          instruction,
          purpose: `initiative_${rule.prompt_mode || 'context_question'}`,
          ...syntheticContextOptionsForRule(rule),
        });
        if (!result?.message?.id) {
          const error = new Error('AI provider returned no initiative message');
          error.code = 'BOT_NO_MESSAGE';
          error.stage = 'provider';
          error.retryable = true;
          throw error;
        }
        return { result, tries: attempt };
      } catch (error) {
        lastError = error;
        const retryable = isRetryableInitiativeError(error);
        if (!retryable || attempt >= PROVIDER_MAX_ATTEMPTS) {
          try { error.initiativeTries = attempt; } catch {}
          throw error;
        }
        const delayMs = providerRetryDelay(error, attempt - 1);
        logRuleEvent('error', rule, {
          status: 'retrying',
          reason: initiativeErrorReason(error),
          stage: cleanText(error?.stage || 'provider', 80),
          tries: attempt,
          retry_in_ms: delayMs,
          detail: errorDetail(error),
        });
        await sleepImpl(delayMs);
      }
    }
    throw lastError || new Error('Initiative provider failed');
  }

  async function processDueReminder(row) {
    const changed = updateReminderProcessingStmt.run(row.id);
    if (!changed.changes) return;
    try {
      const chat = chatStmt.get(row.chat_id);
      const mentionUserId = chat?.type === 'private' ? null : row.requester_user_id;
      const result = await aiBotFeature?.runSyntheticBotTurn?.({
        chatId: row.chat_id,
        botId: row.bot_id,
        instruction: [
          'Send this reminder now.',
          `Reminder text: ${row.reminder_text}`,
          'Write in your persona. In a group chat, address the requester directly.',
        ].join('\n'),
        purpose: 'reminder_due',
        replyToId: row.source_message_id,
        mentionUserId,
      });
      if (!result?.message?.id) throw new Error('Bot did not publish reminder');
      updateReminderSentStmt.run(result.message.id, row.id);
      if (typeof onMessageCreated === 'function') onMessageCreated(result.message);
    } catch (error) {
      const nextStatus = Number(row.attempts || 0) + 1 >= 3 ? 'error' : 'pending';
      updateReminderFailedStmt.run(nextStatus, cleanText(error?.message || 'Reminder delivery failed', 500), row.id);
    }
  }

  async function processDueRule(rule) {
    const now = currentUtc();
    const nextRunAt = computeNextRunAfterDueAttempt(rule, now);
    const check = shouldRunRule(rule);
    if (!check.ok) {
      updateRuleNextStmt.run(nextRunAt, rule.id);
      recordRuleOutcome(rule, { status: 'skipped', reason: check.reason, stage: 'gate' });
      return;
    }
    try {
      const built = await buildRuleInstruction(rule);
      const { result, tries } = await runRuleSyntheticTurn(rule, built.instruction);
      db.transaction(() => {
        if (built.newsSource?.id && Array.isArray(built.newsItems)) {
          for (const item of built.newsItems) {
            if (item?.guid) insertNewsHistoryStmt.run(rule.id, built.newsSource.id, item.guid);
          }
        }
        const isNews = normalizePromptMode(rule.prompt_mode) === 'news_hook';
        updateRuleRunStmt.run(
          nextRunAt,
          isoUtc(currentUtc()),
          isNews ? null : (check.latestHuman?.id || null),
          nextSameContextRunCount(rule, check.latestHuman),
          rule.id
        );
      })();
      recordRuleOutcome(rule, { status: 'sent', reason: 'sent', stage: 'complete', tries });
      if (result?.message && typeof onMessageCreated === 'function') {
        try { onMessageCreated(result.message); } catch (error) {
          logRuleEvent('error', rule, { status: 'publish_hook_failed', stage: 'publish', detail: errorDetail(error) });
        }
      }
    } catch (error) {
      updateRuleNextStmt.run(nextRunAt, rule.id);
      const isNewsSkip = errorCode(error) === 'NO_NEWS_ITEM';
      const reason = isNewsSkip
        ? error.initiativeReason || 'no_recent_news'
        : initiativeErrorReason(error);
      const failedNewsSource = reason === 'news_source_failed';
      recordRuleOutcome(rule, {
        status: isNewsSkip && !failedNewsSource ? 'skipped' : 'failed',
        reason,
        stage: cleanText(error?.stage || (isNewsSkip ? 'news' : 'provider'), 80),
        detail: isNewsSkip && !failedNewsSource ? '' : errorDetail(error),
        tries: Number(error?.initiativeTries || 0),
      });
    }
  }

  async function processDueRulesIndependently(rules, admittedAt = currentUtc()) {
    const tasks = (Array.isArray(rules) ? rules : []).flatMap((rule) => {
      const ruleId = Number(rule?.id || 0);
      if (!ruleId || inFlightRuleIds.has(ruleId)) return [];
      if (isMissedRuleRun(rule, admittedAt)) {
        updateRuleNextStmt.run(computeNextRunAfterDueAttempt(rule, admittedAt), rule.id);
        recordRuleOutcome(rule, { status: 'skipped', reason: 'missed_schedule', stage: 'scheduler' });
        return [];
      }
      inFlightRuleIds.add(ruleId);
      let resolveTask;
      const task = new Promise((resolve) => { resolveTask = resolve; });
      pendingRuleRuns.push({ rule, provider: ruleProvider(rule), resolveTask });
      return [task];
    });
    drainRuleRunQueue();
    await Promise.all(tasks);
  }

  function drainRuleRunQueue() {
    while (activeRuleRunCount < ruleConcurrency && pendingRuleRuns.length) {
      const entryIndex = pendingRuleRuns.findIndex((item) => !activeRuleProviders.has(item.provider));
      if (entryIndex < 0) break;
      const [entry] = pendingRuleRuns.splice(entryIndex, 1);
      activeRuleRunCount += 1;
      activeRuleProviders.add(entry.provider);
      Promise.resolve()
        .then(() => processDueRule(entry.rule))
        .catch((error) => console.warn('[ai-initiative] rule worker failed:', error?.message || error))
        .finally(() => {
          activeRuleRunCount -= 1;
          activeRuleProviders.delete(entry.provider);
          inFlightRuleIds.delete(Number(entry.rule?.id || 0));
          entry.resolveTask();
          drainRuleRunQueue();
        });
    }
  }

  async function runSchedulerTick() {
    if (tickRunning) return;
    tickRunning = true;
    try {
      const nowSql = isoUtc(currentUtc());
      const admittedAt = currentUtc();
      const dueRules = dueRulesStmt.all(nowSql);
      for (const reminder of dueRemindersStmt.all(nowSql)) {
        await processDueReminder(reminder);
      }
      const ruleTask = processDueRulesIndependently(dueRules, admittedAt);
      if (!runRulesInBackground) await ruleTask;
      else ruleTask.catch((error) => console.warn('[ai-initiative] rule batch failed:', error?.message || error));
    } finally {
      tickRunning = false;
    }
  }

  app.get('/api/user/timezone', auth, (req, res) => {
    res.json({ timezone: userTimezone(req.user.id) });
  });

  app.put('/api/user/timezone', auth, (req, res) => {
    const timezone = cleanTimezone(req.body?.timezone, DEFAULT_TIMEZONE);
    db.prepare('UPDATE users SET timezone=? WHERE id=?').run(timezone, req.user.id);
    res.json({ ok: true, timezone });
  });

  app.get('/api/admin/ai-bot-initiatives', auth, adminOnly, (_req, res) => {
    res.json(serializeAdminState());
  });

  app.get('/api/admin/ai-bot-initiatives/news-sources', auth, adminOnly, (_req, res) => {
    res.json({ news_sources: newsSourcesStmt.all().map(serializeNewsSource) });
  });

  app.post('/api/admin/ai-bot-initiatives/news-sources', auth, adminOnly, (req, res) => {
    try {
      const source = saveNewsSource(req.body || {});
      res.json({ source, state: serializeAdminState() });
    } catch (error) {
      res.status(error.status || 400).json({ error: error.message || 'Could not save news source' });
    }
  });

  app.put('/api/admin/ai-bot-initiatives/news-sources/:id(\\d+)', auth, adminOnly, (req, res) => {
    const current = newsSourceByIdStmt.get(Number(req.params.id));
    if (!current) return res.status(404).json({ error: 'News source not found' });
    try {
      const source = saveNewsSource(req.body || {}, current);
      res.json({ source, state: serializeAdminState() });
    } catch (error) {
      res.status(error.status || 400).json({ error: error.message || 'Could not save news source' });
    }
  });

  app.delete('/api/admin/ai-bot-initiatives/news-sources/:id(\\d+)', auth, adminOnly, (req, res) => {
    deleteNewsSourceStmt.run(Number(req.params.id));
    res.json({ ok: true, state: serializeAdminState() });
  });

  app.post('/api/admin/ai-bot-initiatives/news-sources/:id(\\d+)/test', auth, adminOnly, async (req, res) => {
    const source = newsSourceByIdStmt.get(Number(req.params.id));
    if (!source) return res.status(404).json({ error: 'News source not found' });
    try {
      const items = await testNewsSource(source);
      res.json({ ok: true, source: serializeNewsSource(source), items });
    } catch (error) {
      res.status(400).json({ error: error.message || 'News source test failed' });
    }
  });

  app.post('/api/admin/ai-bot-initiatives/rules', auth, adminOnly, (req, res) => {
    try {
      const rule = saveRule(req.body || {});
      res.json({ rule, state: serializeAdminState() });
    } catch (error) {
      res.status(error.status || 400).json({ error: error.message || 'Could not save initiative rule' });
    }
  });

  app.put('/api/admin/ai-bot-initiatives/rules/:id(\\d+)', auth, adminOnly, (req, res) => {
    const current = ruleByIdStmt.get(Number(req.params.id));
    if (!current) return res.status(404).json({ error: 'Rule not found' });
    try {
      const rule = saveRule(req.body || {}, current);
      res.json({ rule, state: serializeAdminState() });
    } catch (error) {
      res.status(error.status || 400).json({ error: error.message || 'Could not save initiative rule' });
    }
  });

  app.delete('/api/admin/ai-bot-initiatives/rules/:id(\\d+)', auth, adminOnly, (req, res) => {
    deleteRuleStmt.run(Number(req.params.id));
    res.json({ ok: true, state: serializeAdminState() });
  });

  app.post('/api/admin/ai-bot-initiatives/rules/:id(\\d+)/test', auth, adminOnly, async (req, res) => {
    const rule = ruleByIdStmt.get(Number(req.params.id));
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    try {
      ensureRuntime(rule.chat_id, rule.bot_id);
      const built = await buildRuleInstruction(rule);
      const result = await aiBotFeature.runSyntheticBotTurn({
        chatId: rule.chat_id,
        botId: rule.bot_id,
        instruction: built.instruction,
        purpose: `initiative_test_${rule.prompt_mode || 'context_question'}`,
        dryRun: true,
        ...syntheticContextOptionsForRule(rule),
      });
      res.json({
        ok: true,
        result: {
          text: result?.text || '',
          news_item: built.newsItem || null,
          news_items: built.newsItems || [],
          news_source: built.newsSource || null,
        },
      });
    } catch (error) {
      res.status(error.status || 400).json({
        error: errorDetail(error, 'Initiative test failed'),
        code: errorCode(error) || 'INITIATIVE_TEST_FAILED',
        stage: cleanText(error?.stage || 'provider', 80),
        retryable: isRetryableInitiativeError(error),
      });
    }
  });

  app.get('/api/chats/:chatId/reminders', auth, (req, res) => {
    const chatId = Number(req.params.chatId);
    if (!hasMembership(chatId, req.user.id)) return res.status(403).json({ error: 'Not a chat member' });
    res.json({ reminders: remindersForUserChatStmt.all(req.user.id, chatId).map(serializeReminder) });
  });

  app.delete('/api/reminders/:id(\\d+)', auth, (req, res) => {
    const row = reminderByIdStmt.get(Number(req.params.id));
    if (!row) return res.status(404).json({ error: 'Reminder not found' });
    if (Number(row.requester_user_id || 0) !== Number(req.user.id || 0) && !req.user.is_admin) {
      return res.status(403).json({ error: 'Not allowed' });
    }
    cancelReminderStmt.run(row.id);
    res.json({ ok: true });
  });

  if (startScheduler) {
    schedulerTimer = setInterval(() => {
      runSchedulerTick().catch((error) => console.warn('[ai-initiative] scheduler failed:', error?.message || error));
    }, Math.max(5_000, Number(schedulerIntervalMs) || 60_000));
    schedulerTimer.unref?.();
    setImmediate(() => runSchedulerTick().catch((error) => console.warn('[ai-initiative] startup tick failed:', error?.message || error)));
  }

  return {
    handleMessageCreated,
    runSchedulerTick,
    stop() {
      if (schedulerTimer) clearInterval(schedulerTimer);
      schedulerTimer = null;
    },
  };
}

module.exports = {
  createAiInitiativeFeature,
  __private: {
    cleanTimezone,
    normalizeTime,
    computeNextRunAt,
    computeNextRunAfterDueAttempt,
    isMissedRuleRun,
    normalizeRuleInput,
    normalizeNewsSourceInput,
    parseNewsFeedXml,
    parseNewsFeedXmlFallback,
    normalizeNewsItem,
    stripHtml,
    minGapElapsed,
    parseDateTimeRule,
    extractReminderText,
    reminderClarificationText,
    looksLikeReminderRequest,
    looksLikeRecurrence,
    dbDateToUtc,
    initiativeFailureText,
    errorStatus,
    errorCode,
    errorDetail,
    retryAfterMs,
    isRetryableInitiativeError,
    shouldRunRule: null,
  },
};
