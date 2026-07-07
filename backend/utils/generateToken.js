const jwt = require('jsonwebtoken');

/**
 * Signs a JWT for a given user id.
 * @param {string} userId - Mongo ObjectId of the user.
 * @returns {string} signed JWT
 */
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

/**
 * Attaches the JWT to the response as an httpOnly cookie.
 * @param {import('express').Response} res
 * @param {string} token
 */
const setTokenCookie = (res, token) => {
  const cookieName = process.env.JWT_COOKIE_NAME || 'diary_token';

  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

/**
 * Clears the auth cookie on logout.
 * @param {import('express').Response} res
 */
const clearTokenCookie = (res) => {
  const cookieName = process.env.JWT_COOKIE_NAME || 'diary_token';

  res.cookie(cookieName, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(0),
  });
};

module.exports = { generateToken, setTokenCookie, clearTokenCookie };
