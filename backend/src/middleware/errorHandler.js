const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const env = require('../config/env');

/** central error handler — controllers throw, this shapes the response. */
module.exports = (err, req, res, _next) => {
  let error = err;

  if (error instanceof mongoose.Error.ValidationError) {
    error = ApiError.badRequest(
      'Validation failed',
      Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }))
    );
  } else if (error instanceof mongoose.Error.CastError) {
    error = ApiError.badRequest(`Invalid value for ${err.path}`);
  } else if (error && error.code === 11000) {
    const detail = error.writeErrors?.[0]?.err ?? error;
    let field = Object.keys(detail.keyPattern ?? detail.keyValue ?? {}).pop();
    let value = detail.keyValue?.[field];

    if (!field) {
      // e.g. `... dup key: { expoRef: ObjectId('..'), label: "A1" }`
      const dup = /dup key:\s*\{(.+?)\}\s*$/s.exec(detail.errmsg ?? error.message ?? '');
      if (dup) {
        const pairs = [...dup[1].matchAll(/(\w+):\s*(?:"([^"]*)"|ObjectId\('([^']*)'\)|([^,]+))/g)];
        // The last non-id key is the human-meaningful one (a label, an email).
        const meaningful = pairs.filter(([, key]) => !/^(_id|.*Ref)$/.test(key)).pop() ?? pairs.pop();
        if (meaningful) {
          field = meaningful[1];
          value = (meaningful[2] ?? meaningful[3] ?? meaningful[4] ?? '').trim();
        }
      }
    }

    error = field
      ? ApiError.conflict(
          value ? `"${value}" is already taken — ${field} must be unique.` : `That ${field} is already in use.`,
          [{ field, message: 'Already in use' }]
        )
      : ApiError.conflict('That value is already in use.');
  } else if (!(error instanceof ApiError)) {
    error = new ApiError(error.statusCode || 500, error.message || 'Something went wrong');
    error.isOperational = false;
  }

  const level = error.statusCode >= 500 ? 'error' : 'warn';
  logger.log(level, `${req.method} ${req.originalUrl} -> ${error.statusCode} ${error.message}`, {
    stack: error.statusCode >= 500 ? err.stack : undefined,
  });

  const body = { success: false, message: error.statusCode >= 500 && env.NODE_ENV === 'production' ? 'Something went wrong' : error.message };
  if (error.errors) body.errors = error.errors;
  if (env.NODE_ENV !== 'production' && error.statusCode >= 500) body.stack = err.stack;

  return res.status(error.statusCode).json(body);
};
