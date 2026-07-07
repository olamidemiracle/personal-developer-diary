const express = require('express');
const { getCategories, createCategory } = require('../controllers/categoryController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', getCategories); // public — the public site's Categories page uses this too
router.post('/', protect, createCategory);

module.exports = router;
