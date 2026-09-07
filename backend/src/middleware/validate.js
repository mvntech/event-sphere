const ApiError = require('../utils/ApiError');

const toFieldErrors = (error) =>
  error.issues.map((i) => ({ field: i.path.join('.') || '_', message: i.message }));

/**
 * validates `req.body` against a Zod schema and replaces it with the parsed
 * (coerced, stripped) result so controllers never see invalidated input.
 */
const validate = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return next(ApiError.badRequest('Validation failed', toFieldErrors(result.error)));
  }
  req.body = result.data;
  return next();
};

/**
 * same, for query strings. the parsed result lands on `req.validatedQuery`
 * because `req.query` is a getter on newer express versions.
 */
const validateQuery = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    return next(ApiError.badRequest('Invalid query parameters', toFieldErrors(result.error)));
  }
  req.validatedQuery = result.data;
  return next();
};

/** rejects malformed route params (e.g. a non-ObjectId `:id`) before any DB call. */
const validateParams = (schema) => (req, _res, next) => {
  const result = schema.safeParse(req.params);
  if (!result.success) {
    return next(ApiError.badRequest('Invalid request path', toFieldErrors(result.error)));
  }
  return next();
};

module.exports = validate;
module.exports.validate = validate;
module.exports.validateQuery = validateQuery;
module.exports.validateParams = validateParams;
