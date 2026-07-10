const mongoose = require('mongoose');

/**
 * Blog collection.
 *
 * Deliberately separate from the Diary collection (models/Diary.js) —
 * blog posts and diary entries are two independent content types that
 * must never mix. There is no relationship between this model and
 * Diary/Category/Image at all; the only thing they share is the same
 * Administrator as author, which is expected (single-admin app).
 *
 * Kept intentionally minimal to match what the "New Blog Post" page
 * actually asks for: a title and a large body of content. No category,
 * mood, tags, or image fields — those are diary-entry concepts.
 */
const blogSchema = new mongoose.Schema(
  {
    administrator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Administrator',
      required: [true, 'Blog post must belong to an administrator'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: 3,
      maxlength: 150,
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
      trim: true,
    },
  },
  {
    timestamps: true, // createdAt is what the homepage sorts/displays by
  }
);

// Full-text search across title and content, and fast "most recent first"
// sorting for the homepage's blog list.
blogSchema.index({ title: 'text', content: 'text' });
blogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Blog', blogSchema);
