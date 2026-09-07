const ApiError = require('../utils/ApiError');

/** Restricts a route to the given roles. Must run after `authMiddleware`. */
const roleGuard = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized());
  if (!roles.includes(req.user.role)) {
    return next(ApiError.forbidden(`This area is restricted to: ${roles.join(', ')}`));
  }
  return next();
};

module.exports = roleGuard;
