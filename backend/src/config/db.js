const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

mongoose.set('strictQuery', true);

async function connectDB(uri = env.MONGODB_URI) {
  mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
  mongoose.connection.on('error', (err) => logger.error('MongoDB error', { message: err.message }));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));

  await mongoose.connect(uri, {
    // connection pooling
    maxPoolSize: 20,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 10000,
  });

  return mongoose.connection;
}

// GET /api/health
function dbStatus() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting', 'uninitialized'];
  return {
    state: states[mongoose.connection.readyState] ?? 'unknown',
    readyState: mongoose.connection.readyState,
    name: mongoose.connection.name ?? null,
    host: mongoose.connection.host ?? null,
  };
}

module.exports = { connectDB, dbStatus };
