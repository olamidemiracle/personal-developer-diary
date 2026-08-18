const request = require('supertest');
const app = require('../app');
const { connect, closeDatabase, clearDatabase } = require('./testDb');
const { loggedInAgent } = require('./helpers');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Diary entries', () => {
  it('GET /api/entries is public and starts empty', async () => {
    const res = await request(app).get('/api/entries');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST /api/entries requires authentication', async () => {
    const res = await request(app).post('/api/entries').send({ title: 'Test entry', workedOn: 'stuff' });
    expect(res.status).toBe(401);
  });

  it('rejects a POST missing the required "workedOn" field', async () => {
    const agent = await loggedInAgent(app);
    const res = await agent.post('/api/entries').send({ title: 'Test entry' });
    expect(res.status).toBe(400);
  });

  it('creates, lists, updates, and deletes an entry end to end', async () => {
    const agent = await loggedInAgent(app);

    const createRes = await agent
      .post('/api/entries')
      .send({ title: 'Fixed the login bug', workedOn: 'Chased down a race condition in the auth middleware.' });
    expect(createRes.status).toBe(201);
    const entryId = createRes.body.entry._id;

    const listRes = await request(app).get('/api/entries');
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].title).toBe('Fixed the login bug');

    const updateRes = await agent.put(`/api/entries/${entryId}`).send({
      title: 'Fixed the login bug (for real this time)',
      workedOn: 'Same as before, plus a regression test.',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.entry.title).toBe('Fixed the login bug (for real this time)');

    const deleteRes = await agent.delete(`/api/entries/${entryId}`);
    expect(deleteRes.status).toBe(200);

    const finalList = await request(app).get('/api/entries');
    expect(finalList.body).toHaveLength(0);
  });

  it('404s when updating an entry that does not exist', async () => {
    const agent = await loggedInAgent(app);
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await agent
      .put(`/api/entries/${fakeId}`)
      .send({ title: 'A valid title', workedOn: 'Something' });
    expect(res.status).toBe(404);
  });
});
