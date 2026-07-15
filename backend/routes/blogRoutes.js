const express = require('express');
const {
  getBlogs,
  getBlogById,
  createBlog,
  updateBlog,
  deleteBlog,
  uploadBlogImage,
} = require('../controllers/blogController');
const { protect, optionalAuth } = require('../middleware/authMiddleware');
const { validateBlogPost } = require('../middleware/validateMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

// Editor utility route registered before the generic "/:idOrSlug" GET
// route below — it's POST-only so there's no real conflict, but keeping
// literal paths above param routes is the clearer convention.
// Upload a single image (cover or inline content image) and get back a
// URL, without creating/touching any Blog document.
router.post('/upload-image', protect, upload.single('image'), uploadBlogImage);

// Public — visitors can read published posts without logging in.
// `optionalAuth` additionally lets the logged-in admin see drafts too,
// without requiring a login for everyone else.
router.get('/', optionalAuth, getBlogs);
router.get('/:idOrSlug', optionalAuth, getBlogById);

// Private — only the administrator can write, reusing the exact same
// `protect` middleware used everywhere else in this app.
router.post('/', protect, upload.single('coverImage'), validateBlogPost, createBlog);
router.put('/:id', protect, upload.single('coverImage'), validateBlogPost, updateBlog);
router.delete('/:id', protect, deleteBlog);

module.exports = router;
