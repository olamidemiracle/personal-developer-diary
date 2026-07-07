/**
 * Lightweight, dependency-free request validation.
 * Keeps validation explicit and easy to extend without pulling in
 * express-validator or joi for a small, single-purpose API.
 */

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

/**
 * Validates the login request body: { email, password }.
 */
const validateLogin = (req, res, next) => {
  const errors = [];
  const { email, password } = req.body || {};

  if (!email || typeof email !== 'string' || !email.trim()) {
    errors.push('Email is required.');
  } else if (!EMAIL_REGEX.test(email.trim())) {
    errors.push('Email must be a valid email address.');
  }

  if (!password || typeof password !== 'string') {
    errors.push('Password is required.');
  } else if (password.length < 6) {
    errors.push('Password must be at least 6 characters long.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  // Normalize before it reaches the controller
  req.body.email = email.trim().toLowerCase();

  next();
};

/**
 * Validates the "New Diary Entry" request body:
 * { title, category?, workedOn, learned?, problems?, solutions? }.
 * Runs after Multer (if an image was included), so req.body is populated
 * from the multipart form fields either way.
 */
const validateDiaryEntry = (req, res, next) => {
  const errors = [];
  const { title, workedOn } = req.body || {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    errors.push('Title is required.');
  } else if (title.trim().length < 3) {
    errors.push('Title must be at least 3 characters long.');
  } else if (title.trim().length > 150) {
    errors.push('Title must be 150 characters or fewer.');
  }

  if (!workedOn || typeof workedOn !== 'string' || !workedOn.trim()) {
    errors.push('"What I Worked On Today" is required.');
  }

  if (errors.length > 0) {
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  next();
};

module.exports = { validateLogin, validateDiaryEntry };
