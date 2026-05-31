(function () {
  'use strict';

  const root = window.BananzaApp = window.BananzaApp || {};
  const registry = root.__registry && typeof root.__registry === 'object'
    ? root.__registry
    : {
      order: [],
      byName: Object.create(null),
    };

  try {
    Object.defineProperty(root, '__registry', {
      configurable: true,
      enumerable: false,
      writable: true,
      value: registry,
    });
  } catch {
    root.__registry = registry;
  }

  function normalizeName(name) {
    const normalized = String(name || '').trim();
    if (!normalized) throw new Error('BananzaApp module name is required');
    return normalized;
  }

  function assertInstaller(installer) {
    if (typeof installer !== 'function') {
      throw new Error('BananzaApp module installer must be a function');
    }
  }

  function getRecord(name) {
    return registry.byName[normalizeName(name)] || null;
  }

  function register(name, installer) {
    const normalizedName = normalizeName(name);
    assertInstaller(installer);
    if (registry.byName[normalizedName]) {
      throw new Error(`BananzaApp module "${normalizedName}" is already registered`);
    }
    registry.byName[normalizedName] = {
      name: normalizedName,
      installer,
      installed: false,
      result: undefined,
    };
    registry.order.push(normalizedName);
    return root;
  }

  function install(name, ctx) {
    const normalizedName = normalizeName(name);
    const record = registry.byName[normalizedName];
    if (!record) {
      throw new Error(`BananzaApp module "${normalizedName}" is not registered`);
    }
    if (record.installed) return record.result;
    const result = record.installer(ctx);
    record.result = result;
    record.installed = true;
    return result;
  }

  function installAll(ctx, order) {
    const names = order == null ? registry.order.slice() : order;
    if (!Array.isArray(names)) {
      throw new Error('BananzaApp installAll order must be an array');
    }
    const results = {};
    names.forEach((name) => {
      const normalizedName = normalizeName(name);
      results[normalizedName] = root.install(normalizedName, ctx);
    });
    return results;
  }

  function get(name) {
    const record = getRecord(name);
    return record && record.installed ? record.result : undefined;
  }

  function has(name) {
    return Boolean(getRecord(name));
  }

  function list() {
    return registry.order.slice();
  }

  if (typeof root.register !== 'function') root.register = register;
  if (typeof root.install !== 'function') root.install = install;
  if (typeof root.installAll !== 'function') root.installAll = installAll;
  if (typeof root.get !== 'function') root.get = get;
  if (typeof root.has !== 'function') root.has = has;
  if (typeof root.list !== 'function') root.list = list;
})();
