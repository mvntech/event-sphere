const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signAccessToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role, type: 'access' }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
  });
}

/**
 * refresh tokens carry a random `jti` so a single token can be revoked
 * (logout) without invalidating every session the user has open.
 */
function signRefreshToken(user, jti) {
  return jwt.sign({ sub: String(user._id), role: user.role, type: 'refresh', jti }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL,
  });
}

function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
  if (payload.type !== 'access') throw new Error('Wrong token type');
  return payload;
}

function verifyRefreshToken(token) {
  const payload = jwt.verify(token, env.JWT_REFRESH_SECRET);
  if (payload.type !== 'refresh') throw new Error('Wrong token type');
  return payload;
}

const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  randomToken,
  sha256,
};
