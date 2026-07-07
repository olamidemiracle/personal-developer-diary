const Administrator = require('../models/Administrator');
const { generateToken, setTokenCookie, clearTokenCookie } = require('../utils/generateToken');
const { recordFailedAttempt, clearAttempts } = require('../middleware/rateLimitMiddleware');

/**
 * There is intentionally NO registerUser here. This app has exactly one
 * administrator account, created only via `npm run seed` (see
 * backend/seed/createAdmin.js). Visitors cannot create accounts.
 */

// @desc    Authenticate the administrator & start a session
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // select('+password') because the schema hides password by default
    const admin = await Administrator.findOne({ email }).select('+password');

    // Same generic message whether the email doesn't match or the
    // password is wrong — avoids leaking which one was incorrect.
    if (!admin || !(await admin.comparePassword(password))) {
      recordFailedAttempt(req);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    clearAttempts(req);

    admin.lastLoginAt = new Date();
    await admin.save();

    const token = generateToken(admin._id);
    setTokenCookie(res, token);

    res.status(200).json({
      message: 'Logged in successfully',
      user: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        lastLoginAt: admin.lastLoginAt,
      },
      // Token is also returned in the body so the frontend/API consumers
      // that can't use cookies (e.g. mobile clients) can send it as a
      // Bearer token instead.
      token,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Log out the administrator (clear the session cookie)
// @route   POST /api/auth/logout
// @access  Private
const logoutUser = async (req, res, next) => {
  try {
    clearTokenCookie(res);
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Get the currently authenticated administrator's profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    // req.user is attached by the `protect` middleware
    res.status(200).json({
      id: req.user._id,
      username: req.user.username,
      email: req.user.email,
      lastLoginAt: req.user.lastLoginAt,
      createdAt: req.user.createdAt,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { loginUser, logoutUser, getMe };
