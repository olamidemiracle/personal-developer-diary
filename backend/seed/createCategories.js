/**
 * Seed script — creates a starter set of categories, matching the ones
 * the public site previously used as sample data (js/data.js).
 *
 * Idempotent: safe to run multiple times, skips any category whose name
 * already exists rather than erroring or duplicating it.
 *
 * Usage (from backend/):
 *   npm run seed:categories
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Category = require('../models/Category');

const STARTER_CATEGORIES = [
  { name: 'Bug Fixes', description: 'Root causes chased down and squashed.', color: '#f87171' },
  { name: 'Learning', description: 'New concepts, courses, and rabbit holes.', color: '#34d399' },
  { name: 'Side Projects', description: 'Late-night builds and weekend experiments.', color: '#5b9cff' },
  { name: 'Career', description: 'Interviews, reviews, and the long game.', color: '#fb923c' },
  { name: 'Tooling', description: 'Editor configs, scripts, and workflow tweaks.', color: '#c084fc' },
];

const run = async () => {
  await connectDB();

  try {
    let created = 0;
    let skipped = 0;

    for (const cat of STARTER_CATEGORIES) {
      const exists = await Category.findOne({ name: cat.name });
      if (exists) {
        skipped += 1;
        continue;
      }
      await Category.create(cat);
      created += 1;
    }

    console.log(`Categories seeded: ${created} created, ${skipped} already existed.`);
    process.exit(0);
  } catch (error) {
    console.error(`Failed to seed categories: ${error.message}`);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
};

run();
