const Blog = require('../models/Blog');

/**
 * @desc    Get all blog posts
 * @route   GET /api/blogs
 * @access  Public — visitors read blog posts without logging in
 */
const getBlogs = async (req, res, next) => {
  try {
    const blogs = await Blog.find({}).sort({ createdAt: -1 });
    res.status(200).json(blogs);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get a single blog post by id
 * @route   GET /api/blogs/:id
 * @access  Public
 */
const getBlogById = async (req, res, next) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }

    res.status(200).json(blog);
  } catch (error) {
    next(error); // malformed :id (CastError) is handled generically -> 404
  }
};

/**
 * @desc    Create a new blog post ("Publish")
 * @route   POST /api/blogs
 * @access  Private (administrator only — reuses the same `protect`
 *          middleware as everything else in this app)
 */
const createBlog = async (req, res, next) => {
  try {
    const { title, content } = req.body;

    const blog = await Blog.create({
      administrator: req.user._id,
      title,
      content,
    });

    res.status(201).json({ message: 'Blog post published successfully', blog });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update a blog post
 * @route   PUT /api/blogs/:id
 * @access  Private (administrator only)
 */
const updateBlog = async (req, res, next) => {
  try {
    const blog = await Blog.findOne({ _id: req.params.id, administrator: req.user._id });

    if (!blog) {
      return res.status(404).json({ message: 'Blog post not found' });
    }

    const { title, content } = req.body;
    blog.title = title;
    blog.content = content;
    await blog.save();

    res.status(200).json({ message: 'Blog post updated successfully', blog });
  } catch (error) {
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

    await Blog.findByIdAndDelete(blog._id);
    res.status(200).json({ message: 'Blog post deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getBlogs, getBlogById, createBlog, updateBlog, deleteBlog };
