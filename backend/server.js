const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const authRoutes = require('./routes/authRoutes');
const entryRoutes = require('./routes/entryRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const categoryRoutes = require('./routes/categoryRoutes');

const isProduction = process.env.NODE_ENV === 'production';

// --- Fail fast on unsafe production config ---
// A weak/default/missing JWT secret is the single most damaging
// misconfiguration this app could ship with — anyone who saw the sample
// value in .env.example could forge sessions. Refuse to boot rather than
// run insecurely.
const INSECURE_DEFAULT_SECRETS = ['replace_this_with_a_long_random_secret', 'dev_only_change_me_9f8a7d6c5b4e3f2a1'];

if (isProduction) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error(
      'FATAL: JWT_SECRET is missing or too short for production. Set a random string of 32+ characters.'
    );
    process.exit(1);
  }
  if (INSECURE_DEFAULT_SECRETS.includes(process.env.JWT_SECRET)) {
    console.error('FATAL: JWT_SECRET is still set to a known sample/default value. Change it before deploying.');
    process.exit(1);
  }
}

// Connect to MongoDB
connectDB();

const app = express();
app.set('etag', false);

app.set('trust proxy', 1); // ensures req.ip is correct behind a reverse proxy/load balancer (Render, etc.)

// --- Security headers ---
// Relaxed CSP for scripts/styles: the frontend is plain HTML/CSS/JS served
// from this same origin plus Google Fonts, not a bundler-based app, so a
// strict default-src 'self' with a couple of explicit allowances covers it
// without breaking the Google Fonts <link>/@import already in use.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': ["'self'"],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
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
const allowedOrigins = (process.env.CLIENT_URL || 'http://127.0.0.1:5500')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin/non-browser requests (no Origin header) and any
      // configured origin; reject anything else.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
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
app.use(mongoSanitize());

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

if (!isProduction) {
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

// --- Error handling (must be last) ---
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// --- Graceful shutdown ---
// Platforms like Render send SIGTERM on redeploy/scale-down; closing the
// HTTP server and the MongoDB connection cleanly avoids dropped requests
// and connection leaks.
const shutdown = (signal) => {
  console.log(`${signal} received, shutting down gracefully…`);
  server.close(() => {
    console.log('HTTP server closed.');
    const mongoose = require('mongoose');
    mongoose.connection.close(false).then(() => {
      console.log('MongoDB connection closed.');
      process.exit(0);
    });
  });

  // Force-exit if shutdown hangs for some reason
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
