const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

/**
 * Spins up a throwaway, in-process MongoDB for a single test file — never
 * the real database from backend/.env. Each test file gets its own server
 * (simpler and fully isolated between files, at the cost of a couple of
 * extra seconds of startup per file, which is fine at this suite's size).
 */
let mongoServer;

async function connect() {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
}

async function closeDatabase() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
}

async function clearDatabase() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}

module.exports = { connect, closeDatabase, clearDatabase };
