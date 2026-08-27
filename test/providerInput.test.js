const test = require('node:test');
const assert = require('node:assert/strict');

const {
  utf8ByteLength,
  jsonContentByteLength,
  normalizeProviderText,
  truncateUtf8End,
  truncateUtf8Middle,
  fitSyntheticProviderInput,
} = require('../ai/providerInput');
const { __private: aiPrivate } = require('../ai');

test('normalizeProviderText replaces lone surrogates and unsafe control characters', () => {
  const input = `ok\uD83D\uDE00\uD800\u0000\u0007done\r\nnext`;
  const normalized = normalizeProviderText(input);
  assert.equal(normalized, 'ok😀�  done\nnext');
  assert.doesNotThrow(() => JSON.parse(JSON.stringify({ content: normalized })));
});

test('UTF-8 truncation never splits multibyte symbols and preserves the requested side', () => {
  const input = 'начало-😀-важный-хвост';
  const end = truncateUtf8End(input, 30, '[cut]\n');
  const middle = truncateUtf8Middle(input.repeat(10), 60, '[cut]');
  assert.ok(end.startsWith('[cut]\n'));
  assert.ok(end.endsWith('хвост'));
  assert.ok(utf8ByteLength(end) <= 30);
  assert.ok(utf8ByteLength(middle) <= 60);
  assert.doesNotMatch(end, /[\uD800-\uDFFF](?![\uDC00-\uDFFF])/u);
});

test('synthetic provider input stays below the byte ceiling and keeps news instruction tail', () => {
  const system = `system-start\n${'правило \\ " '.repeat(3000)}\nsystem-tail`;
  const user = `old-context\n${'старое сообщение \\ " '.repeat(3000)}\nCurrent user message:\nNEWS-GUID-123\nADMIN-INSTRUCTION`;
  const fitted = fitSyntheticProviderInput(system, user, { maxBytes: 20_000, systemMaxBytes: 8_000 });

  assert.equal(fitted.truncated, true);
  assert.ok(fitted.totalBytes <= 20_000);
  assert.ok(jsonContentByteLength(fitted.system) + jsonContentByteLength(fitted.user) <= 20_000);
  assert.ok(fitted.system.startsWith('system-start'));
  assert.ok(fitted.system.endsWith('system-tail'));
  assert.ok(fitted.user.endsWith('NEWS-GUID-123\nADMIN-INSTRUCTION'));
  assert.equal(Buffer.byteLength(JSON.stringify({
    input: [
      { role: 'system', content: fitted.system },
      { role: 'user', content: fitted.user },
    ],
  }), 'utf8') < 22_000, true);
});

test('recent chat lines obey the hard character ceiling even when the newest 20 are long', () => {
  const lines = Array.from({ length: 20 }, (_, index) => `message-${index}-${'x'.repeat(1_590)}`);
  const trimmed = aiPrivate.trimRecentLines(lines, 10_000);
  const joined = trimmed.join('\n');

  assert.ok(joined.length <= 10_000);
  assert.ok(trimmed.length < 20);
  assert.ok(trimmed.at(-1).startsWith('message-19-'));
  assert.equal(trimmed.some((line) => line.startsWith('message-0-')), false);
});
