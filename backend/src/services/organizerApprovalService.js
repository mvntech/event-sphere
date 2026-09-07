const User = require('../models/User');
const ApiError = require('../utils/ApiError');

/** true once at least one organizer can actually sign in. */
async function hasActiveOrganizer() {
  const count = await User.countDocuments({
    role: 'organizer',
    // `null` covers accounts that predate this field; they stay usable.
    $or: [{ organizerApprovalStatus: 'approved' }, { organizerApprovalStatus: null }],
  });
  return count > 0;
}

/**
 * the status a newly-registered account should start with.
 * non-organizers are unaffected and get `null`.
 */
async function initialStatusFor(role) {
  if (role !== 'organizer') return null;
  return (await hasActiveOrganizer()) ? 'pending' : 'approved';
}

/**
 * blocks sign-in for an organizer awaiting or refused approval.
 * anything else — including a grandfathered `null` — is allowed through.
 */
function assertCanSignIn(user) {
  if (user.role !== 'organizer') return;

  if (user.organizerApprovalStatus === 'pending') {
    throw ApiError.forbidden(
      'Your organizer account is waiting for approval from an existing organizer. You will be emailed once it is reviewed.'
    );
  }
  if (user.organizerApprovalStatus === 'rejected') {
    throw ApiError.forbidden('Your organizer account request was not approved. Contact the event team if you think this is wrong.');
  }
}

module.exports = { hasActiveOrganizer, initialStatusFor, assertCanSignIn };
