const Category = require('../models/Category');

/**
 * @desc    Get all categories
 * @route   GET /api/categories
 * @access  Public (the public site's Categories page needs this too)
 */
const getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.status(200).json(categories);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a new category
 * @route   POST /api/categories
 * @access  Private (administrator only)
 */
const createCategory = async (req, res, next) => {
  try {
    const { name, description, color } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Category name is required' });
    }

    const category = await Category.create({
      name: name.trim(),
      description: description || '',
      color: color || undefined, // let the schema default apply if omitted
    });

    res.status(201).json(category);
  } catch (error) {
    next(error);
  }
};

module.exports = { getCategories, createCategory };
