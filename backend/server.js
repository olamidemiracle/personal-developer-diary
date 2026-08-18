const dotenv = require('dotenv');

dotenv.config();

const connectDB = require('./config/db');
const app = require('./app');

const isProduction = process.env.NODE_ENV === 'production';

// --- Fail fast on unsafe production config ---
// A weak/default/missing JWT secret is the single most damaging
// misconfiguration this app could ship with — anyone who saw the sample
// value in .env.example could forge sessions. Refuse to boot rather than
// run insecurely.
const INSECURE_DEFAULT_SECRETS = ['replace_this_with_a_long_random_secret', 'dev_only_change_me_9f8a7d6c5b4e3f2a1'];

if (isProduction) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error(
      'FATAL: JWT_SECRET is missing or too short for production. Set a random string of 32+ characters.'
    );
    process.exit(1);
  }
  if (INSECURE_DEFAULT_SECRETS.includes(process.env.JWT_SECRET)) {
    console.error('FATAL: JWT_SECRET is still set to a known sample/default value. Change it before deploying.');
    process.exit(1);
  }
}

// Connect to MongoDB
connectDB();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// --- Graceful shutdown ---
// Platforms like Render send SIGTERM on redeploy/scale-down; closing the
// HTTP server and the MongoDB connection cleanly avoids dropped requests
// and connection leaks.
const shutdown = (signal) => {
  console.log(`${signal} received, shutting down gracefully…`);
  server.close(() => {
    console.log('HTTP server closed.');
    const mongoose = require('mongoose');
    mongoose.connection.close(false).then(() => {
      console.log('MongoDB connection closed.');
      process.exit(0);
    });
  });

  // Force-exit if shutdown hangs for some reason
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = server;
