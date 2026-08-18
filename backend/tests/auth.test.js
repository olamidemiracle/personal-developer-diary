const request = require('supertest');
const app = require('../app');
const { connect, closeDatabase, clearDatabase } = require('./testDb');
const { TEST_ADMIN, createAdmin, loggedInAgent } = require('./helpers');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials and sets a session cookie', async () => {
    await createAdmin();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_ADMIN.email, password: TEST_ADMIN.password });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(TEST_ADMIN.email);
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('rejects a wrong password without revealing which field was wrong', async () => {
    await createAdmin();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_ADMIN.email, password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('rejects an unknown email with the same generic message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('rejects a malformed request body before touching the database', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('rejects a request with no session', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it("returns the logged-in admin's own profile", async () => {
    const agent = await loggedInAgent(app);
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(TEST_ADMIN.email);
  });
});
