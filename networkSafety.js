const net = require('node:net');

const TYPE_OF_SERVICE_PATCH = Symbol.for('bananza.networkSafety.typeOfServicePatch');

function isIgnoredTypeOfServiceError(error) {
  return error?.code === 'EINVAL' && error?.syscall === 'setTypeOfService';
}

function installNetworkSafety({ socketPrototype = net.Socket.prototype, warn = console.warn } = {}) {
  if (!socketPrototype || typeof socketPrototype.setTypeOfService !== 'function') return false;
  if (socketPrototype[TYPE_OF_SERVICE_PATCH]) return false;

  const original = socketPrototype.setTypeOfService;
  function safeSetTypeOfService(...args) {
    try {
      return original.apply(this, args);
    } catch (error) {
      if (!isIgnoredTypeOfServiceError(error)) throw error;
      try {
        warn('[network] ignored socket setTypeOfService EINVAL');
      } catch {}
      return this;
    }
  }

  Object.defineProperty(socketPrototype, TYPE_OF_SERVICE_PATCH, {
    value: true,
    configurable: true,
  });
  socketPrototype.setTypeOfService = safeSetTypeOfService;
  return true;
}

module.exports = {
  installNetworkSafety,
  isIgnoredTypeOfServiceError,
};
