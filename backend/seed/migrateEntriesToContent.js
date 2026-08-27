/**
 * One-time migration — converts diary entries from the old fixed-prompt
 * shape (workedOn/learned/problems/solutions) to the new freeform
 * `content` field.
 *
 * Reads with `.lean()` so it sees the raw old fields regardless of what's
 * currently in the Diary schema (lean() bypasses hydration and returns
 * exactly what's physically in MongoDB), and writes with a raw
 * `updateOne()` so it never runs full document validation — safe to run
 * either before or after the new schema/code is deployed.
 *
 * Idempotent: skips any entry that already has non-empty `content`.
 *
 * Usage (from backend/):
 *   npm run migrate:entries-content
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Diary = require('../models/Diary');

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Turns the four old fixed fields into one HTML blob, each as its own subtitle. */
function buildContentFromLegacyFields(doc) {
  const sections = [
    ['What I Worked On Today', doc.workedOn],
    ['What I Learned Today', doc.learned],
    ['Problems I Faced', doc.problems],
    ['How I Solved Them', doc.solutions],
  ];

  return sections
    .filter(([, text]) => text && String(text).trim())
    .map(([heading, text]) => `<h3>${heading}</h3><p>${escapeHtml(text).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

function buildExcerpt(content) {
  const plainText = stripHtml(content);
  return plainText.length > 220 ? `${plainText.slice(0, 220).trim()}…` : plainText;
}

const run = async () => {
  await connectDB();

  try {
    const entries = await Diary.find().lean();
    let migrated = 0;
    let skipped = 0;

    for (const entry of entries) {
      if (entry.content && String(entry.content).trim()) {
        skipped += 1;
        continue;
      }

      const content = buildContentFromLegacyFields(entry) || '<p></p>';

      await Diary.updateOne(
        { _id: entry._id },
        {
          $set: { content, excerpt: buildExcerpt(content) },
          $unset: { workedOn: '', learned: '', problems: '', solutions: '' },
        }
      );
      migrated += 1;
    }

    console.log(`Entries migrated: ${migrated}, already had content: ${skipped}.`);
    process.exit(0);
  } catch (error) {
    console.error(`Migration failed: ${error.message}`);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
};

run();
