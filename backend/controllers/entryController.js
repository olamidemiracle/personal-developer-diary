const fs = require('fs');
const path = require('path');

const Diary = require('../models/Diary');
const Image = require('../models/Image');

/**
 * Deletes every given Image document AND its underlying file on disk.
 * Best-effort on the filesystem side (a missing file is not an error worth
 * failing the request over) — always removes the database record.
 */
const deleteImages = async (images) => {
  for (const image of images) {
    const filePath = path.join(__dirname, '..', 'uploads', image.filename);
    fs.unlink(filePath, () => {}); // ignore ENOENT etc — best effort
    await Image.findByIdAndDelete(image._id);
  }
};

/**
 * @desc    Get all diary entries for the logged-in administrator
 * @route   GET /api/entries?page=1&limit=20
 * @access  Private
 *
 * Real, working read against MongoDB — most recent first, with category
 * and images populated for display. `page`/`limit` are optional; omitting
 * them returns every entry (unchanged behavior for existing callers like
 * the dashboard). Pagination is here for when the entry count grows large
 * enough that loading everything on every dashboard visit stops scaling.
 */
const getEntries = async (req, res, next) => {
  try {
    const query = Diary.find({ administrator: req.user._id })
      .sort({ date: -1 })
      .populate('category', 'name slug color')
      .populate('images', 'path mimetype');

    const { page, limit } = req.query;
    if (page || limit) {
      const pageNum = Math.max(parseInt(page, 10) || 1, 1);
      const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100); // cap at 100/page
      query.skip((pageNum - 1) * limitNum).limit(limitNum);
    }

    const entries = await query;
    res.status(200).json(entries);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get a single diary entry by id
 * @route   GET /api/entries/:id
 * @access  Private
 *
 * Real, working read (Phase 7) — scoped to the logged-in administrator,
 * so one admin's entry id can never be fetched by someone else's session
 * (moot with a single admin today, but the right shape regardless).
 */
const getEntryById = async (req, res, next) => {
  try {
    const entry = await Diary.findOne({ _id: req.params.id, administrator: req.user._id })
      .populate('category', 'name slug color')
      .populate('images', 'path mimetype');

    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }

    res.status(200).json(entry);
  } catch (error) {
    next(error); // malformed :id (CastError) is handled generically -> 404
  }
};

/**
 * @desc    Create a new diary entry ("Publish")
 * @route   POST /api/entries
 * @access  Private
 *
 * Real, working write to MongoDB (Phase 6). Accepts multipart/form-data
 * (Multer already ran via the route, see routes/entryRoutes.js) so an
 * optional image can be uploaded in the same request. `date` is never
 * read from the request — it's captured server-side at the moment the
 * Diary document is created.
 */
const createEntry = async (req, res, next) => {
  try {
    const { title, category, workedOn, learned, problems, solutions } = req.body;

    const diary = await Diary.create({
      administrator: req.user._id,
      title,
      category: category || null,
      workedOn,
      learned: learned || '',
      problems: problems || '',
      solutions: solutions || '',
      // `date` is intentionally omitted — the schema default (Date.now)
      // captures both the date and time of publication automatically.
    });

    // If an image was uploaded alongside the entry, record its metadata
    // in the Image collection and link it back to this Diary document.
    if (req.file) {
      const image = await Image.create({
        administrator: req.user._id,
        diary: diary._id,
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: `/uploads/${req.file.filename}`,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });

      diary.images.push(image._id);
      await diary.save();
    }

    const populated = await Diary.findById(diary._id)
      .populate('category', 'name slug color')
      .populate('images', 'path mimetype');

    res.status(201).json({ message: 'Entry published successfully', entry: populated });
  } catch (error) {
    // Clean up the uploaded file if the DB write failed, so it doesn't
    // linger orphaned on disk.
    if (req.file) {
      fs.unlink(path.join(__dirname, '..', 'uploads', req.file.filename), () => {});
    }
    next(error);
  }
};

/**
 * @desc    Update a diary entry
 * @route   PUT /api/entries/:id
 * @access  Private
 *
 * Real, working update (Phase 7). Accepts the same multipart/form-data
 * shape as create. Image handling:
 *   - a new file uploaded  -> old image(s) deleted, new one attached
 *   - `removeImage=true`   -> old image(s) deleted, none attached
 *   - neither              -> existing image(s) left untouched
 * `date` is never updated — it stays fixed at whenever the entry was
 * originally published (the schema field is `immutable`).
 */
const updateEntry = async (req, res, next) => {
  try {
    const entry = await Diary.findOne({
      _id: req.params.id,
      administrator: req.user._id,
    }).populate('images');

    if (!entry) {
      if (req.file) {
        fs.unlink(path.join(__dirname, '..', 'uploads', req.file.filename), () => {});
      }
      return res.status(404).json({ message: 'Entry not found' });
    }

    const { title, category, workedOn, learned, problems, solutions, removeImage } = req.body;

    entry.title = title;
    entry.category = category || null;
    entry.workedOn = workedOn;
    entry.learned = learned || '';
    entry.problems = problems || '';
    entry.solutions = solutions || '';

    const wantsImageRemoved = req.file || removeImage === 'true' || removeImage === true;

    if (wantsImageRemoved && entry.images.length) {
      await deleteImages(entry.images);
      entry.images = [];
    }

    if (req.file) {
      const image = await Image.create({
        administrator: req.user._id,
        diary: entry._id,
        filename: req.file.filename,
        originalName: req.file.originalname,
        path: `/uploads/${req.file.filename}`,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });
      entry.images.push(image._id);
    }

    await entry.save();

    const populated = await Diary.findById(entry._id)
      .populate('category', 'name slug color')
      .populate('images', 'path mimetype');

    res.status(200).json({ message: 'Entry updated successfully', entry: populated });
  } catch (error) {
    if (req.file) {
      fs.unlink(path.join(__dirname, '..', 'uploads', req.file.filename), () => {});
    }
    next(error);
  }
};

/**
 * @desc    Delete a diary entry
 * @route   DELETE /api/entries/:id
 * @access  Private
 *
 * Real, working delete (Phase 7). Every attached Image is deleted first
 * (both its database record and its file on disk) so nothing orphaned is
 * left behind, then the Diary document itself is removed.
 */
const deleteEntry = async (req, res, next) => {
  try {
    const entry = await Diary.findOne({
      _id: req.params.id,
      administrator: req.user._id,
    }).populate('images');

    if (!entry) {
      return res.status(404).json({ message: 'Entry not found' });
    }

    await deleteImages(entry.images);
    await Diary.findByIdAndDelete(entry._id);

    res.status(200).json({ message: 'Entry deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getEntries, getEntryById, createEntry, updateEntry, deleteEntry };
