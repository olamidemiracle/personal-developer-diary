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

module.exports = { validateLogin, validateDiaryEntry, validateBlogPost };

/**
 * Validates the "New Blog Post" request body:
 * { title, content, excerpt?, category?, tags?, status? }.
 * Kept deliberately separate from validateDiaryEntry — blog posts and
 * diary entries are unrelated content types with their own rules, even
 * though both happen to require a title.
 */
function validateBlogPost(req, res, next) {
  const errors = [];
  const { title, content, excerpt, category, tags, status } = req.body || {};

  if (!title || typeof title !== 'string' || !title.trim()) {
    errors.push('Title is required.');
  } else if (title.trim().length < 3) {
    errors.push('Title must be at least 3 characters long.');
  } else if (title.trim().length > 150) {
    errors.push('Title must be 150 characters or fewer.');
  }

  if (!content || typeof content !== 'string' || !content.trim()) {
    errors.push('Content is required.');
  }

  if (excerpt !== undefined && excerpt !== null && typeof excerpt !== 'string') {
    errors.push('Excerpt must be text.');
  } else if (typeof excerpt === 'string' && excerpt.length > 300) {
    errors.push('Excerpt must be 300 characters or fewer.');
  }

  if (category !== undefined && category !== null && typeof category !== 'string') {
    errors.push('Category must be text.');
  }

  // `tags` arrives as a JSON string over multipart/form-data (FormData
  // can't carry real arrays), so accept either shape here — the
  // controller is responsible for parsing the string form before saving.
  if (tags !== undefined && typeof tags !== 'string' && !Array.isArray(tags)) {
    errors.push('Tags must be a list of text values.');
  }

  if (status !== undefined && !['draft', 'published'].includes(status)) {
    errors.push('Status must be either "draft" or "published".');
  }

  if (errors.length > 0) {
    return res.status(400).json({ message: 'Validation failed', errors });
  }

  next();
}
