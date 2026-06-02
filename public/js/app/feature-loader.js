(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const registry = new Map();
  const scriptPromises = new Map();

  function normalizeName(name) {
    const normalized = String(name || '').trim();
    if (!normalized) throw new Error('Feature name is required');
    return normalized;
  }

  function normalizeScriptSrc(src) {
    const raw = String(src || '').trim();
    if (!raw) throw new Error('Feature script src is required');
    if (/^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) return raw;
    const withoutPublic = raw.startsWith('public/') ? raw.slice('public'.length) : raw;
    if (withoutPublic.startsWith('/')) return withoutPublic;
    return `/${withoutPublic.replace(/^\/+/, '')}`;
  }

  function scriptUrl(src) {
    try {
      return new URL(src, window.location.href);
    } catch {
      return null;
    }
  }

  function sameScriptSrc(left, right) {
    const leftUrl = scriptUrl(left);
    const rightUrl = scriptUrl(right);
    if (!leftUrl || !rightUrl) return String(left) === String(right);
    if (leftUrl.href === rightUrl.href) return true;
    return leftUrl.origin === rightUrl.origin && leftUrl.pathname === rightUrl.pathname;
  }

  function scriptKey(src) {
    const url = scriptUrl(src);
    if (!url) return String(src);
    return `${url.origin}${url.pathname}`;
  }

  function findExistingScript(src) {
    const scripts = document.querySelectorAll('script[src]');
    for (const script of scripts) {
      if (script.dataset.bananzaFeatureStatus === 'failed') continue;
      if (sameScriptSrc(script.getAttribute('src') || script.src, src)) return script;
    }
    return null;
  }

  function cloneState(record) {
    if (!record) return null;
    return {
      name: record.name,
      status: record.status,
      scripts: record.scripts.slice(),
      loadedScripts: record.loadedScripts.slice(),
      preload: record.options?.preload || null,
      error: record.error,
    };
  }

  function requireFeature(name) {
    const normalized = normalizeName(name);
    const record = registry.get(normalized);
    if (!record) throw new Error(`Feature "${normalized}" is not registered`);
    return record;
  }

  function markFeature(name, suffix) {
    root.performance?.mark?.(`bananza:feature-load:${name}:${suffix}`);
  }

  function markFeaturePreload(name, suffix) {
    root.performance?.mark?.(`bananza:feature-preload:${name}:${suffix}`);
  }

  function measureFeature(name) {
    root.performance?.measure?.(
      `bananza:feature-load:${name}`,
      `bananza:feature-load:${name}:start`,
      `bananza:feature-load:${name}:end`
    );
  }

  function measureFeaturePreload(name) {
    root.performance?.measure?.(
      `bananza:feature-preload:${name}`,
      `bananza:feature-preload:${name}:start`,
      `bananza:feature-preload:${name}:end`
    );
  }

  function featureStrategies(record) {
    const value = record?.options?.preload;
    const values = Array.isArray(value) ? value : [value];
    return values.map((item) => String(item || '').trim()).filter(Boolean);
  }

  function registerFeature(name, scripts, options = {}) {
    const normalized = normalizeName(name);
    if (!Array.isArray(scripts) || !scripts.length) {
      throw new Error(`Feature "${normalized}" must provide scripts`);
    }
    const nextScripts = scripts.map(normalizeScriptSrc);
    const existing = registry.get(normalized);
    if (existing) {
      existing.scripts = nextScripts;
      existing.options = { ...(options || {}) };
      return cloneState(existing);
    }
    const record = {
      name: normalized,
      status: 'registered',
      scripts: nextScripts,
      loadedScripts: [],
      error: null,
      promise: null,
      preloadPromise: null,
      options: { ...(options || {}) },
    };
    registry.set(normalized, record);
    return cloneState(record);
  }

  function appendScript(record, src) {
    const existing = findExistingScript(src);
    if (existing) {
      const key = scriptKey(src);
      const pending = existing.dataset.bananzaFeatureStatus === 'loading'
        ? scriptPromises.get(key)
        : null;
      if (pending) {
        return pending.then(() => {
          if (!record.loadedScripts.some((loaded) => sameScriptSrc(loaded, src))) {
            record.loadedScripts.push(src);
          }
          return src;
        });
      }
      if (!record.loadedScripts.some((loaded) => sameScriptSrc(loaded, src))) {
        record.loadedScripts.push(src);
      }
      return Promise.resolve(src);
    }

    const key = scriptKey(src);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.dataset.bananzaFeature = record.name;
      script.dataset.bananzaFeatureStatus = 'loading';
      script.onload = () => {
        script.dataset.bananzaFeatureStatus = 'loaded';
        record.loadedScripts.push(src);
        resolve(src);
      };
      script.onerror = () => {
        script.dataset.bananzaFeatureStatus = 'failed';
        reject(new Error(`Failed to load feature "${record.name}" script ${src}`));
      };
      (document.head || document.documentElement).appendChild(script);
    }).finally(() => {
      scriptPromises.delete(key);
    });
    scriptPromises.set(key, promise);
    return promise;
  }

  async function loadFeatureScripts(record) {
    for (const src of record.scripts) {
      await appendScript(record, src);
    }
    return cloneState(record);
  }

  function loadFeature(name) {
    const record = requireFeature(name);
    if (record.status === 'loaded') return Promise.resolve(cloneState(record));
    if (record.status === 'loading' && record.promise) return record.promise;

    record.status = 'loading';
    record.error = null;
    record.loadedScripts = [];
    markFeature(record.name, 'start');

    record.promise = loadFeatureScripts(record)
      .then(() => {
        record.status = 'loaded';
        record.error = null;
        markFeature(record.name, 'end');
        measureFeature(record.name);
        return cloneState(record);
      })
      .catch((error) => {
        record.status = 'failed';
        record.error = error && error.message || String(error || 'Feature load failed');
        markFeature(record.name, 'failed');
        throw error;
      })
      .finally(() => {
        record.promise = null;
        record.preloadPromise = null;
      });

    return record.promise;
  }

  function preloadFeature(name) {
    const record = requireFeature(name);
    if (record.status === 'loaded') return Promise.resolve(cloneState(record));
    if (record.preloadPromise) return record.preloadPromise;
    markFeaturePreload(record.name, 'start');
    record.preloadPromise = new Promise((resolve, reject) => {
      const schedule = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 0));
      schedule(() => {
        loadFeature(record.name).then((state) => {
          markFeaturePreload(record.name, 'end');
          measureFeaturePreload(record.name);
          resolve(state);
        }, (error) => {
          markFeaturePreload(record.name, 'failed');
          reject(error);
        });
      });
    });
    return record.preloadPromise;
  }

  function preloadByStrategy(strategy) {
    const normalized = String(strategy || '').trim();
    if (!normalized) return Promise.resolve([]);
    const records = Array.from(registry.values())
      .filter((record) => featureStrategies(record).includes(normalized));
    return Promise.all(records.map((record) => {
      return preloadFeature(record.name).catch((error) => ({
        name: record.name,
        status: 'failed',
        scripts: record.scripts.slice(),
        loadedScripts: record.loadedScripts.slice(),
        preload: record.options?.preload || null,
        error: error && error.message || String(error || 'Feature preload failed'),
      }));
    }));
  }

  function isFeatureLoaded(name) {
    const record = registry.get(normalizeName(name));
    return Boolean(record && record.status === 'loaded');
  }

  function getFeatureState(name) {
    return cloneState(registry.get(normalizeName(name)));
  }

  function getRegisteredFeatures() {
    return Array.from(registry.values()).map(cloneState);
  }

  function resetForTests() {
    registry.clear();
    scriptPromises.clear();
  }

  root.featureLoader = {
    registerFeature,
    loadFeature,
    preloadFeature,
    preloadByStrategy,
    isFeatureLoaded,
    getFeatureState,
    getRegisteredFeatures,
    resetForTests,
  };
})();
