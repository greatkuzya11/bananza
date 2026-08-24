const test = require('node:test');
const assert = require('node:assert/strict');

const { installNetworkSafety } = require('../networkSafety');

test('network safety ignores only the known setTypeOfService EINVAL', () => {
  const socket = {
    setTypeOfService() {
      const error = new Error('setTypeOfService EINVAL');
      error.code = 'EINVAL';
      error.syscall = 'setTypeOfService';
      throw error;
    },
  };
  const warnings = [];

  assert.equal(installNetworkSafety({ socketPrototype: socket, warn: (message) => warnings.push(message) }), true);
  assert.equal(socket.setTypeOfService(0), socket);
  assert.deepEqual(warnings, ['[network] ignored socket setTypeOfService EINVAL']);
});

test('network safety rethrows non-matching socket errors', () => {
  const socket = {
    setTypeOfService() {
      const error = new Error('permission denied');
      error.code = 'EPERM';
      error.syscall = 'setTypeOfService';
      throw error;
    },
  };

  installNetworkSafety({ socketPrototype: socket, warn: () => assert.fail('must not warn') });
  assert.throws(() => socket.setTypeOfService(0), { code: 'EPERM', syscall: 'setTypeOfService' });
});

test('network safety does not suppress EINVAL from another syscall', () => {
  const socket = {
    setTypeOfService() {
      const error = new Error('invalid argument');
      error.code = 'EINVAL';
      error.syscall = 'connect';
      throw error;
    },
  };

  installNetworkSafety({ socketPrototype: socket, warn: () => assert.fail('must not warn') });
  assert.throws(() => socket.setTypeOfService(0), { code: 'EINVAL', syscall: 'connect' });
});

test('network safety installation is idempotent', () => {
  let calls = 0;
  const socket = {
    setTypeOfService() {
      calls += 1;
      return this;
    },
  };

  assert.equal(installNetworkSafety({ socketPrototype: socket }), true);
  const wrapped = socket.setTypeOfService;
  assert.equal(installNetworkSafety({ socketPrototype: socket }), false);
  assert.equal(socket.setTypeOfService, wrapped);
  assert.equal(socket.setTypeOfService(0), socket);
  assert.equal(calls, 1);
});
