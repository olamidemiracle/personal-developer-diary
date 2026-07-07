// Upload controller — handles responses after Multer has processed a file.
// Wiring into entries/avatars happens in Phase 4. For now this confirms
// that Multer is configured correctly end-to-end.

// @desc    Upload a single image and return its stored path/URL
// @route   POST /api/uploads
// @access  Private
const uploadImage = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  res.status(201).json({
    message: 'File uploaded successfully',
    file: {
      filename: req.file.filename,
      path: `/uploads/${req.file.filename}`,
      size: req.file.size,
      mimetype: req.file.mimetype,
    },
  });
};

module.exports = { uploadImage };
