const request = require('supertest');
const app = require('../app');
const { connect, closeDatabase } = require('./testDb');

beforeAll(async () => connect());
afterAll(async () => closeDatabase());

describe('GET /api/health', () => {
  it('reports ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
