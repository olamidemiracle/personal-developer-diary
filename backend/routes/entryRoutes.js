const express = require('express');
const {
  getEntries,
  getEntryById,
  createEntry,
  updateEntry,
  deleteEntry,
} = require('../controllers/entryController');
const { protect } = require('../middleware/authMiddleware');
const { validateDiaryEntry } = require('../middleware/validateMiddleware');
const upload = require('../middleware/uploadMiddleware');

const router = express.Router();

router
  .route('/')
  .get(getEntries) // Public
  .post(
    protect,
    upload.single('image'),
    validateDiaryEntry,
    createEntry
  );

router
  .route('/:id')
  .get(getEntryById) // Public
  .put(
    protect,
    upload.single('image'),
    validateDiaryEntry,
    updateEntry
  )
  .delete(
    protect,
    deleteEntry
  );

module.exports = router;
