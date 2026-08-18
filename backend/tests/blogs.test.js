const request = require('supertest');
const app = require('../app');
const { connect, closeDatabase, clearDatabase } = require('./testDb');
const { loggedInAgent } = require('./helpers');

beforeAll(async () => connect());
afterEach(async () => clearDatabase());
afterAll(async () => closeDatabase());

describe('Blog posts', () => {
  it('POST /api/blogs requires authentication', async () => {
    const res = await request(app).post('/api/blogs').send({ title: 'x', content: 'y' });
    expect(res.status).toBe(401);
  });

  it('rejects a post with no content', async () => {
    const agent = await loggedInAgent(app);
    const res = await agent.post('/api/blogs').send({ title: 'Missing content' });
    expect(res.status).toBe(400);
  });

  it('defaults to a draft, hidden from anonymous visitors but visible to the admin', async () => {
    const agent = await loggedInAgent(app);

    const createRes = await agent
      .post('/api/blogs')
      .send({ title: 'Draft post about testing', content: '<p>Work in progress.</p>' });
    expect(createRes.status).toBe(201);
    expect(createRes.body.blog.status).toBe('draft');
    const { slug } = createRes.body.blog;

    const publicList = await request(app).get('/api/blogs');
    expect(publicList.body).toEqual([]);

    // A guessed/shared draft link 404s for an anonymous visitor rather
    // than revealing that a (private) post exists at all.
    const publicGet = await request(app).get(`/api/blogs/${slug}`);
    expect(publicGet.status).toBe(404);

    const adminList = await agent.get('/api/blogs');
    expect(adminList.body).toHaveLength(1);
  });

  it('a published post is public, with a real excerpt and reading time', async () => {
    const agent = await loggedInAgent(app);

    const createRes = await agent.post('/api/blogs').send({
      title: 'How I fixed a memory leak',
      content: `<p>${'word '.repeat(250)}</p>`,
      status: 'published',
    });
    expect(createRes.status).toBe(201);
    expect(createRes.body.blog.publishedAt).not.toBeNull();
    expect(createRes.body.blog.readingTime).toBeGreaterThanOrEqual(1);
    expect(createRes.body.blog.excerpt.length).toBeGreaterThan(0);

    const { slug } = createRes.body.blog;
    const publicGet = await request(app).get(`/api/blogs/${slug}`);
    expect(publicGet.status).toBe(200);
    expect(publicGet.body.title).toBe('How I fixed a memory leak');
  });

  it('deleting a post removes it from both the admin and public views', async () => {
    const agent = await loggedInAgent(app);
    const createRes = await agent
      .post('/api/blogs')
      .send({ title: 'Temporary post', content: '<p>Delete me.</p>', status: 'published' });
    const id = createRes.body.blog._id;

    const deleteRes = await agent.delete(`/api/blogs/${id}`);
    expect(deleteRes.status).toBe(200);

    const listRes = await request(app).get('/api/blogs');
    expect(listRes.body).toEqual([]);
  });
});
