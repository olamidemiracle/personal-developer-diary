module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/env.setup.js'],
  testMatch: ['**/tests/**/*.test.js'],
  // mongodb-memory-server downloads/starts a real mongod binary, which can
  // be slow on a cold cache — give it more headroom than Jest's 5s default.
  testTimeout: 30000,
};
