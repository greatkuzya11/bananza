(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};

  function createApiService(ctx) {
    const state = ctx?.state || {};
    const options = {
      getToken: () => state.getToken?.() || state.token || localStorage.getItem('token'),
      onUnauthorized: null,
      tx: ctx?.tx || ((text) => String(text == null ? '' : text)),
    };

    async function request(url, opts = {}) {
      const requestOptions = { ...opts };
      const headers = { ...(requestOptions.headers || {}) };
      const token = options.getToken?.() || '';
      if (token) headers.Authorization = 'Bearer ' + token;
      if (requestOptions.body && !(requestOptions.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        requestOptions.body = JSON.stringify(requestOptions.body);
      }

      const res = await fetch(url, { ...requestOptions, headers });
      if (res.status === 204) return null;
      const contentType = res.headers.get('content-type') || '';
      let data = null;
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const rawText = await res.text();
        const plainText = rawText
          .replace(/<script[\s\S]*?<\/script>/gi, ' ')
          .replace(/<style[\s\S]*?<\/style>/gi, ' ')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        data = { error: plainText || res.statusText || 'Unexpected server response' };
      }

      if (!res.ok) {
        if (res.status === 401) {
          options.onUnauthorized?.();
          return undefined;
        }
        const error = new Error(options.tx(data?.error || `HTTP ${res.status}`));
        error.status = res.status;
        error.serverError = data?.error || '';
        throw error;
      }
      if (!contentType.includes('application/json')) {
        throw new Error(options.tx(data?.error || 'Unexpected server response'));
      }
      return data;
    }

    function configure(nextOptions = {}) {
      if (typeof nextOptions.getToken === 'function') options.getToken = nextOptions.getToken;
      if (typeof nextOptions.onUnauthorized === 'function') options.onUnauthorized = nextOptions.onUnauthorized;
      if (typeof nextOptions.tx === 'function') options.tx = nextOptions.tx;
      return service;
    }

    const service = {
      configure,
      request,
      api: request,
    };
    return service;
  }

  bootRoot.createApiService = createApiService;
})();
