const rateLimit = require('express-rate-limit');
const env = require('../config/env');

const message = (msg) => ({ success: false, message: msg });

/** general API limiter. */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 300 : 2000,
  standardHeaders: true,
  legacyHeaders: false,
  message: message('Too many requests — please slow down and try again shortly.'),
});

/** tighter limiter for credential endpoints (login / register / reset). */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 20 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: message('Too many authentication attempts — please try again in a few minutes.'),
});

/** password-reset requests are email-sending, so limited separately and harder. */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 5 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: message('Too many password reset requests — please try again later.'),
});

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: env.NODE_ENV === 'production' ? 20 : 40,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? `user:${req.user._id}` : `ip:${req.ip}`),
  message: message(
    'You have used your AI requests for this hour. The rest of the app keeps working — try again shortly.'
  ),
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  // no keyGenerator: the library's default is already per-IP and normalizes
  // IPv6 correctly, which is precisely what this endpoint needs.
  message: message(
    'That is several messages in a short time. Try again in an hour, or sign in and use the in-app feedback form.'
  ),
});

module.exports = { apiLimiter, authLimiter, passwordResetLimiter, aiLimiter, contactLimiter };
