/**
 * Runs before the test framework loads. Sets fixed, throwaway env values
 * for anything the app reads from process.env, so tests never depend on
 * (or risk touching) the real backend/.env — which points at the
 * production MongoDB Atlas cluster. testDb.js overrides MONGO_URI-adjacent
 * concerns entirely by connecting mongoose directly to an in-memory server,
 * but everything else the app needs (JWT signing, cookie name, CORS
 * origin) still comes from here.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-do-not-use-in-production-0000000000';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_COOKIE_NAME = 'diary_token';
process.env.CLIENT_URL = 'http://127.0.0.1:5000';
