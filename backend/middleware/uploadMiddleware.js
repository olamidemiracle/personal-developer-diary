const multer = require('multer');
const cloudinary = require('../config/cloudinary');

/**
 * Uploads go straight to Cloudinary instead of local disk — Render's
 * free-tier filesystem is ephemeral and wipes anything written to disk on
 * every redeploy. Cloudinary also auto-optimizes (format/quality) on
 * upload via the `transformation` option below, which replaces the old
 * sharp-based post-processing step entirely.
 *
 * This is a small hand-written Multer storage engine (rather than the
 * multer-storage-cloudinary package) because that package's peer
 * dependency only supports the old Cloudinary v1 SDK — writing ~20 lines
 * against the official v2 SDK directly avoids the version conflict and
 * means the req.file field mapping below (path/filename/size) is exactly
 * what this app controls, not a third-party package's internal contract.
 */
class CloudinaryStorage {
  _handleFile(req, file, cb) {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'dev-diary',
        resource_type: 'image',
        // Animated GIFs aren't safe to re-encode with a quality/format
        // transform (same reasoning the old sharp step used) — leave as-is.
        transformation: file.mimetype === 'image/gif' ? undefined : [{ quality: 'auto', fetch_format: 'auto' }],
      },
      (error, result) => {
        if (error) return cb(error);
        cb(null, {
          path: result.secure_url, // full Cloudinary URL — used directly as <img src>
          filename: result.public_id, // needed later to delete the asset
          size: result.bytes,
        });
      }
    );
    file.stream.pipe(uploadStream);
  }

  _removeFile(req, file, cb) {
    cloudinary.uploader.destroy(file.filename, cb);
  }
}

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const fileFilter = (req, file, cb) => {
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files (jpeg, png, webp, gif) are allowed'), false);
  }
};

const maxSizeMb = Number(process.env.MAX_UPLOAD_SIZE_MB) || 5;

const upload = multer({
  storage: new CloudinaryStorage(),
  fileFilter,
  limits: { fileSize: maxSizeMb * 1024 * 1024 },
});

module.exports = upload;
