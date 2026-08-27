const path = require('path');

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const Blog = require('./models/Blog');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const { sanitizeRequest } = require('./middleware/sanitizeMiddleware');

const authRoutes = require('./routes/authRoutes');
const entryRoutes = require('./routes/entryRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const blogRoutes = require('./routes/blogRoutes');

/**
 * Pure Express app — no DB connection, no app.listen(). Split out of
 * server.js so tests can `require('./app')` and drive it with Supertest
 * against an isolated in-memory database, without ever touching the real
 * MongoDB connection or binding a port. server.js is the only place that
 * calls connectDB() / app.listen().
 */

const isProduction = process.env.NODE_ENV === 'production';

const app = express();
app.set('etag', false);

if (isProduction) {
  app.set('trust proxy', 1); // ensures req.ip is correct behind a reverse proxy/load balancer (Render, etc.)
}

// --- Security headers ---
// Relaxed CSP for scripts/styles: the frontend is plain HTML/CSS/JS served
// from this same origin plus Google Fonts, not a bundler-based app, so a
// strict default-src 'self' with a couple of explicit allowances covers it
// without breaking the Google Fonts <link>/@import already in use. Also
// allows cdnjs.cloudflare.com, which blog-post.html loads Prism.js and its
// theme CSS from for code-block syntax highlighting.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': ["'self'", 'https://cdnjs.cloudflare.com'],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'img-src': ["'self'", 'data:'],
        'connect-src': ["'self'"],
      },
    },
  })
);

// --- Performance: gzip/deflate compress all responses ---
app.use(compression());

// --- CORS ---
// CLIENT_URL may be a single origin or a comma-separated list, so the same
// backend can serve a same-origin deployment (Render serving the frontend
// too) or a split deployment (frontend on Netlify/Vercel, API on Render).
const allowedOrigins = (
  process.env.CLIENT_URL || 'http://127.0.0.1:5000,http://localhost:5000,http://127.0.0.1:5500,http://localhost:5500'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin/non-browser requests (no Origin header) and any
      // configured origin.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      // Deny by passing `false`, not an Error — an Error hard-fails the
      // request server-side even for same-origin POST/PUT/DELETE calls
      // (browsers attach an Origin header to those regardless).
      callback(null, false);
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --- Sanitize against NoSQL injection ---
// Strips any keys starting with "$" or containing "." from req.body,
// req.query, and req.params, so a payload like { "email": { "$ne": null } }
// can't be used to bypass a Mongoose query. Validation middleware already
// requires these fields to be plain strings, so this is defense-in-depth,
// not the only line of protection.
app.use(sanitizeRequest);

// --- General API rate limiting ---
// A broad safety net across all API routes, separate from and in addition
// to the stricter, login-specific limiter in rateLimitMiddleware.js.
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests, please try again later.' },
  })
);

if (!isProduction && process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// --- Static file serving ---
// Serve uploaded images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve the vanilla JS frontend
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// --- API routes ---
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Developer Diary API is running' });
});
// Never let the browser (or any proxy) cache API responses — this data
// is dynamic and session-specific, and caching it caused a real bug
// (GET /api/auth/me was coming back as a bodyless 304).
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use('/api/auth', authRoutes);
app.use('/api/entries', entryRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/blogs', blogRoutes);

// --- sitemap.xml / feed.xml ---
// Not under /api (these are for search engines and feed readers, not the
// frontend app), so they're plain top-level routes. Both are generated on
// every request rather than cached — traffic here is low enough that a
// couple of extra Mongo queries per hit is a non-issue.
function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

app.get('/sitemap.xml', async (req, res, next) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const staticPages = ['/', '/entries.html', '/blog.html', '/search.html', '/about.html'];
    const posts = await Blog.find({ status: 'published' }).select('slug updatedAt').lean();

    const urls = [
      ...staticPages.map((p) => `  <url><loc>${baseUrl}${p}</loc></url>`),
      ...posts.map(
        (p) =>
          `  <url><loc>${baseUrl}/blog-post.html?slug=${encodeURIComponent(p.slug)}</loc><lastmod>${new Date(
            p.updatedAt
          ).toISOString()}</lastmod></url>`
      ),
    ].join('\n');

    res.set('Content-Type', 'application/xml');
    res.send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
    );
  } catch (error) {
    next(error);
  }
});

app.get('/feed.xml', async (req, res, next) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const posts = await Blog.find({ status: 'published' }).sort({ publishedAt: -1 }).limit(50).lean();

    const items = posts
      .map((p) => {
        const link = `${baseUrl}/blog-post.html?slug=${encodeURIComponent(p.slug)}`;
        return `  <item>
    <title>${escapeXml(p.title)}</title>
    <link>${link}</link>
    <guid>${link}</guid>
    <description>${escapeXml(p.excerpt)}</description>
    <pubDate>${new Date(p.publishedAt || p.createdAt).toUTCString()}</pubDate>
  </item>`;
      })
      .join('\n');

    res.set('Content-Type', 'application/rss+xml');
    res.send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>\n  <title>Olamide Miracle — Blog</title>\n  <link>${baseUrl}/blog.html</link>\n  <description>Articles and write-ups from Olamide Miracle, software developer.</description>\n${items}\n</channel></rss>`
    );
  } catch (error) {
    next(error);
  }
});

// --- 404s for the frontend vs. the API ---
// Anything reaching here didn't match a static file or an /api route.
// /api/* keeps returning JSON (below); everything else gets the styled
// 404 page instead of a bare JSON error blob.
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.status(404).sendFile(path.join(__dirname, '..', 'frontend', '404.html'));
});

// --- Error handling (must be last) ---
app.use(notFound);
app.use(errorHandler);

module.exports = app;
