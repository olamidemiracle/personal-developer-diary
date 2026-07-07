/**
 * Seed script — creates the ONE Administrator account for this app.
 *
 * There is no public registration route. This script is the only way an
 * admin account gets created, and it refuses to run if an administrator
 * already exists (the schema's `singleton` unique index would reject a
 * second document anyway, but we check first for a clean error message).
 *
 * Usage:
 *   1. Set ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD in backend/.env
 *   2. Run:  npm run seed   (from the backend/ folder)
 */
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Administrator = require('../models/Administrator');

const run = async () => {
  const { ADMIN_USERNAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  if (!ADMIN_USERNAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error(
      'Missing ADMIN_USERNAME, ADMIN_EMAIL, or ADMIN_PASSWORD in backend/.env — cannot seed.'
    );
    process.exit(1);
  }

  if (ADMIN_PASSWORD.length < 6) {
    console.error('ADMIN_PASSWORD must be at least 6 characters long.');
    process.exit(1);
  }

  await connectDB();

  try {
    const existingCount = await Administrator.countDocuments();

    if (existingCount > 0) {
      console.log('An administrator already exists. Refusing to create another.');
      console.log('If you need to reset credentials, update the existing document directly.');
      process.exit(0);
    }

    const admin = await Administrator.create({
      username: ADMIN_USERNAME,
      email: ADMIN_EMAIL.toLowerCase(),
      password: ADMIN_PASSWORD, // hashed automatically by the pre('save') hook
    });

    console.log('Administrator account created successfully:');
    console.log(`  username: ${admin.username}`);
    console.log(`  email:    ${admin.email}`);
    console.log('You can now log in from the frontend login page.');
    process.exit(0);
  } catch (error) {
    console.error(`Failed to seed administrator: ${error.message}`);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
};

run();
