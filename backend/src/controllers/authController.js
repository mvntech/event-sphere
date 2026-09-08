const ms = require('../utils/ms');
const env = require('../config/env');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { ok, created } = require('../utils/apiResponse');
const logger = require('../utils/logger');
const organizerApproval = require('../services/organizerApprovalService');
const emailService = require('../services/emailService');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  randomToken,
  sha256,
} = require('../utils/token');

const REFRESH_COOKIE = 'es_refresh';
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;
const MAX_SESSIONS_PER_USER = 10;

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: ms(env.JWT_REFRESH_TTL),
    path: '/',
  };
}

/** mints a rotated refresh token, records its hash on the user, and sets the cookie. */
async function issueSession(res, user, req) {
  const jti = randomToken(16);
  const refreshToken = signRefreshToken(user, jti);

  user.sessions.push({
    jti,
    tokenHash: sha256(refreshToken),
    userAgent: (req.headers['user-agent'] || '').slice(0, 255),
    ip: req.ip,
    expiresAt: new Date(Date.now() + ms(env.JWT_REFRESH_TTL)),
  });

  // drop expired sessions, then cap how many devices stay signed in.
  user.sessions = user.sessions.filter((s) => s.expiresAt > new Date());
  if (user.sessions.length > MAX_SESSIONS_PER_USER) {
    user.sessions = user.sessions.slice(-MAX_SESSIONS_PER_USER);
  }
  await user.save();

  res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());

  return { accessToken: signAccessToken(user), expiresIn: ms(env.JWT_ACCESS_TTL) };
}

const readRefreshToken = (req) =>
  (req.cookies && req.cookies[REFRESH_COOKIE]) || (req.body && req.body.refreshToken) || null;

// POST /api/auth/register
const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, consentGiven } = req.body;

  if (await User.exists({ email })) {
    throw ApiError.conflict('That email is already registered', [
      { field: 'email', message: 'Already in use' },
    ]);
  }

  // organizers start inert unless they are the first one.
  const organizerApprovalStatus = await organizerApproval.initialStatusFor(role);

  const user = new User({ name, email, role, consentGiven, organizerApprovalStatus });
  await user.setPassword(password);
  await user.save();

  logger.info('User registered', { userId: String(user._id), role, organizerApprovalStatus });

  // an organizer awaiting approval gets an account but no session — there is
  // nothing they may do until an existing organizer reviews them.
  if (organizerApprovalStatus === 'pending') {
    return created(
      res,
      { user: user.toPublic(), pendingApproval: true },
      'Account created. An existing organizer needs to approve it before you can sign in.'
    );
  }

  // re-select with `sessions` so issueSession can append to a populated array.
  const withSessions = await User.findById(user._id).select('+sessions');
  const tokens = await issueSession(res, withSessions, req);

  return created(res, { user: user.toPublic(), ...tokens }, 'Account created');
});

// POST /api/auth/login
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+passwordHash +sessions');
  // same message either way so the endpoint can't be used to enumerate accounts.
  if (!user || !(await user.comparePassword(password))) {
    throw ApiError.unauthorized('Incorrect email or password');
  }

  // checked after the password so a wrong password never reveals that an
  // account exists but is unapproved.
  organizerApproval.assertCanSignIn(user);

  const tokens = await issueSession(res, user, req);
  logger.info('User logged in', { userId: String(user._id), role: user.role });
  return ok(res, { user: user.toPublic(), ...tokens }, 'Signed in');
});

// POST /api/auth/refresh — silent access-token renewal, with refresh rotation
const refresh = asyncHandler(async (req, res) => {
  const token = readRefreshToken(req);
  if (!token) throw ApiError.unauthorized('Missing refresh token');

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
    throw ApiError.unauthorized('Refresh token is invalid or expired');
  }

  const user = await User.findById(payload.sub).select('+sessions');
  if (!user) throw ApiError.unauthorized('Account no longer exists');

  const hash = sha256(token);
  const index = user.sessions.findIndex((s) => s.jti === payload.jti && s.tokenHash === hash);
  if (index === -1) {
    // token verified but isn't on record: it was rotated away, revoked, or replayed.
    throw ApiError.unauthorized('Session is no longer valid — please sign in again');
  }

  user.sessions.splice(index, 1);
  const tokens = await issueSession(res, user, req);
  return ok(res, { user: user.toPublic(), ...tokens }, 'Session refreshed');
});

// POST /api/auth/logout
const logout = asyncHandler(async (req, res) => {
  const token = readRefreshToken(req);

  if (token) {
    try {
      const payload = verifyRefreshToken(token);
      await User.updateOne({ _id: payload.sub }, { $pull: { sessions: { jti: payload.jti } } });
    } catch {
      // an unreadable token just means there is nothing to revoke.
    }
  }

  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });
  return ok(res, null, 'Signed out');
});

// POST /api/auth/forgot-password
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email }).select('+passwordResetTokenHash +passwordResetExpires');

  // always answer identically — never reveal whether the address has an account.
  const genericMessage = 'If an account exists for that email, a reset link is on its way.';

  if (!user) {
    logger.warn('Password reset requested for unknown email');
    return ok(res, null, genericMessage);
  }

  const token = randomToken(32);
  user.passwordResetTokenHash = sha256(token);
  user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await user.save();

  try {
    const { previewUrl } = await emailService.sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      token,
    });
    return ok(res, env.NODE_ENV === 'production' ? null : { previewUrl }, genericMessage);
  } catch (err) {
    // don't leave a half-armed reset token behind if delivery failed.
    user.passwordResetTokenHash = null;
    user.passwordResetExpires = null;
    await user.save();
    logger.error('Password reset email failed', { message: err.message });
    throw ApiError.internal('We could not send the reset email right now. Please try again shortly.');
  }
});

// POST /api/auth/reset-password
const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;

  const user = await User.findOne({
    passwordResetTokenHash: sha256(token),
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetTokenHash +passwordResetExpires +sessions');

  if (!user) throw ApiError.badRequest('This reset link is invalid or has expired. Request a new one.');

  await user.setPassword(password);
  user.passwordResetTokenHash = null;
  user.passwordResetExpires = null;
  user.sessions = []; // sign every device out after a reset.
  await user.save();

  res.clearCookie(REFRESH_COOKIE, { ...refreshCookieOptions(), maxAge: undefined });

  emailService
    .sendPasswordChangedEmail({ to: user.email, name: user.name })
    .catch((err) => logger.error('Password-changed notice failed', { message: err.message }));

  logger.info('Password reset completed', { userId: String(user._id) });
  return ok(res, null, 'Password updated — you can now sign in with your new password.');
});

module.exports = {
  register,
  login,
  refresh,
  logout,
  forgotPassword,
  resetPassword,
  REFRESH_COOKIE,
};
