/**
 * Strips MongoDB operator-injection keys from incoming request data.
 *
 * Written by hand instead of using the `express-mongo-sanitize` package:
 * that package tries to reassign `req.query` as a whole new object, but
 * since Express 4.18, `req.query` is a getter-only accessor — assigning
 * to it throws on every single request. This version mutates `req.body`,
 * `req.query`, and `req.params` **in place** instead, which works
 * regardless of Express version.
 */

function sanitizeInPlace(obj) {
  if (!obj || typeof obj !== 'object') return;

  for (const key of Object.keys(obj)) {
    if (key.startsWith('$') || key.includes('.')) {
      delete obj[key];
      continue;
    }

    const value = obj[key];
    if (value && typeof value === 'object') {
      sanitizeInPlace(value);
    }
  }
}

const sanitizeRequest = (req, res, next) => {
  sanitizeInPlace(req.body);
  sanitizeInPlace(req.query);
  sanitizeInPlace(req.params);
  next();
};

module.exports = { sanitizeRequest };
