const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * Administrator model.
 *
 * This app has exactly ONE administrator account — there is no public
 * registration. The `singleton` field is a constant (always 1) with a
 * unique index, which makes it impossible for MongoDB to ever store a
 * second Administrator document. The one admin account is created by
 * the seed script (backend/seed/createAdmin.js), never via an API route.
 */
const administratorSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false, // never returned by default in queries
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    singleton: {
      type: Number,
      default: 1,
      unique: true, // guarantees only one Administrator document can ever exist
    },
  },
  { timestamps: true }
);

// Hash password before saving, only if it was modified
administratorSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Instance method to compare plaintext password with hashed password
administratorSchema.methods.comparePassword = function comparePassword(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Administrator', administratorSchema);
