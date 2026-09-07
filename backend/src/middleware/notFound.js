const ApiError = require('../utils/ApiError');

/** any unmatched /api route becomes a proper 404 JSON payload. */
module.exports = (req, _res, next) => next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
