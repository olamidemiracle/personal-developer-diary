const express = require('express');
const { loginUser, logoutUser, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { validateLogin } = require('../middleware/validateMiddleware');
const { checkLoginRateLimit } = require('../middleware/rateLimitMiddleware');

const router = express.Router();

// Public
router.post('/login', checkLoginRateLimit, validateLogin, loginUser);

// Private (require a valid session)
router.post('/logout', protect, logoutUser);
router.get('/me', protect, getMe);

// Deliberately no POST /register route — there is only one administrator
// account, created via the seed script (backend/seed/createAdmin.js).

module.exports = router;
