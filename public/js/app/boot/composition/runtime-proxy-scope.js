(function () {
  const root = window.BananzaApp = window.BananzaApp || {};
  const bootRoot = root.boot = root.boot || {};
  const compositionRoot = bootRoot.composition = bootRoot.composition || {};

  compositionRoot.composeRuntimeProxyScope = function composeRuntimeProxyScope(scope = {}) {
    with (scope) {
      function createRuntimeProxyScope() {
        const scope = Object.create(null);
        Object.assign(scope, {
          window, document, console: window.console || console, $, $$,
          Math: window.Math || Math, Date: window.Date || Date, Number: window.Number || Number,
          String: window.String || String, Boolean: window.Boolean || Boolean, Array: window.Array || Array,
          Object: window.Object || Object, Promise: window.Promise || Promise, Set: window.Set || Set,
          Map: window.Map || Map, JSON: window.JSON || JSON, URL: window.URL,
          FormData: window.FormData, Blob: window.Blob, File: window.File, FileReader: window.FileReader,
          localStorage: window.localStorage, sessionStorage: window.sessionStorage, navigator: window.navigator,
          location: window.location, history: window.history,
          alert: window.alert?.bind?.(window), confirm: window.confirm?.bind?.(window),
          fetch: window.fetch?.bind?.(window),
          setTimeout: window.setTimeout?.bind?.(window), clearTimeout: window.clearTimeout?.bind?.(window),
          requestAnimationFrame: window.requestAnimationFrame?.bind?.(window) || ((callback) => window.setTimeout(callback, 16)),
          cancelAnimationFrame: window.cancelAnimationFrame?.bind?.(window) || ((id) => window.clearTimeout(id)),
        });
        return new Proxy(scope, {
          has() { return true; },
          get(target, key) {
            if (key === Symbol.unscopables) return undefined;
            if (Object.prototype.hasOwnProperty.call(target, key)) return target[key];
            if (typeof key === 'string' && key in window) return window[key];
            if (typeof key === 'string' && /^[A-Za-z_$][\w$]*$/.test(key)) {
              try { return eval(key); } catch (error) { return undefined; }
            }
            return undefined;
          },
          set(target, key, value) {
            if (typeof key === 'string' && /^[A-Za-z_$][\w$]*$/.test(key)) {
              const __bananzaAiAdminScopeValue = value;
              try { eval(key + ' = __bananzaAiAdminScopeValue'); return true; } catch (error) {}
            }
            target[key] = value;
            return true;
          },
        });
      }
      return window.BananzaApp.boot.composition.createEvalExports(["createRuntimeProxyScope"], {
        get: (name) => eval(name),
        set: (name, value) => {
          const __bananzaRuntimeExportValue = value;
          eval(name + ' = __bananzaRuntimeExportValue');
        },
      });
    }
  };
})();
