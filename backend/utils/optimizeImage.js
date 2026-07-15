const fs = require('fs');
const path = require('path');

/**
 * Resizes and compresses an image file in place, using `sharp`.
 *
 * Deliberately defensive: image optimization is a nice-to-have, not
 * something that should ever take down an upload. If `sharp` fails to
 * load (e.g. a platform where its native binary didn't install cleanly)
 * or errors while processing a specific file, this quietly leaves the
 * original, unoptimized file exactly as Multer wrote it, rather than
 * failing the request.
 *
 * @param {string} absolutePath - full path to the file Multer just saved
 * @param {object} [options]
 * @param {number} [options.maxWidth=1600] - resize down to at most this width
 * @param {number} [options.quality=80] - JPEG/WebP compression quality
 * @returns {Promise<void>}
 */
async function optimizeImage(absolutePath, { maxWidth = 1600, quality = 80 } = {}) {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (_err) {
    return; // sharp isn't available — keep the original file as-is
  }

  try {
    const ext = path.extname(absolutePath).toLowerCase();
    const tempPath = `${absolutePath}.optimizing`;

    let pipeline = sharp(absolutePath).rotate().resize({ width: maxWidth, withoutEnlargement: true });

    if (ext === '.png') {
      pipeline = pipeline.png({ quality, compressionLevel: 8 });
    } else if (ext === '.webp') {
      pipeline = pipeline.webp({ quality });
    } else if (ext === '.gif') {
      return; // sharp doesn't re-encode animated GIFs safely here — leave untouched
    } else {
      pipeline = pipeline.jpeg({ quality, mozjpeg: true });
    }

    await pipeline.toFile(tempPath);
    fs.renameSync(tempPath, absolutePath);
  } catch (_err) {
    // Best-effort only — an optimization failure should never break the
    // upload itself. Clean up any partial temp file and move on.
    const tempPath = `${absolutePath}.optimizing`;
    fs.unlink(tempPath, () => {});
  }
}

module.exports = { optimizeImage };
