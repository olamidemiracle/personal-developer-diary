const request = require('supertest');
const app = require('../app');
const { connect, closeDatabase, clearDatabase } = require('./testDb');
const { loggedInAgent } = require('./helpers');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Categories', () => {
  it('GET /api/categories is public', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST /api/categories requires authentication', async () => {
    const res = await request(app).post('/api/categories').send({ name: 'Bug Fixes' });
    expect(res.status).toBe(401);
  });

  it('creates a category with an auto-generated slug when logged in', async () => {
    const agent = await loggedInAgent(app);

    const res = await agent.post('/api/categories').send({ name: 'Bug Fixes' });
    expect(res.status).toBe(201);
    expect(res.body.slug).toBe('bug-fixes');

    const listRes = await request(app).get('/api/categories');
    expect(listRes.body).toHaveLength(1);
  });

  it('rejects a category with no name', async () => {
    const agent = await loggedInAgent(app);
    const res = await agent.post('/api/categories').send({});
    expect(res.status).toBe(400);
  });
});
