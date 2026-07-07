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

module.exports = { protect };
