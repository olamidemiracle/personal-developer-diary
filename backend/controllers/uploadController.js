// Upload controller — handles responses after Multer/Cloudinary has
// processed a file (see middleware/uploadMiddleware.js).

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
      filename: req.file.filename, // Cloudinary public_id
      path: req.file.path, // Cloudinary secure URL
      size: req.file.size,
      mimetype: req.file.mimetype,
    },
  });
};

module.exports = { uploadImage };
