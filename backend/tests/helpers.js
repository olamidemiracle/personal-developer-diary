const request = require('supertest');
const Administrator = require('../models/Administrator');

/**
 * Shared fixtures/helpers for API tests. There's no public registration
 * route (this app has exactly one admin, seeded outside the API — see
 * seed/createAdmin.js), so tests create the Administrator document
 * directly against the in-memory DB instead.
 */

const TEST_ADMIN = {
  username: 'testadmin',
  email: 'admin@example.com',
  password: 'password123',
};

async function createAdmin(overrides = {}) {
  return Administrator.create({ ...TEST_ADMIN, ...overrides });
}

/** Creates the test admin and returns a cookie-carrying agent already logged in. */
async function loggedInAgent(app, credentials = TEST_ADMIN) {
  await createAdmin(credentials);
  const agent = request.agent(app);
  await agent.post('/api/auth/login').send({ email: credentials.email, password: credentials.password });
  return agent;
}

module.exports = { TEST_ADMIN, createAdmin, loggedInAgent };
