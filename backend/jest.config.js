module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/setup/env.js'],
  // integration tests share one database, so they run serially.
  maxWorkers: 1,
  /*
   * 30s was enough per test in isolation but not across a whole run: every
   * suite talks to a shared Atlas cluster, and by the time the later files
   * start, round-trip latency has pushed the slowest tests past the limit.
   * The result was a suite that passed file by file and failed as a whole,
   * which reads as a broken build rather than a slow network.
   */
  testTimeout: 90000,
  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
};
