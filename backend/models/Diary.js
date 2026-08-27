const mongoose = require('mongoose');

/**
 * Diary collection.
 *
 * The core collection of this app: each document is one journal entry
 * written by the (single) administrator. `content` is freeform rich HTML
 * from the editor — the author structures their own subtitles rather
 * than filling in fixed prompts (this replaced an earlier version with
 * four fixed fields: workedOn/learned/problems/solutions).
 *
 * Relationships:
 *   - administrator (required)  1 Administrator ---* Diary   (author)
 *   - category      (optional)  1 Category      ---* Diary   (grouping)
 *   - images        (optional)  1 Diary         ---* Image   (attachments)
 *
 * Date/time:
 *   - `date` is captured automatically at publish time (server-side,
 *     `default: Date.now`) — it is never sent by the client. A single
 *     Date value carries both the calendar date and the time; the
 *     frontend formats the two parts separately for display.
 *   - `createdAt` / `updatedAt` are automatic (`timestamps: true`).
 */
const diarySchema = new mongoose.Schema(
  {
    administrator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Administrator',
      required: [true, 'Diary entry must belong to an administrator'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: 3,
      maxlength: 150,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
      index: true,
    },

    // Rich HTML from the editor — freeform, the author structures their
    // own subtitles (H1/H2/H3) rather than filling in fixed prompts.
    // Trusted content: the only person who can ever write it is the
    // logged-in administrator, same trust model as Blog.content.
    content: {
      type: String,
      required: [true, 'Content is required'],
    },

    // Short plain-text summary for cards/search, auto-derived from
    // `content` on every save (see the pre-save hook below) — there's no
    // separate excerpt input for diary entries, unlike blog posts.
    excerpt: {
      type: String,
      trim: true,
      maxlength: 300,
      default: '',
    },

    images: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Image',
      },
    ],

    // Auto-captured at publish time — never accepted from client input.
    date: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    timestamps: true, // adds createdAt / updatedAt automatically
  }
);

// --- Indexes ---

// Full-text search across title, content, and the auto-derived excerpt.
diarySchema.index({ title: 'text', content: 'text', excerpt: 'text' });

// Most common query pattern: "this admin's entries, most recent first".
diarySchema.index({ administrator: 1, date: -1 });

// Filtering entries by category.
diarySchema.index({ category: 1, date: -1 });

/** Strips HTML tags down to plain text, for the excerpt fallback. */
function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Diary entries have no separate excerpt input (unlike blog posts), so
// this always regenerates the excerpt whenever content changes rather
// than only when it's empty — there's nothing else that could have set
// it deliberately.
diarySchema.pre('save', function autoExcerpt(next) {
  if (this.isModified('content') || !this.excerpt) {
    const plainText = stripHtml(this.content);
    this.excerpt = plainText.length > 220 ? `${plainText.slice(0, 220).trim()}…` : plainText;
  }
  next();
});

module.exports = mongoose.model('Diary', diarySchema);
