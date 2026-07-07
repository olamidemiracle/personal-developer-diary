const mongoose = require('mongoose');

/**
 * Diary collection.
 *
 * The core collection of this app: each document is one journal entry
 * written by the (single) administrator, structured around the four
 * prompts the "New Diary Entry" page asks for.
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

    // --- The four diary prompts ---
    workedOn: {
      type: String,
      required: [true, 'Please describe what you worked on today'],
      trim: true,
    },
    learned: {
      type: String,
      trim: true,
      default: '',
    },
    problems: {
      type: String,
      trim: true,
      default: '',
    },
    solutions: {
      type: String,
      trim: true,
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

// Full-text search across all four prompt fields and the title.
diarySchema.index({
  title: 'text',
  workedOn: 'text',
  learned: 'text',
  problems: 'text',
  solutions: 'text',
});

// Most common query pattern: "this admin's entries, most recent first".
diarySchema.index({ administrator: 1, date: -1 });

// Filtering entries by category.
diarySchema.index({ category: 1, date: -1 });

module.exports = mongoose.model('Diary', diarySchema);
