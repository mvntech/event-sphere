const http = require('http');
const app = require('./app');
const env = require('./config/env');
const logger = require('./utils/logger');
const { connectDB } = require('./config/db');
const { initSocket, closeSocket } = require('./services/socketService');

const server = http.createServer(app);

async function warnAboutStaleUniqueIndexes() {
  const mongoose = require('mongoose');

  try {
    for (const Model of Object.values(mongoose.models)) {
      const name = Model.collection.name;
      if (!(await mongoose.connection.db.listCollections({ name }).hasNext())) continue;

      const declared = new Set(Model.schema.indexes().map(([key]) => Object.keys(key).sort().join('|')));

      for (const index of await Model.collection.indexes()) {
        if (!index.unique || index.name === '_id_') continue;

        const key = Object.keys(index.key).sort().join('|');
        const known = declared.has(key) || Object.keys(index.key).every((field) => Model.schema.path(field));

        if (!known) {
          logger.warn(
            `Stale UNIQUE index "${index.name}" on ${name} references fields this schema does not have — ` +
              'it will reject writes.'
          );
        }
      }
    }
  } catch (error) {
    // diagnostics must never stop the server booting.
    logger.warn('Could not check indexes', { message: error.message });
  }
}

async function bootstrap() {
  try {
    await connectDB();
  } catch (err) {
    logger.error('Could not connect to MongoDB — check MONGODB_URI', { message: err.message });
    process.exit(1);
  }

  await warnAboutStaleUniqueIndexes();

  // real-time layer shares the HTTP server, so one port serves both.
  initSocket(server);

  server.listen(env.PORT, () => {
    logger.info(`EventSphere API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
    logger.info(`Health check: http://localhost:${env.PORT}/api/health`);
  });
}

function shutdown(signal) {
  logger.info(`${signal} received — shutting down`);
  closeSocket().finally(() => {
    server.close(() => {
      require('mongoose').connection.close(false).finally(() => process.exit(0));
    });
  });
  setTimeout(() => process.exit(1), 10000).unref();
}

['SIGINT', 'SIGTERM'].forEach((sig) => process.on(sig, () => shutdown(sig)));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: reason instanceof Error ? reason.message : String(reason) });
});
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', { message: err.message, stack: err.stack });
  process.exit(1);
});

bootstrap();

module.exports = server;
