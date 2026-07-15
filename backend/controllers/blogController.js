const fs = require('fs');
const path = require('path');

const Blog = require('../models/Blog');
const { optimizeImage } = require('../utils/optimizeImage');

/**
 * Parses `tags` out of a request body that may have arrived either as a
 * real array (JSON request) or as a JSON-encoded string (multipart/
 * form-data, which can't carry arrays natively — the editor sends
 * `formData.append('tags', JSON.stringify([...]))`).
 */
function parseTags(rawTags) {
  if (Array.isArray(rawTags)) return rawTags;
  if (typeof rawTags === 'string' && rawTags.trim()) {
    try {
      const parsed = JSON.parse(rawTags);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_err) {
      // Fall back to treating it as a single comma-separated string,
      // in case something posts tags a simpler way.
      return rawTags.split(',');
    }
  }
  return [];
}

/** Deletes a blog's cover image file from disk, if it has one. Best-effort. */
function deleteCoverImageFile(blog) {
  if (blog?.coverImage?.path) {
    const filename = path.basename(blog.coverImage.path);
    fs.unlink(path.join(__dirname, '..', 'uploads', filename), () => {});
  }
}

/**
 * @desc    Get all blog posts (with optional filtering)
 * @route   GET /api/blogs?category=&tag=&search=
 * @access  Public, but visibility differs by who's asking:
 *          - Anonymous visitors / non-admins: only "published" posts
 *          - The logged-in administrator: everything, including drafts
 *            (there's nowhere else in this app to review a draft before
 *            publishing it, since blog posts are intentionally kept off
 *            the Dashboard — this is how the admin still gets to see
 *            their own unfinished posts)
 */
const getBlogs = async (req, res, next) => {
  try {
    const filter = req.user ? {} : { status: 'published' };

    if (req.query.category) filter.category = new RegExp(`^${req.query.category}$`, 'i');
    if (req.query.tag) filter.tags = req.query.tag.toLowerCase();
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    const blogs = await Blog.find(filter)
      .sort({ publishedAt: -1, createdAt: -1 })
      .populate('administrator', 'username');

    res.status(200).json(blogs);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get a single blog post by slug or id
 * @route   GET /api/blogs/:idOrSlug
 * @access  Public for published posts; the administrator can also view
 *          their own drafts (e.g. to preview/continue editing)
 */
const getBlogById = async (req, res, next) => {
  try {
    const { idOrSlug } = req.params;
    const isObjectId = /^[a-f\d]{24}$/i.test(idOrSlug);

    const blog = await Blog.findOne(isObjectId ? { _id: idOrSlug } : { slug: idOrSlug }).populate(
      'administrator',
      'username'
    );

    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }

    if (blog.status !== 'published' && !req.user) {
      // Drafts don't exist as far as an anonymous visitor is concerned —
      // 404, not 403, so a guessed/shared draft link reveals nothing.
      return res.status(404).json({ message: 'Blog post not found' });
    }

    res.status(200).json(blog);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Upload a single image for use inside the blog editor (cover
 *          image or an inline content image) and get back its URL.
 * @route   POST /api/blogs/upload-image
 * @access  Private (administrator only)
 *
 * This does not touch any Blog document — it's a standalone utility the
 * editor calls when the admin inserts an image, exactly like the
 * existing /api/uploads endpoint, but kept blog-specific so this feature
 * stays self-contained.
 */
const uploadBlogImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image file was uploaded' });
    }

    const absolutePath = path.join(__dirname, '..', 'uploads', req.file.filename);
    await optimizeImage(absolutePath);

    // Re-check size after optimization for an accurate figure in the response.
    const finalSize = fs.existsSync(absolutePath) ? fs.statSync(absolutePath).size : req.file.size;

    res.status(201).json({
      url: `/uploads/${req.file.filename}`,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      size: finalSize,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new blog post (draft or published)
 * @route   POST /api/blogs
 * @access  Private (administrator only)
 */
const createBlog = async (req, res, next) => {
  try {
    const { title, content, excerpt, category, status } = req.body;

    const blog = new Blog({
      administrator: req.user._id,
      title,
      content,
      excerpt: excerpt || '',
      category: category || '',
      tags: parseTags(req.body.tags),
      status: status === 'published' ? 'published' : 'draft',
    });

    if (req.file) {
      const absolutePath = path.join(__dirname, '..', 'uploads', req.file.filename);
      await optimizeImage(absolutePath);
      blog.coverImage = {
        path: `/uploads/${req.file.filename}`,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: fs.existsSync(absolutePath) ? fs.statSync(absolutePath).size : req.file.size,
      };
    }

    await blog.save();
    await blog.populate('administrator', 'username');

    res.status(201).json({
      message: blog.status === 'published' ? 'Blog post published successfully' : 'Draft saved successfully',
      blog,
    });
  } catch (error) {
    if (req.file) {
      fs.unlink(path.join(__dirname, '..', 'uploads', req.file.filename), () => {});
    }
    next(error);
  }
};

/**
 * @desc    Update a blog post (including changing draft -> published)
 * @route   PUT /api/blogs/:id
 * @access  Private (administrator only)
 */
const updateBlog = async (req, res, next) => {
  try {
    const blog = await Blog.findOne({ _id: req.params.id, administrator: req.user._id });

    if (!blog) {
      if (req.file) fs.unlink(path.join(__dirname, '..', 'uploads', req.file.filename), () => {});
      return res.status(404).json({ message: 'Blog post not found' });
    }

    const { title, content, excerpt, category, status, removeCoverImage } = req.body;

    blog.title = title;
    blog.content = content;
    blog.excerpt = excerpt || '';
    blog.category = category || '';
    blog.tags = parseTags(req.body.tags);
    if (status === 'draft' || status === 'published') blog.status = status;

    const wantsCoverRemoved = req.file || removeCoverImage === 'true' || removeCoverImage === true;
    if (wantsCoverRemoved && blog.coverImage?.path) {
      deleteCoverImageFile(blog);
      blog.coverImage = { path: null, originalName: null, mimetype: null, size: null };
    }

    if (req.file) {
      const absolutePath = path.join(__dirname, '..', 'uploads', req.file.filename);
      await optimizeImage(absolutePath);
      blog.coverImage = {
        path: `/uploads/${req.file.filename}`,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: fs.existsSync(absolutePath) ? fs.statSync(absolutePath).size : req.file.size,
      };
    }

    await blog.save();
    await blog.populate('administrator', 'username');

    res.status(200).json({
      message: blog.status === 'published' ? 'Blog post updated successfully' : 'Draft updated successfully',
      blog,
    });
  } catch (error) {
    if (req.file) {
      fs.unlink(path.join(__dirname, '..', 'uploads', req.file.filename), () => {});
    }
    next(error);
  }
};

/**
 * @desc    Delete a blog post
 * @route   DELETE /api/blogs/:id
 * @access  Private (administrator only)
 */
const deleteBlog = async (req, res, next) => {
  try {
    const blog = await Blog.findOne({ _id: req.params.id, administrator: req.user._id });

    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }

    deleteCoverImageFile(blog);
    await Blog.findByIdAndDelete(blog._id);

    res.status(200).json({ message: 'Blog post deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getBlogs, getBlogById, createBlog, updateBlog, deleteBlog, uploadBlogImage };
