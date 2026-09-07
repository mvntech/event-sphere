const mongoose = require('mongoose');
const env = require('../../src/config/env');

/**
 * integration tests run against a dedicated database, never the app's own.
 * the name is forced to end in `_test` and asserted below, so a misconfigured
 * MONGODB_URI can't point the suite at real data.
 */
const TEST_DB_NAME = 'eventsphere_ci_test';

/**
 * swaps the database name in a connection string. done by hand rather than
 * with `new URL()`, because an Atlas seed list puts several comma-separated
 * hosts in the authority, which the WHATWG URL parser rejects outright.
 */
function buildTestUri(uri = env.MONGODB_URI, dbName = TEST_DB_NAME) {
  const match = /^(mongodb(?:\+srv)?:\/\/[^/?]+)(?:\/[^?]*)?(\?.*)?$/.exec(uri.trim());
  if (!match) throw new Error(`Could not parse MONGODB_URI to derive a test database name`);

  if (!dbName.endsWith('_test')) {
    throw new Error(`Refusing to build a URI for "${dbName}" — a test database name must end in _test.`);
  }

  const [, authority, query = ''] = match;
  return `${authority}/${dbName}${query}`;
}

async function connect() {
  const uri = buildTestUri();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 });

  if (!mongoose.connection.name.endsWith('_test')) {
    await mongoose.disconnect();
    throw new Error(
      `Refusing to run tests against database "${mongoose.connection.name}" — it is not a _test database.`
    );
  }

  // compound/unique indexes are part of what we assert, so build them up front.
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
}

/** wipes documents between tests without tearing down the indexes. */
async function clear() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

async function disconnect() {
  if (mongoose.connection.readyState === 1 && mongoose.connection.name.endsWith('_test')) {
    await mongoose.connection.dropDatabase();
  }
  await mongoose.disconnect();
}

module.exports = { connect, clear, disconnect, buildTestUri, TEST_DB_NAME };
