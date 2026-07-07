const mongoose = require('mongoose');

/**
 * Category collection.
 *
 * Lets the administrator group diary entries (e.g. "Bug Fixes",
 * "Learning", "Career", "Side Projects"). Referenced by the Diary
 * collection via `Diary.category` (see models/Diary.js).
 */
const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      minlength: 2,
      maxlength: 40,
      unique: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    color: {
      type: String,
      trim: true,
      default: '#6366f1',
      match: [/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/, 'Color must be a valid hex code'],
    },
  },
  { timestamps: true } // adds createdAt / updatedAt
);

/**
 * Auto-generate a URL-safe slug from the name whenever it changes,
 * so categories can be referenced/filterable by a clean identifier
 * (e.g. "Bug Fixes" -> "bug-fixes") without the client having to supply one.
 */
categorySchema.pre('save', function generateSlug(next) {
  if (!this.isModified('name')) return next();

  this.slug = this.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  next();
});

// --- Indexes ---
// name and slug already get unique indexes from `unique: true` above.
// A text index supports quick "search categories by name/description".
categorySchema.index({ name: 'text', description: 'text' });

module.exports = mongoose.model('Category', categorySchema);
