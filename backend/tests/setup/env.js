// keeps the suite out of production code paths and quiets the logger.
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
