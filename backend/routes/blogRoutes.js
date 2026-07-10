const express = require('express');
const { getBlogs, getBlogById, createBlog, updateBlog, deleteBlog } = require('../controllers/blogController');
const { protect } = require('../middleware/authMiddleware');
const { validateBlogPost } = require('../middleware/validateMiddleware');

const router = express.Router();

// Public — visitors can read blog posts without logging in.
// Private — only the administrator can create/edit/delete, reusing the
// exact same `protect` middleware used everywhere else in this app.
router.route('/').get(getBlogs).post(protect, validateBlogPost, createBlog);

router.route('/:id').get(getBlogById).put(protect, validateBlogPost, updateBlog).delete(protect, deleteBlog);

module.exports = router;
