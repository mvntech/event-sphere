class ApiError extends Error {
  constructor(statusCode, message, errors) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(msg = 'Bad request', errors) { return new ApiError(400, msg, errors); }
  static unauthorized(msg = 'Not authenticated') { return new ApiError(401, msg); }
  static forbidden(msg = 'You do not have permission to access this resource') { return new ApiError(403, msg); }
  static notFound(msg = 'Resource not found') { return new ApiError(404, msg); }
  static conflict(msg = 'Conflict', errors) { return new ApiError(409, msg, errors); }
  static tooMany(msg = 'Too many requests') { return new ApiError(429, msg); }
  static internal(msg = 'Something went wrong') { return new ApiError(500, msg); }
}

module.exports = ApiError;
