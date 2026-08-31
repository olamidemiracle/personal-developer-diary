const cloudinary = require('cloudinary').v2;

/**
 * Configures the Cloudinary SDK from env vars. Every image upload in this
 * app (diary entry images, blog cover images, inline editor images) goes
 * through this — Render's free-tier filesystem is ephemeral and was
 * silently deleting every locally-stored upload on each redeploy.
 */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = cloudinary;
