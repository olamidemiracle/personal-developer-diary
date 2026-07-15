const mongoose = require('mongoose');

/**
 * Blog collection.
 *
 * Still deliberately separate from Diary/Category/Image (see
 * models/Diary.js) — blog posts and diary entries are two independent
 * content types that must never mix. The only thing shared with the
 * rest of the app is the same Administrator as author (single-admin app)
 * and the same JWT auth system for writes.
 *
 * This is the "professional blogging platform" version of the schema —
 * everything a Medium/Dev.to/Ghost-style post needs, without borrowing
 * any of Diary's fields (category here is a plain string, not a ref to
 * the Diary-only Category collection, so the two systems stay decoupled
 * even though both happen to use the word "category").
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

    // URL-friendly, unique identifier derived from the title, e.g.
    // "How I Fixed My Memory Leak" -> "how-i-fixed-my-memory-leak".
    // Used for SEO-friendly URLs (blog-post.html?slug=...) instead of a
    // raw database id.
    slug: {
      type: String,
      unique: true,
      index: true,
    },

    // Short summary shown on cards/feeds and used as the meta description
    // for SEO. Auto-derived from `content` on save if left blank.
    excerpt: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },

    // Rich HTML from the editor (headings, bold/italic, lists, code
    // blocks, tables, embedded video iframes, inline images, etc.).
    // Trusted content: this is a single-administrator app, so the only
    // person who can ever write this HTML is the site owner themselves —
    // the same trust model as any personal CMS.
    content: {
      type: String,
      required: [true, 'Content is required'],
    },

    // Optional hero/cover image, stored the same way Diary images are —
    // a path Multer already wrote to backend/uploads/, referenced here
    // directly rather than via the Image collection (keeps Blog fully
    // self-contained and independent of Diary's Image model).
    coverImage: {
      path: { type: String, default: null },
      originalName: { type: String, default: null },
      mimetype: { type: String, default: null },
      size: { type: Number, default: null },
    },

    category: {
      type: String,
      trim: true,
      maxlength: 60,
      default: '',
      index: true,
    },

    tags: {
      type: [String],
      default: [],
      set: (tags) =>
        Array.isArray(tags)
          ? [...new Set(tags.map((t) => String(t).trim().toLowerCase()).filter(Boolean))]
          : [],
    },

    status: {
      type: String,
      enum: {
        values: ['draft', 'published'],
        message: '{VALUE} is not a valid status',
      },
      default: 'draft',
      index: true,
    },

    // Set the first time a post transitions to "published"; stays fixed
    // after that even if the post is later edited (edits update
    // `updatedAt` via timestamps, not this field).
    publishedAt: {
      type: Date,
      default: null,
    },

    // Estimated minutes to read, computed from word count on every save
    // (see the pre-save hook below) — never set directly by the client.
    readingTime: {
      type: Number,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: true,
  }
);

// --- Indexes ---
blogSchema.index({ title: 'text', excerpt: 'text', content: 'text', tags: 'text' });
blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ category: 1, status: 1 });

/**
 * Strips HTML tags down to plain text — used for both the excerpt
 * fallback and the reading-time word count, so neither counts markup as
 * "words."
 */
function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

blogSchema.pre('save', function computeDerivedFields(next) {
  const plainText = stripHtml(this.content);

  // Auto-generate an excerpt from the content if the author didn't write
  // one themselves.
  if (!this.excerpt) {
    this.excerpt = plainText.length > 220 ? `${plainText.slice(0, 220).trim()}…` : plainText;
  }

  // Reading time: average adult silent-reading speed (~200 wpm),
  // rounded up so "1 minute read" never means "a few seconds."
  const wordCount = plainText.split(' ').filter(Boolean).length;
  this.readingTime = Math.max(1, Math.ceil(wordCount / 200));

  // Regenerate the slug whenever the title changes (including on first
  // save), but never touch it otherwise — existing links should keep
  // working across ordinary content edits.
  if (this.isModified('title') || !this.slug) {
    const base = this.title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
    // A short random/time-based suffix keeps slugs unique even if two
    // posts share an identical title, without an extra DB round-trip.
    this.slug = `${base}-${Date.now().toString(36)}`;
  }

  // The first time a post is published, stamp `publishedAt` — but only
  // once; later edits to an already-published post must not reset it.
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }

  next();
});

module.exports = mongoose.model('Blog', blogSchema);
