const mongoose = require('mongoose');

/**
 * Image collection.
 *
 * Multer (configured in Phase 1, middleware/uploadMiddleware.js) writes the
 * actual file bytes to backend/uploads/ on disk. This collection stores the
 * *metadata* about each uploaded file and links it back to the administrator
 * who uploaded it and, optionally, the diary entry it illustrates.
 *
 * Keeping this as its own collection (rather than embedding file metadata
 * directly in the Diary document) lets one image be uploaded and later
 * attached/detached from an entry, and keeps the Diary document lean.
 */
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const imageSchema = new mongoose.Schema(
  {
    administrator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Administrator',
      required: [true, 'Image must be linked to the uploading administrator'],
      index: true,
    },
    diary: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Diary',
      default: null, // null until (or unless) the image is attached to an entry
      index: true,
    },
    filename: {
      type: String,
      required: [true, 'Stored filename is required'],
      trim: true,
    },
    originalName: {
      type: String,
      required: [true, 'Original filename is required'],
      trim: true,
    },
    path: {
      type: String,
      required: [true, 'Storage path/URL is required'],
      trim: true,
    },
    mimetype: {
      type: String,
      required: true,
      enum: {
        values: ALLOWED_MIME_TYPES,
        message: '{VALUE} is not a supported image type',
      },
    },
    size: {
      type: Number,
      required: true,
      min: [1, 'File size must be greater than 0 bytes'],
      max: [5 * 1024 * 1024, 'File size must not exceed 5MB'],
    },
  },
  { timestamps: true } // adds createdAt / updatedAt
);

// --- Indexes ---
// Speeds up "all images for this diary entry" and "all images this admin uploaded".
imageSchema.index({ diary: 1, createdAt: -1 });
imageSchema.index({ administrator: 1, createdAt: -1 });

module.exports = mongoose.model('Image', imageSchema);
