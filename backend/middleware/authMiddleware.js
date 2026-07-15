const jwt = require('jsonwebtoken');
const Administrator = require('../models/Administrator');

/**
 * Protects routes by requiring a valid JWT, sent either as:
 *  - an httpOnly cookie (JWT_COOKIE_NAME), or
 *  - an Authorization: Bearer <token> header.
 * Attaches the authenticated administrator to req.user (password excluded).
 */
const protect = async (req, res, next) => {
  try {
    let token;

    const cookieName = process.env.JWT_COOKIE_NAME || 'diary_token';
    const authHeader = req.headers.authorization;

    if (req.cookies && req.cookies[cookieName]) {
      token = req.cookies[cookieName];
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorized, no token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const admin = await Administrator.findById(decoded.id);
    if (!admin) {
      return res.status(401).json({ message: 'Not authorized, account no longer exists' });
    }

    req.user = admin;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Session expired, please log in again' });
    }
    return res.status(401).json({ message: 'Not authorized, invalid token' });
  }
};

/**
 * Like `protect`, but never blocks the request. If a valid JWT is present
 * (cookie or Bearer header), attaches the administrator to req.user; if
 * not, or if the token is invalid/expired, simply continues with
 * req.user left undefined.
 *
 * Used only by the blog feature's public read routes, so the same
 * endpoint can serve two audiences from one code path: a logged-in
 * administrator sees drafts too, while an anonymous visitor sees only
 * published posts. Nothing about `protect` itself changes.
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    const cookieName = process.env.JWT_COOKIE_NAME || 'diary_token';
    const authHeader = req.headers.authorization;

    if (req.cookies && req.cookies[cookieName]) {
      token = req.cookies[cookieName];
    } else if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) return next();

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Administrator.findById(decoded.id);
    if (admin) req.user = admin;

    next();
  } catch (_err) {
    next(); // invalid/expired token — proceed as an anonymous visitor
  }
};

module.exports = { protect, optionalAuth };
