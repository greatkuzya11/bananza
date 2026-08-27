const SYNTHETIC_INPUT_MAX_BYTES = 20_000;
const SYNTHETIC_SYSTEM_MAX_BYTES = 8_000;

function utf8ByteLength(value) {
  return Buffer.byteLength(String(value || ''), 'utf8');
}

function jsonContentByteLength(value) {
  const serialized = JSON.stringify(String(value || ''));
  return Math.max(0, Buffer.byteLength(serialized, 'utf8') - 2);
}

function normalizeProviderText(value) {
  const source = String(value ?? '').replace(/\r\n?/g, '\n');
  let text = '';
  for (const symbol of source) {
    const codePoint = symbol.codePointAt(0);
    text += codePoint >= 0xD800 && codePoint <= 0xDFFF ? '\uFFFD' : symbol;
  }
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ');
}

function takeUtf8Start(value, maxBytes) {
  const limit = Math.max(0, Math.floor(Number(maxBytes) || 0));
  if (!limit) return '';
  const text = String(value || '');
  if (utf8ByteLength(text) <= limit) return text;
  let result = '';
  let bytes = 0;
  for (const symbol of text) {
    const symbolBytes = utf8ByteLength(symbol);
    if (bytes + symbolBytes > limit) break;
    result += symbol;
    bytes += symbolBytes;
  }
  return result;
}

function takeUtf8End(value, maxBytes) {
  const limit = Math.max(0, Math.floor(Number(maxBytes) || 0));
  if (!limit) return '';
  const text = String(value || '');
  if (utf8ByteLength(text) <= limit) return text;
  const symbols = Array.from(text);
  const result = [];
  let bytes = 0;
  for (let index = symbols.length - 1; index >= 0; index -= 1) {
    const symbol = symbols[index];
    const symbolBytes = utf8ByteLength(symbol);
    if (bytes + symbolBytes > limit) break;
    result.push(symbol);
    bytes += symbolBytes;
  }
  return result.reverse().join('');
}

function truncateUtf8End(value, maxBytes, marker = '[Earlier context omitted]\n') {
  const text = String(value || '');
  const limit = Math.max(0, Math.floor(Number(maxBytes) || 0));
  if (utf8ByteLength(text) <= limit) return text;
  const safeMarker = takeUtf8Start(marker, limit);
  const remaining = Math.max(0, limit - utf8ByteLength(safeMarker));
  return `${safeMarker}${takeUtf8End(text, remaining)}`;
}

function truncateUtf8Middle(value, maxBytes, marker = '\n[Middle of system prompt omitted]\n') {
  const text = String(value || '');
  const limit = Math.max(0, Math.floor(Number(maxBytes) || 0));
  if (utf8ByteLength(text) <= limit) return text;
  const safeMarker = takeUtf8Start(marker, limit);
  const remaining = Math.max(0, limit - utf8ByteLength(safeMarker));
  const startBudget = Math.floor(remaining * 0.4);
  const endBudget = remaining - startBudget;
  return `${takeUtf8Start(text, startBudget)}${safeMarker}${takeUtf8End(text, endBudget)}`;
}

function takeJsonStart(value, maxBytes) {
  const limit = Math.max(0, Math.floor(Number(maxBytes) || 0));
  if (!limit) return '';
  const text = String(value || '');
  if (jsonContentByteLength(text) <= limit) return text;
  let result = '';
  let bytes = 0;
  for (const symbol of text) {
    const symbolBytes = jsonContentByteLength(symbol);
    if (bytes + symbolBytes > limit) break;
    result += symbol;
    bytes += symbolBytes;
  }
  return result;
}

function takeJsonEnd(value, maxBytes) {
  const limit = Math.max(0, Math.floor(Number(maxBytes) || 0));
  if (!limit) return '';
  const text = String(value || '');
  if (jsonContentByteLength(text) <= limit) return text;
  const symbols = Array.from(text);
  const result = [];
  let bytes = 0;
  for (let index = symbols.length - 1; index >= 0; index -= 1) {
    const symbol = symbols[index];
    const symbolBytes = jsonContentByteLength(symbol);
    if (bytes + symbolBytes > limit) break;
    result.push(symbol);
    bytes += symbolBytes;
  }
  return result.reverse().join('');
}

function truncateJsonEnd(value, maxBytes, marker = '[Earlier context omitted]\n') {
  const text = String(value || '');
  const limit = Math.max(0, Math.floor(Number(maxBytes) || 0));
  if (jsonContentByteLength(text) <= limit) return text;
  const safeMarker = takeJsonStart(marker, limit);
  const remaining = Math.max(0, limit - jsonContentByteLength(safeMarker));
  return `${safeMarker}${takeJsonEnd(text, remaining)}`;
}

function truncateJsonMiddle(value, maxBytes, marker = '\n[Middle of system prompt omitted]\n') {
  const text = String(value || '');
  const limit = Math.max(0, Math.floor(Number(maxBytes) || 0));
  if (jsonContentByteLength(text) <= limit) return text;
  const safeMarker = takeJsonStart(marker, limit);
  const remaining = Math.max(0, limit - jsonContentByteLength(safeMarker));
  const startBudget = Math.floor(remaining * 0.4);
  const endBudget = remaining - startBudget;
  return `${takeJsonStart(text, startBudget)}${safeMarker}${takeJsonEnd(text, endBudget)}`;
}

function fitSyntheticProviderInput(system, user, {
  maxBytes = SYNTHETIC_INPUT_MAX_BYTES,
  systemMaxBytes = SYNTHETIC_SYSTEM_MAX_BYTES,
} = {}) {
  const safeSystem = normalizeProviderText(system);
  const safeUser = normalizeProviderText(user);
  const originalSystemBytes = jsonContentByteLength(safeSystem);
  const originalUserBytes = jsonContentByteLength(safeUser);
  const totalBudget = Math.max(1_000, Math.floor(Number(maxBytes) || SYNTHETIC_INPUT_MAX_BYTES));
  const wrapperBytes = Buffer.byteLength(JSON.stringify([
    { role: 'system', content: '' },
    { role: 'user', content: '' },
  ]), 'utf8');
  const contentBudget = Math.max(0, totalBudget - wrapperBytes);
  const systemBudget = Math.min(
    contentBudget,
    Math.max(1_000, Math.floor(Number(systemMaxBytes) || SYNTHETIC_SYSTEM_MAX_BYTES))
  );
  const fittedSystem = truncateJsonMiddle(safeSystem, systemBudget);
  const fittedSystemBytes = jsonContentByteLength(fittedSystem);
  const userBudget = Math.max(0, contentBudget - fittedSystemBytes);
  const fittedUser = truncateJsonEnd(safeUser, userBudget);
  const fittedUserBytes = jsonContentByteLength(fittedUser);
  const totalBytes = Buffer.byteLength(JSON.stringify([
    { role: 'system', content: fittedSystem },
    { role: 'user', content: fittedUser },
  ]), 'utf8');

  return {
    system: fittedSystem,
    user: fittedUser,
    truncated: fittedSystemBytes < originalSystemBytes || fittedUserBytes < originalUserBytes,
    originalSystemBytes,
    originalUserBytes,
    systemBytes: fittedSystemBytes,
    userBytes: fittedUserBytes,
    totalBytes,
  };
}

module.exports = {
  SYNTHETIC_INPUT_MAX_BYTES,
  SYNTHETIC_SYSTEM_MAX_BYTES,
  utf8ByteLength,
  jsonContentByteLength,
  normalizeProviderText,
  takeUtf8Start,
  takeUtf8End,
  truncateUtf8End,
  truncateUtf8Middle,
  takeJsonStart,
  takeJsonEnd,
  truncateJsonEnd,
  truncateJsonMiddle,
  fitSyntheticProviderInput,
};
