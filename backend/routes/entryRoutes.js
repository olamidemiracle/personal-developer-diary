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

router.use(protect); // every entry route requires authentication

router
  .route('/')
  .get(getEntries)
  .post(upload.single('image'), validateDiaryEntry, createEntry);

router
  .route('/:id')
  .get(getEntryById)
  .put(upload.single('image'), validateDiaryEntry, updateEntry)
  .delete(deleteEntry);

module.exports = router;
