(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};

  function objectOrDefault(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function fallbackT(key) {
    return String(key || '');
  }

  function fallbackTx(text) {
    return String(text == null ? '' : text);
  }

  function createEvents(seed) {
    const events = objectOrDefault(seed);
    const listeners = Object.create(null);

    events.on = function on(type, listener) {
      const eventType = String(type || '').trim();
      if (!eventType) throw new Error('BananzaApp event type is required');
      if (typeof listener !== 'function') {
        throw new Error('BananzaApp event listener must be a function');
      }
      if (!listeners[eventType]) listeners[eventType] = [];
      listeners[eventType].push(listener);
      return function unsubscribe() {
        events.off(eventType, listener);
      };
    };

    events.off = function off(type, listener) {
      const eventType = String(type || '').trim();
      const bucket = listeners[eventType];
      if (!bucket || typeof listener !== 'function') return events;
      const index = bucket.indexOf(listener);
      if (index !== -1) bucket.splice(index, 1);
      if (!bucket.length) delete listeners[eventType];
      return events;
    };

    events.emit = function emit(type, payload) {
      const eventType = String(type || '').trim();
      const bucket = listeners[eventType];
      if (!bucket || !bucket.length) return events;
      bucket.slice().forEach((listener) => listener(payload, eventType));
      return events;
    };

    return events;
  }

  function createContext(options) {
    const source = objectOrDefault(options);
    return {
      config: objectOrDefault(source.config),
      state: objectOrDefault(source.state),
      dom: objectOrDefault(source.dom),
      services: objectOrDefault(source.services),
      actions: objectOrDefault(source.actions),
      bridge: objectOrDefault(source.bridge),
      events: createEvents(source.events),
      t: typeof source.t === 'function' ? source.t : fallbackT,
      tx: typeof source.tx === 'function' ? source.tx : fallbackTx,
    };
  }

  if (typeof root.createContext !== 'function') root.createContext = createContext;
})();
