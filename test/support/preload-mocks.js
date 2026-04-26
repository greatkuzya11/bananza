const { EventEmitter } = require('events');
const Module = require('module');
const https = require('https');

if (process.env.BANANZA_TEST_MOCKS !== '1') {
  return;
}

const originalFetch = typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null;
const originalHttpsGet = https.get.bind(https);
const originalModuleLoad = Module._load;

function jsonResponse(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  });
}

function textResponse(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers,
  });
}

function createPreviewHtml(url) {
  return `<!doctype html>
  <html>
    <head>
      <title>Mock Preview Title</title>
      <meta property="og:title" content="Mock Preview Title">
      <meta property="og:description" content="Mock preview description for ${url}">
      <meta property="og:image" content="https://preview.test/assets/banana.png">
    </head>
    <body>
      <h1>Mock preview</h1>
    </body>
  </html>`;
}

globalThis.fetch = async function mockedFetch(input, init = {}) {
  const url = typeof input === 'string' || input instanceof URL
    ? new URL(String(input))
    : new URL(String(input.url));

  if (url.hostname === 'preview.test') {
    return textResponse(createPreviewHtml(url.href), 200, {
      'content-type': 'text/html; charset=utf-8',
    });
  }

  if ((url.hostname === '127.0.0.1' || url.hostname === 'localhost') && url.pathname.endsWith('/transcribe')) {
    return jsonResponse({
      text: 'Mock Vosk transcript',
      model: 'vosk-model-small-ru-0.22',
    });
  }

  if (url.hostname === 'api.openai.com') {
    if (url.pathname.endsWith('/audio/transcriptions')) {
      return jsonResponse({ text: 'Mock OpenAI transcript' });
    }
    if (url.pathname.endsWith('/models')) {
      return jsonResponse({ data: [{ id: 'gpt-4o-mini-transcribe' }] });
    }
    return jsonResponse({
      id: 'mock-openai-response',
      model: 'gpt-4o-mini',
      output_text: 'Mock OpenAI response',
      choices: [{ message: { content: 'Mock OpenAI response' } }],
      data: [{ url: 'https://preview.test/generated/mock-image.png' }],
    });
  }

  if (url.hostname === 'api.x.ai') {
    if (url.pathname.endsWith('/stt')) {
      return jsonResponse({ text: 'Mock Grok transcript', model: 'speech-to-text' });
    }
    if (url.pathname.endsWith('/models')) {
      return jsonResponse({ data: [{ id: 'grok-2' }, { id: 'speech-to-text' }] });
    }
    return jsonResponse({
      id: 'mock-grok-response',
      model: 'grok-2',
      choices: [{ message: { content: 'Mock Grok response' } }],
      data: [{ url: 'https://preview.test/generated/mock-grok-image.png' }],
    });
  }

  if (url.hostname === 'api.deepseek.com') {
    if (url.pathname.endsWith('/models')) {
      return jsonResponse({ data: [{ id: 'deepseek-chat' }] });
    }
    return jsonResponse({
      id: 'mock-deepseek-response',
      model: 'deepseek-chat',
      choices: [{ message: { content: 'Mock DeepSeek response' } }],
    });
  }

  if (
    url.hostname === 'llm.api.cloud.yandex.net'
    || url.hostname === 'foundation-models.api.cloud.yandex.net'
  ) {
    return jsonResponse({
      result: {
        alternatives: [{ message: { text: 'Mock Yandex response' }, status: 'FINAL' }],
      },
      models: [{ uri: 'gpt://folder/mock-model' }],
    });
  }

  if (originalFetch) {
    return originalFetch(input, init);
  }

  throw new Error(`Unexpected fetch in test sandbox: ${url.href}`);
};

function createMockHttpsResponse(statusCode, payload) {
  const response = new EventEmitter();
  response.statusCode = statusCode;
  response.headers = { 'content-type': 'application/json' };
  response.setEncoding = () => {};
  setImmediate(() => {
    response.emit('data', JSON.stringify(payload));
    response.emit('end');
  });
  return response;
}

https.get = function mockedHttpsGet(url, options, callback) {
  const cb = typeof options === 'function' ? options : callback;
  const parsed = new URL(String(url));

  if (parsed.hostname === 'geocoding-api.open-meteo.com') {
    const query = String(parsed.searchParams.get('name') || '').trim();
    const response = createMockHttpsResponse(200, {
      results: query
        ? [{
            id: 42,
            name: 'Moscow',
            country: 'Russia',
            admin1: 'Moscow',
            latitude: 55.7558,
            longitude: 37.6173,
            timezone: 'Europe/Moscow',
            country_code: 'RU',
            population: 13000000,
          }]
        : [],
    });
    const request = new EventEmitter();
    request.setTimeout = () => request;
    request.destroy = (error) => {
      if (error) request.emit('error', error);
    };
    if (cb) process.nextTick(() => cb(response));
    return request;
  }

  if (parsed.hostname === 'api.open-meteo.com') {
    const response = createMockHttpsResponse(200, {
      current: {
        temperature_2m: 21.5,
        weather_code: 1,
        wind_speed_10m: 4.2,
        is_day: 1,
        time: '2026-04-26T12:00',
      },
    });
    const request = new EventEmitter();
    request.setTimeout = () => request;
    request.destroy = (error) => {
      if (error) request.emit('error', error);
    };
    if (cb) process.nextTick(() => cb(response));
    return request;
  }

  return originalHttpsGet(url, options, callback);
};

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'web-push') {
    return {
      generateVAPIDKeys() {
        return {
          publicKey: 'BNANZA_TEST_PUBLIC_KEY',
          privateKey: 'BNANZA_TEST_PRIVATE_KEY',
        };
      },
      setVapidDetails() {},
      async sendNotification(subscription, payload) {
        const endpoint = String(subscription?.endpoint || '');
        if (endpoint.includes('410')) {
          const error = new Error('Endpoint gone');
          error.statusCode = 410;
          throw error;
        }
        globalThis.__BANANZA_TEST_PUSH_CALLS = globalThis.__BANANZA_TEST_PUSH_CALLS || [];
        globalThis.__BANANZA_TEST_PUSH_CALLS.push({
          endpoint,
          payload,
        });
        return { statusCode: 201 };
      },
    };
  }
  return originalModuleLoad(request, parent, isMain);
};
