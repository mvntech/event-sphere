const { verifyAccessToken } = require('../utils/token');
const User = require('../models/User');

/**
 * attaches `req.user` when a valid token is present, but never rejects.
 * Used on browse endpoints that serve both signed-out visitors and signed-in
 * users who should see a little more (an organizer's own drafts, say).
 */
module.exports = async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (!token) return next();

  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub);
    if (user && !(user.passwordChangedAt && payload.iat * 1000 < user.passwordChangedAt.getTime() - 1000)) {
      req.user = user;
    }
  } catch {
    // an invalid or expired token just means "treat this as a guest".
  }

  return next();
};
